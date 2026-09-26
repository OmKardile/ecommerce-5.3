"use client";

// Address book — list, add, delete, set default via /api/account/addresses.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { localPhoneFromInput } from "@/lib/phone";

export interface BookAddress {
  id: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  type: string;
}

const PIN_RE = /^[1-9][0-9]{5}$/;

const emptyForm = {
  recipientName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
};

export function AccountAddressBook({ addresses }: { addresses: BookAddress[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(addresses.length === 0);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  function setField(key: keyof typeof emptyForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function addAddress() {
    const errs: Record<string, string> = {};
    if (form.recipientName.trim().length < 2) errs.recipientName = "Name is required.";
    if (!/^(\+91)?[6-9]\d{9}$/.test(form.phone.replace(/[\s-]/g, ""))) errs.phone = "Valid 10-digit mobile required.";
    if (form.addressLine1.trim().length < 5) errs.addressLine1 = "Address line 1 is required.";
    if (form.city.trim().length < 2) errs.city = "City is required.";
    if (form.state.trim().length < 2) errs.state = "State is required.";
    if (!PIN_RE.test(form.pincode)) errs.pincode = "Valid 6-digit PIN required.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, recipientName: form.recipientName.trim() }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) {
        toast({ title: "Address saved" });
        setForm(emptyForm);
        setShowForm(false);
        router.refresh();
      } else {
        toast({ title: "Could not save address", description: json.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(id: string) {
    setRowBusy(id);
    try {
      const res = await fetch(`/api/account/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) {
        toast({ title: "Default address updated" });
        router.refresh();
      } else {
        toast({ title: "Could not update", variant: "destructive" });
      }
    } finally {
      setRowBusy(null);
    }
  }

  async function remove(id: string) {
    setRowBusy(id);
    try {
      const res = await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Address removed" });
        router.refresh();
      } else {
        toast({ title: "Could not remove", variant: "destructive" });
      }
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <ul className="space-y-3" aria-label="Saved addresses">
        {addresses.map((a) => (
          <li key={a.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {a.recipientName}
                  {a.isDefault && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <Star className="h-2.5 w-2.5" aria-hidden /> Default
                    </span>
                  )}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{a.type.toLowerCase()}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {a.addressLine1}
                  {a.addressLine2 ? `, ${a.addressLine2}` : ""}
                  {a.landmark ? ` · ${a.landmark}` : ""}
                  <br />
                  {a.city}, {a.state} — {a.pincode} · +91 {a.phone.replace(/\D/g, "").slice(-10)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!a.isDefault && (
                  <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void setDefault(a.id)} disabled={rowBusy === a.id}>
                    {rowBusy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Star className="h-3.5 w-3.5" aria-hidden />} Set default
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-destructive"
                      disabled={rowBusy === a.id}
                      aria-label={`Delete address for ${a.recipientName}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display">Remove this address?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {a.addressLine1}, {a.city} — {a.pincode} will no longer be offered at checkout.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => void remove(a.id)}
                        className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                      >
                        <AlertTriangle className="h-4 w-4" aria-hidden /> Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {showForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void addAddress();
          }}
          className="rounded-lg border border-border bg-card p-5"
          aria-label="Add a new address"
        >
          <h3 className="font-display text-lg">New address</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ad-name" className="label-caps mb-1.5 block">Recipient name</Label>
              <Input id="ad-name" value={form.recipientName} onChange={(e) => setField("recipientName", e.target.value)} className="h-10" aria-invalid={Boolean(errors.recipientName)} />
              {errors.recipientName && <p role="alert" className="mt-1 text-xs text-destructive">{errors.recipientName}</p>}
            </div>
            <div>
              <Label htmlFor="ad-phone" className="label-caps mb-1.5 block">Mobile</Label>
              <Input id="ad-phone" inputMode="numeric" value={form.phone} onChange={(e) => setField("phone", localPhoneFromInput(e.target.value))} placeholder="98765 43210" className="h-10" aria-invalid={Boolean(errors.phone)} />
              {errors.phone && <p role="alert" className="mt-1 text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ad-line1" className="label-caps mb-1.5 block">Address line 1</Label>
              <Input id="ad-line1" value={form.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)} className="h-10" aria-invalid={Boolean(errors.addressLine1)} />
              {errors.addressLine1 && <p role="alert" className="mt-1 text-xs text-destructive">{errors.addressLine1}</p>}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ad-line2" className="label-caps mb-1.5 block">Address line 2 <span className="normal-case text-muted-foreground/70">(optional)</span></Label>
              <Input id="ad-line2" value={form.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)} className="h-10" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ad-landmark" className="label-caps mb-1.5 block">Landmark <span className="normal-case text-muted-foreground/70">(optional)</span></Label>
              <Input id="ad-landmark" value={form.landmark} onChange={(e) => setField("landmark", e.target.value)} className="h-10" />
            </div>
            <div>
              <Label htmlFor="ad-city" className="label-caps mb-1.5 block">City</Label>
              <Input id="ad-city" value={form.city} onChange={(e) => setField("city", e.target.value)} className="h-10" aria-invalid={Boolean(errors.city)} />
              {errors.city && <p role="alert" className="mt-1 text-xs text-destructive">{errors.city}</p>}
            </div>
            <div>
              <Label htmlFor="ad-state" className="label-caps mb-1.5 block">State</Label>
              <Input id="ad-state" value={form.state} onChange={(e) => setField("state", e.target.value)} className="h-10" aria-invalid={Boolean(errors.state)} />
              {errors.state && <p role="alert" className="mt-1 text-xs text-destructive">{errors.state}</p>}
            </div>
            <div>
              <Label htmlFor="ad-pin" className="label-caps mb-1.5 block">PIN code</Label>
              <Input id="ad-pin" inputMode="numeric" value={form.pincode} onChange={(e) => setField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} className="h-10" aria-invalid={Boolean(errors.pincode)} />
              {errors.pincode && <p role="alert" className="mt-1 text-xs text-destructive">{errors.pincode}</p>}
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <Button type="submit" disabled={busy} className="h-10">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MapPin className="h-4 w-4" aria-hidden />} Save address
            </Button>
            {addresses.length > 0 && (
              <Button type="button" variant="ghost" className="h-10" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" onClick={() => setShowForm(true)} className="h-10">
          <Plus className="h-4 w-4" aria-hidden /> Add a new address
        </Button>
      )}
    </div>
  );
}
