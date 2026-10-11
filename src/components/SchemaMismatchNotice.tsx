export function SchemaMismatchNotice() {
  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div role="alert" className="bg-ochre-50 border-l-4 border-ochre-600 px-5 py-5">
        <div className="font-display text-[15px] font-semibold text-ochre-700 uppercase tracking-[0.1em]">
          Data update in progress
        </div>
        <p className="text-[14px] text-ink mt-2">
          The dosing data is being updated. Reload in a minute.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 h-11 px-5 bg-moss-600 text-paper font-display font-semibold text-[14px] uppercase tracking-[0.08em] rounded-md hover:bg-moss-700 transition-colors"
        >
          Reload
        </button>
      </div>
    </main>
  );
}
