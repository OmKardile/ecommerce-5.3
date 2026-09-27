# Business documentation

Patel Networks / MegaTech — what the system does for the business, in business terms.

## The business

**Patel Networks** is a Surat-based (Gujarat, India) trader and installer of CCTV, surveillance and networking hardware: cameras (analog HD + IP), DVRs/NVRs, monitors, cables, connectors, converters, switches, storage, tools, and full install kits. Two revenue lines:

1. **Retail (B2C)** — walk-in and online single-unit buyers; storefront at MegaTech brand.
2. **Trade (B2B)** — contractors, installers, electrical dealers; GST invoices, bulk pricing, dealer rates, contractor quotes.

## How money is made

- **Product sales** with variant-level SKUs (each variant = one purchasable SKU with its own price/stock/barcode).
- **Coupons** (`PERCENT` / `FLAT` types, redemption-tracked with 30-day visibility on the dashboard).
- **Kit deals** (Kit Builder bundles camera+DVR+cable+BNC into one purchasable kit).
- Free shipping threshold (₹500) — dynamic progress bar nudges cart value up.

## Catalog & content operations

- **Taxonomy**: Category → Brand → Product → Variant → SKU. Products carry specs (JSON), documents, HSN codes and GST rates (defaults 18%).
- **Merchandising**: featured grid, promo banners (content-manager editable), blog posts, brands pages.
- **Pricing**: `SKU.sellingPrice` (paise) + optional MRP strikethrough; compare table badges lowest price.

## The order lifecycle (B2C)

```
CART → CHECKOUT (address, GSTIN optional, COD or Razorpay)
  → PENDING_PAYMENT / COD_PENDING → PAID → CONFIRMED → PROCESSING
  → PACKED (serial numbers captured for warranty/RMA) → SHIPPED (AWB)
  → OUT_FOR_DELIVERY → DELIVERED
  ↺ CANCELLED (pre-shipment) · RETURN_REQUESTED → … → REFUNDED
```

- **Status transitions are server-enforced** (forward-only, audit-recorded); the UI only offers legal moves.
- **Shipping**: Delhivery/Shiprocket AWBs; tracking webhook updates order status automatically; customers self-serve via `/track` (phone-as-credential, sanitized data).
- **Invoices**: GST invoice per order (`/account/orders/[orderNumber]/invoice`), GSTIN `24AAACP1234F1Z8` (Surat) via `STORE_GSTIN`.

## After-sales: RMA / returns / DOA

1. Customer requests return per order (`/account/orders/[orderNumber]`).
2. Admin reviews in **Returns & DOA** console: approve/reject → courier pick-up inward → QC decision → refund (ledger) → restock.
3. Serial numbers captured at pack time make warranty traceability possible.
4. Notifications (SMS/WhatsApp) fire at each customer-visible step.

## Trade desk (B2B pipeline)

- Inquiry form (with product context + optional GSTIN) lands in **Trade Desk** (`/admin/inquiries`).
- Forward-only pipeline `NEW → CONTACTED → CLOSED` with notes, `tel:`/`wa.me` one-click contact, and "Re: product" deep links.
- Dashboard surfaces new-inquiry count as an alert card.

## Reviews & social proof

- Signed-in customers review products (one per product, rate-limited, verified-purchase flag auto-detected).
- **Nothing publishes unmoderated**: reviews wait in `/admin/reviews` until approved; histogram + chips render on PDP.

## Inventory & stock integrity

- Every stock change is a **StockMovement row** (source: SEED / ORDER / RETURN_RESTOCK / MANUAL_ADJUSTMENT / IMPORT …) — no silent mutations.
- Low-stock thresholds per SKU; OUT/LOW states on the ops console + dashboard; back-in-stock watchers (opt-in notifications) with restock ribbons on PDP.
- CSV import/export for bulk ops.

## Tax & compliance

- GST collected tracked per order (dashboard KPI).
- **GSTR-1 exporter**: Month (regular) | Quarter (QRMP) | Custom-range B2B/B2C summaries with CSV.

## Roles in the shop

| Role | Owns |
|---|---|
| Owner (SUPER_ADMIN) | everything — including staff accounts, their function scopes, and their own login (D-12) |
| Staff | only the functions the owner granted (orders, returns, products, categories, brands, inventory, stock monitor, customers, trade desk, reviews, coupons, banners, blog, reports, settings) — set at account creation via the `/admin/staff` wizard, editable any time |

## Vendor / third-party accounts needed at go-live

Razorpay (KYC + webhook secret) · Shiprocket (Surat 395003 pickup) · Fast2SMS DLT templates (sender PTLNET) · Meta WhatsApp Cloud API (system user + templates) · domain + TLS on the shop VPS. Full onboarding steps: `docs/PRODUCTION-CHECKLIST.md`.

## Measures that matter (dashboard)

GMV · GST collected · pending/COD verification · processing/shipped/delivered pipeline · open returns · new B2B inquiries · reviews to moderate · back-in-stock watchers · coupon redemptions (30d) · low/out-of-stock · 30-day sales series.
