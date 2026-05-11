import { useEffect, useState } from 'react';
import { listMedications, upsertMedication, deleteMedication } from '../../firebase/repos';
import type { Medication, Concentration } from '../../domain/types';

const blank: Medication = { id: '', name: '', concentrations: [] };

export function MedsTab() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [editing, setEditing] = useState<Medication | null>(null);

  async function reload() {
    setMeds(await listMedications());
  }
  useEffect(() => {
    reload();
  }, []);

  async function save() {
    if (!editing) return;
    const toSave = editing.id ? editing : { ...editing, id: crypto.randomUUID() };
    await upsertMedication(toSave);
    setEditing(null);
    await reload();
  }

  async function del(id: string) {
    if (confirm('Delete medication?')) {
      await deleteMedication(id);
      await reload();
    }
  }

  function updateConc(i: number, patch: Partial<Concentration>) {
    if (!editing) return;
    const next = [...editing.concentrations];
    next[i] = { ...next[i], ...patch };
    setEditing({ ...editing, concentrations: next });
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing(blank)}
          className="bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] h-11 px-5 rounded-md hover:bg-moss-700 transition-colors"
        >
          + Add medication
        </button>
      </div>

      <ul className="space-y-2">
        {meds.map(m => (
          <li
            key={m.id}
            className="bg-surface border border-taupe rounded-md p-4 flex items-center justify-between gap-4 hover:bg-cream/40 transition-colors"
          >
            <div className="min-w-0">
              <div
                className="font-display text-[18px] text-ink leading-tight"
                style={{ fontVariationSettings: '"opsz" 24' }}
              >
                {m.name}
              </div>
              {m.genericName && (
                <div className="text-[13px] italic text-ink2 mt-0.5">{m.genericName}</div>
              )}
            </div>
            <div className="flex gap-4 shrink-0">
              <button
                type="button"
                onClick={() => setEditing(m)}
                className="text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => del(m.id)}
                className="text-[12px] uppercase tracking-[0.1em] text-clay-700 underline underline-offset-4 decoration-1"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <div className="bg-surface border border-taupe rounded-md p-5 space-y-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">
            {editing.id ? 'Edit medication' : 'New medication'}
          </div>

          <div>
            <label
              htmlFor="med-name"
              className="text-[11px] uppercase tracking-[0.14em] text-ink2 mb-1.5 block"
            >
              Name
            </label>
            <input
              id="med-name"
              type="text"
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              className="w-full h-10 rounded-md border border-taupe bg-paper px-3 text-[14px] text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="med-generic"
              className="text-[11px] uppercase tracking-[0.14em] text-ink2 mb-1.5 block"
            >
              Generic
            </label>
            <input
              id="med-generic"
              type="text"
              value={editing.genericName ?? ''}
              onChange={e => setEditing({ ...editing, genericName: e.target.value })}
              className="w-full h-10 rounded-md border border-taupe bg-paper px-3 text-[14px] text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors"
            />
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink2 mb-2">
              Concentrations
            </div>
            <div className="space-y-2">
              {editing.concentrations.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="label (e.g. 1.5 mg/ml)"
                    value={c.label}
                    onChange={e => updateConc(i, { label: e.target.value })}
                    className="flex-1 h-10 rounded-md border border-taupe bg-paper px-3 text-[14px] text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors"
                  />
                  <input
                    type="number"
                    placeholder="mg/ml"
                    step="0.01"
                    value={c.mgPerMl}
                    onChange={e => updateConc(i, { mgPerMl: Number(e.target.value) })}
                    className="w-28 h-10 rounded-md border border-taupe bg-paper px-3 text-[14px] tabular-nums text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setEditing({
                  ...editing,
                  concentrations: [...editing.concentrations, { label: '', mgPerMl: 0 }],
                })
              }
              className="mt-2 text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
            >
              + Add concentration
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={save}
              className="bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] h-10 px-5 rounded-md hover:bg-moss-700 transition-colors"
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
      )}
    </div>
  );
}
