import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getBrands } from "@/server/services/catalog.service";

export const metadata: Metadata = {
  title: "Brands — Surveillance & Networking Hardware",
  description:
    "Hikvision, Dahua, CP Plus, D-Link, Optilink and more — the brands we stock, warrant and support from our Surat hub.",
  robots: { index: true, follow: true },
};

export default async function BrandsPage() {
  const brands = await getBrands();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="max-w-2xl">
        <p className="label-caps">Brands</p>
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
          Hardware we stand behind
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Every brand in our catalog is stocked genuine, warranted by the manufacturer and supported
          by our counter engineers in Surat.
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <Link
            key={brand.id}
            href={`/brands/${brand.slug}`}
            className="group flex flex-col rounded-lg border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl tracking-tight">{brand.name}</h2>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                aria-hidden
              />
            </div>
            {brand.description && (
              <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{brand.description}</p>
            )}
            <p className="label-caps mt-auto pt-5 !text-[10px]">
              {brand._count.products} product{brand._count.products === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
