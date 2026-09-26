"use client";

// Global WhatsApp support widget (ADR-013) — quick prompts open wa.me deep links.

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const PROMPTS = [
  { label: "Track my order", text: "Hi, I want to track my Patel Networks order." },
  { label: "B2B / wholesale pricing", text: "Hi, I need a wholesale quote for a surveillance project (10+ units)." },
  { label: "CCTV architecture advice", text: "Hi, I need help planning cameras and a recorder for my site." },
  { label: "Warranty / RMA support", text: "Hi, I need warranty support for a product. Serial number:" },
];

export function WhatsAppWidget({ phone }: { phone: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-md"
            role="dialog"
            aria-label="WhatsApp support"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Commercial support desk</p>
              <p className="text-[12px] text-muted-foreground">Typically replies within working hours (Mon–Sat)</p>
            </div>
            <div className="flex flex-col p-2">
              {PROMPTS.map((p) => (
                <a
                  key={p.label}
                  href={`https://wa.me/${phone}?text=${encodeURIComponent(p.text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md px-3 py-2 text-[13px] font-medium text-foreground/85 hover:bg-muted"
                >
                  {p.label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close WhatsApp support" : "Open WhatsApp support"}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
