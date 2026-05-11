import { useEffect, useState } from 'react';
import { listSpecies, upsertSpecies, deleteSpecies } from '../../firebase/repos';
import type { Species, TaxonomicGroup } from '../../domain/types';

const GROUPS: TaxonomicGroup[] = [
  'raptor',
  'songbird',
  'waterfowl',
  'wadingBird',
  'shorebird',
  'smallMammal',
  'mediumMammal',
  'largeMammal',
  'reptile',
  'amphibian',
  'other',
];

const blank: Species = {
  id: '',
  commonName: '',
  scientificName: '',
  group: 'raptor',
  typicalWeightGrams: { min: 0, max: 0 },
};

export function SpeciesTab() {
  const [items, setItems] = useState<Species[]>([]);
  const [editing, setEditing] = useState<Species | null>(null);

  async function reload() {
    setItems(await listSpecies());
  }
  useEffect(() => {
    reload();
  }, []);

  async function save() {
    if (!editing) return;
    const toSave = editing.id ? editing : { ...editing, id: crypto.randomUUID() };
    await upsertSpecies(toSave);
    setEditing(null);
    await reload();
  }

  async function del(id: string) {
    if (confirm('Delete species?')) {
      await deleteSpecies(id);
      await reload();
    }
  }

  function editPanel() {
    if (!editing) return null;
    return (
      <div className="bg-surface border border-taupe rounded-md p-5 space-y-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">
          {editing.id ? 'Edit species' : 'New species'}
        </div>

        <div>
          <label
            htmlFor="sp-common"
            className="text-[11px] uppercase tracking-[0.14em] text-ink2 mb-1.5 block"
          >
            Common name
          </label>
          <input
            id="sp-common"
            type="text"
            value={editing.commonName}
            onChange={e => setEditing({ ...editing, commonName: e.target.value })}
            className="w-full h-10 rounded-md border border-taupe bg-paper px-3 text-[14px] text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="sp-sci"
            className="text-[11px] uppercase tracking-[0.14em] text-ink2 mb-1.5 block"
          >
            Scientific name
          </label>
          <input
            id="sp-sci"
            type="text"
            value={editing.scientificName}
            onChange={e => setEditing({ ...editing, scientificName: e.target.value })}
            className="w-full h-10 rounded-md border border-taupe bg-paper px-3 text-[14px] italic text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="sp-group"
            className="text-[11px] uppercase tracking-[0.14em] text-ink2 mb-1.5 block"
          >
            Group
          </label>
          <select
            id="sp-group"
            value={editing.group}
            onChange={e => setEditing({ ...editing, group: e.target.value as TaxonomicGroup })}
            className="w-full h-10 rounded-md border border-taupe bg-paper px-3 text-[14px] text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors"
          >
            {GROUPS.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="sp-min"
              className="text-[11px] uppercase tracking-[0.14em] text-ink2 mb-1.5 block"
            >
              Min weight (g)
            </label>
            <input
              id="sp-min"
              type="number"
              value={editing.typicalWeightGrams.min}
              onChange={e =>
                setEditing({
                  ...editing,
                  typicalWeightGrams: {
                    ...editing.typicalWeightGrams,
                    min: Number(e.target.value),
                  },
                })
              }
              className="w-full h-10 rounded-md border border-taupe bg-paper px-3 text-[14px] tabular-nums text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="sp-max"
              className="text-[11px] uppercase tracking-[0.14em] text-ink2 mb-1.5 block"
            >
              Max weight (g)
            </label>
            <input
              id="sp-max"
              type="number"
              value={editing.typicalWeightGrams.max}
              onChange={e =>
                setEditing({
                  ...editing,
                  typicalWeightGrams: {
                    ...editing.typicalWeightGrams,
                    max: Number(e.target.value),
                  },
                })
              }
              className="w-full h-10 rounded-md border border-taupe bg-paper px-3 text-[14px] tabular-nums text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="sp-notes"
            className="text-[11px] uppercase tracking-[0.14em] text-ink2 mb-1.5 block"
          >
            Notes
          </label>
          <textarea
            id="sp-notes"
            value={editing.notes ?? ''}
            onChange={e => setEditing({ ...editing, notes: e.target.value })}
            className="w-full min-h-[80px] py-2 rounded-md border border-taupe bg-paper px-3 text-[14px] text-ink focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/20 transition-colors"
          />
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
    );
  }

  const isNew = editing !== null && !editing.id;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing(blank)}
          className="bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] h-11 px-5 rounded-md hover:bg-moss-700 transition-colors"
        >
          + Add species
        </button>
      </div>

      {isNew && editPanel()}

      <ul className="space-y-2">
        {items.map(s => {
          const isEditingThis = editing !== null && editing.id === s.id;
          if (isEditingThis) {
            return <li key={s.id}>{editPanel()}</li>;
          }
          return (
            <li
              key={s.id}
              className="bg-surface border border-taupe rounded-md p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div
                    className="font-display text-[18px] text-ink leading-tight"
                    style={{ fontVariationSettings: '"opsz" 24' }}
                  >
                    {s.commonName}
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-moss-50 text-moss-700 text-[11px] font-medium uppercase tracking-[0.08em]">
                    {s.group}
                  </span>
                </div>
                <div className="text-[13px] italic text-ink2 mt-0.5">{s.scientificName}</div>
              </div>
              <div className="flex gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => del(s.id)}
                  className="text-[12px] uppercase tracking-[0.1em] text-clay-700 underline underline-offset-4 decoration-1"
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
