// /admin/login — public (proxy bounces authed admins back to /admin).

import { LoginForm } from '@/components/admin/login-form';

export const metadata = {
  title: 'Operator Sign-in · Patel Networks',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Wordmark */}
          <div className="text-center mb-8">
            <p className="font-display text-3xl text-sidebar-primary">Patel Networks</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-sidebar-foreground/50">
              Surveillance & Networking Ops · Surat Central Hub
            </p>
          </div>

          <div className="rounded-md border border-sidebar-border bg-[#183028] p-6 sm:p-8 shadow-sm">
            <div className="mb-6">
              <h1 className="font-display text-xl text-sidebar-primary">Operator sign-in</h1>
              <p className="mt-1 text-sm text-sidebar-foreground/60">
                Restricted back-office access. All actions are audited.
              </p>
            </div>
            <LoginForm next={next} />
          </div>

          <p className="mt-6 text-center text-[11px] text-sidebar-foreground/40">
            Patel Networks (MegaTechzy) · GSTIN 24AAACP1234F1Z8 · Surat, Gujarat
          </p>
        </div>
      </div>
    </div>
  );
}
