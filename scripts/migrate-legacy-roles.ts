// One-off migration to the D-12 account model: fixed manager roles
// (ADMIN / INVENTORY_MANAGER / ORDER_MANAGER / CONTENT_MANAGER) become STAFF
// with a granted `permissions` scope. SUPER_ADMIN and CUSTOMER are untouched.
// Safe to re-run: only touches rows still carrying a legacy role.
// Usage: bun run scripts/migrate-legacy-roles.ts

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const SCOPE_MAP: Record<string, string[]> = {
  ADMIN: ['orders', 'returns', 'products', 'categories', 'brands', 'inventory', 'stock_monitor', 'customers', 'inquiries', 'reviews', 'coupons', 'banners', 'blog', 'reports', 'settings'],
  INVENTORY_MANAGER: ['inventory', 'stock_monitor', 'products'],
  ORDER_MANAGER: ['orders', 'returns'],
  CONTENT_MANAGER: ['banners', 'blog', 'coupons'],
};

async function main() {
  let moved = 0;
  for (const [legacy, permissions] of Object.entries(SCOPE_MAP)) {
    const rows = await db.user.findMany({ where: { role: legacy }, select: { id: true } });
    for (const row of rows) {
      await db.user.update({ where: { id: row.id }, data: { role: 'STAFF', permissions } });
      moved++;
    }
    if (rows.length > 0) console.log(`${legacy} → STAFF ${JSON.stringify(permissions)} (${rows.length})`);
  }
  // legacy STAFF rows without scopes get the stock-monitor persona
  const bare = await db.user.findMany({ where: { role: 'STAFF', permissions: { equals: null } }, select: { id: true } });
  for (const row of bare) {
    await db.user.update({ where: { id: row.id }, data: { permissions: ['stock_monitor'] } });
    moved++;
  }
  console.log(moved === 0 ? 'Nothing to migrate.' : `Migrated ${moved} account(s).`);
}

main().finally(() => db.$disconnect());
