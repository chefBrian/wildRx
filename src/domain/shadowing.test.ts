import { describe, it, expect } from 'vitest';
import { groupRuleReach, overridingSpecies, shadowedGroupRules } from './shadowing';
import type { DosingRule, RuleTarget, Species } from './types';

const sp = (id: string, commonName: string, group: Species['group']): Species => ({
  id, commonName, scientificName: '', group, typicalWeightKg: { min: 1, max: 2 },
});
const hawk = sp('rth', 'Red-tailed Hawk', 'raptor');
const owl = sp('bo', 'Barred Owl', 'raptor');
const robin = sp('robin', 'American Robin', 'songbird');
const rule = (id: string, medicationId: string, target: RuleTarget, route: DosingRule['route'] = 'PO'): DosingRule => ({
  id, medicationId, target, route,
  dosePerKg: { min: 0.1, typical: 0.2, max: 0.5 }, frequency: 'q24h', durationDays: null,
  maxSingleDose: null, contraindications: [], notes: '', updatedAt: 0, updatedBy: '',
});
const groupPO = rule('gpo', 'melox', { type: 'group', value: 'raptor' }, 'PO');
const groupSC = rule('gsc', 'melox', { type: 'group', value: 'raptor' }, 'SC');
const hawkPO = rule('hpo', 'melox', { type: 'species', value: 'rth' }, 'PO');

describe('shadowedGroupRules', () => {
  it('returns every group rule for the med once the species has its own rule', () => {
    const out = shadowedGroupRules({ rules: [groupPO, groupSC, hawkPO], species: hawk, medicationId: 'melox' });
    expect(out.map(r => r.id)).toEqual(['gpo', 'gsc']);
  });

  it('returns nothing when the species has no rule of its own', () => {
    expect(shadowedGroupRules({ rules: [groupPO, groupSC], species: hawk, medicationId: 'melox' })).toEqual([]);
  });

  it("ignores other meds' rules", () => {
    const other = rule('o', 'baytril', { type: 'group', value: 'raptor' });
    expect(shadowedGroupRules({ rules: [other, hawkPO], species: hawk, medicationId: 'melox' })).toEqual([]);
  });
});

describe('overridingSpecies / groupRuleReach', () => {
  const species = [hawk, owl, robin];
  const rules = [groupPO, groupSC, hawkPO];

  it('lists species in the group with their own rule for the med', () => {
    expect(overridingSpecies({ rules, species, group: 'raptor', medicationId: 'melox' }).map(s => s.id)).toEqual(['rth']);
  });

  it('lists species in the group the group rule still reaches', () => {
    expect(groupRuleReach({ rules, species, group: 'raptor', medicationId: 'melox' }).map(s => s.id)).toEqual(['bo']);
  });

  it('never includes species from other groups', () => {
    expect(groupRuleReach({ rules, species, group: 'songbird', medicationId: 'melox' }).map(s => s.id)).toEqual(['robin']);
  });
});
