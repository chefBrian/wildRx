import { useMemo, useState, useRef, useEffect } from 'react';
import Fuse from 'fuse.js';

export interface TypeaheadOption {
  id: string;
  label: string;
  sublabel?: string;
  keywords?: string[];
  badge?: string;
}

interface Props {
  options: TypeaheadOption[];
  onSelect: (id: string) => void;
  placeholder?: string;
  initialQuery?: string;
}

function badgeClasses(badge: string): string {
  const tone = badge.toLowerCase();
  if (tone === 'species') return 'bg-moss-50 text-moss-700';
  if (tone === 'group') return 'bg-ochre-50 text-ochre-700';
  return 'bg-cream text-ink2';
}

export function TypeaheadSelect({ options, onSelect, placeholder, initialQuery = '' }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(
    () => new Fuse(options, { keys: ['label', 'sublabel', 'keywords'], threshold: 0.4 }),
    [options]
  );
  const results = useMemo(
    () => (q.trim() === '' ? options : fuse.search(q).map(r => r.item)),
    [q, options, fuse]
  );

  useEffect(() => { setActive(0); }, [q]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { onSelect(results[active].id); }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full border-0 border-b-2 border-taupe bg-transparent px-1 py-4 text-[17px] font-sans text-ink placeholder:text-taupe2 placeholder:italic focus:border-moss-600 focus:outline-none transition-colors duration-150"
      />
      <ul className="mt-3 max-h-[60vh] overflow-y-auto">
        {results.map((opt, i) => {
          const isActive = i === active;
          return (
            <li
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              aria-selected={isActive}
              className={
                'group cursor-pointer border-b border-taupe/50 last:border-0 transition-all duration-100 min-h-[56px] flex items-start justify-between gap-3 py-4 ' +
                (isActive ? 'bg-cream border-l-[3px] border-l-moss-600 pl-[13px] pr-4' : 'px-4 hover:bg-cream/50')
              }
            >
              <div className="min-w-0">
                <div className="font-sans font-medium text-[17px] text-ink leading-snug">{opt.label}</div>
                {opt.sublabel && (
                  <div className="text-[13px] italic text-ink2 mt-0.5">{opt.sublabel}</div>
                )}
              </div>
              {opt.badge && (
                <span className={
                  'shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] ' +
                  badgeClasses(opt.badge)
                }>
                  {opt.badge}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
