import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './client';
import type { Medication, Species, DosingRule } from '../domain/types';

export async function listMedications(): Promise<Medication[]> {
  const snap = await getDocs(collection(db, 'medications'));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Medication, 'id'>) }));
}

export async function listSpecies(): Promise<Species[]> {
  const snap = await getDocs(collection(db, 'species'));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Species, 'id'>) }));
}

export async function listDosingRulesForMed(medId: string): Promise<DosingRule[]> {
  const q = query(collection(db, 'dosingRules'), where('medicationId', '==', medId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<DosingRule, 'id'>) }));
}
