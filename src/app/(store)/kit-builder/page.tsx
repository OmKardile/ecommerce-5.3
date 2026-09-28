import type { Metadata } from "next";
import { db } from "@/lib/db";
import { KitBuilderWizard, type KitData, type KitProduct, type KitVariant } from "@/components/storefront/kit-builder-wizard";

export const metadata: Metadata = {
  title: "CCTV Kit Builder — 5-step surveillance bundle",
  description:
    "Pick a recorder, cameras bounded by channels, surveillance storage, cabling and connectors. Automatic 5% bundle discount, GST-inclusive.",
  robots: { index: true, follow: true },
};

type ProductWithVariants = {
  id: string;
  slug: string;
  name: string;
  brand: { name: string } | null;
  variants: {
    skuId: string;
    name: string;
    attributes: string;
    sku: {
      code: string;
      mrp: number;
      sellingPrice: number;
      inventory: { currentStock: number; reservedStock: number } | null;
    };
  }[];
};

function toKitProduct(p: ProductWithVariants): KitProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brandName: p.brand?.name ?? "",
    variants: p.variants.map((v): KitVariant => {
      let attributes: Record<string, string> = {};
      try {
        const parsed: unknown = JSON.parse(v.attributes);
        if (parsed && typeof parsed === "object") {
          attributes = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([k, val]) => [k, String(val)]));
        }
      } catch {
        attributes = {};
      }
      const available = v.sku.inventory ? Math.max(v.sku.inventory.currentStock - v.sku.inventory.reservedStock, 0) : 0;
      return {
        skuId: v.skuId,
        skuCode: v.sku.code,
        name: v.name,
        pricePaise: v.sku.sellingPrice,
        mrpPaise: v.sku.mrp,
        availableStock: available,
        inStock: available > 0,
        attributes,
      };
    }),
  };
}

async function loadCategoryProducts(slugs: string[]): Promise<ProductWithVariants[]> {
  const rows = await db.category.findMany({
    where: { slug: { in: slugs }, isActive: true },
    select: {
      products: {
        where: { isActive: true, deletedAt: null },
        select: {
          id: true,
          slug: true,
          name: true,
          brand: { select: { name: true } },
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" as const },
            select: {
              skuId: true,
              name: true,
              attributes: true,
              sku: {
                select: {
                  code: true,
                  mrp: true,
                  sellingPrice: true,
                  inventory: { select: { currentStock: true, reservedStock: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  return rows.flatMap((c) => c.products as ProductWithVariants[]);
}

async function loadConnectorVariant(slug: string): Promise<KitVariant | null> {
  const found = await db.product.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      brand: { select: { name: true } },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" as const },
        select: {
          skuId: true,
          name: true,
          attributes: true,
          sku: {
            select: {
              code: true,
              mrp: true,
              sellingPrice: true,
              inventory: { select: { currentStock: true, reservedStock: true } },
            },
          },
        },
      },
    },
  });
  if (!found) return null;
  const mapped = toKitProduct(found as ProductWithVariants);
  return mapped.variants[0] ?? null;
}

export default async function KitBuilderPage() {
  const [recorders, analogCameras, ipCameras, hdds, coaxCables, ethernetCables, bundle, bncConnector, rj45Connector] =
    await Promise.all([
      loadCategoryProducts(["dvr-nvr-recorders"]),
      loadCategoryProducts(["hd-analog-cameras"]),
      loadCategoryProducts(["ip-network-cameras"]),
      loadCategoryProducts(["surveillance-storage"]),
      loadCategoryProducts(["cctv-coaxial-cable"]),
      loadCategoryProducts(["ethernet-cable"]),
      db.bundle.findUnique({ where: { slug: "custom-cctv-kit" }, select: { discountPct: true } }),
      loadConnectorVariant("axpial-bnc-dc-connector-pack"),
      loadConnectorVariant("mtc-rj45-cat6-keystone-kit"),
    ]);

  const data: KitData = {
    recorders: recorders.map(toKitProduct),
    analogCameras: analogCameras.map(toKitProduct),
    ipCameras: ipCameras.map(toKitProduct),
    hdds: hdds.map(toKitProduct),
    coaxCables: coaxCables.map(toKitProduct),
    ethernetCables: ethernetCables.map(toKitProduct),
    bncConnector,
    rj45Connector,
    discountPct: bundle?.discountPct ?? 5,
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="max-w-2xl">
        <p className="label-caps">Kit builder</p>
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
          Build your surveillance kit in five steps
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Recorder first, cameras sized to its channels, then storage, cabling and termination.
          Camera quantities are capped by the recorder&apos;s channel capacity, and the whole kit
          ships with an automatic {data.discountPct}% bundle discount.
        </p>
      </header>

      <KitBuilderWizard data={data} />
    </div>
  );
}
