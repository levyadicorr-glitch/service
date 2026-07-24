import { NextRequest, NextResponse } from 'next/server';
import { updateCustomer, getCustomerById, tenantExists } from '@/lib/db';
import { checkCsrf } from '@/lib/csrf';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const sharp = (await import('sharp')).default;
    const { tenantId, id } = await params;
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const customer = await getCustomerById(tenantId, id);
    if (!customer) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    const formData = await req.formData();
    const phone = formData.get('phone') as string;

    if (!phone || phone.trim() !== customer.phone) {
      return NextResponse.json({ error: 'מספר טלפון שגוי או חסר' }, { status: 403 });
    }

    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const address = formData.get('address') as string;
    const logoFile = formData.get('logo') as File | null;
    const removeLogo = formData.get('removeLogo') === 'true';

    const update: any = {};
    if (firstName) update.firstName = firstName.trim();
    if (lastName) update.lastName = lastName.trim();
    if (phone) update.phone = phone.trim();
    if (email !== null) update.email = email.trim();
    if (address !== null) update.address = address.trim();

    if (removeLogo) {
      update.logoUrl = '';
    } else if (logoFile && logoFile.size > 0) {
      if (!logoFile.type.startsWith('image/')) {
        return NextResponse.json({ error: 'קובץ הלוגו חייב להיות תמונה' }, { status: 400 });
      }
      
      const logoBuffer = Buffer.from(await logoFile.arrayBuffer());
      const webpBuffer = await sharp(logoBuffer)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      update.logoUrl = `data:image/webp;base64,${webpBuffer.toString('base64')}`;
    }

    const success = await updateCustomer(tenantId, id, update);
    return NextResponse.json({ success, logoUrl: update.logoUrl });
  } catch (err: unknown) {
    console.error('Error updating customer settings:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
