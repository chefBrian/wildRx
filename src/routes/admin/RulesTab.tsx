import { useEffect, useMemo, useState } from 'react';
import {
  listMedications, listSpecies, listDosingRulesForMed,
  upsertDosingRule, deleteDosingRule,
} from '../../firebase/repos';
import { TypeaheadSelect, type TypeaheadOption } from '../../components/TypeaheadSelect';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { calculateDose, type DoseResult } from '../../domain/dose';
import { formatNumber, formatRange } from '../../domain/format';
import { normalizeRuleRange, validateRule } from '../../domain/validate';
import { targetWeightRange } from '../../domain/targetWeights';
import { doseWarnings, type DoseWarning } from '../../domain/warnings';
import { SchemaMismatchError } from '../../firebase/schemaGuard';
import { NumberField } from '../../components/NumberField';
import { FREQUENCY_OPTIONS, isCanonicalFrequency } from '../../domain/frequency';
import { useAuth } from '../../auth/AuthProvider';
import {
  formatGroup,
  type Concentration, type DoseUnit, type DosingRule, type Medication, type Species, type TaxonomicGroup,
  type Route as DoseRoute, type RuleTarget,
} from '../../domain/types';

const GROUPS: TaxonomicGroup[] = [
  'raptor', 'songbird', 'waterfowl', 'wadingBird', 'shorebird',
  'smallMammal', 'mediumMammal', 'largeMammal', 'reptile', 'amphibian', 'other',
];
const ROUTES: DoseRoute[] = ['PO', 'IM', 'SC', 'IV', 'topical'];
const PREVIEW_TAGS: Record<DoseWarning['kind'], string> = {
  cap: 'capped',
  formRoute: 'not injectable',
  unmeasurable: 'too small to measure',
};

const blank = (medId: string, uid: string): DosingRule => ({
  id: '',
  medicationId: medId,
  target: { type: 'group', value: 'raptor' },
  dosePerKg: { min: NaN, max: NaN, typical: NaN },
  route: 'PO',
  frequency: 'q24h',
  durationDays: null,
  maxSingleDose: null,
  contraindications: [],
  notes: '',
  updatedAt: Date.now(),
  updatedBy: uid,
});

const inputCls = 'w-full h-10 rounded-md border border-taupe bg-paper px-3 text-[14px] text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors';
const numInputCls = inputCls + ' tabular-nums';
const textareaCls = 'w-full min-h-[80px] py-2 rounded-md border border-taupe bg-paper px-3 text-[14px] text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors';
const eyebrowCls = 'text-[11px] uppercase tracking-[0.14em] text-ink2 mb-1.5 block';
const sectionEyebrowCls = 'text-[11px] uppercase tracking-[0.14em] text-ink2 mt-2 mb-2 block';

export function RulesTab() {
  const { user } = useAuth();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [species, setSpecies] = useState<Species[]>([]);
  const [medId, setMedId] = useState<string>('');
  const [rules, setRules] = useState<DosingRule[]>([]);
  const [editing, setEditing] = useState<DosingRule | null>(null);
  const [sampleWeight, setSampleWeight] = useState(1);
  const [pickingTarget, setPickingTarget] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DosingRule | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  // freqMode is derived: an empty or non-canonical token = custom; otherwise preset.
  const freqMode: 'preset' | 'custom' =
    editing && editing.frequency && isCanonicalFrequency(editing.frequency)
      ? 'preset'
      : 'custom';

  useEffect(() => {
    listMedications().then(setMeds);
    listSpecies().then(setSpecies);
  }, []);

  useEffect(() => {
    setRulesError(null);
    if (!medId) {
      setRules([]);
      return;
    }
    listDosingRulesForMed(medId)
      .then(setRules)
      .catch(err => {
        if (!(err instanceof SchemaMismatchError)) throw err;
        setRules([]);
        setRulesError('This medication has rules in an old format. Fix or delete them in the Firebase console.');
      });
  }, [medId]);

  const targetOptions: TypeaheadOption[] = useMemo(() => [
    ...GROUPS.map(g => ({ id: `group:${g}`, label: formatGroup(g), badge: 'group', keywords: [g, formatGroup(g)] })),
    ...species.map(s => ({
      id: `species:${s.id}`,
      label: s.commonName,
      sublabel: s.scientificName,
      badge: 'species',
      keywords: [s.commonName, s.scientificName],
    })),
  ], [species]);

  const med = meds.find(m => m.id === medId);
  const unit = med?.doseUnit ?? 'mg';
  const normalized = editing ? normalizeRuleRange(editing) : null;
  const ruleErrors = normalized ? validateRule(normalized) : {};

  function setTargetFromOption(optId: string) {
    if (!editing) return;
    const [type, value] = optId.split(':');
    const target: RuleTarget = type === 'group'
      ? { type: 'group', value: value as TaxonomicGroup }
      : { type: 'species', value };
    setEditing({ ...editing, target });
    setPickingTarget(false);
  }

  async function save() {
    if (!normalized || !user || Object.keys(ruleErrors).length > 0) return;
    const toSave = stamp(normalized, user.uid);
    await upsertDosingRule(toSave);
    setEditing(null);
    if (medId) setRules(await listDosingRulesForMed(medId));
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteDosingRule(pendingDelete.id);
    setPendingDelete(null);
    if (medId) setRules(await listDosingRulesForMed(medId));
  }

  function describeTarget(t: RuleTarget): string {
    if (t.type === 'group') return `Group: ${formatGroup(t.value)}`;
    const s = species.find(x => x.id === t.value);
    return `Species: ${s?.commonName ?? t.value}`;
  }

  function livePreview() {
    if (!normalized || !med) return null;
    const range = targetWeightRange(normalized.target, species);
    const weights = range ? [range.min, range.max] : [sampleWeight];
    return (
      <div className="bg-moss-50 rounded-md p-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-moss-700 mb-2">
          Live preview {range ? '(target typical weights)' : ''}
        </div>
        {!range && (
          <label className="text-[13px] text-ink2 flex items-center gap-2">
            Sample weight (kg)
            <NumberField className="w-28 h-9 rounded-md border border-taupe bg-paper px-3 text-[14px] tabular-nums text-ink focus:border-moss-600 focus:outline-none transition-colors"
              value={sampleWeight}
              onValueChange={v => setSampleWeight(v ?? NaN)} />
          </label>
        )}
        <ul className="mt-3 space-y-1 text-[14px] text-ink">
          {weights.map(kg => (
            <li key={kg}>{previewLine(normalized, med.doseUnit, med.concentrations, kg)}</li>
          ))}
        </ul>
      </div>
    );
  }

  function editPanel() {
    if (!editing) return null;
    return (
      <div className="bg-surface border border-taupe rounded-md p-5 space-y-5">
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">
            {editing.id ? 'Edit rule' : 'New rule'}
          </div>

          {/* Target */}
          <div>
            <div className={sectionEyebrowCls}>Target</div>
            {editing.id ? (
              <>
                <div className="text-[15px] text-ink font-medium">
                  {describeTarget(editing.target)}
                </div>
                <div className="mt-1 text-[12px] italic text-ink2">
                  Target is fixed once a rule is created. To target a different group or species, delete this rule and add a new one.
                </div>
              </>
            ) : pickingTarget ? (
              <TypeaheadSelect
                options={targetOptions}
                onSelect={setTargetFromOption}
                placeholder="Type to search group or species…"
                previewCount={6}
              />
            ) : (
              <div className="bg-cream rounded-md px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-[15px] text-ink font-medium">
                  {describeTarget(editing.target)}
                </div>
                <button
                  type="button"
                  onClick={() => setPickingTarget(true)}
                  className="min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1 shrink-0"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Dosing */}
          <div>
            <div className={sectionEyebrowCls}>{`Dose per kg, per dose (${unit}/kg)`}</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="r-min" className={eyebrowCls}>Min</label>
                <NumberField id="r-min" className={numInputCls} placeholder="= typical"
                  value={editing.dosePerKg.min}
                  onValueChange={v => setEditing({ ...editing, dosePerKg: { ...editing.dosePerKg, min: v ?? NaN } })} />
                {ruleErrors.min && <div className="mt-1 text-[12px] text-clay-700">{ruleErrors.min}</div>}
              </div>
              <div>
                <label htmlFor="r-typ" className={eyebrowCls}>Typical</label>
                <NumberField id="r-typ" className={numInputCls}
                  value={editing.dosePerKg.typical}
                  onValueChange={v => setEditing({ ...editing, dosePerKg: { ...editing.dosePerKg, typical: v ?? NaN } })} />
                {ruleErrors.typical && <div className="mt-1 text-[12px] text-clay-700">{ruleErrors.typical}</div>}
              </div>
              <div>
                <label htmlFor="r-max" className={eyebrowCls}>Max</label>
                <NumberField id="r-max" className={numInputCls} placeholder="= typical"
                  value={editing.dosePerKg.max}
                  onValueChange={v => setEditing({ ...editing, dosePerKg: { ...editing.dosePerKg, max: v ?? NaN } })} />
                {ruleErrors.max && <div className="mt-1 text-[12px] text-clay-700">{ruleErrors.max}</div>}
              </div>
            </div>
            <p className="mt-2 text-[12px] italic text-ink2">
              {unit === 'ml'
                ? 'Per dose, not per day. For a daily fluid total, divide by the number of doses.'
                : unit === 'mg'
                  ? 'Have mcg/kg? Enter as mg/kg: 10 mcg/kg = 0.01 mg/kg.'
                  : 'Leave min or max blank to use the typical value.'}
            </p>
          </div>

          {/* Live preview – placed next to dosing so admins see the effect as they type. */}
          {livePreview()}

          {/* Schedule */}
          <div>
            <div className={sectionEyebrowCls}>Schedule</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="r-route" className={eyebrowCls}>Route</label>
                <select id="r-route" className={inputCls} value={editing.route}
                  onChange={e => setEditing({ ...editing, route: e.target.value as DoseRoute })}>
                  {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="r-freq" className={eyebrowCls}>Frequency</label>
                {freqMode === 'preset' ? (
                  <select
                    id="r-freq"
                    className={inputCls}
                    value={isCanonicalFrequency(editing.frequency) ? editing.frequency.toLowerCase() : 'q24h'}
                    onChange={e => {
                      const v = e.target.value;
                      // Choosing "Custom…" clears the token so the text-input
                      // branch renders; the admin then types their own.
                      setEditing({ ...editing, frequency: v === '__custom__' ? '' : v });
                    }}
                  >
                    {FREQUENCY_OPTIONS.map(o => (
                      <option key={o.token} value={o.token}>{o.token} — {o.plain}</option>
                    ))}
                    <option value="__custom__">Custom…</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      id="r-freq"
                      type="text"
                      className={inputCls + ' flex-1'}
                      placeholder="e.g. q6-12h"
                      value={editing.frequency}
                      onChange={e => setEditing({ ...editing, frequency: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, frequency: 'q24h' })}
                      className="min-h-[44px] text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1 shrink-0"
                    >
                      Preset
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Safety */}
          <div>
            <div className={sectionEyebrowCls}>Safety</div>
            <label htmlFor="r-cap" className={eyebrowCls}>{`Max single dose (${unit}, blank = none)`}</label>
            <NumberField id="r-cap" className={numInputCls}
              value={editing.maxSingleDose}
              onValueChange={v => setEditing({ ...editing, maxSingleDose: v })} />
            {ruleErrors.maxSingleDose && <div className="mt-1 text-[12px] text-clay-700">{ruleErrors.maxSingleDose}</div>}

            <label htmlFor="r-contra" className={eyebrowCls + ' mt-4'}>Contraindications (one per line)</label>
            <textarea id="r-contra" className={textareaCls}
              value={editing.contraindications.join('\n')}
              onChange={e => setEditing({ ...editing, contraindications: e.target.value.split('\n').filter(Boolean) })} />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="r-notes" className={eyebrowCls}>Notes</label>
            <textarea id="r-notes" className={textareaCls} value={editing.notes}
              onChange={e => setEditing({ ...editing, notes: e.target.value })} />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={save}
              disabled={Object.keys(ruleErrors).length > 0}
              className="bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] h-11 px-5 rounded-md hover:bg-moss-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Save
            </button>
            <button type="button" onClick={() => setEditing(null)}
              className="bg-surface text-ink2 border border-taupe font-sans text-[14px] h-11 px-5 rounded-md hover:bg-cream/50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
    );
  }

  const isNew = editing !== null && !editing.id;

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="rule-med" className={eyebrowCls}>Medication</label>
        <select id="rule-med" className={inputCls} value={medId} onChange={e => setMedId(e.target.value)}>
          <option value="">— select —</option>
          {meds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {rulesError && <div role="alert" className="bg-clay-50 border-l-4 border-clay-600 px-5 py-4 text-[14px] text-ink">{rulesError}</div>}

      {medId && (
        <>
          {!rulesError && <div className="flex justify-end">
            <button
              type="button"
              disabled={!user}
              onClick={() => {
                if (!user) return;
                setEditing(blank(medId, user.uid));
                setPickingTarget(true);
              }}
              className="bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] h-11 px-5 rounded-md hover:bg-moss-700 disabled:opacity-50 transition-colors"
            >
              + Add rule
            </button>
          </div>}

          {isNew && editPanel()}

          {rules.length === 0 && !isNew && (
            <div className="bg-cream/60 border border-taupe/60 rounded-md px-5 py-8 text-center text-[14px] text-ink2">
              No rules yet for this medication. Tap <span className="text-ink font-medium">+ Add rule</span> to create the first one.
            </div>
          )}

          <ul className="space-y-2">
            {rules.map(r => {
              const isEditingThis = editing !== null && editing.id === r.id;
              if (isEditingThis) {
                return <li key={r.id}>{editPanel()}</li>;
              }
              const rangeLabel = r.dosePerKg.min === r.dosePerKg.max
                ? formatRange(r.dosePerKg.typical, r.dosePerKg.typical, `${unit}/kg`)
                : `${formatRange(r.dosePerKg.min, r.dosePerKg.max, `${unit}/kg`)} (typ ${formatNumber(r.dosePerKg.typical)})`;
              return (
                <li key={r.id} className="bg-surface border border-taupe rounded-md p-4 flex items-center justify-between gap-6">
                  <div className="min-w-0">
                    <div className="font-display text-[16px] text-ink leading-tight" style={{ fontVariationSettings: '"opsz" 24' }}>
                      {describeTarget(r.target)}
                    </div>
                    <div className="text-[13px] text-ink2 mt-1 flex items-center gap-2 flex-wrap">
                      <span className="tabular-nums">{rangeLabel}</span>
                      <span className="text-taupe2">·</span>
                      <span className="font-mono text-ink">{r.route}</span>
                      <span className="text-taupe2">·</span>
                      <span>{r.frequency}</span>
                    </div>
                  </div>
                  <div className="flex gap-6 shrink-0">
                    <button type="button" onClick={() => setEditing(r)} className="min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1">Edit</button>
                    <button type="button" onClick={() => setPendingDelete(r)} className="min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-clay-700 underline underline-offset-4 decoration-1">Delete</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this rule?"
        message={pendingDelete ? `${describeTarget(pendingDelete.target)} — ${pendingDelete.route} ${pendingDelete.frequency}. This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function previewLine(rule: DosingRule, unit: DoseUnit, concentrations: Concentration[], kg: number): string {
  const head = `${formatNumber(kg)} kg: `;
  const base = calculateDose({ weightKg: kg, rule, doseUnit: unit });
  if (unit === 'ml' || concentrations.length === 0) {
    return `${head}${formatNumber(base.dose.typical)} ${unit}${tagsFor(base, rule, kg)}`;
  }
  const volumes = concentrations.map(c => {
    const r = calculateDose({ weightKg: kg, rule, doseUnit: unit, concentration: c });
    return `${formatNumber(r.volumeMl?.typical ?? NaN)} ml @ ${formatNumber(c.value)} ${unit}/ml${tagsFor(r, rule, kg, c)}`;
  });
  return `${head}${formatNumber(base.dose.typical)} ${unit} = ${volumes.join(', ')}`;
}

function tagsFor(result: DoseResult, rule: DosingRule, kg: number, concentration?: Concentration): string {
  const tags = doseWarnings({ result, rule, weightKg: kg, concentration }).map(w => PREVIEW_TAGS[w.kind]);
  return tags.length ? ` (${tags.join(', ')})` : '';
}

function stamp(rule: DosingRule, uid: string): DosingRule {
  return { ...rule, id: rule.id || crypto.randomUUID(), updatedAt: Date.now(), updatedBy: uid };
}
