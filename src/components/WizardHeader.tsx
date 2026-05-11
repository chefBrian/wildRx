import { Link } from 'react-router-dom';

export interface WizardChip {
  label: string;
  sublabel?: string;
  to?: string;
}

interface Props {
  step: 1 | 2 | 3;
  backTo?: string;
  chips?: WizardChip[];
}

export function WizardHeader({ step, backTo, chips = [] }: Props) {
  return (
    <header className="-mx-5 px-5 pt-4 pb-4 border-b border-taupe/60 bg-paper/95 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center justify-between gap-3">
        {backTo ? (
          <Link
            to={backTo}
            aria-label="Back"
            className="text-[12px] uppercase tracking-[0.1em] text-moss-700 inline-flex items-center gap-1.5 -ml-1 px-2 py-1 rounded-md hover:bg-cream/60 transition-colors"
          >
            <span aria-hidden className="text-[14px] leading-none">←</span>
            Back
          </Link>
        ) : (
          <span />
        )}
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">
          Step {step} of 3
        </div>
      </div>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((chip, i) =>
            chip.to ? (
              <Link
                key={i}
                to={chip.to}
                className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md bg-cream text-ink text-[13px] hover:bg-moss-50 transition-colors"
              >
                <span className="font-medium">{chip.label}</span>
                {chip.sublabel && (
                  <span className="text-[11px] italic text-ink2">{chip.sublabel}</span>
                )}
              </Link>
            ) : (
              <span
                key={i}
                className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md bg-cream text-ink2 text-[13px]"
              >
                <span className="font-medium text-ink">{chip.label}</span>
                {chip.sublabel && (
                  <span className="text-[11px] italic text-ink2">{chip.sublabel}</span>
                )}
              </span>
            )
          )}
        </div>
      )}
    </header>
  );
}
