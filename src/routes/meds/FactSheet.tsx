import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listDosingRulesForMed, listMedications, listSpecies } from '../../firebase/repos';
import { SchemaMismatchError } from '../../firebase/schemaGuard';
import { SchemaMismatchNotice } from '../../components/SchemaMismatchNotice';
import { RuleSummary } from '../../components/RuleSummary';
import { groupRulesForSheet } from '../../domain/factSheet';
import { allowedRoutes, formatRoutes } from '../../domain/concentrations';
import { formatConcentration } from '../../domain/format';
import { formatGroup, type DosingRule, type Medication, type Route, type Species } from '../../domain/types';
import { BackLink } from './BackLink';
import { LoadingSkeleton } from './LoadingSkeleton';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; meds: Medication[]; species: Species[]; rules: DosingRule[] }
  | { status: 'schemaMismatch' }
  | { status: 'error' };

export function FactSheet() {
  const { medId = '' } = useParams();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMedications(), listSpecies(), listDosingRulesForMed(medId)]).then(
      ([meds, species, rules]) => { if (!cancelled) setLoad({ status: 'ready', meds, species, rules }); },
      err => { if (!cancelled) setLoad({ status: err instanceof SchemaMismatchError ? 'schemaMismatch' : 'error' }); },
    );
    return () => { cancelled = true; };
  }, [medId, attempt]);

  if (load.status === 'schemaMismatch') return <SchemaMismatchNotice />;
  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-[max(4rem,env(safe-area-inset-bottom))]">
      <BackLink fallback="/meds" />
      {load.status === 'loading' && <LoadingSkeleton />}
      {load.status === 'error' && (
        <div role="alert" className="mt-8 bg-clay-50 border-l-4 border-clay-600 px-5 py-4">
          <p className="text-[14px] text-ink">Couldn't load this medication. Check your connection and try again.</p>
          <button type="button" onClick={() => { setLoad({ status: 'loading' }); setAttempt(a => a + 1); }} className="mt-3 h-11 px-5 bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] rounded-md hover:bg-moss-700 transition-colors">
            Try again
          </button>
        </div>
      )}
      {load.status === 'ready' && <SheetBody medId={medId} meds={load.meds} species={load.species} rules={load.rules} />}
    </main>
  );
}

function SheetBody({ medId, meds, species, rules }: { medId: string; meds: Medication[]; species: Species[]; rules: DosingRule[] }) {
  const med = meds.find(m => m.id === medId);
  if (!med) {
    return (
      <p className="mt-8 text-[14px] text-ink2">
        Medication not found. <Link to="/meds" className="text-moss-700 underline">All medications</Link>
      </p>
    );
  }
  const unit = med.doseUnit;
  const { sections, other } = groupRulesForSheet({ rules, species, medicationId: med.id });
  const bottleRoutes = new Set<Route>(med.concentrations.flatMap(allowedRoutes));
  const checksBottles = unit !== 'ml' && med.concentrations.length > 0;
  const row = (r: DosingRule, sourceLabel: string) => (
    <RuleSummary key={r.id} rule={r} unit={unit} sourceLabel={sourceLabel} detail>
      {checksBottles && !bottleRoutes.has(r.route) && (
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-clay-700">{`No bottle on file for ${r.route}`}</span>
      )}
    </RuleSummary>
  );
  return (
    <>
      <header className="mt-6 space-y-1">
        <h1 className="font-display text-[30px] font-semibold text-ink leading-tight">{med.name}</h1>
        {med.genericName && <div className="text-[13px] italic text-ink2">{med.genericName}</div>}
        <div className="text-[13px] text-ink2">{`Dosed in ${unit}/kg`}</div>
      </header>

      <section className="mt-8 space-y-2">
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-ink2">Bottles</h2>
        {unit === 'ml' ? (
          <p className="text-[15px] text-ink">{med.productDescription}</p>
        ) : med.concentrations.length === 0 ? (
          <p className="text-[14px] italic text-ink2">No bottles on file.</p>
        ) : (
          <ul className="space-y-2">
            {med.concentrations.map(c => (
              <li key={c.id} className="bg-surface border border-taupe rounded-md px-4 py-3">
                <div className="text-[15px] text-ink">{formatConcentration(c, unit)}</div>
                <div className="text-[12px] text-ink2 mt-0.5">{`Can be given by: ${formatRoutes(allowedRoutes(c))}`}</div>
              </li>
            ))}
          </ul>
        )}
        {med.notes && <p className="text-[14px] text-ink whitespace-pre-wrap">{med.notes}</p>}
      </section>

      <section className="mt-10 space-y-8">
        {sections.length === 0 && other.length === 0 && (
          <p className="text-[14px] text-ink">No dosing rules yet. Ask a vet.</p>
        )}
        {sections.map(s => (
          <div key={s.group} className="space-y-3">
            <h2 className="font-display text-[20px] font-semibold text-ink">{formatGroup(s.group)}</h2>
            {s.groupRules.map(r => row(r, formatGroup(s.group)))}
            {s.speciesBlocks.map(b => (
              <div key={b.species.id} className="space-y-2 pl-4 border-l-2 border-taupe/60">
                <h3 className="text-[15px] font-medium text-ink">{b.species.commonName}</h3>
                {b.replacesGroup && (
                  <p className="text-[12px] italic text-ink2">{`Replaces the ${formatGroup(s.group)} rules for this species.`}</p>
                )}
                {b.lostRoutes.length > 0 && (
                  <p className="text-[12px] text-clay-700">{`No ${formatRoutes(b.lostRoutes)} dose for this species.`}</p>
                )}
                {b.rules.map(r => row(r, 'species'))}
              </div>
            ))}
          </div>
        ))}
        {other.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display text-[20px] font-semibold text-ink">Other rules</h2>
            {other.map(r => row(r, `${r.target.type}: ${r.target.value}`))}
          </div>
        )}
      </section>

      <p className="mt-10 text-[12px] italic text-ink2 leading-relaxed">
        Guidance only. Cross-check with the attending veterinarian before administering. Doses are calculated from the rule in the database and do not replace clinical judgment.
      </p>
    </>
  );
}
