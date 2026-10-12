import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TypeaheadSelect, type TypeaheadOption } from '../../components/TypeaheadSelect';
import { SchemaMismatchNotice } from '../../components/SchemaMismatchNotice';
import { SchemaMismatchError } from '../../firebase/schemaGuard';
import { parseWeightParam } from '../../domain/weight';
import { formatGroup } from '../../domain/types';
import { clearPatientSnapshot, getPatientSnapshot } from './patientSnapshot';

type LoadProblem = 'schemaMismatch' | 'error' | null;

export function Patient() {
  const [params] = useSearchParams();
  const [opts, setOpts] = useState<TypeaheadOption[]>([]);
  const [problem, setProblem] = useState<LoadProblem>(null);
  const [attempt, setAttempt] = useState(0);
  const [speciesId, setSpeciesId] = useState<string | null>(params.get('species'));
  const [weight, setWeight] = useState<string>(params.get('weight') ?? '');
  const nav = useNavigate();

  useEffect(() => {
    // A new patient gets fresh data. The med list reuses this same load.
    clearPatientSnapshot();
    let cancelled = false;
    getPatientSnapshot().then(
      ({ species }) => {
        if (cancelled) return;
        setProblem(null);
        setOpts(species.map(s => ({
          id: s.id,
          label: s.commonName,
          sublabel: s.scientificName,
          badge: formatGroup(s.group),
          keywords: [s.commonName, s.scientificName, s.group, formatGroup(s.group)],
        })));
      },
      err => {
        if (!cancelled) setProblem(err instanceof SchemaMismatchError ? 'schemaMismatch' : 'error');
      },
    );
    return () => { cancelled = true; };
  }, [attempt]);

  const weightKg = parseWeightParam(weight);
  const weightUnreadable = weight.trim() !== '' && weightKg === null;
  const selectedOpt = speciesId ? opts.find(o => o.id === speciesId) ?? null : null;
  const canContinue = selectedOpt !== null && weightKg !== null;

  function go() {
    if (!selectedOpt || weightKg === null) return;
    nav(`/dose/${encodeURIComponent(selectedOpt.id)}/${weightKg}`);
  }

  if (problem === 'schemaMismatch') return <SchemaMismatchNotice />;

  return (
    <main className="mx-auto max-w-md px-5 pt-16 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <header className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Field calculator</div>
        <h1 className="font-display text-[34px] font-semibold text-ink leading-tight"
            style={{ fontVariationSettings: '"opsz" 48, "SOFT" 30' }}>
          wildRx
        </h1>
        <p className="text-[13px] italic text-ink2 max-w-[30ch]">
          Pick the species and enter weight, then choose a medication.
        </p>
      </header>

      <div className="mt-10 space-y-10">
        {problem === 'error' ? (
          <div role="alert" className="bg-clay-50 border-l-4 border-clay-600 px-5 py-4">
            <div className="font-display text-[15px] font-semibold text-clay-700 uppercase tracking-[0.1em]">Couldn't load species</div>
            <p className="text-[14px] text-ink mt-2">Check your connection and try again.</p>
            <button
              type="button"
              onClick={() => { setProblem(null); setAttempt(a => a + 1); }}
              className="mt-4 h-11 px-5 bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] rounded-md hover:bg-moss-700 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : !selectedOpt ? (
          <TypeaheadSelect
            options={opts}
            placeholder="Search species…"
            onSelect={setSpeciesId}
            previewCount={6}
          />
        ) : (
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Species</div>
            <div className="font-display text-[22px] text-ink mt-1" style={{ fontVariationSettings: '"opsz" 32' }}>
              {selectedOpt.label}
            </div>
            {selectedOpt.sublabel && (
              <div className="text-[13px] italic text-ink2 mt-0.5">{selectedOpt.sublabel}</div>
            )}
            <button
              type="button"
              onClick={() => setSpeciesId(null)}
              className="mt-3 min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
            >
              Change
            </button>
          </div>
        )}

        <div>
          <label htmlFor="weight" className="block text-[11px] uppercase tracking-[0.14em] text-ink2 mb-2">
            Weight <span className="lowercase tracking-normal italic text-ink2">(kg)</span>
          </label>
          <input
            id="weight"
            type="text"
            inputMode="decimal"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            placeholder="0"
            aria-describedby={weightUnreadable ? 'weight-hint' : undefined}
            className="w-full h-14 border-0 border-b-2 border-taupe bg-transparent px-1 py-2 font-display tabular-nums text-[28px] text-ink placeholder:text-taupe2 focus:border-moss-600 focus:outline-none transition-colors duration-150"
            style={{ fontVariationSettings: '"opsz" 48' }}
          />
          {/* "1,2" could be 1.2 or 12 depending on locale - never guess. */}
          {weightUnreadable && (
            <p id="weight-hint" role="status" className="mt-2 text-[13px] text-ochre-700">
              Enter weight in kg as a number, e.g. 1.2
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={!canContinue}
          onClick={go}
          className="w-full h-14 bg-moss-600 text-paper font-display font-semibold text-[17px] tracking-[0.08em] uppercase rounded-md hover:bg-moss-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-600"
        >
          Choose medication
        </button>
      </div>
    </main>
  );
}
