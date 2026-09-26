import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, FileText, Heart, MapPin, Package, ShieldCheck } from "lucide-react";
import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccountProfileForm, SignOutButton } from "@/components/storefront/account-profile-form";

export const metadata: Metadata = {
  title: "My Account",
  description: "Profile, orders, addresses and wishlist for Patel Networks customers.",
};

export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login?next=%2Faccount");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { customer: { include: { addresses: true } } },
  });
  if (!user) redirect("/account/login");

  const [ordersCount, spendAgg] = await Promise.all([
    db.order.count({ where: { userId: user.id } }),
    db.order.aggregate({ where: { userId: user.id, status: { not: { in: ["CANCELLED", "PENDING_PAYMENT"] } } }, _sum: { totalAmount: true } }),
  ]);
  const customer = user.customer;
  const fullName = customer?.fullName ?? user.fullName ?? `Customer ${user.phone.slice(-4)}`;
  const addresses = customer?.addresses ?? [];

  const cards = [
    { href: "/account/orders", label: "Orders", value: String(ordersCount), sub: ordersCount === 1 ? "order placed" : "orders placed", icon: Package },
    { href: "/account/wishlist", label: "Wishlist", value: "Saved", sub: "gear for the next install", icon: Heart },
    { href: "/account/addresses", label: "Addresses", value: String(addresses.length), sub: addresses.length === 1 ? "saved address" : "saved addresses", icon: MapPin },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps mb-2">Your account</p>
          <h1 className="font-display text-3xl sm:text-4xl">Namaste, {fullName.split(" ")[0]}.</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>+91 {user.phone.replace(/\D/g, "").slice(-10)}</span>
            {customer?.gstin && (
              <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                <Building2 className="h-3 w-3" aria-hidden /> B2B · {customer.gstin}
              </Badge>
            )}
            {spendAgg._sum.totalAmount ? (
              <span className="text-xs">
                Lifetime value <span className="font-display text-sm font-semibold text-foreground">{formatINR(spendAgg._sum.totalAmount)}</span>
              </span>
            ) : null}
          </div>
        </div>
        <SignOutButton />
      </header>

      {/* quick cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-center justify-between rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/60"
          >
            <div className="flex items-center gap-3.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-primary">
                <card.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">{card.label}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-display text-sm font-semibold text-foreground">{card.value}</span> · {card.sub}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        <section aria-label="Profile details" className="rounded-lg border border-border bg-card p-5 sm:p-6 lg:col-span-8">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-lg">Profile details</h2>
          </div>
          <AccountProfileForm
            profile={{
              fullName,
              phone: user.phone,
              companyName: customer?.companyName ?? "",
              gstin: customer?.gstin ?? "",
            }}
          />
        </section>

        <aside className="space-y-4 lg:col-span-4" aria-label="Helpful links">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-display text-base">Invoices & GST</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Every order has a printable GST tax invoice with the CGST/SGST split your accountant needs. B2B buyers: keep your GSTIN saved so checkout prefills it.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 h-8">
              <Link href="/account/orders">
                <FileText className="h-3.5 w-3.5" aria-hidden /> Find an invoice
              </Link>
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-5 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Need a bulk quote?</p>
            <p className="mt-1">
              The B2B desk prices multi-unit kits for contractors and institutions — mention your BOQ when you call {`+91 98765 43210`}.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
