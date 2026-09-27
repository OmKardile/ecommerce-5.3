// GET /api/admin/inventory — dense SKU matrix for the inventory console.

import { db } from '@/lib/db';
import { fail, ok, requirePermission } from '@/lib/api-helpers';

export async function GET() {
  const session = await requirePermission('inventory');
  if (!session) return fail('Unauthorized', 401);

  const rows = await db.inventory.findMany({
    include: {
      sku: {
        include: {
          variant: { include: { product: { select: { id: true, name: true, isCodAllowed: true } } } },
        },
      },
    },
    orderBy: [{ sku: { code: 'asc' } }],
  });

  return ok({
    rows: rows.map((inv) => ({
      skuId: inv.skuId,
      skuCode: inv.sku.code,
      productId: inv.sku.variant?.product?.id ?? null,
      productName: inv.sku.variant?.product?.name ?? '—',
      variantName: inv.sku.variant?.name ?? '—',
      currentStock: inv.currentStock,
      reservedStock: inv.reservedStock,
      available: Math.max(inv.currentStock - inv.reservedStock, 0),
      lowStockThreshold: inv.lowStockThreshold,
      updatedAt: inv.updatedAt,
    })),
  });
}
