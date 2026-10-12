import type { Concentration, DoseUnit } from './types';

// Display formatters for clinical readouts.
// Keep these pure so they're trivial to test.

/**
 * Format a dose/volume number with clinically-useful precision.
 * Tiers set the MAXIMUM decimals; trailing zeros are always stripped
 * (ISMP do-not-use list: "5.0" can be misread as 50).
 *   - 0 → "0"
 *   - |n| >= 100   → no decimals          (e.g. 240, 10,000)
 *   - |n| >= 10    → up to 1 decimal      (e.g. 24.3, 24)
 *   - |n| >= 1     → up to 2 decimals     (e.g. 2.41, 5)
 *   - |n| >= 0.1   → up to 3 decimals     (e.g. 0.241, 0.2)
 *   - |n| >= 0.001 → 3 significant figures (e.g. 0.0024)
 *   - smaller      → 2 significant figures, plain decimal, never exponent
 *                    (e.g. 0.0000031, 0.00000031)
 * Results of 1000 or more get thousands separators so 10,000 IU can't be misread.
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  // Group the rounded string, not the input: 999.6 rounds to "1000" and still needs "1,000".
  return groupThousands(stripTrailingZeros(n.toFixed(decimalsFor(Math.abs(n)))));
}

/** "5 mg" when min and max display the same, otherwise "5–10 mg". */
export function formatRange(min: number, max: number, unit: string): string {
  return isRange(min, max)
    ? `${formatNumber(min)}–${formatNumber(max)} ${unit}`
    : `${formatNumber(min)} ${unit}`;
}

/** True when min and max would display differently. */
export function isRange(min: number, max: number): boolean {
  return formatNumber(min) !== formatNumber(max);
}

function decimalsFor(abs: number): number {
  if (abs >= 100) return 0;
  if (abs >= 10) return 1;
  if (abs >= 1) return 2;
  if (abs >= 0.1) return 3;
  const sigFigs = abs >= 0.001 ? 3 : 2;
  // toFixed accepts at most 100 digits.
  return Math.min(100, sigFigs - 1 - Math.floor(Math.log10(abs)));
}

function stripTrailingZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function groupThousands(s: string): string {
  const [int, frac] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}

/** Format a weight in kg with clinically-useful precision. */
export function formatWeight(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return '—';
  return `${formatNumber(kg)} kg`;
}

/** Short form for chips / breadcrumbs. */
export function formatWeightShort(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return '—';
  return `${formatNumber(kg)} kg`;
}

/** "22.7 mg/ml · oral · Baytril" - strength is always generated from the number. */
export function formatConcentration(c: Concentration, unit: DoseUnit): string {
  const parts = [`${formatNumber(c.value)} ${unit}/ml`, c.form];
  if (c.note) parts.push(c.note);
  return parts.join(' · ');
}

/** Badge shown next to a medication name in search: mg, IU or ml/kg. */
export function formatUnitBadge(unit: DoseUnit): string {
  return unit === 'ml' ? 'ml/kg' : unit;
}

/** "1 day", "5 days", "5 to 7 days"; null when no duration is set. */
export function plainDuration(d: { min: number; max: number } | null): string | null {
  if (d === null) return null;
  if (d.min === d.max) return d.min === 1 ? '1 day' : `${d.min} days`;
  return `${d.min} to ${d.max} days`;
}

/** "0.2 mg/kg", or "1,000–2,000 IU/kg (typ 1,500)" for a range. */
export function formatDosePerKg(d: { min: number; typical: number; max: number }, unit: DoseUnit): string {
  const perKg = `${unit}/kg`;
  return d.min === d.max
    ? formatRange(d.typical, d.typical, perKg)
    : `${formatRange(d.min, d.max, perKg)} (typ ${formatNumber(d.typical)})`;
}
