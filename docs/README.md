# Patel Networks / MegaTech — Documentation

Greenfield rebuild of the Patel Networks (MegaTech) e-commerce platform: CCTV, surveillance and networking hardware retail for India, B2C plus a B2B trade desk for contractors and installers. Headquarters and fulfillment hub: Surat, Gujarat (origin PIN 395003, state code 24, GSTIN `24AAACP1234F1Z8` — env-overridable).

The implementation was built from scratch by a multi-agent team; the authoritative build history is `/worklog.md` at the repo root, and module ownership rules live in [`CONTRACTS.md`](./CONTRACTS.md).

## Documentation index

| Document | Contents |
| --- | --- |
| [README.md](./README.md) | This overview: identity, feature map, stack, quick start |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Modular-monolith layout, services, session design, order FSM, dual-mode integrations, design system |
| [DATABASE.md](./DATABASE.md) | All 38 Prisma models, relationships, money-in-paise rationale, portability, seed, PostgreSQL switch |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Client VPS self-hosting: Docker Compose, nginx, migrations, backups, logging, SSL |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Every environment variable, required vs optional, simulation behavior |
| [../deploy/ENV-SETUP.md](../deploy/ENV-SETUP.md) | `.env` setup runbook: fill-in order, credential sources, sim→live verification, rotation, troubleshooting |
| [ENVIRONMENT-VARIABLES-GUIDE.md](./ENVIRONMENT-VARIABLES-GUIDE.md) | Every `.env` variable explained (what/where/how-to-obtain), compose-only vars, patel-5.2 parity table |
| [VPS-SETUP-GUIDE.md](./VPS-SETUP-GUIDE.md) | Production on a cloud VPS: phased Docker Compose deployment with checkpoints, TLS, backups, hardening, rollback |
| [PHYSICAL-SERVER-SETUP-GUIDE.md](./PHYSICAL-SERVER-SETUP-GUIDE.md) | Production on bare metal: hardware specs, OS install, SSH, network, BIOS, power resilience, monitoring |
| [RENDER-DEPLOYMENT.md](./RENDER-DEPLOYMENT.md) | Staging preview (auto-deploy on commit): Render Docker runtime + managed Postgres, never touches production data |
| [incidents/2026-09-27-render-502-proxy-unreachable.md](./incidents/2026-09-27-render-502-proxy-unreachable.md) | **Incident post-mortem**: the go-live HTTP 502 — Render's proxy couldn't reach the Next standalone server (HOSTNAME bind trap); timeline, root cause, resolution, recurrence playbook |
| [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md) | Go-live vendor onboarding (Razorpay KYC, Shiprocket, WhatsApp/DLT) + pre-flight smoke test |
| [API.md](./API.md) | Full endpoint catalog with methods, auth, shapes, error codes |
| [SECURITY.md](./SECURITY.md) | Auth design, RBAC matrix, validation, idempotency, rate limits, hardening checklist |
| [DECISIONS.md](./DECISIONS.md) | Conflict resolutions C1-C12 and ADR-020/021 with priority rationale |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local setup, commands, structure walkthrough, QA workflow, PR checklist |
| [STOCK-MONITOR-RESEARCH.md](./STOCK-MONITOR-RESEARCH.md) | **IMPLEMENTED (Task 21)**: employee stock-monitor panel research, schema + API record; v2 candidates parked |

## Business identity

- **Legal name:** Patel Networks (MegaTech)
- **What it sells:** CCTV/surveillance cameras, DVR/NVR recorders, surveillance storage, displays, cables, connectors, fiber media converters, PoE networking
- **Catalog shape:** Category -> Brand -> Product -> Variant -> SKU -> Inventory; stock exists only at SKU level
- **Customers:** B2C retail (phone + OTP accounts) and B2B buyers (GSTIN input-tax-credit checkout)
- **Compliance:** GST-inclusive pricing, split CGST+SGST (intra-state Gujarat) vs IGST (inter-state), printable GST tax invoice with HSN lines
- **Fulfillment:** Surat hub dispatch, 4:00 PM IST cutoff, Shiprocket/Delhivery carriers, zone-based delivery estimates, selective COD (per-product flag, Rs 15,000 ceiling, air-cargo zones blocked)

## Feature map

Storefront (route group `(store)`):

- Home (hero banners, featured products, kit-builder strip), product listing with facet filters (category tree, brand, price, resolution, rating, availability), product detail pages with variant matrix, gallery, pincode checker, JSON-LD, reviews
- Brands index and brand pages; search page with debounced header autocomplete
- 5-step kit builder (recorder -> cameras bounded by channels -> HDD with retention estimate -> cable/connectors -> summary)
- Cart (server source of truth, guest cart with auto-merge at login), coupon box, checkout with OTP-gated login, saved addresses, B2B GSTIN toggle, Razorpay or COD
- Order success, public order tracking (`/track`), account area: profile, orders, order detail, printable GST invoice, address book (max 10), wishlist
- Content: about, contact (B2B inquiry with WhatsApp notify), FAQ (17 Q&As), shipping policy, return policy, privacy policy, terms, blog index and posts
- Presentation: scroll-parallax motion on hero/bands/covers (reduced-motion-safe), skip-to-content link, responsive sweeps keep every route at 0px horizontal overflow @375/768/1280

Admin (`/admin`, own chrome, role-scoped):

- Dashboard (GMV, GST, order pipeline, payment split, low stock)
- Orders fulfillment console (FSM transition buttons, serial number capture, AWB booking, carrier-scan simulator, CSV export)
- Returns & DOA (full RMA: approve → courier inward → QC → refund → restock) · Trade Desk (B2B inquiry FSM `NEW → CONTACTED → CLOSED`) · Reviews moderation (approve / un-publish / delete — nothing publishes unapproved)
- Products (list/new/edit with variants, SKUs, images, specs), categories, brands
- Inventory console (SKU matrix, adjust with reason codes, movement ledger, CSV export/import) + **Requests & counts** tab (approve staff stock corrections, apply count variances)
- **Staff & access (owner-only, D-12)**: 3-step account wizard (identity → account type + function scopes → review), per-account editor (rename / password reset / scopes / deactivate), owner "Your login" self-service; scope edits apply on the staff's next request
- **Stock Monitor** (STAFF-facing): state-tile stock wall with kiosk mode, human-phrased movement history, discrepancy reports, cycle-count sessions — employees observe and propose, managers dispose (ADR-10)
- Customers (CRM, LTV, B2B badge, wa.me links), coupons, banners, blog editor
- Reports (sales 30-day chart, tax summary, GSTR-1 schedule with CSV export, top products/customers, inventory valuation), settings (COD rules, fees, cutoff, announcement)

APIs: 78 route files under `/api/**` — auth, account, cart, catalog, coupon, shipping, orders, payments, webhooks, admin surface, health. See [API.md](./API.md).

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript (strict conventions, `bunx tsc --noEmit` as the gate) |
| Data | Prisma 6 ORM; SQLite in sandbox (`db/custom.db`), PostgreSQL on the client VPS — one-line provider switch (ADR-021) |
| Styling | Tailwind CSS 4, shadcn/ui components, editorial light design system (Fraunces + Inter) |
| State | Zustand cart mirror (badge/count only — server cart is authoritative) |
| Auth | jose HS256 JWTs in httpOnly cookies (`pn_session`, `pn_admin_session`); OTP for customers, scrypt passwords for staff |
| Validation | Zod schemas on every mutation boundary (`src/lib/validators.ts`) |
| Money | Integer paise everywhere; `formatINR()` formatting |
| Integrations | Razorpay, Shiprocket/Delhivery, SMS (Fast2SMS-compatible), WhatsApp Cloud API — all dual-mode (live vs deterministic simulation) |
| Runtime | Bun for dev/tooling; standalone Next server for production |

## Quick start (sandbox)

```bash
bun install            # install dependencies
bun run db:push        # create/push Prisma schema to SQLite (db/custom.db)
bun prisma/seed.ts     # seed catalog, users, coupons, bundle, posts, settings
bun run dev            # Next dev server on http://localhost:3000 (logs tee'd to dev.log)
```

Seeded logins:

- Admin: `superadmin@patelnetworks.in` / `patel@admin2026` (override via `ADMIN_EMAIL`/`ADMIN_PASSWORD`)
- Staff demos: `inventory@patelnetworks.in` / `warehouse@2026`, `orders@patelnetworks.in` / `fulfill@2026`, `content@patelnetworks.in` / `content@2026`, `staff@patelnetworks.in` / `counter@2026`
- Test customer: phone `+91 98765 43210` — in the sandbox the OTP is printed to `dev.log` under `[SIMULATED SMS]`

Useful commands: `bun run lint`, `bunx tsc --noEmit`, `bun run db:generate`, `bun run build` (standalone output).

## Sandbox notes (important)

This project is developed inside a constrained sandbox. The following are simulated by design (documented in worklog Task 0 item 13 and ADR-007/012/013) and switch to live mode purely by configuring real credentials:

- **Database:** SQLite file instead of PostgreSQL; the schema is 100% portable (no Prisma enums, no native arrays, integer paise)
- **Razorpay:** placeholder/absent keys activate deterministic simulation (`order_sim_...` orders, HMAC-signed verify flow, sandbox-only `/api/payments/razorpay/simulate`)
- **Shiprocket/Delhivery:** placeholder/absent credentials return deterministic AWBs (`DELH...`), labels and tracking events
- **SMS/WhatsApp:** absent keys print `[SIMULATED SMS]` / `[SIMULATED WHATSAPP]` to the server log and record audit rows instead of calling providers

Real keys never live in the repo. See [ENVIRONMENT.md](./ENVIRONMENT.md) for the full variable table and [DEPLOYMENT.md](./DEPLOYMENT.md) for the VPS target.
