"use client";

// Customer self-service actions on an order: cancel (pre-pack), return /
// DOA replacement request (delivered, inside the 7-day window) and delivery
// address edit (pre-pack). Each opens a dialog, calls the order API, then
// refreshes the server page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Ban, MapPin, RotateCcw } from "lucide-react";

async function postOrderAction(path: string, body?: unknown, method: "POST" | "PATCH" = "POST"): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !json.ok) return { ok: false, error: json.error ?? "Something went wrong. Try again." };
  return { ok: true };
}

interface CancelOrderButtonProps {
  orderNumber: string;
  /** Server-computed: FSM permits customer cancellation in the current status. */
  canCancel: boolean;
}

export function CancelOrderButton({ orderNumber, canCancel }: CancelOrderButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!canCancel) return null;

  async function confirm() {
    setBusy(true);
    const result = await postOrderAction(`/api/orders/${encodeURIComponent(orderNumber)}/cancel`, reason.trim() ? { reason: reason.trim() } : undefined);
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      setReason("");
      toast({ title: "Order cancelled", description: "Reserved stock has been released. Refunds for prepaid orders return to the source in 4–5 working days." });
      router.refresh();
    } else {
      toast({ title: "Could not cancel", description: result.error, variant: "destructive" });
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="h-10 text-destructive hover:bg-destructive/5 hover:text-destructive">
          <Ban className="h-4 w-4" aria-hidden /> Cancel order
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Cancel {orderNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This releases the reserved stock immediately. Prepaid payments are refunded to the original payment method; the invoice is voided.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason" className="text-xs text-muted-foreground">
            Reason (optional — helps us improve)
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Found a better spec for the site"
            className="resize-none"
          />
        </div>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Keep order
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy} className="min-w-32">
            {busy ? "Cancelling…" : "Cancel order"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface RequestReturnButtonProps {
  orderNumber: string;
  /** Server-computed: status is DELIVERED and inside the 7-day window. */
  canReturn: boolean;
  /** Server-computed: an open return is already in the pipeline. */
  hasOpenReturn?: boolean;
  /** Days remaining in the window (for the helper copy). */
  daysLeft?: number;
}

export function RequestReturnButton({ orderNumber, canReturn, hasOpenReturn = false, daysLeft }: RequestReturnButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!canReturn || hasOpenReturn) return null;

  async function submit() {
    if (reason.trim().length < 10) {
      setError("Describe the issue in at least 10 characters.");
      return;
    }
    setError("");
    setBusy(true);
    const result = await postOrderAction(`/api/orders/${encodeURIComponent(orderNumber)}/returns`, { reason: reason.trim() });
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      setReason("");
      toast({ title: "Return requested", description: "Our trade desk reviews requests within one working day and arranges pickup for approved DOA/warranty returns." });
      router.refresh();
    } else {
      toast({ title: "Could not submit request", description: result.error, variant: "destructive" });
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="h-10">
          <RotateCcw className="h-4 w-4" aria-hidden /> Return or DOA replacement
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Request a return — {orderNumber}</AlertDialogTitle>
          <AlertDialogDescription>
            {typeof daysLeft === "number" && daysLeft >= 0
              ? `${daysLeft === 0 ? "Last day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`} left in the 7-day DOA/return window. Serial numbers captured at dispatch must match the invoice for the RMA to be accepted.`
              : "Serial numbers captured at dispatch must match the invoice for the RMA to be accepted."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="return-reason" className="text-xs text-muted-foreground">
            What went wrong?
          </Label>
          <Textarea
            id="return-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={600}
            placeholder="e.g. Camera arrived DOA — no power LED, tried two adapters and a known-good PSU."
            className="resize-none"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Close
          </Button>
          <Button onClick={submit} disabled={busy} className="min-w-40">
            {busy ? "Submitting…" : "Submit request"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface EditAddressButtonProps {
  orderNumber: string;
  /** Server-computed: order is pre-pack so the address is still editable. */
  canEdit: boolean;
  initial: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    landmark: string;
    city: string;
    state: string;
    pincode: string;
  };
}

export function EditAddressButton({ orderNumber, canEdit, initial }: EditAddressButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    recipientName: initial.recipientName,
    phone: initial.phone,
    addressLine1: initial.addressLine1,
    addressLine2: initial.addressLine2,
    landmark: initial.landmark,
    city: initial.city,
  });

  if (!canEdit) return null;

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (form.recipientName.trim().length < 2) return setError("Enter the recipient name.");
    if (form.addressLine1.trim().length < 5) return setError("Enter the flat / building / street (at least 5 characters).");
    if (form.city.trim().length < 2) return setError("Enter the city.");
    const digits = form.phone.replace(/\D/g, "");
    if (!(digits.length === 10 && /^[6-9]/.test(digits)) && !(digits.length === 12 && digits.startsWith("91"))) {
      return setError("Enter a valid Indian mobile number.");
    }
    setError("");
    setBusy(true);
    const result = await postOrderAction(
      `/api/orders/${encodeURIComponent(orderNumber)}/address`,
      {
        recipientName: form.recipientName.trim(),
        phone: digits,
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        landmark: form.landmark.trim(),
        city: form.city.trim(),
      },
      "PATCH",
    );
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      toast({ title: "Address updated", description: `The kit ships to the new address — state & PIN ${initial.pincode} stay unchanged, so shipping and GST are unaffected.` });
      router.refresh();
    } else {
      toast({ title: "Could not update address", description: result.error, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-primary hover:bg-primary/5 hover:text-primary">
          <MapPin className="h-3.5 w-3.5" aria-hidden /> Edit address
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Edit delivery address</DialogTitle>
          <DialogDescription>
            Update until the order is packed at the Surat hub. State and PIN {initial.pincode} are locked — they set the shipping zone and the GST split on the invoice. For a different PIN, cancel and reorder (one click while pre-pack).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="addr-name" className="text-xs text-muted-foreground">Recipient name</Label>
            <Input id="addr-name" value={form.recipientName} onChange={(e) => setField("recipientName", e.target.value)} maxLength={80} autoComplete="name" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="addr-phone" className="text-xs text-muted-foreground">Mobile number</Label>
            <Input id="addr-phone" value={form.phone} onChange={(e) => setField("phone", e.target.value)} inputMode="tel" maxLength={12} placeholder="10-digit mobile" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="addr-line1" className="text-xs text-muted-foreground">Flat / building / street</Label>
            <Input id="addr-line1" value={form.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)} maxLength={160} autoComplete="address-line1" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="addr-line2" className="text-xs text-muted-foreground">Area / locality (optional)</Label>
            <Input id="addr-line2" value={form.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)} maxLength={160} autoComplete="address-line2" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="addr-landmark" className="text-xs text-muted-foreground">Landmark (optional)</Label>
            <Input id="addr-landmark" value={form.landmark} onChange={(e) => setField("landmark", e.target.value)} maxLength={120} placeholder="e.g. Near Udhna Darwaja" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-city" className="text-xs text-muted-foreground">City</Label>
            <Input id="addr-city" value={form.city} onChange={(e) => setField("city", e.target.value)} maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-region" className="text-xs text-muted-foreground">State · PIN (locked)</Label>
            <Input id="addr-region" value={`${initial.state} — ${initial.pincode}`} disabled aria-readonly className="cursor-not-allowed opacity-80" />
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
        <DialogFooter className="mt-2 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Close</Button>
          <Button onClick={submit} disabled={busy} className="min-w-36">
            {busy ? "Saving…" : "Save address"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
