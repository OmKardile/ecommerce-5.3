// POST /api/reviews — customer product reviews.
// Requires a customer session (phone OTP). One review per (product, user):
// re-submitting updates the existing row. New/edited reviews re-enter the
// moderation queue (isApproved = false). isVerified marks a verified purchase —
// the customer has a DELIVERED order containing that product.

import { reviewSchema } from "@/lib/validators";
import { fail, ok, parseBody } from "@/lib/api-helpers";
import { getCustomerSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return fail("Sign in with your mobile number to write a review.", 401);
  }

  const rl = rateLimit(`review:${session.userId}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return fail("Too many reviews submitted in the last hour — please try again later.", 429, {
      retryAfterMs: rl.retryAfterMs,
    });
  }

  const { data, error } = await parseBody(req, reviewSchema);
  if (error) return error;

  const product = await db.product.findFirst({
    where: { id: data.productId, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (!product) {
    return fail("Product not found.", 404);
  }

  // Verified purchase: a DELIVERED order of this customer containing the product.
  // (Order items carry SKUs; the product is reached through the SKU's variant.)
  const deliveredOrder = await db.order.findFirst({
    where: {
      userId: session.userId,
      status: "DELIVERED",
      items: { some: { sku: { variant: { productId: product.id } } } },
    },
    select: { id: true },
  });
  const isVerified = Boolean(deliveredOrder);

  const review = await db.review.upsert({
    where: { productId_userId: { productId: product.id, userId: session.userId } },
    update: {
      rating: data.rating,
      title: data.title || null,
      comment: data.comment,
      isVerified,
      isApproved: false, // edited reviews re-enter moderation
    },
    create: {
      productId: product.id,
      userId: session.userId,
      rating: data.rating,
      title: data.title || null,
      comment: data.comment,
      isVerified,
      isApproved: false,
    },
    select: { id: true },
  });

  return ok({ submitted: true, note: "pending approval", reviewId: review.id });
}
