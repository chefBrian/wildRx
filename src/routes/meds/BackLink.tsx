import { Link, useLocation, useNavigate } from 'react-router-dom';

const cls = 'text-[12px] uppercase tracking-[0.1em] text-moss-700 inline-flex items-center gap-1.5 -ml-1 px-2 py-1 rounded-md hover:bg-cream/60 transition-colors';

/** Back in history when the user came from inside the app (keeps the patient); otherwise a link.
 *  The link replaces the entry and marks it, so Back on the page it lands on is also a link (no loop). */
export function BackLink({ fallback }: { fallback: string }) {
  const loc = useLocation();
  const nav = useNavigate();
  const arrivedViaFallback = (loc.state as { backFallback?: boolean } | null)?.backFallback === true;
  if (loc.key !== 'default' && !arrivedViaFallback) {
    return <button type="button" onClick={() => nav(-1)} className={cls}><span aria-hidden>←</span> Back</button>;
  }
  return <Link to={fallback} replace state={{ backFallback: true }} className={cls}><span aria-hidden>←</span> Back</Link>;
}
