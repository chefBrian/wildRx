import { describe, it, expect } from 'vitest';
import { targetWeightRange } from './targetWeights';
import type { Species } from './types';

const sp = (id: string, group: Species['group'], min: number, max: number): Species => ({
  id, commonName: id, scientificName: id, group, typicalWeightKg: { min, max },
});
const species = [sp('rth', 'raptor', 0.7, 1.5), sp('ako', 'raptor', 0.1, 0.2), sp('ebt', 'reptile', 0.3, 0.5)];

describe('targetWeightRange', () => {
  it('uses the species range for a species target', () => {
    expect(targetWeightRange({ type: 'species', value: 'ebt' }, species)).toEqual({ min: 0.3, max: 0.5 });
  });

  it('spans all species in a group', () => {
    expect(targetWeightRange({ type: 'group', value: 'raptor' }, species)).toEqual({ min: 0.1, max: 1.5 });
  });

  it('returns null when no species match', () => {
    expect(targetWeightRange({ type: 'group', value: 'amphibian' }, species)).toBeNull();
  });
});
