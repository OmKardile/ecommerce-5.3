"use client";

// Invoice print action — triggers the browser print dialog for the GST tax invoice.

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoicePrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="h-10">
      <Printer className="h-4 w-4" aria-hidden /> Print / save PDF
    </Button>
  );
}
