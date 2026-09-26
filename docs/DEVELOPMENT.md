# Development guide

Local setup, commands, conventions and QA workflow for working on this codebase.

## Local setup

```bash
bun install            # deps (bun.lock is authoritative)
bun run db:push        # push schema to SQLite (db/custom.db; DATABASE_URL in .env)
bun prisma/seed.ts     # destructive clean + seed of the full demo catalog
bun run dev            # http://localhost:3000 — logs tee'd to dev.log
```

Checkpoints after boot: `/` renders (200), `/api/health` returns `{status:'healthy', db:'up'}`, `/admin` redirects to `/admin/login`, `/account` redirects to `/account/login`.

Seeded credentials:

- Admin: `superadmin@patelnetworks.in` / `patel@admin2026` (SUPER_ADMIN)
- Staff demos: `inventory@patelnetworks.in` / `warehouse@2026`, `orders@patelnetworks.in` / `fulfill@2026`
- Test customer: `+919876543210` (Rajesh Contractor, B2B "Shreeji Electricals")

## Bun commands

| Command | What it does |
| --- | --- |
| `bun run dev` | Next dev server on port 3000, output tee'd to `dev.log` |
| `bun run lint` | ESLint over the repo (must be clean in files you touch) |
| `bunx tsc --noEmit` | TypeScript gate — must report ZERO errors before any handoff (note: `next build` ignores TS errors by config, so this command is the real gate) |
| `bun run db:push` | `prisma db push --accept-data-loss` — schema-as-code, dev-friendly |
| `bun run db:generate` | Regenerate the Prisma client after schema edits |
| `bun prisma/seed.ts` | Full reseed (destructive; see DATABASE.md) |
| `bun run build` | Standalone production build (copies static + public into `.next/standalone`) |
| `bun run start` | Run the standalone server (tees `server.log`) |

## Project structure walkthrough

- `src/app/(store)/**` — storefront pages (home, products, brands, kit-builder, search, cart, checkout, order-success, track, account/**, content pages, blog). Server components read services directly; client islands call `/api/**`.
- `src/app/admin/**` — `/admin/login` plus `admin/(panel)/**` (dashboard, orders, products, categories, brands, inventory, customers, coupons, banners, blog, reports, settings) with its own dark chrome layout.
- `src/app/api/**` — all mutations (see API.md). Route handlers parse Zod, call services, return `{ok,data}|{ok,error}`.
- `src/server/services/**` — domain logic: auth, cart, catalog, coupon, inventory, order, payment, shipping, notification, settings, admin. Services are the only Prisma callers.
- `src/lib/**` — money, gst, pincodes, phone, session, rate-limit, validators, constants, api-helpers, serializers, db singleton.
- `src/components/**` — `ui/` (shadcn, shared), `storefront/`, `admin/`, `content/`.
- `src/store/cart-store.ts` + `cart-hydrator.ts` — Zustand mirror of the server cart for the header badge only (server cart is the source of truth).
- `src/proxy.ts` — edge guards for `/admin/*` and `/account/*`.
- `prisma/schema.prisma`, `prisma/seed.ts`, optional `prisma/seed-images.json`.
- `docs/` — CONTRACTS.md plus the nine docs of this set.

## Ownership rules (CONTRACTS.md — read before editing)

`docs/CONTRACTS.md` is the binding file-ownership map from the multi-agent build:

- Shared lead-owned files (`prisma/schema.prisma`, `src/lib/*`, `src/server/services/*`, root layout/globals, shared storefront components, core API routes, `package.json`) must NOT be edited when fixing a local issue — extend around them or flag in the worklog.
- Each surface has an owner (4-a catalog/kit-builder, 4-b commerce flows/account, 4-c admin, 4-d content). Do not edit another agent's files; new API routes go under the owning agent's namespace (e.g. `/api/checkout/**`, `/api/account/**`, `/api/kit/**`).
- Everyone consumes: existing services, `@/lib/*` helpers, shadcn components from `src/components/ui`, lucide-react icons only.
- Never edit `worklog.md` except to APPEND your own task section using the established template.

## Common tasks

### Add a product with variants/SKUs via admin

1. Log in at `/admin/login` (superadmin) and open Products -> New.
2. Fill name/slug/description, pick brand + category (HSN/GST come from the category), set warranty, COD flag, specs via the key/value repeater, image URLs (+ alt text) via the image repeater.
3. Add at least one variant: name, attribute map (e.g. Resolution 2MP, Lens 3.6mm, Form Factor Bullet), SKU code (unique), MRP and selling price **in paise** (the form converts rupees input), initial stock and low-stock threshold.
4. Save — the create endpoint books the initial stock as a `PURCHASE_RECEIPT` movement automatically.
5. Stock changes on an existing product route through `/api/admin/inventory/adjust` (reason-coded), never a direct field edit.

### Sandbox OTP login flow (customer)

1. POST `/api/auth/otp/request` with `{ "phone": "9876543210" }` — the response includes `simulated:true` in the sandbox.
2. Watch the dev server output (`dev.log`) for the boxed `[SIMULATED SMS] ... OTP: <6 digits>` line.
3. POST `/api/auth/otp/verify` with `{ phone, code }` — response sets the `pn_session` cookie (use a cookie jar in curl). New users may pass `fullName` and are prompted to complete it.

### Admin login via curl

```bash
curl -c jar.txt -X POST localhost:3000/api/admin/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"superadmin@patelnetworks.in","password":"patel@admin2026"}'
# then: curl -b jar.txt localhost:3000/api/admin/orders | head -c 400
```

### Test purchases end to end (QA workflow)

The established QA pattern from the build (cookie jar + curl, then agent-browser):

1. OTP login (above) into `jar.txt` for the test customer.
2. `GET /api/products?perPage=1` to grab a live `skuId`.
3. `POST /api/cart/item` `{skuId, quantity:1}`.
4. `POST /api/orders` with `paymentMethod: "COD"`, a Surat/Gujarat pin (e.g. 395009), `isB2B: true` + `companyName` + `gstin`, and a unique 8+ char `idempotencyKey`. Expect `PN-YYYY-NNNNNN`, status `CONFIRMED`, total = subtotal + Rs 49 COD fee. Re-POST the same body with the SAME key to verify idempotency returns the identical order.
5. Razorpay path: create the order with `RAZORPAY`, then `POST /api/payments/razorpay/order` -> `mock:true`; `POST /api/payments/razorpay/simulate {outcome:'failure'}` (order stays pending) and again with `success` (order -> PAID).
6. Admin side (second cookie jar): transition the order through the FSM (`/api/admin/orders/transition`), book an AWB (`/api/admin/orders/shipment`), capture serials, then `/api/admin/orders/shipment/advance` scans to drive SHIPPED -> OUT_FOR_DELIVERY -> DELIVERED (verifies stock decrement + history).
7. Browser QA with the agent-browser skill: header search, PDP variant chips + pincode checker, kit-builder all 5 steps, cart badge updates, checkout inline OTP login, invoice print sheet, admin consoles. Watch `dev.log` for `[SIMULATED SMS]` / `[SIMULATED WHATSAPP]` and any runtime errors.

Known sandbox quirks to expect while testing:

- Contact API rate limit is 5/10 min per IP and reviews 5/hour per user — 429s here are correct behavior, not bugs.
- Self-service `PUT /api/account/profile` intentionally clears `isB2BVerified` (desk re-verification).
- Kit-builder shows the automatic 5% bundle discount as a summary hint; `bundleDiscount` on the created order is currently 0 (checkout totals are authoritative).
- Reseeding wipes everything including orders created during QA.

## PR-style checklist

Before handing off any change:

- [ ] `bunx tsc --noEmit` — zero errors (project-wide).
- [ ] `bun run lint` — zero errors/warnings in files you touched.
- [ ] Dev server smoke of affected pages/APIs (curl cookie-jar where auth matters); `dev.log` tail free of new runtime errors.
- [ ] Money displayed via `formatINR` only; no client-side money math.
- [ ] New inputs have Zod validation; new writes return the `{ok,data}/{ok,error}` envelope with correct status codes (400/401/403/404/409/429).
- [ ] RBAC respected (customer vs admin cookie, role arrays per SECURITY.md); audit rows for sensitive writes.
- [ ] Design system respected (editorial light theme, Fraunces display, no gradients/neon/emoji; skeleton/empty/toast states).
- [ ] No edits to files you do not own (CONTRACTS.md); shared-file needs flagged in the worklog instead.
- [ ] Docs updated if behavior/contracts changed (this directory), plus an APPEND-only worklog entry with the task template.
