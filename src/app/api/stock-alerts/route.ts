// POST /api/stock-alerts — "notify me when back in stock" (public, rate-limited).
// One alert per SKU + phone; re-requesting resets an existing alert to PENDING.

import { fail, ok, parseBody, clientIp } from '@/lib/api-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { stockAlertSchema } from '@/lib/validators';
import { createStockAlert, StockAlertError } from '@/server/services/stock-alert.service';

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`stock-alert:${ip}`, 5, 10 * 60 * 1000);
  if (!rl.ok) {
    return fail('Too many requests — try again in a few minutes.', 429, { retryAfterMs: rl.retryAfterMs });
  }

  const { data, error } = await parseBody(req, stockAlertSchema);
  if (error) return error;

  try {
    const result = await createStockAlert(data.skuId, data.phone);
    if (result.alreadyInStock) {
      return ok({ subscribed: false, alreadyInStock: true, message: 'This item is back in stock — add it to your cart.' });
    }
    return ok({ subscribed: true, message: 'We will WhatsApp you the moment it lands back in stock.' });
  } catch (err) {
    if (err instanceof StockAlertError) return fail(err.message, err.status);
    console.error('[api/stock-alerts] failed', err);
    return fail('Could not save the notification request. Try again.', 500);
  }
}
