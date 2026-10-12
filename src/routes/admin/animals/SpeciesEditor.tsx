import { useState } from 'react';
import { upsertSpecies } from '../../../firebase/repos';
import { slugify } from '../../../domain/slug';
import { groupChangeImpact } from '../../../domain/ruleImpact';
import { actionFailed } from '../actionFailed';
import {
  GROUPS, formatGroup,
  type DosingRule, type Medication, type Species, type TaxonomicGroup,
} from '../../../domain/types';

interface Props {
  /** id '' = new species. */
  species: Species;
  allSpecies: Species[];
  /** For the group-change and orphaned-rule warnings. */
  meds: Medication[];
  rules: DosingRule[];
  onSaved: (saved: Species) => void;
  onCancel: () => void;
}

export function SpeciesEditor({ species, allSpecies, meds, rules, onSaved, onCancel }: Props) {
  const [editing, setEditing] = useState<Species>(species);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isNew = !species.id;
  // New species get a readable, stable id (matches the seed); it never changes after creation.
  const id = isNew ? slugify(editing.commonName) : species.id;
  const error = !editing.commonName.trim() || !id
    ? 'Enter a common name.'
    : isNew && allSpecies.some(s => s.id === id)
      ? `A species with id ${id} already exists.`
      : null;
  // Rules left behind by a deleted species with the same id would silently apply again.
  const orphans = isNew && id ? rules.filter(r => r.target.type === 'species' && r.target.value === id) : [];
  const groupImpact = isNew ? null : groupChangeImpact({ species, newGroup: editing.group, meds, rules });

  async function save() {
    if (error || saving) return;
    const toSave = { ...editing, id };
    setSaving(true);
    setSaveError(null);
    try {
      await upsertSpecies(toSave);
    } catch (err) {
      setSaving(false);
      setSaveError(actionFailed('Save', err));
      return;
    }
    onSaved(toSave);
  }

  return (
    <div className="bg-surface border border-taupe rounded-md p-5 space-y-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">
        {isNew ? 'New species' : 'Edit species'}
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
      {isNew && id && <div className="text-[12px] text-ink2 font-mono">Id: {id}</div>}

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
              {formatGroup(g)}
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
            Min weight (kg)
          </label>
          <input
            id="sp-min"
            type="number"
            step="0.001"
            value={editing.typicalWeightKg.min}
            onChange={e =>
              setEditing({
                ...editing,
                typicalWeightKg: {
                  ...editing.typicalWeightKg,
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
            Max weight (kg)
          </label>
          <input
            id="sp-max"
            type="number"
            step="0.001"
            value={editing.typicalWeightKg.max}
            onChange={e =>
              setEditing({
                ...editing,
                typicalWeightKg: {
                  ...editing.typicalWeightKg,
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

      {orphans.length > 0 && (
        <div role="status" className="bg-ochre-50 border-l-4 border-ochre-600 px-4 py-3 text-[13px] text-ink">
          {orphans.length === 1
            ? `1 existing rule already targets ${id} and will apply to this species.`
            : `${orphans.length} existing rules already target ${id} and will apply to this species.`}
        </div>
      )}
      {groupImpact && (
        <div role="status" className="bg-ochre-50 border-l-4 border-ochre-600 px-4 py-3 text-[13px] text-ink">{groupImpact}</div>
      )}
      {error && editing.commonName.trim() !== '' && (
        <div role="alert" className="text-[13px] text-clay-700">{error}</div>
      )}
      {saveError && <div role="alert" className="text-[13px] text-clay-700">{saveError}</div>}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={!!error || saving}
          className="bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] h-10 px-5 rounded-md hover:bg-moss-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="bg-surface text-ink2 border border-taupe font-sans text-[14px] h-10 px-5 rounded-md hover:bg-cream/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
