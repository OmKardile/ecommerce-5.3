// /admin/banners — storefront creative management.

import { BannerManager } from '@/components/admin/banner-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Banners · Patel Networks Ops' };

export default function AdminBannersPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Marketing</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Banners</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hero and strip creatives rendered on the storefront home page. Lower sort order appears first.
        </p>
      </div>
      <BannerManager />
    </div>
  );
}
