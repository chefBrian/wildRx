import { resolveRules, type ResolvedRule } from './resolveRules';
import type { DosingRule, Medication, Species } from './types';

export interface MedWithRules {
  med: Medication;
  matched: ResolvedRule[];
}

export interface MedsForSpeciesOutput {
  withRules: MedWithRules[];
  withoutRules: Medication[];
}

/**
 * Which meds can be dosed for this animal. Goes through resolveRules per med so
 * shadowing matches the result screen exactly. Rules for meds not in `meds` are ignored.
 */
export function medsForSpecies(input: {
  meds: Medication[];
  rules: DosingRule[];
  species: Species;
}): MedsForSpeciesOutput {
  const { meds, rules, species } = input;
  const withRules: MedWithRules[] = [];
  const withoutRules: Medication[] = [];
  for (const med of [...meds].sort(byName)) {
    const { matched } = resolveRules({ rules, species, medicationId: med.id });
    if (matched.length > 0) withRules.push({ med, matched });
    else withoutRules.push(med);
  }
  return { withRules, withoutRules };
}

function byName(a: Medication, b: Medication): number {
  return a.name.localeCompare(b.name);
}
