# MegaTechzy — the platform, and what it does for the business

**Patel Networks / MegaTechzy · Surat, Gujarat · live at <https://patelnetworks.onrender.com>**
Written by the person who designed and built it — for the people who will run it, fund it, or buy from it. The companion pages: [`business-documentation.md`](business-documentation.md) is the operational manual; this file is the *why*. The visual version of this pitch lives at **`/showcase`** on the site itself — open it on a phone and hand it over.

---

## The 30-second pitch

Patel Networks sells CCTV, surveillance and networking hardware from Surat — to walk-in retail buyers, to installers on a ladder, and to contractors ordering in bulk. Until now that kind of business runs on three disconnected tools: a website, a notebook and hope.

MegaTechzy is what replaces all three with **one designed system**:

- a **storefront** customers actually enjoy — search, compare, a 5-step CCTV kit builder, OTP sign-in, GST-native checkout;
- an **operations console** the staff can genuinely run — fulfillment, stock wall, returns, trade desk, all with guarded, logged moves;
- an **owner's cockpit** where the truth lives — GMV, GST, pipeline, low stock, GSTR-1 CSV, staff scopes, coupons and banners, no developer required.

Same catalog, same stock, same books. Designed end-to-end by one person, so it behaves like one product.

---

## Why a local trade business is exactly what this is for

This is not a template "e-commerce for everyone" product. It was drawn around the reality of a *local* hardware trade:

| Reality of the trade | What the platform does about it |
|---|---|
| Buyers call the counter before they trust the shop | The storefront sells credibility first — authorized brands, serial-tracked stock, published policies, moderated reviews, a real GST invoice |
| Installers buy from the field, on phones | Mobile-first design swept at 375 px; OTP sign-in (no passwords to forget); wishlist price-drop alerts pull them back |
| Contractors buy in bulk and need input tax credit | B2B GSTIN checkout, printable tax invoices, saved site addresses, a B2B Trade Desk pipeline with WhatsApp notification |
| "Is this camera compatible with my DVR?" kills the sale | The kit builder enforces compatibility (cameras bounded by recorder channels, storage sized by retention days) and applies the bundle discount itself |
| Surat is the hub — speed is the edge | Same-day dispatch cutoff (4:00 PM IST) with Shiprocket & Delhivery; customers self-track at `/track` with just order number + phone |
| The counter staff are not computer people | A stock wall with kiosk mode, human-phrased history, observe-and-propose workflow — staff can't silently mutate anything |
| The owner can't be in three places | Scoped staff accounts, audit trail on everything, reports and GSTR-1 export from the browser |

---

## What makes it special — the honest list

1. **It's one system, not three.** Storefront, console and cockpit share one 38-table data core. The stock count on the website is the stock count at the counter; the invoice the accountant wants is the invoice the customer already has.
2. **SKU-serial-level inventory.** Not "we have cameras" — *which* camera, *which* serial, scanned at pack time. That's what makes clean warranty and DOA claims possible.
3. **A 13-state order lifecycle, server-enforced.** The UI only offers legal moves; every transition is audit-recorded. Orders can't be "accidentally" skipped forward.
4. **The kit builder.** Most shops make buyers assemble their own kit and pray it works. This one composes recorder → cameras → storage → power/cable with compatibility bounds and a self-applying bundle discount.
5. **Staff access designed like a bank's.** Owner-only account wizard, per-section scopes that take effect on the staff's *next request* (no re-login), and a stock room where employees propose and managers dispose.
6. **It respects money.** Every rupee is stored as integer paise — rounding drift is structurally impossible, and GST splits correctly into CGST/SGST (Gujarat) or IGST (elsewhere) by delivery state.
7. **It was designed, not assembled.** One designer made the palette, type, motion, flows *and* the data model agree with each other. That coherence is visible the moment you open the site.

---

## Feature tour

### Customers see (storefront)

- Editorial home with managed banners, featured hardware and category departments
- Catalog with facet filters (category tree, brand, price, resolution, rating, availability) + header autocomplete search
- Product pages: variant matrix, galleries, pincode serviceability check, JSON-LD, approved reviews
- 5-step CCTV kit builder; side-by-side compare table with lowest-price badges
- Cart with coupons and free-shipping progress; OTP-gated checkout with saved addresses
- Razorpay **or** COD (per-product COD flag, ceiling rules, zone restrictions)
- Accounts: order history, printable GST invoices, address book, wishlist with price-drop alerts, back-in-stock notify
- Guest order tracking at `/track`; blog ("Field notes"), FAQ, about, contact with B2B inquiry form, four policy pages

### The team runs (operations console — 17 sections)

- Dashboard: GMV, GST collections, order pipeline, payment split, low stock
- Fulfillment: legal-move-only transition buttons, serial capture at pack, AWB booking, carrier-scan events, CSV export
- Inventory: SKU matrix, adjustments with reason codes, movement ledger, CSV import/export, staff count sessions
- Returns & DOA: full RMA — approve → courier inward → QC → refund → restock
- B2B Trade Desk: inquiry pipeline `NEW → CONTACTED → CLOSED` with WhatsApp notify
- Moderation: reviews (nothing publishes unapproved), blog editor, coupons, banners
- Customers CRM: lifetime value, B2B badges, wa.me contact links
- Reports: 30-day sales chart, tax summary, GSTR-1 schedule with CSV, top products/customers, inventory valuation
- Settings: COD rules, fees, dispatch cutoff, site announcement — editable without a developer
- Staff & access (owner-only): 3-step account wizard, scopes, deactivation — and a dedicated Stock Monitor panel for the counter team

### The owner gets (cockpit)

The truth in one screen, the levers in reach: what sold, what's stuck, what's low, what the tax liability looks like — and the tools (staff scopes, coupons, banners, settings) to act on it the same minute.

---

## The design story (why it looks like this)

A surveillance-hardware shop is really selling one thing: **you can trust what we ship.** Every design decision serves that:

- **Warm paper + deep pine palette** — calm, honest, grown-up. A single brass accent, reserved for moments that earn it (discount chips, links, highlights) — never used as a surface.
- **Fraunces for display, Inter for interface** — an editorial serif voice over a workhorse sans that never tires at small sizes.
- **Dark mode is a second design, not an inversion** — deep pine-forest surfaces in the same hue family, so the brand reads identical at night.
- **Motion with manners** — scroll parallax and entrances on the storefront, all of it yielding to `prefers-reduced-motion`.
- **Accessibility in the base, not bolted on** — skip links, focus-visible rings, semantic landmarks, 44px touch targets, zero horizontal overflow swept at 375/768/1280.
- **No AI-generated imagery, ever** — the catalog shows real product files; typographic placeholders render when an image is missing. A hardware shop can't afford to look imaginary.

Design isn't how it looks on launch day. It's how it behaves on the busiest day of the month — and that is what was designed for.

---

## What you can achieve with it

**Week one — sell beyond the counter.** Load the catalog, print the QR to the storefront, and every walk-in customer leaves with a shop that never closes. The wishlist and stock-alert machinery quietly brings them back.

**Month one — delegate.** Give the counter hand a Stock Monitor account, the warehouse person inventory scopes, the fulfillment desk the orders console. They see only their world; you see everything; the audit trail remembers all of it.

**Quarter one — win the trade.** The B2B desk turns WhatsApp inquiries into a tracked pipeline; GSTIN checkout makes input-tax-credit buyers prefer you over marketplaces; bulk kit deals move volume without price confusion.

**Every month-end — close without dread.** Tax summary and GSTR-1 CSV out of the console, movement ledger for the auditor, inventory valuation for the balance sheet. Files, not shoeboxes.

**Anytime — grow without migrating.** More brands, more categories, more staff, a second city? It's catalog rows and staff accounts — not a replatform. The 38-model PostgreSQL core is yours: exportable, backable, movable. No marketplace owns your customers.

---

## Proof, not promises

- **Live now:** <https://patelnetworks.onrender.com> — deployed on Render + Neon PostgreSQL, health-checked, with a documented runbook and even a written post-mortem for the one outage it ever had. Engineering maturity a buyer can inspect.
- **Loaded with reality:** six months of deterministic demo history — 50+ buyers, 180+ orders across every lifecycle state, payments, shipments with tracking events, returns, reviews, stock counts. Every chart and console shows real movement, never empty skeletons.
- **Quality gates on record:** zero-lint and zero-type-error rounds, responsive sweeps at three breakpoints, and a per-round changelog discipline going back to day one.

## Where to point people (the pitch route)

1. **`/showcase`** — this pitch, designed (start here, on a phone)
2. **`/products`** — the catalog, filters, a product page with a pincode check
3. **`/kit-builder`** — build a 4-camera kit and watch the discount apply itself
4. **`/track`** — follow a real demo order
5. **`/admin/login`** — the console (credentials are private to the owner; see `docs/ROUTES.md` in the repository)

## Questions a business buyer asks

**"Is my data mine?"** Yes — a 38-table PostgreSQL database you can export and move. No marketplace lock-in, no rented customer list.

**"What if a staff member leaves?"** Deactivate their account in the wizard; scopes for everyone else are untouched; the audit trail shows exactly what they touched.

**"Can it handle real payments and couriers?"** It's built for Razorpay and Shiprocket/Delhivery — running in verified simulation until live keys are added, at which point nothing else changes. Same for SMS and WhatsApp notifications.

**"Is GST handled?"** Inclusive pricing, correct CGST/SGST vs IGST by state, HSN-bearing printable invoices, GSTR-1 schedule export.

**"What does it cost to run?"** A managed host and a database — the kind of bill that fits a small shop, not an agency retainer. No per-order commission to anyone.

**"Why not just sell on a marketplace?"** Because there you're a row in someone else's table — their fees, their rules, their customer data. This makes the shop the destination, keeps the margin, and keeps the relationship.

---

*MegaTechzy platform v1 — designed & built by [Omkar Kardile](https://omkardile.is-a.dev/) for Patel Networks, Surat. Operational details live in [`business-documentation.md`](business-documentation.md); routes and logins in [`docs/ROUTES.md`](docs/ROUTES.md).*
