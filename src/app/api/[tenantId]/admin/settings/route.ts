import { NextRequest, NextResponse } from 'next/server';
import { getTenantById, updateTenantSettings, tenantExists } from '@/lib/db';
import { requireTenantAdmin, hashPassword } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';
import { normalizeServiceFormConfig } from '@/lib/serviceFormConfig';

export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const sharp = (await import('sharp')).default;
    const { tenantId } = await props.params;
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const formData = await req.formData();
    const businessName = formData.get('businessName') as string;
    const whatsappTemplate = formData.get('whatsappTemplate') as string;
    const partsRequestPhone = formData.get('partsRequestPhone') as string;
    const partsDeletePassword = formData.get('partsDeletePassword') as string;
    const adminWhatsappPhone = formData.get('adminWhatsappPhone') as string;
    const adminWhatsappPhone2 = formData.get('adminWhatsappPhone2') as string;
    const adminWhatsappPhone3 = formData.get('adminWhatsappPhone3') as string;
    const quoteNotificationPhones = formData.get('quoteNotificationPhones') as string;
    const greenApiInstanceId = formData.get('greenApiInstanceId') as string;
    const greenApiToken = formData.get('greenApiToken') as string;
    const password = formData.get('password') as string;
    const serviceFormConfigRaw = formData.get('serviceFormConfig') as string | null;
    const logoFile = formData.get('logo') as File | null;
    const removeLogo = formData.get('removeLogo') === 'true';

    const update: any = {};
    if (businessName) update.businessName = businessName.trim();
    if (whatsappTemplate) update.whatsappTemplate = whatsappTemplate.trim();
    if (partsRequestPhone !== null) update.partsRequestPhone = partsRequestPhone.trim();
    if (adminWhatsappPhone !== null) update.adminWhatsappPhone = adminWhatsappPhone.trim();
    if (adminWhatsappPhone2 !== null) update.adminWhatsappPhone2 = adminWhatsappPhone2.trim();
    if (adminWhatsappPhone3 !== null) update.adminWhatsappPhone3 = adminWhatsappPhone3.trim();
    if (quoteNotificationPhones !== null) update.quoteNotificationPhones = quoteNotificationPhones.trim();
    if (greenApiInstanceId !== null) update.greenApiInstanceId = greenApiInstanceId.trim();
    if (greenApiToken && greenApiToken.trim()) update.greenApiToken = greenApiToken.trim();
    if (partsDeletePassword && partsDeletePassword.trim()) update.partsDeletePassword = partsDeletePassword.trim();
    if (password && password.trim()) {
      const trimmedPassword = password.trim();
      update.adminPassword = hashPassword(trimmedPassword);
      update.adminPasswordPlain = trimmedPassword;
    }
    if (serviceFormConfigRaw) {
      try {
        update.serviceFormConfig = normalizeServiceFormConfig(JSON.parse(serviceFormConfigRaw));
      } catch {
        // Malformed config JSON — ignore it so the rest of the settings still save.
      }
    }

    if (removeLogo) {
      update.logoUrl = '';
      update.primaryColor = '';
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
      
      // Extract dynamic primary color from the logo
      try {
        const Vibrant = (await import('node-vibrant')).default;
        const palette = await Vibrant.from(webpBuffer).getPalette();
        if (palette.Vibrant) {
          update.primaryColor = palette.Vibrant.hex;
        } else if (palette.Muted) {
          update.primaryColor = palette.Muted.hex;
        } else if (palette.LightVibrant) {
          update.primaryColor = palette.LightVibrant.hex;
        }
      } catch (colorErr) {
        console.error('Error extracting color with Vibrant:', colorErr);
      }
    }

    await updateTenantSettings(tenantId, update);
    return NextResponse.json({ success: true, logoUrl: update.logoUrl, primaryColor: update.primaryColor });
  } catch (err: unknown) {
    console.error('Error updating settings:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
