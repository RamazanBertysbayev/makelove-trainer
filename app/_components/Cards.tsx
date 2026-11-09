'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { getMenu, shuffle, trainable, type Dish, type Menu } from '@/lib/menu';
import { configured, getMyProfile, type Profile } from '@/lib/supabase';
import { finishAttempt, saveAnswer, startAttempt, type Outcome } from '@/lib/progress';

const sel = 'min-h-[48px] rounded-xl border border-white/15 bg-plum px-4 text-cream';
type Res = { dish: Dish; outcome: Outcome };

export default function Cards() {
  const [phase, setPhase] = useState<'loading' | 'setup' | 'play' | 'done'>('loading');
  const [err, setErr] = useState('');
  const [warn, setWarn] = useState('');
  const [menu, setMenu] = useState<Menu | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cat, setCat] = useState('all');
  const [count, setCount] = useState(10);
  const [deck, setDeck] = useState<Dish[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [res, setRes] = useState<Res[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const [starting, setStarting] = useState(false);
  const answerLock = useRef(false);
  const beginLock = useRef(false);

  useEffect(() => {
    if (!configured) { setErr('Сайт не подключён к базе (нет ключей Supabase).'); return; }
    Promise.all([getMenu(), getMyProfile()]).then(([m, p]) => { setMenu(m); setProfile(p); setPhase('setup'); }).catch((e) => setErr(e.message || 'Не удалось загрузить данные'));
  }, []);

  const names = useMemo(() => new Map((menu?.ingredients ?? []).map((i) => [i.id, i.name])), [menu]);
  const cats = useMemo(() => new Map((menu?.categories ?? []).map((x) => [x.id, x.name])), [menu]);
  const pool = useMemo(() => (menu ? trainable(menu) : []), [menu]);
  const available = pool.filter((d) => cat === 'all' || d.category_id === cat);
  const photoUrl = (p: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dish-photos/${p}`;

  async function begin(list: Dish[]) {
    if (beginLock.current) return;
    beginLock.current = true;
    setStarting(true);
    setWarn(''); setRes([]); setIdx(0); setFlipped(false); setDeck(list); setAttemptId(null);
    answerLock.current = false; setAnswering(false);
    try {
      if (profile) {
        try { setAttemptId(await startAttempt(profile.id, 'flashcards', cat, null, false, list.length)); }
        catch (e) { setWarn('Прогресс не сохраняется: ' + (e as Error).message); }
      }
      setPhase('play');
    } finally {
      setStarting(false);
      beginLock.current = false;
    }
  }
  async function answer(outcome: Outcome) {
    if (answerLock.current || phase !== 'play' || !deck[idx]) return;
    answerLock.current = true;
    setAnswering(true);
    const dish = deck[idx];
    const all = [...res, { dish, outcome }];
    setRes(all);
    try {
      if (profile && attemptId) {
        try { await saveAnswer(profile.id, attemptId, [dish.id], 'card', outcome, dish.ingredients.map((i) => names.get(i)), outcome); }
        catch (e) { setWarn('Не удалось сохранить ответ: ' + (e as Error).message); }
      }
      if (idx + 1 < deck.length) {
        setIdx((current) => current + 1);
        setFlipped(false);
        return;
      }
      if (profile && attemptId) {
        try { await finishAttempt(attemptId, all.filter((r) => r.outcome === 'right').length); }
        catch (e) { setWarn('Не удалось сохранить результат: ' + (e as Error).message); }
      }
      setPhase('done');
    } finally {
      answerLock.current = false;
      setAnswering(false);
    }
  }

  if (err) return <main className="mx-auto max-w-3xl px-5 py-10"><p className="panel p-5 text-pink" role="alert">{err}</p></main>;
  if (phase === 'loading' || !menu) return <main className="mx-auto max-w-3xl px-5 py-16 text-cream/70">Загрузка…</main>;

  if (phase === 'setup') return (
    <main className="mx-auto max-w-2xl px-5 pb-24">
      <h1 className="font-display py-8 text-3xl font-extrabold">Карточки</h1>
      <div className="panel grid gap-5 p-6">
        {!profile && <p className="rounded-xl border border-sun p-4 text-sun">Чтобы прогресс сохранялся, <Link href="/guest/" className="underline">войди как гость</Link>.</p>}
        <label className="grid gap-2 text-cream/80">Категория
          <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">Все категории</option>
            {menu.categories.filter((x) => pool.some((d) => d.category_id === x.id)).map((x) => (<option key={x.id} value={x.id}>{x.name} ({pool.filter((d) => d.category_id === x.id).length})</option>))}
          </select>
        </label>
        <label className="grid gap-2 text-cream/80">Количество карточек
          <select className={sel} value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 10, 20, 50].map((n) => (<option key={n} value={n}>{n}</option>))}</select>
        </label>
        <p className="text-sm text-cream/60">Доступно блюд: {available.length}.</p>
        <button className="btn-primary disabled:opacity-40" disabled={!available.length || starting} onClick={() => begin(shuffle(available).slice(0, count))}>Начать</button>
      </div>
    </main>
  );

  if (phase === 'done') {
    const n = (o: Outcome) => res.filter((r) => r.outcome === o).length;
    const again = res.filter((r) => r.outcome !== 'right').map((r) => r.dish);
    return (
      <main className="mx-auto max-w-2xl px-5 pb-24">
        <h1 className="font-display py-8 text-3xl font-extrabold">Готово</h1>
        <div className="panel p-6">
          <p className="text-cream/85">Знаю: <b className="text-teal">{n('right')}</b> · Нужно повторить: <b className="text-sun">{n('review')}</b> · Не знаю: <b className="text-pink">{n('wrong')}</b></p>
          {warn && <p className="mt-4 text-sun">{warn}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            {again.length > 0 && <button className="btn-primary" onClick={() => begin(shuffle(again))}>Повторить непонятные ({again.length})</button>}
            <button className="btn-ghost" onClick={() => setPhase('setup')}>Новая колода</button>
            <Link href="/modes/" className="btn-ghost">К режимам</Link>
          </div>
        </div>
      </main>
    );
  }

  const dish = deck[idx];
  return (
    <main className="mx-auto max-w-xl px-5 pb-24">
      <p className="py-6 text-sm text-cream/70">Карточка {idx + 1} из {deck.length}</p>
      <button type="button" onClick={() => setFlipped((current) => !current)} className="panel block min-h-[320px] w-full p-8 text-left" aria-label="Перевернуть карточку">
        {!flipped ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">{cats.get(dish.category_id)}</p>
            <h1 className="font-display mt-3 text-3xl font-extrabold text-pink">{dish.name}</h1>
            {dish.photo_path && <img src={photoUrl(dish.photo_path)} alt={dish.name} loading="lazy" className="mt-5 max-h-48 rounded-xl object-cover" />}
            <p className="mt-8 text-cream/50">Вспомни состав и нажми, чтобы перевернуть</p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">Состав · {dish.name}</p>
            <ul className="mt-4 flex flex-wrap gap-2">{dish.ingredients.map((i) => (<li key={i} className="rounded-full border border-teal/60 px-4 py-2 text-teal">{names.get(i)}</li>))}</ul>
          </>
        )}
      </button>
      {flipped ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <button className="btn-primary px-2" disabled={answering} onClick={() => answer('right')}>Знаю</button>
          <button className="btn-ghost px-2" disabled={answering} onClick={() => answer('review')}>Нужно повторить</button>
          <button className="btn-ghost px-2 !border-pink !text-pink" disabled={answering} onClick={() => answer('wrong')}>Не знаю</button>
        </div>
      ) : <button className="btn-ghost mt-5 w-full" onClick={() => setFlipped(true)}>Показать состав</button>}
      {warn && <p className="mt-4 text-sun">{warn}</p>}
    </main>
  );
}
