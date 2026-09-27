# Changelog

All notable changes, newest first. One entry per shipped round (see `worklog.md` for the full per-round journal).

## 2026-09-27 — Task 22 (role display naming: Owner-first ladder, D-11)

**Change — roles now read the way the shop thinks**
- New `ROLE_LABELS` map (`src/lib/constants.ts`) is the single source of truth for human-facing role names: `SUPER_ADMIN → Owner`, `ADMIN → Manager`, `INVENTORY_MANAGER → Inventory Manager`, `ORDER_MANAGER → Orders Manager`, `CONTENT_MANAGER → Content Manager`, `STAFF → Floor Staff`, `CUSTOMER → Customer`. The admin shell's sidebar badge and "Signed in as" chip render from the map.
- The seeded/bootstrapped owner account renamed "Platform Superadmin" → **"Store Owner"** (`prisma/seed.ts`, auth bootstrap, live DB row via one-off upsert). Credentials unchanged.
- Permission audit (route-by-route over all handlers): **no admin API is Owner-exclusive today** — plain `ADMIN` walks the same surface; the Owner/Manager distinction is currently identity (env bootstrap) + labels. Owner-shaped vocabulary is now in place for any future Owner-only fence (settings, staff management).
- Verified live: Owner session shows "Store Owner · Signed in as Owner" + OWNER badge; Floor Staff keeps its single-entry fence and a live wall (badge FLOOR STAFF); Inventory Manager renders "Signed in as Inventory Manager". Admin sweep stays 0px overflow at 375/768/1280; lint 0 · tsc 0. (Sandbox DB wiped at round start — restored via db:push + db:seed + qa-fixtures per runbook.)

## 2026-09-27 — Task 21 (stock monitor: employee observe-and-report panel, ADR-010)

**Feature — Stock Monitor (`/admin/stock-monitor`)**
- New `STAFF` role (counter/floor staff): observe + report only. Logged in via the normal admin login; the panel layout fences STAFF sessions to `/admin/stock-monitor*` (pathname header from the proxy, redirect otherwise) and the sidebar nav filters to a single entry. Every existing admin API stays closed to STAFF (`ADMIN_ROLES` unchanged) — verified 401s.
- **Stock wall**: state-coloured tiles grouped by category → brand, per-SKU available chips (current − reserved), totals strip (in stock / low / out), search (name/model/SKU/barcode), category+brand filters, 60 s auto-refresh + manual refresh, and a **kiosk "Wall mode"** (chrome-less full-screen board for the shop TV, Esc to exit).
- **SKU dialog**: availability grid (available/physical/reserved), human-phrased movement ledger ("−3 manual adjustment", "+6 received into stock"), and a discrepancy report form — reasons `DAMAGED | MISSING | FOUND | WRONG_LOCATION | OTHER` with reason-validated signed deltas (schema-enforced; WRONG_LOCATION is a note-only flag, delta 0).
- **Count sessions**: open a cycle count scoped to category/brand/all (expected quantities snapshot at open, ≤500 SKUs), steppers identical to the cart qty pattern, bulk submit → `SUBMITTED` with mismatch count. Empty-scope sessions are rejected server-side.
- **Manager side** (Inventory console → new "Requests & counts" tab): approve/reject discrepancy requests (approve with delta ≠ 0 writes a real `MANUAL_ADJUSTMENT` movement atomically; delta 0 acknowledges), review submitted count sheets, one-click **Apply** per variance line (also creates the real movement, marks the line applied), close sessions.
- **Schema**: +3 models — `StockCountSession` (scope snapshot JSON), `StockCountLine` (expected vs counted, variance, applied marker), `StockAdjustmentRequest` (propose→decide, `movementId` backfill). Counts as the stock-monitor layer over `Inventory`/`InventoryMovement` — never a parallel ledger. 38 models total, 75 API route files, 49 pages.
- **APIs** (8 route files, all role-gated): wall projection, SKU history, count-sessions open/list/detail/submit, close, variance apply, requests propose/list, decide. `STOCK_MONITOR_ROLES` = all admins + STAFF; decision endpoints = `INVENTORY_DECISION_ROLES` (matches the inventory console gate). All mutations audited (`STOCK_COUNT_*`, `STOCK_REQUEST_*`).
- **Seed**: `staff@patelnetworks.in / counter@2026` (Counter Staff, STAFF) added to `prisma/seed.ts` and inserted into the live DB.
- Verified end-to-end: API round-trip (STAFF proposes −1 → superadmin approves → stock 14→13 with phrased ledger; count submit 80→82 → manager applies → stock 82) AND the same loop through the browser UI (report → queue badge → approve → variance apply → wall updated); STAFF fence redirects (`/admin/orders`, `/admin/products` → `/admin/stock-monitor`); admin sweep stays 0px overflow at 375/768/1280 with the new route; dark mode adapts via the Task 20 token contract; lint 0 · tsc 0.

## 2026-09-27 — Task 20 (trust-pine dark mode on toggle)

**Feature — dark mode (manual switch)**
- `next-themes` provider (class strategy, `defaultTheme="light"`, no system override, `disableTransitionOnChange`) in the root layout.
- `.dark` palette re-tuned from the stock warm-brown to a **trust-pine night theme**: pine-forest surfaces (`#0e1513` bg, `#131c19` cards — never pure black), mist text `#e6ebe7`, mint-pine action `#7fc4ab`, brightened brass `#d19a4a`, hairline borders `#22302a`, sidebar deepened to `#0b1310` — same hue family as the light brand palette.
- New `ThemeToggle` (Sun/Moon, mounted-gated via `useSyncExternalStore`). Placed in the storefront header actions (≥sm) and the admin operator header; below `sm` it lives in the menu drawer as a labeled "Appearance" row (the standalone icon caused a 23px blowout at 375px — found and fixed).
- Dark adaptations: hand-tinted sage/brass status chips + paper count pills got dark recipes (status-badge, order-console, reviews-console, inquiry-inbox, customer-directory, PDP verified chip); Tailwind `*-100/900` chips → `dark:*-950/60 + *-300`; ParallaxImage/blog covers dim slightly (`dark:brightness-[.88/.9]`).
- Verified: light↔dark round-trip with localStorage persistence across reloads; home / kit band / PDP / admin dashboard / mobile drawer screenshots clean; storefront + admin sweeps stay 0px overflow at 375/768/1280; lint 0 · tsc 0 · 0 console errors. (Sandbox DB wiped again mid-round — restored via db:push + db:seed + qa-fixtures per runbook.)

## 2026-09-27 — Task 18 (parallax + responsive hardening)

**Feature — scroll parallax system**
- New motion primitives (`src/components/motion/parallax.tsx`): `ParallaxImage` (overscale + drift, edge-reveal-proof, hover-scale option), `ScrollDrift` (deterministic global-scroll hero drift + legibility-floor fade), `Drift` (decorative multi-speed layers), plus precomposed `HeroDecor` / `BandDecor`. All transform-only and reduced-motion-safe (verified under emulation).
- Applied: home hero (backdrop + copy lag/fade + SKU-card counter-drift), kit-builder band rings, promo-strip image, PageShell hero band on all 9 content pages, blog article covers. Functional surfaces (catalog, PDP, cart, checkout, account, admin panels) intentionally stay motion-quiet.

**Responsive — whole-site audit + fixes (0 overflow now at 375/768/1280)**
- New repeatable sweeps: `scripts/responsive-sweep.sh` + `responsive-sweep-admin.sh` (43 route×viewport combos; note `agent-browser set viewport` is the working syntax).
- Fixed grid `min-width:auto` blowouts: ContentSection now `grid-cols-1` + `min-w-0` columns (fixed /shipping-policy 641px & /return-policy 404px at 375); `ui/card.tsx` base + `min-w-0` (fixed /admin dashboard 331px); `ui/tabs.tsx` TabsList now scrollable (`max-w-full overflow-x-auto`) (fixed /admin/returns 53px). Bare-text flex `<li>` runs wrapped in `<span>` (shipping-policy).
- Dev-console hygiene: `html { position: relative }` silences framer-motion v12's useScroll static-container warning.

## 2026-09-27 — Task 17 (functional + security audit, docs suite, UI/UX, stock-monitor research)

- **Functional audit**: all 48 pages + 67 API handlers verified (role, auth, payload validation); admin modules exercised end-to-end.
- **Security**: granular RBAC mapped per route; shipping webhook got a shared-secret token gate (`SHIPPING_WEBHOOK_TOKEN`).
- **Docs suite created**: README, changelog, technical-documentation, business-documentation, decisions, help, compact + `docs/STOCK-MONITOR-RESEARCH.md` (schema draft + open questions; implementation parked pending owner confirmation).

## 2026-09-27 — Task 16 (commit 80c4449)

**Feature — Reviews moderation console (`/admin/reviews`)**
- Closed the loop: customer reviews now have an approval surface. `GET/PATCH/DELETE /api/admin/reviews(+)`, Pending/Approved/All tabs, product thumbnails, two-step delete, audit-logged actions (`REVIEW_APPROVE / REVIEW_UNAPPROVE / REVIEW_DELETE`).
- Sidebar "Reviews" nav item + live pending badge; dashboard "Reviews to moderate" pipeline card.
- Demo pending review added to `scripts/qa-fixtures.ts`; `qa-clean.ts` now purges demo inquiries + wishlist demo + fixture reviews at go-live.

**Bug fix — admin audit rows silently lost (systemic, pre-existing)**
- Stale admin sessions (pre-reseed userId) made every admin audit write FK-fail inside `recordAudit`'s try/catch. Hardened: on Prisma `P2003` retry once without `userId`, preserving the dropped id in `details.auditUserIdDropped`. Verified end-to-end with a stale session.

**Security — carrier webhook auth**
- `POST /api/webhooks/shipping` accepted unauthenticated status events. Now requires `x-webhook-token` (or `?token=`) matching `SHIPPING_WEBHOOK_TOKEN` when set; unset = sandbox posture with a loud per-request warning.

**Styling — PDP reviews section**
- Amazon-style summary: big avg + `/ 5` baseline, 5→1 rating-distribution histogram (new `getRatingDistribution` groupBy), verified-purchase chips finally rendered, semantic `<time>`, display-serif titles.

**Small fix** — bare `/wishlist` now 307-redirects to `/account/wishlist`.

## 2026-09-27 — Task 15 (commit a43ba52)

- **Recently-viewed home rail**: shared store module (`pn-recent-v1`), PDP records views, home renders read-only rail, clear-history control everywhere, cross-tab sync.
- **Cart free-shipping progress**: dynamic meter matching checkout math (`Add ₹X more` → "Free shipping unlocked"), `role=progressbar`, tabular numerals on money columns.
- **Bug fix**: PDP review form was hardcoded `loggedIn={false}` — signed-in customers were locked out of writing reviews.
- Styling: qty stepper press feedback, rail card hover language, `.rise-in` entrance.

## 2026-09-26 — Task 14 (commit 7272917)

- **GSTR-1 period modes**: Month | Quarter (Indian fiscal, QRMP) | Custom range with client+server guards (≤366 days, `to ≥ from`); 6th totals tile "B2B · B2C"; skeleton shimmer + icon empty state.

## 2026-09-26 — Task 13 (commits 0527ed3, 739cab2)

- **patel-5.2 doc parity port**: `docs/RENDER-DEPLOYMENT.md`, `docs/VPS-SETUP-GUIDE.md`, `docs/PHYSICAL-SERVER-SETUP-GUIDE.md`, `docs/ENVIRONMENT-VARIABLES-GUIDE.md`, `docs/PRODUCTION-CHECKLIST.md`. Every 5.2-only variable has an explicit 5.3 disposition (used / renamed / do-not-set).
- **Admin order drawer deep-links**: `tel:`, `wa.me`, Google Maps, PDP links per line item; `productSlug` flattened server-side; Radix a11y `SheetTitle`.

## 2026-09-26 — Task 12

- `.env.example` committed (gitignored `.env*` with `!.env.example` opt-in) + `deploy/ENV-SETUP.md` runbook: env flow, fill order, credential sources, sim→live verification, rotation & hygiene, symptom→variable map, variable→code provenance.

## 2026-09-26 — Task 11 (commit 592dbf6)

- **Compare hard-load fix**: `CompareIdsBridge` reconciles `?ids=` with the persisted store (stale ids pruned, saved selection promoted to URL).
- **Reports period switcher**: 7/30/90/180-day parameterized commercial reports.
- **Inventory demo states**: seeded OUT/LOW rows with `MANUAL_ADJUSTMENT` movement provenance.
- Gallery crossfade + active-thumb ring, compare sticky-column depth shadow, a11y chart label.

## 2026-09-25 — Task 10 (commit 6d5ac06)

- **Trade Desk** (`/admin/inquiries`): B2B inbox with forward-only FSM `NEW → CONTACTED → CLOSED`, `handledAt` stamp, notes, `tel:`/`wa.me` deep links, GSTIN chips, audit trail; dashboard + badge integration.
- **Wishlist price-drop tracking**: `priceAtAddPaise` snapshot, "Dropped ₹X since saved" badge, seeded demo.
- **Bug fix (+91 paste)**: shared `localPhoneFromInput()` — `+91 98765 43210` no longer becomes `+919198765432` (previously kept the FIRST 10 digits); fixed in OTP login, checkout, address book.
- Recovery tooling: `bun run db:seed` one-command restore, `postinstall: prisma generate` guard.

## 2026-09-25 — Task 9 (commit f138cee)

- **RMA courier-inward closure**: returns FSM completes with carrier pick-up inward + QC decision.
- PDP back-in-stock ribbon (14-day window after restock), webhook `DELIVERED` FSM fix, footer branding (MegaTechzy + staff console link).

## Earlier (Tasks 0–8)

- Greenfield rebuild: requirements extraction from patel-5.2/5.3 specs, 35-model portable schema, storefront (catalog, PDP, cart, checkout, OTP auth, track, compare, kit-builder), 13-module admin console, payments (Razorpay live + deterministic simulation), shipping (Shiprocket/Delhivery live + deterministic AWBs), notifications (SMS/WhatsApp dual-mode), reports + GSTR-1 CSV, RBAC (5 roles), audit log, deployment suite (Docker Compose + Nginx + backups).
