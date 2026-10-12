import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Fuse from 'fuse.js';
import { getPatientSnapshot, type PatientSnapshot } from './patientSnapshot';
import { SchemaMismatchError } from '../../firebase/schemaGuard';
import { medsForSpecies } from '../../domain/medsForSpecies';
import { bottleAllowsRoute, formatRoutes, resolveConcentration } from '../../domain/concentrations';
import { formatConcentration, formatUnitBadge, formatWeightShort } from '../../domain/format';
import { parseWeightParam } from '../../domain/weight';
import { WizardHeader } from '../../components/WizardHeader';
import { SchemaMismatchNotice } from '../../components/SchemaMismatchNotice';
import type { Concentration, Medication, Species } from '../../domain/types';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; snapshot: PatientSnapshot }
  | { status: 'schemaMismatch' }
  | { status: 'error' };

export function MedList() {
  const { speciesId = '', weight = '' } = useParams();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPatientSnapshot().then(
      snapshot => { if (!cancelled) setLoad({ status: 'ready', snapshot }); },
      err => { if (!cancelled) setLoad({ status: err instanceof SchemaMismatchError ? 'schemaMismatch' : 'error' }); },
    );
    return () => { cancelled = true; };
  }, [attempt]);

  if (load.status === 'loading') return <LoadingSkeleton />;
  if (load.status === 'schemaMismatch') return <SchemaMismatchNotice />;
  if (load.status === 'error') {
    return (
      <Problem title="Couldn't load medications" body="Check your connection and try again.">
        <button type="button" onClick={() => { setLoad({ status: 'loading' }); setAttempt(a => a + 1); }} className={primaryButtonCls}>
          Try again
        </button>
      </Problem>
    );
  }
  const species = load.snapshot.species.find(s => s.id === speciesId);
  if (!species) {
    return (
      <Problem title="Unknown animal" body="This link names a species that isn't in the list.">
        <Link to="/" className={primaryButtonCls}>Choose the animal</Link>
      </Problem>
    );
  }
  const weightKg = parseWeightParam(weight);
  if (weightKg === null) {
    return (
      <Problem title="Weight missing" body="Enter a weight in kg to see medications.">
        <Link to={`/?species=${encodeURIComponent(species.id)}`} className={primaryButtonCls}>Enter weight</Link>
      </Problem>
    );
  }
  return <MedListView species={species} weightKg={weightKg} snapshot={load.snapshot} />;
}

function MedListView({ species, weightKg, snapshot }: { species: Species; weightKg: number; snapshot: PatientSnapshot }) {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const nav = useNavigate();
  const openId = params.get('open');
  const routeParam = params.get('route');
  const pickRequested = params.get('pick') === '1';

  const { withRules, withoutRules } = useMemo(
    () => medsForSpecies({ meds: snapshot.meds, rules: snapshot.rules, species }),
    [snapshot, species],
  );
  const fuse = useMemo(() => new Fuse(snapshot.meds, { keys: ['name', 'genericName'], threshold: 0.4 }), [snapshot.meds]);
  const visible = useMemo(
    () => (query.trim() === '' ? null : new Set(fuse.search(query).map(r => r.item.id))),
    [fuse, query],
  );
  const shown = (m: Medication) => visible === null || visible.has(m.id);
  const ruled = withRules.filter(x => shown(x.med));
  const unruled = withoutRules.filter(shown);

  const enc = encodeURIComponent;
  const base = `/dose/${enc(species.id)}/${weightKg}`;
  const patientLink = `/?species=${enc(species.id)}&weight=${weightKg}`;

  function choose(med: Medication) {
    if (needsBottle(med)) {
      setParams(openId === med.id ? {} : { open: med.id }, { replace: true });
      return;
    }
    nav(`${base}/${enc(med.id)}`);
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <WizardHeader
        step={2}
        backTo={patientLink}
        chips={[{ label: species.commonName, sublabel: formatWeightShort(weightKg), to: patientLink }]}
      />

      <section className="pt-10">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Medication</div>
          <h1 className="font-display text-[34px] font-semibold text-ink leading-tight"
              style={{ fontVariationSettings: '"opsz" 48, "SOFT" 30' }}>
            Choose medication
          </h1>
        </div>

        {withRules.length === 0 ? (
          <div role="alert" className="mt-8 bg-ochre-50 border-l-4 border-ochre-600 px-5 py-5">
            <div className="font-display text-[15px] font-semibold text-ochre-700 uppercase tracking-[0.1em]">No dosing rules</div>
            <p className="text-[14px] text-ink mt-2">
              No medication has a dosing rule for {species.commonName}. Ask a vet.
            </p>
          </div>
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
            {ruled.length === 0 && (
              <p className="mt-4 text-[14px] italic text-ink2">No medications match "{query}".</p>
            )}
            <ul className="mt-3">
              {ruled.map(({ med, matched }) => {
                const multi = needsBottle(med);
                const open = multi && openId === med.id;
                const routesInEffect = [...new Set(matched.map(r => r.route))];
                const usable = (c: Concentration) => routesInEffect.some(r => bottleAllowsRoute(c, r));
                return (
                  <li key={med.id} className="border-b border-taupe/50 last:border-0">
                    <button
                      type="button"
                      onClick={() => choose(med)}
                      aria-expanded={multi ? open : undefined}
                      className="w-full min-h-[56px] flex items-start justify-between gap-3 py-4 px-4 text-left hover:bg-cream/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-600"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-[17px] text-ink leading-snug">{med.name}</span>
                        {med.genericName && <span className="block text-[13px] italic text-ink2 mt-0.5">{med.genericName}</span>}
                      </span>
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] bg-cream text-ink2">
                        {formatUnitBadge(med.doseUnit)}
                      </span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-ink2 mb-2">Which bottle?</div>
                        {pickRequested && (
                          <p role="status" className="text-[13px] text-ochre-700 mb-2">
                            Pick the concentration you're using - the link didn't say which bottle.
                          </p>
                        )}
                        {!med.concentrations.some(usable) && (
                          <p role="status" className="text-[13px] text-clay-700 mb-2">
                            {`No bottle on file can be given by ${formatRoutes(routesInEffect)}. Ask a vet.`}
                          </p>
                        )}
                        <ul className="space-y-2">
                          {med.concentrations.map(c => usable(c) ? (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => nav(`${base}/${enc(med.id)}?conc=${enc(c.id)}${routeParam ? `&route=${enc(routeParam)}` : ''}`)}
                                className="w-full min-h-[48px] text-left px-4 py-3 rounded-md border border-taupe bg-surface text-[15px] text-ink hover:border-moss-600 transition-colors"
                              >
                                {formatConcentration(c, med.doseUnit)}
                              </button>
                            </li>
                          ) : (
                            <li key={c.id} aria-disabled="true" className="px-4 py-3 rounded-md border border-taupe/60 bg-cream/40 text-ink2">
                              <div className="text-[15px]">{formatConcentration(c, med.doseUnit)}</div>
                              <div className="text-[12px] italic mt-0.5">{`Not for ${formatRoutes(routesInEffect)}`}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {unruled.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer min-h-[44px] flex items-center text-[12px] uppercase tracking-[0.1em] text-ink2">
              No rule for {species.commonName} ({unruled.length})
            </summary>
            <ul className="mt-2">
              {unruled.map(m => (
                <li key={m.id} className="px-4 py-2 text-[15px] text-ink2">{m.name}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </main>
  );
}

/** Same rule the result screen uses: several concentrations means the user must pick. */
function needsBottle(med: Medication): boolean {
  return resolveConcentration(med, null).status === 'needsPick';
}

function Problem({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div role="alert" className="bg-clay-50 border-l-4 border-clay-600 px-5 py-4">
        <div className="font-display text-[15px] font-semibold text-clay-700 uppercase tracking-[0.1em]">{title}</div>
        <p className="text-[14px] text-ink mt-2">{body}</p>
      </div>
      <div className="mt-6">{children}</div>
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div className="h-7 w-32 bg-cream rounded animate-pulse" />
      <div className="mt-8 h-10 w-2/3 bg-cream rounded animate-pulse" />
      <div className="mt-6 h-14 w-full bg-cream rounded animate-pulse" />
      <div className="mt-3 h-14 w-full bg-cream rounded animate-pulse" />
      <span className="sr-only">Loading medications…</span>
    </main>
  );
}

const primaryButtonCls = 'w-full h-14 inline-flex items-center justify-center bg-moss-600 text-paper font-display font-semibold text-[16px] uppercase tracking-[0.08em] rounded-md hover:bg-moss-700 transition-colors';
