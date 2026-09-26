"use client";

// Account profile form + sign-out. Edits customer profile via PUT /api/account/profile.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export interface ProfileValues {
  fullName: string;
  phone: string;
  companyName: string;
  gstin: string;
}

export function AccountProfileForm({ profile }: { profile: ProfileValues }) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [gstin, setGstin] = useState(profile.gstin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (fullName.trim().length < 2) {
      setError("Name needs at least 2 characters.");
      return;
    }
    const cleanGstin = gstin.trim().toUpperCase();
    if (cleanGstin && !GSTIN_RE.test(cleanGstin)) {
      setError("Enter a valid 15-character GSTIN, or leave it blank.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), companyName: companyName.trim() || undefined, gstin: cleanGstin || undefined }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) {
        toast({ title: "Profile saved", description: "Your details are up to date." });
      } else {
        setError(json.error ?? "Could not save the profile.");
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-4"
      aria-label="Profile details"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pf-name" className="label-caps mb-1.5 block">Full name</Label>
          <Input id="pf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-10" autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="pf-phone" className="label-caps mb-1.5 block">Mobile (login id)</Label>
          <Input id="pf-phone" value={profile.phone} disabled className="h-10 bg-muted font-mono" aria-describedby="pf-phone-hint" />
          <p id="pf-phone-hint" className="mt-1 text-[11px] text-muted-foreground">Your number is your identity — it cannot be changed here.</p>
        </div>
        <div>
          <Label htmlFor="pf-company" className="label-caps mb-1.5 block">Company <span className="normal-case text-muted-foreground/70">(optional)</span></Label>
          <Input id="pf-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-10" placeholder="Contractor / firm name" />
        </div>
        <div>
          <Label htmlFor="pf-gstin" className="label-caps mb-1.5 block">GSTIN <span className="normal-case text-muted-foreground/70">(optional)</span></Label>
          <Input
            id="pf-gstin"
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))}
            className="h-10 font-mono uppercase"
            placeholder="24AAACP1234F1Z8"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving} className="h-10">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />} Save profile
      </Button>
    </form>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={() => void signOut()} disabled={busy} className={className}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />} Sign out
    </Button>
  );
}
