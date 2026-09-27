// POST /api/admin/orders/shipment/advance — ops debug: simulate the next carrier scan
// for an AWB (IN_TRANSIT / OUT_FOR_DELIVERY / DELIVERED). Syncs the order FSM like a real
// carrier webhook would (via applyShipmentTrackingEvent).

import { z } from 'zod';
import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { applyShipmentTrackingEvent } from '@/server/services/shipping.service';
import { recordAudit } from '@/server/services/notification.service';

const advanceSchema = z.object({
  awb: z.string().min(4).max(40),
  status: z.enum(['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']),
  location: z.string().trim().max(80).optional(),
});


export async function POST(req: Request) {
  const session = await requirePermission('orders');
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, advanceSchema);
  if (error) return error;

  const result = await applyShipmentTrackingEvent({
    awb: data.awb,
    status: data.status,
    location: data.location ?? 'Surat Central Hub (simulated scan)',
    payload: { simulatedBy: session.email },
  });
  if (!result.applied && !result.duplicate) return fail('No shipment found for that AWB', 404);

  await recordAudit('SHIPMENT_SCAN_SIMULATED', 'SHIPMENT', data.awb, { status: data.status, result }, session.userId);
  return ok(result);
}
