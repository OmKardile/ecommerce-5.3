// GET /api/admin/inventory/history?skuId= — immutable movement ledger for one SKU.

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { fail, ok, requireAnyAdmin } from '@/lib/api-helpers';
import { getStockHistory } from '@/server/services/inventory.service';

export async function GET(req: NextRequest) {
  const session = await requireAnyAdmin();
  if (!session) return fail('Unauthorized', 401);

  const skuId = req.nextUrl.searchParams.get('skuId');
  if (!skuId) return fail('skuId query parameter is required', 400);

  const sku = await db.sku.findUnique({ where: { id: skuId }, select: { code: true } });
  if (!sku) return fail('SKU not found', 404);

  const movements = await getStockHistory(skuId, 100);
  return ok({ skuId, skuCode: sku.code, movements });
}
