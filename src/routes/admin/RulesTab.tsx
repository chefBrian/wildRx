import { useEffect, useMemo, useState } from 'react';
import {
  listMedications, listSpecies, listDosingRulesForMed,
  upsertDosingRule, deleteDosingRule,
} from '../../firebase/repos';
import { TypeaheadSelect, type TypeaheadOption } from '../../components/TypeaheadSelect';
import { calculateDose } from '../../domain/dose';
import { useAuth } from '../../auth/AuthProvider';
import {
  formatGroup,
  type DosingRule, type Medication, type Species, type TaxonomicGroup,
  type Route as DoseRoute, type RuleTarget,
} from '../../domain/types';

const GROUPS: TaxonomicGroup[] = [
  'raptor', 'songbird', 'waterfowl', 'wadingBird', 'shorebird',
  'smallMammal', 'mediumMammal', 'largeMammal', 'reptile', 'amphibian', 'other',
];
const ROUTES: DoseRoute[] = ['PO', 'IM', 'SC', 'IV', 'topical'];

const blank = (medId: string, uid: string): DosingRule => ({
  id: '',
  medicationId: medId,
  target: { type: 'group', value: 'raptor' },
  mgPerKg: { min: 0, max: 0, typical: 0 },
  route: 'PO',
  frequency: 'q24h',
  durationDays: null,
  maxSingleDoseMg: null,
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
  const [sampleWeight, setSampleWeight] = useState(1000);

  useEffect(() => {
    listMedications().then(setMeds);
    listSpecies().then(setSpecies);
  }, []);

  useEffect(() => {
    if (medId) listDosingRulesForMed(medId).then(setRules);
    else setRules([]);
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

  function setTargetFromOption(optId: string) {
    if (!editing) return;
    const [type, value] = optId.split(':');
    const target: RuleTarget = type === 'group'
      ? { type: 'group', value: value as TaxonomicGroup }
      : { type: 'species', value };
    setEditing({ ...editing, target });
  }

  async function save() {
    if (!editing || !user) return;
    const toSave: DosingRule = {
      ...editing,
      id: editing.id || crypto.randomUUID(),
      updatedAt: Date.now(),
      updatedBy: user.uid,
    };
    await upsertDosingRule(toSave);
    setEditing(null);
    if (medId) setRules(await listDosingRulesForMed(medId));
  }

  async function del(id: string) {
    if (confirm('Delete rule?')) {
      await deleteDosingRule(id);
      if (medId) setRules(await listDosingRulesForMed(medId));
    }
  }

  function describeTarget(t: RuleTarget): string {
    if (t.type === 'group') return `Group: ${formatGroup(t.value)}`;
    const s = species.find(x => x.id === t.value);
    return `Species: ${s?.commonName ?? t.value}`;
  }

  const preview = editing ? calculateDose({ weightGrams: sampleWeight, rule: editing }) : null;

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
            <TypeaheadSelect
              options={targetOptions}
              onSelect={setTargetFromOption}
              placeholder="Type to search group or species…"
              requireQuery
            />
            <div className="mt-2 text-[13px] text-ink2 italic">
              Current: {describeTarget(editing.target)}
            </div>
          </div>

          {/* Dosing */}
          <div>
            <div className={sectionEyebrowCls}>Dosing (mg / kg)</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="r-min" className={eyebrowCls}>Min</label>
                <input id="r-min" type="number" step="0.01" className={numInputCls}
                  value={editing.mgPerKg.min}
                  onChange={e => setEditing({ ...editing, mgPerKg: { ...editing.mgPerKg, min: Number(e.target.value) } })} />
              </div>
              <div>
                <label htmlFor="r-typ" className={eyebrowCls}>Typical</label>
                <input id="r-typ" type="number" step="0.01" className={numInputCls}
                  value={editing.mgPerKg.typical}
                  onChange={e => setEditing({ ...editing, mgPerKg: { ...editing.mgPerKg, typical: Number(e.target.value) } })} />
              </div>
              <div>
                <label htmlFor="r-max" className={eyebrowCls}>Max</label>
                <input id="r-max" type="number" step="0.01" className={numInputCls}
                  value={editing.mgPerKg.max}
                  onChange={e => setEditing({ ...editing, mgPerKg: { ...editing.mgPerKg, max: Number(e.target.value) } })} />
              </div>
            </div>
          </div>

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
                <input id="r-freq" type="text" className={inputCls} value={editing.frequency}
                  onChange={e => setEditing({ ...editing, frequency: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Safety */}
          <div>
            <div className={sectionEyebrowCls}>Safety</div>
            <label htmlFor="r-cap" className={eyebrowCls}>Max single dose (mg, blank = none)</label>
            <input id="r-cap" type="number" step="0.01" className={numInputCls}
              value={editing.maxSingleDoseMg ?? ''}
              onChange={e => setEditing({ ...editing, maxSingleDoseMg: e.target.value === '' ? null : Number(e.target.value) })} />

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

          {/* Live preview */}
          <div className="bg-moss-50 rounded-md p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-moss-700 mb-2">Live preview</div>
            <label className="text-[13px] text-ink2 flex items-center gap-2">
              Sample weight (g)
              <input type="number" className="w-28 h-9 rounded-md border border-taupe bg-paper px-3 text-[14px] tabular-nums text-ink focus:border-moss-600 focus:outline-none transition-colors"
                value={sampleWeight}
                onChange={e => setSampleWeight(Number(e.target.value))} />
            </label>
            {preview && (
              <div className="mt-3 text-[14px] text-ink">
                Dose: <strong className="font-display tabular-nums text-[18px]" style={{ fontVariationSettings: '"opsz" 24' }}>
                  {preview.doseMg.typical.toFixed(2)} mg
                </strong>
                <span className="text-ink2 ml-2">(range {preview.doseMg.min.toFixed(2)}–{preview.doseMg.max.toFixed(2)})</span>
                {preview.cappedByMaxDose && <span className="ml-2 text-ember-700 uppercase tracking-[0.08em] text-[11px] font-medium">▲ Capped</span>}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={save}
              className="bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] h-10 px-5 rounded-md hover:bg-moss-700 transition-colors">
              Save
            </button>
            <button type="button" onClick={() => setEditing(null)}
              className="bg-surface text-ink2 border border-taupe font-sans text-[14px] h-10 px-5 rounded-md hover:bg-cream/50 transition-colors">
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

      {medId && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!user}
              onClick={() => user && setEditing(blank(medId, user.uid))}
              className="bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] h-11 px-5 rounded-md hover:bg-moss-700 disabled:opacity-50 transition-colors"
            >
              + Add rule
            </button>
          </div>

          {isNew && editPanel()}

          <ul className="space-y-2">
            {rules.map(r => {
              const isEditingThis = editing !== null && editing.id === r.id;
              if (isEditingThis) {
                return <li key={r.id}>{editPanel()}</li>;
              }
              return (
                <li key={r.id} className="bg-surface border border-taupe rounded-md p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-display text-[16px] text-ink leading-tight" style={{ fontVariationSettings: '"opsz" 24' }}>
                      {describeTarget(r.target)}
                    </div>
                    <div className="text-[13px] text-ink2 mt-1 flex items-center gap-2 flex-wrap">
                      <span className="tabular-nums">{r.mgPerKg.typical} mg/kg</span>
                      <span className="text-taupe2">·</span>
                      <span className="font-mono text-ink">{r.route}</span>
                      <span className="text-taupe2">·</span>
                      <span>{r.frequency}</span>
                    </div>
                  </div>
                  <div className="flex gap-4 shrink-0">
                    <button type="button" onClick={() => setEditing(r)} className="text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1">Edit</button>
                    <button type="button" onClick={() => del(r.id)} className="text-[12px] uppercase tracking-[0.1em] text-clay-700 underline underline-offset-4 decoration-1">Delete</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
