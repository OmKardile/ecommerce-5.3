// POST /api/admin/stock-monitor/adjustment-requests/[id]/decide — manager approves
// (creates the real InventoryMovement when delta ≠ 0) or rejects. Audited.

import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { stockRequestDecisionSchema } from '@/lib/validators';
import { decideAdjustment, StockMonitorError } from '@/server/services/stock-monitor.service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('inventory');
  if (!session) return fail('Unauthorized', 401);
  const { id } = await params;

  const { data, error } = await parseBody(req, stockRequestDecisionSchema);
  if (error) return error;

  try {
    return ok(await decideAdjustment(id, data.decision, session.userId));
  } catch (err) {
    if (err instanceof StockMonitorError) return fail(err.message, err.status);
    console.error('[api/admin/stock-monitor/adjustment-requests/:id/decide] failed', err);
    return fail('Could not record decision', 500);
  }
}
