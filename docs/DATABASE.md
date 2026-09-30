# Database

Single Prisma schema at `prisma/schema.prisma` with **39 models**, table names mapped to snake_case via `@@map`. The schema header documents the portability contract:

```
// PORTABILITY NOTE: This schema is 100% valid for BOTH SQLite (sandbox dev)
// and PostgreSQL (client VPS production). Guarantees: no Prisma enums (string + Zod),
// no native arrays (Json/Json-string), all money = integer paise.
```

## Entity map (all 39 models)

Identity & access:

| Model | Key fields / relations |
| --- | --- |
| `User` | phone (unique), email (unique, optional), passwordHash (staff), fullName, role (string: CUSTOMER/SUPER_ADMIN/STAFF — D-12 removed the fixed manager roles), permissions (JSON array of permission-scope keys for STAFF, nullable), isActive, deletedAt; has customer, cart, wishlist, orders, reviews, auditLogs, countSessionsOpened; index on role |
| `OtpVerification` | phone, codeHash (sha256), expiresAt, isVerified, attempts; index (phone, createdAt) |
| `Customer` | userId (unique, cascade) -> User; fullName, companyName, gstin, isB2BVerified; has addresses |
| `Address` | customerId (cascade) -> Customer; recipientName, phone, addressLine1/2, landmark, city, state, pincode, isDefault, type (HOME/WORK/WAREHOUSE); index on customerId |

Catalog (Category -> Brand -> Product -> Variant -> SKU -> Inventory invariant):

| Model | Key fields / relations |
| --- | --- |
| `Category` | name, slug (unique), parentId self-relation ("CategoryTree"), hsnCode (default 8525), gstRate (int percent, default 18), sortOrder, isActive, imageUrl; index on parentId |
| `Brand` | name, slug (unique), logoUrl, description, isActive |
| `Product` | name, slug (unique), brandId + categoryId (FK, indexed), shortDesc/description, modelNumber, isActive, isFeatured, isCodAllowed (ADR-004), specifications (JSON string), documents (JSON string), warrantyMonths, metaTitle/metaDescription, deletedAt (soft); indexes (brandId), (categoryId), (isActive, isFeatured) |
| `ProductImage` | productId (cascade), url, altText, sortOrder; index on productId |
| `ProductVariant` | productId (cascade), name, attributes (JSON string, ADR-005), skuId (unique, cascade) -> Sku, isActive, sortOrder |
| `Sku` | code (unique), barcode (unique, optional), mrp (paise), sellingPrice (paise, GST-inclusive), weightGrams, dimensions (JSON string), isActive |
| `Inventory` | skuId (unique, cascade); currentStock, reservedStock, lowStockThreshold (default 5). Availability = current - reserved. This is the ONLY place stock exists |
| `InventoryMovement` | skuId (cascade), quantity (signed int), reason (string), referenceId, notes, createdById; indexes (skuId, createdAt) and (reason). Immutable audit ledger |
| `Bundle` / `BundleItem` | kit-builder: slug (unique), discountPct (seed 5); items with slot (recorder/camera/hdd/power/cable/connector), quantity, isOptional; unique (bundleId, skuId, slot) |

Cart & wishlist:

| Model | Key fields / relations |
| --- | --- |
| `Cart` | userId (unique, optional) OR guestToken (unique, optional); 30-day cookie `pn_cart_id` for guests; auto-merge on login |
| `CartItem` | cartId (cascade), skuId, quantity; unique (cartId, skuId) |
| `Wishlist` | userId (unique); `WishlistItem` wishlistId + productId, unique (wishlistId, productId) |

Orders, payments, fulfillment:

| Model | Key fields / relations |
| --- | --- |
| `Order` | orderNumber (unique, `PN-<year>-<6 digits>`), userId, status (string, FSM), paymentMethod (RAZORPAY/COD), isB2B, gstin, companyName; money columns ALL int paise: subtotal, discountAmount, bundleDiscount, shippingAmount, codFee, gstAmount, cgstAmount, sgstAmount, igstAmount, totalAmount; denormalized delivery address snapshot (deliveryName/Phone/Line1/Line2/Landmark/City/State/Pincode); customerNote (also stores `idem:<idempotencyKey>`), estimatedDeliveryAt, deletedAt; indexes userId, status, createdAt |
| `OrderItem` | orderId (cascade), skuId, productName/variantName/skuCode/hsnCode snapshots, quantity, unitPrice, taxRate, taxAmount, lineDiscount, totalPrice, serialNumbers (JSON string[] for RMA/warranty), isCodAllowed; index orderId |
| `OrderStatusHistory` | orderId (cascade), status, comment, changedBy (SYSTEM/operator id/CARRIER/SANDBOX); index orderId |
| `Payment` | orderId, gateway (RAZORPAY), gatewayOrderId (unique), gatewayPaymentId (unique), amount, currency INR, method (ONLINE/COD), status (INITIATED/SUCCESS/FAILED/REFUNDED); index orderId |
| `PaymentEvent` | paymentId (optional), eventId (UNIQUE — idempotency), eventType, payload (JSON string, 6000-char cap) |
| `Shipment` | orderId (UNIQUE — one shipment row per order, updated on re-book), provider (SHIPROCKET/DELHIVERY), courierName, providerShipmentId, awb (unique), trackingUrl, labelUrl, status (MANIFESTED/PICKED_UP/IN_TRANSIT/OUT_FOR_DELIVERY/DELIVERED/RTO_INITIATED/RTO_DELIVERED/CANCELLED), estimatedDeliveryAt, dispatchedAt, deliveredAt |
| `ShipmentEvent` | shipmentId (cascade), eventId (UNIQUE — idempotency), status, location, occurredAt, payload; index shipmentId |
| `OrderReturn` | orderId, reason, status (REQUESTED/APPROVED/REJECTED/RESTOCKED/REFUNDED), isRma, refundAmount; index orderId |

Stock monitor (ADR-010):

| Model | Key fields / relations |
| --- | --- |
| `StockCountSession` | title, status (OPEN/COUNTING/SUBMITTED/CLOSED/CANCELLED), scopeKind (CATEGORY/BRAND/ALL) + scope refs, expected snapshot (JSON), openedById (User), counts per scope; index status |
| `StockCountLine` | sessionId (cascade), skuId, expectedQty, countedQty (nullable), variance (derived on write), appliedAt + appliedMovementId (single-apply marker); unique (sessionId, skuId) |
| `StockAdjustmentRequest` | skuId, delta (reason-validated), reason (DAMAGED/MISSING/FOUND/WRONG_LOCATION/OTHER), note, status (PENDING/APPROVED/REJECTED), proposedById, decidedById, movementId (backfill on approve) |

Marketing & content:

| Model | Key fields / relations |
| --- | --- |
| `Coupon` | code (unique), type (PERCENT/FIXED), value (percent int OR paise), minOrderValue, maxDiscountValue, startsAt/endsAt, usageLimit, usedCount, isActive |
| `CouponRedemption` | couponId, orderId, discountAmount; unique (couponId, orderId) |
| `Banner` | title, subtitle, imageUrl, linkUrl, placement (HOME_HERO/HOME_STRIP), sortOrder, isActive, startsAt/endsAt |
| `Post` | title, slug (unique), excerpt, content (markdown), coverImageUrl (nullable by design), status (DRAFT/PUBLISHED), publishedAt, tags (JSON string[]) |
| `Review` | productId (cascade), userId (cascade), rating 1-5, title, comment, isVerified (delivered purchase), isApproved (moderation); unique (productId, userId), index (productId, isApproved) |
| `B2BInquiry` | name, phone, email, companyName, gstin, message, productId, status (NEW/CONTACTED/CLOSED) |
| `PlatformInquiry` | name, contact (email or phone), interest (platform/walkthrough/other), message, status (NEW/REPLIED/CLOSED), note — showcase-pitch leads for the developer, separate from the store's B2BInquiry |

Platform:

| Model | Key fields / relations |
| --- | --- |
| `AuditLog` | userId (optional), action, entity, entityId, details (JSON string, 8000-char cap), ip; indexes (entity, entityId), createdAt |
| `Setting` | key (primary key, `store.*` namespace), value (JSON string); COD rules, fees, cutoff, support phone, announcement |

## Money as integer paise — rationale (resolution C5)

Every monetary column is an `Int` of paise (1 INR = 100 paise). Floats cannot represent 0.1 exactly, so Decimal or float money leaks rounding errors across GST splits, proportional coupon allocation and carrier fees; integers make all server math exact and are portable across SQLite and PostgreSQL without a NUMERIC dependency. Conversion happens only at the edges: `rupeesToPaise()` when an admin types rupees, `formatINR()` for display. GST extraction from inclusive prices uses `base = round(price * 100 / (100 + rate))` with CGST/SGST split rounded to the nearest paise (`src/lib/gst.ts`).

## Portability notes (ADR-021)

- **No Prisma enums:** all state machines (order status, payment status, shipment status, movement reason, roles, slots) are plain strings validated by Zod/constant maps in `src/lib/constants.ts` + `src/lib/validators.ts`. SQLite cannot alter enum unions, and PG enums would make the provider switch one-way.
- **No native arrays:** anything array-shaped (specifications, documents, variant attributes, serialNumbers, post tags, audit details, setting values) is stored as a JSON **string** and parsed at the service/serializer boundary. Prisma `Json` maps fine to both, but string columns were chosen where the value is hand-rolled JSON so SQLite and PG behave identically.
- **Money:** integer paise (above), no `Decimal` fields.
- **Indexes/uniques of note:** `users.phone`/`email` unique; `skus.code`/`barcode` unique; `inventory.skuId` unique; `orders.orderNumber` unique + status index; `payments.gatewayOrderId`/`gatewayPaymentId` unique; `payment_events.eventId` and `shipment_events.eventId` unique (webhook idempotency); `shipments.awb` and `shipments.orderId` unique; `reviews (productId, userId)` unique; `coupon_redemptions (couponId, orderId)` unique; `cart_items (cartId, skuId)` unique; `bundle_items (bundleId, skuId, slot)` unique.
- **Soft deletes:** `User.deletedAt`, `Product.deletedAt`, `Order.deletedAt`.

## Seed overview (`prisma/seed.ts`)

Cleans all tables in dependency order, then creates:

- Users: `superadmin@patelnetworks.in` (SUPER_ADMIN, password `patel@admin2026` or `ADMIN_PASSWORD`), `inventory@patelnetworks.in` (INVENTORY_MANAGER, `warehouse@2026`), `orders@patelnetworks.in` (ORDER_MANAGER, `fulfill@2026`), test customer `+919876543210` (Rajesh Contractor, B2B: Shreeji Electricals, GSTIN 24AABCS1429B1Z5) with one default Surat WAREHOUSE address
- Categories: 5 roots (CCTV & Surveillance, Displays & Screens, Cables & Wiring, Connectors & Accessories, Media Converters & Optical) + 9 subcategories, HSN 8525/8528/8544/8536/8517/8471, GST 18%
- Brands: 10 (CP Plus, Hikvision, Dahua, MTC, D-Link, DGSoal, Axpial, Optilink, Lapcare, AOC)
- Products: 14 products / 23 SKUs with multi-attribute variants, documented sample prices (e.g. `CPP-B01-2MP-36` MRP 2800 / price 1450 / stock 45 COD; `CPP-B01-8MP-28` price 4890 / stock 8 no-COD), each SKU getting an `Inventory` row and an initial `PURCHASE_RECEIPT` movement (`SEED-INTAKE`)
- Kit bundle `custom-cctv-kit` (discountPct 5) wiring recorder/camera/hdd/cable/connector SKUs
- Coupons: WELCOME5 (5%, max Rs 500, min Rs 1,000), INSTALLER10 (10%, min Rs 25,000, max Rs 2,500), CABLE200 (fixed Rs 200 over Rs 2,000)
- 2 banners (hero + kit strip), 3 published technical blog posts (markdown w/ GFM tables), 3 approved verified reviews tied to the test customer, settings via `saveSettings()`

Images come from the optional external bank `prisma/seed-images.json` (`{ "key": ["url", ...] }`, consumed round-robin by `img()`); when the file is absent the corresponding image fields stay null and the UI renders typographic placeholders (ADR-020).

## Re-seeding

The seed is destructive (deleteMany of all domain tables first):

```bash
bun run db:push        # (re)create schema — --accept-data-loss by design in dev
bun prisma/seed.ts     # full clean + reseed; prints admin/customer logins when done
```

Note: seed behavior is not idempotent-safe for partial runs — always run the full seed.

## Switching to PostgreSQL (production)

1. Set `provider = "postgresql"` in `prisma/schema.prisma` (the single-line change) and point `DATABASE_URL` at the VPS Postgres instance.
2. `bun run db:generate && bun run db:push` — or `bun run db:migrate` / `db:reset` if you prefer a migrations baseline; push/migrate behave identically for this schema on either provider.
3. Seed once with `bun prisma/seed.ts` (or import a real catalog), then create the production superadmin via `ADMIN_EMAIL`/`ADMIN_PASSWORD` bootstrap login.

No other code change is required: statuses are strings, arrays are JSON strings, money is integers. See [DEPLOYMENT.md](./DEPLOYMENT.md) for wiring this into the Docker Compose deploy.
