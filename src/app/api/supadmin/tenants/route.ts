import { NextRequest, NextResponse } from 'next/server';
import { getTenants, createTenant } from '@/lib/db';

const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || '12341234';

function checkAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.split(' ')[1];
  return token === SUPER_ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
    }

    const tenants = await getTenants();
    return NextResponse.json({ tenants });
  } catch (err: unknown) {
    console.error('Error fetching tenants:', err);
    const errorMessage = err instanceof Error ? err.message : 'שגיאת שרת פנימית';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
    }

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
      adminPassword,
      whatsappTemplate: whatsappTemplate || `היי! פתחנו עבורך קריאת שירות עבור הכלי שלך 🛴\nכדי שנוכל להתחיל בטיפול, לחץ על הקישור הבא ומלא את הפרטים:\n{link}\n\nתודה מצוות {businessName}!`,
    });

    return NextResponse.json({ success: true, tenant: newTenant });
  } catch (err: unknown) {
    console.error('Error creating tenant:', err);
    if (err instanceof Error && err.message.includes('already exists')) {
      return NextResponse.json({ error: 'מזהה סביבה זה כבר קיים במערכת. אנא בחר מזהה אחר.' }, { status: 409 });
    }
    const errorMessage = err instanceof Error ? err.message : 'שגיאת שרת פנימית';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
