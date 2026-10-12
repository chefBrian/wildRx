import { describe, it, expect } from 'vitest';
import { doseWarnings } from './warnings';
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
  return doseWarnings({ result, rule: r, weightKg });
}

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

  it('warns when the volume is below 0.01 ml', () => {
    // 0.025 kg × 0.2 mg/kg = 0.005 mg ÷ 1 mg/ml = 0.005 ml
    const w = warningsFor(rule(), 0.025, conc());
    expect(w.map(x => x.kind)).toContain('unmeasurable');
  });

  it('warns about the low end when only the min volume is under 0.01 ml', () => {
    // 0.07 kg: min 0.007 ml, typical 0.014 ml
    const w = warningsFor(rule(), 0.07, conc());
    expect(w).toHaveLength(1);
    expect(w[0].kind).toBe('unmeasurable');
    expect(w[0].title).toBe('Below measurable volume');
    expect(w[0].body).toBe('The low end of the range is under 0.01 ml. Dilute before dosing - confirm the dilution with the attending vet.');
  });

  it('keeps the original body when the typical volume is under 0.01 ml', () => {
    const w = warningsFor(rule(), 0.025, conc());
    expect(w).toHaveLength(1);
    expect(w[0].body).toBe('Under 0.01 ml. Dilute before dosing - confirm the dilution with the attending vet.');
  });

  it('has no unmeasurable warning when every volume is measurable', () => {
    expect(warningsFor(rule(), 1, conc()).map(x => x.kind)).not.toContain('unmeasurable');
  });
});
