import { describe, it, expect } from 'vitest';
import {
  validateMedication, validateRule, normalizeRuleRange, toMedication,
  type MedicationDraft,
} from './validate';
import type { DosingRule } from './types';

const draft = (over: Partial<MedicationDraft> = {}): MedicationDraft => ({
  id: 'm1',
  name: 'Enrofloxacin',
  doseUnit: 'mg',
  concentrations: [{ id: 'c1', value: 22.7, form: 'oral' }],
  ...over,
});

const rule = (over: Partial<DosingRule> = {}): DosingRule => ({
  id: 'r1',
  medicationId: 'm1',
  target: { type: 'group', value: 'raptor' },
  dosePerKg: { min: 10, typical: 15, max: 20 },
  route: 'PO',
  frequency: 'q24h',
  durationDays: null,
  maxSingleDose: null,
  contraindications: [],
  notes: '',
  updatedAt: 0,
  updatedBy: '',
  ...over,
});

describe('validateMedication', () => {
  it('passes a valid mg med', () => {
    expect(validateMedication(draft())).toEqual({});
  });

  it('requires a name', () => {
    expect(validateMedication(draft({ name: '  ' })).name).toBeDefined();
  });

  it('requires a dose unit', () => {
    expect(validateMedication(draft({ doseUnit: null })).doseUnit).toBeDefined();
  });

  it('rejects a 0 strength', () => {
    const e = validateMedication(draft({ concentrations: [{ id: 'c1', value: 0, form: 'oral' }] }));
    expect(e['conc.0.value']).toBeDefined();
  });

  it('rejects NaN strength', () => {
    const e = validateMedication(draft({ concentrations: [{ id: 'c1', value: NaN, form: 'oral' }] }));
    expect(e['conc.0.value']).toBeDefined();
  });

  it('requires a form', () => {
    const e = validateMedication(draft({ concentrations: [{ id: 'c1', value: 5, form: '' }] }));
    expect(e['conc.0.form']).toBeDefined();
  });

  it.each(['Baytril', 'in-house dilution', '40 SMX + 8 TMP', 'compounded - verify bottle'])(
    'accepts note %j', note => {
      const e = validateMedication(draft({ concentrations: [{ id: 'c1', value: 5, form: 'oral', note }] }));
      expect(e['conc.0.note']).toBeUndefined();
    },
  );

  it.each(['10 mg', '50mg/ml', '1%', 'injectable 1% (Ivomec)', '5000 IU', '2 units'])(
    'rejects note %j that states a strength', note => {
      const e = validateMedication(draft({ concentrations: [{ id: 'c1', value: 5, form: 'oral', note }] }));
      expect(e['conc.0.note']).toBeDefined();
    },
  );

  it('requires a product description for ml meds', () => {
    const e = validateMedication(draft({ doseUnit: 'ml', concentrations: [] }));
    expect(e.productDescription).toBeDefined();
  });

  it('whitespace product description is missing', () => {
    const e = validateMedication(draft({ doseUnit: 'ml', concentrations: [], productDescription: '   ' }));
    expect(e.productDescription).toBeDefined();
  });

  it('rejects concentrations on an ml med', () => {
    const e = validateMedication(draft({ doseUnit: 'ml', productDescription: 'Pepto Original' }));
    expect(e.concentrations).toBeDefined();
  });

  it('allows a strength in the ml product description', () => {
    const e = validateMedication(draft({
      doseUnit: 'ml', concentrations: [], productDescription: 'Pepto-Bismol Original (17.5 mg/ml)',
    }));
    expect(e).toEqual({});
  });
});

describe('validateRule', () => {
  it('passes a valid rule', () => {
    expect(validateRule(rule())).toEqual({});
  });

  it('rejects typical 0', () => {
    expect(validateRule(rule({ dosePerKg: { min: 0, typical: 0, max: 0 } })).typical).toBeDefined();
  });

  it('rejects NaN typical', () => {
    expect(validateRule(rule({ dosePerKg: { min: 1, typical: NaN, max: 2 } })).typical).toBeDefined();
  });

  it('rejects min above typical', () => {
    expect(validateRule(rule({ dosePerKg: { min: 20, typical: 15, max: 20 } })).min).toBeDefined();
  });

  it('rejects max below typical', () => {
    expect(validateRule(rule({ dosePerKg: { min: 10, typical: 15, max: 12 } })).max).toBeDefined();
  });

  it('rejects a 0 or negative cap but allows null', () => {
    expect(validateRule(rule({ maxSingleDose: 0 })).maxSingleDose).toBeDefined();
    expect(validateRule(rule({ maxSingleDose: null })).maxSingleDose).toBeUndefined();
  });
});

describe('normalizeRuleRange', () => {
  it('fills blank (0) min and max with typical', () => {
    const r = normalizeRuleRange(rule({ dosePerKg: { min: 0, typical: 20, max: 0 } }));
    expect(r.dosePerKg).toEqual({ min: 20, typical: 20, max: 20 });
  });

  it('fills NaN min and max with typical', () => {
    const r = normalizeRuleRange(rule({ dosePerKg: { min: NaN, typical: 20, max: NaN } }));
    expect(r.dosePerKg).toEqual({ min: 20, typical: 20, max: 20 });
  });

  it('leaves set values alone', () => {
    const r = normalizeRuleRange(rule());
    expect(r.dosePerKg).toEqual({ min: 10, typical: 15, max: 20 });
  });
});

describe('toMedication', () => {
  it('toMedication drops whitespace note', () => {
    const m = toMedication(draft({ concentrations: [{ id: 'c1', value: 5, form: 'oral', note: '  ' }] }));
    expect(m.concentrations[0]).toEqual({ id: 'c1', value: 5, form: 'oral' });
    expect('note' in m.concentrations[0]).toBe(false);
  });

  it('never writes undefined keys', () => {
    const m = toMedication(draft({ genericName: '', notes: '' }));
    for (const v of Object.values(m)) expect(v).not.toBeUndefined();
  });

  it('empties concentrations and keeps the product description for ml meds', () => {
    const m = toMedication(draft({ doseUnit: 'ml', productDescription: ' Pepto Original ' }));
    expect(m.concentrations).toEqual([]);
    expect(m.productDescription).toBe('Pepto Original');
  });

  it('throws if the unit was never chosen', () => {
    expect(() => toMedication(draft({ doseUnit: null }))).toThrow();
  });
});
