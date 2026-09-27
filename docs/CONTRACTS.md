# BUILD CONTRACTS (read before writing any code — applies to ALL agents)

## Ownership map (do NOT touch files outside your ownership; never edit shared files other than appending to worklog.md)
- Shared (lead only): prisma/schema.prisma, src/lib/*, src/server/db.ts, src/server/services/*, src/middleware.ts, src/app/layout.tsx, src/app/globals.css, src/components/storefront/{header,footer,product-card,quantity-input}.tsx, src/store/cart-store.ts, src/app/api/{auth,products,search,cart,wishlist,coupon,shipping,orders,payments,webhooks}/*, src/app/page.tsx (home shell), package.json.
- Agent 4-a: src/app/(store)/products/**, src/app/(store)/brands/**, src/app/(store)/kit-builder/**, src/components/storefront/{catalog,filters,variant-selector,pincode-checker,kit-builder}*.tsx — may create NEW api routes under src/app/api/kit/**.
- Agent 4-b: src/app/(store)/cart/**, checkout/**, order-success/**, track/**, account/**, src/components/storefront/{cart,checkout,account}*.tsx — may create NEW api routes under src/app/api/checkout/**, src/app/api/account/**.
- Agent 4-c: src/app/admin/**, src/app/api/admin/**, src/components/admin/**.
- Agent 4-d: src/app/(store)/{about,contact,faq,shipping-policy,return-policy,privacy-policy,terms,login}/**, src/app/(store)/blog/**, src/components/content/**, src/app/api/{contact,reviews}/**.
- Everyone: fetch data from existing APIs; use existing lib helpers; shadcn/ui components from src/components/ui only; lucide-react icons only.

## Design system (MANDATORY — "quietly luxurious editorial", NO dark surveillance theme, NO purple/blue gradients, NO neon/glow)
- Fonts already wired in root layout: `--font-display` (Fraunces, editorial serif — use for headlines, prices, big numbers via `font-display` utility class), body = Inter.
- Palette (CSS vars in globals.css, Tailwind classes): page bg `bg-background` (warm paper #FAF9F7), ink text `text-foreground` (#1C1917), primary `bg-primary text-primary-foreground` (deep pine #1A3C34), accent sparingly `text-accent-foreground`/`bg-accent` (muted brass #A15C07 area), borders `border-border` (subtle #E7E3DC), muted surfaces `bg-muted` (#F1EEE8).
- Layout: generous whitespace, 12-col grids, controlled asymmetry, editorial section labels (small caps tracking-widest text-xs uppercase), serif display headlines (font-display), hairline dividers (border-border), rounded-md (NOT rounded-3xl), soft shadows only (shadow-sm).
- Motion: subtle framer-motion reveals (fade+y 12-24px, 0.4-0.6s ease-out, once), hover transitions 200-300ms; scroll parallax ONLY via `src/components/motion/parallax.tsx` (transform-only, honours `prefers-reduced-motion`, editorial surfaces only — catalog/PDP/cart/checkout/account/admin stay motion-quiet). Responsive contract: `ui/Card` carries `min-w-0`, `ui/TabsList` scrolls (`max-w-full overflow-x-auto`), PageShell grids declare a base `grid-cols-1`; `scripts/responsive-sweep*.sh` must stay at 0px overflow @375/768/1280. No gimmicks.
- Imagery: real product photos from seed URLs (plain <img> with object-cover, aspect-[4/3] or square), NEVER invent placeholder boxes with icons, no emoji UI.
- Every page: `min-h-screen flex flex-col` handled by root layout wrapper; Footer already sticky (mt-auto). Content: `<main class="flex-1">`.
- Loading states: skeletons (src/components/ui/skeleton.tsx); empty states: quiet editorial text + link; error states: toast (sonner) + inline.
- Number formatting: ALWAYS `formatINR(paise)` from '@/lib/money'. Never raw floats.

## Core lib API (already implemented by lead — import, do not recreate)
- `@/lib/money`: formatINR(paise:int):string; rupeesToPaise(r:number):int; paiseToRupees(p):number.
- `@/lib/gst`: splitGstInclusive(priceInclusivePaise, gstRatePercent) -> {base, gst, cgst, sgst, igst} (cgst/sgst populated when intra-state); isSameState(srcPin, dstPin); computeCartTotals(items, opts) server-side.
- `@/lib/pincodes`: resolveZone(pin6) -> {zone, etaDays, codAvailable, express}; isServiceable(pin); estimateDelivery(pin) -> Date.
- `@/lib/constants`: ROLES, ORDER_STATUSES (enum-like string unions), ORDER_TRANSITIONS (valid map), MOVEMENT_REASONS, PAYMENT_STATUSES, PAYMENT_METHODS, SHIPMENT_STATUSES, ZONES, STORE (name, gstin, originPin, originState, supportPhone, whatsapp).
- `@/lib/session`: getSessionUser(), getAdminSession(), requireCustomer(), setCustomerSession(), setAdminSession(), clearAdminSession(), clearSessions() (jose HS256, cookies pn_session / pn_admin_session). `@/lib/api-helpers`: requirePermission(scope) / requireOwner() — DB-fresh gates (D-12); every admin mutation is permission-scoped, Owner passes implicitly.
- `@/lib/rate-limit`: rateLimit(key, limit, windowMs) -> {ok, remaining}.
- `@/lib/validators`: zod schemas: otpRequestSchema, otpVerifySchema, checkoutSchema, addressSchema, productQuerySchema, cartItemSchema, couponSchema, adminSchemas…
- `@/server/db`: prisma singleton.
- `@/lib/api-helpers`: ok(data), fail(message, status), parseBody(req, schema), requireAuth wrappers for route handlers.

## Data model quick reference (prisma/schema.prisma — read the file for full fields)
- User{phone unique, email?, passwordHash?, role:string, fullName?}, Customer{userId unique, fullName, companyName?, gstin?, isB2BVerified}, Address{customerId, recipientName, phone, line1,line2?,landmark?,city,state,pincode,isDefault,type}
- Category{name,slug unique,parentId?,hsnCode,gstRate:int,imageUrl?,sortOrder}, Brand{name,slug unique,logoUrl?,description?}
- Product{name,slug unique,brandId,categoryId,shortDesc?,description,modelNumber?,isActive,isFeatured,isCodAllowed,specifications Json?,documents Json?,warrantyMonths,metaTitle?,metaDescription?,deletedAt?}, ProductImage{productId,url,alt?,sortOrder}, ProductVariant{productId,name,attributes Json,skuId unique}, Sku{code unique,barcode?,mrp:int paise,sellingPrice:int paise,weightGrams,dimensions Json?}, Inventory{skuId unique,currentStock,reservedStock,lowStockThreshold}, InventoryMovement{skuId,quantity:int,reason,referenceId?,notes?,createdById?}
- Cart{userId? unique, guestToken? unique}, CartItem{cartId,skuId,quantity unique(cartId,skuId)}, Wishlist{userId unique}, WishlistItem{wishlistId,productId}
- Order{orderNumber unique,userId,status:string,paymentMethod, isB2B,gstin?,companyName?, subtotal,discountAmount,bundleDiscount,couponCode?,shippingAmount,codFee,gstAmount,cgstAmount,sgstAmount,igstAmount,totalAmount (ALL int paise), deliveryName,deliveryPhone,deliveryLine1,deliveryLine2?,deliveryLandmark?,deliveryCity,deliveryState,deliveryPincode, customerNote?, estimatedDeliveryAt?}, OrderItem{orderId,skuId,productName,variantName,skuCode,hsnCode,quantity,unitPrice,taxRate:int,taxAmount,totalPrice,serialNumbers Json(string[])}, OrderStatusHistory{orderId,status,comment?,changedBy?}
- Payment{orderId,gateway,gatewayOrderId?,gatewayPaymentId?,amount,method,status,events->PaymentEvent{eventId unique,eventType,payload}}, Shipment{orderId,provider,courierName?,providerShipmentId?,awb?,trackingUrl?,labelUrl?,status,estimatedDeliveryAt?}, ShipmentEvent{shipmentId,eventId unique,status,location?,occurredAt,payload}, OrderReturn{orderId,reason,status,isRma,refundAmount?}
- Coupon{code unique,description?,type:PERCENT|FIXED,value:int (percent int or paise),minOrderValue?,maxDiscountValue?,startsAt?,endsAt?,usageLimit?,usedCount,isActive}, CouponRedemption{couponId,orderId,discountAmount}
- Bundle{name,slug unique,description?,discountPct:int,isActive}, BundleItem{bundleId,skuId,quantity,slot:string recorder|camera|hdd|power|cable|connector, isOptional}
- Banner{title,subtitle?,imageUrl,linkUrl?,placement,sortOrder,isActive}, Post{title,slug unique,excerpt?,content,coverImageUrl?,status:DRAFT|PUBLISHED,publishedAt?,tags Json?}, Review{productId,userId,rating:int,title?,comment?,isVerified,isApproved}, AuditLog{userId?,action,entity,entityId,details?,ip?}, Setting{key unique,value}, B2BInquiry{name,phone,email?,companyName?,gstin?,message,productId?,status}

## Server conventions
- ALL mutations via API route handlers (NO server actions). Zod-validate every input. Money math server-side only.
- Stock monitor (ADR-10 + D-12): wall/history/count endpoints require the `stock_monitor` permission; decision endpoints (variance apply, request decide, session close) require `inventory`; every stock change — approvals and count-variance applies — writes a real `InventoryMovement` (MANUAL_ADJUSTMENT, referenceId = request/session) inside one transaction; proposals carry reason-validated deltas (DAMAGED/MISSING < 0, FOUND > 0, WRONG_LOCATION = 0); count sessions snapshot expected stock at open and each line applies at most once (`appliedAt`). Staff page access is fenced server-side by the panel layout (proxy `x-pathname`).
- Inventory-critical ops inside prisma.$transaction with { maxWait: 15000, timeout: 30000 }.
- Availability check: currentStock - reservedStock >= qty else 409 INSUFFICIENT_STOCK.
- Order create: reserve stock (reservedStock++ + movement ORDER_RESERVED) for every item; prepaid -> PENDING_PAYMENT then PAID on capture; COD -> COD_PENDING (respect COD ceiling Rs 15,000 paise = 1500000, per-product isCodAllowed, zone codAvailable).
- Order transitions ONLY via valid ORDER_TRANSITIONS map; write OrderStatusHistory row each change.
- Idempotency: payment_events.eventId & shipment_events.eventId unique — duplicate -> {duplicate:true} 200.
- RBAC: admin APIs call requireRole([...]) from '@/lib/session'; customers requireCustomer().
- Status codes: 400 validation, 401 unauth, 403 forbidden, 404 missing, 409 conflict/insufficient stock, 429 rate limit, 500.
- API JSON shape: ok(data) => {ok:true,data}; fail(msg,status) => {ok:false,error}.
- Cart cookie: pn_cart_id (guestToken uuid). Zustand cart-store mirrors server cart for badge/count only (source of truth = server).
- Notification services (dual-mode sim) exist at src/server/services/notification.service.ts: sendSmsOtp, sendWhatsAppTemplate(name, params, phone) — call these, never raw fetch.
- Shipping: src/server/services/shipping.service.ts -> createShipmentForOrder(orderId, opts) returns {awb, courier, labelUrl, trackingUrl, estimatedDelivery}; used by admin AWB action + webhook sim.
