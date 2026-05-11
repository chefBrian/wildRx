import { describe, it, expect } from 'vitest';
import { resolveRules } from './resolveRules';
import type { DosingRule, Species } from './types';

const redTail: Species = {
  id: 'sp1', commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis',
  group: 'raptor', typicalWeightGrams: { min: 700, max: 1500 },
};

const base: Omit<DosingRule, 'id' | 'target'> = {
  medicationId: 'm1',
  mgPerKg: { min: 0.1, max: 0.5, typical: 0.2 },
  route: 'PO', frequency: 'q24h', durationDays: null,
  maxSingleDoseMg: null, contraindications: [], notes: '',
  updatedAt: 0, updatedBy: '',
};

const groupRule: DosingRule = { ...base, id: 'rg', target: { type: 'group', value: 'raptor' } };
const speciesRule: DosingRule = { ...base, id: 'rs', target: { type: 'species', value: 'sp1' } };

describe('resolveRules', () => {
  it('returns group rule when only group matches', () => {
    const r = resolveRules({ rules: [groupRule], species: redTail, medicationId: 'm1' });
    expect(r.matched.map(x => x.id)).toEqual(['rg']);
    expect(r.matched[0].source).toBe('group');
  });

  it('returns species rule and hides group rule when both match same med', () => {
    const r = resolveRules({ rules: [groupRule, speciesRule], species: redTail, medicationId: 'm1' });
    expect(r.matched.map(x => x.id)).toEqual(['rs']);
    expect(r.matched[0].source).toBe('species');
  });

  it('returns empty when nothing matches', () => {
    const r = resolveRules({ rules: [groupRule], species: { ...redTail, group: 'songbird' }, medicationId: 'm1' });
    expect(r.matched).toEqual([]);
  });

  it('keeps multiple species rules with different routes', () => {
    const speciesRule2: DosingRule = { ...speciesRule, id: 'rs2', route: 'IM' };
    const r = resolveRules({ rules: [speciesRule, speciesRule2], species: redTail, medicationId: 'm1' });
    expect(r.matched.map(x => x.id).sort()).toEqual(['rs', 'rs2']);
  });

  it('filters out rules for other medications', () => {
    const otherMed: DosingRule = { ...speciesRule, id: 'other', medicationId: 'm2' };
    const r = resolveRules({ rules: [otherMed, groupRule], species: redTail, medicationId: 'm1' });
    expect(r.matched.map(x => x.id)).toEqual(['rg']);
  });
});
