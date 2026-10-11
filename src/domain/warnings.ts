import type { Concentration, ConcentrationForm, DosingRule, Route } from './types';
import type { DoseResult } from './dose';
import { formatNumber } from './format';

/** Smallest volume a 1 ml syringe can reliably measure. */
export const MIN_MEASURABLE_ML = 0.01;

export interface DoseWarning {
  kind: 'cap' | 'formRoute' | 'unmeasurable';
  title: string;
  body: string;
}

/** Bottle-side warnings, in display order. Used by the result screen and the copied summary. */
export function doseWarnings(args: {
  result: DoseResult;
  rule: DosingRule;
  weightKg: number;
  concentration?: Concentration;
}): DoseWarning[] {
  const { result, rule, weightKg, concentration } = args;
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
  if (concentration && formMismatchesRoute(rule.route, concentration.form)) {
    warnings.push({
      kind: 'formRoute',
      title: 'Check the product',
      body: `This rule is ${rule.route}, but the selected concentration is ${concentration.form}. Confirm the product is suitable for injection.`,
    });
  }
  if (result.volumeMl && result.volumeMl.typical < MIN_MEASURABLE_ML) {
    warnings.push({
      kind: 'unmeasurable',
      title: 'Below measurable volume',
      body: 'Under 0.01 ml. Dilute before dosing - confirm the dilution with the attending vet.',
    });
  }
  return warnings;
}

/** One direction only: injectables given by mouth are common (e.g. meloxicam). */
export function formMismatchesRoute(route: Route, form: ConcentrationForm): boolean {
  return INJECTION_ROUTES.includes(route) && form !== 'injectable';
}

const INJECTION_ROUTES: Route[] = ['IM', 'SC', 'IV'];
