// Staff & access management (D-12) — owner-only domain.
// Two account shapes exist for operators: SUPER_ADMIN (Owner, implicitly full)
// and STAFF (scope lives in User.permissions, granted by the owner).
// Fixed manager roles (pre-D-12) no longer receive access anywhere.

import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/server/services/auth.service';
import { ROLES, parsePermissions, type PermissionScope } from '@/lib/constants';
import { recordAudit } from '@/server/services/notification.service';

export class StaffServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function assertScopes(permissions: string[]): PermissionScope[] {
  const scopes = parsePermissions(permissions);
  if (permissions.length > 0 && scopes.length !== permissions.length) {
    throw new StaffServiceError('Unknown permission scope in list', 422);
  }
  return scopes;
}

async function uniquePhone(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const phone = `+9199${Math.floor(10000000 + Math.random() * 89999999)}`;
    const clash = await db.user.findUnique({ where: { phone }, select: { id: true } });
    if (!clash) return phone;
  }
  throw new StaffServiceError('Could not allocate a placeholder phone — retry', 500);
}

export async function listAccounts() {
  const users = await db.user.findMany({
    where: { role: { not: ROLES.CUSTOMER }, deletedAt: null },
    select: { id: true, fullName: true, email: true, role: true, isActive: true, permissions: true, createdAt: true },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
  return users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    permissions: parsePermissions(u.permissions),
    createdAt: u.createdAt,
  }));
}

export async function createAccount(
  actorId: string,
  input: { fullName: string; email: string; password: string; accountType: 'STAFF' | 'SUPER_ADMIN'; permissions: string[] },
) {
  const email = input.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new StaffServiceError('An account with this email already exists', 409);

  let permissions: PermissionScope[] = [];
  if (input.accountType === 'STAFF') {
    permissions = assertScopes(input.permissions);
    if (permissions.length === 0) {
      throw new StaffServiceError('Grant at least one function to this staff account', 422);
    }
  }

  const user = await db.user.create({
    data: {
      phone: await uniquePhone(),
      email,
      fullName: input.fullName,
      role: input.accountType === 'SUPER_ADMIN' ? ROLES.SUPER_ADMIN : ROLES.STAFF,
      permissions: input.accountType === 'SUPER_ADMIN' ? [] : permissions,
      passwordHash: hashPassword(input.password),
    },
    select: { id: true, fullName: true, email: true, role: true },
  });
  await recordAudit(
    input.accountType === 'SUPER_ADMIN' ? 'OWNER_CREATED' : 'STAFF_CREATED',
    'User',
    user.id,
    { email, role: user.role, permissions },
    actorId,
  );
  return user;
}

export async function updateAccount(
  actorId: string,
  actorRole: string,
  id: string,
  input: { fullName?: string; password?: string; permissions?: string[]; isActive?: boolean },
) {
  const user = await db.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true, fullName: true } });
  if (!user || user.role === ROLES.CUSTOMER) throw new StaffServiceError('Account not found', 404);
  if (user.role === ROLES.SUPER_ADMIN && actorRole !== ROLES.SUPER_ADMIN) {
    throw new StaffServiceError('Only the owner can edit owner accounts', 403);
  }
  if (id === actorId && input.isActive === false) {
    throw new StaffServiceError('You cannot deactivate your own account', 422);
  }

  const data: { fullName?: string; passwordHash?: string; permissions?: string[]; isActive?: boolean } = {};
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.password !== undefined) data.passwordHash = hashPassword(input.password);
  if (input.isActive !== undefined) data.isActive = input.isActive;
  let scopeChange: PermissionScope[] | null = null;
  if (input.permissions !== undefined) {
    if (user.role === ROLES.SUPER_ADMIN) throw new StaffServiceError('Owner accounts are implicitly full — nothing to scope', 422);
    const scopes = assertScopes(input.permissions);
    if (scopes.length === 0) throw new StaffServiceError('Grant at least one function, or deactivate the account instead', 422);
    scopeChange = scopes;
    data.permissions = scopes;
  }

  const updated = await db.user.update({ where: { id }, data, select: { id: true, fullName: true, email: true, role: true, isActive: true, permissions: true } });
  await recordAudit('STAFF_UPDATED', 'User', id, {
    renamed: input.fullName !== undefined,
    passwordReset: input.password !== undefined,
    deactivated: input.isActive === false,
    reactivated: input.isActive === true,
    permissions: scopeChange,
  }, actorId);
  return {
    id: updated.id,
    fullName: updated.fullName,
    email: updated.email,
    role: updated.role,
    isActive: updated.isActive,
    permissions: parsePermissions(updated.permissions),
  };
}

export async function changeOwnCredentials(
  userId: string,
  input: { currentPassword: string; email?: string; newPassword?: string },
) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, passwordHash: true } });
  if (!user?.passwordHash) throw new StaffServiceError('Account not found', 404);
  if (!verifyPassword(input.currentPassword, user.passwordHash)) {
    throw new StaffServiceError('Current password is incorrect', 403);
  }

  const data: { email?: string; passwordHash?: string } = {};
  if (input.email && input.email.toLowerCase() !== user.email) {
    const clash = await db.user.findUnique({ where: { email: input.email.toLowerCase() }, select: { id: true } });
    if (clash) throw new StaffServiceError('That email is already in use', 409);
    data.email = input.email.toLowerCase();
  }
  if (input.newPassword) data.passwordHash = hashPassword(input.newPassword);

  await db.user.update({ where: { id: userId }, data });
  await recordAudit('OWNER_CREDENTIALS_CHANGED', 'User', userId, {
    emailChanged: Boolean(data.email),
    passwordChanged: Boolean(data.passwordHash),
  }, userId);
  return { emailChanged: Boolean(data.email), passwordChanged: Boolean(data.passwordHash) };
}
