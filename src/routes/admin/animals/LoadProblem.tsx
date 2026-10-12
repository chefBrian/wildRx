import type { AdminLoadError } from './useAdminData';

export function LoadProblem({ error, onRetry }: { error: AdminLoadError; onRetry: () => void }) {
  return (
    <div role="alert" className="bg-clay-50 border-l-4 border-clay-600 px-5 py-4 text-[14px] text-ink">
      {error === 'schemaMismatch'
        ? 'Some rules are in an old format. Fix or delete them in the Firebase console.'
        : "Couldn't load admin data."}
      {error === 'error' && (
        <button type="button" onClick={onRetry} className="ml-2 text-moss-700 underline underline-offset-4">Try again</button>
      )}
    </div>
  );
}
