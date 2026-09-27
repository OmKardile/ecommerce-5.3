// /api/admin/stock-monitor/count-sessions — POST open a cycle-count session
// (scope snapshot), GET list recent sessions. STAFF+ (ADR-010).

import { db } from '@/lib/db';
import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { stockCountSessionCreateSchema } from '@/lib/validators';
import { listCountSessions, openCountSession, StockMonitorError } from '@/server/services/stock-monitor.service';

export async function GET() {
  const session = await requirePermission('stock_monitor');
  if (!session) return fail('Unauthorized', 401);
  return ok({ sessions: await listCountSessions() });
}

export async function POST(req: Request) {
  const session = await requirePermission('stock_monitor');
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, stockCountSessionCreateSchema);
  if (error) return error;

  try {
    const created = await openCountSession({
      title: data.title,
      scopeKind: data.scopeKind,
      scopeRefId: data.scopeRefId,
      openedById: session.userId,
    });
    return ok({ sessionId: created.id, title: created.title }, 201);
  } catch (err) {
    if (err instanceof StockMonitorError) return fail(err.message, err.status);
    console.error('[api/admin/stock-monitor/count-sessions] failed', err);
    return fail('Could not open count session', 500);
  }
}
