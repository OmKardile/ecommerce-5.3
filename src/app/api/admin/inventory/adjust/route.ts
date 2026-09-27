// POST /api/admin/inventory/adjust — manual stock adjustment with mandatory reason code.
// Transactional + immutable movement audit. INVENTORY_MANAGER / ADMIN / SUPER_ADMIN only.

import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { stockAdjustSchema } from '@/lib/validators';
import { adjustStock, InventoryError } from '@/server/services/inventory.service';
import { recordAudit } from '@/server/services/notification.service';


export async function POST(req: Request) {
  const session = await requirePermission('inventory');
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, stockAdjustSchema);
  if (error) return error;

  try {
    const result = await adjustStock({
      skuId: data.skuId,
      delta: data.delta,
      reason: data.reason,
      notes: data.notes || `Adjusted by ${session.fullName || session.email}`,
      createdById: session.userId,
    });
    await recordAudit('STOCK_ADJUSTED', 'INVENTORY', data.skuId, { delta: data.delta, reason: data.reason, notes: data.notes ?? null, result }, session.userId);
    return ok({ skuId: data.skuId, ...result });
  } catch (err) {
    if (err instanceof InventoryError) return fail(err.message, err.status);
    console.error('[api/admin/inventory/adjust] failed', err);
    return fail('Adjustment failed', 500);
  }
}
