// API route handler helpers: uniform JSON envelope, zod parsing, auth guards.

import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { ROLES, parsePermissions, type PermissionScope } from '@/lib/constants';
import { db } from '@/lib/db';
import { getAdminSession, getCustomerSession, type AdminSession, type CustomerSession } from '@/lib/session';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { data: null, error: fail('Invalid JSON body', 400) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      data: null,
      error: fail(first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input', 400, {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      }),
    };
  }
  return { data: parsed.data, error: null };
}

export async function requireCustomer(): Promise<CustomerSession | null> {
  return getCustomerSession();
}

export async function requireAdmin(): Promise<AdminSession | null> {
  return getAdminSession();
}

/**
 * Permission gate (D-12): the DB row is re-read per request, so scope edits
 * made by the owner take effect on the staff's NEXT request — no re-login.
 * SUPER_ADMIN (Owner) passes every scope; STAFF passes when their granted
 * `permissions` include the scope; `scope='any'` admits any active operator.
 * Legacy/fixed roles (pre-D-12) get no access.
 */
export async function requirePermission(scope: PermissionScope | 'any'): Promise<AdminSession | null> {
  const session = await getAdminSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true, deletedAt: true, permissions: true },
  });
  if (!user || user.deletedAt || !user.isActive) return null;
  if (user.role === ROLES.SUPER_ADMIN) return session;
  if (user.role !== ROLES.STAFF) return null;
  if (scope === 'any') return session;
  return parsePermissions(user.permissions).includes(scope) ? session : null;
}

/** Owner-only gate (staff management, owner credentials). */
export async function requireOwner(): Promise<AdminSession | null> {
  const session = await getAdminSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true, deletedAt: true },
  });
  if (!user || user.deletedAt || !user.isActive || user.role !== ROLES.SUPER_ADMIN) return null;
  return session;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
