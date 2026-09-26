# Changelog

All notable changes, newest first. One entry per shipped round (see `worklog.md` for the full per-round journal).

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
