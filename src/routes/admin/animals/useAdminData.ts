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

/** Meds, species and every rule for the Animals pages. reload() refetches; a superseded load is dropped. */
export function useAdminData(): { data: AdminData | null; error: AdminLoadError | null; reload: () => void } {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<AdminLoadError | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMedications(), listSpecies(), listAllDosingRules()]).then(
      ([meds, species, rules]) => {
        if (cancelled) return;
        setData({ meds, species, rules });
        setError(null);
      },
      err => {
        if (!cancelled) setError(err instanceof SchemaMismatchError ? 'schemaMismatch' : 'error');
      },
    );
    return () => { cancelled = true; };
  }, [version]);

  return { data, error, reload: () => setVersion(v => v + 1) };
}
