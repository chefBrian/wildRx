import type { ReactNode } from 'react';

export function ActionButton({ onClick, children, danger = false, disabled = false }: {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] underline underline-offset-4 decoration-1 text-right disabled:opacity-40 disabled:cursor-not-allowed ' +
        (danger ? 'text-clay-700' : 'text-moss-700')
      }
    >
      {children}
    </button>
  );
}
