import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, parseBody, requireCustomer } from '@/lib/api-helpers';
import { db } from '@/lib/db';

// PATCH /api/account/addresses/[id] — set as default address.
// DELETE /api/account/addresses/[id] — remove an address.

const patchSchema = z.object({
  isDefault: z.boolean(),
});

async function ownedCustomer(userId: string) {
  return db.customer.findUnique({ where: { userId } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCustomer();
  if (!session) return fail('Login required', 401);
  const customer = await ownedCustomer(session.userId);
  if (!customer) return fail('Customer profile missing', 404);

  const { id } = await params;
  const address = await db.address.findFirst({ where: { id, customerId: customer.id } });
  if (!address) return fail('Address not found', 404);

  const { data, error } = await parseBody(req, patchSchema);
  if (error) return error;

  await db.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.address.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    }
    await tx.address.update({ where: { id }, data: { isDefault: data.isDefault } });
  });

  return ok({ updated: true, isDefault: data.isDefault });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCustomer();
  if (!session) return fail('Login required', 401);
  const customer = await ownedCustomer(session.userId);
  if (!customer) return fail('Customer profile missing', 404);

  const { id } = await params;
  const address = await db.address.findFirst({ where: { id, customerId: customer.id } });
  if (!address) return fail('Address not found', 404);

  await db.address.delete({ where: { id } });

  // if the default was removed, promote the most recent remaining address
  if (address.isDefault) {
    const next = await db.address.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
    });
    if (next) await db.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }

  return ok({ deleted: true });
}
