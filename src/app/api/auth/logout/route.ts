import { ok } from '@/lib/api-helpers';
import { clearCustomerSession } from '@/lib/session';

export async function POST() {
  await clearCustomerSession();
  return ok({ loggedOut: true });
}
