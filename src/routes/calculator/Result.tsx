import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getPatientSnapshot, type PatientSnapshot } from './patientSnapshot';
import { SchemaMismatchError } from '../../firebase/schemaGuard';
import { resolveRules, type ResolvedRule } from '../../domain/resolveRules';
import { calculateDose } from '../../domain/dose';
import { allowedRoutes, bottleAllowsRoute, formatRoutes, resolveConcentration } from '../../domain/concentrations';
import { doseWarnings } from '../../domain/warnings';
import {
  formatConcentration, formatNumber, formatRange, formatWeight, formatWeightShort, isRange, plainDuration,
} from '../../domain/format';
import { plainFrequency } from '../../domain/frequency';
import { WizardHeader, type WizardChip } from '../../components/WizardHeader';
import { InfoIcon } from '../../components/InfoIcon';
import { SchemaMismatchNotice } from '../../components/SchemaMismatchNotice';
import { ROUTE_PLAIN } from '../../domain/doseRoutes';
import { parseWeightParam } from '../../domain/weight';
import type { Concentration, DoseUnit, Medication, Route, Species } from '../../domain/types';

export function Result() {
  const { speciesId = '', weight = '', medId = '' } = useParams();
  const nav = useNavigate();
  const parsedWeight = parseWeightParam(weight);
  const weightValid = parsedWeight !== null;
  const weightKg = parsedWeight ?? 0;

  const [loading, setLoading] = useState(true);
  const [med, setMed] = useState<Medication | null>(null);
  const [species, setSpecies] = useState<Species | null>(null);
  const [matched, setMatched] = useState<ResolvedRule[]>([]);
  const [routeIdx, setRouteIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [searchParams] = useSearchParams();
  const [schemaMismatch, setSchemaMismatch] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const concParam = searchParams.get('conc');
  const routeParam = searchParams.get('route');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(false);
      let snapshot: PatientSnapshot;
      try {
        snapshot = await getPatientSnapshot();
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SchemaMismatchError) setSchemaMismatch(true);
        else setLoadError(true);
        setLoading(false);
        return;
      }
      if (cancelled) return;
      const m = snapshot.meds.find(x => x.id === medId) ?? null;
      const s = snapshot.species.find(x => x.id === speciesId) ?? null;
      setMed(m);
      setSpecies(s);
      const matchedNow = m && s ? resolveRules({ rules: snapshot.rules, species: s, medicationId: m.id }).matched : [];
      setMatched(matchedNow);
      const choice = m ? resolveConcentration(m, concParam) : null;
      setRouteIdx(firstAllowedIndex(matchedNow, choice?.status === 'selected' ? choice.concentration : undefined, routeParam));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [medId, speciesId, attempt, concParam, routeParam]);

  const enc = encodeURIComponent;
  const patientLink = `/?species=${enc(speciesId)}&weight=${weightValid ? weightKg : ''}`;
  const medListBase = `/dose/${enc(speciesId)}/${enc(weight)}`;
  const needsBottle = !!med && resolveConcentration(med, null).status === 'needsPick';
  const medListBack = needsBottle ? `${medListBase}?open=${enc(medId)}` : medListBase;
  const chips: WizardChip[] = med && species ? [
    { label: species.commonName, sublabel: weightValid ? formatWeightShort(weightKg) : '—', to: patientLink },
    { label: med.name, sublabel: med.genericName, to: medListBack },
  ] : [];

  const rule = matched[Math.min(routeIdx, Math.max(matched.length - 1, 0))];
  const concChoice = med ? resolveConcentration(med, concParam) : { status: 'none' as const };
  const concentration = concChoice.status === 'selected' ? concChoice.concentration : undefined;
  const result = useMemo(() => {
    if (!rule || !weightValid || !med) return null;
    return calculateDose({ weightKg, rule, doseUnit: med.doseUnit, concentration });
  }, [rule, weightKg, weightValid, med, concentration]);

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-5 pt-10 pb-[max(3rem,env(safe-area-inset-bottom))]">
        <div className="h-7 w-32 bg-cream rounded animate-pulse" />
        <div className="mt-8 h-10 w-2/3 bg-cream rounded animate-pulse" />
        <div className="mt-6 h-24 w-full bg-cream rounded animate-pulse" />
        <div className="mt-6 h-16 w-full bg-cream rounded animate-pulse" />
        <span className="sr-only">Loading dose…</span>
      </main>
    );
  }

  if (schemaMismatch) return <SchemaMismatchNotice />;

  if (loadError) {
    return (
      <main className="mx-auto max-w-md px-5 pt-10 pb-[max(3rem,env(safe-area-inset-bottom))]">
        <div role="alert" className="bg-clay-50 border-l-4 border-clay-600 px-5 py-4">
          <div className="font-display text-[15px] font-semibold text-clay-700 uppercase tracking-[0.1em]">Couldn't load the dosing data</div>
          <p className="text-[14px] text-ink mt-2">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => setAttempt(a => a + 1)}
            className="mt-4 h-11 px-5 bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] rounded-md hover:bg-moss-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!med || !species) {
    return (
      <main className="mx-auto max-w-md px-5 pt-10 pb-[max(3rem,env(safe-area-inset-bottom))]">
        <p className="text-ink2">Could not load this calculation. <button type="button" onClick={() => nav('/')} className="text-moss-700 underline">Start over</button>.</p>
      </main>
    );
  }

  // Several concentrations and no valid ?conc id: never guess a strength - go pick.
  // pick=1 tells the med list to explain why the user is back.
  if (concChoice.status === 'needsPick') return <Navigate to={`${medListBase}?open=${enc(medId)}&pick=1`} replace />;

  // Invalid weight – bounce the user back to the patient screen with context.
  if (!weightValid) {
    return (
      <main className="mx-auto max-w-md px-5 pb-[max(3rem,env(safe-area-inset-bottom))]">
        <WizardHeader step={3} backTo={patientLink} chips={chips} />
        <section className="pt-10">
          <div role="alert" className="bg-clay-50 border-l-4 border-clay-600 px-5 py-4">
            <div className="font-display text-[15px] font-semibold text-clay-700 uppercase tracking-[0.1em]">Weight missing</div>
            <p className="text-[14px] text-ink mt-2">Enter a weight in kg to calculate a dose.</p>
          </div>
          <button
            type="button"
            onClick={() => nav(patientLink)}
            className="mt-6 w-full h-14 bg-moss-600 text-paper font-display font-semibold text-[16px] uppercase tracking-[0.08em] rounded-md hover:bg-moss-700 transition-colors"
          >
            Enter weight
          </button>
        </section>
      </main>
    );
  }

  if (matched.length === 0 || !rule || !result) {
    return (
      <main className="mx-auto max-w-md px-5 pb-[max(3rem,env(safe-area-inset-bottom))]">
        <WizardHeader step={3} backTo={medListBack} chips={chips} />
        <section className="pt-10">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Result</div>
            <h1 className="font-display text-[28px] font-semibold text-ink">{med.name}</h1>
          </div>
          <div role="alert" className="mt-8 bg-ochre-50 border-l-4 border-ochre-600 px-5 py-5">
            <div className="font-display text-[15px] font-semibold text-ochre-700 uppercase tracking-[0.1em]">No dosing rule</div>
            <p className="text-[14px] text-ink mt-2">No entry matches <strong>{med.name}</strong> in <strong>{species.commonName}</strong>. Ask a vet.</p>
          </div>
          <button
            type="button"
            onClick={() => nav(medListBase)}
            className="mt-8 w-full h-14 bg-moss-600 text-paper font-display font-semibold text-[16px] uppercase tracking-[0.08em] rounded-md hover:bg-moss-700 transition-colors"
          >
            Back to med list
          </button>
        </section>
      </main>
    );
  }

  const unit = med.doseUnit;
  const rate = rule.dosePerKg.typical;
  const rawDoseTypical = weightKg * rate;
  // A bottle not set for this route: the result is still computed, but no number from it is ever shown.
  const blockedBottle = concentration && !bottleAllowsRoute(concentration, rule.route) ? concentration : null;
  const warnings = blockedBottle ? [] : doseWarnings({ result, rule, weightKg });
  const otherBottleLink = blockedBottle
    && med.concentrations.some(c => c.id !== blockedBottle.id && bottleAllowsRoute(c, rule.route))
    ? `${medListBase}?open=${enc(medId)}&route=${enc(rule.route)}`
    : null;
  const otherRouteOk = !!blockedBottle && matched.some(r => r.id !== rule.id && bottleAllowsRoute(blockedBottle, r.route));
  const volumeSubtitle = unit === 'ml'
    ? med.productDescription ?? ''
    : concentration ? formatConcentration(concentration, unit) : '';

  async function copySummary() {
    if (!med || !species || !rule || !result || blockedBottle) return;
    const lines = [
      `${med.name}${med.genericName ? ` (${med.genericName})` : ''}`,
      `Species: ${species.commonName}${species.scientificName ? ` - ${species.scientificName}` : ''}`,
      `Weight: ${formatWeight(weightKg)}`,
    ];
    if (unit === 'ml') {
      lines.push(`Product: ${med.productDescription ?? ''}`);
    } else {
      const range = isRange(result.dose.min, result.dose.max)
        ? `  (range ${formatRange(result.dose.min, result.dose.max, unit)})`
        : '';
      lines.push(`Dose: ${formatNumber(result.dose.typical)} ${unit}${range}`);
    }
    lines.push(
      `Rate: ${formatNumber(rate)} ${unit}/kg × ${formatNumber(weightKg)} kg`,
      `Route: ${rule.route} (${ROUTE_PLAIN[rule.route]})`,
      `Frequency: ${rule.frequency} - ${plainFrequency(rule.frequency)}`,
    );
    if (rule.durationDays) lines.push(`Duration: ${plainDuration(rule.durationDays)}`);
    if (result.volumeMl) {
      const volumeRange = isRange(result.volumeMl.min, result.volumeMl.max)
        ? `  (range ${formatRange(result.volumeMl.min, result.volumeMl.max, 'ml')})`
        : '';
      lines.push(`Volume: ${formatNumber(result.volumeMl.typical)} ml${volumeRange}${volumeSubtitle ? ` @ ${volumeSubtitle}` : ''}`);
    }
    for (const w of warnings) lines.push(`⚠ ${w.title}: ${w.body}`);
    if (rule.contraindications.length > 0) {
      lines.push(`Contraindications: ${rule.contraindications.join('; ')}`);
    }
    if (rule.notes) lines.push(`Notes: ${rule.notes}`);
    lines.push('- Guidance only; cross-check with attending vet.');
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-[max(4rem,env(safe-area-inset-bottom))]">
      <WizardHeader step={3} backTo={medListBack} chips={chips} />

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
        <div className="flex flex-wrap gap-2 mt-5" role="tablist" aria-label="Route">
          {matched.map((r, i) => {
            const active = i === routeIdx;
            return (
              <button
                key={r.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => { setRouteIdx(i); setCopied(false); }}
                className={
                  'h-11 min-w-[44px] px-4 rounded-full font-mono uppercase tracking-wider text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-600 ' +
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

      {/* Contraindications — surfaced before dose so they aren't missed. */}
      {rule.contraindications.length > 0 && (
        <section role="alert" className="mt-6 bg-clay-50 border-l-4 border-clay-600 px-5 py-4">
          <div className="flex items-center gap-2 text-clay-700">
            <WarningIcon className="w-4 h-4" />
            <span className="font-display text-[13px] font-semibold uppercase tracking-[0.1em]">
              Contraindications
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-[15px] text-ink list-disc pl-5 marker:text-clay-600">
            {rule.contraindications.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Notes — slate-blue callout sits with contraindications so context isn't buried. */}
      {rule.notes && rule.notes.length > 0 && (
        <section className="mt-6 bg-slate-50 border-l-4 border-slate-600 px-5 py-4">
          <div className="flex items-center gap-2 text-slate-700">
            <InfoIcon className="w-4 h-4" />
            <span className="font-display text-[13px] font-semibold uppercase tracking-[0.1em]">
              Notes
            </span>
          </div>
          <div className="mt-2 text-[15px] text-ink whitespace-pre-wrap leading-relaxed">
            {rule.notes}
          </div>
        </section>
      )}

      {blockedBottle ? (
        <RouteBlock
          route={rule.route}
          bottleText={formatConcentration(blockedBottle, unit)}
          allowed={allowedRoutes(blockedBottle)}
          otherBottleLink={otherBottleLink}
          otherRouteOk={otherRouteOk}
        />
      ) : (
        <>
          {warnings.map(w => (
            <div key={w.kind} role="alert" className="mt-6 bg-ember-50 border-l-4 border-ember-600 px-5 py-4">
              <div className="flex items-center gap-2 text-ember-700">
                <WarningIcon className="w-4 h-4" />
                <span className="font-display text-[13px] font-semibold uppercase tracking-[0.1em]">
                  {w.title}
                </span>
              </div>
              <div className="text-[13px] text-ink mt-1">{w.body}</div>
            </div>
          ))}

          {/* Volume hero — primary readout for staff. Falls back to dose hero when no concentration. */}
          {result.volumeMl ? (
            <section className="my-8 bg-cream px-6 py-6" aria-label="Volume">
              <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Volume</div>
              {volumeSubtitle && <div className="mt-1 text-[13px] text-ink2">{volumeSubtitle}</div>}
              <output
                className="block font-display tabular-nums text-ink leading-none mt-4"
                style={{ fontSize: 'clamp(2.5rem, 11vw, 5rem)', fontVariationSettings: '"opsz" 144, "SOFT" 30' }}
              >
                {formatNumber(result.volumeMl.typical)}<span className="font-sans text-[0.3em] text-ink2 ml-2 align-baseline">ml</span>
              </output>
              {isRange(result.volumeMl.min, result.volumeMl.max) && (
                <div className="text-[13px] italic text-ink2 mt-2">
                  range {formatRange(result.volumeMl.min, result.volumeMl.max, 'ml')}
                </div>
              )}
            </section>
          ) : (
            <section className="my-8 bg-cream px-6 py-6" aria-label="Dose">
              <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Dose</div>
              <div className="mt-1 text-[13px] text-ink2 italic">No concentration data — dose only</div>
              <output
                className="block font-display tabular-nums text-ink leading-none mt-4"
                style={{ fontSize: 'clamp(2.5rem, 11vw, 5rem)', fontVariationSettings: '"opsz" 144, "SOFT" 30' }}
              >
                {formatNumber(result.dose.typical)}<span className="font-sans text-[0.3em] text-ink2 ml-2 align-baseline">{unit}</span>
              </output>
              {isRange(result.dose.min, result.dose.max) && (
                <div className="text-[13px] italic text-ink2 mt-2">
                  range {formatRange(result.dose.min, result.dose.max, unit)}
                </div>
              )}
            </section>
          )}

          {/* The math, shown so the volunteer can sanity-check the readout. */}
          <div className="mt-2 mb-10 font-mono tabular-nums text-[13px] text-ink2 leading-relaxed">
            {buildMathLine({
              rate,
              weightKg,
              rawDoseTypical,
              unit,
              cap: rule.maxSingleDose,
              typicalCapped: result.typicalCapped,
              concValue: concentration?.value ?? null,
              volumeTypical: result.volumeMl?.typical ?? null,
            })}
          </div>
        </>
      )}

      {/* Stat row — Dose demoted to a column; Volume is now the hero above. */}
      <section className="grid grid-cols-4 gap-3 my-10">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Dose</div>
          {blockedBottle ? (
            <div className="font-display text-[18px] text-ink mt-1">—</div>
          ) : unit === 'ml' ? (
            <>
              <div className="font-display tabular-nums text-[18px] text-ink mt-1">{formatNumber(rate)} ml/kg</div>
              <div className="text-[12px] text-ink2 mt-0.5">Rate</div>
            </>
          ) : (
            <>
              <div className="font-display tabular-nums text-[18px] text-ink mt-1">
                {formatNumber(result.dose.typical)} {unit}
              </div>
              {isRange(result.dose.min, result.dose.max) && (
                <div className="text-[12px] text-ink2 mt-0.5">
                  range {formatRange(result.dose.min, result.dose.max, unit)}
                </div>
              )}
            </>
          )}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Route</div>
          <div className="font-display font-mono text-[18px] text-ink mt-1">{rule.route}</div>
          <div className="text-[12px] text-ink2 mt-0.5">{ROUTE_PLAIN[rule.route]}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Freq</div>
          <div className="font-display text-[18px] text-ink mt-1">{rule.frequency}</div>
          <div className="text-[12px] text-ink2 mt-0.5">{plainFrequency(rule.frequency)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Duration</div>
          <div className="font-display text-[18px] text-ink mt-1">
            {rule.durationDays === null
              ? '-'
              : rule.durationDays.min === rule.durationDays.max
                ? `${rule.durationDays.min}d`
                : `${rule.durationDays.min}-${rule.durationDays.max}d`}
          </div>
          <div className="text-[12px] text-ink2 mt-0.5">
            {plainDuration(rule.durationDays) ?? 'No duration set'}
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="mt-10 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={copySummary}
          disabled={!!blockedBottle}
          aria-live="polite"
          className="h-12 bg-surface text-ink border border-taupe font-sans text-[14px] rounded-md hover:bg-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-600"
        >
          {copied ? 'Copied ✓' : 'Copy summary'}
        </button>
        <button
          type="button"
          onClick={() => nav(medListBase)}
          className="h-12 bg-moss-600 text-paper font-display font-semibold text-[13px] uppercase tracking-[0.06em] rounded-md hover:bg-moss-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-600"
        >
          Another med for this patient
        </button>
      </div>
      <div className="mt-4 text-center">
        <Link
          to="/"
          className="min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
        >
          New patient
        </Link>
        <Link
          to={`/meds/${enc(medId)}`}
          className="ml-6 min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
        >
          About {med.name}
        </Link>
      </div>

      {/* Disclaimer */}
      <p className="mt-8 text-[12px] italic text-ink2 leading-relaxed">
        Guidance only. Cross-check with the attending veterinarian before
        administering. Doses are calculated from the rule in the database and
        do not replace clinical judgment.
      </p>
    </main>
  );
}

/**
 * Open on the preferred route (from "Choose another bottle") when the chosen bottle allows it,
 * else the first route it allows; tab 0 when none does (the block explains).
 */
function firstAllowedIndex(rules: ResolvedRule[], bottle?: Concentration, preferredRoute?: string | null): number {
  if (!bottle) return 0;
  const preferred = preferredRoute ? rules.findIndex(r => r.route === preferredRoute && bottleAllowsRoute(bottle, r.route)) : -1;
  if (preferred !== -1) return preferred;
  const i = rules.findIndex(r => bottleAllowsRoute(bottle, r.route));
  return i === -1 ? 0 : i;
}

function RouteBlock({ route, bottleText, allowed, otherBottleLink, otherRouteOk }: {
  route: Route;
  bottleText: string;
  allowed: readonly Route[];
  otherBottleLink: string | null;
  otherRouteOk: boolean;
}) {
  return (
    <section role="alert" className="mt-6 bg-clay-50 border-l-4 border-clay-600 px-5 py-4">
      <div className="flex items-center gap-2 text-clay-700">
        <WarningIcon className="w-4 h-4" />
        <span className="font-display text-[13px] font-semibold uppercase tracking-[0.1em]">
          Not for {route} use
        </span>
      </div>
      <p className="mt-2 text-[15px] text-ink">
        {allowed.length > 0 ? `${bottleText} is set for ${formatRoutes(allowed)} only.` : `${bottleText} has no routes set.`}
      </p>
      {otherBottleLink ? (
        <Link
          to={otherBottleLink}
          className="mt-3 min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
        >
          Choose another bottle
        </Link>
      ) : (
        <p className="mt-2 text-[15px] text-ink">
          {`No bottle on file can be given by ${route}. Ask a vet.${otherRouteOk ? ' Or choose another route above.' : ''}`}
        </p>
      )}
    </section>
  );
}

function buildMathLine(args: {
  rate: number;
  weightKg: number;
  rawDoseTypical: number;
  unit: DoseUnit;
  cap: number | null;
  typicalCapped: boolean;
  concValue: number | null;
  volumeTypical: number | null;
}): ReactNode {
  const { rate, weightKg, rawDoseTypical, unit, cap, typicalCapped, concValue, volumeTypical } = args;
  return (
    <>
      <span className="text-ink">{formatNumber(rate)}</span> {unit}/kg
      <span className="mx-1.5">×</span>
      <span className="text-ink">{formatNumber(weightKg)}</span> kg
      <span className="mx-1.5">=</span>
      <span className="text-ink">{formatNumber(rawDoseTypical)}</span> {unit}
      {typicalCapped && cap !== null && (
        <span className="ml-1.5 text-ember-700">→ capped at {formatNumber(cap)} {unit}</span>
      )}
      {unit !== 'ml' && concValue !== null && volumeTypical !== null && (
        <>
          <span className="mx-1.5">÷</span>
          <span className="text-ink">{formatNumber(concValue)}</span> {unit}/ml
          <span className="mx-1.5">=</span>
          <span className="text-ink">{formatNumber(volumeTypical)}</span> ml
        </>
      )}
    </>
  );
}

function WarningIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}
