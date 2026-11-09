'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminSb, dropMenuCache, errText } from '@/lib/adminClient';
import { norm } from '@/lib/menu';

type Opt = { id: string; label: string; is_correct: boolean; sort_order: number };
type Q = { id: string; dish_id: string; prompt: string; explanation: string | null; sort_order: number; is_active: boolean; options: Opt[] };
type Dish = { id: string; name: string };
type Draft = { id: string | null; dish_id: string; prompt: string; explanation: string; is_active: boolean; options: { label: string; is_correct: boolean }[] };

const field = 'min-h-[44px] w-full rounded-xl border border-white/15 bg-plum/70 px-3 text-cream placeholder:text-cream/40';
const smallBtn = 'min-h-[40px] rounded-xl border-2 px-4 text-sm font-bold';
const emptyDraft = (): Draft => ({ id: null, dish_id: '', prompt: '', explanation: '', is_active: true, options: [{ label: '', is_correct: true }, { label: '', is_correct: false }] });

export default function QuestionsTab() {
  const [qs, setQs] = useState<Q[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const s = adminSb();
      const [q, d] = await Promise.all([
        s.from('custom_questions').select('id,dish_id,prompt,explanation,sort_order,is_active,custom_options(id,label,is_correct,sort_order)').order('sort_order'),
        s.from('dishes').select('id,name').order('name'),
      ]);
      if (q.error) throw q.error;
      if (d.error) throw d.error;
      type Raw = Omit<Q, 'options'> & { custom_options: Opt[] };
      setQs((q.data as unknown as Raw[]).map(({ custom_options, ...r }) => ({ ...r, options: [...custom_options].sort((a, b) => a.sort_order - b.sort_order) })));
      setDishes(d.data as Dish[]);
      setErr(''); setReady(true);
    } catch (e) {
      const m = errText(e);
      setErr(/custom_questions|does not exist|42P01|schema cache/i.test(m) ? 'Таблицы вопросов ещё не созданы. Запустите sql/05_custom_questions.sql в Supabase → SQL Editor.' : m);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const dishName = useMemo(() => new Map(dishes.map((d) => [d.id, d.name])), [dishes]);

  // Одна операция за раз: повторные нажатия во время запроса игнорируются.
  async function run(fn: () => PromiseLike<{ error: unknown }>, okText: string, after?: () => void) {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setMsg(null);
    try {
      const { error } = await fn();
      if (error) { setMsg({ ok: false, t: errText(error) }); return false; }
      dropMenuCache(); await load(); after?.(); setMsg({ ok: true, t: okText });
      return true;
    } catch (e) { setMsg({ ok: false, t: errText(e) }); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }

  function edit(q: Q) {
    setMsg(null);
    setDraft({ id: q.id, dish_id: q.dish_id, prompt: q.prompt, explanation: q.explanation ?? '', is_active: q.is_active, options: q.options.map((o) => ({ label: o.label, is_correct: o.is_correct })) });
  }

  async function save() {
    if (!draft) return;
    const labels = draft.options.map((o) => o.label.trim());
    if (!draft.dish_id) return setMsg({ ok: false, t: 'Выберите блюдо, к которому относится вопрос.' });
    if (!draft.prompt.trim()) return setMsg({ ok: false, t: 'Введите текст вопроса.' });
    if (draft.options.length < 2) return setMsg({ ok: false, t: 'Нужно минимум два варианта ответа.' });
    if (labels.some((l) => !l)) return setMsg({ ok: false, t: 'Заполните или удалите пустые варианты ответа.' });
    if (new Set(labels.map(norm)).size !== labels.length) return setMsg({ ok: false, t: 'Варианты ответа не должны повторяться.' });
    if (draft.options.filter((o) => o.is_correct).length !== 1) return setMsg({ ok: false, t: 'Отметьте ровно один правильный ответ.' });
    await run(() => adminSb().rpc('admin_save_question', {
      p_id: draft.id, p_dish: draft.dish_id, p_prompt: draft.prompt, p_explanation: draft.explanation,
      p_active: draft.is_active, p_options: draft.options.map((o) => ({ label: o.label, is_correct: o.is_correct })),
    }), draft.id ? 'Вопрос сохранён.' : 'Вопрос добавлен.', () => setDraft(null));
  }

  async function remove(q: Q) {
    if (busyRef.current || !window.confirm(`Удалить вопрос «${q.prompt}» вместе с вариантами ответов? Это действие нельзя отменить.`)) return;
    await run(() => adminSb().from('custom_questions').delete().eq('id', q.id), 'Вопрос удалён.');
  }

  async function move(i: number, dir: -1 | 1) {
    const a = qs[i], b = qs[i + dir];
    if (!a || !b || busyRef.current) return;
    await run(async () => {
      const s = adminSb();
      const r1 = await s.from('custom_questions').update({ sort_order: b.sort_order }).eq('id', a.id);
      if (r1.error) return r1;
      return s.from('custom_questions').update({ sort_order: a.sort_order }).eq('id', b.id);
    }, 'Порядок изменён.');
  }

  async function toggle(q: Q) {
    await run(() => adminSb().from('custom_questions').update({ is_active: !q.is_active }).eq('id', q.id), q.is_active ? 'Вопрос скрыт из игр.' : 'Вопрос включён.');
  }

  const setOpt = (i: number, patch: Partial<Draft['options'][number]>) => setDraft((d) => d && ({ ...d, options: d.options.map((o, k) => (k === i ? { ...o, ...patch } : o)) }));
  const markCorrect = (i: number) => setDraft((d) => d && ({ ...d, options: d.options.map((o, k) => ({ ...o, is_correct: k === i })) }));
  const moveOpt = (i: number, dir: -1 | 1) => setDraft((d) => {
    if (!d || !d.options[i + dir]) return d;
    const o = [...d.options]; [o[i], o[i + dir]] = [o[i + dir], o[i]];
    return { ...d, options: o };
  });
  const removeOpt = (i: number) => setDraft((d) => {
    if (!d || d.options.length <= 2) return d;
    const o = d.options.filter((_, k) => k !== i);
    if (!o.some((x) => x.is_correct)) o[0] = { ...o[0], is_correct: true };
    return { ...d, options: o };
  });

  if (err && !ready) return <p className="panel p-5 text-pink" role="alert">{err}</p>;
  if (!ready) return <p className="text-cream/70">Загружаю…</p>;

  const nq = norm(search);
  const list = qs.map((q, i) => ({ q, i })).filter(({ q }) => !nq || norm(q.prompt).includes(nq) || norm(dishName.get(q.dish_id) ?? '').includes(nq));

  return (
    <>
      <p className="mb-4 text-sm text-cream/70">Свои вопросы подмешиваются в «Квиз» и «Свободную практику» (примерно каждый второй квиз-вопрос). Остальные режимы строятся из составов блюд и вопросов не используют.</p>

      {!draft && (
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={() => { setMsg(null); setDraft(emptyDraft()); }} disabled={busy}>Новый вопрос</button>
          <input className={field + ' max-w-sm'} placeholder="Поиск по вопросу или блюду" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск вопроса" />
        </div>
      )}
      {msg && <p role="status" className={`mt-3 ${msg.ok ? 'text-teal' : 'text-pink'}`}>{msg.t}</p>}

      {draft && (
        <section className="panel mt-4 space-y-4 p-5">
          <h2 className="font-display text-xl font-extrabold">{draft.id ? 'Редактирование вопроса' : 'Новый вопрос'}</h2>
          <label className="block text-sm font-semibold">Блюдо
            <select className={field + ' mt-1'} value={draft.dish_id} onChange={(e) => setDraft({ ...draft, dish_id: e.target.value })}>
              <option value="">Выберите блюдо…</option>
              {dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Вопрос
            <textarea className={field + ' mt-1 min-h-[80px] py-2'} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} />
          </label>
          <div>
            <p className="text-sm font-semibold">Варианты ответа (отметьте правильный)</p>
            <ul className="mt-2 space-y-2">
              {draft.options.map((o, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <input type="radio" name="correct" className="h-5 w-5" checked={o.is_correct} onChange={() => markCorrect(i)} aria-label={`Вариант ${i + 1} правильный`} />
                  <input className={field + ' min-w-[200px] flex-1'} value={o.label} placeholder={`Вариант ${i + 1}`} onChange={(e) => setOpt(i, { label: e.target.value })} aria-label={`Текст варианта ${i + 1}`} />
                  <button type="button" className={smallBtn + ' border-white/20 px-3'} disabled={i === 0} onClick={() => moveOpt(i, -1)} aria-label="Вариант выше">↑</button>
                  <button type="button" className={smallBtn + ' border-white/20 px-3'} disabled={i === draft.options.length - 1} onClick={() => moveOpt(i, 1)} aria-label="Вариант ниже">↓</button>
                  <button type="button" className={smallBtn + ' border-pink px-3 text-pink'} disabled={draft.options.length <= 2} onClick={() => removeOpt(i)} aria-label="Удалить вариант">✕</button>
                </li>
              ))}
            </ul>
            <button type="button" className={smallBtn + ' mt-2 border-teal text-teal hover:bg-teal/10'} disabled={draft.options.length >= 8}
              onClick={() => setDraft({ ...draft, options: [...draft.options, { label: '', is_correct: false }] })}>Добавить вариант</button>
          </div>
          <label className="block text-sm font-semibold">Пояснение после ответа (необязательно)
            <textarea className={field + ' mt-1 min-h-[60px] py-2'} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} /> Показывать в играх</label>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
            <button className="btn-ghost" disabled={busy} onClick={() => { setDraft(null); setMsg(null); }}>Отмена</button>
          </div>
        </section>
      )}

      {!draft && (
        <>
          <p className="mt-4 text-sm text-cream/60">Вопросов: {list.length} из {qs.length}</p>
          <ul className="mt-3 space-y-2">
            {list.map(({ q, i }) => (
              <li key={q.id} className="panel space-y-2 p-4">
                <p className="font-semibold">{q.prompt}</p>
                <p className="text-sm text-cream/70">Блюдо: {dishName.get(q.dish_id) ?? '—'} · Правильный ответ: <span className="text-teal">{q.options.find((o) => o.is_correct)?.label}</span> · Вариантов: {q.options.length}{!q.is_active && <span className="text-sun"> · скрыт</span>}</p>
                <div className="flex flex-wrap gap-2">
                  <button className={smallBtn + ' border-white/20 px-3'} disabled={busy || i === 0} onClick={() => void move(i, -1)} aria-label="Выше">↑</button>
                  <button className={smallBtn + ' border-white/20 px-3'} disabled={busy || i === qs.length - 1} onClick={() => void move(i, 1)} aria-label="Ниже">↓</button>
                  <button className={smallBtn + ' border-teal text-teal hover:bg-teal/10'} disabled={busy} onClick={() => edit(q)}>Изменить</button>
                  <button className={smallBtn + ' border-sun text-sun hover:bg-sun/10'} disabled={busy} onClick={() => void toggle(q)}>{q.is_active ? 'Скрыть' : 'Включить'}</button>
                  <button className={smallBtn + ' border-pink text-pink hover:bg-pink/10'} disabled={busy} onClick={() => void remove(q)}>Удалить</button>
                </div>
              </li>
            ))}
          </ul>
          {list.length === 0 && <p className="mt-6 text-cream/70">Вопросов пока нет.</p>}
        </>
      )}
    </>
  );
}
