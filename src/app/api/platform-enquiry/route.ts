// POST /api/platform-enquiry — platform-pitch intake (showcase page).
// Audience: business owners who want a commerce platform like this one built
// for their trade. Leads land with the DEVELOPER — deliberately separate from
// /api/contact (the store's hardware trade desk).
// Flow: IP rate limit (5 per 10 min) -> zod platformEnquirySchema -> create
// PlatformInquiry row -> fire-and-forget developer ping (WhatsApp template
// when DEVELOPER_WHATSAPP + Cloud credentials exist; simulated no-op otherwise).

import { platformEnquirySchema } from "@/lib/validators";
import { clientIp, fail, ok, parseBody } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { DEVELOPER } from "@/lib/constants";
import { sendWhatsAppTemplate } from "@/server/services/notification.service";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`platenq:${ip}`, 5, 10 * 60 * 1000);
  if (!rl.ok) {
    return fail("Too many enquiries from this address — yours are already with the developer. Try again shortly.", 429, {
      retryAfterMs: rl.retryAfterMs,
    });
  }

  const { data, error } = await parseBody(req, platformEnquirySchema);
  if (error) return error;

  const inquiry = await db.platformInquiry.create({
    data: {
      name: data.name,
      contact: data.contact,
      interest: data.interest,
      message: data.message,
      status: "NEW",
    },
  });

  // Fire-and-forget ping to the DEVELOPER (never the buyer, never the shop's
  // trade desk). No-op unless DEVELOPER_WHATSAPP + WhatsApp Cloud credentials
  // are configured — the row itself is the durable record either way.
  if (DEVELOPER.whatsapp) {
    void sendWhatsAppTemplate(DEVELOPER.whatsapp, "platform_enquiry", [
      data.name,
      data.contact,
      data.interest,
      data.message,
    ]).catch(() => undefined);
  }

  return ok({ received: true, inquiryId: inquiry.id });
}
