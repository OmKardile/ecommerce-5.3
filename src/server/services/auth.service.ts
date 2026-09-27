// Authentication service (ADR-003 / ADR-011 / ADR-019).
// Customers: phone + 6-digit OTP, rate-limited, dual-mode SMS.
// Admins: email + scrypt password hash + role-isolated JWT cookie.

import { createHash, randomInt, scryptSync, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { normalizeIndianPhone } from '@/lib/phone';
import { rateLimit } from '@/lib/rate-limit';
import { sendSmsOtp } from './notification.service';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_SEND_LIMIT = 3;
const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;

export class AuthServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function hashCode(code: string): string {
  return createHash('sha256').update(`${code}:${process.env.JWT_SECRET ?? 'dev'}`).digest('hex');
}

export async function requestOtp(rawPhone: string, ip: string): Promise<{ simulated: boolean; expiresInSec: number }> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) throw new AuthServiceError('Enter a valid Indian mobile number', 400);

  const rl = rateLimit(`otp:${phone}`, OTP_SEND_LIMIT, OTP_SEND_WINDOW_MS);
  if (!rl.ok) {
    throw new AuthServiceError(`Too many OTP requests. Try again in ${Math.ceil(rl.retryAfterMs / 60000)} minutes.`, 429);
  }
  const ipRl = rateLimit(`otp-ip:${ip}`, 12, OTP_SEND_WINDOW_MS);
  if (!ipRl.ok) throw new AuthServiceError('Too many requests from this network', 429);

  const code = String(randomInt(100000, 999999));
  await db.otpVerification.create({
    data: { phone, codeHash: hashCode(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  const { simulated } = await sendSmsOtp(phone, code);
  return { simulated, expiresInSec: OTP_TTL_MS / 1000 };
}

export interface OtpVerifyResult {
  userId: string;
  customerId: string;
  phone: string;
  isNewUser: boolean;
  mergedCartItems: number;
}

export async function verifyOtpAndLogin(rawPhone: string, code: string, fullName?: string): Promise<OtpVerifyResult> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) throw new AuthServiceError('Enter a valid Indian mobile number', 400);

  const record = await db.otpVerification.findFirst({
    where: { phone, isVerified: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) throw new AuthServiceError('OTP expired or not requested. Request a new code.', 400);
  if (record.attempts >= OTP_MAX_ATTEMPTS) throw new AuthServiceError('Too many incorrect attempts. Request a new code.', 400);

  const provided = Buffer.from(hashCode(code));
  const expected = Buffer.from(record.codeHash);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    await db.otpVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new AuthServiceError('Incorrect OTP', 400);
  }

  await db.otpVerification.update({ where: { id: record.id }, data: { isVerified: true } });

  // upsert user + customer profile
  let user = await db.user.findUnique({ where: { phone }, include: { customer: true, cart: { include: { items: true } } } });
  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    user = await db.user.create({
      data: {
        phone,
        role: 'CUSTOMER',
        fullName: fullName?.trim() || null,
        customer: { create: { fullName: fullName?.trim() || `Customer ${phone.slice(-4)}` } },
      },
      include: { customer: true, cart: { include: { items: true } } },
    });
  } else if (!user.customer) {
    await db.customer.create({ data: { userId: user.id, fullName: fullName?.trim() || user.fullName || `Customer ${phone.slice(-4)}` } });
  } else if (fullName?.trim() && !user.customer.fullName) {
    await db.customer.update({ where: { id: user.customer.id }, data: { fullName: fullName.trim() } });
  }
  if (!user.isActive) throw new AuthServiceError('This account has been disabled. Contact support.', 403);

  const customerId = user.customer?.id ?? (await db.customer.findUniqueOrThrow({ where: { userId: user.id } })).id;

  // merge guest cart (pn_cart_id token) into the user cart
  const { mergeGuestCart } = await import('./cart.service');
  const mergedCartItems = await mergeGuestCart(user.id);

  return { userId: user.id, customerId, phone, isNewUser, mergedCartItems };
}

// ---------------- Admin (email + scrypt) ----------------

export function hashPassword(password: string): string {
  const salt = randomInt(16, 33).toString(16).padStart(2, '0');
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, digest] = stored.split('$');
    if (scheme !== 'scrypt' || !salt || !digest) return false;
    const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    const expected = Buffer.from(digest, 'hex');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export async function adminLogin(email: string, password: string): Promise<{ userId: string; email: string; fullName: string; role: string }> {
  const rl = rateLimit(`admin-login:${email}`, 8, 10 * 60 * 1000);
  if (!rl.ok) throw new AuthServiceError('Too many login attempts. Try again later.', 429);

  let user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  const envEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD;

  if (!user && envEmail && email.toLowerCase() === envEmail && envPassword && password === envPassword) {
    // bootstrap the environment-defined superadmin on first login
    user = await db.user.upsert({
      where: { email: envEmail },
      update: {},
      create: {
        email: envEmail,
        phone: `+9100000${Date.now() % 100000000}`,
        fullName: 'Store Owner',
        role: 'SUPER_ADMIN',
        passwordHash: hashPassword(envPassword),
      },
    });
  }

  if (!user || !user.passwordHash || !user.isActive || user.role === 'CUSTOMER') {
    throw new AuthServiceError('Invalid credentials', 401);
  }
  if (!verifyPassword(password, user.passwordHash)) {
    throw new AuthServiceError('Invalid credentials', 401);
  }
  return { userId: user.id, email: user.email ?? email, fullName: user.fullName ?? user.email ?? 'Operator', role: user.role };
}
