import { useMemo, useState, useRef, useEffect, useId } from 'react';
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
  /**
   * How many options to render when the query is empty.
   * - undefined (default): show all options (browse mode).
   * - 0: show none.
   * - N: show first N options as a preview.
   */
  previewCount?: number;
}

function badgeClasses(badge: string): string {
  const tone = badge.toLowerCase();
  if (tone === 'species') return 'bg-moss-50 text-moss-700';
  if (tone === 'group') return 'bg-ochre-50 text-ochre-700';
  return 'bg-cream text-ink2';
}

export function TypeaheadSelect({ options, onSelect, placeholder, initialQuery = '', previewCount }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const fuse = useMemo(
    () => new Fuse(options, { keys: ['label', 'sublabel', 'keywords'], threshold: 0.4 }),
    [options]
  );
  const queryIsEmpty = q.trim() === '';
  const results = useMemo(
    () => {
      if (queryIsEmpty) {
        if (previewCount === undefined) return options;
        return options.slice(0, previewCount);
      }
      return fuse.search(q).map(r => r.item);
    },
    [q, queryIsEmpty, options, fuse, previewCount]
  );
  const showPreviewHint = queryIsEmpty && previewCount !== undefined && previewCount < options.length;

  useEffect(() => { setActive(0); }, [q]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); onSelect(results[active].id); }
    else if (e.key === 'Escape' && q) { e.preventDefault(); setQ(''); }
  }

  const announce = queryIsEmpty
    ? ''
    : results.length === 0
      ? 'No results.'
      : `${results.length} result${results.length === 1 ? '' : 's'}.`;

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={results[active] ? optionId(active) : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full border-0 border-b-2 border-taupe bg-transparent pl-1 pr-9 py-4 text-[17px] font-sans text-ink placeholder:text-taupe2 placeholder:italic focus:border-moss-600 focus:outline-none transition-colors duration-150"
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); inputRef.current?.focus(); }}
            aria-label="Clear search"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-ink2 hover:text-ink rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-600"
          >
            <svg viewBox="0 0 16 16" aria-hidden className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M3 3l10 10M13 3 3 13" />
            </svg>
          </button>
        )}
      </div>
      <div aria-live="polite" className="sr-only">{announce}</div>
      <ul
        id={listId}
        role="listbox"
        className="mt-3 max-h-[60vh] overflow-y-auto"
      >
        {results.map((opt, i) => {
          const isActive = i === active;
          return (
            <li
              key={opt.id}
              id={optionId(i)}
              role="option"
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
        {showPreviewHint && (
          <li className="px-4 py-3 text-[12px] italic text-ink2 text-center" aria-hidden>
            Type to see more
          </li>
        )}
      </ul>
    </div>
  );
}
