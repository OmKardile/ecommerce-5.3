# Decisions (living ADR log)

Older records: conflict resolutions **C1..C12** and **ADR-020/021** live in [`docs/DECISIONS.md`](docs/DECISIONS.md). New decisions from recent rounds are recorded here, newest first.

---

## D-13 · 2026-09-27 · Runtime DB is Neon PostgreSQL — repo provider flipped, scripts made env-proof

**Context**: Owner provisioned a Neon Postgres instance and asked to drop SQLite ("stop using your sqlite db and switch to this") because the site is going to Render in a Node environment for client viewing. The schema was already 100% provider-portable (D-12's JSON-column choice included), so the flip touches configuration, not models.

**Decision**: (1) `prisma/schema.prisma` is now `provider = "postgresql"` in-repo (the Dockerfile sed stays as a documented no-op safety net). (2) **Every DB-touching npm script runs under `env -u DATABASE_URL`** (dev/db:push/db:sync/db:seed) — the sandbox injects a stale `DATABASE_URL=file:…` into the process environment, and OS env beats `.env` files, so without this the app silently talks to the wrong DB. (3) `start` uses plain `node .next/standalone/server.js` (Render Node runtime has no bun). (4) New `db:sync` script (`prisma db push` **without** `--accept-data-loss`) is the Render build step — destructive schema changes fail the deploy loudly instead of eating data. (5) Seed clean-phase now also clears `otp_verifications` + the three stock-monitor tables — Postgres enforces FKs strictly and this keeps reseeds idempotent. (6) `package-lock.json` (lockfileVersion 3, 951 pkgs) committed so Render npm builds are reproducible. SQLite remains a documented fallback (flip provider + `file:` URL).

**Rejected**: keeping SQLite in dev (the owner's deployment target shares the Neon DB; one source of truth removes the recurring sandbox-wipe class of bugs); pooled Neon endpoint now (single long-running server doesn't need it — documented for future scaling); Prisma migrations (repo strategy remains `db push`, unchanged).

## D-12 · 2026-09-27 · Role overhaul: Owner + dynamically-scoped Staff (fixed roles removed)

**Context**: Owner's spec — the store owner has full permissions **including changing their own login and creating other superadmins**; the general `ADMIN` role is removed; **every other operator role becomes Staff whose scope the owner sets at account creation via a wizard** ("which functions u want this staff to have").

**Decision**: (1) **Two operator roles**: `SUPER_ADMIN` (Owner — implicitly passes every gate; can change own email/password with current-password confirmation; can create more superadmins) and `STAFF` (scope lives in a new `User.permissions` JSON column — 15 validated scope keys, one per console section). Legacy fixed roles (`ADMIN`, `INVENTORY_MANAGER`, `ORDER_MANAGER`, `CONTENT_MANAGER`) are deleted from the model; an idempotent `scripts/migrate-legacy-roles.ts` maps existing rows to STAFF + scope. (2) **DB-fresh permission gates**: `requirePermission(scope)` / `requireOwner()` re-read the operator row per request, so scope edits and deactivations apply on the staff's **next request without re-login**; all admin routes moved off fixed role lists. Panel layout mirrors the gates server-side (deep links into non-granted sections bounce to the staff's first granted section; `/admin` dashboard is Owner/scope-less-staff only). (3) **Wizard over forms**: `/admin/staff` (owner-only) has a 3-step creation flow — identity → account type (Staff / Superadmin) + grouped function checkboxes with role presets → review — plus per-account editing (rename, password reset, scope change, deactivate). (4) **Dead-session escape hatch**: `GET /admin/logout` clears stale-but-valid JWTs (user wiped/recreated), breaking the proxy↔layout redirect loop found during E2E.

**Rejected**: keeping a general ADMIN role "for convenience" (the whole point is least-privilege by default); encoding scopes in the JWT (stale until re-login — violates live-edit requirement); storing scopes as a scalar list (SQLite has no scalar lists — JSON column instead); deleting legacy users outright (audit history must keep attributing).

## D-11 · 2026-09-27 · Role display naming: the owner reads "Owner", not "Super Admin"

**Context**: Owner asked "so you have named superadmin as manager (basically store owner who has ALL the permissions)" — their mental model is Owner-first, but the UI rendered `SUPER_ADMIN` as "SUPER ADMIN" and the account as "Platform Superadmin", while the "Manager" word actually belonged to the scoped roles. A route-by-route permission audit (all 75 handlers) also confirmed no admin API is Owner-exclusive today — plain `ADMIN` walks the same surface — so hierarchy was carried by labels and identity (env bootstrap), not by permissions.

**Decision**: **Display-layer rename only; DB role keys frozen** (zero migration). A single `ROLE_LABELS` map in `lib/constants.ts` is the source of truth for human-facing names: SUPER_ADMIN→**Owner**, ADMIN→**Manager**, INVENTORY_MANAGER→Inventory Manager, ORDER_MANAGER→Orders Manager, CONTENT_MANAGER→Content Manager, STAFF→**Floor Staff**, CUSTOMER→Customer. The admin shell (sidebar badge + "Signed in as" chip) renders from the map, and the seeded/bootstrapped owner account is named "Store Owner". Owner-shaped vocabulary now exists so any future Owner-exclusive surface (settings, staff management) can be fenced on top without another naming pass.

**Rejected**: renaming the Prisma role strings (breaking churn across API gates, audits and seed for cosmetics); labelling plain ADMIN "Admin" (keeps the exact manager/owner confusion the owner flagged); per-component label strings instead of one map (drift risk).

## D-10 · 2026-09-27 · Stock monitor: staff observe-and-report, two-man-rule corrections

**Context**: Task 17's research draft (`docs/STOCK-MONITOR-RESEARCH.md`) parked the stock-monitor build pending owner answers to §9. The owner green-lit the build ("okay remember we talked about stock management panel"); since no per-question answers came back, the draft's recommended options were adopted as recorded defaults (§9 of the research doc now logs each decision + rationale).

**Decision**: (1) **Persona** — new `STAFF` role with wall + history + count + proposals only; `ADMIN_ROLES` is unchanged so every existing admin API remains closed to STAFF, and the panel layout fences STAFF sessions to `/admin/stock-monitor*` via an `x-pathname` header the proxy now injects (server-side redirect, not just nav hiding). (2) **Corrections are propose→approve** — employees never mutate stock; approvals (and count-variance applies) write through the SAME transactional `Inventory`+`InventoryMovement` ledger as the inventory console, with the request/line marked applied and audited. WRONG_LOCATION is a delta-0 acknowledgement (flag report, no movement). (3) **Count sessions snapshot expected quantities at open** (scope JSON) so later catalog edits can't skew an in-flight count; scope caps at 500 SKUs. (4) **Kiosk wall mode** ships in v1 (cheap, scenario #4 from research); WhatsApp OUT/LOW alerts and phone-camera barcode scanning stay parked (owner notification rules + hardware scope, not needed for the observe-and-report loop). (5) On-demand counting only — no cadence scheduler.

**Rejected**: reusing `INVENTORY_MANAGER` for juniors (no way to grant view-only); letting the monitor write stock directly (breaks the audit model); a separate bin-location/trend-rollup schema in v1 (v2 candidates, research doc §6).

## D-9 · 2026-09-27 · Dark mode is a manual toggle and a token-only theme

**Context**: Request was "clean trust themed dark mode (on switch)". Two failure modes to avoid: an off-brand dark palette (the stock `.dark` block was warm-brown, not pine), and scattered `dark:` patches as the only mechanism.

**Decision**: (1) **Manual switch only** — `next-themes` with `defaultTheme="light"`, `enableSystem={false}`: the light editorial theme stays the brand's first impression; dark is opt-in via the nav toggle (storefront header ≥sm + mobile drawer "Appearance" row; admin operator header), persisted in localStorage. (2) **Token-first**: the `.dark` block is a re-tuned trust-pine palette — pine-forest `#0e1513` surfaces (never pure black), mist text, mint-pine `#7fc4ab` actions, brightened brass — so every var-driven component adapts with zero per-page work. (3) The only sanctioned `dark:` utilities are recipes for the hand-tinted status/count chips and slight `brightness` dims on cover photography (convention 10 in technical-documentation.md).

**Rejected**: system-preference auto-dark as default (the designed light experience would stop being the first impression); pure-black surfaces (harsh, off-brand); heavy CSS photo filters beyond a slight dim.

## D-8 · 2026-09-27 · Responsive hardening at the primitive level, verified by repeatable sweeps

**Context**: The whole-site responsive audit found the *same class* of bug in several unrelated places: grid/flex items defaulting to `min-width:auto` sized themselves to a wide table's min-content and blew out horizontally at 375px (shipping-policy 641px, admin dashboard 331px, admin/returns 53px).

**Decision**: Fix the class, not just the instances — `ui/card.tsx` base carries `min-w-0`, `ui/tabs.tsx` TabsList carries `max-w-full overflow-x-auto no-scrollbar`, PageShell grids always declare a base `grid-cols-1` with `min-w-0` columns, and bare text runs inside flex `<li>`s get wrapped in `<span>`. Regression safety is a script, not memory: `scripts/responsive-sweep.sh` + `responsive-sweep-admin.sh` measure `documentElement.scrollWidth` on every route × 375/768/1280 and must report 0px (harness note: the working agent-browser syntax is `set viewport`, not `viewport`).

**Rejected**: per-page one-off patches (the same bug reappears on the next page); a global `* { min-width: 0 }` (masks real layout intent and breaks intentional overflow).

## D-7 · 2026-09-27 · Parallax is transform-only, editorial-only, reduced-motion-safe

**Context**: Request was "parallax all over pages". The naive versions are harmful: `background-attachment: fixed` breaks on iOS Safari; animating layout properties forces reflow jank; scroll-jacked libraries add weight; and data-dense surfaces (catalog, cart, admin tables) get slower and harder to scan.

**Decision**: All scroll motion lives in `src/components/motion/parallax.tsx` and is (a) **transform-only** (`translate3d`/`scale` — compositor-driven, no reflow), (b) **overscaled** (backdrops render at 1.15–1.18 so drift never reveals edges), (c) **reduced-motion-safe** (every primitive drops translation/scale and keeps full opacity under `prefers-reduced-motion` — verified under emulation), and (d) **editorial-surfaces-only**: home hero, kit band, promo strip, the PageShell header band on all 9 content pages, and blog covers. Catalog/PDP/cart/checkout/account and all admin panels stay motion-quiet by contract (header comment in the primitives file + convention 9 in technical-documentation.md).

**Rejected**: site-wide parallax including functional surfaces (usability/perf cost, no conversion benefit); `background-attachment: fixed` (iOS breakage); scroll-hijack libraries (Lenis/GSAP-class) — framer-motion `useScroll`/`useTransform` was already in the bundle.

## D-6 · 2026-09-27 · Shipping webhook auth = shared secret, not HMAC

**Context**: `POST /api/webhooks/shipping` (carrier tracking events) accepted unauthenticated POSTs — anyone who guessed an AWB could push `DELIVERED`. Razorpay-style HMAC isn't available: Shiprocket/Delhivery webhooks don't sign bodies the way Razorpay does.

**Decision**: optional shared-secret token (`SHIPPING_WEBHOOK_TOKEN`), presented as `x-webhook-token` header or `?token=`. Set → enforced (401 otherwise). Unset → sandbox posture, accept but `console.warn` per request so production-without-token is visible in logs immediately. Documented in `.env.example`, env guides and PRODUCTION-CHECKLIST.

**Rejected**: IP allow-listing (carrier egress IPs are not stable/documented); no-auth-with-obscurity (the actual hole).

## D-5 · 2026-09-27 · recordAudit self-heals stale sessions instead of failing

**Context**: admin sessions carry `userId`; a DB reseed invalidates them against the `AuditLog.userId` FK → every admin audit write silently vanished (caught by try/catch). Discovered during the reviews round.

**Decision**: on Prisma `P2003`, retry once **without** `userId`, embedding the dropped id in `details.auditUserIdDropped` + `console.warn`. The trail (action/entity/details) matters more than attribution. Sessions self-heal on next login; no per-request DB session validation added (cost not justified while JWTs are signed + httpOnly and every page/API already resolves role).

## D-4 · 2026-09-27 · Reviews are moderated by default; PDP shows approved-only

**Context**: reviews schema already had `isApproved` default false, but no admin surface existed — submissions could never go live.

**Decision**: `/admin/reviews` moderation console (Pending default tab, approve/un-publish/delete, audit-logged). PDP keeps `isApproved: true` filter. Verified-purchase chip renders from `isVerified` (order-derived). Deleted reviews are hard deletes (spam/abuse) with audit trail.

## D-3 · 2026-09-26 · Product cards bind OOS at product level, PDP at variant level

**Context**: variant `inStock` on cards would show "out of stock" for purchasable products (any in-stock variant).

**Decision**: cards = product-level availability (cheapest variant drives price); OOS + notify-me lives on the PDP variant selector. Matches Amazon/Flipkart convention. Future toggle if the owner wants variant-aware cards.

## D-2 · 2026-09-26 · Plain role=tablist button groups over Radix Tabs in admin

**Context**: Radix Tabs activation proved unreproducible under automation QA and duplicated an existing pattern.

**Decision**: all admin tab UIs (orders console, trade desk, GSTR-1, reviews) use the shared plain-button `role="tablist"` pattern. Consistency + testability over component variety.

## D-1 · 2026-09-25 · Phone normalization: strip prefixes only when unambiguous

**Context**: `+91 98765 43210` paste produced `+919198765432` (old code kept the FIRST 10 digits).

**Decision**: `localPhoneFromInput()` strips `91` only when total digits ≥ 12, strips leading `0` only when ≥ 11, then takes the LAST 10. Shared by OTP login, checkout, address book. Guest `track` remains phone-as-credential with hard rate limits + sanitized projections (documented posture).
