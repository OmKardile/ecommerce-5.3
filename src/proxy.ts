// Edge proxy (Next.js 16 convention, ex-middleware) — route guards (ADR-019):
//   /admin/*  -> requires pn_admin_session (except /admin/login)
//   /account/* -> requires pn_session (except /account/login)

import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge } from '@/lib/session';

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith('/admin')) {
    if (pathname.startsWith('/admin/login')) {
      const session = await verifyTokenEdge(req.cookies.get('pn_admin_session')?.value);
      if (session && session.kind === 'admin') {
        return NextResponse.redirect(new URL('/admin', req.url));
      }
      return NextResponse.next();
    }
    const session = await verifyTokenEdge(req.cookies.get('pn_admin_session')?.value);
    if (!session || session.kind !== 'admin') {
      return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(pathname + search)}`, req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/account')) {
    if (pathname.startsWith('/account/login')) return NextResponse.next();
    const session = await verifyTokenEdge(req.cookies.get('pn_session')?.value);
    if (!session || session.kind !== 'customer') {
      return NextResponse.redirect(new URL(`/account/login?next=${encodeURIComponent(pathname + search)}`, req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*'],
};
