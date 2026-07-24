'use client';

import React, { useState, useMemo } from 'react';
import { Customer } from '@/lib/db';
import { Search, UserCheck, X, Phone, MapPin, Check, Edit2 } from 'lucide-react';

interface CustomerSelectComboboxProps {
  customers: Customer[];
  selectedCustomerId: string;
  onSelectCustomer: (customer: Customer | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export default function CustomerSelectCombobox({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  label = 'בחר לקוח',
  placeholder = 'חפש לקוח לפי שם, טלפון או עיר...',
  required = false,
}: CustomerSelectComboboxProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return customers.slice(0, 20); // show initial 20 customers
    return customers.filter(c => {
      const name = `${c.firstName} ${c.lastName}`.toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const city = (c.city || '').toLowerCase();
      return name.includes(term) || phone.includes(term) || city.includes(term);
    }).slice(0, 25);
  }, [customers, searchTerm]);

  return (
    <div className="space-y-1.5 relative">
      {label && (
        <label className="block text-xs font-bold text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {selectedCustomer ? (
        <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-200 rounded-xl transition-all shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-gray-900 text-xs block truncate">
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </span>
              <span className="text-[11px] text-gray-500 font-mono block truncate" dir="ltr">
                {selectedCustomer.phone || 'ללא טלפון'} {selectedCustomer.city ? `• ${selectedCustomer.city}` : ''}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onSelectCustomer(null);
              setSearchTerm('');
              setIsOpen(true);
            }}
            className="px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100/60 rounded-lg border border-blue-200 transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
          >
            <Edit2 className="w-3 h-3" />
            <span>שנה לקוח</span>
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-3 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isOpen && (
            <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-gray-50 animate-in fade-in duration-150">
              {filteredCustomers.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 font-medium">
                  לא נמצאו לקוחות תואמים לחיפוש "{searchTerm}"
                </div>
              ) : (
                filteredCustomers.map(cust => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => {
                      onSelectCustomer(cust);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className="w-full p-2.5 text-right hover:bg-blue-50/50 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div>
                      <strong className="text-xs font-bold text-gray-800 block">
                        {cust.firstName} {cust.lastName}
                      </strong>
                      <span className="text-[10px] text-gray-400 font-mono" dir="ltr">
                        {cust.phone || 'ללא טלפון'} {cust.city ? `• ${cust.city}` : ''}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      בחר
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
