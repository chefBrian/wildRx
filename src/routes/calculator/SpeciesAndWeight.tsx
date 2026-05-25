import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listMedications, listSpecies } from '../../firebase/repos';
import { TypeaheadSelect, type TypeaheadOption } from '../../components/TypeaheadSelect';
import { WizardHeader } from '../../components/WizardHeader';
import { formatGroup, type Medication } from '../../domain/types';

export function SpeciesAndWeight() {
  const { medId = '' } = useParams();
  const [params] = useSearchParams();
  const [opts, setOpts] = useState<TypeaheadOption[]>([]);
  const [med, setMed] = useState<Medication | null>(null);
  const [speciesId, setSpeciesId] = useState<string | null>(params.get('species'));
  const [weight, setWeight] = useState<string>(params.get('weight') ?? '');
  const [concIdx, setConcIdx] = useState<number>(() => {
    const fromUrl = params.get('conc');
    const n = fromUrl === null ? 0 : Math.floor(Number(fromUrl));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const nav = useNavigate();

  useEffect(() => {
    listSpecies().then(species =>
      setOpts(
        species.map(s => ({
          id: s.id,
          label: s.commonName,
          sublabel: s.scientificName,
          badge: formatGroup(s.group),
          keywords: [s.commonName, s.scientificName, s.group, formatGroup(s.group)],
        }))
      )
    );
    listMedications().then(meds => setMed(meds.find(m => m.id === medId) ?? null));
  }, [medId]);

  useEffect(() => {
    if (med && med.concentrations.length > 0) {
      setConcIdx(i => Math.min(i, med.concentrations.length - 1));
    }
  }, [med]);

  const weightNum = Number(weight);
  const weightValid = Number.isFinite(weightNum) && weightNum > 0;

  function go() {
    if (speciesId && weightValid) {
      const concParam = med && med.concentrations.length > 1 ? `?conc=${concIdx}` : '';
      nav(`/calc/${medId}/${speciesId}/${weightNum}${concParam}`);
    }
  }

  const selectedOpt = speciesId ? opts.find(o => o.id === speciesId) : null;

  return (
    <main className="mx-auto max-w-md px-5 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <WizardHeader
        step={2}
        backTo="/"
        chips={med ? [{ label: med.name, sublabel: med.genericName, to: '/' }] : []}
      />

      <section className="pt-10">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Patient</div>
          <h1
            className="font-display text-[34px] font-semibold text-ink leading-tight"
            style={{ fontVariationSettings: '"opsz" 48, "SOFT" 30' }}
          >
            Species & weight
          </h1>
          <p className="text-[13px] italic text-ink2 max-w-[34ch]">
            Pick the species and enter weight in kg.
          </p>
        </div>

        <div className="mt-10 space-y-10">
          {!speciesId || !selectedOpt ? (
            <TypeaheadSelect
              options={opts}
              placeholder="Search species…"
              onSelect={setSpeciesId}
              previewCount={6}
            />
          ) : (
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Species</div>
              <div
                className="font-display text-[22px] text-ink mt-1"
                style={{ fontVariationSettings: '"opsz" 32' }}
              >
                {selectedOpt.label}
              </div>
              {selectedOpt.sublabel && (
                <div className="text-[13px] italic text-ink2 mt-0.5">{selectedOpt.sublabel}</div>
              )}
              <button
                type="button"
                onClick={() => setSpeciesId(null)}
                className="mt-3 min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
              >
                Change
              </button>
            </div>
          )}

          {med && med.concentrations.length > 1 && (
            <div>
              <label
                htmlFor="conc"
                className="block text-[11px] uppercase tracking-[0.14em] text-ink2 mb-2"
              >
                Concentration
              </label>
              <div className="relative">
                <select
                  id="conc"
                  value={concIdx}
                  onChange={e => setConcIdx(Number(e.target.value))}
                  className="w-full h-12 appearance-none bg-transparent border-b border-taupe py-2 pl-1 pr-7 font-sans text-[15px] text-ink focus:border-moss-600 focus:outline-none transition-colors"
                >
                  {med.concentrations.map((c, i) => (
                    <option key={i} value={i}>{c.label}</option>
                  ))}
                </select>
                <svg aria-hidden viewBox="0 0 12 8" className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-3 h-2 text-ink2">
                  <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="weight"
              className="block text-[11px] uppercase tracking-[0.14em] text-ink2 mb-2"
            >
              Weight{' '}
              <span className="lowercase tracking-normal italic text-ink2">(kg)</span>
            </label>
            <input
              id="weight"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.001"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="0"
              className="w-full h-14 border-0 border-b-2 border-taupe bg-transparent px-1 py-2 font-display tabular-nums text-[28px] text-ink placeholder:text-taupe2 focus:border-moss-600 focus:outline-none transition-colors duration-150"
              style={{ fontVariationSettings: '"opsz" 48' }}
            />
          </div>

          <button
            type="button"
            disabled={!speciesId || !weightValid}
            onClick={go}
            className="w-full h-14 bg-moss-600 text-paper font-display font-semibold text-[17px] tracking-[0.08em] uppercase rounded-md hover:bg-moss-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-600"
          >
            Calculate
          </button>
        </div>
      </section>
    </main>
  );
}
