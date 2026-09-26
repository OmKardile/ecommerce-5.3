import { NextResponse } from 'next/server';
import { verifyWebhookSignature, capturePayment } from '@/server/services/payment.service';

// Idempotent Razorpay webhook (ADR-010): HMAC verification + event dedup via payment_events.eventId.
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id) return NextResponse.json({ status: 'ignored' });

  if (event.event === 'payment.captured' || event.event === 'payment.authorized') {
    const result = await capturePayment({
      gatewayOrderId: payment.order_id,
      gatewayPaymentId: payment.id,
      eventId: `evt_${payment.id}_${event.event}`,
      eventType: event.event,
      payload: event,
    });
    return NextResponse.json({ status: 'success', duplicate: result.alreadyProcessed });
  }
  if (event.event === 'payment.failed') {
    const { db } = await import('@/lib/db');
    const rec = await db.payment.findUnique({ where: { gatewayOrderId: payment.order_id } });
    if (rec) {
      await db.payment.update({ where: { id: rec.id }, data: { status: 'FAILED' } }).catch(() => undefined);
    }
    return NextResponse.json({ status: 'success' });
  }
  return NextResponse.json({ status: 'ignored' });
}
