// /api/admin/settings — GET (any admin) + PUT (ADMIN / SUPER_ADMIN). Zod-validated store config.

import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { settingsSchema } from '@/lib/validators';
import { getSettings, saveSettings } from '@/server/services/settings.service';
import { recordAudit } from '@/server/services/notification.service';


export async function GET() {
  const session = await requirePermission('settings');
  if (!session) return fail('Unauthorized', 401);
  const settings = await getSettings();
  return ok({ settings });
}

export async function PUT(req: Request) {
  const session = await requirePermission('settings');
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, settingsSchema);
  if (error) return error;

  const settings = await saveSettings(data);
  await recordAudit('SETTINGS_UPDATED', 'SETTING', 'store', { fields: Object.keys(data) }, session.userId);
  return ok({ settings });
}
