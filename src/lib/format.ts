// Shared display helpers used across the admin, portal and driver views.

// Request-number display prefix derived from the tenant slug (e.g. 'gowheels' -> 'GW').
export function requestNumberPrefix(tenantId: string): string {
  return tenantId.substring(0, 2).toUpperCase();
}

export function formatRequestNumber(tenantId: string, requestNumber: number): string {
  return `#${requestNumberPrefix(tenantId)}-${requestNumber}`;
}

// Default WhatsApp message used when a tenant has no custom template configured.
export const DEFAULT_WHATSAPP_TEMPLATE =
  'היי! פתחנו עבורך קריאת שירות עבור הכלי שלך 🛴\nכדי שנוכל להתחיל בטיפול, לחץ על הקישור הבא ומלא את הפרטים:\n{link}\n\nתודה מצוות {businessName}!';

export function buildWhatsAppMessage(template: string, link: string, businessName: string): string {
  const effectiveTemplate = template && template.includes('{link}') ? template : DEFAULT_WHATSAPP_TEMPLATE;
  return effectiveTemplate.replace('{link}', link).replace('{businessName}', businessName);
}

export function formatDate(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
