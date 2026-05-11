import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { listMedications, listSpecies, listDosingRulesForMed } from '../../firebase/repos';
import { resolveRules, type ResolvedRule } from '../../domain/resolveRules';
import { calculateDose } from '../../domain/dose';
import { WizardHeader, type WizardChip } from '../../components/WizardHeader';
import type { Medication, Species } from '../../domain/types';

export function Result() {
  const { medId = '', speciesId = '', weight = '0' } = useParams();
  const weightG = Number(weight) || 0;

  const [loading, setLoading] = useState(true);
  const [med, setMed] = useState<Medication | null>(null);
  const [species, setSpecies] = useState<Species | null>(null);
  const [matched, setMatched] = useState<ResolvedRule[]>([]);
  const [routeIdx, setRouteIdx] = useState(0);
  const [concIdx, setConcIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [meds, allSpecies, rules] = await Promise.all([
        listMedications(),
        listSpecies(),
        listDosingRulesForMed(medId),
      ]);
      if (cancelled) return;
      const m = meds.find(x => x.id === medId) ?? null;
      const s = allSpecies.find(x => x.id === speciesId) ?? null;
      setMed(m);
      setSpecies(s);
      if (m && s) {
        const { matched } = resolveRules({ rules, species: s, medicationId: m.id });
        setMatched(matched);
      } else {
        setMatched([]);
      }
      setRouteIdx(0);
      setConcIdx(0);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [medId, speciesId]);

  if (loading || !med || !species) {
    return <main className="px-5 pt-12 text-ink2">Loading…</main>;
  }

  const stepTwoBack = `/calc/${medId}?species=${speciesId}&weight=${weight}`;
  const chips: WizardChip[] = [
    { label: med.name, sublabel: med.genericName, to: '/' },
    { label: species.commonName, sublabel: `${weightG} g`, to: stepTwoBack },
  ];

  if (matched.length === 0) {
    return (
      <main className="mx-auto max-w-md px-5 pb-12">
        <WizardHeader step={3} backTo={stepTwoBack} chips={chips} />
        <section className="pt-10">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Result</div>
            <h1 className="font-display text-[28px] font-semibold text-ink">{med.name}</h1>
          </div>
          <div className="mt-8 bg-ochre-50 border-l-4 border-ochre-600 px-5 py-5">
            <div className="font-display text-[15px] font-semibold text-ochre-700 uppercase tracking-[0.1em]">No dosing rule</div>
            <p className="text-[14px] text-ink mt-2">No entry matches <strong>{med.name}</strong> in <strong>{species.commonName}</strong>. Ask a vet.</p>
          </div>
        </section>
      </main>
    );
  }

  const rule = matched[Math.min(routeIdx, matched.length - 1)];
  const concentration = med.concentrations[concIdx];
  const result = calculateDose({
    weightGrams: weightG,
    rule,
    concentration: med.concentrations.length > 0 ? concentration : undefined,
  });

  return (
    <main className="mx-auto max-w-md px-5 pb-16">
      <WizardHeader step={3} backTo={stepTwoBack} chips={chips} />

      <div className="pt-6">
        <div
          className="font-display text-[26px] font-semibold text-ink leading-tight"
          style={{ fontVariationSettings: '"opsz" 32' }}
        >
          {med.name}
        </div>
        <div className="text-[13px] text-ink2 mt-1 flex items-center gap-2 flex-wrap">
          {rule.source === 'species' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-moss-50 text-moss-700 text-[11px] font-medium uppercase tracking-[0.08em]">species rule</span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-ochre-50 text-ochre-700 text-[11px] font-medium uppercase tracking-[0.08em]">group rule</span>
          )}
        </div>
      </div>

      {/* Route selector */}
      {matched.length > 1 && (
        <div className="flex flex-wrap gap-2 mt-5">
          {matched.map((r, i) => {
            const active = i === routeIdx;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRouteIdx(i)}
                className={
                  'h-11 px-4 rounded-full font-mono uppercase tracking-wider text-[13px] transition-colors ' +
                  (active
                    ? 'bg-moss-600 text-paper'
                    : 'bg-surface text-ink2 border border-taupe hover:border-taupe2')
                }
              >
                {r.route} · {r.frequency}
              </button>
            );
          })}
        </div>
      )}

      {/* Dose hero */}
      <section className="mt-12 mb-10">
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Dose</div>
        <div
          className="font-display tabular-nums text-ink leading-none mt-2"
          style={{ fontSize: 'clamp(3.5rem, 14vw, 6rem)', fontVariationSettings: '"opsz" 144, "SOFT" 30' }}
        >
          {result.doseMg.typical.toFixed(2)}<span className="font-sans text-[0.3em] text-ink2 ml-2 align-baseline">mg</span>
        </div>
        <div className="text-[13px] italic text-ink2 mt-2">
          range {result.doseMg.min.toFixed(2)} – {result.doseMg.max.toFixed(2)} mg
        </div>
      </section>

      {/* Max-cap banner */}
      {result.cappedByMaxDose && rule.maxSingleDoseMg !== null && (
        <div className="my-6 bg-ember-50 border-l-4 border-ember-600 px-5 py-4">
          <div className="font-display text-[15px] font-semibold text-ember-700 uppercase tracking-[0.1em]">
            ▲ Capped at max single dose
          </div>
          <div className="text-[13px] text-ink mt-1">Max {rule.maxSingleDoseMg} mg.</div>
        </div>
      )}

      {/* Volume */}
      {med.concentrations.length > 0 && concentration && result.volumeMl && (
        <section className="my-8 bg-cream px-6 py-6">
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Volume</div>
          <div className="mt-3">
            <select
              value={concIdx}
              onChange={e => setConcIdx(Number(e.target.value))}
              className="appearance-none bg-transparent border-b border-taupe2 py-2 pr-6 font-sans text-[13px] text-ink focus:border-moss-600 focus:outline-none transition-colors"
            >
              {med.concentrations.map((c, i) => (
                <option key={i} value={i}>{c.label}</option>
              ))}
            </select>
          </div>
          <div
            className="font-display tabular-nums text-ink leading-none mt-4"
            style={{ fontSize: 'clamp(2.5rem, 10vw, 4rem)', fontVariationSettings: '"opsz" 96' }}
          >
            {result.volumeMl.typical.toFixed(2)}<span className="font-sans text-[0.32em] text-ink2 ml-2 align-baseline">ml</span>
          </div>
          <div className="text-[13px] italic text-ink2 mt-2">
            range {result.volumeMl.min.toFixed(2)} – {result.volumeMl.max.toFixed(2)} ml
          </div>
        </section>
      )}

      {/* Stat row */}
      <section className="grid grid-cols-3 gap-4 my-10">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Route</div>
          <div className="font-display font-mono text-[20px] text-ink mt-1">{rule.route}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Freq</div>
          <div className="font-display text-[20px] text-ink mt-1">{rule.frequency}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Duration</div>
          <div className="font-display text-[20px] text-ink mt-1">
            {rule.durationDays === null
              ? '—'
              : rule.durationDays.min === rule.durationDays.max
                ? `${rule.durationDays.min}d`
                : `${rule.durationDays.min}–${rule.durationDays.max}d`}
          </div>
        </div>
      </section>

      {/* Contraindications */}
      {rule.contraindications.length > 0 && (
        <section className="my-6 bg-clay-50 px-5 py-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-clay-700">Contraindications</div>
          <ul className="mt-2 space-y-1 text-[15px] text-ink list-disc pl-5 marker:text-clay-600">
            {rule.contraindications.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Notes — always visible */}
      {rule.notes && rule.notes.length > 0 && (
        <section className="my-6">
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2 pb-3 border-b border-taupe">
            Notes
          </div>
          <div className="text-[15px] text-ink whitespace-pre-wrap pt-4 leading-relaxed">
            {rule.notes}
          </div>
        </section>
      )}
    </main>
  );
}
