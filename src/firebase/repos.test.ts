import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_, name) => ({ __collection: name })),
  getDocs: vi.fn(),
  query: vi.fn((c) => c),
  where: vi.fn(),
  doc: vi.fn((_, c, id) => ({ __doc: `${c}/${id}` })),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  runTransaction: vi.fn(),
}));
vi.mock('./client', () => ({ db: {} }));

import { getDocs } from 'firebase/firestore';
import { listMedications, listSpecies, listDosingRulesForMed, listAllDosingRules } from './repos';
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

describe('repos - listAllDosingRules', () => {
  it('returns every rule, mapped', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(mockSnapshot([
      { id: 'r1', medicationId: 'm1', target: { type: 'group', value: 'raptor' },
        dosePerKg: { min: 0.1, max: 0.5, typical: 0.2 }, route: 'PO', frequency: 'q24h',
        durationDays: null, maxSingleDose: null, contraindications: [], notes: '',
        updatedAt: 0, updatedBy: '' },
      { id: 'r2', medicationId: 'm2', target: { type: 'species', value: 's1' },
        dosePerKg: { min: 1, max: 1, typical: 1 }, route: 'IM', frequency: 'once',
        durationDays: null, maxSingleDose: null, contraindications: [], notes: '',
        updatedAt: 0, updatedBy: '' },
    ]));
    const res = await listAllDosingRules();
    expect(res.map(r => r.id)).toEqual(['r1', 'r2']);
  });

  it('rejects on any old-shape rule (never skips)', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(mockSnapshot([
      { id: 'r1', medicationId: 'm1', target: { type: 'group', value: 'raptor' },
        mgPerKg: { min: 0.1, max: 0.5, typical: 0.2 }, route: 'PO', frequency: 'q24h' },
    ]));
    await expect(listAllDosingRules()).rejects.toThrow(SchemaMismatchError);
  });
});

import { createDosingRule, createDosingRules, rekeyDosingRule, RuleExistsError } from './repos';
import { runTransaction } from 'firebase/firestore';
import type { DosingRule } from '../domain/types';

const txRule = (id: string): DosingRule => ({
  id, medicationId: 'm1', target: { type: 'group', value: 'raptor' },
  dosePerKg: { min: 0.1, max: 0.5, typical: 0.2 }, route: 'PO', frequency: 'q24h',
  durationDays: null, maxSingleDose: null, contraindications: [], notes: '',
  updatedAt: 0, updatedBy: 'u1',
});

// Fake transaction: `existing` lists doc paths ("dosingRules/<id>") that already exist.
function useFakeTx(existing: string[]) {
  const tx = {
    get: vi.fn(async (ref: { __doc: string }) => ({
      id: ref.__doc.split('/')[1],
      exists: () => existing.includes(ref.__doc),
    })),
    set: vi.fn(),
    delete: vi.fn(),
  };
  vi.mocked(runTransaction).mockImplementation(
    (async (_db: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) as never,
  );
  return tx;
}

describe('repos - transactional rule writes', () => {
  it('createDosingRule writes when the id is free', async () => {
    const tx = useFakeTx([]);
    await createDosingRule(txRule('m1__group-raptor__PO'));
    expect(tx.set).toHaveBeenCalledWith({ __doc: 'dosingRules/m1__group-raptor__PO' }, expect.not.objectContaining({ id: expect.anything() }));
  });

  it('createDosingRule throws RuleExistsError and writes nothing when the id is taken', async () => {
    const tx = useFakeTx(['dosingRules/m1__group-raptor__PO']);
    await expect(createDosingRule(txRule('m1__group-raptor__PO'))).rejects.toBeInstanceOf(RuleExistsError);
    expect(tx.set).not.toHaveBeenCalled();
  });

  it('createDosingRules is all or nothing', async () => {
    const tx = useFakeTx(['dosingRules/b']);
    await expect(createDosingRules([txRule('a'), txRule('b')])).rejects.toBeInstanceOf(RuleExistsError);
    expect(tx.set).not.toHaveBeenCalled();
  });

  it('rekeyDosingRule writes the new id and deletes the old one', async () => {
    const tx = useFakeTx([]);
    await rekeyDosingRule('old', txRule('new'));
    expect(tx.set).toHaveBeenCalledWith({ __doc: 'dosingRules/new' }, expect.anything());
    expect(tx.delete).toHaveBeenCalledWith({ __doc: 'dosingRules/old' });
  });

  it('rekeyDosingRule throws RuleExistsError and changes nothing when the new id is taken', async () => {
    const tx = useFakeTx(['dosingRules/new']);
    await expect(rekeyDosingRule('old', txRule('new'))).rejects.toBeInstanceOf(RuleExistsError);
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
  });
});

describe('repos - only stored rule fields are written', () => {
  // Admin pages pass ResolvedRules, which carry a UI-only `source`.
  const resolved = { ...txRule('m1__group-raptor__PO'), source: 'group' } as DosingRule;
  const STORED_KEYS = [
    'contraindications', 'dosePerKg', 'durationDays', 'frequency', 'maxSingleDose',
    'medicationId', 'notes', 'route', 'target', 'updatedAt', 'updatedBy',
  ];

  it('upsertDosingRule drops id and source', async () => {
    await upsertDosingRule(resolved);
    const written = vi.mocked(setDoc).mock.calls.at(-1)![1] as Record<string, unknown>;
    expect(Object.keys(written).sort()).toEqual(STORED_KEYS);
  });

  it('createDosingRules and rekeyDosingRule drop source too', async () => {
    const tx = useFakeTx([]);
    await createDosingRules([resolved]);
    await rekeyDosingRule('old', resolved);
    for (const call of tx.set.mock.calls) {
      expect(Object.keys(call[1] as Record<string, unknown>).sort()).toEqual(STORED_KEYS);
    }
  });
});
