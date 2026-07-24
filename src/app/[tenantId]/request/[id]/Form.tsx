'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Customer, ServiceRequest } from '@/lib/db';
import { ServiceFormConfig, normalizeServiceFormConfig } from '@/lib/serviceFormConfig';
import ServiceRequestForm from '@/components/ServiceRequestForm';

interface FormProps {
  customer: Customer;
  tenantId: string;
  businessName: string;
  whatsappTemplate: string;
  logoUrl?: string;
  serviceFormConfig?: ServiceFormConfig;
}

export default function RequestForm({ customer, tenantId, businessName, logoUrl = '', serviceFormConfig }: FormProps) {
  const config = normalizeServiceFormConfig(serviceFormConfig);
  const storeName = `${customer.firstName} ${customer.lastName}`.trim();
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [createdRequestNumber, setCreatedRequestNumber] = useState<number | null>(null);

  const handleSuccess = (request: ServiceRequest) => {
    if (request?.requestNumber) setCreatedRequestNumber(request.requestNumber);
    setSubmitSuccess(true);
  };

  // SUCCESS SCREEN
  if (submitSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-gray-100 text-center max-w-lg mx-auto mt-10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100 shadow-inner"
        >
          <Check className="w-10 h-10 text-green-500" strokeWidth={3} />
        </motion.div>

        <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">הקריאה התקבלה בהצלחה!</h2>
        <p className="text-gray-500 mb-8 text-base leading-relaxed">
          תודה, קריאת השירות שלך נרשמה במערכת {businessName}. נציג מטעמנו יטפל בפנייה בהקדם.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 bg-gray-50/80 backdrop-blur rounded-2xl text-right text-sm text-gray-600 border border-gray-100 space-y-3.5 shadow-sm"
        >
          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
            <span className="text-gray-400 font-medium">מספר קריאה סידורי:</span>
            <strong className="text-blue-600 font-mono text-base">
              #{tenantId.substring(0, 2).toUpperCase()}-{createdRequestNumber || 'נשמר בענן'}
            </strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-medium">שם הלקוח:</span>
            <strong className="text-gray-800">{customer.firstName} {customer.lastName}</strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-medium">שם החנות:</span>
            <strong className="text-gray-800">{storeName}</strong>
          </div>
        </motion.div>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold transition-all shadow active:scale-[0.98]"
          >
            פתח קריאה נוספת
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 md:p-10 max-w-2xl mx-auto space-y-8"
    >
      {/* Animated welcome header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 md:p-8 text-white border border-slate-800 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -ml-10 -mb-10"></div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-lg text-[10px] font-bold tracking-wider uppercase mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
              {businessName} שירות לקוחות
            </div>
            <motion.h1
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
              className="text-2xl md:text-3xl font-black tracking-tight"
            >
              שלום, <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-400 via-indigo-300 to-white">{customer.firstName} {customer.lastName}</span>
            </motion.h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1.5 font-medium">
              מרכז השירות המורשה {businessName}. אנא מלא את פרטי הטיפול עבור הכלי שלך.
            </p>
          </div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="w-12 h-12 md:w-14 md:h-14 rounded-2xl overflow-hidden bg-white flex items-center justify-center shadow-lg shadow-blue-500/30 border-2 border-white/20 select-none flex-shrink-0"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-lg md:text-xl">
                {customer.firstName[0]}{customer.lastName[0]}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <ServiceRequestForm
        config={config}
        customer={customer}
        tenantId={tenantId}
        context="public"
        onSuccess={handleSuccess}
      />
    </motion.div>
  );
}
