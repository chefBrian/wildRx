import {
  collection, deleteDoc, doc, getDocs, query, runTransaction, setDoc, where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
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

/** Every rule. Used by the calculator snapshot and the admin Animals pages. */
export async function listAllDosingRules(): Promise<DosingRule[]> {
  const snap = await getDocs(collection(db, 'dosingRules'));
  return snap.docs.map(toRule);
}

/** One med's rules. Used by admin MedsTab (to lock the unit once rules exist) and the public fact sheet. */
export async function listDosingRulesForMed(medId: string): Promise<DosingRule[]> {
  const q = query(collection(db, 'dosingRules'), where('medicationId', '==', medId));
  const snap = await getDocs(q);
  return snap.docs.map(toRule);
}

// Throw, never skip: dropping one species rule would silently surface the group rule.
function toRule(d: QueryDocumentSnapshot): DosingRule {
  const data = d.data();
  assertRuleShape(d.id, data);
  return { id: d.id, ...(data as Omit<DosingRule, 'id'>) };
}

export async function upsertMedication(m: Medication) {
  await setDoc(doc(db, 'medications', m.id), stripId(m));
}

function stripId<T extends { id: string }>(o: T): Omit<T, 'id'> {
  const { id, ...rest } = o;
  void id;
  return rest;
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

/** Edit a rule in place (same id). Two admins editing one rule is last-write-wins. */
export async function upsertDosingRule(r: DosingRule) {
  await setDoc(doc(db, 'dosingRules', r.id), toRuleDoc(r));
}

/**
 * Only the stored DosingRule fields. Admin pages hold ResolvedRules whose UI-only
 * `source` label must never be written (firestore.rules also rejects extra keys).
 */
function toRuleDoc(r: DosingRule): Omit<DosingRule, 'id'> {
  return {
    medicationId: r.medicationId,
    target: r.target,
    dosePerKg: r.dosePerKg,
    route: r.route,
    frequency: r.frequency,
    durationDays: r.durationDays,
    maxSingleDose: r.maxSingleDose,
    contraindications: r.contraindications,
    notes: r.notes,
    updatedAt: r.updatedAt,
    updatedBy: r.updatedBy,
  };
}
export async function deleteDosingRule(id: string) {
  await deleteDoc(doc(db, 'dosingRules', id));
}

/** A rule already exists at the id a create or re-key wanted. Nothing was written. */
export class RuleExistsError extends Error {
  readonly id: string;
  constructor(id: string) {
    super(`A dosing rule with id ${id} already exists`);
    this.name = 'RuleExistsError';
    this.id = id;
  }
}

export async function createDosingRule(r: DosingRule) {
  await createDosingRules([r]);
}

/**
 * Create several rules, all or nothing. A plain setDoc would silently overwrite a rule
 * another tab or admin created meanwhile; the transaction reads first and refuses.
 */
export async function createDosingRules(rules: DosingRule[]) {
  await runTransaction(db, async tx => {
    const refs = rules.map(r => doc(db, 'dosingRules', r.id));
    const snaps = await Promise.all(refs.map(ref => tx.get(ref)));
    const taken = snaps.find(s => s.exists());
    if (taken) throw new RuleExistsError(taken.id);
    refs.forEach((ref, i) => tx.set(ref, toRuleDoc(rules[i])));
  });
}

/** Move a rule to a new id (route changed, or a legacy id). Refuses if the new id is taken. */
export async function rekeyDosingRule(oldId: string, r: DosingRule) {
  await runTransaction(db, async tx => {
    const nextRef = doc(db, 'dosingRules', r.id);
    if ((await tx.get(nextRef)).exists()) throw new RuleExistsError(r.id);
    tx.set(nextRef, toRuleDoc(r));
    tx.delete(doc(db, 'dosingRules', oldId));
  });
}
