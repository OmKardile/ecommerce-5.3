import { ok } from '@/lib/api-helpers';
import { db } from '@/lib/db';

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return ok({ status: 'healthy', db: 'up', time: new Date().toISOString() });
  } catch {
    return ok({ status: 'degraded', db: 'down', time: new Date().toISOString() });
  }
}
