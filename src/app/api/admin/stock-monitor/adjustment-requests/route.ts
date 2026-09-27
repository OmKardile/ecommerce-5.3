// /api/admin/stock-monitor/adjustment-requests
//   POST — employee proposes a stock correction (never mutates stock). STAFF+.
//   GET  — manager queue (?status=PENDING|APPROVED|REJECTED|all). Decision roles only.

import type { NextRequest } from 'next/server';
import { fail, ok, parseBody, requireRole } from '@/lib/api-helpers';
import { INVENTORY_DECISION_ROLES, STOCK_MONITOR_ROLES } from '@/lib/constants';
import { stockAdjustmentRequestSchema } from '@/lib/validators';
import {
  listAdjustmentRequests,
  proposeAdjustment,
  StockMonitorError,
} from '@/server/services/stock-monitor.service';

export async function GET(req: NextRequest) {
  const session = await requireRole(INVENTORY_DECISION_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const status = req.nextUrl.searchParams.get('status');
  const valid = ['PENDING', 'APPROVED', 'REJECTED'];
  const filter = status && valid.includes(status) ? (status as 'PENDING' | 'APPROVED' | 'REJECTED') : undefined;
  return ok({ requests: await listAdjustmentRequests(filter) });
}

export async function POST(req: Request) {
  const session = await requireRole(STOCK_MONITOR_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, stockAdjustmentRequestSchema);
  if (error) return error;

  try {
    const created = await proposeAdjustment({
      skuId: data.skuId,
      delta: data.delta,
      reason: data.reason,
      note: data.note,
      requestedById: session.userId,
    });
    return ok({ requestId: created.id, status: created.status }, 201);
  } catch (err) {
    if (err instanceof StockMonitorError) return fail(err.message, err.status);
    console.error('[api/admin/stock-monitor/adjustment-requests] failed', err);
    return fail('Could not submit request', 500);
  }
}
