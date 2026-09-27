// /api/admin/posts — GET list + POST create. CONTENT_MANAGER / ADMIN / SUPER_ADMIN.

import { db } from '@/lib/db';
import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { adminPostSchema } from '@/lib/validators';
import { recordAudit } from '@/server/services/notification.service';


function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export async function GET() {
  const session = await requirePermission('blog');
  if (!session) return fail('Unauthorized', 401);

  const posts = await db.post.findMany({ orderBy: { createdAt: 'desc' } });
  return ok({ posts });
}

export async function POST(req: Request) {
  const session = await requirePermission('blog');
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, adminPostSchema);
  if (error) return error;

  try {
    const post = await db.post.create({
      data: {
        title: data.title,
        slug: data.slug && data.slug.length > 0 ? data.slug : slugify(data.title),
        excerpt: data.excerpt || null,
        content: data.content,
        coverImageUrl: data.coverImageUrl || null,
        status: data.status,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        tags: JSON.stringify(data.tags),
      },
    });
    await recordAudit('POST_CREATED', 'POST', post.id, { title: data.title, status: data.status }, session.userId);
    return ok({ post }, 201);
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return fail('A post with that slug already exists', 409);
    console.error('[api/admin/posts] create failed', err);
    return fail('Failed to create post', 500);
  }
}
