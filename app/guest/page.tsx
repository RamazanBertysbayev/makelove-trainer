'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { configured, ensureSession, getMyProfile, sb, type Profile } from '@/lib/supabase';

const input = 'min-h-[48px] w-full rounded-xl border border-white/15 bg-plum/70 px-4 text-cream placeholder:text-cream/40';

export default function Guest() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<'new' | 'restore'>('new');
  const [nick, setNick] = useState('');
  const [code, setCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!configured) { setErr('Сайт не подключён к базе (нет ключей Supabase).'); setLoading(false); return; }
    getMyProfile().then(setProfile).catch((e) => setErr(e.message || 'Ошибка подключения')).finally(() => setLoading(false));
  }, []);

  async function create() {
    setErr(''); setBusy(true);
    try {
      await ensureSession();
      const { data, error } = await sb().rpc('create_guest_profile', { p_nickname: nick });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setNewCode(row.out_recovery_code); setSaved(false);
      setProfile(await getMyProfile());
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function restore() {
    setErr(''); setBusy(true);
    try {
      await ensureSession();
      const { data, error } = await sb().rpc('recover_profile', { p_code: code });
      if (error) throw error;
      if (!data) { setErr('Код не подошёл. Проверь, что ввёл все 24 символа.'); return; }
      setProfile(await getMyProfile());
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function regen() {
    if (!confirm('Выпустить новый код? Старый перестанет работать.')) return;
    setErr(''); setBusy(true);
    try {
      const { data, error } = await sb().rpc('regenerate_recovery_code');
      if (error) throw error;
      setNewCode(data as string); setSaved(false);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function signOut() {
    if (!confirm('Выйти на этом устройстве? Вернуться в профиль можно будет только по коду восстановления.')) return;
    await sb().auth.signOut(); setProfile(null); setNewCode('');
  }

  if (loading) return <main className="mx-auto max-w-xl px-5 py-16 text-cream/70">Загрузка…</main>;

  // Код восстановления показывается один раз
  if (newCode) return (
    <main className="mx-auto max-w-xl px-5 pb-24">
      <h1 className="font-display py-8 text-3xl font-extrabold">Твой код восстановления</h1>
      <div className="panel p-6">
        <p className="text-cream/80">Сохрани этот код: он вернёт твой прогресс на другом устройстве. Показываем его один раз, другим гостям он недоступен.</p>
        <p className="font-display mt-5 break-all rounded-xl border-2 border-teal bg-night p-4 text-center text-xl tracking-wider text-teal select-all">{newCode}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(newCode)}>Скопировать</button>
        </div>
        <label className="mt-5 flex items-start gap-3 text-cream/80"><input type="checkbox" className="mt-1 h-5 w-5" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> Я сохранил код</label>
        <button className="btn-primary mt-5 w-full disabled:opacity-40" disabled={!saved} onClick={() => setNewCode('')}>Продолжить</button>
      </div>
    </main>
  );

  if (profile) return (
    <main className="mx-auto max-w-xl px-5 pb-24">
      <h1 className="font-display py-8 text-3xl font-extrabold">Привет, {profile.nickname}!</h1>
      <div className="panel p-6">
        <p className="text-cream/80">Опыт: <b className="text-sun">{profile.xp} XP</b></p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/modes/" className="btn-primary">Выбрать режим</Link>
          <Link href="/play/assemble/" className="btn-ghost">Собери блюдо</Link>
        </div>
        <hr className="my-6 border-white/10" />
        <div className="flex flex-wrap gap-3">
          <button className="btn-ghost" onClick={regen} disabled={busy}>Новый код восстановления</button>
          <button className="btn-ghost" onClick={signOut}>Выйти на этом устройстве</button>
        </div>
        {err && <p className="mt-4 text-pink" role="alert">{err}</p>}
      </div>
    </main>
  );

  return (
    <main className="mx-auto max-w-xl px-5 pb-24">
      <h1 className="font-display py-8 text-3xl font-extrabold">Вход гостя</h1>
      <div className="panel p-6">
        <div className="grid grid-cols-2 gap-2" role="tablist">
          {(['new', 'restore'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setErr(''); }} className={`min-h-[48px] rounded-xl font-bold ${tab === t ? 'bg-pink text-night' : 'border border-white/15 text-cream/80'}`}>{t === 'new' ? 'Новый профиль' : 'Восстановить'}</button>
          ))}
        </div>
        {tab === 'new' ? (
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-cream/80">Никнейм (2–24 символа)
              <input className={input} value={nick} maxLength={24} onChange={(e) => setNick(e.target.value)} placeholder="Например, Имя" />
            </label>
            <p className="text-sm text-cream/60">Никнейм это просто имя на экране. Регистрация по почте не нужна: профиль привязывается к устройству, а для другого устройства получишь код восстановления.</p>
            <button className="btn-primary disabled:opacity-40" disabled={busy || nick.trim().length < 2} onClick={create}>{busy ? 'Создаю…' : 'Войти'}</button>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-cream/80">Код восстановления
              <input className={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autoCapitalize="characters" />
            </label>
            <button className="btn-primary disabled:opacity-40" disabled={busy || code.trim().length < 10} onClick={restore}>{busy ? 'Проверяю…' : 'Восстановить профиль'}</button>
          </div>
        )}
        {err && <p className="mt-4 text-pink" role="alert">{err}</p>}
      </div>
    </main>
  );
}
