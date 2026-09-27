// GET /api/admin/reviews — moderation queue for customer product reviews.
// Query: status=PENDING|APPROVED|ALL (default PENDING), q (product / phone /
// reviewer / text search), page, perPage.
// New reviews arrive with isApproved=false (see POST /api/reviews) and stay
// invisible on the PDP until approved here.

import type { NextRequest } from 'next/server';
import { fail, ok, requirePermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await requirePermission('reviews');
  if (!session) return fail('Unauthorized', 401);

  const sp = req.nextUrl.searchParams;
  const statusRaw = sp.get('status') ?? 'PENDING';
  const status = (['PENDING', 'APPROVED', 'ALL'].includes(statusRaw) ? statusRaw : 'PENDING') as
    | 'PENDING'
    | 'APPROVED'
    | 'ALL';
  const q = sp.get('q')?.trim() || undefined;
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1);
  const perPage = Math.min(100, Math.max(1, Number(sp.get('perPage') ?? '20') || 20));

  const where: Prisma.ReviewWhereInput = {
    ...(status === 'PENDING' ? { isApproved: false } : status === 'APPROVED' ? { isApproved: true } : {}),
    ...(q
      ? {
          // NOTE: SQLite contains is case-insensitive for ASCII; no `mode` here.
          OR: [
            { title: { contains: q } },
            { comment: { contains: q } },
            { user: { is: { OR: [{ fullName: { contains: q } }, { phone: { contains: q } }] } } },
            { product: { is: { OR: [{ name: { contains: q } }, { slug: { contains: q } }] } } },
          ],
        }
      : {}),
  };

  const [total, pendingCount, rows] = await Promise.all([
    db.review.count({ where }),
    db.review.count({ where: { isApproved: false } }),
    db.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        isApproved: true,
        isVerified: true,
        createdAt: true,
        user: { select: { fullName: true, phone: true } },
        product: {
          select: {
            name: true,
            slug: true,
            images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true, altText: true } },
          },
        },
      },
    }),
  ]);

  return ok({
    items: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      isApproved: r.isApproved,
      isVerified: r.isVerified,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      product: {
        name: r.product.name,
        slug: r.product.slug,
        image: r.product.images[0]?.url ?? null,
      },
    })),
    total,
    pendingCount,
    page,
    perPage,
  });
}
