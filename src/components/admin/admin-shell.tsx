'use client';

// AdminShell — dark command-center chrome (sidebar + operator header) around a light content area.
// Sidebar tokens come from globals.css (--sidebar #142a24 family). No gradients, no neon.

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardList,
  Image as ImageIcon,
  LayoutDashboard,
  UserCog,
  Undo2,
  LogOut,
  type LucideIcon,
  MessageSquareQuote,
  Newspaper,
  Package,
  Settings,
  Shapes,
  Star,
  Store,
  TicketPercent,
  Users,
  Warehouse,
  Radar,
  Menu,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_LABELS, SCOPE_LABELS, STORE, type PermissionScope, type Role } from '@/lib/constants';
import { api } from '@/components/admin/api';

export interface AdminShellSession {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  /** Granted scope keys — empty for the Owner (who passes every gate implicitly). */
  permissions: string[];
  isOwner: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: 'pendingReturns' | 'newInquiries' | 'pendingReviews';
  /** Permission scope this section belongs to; omitted = dashboard (everyone). */
  scope?: PermissionScope;
  /** Owner-only section (staff management). */
  ownerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/orders', label: 'Orders', icon: ClipboardList, scope: 'orders' },
  { href: '/admin/returns', label: 'Returns & DOA', icon: Undo2, badgeKey: 'pendingReturns', scope: 'returns' },
  { href: '/admin/products', label: 'Products', icon: Package, scope: 'products' },
  { href: '/admin/categories', label: 'Categories', icon: Shapes, scope: 'categories' },
  { href: '/admin/brands', label: 'Brands', icon: Boxes, scope: 'brands' },
  { href: '/admin/inventory', label: 'Inventory', icon: Warehouse, scope: 'inventory' },
  { href: '/admin/stock-monitor', label: 'Stock Monitor', icon: Radar, scope: 'stock_monitor' },
  { href: '/admin/customers', label: 'Customers', icon: Users, scope: 'customers' },
  { href: '/admin/inquiries', label: 'Trade Desk', icon: MessageSquareQuote, badgeKey: 'newInquiries', scope: 'inquiries' },
  { href: '/admin/reviews', label: 'Reviews', icon: Star, badgeKey: 'pendingReviews', scope: 'reviews' },
  { href: '/admin/coupons', label: 'Coupons', icon: TicketPercent, scope: 'coupons' },
  { href: '/admin/banners', label: 'Banners', icon: ImageIcon, scope: 'banners' },
  { href: '/admin/blog', label: 'Blog', icon: Newspaper, scope: 'blog' },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3, scope: 'reports' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, scope: 'settings' },
  { href: '/admin/staff', label: 'Staff & access', icon: UserCog, ownerOnly: true },
];

function roleBadgeClass(role: string): string {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return 'bg-[#f7f6f1] text-[#142a24] border-transparent';
    default:
      return 'bg-transparent text-sidebar-foreground/80 border-sidebar-border';
  }
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role.replace(/_/g, ' ');
}

function SidebarNav({ session, badges, onNavigate }: { session: AdminShellSession; badges?: { pendingReturns?: number; newInquiries?: number; pendingReviews?: number }; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
        <p className="font-display text-lg leading-tight text-sidebar-primary">Patel Networks</p>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/60">Operations Console</p>
      </div>

      <nav aria-label="Admin sections" className="flex-1 overflow-y-auto thin-scrollbar px-3 py-4 space-y-0.5">
        {NAV_ITEMS.filter((item) => {
          if (item.ownerOnly) return session.isOwner;
          if (!item.scope) return session.isOwner || session.permissions.length === 0; // dashboard: owner, or staff with no scopes yet
          return session.isOwner || session.permissions.includes(item.scope);
        }).map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{item.label}</span>
              {item.badgeKey && Boolean(badges?.[item.badgeKey]) && (
                <span className="ml-auto rounded-full bg-[#f7f6f1] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#142a24] tabular-nums">
                  {badges?.[item.badgeKey]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
        {session.isOwner && (
          <a
            href="/blueprint/index.html"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            <span>System blueprint</span>
          </a>
        )}
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <Store className="h-4 w-4" aria-hidden />
          <span>View storefront</span>
        </a>
        <SignOutButton />
        <p className="px-3 pt-1 text-[10px] leading-relaxed text-sidebar-foreground/40">
          {session.fullName || session.email} · Signed in as {roleLabel(session.role)}
          {!session.isOwner && session.permissions.length > 0 && (
            <> — {session.permissions.map((p) => SCOPE_LABELS[p as PermissionScope] ?? p).join(', ')}</>
          )}
        </p>
      </div>
    </div>
  );
}

function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await api('/api/admin/auth/logout', { method: 'POST' });
    } catch {
      // cookie is cleared server-side even on transport errors; proceed to login
    }
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors disabled:opacity-50',
        className
      )}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      <span>{busy ? 'Signing out…' : 'Sign out'}</span>
    </button>
  );
}

export function AdminShell({
  session,
  children,
  badges,
}: {
  session: AdminShellSession;
  children: React.ReactNode;
  badges?: { pendingReturns?: number; newInquiries?: number; pendingReviews?: number };
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Radix Dialog triggers hydrate with different aria/data-state attributes than
  // SSR emits (dev-only warning, seen on every admin page) — gate the mobile
  // Sheet until after mount so the SSR tree and first client render agree.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div className="min-h-screen flex bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col fixed inset-y-0 left-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-40">
        <SidebarNav session={session} badges={badges} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col lg:pl-60">
        {/* Operator header — page-agnostic */}
        <header className="sticky top-0 z-30 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            {mounted && (
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground border-sidebar-border">
                <SheetTitle className="sr-only">Admin navigation</SheetTitle>
                <SidebarNav session={session} badges={badges} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            )}

            <div className="flex items-center gap-2 min-w-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-sidebar-border bg-sidebar-accent/60 px-2 py-1 text-[11px] font-medium tracking-wide">
                Surat Central Hub
              </span>
              <span className="hidden md:inline-flex items-center rounded-md border border-sidebar-border px-2 py-1 font-mono text-[11px] text-sidebar-foreground/70">
                GSTIN {STORE.gstin}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3 min-w-0">
              <ThemeToggle className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent" />
              <div className="hidden sm:block text-right min-w-0">
                <p className="text-xs font-medium truncate max-w-[220px]">{session.fullName || session.email}</p>
                <p className="text-[10px] text-sidebar-foreground/60 truncate max-w-[220px]">{session.email}</p>
              </div>
              <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wide', roleBadgeClass(session.role))}>
                {roleLabel(session.role)}
              </Badge>
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
