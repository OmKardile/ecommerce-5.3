import { ok, fail } from '@/lib/api-helpers';
import { getCustomerSession } from '@/lib/session';
import { db } from '@/lib/db';

export async function POST(_req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const session = await getCustomerSession();
  if (!session) return fail('Login required', 401);
  const { productId } = await params;
  const wishlist = await db.wishlist.upsert({ where: { userId: session.userId }, update: {}, create: { userId: session.userId } });
  const existing = await db.wishlistItem.findUnique({ where: { wishlistId_productId: { wishlistId: wishlist.id, productId } } });
  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
    return ok({ added: false });
  }
  await db.wishlistItem.create({ data: { wishlistId: wishlist.id, productId } });
  return ok({ added: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const session = await getCustomerSession();
  if (!session) return fail('Login required', 401);
  const { productId } = await params;
  const wishlist = await db.wishlist.findUnique({ where: { userId: session.userId } });
  if (wishlist) await db.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id, productId } });
  return ok({ removed: true });
}
