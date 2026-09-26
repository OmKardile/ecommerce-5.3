// Notification service — dual-mode per ADR-007/ADR-013:
// real credentials -> live SMS (Fast2SMS/MSG91) & WhatsApp Cloud API (Meta Graph);
// placeholder credentials -> deterministic simulation (console + audit log). No fabricated success:
// simulation mode returns { simulated: true } so callers can surface it.

import { db } from '@/lib/db';
import { STORE } from '@/lib/constants';

function isPlaceholder(value: string | undefined): boolean {
  return !value || value.includes('placeholder') || value.startsWith('YOUR_');
}

export async function recordAudit(action: string, entity: string, entityId: string | null, details: unknown, userId?: string | null): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action,
        entity,
        entityId: entityId ?? undefined,
        userId: userId ?? undefined,
        details: JSON.stringify(details).slice(0, 8000),
      },
    });
  } catch (err) {
    // Stale session after a DB reseed: userId no longer matches a User row and
    // the FK write fails. The action/entity/details trail matters more than
    // attribution — retry once without it instead of losing the row silently.
    if ((err as { code?: string }).code === 'P2003' && userId) {
      try {
        await db.auditLog.create({
          data: { action, entity, entityId: entityId ?? undefined, details: JSON.stringify({ ...(typeof details === 'object' && details ? details : {}), auditUserIdDropped: userId }).slice(0, 8000) },
        });
        console.warn('[audit] recorded without userId (stale session FK) —', action);
        return;
      } catch (retryErr) {
        console.error('[audit] retry failed', action, retryErr);
        return;
      }
    }
    console.error('[audit] failed to record', action, err);
  }
}

// ---------------- SMS / OTP ----------------

export interface OtpSendResult {
  simulated: boolean;
}

export async function sendSmsOtp(phone: string, code: string): Promise<OtpSendResult> {
  const apiKey = process.env.SMS_GATEWAY_API_KEY;
  if (!isPlaceholder(apiKey)) {
    // Fast2SMS-compatible dispatch (DLT-approved template assumed configured).
    try {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { authorization: apiKey as string, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route: 'dlt',
          sender_id: process.env.SMS_SENDER_ID ?? 'PTLNET',
          message: process.env.SMS_TEMPLATE_ID ?? '',
          variables_values: code,
          numbers: phone.replace('+91', ''),
        }),
      });
      if (!res.ok) throw new Error(`SMS gateway ${res.status}`);
      return { simulated: false };
    } catch (err) {
      console.error('[sms] live dispatch failed, falling back to simulation', err);
    }
  }
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  [SIMULATED SMS] Patel Networks          ');
  console.log(`║  To: ${phone}  OTP: ${code}   `);
  console.log('╚══════════════════════════════════════════╝\n');
  return { simulated: true };
}

// ---------------- WhatsApp Cloud API ----------------

export type WhatsAppTemplate =
  | 'order_confirmation'
  | 'order_dispatched'
  | 'out_for_delivery'
  | 'order_delivered'
  | 'order_cancelled'
  | 'return_requested'
  | 'back_in_stock'
  | 'cod_verification'
  | 'b2b_quote_inquiry'
  | 'address_updated';

export interface WhatsAppSendResult {
  simulated: boolean;
  messageId?: string;
}

export async function sendWhatsAppTemplate(
  toPhone: string,
  template: WhatsAppTemplate,
  params: string[]
): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = toPhone.replace(/\D/g, '');

  if (!isPlaceholder(token) && !isPlaceholder(phoneId)) {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: template,
            language: { code: 'en' },
            components: [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) }],
          },
        }),
      });
      const json = (await res.json()) as { messages?: { id: string }[] };
      if (!res.ok) throw new Error(`WhatsApp API ${res.status}`);
      const messageId = json.messages?.[0]?.id;
      await recordAudit('WHATSAPP_DISPATCH', 'WHATSAPP_NOTIFICATION', messageId ?? null, { template, to, params });
      return { simulated: false, messageId };
    } catch (err) {
      console.error('[whatsapp] live dispatch failed, falling back to simulation', err);
    }
  }

  console.log('\n┌───────────── [SIMULATED WHATSAPP] ─────────────┐');
  console.log(`│ To: +${to}`);
  console.log(`│ Template: ${template}`);
  params.forEach((p, i) => console.log(`│   {{${i + 1}}} ${p}`));
  console.log('└────────────────────────────────────────────────┘\n');
  await recordAudit('WHATSAPP_DISPATCH_SIMULATED', 'WHATSAPP_NOTIFICATION', null, { template, to, params });
  return { simulated: true };
}

export function whatsappDeepLink(text: string): string {
  return `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(text)}`;
}
