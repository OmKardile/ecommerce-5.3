# Patel Networks / MegaTech — Routes cheat sheet

> **The one file to check when you can't remember a URL.** Page routes (storefront + admin), login pages, seeded credentials, and the API group map. Full API handler catalog with methods/shapes: [`API.md`](./API.md).

---

## 1 · Logins (the part you keep needing)

### Operators (Owner + Staff) — ONE login page for everyone

**`/admin/login`** — email + password. The account's role decides where you land:

| Who | Email | Password | Lands on | Sees |
|---|---|---|---|---|
| **Owner** (super admin) | `superadmin@patelnetworks.in` | `patel@admin2026` | `/admin` (full console) | Everything, incl. Staff & access |
| Staff — Stock Monitor persona | `staff@patelnetworks.in` | `counter@2026` | `/admin/stock-monitor` | Stock Monitor only |
| Staff — Warehouse persona | `inventory@patelnetworks.in` | `warehouse@2026` | first granted section | scopes set in wizard |
| Staff — Fulfillment persona | `orders@patelnetworks.in` | `fulfill@2026` | first granted section | scopes set in wizard |
| Staff — Content persona | `content@patelnetworks.in` | `content@2026` | first granted section | scopes set in wizard |

- Staff scopes are **DB-fresh** (D-12): the owner edits them in `/admin/staff` and they apply on the staff's **next request — no re-login needed**.
- A scoped staff typing a URL outside their grant gets bounced server-side to their first granted section.
- Stale session escape hatch: **`/admin/logout`** (GET — clears the JWT even if the account was wiped/recreated).
- Owner bootstrap fallback (empty DB): `ADMIN_EMAIL` / `ADMIN_PASSWORD` env.

### Customers — phone + OTP (no passwords)

| Route | What |
|---|---|
| **`/account/login`** | The real OTP sign-in (request code → verify) |
| `/login` | Convenience alias → redirects to `/account/login` (preserves `?next=`) |

Test customer in sandbox/demo: phone **`+91 98765 43210`** — the OTP prints to `dev.log` as `[SIMULATED SMS]` (sandbox) or is sent by the SMS provider when keys are configured.

### Guest order tracking (no login)

**`/track`** — order number + phone as credential (rate-limited).

---

## 2 · Storefront pages (public)

| Route | Page |
|---|---|
| `/` | Home (hero banners, featured, kit-builder strip) |
| `/products` | Catalog listing (facet filters) |
| `/products/[slug]` | Product detail (variants, gallery, pincode check, reviews) |
| `/brands` · `/brands/[slug]` | Brands index · brand page |
| `/search` | Search with header autocomplete |
| `/kit-builder` | 5-step CCTV kit builder |
| `/cart` | Cart (server-authoritative, guest cart merges at login) |
| `/checkout` | Checkout (OTP-gated, B2B GSTIN toggle, Razorpay/COD) |
| `/order-success` | Post-payment confirmation |
| `/compare` | Product compare |
| `/track` | Public order tracking |
| `/blog` · `/blog/[slug]` | Blog index · post |
| `/about` · `/contact` · `/faq` | Content pages (contact includes B2B inquiry form) |
| `/shipping-policy` · `/return-policy` · `/privacy-policy` · `/terms` | Policy pages |
| `/index-help` | System guide (printable explainer: database, backend flow, roles, order lifecycle, routes) — linked owner-only from the admin sidebar |

## 3 · Customer account (requires `pn_session` — OTP login)

| Route | Page |
|---|---|
| `/account` | Account dashboard |
| `/account/login` | OTP sign-in (see §1) |
| `/account/orders` · `/account/orders/[orderNumber]` | Order history · order detail + printable GST invoice |
| `/account/addresses` | Address book (max 10) |
| `/account/wishlist` | Wishlist with price-drop alerts |

## 4 · Admin console (`/admin`, own chrome — password login, see §1)

| Route | Section | Access |
|---|---|---|
| `/admin` | Dashboard (GMV, GST, pipeline, low stock) | Owner + scope-less staff only |
| `/admin/orders` | Fulfillment console (FSM buttons, serials, AWB, CSV) | granted scope |
| `/admin/products` · `/admin/categories` · `/admin/brands` | Catalog management | granted scope |
| `/admin/inventory` | SKU matrix, adjustments, movement ledger + **Requests & counts** tab | granted scope |
| `/admin/customers` | CRM (LTV, B2B badge, wa.me links) | granted scope |
| `/admin/coupons` · `/admin/banners` | Marketing | granted scope |
| `/admin/blog` | Blog editor | granted scope |
| `/admin/reviews` | Moderation (approve / un-publish / delete) | granted scope |
| `/admin/returns` | Returns & DOA RMA flow | granted scope |
| `/admin/inquiries` | B2B Trade Desk (`NEW → CONTACTED → CLOSED`) | granted scope |
| `/admin/reports` | Sales chart, tax summary, GSTR-1 CSV | granted scope |
| `/admin/settings` | Store settings (COD rules, fees, cutoff, announcement) | granted scope |
| `/admin/staff` | **Owner-only** — account wizard, scopes, deactivate | Owner |
| `/admin/stock-monitor` | Staff panel: stock wall, kiosk mode, counts, proposals | Staff (counter persona's home) |
| `/admin/login` · `/admin/logout` | Sign-in · GET escape hatch (see §1) | public |

## 5 · API routes — group map

All handlers live under `src/app/api/**`; responses use the envelope `{ ok, data }` / `{ ok:false, error }`. **Full per-endpoint catalog (methods, auth, request/response shapes): [`API.md`](./API.md).**

| Group | Covers |
|---|---|
| `/api/auth/**` | Customer OTP request/verify, session me/logout |
| `/api/admin/auth/**` | Operator login/logout |
| `/api/account/**` | Profile, addresses |
| `/api/cart/**` · `/api/wishlist/**` | Cart + guest merge · wishlist |
| `/api/products/**` · `/api/search` · `/api/reviews` | Catalog, autocomplete, review submit |
| `/api/coupon/**` · `/api/shipping/**` | Coupon validation · rates/serviceability |
| `/api/orders/**` · `/api/track` | Placement, history, public tracking |
| `/api/payments/**` | Razorpay create/verify (+ sandbox simulate) |
| `/api/stock-alerts` | Back-in-stock notify-me |
| `/api/admin/**` | The whole operations console (orders, inventory, staff, reports, GSTR-1, …) |
| `/api/webhooks/**` | Razorpay + shipping events (shared-secret) |
| `/api/contact` | B2B inquiry form |
| `/api/health` | Liveness + DB ping (`{"ok":true,"data":{"status":"healthy","db":"up"}}`) |

---

*Page routes mirror the folder tree 1:1 (`src/app/(store)/**`, `src/app/admin/**`), so if a route isn't listed here, the folder name is the URL. Keep this file updated when adding top-level sections.*
