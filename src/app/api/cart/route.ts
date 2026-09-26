import { ok } from '@/lib/api-helpers';
import { getCartView, codEligible } from '@/server/services/cart.service';
import { getSettings } from '@/server/services/settings.service';

export async function GET() {
  const [cart, settings] = await Promise.all([getCartView(), getSettings()]);
  return ok({ cart, cod: codEligible(cart, settings.codMaxOrderValuePaise) });
}
