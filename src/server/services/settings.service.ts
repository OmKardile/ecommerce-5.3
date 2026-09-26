// Store settings — persisted in the Setting table (key/value JSON), with documented defaults.

import { db } from '@/lib/db';
import { COD_FEE_PAISE, COD_MAX_ORDER_VALUE_PAISE, DEFAULT_SHIPPING_FEE_PAISE, FREE_SHIPPING_THRESHOLD_PAISE, STORE } from '@/lib/constants';

export interface StoreSettings {
  codMaxOrderValuePaise: number;
  codFeePaise: number;
  shippingFeePaise: number;
  freeShippingThresholdPaise: number;
  dispatchCutoff: string;
  supportPhone: string;
  announcement: string;
}

const DEFAULTS: StoreSettings = {
  codMaxOrderValuePaise: COD_MAX_ORDER_VALUE_PAISE,
  codFeePaise: COD_FEE_PAISE,
  shippingFeePaise: DEFAULT_SHIPPING_FEE_PAISE,
  freeShippingThresholdPaise: FREE_SHIPPING_THRESHOLD_PAISE,
  dispatchCutoff: STORE.dispatchCutoff,
  supportPhone: STORE.supportPhone,
  announcement: 'Same-day dispatch on orders confirmed before 4:00 PM IST (Mon–Sat) · Pan-India delivery',
};

export async function getSettings(): Promise<StoreSettings> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: 'store.' } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const read = <K extends keyof StoreSettings>(key: K, fallback: StoreSettings[K]): StoreSettings[K] => {
    const raw = map.get(`store.${key}`);
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as StoreSettings[K];
    } catch {
      return fallback;
    }
  };
  return {
    codMaxOrderValuePaise: read('codMaxOrderValuePaise', DEFAULTS.codMaxOrderValuePaise),
    codFeePaise: read('codFeePaise', DEFAULTS.codFeePaise),
    shippingFeePaise: read('shippingFeePaise', DEFAULTS.shippingFeePaise),
    freeShippingThresholdPaise: read('freeShippingThresholdPaise', DEFAULTS.freeShippingThresholdPaise),
    dispatchCutoff: read('dispatchCutoff', DEFAULTS.dispatchCutoff),
    supportPhone: read('supportPhone', DEFAULTS.supportPhone),
    announcement: read('announcement', DEFAULTS.announcement),
  };
}

export async function saveSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [string, unknown][];
  for (const [key, value] of entries) {
    await db.setting.upsert({
      where: { key: `store.${key}` },
      update: { value: JSON.stringify(value) },
      create: { key: `store.${key}`, value: JSON.stringify(value) },
    });
  }
  return getSettings();
}
