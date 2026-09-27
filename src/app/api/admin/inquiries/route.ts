// GET /api/admin/inquiries — trade desk inbox for B2B/wholesale inquiries.
// Query: status=NEW|CONTACTED|CLOSED|ALL, q (name/phone/company search), page, perPage.

import type { NextRequest } from 'next/server';
import { fail, ok, requirePermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await requirePermission('inquiries');
  if (!session) return fail('Unauthorized', 401);

  const sp = req.nextUrl.searchParams;
  const statusRaw = sp.get('status') ?? 'ALL';
  const status = (['NEW', 'CONTACTED', 'CLOSED', 'ALL'].includes(statusRaw) ? statusRaw : 'ALL') as 'NEW' | 'CONTACTED' | 'CLOSED' | 'ALL';
  const q = sp.get('q')?.trim() || undefined;
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1);
  const perPage = Math.min(100, Math.max(1, Number(sp.get('perPage') ?? '20') || 20));

  const where: Prisma.B2BInquiryWhereInput = {
    ...(status !== 'ALL' ? { status } : {}),
    ...(q
      ? {
          // NOTE: SQLite contains is case-insensitive for ASCII; no `mode` here.
          OR: [{ name: { contains: q } }, { phone: { contains: q } }, { companyName: { contains: q } }, { email: { contains: q } }],
        }
      : {}),
  };

  const [total, openCount, rows] = await Promise.all([
    db.b2BInquiry.count({ where }),
    db.b2BInquiry.count({ where: { status: 'NEW' } }),
    db.b2BInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  // productId is a soft reference (id, slug or even SKU text) — resolve only
  // the ones that match a real product for the "Re:" deep link.
  const productIds = rows.map((r) => r.productId).filter((v): v is string => Boolean(v));
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds }, deletedAt: null },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const productById = new Map(products.map((p) => [p.id, p]));

  return ok({
    items: rows.map((r) => {
      const product = r.productId ? productById.get(r.productId) : undefined;
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        companyName: r.companyName,
        gstin: r.gstin,
        message: r.message,
        status: r.status,
        note: r.note,
        handledAt: r.handledAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        product: product ? { name: product.name, slug: product.slug } : null,
      };
    }),
    total,
    openCount,
    page,
    perPage,
  });
}
