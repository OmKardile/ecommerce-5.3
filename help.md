# Help — running the shop day-to-day

For the owner and staff. Everything is clickable in the admin console at **/admin** (footer link "Staff console" → login with your admin email).

## First 5 minutes

1. **Log in**: `/admin/login` → email + password. (Sandbox demo: `superadmin@patelnetworks.in / patel@admin2026`.)
2. The **Dashboard** is your morning: pipeline cards (orders to verify, processing, shipped), alerts in red when action is waiting (open returns, new trade inquiries, reviews to moderate), low/out-of-stock lists, 30-day sales chart.
3. Left sidebar shows live **count badges** on Returns, Trade Desk and Reviews when something needs you.

## Where do I do X?

| I want to… | Go to | Notes |
|---|---|---|
| Verify a COD/payment, move an order forward | **Orders** → open the order drawer | Buttons only offer legal next steps; `tel:` / WhatsApp / map links on the customer |
| Print/capture serials for warranty | **Orders** → drawer → line-item serial capture | Needed before RMA |
| Create a shipment / copy AWB / track link | **Orders** → drawer → Shipment section | AWB from Delhivery/Shiprocket; customers see it at `/track` |
| Handle a return or DOA | **Returns & DOA** | Approve → courier inward → QC → refund → restock |
| Answer a bulk quote request | **Trade Desk** | Mark *Contacted* when you call (notes + first-handled time are recorded), *Close* when done. WhatsApp/tel buttons pre-filled. |
| Publish a customer review | **Reviews** | Approve (goes live on the product page) / Un-publish / Delete. Nothing publishes unapproved. |
| Fix stock counts | **Inventory** | Adjust (+/- with reason), CSV import/export, movement history per SKU |
| Add a product / variant / price | **Products** → New / edit | Money in ₹, stored as paise; specs as rows |
| Change categories / brands | **Categories / Brands** | Logo/image URLs + HSN/GST defaults |
| Run a promo | **Coupons** | `PERCENT` or `FLAT`; see redemption counts on the dashboard |
| Post news / blog | **Blog** | Draft → publish |
| Homepage banners | **Banners** | Image URL + link |
| Monthly/quarterly GST | **Reports → GSTR-1** | Month | Quarter (QRMP) | Custom range → CSV |
| Change shop settings (GSTIN, support phone, free-ship threshold…) | **Settings** | Saved in paise where money |

## Storefront (customer-side) quick answers

- **Where do customers track orders?** `/track` — enter order number + the phone used at checkout (or just phone for the order list). No login needed.
- **How do customers log in?** `/account/login` → phone → OTP. In this sandbox the OTP prints in the server log (`[SIMULATED SMS] … OTP: 123456`) because no SMS gateway is configured.
- **Wishlist price drops**: items show a green "Dropped ₹X since saved" badge when the current best price falls below the price when saved.
- **Notify me**: on an out-of-stock variant, customers opt in; they're pinged on restock (and a back-in-stock ribbon shows for 14 days).
- **Compare**: pick up to 4 products; the table highlights the lowest price per row. The selection survives page reloads.
- **Dark mode**: the sun/moon button in the header (inside the menu drawer under "Appearance" on phones) switches the whole site — storefront and staff console — to the pine night theme and back. The choice is remembered per browser.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Admin login says "Invalid credentials" | Bootstrap admin only exists after first successful login with `ADMIN_EMAIL/PASSWORD`; on a fresh DB, seed first (`bun run db:seed`) or set env and log in once |
| OTP never arrives | SMS is in simulation mode — read `dev.log` for `[SIMULATED SMS]` lines; configure `SMS_GATEWAY_API_KEY` for real SMS |
| Badge counts look stuck | They're computed per page load; refresh. If wrong after a DB restore, log out/in (stale session self-heals) |
| "Stale Prisma client" 500s | `bun run prisma generate` (also runs on `bun install`) |
| Empty catalog | `bun run db:seed` restores the full demo catalog |
| Demo inquiries/reviews show up | Intentional QA fixtures — `bun run scripts/qa-clean.ts` before go-live |
| WhatsApp links open a chat with wrong number | Numbers are normalized to 10 digits (leading `91`/`0` handled) — check the customer record itself |
| The scrolling/parallax effects bother someone | All motion honours the OS "reduce motion" setting (Windows: Animation effects · macOS/iOS: Reduce Motion · Android: Remove animations) — effects stop and content stays fully readable |
| A page overflows sideways on a phone | Run `bash scripts/responsive-sweep.sh` (storefront) or `-admin.sh` (console) to find the offending route; Card/TabsList/PageShell are already hardened — look for new wide tables or bare text inside flex rows |

## Security notes for staff

- Never share the superadmin login; ask the owner to create per-person admin users with the right **role** (orders vs inventory vs content) so audit trails name the right person.
- The carrier tracking webhook needs `SHIPPING_WEBHOOK_TOKEN` set in production — the server warns loudly until it is.
- Log out on shared machines (button in the sidebar footer).
