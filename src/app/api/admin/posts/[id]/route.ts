// /api/admin/posts/[id] — PATCH (edit; PUBLISH sets publishedAt) + DELETE.

import { db } from '@/lib/db';
import { fail, ok, parseBody, requireRole } from '@/lib/api-helpers';
import { adminPostSchema } from '@/lib/validators';
import { ROLES } from '@/lib/constants';
import { recordAudit } from '@/server/services/notification.service';

const CONTENT_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CONTENT_MANAGER];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(CONTENT_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const { data, error } = await parseBody(req, adminPostSchema.partial());
  if (error) return error;

  const existing = await db.post.findUnique({ where: { id } });
  if (!existing) return fail('Post not found', 404);

  // Publishing rules: first PUBLISHED stamps publishedAt; re-drafting keeps the original date.
  const publishingNow = data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED';

  try {
    const post = await db.post.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.slug !== undefined && data.slug.length > 0 ? { slug: data.slug } : {}),
        ...(data.excerpt !== undefined ? { excerpt: data.excerpt || null } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.coverImageUrl !== undefined ? { coverImageUrl: data.coverImageUrl || null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(publishingNow ? { publishedAt: new Date() } : {}),
        ...(data.tags !== undefined ? { tags: JSON.stringify(data.tags) } : {}),
      },
    });
    await recordAudit('POST_UPDATED', 'POST', id, { fields: Object.keys(data), publishingNow }, session.userId);
    return ok({ post });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return fail('A post with that slug already exists', 409);
    console.error('[api/admin/posts/[id]] patch failed', err);
    return fail('Failed to update post', 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(CONTENT_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const existing = await db.post.findUnique({ where: { id } });
  if (!existing) return fail('Post not found', 404);

  await db.post.delete({ where: { id } });
  await recordAudit('POST_DELETED', 'POST', id, { title: existing.title }, session.userId);
  return ok({ deleted: true });
}
