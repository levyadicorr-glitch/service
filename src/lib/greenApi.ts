export interface GreenApiStateResult {
  connected: boolean;
  stateInstance: string;
}

export interface GreenApiSendResult {
  sent: boolean;
  error?: string;
}

/**
 * Normalizes a local Israeli phone number (e.g. "050-123-4567") into a
 * Green API WhatsApp chatId (e.g. "972501234567@c.us"). Returns null for
 * empty/invalid input.
 */
export function toWhatsAppChatId(phone: string): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const international = digits.startsWith('0') ? '972' + digits.slice(1) : digits;
  if (international.length < 9) return null;
  return `${international}@c.us`;
}

export async function getInstanceState(instanceId: string, token: string): Promise<GreenApiStateResult> {
  const url = `https://api.green-api.com/waInstance${instanceId}/getStateInstance/${token}`;
  const res = await fetch(url);

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Instance ID או API Token שגויים');
    }
    throw new Error(`שגיאה מ-Green API (${res.status})`);
  }

  const data = await res.json();
  const stateInstance = data?.stateInstance as string;
  return { connected: stateInstance === 'authorized', stateInstance };
}

/**
 * Sends a WhatsApp text message via Green API. Never throws — a failed send
 * (bad credentials, invalid number, network error) is reported back as
 * { sent: false, error } so callers can fan out to multiple recipients
 * without one failure aborting the rest.
 */
export async function sendWhatsAppMessage(
  instanceId: string,
  token: string,
  phone: string,
  message: string
): Promise<GreenApiSendResult> {
  const chatId = toWhatsAppChatId(phone);
  if (!chatId) {
    return { sent: false, error: 'מספר טלפון לא תקין' };
  }

  try {
    const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { sent: false, error: `Green API error (${res.status}): ${text}` };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'שגיאת רשת' };
  }
}

/**
 * Returns the list of target WhatsApp phone numbers for Quote & Sales Agent notifications
 * configured in the tenant settings (quoteNotificationPhones, falling back to adminWhatsappPhone & partsRequestPhone).
 */
export function getQuoteNotificationPhones(tenant: { quoteNotificationPhones?: string; adminWhatsappPhone?: string; adminWhatsappPhone2?: string; adminWhatsappPhone3?: string; partsRequestPhone?: string }): string[] {
  const rawQuote = (tenant.quoteNotificationPhones || '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (rawQuote.length > 0) {
    return Array.from(new Set(rawQuote));
  }

  const fallbackAdmin = [
    tenant.adminWhatsappPhone,
    tenant.adminWhatsappPhone2,
    tenant.adminWhatsappPhone3,
    tenant.partsRequestPhone,
  ]
    .map((p) => (p || '').trim())
    .filter((p) => p.length > 0);

  return Array.from(new Set(fallbackAdmin));
}

export interface ChinaNotifyResult {
  sent: boolean;
  sentCount: number;
  /**
   * Machine-readable outcome the admin UI turns into a human message:
   * 'sent' | 'no_phones' | 'no_instance' | 'no_token' | 'send_failed: <detail>'.
   */
  reason: string;
}

/**
 * Parses the tenant's China-order notification recipients. The field is a free
 * text list separated by commas, newlines or semicolons.
 */
export function getChinaOrderNotificationPhones(tenant: { chinaOrderNotificationPhones?: string }): string[] {
  return Array.from(new Set(
    (tenant.chinaOrderNotificationPhones || '')
      .split(/[,\n;]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
  ));
}

/**
 * Sends a China-order WhatsApp notification to the tenant's configured admin
 * numbers (chinaOrderNotificationPhones) via their Green API instance. Shared by
 * both the "order created" and "order marked ORDERED" flows so they behave
 * identically. Never throws — returns a structured reason the caller surfaces to
 * the admin. On a total failure it probes the live instance state so the reason
 * explains the most common real cause (instance not authorized / QR expired).
 */
export async function sendChinaOrderNotification(
  tenant: { greenApiInstanceId?: string; greenApiToken?: string; chinaOrderNotificationPhones?: string },
  message: string
): Promise<ChinaNotifyResult> {
  const recipients = getChinaOrderNotificationPhones(tenant);
  if (recipients.length === 0) return { sent: false, sentCount: 0, reason: 'no_phones' };
  if (!tenant.greenApiInstanceId) return { sent: false, sentCount: 0, reason: 'no_instance' };
  if (!tenant.greenApiToken) return { sent: false, sentCount: 0, reason: 'no_token' };

  const results = await Promise.all(
    recipients.map((p) => sendWhatsAppMessage(tenant.greenApiInstanceId!, tenant.greenApiToken!, p, message))
  );
  console.log('[CHINA-ORDERS] send results:', JSON.stringify(results));
  const sentCount = results.filter((r) => r.sent).length;
  if (sentCount > 0) return { sent: true, sentCount, reason: 'sent' };

  // Everything failed. The overwhelmingly common cause once credentials are set
  // is that the Green API instance itself is not authorized (the WhatsApp phone
  // / QR isn't actually connected). Probe the live state so the reason is
  // actionable instead of a raw error.
  const firstError = results.find((r) => !r.sent)?.error;
  let stateNote = '';
  try {
    const state = await getInstanceState(tenant.greenApiInstanceId, tenant.greenApiToken);
    console.log('[CHINA-ORDERS] instance state:', state);
    if (!state.connected) {
      stateNote = ` | instance not authorized (state: ${state.stateInstance || 'unknown'}) — scan the QR in Green API`;
    }
  } catch (stateErr) {
    stateNote = ` | instance state check failed: ${stateErr instanceof Error ? stateErr.message : 'unknown'}`;
    console.error('[CHINA-ORDERS] instance state check failed:', stateErr);
  }
  return { sent: false, sentCount: 0, reason: `send_failed: ${firstError || 'unknown'}${stateNote}` };
}

/**
 * Sends a WhatsApp message to all quote notification recipients configured for the tenant.
 */
export async function sendQuoteNotificationToAdmins(
  tenant: { greenApiInstanceId?: string; greenApiToken?: string; quoteNotificationPhones?: string; adminWhatsappPhone?: string; adminWhatsappPhone2?: string; adminWhatsappPhone3?: string; partsRequestPhone?: string },
  message: string
): Promise<{ sentCount: number }> {
  if (!tenant.greenApiInstanceId || !tenant.greenApiToken) {
    return { sentCount: 0 };
  }

  const recipients = getQuoteNotificationPhones(tenant);
  if (recipients.length === 0) {
    return { sentCount: 0 };
  }

  const results = await Promise.allSettled(
    recipients.map((phone) =>
      sendWhatsAppMessage(tenant.greenApiInstanceId!, tenant.greenApiToken!, phone, message)
    )
  );

  const sentCount = results.filter((r) => r.status === 'fulfilled' && r.value.sent).length;
  return { sentCount };
}
