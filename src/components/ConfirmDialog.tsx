import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, onConfirm, onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-[2px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-paper rounded-xl shadow-xl border border-taupe overflow-hidden"
      >
        <div className="px-5 pt-5 pb-4">
          <div id="confirm-title" className="font-display text-[20px] font-semibold text-ink leading-tight"
               style={{ fontVariationSettings: '"opsz" 32' }}>
            {title}
          </div>
          {message && (
            <p className="text-[14px] text-ink2 mt-2 leading-relaxed">{message}</p>
          )}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-12 bg-surface text-ink border border-taupe font-sans text-[15px] rounded-md hover:bg-cream transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={
              'flex-1 h-12 font-display font-semibold text-[15px] uppercase tracking-[0.08em] rounded-md transition-colors text-paper ' +
              (destructive ? 'bg-clay-600 hover:bg-clay-700' : 'bg-moss-600 hover:bg-moss-700')
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
