import { ok, fail } from '@/lib/api-helpers';
import { getCustomerSession, getAdminSession } from '@/lib/session';
import { getOrderByNumber } from '@/server/services/order.service';

export async function GET(_req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const order = await getOrderByNumber(orderNumber);
  if (!order) return fail('Order not found', 404);
  const [customer, admin] = await Promise.all([getCustomerSession(), getAdminSession()]);
  const isOwner = customer && order.userId === customer.userId;
  if (!isOwner && !admin) return fail('Not authorized to view this order', 403);
  return ok({ order });
}
