import type { DosingRule, Species, TaxonomicGroup } from './types';

/**
 * Group rules hidden for this species because it has its own rule for the med.
 * resolveRules drops these; the admin shows them so shadowing is visible.
 */
export function shadowedGroupRules(input: {
  rules: DosingRule[];
  species: Species;
  medicationId: string;
}): DosingRule[] {
  const { rules, species, medicationId } = input;
  const forMed = rules.filter(r => r.medicationId === medicationId);
  const hasOwn = forMed.some(r => r.target.type === 'species' && r.target.value === species.id);
  if (!hasOwn) return [];
  return forMed.filter(r => r.target.type === 'group' && r.target.value === species.group);
}

interface GroupMedInput {
  rules: DosingRule[];
  species: Species[];
  group: TaxonomicGroup;
  medicationId: string;
}

/** Species in `group` that a group rule for this med actually reaches. */
export function groupRuleReach(input: GroupMedInput): Species[] {
  const overriding = new Set(overridingSpecies(input).map(s => s.id));
  return input.species.filter(s => s.group === input.group && !overriding.has(s.id));
}

/** Species in `group` with at least one species rule for this med (group rules don't reach them). */
export function overridingSpecies(input: GroupMedInput): Species[] {
  const { rules, species, group, medicationId } = input;
  return species.filter(s => s.group === group && rules.some(r =>
    r.medicationId === medicationId && r.target.type === 'species' && r.target.value === s.id));
}
