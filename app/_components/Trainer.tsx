'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { getMenu, trainable, type Menu } from '@/lib/menu';
import { configured, getMyProfile, type Profile } from '@/lib/supabase';
import { Ctx, hintFor, makeTasks, type Difficulty, type Kind, type Task } from '@/lib/tasks';
import { finishAttempt, saveAnswer, startAttempt, type Mode } from '@/lib/progress';
import { AssembleView, CompareView, FindErrorView, QuizView, type Answer } from './views';

type Phase = 'loading' | 'setup' | 'play' | 'done';
const sel = 'min-h-[48px] rounded-xl border border-white/15 bg-plum px-4 text-cream';
const KIND_NAMES: Record<Kind, string> = { assemble: 'Собери блюдо', quiz: 'Квиз', find_error: 'Найди ошибку', compare: 'Сравнение блюд' };
const DIFF_NAMES: Record<Difficulty, string> = { easy: 'Лёгкая', medium: 'Средняя', hard: 'Сложная' };

export default function Trainer({ title, kinds, mode, chooseKinds = false }: { title: string; kinds: Kind[]; mode: Mode; chooseKinds?: boolean }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [err, setErr] = useState('');
  const [warn, setWarn] = useState('');
  const [menu, setMenu] = useState<Menu | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cat, setCat] = useState('all');
  const [count, setCount] = useState(10);
  const [diff, setDiff] = useState<Difficulty>('medium');
  const [exam, setExam] = useState(false);
  const [chosenKinds, setChosenKinds] = useState<Kind[]>(kinds);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<{ task: Task; ok: boolean }[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const answerLock = useRef(false);
  const nextLock = useRef(false);
  const beginLock = useRef(false);

  useEffect(() => {
    if (!configured) { setErr('Сайт не подключён к базе (нет ключей Supabase).'); return; }
    Promise.all([getMenu(), getMyProfile()])
      .then(([m, p]) => { setMenu(m); setProfile(p); setPhase('setup'); })
      .catch((e) => setErr(e.message || 'Не удалось загрузить данные'));
  }, []);

  const c = useMemo(() => (menu ? new Ctx(menu, diff) : null), [menu, diff]);
  const pool = useMemo(() => (menu ? trainable(menu) : []), [menu]);
  const available = pool.filter((d) => cat === 'all' || d.category_id === cat).length;
  const showDiff = kinds.some((k) => k !== 'assemble') || chooseKinds;

  async function begin(list: Task[]) {
    if (beginLock.current) return;
    beginLock.current = true;
    setWarn(''); setResults([]); setIdx(0); setAnswered(false); setShowHint(false); setTasks(list); setAttemptId(null);
    answerLock.current = false; nextLock.current = false;
    try {
      if (profile) {
        try { setAttemptId(await startAttempt(profile.id, mode, cat, showDiff ? diff : null, exam, list.length)); }
        catch (e) { setWarn('Прогресс не сохраняется: ' + (e as Error).message); }
      }
      setPhase('play');
    } finally { beginLock.current = false; }
  }
  const start = () => {
    if (beginLock.current) return;
    const list = makeTasks(menu!, { kinds: chosenKinds, count, categoryId: cat, difficulty: diff });
    if (list.length === 0) { setWarn('Не удалось составить задания для этой категории.'); return; }
    void begin(list);
  };

  async function onAnswer(a: Answer) {
    if (answerLock.current || answered || phase !== 'play') return;
    const task = tasks[idx];
    if (!task) return;
    answerLock.current = true;
    setAnswered(true);
    setResults((r) => [...r, { task, ok: a.ok }]);
    try {
      if (!profile || !attemptId) return;
      await saveAnswer(profile.id, attemptId, task.dishIds, task.kind === 'quiz' ? task.qtype : task.kind, a.ok ? 'right' : 'wrong', a.expected, a.given);
    } catch (e) { setWarn('Не удалось сохранить ответ: ' + (e as Error).message); }
  }
  async function next() {
    if (nextLock.current || !answered) return;
    nextLock.current = true;
    try {
      if (idx + 1 < tasks.length) {
        setIdx((current) => current + 1); setAnswered(false); setShowHint(false); answerLock.current = false; return;
      }
      setPhase('done');
      if (profile && attemptId) {
        try { await finishAttempt(attemptId, results.filter((r) => r.ok).length); }
        catch (e) { setWarn('Не удалось сохранить результат: ' + (e as Error).message); }
      }
    } finally { nextLock.current = false; }
  }

  if (err) return <main className="mx-auto max-w-3xl px-5 py-10"><p className="panel p-5 text-pink" role="alert">{err}</p></main>;
  if (phase === 'loading' || !menu || !c) return <main className="mx-auto max-w-3xl px-5 py-16 text-cream/70">Загрузка…</main>;

  if (phase === 'setup') return (
    <main className="mx-auto max-w-2xl px-5 pb-24">
      <h1 className="font-display py-8 text-3xl font-extrabold">{title}</h1>
      <div className="panel grid gap-5 p-6">
        {!profile && <p className="rounded-xl border border-sun p-4 text-sun">Чтобы прогресс сохранялся, <Link href="/guest/" className="underline">войди как гость</Link>. Без входа можно тренироваться, но результаты не сохранятся.</p>}
        {chooseKinds && (
          <fieldset className="grid gap-2 text-cream/80"><legend className="mb-1">Какие задания включить</legend>
            {(Object.keys(KIND_NAMES) as Kind[]).map((k) => (
              <label key={k} className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={chosenKinds.includes(k)} onChange={(e) => setChosenKinds(e.target.checked ? [...chosenKinds, k] : chosenKinds.filter((x) => x !== k))} /> {KIND_NAMES[k]}</label>
            ))}
          </fieldset>
        )}
        <label className="grid gap-2 text-cream/80">Категория
          <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">Все категории</option>
            {menu.categories.filter((x) => pool.some((d) => d.category_id === x.id)).map((x) => (<option key={x.id} value={x.id}>{x.name} ({pool.filter((d) => d.category_id === x.id).length})</option>))}
          </select>
        </label>
        {showDiff && (
          <label className="grid gap-2 text-cream/80">Сложность
            <select className={sel} value={diff} onChange={(e) => setDiff(e.target.value as Difficulty)}>{(Object.keys(DIFF_NAMES) as Difficulty[]).map((d) => (<option key={d} value={d}>{DIFF_NAMES[d]}</option>))}</select>
          </label>
        )}
        <label className="grid gap-2 text-cream/80">Количество заданий
          <select className={sel} value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 10, 20, 50].map((n) => (<option key={n} value={n}>{n}</option>))}</select>
        </label>
        <label className="flex items-center gap-3 text-cream/80"><input type="checkbox" className="h-5 w-5" checked={exam} onChange={(e) => setExam(e.target.checked)} /> Режим экзамена (подсказки отключены)</label>
        <p className="text-sm text-cream/60">Доступно блюд: {available}. В тренировку попадают только подтверждённые блюда с составом, заданий будет не больше этого числа.</p>
        {warn && <p className="text-pink" role="alert">{warn}</p>}
        <button className="btn-primary disabled:opacity-40" disabled={available === 0 || chosenKinds.length === 0} onClick={start}>Начать</button>
      </div>
    </main>
  );

  if (phase === 'done') {
    const ok = results.filter((r) => r.ok).length, wrong = results.filter((r) => !r.ok);
    const label = (t: Task) => t.dishIds.map((id) => c.byId.get(id)?.name).join(' и ');
    return (
      <main className="mx-auto max-w-2xl px-5 pb-24">
        <h1 className="font-display py-8 text-3xl font-extrabold">Результат: {ok} из {results.length}</h1>
        <div className="panel p-6">
          <p className="text-cream/80">Правильных ответов: {results.length ? Math.round((100 * ok) / results.length) : 0}%</p>
          {wrong.length > 0 ? (<><p className="mt-4 text-cream/80">Ошибки:</p><ul className="mt-2 grid gap-1 text-pink">{wrong.map((r, i) => (<li key={i}>• {label(r.task)}</li>))}</ul></>) : <p className="mt-4 text-teal">Без ошибок!</p>}
          {warn && <p className="mt-4 text-sun">{warn}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            {wrong.length > 0 && <button className="btn-primary" onClick={() => begin(wrong.map((r) => r.task))}>Повторить ошибки</button>}
            <button className="btn-ghost" onClick={() => setPhase('setup')}>Новая сессия</button>
            <Link href="/modes/" className="btn-ghost">К режимам</Link>
          </div>
        </div>
      </main>
    );
  }

  const task = tasks[idx];
  return (
    <main className="mx-auto max-w-5xl px-5 pb-24">
      <div className="flex items-center justify-between py-6 text-sm text-cream/70"><span>Задание {idx + 1} из {tasks.length}</span><span>{exam ? 'Экзамен' : 'Тренировка'}</span></div>
      <div key={idx}>
        {task.kind === 'assemble' && <AssembleView task={task} c={c} onAnswer={onAnswer} />}
        {task.kind === 'quiz' && <QuizView task={task} c={c} onAnswer={onAnswer} />}
        {task.kind === 'find_error' && <FindErrorView task={task} c={c} onAnswer={onAnswer} />}
        {task.kind === 'compare' && <CompareView task={task} c={c} onAnswer={onAnswer} />}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {!exam && !answered && <button className="btn-ghost" onClick={() => setShowHint(!showHint)}>Подсказка</button>}
        {answered && <button className="btn-primary" onClick={next}>{idx + 1 < tasks.length ? 'Дальше' : 'Завершить'}</button>}
      </div>
      {!exam && !answered && showHint && <p className="mt-4 rounded-xl border border-teal/50 p-4 text-cream/85">{hintFor(c, task)}</p>}
      {warn && <p className="mt-4 text-sun">{warn}</p>}
    </main>
  );
}
