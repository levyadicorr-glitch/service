import { NextRequest, NextResponse } from 'next/server';
import { getTenantById, updateTenantAdminPassword, tenantExists } from '@/lib/db';
import {
  createSessionToken,
  hashPassword,
  isHashedPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const { allowed } = checkRateLimit(`login_${ip}`, 5, 900000);
  if (!allowed) {
    return NextResponse.json({ error: 'יותר מדי בקשות. נסה שוב מאוחר יותר.' }, { status: 429 });
  }

  try {
    const { tenantId } = await props.params;
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const body = await req.json();
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password) {
      return NextResponse.json({ error: 'נא להזין סיסמה' }, { status: 400 });
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant?.adminPassword || !verifyPassword(password, tenant.adminPassword)) {
      return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 });
    }

    // Lazy migration: upgrade legacy plaintext passwords to a hash on first successful login.
    if (!isHashedPassword(tenant.adminPassword)) {
      await updateTenantAdminPassword(tenantId, hashPassword(password));
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(SESSION_COOKIE, createSessionToken(tenantId), sessionCookieOptions());
    return res;
  } catch (err: unknown) {
    console.error('Error during admin login:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
