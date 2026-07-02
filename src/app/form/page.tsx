import React from 'react';
import RequestForm from '../request/[id]/Form';

export default function FormPreviewPage() {
  const mockCustomer = {
    id: 'demo-customer-id',
    excelId: 9999,
    firstName: 'ישראל',
    lastName: 'ישראלי',
    phone: '052-1234567',
    email: 'demo@gowheels.co.il',
    address: 'דרך מנחם בגין 121, תל אביב',
    licensePlate: '12-345-67',
    color: 'שחור מטאלי',
    serialNumber: 'GW-88392-XL',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100/50 py-10 px-4 sm:px-6 lg:px-8" dir="rtl">
      <RequestForm customer={mockCustomer} />
    </div>
  );
}
