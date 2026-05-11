import type { DosingRule, Species } from './types';

export interface ResolvedRule extends DosingRule {
  source: 'species' | 'group';
}

export interface ResolveRulesInput {
  rules: DosingRule[];
  species: Species;
  medicationId: string;
}

export interface ResolveRulesOutput {
  matched: ResolvedRule[];
}

export function resolveRules(input: ResolveRulesInput): ResolveRulesOutput {
  const { rules, species, medicationId } = input;
  const forMed = rules.filter(r => r.medicationId === medicationId);

  const speciesRules = forMed
    .filter(r => r.target.type === 'species' && r.target.value === species.id)
    .map<ResolvedRule>(r => ({ ...r, source: 'species' }));

  if (speciesRules.length > 0) return { matched: speciesRules };

  const groupRules = forMed
    .filter(r => r.target.type === 'group' && r.target.value === species.group)
    .map<ResolvedRule>(r => ({ ...r, source: 'group' }));

  return { matched: groupRules };
}
