import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, parseBody } from '@/lib/api-helpers';
import { requireCustomer } from '@/lib/api-helpers';
import { gstinSchema } from '@/lib/validators';
import { db } from '@/lib/db';

// PUT /api/account/profile — update customer profile (name + B2B fields).

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  companyName: z.string().trim().max(120).optional().or(z.literal('')),
  gstin: gstinSchema.optional().or(z.literal('')),
});

export async function GET() {
  const session = await requireCustomer();
  if (!session) return fail('Login required', 401);
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { customer: true },
  });
  if (!user) return fail('Not found', 404);
  return ok({
    fullName: user.customer?.fullName ?? user.fullName ?? '',
    phone: user.phone,
    companyName: user.customer?.companyName ?? '',
    gstin: user.customer?.gstin ?? '',
    isB2BVerified: user.customer?.isB2BVerified ?? false,
  });
}

export async function PUT(req: NextRequest) {
  const session = await requireCustomer();
  if (!session) return fail('Login required', 401);

  const { data, error } = await parseBody(req, profileSchema);
  if (error) return error;

  const customer = await db.customer.findUnique({ where: { userId: session.userId } });
  if (!customer) return fail('Customer profile missing', 404);

  const gstin = data.gstin ? data.gstin : null;
  const companyName = data.companyName ? data.companyName : null;

  await db.$transaction([
    db.user.update({ where: { id: session.userId }, data: { fullName: data.fullName } }),
    db.customer.update({
      where: { id: customer.id },
      data: {
        fullName: data.fullName,
        companyName,
        gstin,
        // self-service GSTIN marks the account as B2B-oriented but not desk-verified
        ...(gstin ? { isB2BVerified: false } : {}),
      },
    }),
  ]);

  return ok({ updated: true, fullName: data.fullName, companyName, gstin });
}
