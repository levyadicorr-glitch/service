import { NextRequest, NextResponse } from 'next/server';
import { createServiceRequest, getCustomerById, getServiceRequests, tenantExists, ServiceRequest, ensureIndexes } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB per file, before compression
const MAX_TOOL_IMAGES = 3;
const REPAIR_LEVELS: ReadonlyArray<ServiceRequest['repairLevel']> = ['RIDE_ONLY', 'SAFE_RIDE', 'LIKE_NEW'];

function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) {
    return 'קובץ תמונה גדול מדי (מקסימום 8MB)';
  }
  if (file.type && !file.type.startsWith('image/')) {
    return 'ניתן להעלות קבצי תמונה בלבד';
  }
  return null;
}

export async function GET(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const params = await props.params;
  try {
    const denied = requireTenantAdmin(req, params.tenantId);
    if (denied) return denied;

    await ensureIndexes(params.tenantId);

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const { requests, total } = await getServiceRequests(params.tenantId, {
      page,
      limit,
      excludeImages: true
    });
    return NextResponse.json({ requests, total, page, limit });
  } catch (err: unknown) {
    console.error('Error fetching requests:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const sharp = (await import('sharp')).default;
    const params = await props.params;
    const { tenantId } = params;
    // Public endpoint (customer form/portal) — validate the tenant before touching its DB.
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }
    const formData = await req.formData();
    const customerId = formData.get('customerId') as string;
    const storeName = formData.get('storeName') as string;
    const toolOwnerName = formData.get('toolOwnerName') as string;
    const toolOwnerPhone = formData.get('toolOwnerPhone') as string;
    const hasWarranty = formData.get('hasWarranty') === 'true';
    const agreedToInspectionFee = formData.get('agreedToInspectionFee') === 'true';
    const issueDescription = formData.get('issueDescription') as string || '';
    const comments = formData.get('comments') as string || '';
    const repairLevel = formData.get('repairLevel') as string || 'SAFE_RIDE';
    const preApprovedAmount = formData.get('preApprovedAmount') ? Number(formData.get('preApprovedAmount')) : undefined;
    const preApprovedNotes = formData.get('preApprovedNotes') as string || '';

    const warrantyReceiptImage = formData.get('warrantyReceiptImage') as File | null;

    // Extract tool images (supports multiple files or single fields)
    let toolImageFiles: File[] = [];
    const allImages = formData.getAll('toolImages') as File[];
    if (allImages && allImages.length > 0) {
      toolImageFiles = allImages.filter(f => f && f.size > 0);
    } else {
      const singleImage = formData.get('toolImage') as File | null;
      if (singleImage && singleImage.size > 0) {
        toolImageFiles.push(singleImage);
      }
      for (let i = 0; i < MAX_TOOL_IMAGES; i++) {
        const img = formData.get(`toolImage_${i}`) as File | null;
        if (img && img.size > 0) {
          toolImageFiles.push(img);
        }
      }
    }
    toolImageFiles = toolImageFiles.slice(0, MAX_TOOL_IMAGES);

    if (!customerId || !storeName || !toolOwnerName || toolImageFiles.length === 0) {
      return NextResponse.json({ error: 'שדות חובה חסרים' }, { status: 400 });
    }

    for (const file of toolImageFiles) {
      const fileError = validateImageFile(file);
      if (fileError) {
        return NextResponse.json({ error: fileError }, { status: 400 });
      }
    }
    if (warrantyReceiptImage && warrantyReceiptImage.size > 0) {
      const fileError = validateImageFile(warrantyReceiptImage);
      if (fileError) {
        return NextResponse.json({ error: fileError }, { status: 400 });
      }
    }

    const customer = await getCustomerById(tenantId, customerId);
    if (!customer) {
      return NextResponse.json({ error: 'לקוח לא נמצא במערכת' }, { status: 404 });
    }

    if (!agreedToInspectionFee) {
      return NextResponse.json({ error: 'חובה לאשר את דמי הבדיקה בסך 150 ש"ח' }, { status: 400 });
    }

    if (hasWarranty && (!warrantyReceiptImage || warrantyReceiptImage.size === 0)) {
      return NextResponse.json({ error: 'חובה לצרף תמונת חשבונית או תעודת אחריות' }, { status: 400 });
    }

    // Process up to 3 tool images with sharp to Base64 (Serverless & Vercel friendly)
    const toolImageUrls: string[] = [];
    for (const file of toolImageFiles) {
      const toolImageBuffer = Buffer.from(await file.arrayBuffer());
      const webpBuffer = await sharp(toolImageBuffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      toolImageUrls.push(`data:image/webp;base64,${webpBuffer.toString('base64')}`);
    }

    // Save warranty image if exists (Compressed WebP to Base64)
    let warrantyReceiptImageUrl = undefined;
    if (hasWarranty && warrantyReceiptImage && warrantyReceiptImage.size > 0) {
      const warrantyReceiptBuffer = Buffer.from(await warrantyReceiptImage.arrayBuffer());
      const webpBuffer = await sharp(warrantyReceiptBuffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      warrantyReceiptImageUrl = `data:image/webp;base64,${webpBuffer.toString('base64')}`;
    }

    const validRepairLevel = REPAIR_LEVELS.includes(repairLevel as ServiceRequest['repairLevel'])
      ? (repairLevel as ServiceRequest['repairLevel'])
      : 'SAFE_RIDE';

    const newRequest = await createServiceRequest(tenantId, {
      customerId,
      storeName,
      toolOwnerName,
      toolOwnerPhone: toolOwnerPhone || undefined,
      hasWarranty,
      warrantyReceiptImage: warrantyReceiptImageUrl,
      toolImage: toolImageUrls[0], // for backward compatibility
      toolImages: toolImageUrls,
      agreedToInspectionFee,
      issueDescription: issueDescription || undefined,
      comments: comments || undefined,
      repairLevel: validRepairLevel,
      preApprovedAmount: preApprovedAmount || undefined,
      preApprovedNotes: preApprovedNotes || undefined,
    });

    return NextResponse.json({ success: true, request: newRequest });
  } catch (err: unknown) {
    console.error('Error creating request:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
