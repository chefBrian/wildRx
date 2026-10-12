import type { DosingRule } from './types';
import type { DoseResult } from './dose';
import { formatNumber } from './format';

/** Smallest volume a 1 ml syringe can reliably measure. */
export const MIN_MEASURABLE_ML = 0.01;

export interface DoseWarning {
  kind: 'cap' | 'unmeasurable';
  title: string;
  body: string;
}

/**
 * Bottle-side warnings, in display order. Used by the result screen and the copied summary.
 * Route limits are enforced by the result screen's block, not a warning.
 */
export function doseWarnings(args: {
  result: DoseResult;
  rule: DosingRule;
  weightKg: number;
}): DoseWarning[] {
  const { result, rule, weightKg } = args;
  const warnings: DoseWarning[] = [];
  const cap = rule.maxSingleDose;
  const unit = result.unit;
  if (result.cappedByMaxDose && cap !== null) {
    const rawTypical = weightKg * rule.dosePerKg.typical;
    warnings.push({
      kind: 'cap',
      title: 'Capped at max single dose',
      body: result.typicalCapped
        ? `Calculated ${formatNumber(rawTypical)} ${unit} exceeded the ${formatNumber(cap)} ${unit} cap. Showing the capped value.`
        : `Top of range capped at ${formatNumber(cap)} ${unit}.`,
    });
  }
  if (result.volumeMl && result.volumeMl.typical < MIN_MEASURABLE_ML) {
    warnings.push({
      kind: 'unmeasurable',
      title: 'Below measurable volume',
      body: 'Under 0.01 ml. Dilute before dosing - confirm the dilution with the attending vet.',
    });
  } else if (result.volumeMl && result.volumeMl.min < MIN_MEASURABLE_ML) {
    warnings.push({
      kind: 'unmeasurable',
      title: 'Below measurable volume',
      body: 'The low end of the range is under 0.01 ml. Dilute before dosing - confirm the dilution with the attending vet.',
    });
  }
  return warnings;
}
