// GET /admin/logout — server-side escape hatch for dead sessions (D-12).
// A JWT can verify at the edge while its user no longer exists (wiped/recreated
// DB, deactivated account) — the panel layout then redirects here instead of
// /admin/login, so the stale cookie is actually cleared and the login page can
// render instead of ping-ponging proxy<->layout. Self-healing loop breaker.

import { NextResponse } from 'next/server';
import { clearAdminSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  await clearAdminSession();
  return NextResponse.redirect(new URL('/admin/login', req.url));
}
