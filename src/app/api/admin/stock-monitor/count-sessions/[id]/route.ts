// /api/admin/stock-monitor/count-sessions/[id] — GET detail (lines + expected vs
// counted), PATCH submit counted quantities in bulk. STAFF+ (ADR-010).

import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { stockCountSubmitSchema } from '@/lib/validators';
import {
  getCountSessionDetail,
  StockMonitorError,
  submitCountLines,
} from '@/server/services/stock-monitor.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await requirePermission('stock_monitor');
  if (!session) return fail('Unauthorized', 401);
  const { id } = await params;

  try {
    return ok(await getCountSessionDetail(id));
  } catch (err) {
    if (err instanceof StockMonitorError) return fail(err.message, err.status);
    console.error('[api/admin/stock-monitor/count-sessions/:id] failed', err);
    return fail('Could not load count session', 500);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await requirePermission('stock_monitor');
  if (!session) return fail('Unauthorized', 401);
  const { id } = await params;

  const { data, error } = await parseBody(req, stockCountSubmitSchema);
  if (error) return error;

  try {
    const result = await submitCountLines(id, data.lines, session.userId);
    return ok(result);
  } catch (err) {
    if (err instanceof StockMonitorError) return fail(err.message, err.status);
    console.error('[api/admin/stock-monitor/count-sessions/:id] submit failed', err);
    return fail('Could not submit counts', 500);
  }
}
