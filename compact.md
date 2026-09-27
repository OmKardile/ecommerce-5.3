# Compact — one-file project context

Last updated: 2026-09-27 (Task 21 — stock monitor shipped). Keep under ~200 lines. Full map in `README.md`.

## Identity
- **Patel Networks / MegaTech** — CCTV & networking hardware e-commerce, Surat (GSTIN 24AAACP1234F1Z8).
- Greenfield rebuild of patel-5.2 → **patel-5.3** (`github.com/OmKardile/patel-5.3.git`, deploy from `main`).
- Sandbox: `/home/z/my-project`, Next.js 16 + bun, port 3000 only. **No AI-generated images** (real files via `prisma/seed-images.json`).

## Stack & commands
- Next.js 16 App Router · TS strict · Tailwind 4 · shadcn/ui · Prisma 6 · SQLite dev / PostgreSQL prod · Zustand islands.
- `bun run dev` · `bun run lint` · `bunx tsc --noEmit` · `bun run db:push` · `bun run db:seed` (restore) · `bun run scripts/qa-fixtures.ts` (demo data) · `bun run scripts/qa-clean.ts` (purge before go-live) · `bash scripts/responsive-sweep.sh` + `responsive-sweep-admin.sh` (0px-overflow gate @375/768/1280) · health: `GET /api/health`.

## Non-negotiable conventions
1. Money = **integer paise** everywhere. 2. API envelope `{ok,data}` via `ok()/fail()`. 3. **Route handlers for all mutations** (Zod from `lib/validators`). 4. FSMs server-enforced forward-only + `recordAudit`. 5. SQLite `contains` only — **no `mode:'insensitive'`**. 6. Client islands use plain `role=tablist` button groups (not Radix Tabs). 7. All admin mutations role-guarded (`requireRole`/`requireAnyAdmin`). 8. Phone normalization via `localPhoneFromInput()`. 9. **Motion contract**: parallax only via `components/motion/parallax.tsx` — transform-only, reduced-motion-safe, editorial surfaces only (heroes/bands/covers); catalog/PDP/cart/checkout/account/admin stay motion-quiet. Responsive: `ui/Card` carries `min-w-0`, `ui/TabsList` scrolls, PageShell grids declare base `grid-cols-1`. 10. **Theme contract**: light is brand-default; dark is manual-only via the nav toggle (persisted localStorage) and token-first through the `.dark` trust-pine block in globals.css — `dark:` utilities are sanctioned only for hand-tinted chips and slight photo dims.

## Scale
38 Prisma models · 49 pages (24 storefront + 16 admin + auth) · 75 API route files · 6 console roles (5 admin + STAFF) · dual-mode integrations (Razorpay / Shiprocket-Delhivery / Fast2SMS / WhatsApp Cloud API — live with creds, deterministic simulation without).

## State (end of Task 21)
- **Stock monitor (ADR-010)**: STAFF observe-and-report layer — `/admin/stock-monitor` wall (state tiles, search/filters, 60 s auto-refresh, kiosk Wall mode) + SKU dialog (phrased ledger, discrepancy reports) + count sessions (scope snapshot, bulk submit); manager side = Inventory "Requests & counts" tab (approve/reject, one-click variance apply, close). STAFF sessions fenced to `/admin/stock-monitor*` via proxy pathname header; all corrections flow through the real `InventoryMovement` ledger, audited.
- **Dark mode**: manual toggle — storefront header (≥sm) + mobile drawer "Appearance" row + admin operator header; token-driven trust-pine night palette (`#0e1513` pine-forest surfaces, mint `#7fc4ab` actions, never pure black); persisted across reloads.
- **Motion & responsive**: parallax on home hero / kit band / promo strip / 9 content-page headers / blog covers (reduced-motion-safe, transform-only); whole site measures 0px horizontal overflow at 375/768/1280 (sweep-verified; Card/TabsList/PageShell hardened).
- **Storefront**: home (featured, recent rail, promos), catalog + search, PDP (gallery, variants, reviews w/ histogram + moderation, notify-me, restock ribbon), cart (free-ship meter), checkout (GSTIN, COD/Razorpay), account (orders, invoice, addresses, wishlist w/ price-drop), track, compare, kit-builder, blog, brands, policies.
- **Admin console**: Dashboard · Orders (drawer + deep links + serials) · Returns & DOA (full RMA) · Products · Categories · Brands · Inventory (adjust/import/export/history, OUT/LOW demo states, **Requests & counts tab**) · **Stock Monitor (STAFF-facing wall/count/reports)** · Customers · Trade Desk (B2B FSM) · **Reviews (moderation queue)** · Coupons · Banners · Blog · Reports (7/30/90/180 + GSTR-1 month/quarter/custom) · Settings.
- **Auth/security**: OTP (per-phone+IP limits, attempt caps), admin login rate-limited, scrypt passwords, httpOnly JWT cookies, role isolation on login, Razorpay HMAC webhook, WhatsApp verify token, **shipping webhook token-gated (`SHIPPING_WEBHOOK_TOKEN`)**, audit log self-heals stale sessions (`auditUserIdDropped`).
- **Docs**: README + technical/business/decisions/help/changelog/compact + docs/ (12 deep-dives incl. 5.2-parity deploy suite) + deploy/ (runbook, ENV-SETUP, backup.sh).
- **QA posture**: lint 0 / tsc 0 / health db:up / agent-browser E2E green / 0 console errors every round / 0px overflow 375-768-1280 (sweep-verified).

## Credentials (sandbox only)
- Admin: `superadmin@patelnetworks.in` / `patel@admin2026` · Staff (stock monitor): `staff@patelnetworks.in` / `counter@2026` · Customer: `+919876543210` (OTP in `dev.log`).

## Known-posture decisions (short)
Cards show product-level OOS (PDP handles variants) · reviews moderated-by-default · plain tabs over Radix · audit FK retry over session revalidation · shipping webhook token optional-but-loud · `/wishlist` → `/account/wishlist` · staff observe-and-report, two-man-rule stock corrections (D-10) · manual-toggle token-only dark mode (D-9).

## Parking lot (researched, not built)
- Stock-monitor **v2 candidates**: BinLocation (rack/shelf codes), StockSnapshot trend rollups, phone-camera barcode scanning, WhatsApp alerts on OUT/LOW (owner routing/consent needed) — design record in `docs/STOCK-MONITOR-RESEARCH.md`.
- Per-product image overrides (waiting on owner's brand images) · compare-store `pn-compare-v2` bump only if snapshot schema changes · home category-card staggered Reveal entrance (deferred from Task 18 parallax scope).
