'use client';

// Admin login — dark command-center card. Proxy redirects authed admins away from this page.

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/components/admin/api';

const DEMO_EMAIL = 'superadmin@patelnetworks.in';
const DEMO_PASSWORD = 'patel@admin2026';

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function fillDemo() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError(null);
    setDigest(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setDigest(null);
    try {
      await api('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const target = next && next.startsWith('/admin') ? next : '/admin';
      router.push(target);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      // Short correlation digest (shown to the operator; match against dev server logs).
      setDigest(Math.abs(hashString(`${message}:${new Date().toISOString().slice(0, 16)}`)).toString(36).slice(0, 8).toUpperCase());
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="admin-email" className="text-sidebar-foreground/80 text-xs uppercase tracking-wider">
          Operator email
        </Label>
        <Input
          id="admin-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@patelnetworks.in"
          className="h-11 bg-[#0f1f1a] border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/30 focus-visible:ring-sidebar-ring"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-password" className="text-sidebar-foreground/80 text-xs uppercase tracking-wider">
          Password
        </Label>
        <div className="relative">
          <Input
            id="admin-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            className="h-11 pr-11 bg-[#0f1f1a] border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/30 focus-visible:ring-sidebar-ring"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2.5 text-sm text-red-200">
          <p className="font-medium">{error}</p>
          {digest && <p className="mt-1 font-mono text-[10px] text-red-300/70">error digest: {digest}</p>}
        </div>
      )}

      <Button
        type="submit"
        disabled={busy}
        className="w-full h-11 bg-[#f7f6f1] text-[#142a24] hover:bg-white font-medium"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Signing in…
          </>
        ) : (
          'Sign in to console'
        )}
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-sidebar-border" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/40">or</span>
        <div className="h-px flex-1 bg-sidebar-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={fillDemo}
        className="w-full h-10 border-sidebar-border bg-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Autofill demo credentials
        <span className="ml-1 rounded bg-sidebar-accent px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-sidebar-accent-foreground">Demo</span>
      </Button>
    </form>
  );
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
