// API route handler helpers: uniform JSON envelope, zod parsing, auth guards.

import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { ADMIN_ROLES, type Role } from '@/lib/constants';
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

export async function requireRole(allowed: Role[]): Promise<AdminSession | null> {
  const session = await getAdminSession();
  if (!session) return null;
  if (!allowed.includes(session.role)) return null;
  return session;
}

export async function requireAnyAdmin(): Promise<AdminSession | null> {
  return requireRole(ADMIN_ROLES);
}

export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
