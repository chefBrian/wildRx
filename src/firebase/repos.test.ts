import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_, name) => ({ __collection: name })),
  getDocs: vi.fn(),
  query: vi.fn((c) => c),
  where: vi.fn(),
  doc: vi.fn((_, c, id) => ({ __doc: `${c}/${id}` })),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));
vi.mock('./client', () => ({ db: {} }));

import { getDocs } from 'firebase/firestore';
import { listMedications, listSpecies, listDosingRulesForMed } from './repos';
import { SchemaMismatchError } from './schemaGuard';
import type { QuerySnapshot } from 'firebase/firestore';

const mockSnapshot = (docs: { id: string; [k: string]: unknown }[]) =>
  ({
    docs: docs.map(d => ({ id: d.id, data: () => d })),
  }) as unknown as QuerySnapshot;

beforeEach(() => vi.clearAllMocks());

describe('repos', () => {
  it('listMedications returns mapped medications', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(mockSnapshot([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [] },
    ]));
    const res = await listMedications();
    expect(res).toEqual([{ id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [] }]);
  });

  it('listMedications skips old-shape meds and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(getDocs).mockResolvedValueOnce(mockSnapshot([
      { id: 'old', name: 'Old', concentrations: [] },
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [] },
    ]));
    const res = await listMedications();
    expect(res.map(m => m.id)).toEqual(['m1']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('listSpecies returns mapped species', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(mockSnapshot([
      { id: 's1', commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis',
        group: 'raptor', typicalWeightKg: { min: 0.7, max: 1.5 } },
    ]));
    const res = await listSpecies();
    expect(res[0].commonName).toBe('Red-tailed Hawk');
  });

  it('listDosingRulesForMed returns mapped rules', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(mockSnapshot([
      { id: 'r1', medicationId: 'm1', target: { type: 'group', value: 'raptor' },
        dosePerKg: { min: 0.1, max: 0.5, typical: 0.2 }, route: 'PO', frequency: 'q24h',
        durationDays: null, maxSingleDose: null, contraindications: [], notes: '',
        updatedAt: 0, updatedBy: '' },
    ]));
    const res = await listDosingRulesForMed('m1');
    expect(res[0].id).toBe('r1');
  });

  it('listDosingRulesForMed rejects on an old-shape rule', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(mockSnapshot([
      { id: 'r1', medicationId: 'm1', target: { type: 'group', value: 'raptor' },
        mgPerKg: { min: 0.1, max: 0.5, typical: 0.2 }, route: 'PO', frequency: 'q24h' },
    ]));
    await expect(listDosingRulesForMed('m1')).rejects.toThrow(SchemaMismatchError);
  });
});

import { upsertMedication, deleteMedication, upsertSpecies, deleteSpecies, upsertDosingRule, deleteDosingRule } from './repos';
import { setDoc, doc, deleteDoc } from 'firebase/firestore';

describe('repos — writes', () => {
  it('upsertMedication writes by id', async () => {
    await upsertMedication({ id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [] });
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'medications', 'm1');
    expect(setDoc).toHaveBeenCalled();
  });
  it('deleteMedication deletes by id', async () => {
    await deleteMedication('m1');
    expect(deleteDoc).toHaveBeenCalled();
  });
  // Equivalent tests for species + dosingRules
  it('upsertSpecies works', async () => {
    await upsertSpecies({ id: 's1', commonName: 'X', scientificName: 'Y', group: 'raptor', typicalWeightKg: { min: 0.001, max: 0.002 } });
    expect(setDoc).toHaveBeenCalled();
  });
  it('deleteSpecies deletes by id', async () => {
    await deleteSpecies('s1');
    expect(deleteDoc).toHaveBeenCalled();
  });
  it('upsertDosingRule works', async () => {
    await upsertDosingRule({
      id: 'r1', medicationId: 'm1', target: { type: 'group', value: 'raptor' },
      dosePerKg: { min: 0.1, max: 0.5, typical: 0.2 }, route: 'PO', frequency: 'q24h',
      durationDays: null, maxSingleDose: null, contraindications: [], notes: '',
      updatedAt: 0, updatedBy: '',
    });
    expect(setDoc).toHaveBeenCalled();
  });
  it('deleteDosingRule deletes by id', async () => {
    await deleteDosingRule('r1');
    expect(deleteDoc).toHaveBeenCalled();
  });
});
