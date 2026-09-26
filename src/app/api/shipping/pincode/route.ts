import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helpers';
import { isValidPincode, resolveZone, estimateDelivery } from '@/lib/pincodes';

export async function GET(req: NextRequest) {
  const pin = new URL(req.url).searchParams.get('pin') ?? '';
  if (!isValidPincode(pin)) return fail('Enter a valid 6-digit PIN code', 400);
  const zone = resolveZone(pin);
  return ok({
    pin,
    zone: zone.zone,
    label: zone.label,
    etaDays: `${zone.etaMinDays}-${zone.etaMaxDays} business days`,
    codAvailable: zone.codAvailable,
    express: zone.express,
    estimatedDelivery: estimateDelivery(pin).toISOString(),
  });
}
