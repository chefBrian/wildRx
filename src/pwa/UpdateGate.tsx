import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { isAdminPath, useUpdateReadyPath } from './updates';

const defaultReload = () => window.location.reload();

/**
 * Once a new build is ready, the next screen change loads fresh instead of rendering in the
 * old code, so the swap looks like a normal page change. Admin shows a banner instead.
 */
export function UpdateGate({ children, reload = defaultReload }: { children: ReactNode; reload?: () => void }) {
  const readyPath = useUpdateReadyPath();
  const location = useLocation();
  const path = location.pathname + location.search + location.hash;
  const admin = isAdminPath(location.pathname);
  const reloadHere = readyPath !== null && !admin && path !== readyPath;

  useEffect(() => {
    if (reloadHere) reload();
  }, [reloadHere, reload]);

  if (reloadHere) return null;
  return (
    <>
      {children}
      {readyPath !== null && admin && <UpdateBanner onReload={reload} />}
    </>
  );
}

function UpdateBanner({ onReload }: { onReload: () => void }) {
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-50 bg-moss-700 text-paper px-5 py-3 flex items-center justify-center gap-4 text-[14px]">
      <span>A new version is available. Reload when you've saved.</span>
      <button
        type="button"
        onClick={onReload}
        className="h-9 px-4 rounded-md bg-paper text-moss-700 font-display font-semibold text-[13px] uppercase tracking-[0.08em]"
      >
        Reload
      </button>
    </div>
  );
}
