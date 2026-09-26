// Patel Networks — shared domain constants (single source of truth, Zod-validated at boundaries)

export const STORE = {
  name: 'Patel Networks',
  legalName: 'Patel Networks (MegaTech)',
  tagline: 'Surveillance & networking hardware, delivered India-wide',
  gstin: process.env.STORE_GSTIN ?? '24AAACP1234F1Z8',
  originPin: '395003',
  originState: 'Gujarat',
  originStateCode: '24',
  supportPhone: '+91 98765 43210',
  whatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '919876543210',
  email: 'sales@patelnetworks.in',
  city: 'Surat',
  dispatchCutoff: '4:00 PM IST',
} as const;

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  INVENTORY_MANAGER: 'INVENTORY_MANAGER',
  ORDER_MANAGER: 'ORDER_MANAGER',
  CONTENT_MANAGER: 'CONTENT_MANAGER',
  CUSTOMER: 'CUSTOMER',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ADMIN_ROLES: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.INVENTORY_MANAGER,
  ROLES.ORDER_MANAGER,
  ROLES.CONTENT_MANAGER,
];

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'COD_PENDING',
  'PAID',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'REFUNDED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Strict finite state machine (ADR-010). Additional equal-stage transitions allowed via map.
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED', 'CONFIRMED'],
  COD_PENDING: ['CONFIRMED', 'CANCELLED'],
  PAID: ['CONFIRMED', 'PROCESSING', 'CANCELLED', 'REFUNDED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'RETURN_REQUESTED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURN_REQUESTED'],
  DELIVERED: ['RETURN_REQUESTED'],
  CANCELLED: [],
  RETURN_REQUESTED: ['RETURNED', 'PROCESSING'],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
};

export const CUSTOMER_VISIBLE_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'COD_PENDING',
  'PAID',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pending Payment',
  COD_PENDING: 'COD Verification',
  PAID: 'Paid',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return Requested',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
};

export const MOVEMENT_REASONS = [
  'PURCHASE_RECEIPT',
  'ORDER_RESERVED',
  'ORDER_DISPATCHED',
  'ORDER_CANCELLED_RESTOCK',
  'RETURN_RESTOCK',
  'MANUAL_ADJUSTMENT',
  'DAMAGED_WRITE_OFF',
] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

export const PAYMENT_METHODS = ['RAZORPAY', 'COD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['INITIATED', 'SUCCESS', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SHIPMENT_STATUSES = [
  'MANIFESTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RTO_INITIATED',
  'RTO_DELIVERED',
  'CANCELLED',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

// ADR-004 selective COD
export const COD_MAX_ORDER_VALUE_PAISE = 15_00_000; // ₹15,000
export const FREE_SHIPPING_THRESHOLD_PAISE = 50_000; // ₹500
export const DEFAULT_SHIPPING_FEE_PAISE = 9_900; // ₹99
export const COD_FEE_PAISE = 4_900; // ₹49

// Cart cookie (guest cart token) — merged into the customer account at OTP login
export const CART_COOKIE = 'pn_cart_id';
export const CUSTOMER_COOKIE = 'pn_session';
export const ADMIN_COOKIE = 'pn_admin_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
