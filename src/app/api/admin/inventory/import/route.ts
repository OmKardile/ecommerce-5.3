// POST /api/admin/inventory/import — bulk CSV import. Client parses the file and posts
// rows {skuCode, delta, reason, notes}; each row runs through the audited adjustStock path
// in a sequential transaction loop. Returns per-row success/fail report.

import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, ok, parseBody, requireRole } from '@/lib/api-helpers';
import { ROLES } from '@/lib/constants';
import { adjustStock, InventoryError } from '@/server/services/inventory.service';
import { recordAudit } from '@/server/services/notification.service';

const importRowSchema = z.object({
  skuCode: z.string().trim().min(2).max(40),
  delta: z.number().int().refine((v) => v !== 0, 'delta cannot be zero'),
  reason: z.enum(['PURCHASE_RECEIPT', 'MANUAL_ADJUSTMENT', 'DAMAGED_WRITE_OFF', 'RETURN_RESTOCK']),
  notes: z.string().trim().max(300).optional(),
});

const importSchema = z.object({ rows: z.array(importRowSchema).min(1).max(500) });

const INVENTORY_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.INVENTORY_MANAGER];

export async function POST(req: Request) {
  const session = await requireRole(INVENTORY_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, importSchema);
  if (error) return error;

  // Map SKU codes -> skuIds once, up-front.
  const codes = [...new Set(data.rows.map((r) => r.skuCode))];
  const skus = await db.sku.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const skuMap = new Map(skus.map((s) => [s.code, s.id]));

  const results: { skuCode: string; ok: boolean; error?: string }[] = [];
  let adjusted = 0;

  for (const row of data.rows) {
    const skuId = skuMap.get(row.skuCode);
    if (!skuId) {
      results.push({ skuCode: row.skuCode, ok: false, error: 'Unknown SKU code' });
      continue;
    }
    try {
      await adjustStock({
        skuId,
        delta: row.delta,
        reason: row.reason,
        notes: row.notes || 'Bulk CSV import',
        createdById: session.userId,
      });
      results.push({ skuCode: row.skuCode, ok: true });
      adjusted++;
    } catch (err) {
      const message = err instanceof InventoryError ? err.message : err instanceof Error ? err.message : 'Adjustment failed';
      results.push({ skuCode: row.skuCode, ok: false, error: message });
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  await recordAudit('INVENTORY_BULK_IMPORT', 'INVENTORY', null, { rows: data.rows.length, adjusted, failed }, session.userId);
  return ok({ total: data.rows.length, adjusted, failed, results });
}
