# Patel Networks / MegaTechzy — README

E-commerce + operations platform for **Patel Networks** (Surat, Gujarat): CCTV, surveillance and networking hardware retail & B2B trade. Storefront brand: **MegaTechzy** (by Patel Networks); store-ops console: **Patel Networks Operations Console**.

> Stack: **Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma ORM · PostgreSQL (Neon — dev + prod) · bun**
> 38 Prisma models · 50 pages · 78 API route handlers · 2 operator roles (Owner + scoped Staff) · money always integer paise
> Appearance: editorial light theme (default) · **trust-pine dark mode** via the nav toggle (storefront header, mobile drawer, admin chrome)
>
> **Live on Render (Node runtime)**: <https://patelnetworks.onrender.com> — free plan sleeps after ~15 idle minutes; the first visit wakes it in ~50 s. Runbook: [`deploy/RENDER-STEPS.md`](deploy/RENDER-STEPS.md).
>
---

## Quick start (sandbox / local dev)

```bash
bun install          # postinstall runs `prisma generate`
bun run db:push      # apply schema to PostgreSQL (Neon via .env DATABASE_URL)
bun run db:seed      # full catalog + demo users (idempotent restore point)
bun run dev          # Next dev server on :3000
```

Health check: `GET /api/health` → `{ok:true,data:{status:"healthy",db:"up"}}`

Quality gates per round: `bun run lint` (0) · `bunx tsc --noEmit` (0) · `bash scripts/responsive-sweep.sh` + `bash scripts/responsive-sweep-admin.sh` (0px horizontal overflow at 375/768/1280) · **docs updated in the same round** (`changelog.md` + every affected md — documentation never lags code).

### Default credentials (sandbox only)

| Who | Where | Credential |
|---|---|---|
| Superadmin | `/admin/login` | `superadmin@patelnetworks.in` / `patel@admin2026` |
| Test customer | `/account/login` | phone `+91 98765 43210`, OTP code appears in `dev.log` (`[SIMULATED SMS]`) |

> Bootstrap admin comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env on first login. Never reuse sandbox credentials in production — set them per environment.

### Demo data

`bun run db:seed` builds the catalog **and** six months of deterministic operating history — every one of the 38 tables has data (51 buyers, 182 orders across all statuses, payments/gateway events, shipments/tracking events, returns, reviews, carts, wishlists, B2B inquiries, audit trail, stock-monitor sessions) — see **D-15** in `decisions.md`. `bun run scripts/qa-fixtures.ts` adds a few extra console demos (B2B inquiries, wishlist price-drop, pending review). **Purge before go-live:** `bun run scripts/qa-clean.ts` + a fresh `db:seed`.

---

## Documentation map

| Doc | Purpose |
|---|---|
| [`docs/README.md`](docs/README.md) | Full docs index |
| [`docs/ROUTES.md`](docs/ROUTES.md) | **Routes cheat sheet**: every URL + login pages & credentials (staff login = `/admin/login`) |
| [`technical-documentation.md`](technical-documentation.md) | **Tech hub**: architecture, module map, API index, conventions |
| [`business-documentation.md`](business-documentation.md) | Business model, ops flows, GST, vendor integrations, roles |
| [`business-pitch.md`](business-pitch.md) | **The platform pitch**: what the platform is, why it's special, business outcomes — visual version lives at `/showcase` |
| [`changelog.md`](changelog.md) | Release-by-release change log |
| [`decisions.md`](decisions.md) | Decision log (conflict resolutions + ADRs, incl. recent) |
| [`help.md`](help.md) | Operator help: how to run the store day-to-day, troubleshooting |
| [`compact.md`](compact.md) | One-file compact context (stack, commands, conventions, state) |
| [`worklog.md`](worklog.md) | Agent work journal (per-round, three-section handover) |
| [`docs/ENVIRONMENT-VARIABLES-GUIDE.md`](docs/ENVIRONMENT-VARIABLES-GUIDE.md) | Every env var explained |
| [`deploy/DEPLOY-STEPS.md`](deploy/DEPLOY-STEPS.md) | Terse VPS (Docker) deploy runbook |
| [`deploy/RENDER-STEPS.md`](deploy/RENDER-STEPS.md) | Render + Neon deploy runbook (Blueprint or manual) |
| [`docs/VPS-SETUP-GUIDE.md`](docs/VPS-SETUP-GUIDE.md) | Phased VPS setup (Docker, TLS, backups) |
| [`docs/PHYSICAL-SERVER-SETUP-GUIDE.md`](docs/PHYSICAL-SERVER-SETUP-GUIDE.md) | Bare-metal in-shop server guide |
| [`docs/RENDER-DEPLOYMENT.md`](docs/RENDER-DEPLOYMENT.md) | Staging preview on Render |
| [`docs/incidents/2026-09-27-render-502-proxy-unreachable.md`](docs/incidents/2026-09-27-render-502-proxy-unreachable.md) | Incident post-mortem: the go-live HTTP 502 (Render proxy ↔ Next standalone bind trap) |
| [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md) | Go-live checklist + smoke test |

## Repo

Official: `https://github.com/OmKardile/patel-5.3.git` (deploy from `main`).

## Rule of the house

**No AI-generated imagery.** Product/seed images come from real files indexed in `prisma/seed-images.json` (local `public/images/seed/**`). Typographic placeholders render when an image is missing.
