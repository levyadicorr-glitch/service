import { redirect } from 'next/navigation';
import { getCustomerById, getServiceRequestsByCustomerId, getPartRequestsByCustomerId, getPartRequestById } from '@/lib/db';
import CustomerPortal from './CustomerPortal';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    tenantId: string;
    id: string;
  }>;
}

export default async function PortalPage({ params }: PageProps) {
  const { tenantId, id } = await params;
  let customer = await getCustomerById(tenantId, id);

  if (!customer) {
    // Check if id is actually a PartRequest ID!
    const partReq = await getPartRequestById(tenantId, id);
    if (partReq) {
      redirect(`/${tenantId}/part/${id}`);
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">הקישור אינו תקין</h2>
          <p className="text-gray-600 mb-6">
            לא מצאנו לקוח או בקשת חלק שמתאימים למזהה המבוקש. אנא ודא שהקישור נכון או פנה למנהל המערכת.
          </p>
          <Link href={`/${tenantId}/admin`} className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow transition-colors">
            חזרה לניהול
          </Link>
        </div>
      </div>
    );
  }

  const { getTenantById } = await import('@/lib/db');
  const tenantObj = await getTenantById(tenantId);
  const businessName = tenantObj?.businessName || 'העסק';

  if (customer.approved === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100" dir="rtl">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl text-center max-w-md w-full shadow-2xl">
          <div className="w-16 h-16 bg-amber-500/15 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">הבקשה של &quot;{customer.firstName}&quot; ממתינה לאישור</h2>
          <p className="text-slate-400 mb-2 text-sm leading-relaxed">
            ההרשמה שלך ל-<strong>{businessName}</strong> התקבלה ונשלחה לאישור מנהל העסק. ברגע שתאושר תוכל להיכנס לפורטל ולפתוח קריאות שירות.
          </p>
          <p className="text-slate-500 text-xs">
            אם עבר זמן רב ולא קיבלת אישור, ניתן לפנות ישירות לעסק.
          </p>
        </div>
      </div>
    );
  }

  const requests = await getServiceRequestsByCustomerId(tenantId, id);
  const partRequests = await getPartRequestsByCustomerId(tenantId, id);
  const whatsappTemplate = tenantObj?.whatsappTemplate || '';
  const partsRequestPhone = tenantObj?.partsRequestPhone || '';
  const logoUrl = tenantObj?.logoUrl || '';
  const primaryColor = tenantObj?.primaryColor || '';
  const { normalizeServiceFormConfig } = await import('@/lib/serviceFormConfig');
  const serviceFormConfig = normalizeServiceFormConfig(tenantObj?.serviceFormConfig);

  return <CustomerPortal customer={customer} initialRequests={requests} initialPartRequests={partRequests} tenantId={tenantId} businessName={businessName} whatsappTemplate={whatsappTemplate} partsRequestPhone={partsRequestPhone} logoUrl={logoUrl} primaryColor={primaryColor} serviceFormConfig={serviceFormConfig} />;
}
