'use client';

// Settings form — store ops config (ADR-004 COD rules, shipping, announcement).
// Money fields entered in rupees, persisted as paise via PUT /api/admin/settings.

import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/components/admin/api';
import { formatINR } from '@/lib/money';

interface SettingsShape {
  codMaxOrderValuePaise: number;
  codFeePaise: number;
  shippingFeePaise: number;
  freeShippingThresholdPaise: number;
  dispatchCutoff: string;
  supportPhone: string;
  announcement: string;
}

type Draft = {
  codMaxOrderRupees: string;
  codFeeRupees: string;
  shippingFeeRupees: string;
  freeShippingRupees: string;
  dispatchCutoff: string;
  supportPhone: string;
  announcement: string;
};

const EMPTY: Draft = { codMaxOrderRupees: '', codFeeRupees: '', shippingFeeRupees: '', freeShippingRupees: '', dispatchCutoff: '', supportPhone: '', announcement: '' };

function toDraft(s: SettingsShape): Draft {
  return {
    codMaxOrderRupees: String(s.codMaxOrderValuePaise / 100),
    codFeeRupees: String(s.codFeePaise / 100),
    shippingFeeRupees: String(s.shippingFeePaise / 100),
    freeShippingRupees: String(s.freeShippingThresholdPaise / 100),
    dispatchCutoff: s.dispatchCutoff,
    supportPhone: s.supportPhone,
    announcement: s.announcement,
  };
}

function paiseFromRupees(raw: string, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100);
}

export function SettingsForm() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SettingsShape | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ settings: SettingsShape }>('/api/admin/settings')
      .then((res) => {
        if (!alive) return;
        setSettings(res.settings);
        setDraft(toDraft(res.settings));
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      });
    return () => {
      alive = false;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !settings) return;
    setBusy(true);
    setError(null);
    const payload = {
      codMaxOrderValuePaise: paiseFromRupees(draft.codMaxOrderRupees, settings.codMaxOrderValuePaise),
      codFeePaise: paiseFromRupees(draft.codFeeRupees, settings.codFeePaise),
      shippingFeePaise: paiseFromRupees(draft.shippingFeeRupees, settings.shippingFeePaise),
      freeShippingThresholdPaise: paiseFromRupees(draft.freeShippingRupees, settings.freeShippingThresholdPaise),
      dispatchCutoff: draft.dispatchCutoff.trim(),
      supportPhone: draft.supportPhone.trim(),
      announcement: draft.announcement.trim(),
    };
    try {
      const res = await api<{ settings: SettingsShape }>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
      setSettings(res.settings);
      setDraft(toDraft(res.settings));
      toast({ title: 'Settings saved', description: 'Checkout pricing and announcements reflect the new values immediately.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setError(message);
      toast({ title: 'Save failed', description: message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Pricing & fees</CardTitle>
            <p className="text-xs text-muted-foreground">Entered in rupees · persisted as paise</p>
          </CardHeader>
          <CardContent className="grid gap-3.5 sm:grid-cols-2">
            {settings === null ? (
              [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-md" />)
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="st-cod-max">COD max order value (₹)</Label>
                  <Input id="st-cod-max" type="number" min={1} step="0.01" value={draft.codMaxOrderRupees} onChange={(e) => setDraft({ ...draft, codMaxOrderRupees: e.target.value })} required />
                  <p className="text-[10px] text-muted-foreground">Currently {formatINR(settings.codMaxOrderValuePaise)} — orders above this are prepaid-only.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-cod-fee">COD fee (₹)</Label>
                  <Input id="st-cod-fee" type="number" min={0} step="0.01" value={draft.codFeeRupees} onChange={(e) => setDraft({ ...draft, codFeeRupees: e.target.value })} required />
                  <p className="text-[10px] text-muted-foreground">Flat handling fee added to COD orders.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-ship-fee">Shipping fee (₹)</Label>
                  <Input id="st-ship-fee" type="number" min={0} step="0.01" value={draft.shippingFeeRupees} onChange={(e) => setDraft({ ...draft, shippingFeeRupees: e.target.value })} required />
                  <p className="text-[10px] text-muted-foreground">Applied when the cart is below the free-shipping threshold.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-free-ship">Free shipping threshold (₹)</Label>
                  <Input id="st-free-ship" type="number" min={0} step="0.01" value={draft.freeShippingRupees} onChange={(e) => setDraft({ ...draft, freeShippingRupees: e.target.value })} required />
                  <p className="text-[10px] text-muted-foreground">Carts at or above this value ship free (air-cargo zones excepted).</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Storefront messaging</CardTitle>
            <p className="text-xs text-muted-foreground">Support contact and site-wide announcement</p>
          </CardHeader>
          <CardContent className="grid gap-3.5">
            {settings === null ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-md" />)
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="st-cutoff">Dispatch cutoff</Label>
                  <Input id="st-cutoff" value={draft.dispatchCutoff} onChange={(e) => setDraft({ ...draft, dispatchCutoff: e.target.value })} maxLength={40} placeholder="4:00 PM IST" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-phone">Support phone</Label>
                  <Input id="st-phone" value={draft.supportPhone} onChange={(e) => setDraft({ ...draft, supportPhone: e.target.value })} maxLength={20} placeholder="+91 98765 43210" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-announcement">Announcement</Label>
                  <Textarea id="st-announcement" value={draft.announcement} onChange={(e) => setDraft({ ...draft, announcement: e.target.value })} maxLength={160} rows={3} />
                  <p className="text-[10px] text-muted-foreground">Shown in the storefront announcement bar · max 160 characters.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy || settings === null}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {busy ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}
