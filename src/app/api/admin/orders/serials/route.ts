// POST /api/admin/orders/serials — capture device serial numbers on an order item
// (RMA / warranty traceability, ADR-014). ORDER_MANAGER / ADMIN / SUPER_ADMIN only.

import { db } from '@/lib/db';
import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { serialNumbersSchema } from '@/lib/validators';
import { recordAudit } from '@/server/services/notification.service';


export async function POST(req: Request) {
  const session = await requirePermission('orders');
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, serialNumbersSchema);
  if (error) return error;

  const item = await db.orderItem.findUnique({ where: { id: data.orderItemId }, include: { order: { select: { orderNumber: true } } } });
  if (!item) return fail('Order item not found', 404);

  await db.orderItem.update({
    where: { id: data.orderItemId },
    data: { serialNumbers: JSON.stringify(data.serialNumbers) },
  });
  await recordAudit('ORDER_SERIALS_CAPTURED', 'ORDER_ITEM', data.orderItemId, { orderNumber: item.order.orderNumber, skuCode: item.skuCode, serials: data.serialNumbers }, session.userId);
  return ok({ orderItemId: data.orderItemId, serialNumbers: data.serialNumbers });
}
