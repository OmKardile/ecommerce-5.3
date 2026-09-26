import { ok } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { CART_COOKIE } from '@/lib/constants';
import { getCustomerSession } from '@/lib/session';

export async function POST() {
  const session = await getCustomerSession();
  const cart = session
    ? await db.cart.findUnique({ where: { userId: session.userId } })
    : await db.cart.findUnique({ where: { guestToken: (await cookies()).get(CART_COOKIE)?.value } });
  if (cart) await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  return ok({ cleared: true });
}
