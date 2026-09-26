// GET /api/admin/orders/[id] — full order detail for the fulfillment sheet:
// items (serials), status history, payments, shipments + tracking events.

import { db } from '@/lib/db';
import { fail, ok, requireAnyAdmin } from '@/lib/api-helpers';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAnyAdmin();
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: 'asc' } },
      payments: true,
      shipments: { include: { events: { orderBy: { occurredAt: 'asc' } } } },
      user: { select: { phone: true, fullName: true, customer: { select: { isB2BVerified: true, gstin: true, companyName: true } } } },
    },
  });
  if (!order) return fail('Order not found', 404);
  return ok(order);
}
