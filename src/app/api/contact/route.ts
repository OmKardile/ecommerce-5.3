// POST /api/contact — B2B / wholesale inquiry intake.
// Flow: IP rate limit (5 per 10 min) -> zod b2bInquirySchema -> create B2BInquiry
// row -> fire-and-forget WhatsApp trade-desk notification (simulated without
// credentials, per ADR-007/013).

import { b2bInquirySchema } from "@/lib/validators";
import { clientIp, fail, ok, parseBody } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { sendWhatsAppTemplate } from "@/server/services/notification.service";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`b2b:${ip}`, 5, 10 * 60 * 1000);
  if (!rl.ok) {
    return fail("Too many inquiries from this address — the trade desk already has your earlier ones. Try again shortly.", 429, {
      retryAfterMs: rl.retryAfterMs,
    });
  }

  const { data, error } = await parseBody(req, b2bInquirySchema);
  if (error) return error;

  // The form's optional "product or SKU reference" accepts a product id, a
  // product URL slug or a SKU code. Resolve to the canonical product id when
  // possible; otherwise keep the free-text reference for the trade desk.
  let productId: string | null = null;
  const ref = data.productId?.trim();
  if (ref) {
    const byIdOrSlug = await db.product.findFirst({
      where: { deletedAt: null, OR: [{ id: ref }, { slug: ref.toLowerCase() }] },
      select: { id: true },
    });
    const bySku = byIdOrSlug
      ? null
      : await db.product.findFirst({
          where: { deletedAt: null, variants: { some: { sku: { code: ref.toUpperCase() } } } },
          select: { id: true },
        });
    productId = (byIdOrSlug ?? bySku)?.id ?? ref;
  }

  const inquiry = await db.b2BInquiry.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      companyName: data.companyName || null,
      gstin: data.gstin || null,
      message: data.message,
      productId,
      status: "NEW",
    },
  });

  // Fire-and-forget: never block the HTTP response on the notification.
  void sendWhatsAppTemplate(data.phone, "b2b_quote_inquiry", [data.name, data.message]).catch(() => undefined);

  return ok({ received: true, inquiryId: inquiry.id });
}
