import { NextRequest, NextResponse } from 'next/server';
import { getTenantById, tenantExists } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';
import { getInstanceState } from '@/lib/greenApi';

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

    const tenant = await getTenantById(tenantId);
    if (!tenant?.greenApiInstanceId || !tenant?.greenApiToken) {
      return NextResponse.json({ error: 'יש להזין ולשמור Instance ID ו-API Token לפני בדיקת החיבור' }, { status: 400 });
    }

    const result = await getInstanceState(tenant.greenApiInstanceId, tenant.greenApiToken);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'שגיאה בבדיקת החיבור';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
