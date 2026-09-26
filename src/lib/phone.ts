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
