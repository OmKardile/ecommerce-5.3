import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = [
    "", "/products", "/kit-builder", "/brands", "/cart", "/track", "/about", "/contact", "/faq",
    "/blog", "/shipping-policy", "/return-policy", "/privacy-policy", "/terms", "/login", "/showcase",
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/products" ? 0.9 : 0.5,
  }));

  try {
    const [products, categories] = await Promise.all([
      db.product.findMany({ where: { isActive: true, deletedAt: null }, select: { slug: true, updatedAt: true } }),
      db.category.findMany({ where: { isActive: true }, select: { slug: true } }),
    ]);
    return [
      ...statics,
      ...categories.map((c) => ({ url: `${BASE}/products?category=${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...products.map((p) => ({ url: `${BASE}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ];
  } catch {
    return statics;
  }
}
