import { z } from 'zod';

// ---------- shared ----------
export const pincodeSchema = z.string().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit Indian PIN code');
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => (v.length === 10 && /^[6-9]/.test(v)) || (v.length === 12 && v.startsWith('91')), 'Enter a valid Indian mobile number');

export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Enter a valid 15-character GSTIN');

export const addressSchema = z.object({
  recipientName: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  addressLine1: z.string().trim().min(5).max(160),
  addressLine2: z.string().trim().max(160).optional().or(z.literal('')),
  landmark: z.string().trim().max(120).optional().or(z.literal('')),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: pincodeSchema,
  isDefault: z.boolean().optional(),
  type: z.enum(['HOME', 'WORK', 'WAREHOUSE']).optional(),
});

// ---------- auth ----------
export const otpRequestSchema = z.object({ phone: phoneSchema });
export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit OTP'),
  fullName: z.string().trim().max(80).optional(),
});
export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

// ---------- catalog ----------
export const productQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(), // slug, comma-separated allowed
  brand: z.string().trim().max(120).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(), // rupees
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  resolution: z.string().trim().max(80).optional(), // e.g. "2MP,4MP,8MP"
  availability: z.enum(['in-stock', 'out-of-stock']).optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  featured: z.coerce.boolean().optional(),
  sort: z.enum(['popular', 'price-asc', 'price-desc', 'newest', 'rating']).default('popular'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(48).default(12),
});

// ---------- cart ----------
export const cartAddSchema = z.object({
  skuId: z.string().min(1),
  quantity: z.number().int().min(1).max(99).default(1),
});
export const cartUpdateSchema = z.object({
  skuId: z.string().min(1),
  quantity: z.number().int().min(0).max(99),
});

// ---------- checkout ----------
export const checkoutSchema = z
  .object({
    paymentMethod: z.enum(['RAZORPAY', 'COD']),
    delivery: addressSchema.omit({ isDefault: true, type: true }),
    saveAddress: z.boolean().optional(),
    isB2B: z.boolean().default(false),
    companyName: z.string().trim().max(120).optional(),
    gstin: gstinSchema.optional(),
    couponCode: z.string().trim().max(40).optional(),
    customerNote: z.string().trim().max(500).optional(),
    idempotencyKey: z.string().min(8).max(64),
  })
  .refine((v) => !v.isB2B || (v.companyName && v.gstin), {
    message: 'Business name and GSTIN are required for B2B purchases',
    path: ['gstin'],
  })
  .refine((v) => v.paymentMethod !== 'COD' || !v.isB2B || v.gstin, {
    message: 'GSTIN required',
    path: ['gstin'],
  });

// ---------- coupons ----------
export const couponValidateSchema = z.object({
  code: z.string().trim().min(2).max(40),
  subtotalPaise: z.number().int().nonnegative(),
});

// ---------- admin: catalog ----------
export const adminCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().trim().max(500).optional(),
  parentId: z.string().nullable().optional(),
  hsnCode: z.string().trim().max(10).optional(),
  gstRate: z.number().int().min(0).max(28).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export const adminBrandSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const variantInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  attributes: z.record(z.string(), z.string()),
  sku: z.object({
    code: z.string().trim().min(2).max(40),
    barcode: z.string().trim().max(60).optional().or(z.literal('')),
    mrp: z.number().int().nonnegative(),
    sellingPrice: z.number().int().nonnegative(),
    weightGrams: z.number().int().nonnegative().default(500),
    stock: z.number().int().nonnegative().default(0),
    lowStockThreshold: z.number().int().nonnegative().default(5),
  }),
});

export const adminProductSchema = z.object({
  name: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  brandId: z.string().min(1),
  categoryId: z.string().min(1),
  shortDesc: z.string().trim().max(220).optional().or(z.literal('')),
  description: z.string().trim().min(10),
  modelNumber: z.string().trim().max(60).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isCodAllowed: z.boolean().default(true),
  warrantyMonths: z.number().int().min(0).max(120).default(12),
  specifications: z.array(z.object({ key: z.string().trim().min(1), value: z.string().trim().min(1) })).default([]),
  images: z.array(z.object({ url: z.string().url().or(z.literal('')), altText: z.string().trim().max(160).optional() })).default([]),
  variants: z.array(variantInputSchema).min(1, 'At least one variant/SKU is required'),
});

export const stockAdjustSchema = z.object({
  skuId: z.string().min(1),
  delta: z.number().int().refine((v) => v !== 0, 'Quantity cannot be zero'),
  reason: z.enum(['PURCHASE_RECEIPT', 'MANUAL_ADJUSTMENT', 'DAMAGED_WRITE_OFF', 'RETURN_RESTOCK']),
  notes: z.string().trim().max(300).optional(),
});

// ---------- admin: orders ----------
export const orderTransitionSchema = z.object({
  orderId: z.string().min(1),
  status: z.string().min(2),
  comment: z.string().trim().max(300).optional(),
});

// ---------- customer: order return / DOA request ----------
export const returnRequestSchema = z.object({
  reason: z.string().trim().min(10, 'Describe the issue in at least 10 characters').max(600),
});

// ---------- customer: pre-pack delivery address edit ----------
// PIN code & state are intentionally NOT accepted post-checkout: they drive the
// shipping zone, COD eligibility and the CGST/SGST vs IGST split already on the
// invoice. Everything else (recipient, contact, lines, landmark, city) is editable
// until the order is packed.
export const orderAddressUpdateSchema = addressSchema.omit({ isDefault: true, type: true, pincode: true, state: true });
export type OrderAddressUpdateInput = z.infer<typeof orderAddressUpdateSchema>;

// ---------- customer: back-in-stock notify-me ----------
export const stockAlertSchema = z.object({
  skuId: z.string().min(1),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => /^(\+91)?[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number')
    .transform((v) => (v.startsWith('+91') ? v.slice(3) : v)),
});

// ---------- admin: returns queue ----------
export const returnActionSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT', 'MARK_RESTOCKED', 'MARK_REFUNDED']),
    // courier-inward evidence — REQUIRED for MARK_RESTOCKED, optional elsewhere
    inwardCourier: z.string().trim().min(2).max(60).optional(),
    inwardTracking: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9-]{4,39}$/, 'Docket number must be 5-40 letters/digits/dashes')
      .optional(),
    inwardNote: z.string().trim().max(300).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action === 'MARK_RESTOCKED') {
      if (!v.inwardCourier) ctx.addIssue({ code: 'custom', message: 'Return courier is required', path: ['inwardCourier'] });
      if (!v.inwardTracking) ctx.addIssue({ code: 'custom', message: 'Courier docket / return AWB number is required', path: ['inwardTracking'] });
    }
  });
export const serialNumbersSchema = z.object({
  orderItemId: z.string().min(1),
  serialNumbers: z.array(z.string().trim().min(1).max(60)).max(200),
});
export const createShipmentSchema = z.object({
  orderId: z.string().min(1),
  provider: z.enum(['SHIPROCKET', 'DELHIVERY']).default('SHIPROCKET'),
});

// ---------- admin: marketing ----------
export const adminCouponSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(40).regex(/^[A-Z0-9_-]+$/),
  description: z.string().trim().max(200).optional().or(z.literal('')),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().positive(),
  minOrderValue: z.number().int().nonnegative().optional().nullable(),
  maxDiscountValue: z.number().int().nonnegative().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const adminBannerSchema = z.object({
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(220).optional().or(z.literal('')),
  imageUrl: z.string().url().min(1),
  linkUrl: z.string().trim().max(300).optional().or(z.literal('')),
  placement: z.enum(['HOME_HERO', 'HOME_STRIP']).default('HOME_HERO'),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const adminPostSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  excerpt: z.string().trim().max(300).optional().or(z.literal('')),
  content: z.string().trim().min(20),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  tags: z.array(z.string().trim()).default([]),
});

// ---------- misc ----------
export const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().or(z.literal('')),
  comment: z.string().trim().min(5).max(2000),
});

export const b2bInquirySchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: z.string().trim().email().optional().or(z.literal('')),
  companyName: z.string().trim().max(120).optional().or(z.literal('')),
  gstin: gstinSchema.optional().or(z.literal('')),
  message: z.string().trim().min(5).max(2000),
  productId: z.string().optional(),
});

export const settingsSchema = z.object({
  codMaxOrderValuePaise: z.number().int().positive().optional(),
  codFeePaise: z.number().int().nonnegative().optional(),
  shippingFeePaise: z.number().int().nonnegative().optional(),
  freeShippingThresholdPaise: z.number().int().nonnegative().optional(),
  dispatchCutoff: z.string().trim().max(40).optional(),
  supportPhone: z.string().trim().max(20).optional(),
  announcement: z.string().trim().max(160).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type AddressInput = z.infer<typeof addressSchema>;

// ---------- admin: stock monitor (ADR-010) ----------
export const DISCREPANCY_REASONS = ['DAMAGED', 'MISSING', 'FOUND', 'WRONG_LOCATION', 'OTHER'] as const;

export const stockCountSessionCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    scopeKind: z.enum(['CATEGORY', 'BRAND', 'ALL']),
    scopeRefId: z.string().trim().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.scopeKind !== 'ALL' && !v.scopeRefId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scopeRefId'], message: 'scopeRefId is required for CATEGORY/BRAND scopes' });
    }
  });

export const stockCountSubmitSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        countedQty: z.number().int().min(0, 'Counted quantity cannot be negative').max(100000),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .min(1, 'At least one counted line is required')
    .max(500),
});

export const stockAdjustmentRequestSchema = z
  .object({
    skuId: z.string().min(1),
    delta: z.number().int().min(-10000).max(10000),
    reason: z.enum(DISCREPANCY_REASONS),
    note: z.string().trim().max(300).optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.reason === 'DAMAGED' || v.reason === 'MISSING') && v.delta >= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['delta'], message: `${v.reason} requires a negative delta (stock leaving)` });
    }
    if (v.reason === 'FOUND' && v.delta <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['delta'], message: 'FOUND requires a positive delta (stock reappearing)' });
    }
    if (v.reason === 'WRONG_LOCATION' && v.delta !== 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['delta'], message: 'WRONG_LOCATION is a flag report — delta must be 0' });
    }
    if (v.reason === 'OTHER' && v.delta === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['delta'], message: 'Delta cannot be zero' });
    }
  });

export const stockRequestDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
});

export const countLineApplySchema = z.object({
  lineId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Staff & access management (D-12) — owner-only surface
// ---------------------------------------------------------------------------

export const staffCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  accountType: z.enum(['STAFF', 'SUPER_ADMIN']),
  permissions: z.array(z.string()).default([]),
});

export const staffUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  password: z.string().min(8).max(72).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const ownerCredentialsSchema = z
  .object({
    currentPassword: z.string().min(1),
    email: z.string().trim().toLowerCase().email().optional(),
    newPassword: z.string().min(8).max(72).optional(),
  })
  .refine((d) => Boolean(d.email || d.newPassword), {
    message: 'Provide a new email and/or a new password',
    path: ['email'],
  });
