// Patel Networks — shared domain constants (single source of truth, Zod-validated at boundaries)

export const STORE = {
  name: 'Patel Networks',
  legalName: 'Patel Networks (MegaTechzy)',
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

// The platform's developer (showcase / pitching audience). Platform-pitch
// enquiries from /showcase land HERE — deliberately separate from the store's
// trade desk (STORE above), whose audience is hardware buyers.
// Email is the confirmed public channel (portfolio contact page);
// WhatsApp is optional and only fires when DEVELOPER_WHATSAPP is configured.
export const DEVELOPER = {
  name: 'Omkar Kardile',
  portfolio: 'https://omkardile.is-a.dev/',
  email: process.env.DEVELOPER_EMAIL ?? 'omkardile84@gmail.com',
  whatsapp: process.env.DEVELOPER_WHATSAPP ?? null,
} as const;

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  STAFF: 'STAFF',
  CUSTOMER: 'CUSTOMER',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

// Human-facing names (D-11/D-12): the DB keys above are frozen API surface;
// only this map decides what people read in the UI.
// Ladder: Owner (store owner, every permission incl. staff management) →
// Staff (dynamic scope, granted per-account by the owner) → Customer.
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Owner',
  STAFF: 'Staff',
  CUSTOMER: 'Customer',
} as const;

// ---------------------------------------------------------------------------
// Permission scopes (D-12): the owner grants per-staff scopes at account
// creation (wizard at /admin/staff). Owner always passes every gate.
// `staff` itself is NOT grantable — /admin/staff is inherently owner-only.
// ---------------------------------------------------------------------------
export const PERMISSION_SCOPES = [
  { key: 'orders', label: 'Orders & fulfillment', group: 'Fulfillment', description: 'Order pipeline, packing, shipments, serials' },
  { key: 'returns', label: 'Returns & DOA', group: 'Fulfillment', description: 'RMA queue, DOA claims, refunds' },
  { key: 'products', label: 'Products', group: 'Catalog & stock', description: 'Create and edit products, variants, SKUs' },
  { key: 'categories', label: 'Categories', group: 'Catalog & stock', description: 'Category tree' },
  { key: 'brands', label: 'Brands', group: 'Catalog & stock', description: 'Brand directory' },
  { key: 'inventory', label: 'Inventory', group: 'Catalog & stock', description: 'Stock levels, adjustments, imports, variance approval' },
  { key: 'stock_monitor', label: 'Stock Monitor', group: 'Catalog & stock', description: 'Live wall, count sessions, discrepancy reports' },
  { key: 'customers', label: 'Customers', group: 'People & support', description: 'Customer directory and profiles' },
  { key: 'inquiries', label: 'Trade Desk', group: 'People & support', description: 'B2B / bulk inquiries' },
  { key: 'reviews', label: 'Reviews', group: 'People & support', description: 'Moderate product reviews' },
  { key: 'coupons', label: 'Coupons', group: 'Content & marketing', description: 'Discount codes' },
  { key: 'banners', label: 'Banners', group: 'Content & marketing', description: 'Homepage promo banners' },
  { key: 'blog', label: 'Blog', group: 'Content & marketing', description: 'Posts and guides' },
  { key: 'reports', label: 'Reports', group: 'Insights & config', description: 'Sales reports, GSTR-1 export' },
  { key: 'settings', label: 'Settings', group: 'Insights & config', description: 'Store config (sensitive)' },
] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number]['key'];
export const PERMISSION_KEYS: readonly PermissionScope[] = PERMISSION_SCOPES.map((s) => s.key);
export const SCOPE_LABELS: Record<PermissionScope, string> = Object.fromEntries(
  PERMISSION_SCOPES.map((s) => [s.key, s.label]),
) as Record<PermissionScope, string>;

/** Parse the User.permissions JSON column into validated scope keys. */
export function parsePermissions(value: unknown): PermissionScope[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<string>(PERMISSION_KEYS);
  return value.filter((v): v is PermissionScope => typeof v === 'string' && valid.has(v));
}

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
