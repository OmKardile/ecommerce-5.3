// POST /api/admin/stock-monitor/count-lines/apply — manager converts one counted
// variance into a real MANUAL_ADJUSTMENT movement (one click, audited).

import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { countLineApplySchema } from '@/lib/validators';
import { applyCountLine, StockMonitorError } from '@/server/services/stock-monitor.service';

export async function POST(req: Request) {
  const session = await requirePermission('inventory');
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, countLineApplySchema);
  if (error) return error;

  try {
    return ok(await applyCountLine(data.lineId, session.userId));
  } catch (err) {
    if (err instanceof StockMonitorError) return fail(err.message, err.status);
    console.error('[api/admin/stock-monitor/count-lines/apply] failed', err);
    return fail('Could not apply variance', 500);
  }
}
