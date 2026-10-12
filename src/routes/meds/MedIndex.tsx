import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Fuse from 'fuse.js';
import { listMedications } from '../../firebase/repos';
import { formatUnitBadge } from '../../domain/format';
import type { Medication } from '../../domain/types';
import { BackLink } from './BackLink';
import { LoadingSkeleton } from './LoadingSkeleton';

export function MedIndex() {
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    listMedications().then(
      m => { if (!cancelled) { setMeds([...m].sort((a, b) => a.name.localeCompare(b.name))); setFailed(false); } },
      () => { if (!cancelled) setFailed(true); },
    );
    return () => { cancelled = true; };
  }, [attempt]);

  const fuse = useMemo(() => new Fuse(meds ?? [], { keys: ['name', 'genericName'], threshold: 0.4 }), [meds]);
  const shown = !meds ? [] : query.trim() ? fuse.search(query).map(r => r.item) : meds;

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <BackLink fallback="/" />
      <header className="mt-6 space-y-2">
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Reference</div>
        <h1 className="font-display text-[34px] font-semibold text-ink leading-tight" style={{ fontVariationSettings: '"opsz" 48, "SOFT" 30' }}>
          Medications
        </h1>
      </header>
      {failed ? (
        <div role="alert" className="mt-8 bg-clay-50 border-l-4 border-clay-600 px-5 py-4">
          <p className="text-[14px] text-ink">Couldn't load medications. Check your connection and try again.</p>
          <button type="button" onClick={() => { setFailed(false); setAttempt(a => a + 1); }} className="mt-3 h-11 px-5 bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] rounded-md hover:bg-moss-700 transition-colors">
            Try again
          </button>
        </div>
      ) : !meds ? (
        <LoadingSkeleton />
      ) : (
        <>
          <input
            type="search"
            aria-label="Filter medications"
            placeholder="Filter medications…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            className="mt-8 w-full border-0 border-b-2 border-taupe bg-transparent pl-1 py-3 text-[17px] text-ink placeholder:text-taupe2 placeholder:italic focus:border-moss-600 focus:outline-none transition-colors"
          />
          <ul className="mt-3">
            {shown.map(m => (
              <li key={m.id} className="border-b border-taupe/50 last:border-0">
                <Link to={`/meds/${encodeURIComponent(m.id)}`} className="min-h-[56px] flex items-start justify-between gap-3 py-4 px-4 hover:bg-cream/50 transition-colors">
                  <span className="min-w-0">
                    <span className="block font-medium text-[17px] text-ink leading-snug">{m.name}</span>
                    {m.genericName && <span className="block text-[13px] italic text-ink2 mt-0.5">{m.genericName}</span>}
                  </span>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] bg-cream text-ink2">
                    {formatUnitBadge(m.doseUnit)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
