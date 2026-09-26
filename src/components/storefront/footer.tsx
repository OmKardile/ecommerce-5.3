import Link from "next/link";
import { Phone, Mail, MapPin, ShieldCheck, Truck, FileText } from "lucide-react";
import { STORE } from "@/lib/constants";

const shopLinks = [
  { href: "/products?category=cctv-surveillance", label: "CCTV & Surveillance" },
  { href: "/products?category=displays-screens", label: "Displays & Screens" },
  { href: "/products?category=cables-wiring", label: "Cables & Wiring" },
  { href: "/products?category=connectors-accessories", label: "Connectors & Accessories" },
  { href: "/products?category=media-converters-optical", label: "Media Converters & Optical" },
  { href: "/kit-builder", label: "CCTV Kit Builder" },
  { href: "/brands", label: "All Brands" },
];

const accountLinks = [
  { href: "/account", label: "My Account" },
  { href: "/account/orders", label: "Orders & Tracking" },
  { href: "/account/addresses", label: "Address Book" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/track", label: "Track Order" },
  { href: "/contact", label: "B2B / Wholesale Desk" },
];

const policyLinks = [
  { href: "/about", label: "About Us" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/return-policy", label: "Return & Warranty Policy" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Sale" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      {/* trust strip */}
      <div className="border-b border-border">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
          {[
            { icon: ShieldCheck, title: "Genuine hardware", body: "Authorized distribution with brand warranties and serial-tracked RMA." },
            { icon: Truck, title: "Surat hub dispatch", body: "Same-day handover to carrier for orders paid before 4:00 PM IST." },
            { icon: FileText, title: "GST tax invoices", body: "CGST/SGST & IGST compliant invoices for B2B input tax credit." },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* main footer */}
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <p className="font-display text-xl font-semibold">Patel Networks</p>
          <p className="label-caps mt-1 !text-[9px] !tracking-[0.3em]">MEGATECH · SURAT</p>
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            Commercial CCTV, surveillance and structured networking hardware for retail buyers, installers and system
            integrators across India.
          </p>
          <div className="mt-4 space-y-2 text-[13px] text-muted-foreground">
            <p className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" /> Surat Central Hub, Gujarat 395003
            </p>
            <a href={`tel:${STORE.supportPhone.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-foreground">
              <Phone className="h-3.5 w-3.5" /> {STORE.supportPhone}
            </a>
            <a href={`mailto:${STORE.email}`} className="flex items-center gap-2 hover:text-foreground">
              <Mail className="h-3.5 w-3.5" /> {STORE.email}
            </a>
          </div>
        </div>

        <nav aria-label="Shop">
          <p className="label-caps">Shop</p>
          <ul className="mt-4 space-y-2.5">
            {shopLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-[13px] text-muted-foreground hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account">
          <p className="label-caps">Account</p>
          <ul className="mt-4 space-y-2.5">
            {accountLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-[13px] text-muted-foreground hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company and policy">
          <p className="label-caps">Company</p>
          <ul className="mt-4 space-y-2.5">
            {policyLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-[13px] text-muted-foreground hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Patel Networks (MegaTech). GSTIN {STORE.gstin}. All rights reserved.</p>
          <p>
            Payments secured by Razorpay · Shipping by Shiprocket &amp; Delhivery · Jurisdiction: Surat, Gujarat
          </p>
        </div>
      </div>
    </footer>
  );
}
