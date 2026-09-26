// Money helpers — ALL monetary values are integers in paise (1 INR = 100 paise).
// Never use floating point for financial math (ADR-008).

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Format integer paise as Indian Rupee currency, e.g. 145000 -> "₹1,450" */
export function formatINR(paise: number, opts?: { withDecimals?: boolean }): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: opts?.withDecimals ? 2 : 0,
    maximumFractionDigits: opts?.withDecimals ? 2 : 0,
  }).format(rupees);
}

/** Format paise as a plain Indian-grouped number (no symbol), e.g. 145000 -> "1,450" */
export function formatINRPlain(paise: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(paise / 100);
}

/** Discount percentage off MRP, rounded down. */
export function discountPercent(sellingPricePaise: number, mrpPaise: number): number {
  if (mrpPaise <= 0 || sellingPricePaise >= mrpPaise) return 0;
  return Math.floor(((mrpPaise - sellingPricePaise) / mrpPaise) * 100);
}
