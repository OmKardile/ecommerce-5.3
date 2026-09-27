// GET /api/admin/inventory/export — CSV download of the SKU matrix.

import { fail, requirePermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requirePermission('inventory');
  if (!session) return fail('Unauthorized', 401);

  const rows = await db.inventory.findMany({
    include: {
      sku: {
        include: { variant: { include: { product: { select: { name: true } } } } },
      },
    },
    orderBy: [{ sku: { code: 'asc' } }],
  });

  const header = 'sku_code,product,variant,physical,reserved,available,low_stock_threshold';
  const lines = rows.map((inv) => {
    const cells = [
      inv.sku.code,
      inv.sku.variant?.product?.name ?? '—',
      inv.sku.variant?.name ?? '—',
      String(inv.currentStock),
      String(inv.reservedStock),
      String(Math.max(inv.currentStock - inv.reservedStock, 0)),
      String(inv.lowStockThreshold),
    ];
    return cells.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',');
  });
  const csv = `${header}\n${lines.join('\n')}\n`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="patel-networks-inventory-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
