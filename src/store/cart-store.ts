"use client";

// Cart store — zustand mirror of the server cart (source of truth = DB).
// Holds the serialized CartView from GET /api/cart plus UI state.

import { create } from "zustand";
import { useEffect } from "react";

export interface CartLine {
  skuId: string;
  skuCode: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  image: string | null;
  quantity: number;
  unitPricePaise: number;
  mrpPaise: number;
  lineTotalPaise: number;
  taxRate: number;
  availableStock: number;
  isCodAllowed: boolean;
  inStock: boolean;
}

export interface CartView {
  lines: CartLine[];
  itemCount: number;
  subtotalPaise: number;
  mrpTotalPaise: number;
  gstAmountPaise: number;
  taxableBasePaise: number;
  allCodAllowed: boolean;
  hasOutOfStock: boolean;
  bundleDiscountPaise: number;
  bundleApplied: { name: string; discountPct: number } | null;
}

interface CartState {
  cart: CartView;
  loaded: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  add: (skuId: string, quantity?: number) => Promise<{ ok: boolean; error?: string }>;
  update: (skuId: string, quantity: number) => Promise<{ ok: boolean; error?: string }>;
  remove: (skuId: string) => Promise<void>;
  clear: () => Promise<void>;
}

const emptyCart: CartView = {
  lines: [],
  itemCount: 0,
  subtotalPaise: 0,
  mrpTotalPaise: 0,
  gstAmountPaise: 0,
  taxableBasePaise: 0,
  allCodAllowed: true,
  hasOutOfStock: false,
  bundleDiscountPaise: 0,
  bundleApplied: null,
};

export const useCartStore = create<CartState>((set, get) => ({
  cart: emptyCart,
  loaded: false,
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      const json = (await res.json()) as { ok: boolean; data?: { cart: CartView } };
      if (json.ok && json.data) set({ cart: json.data.cart, loaded: true });
    } finally {
      set({ loading: false, loaded: true });
    }
  },
  add: async (skuId, quantity = 1) => {
    const res = await fetch("/api/cart/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skuId, quantity }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string; data?: { cart: CartView } };
    if (json.ok && json.data) {
      set({ cart: json.data.cart, loaded: true });
      return { ok: true };
    }
    return { ok: false, error: json.error ?? "Could not add item" };
  },
  update: async (skuId, quantity) => {
    const res = await fetch("/api/cart/item", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skuId, quantity }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string; data?: { cart: CartView } };
    if (json.ok && json.data) set({ cart: json.data.cart });
    return { ok: json.ok, error: json.error };
  },
  remove: async (skuId) => {
    await fetch(`/api/cart/item?skuId=${encodeURIComponent(skuId)}`, { method: "DELETE" });
    await get().refresh();
  },
  clear: async () => {
    await fetch("/api/cart/clear", { method: "POST" });
    await get().refresh();
  },
}));

/** Mounts once per storefront page load to hydrate the cart badge. */
export function CartHydrator() {
  useEffect(() => {
    void useCartStore.getState().refresh();
  }, []);
  return null;
}

export function useCartCount(): number {
  return useCartStore((s) => s.cart.itemCount);
}
