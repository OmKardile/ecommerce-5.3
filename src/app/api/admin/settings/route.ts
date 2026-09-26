// /api/admin/settings — GET (any admin) + PUT (ADMIN / SUPER_ADMIN). Zod-validated store config.

import { fail, ok, parseBody, requireAnyAdmin, requireRole } from '@/lib/api-helpers';
import { settingsSchema } from '@/lib/validators';
import { ROLES } from '@/lib/constants';
import { getSettings, saveSettings } from '@/server/services/settings.service';
import { recordAudit } from '@/server/services/notification.service';

const SETTINGS_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

export async function GET() {
  const session = await requireAnyAdmin();
  if (!session) return fail('Unauthorized', 401);
  const settings = await getSettings();
  return ok({ settings });
}

export async function PUT(req: Request) {
  const session = await requireRole(SETTINGS_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, settingsSchema);
  if (error) return error;

  const settings = await saveSettings(data);
  await recordAudit('SETTINGS_UPDATED', 'SETTING', 'store', { fields: Object.keys(data) }, session.userId);
  return ok({ settings });
}
