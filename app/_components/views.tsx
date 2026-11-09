'use client';
import { useMemo, useRef, useState } from 'react';
import { shuffle } from '@/lib/menu';
import type { Ctx, ErrType, Side, Task } from '@/lib/tasks';

export type Answer = { ok: boolean; given: unknown; expected: unknown };
type P<K extends Task['kind']> = { task: Extract<Task, { kind: K }>; c: Ctx; onAnswer: (a: Answer) => void };

const chip = 'min-h-[44px] rounded-full border px-4 text-left';
const fb = (ok: boolean) => `mt-5 rounded-2xl border-2 p-5 ${ok ? 'border-teal bg-teal/10' : 'border-pink bg-pink/10'}`;

// ---------- СОБЕРИ БЛЮДО ----------
export function AssembleView({ task, c, onAnswer }: P<'assemble'>) {
  const dish = c.byId.get(task.dishIds[0])!;
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [res, setRes] = useState<{ ok: boolean; missing: string[]; extra: string[] } | null>(null);
  const checkLock = useRef(false);
  const rest = useMemo(() => {
    const f = filter.trim().toLowerCase().replace(/ё/g, 'е');
    return c.menu.ingredients.filter((i) => !picked.includes(i.id) && (!f || i.name.toLowerCase().replace(/ё/g, 'е').includes(f) || i.aliases.some((a) => a.toLowerCase().includes(f))));
  }, [c, picked, filter]);

  function check() {
    if (checkLock.current || res) return;
    checkLock.current = true;
    const right = new Set(dish.ingredients), got = new Set(picked);
    const missing = dish.ingredients.filter((i) => !got.has(i)).map(c.label);
    const extra = picked.filter((i) => !right.has(i)).map(c.label);
    const ok = !missing.length && !extra.length;   // только состав, порядок не важен
    setRes({ ok, missing, extra });
    if (ok) onAnswer({ ok, given: picked.map(c.label), expected: dish.ingredients.map(c.label) });
  }
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Собери состав: <span className="text-pink">{dish.name}</span></h1>
      <section className="panel mt-6 p-5" aria-label="Выбранные ингредиенты">
        <p className="text-sm text-cream/60">Выбрано: {picked.length}</p>
        <ul className="mt-3 flex min-h-[48px] flex-wrap gap-2">
          {picked.map((id) => (<li key={id}><button type="button" disabled={!!res} onClick={() => setPicked((current) => current.filter((x) => x !== id))} className={`${chip} border-2 border-pink bg-pink/10 font-semibold text-cream disabled:opacity-80`} aria-label={`Убрать ${c.label(id)}`}>{c.label(id)} ✕</button></li>))}
          {!picked.length && <li className="text-cream/50">Нажимай на ингредиенты ниже</li>}
        </ul>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-ghost" disabled={!!res || !picked.length} onClick={() => setPicked((current) => current.slice(0, -1))}>Отменить последний</button>
          <button className="btn-ghost" disabled={!!res || !picked.length} onClick={() => setPicked([])}>Начать заново</button>
          <button className="btn-primary disabled:opacity-40" disabled={!!res || !picked.length} onClick={check}>Проверить</button>
        </div>
      </section>
      {res && (
        <section className={fb(res.ok)} role="status">
          <p className="font-display text-xl font-semibold">{res.ok ? 'Верно!' : 'Неверно'}</p>
          {res.missing.length > 0 && <p className="mt-2">Не хватает: <b>{res.missing.join(', ')}</b></p>}
          {res.extra.length > 0 && <p className="mt-2">Лишнее: <b>{res.extra.join(', ')}</b></p>}
          <p className="mt-2 text-cream/80">Правильный состав: {c.list(dish.ingredients)}</p>
          {!res.ok && <button type="button" className="btn-primary mt-4" onClick={() => { checkLock.current = false; setPicked([]); setFilter(''); setRes(null); }}>Начать заново</button>}
        </section>
      )}
      {!res && (
        <section className="mt-6" aria-label="Ингредиенты">
          <input className="min-h-[48px] w-full rounded-xl border border-white/15 bg-plum/70 px-4 text-cream placeholder:text-cream/40" placeholder="Найти ингредиент" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Найти ингредиент" />
          <ul className="mt-3 flex max-h-[45vh] flex-wrap gap-2 overflow-y-auto pr-1">
            {rest.map((i) => (<li key={i.id}><button type="button" onClick={() => setPicked((current) => current.includes(i.id) ? current : [...current, i.id])} className={`${chip} border-teal/60 text-teal hover:bg-teal/10`}>{i.name}</button></li>))}
          </ul>
        </section>
      )}
    </>
  );
}

// ---------- КВИЗ ----------
export function QuizView({ task, c, onAnswer }: P<'quiz'>) {
  const [chosen, setChosen] = useState<string | null>(null);
  const chooseLock = useRef(false);
  const done = chosen !== null;
  function choose(id: string) {
    if (done || chooseLock.current) return;
    chooseLock.current = true;
    setChosen(id);
    const lab = (x: string) => task.options.find((o) => o.id === x)?.label;
    onAnswer({ ok: id === task.correct, given: lab(id), expected: lab(task.correct) });
  }
  const long = task.qtype === 'pick_composition';
  return (
    <>
      <h1 className="font-display text-xl font-extrabold sm:text-2xl">{task.prompt}</h1>
      {task.shown && <ul className="mt-4 flex flex-wrap gap-2">{task.shown.map((i) => (<li key={i} className="rounded-full border border-white/25 px-4 py-2 text-cream/90">{c.label(i)}</li>))}</ul>}
      <ul className={`mt-6 grid gap-3 ${long ? '' : 'sm:grid-cols-2'}`}>
        {task.options.map((o) => {
          const mark = !done ? 'border-teal/60 text-cream hover:bg-teal/10' : o.id === task.correct ? 'border-teal bg-teal/15 text-cream' : o.id === chosen ? 'border-pink bg-pink/15 text-cream' : 'border-white/10 text-cream/50';
          return (<li key={o.id}><button type="button" disabled={done} onClick={() => choose(o.id)} className={`min-h-[56px] w-full rounded-xl border-2 px-4 py-3 text-left font-semibold ${mark}`}>{o.label}</button></li>);
        })}
      </ul>
      {done && (
        <section className={fb(chosen === task.correct)} role="status">
          <p className="font-display text-xl font-semibold">{chosen === task.correct ? 'Верно!' : 'Неверно'}</p>
          <p className="mt-2 text-cream/85">{task.explain}</p>
        </section>
      )}
    </>
  );
}

// ---------- НАЙДИ ОШИБКУ ----------
const ETYPES: [ErrType, string][] = [['extra', 'Есть лишний ингредиент'], ['missing', 'Чего-то не хватает'], ['replaced', 'Один ингредиент заменён']];
export function FindErrorView({ task, c, onAnswer }: P<'find_error'>) {
  const dish = c.byId.get(task.dishIds[0])!;
  const [type, setType] = useState<ErrType | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [done, setDone] = useState<boolean | null>(null);
  const typeLock = useRef(false);
  const targetLock = useRef(false);
  const given = (t: ErrType, x?: string) => ({ type: t, target: x ? c.label(x) : null });
  const expected = { type: task.etype, target: c.label(task.target) };

  function chooseType(t: ErrType) {
    if (typeLock.current) return;
    typeLock.current = true;
    setType(t);
    if (t !== task.etype) { setDone(false); onAnswer({ ok: false, given: given(t), expected }); }
  }
  function chooseTarget(id: string) {
    if (done !== null || targetLock.current) return;
    targetLock.current = true;
    setTarget(id);
    const ok = id === task.target;
    setDone(ok); onAnswer({ ok, given: given(type!, id), expected });
  }
  const step2 = type !== null && type === task.etype;
  const list = type === 'missing' ? task.options.map((o) => o.id) : task.shown;
  return (
    <>
      <h1 className="font-display text-xl font-extrabold sm:text-2xl">Найди ошибку в составе: <span className="text-pink">{dish.name}</span></h1>
      <ul className="mt-4 flex flex-wrap gap-2">{task.shown.map((i) => (<li key={i} className="rounded-full border border-white/25 px-4 py-2 text-cream/90">{c.label(i)}</li>))}</ul>
      <p className="mt-6 text-cream/70">Что не так с этим составом?</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {ETYPES.map(([t, label]) => (<li key={t}><button type="button" disabled={type !== null} onClick={() => chooseType(t)} className={`min-h-[56px] w-full rounded-xl border-2 px-4 py-3 font-semibold ${type === t ? (t === task.etype ? 'border-teal bg-teal/15' : 'border-pink bg-pink/15') : type !== null ? 'border-white/10 text-cream/50' : 'border-teal/60 hover:bg-teal/10'}`}>{label}</button></li>))}
      </ul>
      {step2 && (
        <section className="mt-6" aria-label="Выбор ингредиента">
          <p className="text-cream/70">{type === 'missing' ? 'Какого ингредиента не хватает?' : 'Нажми на неправильный ингредиент.'}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {list.map((id) => {
              const mark = done === null ? 'border-teal/60 text-teal hover:bg-teal/10' : id === task.target ? 'border-teal bg-teal/15 text-cream' : id === target ? 'border-pink bg-pink/15 text-cream' : 'border-white/10 text-cream/50';
              return (<li key={id}><button type="button" disabled={done !== null} onClick={() => chooseTarget(id)} className={`${chip} ${mark}`}>{c.label(id)}</button></li>);
            })}
          </ul>
        </section>
      )}
      {done !== null && (
        <section className={fb(done)} role="status">
          <p className="font-display text-xl font-semibold">{done ? 'Верно!' : 'Неверно'}</p>
          <p className="mt-2 text-cream/85">{task.explain}</p>
        </section>
      )}
    </>
  );
}

// ---------- СРАВНЕНИЕ БЛЮД ----------
const SIDES: [Side, string][] = [['both', 'Оба'], ['a', 'Только A'], ['b', 'Только B']];
export function CompareView({ task, c, onAnswer }: P<'compare'>) {
  const [a, b] = task.dishIds.map((id) => c.byId.get(id)!);
  const [ans, setAns] = useState<Record<string, Side>>({});
  const [res, setRes] = useState<boolean | null>(null);
  const checkLock = useRef(false);
  const rows = useMemo(() => task.rows, [task]);
  const ready = rows.every((r) => ans[r]);
  function check() {
    if (checkLock.current || res !== null) return;
    checkLock.current = true;
    const wrong = rows.filter((r) => ans[r] !== task.truth[r]);
    const ok = wrong.length === 0;
    setRes(ok);
    const word = (s: Side) => (s === 'both' ? 'оба' : s === 'a' ? a.name : b.name);
    onAnswer({ ok, given: rows.map((r) => `${c.label(r)}: ${word(ans[r])}`), expected: rows.map((r) => `${c.label(r)}: ${word(task.truth[r])}`) });
  }
  return (
    <>
      <h1 className="font-display text-xl font-extrabold sm:text-2xl">Сравни блюда</h1>
      <p className="mt-3 text-cream/85"><b className="text-pink">A</b> — {a.name}<br /><b className="text-teal">B</b> — {b.name}</p>
      <p className="mt-3 text-cream/70">Для каждого ингредиента отметь: он есть в обоих блюдах или только в одном.</p>
      <ul className="mt-4 grid gap-3">
        {rows.map((r) => (
          <li key={r} className="panel p-3">
            <p className="font-semibold">{c.label(r)}{res !== null && <span className={ans[r] === task.truth[r] ? ' text-teal' : ' text-pink'}> {ans[r] === task.truth[r] ? '✓' : `✗ (${SIDES.find(([s]) => s === task.truth[r])![1]})`}</span>}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SIDES.map(([s, label]) => (<button key={s} type="button" disabled={res !== null} onClick={() => setAns((current) => ({ ...current, [r]: s }))} className={`min-h-[44px] rounded-lg border-2 px-2 text-sm font-bold ${ans[r] === s ? 'border-pink bg-pink/20' : 'border-white/15 text-cream/80'}`}>{label}</button>))}
            </div>
          </li>
        ))}
      </ul>
      {res === null && <button className="btn-primary mt-5 w-full disabled:opacity-40" disabled={!ready} onClick={check}>Проверить</button>}
      {res !== null && (
        <section className={fb(res)} role="status">
          <p className="font-display text-xl font-semibold">{res ? 'Всё верно!' : 'Есть ошибки'}</p>
          <p className="mt-2 text-cream/85">Общие: {c.list(rows.filter((r) => task.truth[r] === 'both')) || 'нет'}.<br />Только в «{a.name}»: {c.list(rows.filter((r) => task.truth[r] === 'a')) || 'нет'}.<br />Только в «{b.name}»: {c.list(rows.filter((r) => task.truth[r] === 'b')) || 'нет'}.</p>
        </section>
      )}
    </>
  );
}
