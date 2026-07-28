import { NextRequest, NextResponse } from 'next/server';
import { getCustomerById, getCustomerApprovalToken, updateCustomer } from '@/lib/db';
import { checkCsrf } from '@/lib/csrf';

// Public, unauthenticated endpoint — access is gated by possession of the
// customer's unguessable approvalToken (from the one-click WhatsApp link),
// not by an admin session.
export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string; id: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const { tenantId, id } = await props.params;
  const formData = await req.formData();
  const token = formData.get('token') as string;

  const customer = await getCustomerById(tenantId, id);
  const approvalToken = await getCustomerApprovalToken(tenantId, id);
  const tokenValid = !!customer && !!approvalToken && token === approvalToken;

  if (customer && tokenValid && customer.approved === false) {
    await updateCustomer(tenantId, id, { approved: true });
  }

  return NextResponse.redirect(new URL(`/${tenantId}/approve/${id}`, req.url), 303);
}
