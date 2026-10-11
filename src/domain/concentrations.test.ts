import { describe, it, expect } from 'vitest';
import { resolveConcentration } from './concentrations';
import type { Medication } from './types';

const med = (over: Partial<Medication> = {}): Medication => ({
  id: 'm1', name: 'Enrofloxacin', doseUnit: 'mg',
  concentrations: [
    { id: 'oral', value: 22.7, form: 'oral' },
    { id: 'inj', value: 100, form: 'injectable' },
  ],
  ...over,
});

describe('resolveConcentration', () => {
  it('returns none for ml meds', () => {
    expect(resolveConcentration(med({ doseUnit: 'ml', concentrations: [] }), null)).toEqual({ status: 'none' });
  });

  it('returns none when the med has no concentrations', () => {
    expect(resolveConcentration(med({ concentrations: [] }), null)).toEqual({ status: 'none' });
  });

  it('uses the only concentration regardless of the id', () => {
    const only = { id: 'x', value: 5, form: 'oral' as const };
    expect(resolveConcentration(med({ concentrations: [only] }), 'whatever'))
      .toEqual({ status: 'selected', concentration: only });
  });

  it('selects by id', () => {
    const r = resolveConcentration(med(), 'inj');
    expect(r.status === 'selected' && r.concentration.value).toBe(100);
  });

  it('needs a pick when the id is missing', () => {
    expect(resolveConcentration(med(), null)).toEqual({ status: 'needsPick' });
  });

  it('needs a pick for an old index-style id', () => {
    expect(resolveConcentration(med(), '1')).toEqual({ status: 'needsPick' });
  });
});
