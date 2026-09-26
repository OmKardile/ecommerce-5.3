import { ok } from '@/lib/api-helpers';
import { clearAdminSession } from '@/lib/session';

export async function POST() {
  await clearAdminSession();
  return ok({ loggedOut: true });
}
