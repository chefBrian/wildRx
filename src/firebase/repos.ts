import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './client';
import type { Medication, Species, DosingRule } from '../domain/types';
import { isCurrentMedicationShape, assertRuleShape } from './schemaGuard';

export async function listMedications(): Promise<Medication[]> {
  const snap = await getDocs(collection(db, 'medications'));
  return snap.docs.flatMap(d => {
    const data = d.data();
    if (!isCurrentMedicationShape(data)) {
      // Hide rather than fail the whole list: a missing med is safe, a dead calculator isn't.
      console.warn(`Skipping old-shape medication ${d.id}`);
      return [];
    }
    return [{ id: d.id, ...(data as Omit<Medication, 'id'>) }];
  });
}

export async function listSpecies(): Promise<Species[]> {
  const snap = await getDocs(collection(db, 'species'));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Species, 'id'>) }));
}

export async function listDosingRulesForMed(medId: string): Promise<DosingRule[]> {
  const q = query(collection(db, 'dosingRules'), where('medicationId', '==', medId));
  const snap = await getDocs(q);
  // Throw, never skip: dropping one species rule would silently surface the group rule.
  return snap.docs.map(d => {
    const data = d.data();
    assertRuleShape(d.id, data);
    return { id: d.id, ...(data as Omit<DosingRule, 'id'>) };
  });
}

import { doc, setDoc, deleteDoc } from 'firebase/firestore';

function stripId<T extends { id: string }>(o: T): Omit<T, 'id'> {
  const { id: _ignored, ...rest } = o;
  return rest;
}

export async function upsertMedication(m: Medication) {
  await setDoc(doc(db, 'medications', m.id), stripId(m));
}
export async function deleteMedication(id: string) {
  await deleteDoc(doc(db, 'medications', id));
}
export async function upsertSpecies(s: Species) {
  await setDoc(doc(db, 'species', s.id), stripId(s));
}
export async function deleteSpecies(id: string) {
  await deleteDoc(doc(db, 'species', id));
}
export async function upsertDosingRule(r: DosingRule) {
  await setDoc(doc(db, 'dosingRules', r.id), stripId(r));
}
export async function deleteDosingRule(id: string) {
  await deleteDoc(doc(db, 'dosingRules', id));
}
