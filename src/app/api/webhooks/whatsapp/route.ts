import { NextResponse } from 'next/server';
import { recordAudit } from '@/server/services/notification.service';

// Meta WhatsApp Cloud API webhook: GET verification handshake + POST status/inbound callbacks.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === (process.env.WHATSAPP_VERIFY_TOKEN ?? 'placeholder_verify_token')) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    await recordAudit('WHATSAPP_WEBHOOK', 'WHATSAPP_NOTIFICATION', null, body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  return NextResponse.json({ status: 'success' });
}
