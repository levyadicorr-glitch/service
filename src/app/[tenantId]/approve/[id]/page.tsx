import React from 'react';
import { getCustomerById, getCustomerApprovalToken } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    tenantId: string;
    id: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function ResultCard({
  tenantId,
  customerId,
  icon,
  iconClass,
  title,
  message,
  showPortalLink,
  children,
}: {
  tenantId: string;
  customerId: string;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  message: string;
  showPortalLink: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100" dir="rtl">
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl text-center max-w-md w-full shadow-2xl">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${iconClass}`}>
          {icon}
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400 mb-6 text-sm leading-relaxed">{message}</p>
        {children}
        {showPortalLink && (
          <Link
            href={`/${tenantId}/portal/${customerId}`}
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-all"
          >
            צפייה בפורטל הלקוח
          </Link>
        )}
      </div>
    </div>
  );
}

const checkIcon = (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
  </svg>
);

const errorIcon = (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const waitingIcon = (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default async function ApproveCustomerPage({ params, searchParams }: PageProps) {
  const { tenantId, id } = await params;
  const { token } = await searchParams;

  const customer = await getCustomerById(tenantId, id);

  if (!customer) {
    return (
      <ResultCard
        tenantId={tenantId}
        customerId={id}
        icon={errorIcon}
        iconClass="bg-red-500/15 text-red-400"
        title="לקוח לא נמצא"
        message="הקישור אינו תקין. אנא ודא שהקישור נכון."
        showPortalLink={false}
      />
    );
  }

  // Already approved — safe to reveal regardless of token, and lets the page
  // show a clean success state after the confirm button below redirects here.
  if (customer.approved !== false) {
    return (
      <ResultCard
        tenantId={tenantId}
        customerId={id}
        icon={checkIcon}
        iconClass="bg-emerald-500/15 text-emerald-400"
        title={`"${customer.firstName}" מאושר`}
        message="ללקוח יש גישה מלאה לפורטל ולפתיחת קריאות שירות."
        showPortalLink={true}
      />
    );
  }

  const approvalToken = await getCustomerApprovalToken(tenantId, id);
  const tokenValid = typeof token === 'string' && !!approvalToken && token === approvalToken;

  if (!tokenValid) {
    return (
      <ResultCard
        tenantId={tenantId}
        customerId={id}
        icon={errorIcon}
        iconClass="bg-red-500/15 text-red-400"
        title="קישור אישור לא תקין"
        message="הקישור פגום או לא שייך ללקוח הזה. ניתן לאשר את הלקוח מתוך ממשק הניהול."
        showPortalLink={false}
      />
    );
  }

  // Opening this page never approves the customer by itself (a WhatsApp/
  // Green API link-preview fetch could otherwise trigger it silently) —
  // approval only happens when the button below is actually tapped.
  return (
    <ResultCard
      tenantId={tenantId}
      customerId={id}
      icon={waitingIcon}
      iconClass="bg-amber-500/15 text-amber-400"
      title={`אישור לקוח: "${customer.firstName}"`}
      message="בקשת ההרשמה ממתינה לאישור שלך. לחץ לאישור כדי לתת ללקוח גישה לפורטל."
      showPortalLink={false}
    >
      <form action={`/api/${tenantId}/customers/${id}/approve`} method="POST" className="mb-3">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-2xl shadow-xl shadow-emerald-600/25 transition-all active:scale-[0.98]"
        >
          אשר את הלקוח
        </button>
      </form>
    </ResultCard>
  );
}
