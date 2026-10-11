import { useEffect, useRef, useState } from 'react';
import {
  listMedications, listDosingRulesForMed, upsertMedication, deleteMedication,
} from '../../firebase/repos';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { NumberField } from '../../components/NumberField';
import { formatUnitBadge } from '../../domain/format';
import {
  validateMedication, toMedication,
  type ConcentrationDraft, type MedicationDraft,
} from '../../domain/validate';
import {
  CONCENTRATION_FORMS, DOSE_UNITS,
  type DoseUnit, type Medication,
} from '../../domain/types';

const blank: MedicationDraft = { id: '', name: '', doseUnit: null, concentrations: [] };

const UNIT_LABELS: Record<DoseUnit, string> = {
  mg: 'mg (mg/kg, mg/ml)',
  IU: 'IU (IU/kg, IU/ml)',
  ml: 'ml (ml/kg, no concentration)',
};

const inputCls = 'h-10 rounded-md border border-taupe bg-paper px-3 text-[14px] text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors';
const eyebrowCls = 'text-[11px] uppercase tracking-[0.14em] text-ink2 mb-1.5 block';
const errorCls = 'mt-1 text-[12px] text-clay-700';

export function MedsTab() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [editing, setEditing] = useState<MedicationDraft | null>(null);
  // null = still counting. The unit select stays locked until the count says 0.
  const [ruleCount, setRuleCount] = useState<number | null>(0);
  const countingFor = useRef<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Medication | null>(null);

  async function reload() {
    setMeds(await listMedications());
  }
  useEffect(() => {
    reload();
  }, []);

  async function startEdit(m: Medication | null) {
    setEditing(m ?? blank);
    countingFor.current = m?.id ?? null;
    if (!m) {
      setRuleCount(0);
      return;
    }
    setRuleCount(null);
    try {
      const n = (await listDosingRulesForMed(m.id)).length;
      // Ignore a late answer for a med the admin already navigated away from.
      if (countingFor.current === m.id) setRuleCount(n);
    } catch {
      // Unknown count (e.g. old-shape rules) - leave the unit locked.
    }
  }

  async function save() {
    if (!editing || Object.keys(validateMedication(editing)).length > 0) return;
    const med = toMedication(editing);
    await upsertMedication(med.id ? med : { ...med, id: crypto.randomUUID() });
    setEditing(null);
    await reload();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteMedication(pendingDelete.id);
    setPendingDelete(null);
    await reload();
  }

  function updateConc(i: number, patch: Partial<ConcentrationDraft>) {
    if (!editing) return;
    const next = [...editing.concentrations];
    next[i] = { ...next[i], ...patch };
    setEditing({ ...editing, concentrations: next });
  }

  function setUnit(unit: DoseUnit | null) {
    if (!editing) return;
    // ml meds have no concentrations; clear them so nothing hidden blocks Save.
    setEditing({
      ...editing,
      doseUnit: unit,
      concentrations: unit === 'ml' ? [] : editing.concentrations,
    });
  }

  function editPanel() {
    if (!editing) return null;
    const errors = validateMedication(editing);
    return (
      <div className="bg-surface border border-taupe rounded-md p-5 space-y-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">
          {editing.id ? 'Edit medication' : 'New medication'}
        </div>

        <div>
          <label htmlFor="med-name" className={eyebrowCls}>
            Name
          </label>
          <input
            id="med-name"
            type="text"
            value={editing.name}
            onChange={e => setEditing({ ...editing, name: e.target.value })}
            className={inputCls + ' w-full'}
          />
          {errors.name && <div className={errorCls}>{errors.name}</div>}
        </div>

        <div>
          <label htmlFor="med-generic" className={eyebrowCls}>
            Generic
          </label>
          <input
            id="med-generic"
            type="text"
            value={editing.genericName ?? ''}
            onChange={e => setEditing({ ...editing, genericName: e.target.value })}
            className={inputCls + ' w-full'}
          />
        </div>

        <div>
          <label htmlFor="med-unit" className={eyebrowCls}>Dosed in</label>
          <select
            id="med-unit"
            className={inputCls + ' w-full'}
            value={editing.doseUnit ?? ''}
            disabled={ruleCount !== 0}
            onChange={e => setUnit(e.target.value === '' ? null : (e.target.value as DoseUnit))}
          >
            <option value="">— choose —</option>
            {DOSE_UNITS.map(u => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
          </select>
          {ruleCount === null && (
            <div className="mt-1 text-[12px] italic text-ink2">Checking rules…</div>
          )}
          {ruleCount !== null && ruleCount > 0 && (
            <div className="mt-1 text-[12px] italic text-ink2">
              {ruleCount} {ruleCount === 1 ? 'rule uses' : 'rules use'} this unit - delete them to change it.
            </div>
          )}
          {errors.doseUnit && <div className={errorCls}>{errors.doseUnit}</div>}
        </div>

        {editing.doseUnit === 'ml' && (
          <div>
            <label htmlFor="med-product" className={eyebrowCls}>Product</label>
            <input
              id="med-product"
              type="text"
              className={inputCls + ' w-full'}
              placeholder="e.g. Pepto-Bismol Original (17.5 mg/ml bismuth subsalicylate)"
              value={editing.productDescription ?? ''}
              onChange={e => setEditing({ ...editing, productDescription: e.target.value })}
            />
            <p className="mt-1 text-[12px] italic text-ink2">
              Name the exact product and strength - the same ml/kg is only safe for one formulation.
            </p>
            {errors.productDescription && <div className={errorCls}>{errors.productDescription}</div>}
          </div>
        )}

        {(editing.doseUnit === 'mg' || editing.doseUnit === 'IU') && (
          <div>
            <div className={eyebrowCls}>Concentrations</div>
            <p className="text-[12px] italic text-ink2 mb-3 max-w-prose">
              One row per product on the shelf. Strength goes in the number field.
              Use the note for brand, dilution or route limits - e.g. "Baytril",
              "in-house dilution", "IM/SC only - never IV". "Injectable" alone
              does not mean safe to give IV.
            </p>
            <div className="space-y-3">
              {editing.concentrations.map((c, i) => (
                <div key={c.id}>
                  <div className="flex gap-2 items-center flex-wrap">
                    <NumberField
                      aria-label={`Concentration ${i + 1} strength`}
                      value={c.value}
                      onValueChange={v => updateConc(i, { value: v ?? NaN })}
                      className={inputCls + ' w-28 tabular-nums'}
                    />
                    <span className="text-[13px] text-ink2 w-14">{editing.doseUnit}/ml</span>
                    <select
                      aria-label={`Concentration ${i + 1} form`}
                      value={c.form}
                      onChange={e => updateConc(i, { form: e.target.value as ConcentrationDraft['form'] })}
                      className={inputCls + ' w-36'}
                    >
                      <option value="">— form —</option>
                      {CONCENTRATION_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <input
                      type="text"
                      aria-label={`Concentration ${i + 1} note`}
                      placeholder="Note (optional)"
                      value={c.note ?? ''}
                      onChange={e => updateConc(i, { note: e.target.value })}
                      className={inputCls + ' flex-1 min-w-[10rem]'}
                    />
                    <button
                      type="button"
                      onClick={() => setEditing({
                        ...editing,
                        concentrations: editing.concentrations.filter((_, j) => j !== i),
                      })}
                      aria-label="Remove concentration"
                      className="w-8 h-10 text-ink2 hover:text-clay-700 transition-colors text-[18px] leading-none"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                  {(['value', 'form', 'note'] as const).map(f =>
                    errors[`conc.${i}.${f}`] ? <div key={f} className={errorCls}>{errors[`conc.${i}.${f}`]}</div> : null
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEditing({
                ...editing,
                concentrations: [...editing.concentrations, { id: crypto.randomUUID().slice(0, 8), value: NaN, form: '' }],
              })}
              className="mt-2 text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
            >
              + Add concentration
            </button>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={Object.keys(errors).length > 0}
            className="bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] h-10 px-5 rounded-md hover:bg-moss-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="bg-surface text-ink2 border border-taupe font-sans text-[14px] h-10 px-5 rounded-md hover:bg-cream/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const isNew = editing !== null && !editing.id;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => startEdit(null)}
          className="bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] h-11 px-5 rounded-md hover:bg-moss-700 transition-colors"
        >
          + Add medication
        </button>
      </div>

      {isNew && editPanel()}

      {meds.length === 0 && !isNew && (
        <div className="bg-cream/60 border border-taupe/60 rounded-md px-5 py-8 text-center text-[14px] text-ink2">
          No medications yet. Tap <span className="text-ink font-medium">+ Add medication</span> to get started.
        </div>
      )}

      <ul className="space-y-2">
        {meds.map(m => {
          const isEditingThis = editing !== null && editing.id === m.id;
          if (isEditingThis) {
            return <li key={m.id}>{editPanel()}</li>;
          }
          return (
            <li
              key={m.id}
              className="bg-surface border border-taupe rounded-md p-4 flex items-center justify-between gap-6 hover:bg-cream/40 transition-colors"
            >
              <div className="min-w-0">
                <div
                  className="font-display text-[18px] text-ink leading-tight"
                  style={{ fontVariationSettings: '"opsz" 24' }}
                >
                  {m.name}
                  <span className="ml-2 align-middle inline-flex items-center px-2 py-0.5 rounded-md bg-cream text-ink2 text-[11px] font-medium tracking-[0.04em]">
                    {formatUnitBadge(m.doseUnit)}
                  </span>
                </div>
                {m.genericName && (
                  <div className="text-[13px] italic text-ink2 mt-0.5">{m.genericName}</div>
                )}
              </div>
              <div className="flex gap-6 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(m)}
                  className="min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(m)}
                  className="min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-clay-700 underline underline-offset-4 decoration-1"
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this medication?"
        message={pendingDelete ? `${pendingDelete.name} and any associated dosing rules will need to be cleaned up. This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
