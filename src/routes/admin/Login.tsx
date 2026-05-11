import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase/auth';

export function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      nav('/admin');
    } catch (e: any) {
      setErr(e?.message ?? 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-5 pt-16 pb-10">
      <header className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink2">Admin</div>
        <h1 className="font-display text-[32px] font-semibold text-ink leading-tight"
            style={{ fontVariationSettings: '"opsz" 48, "SOFT" 30' }}>
          Sign in
        </h1>
      </header>
      <form onSubmit={submit} className="mt-10 space-y-6">
        <div>
          <label htmlFor="email" className="block text-[11px] uppercase tracking-[0.14em] text-ink2 mb-2">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full h-12 border-0 border-b-2 border-taupe bg-transparent px-1 py-2 font-sans text-[16px] text-ink placeholder:text-taupe2 focus:border-moss-600 focus:outline-none transition-colors duration-150"
          />
        </div>
        <div>
          <label htmlFor="pw" className="block text-[11px] uppercase tracking-[0.14em] text-ink2 mb-2">Password</label>
          <input
            id="pw"
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full h-12 border-0 border-b-2 border-taupe bg-transparent px-1 py-2 font-sans text-[16px] text-ink placeholder:text-taupe2 focus:border-moss-600 focus:outline-none transition-colors duration-150"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full h-14 bg-moss-600 text-paper font-display font-semibold text-[16px] tracking-[0.08em] uppercase rounded-md hover:bg-moss-700 disabled:opacity-50 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {err && (
          <div className="bg-clay-50 border-l-4 border-clay-600 px-4 py-3 text-[13px] text-ink">
            {err}
          </div>
        )}
      </form>
    </main>
  );
}
