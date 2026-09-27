# Patel Networks / MegaTech — README

E-commerce + operations platform for **Patel Networks** (Surat, Gujarat): CCTV, surveillance and networking hardware retail & B2B trade. Storefront brand: **MegaTech** (by Patel Networks); store-ops console: **Patel Networks Operations Console**.

> Stack: **Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma ORM · SQLite (dev) / PostgreSQL (prod) · bun**
> 38 Prisma models · 50 pages · 78 API route handlers · 2 operator roles (Owner + scoped Staff) · money always integer paise
> Appearance: editorial light theme (default) · **trust-pine dark mode** via the nav toggle (storefront header, mobile drawer, admin chrome)

---

## Quick start (sandbox / local dev)

```bash
bun install          # postinstall runs `prisma generate`
bun run db:push      # apply schema to SQLite (db/custom.db)
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

`bun run scripts/qa-fixtures.ts` seeds 2 B2B inquiries, a wishlist price-drop demo, and 1 pending review so every console has something to show. **Purge before go-live:** `bun run scripts/qa-clean.ts`.

---

## Documentation map

| Doc | Purpose |
|---|---|
| [`docs/README.md`](docs/README.md) | Full docs index |
| [`technical-documentation.md`](technical-documentation.md) | **Tech hub**: architecture, module map, API index, conventions |
| [`business-documentation.md`](business-documentation.md) | Business model, ops flows, GST, vendor integrations, roles |
| [`changelog.md`](changelog.md) | Release-by-release change log |
| [`decisions.md`](decisions.md) | Decision log (conflict resolutions + ADRs, incl. recent) |
| [`help.md`](help.md) | Operator help: how to run the store day-to-day, troubleshooting |
| [`compact.md`](compact.md) | One-file compact context (stack, commands, conventions, state) |
| [`worklog.md`](worklog.md) | Agent work journal (per-round, three-section handover) |
| [`docs/ENVIRONMENT-VARIABLES-GUIDE.md`](docs/ENVIRONMENT-VARIABLES-GUIDE.md) | Every env var explained |
| [`deploy/DEPLOY-STEPS.md`](deploy/DEPLOY-STEPS.md) | Terse VPS deploy runbook |
| [`docs/VPS-SETUP-GUIDE.md`](docs/VPS-SETUP-GUIDE.md) | Phased VPS setup (Docker, TLS, backups) |
| [`docs/PHYSICAL-SERVER-SETUP-GUIDE.md`](docs/PHYSICAL-SERVER-SETUP-GUIDE.md) | Bare-metal in-shop server guide |
| [`docs/RENDER-DEPLOYMENT.md`](docs/RENDER-DEPLOYMENT.md) | Staging preview on Render |
| [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md) | Go-live checklist + smoke test |

## Repo

Official: `https://github.com/OmKardile/patel-5.3.git` (deploy from `main`).

## Rule of the house

**No AI-generated imagery.** Product/seed images come from real files indexed in `prisma/seed-images.json` (local `public/images/seed/**`). Typographic placeholders render when an image is missing.
