import { useState } from 'react';
import {
  createDosingRule, rekeyDosingRule, upsertDosingRule, RuleExistsError,
} from '../../../firebase/repos';
import { calculateDose, type DoseResult } from '../../../domain/dose';
import { formatNumber } from '../../../domain/format';
import { normalizeRuleRange, validateRule } from '../../../domain/validate';
import { targetWeightRange } from '../../../domain/targetWeights';
import { doseWarnings, type DoseWarning } from '../../../domain/warnings';
import { FREQUENCY_OPTIONS, isCanonicalFrequency } from '../../../domain/frequency';
import { bottleAllowsRoute } from '../../../domain/concentrations';
import { ROUTES } from '../../../domain/doseRoutes';
import { ruleId } from '../../../domain/ruleId';
import { overrideImpact } from '../../../domain/ruleImpact';
import { NumberField } from '../../../components/NumberField';
import { useAuth } from '../../../auth/AuthProvider';
import { actionFailed } from '../actionFailed';
import {
  formatGroup,
  type Concentration, type DoseUnit, type DosingRule, type Medication, type Species,
  type Route as DoseRoute, type RuleTarget,
} from '../../../domain/types';

type DoseField = 'min' | 'typical' | 'max';
const PREVIEW_TAGS: Record<DoseWarning['kind'], string> = {
  cap: 'capped',
  unmeasurable: 'too small to measure',
};

const inputCls = 'w-full h-10 rounded-md border border-taupe bg-paper px-3 text-[14px] text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors';
const numInputCls = inputCls + ' tabular-nums';
const selectCls = inputCls + ' pr-9';
const textareaCls = 'w-full min-h-[80px] py-2 rounded-md border border-taupe bg-paper px-3 text-[14px] text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors';
const eyebrowCls = 'text-[11px] uppercase tracking-[0.14em] text-ink2 mb-1.5 block';
const sectionEyebrowCls = 'text-[11px] uppercase tracking-[0.14em] text-ink2 mt-2 mb-2 block';

export interface RuleEditorProps {
  /** id '' = new rule. */
  rule: DosingRule;
  meds: Medication[];
  species: Species[];
  /** Every rule, for the duplicate and override checks. */
  allRules: DosingRule[];
  /** New rules only: the targets this page allows; the rule's target is the default. */
  targetChoices: RuleTarget[];
  onSaved: () => void;
  onCancel: () => void;
  /** Another tab or admin created this rule meanwhile - refetch so the duplicate check sees it. */
  onReload: () => void;
}

export function RuleEditor({ rule, meds, species, allRules, targetChoices, onSaved, onCancel, onReload }: RuleEditorProps) {
  const { user } = useAuth();
  const [editing, setDraft] = useState<DosingRule>(rule);
  const [badFields, setBadFields] = useState<Partial<Record<DoseField, boolean>>>({});
  const [sampleWeight, setSampleWeight] = useState(1);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNew = !rule.id;
  const med = meds.find(m => m.id === editing.medicationId);
  const unit = med?.doseUnit ?? 'mg';
  // freqMode is derived: an empty or non-canonical token = custom; otherwise preset.
  const freqMode: 'preset' | 'custom' =
    editing.frequency && isCanonicalFrequency(editing.frequency) ? 'preset' : 'custom';
  const normalized = normalizeRuleRange(editing);
  const nextId = ruleId(editing.medicationId, editing.target, editing.route);
  // Compare by fields, not stored id, so legacy-id docs count as duplicates too.
  const duplicate = allRules.some(r => r.id !== rule.id && ruleId(r.medicationId, r.target, r.route) === nextId);
  const ruleErrors: Record<string, string> = { ...validateRule(normalized), ...plainNumberErrors(badFields) };
  if (duplicate || conflict) {
    ruleErrors.duplicate = `${med?.name ?? editing.medicationId} / ${targetLabel(editing.target, species)}: a rule for ${editing.route} already exists - edit that one instead.`;
  }
  const hides = isNew ? overrideImpact({ rule: editing, rules: allRules, species }) : null;
  const canSave = !!user && !!med && !saving && Object.keys(ruleErrors).length === 0;

  // Any edit clears a stale "created elsewhere" conflict; the duplicate check takes over after reload.
  function setEditing(next: DosingRule) {
    setDraft(next);
    setConflict(false);
  }

  // Doses typed for one unit must not be silently reinterpreted in another.
  function changeMed(medicationId: string) {
    const nextUnit = meds.find(m => m.id === medicationId)?.doseUnit ?? 'mg';
    if (nextUnit === unit) {
      setEditing({ ...editing, medicationId });
      return;
    }
    setEditing({ ...editing, medicationId, dosePerKg: { min: NaN, typical: NaN, max: NaN }, maxSingleDose: null });
    setBadFields({});
  }

  function setDoseField(field: DoseField, v: number | null) {
    setEditing({ ...editing, dosePerKg: { ...editing.dosePerKg, [field]: v ?? NaN } });
    setBadFields({ ...badFields, [field]: v !== null && Number.isNaN(v) });
  }

  async function save() {
    if (!canSave || !user) return;
    const toSave = stamped(normalized, nextId, user.uid);
    setSaving(true);
    setSaveError(null);
    try {
      if (isNew) await createDosingRule(toSave);
      else if (rule.id === nextId) await upsertDosingRule(toSave);
      else await rekeyDosingRule(rule.id, toSave);
    } catch (err) {
      setSaving(false);
      if (err instanceof RuleExistsError) {
        setConflict(true);
        onReload();
      } else {
        // e.g. permission-denied after the rules deploy: say so, don't look like nothing happened.
        setSaveError(actionFailed('Save', err));
      }
      return;
    }
    // Stays disabled: the page closes the editor.
    onSaved();
  }

  function livePreview() {
    if (!med) return null;
    const range = targetWeightRange(normalized.target, species);
    const weights = range ? [...new Set([range.min, range.max])] : [sampleWeight];
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

  return (
    <div className="bg-surface border border-taupe rounded-md p-5 space-y-5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">
        {isNew ? 'New rule' : 'Edit rule'}
      </div>

      {/* Medication */}
      <div>
        {isNew ? (
          <>
            <label htmlFor="r-med" className={sectionEyebrowCls}>Medication</label>
            <select id="r-med" className={selectCls} value={editing.medicationId}
              onChange={e => changeMed(e.target.value)}>
              {meds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </>
        ) : (
          <>
            <div className={sectionEyebrowCls}>Medication</div>
            <div className="text-[15px] text-ink font-medium">{med?.name ?? editing.medicationId}</div>
          </>
        )}
      </div>

      {/* Target */}
      <div>
        {isNew && targetChoices.length > 1 ? (
          <>
            <label htmlFor="r-target" className={sectionEyebrowCls}>Applies to</label>
            <select id="r-target" className={selectCls} value={targetKey(editing.target)}
              onChange={e => {
                const next = targetChoices.find(t => targetKey(t) === e.target.value);
                if (next) setEditing({ ...editing, target: next });
              }}>
              {targetChoices.map(t => (
                <option key={targetKey(t)} value={targetKey(t)}>{targetLabel(t, species)}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            <div className={sectionEyebrowCls}>Applies to</div>
            <div className="text-[15px] text-ink font-medium">{targetLabel(editing.target, species)}</div>
          </>
        )}
        {!isNew && (
          <div className="mt-1 text-[12px] italic text-ink2">
            Target is fixed once a rule is created. To target a different group or species, delete this rule and add a new one.
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
              onValueChange={v => setDoseField('min', v)} />
            {ruleErrors.min && <div className="mt-1 text-[12px] text-clay-700">{ruleErrors.min}</div>}
          </div>
          <div>
            <label htmlFor="r-typ" className={eyebrowCls}>Typical</label>
            <NumberField id="r-typ" className={numInputCls}
              value={editing.dosePerKg.typical}
              onValueChange={v => setDoseField('typical', v)} />
            {ruleErrors.typical && <div className="mt-1 text-[12px] text-clay-700">{ruleErrors.typical}</div>}
          </div>
          <div>
            <label htmlFor="r-max" className={eyebrowCls}>Max</label>
            <NumberField id="r-max" className={numInputCls} placeholder="= typical"
              value={editing.dosePerKg.max}
              onValueChange={v => setDoseField('max', v)} />
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
            <select id="r-route" className={selectCls} value={editing.route}
              onChange={e => setEditing({ ...editing, route: e.target.value as DoseRoute })}>
              {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="r-freq" className={eyebrowCls}>Frequency</label>
            {freqMode === 'preset' ? (
              <select
                id="r-freq"
                className={selectCls}
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

      {hides && (
        <div role="status" className="bg-ochre-50 border-l-4 border-ochre-600 px-4 py-3 text-[13px] text-ink">{hides}</div>
      )}
      {ruleErrors.duplicate && (
        <div role="alert" className="text-[13px] text-clay-700">{ruleErrors.duplicate}</div>
      )}
      {saveError && (
        <div role="alert" className="text-[13px] text-clay-700">{saveError}</div>
      )}

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={save} disabled={!canSave}
          className="bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] h-11 px-5 rounded-md hover:bg-moss-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Save
        </button>
        <button type="button" onClick={onCancel} disabled={saving}
          className="bg-surface text-ink2 border border-taupe font-sans text-[14px] h-11 px-5 rounded-md hover:bg-cream/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Cancel
        </button>
      </div>
    </div>
  );
}

function stamped(rule: DosingRule, id: string, uid: string): DosingRule {
  return { ...rule, id, updatedAt: Date.now(), updatedBy: uid };
}

function targetKey(t: RuleTarget): string {
  return `${t.type}:${t.value}`;
}

function targetLabel(t: RuleTarget, species: Species[]): string {
  if (t.type === 'group') return `${formatGroup(t.value)} (group)`;
  return species.find(s => s.id === t.value)?.commonName ?? t.value;
}

function previewLine(rule: DosingRule, unit: DoseUnit, concentrations: Concentration[], kg: number): string {
  const head = `${formatNumber(kg)} kg: `;
  const base = calculateDose({ weightKg: kg, rule, doseUnit: unit });
  if (unit === 'ml' || concentrations.length === 0) {
    return `${head}${formatNumber(base.dose.typical)} ${unit}${tagsFor(base, rule, kg)}`;
  }
  const volumes = concentrations.map(c => {
    if (!bottleAllowsRoute(c, rule.route)) return `not for ${rule.route} @ ${formatNumber(c.value)} ${unit}/ml`;
    const r = calculateDose({ weightKg: kg, rule, doseUnit: unit, concentration: c });
    return `${formatNumber(r.volumeMl?.typical ?? NaN)} ml @ ${formatNumber(c.value)} ${unit}/ml${tagsFor(r, rule, kg)}`;
  });
  return `${head}${formatNumber(base.dose.typical)} ${unit} = ${volumes.join(', ')}`;
}

function tagsFor(result: DoseResult, rule: DosingRule, kg: number): string {
  const tags = doseWarnings({ result, rule, weightKg: kg }).map(w => PREVIEW_TAGS[w.kind]);
  return tags.length ? ` (${tags.join(', ')})` : '';
}

function plainNumberErrors(bad: Partial<Record<DoseField, boolean>>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ['min', 'typical', 'max'] as const) {
    if (bad[field]) errors[field] = 'Enter a plain number.';
  }
  return errors;
}
