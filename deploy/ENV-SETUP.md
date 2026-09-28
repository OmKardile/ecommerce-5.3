# Patel Networks / MegaTechzy — `.env` Setup Guide

Companion to `deploy/DEPLOY-STEPS.md` (VPS runbook) and `docs/ENVIRONMENT.md`
(reference table). This guide is the **step-by-step** version: what to put in
`.env`, where each value comes from, how to prove the subsystem switched from
simulation to live, and how to rotate secrets later.

The committed template is `.env.example` — always start from a copy:

```bash
cp .env.example .env      # then edit; .env is git-ignored (never commit it)
```

---

## 0. How env vars flow in this repo (read once)

| Mechanism | Variables | Implication |
|---|---|---|
| **Runtime read** (`process.env.*` in `src/`) | everything except `NEXT_PUBLIC_*` | Change → restart the app (`docker compose up -d app`). No rebuild. |
| **Build-time inlined** (Next.js bundles client code with these baked in) | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPPORT_WHATSAPP` | On Docker builds they are also a build **arg** (see `docker-compose.yml` `args:` comment). Changing the origin → rebuild the image, otherwise client bundles keep the old value. |
| **Compose `env_file`** | whole `.env` injected into `app` and `db` containers | The same file also feeds `${...}` interpolation and the `POSTGRES_*` trio consumed by the `postgres:16-alpine` image. |
| **Dockerfile build args** | `NEXT_PUBLIC_APP_URL` (default `http://localhost:3000`), `PRISMA_PROVIDER` (default `postgresql`) | The repo schema is already `postgresql`; the in-image sed remains only as a no-op safety net for SQLite checkouts — do not override unless you know why. |
| **Container entrypoint** | `RUN_MIGRATIONS` | `true` → schema sync at boot (`migrate deploy` if `prisma/migrations/` exists, else `db push --skip-generate`). |

**Golden rule:** leave a variable **unset** rather than inventing a fake
value. Every integration detects missing/`placeholder` credentials and falls
back to deterministic simulation; a plausible-looking wrong value instead
produces real API failures at checkout time.

---

## 1. Sandbox / local development — zero paid config

The template defaults are sim-safe. Only two things normally need attention:

```bash
cp .env.example .env
```

1. **`DATABASE_URL`** — sandbox keeps a local SQLite fallback in
   `.env.example` (`DATABASE_URL="file:./db/custom.db"`), which additionally
   requires flipping `provider = "sqlite"` in `prisma/schema.prisma`. The
   default sandbox posture is the shared Neon Postgres string (repo provider
   is PostgreSQL since Task 27): `cp .env.example .env` and paste the Neon
   URL, then `bun run db:push` + `bun run db:seed` (skip seeding if the Neon
   DB is already populated).
2. **Nothing else is required to boot.** Sessions use the documented dev
   fallback secret; OTPs print to the server log; payments/shipping/WhatsApp
   run in simulation.

Seeded logins (see `docs/README.md`): superadmin `superadmin@patelnetworks.in`
/ `patel@admin2026` (override at seed time via `ADMIN_EMAIL`/`ADMIN_PASSWORD`),
staff demos, test customer `+91 98765 43210` whose OTP appears in `dev.log`
under `[SIMULATED SMS]`.

---

## 2. VPS production — fill-in order

Follow this exact order on the VPS (assumes `cp .env.example .env` in
`/opt/patelnetworks`; domain `patelnetworks.in` as the example).

### 2.1 Database trio + connection string

```bash
openssl rand -hex 16        # -> POSTGRES_PASSWORD
```

| Key | Value |
|---|---|
| `POSTGRES_USER` | `patel` (any lowercase name) |
| `POSTGRES_PASSWORD` | the generated value |
| `POSTGRES_DB` | `patelnetworks` |
| `DATABASE_URL` | `postgresql://patel:<POSTGRES_PASSWORD>@db:5432/patelnetworks?schema=public` |

Host **must be `db`** — the compose service name on the internal network.
`localhost` inside the app container does not reach Postgres and is the #1
cause of `{"status":"degraded"}` health checks.

### 2.2 Session/OTP secret (mandatory)

```bash
openssl rand -hex 32        # -> JWT_SECRET
```

`JWT_SECRET` signs both session JWTs and OTP lookups. The dev fallbacks
(`patel_networks_dev_secret_change_in_production_32b!` for sessions, `dev`
for OTP hashing) are compile-time conveniences — a public host without a
real value is forgeable-sessions territory. Treat as REQUIRED.

### 2.3 First admin bootstrap

| Key | Value |
|---|---|
| `ADMIN_EMAIL` | e.g. `admin@patelnetworks.in` |
| `ADMIN_PASSWORD` | `openssl rand -base64 18` |

Bootstrap fires on the first `/admin/login` submit **only while no user with
that email exists**. Store the password in the client's password manager,
then note that this pair is a *bootstrap*, not a live password store (see
§5 rotation).

### 2.4 Public origin

```env
NEXT_PUBLIC_APP_URL=https://patelnetworks.in
```

Set it **before the first image build** (it is baked into client bundles via
the Dockerfile build arg). Runtime reads (`metadataBase`, `sitemap.xml`,
`robots.txt`, canonicals) pick it up from `.env` at any time.

### 2.5 Leave the rest unset until the client provides keys

Payments, shipping, SMS, WhatsApp can all stay commented — the store launches
in **simulation mode**: sandbox checkout with `order_sim_*` payments,
deterministic `DELH…` AWBs, OTPs and WhatsApp dispatches visible in
`docker compose logs app`. This is the intended go-live path: launch, verify
catalog + orders + FSM, then plug credentials one subsystem at a time (§3).

### 2.6 Compose-only tail

`POSTGRES_*` (from 2.1) and `RUN_MIGRATIONS=true` are already correct in the
template. `PORT` stays at the default 3000 unless `nginx/conf.d/patel.conf`
is changed with it.

---

## 3. Where each live credential comes from

### Razorpay (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`)

1. Dashboard → **Settings → API Keys** → *Generate Live Keys*. `KEY_ID` is
   `rzp_live_…`; the secret is shown **once** — copy immediately.
2. Dashboard → **Settings → Webhooks** → new endpoint:
   `https://patelnetworks.in/api/webhooks/razorpay`, subscribe to payment
   events; copy the webhook secret. **The same string goes into
   `RAZORPAY_WEBHOOK_SECRET`** — the verify endpoint recomputes the HMAC
   signature with it and drops mismatches.
3. `docker compose up -d app` after editing; the sandbox-only
   `/api/payments/razorpay/simulate` route now refuses with 403 (that's the
   proof live mode is on).

### Shiprocket (`SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`)

The email/password of the Shiprocket account with pickup address registered
at the Surat hub (calls hardcode pickup postcode `395003`, matching
`STORE.originPin`). Optional `SHIPROCKET_API_URL` override defaults to
`https://apiv2.shiprocket.in/v1/external`. Delhivery (`DELHIVERY_API_KEY`) is
wired but routes to the simulator until its direct integration is keyed —
carrier scans still drive the order FSM either way.

### SMS / OTP (`SMS_GATEWAY_API_KEY`, `SMS_SENDER_ID`, `SMS_TEMPLATE_ID`)

Fast2SMS-compatible DLT pathway:

1. DLT registration (e.g. on Jio/Airtel/Vodafone DLT portals): register the
   business, header/sender ID (6 chars → `SMS_SENDER_ID`), and the OTP
   message template; note the template ID.
2. Gateway API key → `SMS_GATEWAY_API_KEY`; `SMS_TEMPLATE_ID` is sent as the
   `message` template id on the send call.

Until then OTPs are printed as `[SIMULATED SMS] … OTP: <code>` in the app
logs — acceptable for the sandbox, **never** for production.

### WhatsApp Cloud API (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`)

1. Meta developer app → **WhatsApp** product → *API Setup*: copy the phone
   number ID and create a permanent **System User** token (never the
   24-hour one).
2. Webhook subscription: callback URL
   `https://patelnetworks.in/api/webhooks/whatsapp`, verify token = your
   `WHATSAPP_VERIFY_TOKEN` value (unset it and Meta's GET challenge accepts
   the literal `placeholder_verify_token` — fine in dev, not in prod).
3. Create the message templates the code sends — the union used by
   `notification.service.ts` is:

   `order_confirmation`, `order_dispatched`, `out_for_delivery`,
   `order_delivered`, `cod_verification`, `b2b_quote_inquiry`,
   `address_updated`

### Store overrides (`STORE_GSTIN`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`)

The client's real GSTIN replaces the ADR-014 placeholder
(`24AAACP1234F1Z8`) — it is rendered on every GST tax invoice and the footer.
`NEXT_PUBLIC_SUPPORT_WHATSAPP` is digits only with the `91` prefix, no `+`.

> COD ceiling, COD fee, shipping fee, free-shipping threshold, dispatch
> cutoff, support phone and the storefront announcement are **not** env vars
> — they live in the `Setting` table and are edited at `/admin/settings`.

---

## 4. Prove each subsystem switched (verification checklist)

After every credential drop-in: `docker compose up -d app`, then:

| Subsystem | Simulation looks like | Live looks like |
|---|---|---|
| DB | `/api/health` → `{"status":"degraded"}` | `{"status":"healthy","db":"up"}` |
| Payments | orders `order_sim_*`; `/api/payments/razorpay/simulate` works | simulate route **403**; real `pay_*` ids; webhook HMAC verified |
| Shipping | AWBs `DELH<10hex>`, provider ids `SR-SIM-*` | real AWB ids from the provider; labels from provider URL |
| SMS/OTP | `[SIMULATED SMS] … OTP: <code>` in `docker compose logs app`; API says `simulated:true` | no simulated lines; OTP arrives on the handset |
| WhatsApp | `[SIMULATED WHATSAPP]` log box + `WHATSAPP_DISPATCH_SIMULATED` audit row | dispatch audit rows without the SIMULATED marker; message delivered in Meta panel |

Also run one end-to-end sanity pass per go-live: OTP login → order (Razorpay
& COD) → admin FSM advance to dispatch → tracking events.

---

## 5. Rotation & hygiene

- **`JWT_SECRET`** — invalidates every session AND outstanding OTP on
  restart. Rotate on suspicion of leak; expect users to re-login (that's the
  point).
- **`ADMIN_PASSWORD`** — bootstrap-only: changing it in `.env` does **not**
  change an existing superadmin's password (bootstrap is skipped once the
  email exists). To truly rotate: create a new bootstrap pair, log in as the
  new SUPER_ADMIN, then have the DB password hash of the old account reset
  (`scrypt$salt$digest`, N=16384/r=8/p=1, 64-byte key) or deactivate the old
  user. There is intentionally no self-service password endpoint for staff.
- **`RAZORPAY_WEBHOOK_SECRET`** — update the dashboard and `.env` together;
  a mismatch silently drops every webhook.
- **`POSTGRES_PASSWORD`** — rotate inside Postgres first
  (`docker compose exec db psql -U patel … ALTER USER patel PASSWORD …`),
  then update `DATABASE_URL` + `POSTGRES_PASSWORD` in `.env` and
  `docker compose up -d` so both containers re-read it. `pgdata` keeps its
  data; no volume change involved.
- **File hygiene** — `.env` is git-ignored (`.env*`, with `!.env.example`
  opting the template in); secrets never appear in compose, Dockerfile,
  nginx conf, or code. Backups: `deploy/backup.sh` archives the DB only —
  keep an off-VPS copy of `.env` in the client's vault, a lost VPS loses
  both together.

---

## 6. Symptom → variable quick map

| Symptom | Suspect variable(s) |
|---|---|
| health `degraded`, `docker compose logs db` shows auth errors | `POSTGRES_PASSWORD` vs `DATABASE_URL` mismatch, or `DATABASE_URL` host != `db` |
| Admin login "Invalid credentials" on a fresh box | `ADMIN_EMAIL`/`ADMIN_PASSWORD` unset or already-bootstrapped email |
| OTP never arrives, nothing in logs | `SMS_GATEWAY_API_KEY` set but wrong/placeholder-adjacent, or DLT template rejected — check app logs for the live-send error + sim fallback |
| OTP works but sessions drop on every request | `JWT_SECRET` changed between restarts / differs across replicas |
| Payments stuck "pending", no webhook events | `RAZORPAY_WEBHOOK_SECRET` mismatch or dashboard webhook not pointed at `/api/webhooks/razorpay` |
| checkout signature verification fails live | `RAZORPAY_KEY_SECRET` does not match the `RAZORPAY_KEY_ID` pair |
| Shipping quotes 502/errors after adding keys | wrong `SHIPROCKET_API_URL`, or account lacks the `395003` pickup |
| sitemap/robots/canonicals still show `localhost:3000` | `NEXT_PUBLIC_APP_URL` set after image build → rebuild with compose `args` |
| WhatsApp GET /webhooks/whatsapp 403 during Meta setup | `WHATSAPP_VERIFY_TOKEN` mismatch |

---

## 7. Variable → code provenance (audit trail)

Every runtime read, so future greps can re-verify this guide:

| Variable | Read in |
|---|---|
| `DATABASE_URL` | `prisma/schema.prisma` (via `src/lib/db.ts` client) |
| `JWT_SECRET` | `src/lib/session.ts` (session fallback), `src/server/services/auth.service.ts` (OTP hash fallback `'dev'`) |
| `NEXT_PUBLIC_APP_URL` | `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts` (+ Dockerfile/compose build arg) |
| `NODE_ENV` | `src/lib/session.ts` + `cart.service.ts` (secure cookies), `src/lib/db.ts` (log level) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `src/server/services/auth.service.ts` (bootstrap), `prisma/seed.ts` (seed override) |
| `RAZORPAY_*` | `src/server/services/payment.service.ts` |
| `SHIPROCKET_*`, `DELHIVERY_API_KEY` | `src/server/services/shipping.service.ts` |
| `SMS_*`, `WHATSAPP_*` | `src/server/services/notification.service.ts`; verify token also `src/app/api/webhooks/whatsapp/route.ts` |
| `STORE_GSTIN`, `NEXT_PUBLIC_SUPPORT_WHATSAPP` | `src/lib/constants.ts` (`STORE`) |
| `POSTGRES_*`, `RUN_MIGRATIONS`, `PORT` | `docker-compose.yml` (postgres image + healthchecks), `docker-entrypoint.sh`, standalone server |
