import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  ClipboardCheck,
  Contrast,
  Database,
  GitCompare,
  MousePointerClick,
  PackageSearch,
  Receipt,
  Search,
  ShieldCheck,
  Store,
  Truck,
  Warehouse,
  Wrench,
} from "lucide-react";
import { BandDecor } from "@/components/motion/parallax";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "The Platform — one system for the counter, stockroom and back office",
  description:
    "One system, three faces: a customer storefront, a staff operations console and an owner's cockpit — designed end-to-end for a Surat CCTV & networking hardware trade. Take the tour.",
};

/* ------------------------------------------------------------------ */
/* Static, honest content — every number below maps to a real surface  */
/* ------------------------------------------------------------------ */

const STATS = [
  { value: "38", label: "domain data models" },
  { value: "50+", label: "designed screens" },
  { value: "78", label: "API endpoints" },
  { value: "13", label: "state order lifecycle" },
  { value: "2", label: "complete themes" },
  { value: "100%", label: "paise-exact billing" },
];

const FACES = [
  {
    icon: Store,
    kicker: "For the customer",
    title: "The storefront",
    body: "A warm, editorial shopping experience for cameras, recorders, cables and networking gear — built to make a first-time visitor trust the shop before they ever call it.",
    href: "/products",
    cta: "Walk the catalog",
  },
  {
    icon: Warehouse,
    kicker: "For the team",
    title: "The operations console",
    body: "Fulfillment, inventory, returns, trade desk and moderation — every order state is server-enforced, every stock move is reasoned and logged. Staff see only what they're granted.",
    href: "/admin/login",
    cta: "Operator sign-in",
  },
  {
    icon: ClipboardCheck,
    kicker: "For the owner",
    title: "The cockpit",
    body: "GMV, GST collections, order pipeline and low stock on one dashboard; GSTR-1-ready CSVs, staff scopes, coupons, banners and store rules — no developer required.",
    href: "/admin/login",
    cta: "Owner sign-in",
  },
];

const POWERS = [
  {
    icon: Search,
    title: "Catalog that answers back",
    body: "Facet filters across category, brand, price, resolution, rating and availability — plus debounced autocomplete in the header.",
  },
  {
    icon: Wrench,
    title: "5-step CCTV kit builder",
    body: "Recorder → cameras bounded by its channels → storage with a retention estimate → power & cable. Compatibility is enforced, the bundle discount applies itself.",
  },
  {
    icon: GitCompare,
    title: "Side-by-side compare",
    body: "Specs, prices and badges in one honest table — the lowest price is marked, not hidden.",
  },
  {
    icon: ShieldCheck,
    title: "OTP sign-in, no passwords",
    body: "Customers sign in with a phone and a one-time code. Guest carts merge automatically when they do.",
  },
  {
    icon: BellRing,
    title: "Wishlist with price-drop alerts",
    body: "Saved items watch their own prices and tell the customer when to come back — a quiet re-marketing engine.",
  },
  {
    icon: PackageSearch,
    title: "Tracking without an account",
    body: "Any customer can follow an order with just the order number and phone — rate-limited and sanitized.",
  },
  {
    icon: Receipt,
    title: "GST-native checkout",
    body: "B2B buyers drop a GSTIN and get input-tax-credit invoices; everyone gets CGST/SGST or IGST computed correctly by state.",
  },
  {
    icon: BadgeCheck,
    title: "Reviews that earn trust",
    body: "Nothing publishes unapproved. Moderation happens in the console; credibility happens on the page.",
  },
];

const PIPELINE = ["CART", "PAID", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT FOR DELIVERY", "DELIVERED"];

const OPS = [
  {
    icon: Truck,
    title: "Fulfillment console",
    body: "Legal-move-only buttons, serial numbers captured at pack, AWB booking and carrier-scan events — then a CSV when the accountant asks.",
  },
  {
    icon: Warehouse,
    title: "Stock Monitor & inventory",
    body: "A state-tile stock wall with kiosk mode. Staff observe, count and propose; managers approve and apply. Every adjustment carries a reason code and a ledger line.",
  },
  {
    icon: Receipt,
    title: "Books & taxes",
    body: "A 30-day sales chart, tax summary and a GSTR-1 schedule with CSV export — filing stops being a month-end crisis.",
  },
];

const SWATCHES = [
  { hex: "#faf9f6", name: "Warm paper", note: "the page you're reading" },
  { hex: "#1a3c34", name: "Deep pine", note: "trust, for a hardware trade" },
  { hex: "#7fc4ab", name: "Mint", note: "night-mode actions" },
  { hex: "#b45309", name: "Brass", note: "accents, never surfaces" },
];

const CRAFT = [
  { icon: Contrast, title: "Two full themes", body: "Dark mode isn't inverted — it's a second, designed palette in the same hue family." },
  { icon: MousePointerClick, title: "Motion with manners", body: "Scroll parallax and entrances everywhere — and all of it steps aside for reduced-motion users." },
  { icon: ShieldCheck, title: "Accessibility in the base", body: "Skip links, focus-visible rings, semantic landmarks, 44px touch targets, 0px overflow swept at 375 / 768 / 1280." },
  { icon: Database, title: "Paise-exact by design", body: "Every rupee in the system is an integer of paise — rounding drift is structurally impossible." },
];

const OUTCOMES = [
  {
    title: "Sell beyond the counter",
    body: "The shop stops being a place and becomes a hub — the same catalog serves the walk-in buyer, the installer on a rooftop, and the contractor ordering forty cameras at midnight.",
  },
  {
    title: "Delegate without worry",
    body: "Hand staff accounts scoped sections — a counter hand watches stock, fulfillment books shipments. Scopes apply on their next request, and the owner alone owns access.",
  },
  {
    title: "Close the books without dread",
    body: "GST-computed invoices, a tax summary, and GSTR-1 CSV straight out of the console. The accountant gets files, not shoeboxes.",
  },
  {
    title: "Own your data",
    body: "A 38-model PostgreSQL core you can export, back up and move — customers, orders, serials and ledgers stay yours, not a marketplace's.",
  },
];

/* ------------------------------------------------------------------ */

export default function ShowcasePage() {
  return (
    <div>
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_80%_at_80%_10%,color-mix(in_srgb,var(--primary)_7%,transparent),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="rise-in max-w-3xl">
            <p className="label-caps">Patel Networks · Surat</p>
            <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              A shop counter, a stockroom and a back office —
              <span className="block italic text-primary">designed as one system.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Most local trade businesses run on three disconnected tools: a website, a notebook and hope. This platform
              is one designed whole — a storefront customers enjoy, a console the staff can actually run, and a cockpit
              where the owner sees the truth. Take the tour below; every number on this page is real and clickable.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-full px-6">
                <Link href="/products">
                  Walk the storefront <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-foreground/25 px-6">
                <Link href="/kit-builder">Build a CCTV kit</Link>
              </Button>
            </div>
            <p className="mt-6 text-[13px] text-muted-foreground">
              Designed end-to-end — typography, color, motion, flows and the data model behind them.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- stats band ---------- */}
      <section className="border-b border-border bg-brand text-brand-foreground">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-3xl tracking-tight">{s.value}</dd>
                <dd className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-foreground/60">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- three faces ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <p className="label-caps">One system, three faces</p>
        <h2 className="mt-2 max-w-2xl font-display text-3xl tracking-tight">
          Whoever opens it, it was designed for them.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {FACES.map((f) => (
            <div key={f.title} className="flex flex-col rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-sm">
              <f.icon className="h-6 w-6 text-primary" aria-hidden />
              <p className="label-caps mt-5">{f.kicker}</p>
              <h3 className="mt-1.5 font-display text-xl">{f.title}</h3>
              <p className="mt-2.5 flex-1 text-[13.5px] leading-relaxed text-muted-foreground">{f.body}</p>
              <Link href={f.href} className="link-underline mt-5 inline-block w-fit text-[13px] font-medium">
                {f.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- storefront superpowers ---------- */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-caps">The customer side</p>
              <h2 className="mt-2 font-display text-3xl tracking-tight">Eight superpowers, zero clutter.</h2>
            </div>
            <Link href="/products" className="link-underline hidden text-sm font-medium sm:block">
              See them live →
            </Link>
          </div>
          <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {POWERS.map((p) => (
              <div key={p.title}>
                <p.icon className="h-5 w-5 text-primary" aria-hidden />
                <h3 className="mt-3.5 text-[15px] font-semibold leading-snug">{p.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- operations ---------- */}
      <section className="relative overflow-hidden bg-brand text-brand-foreground">
        <BandDecor />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-foreground/60">The team side</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl leading-tight tracking-tight sm:text-4xl">
            An order walks a 13-state pipeline. The system holds its hand the whole way.
          </h2>

          {/* pipeline */}
          <ol className="mt-8 flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label="Order lifecycle">
            {PIPELINE.map((step, i) => (
              <li key={step} className="flex items-center gap-1.5">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10.5px] font-semibold tracking-wide ${
                    i === PIPELINE.length - 1
                      ? "border-brand-foreground/40 bg-brand-foreground/10 text-brand-foreground"
                      : "border-brand-foreground/20 text-brand-foreground/75"
                  }`}
                >
                  {step}
                </span>
                {i < PIPELINE.length - 1 && <span aria-hidden className="text-brand-foreground/40">→</span>}
              </li>
            ))}
            <li className="ml-2 text-[10.5px] font-medium tracking-wide text-brand-foreground/50">
              + CANCELLED pre-shipment · RETURN_REQUESTED → REFUNDED, all audit-recorded
            </li>
          </ol>

          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-brand-foreground/15 bg-brand-foreground/10 md:grid-cols-3">
            {OPS.map((o) => (
              <div key={o.title} className="bg-brand p-6">
                <o.icon className="h-5 w-5 text-brand-foreground/80" aria-hidden />
                <h3 className="mt-4 font-display text-lg">{o.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-brand-foreground/70">{o.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 max-w-2xl text-[13px] leading-relaxed text-brand-foreground/60">
            And when something goes wrong — a dead-on-arrival camera, a wrong count, a refund — the console already has
            the form for it: full RMA flow, count sessions, reason codes. Nothing lives in anyone's head.
          </p>
        </div>
      </section>

      {/* ---------- design story ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="label-caps">The design story</p>
            <h2 className="mt-2 font-display text-3xl leading-tight tracking-tight">
              This wasn't assembled from a template. It was drawn, argued over, and drawn again.
            </h2>
            <p className="mt-5 text-[14px] leading-relaxed text-muted-foreground">
              A shop that sells surveillance hardware is really selling one thing: <em>you can trust what we ship</em>.
              So the palette is warm paper and deep pine — calm, honest, grown-up — with a single brass accent reserved
              for moments that earn it. Display type is Fraunces, an editorial serif; body text is Inter, quiet at small
              sizes. Product photography sits in generous negative space instead of fighting for it.
            </p>
            <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
              The same discipline runs underneath: forms ask for information in the order a human would give it, prices
              never shift after the click, empty states explain themselves, and every destructive action wants you to be
              sure. Design isn't how it looks on launch day — it's how it behaves on the busiest day of the month.
            </p>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {CRAFT.map((c) => (
                <li key={c.title} className="flex items-start gap-3">
                  <c.icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-[13.5px] font-semibold">{c.title}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* palette + type specimen card */}
          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-4">
                {SWATCHES.map((s) => (
                  <div key={s.name} className="bg-card p-4">
                    <div className="h-16 w-full rounded-md border border-border/60" style={{ backgroundColor: s.hex }} />
                    <p className="mt-3 text-[12.5px] font-semibold">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">{s.hex}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s.note}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border px-6 py-7">
                <p className="label-caps">Type system</p>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <span className="font-display text-5xl leading-none">Aa</span>
                  <div>
                    <p className="text-sm font-semibold">Fraunces — display</p>
                    <p className="text-[12px] text-muted-foreground">headlines, prices, the voice of the shop</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <span className="text-4xl leading-none">Aa</span>
                  <div>
                    <p className="text-sm font-semibold">Inter — interface</p>
                    <p className="text-[12px] text-muted-foreground">body, tables, forms — never tired at 12px</p>
                  </div>
                </div>
                <p className="mt-6 border-t border-border/60 pt-4 text-[12.5px] leading-relaxed text-muted-foreground">
                  Rules of the house: brass is an accent, never a surface · brand bands stay pine day and night · motion
                  yields to <code className="rounded bg-muted px-1 py-0.5 text-[11px]">prefers-reduced-motion</code> ·
                  no AI-generated imagery, ever — the catalog shows real products.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- outcomes ---------- */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="label-caps">What the business gets</p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl tracking-tight">
            Not a website. A way of running the shop.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {OUTCOMES.map((o, i) => (
              <div key={o.title} className="rounded-lg border border-border bg-card p-6">
                <p className="font-display text-2xl text-primary/40">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-3 font-display text-xl">{o.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{o.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- closing CTA ---------- */}
      <section className="relative overflow-hidden bg-brand text-brand-foreground">
        <BandDecor />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-foreground/60">See it running</p>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              The best pitch is the product. Open it and click around.
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-brand-foreground/75">
              The storefront is fully browsable — search, compare, build a kit, place a COD order, track it back. Six
              months of realistic operating history is loaded, so every console and report shows real movement, not
              empty charts.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary" className="rounded-full px-6">
                <Link href="/products">
                  Browse the catalog <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-brand-foreground/30 bg-transparent px-6 text-brand-foreground hover:bg-brand-foreground/10 hover:text-brand-foreground"
              >
                <Link href="/track">Track a demo order</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-brand-foreground/30 bg-transparent px-6 text-brand-foreground hover:bg-brand-foreground/10 hover:text-brand-foreground"
              >
                <Link href="/about">Meet the shop</Link>
              </Button>
            </div>
            <p className="mt-6 text-[12.5px] text-brand-foreground/55">
              Operator &amp; demo credentials are held privately by the owner — see <code className="rounded bg-brand-foreground/10 px-1.5 py-0.5">docs/ROUTES.md</code> in the repository.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
