import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminData } from './useAdminData';
import { LoadProblem } from './LoadProblem';
import { SpeciesEditor } from './SpeciesEditor';
import { GROUPS, formatGroup, type Species } from '../../../domain/types';

const blankSpecies: Species = {
  id: '', commonName: '', scientificName: '', group: 'raptor', typicalWeightKg: { min: 0, max: 0 },
};

export function AnimalsIndex() {
  const { data, error, reload } = useAdminData();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const nav = useNavigate();

  if (error) return <LoadProblem error={error} onRetry={reload} />;
  if (!data) return <div className="text-[14px] italic text-ink2">Loading…</div>;

  const q = query.trim().toLowerCase();
  const groups = GROUPS.map(group => {
    const all = data.species.filter(s => s.group === group).sort((a, b) => a.commonName.localeCompare(b.commonName));
    if (!q) return { group, list: all, show: true };
    const groupHit = formatGroup(group).toLowerCase().includes(q);
    const list = groupHit ? all : all.filter(s =>
      s.commonName.toLowerCase().includes(q) || s.scientificName.toLowerCase().includes(q));
    return { group, list, show: groupHit || list.length > 0 };
  }).filter(g => g.show);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <input
          type="search"
          aria-label="Filter animals"
          placeholder="Filter animals…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 h-11 rounded-md border border-taupe bg-paper px-3 text-[14px] text-ink focus:border-moss-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] h-11 px-5 rounded-md hover:bg-moss-700 transition-colors"
        >
          + Add species
        </button>
      </div>

      {adding && (
        <SpeciesEditor
          species={blankSpecies}
          allSpecies={data.species}
          meds={data.meds}
          rules={data.rules}
          onSaved={saved => nav(`/admin/animals/species/${encodeURIComponent(saved.id)}`)}
          onCancel={() => setAdding(false)}
        />
      )}

      {groups.map(({ group, list }) => (
        <section key={group}>
          <Link
            to={`/admin/animals/group/${group}`}
            className="font-display text-[18px] font-semibold text-ink underline-offset-4 hover:underline"
          >
            {formatGroup(group)}
          </Link>
          {list.length === 0 ? (
            <p className="mt-1 text-[13px] italic text-ink2">No species yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-taupe/50 border border-taupe rounded-md bg-surface">
              {list.map(s => (
                <li key={s.id}>
                  <Link to={`/admin/animals/species/${encodeURIComponent(s.id)}`} className="flex items-baseline gap-2 px-4 py-3 hover:bg-cream/50">
                    <span className="text-[15px] text-ink">{s.commonName}</span>
                    <span className="text-[12px] italic text-ink2">{s.scientificName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
