import type { NextRequest } from 'next/server';
import { ok, fail, parseBody, requireCustomer } from '@/lib/api-helpers';
import { addressSchema } from '@/lib/validators';
import { db } from '@/lib/db';

// GET /api/account/addresses — list saved addresses.
// POST /api/account/addresses — add an address (zod addressSchema).

export async function GET() {
  const session = await requireCustomer();
  if (!session) return fail('Login required', 401);
  const customer = await db.customer.findUnique({
    where: { userId: session.userId },
    include: { addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] } },
  });
  if (!customer) return fail('Customer profile missing', 404);
  return ok({ addresses: customer.addresses });
}

export async function POST(req: NextRequest) {
  const session = await requireCustomer();
  if (!session) return fail('Login required', 401);

  const { data, error } = await parseBody(req, addressSchema);
  if (error) return error;

  const customer = await db.customer.findUnique({ where: { userId: session.userId } });
  if (!customer) return fail('Customer profile missing', 404);

  const existingCount = await db.address.count({ where: { customerId: customer.id } });
  if (existingCount >= 10) {
    return fail('Address book is full — remove an address before adding another (max 10)', 409);
  }
  const makeDefault = data.isDefault === true || existingCount === 0;

  const address = await db.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.address.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    }
    return tx.address.create({
      data: {
        customerId: customer.id,
        recipientName: data.recipientName,
        phone: data.phone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        landmark: data.landmark || null,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        isDefault: makeDefault,
        type: data.type ?? 'HOME',
      },
    });
  });

  return ok({ address }, 201);
}
