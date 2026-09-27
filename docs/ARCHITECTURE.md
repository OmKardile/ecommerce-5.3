# Architecture

Patel Networks is a **modular monolith**: one Next.js 16 application owning the storefront, the admin console and the JSON API, with a strict internal layering (route handlers -> services -> Prisma). There is no microservice split; deployment is a single app container beside PostgreSQL (see [DEPLOYMENT.md](./DEPLOYMENT.md)).

## Layering

```
src/
  app/                     routes
    (store)/               storefront route group (shared Header/Footer layout)
    admin/                 back office (login page + (panel) group with its own dark chrome)
    api/                   route handlers — ALL mutations live here
  server/
    db.ts                  Prisma singleton (global-cached in dev)
    services/              domain logic, no HTTP concerns
  lib/                     shared primitives (see CONTRACTS.md "Core lib API")
  components/
    ui/                    shadcn/ui primitives (single allowed source)
    storefront/            cart, checkout, tracking, gallery, wizard, ...
    admin/                 consoles and manager islands
    content/               page shells, blog rendering
  store/                   Zustand cart mirror + hydrator
```

Rules (from `CONTRACTS.md`): services never import route handlers; route handlers never talk to Prisma directly for domain operations; the client never computes money; all UI uses `formatINR(paise)`.

## Route groups and rendering

- `(store)` — server components fetch via services directly (no internal HTTP fetch). Client islands (filters, variant selector, wizard, checkout) call `/api/**`.
- `admin/(panel)` — server pages render tables server-side; interactive islands call `/api/admin/**`. `/admin/login` sits outside the panel group.
- `src/proxy.ts` is the Next 16 edge proxy (ex-middleware) guarding `/admin/*` (requires `pn_admin_session`, except `/admin/login`) and `/account/*` (requires `pn_session`, except `/account/login`), redirecting with a `next=` parameter.

## Why API route handlers instead of Server Actions

The platform rule for this build mandates HTTP route handlers for mutations, and the old repo's ADR-001 already permits Route Handlers as an alternative to Server Actions (resolution C2 in [DECISIONS.md](./DECISIONS.md)). Benefits realized here: uniform JSON envelope, curl-testable QA, webhook endpoints on the same conventions, and clean separation between server pages and client islands.

## Data flow (purchase path)

```
 Browser                     Route handler              Service                 Database
   |  POST /api/orders            |                        |                        |
   |  {checkout, idempotencyKey}  |  parseBody(Zod)        |                        |
   |----------------------------->|----------------------->| createOrderFromCart()  |
   |                              |                        |  idempotency lookup    |
   |                              |                        |  getCartView()-------->| carts/cart_items (+ live re-price)
   |                              |                        |  evaluateCoupon()----->| coupons
   |                              |                        |  resolveZone()/GST     |
   |                              |                        |  $transaction:         |
   |                              |                        |   availability check   |
   |                              |                        |   order+items create   |
   |                              |                        |   reservedStock++      |
   |                              |                        |   movement ORDER_RESERVED
   |                              |                        |   address snapshot     |
   |<---- {ok,data:order} --------|                        |  WhatsApp notify (sim) |
```

Key invariants: prices, fees, GST and stock are computed **server-side only**; the cart is re-validated against live SKU price/stock on every read (`cart.service.getCartView`); availability = `currentStock - reservedStock` and a shortfall is `409 INSUFFICIENT_STOCK`.

## Session/JWT design

`src/lib/session.ts` signs jose HS256 JWTs (7 day expiry) with `JWT_SECRET`, carried in two strictly isolated httpOnly cookies (ADR-019):

| Cookie | `kind` claim | Payload | Issued by |
| --- | --- | --- | --- |
| `pn_session` | `customer` | userId, customerId, phone, role | OTP verify (`/api/auth/otp/verify`) |
| `pn_admin_session` | `admin` | userId, email, fullName, role | `/api/admin/auth/login` |
| `pn_cart_id` | (not an identity) | guest cart UUID token, 30 days | cart service on first add |

Cookie attributes: httpOnly, sameSite lax, `secure` in production, path `/`. The edge proxy verifies tokens with `verifyTokenEdge` (no DB). API guards: `requireCustomer()`, `requireAnyAdmin()`, `requireRole([...])` in `src/lib/api-helpers.ts`. A `kind` mismatch (e.g. admin token on a customer route) fails verification of intent because guards check both the cookie name and the `kind` field.

## Inventory transaction discipline

All stock mutations run inside `prisma.$transaction(..., { maxWait: 15000, timeout: 30000 })` and append rows to the immutable `inventory_movements` ledger (`inventory.service.ts`, `order.service.ts`):

| Operation | Effect | Movement reason |
| --- | --- | --- |
| Order created (checkout) | `reservedStock += qty` after availability check | `ORDER_RESERVED` (negative qty) |
| Order -> SHIPPED (from PACKED) | `currentStock -= qty` and `reservedStock -= qty` | `ORDER_DISPATCHED` |
| Order -> CANCELLED (pre-dispatch) | `reservedStock -= min(qty, reserved)` | `ORDER_CANCELLED_RESTOCK` |
| Admin adjust / CSV import | `currentStock += delta` (guard: never negative, never below reserved) | `PURCHASE_RECEIPT`, `MANUAL_ADJUSTMENT`, `DAMAGED_WRITE_OFF`, `RETURN_RESTOCK` |
| Stock-monitor request approved / count variance applied (`stock-monitor.service.ts`) | same transactional ledger as manual adjust; request/line marked decided+`movementId`/`appliedAt` | `MANUAL_ADJUSTMENT` (referenceId = requestId / sessionId) |

Note (from `inventory.service.ts`): SQLite's interactive-transaction write lock serializes writers in the sandbox; on PostgreSQL the same code path runs with row-level locking semantics. No `SELECT ... FOR UPDATE` is used explicitly, so the availability check + update pattern relies on the transaction boundary; serializing single-node traffic (the target topology) keeps this safe.

## Order state machine

Statuses (string values, `src/lib/constants.ts`): `PENDING_PAYMENT`, `COD_PENDING`, `PAID`, `CONFIRMED`, `PROCESSING`, `PACKED`, `SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, `RETURN_REQUESTED`, `RETURNED`, `REFUNDED`.

`transitionOrder()` (order.service) enforces `ORDER_TRANSITIONS` inside a transaction, writes an `order_status_history` row per change, and applies inventory side effects (SHIPPED decrement, CANCELLED release). Same-status transitions are idempotent no-ops; invalid moves raise `409`.

```
PENDING_PAYMENT --> PAID --> CONFIRMED --> PROCESSING --> PACKED --> SHIPPED --> OUT_FOR_DELIVERY --> DELIVERED
      |              |  \                       |             |          |  \                |
      |              |   +--> REFUNDED          |             |          |   +--> RETURN_REQUESTED
      |              +--> CANCELLED             |             |          |
      +--> CANCELLED  (also CONFIRMED direct)   |             |          SHIPPED reachable also via carrier PICKED_UP/IN_TRANSIT scan
COD_PENDING --> CONFIRMED | CANCELLED
CONFIRMED --> PROCESSING | CANCELLED
PROCESSING --> PACKED | CANCELLED
DELIVERED --> RETURN_REQUESTED --> RETURNED --> REFUNDED   (RETURN_REQUESTED can also go back to PROCESSING)
CANCELLED / REFUNDED are terminal
```

Entry points that write history: checkout (create), Razorpay capture (`PENDING_PAYMENT -> PAID`, changedBy `SYSTEM`), COD placement (immediate `-> CONFIRMED`), admin console (changedBy operator id), carrier webhook scans (changedBy `CARRIER`). COD collection is marked `SUCCESS` on the payment when the carrier reports `DELIVERED`.

## Dual-mode integrations

Every external integration checks credential presence/shape and degrades to a deterministic simulator that returns `{ simulated: true }`-style signals — never fabricated success in live mode:

| Integration | Live mode when | Simulated behavior |
| --- | --- | --- |
| Razorpay (`payment.service.ts`) | `RAZORPAY_KEY_ID` set and not "placeholder" | `order_sim_*` gateway orders, HMAC-signed sim verify, sandbox-only `/api/payments/razorpay/simulate` (refuses when live keys present) |
| Shiprocket (`shipping.service.ts`) | `SHIPROCKET_EMAIL`/`PASSWORD` set and not "placeholder" | deterministic AWB `DELH` + hex, `SR-SIM-*` provider ids, Delhivery tracking URL, label URL, zone-based ETAs |
| Delhivery direct | `DELHIVERY_API_KEY` set | same simulator until the key is configured (provider interface is the seam) |
| SMS OTP (`notification.service.ts`) | `SMS_GATEWAY_API_KEY` real (Fast2SMS DLT dispatch) | prints `[SIMULATED SMS] ... OTP: <code>` to stdout/dev.log |
| WhatsApp (`notification.service.ts`) | `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` real (Graph v20) | prints `[SIMULATED WHATSAPP]` box and records `WHATSAPP_DISPATCH_SIMULATED` audit rows |

Webhook receivers (`/api/webhooks/razorpay|shipping|whatsapp`) are the same in both modes; Razorpay webhook verification uses `RAZORPAY_WEBHOOK_SECRET` (placeholder default in sandbox), shipping webhook dedups on event ids, WhatsApp webhook validates the Meta verify token.

## Design system summary

"Quietly luxurious editorial" (worklog Task 0 C3; tokens in `src/app/globals.css`):

- Fonts: Fraunces (`--font-display`, headlines/prices/big numbers via `font-display`) + Inter (body)
- Palette: warm paper background `#FAF9F6`, ink foreground `#1C1917`, deep pine primary `#1A3C34` (paper-foreground `#F7F6F1`), muted brass accent `#B45309` used sparingly, hairline borders `#E6E1D6`, muted surfaces `#F1EEE7`; admin sidebar `#142A24`
- Geometry: rounded-md (0.5rem base radius), soft shadows only, hairline dividers, 12-col grids with controlled asymmetry, small-caps tracking-widest section labels
- Motion: subtle framer-motion fade+12-24px reveals (0.4-0.6s, once); 200-300ms hovers; scroll parallax confined to `src/components/motion/parallax.tsx` primitives — transform-only, reduced-motion-safe, editorial surfaces only (catalog/PDP/cart/checkout/account/admin stay motion-quiet, decisions.md D-7); no gradients/neon/glow/emoji anywhere
- Imagery: seed image bank (`prisma/seed-images.json`, optional external file — ADR-020) with graceful typographic placeholders when a product has no images; plain `<img>` with object-cover
- Loading/empty/error states: skeletons from `src/components/ui/skeleton.tsx`, quiet editorial empty states, sonner toasts + inline errors

## Idempotency and dedup points

| Concern | Mechanism |
| --- | --- |
| Order creation retries | client-generated `idempotencyKey` (Zod: 8-64 chars); order service looks up `customerNote` prefix `idem:<key>` and returns the existing order |
| Payment capture (checkout verify + webhook) | `payment_events.eventId` unique (`evt_checkout_<paymentId>`); duplicate -> `{alreadyProcessed:true}`; `payment.status SUCCESS` short-circuit |
| Carrier scans / webhooks | `shipment_events.eventId` unique (`evt_<awb>_<status>_<ts>`); duplicate -> `{duplicate:true}` 200 |
| FSM transitions | same-status transition is a no-op; others validated against the map |
