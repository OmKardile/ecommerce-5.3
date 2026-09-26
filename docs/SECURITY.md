# Security

Security posture of the Patel Networks build, grounded in the implemented code. Sandbox deviations are called out explicitly at the end.

## Authentication design

**Customers — phone + OTP (no passwords):**

- Phone normalization to E.164 `+91XXXXXXXXXX` for 10-digit numbers starting 6-9 (`src/lib/phone.ts`); Zod `phoneSchema` accepts 10 digits or a 91-prefix and strips non-digits.
- OTP: 6-digit `randomInt(100000, 999999)`, stored as `sha256(code:JWT_SECRET)` (never plaintext), 5-minute TTL, single-use (`isVerified`).
- Limits (auth.service): 3 sends / 10 min per phone, 12 sends / 10 min per IP, max 5 incorrect attempts per OTP record before it is dead. All return 429/400 with friendly messages.
- Verify uses `timingSafeEqual` on hashed buffers; disabled accounts are refused (403).
- On success the guest cart (`pn_cart_id`) is merged into the account cart and the guest cart deleted.

**Staff — email + password:**

- Password hashing: Node stdlib `crypto.scryptSync` (N=16384, r=8, p=1, 64-byte key) with random salt, stored as `scrypt$salt$hash`; verification is timing-safe (resolution C4 — Argon2id was specified by the old repo's ADR-008 but replaced to avoid native-module fragility; swapping back on the VPS is optional and documented).
- Login rate limit: 8 attempts / 10 min per email. Errors are generic (`Invalid credentials`, 401). `CUSTOMER`-role users can never log in as staff.
- Optional production bootstrap: `ADMIN_EMAIL`/`ADMIN_PASSWORD` env creates the SUPER_ADMIN on first login.

**Sessions:**

- jose HS256 JWTs, 7-day expiry, in httpOnly `sameSite=lax` cookies; `secure` when `NODE_ENV=production`.
- Strict cookie isolation (ADR-019): `pn_session` (kind=customer) vs `pn_admin_session` (kind=admin). The `kind` claim is checked by the edge proxy so an admin token cannot open `/account/*` and vice versa; a `pn_cart_id` is never an identity.
- `JWT_SECRET` signs sessions and OTP hashes — must be 32+ random bytes in production; rotation invalidates all sessions and live OTPs.

## RBAC role matrix

Roles on `User.role`: `SUPER_ADMIN`, `ADMIN`, `INVENTORY_MANAGER`, `ORDER_MANAGER`, `CONTENT_MANAGER`, `CUSTOMER`. Admin APIs enforce via `requireAnyAdmin()` / `requireRole([...])`; customers via `requireCustomer()`. Actual arrays per route family (verified in code):

| Capability | SUPER_ADMIN | ADMIN | INVENTORY_MANAGER | ORDER_MANAGER | CONTENT_MANAGER |
| --- | --- | --- | --- | --- | --- |
| Admin reads (orders, products, customers, inventory, settings GET, reports) | yes | yes | yes | yes | yes |
| Product/category/brand create/update/delete | yes | yes | no | no | no |
| Inventory view/export | yes | yes | yes | yes | yes |
| Inventory adjust + CSV import | yes | yes | yes | no | no |
| Order transitions, serials, AWB booking, scan simulator | yes | yes | no | yes | no |
| Coupons / banners / posts CRUD | yes | yes | no | no | yes |
| Settings PUT | yes | yes | no | no | no |
| Admin login/logout | yes | yes | yes | yes | yes |

Customers have no admin surface at all; storefront customer APIs only ever operate on the session's own data (order lookup by owner-or-admin, addresses by customerId, etc.).

## Middleware / proxy guards

`src/proxy.ts` (Next 16 edge proxy, matcher `/admin/:path*` and `/account/:path*`):

- `/admin/*` except `/admin/login`: requires a valid `pn_admin_session` with `kind=admin`, else 307 to `/admin/login?next=...`; an authed admin hitting `/admin/login` is bounced to `/admin`.
- `/account/*` except `/account/login`: requires valid `pn_session` with `kind=customer`, else 307 to `/account/login?next=...` (`next` is validated as a same-site path when consumed).
- Page-level guards re-check ownership server-side (order detail/invoice render `notFound()` for non-owners), so the proxy is defense-in-depth, not the only gate.

## Input validation

- Every mutating route handler parses its body through a Zod schema (`parseBody` in `api-helpers`), returning 400 with `issues` (path + message) on failure. Schemas in `src/lib/validators.ts` cover OTP, admin login, addresses, checkout (B2B requires legal name + 15-char GSTIN regex), product queries, cart quantities (max 99), stock adjustments (delta non-zero, reason enum), order transitions, serials (max 200), coupons/banners/posts, reviews, B2B inquiries, settings.
- Zod transforms normalize at the edge: phone digits, GSTIN trim/uppercase, coupon uppercase, slug pattern enforcement.
- Query strings on admin list endpoints are whitelisted (q, status, page, perPage, from/to dates).

## Server-side price/stock trust

Zero-trust commerce: the client never sends prices, totals, fees, or stock. `cart.service.getCartView()` re-reads live SKU prices and inventory on every read (silently clamping stale quantities); `order.service.createOrderFromCart()` recomputes subtotal, coupon discount (server-side `evaluateCoupon`), zone shipping, COD fees, and the GST split in integer paise inside the reservation transaction. Availability = `currentStock - reservedStock` with 409 on shortfall. Admin stock edits cannot drive stock negative or below reserved units.

## Idempotency

| Threat | Control |
| --- | --- |
| Double order submit / retry | Client `idempotencyKey` (Zod 8-64) persisted in the order's `customerNote` as `idem:<key>`; repeat POSTs return the original order |
| Duplicate payment capture (verify + webhook) | `payment_events.eventId` unique (`evt_checkout_<paymentId>` or provider event id); duplicate -> `{alreadyProcessed:true}` 200; `payment.status === 'SUCCESS'` short-circuits re-processing |
| Duplicate carrier webhooks | `shipment_events.eventId` unique (`evt_<awb>_<status>_<ts>`); duplicates return `{duplicate:true}` |
| Double transitions | Same-status transition is a no-op; others validated against `ORDER_TRANSITIONS` (409) |
| Coupon double-count | `coupon_redemptions (couponId, orderId)` unique |

## Rate limiting (memory store)

`src/lib/rate-limit.ts` — sliding-window buckets keyed by arbitrary strings, swept each minute. Single-node by design (documented in the file); move to redis if scaling out. Verified usage:

| Route | Key | Limit |
| --- | --- | --- |
| POST `/api/auth/otp/request` | `otp:<phone>` | 3 / 10 min |
| POST `/api/auth/otp/request` | `otp-ip:<ip>` | 12 / 10 min |
| POST `/api/admin/auth/login` | `admin-login:<email>` | 8 / 10 min |
| POST `/api/track` | `track:<ip>` | 20 / min |
| POST `/api/contact` | `b2b:<ip>` | 5 / 10 min |
| POST `/api/reviews` | `review:<userId>` | 5 / hour |

## Audit logging

`recordAudit()` (notification.service) writes `audit_logs` rows (action, entity, entityId, details JSON, userId) — fire-and-forget with internal error trapping. Audited actions include: `ORDER_CREATED`, `ORDER_STATUS_TRANSITION`, `ORDER_SERIALS_CAPTURED`, `SHIPMENT_CREATED`, `SHIPMENT_SCAN_SIMULATED`, `STOCK_ADJUSTED`, `SETTINGS_UPDATED`, `COUPON_CREATED/UPDATED/DELETED`, `BANNER_*`, `POST_*`, `WHATSAPP_DISPATCH`, `WHATSAPP_DISPATCH_SIMULATED`.

## Security headers, cookies, CSRF

- Next.js default headers apply; deployment nginx is expected to add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS once TLS is live (see DEPLOYMENT.md).
- Session cookies: httpOnly + sameSite=lax blocks cross-site script reads and (together with same-site JSON POSTs) the classic CSRF vector; there are no cross-origin form posts in the app. `secure` is automatic in production.
- No `dangerouslySetInnerHTML` for user content; blog markdown renders through react-markdown (no raw HTML); webhook payloads are stored as truncated JSON strings, never rendered.
- OTP codes and admin passwords are only ever stored hashed; webhook signatures compared with `timingSafeEqual`.

## Known sandbox deviations

- Razorpay/Shiprocket/Delhivery/SMS/WhatsApp run in **documented deterministic simulation** when credentials are placeholder/absent. Simulation is faithful to the live control flow (same verify paths, same FSM sync), but signature verification in sandbox uses placeholder secrets — treat sandbox captures as non-proofs.
- SQLite (sandbox) serializes the interactive transactions via its write lock; PostgreSQL on the VPS is the real concurrency target.
- The webhook shipping receiver intentionally has **no HMAC** (carrier-agnostic normalization + event-id dedup instead). On the VPS, restrict `/api/webhooks/*` at nginx to provider IP ranges where supported.
- `next.config.ts` sets `typescript.ignoreBuildErrors: true` (platform build requirement); the CI gate is `bunx tsc --noEmit`, which must stay clean.

## VPS hardening checklist

1. Strong unique `JWT_SECRET`; rotate if leaked (kills all sessions).
2. Set real `ADMIN_EMAIL`/`ADMIN_PASSWORD`; disable or re-password the seeded staff accounts; never ship the seed default password.
3. Postgres: strong password, bound to the compose network only (no published 5432), scheduled `pg_dump` backups restored quarterly.
4. HTTPS via certbot before go-live (session cookies become `secure`); redirect all HTTP.
5. nginx: security headers, `client_max_body_size` sized to CSV imports, provider IP allow-lists for webhooks, gzip.
6. Keep placeholder `YOUR_*` / `placeholder` values out of production `.env` — audit logs (`WHATSAPP_DISPATCH_SIMULATED`, `[SIMULATED SMS]` in logs) reveal any subsystem silently in sim mode.
7. Patch cadence: `docker compose pull && docker compose build && docker compose up -d` monthly; watch Prisma/Next advisories.
8. Review `audit_logs` and `payment_events` weekly during launch; alert on `/api/health` body `degraded`.
