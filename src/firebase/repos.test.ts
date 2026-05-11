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

const mockSnapshot = (docs: any[]) => ({
  docs: docs.map(d => ({ id: d.id, data: () => d })),
});

beforeEach(() => vi.clearAllMocks());

describe('repos', () => {
  it('listMedications returns mapped medications', async () => {
    (getDocs as any).mockResolvedValueOnce(mockSnapshot([
      { id: 'm1', name: 'Meloxicam', concentrations: [] },
    ]));
    const res = await listMedications();
    expect(res).toEqual([{ id: 'm1', name: 'Meloxicam', concentrations: [] }]);
  });

  it('listSpecies returns mapped species', async () => {
    (getDocs as any).mockResolvedValueOnce(mockSnapshot([
      { id: 's1', commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis',
        group: 'raptor', typicalWeightGrams: { min: 700, max: 1500 } },
    ]));
    const res = await listSpecies();
    expect(res[0].commonName).toBe('Red-tailed Hawk');
  });

  it('listDosingRulesForMed returns mapped rules', async () => {
    (getDocs as any).mockResolvedValueOnce(mockSnapshot([
      { id: 'r1', medicationId: 'm1', target: { type: 'group', value: 'raptor' },
        mgPerKg: { min: 0.1, max: 0.5, typical: 0.2 }, route: 'PO', frequency: 'q24h',
        durationDays: null, maxSingleDoseMg: null, contraindications: [], notes: '',
        updatedAt: 0, updatedBy: '' },
    ]));
    const res = await listDosingRulesForMed('m1');
    expect(res[0].id).toBe('r1');
  });
});

import { upsertMedication, deleteMedication, upsertSpecies, deleteSpecies, upsertDosingRule, deleteDosingRule } from './repos';
import { setDoc, doc, deleteDoc } from 'firebase/firestore';

describe('repos — writes', () => {
  it('upsertMedication writes by id', async () => {
    await upsertMedication({ id: 'm1', name: 'Meloxicam', concentrations: [] });
    expect((doc as any)).toHaveBeenCalledWith(expect.anything(), 'medications', 'm1');
    expect((setDoc as any)).toHaveBeenCalled();
  });
  it('deleteMedication deletes by id', async () => {
    await deleteMedication('m1');
    expect((deleteDoc as any)).toHaveBeenCalled();
  });
  // Equivalent tests for species + dosingRules
  it('upsertSpecies works', async () => {
    await upsertSpecies({ id: 's1', commonName: 'X', scientificName: 'Y', group: 'raptor', typicalWeightGrams: { min: 1, max: 2 } });
    expect((setDoc as any)).toHaveBeenCalled();
  });
  it('deleteSpecies deletes by id', async () => {
    await deleteSpecies('s1');
    expect((deleteDoc as any)).toHaveBeenCalled();
  });
  it('upsertDosingRule works', async () => {
    await upsertDosingRule({
      id: 'r1', medicationId: 'm1', target: { type: 'group', value: 'raptor' },
      mgPerKg: { min: 0.1, max: 0.5, typical: 0.2 }, route: 'PO', frequency: 'q24h',
      durationDays: null, maxSingleDoseMg: null, contraindications: [], notes: '',
      updatedAt: 0, updatedBy: '',
    });
    expect((setDoc as any)).toHaveBeenCalled();
  });
  it('deleteDosingRule deletes by id', async () => {
    await deleteDosingRule('r1');
    expect((deleteDoc as any)).toHaveBeenCalled();
  });
});
