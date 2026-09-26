import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/products", "/kit-builder", "/brands", "/blog", "/about", "/contact", "/faq"],
        disallow: ["/admin", "/admin/*", "/account", "/account/*", "/checkout", "/api/*", "/cart"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
