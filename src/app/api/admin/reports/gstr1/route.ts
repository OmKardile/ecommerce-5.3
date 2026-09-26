// GET /api/admin/reports/gstr1?from=&to= — statutory GSTR-1 style schedule (ADR-017).

import type { NextRequest } from 'next/server';
import { fail, ok, requireAnyAdmin } from '@/lib/api-helpers';
import { getGstr1Schedule } from '@/server/services/admin.service';

export async function GET(req: NextRequest) {
  const session = await requireAnyAdmin();
  if (!session) return fail('Unauthorized', 401);

  const sp = req.nextUrl.searchParams;
  const fromRaw = sp.get('from');
  const toRaw = sp.get('to');

  const now = new Date();
  const from = fromRaw ? new Date(fromRaw) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toRaw ? new Date(toRaw) : now;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return fail('Invalid date range — use ISO dates (YYYY-MM-DD)', 400);
  }
  if (from > to) return fail('"from" must be before "to"', 400);
  // extend `to` to end-of-day for inclusive reporting
  to.setHours(23, 59, 59, 999);

  const rows = await getGstr1Schedule(from, to);
  const totals = rows.reduce(
    (acc, r) => ({
      taxableValuePaise: acc.taxableValuePaise + r.taxableValuePaise,
      cgstPaise: acc.cgstPaise + r.cgstPaise,
      sgstPaise: acc.sgstPaise + r.sgstPaise,
      igstPaise: acc.igstPaise + r.igstPaise,
      totalTaxPaise: acc.totalTaxPaise + r.totalTaxPaise,
      invoiceValuePaise: acc.invoiceValuePaise + r.invoiceValuePaise,
      b2bCount: acc.b2bCount + (r.isB2B ? 1 : 0),
      b2cCount: acc.b2cCount + (r.isB2B ? 0 : 1),
    }),
    { taxableValuePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalTaxPaise: 0, invoiceValuePaise: 0, b2bCount: 0, b2cCount: 0 }
  );

  return ok({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), rows, totals });
}
