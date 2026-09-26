# Technical documentation (hub)

Single entry point for engineers. Deep dives live in `docs/`; this file stays the accurate overview.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 App Router, React 19 | All mutations via **route handlers** (no server actions) |
| Language | TypeScript 5 (strict) | |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) | Editorial light theme, pine `#1e3a2f`-family primary |
| DB | Prisma 6 · **SQLite in dev, PostgreSQL in prod** | Portable schema: no enums, no `String[]`, money = integer paise |
| Auth | Phone-OTP (customers) · email+password scrypt (admins) | JWT in httpOnly cookies, `secure` in prod |
| Cache/state | Local memory caching, Zustand (client islands) | No Redis by design |
| Runtime | bun | `bun run dev` on :3000 |

## Architecture in one page

```
src/
  app/
    (store)/          ← 24 storefront pages (catalog, PDP, cart, checkout, account, track…)
    admin/
      login/          ← standalone login (outside panel chrome)
      (panel)/        ← 15 console pages, server-layout gated + role badges
    api/              ← 67 route handlers (all mutations; Zod-validated DTOs)
  components/
    storefront/       ← product cards, gallery, variant selector, cart, reviews…
    admin/            ← client islands per console module + shared shell
  server/services/    ← business logic (orders, inventory, shipping, payments,
  |                      notifications, catalog, reports, auth); the ONLY place
  |                      that talks to Prisma besides thin API reads
  lib/                ← session, api-helpers (ok/fail/requireRole), validators,
  |                      money, phone, pincodes, rate-limit, constants
prisma/schema.prisma  ← 35 models · prisma/seed.ts + seed-images.json (real images only)
scripts/              ← qa-fixtures.ts / qa-clean.ts / checkdb.ts / rma-e2e.sh
```

**Request flow**: page/handler → service (auth context resolved first) → Prisma → `{ok,data}` envelope via `ok()`/`fail()`.

## Conventions that must not drift

1. **Money is integer paise** everywhere (DB, API, logic). Convert to ₹ only at render (`paiseToRupees`).
2. **`{ok, data}` envelope** on every API route; errors via `fail(msg, status, issues?)`.
3. **All mutations are route handlers** with Zod schemas from `src/lib/validators.ts`.
4. **Status FSMs live server-side** with forward-only ranks + audit records (orders, returns, inquiries, shipments).
5. **SQLite contains** is CI for ASCII; **no `mode:'insensitive'`** (breaks on SQLite).
6. **No AI-generated images.** Seed images indexed in `prisma/seed-images.json`.
7. **Audit**: state-changing admin actions call `recordAudit(action, entity, id, details, userId)` (self-heals stale sessions — see decisions.md D-3).
8. Client islands use the app's plain `role="tablist"` button-group pattern (not Radix Tabs) for consistency.

## Auth model

| Surface | Mechanism | Rate limits |
|---|---|---|
| Customer | OTP to phone; JWT cookie `pn_session` | OTP: 3/phone/window + 12/IP/window; verify attempts capped |
| Admin | email+password (scrypt N=16384,r=8,p=1); JWT cookie `pn_admin_session`; role bootstrap via `ADMIN_EMAIL/PASSWORD` | Login 8 / 10 min / email |
| Cookies | httpOnly, `sameSite=lax`, `secure` in prod | Role isolation: admin login clears customer cookie and vice versa |

RBAC roles: `SUPER_ADMIN, ADMIN, INVENTORY_MANAGER, ORDER_MANAGER, CONTENT_MANAGER` — enforced per-route via `requireRole([...])` (products/categories/brands/settings: admin+; inventory mutations: +INVENTORY_MANAGER; orders/shipments/returns/serials: +ORDER_MANAGER; content (banners/posts/coupons): +CONTENT_MANAGER).

## Integrations (dual-mode)

Each integration is **live when real credentials exist, deterministic simulation otherwise** — no fabricated success (`{simulated:true}` is surfaced):

- **Razorpay**: live orders + HMAC signature webhook verification; simulate path for sandbox.
- **Shiprocket/Delhivery**: live AWBs/labels; simulated `DELH<10hex>` AWBs, zone-based ETAs. Tracking webhook now token-gated (`SHIPPING_WEBHOOK_TOKEN`).
- **SMS (Fast2SMS shape, DLT)**: live dispatch or `[SIMULATED SMS]` lines in server logs.
- **WhatsApp Cloud API (Meta)**: 7 canonical templates (order confirm, shipped, delivered, refund, RMA update, back-in-stock, address_updated) or simulated audit records.

## Data & migrations

- Dev: `bun run db:push`; restore catalog any time with `bun run db:seed`.
- Prod: `RUN_MIGRATIONS=true` runs `prisma migrate deploy` in the container entrypoint; provider switch is one line (`provider = "postgresql"`), documented in `docs/VPS-SETUP-GUIDE.md`.
- Backups: `deploy/backup.sh` (cron-able) + `.env` vault copy off-box.

## Verification gates (every round)

`bun run lint` (0) · `bunx tsc --noEmit` (0) · `GET /api/health` → `db:up` · agent-browser E2E pass of changed flows · 0 console errors.

## Deep-dive index

`docs/ARCHITECTURE.md` · `docs/DATABASE.md` · `docs/API.md` · `docs/SECURITY.md` · `docs/CONTRACTS.md` · `docs/ENVIRONMENT.md` + `docs/ENVIRONMENT-VARIABLES-GUIDE.md` · deployment trio in the README map.
