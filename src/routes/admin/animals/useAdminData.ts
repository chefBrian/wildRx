import { useEffect, useState } from 'react';
import { listAllDosingRules, listMedications, listSpecies } from '../../../firebase/repos';
import { SchemaMismatchError } from '../../../firebase/schemaGuard';
import type { DosingRule, Medication, Species } from '../../../domain/types';

export interface AdminData {
  meds: Medication[];
  species: Species[];
  rules: DosingRule[];
}

export type AdminLoadError = 'schemaMismatch' | 'error';

export interface AdminDataState {
  data: AdminData | null;
  /** Initial load failed (nothing to show): pages render LoadProblem. */
  error: AdminLoadError | null;
  /** A reload failed while data is on screen: keep the data, show a notice. */
  refreshError: AdminLoadError | null;
  reload: () => void;
}

/** Meds, species and every rule for the Animals pages. reload() refetches; a superseded load is dropped. */
export function useAdminData(): AdminDataState {
  const [data, setData] = useState<AdminData | null>(null);
  const [failure, setFailure] = useState<AdminLoadError | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMedications(), listSpecies(), listAllDosingRules()]).then(
      ([meds, species, rules]) => {
        if (cancelled) return;
        setData({ meds, species, rules });
        setFailure(null);
      },
      err => {
        if (!cancelled) setFailure(err instanceof SchemaMismatchError ? 'schemaMismatch' : 'error');
      },
    );
    return () => { cancelled = true; };
  }, [version]);

  return {
    data,
    error: data ? null : failure,
    refreshError: data ? failure : null,
    reload: () => setVersion(v => v + 1),
  };
}
