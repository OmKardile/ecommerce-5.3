# Changelog

All notable changes, newest first. One entry per shipped round (see `worklog.md` for the full per-round journal).

## 2026-09-30 — Task 42 (contact-form E2E walkthrough + trade-desk reference visibility fix)

**Change — "how the contact form is working?"** — traced and live-verified the full inquiry pipeline, and fixed one real gap found on the way.

- **E2E demo (agent-browser)**: submitted a labeled QA inquiry through /contact → success card ("Inquiry received · REFERENCE LOGGED"); owner sign-in → /admin/inquiries shows it atop the New tab with tel/WhatsApp links; trade-desk note + "Mark contacted" → PATCH 200, row moved New 6→5, CONTACTED badge, "First handled" stamp, audit row `INQUIRY_STATUS {from: NEW, to: CONTACTED, note}` recorded. (Along the way: the sandbox had wiped the SQLite DB — re-seeded via `bun run db:seed`; /tmp/devup.sh keeper recreated.)
- **Fix — unresolvable product references were invisible to the desk**: the intake API keeps free-text references (id/slug/SKU resolution falls back to raw text), and the admin GET returned only the resolved product — so showcase-sourced enquiries ("Product reference: Platform enquiry (showcase page)") showed no origin. Now the GET passes `productRef` through when unresolved, and the inbox card renders "Re: <raw reference>" in place of the product deep-link. Resolvable references keep the existing "Re: <product name>" PDP link.
- **Harness note**: agent-browser coordinate clicks on the inbox were intercepted by the sticky admin header (JS clicks fine) — test artifact, not a product bug.
- **Verified**: lint 0 · tsc 0; browser — reference line renders on the QA card, pipeline move + note + handledAt + audit all confirmed via UI and DB.

## 2026-09-30 — Task 41 (attribution restored minus the word "personal" + showcase CTAs → enquiry-first)

Two-part round: (a) a correction of Task 40, (b) the pending showcase CTA rework.

**Part A — attribution correction ("i didnt told u to remove personal references i just told u to remove the word 'personal'")** — Task 40 over-removed. Every Omkar Kardile / omkardile.is-a.dev attribution from the Task 37 state is restored, with only the word "personal" dropped ("A personal project by Omkar Kardile" → "A project by Omkar Kardile"): `/showcase` metadata title + hero eyebrow link + designer line; storefront footer "— authored by Omkar Kardile" link; `/index-help.html` lede + footer credits; README + docs/README blockquotes and "The designer's pitch" rows; business-pitch.md "designed end-to-end by one person" + closing credit line; the five decorated doc bylines (VPS-SETUP, PRODUCTION-CHECKLIST, RENDER-DEPLOYMENT, PHYSICAL-SERVER, ENV-VARS-GUIDE) → "A project — authored by Omkar Kardile"; docs/DEPLOYMENT.md agent-process status note. Remaining `personal` hits in the repo are ordinary English (GitHub Personal Access Tokens, personal-name orders, Sensitive Personal Data, "personalize").

**Part B — showcase CTAs now pitch the enquiry, not the catalog ("why the hell showcase page having those unrelated CTA?")** — hero primary → **"Enquire now"** → `/contact?product=Platform enquiry (showcase page)` (prefills the trade-desk form's reference field); hero secondary → "Open the live storefront" (demo proof; replaces "Walk the storefront", drops "Build a CCTV kit"); the three-faces console cards swap their private `/admin/login` sign-in links for "Request a walkthrough" → `/contact` prefilled per console; closing band rebuilt enquiry-first — "Enquire now" + "WhatsApp the desk" (wa.me with a prefilled message) + tap-to-call +91 98765 43210 + a mailto footnote ("the desk replies within one working day"); the developer-flavored docs/ROUTES.md credentials note is gone, and "Track a demo order" / "Meet the shop" buttons are dropped (demo evidence survives as an inline "fully browsable" link to /products).

**Verified**: agent-browser — showcase title "The Platform — a project by Omkar Kardile", eyebrow, hero CTAs, faces cards and closing band all render; "Enquire now" click → `/contact` with "Product reference: Platform enquiry (showcase page)" prefilled in the form; footer shows "authored by Omkar Kardile / MegaTechzy — Patel Networks"; light + dark pine-band buttons all visible (ghost pattern holds); 375px & 1280px overflow 0; full sweep 108/108 (27 routes × 4 viewports); lint 0 · tsc 0.

## 2026-09-28 — Task 40 (de-personalization: "by Omkar" attribution removed everywhere)

**Change — "remove personal prefix from the project .. by omkar — from everywhere"**
- **Code surfaces**: `/showcase` metadata title → "The Platform — one system for the counter, stockroom and back office"; hero eyebrow link ("A personal project by Omkar Kardile ↗" → omkardile.is-a.dev) replaced with a neutral `Patel Networks · Surat` label-caps eyebrow; the designer line → "Designed end-to-end — typography, color, motion, flows and the data model behind them." Storefront footer keeps the MegaTechzy branding but drops "— authored by Omkar Kardile (link)". `/index-help.html` lede + footer attribution sentences removed.
- **Docs**: README + docs/README "A personal project by Omkar Kardile" blockquotes deleted; the five decorated doc bylines (VPS-SETUP, PRODUCTION-CHECKLIST, RENDER-DEPLOYMENT, PHYSICAL-SERVER, ENV-VARS-GUIDE) reduced to the neutral "Patel Networks / MegaTechzy" identity line; business-pitch.md closing line de-named ("designed & built for Patel Networks, Surat") + "by one person" → "as one whole"; README/docs-README pitch rows renamed "The designer's pitch" → "The platform pitch"; stale agent-process status note in docs/DEPLOYMENT.md neutralized.
- **Kept (operational, not attribution)**: the GitHub repo URLs (`github.com/OmKardile/patel-5.3`) in deploy docs/README — they are where the code lives and deploy instructions depend on them. History files (worklog/changelog) untouched by design.
- **Verified**: repo-wide rg for `omkar|omkardile.is-a.dev|personal project|authored by` → only repo URLs remain; agent-browser — showcase (title/eyebrow/zero portfolio links), footer (no Omkar, MegaTechzy intact), index-help clean; lint 0 · tsc 0; overflow 0px at 320/375/1280 on all three edited surfaces.

## 2026-09-28 — Task 39 (review & iterate: QA-driven bug batch + UX pass)

**Change — "review and iterate, check if anything is remaining; test and debug loop; check for any space for ux improvements"**
- **QA loop**: two agent-browser sweeps (storefront golden path + the full 17-section admin console as owner AND scoped staff). Verdict: admin airtight (staff scoping bounces all blocked routes; 182 orders / 51 customers / 23 SKUs / seed counts reconcile); storefront core flows all functional. Found 8 real issues → all fixed:
  1. **/track phone paste bug (medium)** — pasting `+91 98765 03699` silently became `9198765036` (10-digit cap kept the country-code prefix) → guaranteed "mobile does not match" failures. Now uses the existing `localPhoneFromInput()` helper (the same one checkout/OTP/address-book already used — track was the last holdout).
  2. **Duplicated `<title>` brand** — 19 surfaces rendered like "… | Patel Networks · Patel Networks" (14 static metadata titles + track/login layouts + 3 not-found fallbacks + PDP/blog-dynamic titles). All suffixes stripped; the root layout template (`%s · Patel Networks`) is the single brand-appender.
  3. **Kit-builder Next bypass** — step 1 advanced with no recorder picked (step indicator mislead, guard message as a dead end). Next now disables per-step with an inline hint ("Pick a recorder type and channel capacity first" / "Add at least one camera to continue").
  4. **Kit panel pre-seed** — the BNC/RJ45 connector pack showed in "YOUR KIT" before any recorder existed. Connector now enters the kit only once a recorder is in it.
  5. **Radix a11y warning** — header mobile Sheet lacked a DialogDescription → added `sr-only` SheetDescription (fresh-session console clean).
  6. **"1 items" pluralization** — header cart aria-label + cart & checkout subtotal lines now singularize.
  7. **Admin dashboard pipeline labels** — "Shipped 20 vs tabs 26" confusion: chips renamed to the exact stages they aggregate ("Confirmed → Packed", "Shipped / OFD") + a caption stating counts are all-time, not the 30-day KPI window.
  8. **Seed address correlation** — orders like "Delhi, Delhi — 395002" (a Surat PIN): the CITIES table now carries its matching PIN per city (Surat×5 weighted, Navsari/Bhavnagar/Bharuch/Vapi/Nashik added), reseed verified (8/8 sampled orders city↔PIN consistent).
- **UX additions**: `/order-success` bare-hit rescue page (real 404 traffic observed in dev.log — checkout always links the numbered route, scanners don't) with Track/Account CTAs; `/track?order=PN-…` deep-link prefill (wired from the rescue page); desktop announcement bar gains a "Track order" link (Track was footer/mobile-only before); cart empty state gains a "Build a full kit instead" secondary CTA.
- **Sandbox**: session restart wiped `.env` (Neon URL unrecoverable from the sandbox) — local dev restored via the documented SQLite fallback (provider flip + seed), guarded with `git update-index --skip-worktree prisma/schema.prisma` so the repo keeps `postgresql` for Render. Production (Render + Neon) unaffected. File-mode noise (644→755) normalized.
- **Verified**: agent-browser — `+91` paste → `9876503699`; all sampled titles single-brand; kit Next disabled + hint; kit panel empty until recorder; rescue page + prefill; header track link; cart add→badge→line→free-ship meter; fresh-session console **zero warnings**; full responsive sweep **108/108 zero overflow** (27 routes × 4 viewports — added `/order-success`, `/order-success/PN-…`, `/track?order=…`); **lint 0 · tsc 0**.

## 2026-09-28 — Task 38 (white-button fix + deeper responsive pass incl. 320px)

**Change — "some buttons are white by default and gets normal when on hover; fix them" + "make the showcase / pitching / help pages strictly and very perfectly responsive" (round 2)**
- **White buttons**: reproduced in light mode — the two `variant="outline"` CTAs on `/showcase`'s pine CTA band ("Track a demo order", "Meet the shop") inherited `bg-background` (white) from the shadcn outline variant and carried `text-brand-foreground` (near-white) → **white pill, invisible white text**. Fix: `bg-transparent` in className (tailwind-merge drops the variant's `bg-background`; `dark:bg-input/30` untouched — dark mode verified unchanged). Now: transparent ghost buttons on the pine band in light, same as before in dark. Swept the codebase for the same pattern (outline/ghost inside `bg-brand` bands) — no other occurrences.
- **Responsive round 2**: added a **320px small-phone viewport** to `scripts/responsive-sweep.sh` (now 26 routes × **4** viewports = 104 checks). First run exposed two real defects: (1) the storefront **header** min-width ≈ 358px — the icon cluster + wordmark subline pushed every page +38px at 320 → at ≤374px the wordmark subline now hides, the title drops to 19px and the row gap tightens (icons kept at 36px); (2) `index-help.html`'s **wide tables** (349px) widened the page +49px → `table.simple` becomes a block-level `overflow-x:auto` scroller below 520px. Note: the sweep's "worst element" heuristic can point at internal scrollers (header rail, table wrappers) — the real pusher was found by walking unclipped elements' bounding rects.
- **Dev-env lesson**: after the header edit, Turbopack's incremental Tailwind pipeline generated the new `max-[374px]:gap-2` but silently dropped `max-[374px]:text-[19px]` / `max-[374px]:hidden` (classes in DOM, no CSS rule, computed styles unchanged) — `touch globals.css` didn't help; a **full `.next` wipe + restart** regenerated all rules. If new utility variants don't apply, don't trust the incremental cache: restart clean.
- **Verified (agent-browser)**: light-mode band buttons `rgba(0,0,0,0)` + white text; dark mode `dark:bg-input/30` preserved; full sweep **104/104 zero overflow**; 320px screenshots eyeballed (compact header, wrapped eyebrow, scrollable rail); **lint 0 · tsc 0**.

## 2026-09-28 — Task 37 (strict responsive pass + MegaTechzy rebrand & personal-project attribution)

**Change — "make the showcase / pitching / help pages strictly and very perfectly responsive" + "rename everything related to mega tech to MegaTechzy; only keep that megatechzy and related at footer of storefront; other else make this as my personal project (omkardile.is-a.dev)"**
- **Responsive**: full overflow sweep of `/showcase` + `/index-help.html` at 375/768/1280 passed (help page already had viewport meta, clamp() type, scrollable nav, pan/zoom canvas, tables ≤349px at 375). One real defect found & fixed: the `/showcase` palette swatch grid's border-neutralizers were `sm:`-prefixed, so at <640px the right column/bottom row doubled borders — rebuilt with the hairline-gap technique (`gap-px bg-border/60` + plain `bg-card` cells), correct at every width. Both pages added to `scripts/responsive-sweep.sh` (now **26 routes × 3 viewports**, full run: zero overflow).
- **Rebrand**: every bare "MegaTech" → **"MegaTechzy"** (lookahead-safe rename across 2 code surfaces, 6 doc titles/intros/bylines, 5 deploy config headers, both prisma artifact headers; `docs/README.md` legal name corrected to match `STORE.legalName`). History files (changelog/worklog) untouched.
- **Personal-project attribution (brand display → footer-only)**: `/showcase` metadata title + hero eyebrow + designer line now credit **Omkar Kardile** with links to <https://omkardile.is-a.dev/>; `/index-help.html` h1 de-branded + lede/footer attributed with links; storefront footer **keeps** the MegaTechzy branding (per instruction) with the author name now a portfolio link; README + docs/README gained attribution lines; five decorated doc bylines link the portfolio. Legal-name usages ("Patel Networks (MegaTechzy)") intentionally kept as seller identity.
- **Verified (agent-browser)**: showcase title/eyebrow/designer-line + swatch hairlines confirmed (light & dark); index-help h1/lede/footer links confirmed; footer author link confirmed; **lint 0 · tsc 0**.

## 2026-09-28 — Task 36 (schema.dbml → prisma folder, next to schema.prisma)

**Change — "that dbml code file also store it in prisma folder"**
- **Moved**: `scripts/schema.dbml` → **`prisma/schema.dbml`** — the DBML now lives beside `schema.prisma`, where anyone touching the data model will look. Single canonical copy (kept one file instead of a duplicate in both folders — duplicates drift silently).
- **`scripts/blueprint-erd.ts`** updated (header comment + `DBML` path constant) to read from the new location.
- **Verified**: regeneration smoke test from the new path produces the **byte-identical** SVG (9036×4210 pt · 38 tables · 345,580 bytes, md5 match); `/schema-diagram.svg` serves 200 from the dev server; zero live references to the old path remain; **lint 0 · tsc 0**.

## 2026-09-28 — Task 35 (the pitch kit: business-pitch.md + the /showcase page)

**Change — "create one business related md file … basically like pitching or impressing .md and also one html directly viewable through some route with some great ui" (local e-commerce framing: "you know this is a local e commerce site right")**
- **New `business-pitch.md`** (repo root, next to its operational sibling `business-documentation.md`): the designer's voice pitch — 30-second elevator; a "reality of the trade → what the platform does" table grounded in the *local* Surat hardware business (walk-in trust, installers on phones, GSTIN contractors, kit compatibility, 4 PM dispatch cutoff, non-technical counter staff); the honest 7-point "what makes it special" list; a three-audience feature tour (customers / team 17-section console / owner cockpit); the design story (warm-paper + deep-pine rationale, Fraunces/Inter, dark mode as a second design, motion with manners, a11y in the base, no-AI-imagery rule); "what you can achieve with it" playbooks (week one → quarter one → month-end → scale); a proof section (live URL, six-month deterministic demo history, quality gates); the 5-stop pitch route for a live meeting; and a business-buyer FAQ (data ownership, staff turnover, payments/couriers, GST, running cost, vs marketplace). No credentials embedded — pointers to `docs/ROUTES.md` instead.
- **New public route `/showcase`** (`src/app/(store)/showcase/page.tsx`) — the designed visual pitch, inheriting the storefront chrome: editorial Fraunces hero; a deep-pine stats band (38 models · 50+ screens · 78 endpoints · 13-state lifecycle · 2 themes · 100% paise-exact); "one system, three faces" cards; eight storefront superpowers; a pine operations band with the 8-step pipeline chip rail + cancel/return branch and the fulfillment/stock/books trio; the design-story section with real palette swatches (#faf9f6, #1a3c34, #7fc4ab, #b45309) and a Fraunces/Inter type specimen card; four business-outcome cards; closing CTA band. Static (no DB calls), `metadata` set, `rise-in` entrance, BandDecor continuity, no indigo/blue — token-only styling.
- **Wiring**: footer "Company" column gains **"Our Platform" → `/showcase`** (discoverable from every storefront page); `/showcase` added to `sitemap.ts` statics.
- **Cross-links**: `README.md` docs map + `docs/README.md` index gain `business-pitch.md` rows; `docs/ROUTES.md` storefront table gains `/showcase`; `business-documentation.md` header note points to the pitch (and vice versa).
- **Verified (agent-browser)**: `/showcase` 200 — all sections in the a11y tree; hero CTA navigates to `/products`; footer link present; dark mode keeps brand bands deep pine (`rgb(20,42,36)` = #142a24) with mist text; horizontal overflow **0 px** at both 375 px and 1280 px; dev.log clean; **lint 0 · tsc 0**.

## 2026-09-28 — Task 34 (blueprint page → /index-help.html; developer tool guides removed for production)

**Change — "REMOVE ANY SUCH GUIDE OR TEMPLATE THINGS AS THIS IS GONNA BE END PRODUCTION APP" + "change the blueprint/index.html to just /index-help.html"**
- **Moved**: `public/blueprint/index.html` → **`public/index-help.html`** (served at `/index-help.html`); `schema-diagram.svg` → `public/schema-diagram.svg` (the page's relative canvas links keep working); `schema.dbml` → `scripts/schema.dbml` (dev-tooling input, no longer served from the site). The `public/blueprint/` folder is gone; the old URL now 404s.
- **Removed all developer-facing guide/template content** from the page: the entire **Section 7 "Online tools"** (dbdiagram.io walkthrough, dbdocs.io push instructions, Eraser/drawSQL/Mermaid starters, DBeaver notes), the "Want this as a picture you can zoom? Go to dbdiagram.io… paste /blueprint/schema.dbml" callout, the "Client-ready pack in 2 minutes" callout, all dbdocs.io links, the "regenerates from schema.dbml with bun scripts/blueprint-erd.ts" notes, and the "Online tools" nav item (page is now 6 sections) — plus the dead `.tool`/`details.code` CSS. What remains is pure product explanation: system flow, 38-table database with zoomable canvas, roles & scopes, order lifecycle, routes.
- **Rebranded on-page**: title/nav/eyebrow/footer now say "System Guide" (v1.2); the routes section self-reference updated to `/index-help`.
- **Wired up**: owner-only admin sidebar link → `/index-help.html` (label "System guide"); `scripts/blueprint-erd.ts` paths updated (reads `scripts/schema.dbml`, writes `public/schema-diagram.svg` — regeneration smoke-tested, same 9036×4210 output).
- **Docs brought up to date**: `help.md` blueprint section rewritten (new URL, tool-guide/dbdocs paragraphs deleted), `docs/ROUTES.md` gains the `/index-help` row. Live docs contain zero references to the old path or the external tool guides.
- **Verified (agent-browser)**: `/index-help.html` 200 with 6 sections + canvas SVG loaded; `/blueprint/index.html` **404**; SVG 200; owner login → sidebar shows "System guide" → `/index-help.html`; lint 0 · tsc 0. Deploy note: pushing `main` auto-deploys the new path to Render.

## 2026-09-28 — Task 33 (routes cheat sheet: docs/ROUTES.md — logins + every URL in one file)

**Docs — "which is the file with all the info about routes and all; i cant remember which route was for staff login" → new permanent cheat sheet**
- **The answer**: staff login is **`/admin/login`** — the same password page as the owner; the account's role decides the landing page (staff persona `staff@patelnetworks.in` / `counter@2026` → auto-lands on the Stock Monitor panel). API handlers were already catalogued in `docs/API.md`, but no single page-route reference existed → **created `docs/ROUTES.md`**.
- Contents: §1 logins (operator credentials table with all 5 seeded accounts + landing pages, DB-fresh scope note, `/admin/logout` escape hatch, customer OTP login `/account/login` + `/login` alias, test customer `+91 98765 43210`, guest `/track`); §2 storefront pages; §3 customer account pages; §4 admin console access map (owner-only `/admin/staff`, staff home `/admin/stock-monitor`); §5 API group map pointing into `API.md`.
- Cross-linked from: root `README.md` docs map, `docs/README.md` index (row 2 — deliberately prominent), and `help.md` "First 5 minutes" login step.

## 2026-09-28 — Task 32 (skeleton loading colour: orange → grey)

**Fix — "change the skeleton loading colour to grey; why its orange??"**
- **Cause**: the shared shadcn `<Skeleton>` (`src/components/ui/skeleton.tsx`) rendered `bg-accent`, and `--accent` is the brand's **brass** accent (`#b45309` light = amber-orange, `#d19a4a` dark) — so every loading skeleton pulsed orange: cart, checkout, the `products`/`account/orders` route-loading screens, and the sidebar primitive.
- **Fix**: `bg-accent` → `bg-muted` in the Skeleton component — neutral grey (`#f1eee7` light / `#17211d` dark). This also unifies the Skeleton with the two hand-rolled pulse blocks (GSTR-1 card, account login) that already used `bg-muted`. The `--accent` token itself is untouched — it's correct for badges/links/highlights (e.g. the product discount chips stay brass by design).
- **Verified (agent-browser)**: probe element with the Skeleton's exact classes resolves to grey in both themes (light `rgb(241,238,231)`, dark `rgb(23,33,29)`); `/products` renders 14 products from Neon with no error boundary; lint 0.
- **Env incident (sandbox, not code)**: mid-round the sandbox `.env` had been overwritten to the single stale line `DATABASE_URL=file:…/custom.db` → Prisma failed with "the URL must start with the protocol `postgresql://`" (app error boundary). Restored the Neon URL in `.env` (gitignored — not a git change) and restarted via the keeper; health `{db:"up"}`. **Future rounds: if Prisma throws the URL-protocol validation error, check `.env` content first — the with-env shim is fine; it sources whatever is in the file.**

## 2026-09-28 — Task 31 (incident record: the go-live HTTP 502, documented end-to-end)

**Docs — "Render's proxy could not successfully reach the running Next.js server" now has a dedicated post-mortem**
- New **`docs/incidents/2026-09-27-render-502-proxy-unreachable.md`** — the full story of the 502 that greeted the first green Render deploy: the owner's actual 6-step timeline (P1012 build failure as a separate incident → green build → 502 → dashboard Start-Command change → live → Task 29 back-port); the root-cause mechanics with a proxy-hop diagram (Render injects `HOSTNAME` = service hostname; Next standalone binds `process.env.HOSTNAME`; the edge proxy can't reach that interface → 502); a symptom-vs-reality table explaining how `✓ Ready in 802ms` + "Your service is live 🎉" coexisted with a dead site; why `bun` was incidental and `HOSTNAME=0.0.0.0 PORT=$PORT` was the fix; why the trap exists only on the Render Node runtime (dev binds broadly, Docker pinned `HOSTNAME` since Task 3-b); a recurrence playbook (Ready+502 = reachability, no Ready = boot; split the hop with an in-instance curl); lessons learned; and a verification record.
- Cross-linked from: `deploy/RENDER-STEPS.md` (502 troubleshooting row), `docs/RENDER-DEPLOYMENT.md` (status banner), `docs/README.md` + root `README.md` (incidents row in both doc maps), and **D-14** in `decisions.md`.
- No code changes. Live site re-verified healthy while documenting: `/api/health` → 200 `{"db":"up"}`, homepage 200 (~1.6 s).

## 2026-09-27 — Task 30 (volumetric seed: realistic operating history in every one of the 38 tables)

**Change — "seed a lot of data in neon db in every table" (Neon re-seeded; live site shows it immediately)**
- `prisma/seed.ts` gains a deterministic volumetric phase (**mulberry32 PRNG → identical dataset on every re-seed**, stable for screenshots/QA). New data, on top of the existing catalog: **51 buyers** (50 generated + the B2B test customer) with 106 addresses (Surat-weighted Gujarat + pan-India mix, B2B 60% with generated GSTINs); **182 orders** (`PN-2026-3xxxxx`, matching the app's order-number format) spanning ~6 months across **all 13 statuses** (110 delivered, plus shipped/out-for-delivery/processing/cancelled/return states); 303 order items with GST back-computed per line from GST-inclusive prices, CGST/SGST for Gujarat vs IGST otherwise, serial numbers on high-value units; **1,231 status-history rows**; 182 payments (Razorpay/COD mix; SUCCESS/INITIATED/FAILED/REFUNDED) + 294 gateway events; 138 shipments (Shiprocket-style AWBs, 5-courier mix) + **658 tracking events** manifesting Surat → destination city; 8 returns (REQUESTED/RESTOCKED/REFUNDED with inward-courier trail + refund amounts); 25 coupon redemptions (coupon `usedCount` synced); 66 fresh reviews (~5/product, 92% approved); 13 carts (3 guest) + 32 items; 14 wishlists + 32 items with price snapshots; 9 stock alerts on the low/OOS SKUs; 14 B2B inquiries (NEW/CONTACTED/CLOSED with trade-desk notes); 12 OTP trail rows; 80 audit-log entries tied to real order/product ids; and the full ADR-010 stock-monitor lifecycle (CLOSED count with applied variances → real inventory movements, COUNTING session mid-count, OPEN session fresh, 10 adjustment requests PENDING/APPROVED/REJECTED — approved ones carrying real movements — plus 15 ledger movements).
- **Engineering**: batched `createMany`/`createManyAndReturn` (~50 network round trips instead of ~3,600 per-row inserts) keeps the full reseed ≈ 1 min against Neon; every unique constraint guarded in-memory (review×user, cart×sku, wishlist×product, alert×sku+phone, redemption×order, awb/event ids); orders never decrement Inventory so the demo low/OOS states survive; money stays integer paise.
- **Verified**: seed run green against Neon with a per-table count report — all 38 tables non-zero (~3.6k rows); sandbox storefront serves the seeded catalog; the **live Render site picked the data up immediately** (shared Neon DB); admin API fence intact (401 unauth); lint 0. Decision **D-15**.

## 2026-09-27 — Task 29 (Render go-live: runtime fix back-ported — 0.0.0.0 bind)

**Fix — the start-command change that killed the 502 now lives in the repo, not just the dashboard**
- **Live**: https://patelnetworks.onrender.com is up (runtime switched Docker → Node; build `npm install && npm run db:sync && npm run build`). Re-verified this round from the sandbox: `/api/health` → `{"db":"up"}`, homepage 200.
- **Root cause of the 502**: Render injects `HOSTNAME` (the service hostname) into the environment and Next's standalone server binds to it — an interface nothing can reach. The dashboard start command that fixed it pins `HOSTNAME=0.0.0.0 PORT=$PORT`. `npm run start` now carries the same fix in-repo: `HOSTNAME=0.0.0.0 PORT=${PORT:-3000} NODE_ENV=production node .next/standalone/server.js` — so `render.yaml`'s `startCommand: npm run start` and the dashboard's bun variant are equivalent (bun ships in Render's Node image and is verified working there; node stays the portable default). Decision **D-14**.
- **Docs**: render.yaml header documents the gotcha + the verified bun variant; `deploy/RENDER-STEPS.md` gains a LIVE banner + a "build green but 502" troubleshooting row (now leads the map); `docs/RENDER-DEPLOYMENT.md` gains a status banner; README gains the live URL.
- Residual note: the dashboard's Start Command is a per-service override — if the Blueprint is ever re-applied it switches back to `npm run start`, which now includes the binding, so no regression either way.

## 2026-09-27 — Task 28 (hotfix: Render build failure — env precedence shim)

**Fix — "Environment variable not found: DATABASE_URL" (P1012) at Render's `db:sync` build step**
- **Root cause (self-inflicted)**: Task 27 made every DB script run under `env -u DATABASE_URL` to defeat the sandbox's stale injected env var — but on Render there is no `.env` to refill it, so the shim erased the dashboard-provided URL and the build died. Sandbox-first thinking, Render-hostile result.
- **Fix — `scripts/with-env.sh`**: POSIX shim used by `dev` / `db:push` / `db:sync` / `db:seed`. When `.env` exists (sandbox) it sources it with `set -a` so its values **override** the inherited environment; when it doesn't (Render) the inherited environment passes through untouched. Correct in both worlds by construction; `exec "$@"` preserves signals/exit codes.
- **Verified with real runs, all three modes**: stale `file:` env → Neon reached via `.env` override; plain run → sync; no-`.env` directory → dashboard-style URL passes through verbatim (the exact Render scenario). Dev server restarted through the new path — health `{db:up}` on Neon. lint 0 · tsc 0.
- **Runbook**: `deploy/RENDER-STEPS.md` troubleshooting map now leads with this exact P1012 row — if it recurs after this fix, `DATABASE_URL` simply isn't set on the Render service (Environment → add the Neon string → Manual Deploy). New "Precedence rule" section documents the shim as the mandatory route for future DB-touching scripts. decisions **D-13 amended** to replace the `env -u` mechanism with the shim.

## 2026-09-27 — Task 27 (database switch: Neon PostgreSQL everywhere + Render deploy kit)

**Change — "stop using your sqlite db and switch to this" (owner's Neon instance) + ready-to-deploy Render setup**
- **Provider flip in-repo**: `prisma/schema.prisma` → `provider = "postgresql"` (the schema was designed for this day: no enums, no native arrays, integer paise — zero model changes needed). `.env` points at the owner's Neon URL (`sslmode=require`); SQLite stays a documented fallback (flip provider + `file:` URL). `.env` is git-ignored so the credential never enters the repo.
- **Env-hygiene hardening (the real trap)**: the sandbox injects a stale `DATABASE_URL=file:…` into the process environment, and OS env beats `.env` files — the dev server and Prisma CLI would silently talk to the wrong DB. All DB-touching scripts (`dev`, `db:push`, new `db:sync`, `db:seed`) now run under `env -u DATABASE_URL` so `.env` always wins. `start` switched to plain `node .next/standalone/server.js` (Render's Node runtime has no bun).
- **Schema pushed + seeded on Neon**: `prisma db push` created all 38 tables; seed restored the full catalog (10 brands · 14 products · 23 SKUs · kit bundle · coupons · banners · 3 posts) and the D-12 account model (owner + 4 scoped staff personas + B2B test customer). Seed clean-phase now also clears `otp_verifications` + the 3 stock-monitor tables → idempotent reseeds under Postgres's strict FK enforcement.
- **Verified live on Neon (agent-browser)**: storefront home + products render from Postgres; **owner login works** (`superadmin@patelnetworks.in` → full console); **staff login works** (`staff@patelnetworks.in` → lands scoped `/admin/stock-monitor`, nav = Stock Monitor only, live stock wall shows all 23 SKUs); DB-fresh gates intact; 375px overflow **0px**; `pg_stat_activity` shows the app's pooled connections on `neondb`; lint 0 · tsc 0 · health `{db:up}`. (A mid-round blank screen was the sandbox reaping the dev server — keeper restart, not a code issue.)
- **Render deploy kit**: new **`render.yaml`** Blueprint (Node runtime · build `npm install && npm run db:sync && npm run build` · start `npm run start` · healthCheck `/api/health` · auto-generated stable `JWT_SECRET` · `DATABASE_URL`/`NEXT_PUBLIC_APP_URL` prompted via `sync:false`); new **`db:sync`** script = `prisma db push` **without** `--accept-data-loss` so destructive schema changes fail a deploy loudly instead of eating data; **`package-lock.json`** (v3, 951 pkgs) committed for reproducible npm builds; **`deploy/RENDER-STEPS.md`** runbook (Blueprint + manual paths, env-var table, spin-down/pooling caveats, troubleshooting map).
- **Docs duty**: decisions **D-13** · README stack line + docs table (+RENDER-STEPS row) · `technical-documentation.md` DB row + convention #5 rewritten (Postgres runtime → `mode:'insensitive'` now allowed; SQLite fallback caveat) · `.env.example` postgres-first · `deploy/ENV-SETUP.md` sandbox section + Dockerfile arg note · `Dockerfile` provider-switch section marked no-op safety net · `docs/RENDER-DEPLOYMENT.md` gains a "which Render path" banner (Node+Blueprint vs Docker parity) · `compact.md` updated.

## 2026-09-27 — Task 26 (blueprint canvas: self-rendered ERD + live dbdocs wired in)

**Enhancement — the owner published the schema with our tools; the blueprint now shows it off**
- **Owner followed the Task 24 guide**: published the DBML as live docs at **[dbdocs.io/galat31868/patel](https://dbdocs.io/galat31868/patel)** and produced the ERD export. Their SVG attachment never reached the sandbox (`upload/` was empty and the dbdocs diagram renderer is client-private), so the blueprint now **renders the same ERD itself**.
- **New `scripts/blueprint-erd.ts`** (`bun scripts/blueprint-erd.ts`): schema.dbml → dbml-renderer (DOT) → inject 8 domain clusters matching the blueprint's domain cards (tinted, rounded, colored, labeled with table counts) → graphviz `dot` → **`public/blueprint/schema-diagram.svg`** (38 tables, ~9036×4210pt, rankdir=TB). The renderer's invisible ordering edges are dropped (they forced a 17k-pt single-column tower); DBML `''` SQL escapes are patched in-memory for the renderer only. Re-run after any schema change — canvas + DBML stay in lockstep with `prisma/schema.prisma`.
- **Zoomable canvas in Section 3**: "The full canvas — all 38 tables on one map" — a self-contained vanilla-JS viewer (no dependencies added): drag to pan, wheel/pinch zoom centered on cursor, double-click dive-in, ±/Fit width/Fit all buttons, **fullscreen mode** for live client demos, arrow-key panning, zoom % readout, domain-color legend chips, "Open raw SVG ↗" link, and a how-to-read note. Fit-width on load; hidden in print (print note explains the PNG-annex path).
- **Tools section updated**: dbdocs entry now carries a brass **"LIVE — YOURS"** chip with the real URL and `dbdocs push` re-push note; dbdiagram marked "Already used for this project"; Prisma-ERD-generator entry flipped to **"Done — our own"** pointing at the shipped script; client-ready-pack callout mentions demoing the canvas live on a shared screen.
- Also: help.md blueprint section rewritten (canvas + live docs link); footer bumped to v1.1.
- Verified live (agent-browser): canvas renders fit-all at 1280 with all 8 domain columns; zoom 9%→17% + drag-pan + fit-width all confirmed interactive; tools chips render; mobile 375px **0px overflow**; SVG serves 200 (334 KB); lint 0 · tsc 0.

## 2026-09-27 — Task 25 (dark-mode surface fix: brand bands stop flipping to mint)

**Fix — "goofy dark mode colours"**
- **Root cause**: Task 20 made dark `--primary` a bright mint (`#7fc4ab`, correct for buttons/chips/selected states), but every component that used `bg-primary` as a large *surface* — the announcement bar, the home kit-builder band (plus its step cells and decor rings), and the content-page CTA band — inherited that mint, turning full-width brand sections into eye-searing bright slabs with near-black text at night.
- **Fix, token-driven (not hardcoded)**: new `--brand` / `--brand-foreground` token pair exposed to Tailwind as `bg-brand` / `text-brand-foreground`. Light values equal the light primary (deep pine `#1a3c34` + cream `#f7f6f1`) so **light mode is pixel-identical**; dark values keep the deep pine surface (`#142a24`, one step above the `#0e1513` page background) with mist text (`#e6ebe7`), so bands read as elevated brand panels instead of mint billboards. Rule recorded in CSS comments: interactive elements keep `--primary`; large surfaces must never flip to mint.
- **Surfaces migrated**: storefront announcement bar (header), kit-builder band + step grid + `BandDecor` rings (home page / parallax), `CtaBand` panel, pill button and secondary link (content page-shell). Buttons, badges, pagination chips, variant chips, WhatsApp FAB and all small interactive elements intentionally stay mint.
- **Leftover light-theme badges given dark variants**: blog console Published/Draft chips and returns-queue REQUESTED/APPROVED borders (were pastel-on-dark).
- **Incident worth remembering**: after editing `globals.css`, Turbopack served a **stale CSS chunk** — utilities (`bg-brand` → `var(--brand)`) regenerated but the `:root`/`.dark` definitions were missing, so everything rendered transparent. A plain server restart didn't clear it; `rm -rf .next` + restart did. If tokens resolve empty after a palette edit, nuke the cache first.
- Verified live (agent-browser, dark): home kit band = deep pine panel with cream text; announcement bar pine; CtaBand + admin login card elegant; owner dashboard / orders / staff / blog consoles clean; product listing + PDP + kit-builder + cart clean; light mode unchanged; 375px overflow **0px**; lint 0 · tsc 0 · health {db:up}.

## 2026-09-27 — Task 24 (System Blueprint: visual docs for owner & client)

**Feature — a shareable "how the whole system works" page + ready-to-paste schema**
- **`/blueprint/index.html`** (static, self-contained, no JS deps, unlisted): the whole platform on one page — overview & tech table, the 4-layer request flow (people → Next.js app → services → Prisma/DB + external gateways), the **38-table database mapped in 8 domains** (domain map, catalog-spine diagram, per-domain expandable ER cards with real fields, ₹-paise/JSON/unique badges), the **Owner/Staff/Customer access model** (role ladder, 15 scopes in 5 groups, DB-fresh gate flow, wizard walkthrough, who-sees-what table), the **13-state order lifecycle** as three phases, the full **route map** (24 storefront + 7 account + 18 console pages, 78 API files in 6 groups), and an **online-tools guide** (dbdiagram.io, dbdocs, Eraser, drawSQL, Mermaid Live with a starter ER snippet, prisma-erd-generator, DBeaver). "Print / Save PDF" button + print stylesheet = client-ready deck in one click.
- **`/blueprint/schema.dbml`**: the entire schema as DBML (38 tables, all relationships, per-domain header colors, paise/enum notes) — paste into **dbdiagram.io** for an instant interactive ER diagram, or **dbdocs.io** for a shareable docs site. Written from `prisma/schema.prisma` (incl. the faithful `Wishlist`/`WishlistItem` un-mapped table names).
- **Admin shell**: owner-only **"System blueprint"** sidebar link (BookOpen, opens in new tab) — staff never see it (verified: counter staff → link hidden, fence intact, lands on stock monitor).
- Verified live: page + DBML serve 200 with 0 console errors; **0px overflow at 375px** after fixing a real bug the sweep caught (`.chips` flex was scoped to `.band`, so role-ladder chips formed an unbreakable 411px inline run → grid min-content blowout); admin sweep passes at 375/768/1280 across 17 routes; lint 0 · tsc 0.

## 2026-09-27 — Task 23 (role overhaul: Owner + scoped Staff, D-12; login-loop fix)

**Change — the account model you asked for**
- **Two operator roles remain**: `SUPER_ADMIN` (**Owner** — implicitly full access) and `STAFF` (**Staff** — dynamic scope). `ADMIN`, `INVENTORY_MANAGER`, `ORDER_MANAGER`, `CONTENT_MANAGER` are **removed**: legacy rows migrate to STAFF with a mapped scope (`scripts/migrate-legacy-roles.ts`, idempotent, safe to keep).
- **Per-staff scope**: new `User.permissions` JSON column (validated scope keys). The Owner grants functions at staff creation and edits them any time — **15 grantable scopes** (orders, returns, products, categories, brands, inventory, stock_monitor, customers, inquiries, reviews, coupons, banners, blog, reports, settings), grouped in the wizard with quick presets (Counter / Warehouse / Fulfillment / Catalog / Content desk).
- **Permission gates**: new `requirePermission(scope)` + `requireOwner()` in `api-helpers` re-read the operator's DB row **per request** — scope edits and deactivations take effect on the staff's **next request, no re-login**. All 39 gated admin route files (~58 call sites) moved off `requireRole`/`requireAnyAdmin`; fixed-role constants deleted. Route → scope map documented in the layout + technical docs.
- **Staff & access console** (`/admin/staff`, owner-only, in nav + sweep): accounts table (Owner/Staff chips, scope chips, active state), **3-step creation wizard** (identity → account type & function grid → review; password generator), per-account editor (rename / reset password / scope change / deactivate), and an owner **"Your login" card** (change own email +/or password, current password always required; wrong current password → 403).
- **Owner self-service + second superadmin**: the wizard's account-type step creates Staff or another Superadmin; owners cannot be scoped or deactivated from the dialog (implicit full access).
- **Bug found & fixed during E2E — login redirect loop**: a JWT can verify at the edge while its user row is gone (post-wipe/reseed), so panel-layout → `/admin/login` ping-ponged with the proxy (ERR_TOO_MANY_REDIRECTS). New `GET /admin/logout` escape hatch: the layout routes dead sessions there to actually clear the cookie, then login renders — self-healing.
- **Seed**: 4 scoped staff personas (warehouse `inventory@…/warehouse@2026`, fulfillment `orders@…/fulfill@2026`, content `content@…/content@2026`, counter `staff@…/counter@2026`).
- **Verified live (browser)**: wizard create → new staff lands on their section with single-entry nav; deep-link `/admin/orders` bounces back; scope added by owner → staff nav/API update immediately; scoped staff hitting `/api/admin/products|orders|staff` → 401, wall → 200; owner password change + revert + wrong-current-password 403; second superadmin sees all 17 nav entries; admin sweep 0px overflow at 375/768/1280 (incl. `/admin/staff`); lint 0 · tsc 0. Sandbox dev server reaped twice mid-round → keeper restarts.

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
