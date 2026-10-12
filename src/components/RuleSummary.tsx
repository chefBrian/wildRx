import type { ReactNode } from 'react';
import { formatDosePerKg, formatNumber, plainDuration } from '../domain/format';
import { plainFrequency } from '../domain/frequency';
import { ROUTE_PLAIN } from '../domain/doseRoutes';
import type { DoseUnit, DosingRule } from '../domain/types';

interface Props {
  rule: DosingRule;
  unit: DoseUnit;
  /** "species" or the group label, e.g. "Raptor". */
  sourceLabel: string;
  /** Hidden by a species rule: shown for context, not in effect. */
  dimmed?: boolean;
  /** Admin action buttons. The public fact sheet passes none. */
  children?: ReactNode;
}

/** One rule as a read-only row. No admin or auth imports - the public fact sheet reuses it. */
export function RuleSummary({ rule, unit, sourceLabel, dimmed = false, children }: Props) {
  const tone = rule.target.type === 'species' ? 'bg-moss-50 text-moss-700' : 'bg-ochre-50 text-ochre-700';
  const duration = plainDuration(rule.durationDays);
  const n = rule.contraindications.length;
  return (
    <div
      data-testid={`rule-${rule.id}`}
      className={'bg-surface border border-taupe rounded-md p-4' + (dimmed ? ' opacity-60' : '')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[15px] text-ink">{rule.route}</span>
            <span className="text-[12px] text-ink2">{ROUTE_PLAIN[rule.route]}</span>
            <span className={'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] ' + tone}>
              {sourceLabel}
            </span>
          </div>
          <div className="text-[14px] text-ink tabular-nums">{formatDosePerKg(rule.dosePerKg, unit)}</div>
          <div className="text-[13px] text-ink2 flex flex-wrap gap-x-1.5">
            <span>{rule.frequency} ({plainFrequency(rule.frequency)})</span>
            {duration && <span>· {duration}</span>}
            {rule.maxSingleDose !== null && <span>· max {formatNumber(rule.maxSingleDose)} {unit}</span>}
            {n > 0 && <span className="text-clay-700">· {n} contraindication{n === 1 ? '' : 's'}</span>}
            {rule.notes && <span>· notes</span>}
          </div>
        </div>
        {children && <div className="flex flex-col items-end gap-1 shrink-0">{children}</div>}
      </div>
    </div>
  );
}
