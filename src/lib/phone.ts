// Indian phone normalization (ADR-011): E.164 (+91XXXXXXXXXX) for 10-digit numbers starting 6-9.

export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('91') && local.length === 12) local = local.slice(2);
  if (local.startsWith('0') && local.length === 11) local = local.slice(1);
  if (local.length === 10 && /^[6-9]/.test(local)) return `+91${local}`;
  return null;
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\+\d{2})(\d{5})(\d{3})/, '$1XXXXX$3');
}

/**
 * Input-field normalizer for 10-digit local phone fields. Strips a pasted
 * "+91 …" / "0 …" prefix BEFORE the 10-digit cap — capping first would keep
 * the first 10 digits of a 12-digit sequence and register the wrong account.
 * Only fires on clearly-prefixed lengths so ordinary typing is untouched
 * (no Indian mobile starts with 91/0).
 */
export function localPhoneFromInput(raw: string): string {
  let v = raw.replace(/\D/g, '');
  if (v.startsWith('91') && v.length >= 12) v = v.slice(2);
  if (v.startsWith('0') && v.length >= 11) v = v.slice(1);
  return v.slice(0, 10);
}
