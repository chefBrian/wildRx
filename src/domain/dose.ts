import type { DosingRule, Concentration } from './types';

export interface CalculateDoseInput {
  weightGrams: number;
  rule: DosingRule;
  concentration?: Concentration;
}

export interface DoseResult {
  doseMg: { min: number; typical: number; max: number };
  volumeMl?: { min: number; typical: number; max: number };
  cappedByMaxDose: boolean;
}

export function calculateDose(input: CalculateDoseInput): DoseResult {
  const { weightGrams, rule, concentration } = input;
  const kg = weightGrams / 1000;
  const doseMg = {
    min: kg * rule.mgPerKg.min,
    typical: kg * rule.mgPerKg.typical,
    max: kg * rule.mgPerKg.max,
  };
  const volumeMl = concentration
    ? {
        min: doseMg.min / concentration.mgPerMl,
        typical: doseMg.typical / concentration.mgPerMl,
        max: doseMg.max / concentration.mgPerMl,
      }
    : undefined;
  return { doseMg, volumeMl, cappedByMaxDose: false };
}
