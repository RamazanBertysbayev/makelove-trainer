'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminConfigured, adminSb, checkIsAdmin, errText } from '@/lib/adminClient';
import DishesTab from './DishesTab';
import IngredientsTab from './IngredientsTab';

type Phase = 'loading' | 'login' | 'denied' | 'ok';

export default function AdminApp() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [tab, setTab] = useState<'dishes' | 'ingredients'>('dishes');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function verify() {
    try {
      const ok = await checkIsAdmin();
      setPhase(ok ? 'ok' : 'denied');
    } catch (e) { setErr(errText(e)); setPhase('login'); }
  }

  useEffect(() => {
    if (!adminConfigured) { setErr('Сайт не подключён к базе (нет ключей Supabase).'); setPhase('login'); return; }
    adminSb().auth.getSession().then(({ data }) => { if (data.session) verify(); else setPhase('login'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await adminSb().auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (error) { setErr(/invalid login/i.test(error.message) ? 'Неверная почта или пароль.' : error.message); return; }
    setPass('');
    setPhase('loading');
    await verify();
  }

  async function logout() {
    await adminSb().auth.signOut();
    setPhase('login'); setErr('');
  }

  const input = 'min-h-[48px] w-full rounded-xl border border-white/15 bg-plum/70 px-4 text-cream placeholder:text-cream/40';

  if (phase === 'loading') return <main className="mx-auto max-w-2xl px-5 py-10 text-cream/70">Загрузка…</main>;

  if (phase === 'login') {
    return (
      <main className="mx-auto max-w-md px-5 pb-24">
        <h1 className="font-display py-8 text-3xl font-extrabold">Разработчик</h1>
        <form onSubmit={login} className="panel space-y-4 p-6">
          <label className="block text-sm font-semibold">Почта
            <input className={input + ' mt-1'} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">Пароль
            <input className={input + ' mt-1'} type="password" autoComplete="current-password" required value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          {err && <p role="alert" className="text-pink">{err}</p>}
          <button className="btn-primary w-full" disabled={busy || !adminConfigured}>{busy ? 'Вхожу…' : 'Войти'}</button>
          <Link href="/" className="btn-ghost w-full">На главную</Link>
        </form>
      </main>
    );
  }

  if (phase === 'denied') {
    return (
      <main className="mx-auto max-w-2xl px-5 pb-24">
        <h1 className="font-display py-8 text-3xl font-extrabold">Нет доступа</h1>
        <div className="panel space-y-4 p-6">
          <p className="text-cream/80">Вход выполнен, но база не считает этого пользователя администратором. Проверьте, что его UUID записан в таблицу <code>app_admins</code> (файл 03_make_admin.sql).</p>
          <button className="btn-ghost" onClick={logout}>Выйти</button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3 py-6">
        <h1 className="font-display text-3xl font-extrabold">Разработчик</h1>
        <button className="btn-ghost min-h-[40px] px-4 text-sm" onClick={logout}>Выйти</button>
      </div>
      <div role="tablist" className="mb-6 flex gap-2">
        {([['dishes', 'Блюда'], ['ingredients', 'Ингредиенты']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-[44px] rounded-xl border-2 px-5 font-bold ${tab === k ? 'border-pink bg-pink text-night' : 'border-white/20 text-cream/80 hover:border-teal'}`}>{label}</button>
        ))}
      </div>
      {tab === 'dishes' ? <DishesTab /> : <IngredientsTab />}
    </main>
  );
}
