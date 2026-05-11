import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMedications } from '../../firebase/repos';
import { TypeaheadSelect, type TypeaheadOption } from '../../components/TypeaheadSelect';

export function MedSearch() {
  const [opts, setOpts] = useState<TypeaheadOption[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    listMedications().then(meds =>
      setOpts(meds.map(m => ({
        id: m.id,
        label: m.name,
        sublabel: m.genericName,
        keywords: [m.name, m.genericName ?? ''],
      })))
    );
  }, []);

  return (
    <main className="mx-auto max-w-md px-5 pt-16 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <header className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Field calculator</div>
        <h1 className="font-display text-[34px] font-semibold text-ink leading-tight"
            style={{ fontVariationSettings: '"opsz" 48, "SOFT" 30' }}>
          wildRx
        </h1>
        <p className="text-[13px] italic text-ink2 max-w-[28ch]">
          Search by medication, then choose species and weight.
        </p>
      </header>
      <div className="mt-10">
        <TypeaheadSelect
          options={opts}
          placeholder="Search medications…"
          onSelect={id => nav(`/calc/${id}`)}
          previewCount={6}
        />
      </div>
    </main>
  );
}
