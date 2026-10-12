// Plain decimals only: Number() would accept "0x10" (16) and "1e3" (1000).
const PLAIN_DECIMAL = /^(\d+\.?\d*|\.\d+)$/;

/** Weight in kg from a URL segment or form field. null unless it's a plain decimal above 0. */
export function parseWeightParam(s: string | null | undefined): number | null {
  const t = (s ?? '').trim();
  if (!PLAIN_DECIMAL.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}
