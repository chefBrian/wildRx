import type { DosingRule, Concentration, DoseUnit } from './types';

export interface DoseTriple {
  min: number;
  typical: number;
  max: number;
}

export interface CalculateDoseInput {
  weightKg: number;
  rule: DosingRule;
  doseUnit: DoseUnit;
  concentration?: Concentration;
}

export interface DoseResult {
  dose: DoseTriple;           // in unit
  unit: DoseUnit;
  volumeMl?: DoseTriple;
  cappedByMaxDose: boolean;   // any of min/typical/max was capped
  typicalCapped: boolean;     // the typical value itself was capped
}

export function calculateDose(input: CalculateDoseInput): DoseResult {
  const { weightKg, rule, doseUnit, concentration } = input;
  const raw = {
    min: weightKg * rule.dosePerKg.min,
    typical: weightKg * rule.dosePerKg.typical,
    max: weightKg * rule.dosePerKg.max,
  };
  const cap = rule.maxSingleDose;
  // Max of all three (not raw.max) so legacy rules with min > max still flag.
  const cappedByMaxDose = cap !== null && Math.max(raw.min, raw.typical, raw.max) > cap;
  const typicalCapped = cap !== null && raw.typical > cap;
  const dose = cap === null
    ? raw
    : {
        min: Math.min(raw.min, cap),
        typical: Math.min(raw.typical, cap),
        max: Math.min(raw.max, cap),
      };
  return {
    dose,
    unit: doseUnit,
    volumeMl: volumeFor(dose, doseUnit, concentration),
    cappedByMaxDose,
    typicalCapped,
  };
}

function volumeFor(dose: DoseTriple, unit: DoseUnit, concentration?: Concentration): DoseTriple | undefined {
  // ml meds are dosed by volume: the dose is the volume.
  if (unit === 'ml') return dose;
  if (!concentration || !(concentration.value > 0)) return undefined;
  return {
    min: dose.min / concentration.value,
    typical: dose.typical / concentration.value,
    max: dose.max / concentration.value,
  };
}
