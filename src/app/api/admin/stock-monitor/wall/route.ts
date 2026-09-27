// GET /api/admin/stock-monitor/wall?q=&categoryId=&brandId= — stock wall projection.
// Read-only availability per SKU (current − reserved), state-coloured. STAFF+ (ADR-010).

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api-helpers';
import { requireRole } from '@/lib/api-helpers';
import { STOCK_MONITOR_ROLES } from '@/lib/constants';
import { getWallProjection } from '@/server/services/stock-monitor.service';

export async function GET(req: NextRequest) {
  const session = await requireRole(STOCK_MONITOR_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const q = req.nextUrl.searchParams.get('q') ?? undefined;
  const categoryId = req.nextUrl.searchParams.get('categoryId') ?? undefined;
  const brandId = req.nextUrl.searchParams.get('brandId') ?? undefined;

  const [projection, categories, brands] = await Promise.all([
    getWallProjection({ q, categoryId: categoryId || undefined, brandId: brandId || undefined }),
    db.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.brand.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return ok({ ...projection, categories, brands });
}
