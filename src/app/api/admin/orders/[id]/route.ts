// GET /api/admin/orders/[id] — full order detail for the fulfillment sheet:
// items (serials + PDP slug for deep-links), status history, payments,
// shipments + tracking events.

import { db } from '@/lib/db';
import { fail, ok, requireAnyAdmin } from '@/lib/api-helpers';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAnyAdmin();
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          sku: {
            select: { variant: { select: { product: { select: { slug: true } } } } },
          },
        },
      },
      statusHistory: { orderBy: { createdAt: 'asc' } },
      payments: true,
      shipments: { include: { events: { orderBy: { occurredAt: 'asc' } } } },
      user: { select: { phone: true, fullName: true, customer: { select: { isB2BVerified: true, gstin: true, companyName: true } } } },
    },
  });
  if (!order) return fail('Order not found', 404);

  // Flatten the item → sku → variant → product hop into productSlug for the
  // console's PDP deep-links, and drop the nested include from the payload.
  const { items, ...rest } = order;
  return ok({
    ...rest,
    items: items.map(({ sku, ...item }) => ({
      ...item,
      productSlug: sku?.variant?.product?.slug ?? null,
    })),
  });
}
