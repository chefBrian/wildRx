import { describe, it, expect } from 'vitest';
import { medsForSpecies } from './medsForSpecies';
import type { DosingRule, Medication, RuleTarget, Species } from './types';

const hawk: Species = {
  id: 'rth', commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis',
  group: 'raptor', typicalWeightKg: { min: 0.7, max: 1.5 },
};
const med = (id: string, name: string): Medication => ({ id, name, doseUnit: 'mg', concentrations: [] });
const rule = (id: string, medicationId: string, target: RuleTarget, route: DosingRule['route'] = 'PO'): DosingRule => ({
  id, medicationId, target, route,
  dosePerKg: { min: 0.1, typical: 0.2, max: 0.5 }, frequency: 'q24h', durationDays: null,
  maxSingleDose: null, contraindications: [], notes: '', updatedAt: 0, updatedBy: '',
});

const meloxicam = med('melox', 'Meloxicam');
const baytril = med('baytril', 'Baytril');
const prazi = med('prazi', 'Praziquantel');

describe('medsForSpecies', () => {
  it('puts a med with only a group rule in withRules, sourced from the group', () => {
    const out = medsForSpecies({ meds: [baytril], rules: [rule('r1', 'baytril', { type: 'group', value: 'raptor' })], species: hawk });
    expect(out.withRules).toHaveLength(1);
    expect(out.withRules[0].matched.map(r => r.source)).toEqual(['group']);
  });

  it('lets a species rule shadow the group rules for that med', () => {
    const out = medsForSpecies({
      meds: [meloxicam],
      rules: [
        rule('g1', 'melox', { type: 'group', value: 'raptor' }, 'PO'),
        rule('g2', 'melox', { type: 'group', value: 'raptor' }, 'SC'),
        rule('s1', 'melox', { type: 'species', value: 'rth' }, 'PO'),
      ],
      species: hawk,
    });
    expect(out.withRules[0].matched.map(r => r.id)).toEqual(['s1']);
  });

  it('puts meds with no matching rule in withoutRules', () => {
    const out = medsForSpecies({ meds: [prazi], rules: [], species: hawk });
    expect(out.withRules).toEqual([]);
    expect(out.withoutRules.map(m => m.id)).toEqual(['prazi']);
  });

  it("ignores another species' rule and another group's rule", () => {
    const out = medsForSpecies({
      meds: [meloxicam],
      rules: [
        rule('s1', 'melox', { type: 'species', value: 'barred-owl' }),
        rule('g1', 'melox', { type: 'group', value: 'songbird' }),
      ],
      species: hawk,
    });
    expect(out.withoutRules.map(m => m.id)).toEqual(['melox']);
  });

  it('ignores rules whose med is missing (deleted or skipped as old-shape)', () => {
    const out = medsForSpecies({ meds: [prazi], rules: [rule('r1', 'gone', { type: 'group', value: 'raptor' })], species: hawk });
    expect(out.withRules).toEqual([]);
    expect(out.withoutRules.map(m => m.id)).toEqual(['prazi']);
  });

  it('sorts both lists by name', () => {
    const out = medsForSpecies({
      meds: [prazi, meloxicam, baytril, med('amox', 'Amoxicillin')],
      rules: [
        rule('r1', 'melox', { type: 'group', value: 'raptor' }),
        rule('r2', 'baytril', { type: 'group', value: 'raptor' }),
      ],
      species: hawk,
    });
    expect(out.withRules.map(x => x.med.name)).toEqual(['Baytril', 'Meloxicam']);
    expect(out.withoutRules.map(m => m.name)).toEqual(['Amoxicillin', 'Praziquantel']);
  });
});
