import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Boxes, ReceiptText, HardHat, MapPin, Phone } from "lucide-react";
import { PageShell, ContentSection, ContentContainer, CtaBand } from "@/components/content/page-shell";
import { getBrands } from "@/server/services/catalog.service";
import { STORE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About Patel Networks — Surveillance & Networking Hardware from Surat | MegaTech",
  description:
    "Patel Networks (MegaTech) is a Surat-based distributor of CCTV, surveillance and networking hardware — authorized Hikvision, Dahua, CP Plus, WD and D-Link stock with GST invoicing and serial-tracked warranty.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/about" },
};

const VALUE_BLOCKS = [
  {
    icon: ShieldCheck,
    title: "Authorized, genuine hardware",
    body: "We stock Hikvision, Dahua, CP Plus, WD and D-Link through authorized supply. Every recorder, camera and drive carries the manufacturer's India warranty, and serial numbers are recorded at dispatch so a warranty claim never depends on a paper trail you have lost.",
  },
  {
    icon: Boxes,
    title: "SKU-level inventory discipline",
    body: "Stock is tracked per SKU, not per shelf. Available quantity is the difference between received stock and live reservations, and every movement — purchase receipt, order reservation, dispatch, return restock — is written to an immutable movement log.",
  },
  {
    icon: ReceiptText,
    title: "GST-first commerce",
    body: "Prices are GST-inclusive and every order gets a proper tax invoice: CGST and SGST for Gujarat deliveries, IGST for the rest of India, HSN codes per line. Business buyers add a GSTIN at checkout and the same invoice feeds their input tax credit.",
  },
  {
    icon: HardHat,
    title: "A trade desk for installers",
    body: "Contractors, system integrators and electrical consultants get a dedicated consultation desk: specification help, kit pricing with a 5% bundle discount, and bank-transfer settlement for institutional orders above online limits.",
  },
] as const;

export default async function AboutPage() {
  const brands = await getBrands();

  return (
    <PageShell
      eyebrow="About Patel Networks"
      title="A counter, a warehouse, and a ledger that adds up"
      lede="Patel Networks — trading as MegaTech — supplies CCTV, surveillance and structured networking hardware to retail buyers, installers and system integrators across India, from a single fulfillment hub in Surat, Gujarat."
      aside="Surat, Gujarat · Origin PIN 395003"
    >
      <ContentContainer>
        {/* Story */}
        <ContentSection eyebrow="The business" title="Surveillance hardware, specified right" first>
          <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              Patel Networks began as a trade counter serving electricians and security contractors in Surat&apos;s
              commercial hardware market, and grew into a focused distribution business under the MegaTech name. The
              trade is specific: cameras, recorders, surveillance-rated storage, cable, connectors and the networking
              hardware that ties a site together. We do not sell general electronics — depth in one category is the
              service.
            </p>
            <p>
              Customers are of two kinds. Walk-in and online retail buyers fitting a shop, office, home or farm need a
              working kit at a fair price — recorder, cameras, drive, cable — which is why the site offers a guided{" "}
              <Link href="/kit-builder" className="underline underline-offset-2 hover:text-foreground">
                kit builder
              </Link>{" "}
              that assembles a compatible set in five steps. Installers and system integrators buying for client sites
              need repeatable SKUs, GST invoices that survive an accountant&apos;s review, and stock positions they can
              trust.
            </p>
            <p>
              Both kinds of customer get the same operating standard: genuine goods from authorized supply, honest
              stock numbers, same-day carrier handover for paid orders before the {STORE.dispatchCutoff} cutoff, and a
              warranty process built on serial numbers rather than goodwill.
            </p>
          </div>
        </ContentSection>

        {/* Value blocks */}
        <ContentSection eyebrow="How we operate" title="Four commitments behind every order">
          <div className="grid gap-4 sm:grid-cols-2">
            {VALUE_BLOCKS.map((block) => (
              <div key={block.title} className="rounded-lg border border-border bg-card p-6">
                <block.icon className="h-5 w-5 text-primary" aria-hidden />
                <h3 className="mt-4 font-display text-lg leading-snug tracking-tight">{block.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{block.body}</p>
              </div>
            ))}
          </div>
        </ContentSection>

        {/* Serial-tracked warranty explainer */}
        <ContentSection eyebrow="Warranty discipline" title="Serial numbers, not goodwill">
          <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              Surveillance hardware is warranted by its manufacturer, and manufacturers settle claims by serial
              number. So serials are captured for warranty-bearing items at the moment of dispatch and stored against
              the order line. When something fails inside the warranty window, the replacement claim is matched to the
              exact unit that shipped — which is also what our{" "}
              <Link href="/return-policy" className="underline underline-offset-2 hover:text-foreground">
                return and warranty policy
              </Link>{" "}
              requires for a fast RMA.
            </p>
            <div className="rounded-lg border border-border bg-muted/50 p-5">
              <p className="label-caps !text-[10px]">Typical manufacturer warranty periods</p>
              <ul className="mt-3 space-y-1.5 text-[13px] text-foreground/90">
                <li>CP Plus, Hikvision and Dahua cameras and recorders — 2 years</li>
                <li>WD Purple surveillance drives — 3 years</li>
                <li>The exact period for each product is printed on its product page and invoice</li>
              </ul>
            </div>
          </div>
        </ContentSection>

        {/* Brand list */}
        <ContentSection eyebrow="Brands we carry" title="Authorized distribution across the stack">
          <p className="text-[15px] leading-relaxed text-foreground/90">
            The catalog concentrates on brands with Indian service networks and documented warranty terms — the names
            an installer can put in a client bill of quantities without hesitation.
          </p>
          <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {brands.map((brand) => (
              <li key={brand.id} className="border-t border-border pt-3">
                <Link href={`/brands/${brand.slug}`} className="group flex items-baseline justify-between gap-4">
                  <span className="font-display text-lg tracking-tight group-hover:underline group-hover:underline-offset-4">
                    {brand.name}
                  </span>
                  <span className="label-caps shrink-0 !text-[10px]">
                    {brand._count.products} product{brand._count.products === 1 ? "" : "s"}
                  </span>
                </Link>
                {brand.description ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{brand.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </ContentSection>

        {/* Hub / facts */}
        <ContentSection eyebrow="The hub" title="Everything ships from Surat">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6">
              <MapPin className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-4 font-display text-lg tracking-tight">One warehouse, every order</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Fulfillment runs from the Surat Central hub (origin PIN {STORE.originPin}, state code{" "}
                {STORE.originStateCode}). Orders paid before {STORE.dispatchCutoff} are handed to the carrier the same
                working day; Gujarat deliveries typically arrive in 1–2 days, metros in 2–3.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <Phone className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-4 font-display text-lg tracking-tight">Reachable by phone, not just forms</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Specification questions are answered by counter engineers — call{" "}
                <a
                  href={`tel:${STORE.supportPhone.replace(/\s/g, "")}`}
                  className="text-foreground underline underline-offset-2"
                >
                  {STORE.supportPhone}
                </a>{" "}
                during business hours, or message the trade desk on WhatsApp. B2B pricing and institutional orders go
                through the{" "}
                <Link href="/contact" className="text-foreground underline underline-offset-2">
                  consultation desk
                </Link>
                .
              </p>
            </div>
          </div>
        </ContentSection>

        <div className="border-t border-border pt-10 pb-4 lg:pb-8">
          <CtaBand
            title="Specifying a site? Talk it through first."
            body="Send the camera count, cable runs and storage window you need — the trade desk replies with a bill of materials and a GST quotation."
            href="/contact"
            ctaLabel="Contact the trade desk"
            secondaryHref="/products"
            secondaryLabel="Browse the catalog"
          />
        </div>
      </ContentContainer>
    </PageShell>
  );
}
