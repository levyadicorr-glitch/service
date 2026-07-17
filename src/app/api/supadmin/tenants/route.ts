import { NextRequest, NextResponse } from 'next/server';
import { getTenants, createTenant, deleteTenant } from '@/lib/db';
import { hashPassword, requireSupAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';

export async function GET(req: NextRequest) {
  try {
    const denied = requireSupAdmin(req);
    if (denied) return denied;

    const tenants = await getTenants();
    return NextResponse.json({ tenants });
  } catch (err: unknown) {
    console.error('Error fetching tenants:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const denied = requireSupAdmin(req);
    if (denied) return denied;

    const body = await req.json();
    const { tenantId, businessName, adminPassword, whatsappTemplate } = body;

    if (!tenantId || !businessName || !adminPassword) {
      return NextResponse.json({ error: 'שדות חובה חסרים: מזהה סביבה, שם עסק, וסיסמת מנהל' }, { status: 400 });
    }

    // Check if tenantId format is valid (letters and numbers only, no spaces)
    if (!/^[a-zA-Z0-9]+$/.test(tenantId)) {
      return NextResponse.json({ error: 'מזהה הסביבה חייב להכיל רק אותיות באנגלית ומספרים (ללא רווחים)' }, { status: 400 });
    }

    const newTenant = await createTenant({
      id: tenantId.toLowerCase(),
      name: businessName,
      businessName: businessName,
      adminPassword: hashPassword(adminPassword),
      whatsappTemplate: whatsappTemplate || `היי! פתחנו עבורך קריאת שירות עבור הכלי שלך 🛴\nכדי שנוכל להתחיל בטיפול, לחץ על הקישור הבא ומלא את הפרטים:\n{link}\n\nתודה מצוות {businessName}!`,
    });

    // The plaintext password is returned once for the creator to hand off;
    // only a hash is stored and it is never listed again.
    const { adminPassword: _stored, ...tenantWithoutPassword } = newTenant;
    void _stored;
    return NextResponse.json({ success: true, tenant: tenantWithoutPassword });
  } catch (err: unknown) {
    console.error('Error creating tenant:', err);
    if (err instanceof Error && err.message.includes('already exists')) {
      return NextResponse.json({ error: 'מזהה סביבה זה כבר קיים במערכת. אנא בחר מזהה אחר.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const denied = requireSupAdmin(req);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'מזהה סביבה חסר' }, { status: 400 });
    }

    const deleted = await deleteTenant(tenantId);

    if (!deleted) {
      return NextResponse.json({ error: 'הסביבה לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting tenant:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
