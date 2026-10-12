import { describe, it, expect } from 'vitest';
import { planMedication, writeGate } from './migrateConcentrationRoutes.mjs';

const med = (over = {}) => ({ name: 'Meloxicam', doseUnit: 'mg', concentrations: [], ...over });

describe('planMedication', () => {
  it('fills missing routes from the form and sets the schema version', () => {
    const p = planMedication('melox', med({ concentrations: [
      { id: 'o', value: 1.5, form: 'oral', note: 'Metacam' },
      { id: 'i', value: 5, form: 'injectable' },
    ] }));
    expect(p.status).toBe('change');
    expect(p.data.schemaVersion).toBe(2);
    expect(p.data.concentrations.map(c => c.routes)).toEqual([['PO'], ['PO', 'IM', 'SC']]);
    expect(p.bottles).toEqual([
      'melox (Meloxicam): 1.5 mg/ml oral (Metacam) -> PO [default]',
      'melox (Meloxicam): 5 mg/ml injectable -> PO, IM, SC [default]',
    ]);
  });

  it('keeps explicit routes', () => {
    const p = planMedication('pen', med({ name: 'Penicillin', doseUnit: 'IU', concentrations: [
      { id: 'i', value: 300000, form: 'injectable', routes: ['IM', 'SC'] },
    ] }));
    expect(p.data.concentrations[0].routes).toEqual(['IM', 'SC']);
    expect(p.bottles[0]).toBe('pen (Penicillin): 300000 IU/ml injectable -> IM, SC');
  });

  it('skips a doc that is already complete', () => {
    const p = planMedication('melox', med({ schemaVersion: 2, concentrations: [{ id: 'o', value: 1.5, form: 'oral', routes: ['PO'] }] }));
    expect(p.status).toBe('skip');
  });

  it('fills a bottle missing routes even when the doc is already schemaVersion 2', () => {
    const p = planMedication('melox', med({ schemaVersion: 2, concentrations: [
      { id: 'o', value: 1.5, form: 'oral', routes: ['PO'] },
      { id: 'i', value: 5, form: 'injectable' },
    ] }));
    expect(p.status).toBe('change');
    expect(p.data.concentrations.map(c => c.routes)).toEqual([['PO'], ['PO', 'IM', 'SC']]);
    expect(p.bottles).toEqual([
      'melox (Meloxicam): 1.5 mg/ml oral -> PO',
      'melox (Meloxicam): 5 mg/ml injectable -> PO, IM, SC [default]',
    ]);
  });

  it('still lists the bottles of a skipped doc', () => {
    const p = planMedication('melox', med({ schemaVersion: 2, concentrations: [{ id: 'o', value: 1.5, form: 'oral', routes: ['PO'] }] }));
    expect(p.status).toBe('skip');
    expect(p.bottles).toEqual(['melox (Meloxicam): 1.5 mg/ml oral -> PO']);
  });

  it('only sets the schema version on ml meds', () => {
    const p = planMedication('pepto', med({ name: 'Pepto', doseUnit: 'ml', concentrations: [], productDescription: 'Original' }));
    expect(p.status).toBe('change');
    expect(p.data).toEqual(expect.objectContaining({ schemaVersion: 2, concentrations: [] }));
  });

  it('flags a bottle that ends up with no routes', () => {
    const p = planMedication('eye', med({ name: 'Eye drops', concentrations: [{ id: 'e', value: 3, form: 'other' }] }));
    expect(p.flags).toEqual(['eye (Eye drops): 3 mg/ml other has no routes - an admin must tick them before it can be used']);
  });

  it.each([
    ['concentrations not a list', med({ concentrations: 'x' }), 'bad: concentrations is not a list'],
    ['unknown form', med({ concentrations: [{ id: 'c', value: 1, form: 'spray' }] }), 'bad: concentration c has unknown form spray'],
  ])('reports a problem: %s', (_label, data, problem) => {
    expect(planMedication('bad', data)).toEqual(expect.objectContaining({ status: 'problem', problem }));
  });
});

describe('writeGate', () => {
  it('allows --write only with no problems', () => {
    expect(writeGate([])).toBeNull();
    expect(writeGate(['x'])).toBe('Refusing --write: 1 problem(s). Fix them by hand and re-run the dry run until it is clean.');
  });
});
