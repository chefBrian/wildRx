import { describe, it, expect } from 'vitest';
import { groupRulesForSheet } from './factSheet';
import type { DosingRule, RuleTarget, Species } from './types';

const sp = (id: string, commonName: string, group: Species['group']): Species => ({
  id, commonName, scientificName: '', group, typicalWeightKg: { min: 1, max: 2 },
});
const rule = (medicationId: string, target: RuleTarget, route: DosingRule['route']): DosingRule => ({
  id: `${medicationId}__${target.type}-${target.value}__${route}`, medicationId, target, route,
  dosePerKg: { min: 0.1, typical: 0.2, max: 0.5 }, frequency: 'q24h', durationDays: null,
  maxSingleDose: null, contraindications: [], notes: '', updatedAt: 0, updatedBy: '',
});
const species = [sp('rth', 'Red-tailed Hawk', 'raptor'), sp('bo', 'Barred Owl', 'raptor'), sp('robin', 'American Robin', 'songbird')];
const raptor: RuleTarget = { type: 'group', value: 'raptor' };

describe('groupRulesForSheet', () => {
  it('orders sections by GROUPS and puts group rules first', () => {
    const out = groupRulesForSheet({
      species, medicationId: 'm',
      rules: [rule('m', { type: 'group', value: 'songbird' }, 'PO'), rule('m', raptor, 'SC'), rule('m', raptor, 'PO')],
    });
    expect(out.sections.map(s => s.group)).toEqual(['raptor', 'songbird']);
    expect(out.sections[0].groupRules.map(r => r.route)).toEqual(['PO', 'SC']);
  });

  it('puts species rules under their group with replace and lost-route labels', () => {
    const out = groupRulesForSheet({
      species, medicationId: 'm',
      rules: [rule('m', raptor, 'PO'), rule('m', raptor, 'SC'), rule('m', { type: 'species', value: 'rth' }, 'PO')],
    });
    const block = out.sections[0].speciesBlocks[0];
    expect(block.species.id).toBe('rth');
    expect(block.replacesGroup).toBe(true);
    expect(block.lostRoutes).toEqual(['SC']);
  });

  it('gives a species rule its own section when its group has no group rule', () => {
    const out = groupRulesForSheet({ species, medicationId: 'm', rules: [rule('m', { type: 'species', value: 'robin' }, 'PO')] });
    expect(out.sections.map(s => s.group)).toEqual(['songbird']);
    expect(out.sections[0].speciesBlocks[0].replacesGroup).toBe(false);
  });

  it('never drops rules for a deleted species or an unknown group', () => {
    const out = groupRulesForSheet({
      species, medicationId: 'm',
      rules: [
        rule('m', { type: 'species', value: 'deleted-hawk' }, 'PO'),
        rule('m', { type: 'group', value: 'dragons' as Species['group'] }, 'IM'),
      ],
    });
    expect(out.sections).toEqual([]);
    expect(out.other.map(r => r.id)).toEqual(['m__species-deleted-hawk__PO', 'm__group-dragons__IM']);
  });

  it('ignores other medications', () => {
    const out = groupRulesForSheet({ species, medicationId: 'm', rules: [rule('x', raptor, 'PO')] });
    expect(out).toEqual({ sections: [], other: [] });
  });
});
