// POST /api/admin/orders/shipment — book a carrier shipment (AWB) for an order.
// Simulation mode (placeholder credentials) issues deterministic DELH… AWBs (ADR-012).

import { fail, ok, parseBody, requireRole } from '@/lib/api-helpers';
import { createShipmentSchema } from '@/lib/validators';
import { ROLES } from '@/lib/constants';
import { createShipmentForOrder } from '@/server/services/shipping.service';

const ORDER_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ORDER_MANAGER];

export async function POST(req: Request) {
  const session = await requireRole(ORDER_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, createShipmentSchema);
  if (error) return error;

  try {
    const shipment = await createShipmentForOrder(data.orderId, data.provider);
    return ok({
      id: shipment.id,
      awb: shipment.awb,
      courier: shipment.courierName,
      provider: shipment.provider,
      status: shipment.status,
      trackingUrl: shipment.trackingUrl,
      labelUrl: shipment.labelUrl,
      estimatedDeliveryAt: shipment.estimatedDeliveryAt,
    });
  } catch (err) {
    console.error('[api/admin/orders/shipment] booking failed', err);
    return fail(err instanceof Error ? err.message : 'Shipment booking failed', 500);
  }
}
