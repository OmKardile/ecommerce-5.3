// GST engine — India. Prices are stored GST-INCLUSIVE.
// Intra-state (same state as origin Gujarat): CGST + SGST (rate/2 each).
// Inter-state: IGST (full rate). All math in integer paise with banker-safe rounding.

const ORIGIN_STATE = 'Gujarat';

/** Intra-state = destination PIN is a Gujarat PIN (prefixes 36–39, state code 24). */
export function isSameState(_originPin: string, destinationPin: string): boolean {
  const prefix = destinationPin.slice(0, 2);
  return ['36', '37', '38', '39'].includes(prefix);
}

export interface GstSplit {
  base: number; // taxable value (paise)
  gst: number; // total tax (paise)
  cgst: number;
  sgst: number;
  igst: number;
}

/**
 * Extract GST from an INCLUSIVE price: base = price * 100 / (100 + rate).
 * Integer math with rounding to the nearest paise.
 */
export function splitGstInclusive(priceInclusivePaise: number, gstRatePercent: number, destinationState?: string): GstSplit {
  const rate = gstRatePercent;
  const base = Math.round((priceInclusivePaise * 100) / (100 + rate));
  const gst = priceInclusivePaise - base;
  const intra = destinationState ? destinationState === ORIGIN_STATE : true;
  if (intra) {
    const half = Math.round(gst / 2);
    return { base, gst, cgst: half, sgst: gst - half, igst: 0 };
  }
  return { base, gst, cgst: 0, sgst: 0, igst: gst };
}
