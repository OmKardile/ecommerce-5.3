# Patel Networks / MegaTech — Environment Variables Guide (patel-5.3)

> **Complete reference** for every environment variable this codebase reads.
> Each variable has its own section: what it does, where it's used, how to get it, format, and example values.
>
> See also: **`.env.example`** (the committed template — copy it, never commit your filled `.env`),
> **[docs/ENVIRONMENT.md](./ENVIRONMENT.md)** (compact code-verified table),
> **[deploy/ENV-SETUP.md](../deploy/ENV-SETUP.md)** (step-by-step `.env` walkthrough: fill-in order, credential sources, sim→live proof, rotation),
> and the deployment guides **[docs/RENDER-DEPLOYMENT.md](./RENDER-DEPLOYMENT.md)** (Render staging), **[docs/VPS-SETUP-GUIDE.md](./VPS-SETUP-GUIDE.md)** (cloud VPS), **[docs/PHYSICAL-SERVER-SETUP-GUIDE.md](./PHYSICAL-SERVER-SETUP-GUIDE.md)** (bare metal), plus **[docs/DEPLOYMENT.md](./DEPLOYMENT.md)** (VPS topology) and **[deploy/DEPLOY-STEPS.md](../deploy/DEPLOY-STEPS.md)** (the VPS runbook).

---

## Quick Reference Table

| Variable | Required? | Where used | Default / Simulation |
|---|---|---|---|
| [`DATABASE_URL`](#database_url) | ✅ Required | `prisma/schema.prisma` + `src/lib/db.ts` | — (template ships the SQLite sandbox line) |
| [`JWT_SECRET`](#jwt_secret) | ✅ Required in prod (dev fallback exists) | `src/lib/session.ts`, `auth.service.ts`, `src/proxy.ts` | Documented dev fallback strings |
| [`NEXT_PUBLIC_APP_URL`](#next_public_app_url) | ✅ Required | `src/app/layout.tsx`, `robots.ts`, `sitemap.ts`, Dockerfile build arg | `http://localhost:3000` |
| [`NODE_ENV`](#node_env) | ✅ Set by runtime | `src/lib/session.ts` + `cart.service.ts` (secure cookies), `src/lib/db.ts` (log level) | `production` (pinned in the Docker image) |
| [`ADMIN_EMAIL`](#admin_email) | ⚠️ Optional (bootstrap) | `auth.service.ts` bootstrap + `prisma/seed.ts` | `superadmin@patelnetworks.in` |
| [`ADMIN_PASSWORD`](#admin_password) | ⚠️ Optional (bootstrap) | `auth.service.ts` bootstrap + `prisma/seed.ts` | `patel@admin2026` |
| [`RAZORPAY_KEY_ID`](#razorpay_key_id) | 🔶 Simulation | `payment.service.ts` | `order_sim_*` simulated orders |
| [`RAZORPAY_KEY_SECRET`](#razorpay_key_secret) | 🔶 Simulation | `payment.service.ts` | HMAC against `placeholder_secret_key` |
| [`RAZORPAY_WEBHOOK_SECRET`](#razorpay_webhook_secret) | 🔶 Simulation | `webhooks/razorpay` + `payment.service.ts` | HMAC against `placeholder_webhook_secret` |
| [`SHIPROCKET_EMAIL`](#shiprocket_email) | 🔶 Simulation | `shipping.service.ts` | Deterministic `DELH…` AWBs |
| [`SHIPROCKET_PASSWORD`](#shiprocket_password) | 🔶 Simulation | `shipping.service.ts` | — |
| [`SHIPROCKET_API_URL`](#shiprocket_api_url) | ⚠️ Optional | `shipping.service.ts` | `https://apiv2.shiprocket.in/v1/external` |
| [`DELHIVERY_API_KEY`](#delhivery_api_key) | 🔶 Simulation | `shipping.service.ts` | Always simulated until direct integration is keyed |
| [`SMS_GATEWAY_API_KEY`](#sms_gateway_api_key) | 🔶 Simulation | `notification.service.ts` | `[SIMULATED SMS] … OTP: <code>` in logs |
| [`SMS_SENDER_ID`](#sms_sender_id) | ⚠️ Optional | `notification.service.ts` | `PTLNET` |
| [`SMS_TEMPLATE_ID`](#sms_template_id) | 🔶 Simulation | `notification.service.ts` | — (required alongside a real key) |
| [`WHATSAPP_ACCESS_TOKEN`](#whatsapp_access_token) | 🔶 Simulation | `notification.service.ts` | `[SIMULATED WHATSAPP]` + `WHATSAPP_DISPATCH_SIMULATED` audit row |
| [`WHATSAPP_PHONE_NUMBER_ID`](#whatsapp_phone_number_id) | 🔶 Simulation | `notification.service.ts` | — |
| [`WHATSAPP_VERIFY_TOKEN`](#whatsapp_verify_token) | ⚠️ Optional | `src/app/api/webhooks/whatsapp/route.ts` | Literal `placeholder_verify_token` accepted when unset |
| [`STORE_GSTIN`](#store_gstin) | ⚠️ Optional | `src/lib/constants.ts` (`STORE`) | `24AAACP1234F1Z8` (ADR-014 placeholder) |
| [`NEXT_PUBLIC_SUPPORT_WHATSAPP`](#next_public_support_whatsapp) | ⚠️ Optional | `src/lib/constants.ts` (`STORE`) | `919876543210` |

**Legend**: ✅ Required (app won't boot / operate correctly without it) · ⚠️ Optional (has a documented default) · 🔶 Simulation (unset or placeholder value activates deterministic simulation; real keys switch the subsystem live)

### Compose-only variables (not read by Next.js code)

Consumed by `docker-compose.yml`, the `postgres:16-alpine` image, `docker-entrypoint.sh`, or the standalone server. They live in the same `.env`; compose loads it via `env_file` for the `app` and `db` services and for `${…}` interpolation.

| Variable | Required? | Where used | Default |
|---|---|---|---|
| [`POSTGRES_USER`](#postgres_user--postgres_password--postgres_db) | ✅ On the VPS compose stack | `postgres:16-alpine` image | `patel` (template) |
| [`POSTGRES_PASSWORD`](#postgres_user--postgres_password--postgres_db) | ✅ On the VPS compose stack | `postgres:16-alpine` image | — (generate: `openssl rand -hex 16`) |
| [`POSTGRES_DB`](#postgres_user--postgres_password--postgres_db) | ✅ On the VPS compose stack | `postgres:16-alpine` image | `patelnetworks` |
| [`RUN_MIGRATIONS`](#run_migrations) | ⚠️ Optional | `docker-entrypoint.sh` | `true` |
| [`PORT`](#port) | ⚠️ Optional | Standalone server listen port inside the container | `3000` |

---

## Required Variables

### DATABASE_URL

**What it does**: The single Prisma connection string. Every database query in the app (catalog, cart, orders, auth, admin, audits, webhooks) flows through the one Prisma client it configures. The repository file is provider-`sqlite` for the sandbox; the production Docker image switches the provider to `postgresql` with an in-image `sed` — the repo file is never modified (ADR-021).

**Where used**: `prisma/schema.prisma` (`url = env("DATABASE_URL")`) → consumed by the shared client in `src/lib/db.ts`, imported by every service under `src/server/services/`.

**How to set it**:
- **Sandbox / local dev**: keep the template's SQLite line and run `bun run db:push` + `bun prisma/seed.ts`.
- **VPS (docker compose)**: fill the `POSTGRES_*` trio first (see below), then mirror those exact values in the URL. The host **must be `db`** — the compose service name on the internal network.

**Format**: SQLite → `file:<relative path>` · Postgres → `postgresql://<user>:<password>@<host>:<port>/<dbname>?schema=public`

**Example (sandbox)**:
```bash
DATABASE_URL="file:./db/custom.db"
```

**Example (VPS compose)**:
```bash
DATABASE_URL="postgresql://patel:CHANGE_ME@db:5432/patelnetworks?schema=public"
```

**Example (managed Postgres — e.g. Render staging)**:
```bash
DATABASE_URL="postgresql://user:password@host.render-internal.com:5432/patelnetworks?schema=public&sslmode=require"
```

> ⚠️ **Host must be `db` on the compose stack — not `localhost`, not `127.0.0.1`.** Inside the app container those loop back to the container itself, Postgres is unreachable, and `/api/health` reports `{"status":"degraded"}`. This is the #1 cause of degraded health checks on a fresh VPS (see deploy/ENV-SETUP.md §6).

> ⚠️ Keep the user/password/db name **in sync with the `POSTGRES_*` trio** — the Postgres container creates the credentials on first boot from those variables, while the app authenticates with this URL. A mismatch shows up as Postgres auth errors and a degraded health status.

> Note: unlike patel-5.2 there is **no `DIRECT_URL`** in this codebase — one plain `DATABASE_URL` is correct here (see the parity section below).

---

### JWT_SECRET

**What it does**: One secret, two jobs: (1) signs and verifies the HS256 session JWTs carried by the `pn_session` (customer) and `pn_admin_session` (staff) httpOnly cookies, including the edge guard in `src/proxy.ts`; (2) keys the OTP hash — codes are stored as `sha256(code:JWT_SECRET)`, never in plaintext.

**Where used**:
- `src/lib/session.ts` — sign/verify both session flavors (dev fallback `patel_networks_dev_secret_change_in_production_32b!`)
- `src/server/services/auth.service.ts` — OTP hashing (dev fallback `'dev'`)
- `src/proxy.ts` — edge verification for `/admin/*` and `/account/*` routes

**How to generate it**:
```bash
openssl rand -hex 32
# Output example: 9f1c4e7b2a8d63f05c1e8a4bd7f2c6e91a3d5b8c0e7f4a2d6b9c1e3f5a7d9b2c
```

**Format**: Any long random string; 32 random bytes as hex is the house standard.

**Example**:
```bash
JWT_SECRET="9f1c4e7b2a8d63f05c1e8a4bd7f2c6e91a3d5b8c0e7f4a2d6b9c1e3f5a7d9b2c"
```

> ⚠️ **Rotating this logs out every user AND voids every outstanding OTP** (the stored hashes can no longer be reproduced). Rotate on suspicion of leak and expect a full re-login — that's the point. On the VPS a restart (`docker compose up -d app`) applies it.

> ⚠️ The dev fallbacks are compile-time conveniences for the sandbox. A public host running without a real `JWT_SECRET` is forgeable-session territory — treat this variable as **required in production**.

---

### NEXT_PUBLIC_APP_URL

**What it does**: The public origin of the deployment. Drives `metadataBase` and canonical URLs in metadata, `sitemap.xml`, and `robots.txt`.

**Where used**: `src/app/layout.tsx` (metadataBase), `src/app/robots.ts`, `src/app/sitemap.ts`. It is also the **only build-time variable that matters**: the Dockerfile declares it as `ARG NEXT_PUBLIC_APP_URL` and compose passes it through `build.args`, so Next.js inlines it into client bundles at image build time.

**How to set it**:
- **Sandbox**: leave the default.
- **VPS**: `https://patelnetworks.in` — set it **before the first image build** and keep it in `.env` for the runtime reads.

**Format**: Full URL with protocol, **no trailing slash**.

**Example**:
```bash
NEXT_PUBLIC_APP_URL="https://patelnetworks.in"
```

> ⚠️ **`NEXT_PUBLIC_*` is baked in at build time.** Changing `.env` updates the runtime reads (metadataBase/sitemap/robots) immediately after a restart, but client bundles keep the old value until the image is rebuilt with compose `build.args`. If sitemap/robots/canonicals still show `localhost:3000` after going live — rebuild.

> The `NEXT_PUBLIC_` prefix intentionally exposes this value to the browser. It's safe here — it's just a URL. Never use the prefix for secrets.

---

### NODE_ENV

**What it does**: Standard Node/Next.js environment mode. In this codebase it does two concrete things: flips session and cart cookies to `secure` in production, and switches the Prisma client log level from `error,warn` down to `error`.

**Where used**:
- `src/lib/session.ts` — `secure: process.env.NODE_ENV === 'production'` on both session cookies
- `src/server/services/cart.service.ts` — same for the guest-cart cookie
- `src/lib/db.ts` — Prisma log level
- `Dockerfile` runner stage — pins `NODE_ENV=production` for the deployed image

**Allowed values**: `production`, `development`, `test` — **anything else breaks Next.js** prerendering.

**Example**:
```bash
NODE_ENV="production"
```

> ⚠️ **Never set a non-standard value** (`staging`, `local`, `uat`…). The build dies with `Cannot read properties of null (reading 'useContext')` during prerender — the exact failure debugged in patel-5.2. On Docker you don't set it at all (the image pins `production`); on a platform like Render leave it unset and the default `production` applies.

---

## Optional / Bootstrap Variables

### ADMIN_EMAIL

**What it does**: Defines the environment's bootstrap superadmin. On the first `/admin/login` submit, **only while no user in the database matches this email**, the auth service upserts a `SUPER_ADMIN` ("Platform Superadmin") with `ADMIN_PASSWORD`. It also names the seeded admin when `prisma/seed.ts` runs.

**Where used**: `src/server/services/auth.service.ts` (bootstrap in `adminLogin`), `prisma/seed.ts` (seed override).

**Default (seed)**: `superadmin@patelnetworks.in`

**Example**:
```bash
ADMIN_EMAIL="admin@patelnetworks.in"
```

> Bootstrap is one-way: once a user with that email exists, the env pair is skipped entirely and normal scrypt password verification takes over.

---

### ADMIN_PASSWORD

**What it does**: Pairs with `ADMIN_EMAIL` for the bootstrap, and overrides the seeded superadmin's password when set at seed time.

**Where used**: `src/server/services/auth.service.ts`, `prisma/seed.ts`.

**Default (seed)**: `patel@admin2026`

**How to generate one**:
```bash
openssl rand -base64 18
```

**Example**:
```bash
ADMIN_PASSWORD="a-long-generated-password-here"
```

> ⚠️ **Never ship the seed default** (`patel@admin2026`) — it is documented in the code and in every README. Override it in production via this variable (or at seed time), then store the real value in the client's password manager.

> ⚠️ **This is a bootstrap, not a live password store.** Changing `ADMIN_PASSWORD` in `.env` after the account exists does **nothing** — the bootstrap is skipped once the email matches an existing user. To truly rotate (per deploy/ENV-SETUP.md §5): set a **new bootstrap pair** (new email + new password), log in as that SUPER_ADMIN, then reset the old account's hash (`scrypt$salt$digest`, N=16384/r=8/p=1, 64-byte key) or deactivate the old user. There is intentionally no self-service password endpoint for staff.

---

## Simulation Variables (unset/placeholder → deterministic simulation; real keys → live)

These integrations are **dual-mode by design** (ADR-007/012/013). Missing, `placeholder`-containing, or `YOUR_*`-prefixed credentials activate a documented deterministic simulation — the feature works end-to-end without fabricating live success (`simulated: true` comes back to callers). The golden rule from `.env.example`: **leave a variable unset rather than inventing a fake value** — a plausible-looking wrong key causes real API failures at checkout time. After each drop-in, prove the switch with the checklist in deploy/ENV-SETUP.md §4.

### Payment Gateway — Razorpay

#### RAZORPAY_KEY_ID

**What it does**: The Razorpay API key ID. Server-side identifier used to create gateway orders and, in live mode, to authenticate REST calls together with the secret.

**Where used**: `src/server/services/payment.service.ts` (`createGatewayOrder`, `publicKeyId()`).

**How to get it**: Razorpay Dashboard → **Settings → API Keys → Generate Live Keys**. Live IDs start with `rzp_live_`; test IDs with `rzp_test_`.

**Example**:
```bash
RAZORPAY_KEY_ID="rzp_live_xxxxxxxx"
```

**Simulation behavior**: unset, containing `placeholder`, or starting with `rzp_test_placeholder` → mock orders named `order_sim_<hex>`, and `publicKeyId()` returns `rzp_test_placeholder_key_id` for the checkout dialog. The sandbox-only `POST /api/payments/razorpay/simulate` route works in this mode and **refuses with 403 once live keys are configured** — that 403 is the proof live mode is on.

Official docs: https://razorpay.com/docs/api/

#### RAZORPAY_KEY_SECRET

**What it does**: The secret paired with `RAZORPAY_KEY_ID`. Used server-side to authenticate order creation and to recompute the HMAC-SHA256 checkout signature (`gatewayOrderId|gatewayPaymentId`) that the verify endpoint checks with `timingSafeEqual`.

**Where used**: `src/server/services/payment.service.ts` (order auth + `verifyCheckoutSignature` + `simulateSuccessfulPayment`).

**How to get it**: Shown **once** when the key pair is generated — copy it immediately.

**Example**:
```bash
RAZORPAY_KEY_SECRET="AbCdEf123456GhIjKl7890MnOpQrSt"
```

> ⚠️ Secret. Never expose it to the client, never commit it. If checkout signature verification fails live, this value doesn't match the `RAZORPAY_KEY_ID` pair.

> Note: there is deliberately **no `NEXT_PUBLIC_RAZORPAY_KEY_ID`** in this codebase — the checkout takes the public key id from the server's order response (`publicKeyId()`), so there is exactly one source of truth.

#### RAZORPAY_WEBHOOK_SECRET

**What it does**: HMAC-SHA256 secret that proves incoming webhooks are genuinely from Razorpay. The handler recomputes the signature over the raw body and drops mismatches; the same secret must be typed into the Razorpay dashboard.

**Where used**: `src/app/api/webhooks/razorpay/route.ts` → `verifyWebhookSignature` in `payment.service.ts`.

**How to generate it**:
```bash
openssl rand -hex 16
```
Then set the **same string** in Razorpay Dashboard → **Settings → Webhooks** → endpoint `https://<your-domain>/api/webhooks/razorpay` (subscribe to payment events).

**Example**:
```bash
RAZORPAY_WEBHOOK_SECRET="your-generated-32-char-hex"
```

> ⚠️ Update the dashboard and `.env` **together** — a mismatch silently drops every webhook and payments stay "pending" until the checkout verify path catches up.

**Simulation behavior**: verified against `placeholder_webhook_secret` (sandbox only).

Official docs: https://razorpay.com/docs/webhooks/

### Shipping — Shiprocket / Delhivery

#### SHIPROCKET_EMAIL

**What it does**: Account email used to obtain a Shiprocket API token for serviceability checks, AWB booking, label creation, and cancellation.

**Where used**: `src/server/services/shipping.service.ts` (token auth, mock-mode check).

**How to get it**: Your Shiprocket account email — **the account must have a pickup address registered at the Surat hub (postcode `395003`)**; provider calls hardcode that pickup postcode, matching `STORE.originPin`.

**Example**:
```bash
SHIPROCKET_EMAIL="logistics@patelnetworks.in"
```

Official docs: https://apidocs.shiprocket.in/

#### SHIPROCKET_PASSWORD

**What it does**: Shiprocket account password, paired with `SHIPROCKET_EMAIL`.

**Where used**: `src/server/services/shipping.service.ts`.

**Example**:
```bash
SHIPROCKET_PASSWORD="your_shiprocket_account_password"
```

> ⚠️ Secret. Never commit.

**Simulation behavior** (both credentials): missing or containing `placeholder` → deterministic AWBs `DELH<10 hex>`, provider ids `SR-SIM-*`, zone-based ETAs and quotes, printable label URLs (`/api/admin/shipments/label?awb=…`), and synthetic scan events that still drive the full order FSM. One provider's live credentials is enough for real shipping.

#### SHIPROCKET_API_URL

**What it does**: Shiprocket API base override.

**Where used**: `src/server/services/shipping.service.ts` (all Shiprocket REST calls).

**Default**: `https://apiv2.shiprocket.in/v1/external`

**When to change**: Never, unless Shiprocket changes their API base.

#### DELHIVERY_API_KEY

**What it does**: Reserved for the Delhivery direct integration.

**Where used**: `src/server/services/shipping.service.ts` (`isDelhiveryMockMode`).

**How to get it**: Delhivery partner/account API key when the direct integration is keyed.

**Simulation behavior**: unset or `placeholder` → always routes to the simulator. Carrier scans still sync the order FSM either way, so nothing blocks on this key.

### SMS OTP — Fast2SMS-compatible (DLT)

#### SMS_GATEWAY_API_KEY

**What it does**: API key for the SMS gateway that delivers customer OTP codes. **REQUIRED before real customer OTP logins** — without it every phone number "logs in" via the printed simulation, which is acceptable only in the sandbox.

**Where used**: `src/server/services/notification.service.ts` (`sendSmsOtp`, Fast2SMS `bulkV2` DLT route).

**How to get it**: Fast2SMS (or MSG91-compatible) account → API key; in India the sender and template must be DLT-registered first.

**Example**:
```bash
SMS_GATEWAY_API_KEY="your-fast2sms-api-key"
```

**Simulation behavior**: missing, containing `placeholder`, or starting with `YOUR_` → the OTP is printed as a `[SIMULATED SMS] … OTP: <code>` box in the server log (`dev.log` in the sandbox, `docker compose logs app` on the VPS) and API responses carry `simulated: true`. A live send failure also falls back to simulation with a logged error — check logs before assuming an OTP went out.

#### SMS_SENDER_ID

**What it does**: The 6-character DLT sender (header) shown as the "from" address on OTP messages.

**Where used**: `src/server/services/notification.service.ts` (`sender_id` on the send call).

**Default**: `PTLNET`

**How to get it**: DLT registration on your carrier's portal (Jio/Airtel/Vodafone) — register the business, then the header. Takes a day or two.

**Example**:
```bash
SMS_SENDER_ID="PTLNET"
```

#### SMS_TEMPLATE_ID

**What it does**: The DLT-approved OTP message template id, sent as the Fast2SMS `message` parameter; the OTP itself goes in `variables_values`.

**Where used**: `src/server/services/notification.service.ts`.

**How to get it**: Same DLT registration as the sender — register the OTP template, note its id. **Required alongside a real key.**

**Example**:
```bash
SMS_TEMPLATE_ID="1507167432100000000"
```

### WhatsApp Cloud API (Meta Graph v20)

#### WHATSAPP_ACCESS_TOKEN

**What it does**: Permanent access token authenticating WhatsApp template-message dispatches (order confirmations, delivery updates, COD verification, B2B inquiry notifications, back-in-stock alerts).

**Where used**: `src/server/services/notification.service.ts` (`sendWhatsAppTemplate`, `Bearer` auth to `graph.facebook.com/v20.0/{phone-id}/messages`).

**How to get it**: Meta Business Suite → **System Users** → generate a **permanent** token with WhatsApp business asset access (never the 24-hour one).

**Example**:
```bash
WHATSAPP_ACCESS_TOKEN="EAAGm0PXabcd1234...long_token_string..."
```

> ⚠️ Secret. Never commit.

**Simulation behavior**: token or phone-id missing, containing `placeholder`, or starting with `YOUR_` → `[SIMULATED WHATSAPP]` box in the logs (template + parameters) and a `WHATSAPP_DISPATCH_SIMULATED` audit row instead of a dispatch. Live failures also fall back with a logged error.

#### WHATSAPP_PHONE_NUMBER_ID

**What it does**: The id of the WhatsApp Business phone number that sends messages to customers.

**Where used**: `src/server/services/notification.service.ts` (the `/{phone-id}/messages` path).

**How to get it**: Meta developer app → **WhatsApp → API Setup** → Phone Number ID.

**Example**:
```bash
WHATSAPP_PHONE_NUMBER_ID="123456789012345"
```

#### WHATSAPP_VERIFY_TOKEN

**What it does**: A value **you choose**, used during the Meta webhook subscription: Meta's GET challenge to `/api/webhooks/whatsapp` echoes it and the endpoint answers only on a match.

**Where used**: `src/app/api/webhooks/whatsapp/route.ts`.

**How to set it**: Invent any unique string; enter the identical value in Meta's webhook subscription setup.

**Example**:
```bash
WHATSAPP_VERIFY_TOKEN="patel_networks_webhook_verify_2026"
```

> Not a cryptographically strong secret — it's a shared check between you and Meta. Set a real one in production: **unset, the challenge accepts the literal `placeholder_verify_token`** (fine in dev, not in prod). A 403 during Meta setup means a mismatch.

**Templates the code uses** — create all of these in Meta, named exactly:

| Template | Fired by |
|---|---|
| `order_confirmation` | Payment captured (Razorpay) / order placed (prepaid) |
| `cod_verification` | COD order placed |
| `order_dispatched` | Declared in the template union; reserved for the dispatch notification (no call site yet) |
| `out_for_delivery` | Carrier scan webhook |
| `order_delivered` | Carrier scan webhook |
| `order_cancelled` | Order cancelled |
| `return_requested` | Return requested / approved / rejected / refunded |
| `back_in_stock` | SKU stock alerts + wishlist OOS→available transition |
| `b2b_quote_inquiry` | B2B trade inquiry via `/api/contact` |
| `address_updated` | Customer edits the delivery address on an order |

(The `WhatsAppTemplate` union in `notification.service.ts` is exactly these ten names; every one has a call site today except `order_dispatched`, which is declared and reserved.)

### Store overrides

#### STORE_GSTIN

**What it does**: The GSTIN rendered on every printable GST tax invoice and in the storefront footer.

**Where used**: `src/lib/constants.ts` (`STORE.gstin`).

**Default**: `24AAACP1234F1Z8` — an ADR-014 **placeholder** in the Gujarat (24) format. Replace with the client's real GSTIN in production; invoices are legal documents.

**Example**:
```bash
STORE_GSTIN="24AAACP1234F1Z8"
```

#### NEXT_PUBLIC_SUPPORT_WHATSAPP

**What it does**: The support number behind `wa.me` deep links (contact page, floating widget, B2B inquiry prompts).

**Where used**: `src/lib/constants.ts` (`STORE.whatsapp` → `whatsappDeepLink()`).

**Default**: `919876543210`

**Format**: Digits only, **with the `91` prefix, no `+`** (wa.me URL form).

> ⚠️ Like every `NEXT_PUBLIC_*`, it is inlined at build time — rebuild the image to change it.

**Example**:
```bash
NEXT_PUBLIC_SUPPORT_WHATSAPP="919876543210"
```

**Not env vars**: the COD ceiling (`1500000` paise = ₹15,000), COD fee (`4900`), shipping fee (`9900`), free-shipping threshold (`50000`), dispatch cutoff, support phone, and the storefront announcement live in the **`Setting` table**, editable at `/admin/settings` (PUT gated to SUPER_ADMIN/ADMIN). Don't go looking for them in `.env`.

---

## Compose-only Variables

Consumed by `docker-compose.yml`, the containers, or the container entrypoint — never by Next.js code. They live in the same `.env` (compose injects it via `env_file` and reads it for `${…}` interpolation).

### POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB

**What they do**: Credentials the `postgres:16-alpine` image uses to create the database and superuser on **first boot** of the `pgdata` volume. The `db` service healthcheck (`pg_isready`) also reads them.

**Where used**: `docker-compose.yml` (`env_file: .env` on the `db` service), consumed by the Postgres image itself. The port is deliberately **not published to the host** — reach Postgres with `docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"`.

**How to set them**:

| Key | Value |
|---|---|
| `POSTGRES_USER` | `patel` (any lowercase name) |
| `POSTGRES_PASSWORD` | `openssl rand -hex 16` |
| `POSTGRES_DB` | `patelnetworks` |

> ⚠️ These **must match `DATABASE_URL`** (user, password, db name, and host `db`). A mismatch is the top cause of degraded health on a fresh VPS.

> ⚠️ **Password rotation** — rotate inside Postgres first, then in `.env`:
> ```bash
> docker compose exec db psql -U patel -d patelnetworks -c "ALTER USER patel PASSWORD 'new-password';"
> ```
> Then update `DATABASE_URL` **and** `POSTGRES_PASSWORD` in `.env` and run `docker compose up -d` so both containers re-read them. The `pgdata` volume keeps its data; nothing is recreated or lost.

### RUN_MIGRATIONS

**What it does**: Entrypoint gate. `true` → before the server starts, `docker-entrypoint.sh` syncs the schema: `prisma migrate deploy` if `prisma/migrations/` exists in the image, otherwise (current repo strategy) `prisma db push --skip-generate`. The push runs **without** `--accept-data-loss`, so destructive drift aborts loudly instead of silently dropping columns.

**Where used**: `docker-entrypoint.sh` (Prisma CLI + engines are baked into the image — no network fetch at boot).

**Default**: `true`. Set `false` only for one-off app-only containers.

```
RUN_MIGRATIONS=true
```

### PORT

**What it does**: The port the Next.js standalone server listens on **inside the container**. Nginx proxies to `app:3000` (the `patel_app` upstream in `nginx/conf.d/patel.conf`).

**Where used**: Dockerfile (`ENV PORT=3000` default), the standalone `server.js`, the healthchecks (which ping `127.0.0.1:3000/api/health`).

**Default**: `3000`. **Change it only together with `nginx/conf.d/patel.conf`** — otherwise nginx proxies into the void.

```
# PORT=3000
```

---

## Variables used by patel-5.2 that this codebase does NOT read

Nothing required from patel-5.2 was lost in the rebuild — but several variables 5.2 carried are **deliberately gone**. This section is the parity proof: if you migrate a `.env` from 5.2, delete these rows.

| Variable | What it did in patel-5.2 | patel-5.3 status |
|---|---|---|
| `DIRECT_URL` | Non-pooled Postgres URL for migrations beside PgBouncer (5432 direct vs 6432 pooled — transaction-mode pooling breaks `prisma migrate`) | **Do not set; no effect.** No PgBouncer in this stack — one `DATABASE_URL` over the compose network serves queries *and* the entrypoint's schema sync; `prisma/schema.prisma` has no `directUrl`. |
| `JWT_EXPIRES_IN` | Declared in 5.2's `.env.example` as the session TTL | **Do not set; no effect.** The session TTL is a code constant (`'7d'` in `src/lib/session.ts`). |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Client-side checkout read the public key id directly from the bundle | **Do not set; no effect.** Checkout takes the key id from the server's order response (`publicKeyId()` in `payment.service.ts`) — one source of truth. |
| `WHATSAPP_API_URL` | Meta Graph base URL override | **Do not set; no effect.** Graph `v20.0` is hardcoded in `notification.service.ts`. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Reserved in 5.2, never read | **Do not set; no effect.** Not declared in this codebase at all. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Reserved in 5.2, never implemented | **Do not set; no effect.** Images in 5.3 are URL-based (seed + admin-managed URLs). If object storage is ever added, the commented `minio` block in `docker-compose.yml` is the intended slot. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase-era leftovers, already removed in 5.2 by ADR-022 | **Do not set; no effect.** Supabase was never part of 5.3 (compose rule: client-owned Postgres only). |

Dead variables in a `.env` don't just sit there — they mislead the next reader into thinking a subsystem is configured. Remove them when migrating.

---

## Environment Setup by Platform

### Local sandbox (this repo's daily mode)

1. `cp .env.example .env` — the template defaults are sim-safe.
2. Only `DATABASE_URL` needs attention, and its SQLite default (`file:./db/custom.db`) is already correct.
3. `bun run db:push` → `bun prisma/seed.ts` → `bun run dev`.
4. Every integration runs in simulation: test-customer OTPs appear in `dev.log` under `[SIMULATED SMS]`, payments are `order_sim_*`, AWBs are `DELH…`, WhatsApp dispatches are `[SIMULATED WHATSAPP]` boxes. Nothing paid, nothing external.

### Render (staging, not the primary target)

The primary deployment is the client VPS (decision C8) — but the image is a standard Docker container, so Render works for a staging environment:

1. Docker runtime; add the compose-only files' counterparts: set `DATABASE_URL` to the **managed Postgres external connection string with `sslmode=require`** (there is no compose network here, so the host is *not* `db`), `JWT_SECRET`, `NEXT_PUBLIC_APP_URL` (the Render URL), and `RUN_MIGRATIONS=true`.
2. `NODE_ENV` stays unset (platforms default to `production`).
3. Integrations stay unset → simulation mode, same as the sandbox. Full walkthrough: **[docs/RENDER-DEPLOYMENT.md](./RENDER-DEPLOYMENT.md)**.

### VPS / physical server (production)

Full hardware + OS + Docker runbooks: **[docs/VPS-SETUP-GUIDE.md](./VPS-SETUP-GUIDE.md)** and **[docs/PHYSICAL-SERVER-SETUP-GUIDE.md](./PHYSICAL-SERVER-SETUP-GUIDE.md)** (plus the command-level [deploy/DEPLOY-STEPS.md](../deploy/DEPLOY-STEPS.md)).

1. `cp .env.example .env && nano .env` in `/opt/patelnetworks`.
2. Fill in **this exact order** (rationale in deploy/ENV-SETUP.md §2):
   1. `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` (the trio),
   2. `DATABASE_URL` (host `db`, mirroring the trio),
   3. `JWT_SECRET` (`openssl rand -hex 32`),
   4. `ADMIN_EMAIL` + `ADMIN_PASSWORD` (bootstrap pair),
   5. `NEXT_PUBLIC_APP_URL` — **before the first image build** (baked into bundles),
   6. leave every integration unset until the client procures keys — the store launches in simulation mode by design, then each subsystem goes live one at a time.
3. Apply changes: `docker compose up -d app` — runtime vars need **no rebuild**. The exception is `NEXT_PUBLIC_APP_URL` (and any `NEXT_PUBLIC_*`): after changing it, rebuild the image with the compose `build.args` uncommented, otherwise bundles keep the old origin.

---

## Security Best Practices

1. **Never commit `.env` to git.** It's ignored via `.env*` with `!.env.example` opting only the placeholder template back in. Verify with `git check-ignore -v .env`.
2. **Use a different `JWT_SECRET`** for staging vs production — a shared secret lets a staging-forged cookie authenticate on prod.
3. **Override `ADMIN_PASSWORD` in production** and never ship the seed default `patel@admin2026`; replace or disable the seeded staff demo accounts (`inventory@…`, `orders@…`) before go-live.
4. **Keep secrets server-side.** `RAZORPAY_KEY_SECRET`, webhook secrets, `SHIPROCKET_PASSWORD`, `WHATSAPP_ACCESS_TOKEN`, `SMS_GATEWAY_API_KEY` must never carry a `NEXT_PUBLIC_` prefix or reach a client bundle.
5. **Set webhook secrets on both sides.** `RAZORPAY_WEBHOOK_SECRET` and `WHATSAPP_VERIFY_TOKEN` exist to reject spoofed traffic; a dashboard/`.env` mismatch silently drops events.
6. **Use HTTPS** — on the VPS it's nginx + certbot (patel-5.2 used Caddy; this stack standardizes on nginx). Cookies are issued `Secure` because `NODE_ENV=production` in the image, and nginx forwards `X-Forwarded-Proto` so the app sees the real client scheme.
7. **Keep an off-VPS copy of `.env` in the client's vault.** `deploy/backup.sh` archives the database only — a lost VPS loses the DB *and* the `.env` together, and the bootstrap password lives nowhere else.
8. **Rotate on suspicion** — `JWT_SECRET` (expect full re-login + dead OTPs), `POSTGRES_PASSWORD` (ALTER USER inside the container first, then `.env` + `docker compose up -d`), `ADMIN_PASSWORD` (new bootstrap pair → reset the old hash, per deploy/ENV-SETUP.md §5).

---

<p align="center">
<em>Authored by Omkar Kardile — Patel Networks / MegaTech</em><br/>
<sub>Surveillance hardware procurement platform · India</sub>
</p>
