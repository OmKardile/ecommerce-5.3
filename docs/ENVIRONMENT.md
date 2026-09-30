# Environment variables

Verified against the codebase (grep of `process.env.*` across `src/` and `prisma/`). The committed template **`.env.example`** mirrors this table with sim-safe placeholder values — `cp .env.example .env` then fill; **never commit real secrets**. Step-by-step walkthrough (where to obtain each credential, sim→live verification, rotation, troubleshooting): **[deploy/ENV-SETUP.md](../deploy/ENV-SETUP.md)**. Per-variable deep reference (what it does / where used / how to obtain / patel-5.2 parity): **[ENVIRONMENT-VARIABLES-GUIDE.md](./ENVIRONMENT-VARIABLES-GUIDE.md)**. The sandbox `.env` currently carries only `DATABASE_URL`; everything else falls back to the documented defaults or activates simulation.

Simulation detection conventions actually used in code:

- Razorpay (`payment.service.ts`): mock when `RAZORPAY_KEY_ID` is missing, contains `placeholder`, or starts with `rzp_test_placeholder`.
- Shiprocket (`shipping.service.ts`): mock when `SHIPROCKET_EMAIL`/`SHIPROCKET_PASSWORD` are missing or contain `placeholder`.
- Delhivery: mock when `DELHIVERY_API_KEY` is missing or contains `placeholder` (Delhivery always routes to the simulator until its direct integration is keyed).
- SMS/WhatsApp (`notification.service.ts`): placeholder when missing, containing `placeholder`, or starting with `YOUR_`; live send failures also fall back to simulation with a logged error.

## Core

| Variable | Required | Example / default | Behavior |
| --- | --- | --- | --- |
| `DATABASE_URL` | REQUIRED | `file:./db/custom.db` (sandbox) / `postgresql://user:pass@postgres:5432/patel` (VPS) | Prisma connection; provider set in `prisma/schema.prisma` (ADR-021) |
| `JWT_SECRET` | REQUIRED in prod (dev fallback exists) | 32+ random bytes | Signs HS256 session JWTs (`pn_session`, `pn_admin_session`) AND hashes OTP codes (`sha256(code:JWT_SECRET)`). Rotating it invalidates all sessions and outstanding OTPs. Dev fallback `patel_networks_dev_secret_change_in_production_32b!` must never reach production |
| `NEXT_PUBLIC_APP_URL` | REQUIRED in prod | `http://localhost:3000` default | metadataBase, canonical URLs, `sitemap.xml`, `robots.txt` |
| `NODE_ENV` | set by runtime | `production` | Switches cookies to `secure`, prisma log level to `error` |

## Razorpay (payments)

| Variable | Required | Sim-mode behavior when unset/placeholder |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | REQUIRED for live payments | Mock orders `order_sim_*`; `publicKeyId()` returns `rzp_test_placeholder_key_id` |
| `RAZORPAY_KEY_SECRET` | REQUIRED for live payments | Checkout signature + simulate endpoint HMAC against `placeholder_secret_key` (sandbox only) |
| `RAZORPAY_WEBHOOK_SECRET` | REQUIRED for live webhooks | Webhook HMAC verified against `placeholder_webhook_secret`; configure the same secret in the Razorpay dashboard in live mode |

Simulated flow: `POST /api/payments/razorpay/simulate` (sandbox-only; refuses with 403 when live keys are configured) -> `POST /api/payments/razorpay/verify` performs the exact same HMAC verification as production.

## Shipping (Shiprocket / Delhivery)

| Variable | Required | Sim-mode behavior when unset/placeholder |
| --- | --- | --- |
| `SHIPROCKET_EMAIL` | one provider's creds required for live shipping | Deterministic AWB `DELH<10 hex>`, provider id `SR-SIM-*`, zone-based ETAs, label URL `/api/admin/shipments/label?awb=...` |
| `SHIPROCKET_PASSWORD` | with the above | — |
| `SHIPROCKET_API_URL` | optional | Defaults to `https://apiv2.shiprocket.in/v1/external` |
| `DELHIVERY_API_KEY` | optional | Delhivery direct always uses the simulator until keyed; carrier scans still sync the order FSM |
| `SHIPPING_WEBHOOK_TOKEN` | optional (required in production) | Shared secret for `POST /api/webhooks/shipping` (header `x-webhook-token` or `?token=`). Unset = sandbox posture with a per-request warning |

Pickup postcode is hardcoded to the Surat hub `395003` in the provider calls (matches `STORE.originPin`).

## SMS / WhatsApp (notifications)

| Variable | Required | Sim-mode behavior when unset/placeholder |
| --- | --- | --- |
| `SMS_GATEWAY_API_KEY` | REQUIRED in prod (customer OTP) | `[SIMULATED SMS] ... OTP: <code>` printed to stdout/dev.log; API responses carry `simulated:true` |
| `SMS_SENDER_ID` | optional | Default `PTLNET` (DLT sender) |
| `SMS_TEMPLATE_ID` | REQUIRED with a real key | Sent as the Fast2SMS DLT `message` template id; empty in sandbox |
| `WHATSAPP_ACCESS_TOKEN` | REQUIRED in prod | `[SIMULATED WHATSAPP]` box in logs + `WHATSAPP_DISPATCH_SIMULATED` audit row |
| `WHATSAPP_PHONE_NUMBER_ID` | REQUIRED in prod | Meta Graph v20 `/{phone-id}/messages` target |
| `WHATSAPP_VERIFY_TOKEN` | optional (webhook subscription) | Meta webhook GET verify accepts `placeholder_verify_token` when unset — set a real token in prod |

WhatsApp templates referenced by code: `order_confirmation`, `order_dispatched`, `out_for_delivery`, `order_delivered`, `cod_verification`, `b2b_quote_inquiry`, `platform_enquiry` (developer-side ping for showcase leads — only dispatches when `DEVELOPER_WHATSAPP` is configured).

## Store overrides

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `STORE_GSTIN` | optional | `24AAACP1234F1Z8` (ADR-014) | Rendered on invoices/FOOTER via `src/lib/constants.ts` `STORE` |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | optional | `919876543210` | wa.me deep links (contact page, floating widget) |

Runtime COD/fee settings are **not** env vars — they live in the `Setting` table (`store.codMaxOrderValuePaise` default 1500000, `store.codFeePaise` 4900, `store.shippingFeePaise` 9900, `store.freeShippingThresholdPaise` 50000, dispatchCutoff, supportPhone, announcement) and are editable at `/admin/settings` (PUT gated to SUPER_ADMIN/ADMIN).

## Developer / showcase (platform enquiries)

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DEVELOPER_EMAIL` | optional | `omkardile84@gmail.com` | Recipient shown on the `/showcase` enquiry success card (prefilled mailto) and closing pitch band via `src/lib/constants.ts` `DEVELOPER` — the developer's desk, deliberately NOT the store trade desk (`/contact`) |
| `DEVELOPER_WHATSAPP` | optional | unset (no ping) | Digits only, `91` prefix, no `+`. When set AND the WhatsApp Cloud API credentials exist, `POST /api/platform-enquiry` submissions additionally ping the developer with the `platform_enquiry` template; unset = no ping, enquiries still persist in the `platform_inquiries` table |

## Admin bootstrap

| Variable | Required | Default | Behavior |
| --- | --- | --- | --- |
| `ADMIN_EMAIL` | optional (recommended in prod) | seed uses `superadmin@patelnetworks.in` | When set and no user matches the email at login, the service bootstraps a SUPER_ADMIN with `ADMIN_PASSWORD` |
| `ADMIN_PASSWORD` | with `ADMIN_EMAIL` | seed default `patel@admin2026` | Also overrides the seed password when set during seeding |

Hardcoded seed staff (`inventory@patelnetworks.in` / `warehouse@2026`, `orders@patelnetworks.in` / `fulfill@2026`) exist for RBAC demo purposes; replace or disable them for production.

## Quick matrix

- **Truly REQUIRED to boot:** `DATABASE_URL` (JWT_SECRET technically has a dev fallback — treat as required in prod).
- **REQUIRED for real operations:** Razorpay trio, one shipping provider's credentials, `SMS_GATEWAY_API_KEY`, WhatsApp token + phone id, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `NEXT_PUBLIC_APP_URL`, strong `JWT_SECRET`.
- **OPTIONAL:** `STORE_GSTIN`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `DEVELOPER_EMAIL`, `DEVELOPER_WHATSAPP`, `SHIPROCKET_API_URL`, `SMS_SENDER_ID`, `SMS_TEMPLATE_ID`, `WHATSAPP_VERIFY_TOKEN`.
- Anything unset/placeholder degrades that subsystem to **documented deterministic simulation**, never a fabricated live success.
