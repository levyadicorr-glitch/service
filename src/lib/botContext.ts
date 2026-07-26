import { getDb, getCustomerByPhone } from './db';
import { formatDate, formatRequestNumber } from './format';
import { serviceStatusLabel, partStatusLabel, quoteStatusLabel, orderStatusLabel } from './statusLabels';

/**
 * Builds the read-only business context handed to the model for one customer.
 *
 * Two rules govern this file:
 *
 * 1. Projections are ALLOWLISTS, never denylists. The existing query layer uses
 *    exclusion literals like { toolImages: 0 }, which means the day someone
 *    adds pickupPhotoImage2, megabytes of base64 start flowing into the prompt
 *    and the token bill. Here a new field is invisible until named.
 *
 * 2. Everything is keyed off the customer resolved from the SENDER's phone
 *    number. No model output ever selects which records get loaded, so a
 *    cross-customer read is not merely forbidden — it has no code path.
 */

const MAX_RECORDS_PER_KIND = 5;
const QUOTE_VALIDITY_DAYS = 7;

export interface BotContextCustomer {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city?: string;
}

export interface BotContextServiceRequest {
  requestNumber: number;
  status: string;
  issueDescription?: string;
  preApprovedAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BotContextPartRequest {
  id: string;
  requestNumber: number;
  description: string;
  status: string;
  quotePrice?: number;
  quoteStatus?: string;
  quoteSentAt?: string;
  createdAt: string;
}

export interface BotContextOrder {
  orderNumber: number;
  deviceType: string;
  model?: string;
  quantity: number;
  totalPrice: number;
  status: string;
  createdAt: string;
}

export interface BotContext {
  tenantId: string;
  customer: BotContextCustomer | null;
  serviceRequests: BotContextServiceRequest[];
  partRequests: BotContextPartRequest[];
  orders: BotContextOrder[];
  /** The only set a quote approval may ever act on. */
  pendingQuotes: BotContextPartRequest[];
}

export async function buildBotContext(tenantId: string, phone: string): Promise<BotContext> {
  const customer = await getCustomerByPhone(tenantId, phone);

  if (!customer) {
    return {
      tenantId,
      customer: null,
      serviceRequests: [],
      partRequests: [],
      orders: [],
      pendingQuotes: [],
    };
  }

  const db = await getDb(tenantId);
  const customerId = customer.id;

  const [serviceRequests, partRequests, orders] = await Promise.all([
    db.collection('serviceRequests')
      .find({ customerId }, {
        projection: {
          _id: 0,
          requestNumber: 1,
          status: 1,
          issueDescription: 1,
          preApprovedAmount: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(MAX_RECORDS_PER_KIND)
      .toArray(),

    db.collection('partRequests')
      .find({ customerId }, {
        projection: {
          _id: 0,
          id: 1,
          requestNumber: 1,
          description: 1,
          status: 1,
          quotePrice: 1,
          quoteStatus: 1,
          quoteSentAt: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(MAX_RECORDS_PER_KIND)
      .toArray(),

    db.collection('orders')
      .find({ customerId }, {
        projection: {
          _id: 0,
          orderNumber: 1,
          deviceType: 1,
          model: 1,
          quantity: 1,
          totalPrice: 1,
          status: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(MAX_RECORDS_PER_KIND)
      .toArray(),
  ]);

  const typedParts = partRequests as unknown as BotContextPartRequest[];

  // Same window the keyword approval path uses, so the two routes can never
  // disagree about which quotes are live.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - QUOTE_VALIDITY_DAYS);
  const cutoffIso = cutoff.toISOString();

  const pendingQuotes = typedParts.filter(
    p => p.quoteStatus === 'PENDING_APPROVAL' && (p.quoteSentAt || '') >= cutoffIso
  );

  return {
    tenantId,
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      city: customer.city,
    },
    serviceRequests: serviceRequests as unknown as BotContextServiceRequest[],
    partRequests: typedParts,
    orders: orders as unknown as BotContextOrder[],
    pendingQuotes,
  };
}

/**
 * Renders the context as compact Hebrew prose. Empty sections are omitted
 * entirely rather than rendered as "none" — it keeps the prompt short and
 * gives the model one less thing to misread as an available record.
 */
export function renderContextBlock(ctx: BotContext): string {
  const today = formatDate(new Date().toISOString());

  if (!ctx.customer) {
    return [
      'לקוח לא מזוהה במערכת (מספר הטלפון אינו רשום).',
      `תאריך היום: ${today}`,
      'אין גישה לנתוני קריאות, הזמנות או הצעות מחיר עבור פונה זה.',
    ].join('\n');
  }

  const c = ctx.customer;
  const lines: string[] = [];

  const header = [`לקוח: ${c.firstName} ${c.lastName}`];
  if (c.phone) header.push(`טלפון: ${c.phone}`);
  if (c.city) header.push(`עיר: ${c.city}`);
  lines.push(header.join(' | '));
  lines.push(`תאריך היום: ${today}`);

  if (ctx.serviceRequests.length > 0) {
    lines.push('', 'קריאות שירות:');
    for (const r of ctx.serviceRequests) {
      const parts = [
        formatRequestNumber(ctx.tenantId, r.requestNumber),
        `סטטוס: ${serviceStatusLabel(r.status)}`,
        `נפתחה: ${formatDate(r.createdAt)}`,
      ];
      if (r.issueDescription) parts.push(`תקלה: ${r.issueDescription}`);
      if (typeof r.preApprovedAmount === 'number') parts.push(`תקרת אישור מראש: ${r.preApprovedAmount} ₪`);
      lines.push(`- ${parts.join(' | ')}`);
    }
  }

  if (ctx.partRequests.length > 0) {
    lines.push('', 'בקשות חלקים:');
    for (const p of ctx.partRequests) {
      const parts = [
        formatRequestNumber(ctx.tenantId, p.requestNumber),
        p.description,
        `סטטוס: ${partStatusLabel(p.status)}`,
      ];
      if (typeof p.quotePrice === 'number') {
        const isPending = ctx.pendingQuotes.some(q => q.id === p.id);
        const quoteText = `הצעת מחיר: ${p.quotePrice} ₪ — ${quoteStatusLabel(p.quoteStatus)}`;
        parts.push(
          isPending && p.quoteSentAt
            ? `${quoteText} (נשלחה ${formatDate(p.quoteSentAt)})`
            : quoteText
        );
      }
      lines.push(`- ${parts.join(' | ')}`);
    }
  }

  if (ctx.orders.length > 0) {
    lines.push('', 'הזמנות:');
    for (const o of ctx.orders) {
      const parts = [
        `הזמנה #${o.orderNumber}`,
        [o.deviceType, o.model].filter(Boolean).join(' '),
        `כמות: ${o.quantity}`,
        `סה"כ: ${o.totalPrice} ₪`,
        `סטטוס: ${orderStatusLabel(o.status)}`,
      ];
      lines.push(`- ${parts.join(' | ')}`);
    }
  }

  if (ctx.serviceRequests.length === 0 && ctx.partRequests.length === 0 && ctx.orders.length === 0) {
    lines.push('', 'אין קריאות, בקשות חלקים או הזמנות רשומות עבור לקוח זה.');
  }

  return lines.join('\n');
}
