import { Link, Outlet, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/auth';

const TABS: Array<{ to: string; label: string; match: (path: string) => boolean }> = [
  { to: '/admin', label: 'Animals', match: p => p === '/admin' || p === '/admin/' || p.startsWith('/admin/animals') },
  { to: '/admin/meds', label: 'Meds', match: p => p.startsWith('/admin/meds') },
];

export default function AdminHome() {
  const { pathname } = useLocation();
  return (
    <main className="mx-auto max-w-3xl px-5 pt-10 pb-[max(4rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Admin</div>
          <h1 className="font-display text-[28px] font-semibold text-ink leading-tight"
              style={{ fontVariationSettings: '"opsz" 48' }}>
            wildRx control
          </h1>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <Link
            to="/"
            className="min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
          >
            View calculator
          </Link>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="mt-8 flex gap-2 border-b border-taupe">
        {TABS.map(tab => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? 'page' : undefined}
              className={
                'px-4 h-11 inline-flex items-center text-[13px] font-medium uppercase tracking-[0.1em] -mb-px border-b-2 transition-colors ' +
                (active ? 'border-moss-600 text-ink' : 'border-transparent text-ink2 hover:text-ink')
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <section className="mt-8">
        <Outlet />
      </section>
    </main>
  );
}
