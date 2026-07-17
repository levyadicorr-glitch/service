import { NextRequest, NextResponse } from 'next/server';
import { getTenantById, updateTenantSettings, tenantExists } from '@/lib/db';
import { requireTenantAdmin, hashPassword } from '@/lib/auth';
import sharp from 'sharp';
import Vibrant from 'node-vibrant';
import { checkCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId } = await props.params;
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const formData = await req.formData();
    const businessName = formData.get('businessName') as string;
    const whatsappTemplate = formData.get('whatsappTemplate') as string;
    const password = formData.get('password') as string;
    const logoFile = formData.get('logo') as File | null;
    const removeLogo = formData.get('removeLogo') === 'true';

    const update: any = {};
    if (businessName) update.businessName = businessName.trim();
    if (whatsappTemplate) update.whatsappTemplate = whatsappTemplate.trim();
    if (password && password.trim()) update.adminPassword = hashPassword(password.trim());

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
