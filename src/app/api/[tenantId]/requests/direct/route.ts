import { NextRequest, NextResponse } from 'next/server';
import { createServiceRequest, getCustomerById, getDriverById, getTenantById, ServiceRequest } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';
import { normalizeServiceFormConfig } from '@/lib/serviceFormConfig';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOOL_IMAGES = 3;
const REPAIR_LEVELS: ReadonlyArray<ServiceRequest['repairLevel']> = ['RIDE_ONLY', 'SAFE_RIDE', 'LIKE_NEW'];

function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) return 'קובץ תמונה גדול מדי (מקסימום 8MB)';
  if (file.type && !file.type.startsWith('image/')) return 'ניתן להעלות קבצי תמונה בלבד';
  return null;
}

export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const sharp = (await import('sharp')).default;
    const params = await props.params;
    const { tenantId } = params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const formData = await req.formData();
    const customerId = formData.get('customerId') as string;
    const toolOwnerName = (formData.get('toolOwnerName') as string) || '';
    const toolOwnerPhone = (formData.get('toolOwnerPhone') as string) || '';
    const driverId = (formData.get('driverId') as string) || '';
    const hasWarranty = formData.get('hasWarranty') === 'true';
    const agreedToInspectionFee = formData.get('agreedToInspectionFee') === 'true';
    const issueDescription = (formData.get('issueDescription') as string) || '';
    const comments = (formData.get('comments') as string) || '';
    const repairLevelRaw = (formData.get('repairLevel') as string) || 'SAFE_RIDE';
    const preApprovedAmount = formData.get('preApprovedAmount') ? Number(formData.get('preApprovedAmount')) : undefined;
    const preApprovedNotes = (formData.get('preApprovedNotes') as string) || '';
    const warrantyReceiptImage = formData.get('warrantyReceiptImage') as File | null;

    if (!customerId) {
      return NextResponse.json({ error: 'נא לבחור חנות/לקוח' }, { status: 400 });
    }

    const customer = await getCustomerById(tenantId, customerId);
    if (!customer) {
      return NextResponse.json({ error: 'הלקוח לא נמצא במערכת' }, { status: 404 });
    }
    if (driverId) {
      const driver = await getDriverById(tenantId, driverId);
      if (!driver) return NextResponse.json({ error: 'נהג לא נמצא' }, { status: 400 });
    }

    const storeName = `${customer.firstName} ${customer.lastName}`;

    // Field visibility/requiredness driven by the tenant's form config.
    const tenant = await getTenantById(tenantId);
    const cfg = normalizeServiceFormConfig(tenant?.serviceFormConfig);
    const fieldEnabled = (key: string) => {
      const f = cfg.fields.find((x) => x.key === key);
      return f ? f.enabled : true;
    };
    const fieldRequired = (key: string) => {
      const f = cfg.fields.find((x) => x.key === key);
      return f ? f.enabled && f.required : false;
    };

    // Tool images (multiple field "toolImages").
    const toolImageFiles = (formData.getAll('toolImages') as File[]).filter((f) => f && f.size > 0).slice(0, MAX_TOOL_IMAGES);

    if (fieldRequired('toolImages') && toolImageFiles.length === 0) {
      return NextResponse.json({ error: 'חובה לצרף לפחות תמונה אחת של הכלי' }, { status: 400 });
    }
    for (const file of toolImageFiles) {
      const fileError = validateImageFile(file);
      if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
    }
    if (warrantyReceiptImage && warrantyReceiptImage.size > 0) {
      const fileError = validateImageFile(warrantyReceiptImage);
      if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
    }
    if (fieldEnabled('inspectionFee') && !agreedToInspectionFee) {
      return NextResponse.json({ error: `חובה לאשר את דמי הבדיקה בסך ${cfg.inspectionFeeAmount} ש"ח` }, { status: 400 });
    }
    if (fieldEnabled('warranty') && hasWarranty && (!warrantyReceiptImage || warrantyReceiptImage.size === 0)) {
      return NextResponse.json({ error: 'חובה לצרף תמונת חשבונית או תעודת אחריות' }, { status: 400 });
    }

    // Process images to compressed base64 (serverless-friendly).
    const toolImageUrls: string[] = [];
    for (const file of toolImageFiles) {
      const buf = Buffer.from(await file.arrayBuffer());
      const webp = await sharp(buf).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      toolImageUrls.push(`data:image/webp;base64,${webp.toString('base64')}`);
    }
    let warrantyReceiptImageUrl: string | undefined;
    if (hasWarranty && warrantyReceiptImage && warrantyReceiptImage.size > 0) {
      const buf = Buffer.from(await warrantyReceiptImage.arrayBuffer());
      const webp = await sharp(buf).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      warrantyReceiptImageUrl = `data:image/webp;base64,${webp.toString('base64')}`;
    }

    const validRepairLevel = REPAIR_LEVELS.includes(repairLevelRaw as ServiceRequest['repairLevel'])
      ? (repairLevelRaw as ServiceRequest['repairLevel'])
      : 'SAFE_RIDE';

    // Custom fields (id → label from config).
    const customFields: { key: string; label: string; value: string }[] = [];
    for (const f of cfg.fields) {
      if (!f.builtin && f.enabled) {
        const v = formData.get(`custom_${f.id}`);
        if (typeof v === 'string' && v.trim()) customFields.push({ key: f.id, label: f.label, value: v.trim() });
      }
    }

    const newRequest = await createServiceRequest(tenantId, {
      customerId,
      storeName,
      toolOwnerName: toolOwnerName.trim() || storeName,
      toolOwnerPhone: toolOwnerPhone.trim() || undefined,
      hasWarranty: fieldEnabled('warranty') ? hasWarranty : false,
      warrantyReceiptImage: warrantyReceiptImageUrl,
      toolImage: toolImageUrls[0],
      toolImages: toolImageUrls,
      agreedToInspectionFee: true,
      issueDescription: issueDescription.trim() || undefined,
      comments: comments.trim() || undefined,
      repairLevel: validRepairLevel,
      preApprovedAmount: preApprovedAmount || undefined,
      preApprovedNotes: preApprovedNotes.trim() || undefined,
      customFields: customFields.length > 0 ? customFields : undefined,
      status: 'WAITING_FOR_PICKUP',
      driverId: driverId || undefined,
    });

    return NextResponse.json({ success: true, request: { ...newRequest, customer } });
  } catch (err: unknown) {
    console.error('Error creating direct request:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
