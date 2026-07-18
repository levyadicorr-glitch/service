import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { tenantExists, getDriverById, getServiceRequestById, markRequestsPickedUpWithSignature } from '@/lib/db';
import { checkCsrf } from '@/lib/csrf';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB per file, before compression
const MAX_BATCH = 30;

function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) {
    return 'קובץ תמונה גדול מדי (מקסימום 8MB)';
  }
  if (file.type && !file.type.startsWith('image/')) {
    return 'ניתן להעלות קבצי תמונה בלבד';
  }
  return null;
}

export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId } = await props.params;
    // Public endpoint (driver panel) — validate the tenant before touching its DB.
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const formData = await req.formData();
    const driverToken = formData.get('driverToken') as string;
    const signerName = ((formData.get('signerName') as string) || '').trim();
    const signature = formData.get('signature') as File | null;
    const photo = formData.get('photo') as File | null;

    let conditionNotesMap: Record<string, string> = {};
    try {
      conditionNotesMap = JSON.parse((formData.get('conditionNotes') as string) || '{}');
    } catch {}

    let requestIds: string[] = [];
    try {
      requestIds = JSON.parse((formData.get('requestIds') as string) || '[]');
    } catch {}
    if (!Array.isArray(requestIds) || requestIds.length === 0 || requestIds.length > MAX_BATCH
        || !requestIds.every(id => typeof id === 'string')) {
      return NextResponse.json({ error: 'רשימת קריאות לא תקינה' }, { status: 400 });
    }
    if (!signerName) {
      return NextResponse.json({ error: 'חובה למלא שם חותם' }, { status: 400 });
    }
    if (!signature || signature.size === 0) {
      return NextResponse.json({ error: 'חובה לצרף חתימה' }, { status: 400 });
    }
    for (const f of [signature, ...(photo && photo.size > 0 ? [photo] : [])]) {
      const fileError = validateImageFile(f);
      if (fileError) {
        return NextResponse.json({ error: fileError }, { status: 400 });
      }
    }

    // Capability check (same model as the driver PATCH): the caller proves identity
    // with the driver's unguessable UUID, and every request must be assigned to him.
    // Checked in full before any write — the batch is all-or-nothing.
    if (!driverToken || !(await getDriverById(tenantId, driverToken))) {
      return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
    }
    const requests = await Promise.all(requestIds.map(id => getServiceRequestById(tenantId, id)));
    if (requests.some(r => !r || r.driverId !== driverToken)) {
      return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
    }

    const signatureBuffer = await sharp(Buffer.from(await signature.arrayBuffer()))
      .flatten({ background: '#ffffff' })
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const signatureImage = `data:image/webp;base64,${signatureBuffer.toString('base64')}`;

    let photoImage: string | undefined;
    if (photo && photo.size > 0) {
      const photoBuffer = await sharp(Buffer.from(await photo.arrayBuffer()))
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      photoImage = `data:image/webp;base64,${photoBuffer.toString('base64')}`;
    }

    const updated = await markRequestsPickedUpWithSignature(tenantId, requestIds, driverToken, {
      signatureImage,
      photoImage,
      signerName,
      conditionNotesMap,
    });

    return NextResponse.json({ success: true, updated });
  } catch (err: unknown) {
    console.error('Error in driver pickup form:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
