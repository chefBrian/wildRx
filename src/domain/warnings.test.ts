import { describe, it, expect } from 'vitest';
import { doseWarnings, formMismatchesRoute } from './warnings';
import { calculateDose } from './dose';
import type { Concentration, DosingRule } from './types';

const rule = (over: Partial<DosingRule> = {}): DosingRule => ({
  id: 'r1', medicationId: 'm1', target: { type: 'group', value: 'raptor' },
  dosePerKg: { min: 0.1, typical: 0.2, max: 0.5 }, route: 'PO', frequency: 'q24h',
  durationDays: null, maxSingleDose: null, contraindications: [], notes: '',
  updatedAt: 0, updatedBy: '', ...over,
});
const conc = (over: Partial<Concentration> = {}): Concentration => ({ id: 'c1', value: 1, form: 'oral', ...over });

function warningsFor(r: DosingRule, weightKg: number, c?: Concentration) {
  const result = calculateDose({ weightKg, rule: r, doseUnit: 'mg', concentration: c });
  return doseWarnings({ result, rule: r, weightKg, concentration: c });
}

describe('formMismatchesRoute', () => {
  it.each([
    ['IM', 'oral', true], ['SC', 'topical', true], ['IV', 'other', true],
    ['IM', 'injectable', false], ['PO', 'injectable', false], ['PO', 'oral', false],
  ] as const)('%s + %s → %s', (route, form, out) => {
    expect(formMismatchesRoute(route, form)).toBe(out);
  });
});

describe('doseWarnings', () => {
  it('returns nothing for an ordinary dose', () => {
    expect(warningsFor(rule(), 1, conc())).toEqual([]);
  });

  it('explains a capped typical dose', () => {
    const w = warningsFor(rule({ maxSingleDose: 0.3 }), 5);
    expect(w).toHaveLength(1);
    expect(w[0].kind).toBe('cap');
    expect(w[0].body).toBe('Calculated 1 mg exceeded the 0.3 mg cap. Showing the capped value.');
  });

  it('explains a cap that only affects the top of the range', () => {
    const w = warningsFor(rule({ maxSingleDose: 0.3 }), 1);
    expect(w[0].body).toBe('Top of range capped at 0.3 mg.');
  });

  it('warns about an oral form on an injection route', () => {
    const w = warningsFor(rule({ route: 'IM' }), 1, conc({ form: 'oral' }));
    expect(w.map(x => x.kind)).toContain('formRoute');
    expect(w.find(x => x.kind === 'formRoute')?.body).toMatch(/This rule is IM, but the selected concentration is oral/);
  });

  it('does not warn about an injectable given PO', () => {
    const w = warningsFor(rule({ route: 'PO' }), 1, conc({ form: 'injectable' }));
    expect(w.map(x => x.kind)).not.toContain('formRoute');
  });

  it('warns when the volume is below 0.01 ml', () => {
    // 0.025 kg × 0.2 mg/kg = 0.005 mg ÷ 1 mg/ml = 0.005 ml
    const w = warningsFor(rule(), 0.025, conc());
    expect(w.map(x => x.kind)).toContain('unmeasurable');
  });
});
