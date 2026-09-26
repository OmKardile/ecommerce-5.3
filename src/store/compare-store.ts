"use client";

// Compare selection — purely client-side (localStorage via zustand persist).
// Stores a minimal snapshot per product so the floating tray can render
// thumbnails without extra fetches; the /compare page re-validates ids
// server-side, so a stale snapshot can never show a wrong price.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const COMPARE_LIMIT = 4;

export interface CompareItem {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  priceFromPaise: number;
  brandName: string;
}

export type ToggleResult = "added" | "removed" | "full";

interface CompareState {
  items: CompareItem[];
  /** False until the persisted slice rehydrates — guards against SSR flash. */
  hydrated: boolean;
  setHydrated: () => void;
  toggle: (item: CompareItem) => ToggleResult;
  remove: (id: string) => void;
  clear: () => void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      toggle: (item) => {
        const { items } = get();
        if (items.some((i) => i.id === item.id)) {
          set({ items: items.filter((i) => i.id !== item.id) });
          return "removed";
        }
        if (items.length >= COMPARE_LIMIT) return "full";
        set({ items: [...items, item] });
        return "added";
      },
      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      clear: () => set({ items: [] }),
    }),
    {
      name: "pn-compare-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }) as CompareState,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
