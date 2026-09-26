import { NextResponse } from 'next/server';
import { applyShipmentTrackingEvent } from '@/server/services/shipping.service';

// Universal carrier tracking webhook (Shiprocket/Delhivery schemas normalized).
// Idempotent via shipment_events.eventId dedup.
//
// AUTH: carriers cannot sign webhooks with HMAC the way Razorpay does, so this
// endpoint uses a shared-secret token. Set SHIPPING_WEBHOOK_TOKEN in the
// carrier's dashboard (custom header x-webhook-token, or append ?token=…).
// - Token configured  -> requests MUST present the matching token (401 otherwise).
// - Token NOT set     -> sandbox/simulation posture: accepted, but every accept
//   is warned in the server log so a production deploy without the token is
//   visible in dev.log immediately.
export async function POST(req: Request) {
  const expected = process.env.SHIPPING_WEBHOOK_TOKEN?.trim();
  if (expected) {
    const url = new URL(req.url);
    const provided = req.headers.get('x-webhook-token') ?? url.searchParams.get('token') ?? '';
    if (provided !== expected) {
      return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
    }
  } else {
    console.warn('[webhook] shipping event accepted WITHOUT token — set SHIPPING_WEBHOOK_TOKEN before go-live');
  }

  let body: {
    awb?: string;
    current_status?: string;
    status?: string;
    location?: string;
    timestamp?: string;
    activity?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const awb = body.awb;
  const status = (body.current_status ?? body.status ?? '').toUpperCase().replace(/\s+/g, '_');
  if (!awb || !status) return NextResponse.json({ error: 'awb and status required' }, { status: 400 });

  const result = await applyShipmentTrackingEvent({
    awb,
    status,
    location: body.location,
    occurredAt: body.timestamp ? new Date(body.timestamp) : undefined,
    payload: body,
  });
  if (!result.applied && !result.duplicate) {
    return NextResponse.json({ error: 'Unknown AWB' }, { status: 404 });
  }
  return NextResponse.json({ status: 'success', duplicate: result.duplicate, orderNumber: result.orderNumber });
}
