import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helpers';
import { isValidPincode } from '@/lib/pincodes';
import { isShiprocketMockMode } from '@/server/services/shipping.service';
import { getCartView } from '@/server/services/cart.service';
import { getSettings } from '@/server/services/settings.service';
import { resolveZone } from '@/lib/pincodes';

export async function GET(req: NextRequest) {
  const pin = new URL(req.url).searchParams.get('pin') ?? '';
  const cod = new URL(req.url).searchParams.get('cod') === '1';
  if (!isValidPincode(pin)) return fail('Enter a valid 6-digit PIN code', 400);
  const [cart, settings] = await Promise.all([getCartView(), getSettings()]);
  const zone = resolveZone(pin);
  const weight = 500 * Math.max(cart.itemCount, 1);
  const base = cart.subtotalPaise >= settings.freeShippingThresholdPaise ? 0 : settings.shippingFeePaise;
  const airSurcharge = zone.zone === 'SPECIAL' ? 19900 : 0;
  return ok({
    mock: isShiprocketMockMode(),
    zone: zone.zone,
    quotes: [
      {
        courier: zone.express ? 'Surface Express' : 'Surface',
        etaDays: `${zone.etaMinDays}-${zone.etaMaxDays} business days`,
        feePaise: base + airSurcharge,
        codAvailable: zone.codAvailable && cart.allCodAllowed,
      },
    ],
    weightGrams: weight,
    codRequested: cod,
  });
}
