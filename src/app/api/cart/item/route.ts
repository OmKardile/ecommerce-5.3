import type { NextRequest } from 'next/server';
import { ok, fail, parseBody } from '@/lib/api-helpers';
import { cartAddSchema, cartUpdateSchema } from '@/lib/validators';
import { addToCart, updateCartItem, removeCartItem, getCartView } from '@/server/services/cart.service';

export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, cartAddSchema);
  if (error) return error;
  const result = await addToCart(data.skuId, data.quantity);
  if (!result.ok) return fail(result.error ?? 'Could not add item', 409);
  return ok({ cart: await getCartView() });
}

export async function PATCH(req: NextRequest) {
  const { data, error } = await parseBody(req, cartUpdateSchema);
  if (error) return error;
  const result = await updateCartItem(data.skuId, data.quantity);
  if (!result.ok) return fail(result.error ?? 'Could not update item', 409);
  return ok({ cart: await getCartView() });
}

export async function DELETE(req: NextRequest) {
  const skuId = new URL(req.url).searchParams.get('skuId');
  if (!skuId) return fail('skuId required', 400);
  await removeCartItem(skuId);
  return ok({ cart: await getCartView() });
}
