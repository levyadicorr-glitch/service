import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { createServiceRequest, getCustomerById, getServiceRequests } from '@/lib/db';

export async function GET() {
  try {
    const requests = await getServiceRequests();
    return NextResponse.json({ requests });
  } catch (err: any) {
    console.error('Error fetching requests:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const customerId = formData.get('customerId') as string;
    const storeName = formData.get('storeName') as string;
    const toolOwnerName = formData.get('toolOwnerName') as string;
    const hasWarranty = formData.get('hasWarranty') === 'true';
    const agreedToInspectionFee = formData.get('agreedToInspectionFee') === 'true';
    
    const toolImage = formData.get('toolImage') as File | null;
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
      for (let i = 0; i < 3; i++) {
        const img = formData.get(`toolImage_${i}`) as File | null;
        if (img && img.size > 0) {
          toolImageFiles.push(img);
        }
      }
    }

    if (!customerId || !storeName || !toolOwnerName || toolImageFiles.length === 0) {
      return NextResponse.json({ error: 'שדות חובה חסרים' }, { status: 400 });
    }

    const customer = await getCustomerById(customerId);
    if (!customer) {
      return NextResponse.json({ error: 'לקוח לא נמצא במערכת' }, { status: 404 });
    }

    if (!agreedToInspectionFee) {
      return NextResponse.json({ error: 'חובה לאשר את דמי הבדיקה בסך 150 ש"ח' }, { status: 400 });
    }

    if (hasWarranty && (!warrantyReceiptImage || warrantyReceiptImage.size === 0)) {
      return NextResponse.json({ error: 'חובה לצרף תמונת חשבונית או תעודת אחריות' }, { status: 400 });
    }

    // Ensure public/uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Process up to 3 tool images with sharp
    const toolImageUrls: string[] = [];
    for (let i = 0; i < Math.min(toolImageFiles.length, 3); i++) {
      const file = toolImageFiles[i];
      const toolImageBuffer = Buffer.from(await file.arrayBuffer());
      const toolImageFilename = `tool-${crypto.randomUUID()}.webp`;
      const toolImagePath = path.join(uploadsDir, toolImageFilename);
      await sharp(toolImageBuffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(toolImagePath);
      toolImageUrls.push(`/uploads/${toolImageFilename}`);
    }

    // Save warranty image if exists (Compressed WebP)
    let warrantyReceiptImageUrl = undefined;
    if (hasWarranty && warrantyReceiptImage && warrantyReceiptImage.size > 0) {
      const warrantyReceiptBuffer = Buffer.from(await warrantyReceiptImage.arrayBuffer());
      const warrantyReceiptFilename = `warranty-${crypto.randomUUID()}.webp`;
      const warrantyReceiptPath = path.join(uploadsDir, warrantyReceiptFilename);
      await sharp(warrantyReceiptBuffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(warrantyReceiptPath);
      warrantyReceiptImageUrl = `/uploads/${warrantyReceiptFilename}`;
    }

    const newRequest = await createServiceRequest({
      customerId,
      storeName,
      toolOwnerName,
      hasWarranty,
      warrantyReceiptImage: warrantyReceiptImageUrl,
      toolImage: toolImageUrls[0], // for backward compatibility
      toolImages: toolImageUrls,
      agreedToInspectionFee,
    });

    return NextResponse.json({ success: true, request: newRequest });
  } catch (err: any) {
    console.error('Error creating request:', err);
    return NextResponse.json({ error: err.message || 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
