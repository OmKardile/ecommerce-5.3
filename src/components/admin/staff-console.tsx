'use client';

// Staff & access console (D-12) — owner-only. Accounts table, a 3-step creation
// wizard (identity → account type → function scopes → review), per-account
// editing (rename / password reset / scope change / deactivate), and the
// owner's own login change. Plain role=tablist-free, motion-quiet admin style.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, PlusCircle, ShieldCheck, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, formatDate } from '@/components/admin/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PERMISSION_SCOPES } from '@/lib/constants';

interface Account {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  permissions: string[];
  createdAt: string;
}

const GROUPS = Array.from(new Set(PERMISSION_SCOPES.map((s) => s.group)));

const PRESETS: Array<{ label: string; scopes: string[] }> = [
  { label: 'Counter / floor', scopes: ['stock_monitor'] },
  { label: 'Warehouse', scopes: ['inventory', 'stock_monitor'] },
  { label: 'Fulfillment desk', scopes: ['orders', 'returns'] },
  { label: 'Catalog desk', scopes: ['products', 'categories', 'brands', 'inventory'] },
  { label: 'Content desk', scopes: ['banners', 'blog', 'coupons'] },
];

function generatePassword(): string {
  const charset = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const buf = new Uint32Array(14);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 14; i++) out += charset[buf[i] % charset.length];
  return out;
}

function scopeChips(scopes: string[]) {
  const byKey = new Map<string, string>(PERMISSION_SCOPES.map((s) => [s.key, s.label]));
  if (scopes.length === 0) return <span className="text-xs text-muted-foreground">No functions granted</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {scopes.map((s) => (
        <Badge key={s} variant="outline" className="text-[10px] font-normal">
          {byKey.get(s) ?? s}
        </Badge>
      ))}
    </div>
  );
}

export function StaffConsole() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<Account[]>('/api/admin/staff');
      setAccounts(data);
    } catch (err) {
      toast({ title: 'Failed to load accounts', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const owners = accounts.filter((a) => a.role === 'SUPER_ADMIN');
  const staff = accounts.filter((a) => a.role !== 'SUPER_ADMIN');

  return (
    <div className="space-y-6">
      <OwnerCredentialsCard onChanged={load} />

      <section aria-labelledby="accounts-heading" className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-6">
          <div>
            <h2 id="accounts-heading" className="font-display text-lg">Accounts</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {owners.length} owner{owners.length === 1 ? '' : 's'} · {staff.length} staff account{staff.length === 1 ? '' : 's'}
            </p>
          </div>
          <Button onClick={() => setWizardOpen(true)} size="sm">
            <PlusCircle className="mr-2 h-4 w-4" aria-hidden />
            New account
          </Button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground" aria-live="polite">Loading accounts…</div>
        ) : (
          <ul className="divide-y">
            {[...owners, ...staff].map((a) => (
              <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{a.fullName || a.email || '—'}</p>
                    {a.role === 'SUPER_ADMIN' ? (
                      <Badge className="bg-[#f7f6f1] text-[#142a24] border-transparent hover:bg-[#f7f6f1]">
                        <ShieldCheck className="mr-1 h-3 w-3" aria-hidden /> Owner
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Staff</Badge>
                    )}
                    {!a.isActive && <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px] uppercase tracking-wide">Deactivated</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.email} · joined {formatDate(a.createdAt)}</p>
                  {a.role !== 'SUPER_ADMIN' && <div className="mt-2">{scopeChips(a.permissions)}</div>}
                  {a.role === 'SUPER_ADMIN' && (
                    <p className="mt-2 text-xs text-muted-foreground">Implicitly full access — can manage staff and owners.</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                    <UserCog className="mr-2 h-4 w-4" aria-hidden />
                    {a.role === 'SUPER_ADMIN' ? 'Manage' : 'Edit'}
                  </Button>
                </div>
              </li>
            ))}
            {accounts.length === 0 && (
              <li className="p-6 text-sm text-muted-foreground">No operator accounts yet — create the first one.</li>
            )}
          </ul>
        )}
      </section>

      <CreateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={() => {
          setWizardOpen(false);
          void load();
        }}
      />
      <EditDialog
        account={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function OwnerCredentialsCard({ onChanged }: { onChanged: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!email && !newPassword) {
      toast({ title: 'Nothing to change', description: 'Enter a new email and/or a new password.' });
      return;
    }
    setBusy(true);
    try {
      await api('/api/admin/account/credentials', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          ...(email ? { email } : {}),
          ...(newPassword ? { newPassword } : {}),
        }),
      });
      toast({ title: 'Login updated', description: 'Use the new credentials next time you sign in.' });
      setEmail('');
      setNewPassword('');
      setCurrentPassword('');
      onChanged();
    } catch (err) {
      toast({ title: 'Could not update login', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="your-login-heading" className="rounded-lg border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" aria-hidden />
        <h2 id="your-login-heading" className="font-display text-lg">Your login</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Change your own email and/or password. The current password is always required.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="own-email">New email (optional)</Label>
          <Input id="own-email" type="email" autoComplete="email" placeholder="owner@patelnetworks.in" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="own-pass">New password (optional)</Label>
          <Input id="own-pass" type="password" autoComplete="new-password" placeholder="••••••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="own-current">Current password *</Label>
          <Input id="own-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
      </div>
      <Button className="mt-4" size="sm" onClick={submit} disabled={busy || (!email && !newPassword) || !currentPassword}>
        {busy ? 'Updating…' : 'Update login'}
      </Button>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const STEPS = ['Identity', 'Functions', 'Review'] as const;

function CreateWizard({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'STAFF' | 'SUPER_ADMIN'>('STAFF');
  const [scopes, setScopes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ fullName: string | null; email: string | null; role: string } | null>(null);

  const scopeByKey = useMemo(() => new Map(PERMISSION_SCOPES.map((s) => [s.key, s])), []);

  function reset() {
    setStep(0);
    setFullName('');
    setEmail('');
    setPassword('');
    setAccountType('STAFF');
    setScopes([]);
    setCreated(null);
  }

  function toggleScope(key: string) {
    setScopes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function applyPreset(preset: string[]) {
    setScopes(preset.length === 0 ? [] : Array.from(new Set([...scopes, ...preset])));
  }

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const user = await api<{ fullName: string | null; email: string | null; role: string }>('/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password, accountType, permissions: accountType === 'SUPER_ADMIN' ? [] : scopes }),
      });
      setCreated(user);
    } catch (err) {
      toast({ title: 'Could not create account', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  function close() {
    onOpenChange(false);
    if (created) onCreated();
    reset();
  }

  const canNext = step === 0 ? fullName.trim().length >= 2 && /.+@.+\..+/.test(email) && password.length >= 8 : step === 1 ? accountType === 'SUPER_ADMIN' || scopes.length > 0 : true;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">New operator account</DialogTitle>
          <DialogDescription>
            Step {created ? 3 : step + 1} of 3 — {created ? 'done' : STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
              <p className="font-medium">{created.fullName}</p>
              <p className="text-muted-foreground">{created.email}</p>
              <p className="mt-1 text-xs">
                {created.role === 'SUPER_ADMIN'
                  ? 'Owner account — implicitly full access.'
                  : `Staff account with ${scopes.length} function${scopes.length === 1 ? '' : 's'} granted.`}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Share the email + password securely (never over WhatsApp groups). The password is shown only to you, right now.
            </p>
            <Button className="w-full" onClick={close}>Done</Button>
          </div>
        ) : step === 0 ? (
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="w-name">Full name</Label>
              <Input id="w-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ramesh Patel" autoFocus />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="w-email">Login email</Label>
              <Input id="w-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ramesh@patelnetworks.in" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="w-pass">Password (min 8 chars)</Label>
              <div className="flex gap-2">
                <Input id="w-pass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono text-sm" />
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setPassword(generatePassword())}>
                  Generate
                </Button>
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button disabled={!canNext} onClick={() => setStep(1)}>Next: functions</Button>
            </div>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAccountType('STAFF')}
                aria-pressed={accountType === 'STAFF'}
                className={cn(
                  'rounded-md border p-3 text-left transition-colors',
                  accountType === 'STAFF' ? 'border-primary bg-primary/5' : 'hover:border-primary/40',
                )}
              >
                <p className="text-sm font-medium">Staff</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Sees only the functions you grant.</p>
              </button>
              <button
                type="button"
                onClick={() => setAccountType('SUPER_ADMIN')}
                aria-pressed={accountType === 'SUPER_ADMIN'}
                className={cn(
                  'rounded-md border p-3 text-left transition-colors',
                  accountType === 'SUPER_ADMIN' ? 'border-primary bg-primary/5' : 'hover:border-primary/40',
                )}
              >
                <p className="text-sm font-medium">Superadmin (Owner)</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Full access — like you. Use sparingly.</p>
              </button>
            </div>

            {accountType === 'STAFF' && (
              <div className="space-y-4">
                <div>
                  <p className="label-caps mb-2">Quick presets</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyPreset(p.scopes)}
                        className="rounded-full border px-3 py-1 text-xs transition-colors hover:border-primary hover:bg-primary/5"
                      >
                        + {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setScopes([])}
                      className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <div className="max-h-64 space-y-4 overflow-y-auto thin-scrollbar rounded-md border p-3">
                  {GROUPS.map((group) => (
                    <fieldset key={group}>
                      <legend className="label-caps mb-2">{group}</legend>
                      <div className="space-y-2">
                        {PERMISSION_SCOPES.filter((s) => s.group === group).map((s) => (
                          <label key={s.key} className="flex cursor-pointer items-start gap-2.5 rounded-md p-1.5 transition-colors hover:bg-muted/60">
                            <Checkbox
                              checked={scopes.includes(s.key)}
                              onCheckedChange={() => toggleScope(s.key)}
                              className="mt-0.5"
                              aria-label={s.label}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm leading-tight">{s.label}</span>
                              <span className="block text-xs text-muted-foreground">{s.description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {scopes.length} function{scopes.length === 1 ? '' : 's'} selected — editable any time.
                </p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
              <Button disabled={!canNext} onClick={() => setStep(2)}>Next: review</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="space-y-2 rounded-md border p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{fullName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Login email</dt>
                <dd className="font-mono text-xs">{email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Account type</dt>
                <dd className="font-medium">{accountType === 'SUPER_ADMIN' ? 'Owner (full access)' : 'Staff'}</dd>
              </div>
              {accountType === 'STAFF' && (
                <div>
                  <dt className="text-muted-foreground">Functions</dt>
                  <dd className="mt-1">{scopeChips(scopes)}</dd>
                </div>
              )}
            </dl>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={create} disabled={busy}>
                {busy ? 'Creating…' : 'Create account'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function EditDialog({ account, onClose, onSaved }: { account: Account | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (account) {
      setFullName(account.fullName ?? '');
      setPassword('');
      setScopes(account.permissions);
      setIsActive(account.isActive);
    }
  }, [account]);

  if (!account) return null;
  const isOwner = account.role === 'SUPER_ADMIN';

  async function save() {
    if (!account || busy) return;
    setBusy(true);
    try {
      await api(`/api/admin/staff/${account.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(fullName !== (account.fullName ?? '') ? { fullName } : {}),
          ...(password ? { password } : {}),
          ...(!isOwner ? { permissions: scopes } : {}),
          ...(isActive !== account.isActive ? { isActive } : {}),
        }),
      });
      toast({ title: 'Account updated', description: 'Scope changes apply on their next request.' });
      onSaved();
    } catch (err) {
      toast({ title: 'Update failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(account)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Manage {account.fullName || account.email}</DialogTitle>
          <DialogDescription>
            {isOwner ? 'Owner account — implicitly full access.' : 'Rename, reset the password, or change the granted functions.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="e-name">Full name</Label>
            <Input id="e-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="e-pass">Reset password (optional)</Label>
            <div className="flex gap-2">
              <Input id="e-pass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" className="font-mono text-sm" />
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setPassword(generatePassword())}>
                Generate
              </Button>
            </div>
          </div>

          {!isOwner && (
            <fieldset className="max-h-56 space-y-2 overflow-y-auto thin-scrollbar rounded-md border p-3">
              <legend className="label-caps">Granted functions</legend>
              {PERMISSION_SCOPES.map((s) => (
                <label key={s.key} className="flex cursor-pointer items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-muted/60">
                  <Checkbox
                    checked={scopes.includes(s.key)}
                    onCheckedChange={() =>
                      setScopes((prev) => (prev.includes(s.key) ? prev.filter((k) => k !== s.key) : [...prev, s.key]))
                    }
                    aria-label={s.label}
                  />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </fieldset>
          )}

          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
              aria-label="Account active"
              disabled={isOwner}
            />
            <span className="text-sm">Account active {isOwner && '(owners cannot be deactivated here)'}</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
