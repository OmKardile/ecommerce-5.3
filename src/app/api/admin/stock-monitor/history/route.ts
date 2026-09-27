// GET /api/admin/stock-monitor/history?skuId=&take= — human-phrased movement ledger
// for one SKU. Read-only. STAFF+ (ADR-010).

import type { NextRequest } from 'next/server';
import { fail, ok, requirePermission } from '@/lib/api-helpers';
import { getSkuHistory, StockMonitorError } from '@/server/services/stock-monitor.service';

export async function GET(req: NextRequest) {
  const session = await requirePermission('stock_monitor');
  if (!session) return fail('Unauthorized', 401);

  const skuId = req.nextUrl.searchParams.get('skuId');
  if (!skuId) return fail('skuId query parameter is required', 400);
  const take = Math.min(Number(req.nextUrl.searchParams.get('take')) || 30, 100);

  try {
    return ok(await getSkuHistory(skuId, take));
  } catch (err) {
    if (err instanceof StockMonitorError) return fail(err.message, err.status);
    console.error('[api/admin/stock-monitor/history] failed', err);
    return fail('History lookup failed', 500);
  }
}
