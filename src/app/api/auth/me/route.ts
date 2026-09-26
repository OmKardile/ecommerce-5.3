import { ok, fail } from '@/lib/api-helpers';
import { getCustomerSession } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return fail('Not authenticated', 401);
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { customer: { include: { addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] } } } },
  });
  if (!user) return fail('Not authenticated', 401);
  return ok({
    userId: user.id,
    phone: user.phone,
    fullName: user.customer?.fullName ?? user.fullName,
    companyName: user.customer?.companyName ?? null,
    gstin: user.customer?.gstin ?? null,
    isB2BVerified: user.customer?.isB2BVerified ?? false,
    addresses: user.customer?.addresses ?? [],
  });
}
