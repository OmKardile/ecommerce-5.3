// Edge-compatible JWT sessions (jose HS256) with strict cookie isolation (ADR-019):
//   pn_session        -> customer (phone OTP identity)
//   pn_admin_session  -> back-office operator (role-isolated)
//   pn_cart_id        -> guest cart token (not an identity)

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, CUSTOMER_COOKIE, SESSION_MAX_AGE_SECONDS, type Role } from '@/lib/constants';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'patel_networks_dev_secret_change_in_production_32b!'
);

export interface CustomerSession {
  userId: string;
  customerId: string;
  phone: string;
  role: Role;
}

export interface AdminSession {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
}

async function sign(payload: Record<string, unknown>, expires: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secret);
}

async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as T;
  } catch {
    return null;
  }
}

export async function setCustomerSession(session: CustomerSession): Promise<void> {
  const token = await sign({ ...session, kind: 'customer' }, '7d');
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const jar = await cookies();
  const s = await verify<CustomerSession>(jar.get(CUSTOMER_COOKIE)?.value);
  return s?.userId ? s : null;
}

export async function clearCustomerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(CUSTOMER_COOKIE);
}

export async function setAdminSession(session: AdminSession): Promise<void> {
  const token = await sign({ ...session, kind: 'admin' }, '7d');
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const s = await verify<AdminSession>(jar.get(ADMIN_COOKIE)?.value);
  return s?.userId ? s : null;
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

/** Token for edge middleware (no next/headers import needed). */
export async function verifyTokenEdge(token: string | undefined): Promise<Record<string, unknown> | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}
