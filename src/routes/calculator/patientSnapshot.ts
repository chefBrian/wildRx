import { listAllDosingRules, listMedications, listSpecies } from '../../firebase/repos';
import type { DosingRule, Medication, Species } from '../../domain/types';

export interface PatientSnapshot {
  meds: Medication[];
  species: Species[];
  rules: DosingRule[];
}

let cached: Promise<PatientSnapshot> | null = null;

/**
 * One load of meds, species and rules per patient, shared by the med list and the
 * result screen: switching meds costs no network, and every dose for one patient
 * comes from the same data. Admin edits show up from the next patient.
 */
export function getPatientSnapshot(): Promise<PatientSnapshot> {
  if (!cached) {
    const load = Promise.all([listMedications(), listSpecies(), listAllDosingRules()])
      .then(([meds, species, rules]) => ({ meds, species, rules }));
    cached = load;
    // A failed load must not stick: the next call retries.
    load.catch(() => {
      if (cached === load) cached = null;
    });
  }
  return cached;
}

/** A new patient starts: their doses come from fresh data. */
export function clearPatientSnapshot(): void {
  cached = null;
}
