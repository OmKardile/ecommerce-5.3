// POST /api/admin/stock-monitor/count-sessions/[id]/close — manager closes a
// reviewed count session. INVENTORY_MANAGER / ADMIN / SUPER_ADMIN only.

import { fail, ok, requirePermission } from '@/lib/api-helpers';
import { closeCountSession, StockMonitorError } from '@/server/services/stock-monitor.service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('inventory');
  if (!session) return fail('Unauthorized', 401);
  const { id } = await params;

  try {
    return ok(await closeCountSession(id, session.userId));
  } catch (err) {
    if (err instanceof StockMonitorError) return fail(err.message, err.status);
    console.error('[api/admin/stock-monitor/count-sessions/:id/close] failed', err);
    return fail('Could not close session', 500);
  }
}
