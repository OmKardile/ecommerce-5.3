# API reference

Compact catalog of every route handler under `src/app/api/**` (60+ handlers). All responses use the envelope `{ ok: true, data }` on success and `{ ok: false, error, issues? }` on failure (`src/lib/api-helpers.ts`). Error status codes: 400 validation/invalid, 401 unauthenticated, 403 forbidden, 404 missing, 409 conflict/insufficient stock, 429 rate limited, 500 unexpected.

Auth abbreviations: **pub** = public, **cust** = `pn_session` customer cookie, **admin** = any admin role (`requireAnyAdmin`), **role(...)** = specific admin roles.

## Auth (customer OTP)

| Method & path | Auth | Request | Response / notes |
| --- | --- | --- | --- |
| POST `/api/auth/otp/request` | pub | `{ phone }` (Indian mobile, 6-9 start; 10 digits or 91-prefix) | `{ simulated, expiresInSec: 300 }`. Limits: 3/10min per phone, 12/10min per IP (429 otherwise). Simulated SMS prints OTP to dev.log |
| POST `/api/auth/otp/verify` | pub | `{ phone, code (6 digits), fullName? }` | Sets `pn_session`; `{ userId, customerId, phone, isNewUser, mergedCartItems }`. Max 5 wrong attempts per OTP; 400 on expired/not found; 403 for disabled accounts |
| GET `/api/auth/me` | cust | — | Session + customer profile, cart summary; 401 when anonymous (checkout uses this to trigger inline OTP login) |
| POST `/api/auth/logout` | cust | — | Clears `pn_session`; `{ ok }` |

## Account

| Method & path | Auth | Request | Response / notes |
| --- | --- | --- | --- |
| GET `/api/account/profile` | cust | — | User + customer (B2B fields), masked phone |
| PUT `/api/account/profile` | cust | `{ fullName, companyName?, gstin? }` (Zod-validated GSTIN) | Updates user + customer; intentionally clears `isB2BVerified` (desk re-verification flow) |
| GET `/api/account/addresses` | cust | — | Address list |
| POST `/api/account/addresses` | cust | `addressSchema` | 201 on create; 409 when book is full (max 10); exclusive default enforced in a transaction |
| PATCH `/api/account/addresses/[id]` | cust | partial address, `isDefault` | Sets default (unsets others); 404 on foreign id |
| DELETE `/api/account/addresses/[id]` | cust | — | Deletes; promotes next address to default |

## Cart

Guest carts ride the `pn_cart_id` cookie; all lines re-priced/re-stocked server-side on every read.

| Method & path | Auth | Request | Response / notes |
| --- | --- | --- | --- |
| GET `/api/cart` | pub (guest or cust) | — | `{ cart: CartView, cod: { eligible, reason? } }`; CartView: lines (skuId, skuCode, product/variant names, image, quantity, unitPricePaise, mrpPaise, lineTotalPaise, taxRate, availableStock, isCodAllowed, inStock), itemCount, subtotalPaise, mrpTotalPaise, gstAmountPaise, taxableBasePaise, allCodAllowed, hasOutOfStock |
| POST `/api/cart/item` | pub | `{ skuId, quantity 1-99 }` | Adds (clamped to availability); 409 when out of stock/unavailable; returns full cart |
| PATCH `/api/cart/item` | pub | `{ skuId, quantity 0-99 }` | 0 removes; 409 when exceeding availability |
| DELETE `/api/cart/item` | pub | `?skuId=` (query) | Removes line; returns full cart |
| POST `/api/cart/clear` | pub | — | Empties the cart |

## Catalog & search

| Method & path | Auth | Request | Response / notes |
| --- | --- | --- | --- |
| GET `/api/products` | pub | `productQuerySchema`: q, category (slugs, comma-ok), brand, minPrice/maxPrice (rupees), resolution, availability (`in-stock`/`out-of-stock`), minRating, featured, sort (`popular`/`price-asc`/`price-desc`/`newest`/`rating`), page, perPage (<=48, default 12) | `{ items: ProductCard[], total, page, perPage, totalPages }` |
| GET `/api/products/[slug]` | pub | — | Full product: brand, category, images, variants (attributes JSON, SKU price/stock); 404 on miss/inactive |
| GET `/api/search/quick` | pub | `?q=` | Up to 8 lightweight hits for header autocomplete |

## Wishlist

| Method & path | Auth | Request | Response / notes |
| --- | --- | --- | --- |
| GET `/api/wishlist` | cust | — | `{ items: ProductCard[] }` with price/rating enrichment |
| POST `/api/wishlist` | cust | — | Ensures the wishlist row exists (`{ ready: true }`) |
| POST `/api/wishlist/[productId]` | cust | — | Adds product |
| DELETE `/api/wishlist/[productId]` | cust | — | Removes product |

## Coupon & shipping

| Method & path | Auth | Request | Response / notes |
| --- | --- | --- | --- |
| POST `/api/coupon/validate` | pub | `{ code, subtotalPaise }` | `{ valid, discountPaise, coupon? }` or 400 with reason (server-side evaluation only) |
| GET `/api/shipping/pincode` | pub | `?pin=6 digits` | Zone: label, etaMin/MaxDays, `codAvailable`, express; error alert state for invalid PIN |
| GET `/api/shipping/rates` | pub | `?pin=&isCod=&orderValue=` | Provider quotes (simulator in sandbox): courier, etaDays, feePaise, codAvailable |

## Orders

| Method & path | Auth | Request | Response / notes |
| --- | --- | --- | --- |
| POST `/api/orders` | cust | `checkoutSchema`: paymentMethod (RAZORPAY/COD), delivery address fields, saveAddress?, isB2B (+companyName+gstin refine), couponCode?, customerNote?, idempotencyKey (8-64 chars) | Creates order in one transaction: stock reservation, coupon evaluation, zone shipping (SPECIAL >= Rs 199), COD rules (per-product flag, Rs 15,000 ceiling, zone COD), GST split. Returns `{ orderId, orderNumber PN-YYYY-NNNNNN, status (PENDING_PAYMENT or CONFIRMED for COD), totalAmount, paymentMethod }`. Error codes: EMPTY_CART, OUT_OF_STOCK/INSUFFICIENT_STOCK (409), COUPON_INVALID, COD_BLOCKED_ITEM/COD_LIMIT/COD_BLOCKED_ZONE, B2B_MISSING. Same idempotencyKey returns the SAME order. Note: `bundleDiscount` is reserved and currently 0 (kit 5% is advisory in the wizard) |
| GET `/api/orders/[orderNumber]` | cust (owner) or admin | — | Full order: items (with serialNumbers JSON), statusHistory, payments, shipments+events, user phone/name; 404 otherwise |

## Payments (Razorpay)

| Method & path | Auth | Request | Response / notes |
| --- | --- | --- | --- |
| POST `/api/payments/razorpay/order` | cust | `{ orderId }` (own order) | `{ gatewayOrderId, amountPaise, currency, mock }`; upserts `Payment` (INITIATED) |
| POST `/api/payments/razorpay/verify` | cust | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | HMAC sha256 of `orderId|paymentId` with key secret; on success marks payment SUCCESS, moves `PENDING_PAYMENT -> PAID` (+history), sends WhatsApp confirmation. Idempotent via `payment_events.eventId = evt_checkout_<paymentId>` (`alreadyProcessed`) |
| POST `/api/payments/razorpay/simulate` | cust (sandbox only) | `{ orderId, outcome: 'success'\|'failure' }` | success: builds a signed sim payment and internally calls verify -> `{ simulated, outcome, verified, orderNumber }`; failure: payment FAILED + history note, order stays pending. 403 when live keys are configured |

### Webhooks

| Method & path | Auth | Notes |
| --- | --- | --- |
| POST `/api/webhooks/razorpay` | HMAC | `x-razorpay-signature` = HMAC sha256 of the raw body with `RAZORPAY_WEBHOOK_SECRET` (timing-safe compare). Events stored in `payment_events` with provider event id -> duplicate ids get `{duplicate:true}`-style idempotent 200; `payment.captured` drives the same capture path as verify |
| POST `/api/webhooks/shipping` | dedup | Carrier tracking (Shiprocket/Delhivery normalized): `{ awb, current_status|status, location?, timestamp? }`. Status upper-snake-cased; event id `evt_<awb>_<status>_<ts>` dedup. Syncs order FSM: PICKED_UP/IN_TRANSIT + PACKED -> SHIPPED (physical stock decrement), OUT_FOR_DELIVERY, DELIVERED (+ COD payment SUCCESS), RTO -> OrderReturn + RETURNED. 404 unknown AWB |
| GET/POST `/api/webhooks/whatsapp` | verify token | GET: Meta subscription handshake (`hub.verify_token` vs `WHATSAPP_VERIFY_TOKEN`). POST: inbound events acknowledged 200 (simulated dispatches are audited) |

## Tracking (public)

| Method & path | Auth | Request | Response / notes |
| --- | --- | --- | --- |
| POST `/api/track` | pub | `{ orderNumber, phone }` | Rate limit 20/min per IP. Matches deliveryPhone or account phone; returns sanitized timeline only (status, history, shipment events, ETA — no amounts/addresses); 403 phone mismatch, 404 unknown order |

## Admin

All under `/api/admin/**`; every route requires an admin cookie and most writes audit-log via `recordAudit`. Permission scopes (D-12, Owner passes all): products/categories/brands → `products`/`categories`/`brands`; coupons/banners/posts → `coupons`/`banners`/`blog`; inventory → `inventory`; orders/shipments/serials → `orders`; returns → `returns`; settings → `settings`; reports → `reports`; customers → `customers`; inquiries → `inquiries`; reviews → `reviews`; stock-monitor observation → `stock_monitor`, decision endpoints → `inventory`; staff management + own-login change → Owner only (`requireOwner`). Gates are DB-fresh (`requirePermission` re-reads the user per request).

| Method & path | Auth (writes) | Purpose / key shapes |
| --- | --- | --- |
| POST `/api/admin/auth/login` | pub | `{ email, password }` -> sets `pn_admin_session`; scrypt verify; 8 attempts/10min per email; optional env bootstrap |
| POST `/api/admin/auth/logout` | admin | Clears admin cookie |
| GET `/api/admin/orders` | admin | Query q/status/page/perPage; status tabs + counts; B2B chip, AWB column |
| GET `/api/admin/orders/[id]` | admin | Full order for the detail sheet |
| POST `/api/admin/orders/transition` | ORDER | `{ orderId, status, comment? }` -> FSM transition (409 invalid), history row, audit `ORDER_STATUS_TRANSITION` |
| POST `/api/admin/orders/serials` | ORDER | `{ orderItemId, serialNumbers[] (<=200) }` -> stores JSON for RMA; audit `ORDER_SERIALS_CAPTURED` |
| POST `/api/admin/orders/shipment` | ORDER | `{ orderId, provider }` -> books AWB (live or sim), MANIFESTED event; audit `SHIPMENT_CREATED` |
| POST `/api/admin/orders/shipment/advance` | ORDER | Carrier-scan simulator: advance shipment status -> drives the same webhook sync path; audit `SHIPMENT_SCAN_SIMULATED` |
| GET/POST `/api/admin/products` | CATALOG | List / create (create books initial stock as PURCHASE_RECEIPT) |
| GET/PATCH/DELETE `/api/admin/products/[id]` | CATALOG | Fetch / update (stock deltas routed to inventory adjust) / soft delete |
| GET/POST + PATCH/DELETE `/api/admin/categories` (+`/[id]`) | CATALOG | Category CRUD, slug auto, HSN/GST fields |
| GET/POST + PATCH/DELETE `/api/admin/brands` (+`/[id]`) | CATALOG | Brand CRUD |
| GET `/api/admin/inventory` | admin | SKU matrix with availability + OK/LOW/OUT status |
| POST `/api/admin/inventory/adjust` | INVENTORY | `{ skuId, delta (non-zero), reason (PURCHASE_RECEIPT/MANUAL_ADJUSTMENT/DAMAGED_WRITE_OFF/RETURN_RESTOCK), notes? }`; guards: never negative, never below reserved; audit `STOCK_ADJUSTED` |
| GET `/api/admin/inventory/history` | admin | `?skuId=` movement ledger (latest 50) |
| GET `/api/admin/inventory/export` | admin | RFC4180 CSV of SKU stock |
| POST `/api/admin/inventory/import` | INVENTORY | Parsed CSV rows -> per-row adjust report |
| GET `/api/admin/customers` | admin | Search + ALL/B2B/RETAIL filter, orders count, LTV |
| GET/POST + PATCH/DELETE `/api/admin/coupons` (+`/[id]`) | CONTENT | Coupon CRUD; delete with redemptions deactivates instead |
| GET/POST + PATCH/DELETE `/api/admin/banners` (+`/[id]`) | CONTENT | Banner CRUD (HOME_HERO/HOME_STRIP) |
| GET/POST + PATCH/DELETE `/api/admin/posts` (+`/[id]`) | CONTENT | Blog CRUD; first publish stamps publishedAt |
| GET `/api/admin/reports/gstr1` | admin | `?from=&to=` B2B/B2C invoice schedule (taxable, CGST/SGST/IGST, invoice value) + CSV export |
| GET `/api/admin/settings` / PUT | GET admin; PUT SETTINGS | Read / save store settings (paise-coded fees, cutoff, support phone, announcement); audit `SETTINGS_UPDATED` |

## Misc

| Method & path | Auth | Notes |
| --- | --- | --- |
| GET `/api/health` | pub | `SELECT 1` probe; `{ status: 'healthy'\|'degraded', db: 'up'\|'down', time }` — always HTTP 200, check the body in monitors |
| POST `/api/contact` | pub | B2B inquiry: `b2bInquirySchema`, productRef resolves id/slug/SKU, status NEW, WhatsApp `b2b_quote_inquiry` (sim in sandbox); rate limit 5/10min per IP (429) |
| POST `/api/reviews` | cust | `reviewSchema` (rating 1-5, comment 5-2000); verified-purchase detection (DELIVERED order containing the product); upsert per product+user, resubmit re-queues `isApproved=false`; rate limit 5/hour per user |
