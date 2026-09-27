// GET /api/admin/orders — paginated fulfillment list + per-status counts for the tab bar.

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { fail, ok, requirePermission } from '@/lib/api-helpers';
import { getAdminOrdersList } from '@/server/services/admin.service';

export async function GET(req: NextRequest) {
  const session = await requirePermission('orders');
  if (!session) return fail('Unauthorized', 401);

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q') ?? undefined;
  const status = sp.get('status') ?? 'ALL';
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1);
  const perPage = Math.min(100, Math.max(1, Number(sp.get('perPage') ?? '20') || 20));

  try {
    const [list, statusGroups] = await Promise.all([
      getAdminOrdersList({ q, status, page, perPage }),
      db.order.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const counts: Record<string, number> = {};
    let all = 0;
    for (const g of statusGroups) {
      counts[g.status] = g._count._all;
      all += g._count._all;
    }
    return ok({ ...list, counts: { ...counts, ALL: all } });
  } catch (err) {
    console.error('[api/admin/orders] list failed', err);
    return fail('Failed to load orders', 500);
  }
}
