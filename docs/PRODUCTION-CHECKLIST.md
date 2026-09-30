# Patel Networks / MegaTechzy — Production Deployment & Manual Configuration Checklist

> **Target Audience**: Business Owner, System Administrator, DevOps Engineer  
> **Platform Scope**: Commercial CCTV, Surveillance & Structured Networking Platform (India)  
> **Objective**: Step-by-step instructions for transitioning from the sandbox simulation/development build into a live, high-reliability commercial production environment on the client's own Ubuntu VPS.

> **Companion docs**: VPS runbook [`deploy/DEPLOY-STEPS.md`](../deploy/DEPLOY-STEPS.md) · architecture [DEPLOYMENT.md](./DEPLOYMENT.md) · env reference [ENVIRONMENT.md](./ENVIRONMENT.md) · env runbook [`deploy/ENV-SETUP.md`](../deploy/ENV-SETUP.md) · staging preview [RENDER-DEPLOYMENT.md](./RENDER-DEPLOYMENT.md) · hardening [SECURITY.md](./SECURITY.md)

---

## 📌 Quick Summary of Manual Prerequisites

| Service | Provider | Purpose | Production Action Required |
| :--- | :--- | :--- | :--- |
| **Database** | Self-hosted PostgreSQL 16 (client VPS) | Relational DB — Docker Compose `db` service (`postgres:16-alpine`, `pgdata` volume) | Provision the VPS, fill the `POSTGRES_*` trio + `DATABASE_URL`; schema syncs on boot (`RUN_MIGRATIONS=true`). Guides: `docs/VPS-SETUP-GUIDE.md` / `docs/PHYSICAL-SERVER-SETUP-GUIDE.md` (bare-metal path) + our runbook `deploy/DEPLOY-STEPS.md` |
| **Payments** | Razorpay | UPI, Cards, Netbanking | Complete KYC, generate live API keys, configure webhook endpoint for payment capture |
| **Logistics** | Shiprocket / Delhivery | Automated AWB & live tracking | Add live account credentials, set the Surat (`395003`) pickup hub, register the tracking webhook |
| **WhatsApp API** | Meta Cloud API | Transactional lifecycle alerts | Generate a permanent System User token, submit the 7 HSM templates for approval, register the webhook |
| **SMS OTP** | Fast2SMS (DLT) | Passwordless mobile OTP auth | Add the live SMS API key, verify Indian telecom DLT registration (entity + header `PTLNET` + approved OTP template id) |
| **Admin Security** | Custom bootstrap | SUPER_ADMIN console auth | Set `ADMIN_EMAIL`/`ADMIN_PASSWORD` before the first `/admin/login`; set a cryptographically secure `JWT_SECRET` |
| **Hosting & SSL** | Client Ubuntu VPS (Docker Compose: app + db + nginx) | Fullstack Next.js 16 hosting | `docker compose up -d --build`, bind `patelnetworks.in` DNS, TLS via certbot |

---

## 🗄️ 1. Self-Hosted PostgreSQL 16 on the Client VPS

> This is **NOT Supabase** (and no other managed DB). Project rule (Task 0 / `docker-compose.yml` header): client-owned VPS only. PostgreSQL 16 runs as the `db` service inside the same Docker Compose stack as the app and nginx.

### 1.1 Provision the Database Host
1. Follow `deploy/DEPLOY-STEPS.md` §1–2: Ubuntu 22.04/24.04 VPS → install Docker Engine + compose plugin → clone the repo to `/opt/patelnetworks`.
2. The database is the `db` service in `docker-compose.yml`: image `postgres:16-alpine`, data in the named `pgdata` volume, **deliberately not published to the host** — reach it with `docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"`.
3. Server hardening (SSH key-only, UFW 22/80/443, BIOS AC-power recovery, off-VPS backup copies) follows `docs/VPS-SETUP-GUIDE.md` — with `docs/PHYSICAL-SERVER-SETUP-GUIDE.md` covering the bare-metal alternative (hardware specs, OS install, BIOS/power resilience); the canonical 5.3 runbook is `deploy/DEPLOY-STEPS.md`, architecture rationale in [DEPLOYMENT.md](./DEPLOYMENT.md).

### 1.2 Configure Production Environment Variables
In `/opt/patelnetworks/.env` (never committed):
```env
# postgres:16-alpine container credentials (read by the db service):
POSTGRES_USER="patel"
POSTGRES_PASSWORD="<openssl rand -hex 16>"
POSTGRES_DB="patelnetworks"

# Prisma connection — host MUST be the compose service name `db`, not localhost:
DATABASE_URL="postgresql://patel:<POSTGRES_PASSWORD>@db:5432/patelnetworks?schema=public"

# Entrypoint migration gate (docker-entrypoint.sh):
RUN_MIGRATIONS="true"
```
With `RUN_MIGRATIONS=true` the app container runs `prisma db push --skip-generate` on every boot (it auto-switches to `prisma migrate deploy` the moment a `prisma/migrations/` folder is ever committed). Destructive schema drift aborts loudly instead of silently dropping columns.

> 🚫 **No `DIRECT_URL` in 5.3.** The 5.2 checklist set a second connection string to bypass Supabase's PgBouncer for migrations — 5.3 has no pooler in front of the database and `prisma/schema.prisma` declares no `directUrl`. One `DATABASE_URL` covers runtime queries and schema sync alike.

### 1.3 Deploy Schema & Seed Catalog
```bash
# Build + start the whole stack; the entrypoint pushes the schema to the
# empty pgdata volume (provider is sed'd sqlite→postgresql inside the image):
docker compose up -d --build
docker compose logs -f app     # watch: schema sync → exec node server.js

# OPTIONAL: demo catalog seed (the builder stage carries bun + full deps):
docker build --target builder -t patel-builder . \
  && docker run --rm --network patelnetworks_internal --env-file .env \
     -v "$PWD/prisma:/app/prisma" patel-builder bun prisma/seed.ts
```
`prisma/seed-images.json` **is committed in this repo**, so the demo seed runs cleanly end-to-end (an older caveat about a missing seed-images file no longer applies). For a clean commercial launch you may skip the demo seed entirely — the real catalog can be entered via `/admin/products`; if you do seed, replace or disable the hardcoded demo staff logins (`inventory@patelnetworks.in` / `warehouse@2026`, `orders@patelnetworks.in` / `fulfill@2026`).

---

## 💳 2. Razorpay Payment Gateway (Live Production)

### 2.1 Complete Business KYC & Activate Live Keys
1. Log in to the [Razorpay Merchant Dashboard](https://dashboard.razorpay.com).
2. Complete business KYC verification with company PAN, GSTIN (`24AAACP1234F1Z8`), and linked bank account for daily settlements.
3. Switch the toggle from **Test Mode** to **Live Mode**.
4. Navigate to **Settings ➔ API Keys** and click **Generate Key**.

### 2.2 Configure Production Environment Variables
```env
RAZORPAY_KEY_ID="rzp_live_xxxxxxxxxxxxxx"
RAZORPAY_KEY_SECRET="your_live_razorpay_secret_key"
RAZORPAY_WEBHOOK_SECRET="<openssl rand -hex 16>"
```
Until these are set (or while they contain `placeholder`), the checkout runs in deterministic simulation mode: `order_sim_*` gateway orders and the sandbox-only `POST /api/payments/razorpay/simulate` endpoint.

### 2.3 Register Live Webhook Endpoint
1. In Razorpay Dashboard, navigate to **Settings ➔ Webhooks**.
2. Click **Add New Webhook** and enter:
   * **Webhook URL**: `https://patelnetworks.in/api/webhooks/razorpay`
   * **Secret**: The exact value of your `RAZORPAY_WEBHOOK_SECRET`
   * **Alert Email**: `admin@patelnetworks.in`
3. Select the following active events:
   * `payment.captured`
   * `payment.failed`
   * `order.paid`
4. Click **Save Webhook**.

### 2.4 5.3 Behavior Notes (go-live proof)
* The webhook route (`/api/webhooks/razorpay`) verifies the **HMAC signature** against `RAZORPAY_WEBHOOK_SECRET` — a mismatch silently drops every event. Update the dashboard and `.env` together.
* Once live keys are configured, the sandbox-only `/api/payments/razorpay/simulate` endpoint **refuses with 403** ("Simulation mode unavailable: live gateway configured"). Hitting it and receiving 403 is your proof the gateway is live.
* **There is no `NEXT_PUBLIC_RAZORPAY_KEY_ID` in 5.3.** The checkout fetches the public key id from the server response — `publicKeyId()` in `src/server/services/payment.service.ts`, returned by `POST /api/payments/razorpay/order` — so the key id is never inlined at build time and can be rotated without a rebuild.

---

## 📦 3. Carrier Logistics (Shiprocket / Delhivery)

### 3.1 Live Account & Primary Hub Setup
1. Log in to your [Shiprocket Account](https://app.shiprocket.in).
2. Navigate to **Settings ➔ Pickup Addresses** and add the Central Fulfillment Hub:
   * **Address**: Surat Central Logistics Node, Ring Road, Surat, Gujarat
   * **Pincode**: `395003`
   * **Phone**: Official operations contact
   * ⚠️ `395003` matches the **hardcoded pickup/billing postcode** in `src/server/services/shipping.service.ts` (serviceability calls + `billing_pincode`). If the hub ever moves, the code must be updated too — otherwise every rate quote and AWB originates from the wrong city.
3. Enable COD per your policy — the in-app COD rules (per-product flag, ₹15,000 ceiling, air-cargo zones blocked) live in `/admin/settings`, not in Shiprocket.

### 3.2 Configure Production Environment Variables
```env
SHIPROCKET_EMAIL="ops@patelnetworks.in"
SHIPROCKET_PASSWORD="your_live_shiprocket_password"
SHIPROCKET_API_URL="https://apiv2.shiprocket.in/v1/external"   # default — override only if directed
```
Missing or `placeholder` credentials return deterministic simulated AWBs (`DELH<10 hex>`) with fake tracking — never acceptable in production.

### 3.3 Register Tracking Status Webhook
1. In Shiprocket Dashboard, go to **API ➔ Webhooks**.
2. Click **Add Webhook** and configure:
   * **URL**: `https://patelnetworks.in/api/webhooks/shipping`
   * **Events**: Status Updates (`PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RTO_INITIATED`)
3. Save configuration. Carrier scans sync the order FSM (the FSM synthesizes an `OUT_FOR_DELIVERY` scan if a carrier jumps straight to `DELIVERED`).

### 3.4 Delhivery Alternative
`DELHIVERY_API_KEY` exists in 5.3 as an alternative provider — until it is keyed, Delhivery routes to the simulator. **One provider's live credentials is enough for real shipping.**

---

## 💬 4. WhatsApp Business Cloud API (Meta)

### 4.1 Create Permanent System User Token
1. Open the [Meta for Developers Portal](https://developers.facebook.com) and navigate to your WhatsApp Business App.
2. In **Business Manager ➔ System Users**:
   * Create an Admin System User named `PatelNetworksEcomEngine`.
   * Assign permissions: `whatsapp_business_messaging`, `whatsapp_business_management`.
   * Click **Generate New Token** and set expiration to **Never** (Permanent Access Token).

### 4.2 Configure Production Environment Variables
```env
WHATSAPP_ACCESS_TOKEN="EAAxxxxxx...your_permanent_system_user_token"
WHATSAPP_PHONE_NUMBER_ID="your_15_digit_phone_number_id"
WHATSAPP_VERIFY_TOKEN="your_random_webhook_verify_token"
```
> 🚫 **5.3 has no `WHATSAPP_API_URL` / `WHATSAPP_BUSINESS_ACCOUNT_ID`** — the Graph v20 base URL (`https://graph.facebook.com/v20.0`) is hardcoded in `src/server/services/notification.service.ts`. Do not port those two variables from the 5.2 checklist; unset variables are simply ignored. Absent/placeholder credentials print `[SIMULATED WHATSAPP]` boxes to the logs and record `WHATSAPP_DISPATCH_SIMULATED` audit rows instead of sending.

### 4.3 Submit & Approve WhatsApp HSM Message Templates
In **Meta WhatsApp Manager ➔ Message Templates**, submit the **7 templates the code actually sends** (names must match exactly — they are the code-canonical union in `notification.service.ts`):

| Template name | Category | Fired by |
| :--- | :--- | :--- |
| `order_confirmation` | Utility | Prepaid payment capture (`payment.service`) |
| `cod_verification` | Utility | COD order placement (`order.service`) |
| `order_dispatched` | Utility | Dispatch / AWB handoff |
| `out_for_delivery` | Utility | Carrier scan (`shipping.service`) |
| `order_delivered` | Utility | Carrier scan (`shipping.service`) |
| `b2b_quote_inquiry` | Utility | `/contact` B2B inquiry acknowledgment |
| `address_updated` | Utility | Order address change (`order.service`) |

Ready-to-submit copywriting examples (5.2 template copy adapted to 5.3 names and parameter orders):

1. **Template Name**: `order_confirmation` (Category: Utility)
   * *Header*: Video Surveillance Order Confirmed
   * *Body*: `Dear {{1}}, Your Patel Networks CCTV order #{{2}} for ₹{{3}} is confirmed. Payment: {{4}}. Items: {{5}}.`
2. **Template Name**: `order_dispatched` (Category: Utility)
   * *Header*: Hardware Dispatched
   * *Body*: `Update on Order #{{1}}: Your surveillance hardware is on the way! Carrier: {{2}}, AWB: {{3}}, Est. Delivery: {{4}}. Track live: {{5}}`
3. **Template Name**: `out_for_delivery` (Category: Utility)
   * *Header*: Out for Delivery
   * *Body*: `Hi {{1}}, your Patel Networks CCTV shipment #{{2}} with courier {{3}} (AWB: {{4}}) is out for delivery in {{5}} today.`
4. **Template Name**: `b2b_quote_inquiry` (Category: Utility)
   * *Body*: `Commercial Project Inquiry Received! Hi {{1}}, our trade desk has received your request: "{{2}}". An authorized representative will contact you within 1 business hour.`

> The template union also declares `order_cancelled`, `return_requested` and `back_in_stock` (order cancellation, RMA and stock-alert flows). Submit them when those notifications are switched on — they are not required for day-1 go-live.

### 4.4 Register WhatsApp Webhook
1. In Meta Developer App ➔ **WhatsApp ➔ Configuration ➔ Webhook**:
   * **Callback URL**: `https://patelnetworks.in/api/webhooks/whatsapp`
   * **Verify Token**: the exact value of `WHATSAPP_VERIFY_TOKEN` (the GET challenge accepts `placeholder_verify_token` when the variable is unset — set a real token in production)
2. Subscribe to field: `messages`.

---

## 📲 5. SMS OTP Gateway (Fast2SMS — DLT)

### 5.1 DLT Registration Compliance (India)
1. Ensure your DLT **Entity** is registered with the telecom operators (Jio/Airtel/VI).
2. Ensure the 6-character **Header/Sender** `PTLNET` is approved.
3. Ensure the 6-digit **OTP template** is approved — and record its **DLT template id**.

### 5.2 Configure Production Environment Variables
```env
SMS_GATEWAY_API_KEY="your_live_fast2sms_auth_key"
SMS_SENDER_ID="PTLNET"
SMS_TEMPLATE_ID="your_dlt_approved_otp_template_id"
```
> **5.3 addition vs 5.2**: `SMS_TEMPLATE_ID` is a real, required variable here. The Fast2SMS-compatible send (`bulkV2`) transmits the DLT template id on every OTP call (`notification.service.ts`), so an empty or unapproved template id means every live OTP fails even with a valid key.

### 5.3 ⚠️ Warning — Simulation Must Never Reach Production
Until `SMS_GATEWAY_API_KEY` is set, every OTP prints as `[SIMULATED SMS] ... OTP: <code>` in the server logs (`docker compose logs app`) and API responses carry `simulated: true`. That is acceptable only in the sandbox/staging. After keying, verify zero `[SIMULATED SMS]` lines appear during a real login — see `deploy/ENV-SETUP.md` §4 (sim→live verification per subsystem).

---

## 🔐 6. Production Security & Credentials

### 6.1 Set Production Superadmin Password
* **Never ship the default development password** (`patel@admin2026`) to a public host.
* Set `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` **before the first `/admin/login` submit** — the bootstrap is one-shot: it fires only while no user matches `ADMIN_EMAIL` (bootstrap semantics per `deploy/ENV-SETUP.md` §5). Changing the env later does **not** change an existing account's password; true rotation requires bootstrapping a new SUPER_ADMIN pair and then resetting the old account's scrypt hash (`scrypt$salt$digest`, N=16384/r=8/p=1, 64-byte key) or deactivating the user. There is intentionally no self-service password endpoint for staff.
* Also replace or disable the seeded demo staff accounts (§1.3).
  ```env
  ADMIN_EMAIL="superadmin@patelnetworks.in"
  ADMIN_PASSWORD="ChooseYourSecureRandomPassword2026!#"
  ```

### 6.2 Set a 32-Byte JWT Secret
* Generate with `openssl rand -hex 32`. It signs the HS256 session JWTs (`pn_session`, `pn_admin_session`) **and** hashes OTP codes (`sha256(code:JWT_SECRET)`):
  ```env
  JWT_SECRET="<openssl rand -hex 32>"
  ```
* Rotating it **logs out everyone and voids all outstanding OTPs** — rotate on suspicion of leak only, and expect users to re-login.
* 🚫 There is **no `JWT_EXPIRES_IN`** in 5.3 — session lifetime is fixed at 7 days in `src/lib/session.ts`.
* Full hardening reference: [SECURITY.md](./SECURITY.md) (RBAC matrix, rate limits, idempotency, validation boundaries).

---

## 🚀 7. Hosting Deployment & Custom Domain (Client VPS — Docker Compose)

### 7.1 Primary Target: Client Ubuntu VPS (not Vercel / Railway)
1. Follow `deploy/DEPLOY-STEPS.md` §1–5: install Docker, clone to `/opt/patelnetworks`, fill `.env` (§1.2 above plus all provider keys), then `docker compose up -d --build`.
2. Only **nginx** is exposed to the internet (80/443); the app and database stay on the internal compose network.
3. Backups are mandatory: `./deploy/backup.sh` on a daily cron (07:30-style schedule per the runbook), with off-VPS copies of both the archives and the `.env` itself.

### 7.2 Optional Staging: Render
A staging/preview environment can run on Render with its **own** Postgres — see [RENDER-DEPLOYMENT.md](./RENDER-DEPLOYMENT.md). Never point staging at the production database.

### 7.3 Domain & DNS Binding
1. In your DNS registrar (GoDaddy / Cloudflare / Namecheap):
   * `A` record: `@` ➔ the **VPS public IP**
   * `A` record: `www` ➔ the **VPS public IP** (or `CNAME www` ➔ `patelnetworks.in`)
2. Wait for propagation: `dig +short patelnetworks.in`.
3. Keep `NEXT_PUBLIC_APP_URL=https://patelnetworks.in` in `.env` and rebuild (`docker compose up -d --build`) so it is baked into client bundles.

### 7.4 TLS via certbot (Let's Encrypt)
Managed-SSL (the 5.2 Vercel path) does not apply — issue certificates on the VPS per `deploy/DEPLOY-STEPS.md` §7:
```bash
sudo certbot certonly --standalone -d patelnetworks.in -d www.patelnetworks.in
# copy certs into nginx/certs/, uncomment the 443 server block in
# nginx/conf.d/patel.conf, docker compose up -d nginx, then:
curl -fsSI https://patelnetworks.in
```
Renewals: `certbot renew --dry-run` + cron/systemd timer re-copying certs and `docker compose exec nginx nginx -s reload` (or the webroot variant documented at the bottom of `nginx/conf.d/patel.conf`).

### 7.5 Full Production `.env` Summary
```env
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://patelnetworks.in"

# Database (self-hosted compose)
DATABASE_URL="postgresql://patel:<POSTGRES_PASSWORD>@db:5432/patelnetworks?schema=public"
POSTGRES_USER="patel"
POSTGRES_PASSWORD="<strong password>"
POSTGRES_DB="patelnetworks"
RUN_MIGRATIONS="true"

# Security
JWT_SECRET="<openssl rand -hex 32>"
ADMIN_EMAIL="superadmin@patelnetworks.in"
ADMIN_PASSWORD="<strong password>"

# Razorpay
RAZORPAY_KEY_ID="rzp_live_xxxxxxxxxxxxxx"
RAZORPAY_KEY_SECRET="your_live_razorpay_secret"
RAZORPAY_WEBHOOK_SECRET="your_live_webhook_secret"

# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN="EAAxxxxxx...permanent_token"
WHATSAPP_PHONE_NUMBER_ID="your_15_digit_phone_id"
WHATSAPP_VERIFY_TOKEN="your_random_verify_token"

# Shiprocket
SHIPROCKET_EMAIL="ops@patelnetworks.in"
SHIPROCKET_PASSWORD="your_shiprocket_password"
SHIPROCKET_API_URL="https://apiv2.shiprocket.in/v1/external"

# SMS OTP (DLT)
SMS_GATEWAY_API_KEY="your_sms_gateway_key"
SMS_SENDER_ID="PTLNET"
SMS_TEMPLATE_ID="your_dlt_otp_template_id"
```
Absent **by design** (do not port from 5.2): `DIRECT_URL` (no PgBouncer), `JWT_EXPIRES_IN` (fixed 7d), `WHATSAPP_API_URL` + `WHATSAPP_BUSINESS_ACCOUNT_ID` (Graph v20 hardcoded), `NEXT_PUBLIC_RAZORPAY_KEY_ID` (served by the API). Optional: `DELHIVERY_API_KEY`, `STORE_GSTIN`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `PORT`. Complete per-variable reference: [ENVIRONMENT.md](./ENVIRONMENT.md).

---

## 🧪 8. Final 12-Step Pre-Flight Smoke Test Checklist

Once the production build is live on `https://patelnetworks.in`, perform this test:

- [ ] **1. SSL & Homepage**: Visit `https://patelnetworks.in`, verify the SSL padlock, hero banner imagery, and the brand logos strip.
- [ ] **2. Search Autocomplete**: Type "CP Plus" in the header search — verify the debounced instant model dropdown, the clear (`X`) button, and that `Escape` closes it.
- [ ] **3. Dynamic PDP Variants**: Open a multi-variant product page, switch between variants (2MP/4MP/8MP), verify dynamic pricing, the image gallery, and the pincode checker.
- [ ] **4. 5-Step Kit Builder**: Build a kit in `/kit-builder` — recorder ➔ cameras (bounded by recorder channels) ➔ HDD with retention estimate ➔ cable/connectors ➔ summary — add to cart, and verify the bundle discount.
- [ ] **5. Cart GST Engine**: Open `/cart`, verify 18% GST computed in integer paise and split **CGST 9% + SGST 9%** for an intra-state (Gujarat) delivery, with coupons applied before tax.
- [ ] **6. Pincode Intelligence**: Test Surat PIN `395003` (ground ETA, COD allowed) and Imphal PIN `795001` (special-zone air-cargo estimate, COD blocked).
- [ ] **7. Live Razorpay Payment**: Place a ₹1 test order, complete a real UPI payment, and verify automatic redirect to `/order-success/[orderNumber]`.
- [ ] **8. Printable GST Invoice**: On the order success screen, click **Print Invoice** and verify the 15-character GSTIN (`24AAACP1234F1Z8` / `STORE_GSTIN`), the **CGST 9% + SGST 9%** tax breakdown, and HSN lines.
- [ ] **9. WhatsApp Real-Time Alert**: Verify the test handset receives the automated `order_confirmation` WhatsApp (or `cod_verification` for a COD order).
- [ ] **10. Admin Auth Gate**: Visit `/admin` anonymous — verify the **307 redirect to `/admin/login`** — then log in with the **production** `ADMIN_EMAIL`/`ADMIN_PASSWORD` (never the `patel@admin2026` default).
- [ ] **11. Fulfillment & CSV Exports**:
  - In `/admin/orders`: run FSM transitions, capture a test serial number, book the carrier AWB, and click **Export CSV**.
  - In `/admin/reports`: verify the GSTR-1 tax schedule and click **Export CSV** (enabled from the first invoice of the month).
- [ ] **12. 404 Error Page**: Visit `/non-existent-link-test` and verify the custom **"404 · Signal lost — This feed is offline"** page renders with its recovery CTAs (home / catalog / track).

### Optional extended checklist — 5.3-exclusive features

- [ ] **E1. Wishlist price-drop badge**: Save an item to `/account/wishlist`, drop its price in `/admin/products`, reload the wishlist — verify the **"Dropped ₹X since saved"** pill.
- [ ] **E2. Trade Desk B2B inbox**: Submit the `/contact` inquiry form — verify it appears in `/admin/inquiries` under the **NEW** tab (sidebar badge increments), then mark it Contacted/Closed with a note.
- [ ] **E3. RMA return flow**: From an account order request a return ➔ approve in the admin returns queue ➔ inward the parcel with **courier + docket number** (invalid docket rejected with 422) ➔ `RESTOCKED` (stock restored) ➔ `REFUNDED`; confirm the customer sees the return state on `/track` and the order page.
- [ ] **E4. Public `/track` timeline**: Track the order by number + delivery phone (and via the phone-only "Find my orders" list) — verify status chips, return/refund/cancel chips, and the event timeline.

---

<p align="center">
<em>A project — authored by <a href="https://omkardile.is-a.dev/">Omkar Kardile</a> — Patel Networks / MegaTechzy</em><br/>
<sub>Surveillance hardware procurement platform · India</sub>
</p>
