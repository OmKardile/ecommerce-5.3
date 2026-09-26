// Indian PIN code intelligence (ADR-012).
// Origin hub: Surat 395003 (Gujarat). Zones resolve delivery SLA and COD serviceability.

export interface PinZone {
  zone: 'INTRA_STATE' | 'METRO' | 'REGIONAL' | 'SPECIAL';
  label: string;
  etaMinDays: number;
  etaMaxDays: number;
  codAvailable: boolean;
  express: boolean;
}

const METRO_PREFIXES = ['11', '12', '13', '20', '40', '41', '50', '56', '60', '70'];
const SPECIAL_PREFIXES = ['78', '79', '19', '744'];
const GUJARAT_PREFIXES = ['36', '37', '38', '39'];

export function isValidPincode(pin: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pin);
}

export function resolveZone(pin: string): PinZone {
  const p = pin.slice(0, 3);
  const p2 = pin.slice(0, 2);
  if (GUJARAT_PREFIXES.includes(p2)) {
    return { zone: 'INTRA_STATE', label: 'Gujarat (Surat Central Hub)', etaMinDays: 1, etaMaxDays: 2, codAvailable: true, express: true };
  }
  if (SPECIAL_PREFIXES.includes(p2) || p === '744') {
    return { zone: 'SPECIAL', label: 'Special Logistics Zone (air cargo)', etaMinDays: 5, etaMaxDays: 7, codAvailable: false, express: false };
  }
  if (METRO_PREFIXES.includes(p2)) {
    return { zone: 'METRO', label: 'Metro Express Corridor', etaMinDays: 2, etaMaxDays: 3, codAvailable: true, express: true };
  }
  return { zone: 'REGIONAL', label: 'Regional Surface Network', etaMinDays: 3, etaMaxDays: 4, codAvailable: true, express: false };
}

export function isServiceable(pin: string): boolean {
  return isValidPincode(pin);
}

/** Estimated delivery date from now, skipping Sundays, given dispatch today before cutoff. */
export function estimateDelivery(pin: string, from: Date = new Date()): Date {
  const zone = resolveZone(pin);
  let remaining = zone.etaMaxDays;
  const d = new Date(from);
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) remaining -= 1; // skip Sundays
  }
  return d;
}
