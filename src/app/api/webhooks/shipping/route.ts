import { NextResponse } from 'next/server';
import { applyShipmentTrackingEvent } from '@/server/services/shipping.service';

// Universal carrier tracking webhook (Shiprocket/Delhivery schemas normalized).
// Idempotent via shipment_events.eventId dedup.
export async function POST(req: Request) {
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
