// /admin/blog — journal management (posts feed /blog on the storefront).

import { BlogManager } from '@/components/admin/blog-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Blog · Patel Networks Ops' };

export default function AdminBlogPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Content</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Blog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buying guides and field notes rendered at /blog. Markdown is rendered with GFM tables on the storefront.
        </p>
      </div>
      <BlogManager />
    </div>
  );
}
