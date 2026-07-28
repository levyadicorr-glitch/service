import type { ServiceRequest, PartRequest, Order, ChinaOrder } from './db';

/**
 * Canonical Hebrew status labels.
 *
 * These strings are currently duplicated across AdminDashboard, CustomerPortal,
 * DriverPanel, AgentPortal and PartRequestClientView. This module is the single
 * source of truth for *new* consumers (the AI bot renders statuses into prompts
 * and must not invent its own wording).
 *
 * Deliberately not wired into the existing five call sites yet: several of them
 * carry per-status Tailwind colour classes alongside the label, so replacing
 * them is a separate refactor rather than a drive-by edit.
 */

export type ServiceRequestStatus = ServiceRequest['status'];
export type PartRequestStatus = PartRequest['status'];
export type QuoteStatus = NonNullable<PartRequest['quoteStatus']>;
export type OrderStatus = Order['status'];
export type ChinaOrderStatus = ChinaOrder['status'];

export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  NEW: 'חדש',
  WAITING_FOR_PICKUP: 'ממתין לאיסוף',
  PICKED_UP_BY_DRIVER: 'נהג אסף כלי',
  COMPLETED: 'טיפול הסתיים',
};

export const PART_REQUEST_STATUS_LABELS: Record<PartRequestStatus, string> = {
  NEW: 'חדש - ממתין לטיפול',
  READY_FOR_DISPATCH: 'מוכן לשילוח',
  FULFILLED: 'טופל / סופק',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  NONE: 'אין הצעת מחיר',
  PENDING_APPROVAL: 'ממתין לאישורך',
  APPROVED: 'אושר',
  EXPIRED: 'פג תוקף',
  REJECTED: 'נדחה',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'בהכנה',
  READY_FOR_DISPATCH: 'מוכן לשילוח',
  FULFILLED: 'סופק',
  CANCELLED: 'בוטל',
};

export const CHINA_ORDER_STATUS_LABELS: Record<ChinaOrderStatus, string> = {
  PENDING_APPROVAL: 'ממתין לאישור',
  WAITING_TO_ORDER: 'ממתין להזמנה',
  ORDERED: 'הוזמן',
  ARRIVED: 'הגיע',
};

// Each lookup falls back to the raw string rather than throwing: an unknown
// status must degrade to a slightly odd label, never to a failed webhook.
function lookup(map: Record<string, string>, status?: string): string {
  if (!status) return '';
  return map[status] ?? status;
}

export function serviceStatusLabel(status?: string): string {
  return lookup(SERVICE_REQUEST_STATUS_LABELS, status);
}

export function partStatusLabel(status?: string): string {
  return lookup(PART_REQUEST_STATUS_LABELS, status);
}

export function quoteStatusLabel(status?: string): string {
  return lookup(QUOTE_STATUS_LABELS, status);
}

export function orderStatusLabel(status?: string): string {
  return lookup(ORDER_STATUS_LABELS, status);
}

export function chinaOrderStatusLabel(status?: string): string {
  return lookup(CHINA_ORDER_STATUS_LABELS, status);
}
