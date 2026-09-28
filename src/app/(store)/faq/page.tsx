import type { Metadata } from "next";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageShell, ContentSection, ContentContainer, CtaBand } from "@/components/content/page-shell";
import { STORE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "FAQ — Buying, Installation, GST, Shipping & Returns",
  description:
    "Answers on HD analog vs IP cameras, surveillance HDD sizing, GST input tax credit for B2B buyers, the 4 PM dispatch cutoff, COD rules, the 7-day DOA replacement and warranty periods.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/faq" },
};

interface Faq {
  q: string;
  a: React.ReactNode;
}

const GROUPS: { id: string; label: string; faqs: Faq[] }[] = [
  {
    id: "buying",
    label: "Buying",
    faqs: [
      {
        q: "HD analog or IP cameras — which system should I buy?",
        a: (
          <>
            <p>
              HD analog (HDCVI / AHD / TVI) sends uncompressed video over existing coaxial cable and is the
              lower-cost choice for small sites — shops, offices, homes — where runs stay under roughly 300 metres.
              IP cameras send compressed digital video over Cat6 ethernet, carry power on the same cable via PoE, and
              are the right call when you need AI analytics (human/vehicle detection, line crossing), runs beyond
              300 m, or buildings linked by fiber media converters.
            </p>
            <p>
              As a rule of thumb: an 8-channel HD analog DVR with 2MP/4MP cameras is the value pick for small sites;
              4MP/8MP PoE IP cameras on a 16-channel NVR justify their premium on factories and campuses. The{" "}
              <Link href="/blog/hd-analog-vs-ip-cameras" className="underline underline-offset-2 hover:text-foreground">
                full comparison
              </Link>{" "}
              walks through cabling and storage.
            </p>
          </>
        ),
      },
      {
        q: "How much hard drive storage do I need for recording?",
        a: (
          <p>
            Retention is bitrate-driven. At H.265, four 2MP cameras recording motion-weighted footage fit roughly 15–30
            days on a 1TB surveillance drive. Heavier cameras scale accordingly: 4MP doubles the space, 8MP (4K)
            quadruples it. A worked table for common setups is in the{" "}
            <Link
              href="/blog/surveillance-hdd-retention-calculator"
              className="underline underline-offset-2 hover:text-foreground"
            >
              HDD sizing guide
            </Link>
            , and the kit builder estimates retention for the drive you select. Use surveillance-rated drives (WD
            Purple class) — desktop drives are not built for 24/7 write loads.
          </p>
        ),
      },
      {
        q: "Are the prices on the site GST-inclusive?",
        a: (
          <p>
            Yes. Every listed price includes 18% GST. For Gujarat deliveries the invoice splits it as CGST + SGST;
            for other states it is charged as IGST. Business buyers can enter a GSTIN at checkout and receive a tax
            invoice usable for input tax credit.
          </p>
        ),
      },
      {
        q: "Can I buy a complete camera kit in one order?",
        a: (
          <p>
            Yes — the{" "}
            <Link href="/kit-builder" className="underline underline-offset-2 hover:text-foreground">
              kit builder
            </Link>{" "}
            assembles a compatible set in five steps (recorder, cameras, drive, cable and connectors) and applies a 5%
            bundle discount when the kit is added to the cart. Everything arrives as individual, invoiceable line
            items.
          </p>
        ),
      },
      {
        q: "Why do some products say “prepaid only”?",
        a: (
          <p>
            Cash on delivery is enabled selectively — per product and per delivery zone. High-value items are prepaid
            only to keep dispatch risk manageable. If a product page shows a card or “prepaid only” badge, that item
            must be paid online (UPI, cards or netbanking via Razorpay).
          </p>
        ),
      },
    ],
  },
  {
    id: "installation",
    label: "Installation",
    faqs: [
      {
        q: "Do you provide installation services?",
        a: (
          <p>
            Patel Networks is a hardware counter, not an installation contractor. We supply the equipment and support
            it with specifications, cable-length guidance and recorder configuration help; the physical installation
            is carried out by your electrician, CCTV installer or systems integrator. For Surat-area sites, the trade
            desk can point you toward installers who work with the brands we stock — ask on the{" "}
            <Link href="/contact" className="underline underline-offset-2 hover:text-foreground">
              consultation desk
            </Link>
            .
          </p>
        ),
      },
      {
        q: "Can new HD cameras reuse the coax cable already in my walls?",
        a: (
          <p>
            Usually yes — that is the main argument for HD analog. HDCVI/AHD/TVI signals run over the same RG59-style
            coax used by older analog systems for runs up to roughly 300 metres, so an upgrade often means swapping
            the camera and DVR without re-cabling. If the old cable is damaged or the run is longer, re-pull coax or
            move to IP over Cat6.
          </p>
        ),
      },
      {
        q: "Do IP cameras need a separate power supply?",
        a: (
          <p>
            No, if your NVR or switch provides PoE (Power over Ethernet) — one Cat6 cable per camera carries both
            power and video, which is cleaner to install. Analog cameras take 12V DC from an SMPS power supply over
            the DC connector alongside the coax. Check the PoE budget of the NVR or switch against the cameras you
            plan to connect.
          </p>
        ),
      },
    ],
  },
  {
    id: "gst-b2b",
    label: "GST & B2B",
    faqs: [
      {
        q: "How do I claim GST input tax credit on my purchase?",
        a: (
          <>
            <p>Four steps:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Toggle “Use GSTIN for business input tax credit” at checkout.</li>
              <li>Enter your legal business name and 15-character GSTIN exactly as registered.</li>
              <li>The generated tax invoice carries your details, our GSTIN and HSN codes per line.</li>
              <li>The credit appears in your GSTR-2B after we file GSTR-1 for the period.</li>
            </ol>
            <p>
              Keep the invoice with the serial numbers recorded at dispatch — brand warranty claims are matched the
              same way.
            </p>
          </>
        ),
      },
      {
        q: "Do you offer trade or wholesale pricing for installers?",
        a: (
          <p>
            Yes. Contractors, system integrators and resellers get tiered pricing through the trade desk rather than a
            public price list. Send your requirement and monthly volumes via the{" "}
            <Link href="/contact" className="underline underline-offset-2 hover:text-foreground">
              consultation form
            </Link>{" "}
            — the desk responds within one working day.
          </p>
        ),
      },
      {
        q: "Can our institution pay by bank transfer or purchase order?",
        a: (
          <p>
            Bank transfer details are shared on request for orders above online limits. NEFT/RTGS settlement is
            against a GST tax invoice, and purchase-order backed supply is available for government, institutional
            and AMC customers. Raise it with the trade desk before confirming the order.
          </p>
        ),
      },
    ],
  },
  {
    id: "shipping",
    label: "Shipping",
    faqs: [
      {
        q: "When does my order dispatch?",
        a: (
          <p>
            Orders paid before {STORE.dispatchCutoff} on a working day are packed and handed to the carrier the same
            day from our Surat hub; orders paid after the cutoff move to the next working day&apos;s dispatch. You
            receive the AWB/tracking number on WhatsApp and in your account once the label is generated.
          </p>
        ),
      },
      {
        q: "Which carriers do you ship with, and how long does delivery take?",
        a: (
          <p>
            Shipments move through Delhivery and the Shiprocket carrier network, with BlueDart used for
            air-consignments — lithium-containing items (some IP cameras with batteries) and heavier consignments
            travel by air where the zone demands it. Indicative transit: Gujarat 1–2 working days, major metros 2–3,
            regional hubs 3–4, remote/special zones 5–7. The exact estimate for your pincode is shown by the pincode
            checker on each product page.
          </p>
        ),
      },
      {
        q: "Is cash on delivery (COD) available for my order?",
        a: (
          <p>
            COD is selective. It is enabled per product (prepaid-only items are excluded), capped at ₹15,000 per
            order, and unavailable in remote/special zones such as 78x/79x, 19x and 744 pincodes. Whether a product
            qualifies for your pincode is confirmed by the pincode checker before checkout.
          </p>
        ),
      },
      {
        q: "How do I know my pincode is serviceable?",
        a: (
          <p>
            Enter the six-digit pincode in the delivery checker on any product page. It returns the delivery zone,
            expected delivery window and whether COD is available. Zones and transit days are also published in the{" "}
            <Link href="/shipping-policy" className="underline underline-offset-2 hover:text-foreground">
              shipping policy
            </Link>
            .
          </p>
        ),
      },
    ],
  },
  {
    id: "returns",
    label: "Returns",
    faqs: [
      {
        q: "What if an item arrives dead or damaged (DOA)?",
        a: (
          <p>
            Dead-on-arrival units are replaced under our 7-day DOA window: report within 7 days of delivery with the
            order number and a photo/video of the fault, and the unit is swapped after the carrier picks it up — no
            repair wait. The process and exclusions are detailed in the{" "}
            <Link href="/return-policy" className="underline underline-offset-2 hover:text-foreground">
              return policy
            </Link>
            .
          </p>
        ),
      },
      {
        q: "How long is the warranty on cameras, recorders and drives?",
        a: (
          <p>
            Manufacturer warranty applies: CP Plus, Hikvision and Dahua cameras and recorders carry 2 years; WD
            Purple surveillance drives carry 3 years. The exact period for every SKU is printed on its product page
            and your invoice, and serial numbers captured at dispatch make the claim traceable to your order.
          </p>
        ),
      },
      {
        q: "Can I return installed equipment or cut cable?",
        a: (
          <p>
            No. Installed or commissioned items, and cable cut to length, cannot be returned — they are
            non-resalable and warranty on them is handled as a manufacturer RMA instead. Uninstalled items in
            original, undamaged packaging fall under the 7-day DOA/replacement process.
          </p>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <PageShell
      eyebrow="Frequently asked questions"
      title="Before you buy, and after"
      lede="Straight answers on choosing hardware, claiming GST credit, dispatch timelines and warranty — the questions our counter fields every day."
    >
      <ContentContainer>
        {/* Jump nav */}
        <nav aria-label="FAQ categories" className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-6">
          {GROUPS.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="link-underline text-[13px] font-medium text-muted-foreground hover:text-foreground"
            >
              {g.label}
            </a>
          ))}
        </nav>

        {GROUPS.map((group, gi) => (
          <ContentSection id={group.id} eyebrow={`Section 0${gi + 1}`} title={group.label} key={group.id}>
            <Accordion type="single" collapsible className="w-full">
              {group.faqs.map((faq, i) => (
                <AccordionItem key={faq.q} value={`${group.id}-${i}`}>
                  <AccordionTrigger className="text-left text-[15px] font-medium leading-snug hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-[14px] leading-relaxed text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ContentSection>
        ))}

        <div className="border-t border-border pt-10 pb-4 lg:pb-8">
          <CtaBand
            title="Question not covered here?"
            body="The trade desk answers specification, GST and delivery questions by phone, WhatsApp or the consultation form."
            href="/contact"
            ctaLabel="Ask the trade desk"
            secondaryHref="/shipping-policy"
            secondaryLabel="Read the shipping policy"
          />
        </div>
      </ContentContainer>
    </PageShell>
  );
}
