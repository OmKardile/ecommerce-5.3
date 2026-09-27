// GET /api/admin/customers — CRM directory (search + B2B/retail filter + pagination).

import type { NextRequest } from 'next/server';
import { fail, ok, requirePermission } from '@/lib/api-helpers';
import { getAdminCustomers } from '@/server/services/admin.service';

export async function GET(req: NextRequest) {
  const session = await requirePermission('customers');
  if (!session) return fail('Unauthorized', 401);

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q') ?? undefined;
  const filterRaw = sp.get('filter') ?? 'ALL';
  const filter = (['ALL', 'B2B', 'RETAIL'].includes(filterRaw) ? filterRaw : 'ALL') as 'ALL' | 'B2B' | 'RETAIL';
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1);
  const perPage = Math.min(100, Math.max(1, Number(sp.get('perPage') ?? '20') || 20));

  const result = await getAdminCustomers({ q: q || undefined, filter, page, perPage });
  return ok(result);
}
