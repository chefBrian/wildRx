import { ruleId } from '../../../domain/ruleId';
import type { DosingRule, RuleTarget } from '../../../domain/types';

/** Empty rule for the editor. id '' marks it new; updatedBy is set on save. */
export function blankRule(medicationId: string, target: RuleTarget): DosingRule {
  return {
    id: '',
    medicationId,
    target,
    dosePerKg: { min: NaN, max: NaN, typical: NaN },
    route: 'PO',
    frequency: 'q24h',
    durationDays: null,
    maxSingleDose: null,
    contraindications: [],
    notes: '',
    updatedAt: Date.now(),
    updatedBy: '',
  };
}

/** A species copy of a group rule with identical values - "Override for this species". */
export function copyToSpecies(rule: DosingRule, speciesId: string, uid: string): DosingRule {
  const target: RuleTarget = { type: 'species', value: speciesId };
  return {
    ...rule,
    id: ruleId(rule.medicationId, target, rule.route),
    target,
    updatedAt: Date.now(),
    updatedBy: uid,
  };
}
