// Shipping service — provider abstraction (Shiprocket / Delhivery) with deterministic
// simulation fallback (ADR-012). Live credentials -> real REST calls; placeholders ->
// deterministic AWBs + scan events so the full lifecycle is exercisable end-to-end.

import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { resolveZone } from '@/lib/pincodes';
import type { ShipmentStatus } from '@/lib/constants';
import { recordAudit } from './notification.service';

export interface ShippingRateRequest {
  deliveryPincode: string;
  weightGrams: number;
  isCod: boolean;
  orderValuePaise: number;
}

export interface ShippingQuote {
  provider: string;
  courier: string;
  etaDays: number;
  feePaise: number;
  codAvailable: boolean;
}

export function isShiprocketMockMode(): boolean {
  const email = process.env.SHIPROCKET_EMAIL;
  const pass = process.env.SHIPROCKET_PASSWORD;
  return !email || !pass || email.includes('placeholder') || pass.includes('placeholder');
}

export function isDelhiveryMockMode(): boolean {
  const key = process.env.DELHIVERY_API_KEY;
  return !key || key.includes('placeholder');
}

export interface ShippingProvider {
  readonly name: 'SHIPROCKET' | 'DELHIVERY';
  checkServiceability(pincode: string): Promise<{ serviceable: boolean; codAvailable: boolean; etaDays: number }>;
  calculateRate(req: ShippingRateRequest): Promise<ShippingQuote[]>;
  createShipment(input: { orderNumber: string; pincode: string; weightGrams: number; isCod: boolean; declaredValuePaise: number }): Promise<{
    providerShipmentId: string;
    awb: string;
    courier: string;
    trackingUrl: string;
    labelUrl: string;
    estimatedDeliveryAt: Date;
  }>;
  cancelShipment(providerShipmentId: string): Promise<boolean>;
}

// ---------------- deterministic simulation ----------------

function simulatedProvider(name: 'SHIPROCKET' | 'DELHIVERY'): ShippingProvider {
  const prefix = 'DELH';
  return {
    name,
    async checkServiceability(pincode) {
      const zone = resolveZone(pincode);
      return { serviceable: true, codAvailable: zone.codAvailable, etaDays: zone.etaMaxDays };
    },
    async calculateRate(req) {
      const zone = resolveZone(req.deliveryPincode);
      const base = zone.zone === 'SPECIAL' ? 19900 : zone.zone === 'METRO' ? 9900 : 11900;
      return [
        { provider: name, courier: zone.express ? 'Delhivery Surface Express' : 'Delhivery Surface', etaDays: zone.etaMaxDays, feePaise: base, codAvailable: zone.codAvailable },
      ];
    },
    async createShipment(input) {
      const zone = resolveZone(input.pincode);
      const awb = `${prefix}${randomBytes(5).toString('hex').toUpperCase()}`;
      return {
        providerShipmentId: `SR-SIM-${randomBytes(4).toString('hex').toUpperCase()}`,
        awb,
        courier: zone.express ? 'Delhivery Surface Express' : 'Delhivery Surface',
        trackingUrl: `https://track.delhivery.com/p/${awb}`,
        labelUrl: `/api/admin/shipments/label?awb=${awb}`,
        estimatedDeliveryAt: new Date(Date.now() + zone.etaMaxDays * 86400000),
      };
    },
    async cancelShipment() {
      return true;
    },
  };
}

// ---------------- live providers ----------------

async function shiprocketToken(): Promise<string> {
  const res = await fetch(`${process.env.SHIPROCKET_API_URL ?? 'https://apiv2.shiprocket.in/v1/external'}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Shiprocket auth failed: ${res.status}`);
  const json = (await res.json()) as { token: string };
  return json.token;
}

const shiprocketLive: ShippingProvider = {
  name: 'SHIPROCKET',
  async checkServiceability(pincode) {
    const token = await shiprocketToken();
    const res = await fetch(
      `${process.env.SHIPROCKET_API_URL ?? 'https://apiv2.shiprocket.in/v1/external'}/courier/serviceability?pickup_postcode=395003&delivery_postcode=${pincode}&cod=0&weight=0.5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return { serviceable: false, codAvailable: false, etaDays: 0 };
    const json = (await res.json()) as { data?: { available_courier_companies?: { etd?: string; cod: number }[] } };
    const couriers = json.data?.available_courier_companies ?? [];
    return { serviceable: couriers.length > 0, codAvailable: couriers.some((c) => c.cod === 1), etaDays: couriers.length ? 4 : 0 };
  },
  async calculateRate(req) {
    const token = await shiprocketToken();
    const res = await fetch(
      `${process.env.SHIPROCKET_API_URL ?? 'https://apiv2.shiprocket.in/v1/external'}/courier/serviceability?pickup_postcode=395003&delivery_postcode=${req.deliveryPincode}&cod=${req.isCod ? 1 : 0}&weight=${Math.max(req.weightGrams / 1000, 0.5)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { available_courier_companies?: { courier_name: string; rate: number; etd: string; cod: number }[] } };
    return (json.data?.available_courier_companies ?? []).map((c) => ({
      provider: 'SHIPROCKET' as const,
      courier: c.courier_name,
      etaDays: 4,
      feePaise: Math.round(c.rate * 100),
      codAvailable: c.cod === 1,
    }));
  },
  async createShipment(input) {
    const token = await shiprocketToken();
    const res = await fetch(`${process.env.SHIPROCKET_API_URL ?? 'https://apiv2.shiprocket.in/v1/external'}/orders/create/adhoc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: input.orderNumber,
        billing_customer_name: 'Patel Networks',
        last_mile_courier_id: '',
        payment_method: input.isCod ? 'COD' : 'Prepaid',
        subtotal: Math.round(input.declaredValuePaise / 100),
        lengths: [15], breadths: [12], heights: [10], weight: Math.max(input.weightGrams / 1000, 0.5),
        billing_pincode: 395003,
        shipping_customer_name: 'Customer', shipping_address: '—', shipping_city: '—', shipping_pincode: input.pincode, shipping_state: '—', shipping_email: 'ops@patelnetworks.in', shipping_phone: 9100000000, shipping_country: 'India',
      }),
    });
    if (!res.ok) throw new Error(`Shiprocket adhoc order failed: ${res.status}`);
    const json = (await res.json()) as { order_id: number; awb_code?: string; courier_name?: string };
    const awb = json.awb_code ?? `SR${json.order_id}`;
    return {
      providerShipmentId: String(json.order_id),
      awb,
      courier: json.courier_name ?? 'Shiprocket',
      trackingUrl: `https://shiprocket.co/tracking/${awb}`,
      labelUrl: `/api/admin/shipments/label?awb=${awb}`,
      estimatedDeliveryAt: new Date(Date.now() + 4 * 86400000),
    };
  },
  async cancelShipment(providerShipmentId) {
    const token = await shiprocketToken();
    const res = await fetch(`${process.env.SHIPROCKET_API_URL ?? 'https://apiv2.shiprocket.in/v1/external'}/orders/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [providerShipmentId] }),
    });
    return res.ok;
  },
};

function providerFor(name: 'SHIPROCKET' | 'DELHIVERY'): ShippingProvider {
  const mock = name === 'SHIPROCKET' ? isShiprocketMockMode() : isDelhiveryMockMode();
  if (mock || name === 'DELHIVERY') return simulatedProvider(name); // Delhivery direct uses same sim until key configured
  return shiprocketLive;
}

// ---------------- orchestration ----------------

export async function createShipmentForOrder(orderId: string, providerName: 'SHIPROCKET' | 'DELHIVERY' = 'SHIPROCKET') {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { sku: true } } },
  });
  const provider = providerFor(providerName);
  const weight = order.items.reduce((n, i) => n + i.quantity * 500, 500);

  const shipment = await provider.createShipment({
    orderNumber: order.orderNumber,
    pincode: order.deliveryPincode,
    weightGrams: weight,
    isCod: order.paymentMethod === 'COD',
    declaredValuePaise: order.totalAmount,
  });

  const existing = await db.shipment.findUnique({ where: { orderId } });
  const record = existing
    ? await db.shipment.update({
        where: { id: existing.id },
        data: {
          provider: providerName,
          courierName: shipment.courier,
          providerShipmentId: shipment.providerShipmentId,
          awb: shipment.awb,
          trackingUrl: shipment.trackingUrl,
          labelUrl: shipment.labelUrl,
          status: 'MANIFESTED',
          estimatedDeliveryAt: shipment.estimatedDeliveryAt,
        },
      })
    : await db.shipment.create({
        data: {
          orderId,
          provider: providerName,
          courierName: shipment.courier,
          providerShipmentId: shipment.providerShipmentId,
          awb: shipment.awb,
          trackingUrl: shipment.trackingUrl,
          labelUrl: shipment.labelUrl,
          status: 'MANIFESTED',
          estimatedDeliveryAt: shipment.estimatedDeliveryAt,
        },
      });

  await db.shipmentEvent.create({
    data: {
      shipmentId: record.id,
      eventId: `evt_${shipment.awb}_MANIFESTED_${Date.now()}`,
      status: 'MANIFESTED',
      location: 'Surat Central Hub',
      occurredAt: new Date(),
      payload: JSON.stringify({ provider: providerName, courier: shipment.courier }),
    },
  });

  void recordAudit('SHIPMENT_CREATED', 'SHIPMENT', record.id, { awb: shipment.awb, provider: providerName, courier: shipment.courier });
  return record;
}

export async function applyShipmentTrackingEvent(params: {
  awb: string;
  status: string;
  location?: string;
  occurredAt?: Date;
  payload?: unknown;
}): Promise<{ applied: boolean; duplicate: boolean; orderNumber?: string }> {
  const shipment = await db.shipment.findUnique({ where: { awb: params.awb }, include: { order: true } });
  if (!shipment) return { applied: false, duplicate: false };

  const occurredAt = params.occurredAt ?? new Date();
  const eventId = `evt_${params.awb}_${params.status}_${occurredAt.getTime()}`;
  const dup = await db.shipmentEvent.findUnique({ where: { eventId } });
  if (dup) return { applied: false, duplicate: true, orderNumber: shipment.order.orderNumber };

  await db.shipmentEvent.create({
    data: {
      shipmentId: shipment.id,
      eventId,
      status: params.status,
      location: params.location,
      occurredAt,
      payload: JSON.stringify(params.payload ?? {}).slice(0, 6000),
    },
  });

  const statusMap: Record<string, ShipmentStatus> = {
    PICKED_UP: 'PICKED_UP',
    IN_TRANSIT: 'IN_TRANSIT',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
    RTO_INITIATED: 'RTO_INITIATED',
    RTO_DELIVERED: 'RTO_DELIVERED',
  };
  const nextShipmentStatus = statusMap[params.status];
  if (!nextShipmentStatus) return { applied: true, duplicate: false, orderNumber: shipment.order.orderNumber };

  await db.shipment.update({
    where: { id: shipment.id },
    data: {
      status: nextShipmentStatus,
      ...(nextShipmentStatus === 'DELIVERED' ? { deliveredAt: occurredAt } : {}),
      ...(nextShipmentStatus === 'PICKED_UP' ? { dispatchedAt: occurredAt } : {}),
    },
  });

  const { transitionOrder } = await import('./order.service');
  const order = shipment.order;
  try {
    if ((params.status === 'PICKED_UP' || params.status === 'IN_TRANSIT') && order.status === 'PACKED') {
      await transitionOrder(order.id, 'SHIPPED', 'Picked up by carrier', 'CARRIER');
    }
    if (params.status === 'OUT_FOR_DELIVERY' && order.status === 'SHIPPED') {
      await transitionOrder(order.id, 'OUT_FOR_DELIVERY', 'Out for delivery', 'CARRIER');
      void (await import('./notification.service')).sendWhatsAppTemplate(order.deliveryPhone, 'out_for_delivery', [order.deliveryName, order.orderNumber, shipment.courierName ?? 'Courier', shipment.awb ?? '', order.deliveryCity]);
    }
    if (params.status === 'DELIVERED') {
      if (order.status === 'SHIPPED' || order.status === 'OUT_FOR_DELIVERY') {
        await transitionOrder(order.id, 'DELIVERED', 'Delivered (carrier POD)', 'CARRIER');
      }
      if (order.paymentMethod === 'COD') {
        await db.payment.updateMany({ where: { orderId: order.id, method: 'COD' }, data: { status: 'SUCCESS' } });
      }
      void (await import('./notification.service')).sendWhatsAppTemplate(order.deliveryPhone, 'order_delivered', [order.deliveryName, order.orderNumber]);
    }
    if ((params.status === 'RTO_INITIATED' || params.status === 'RTO_DELIVERED') && order.status !== 'RETURNED') {
      await db.orderReturn.create({
        data: { orderId: order.id, reason: 'Return to origin (carrier)', status: params.status === 'RTO_DELIVERED' ? 'RESTOCKED' : 'REQUESTED', isRma: false },
      });
      await transitionOrder(order.id, 'RETURNED', 'Shipment RTO', 'CARRIER');
    }
  } catch (err) {
    console.error('[shipping] order state sync skipped:', err);
  }

  return { applied: true, duplicate: false, orderNumber: order.orderNumber };
}

export async function trackShipment(awb: string) {
  return db.shipment.findUnique({ where: { awb }, include: { events: { orderBy: { occurredAt: 'asc' } } } });
}
