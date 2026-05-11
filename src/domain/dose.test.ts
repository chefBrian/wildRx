import { describe, it, expect } from 'vitest';
import { calculateDose } from './dose';
import type { DosingRule } from './types';

const rule: DosingRule = {
  id: 'r1',
  medicationId: 'm1',
  target: { type: 'group', value: 'raptor' },
  mgPerKg: { min: 0.1, max: 0.5, typical: 0.2 },
  route: 'PO',
  frequency: 'q24h',
  durationDays: null,
  maxSingleDoseMg: null,
  contraindications: [],
  notes: '',
  updatedAt: 0,
  updatedBy: '',
};

describe('calculateDose — mg dose', () => {
  it('computes typical, min, max for a 1 kg animal', () => {
    const result = calculateDose({ weightGrams: 1000, rule });
    expect(result.doseMg.typical).toBeCloseTo(0.2);
    expect(result.doseMg.min).toBeCloseTo(0.1);
    expect(result.doseMg.max).toBeCloseTo(0.5);
  });

  it('scales linearly with weight', () => {
    const result = calculateDose({ weightGrams: 2500, rule });
    expect(result.doseMg.typical).toBeCloseTo(0.5);
  });
});
