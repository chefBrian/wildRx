// Display formatters for clinical readouts.
// Keep these pure so they're trivial to test.

/**
 * Format a dose/volume number with clinically-useful precision.
 * Rules:
 *   - 0 → "0"
 *   - |n| >= 100  → no decimals      (e.g. 240)
 *   - |n| >= 10   → 1 decimal        (e.g. 24.3)
 *   - |n| >= 1    → 2 decimals       (e.g. 2.41)
 *   - |n| >= 0.1  → 3 decimals       (e.g. 0.241)
 *   - smaller     → 3 significant figures, never rounds to 0
 *                   (e.g. 0.0024 → "0.0024", 0.0000031 → "3.1e-6")
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1);
  if (abs >= 1) return n.toFixed(2);
  if (abs >= 0.1) return n.toFixed(3);
  if (abs >= 0.001) {
    const fixed = n.toPrecision(3);
    return Number(fixed).toString();
  }
  return n.toPrecision(2);
}

/** Format a weight in grams; show kg parenthetically when >= 1000g. */
export function formatWeight(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return '—';
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${grams} g (${formatNumber(kg)} kg)`;
  }
  return `${grams} g`;
}

/** Short form for chips / breadcrumbs. */
export function formatWeightShort(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return '—';
  if (grams >= 1000) return `${formatNumber(grams / 1000)} kg`;
  return `${grams} g`;
}
