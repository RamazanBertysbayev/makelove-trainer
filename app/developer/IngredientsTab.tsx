'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminSb, dropMenuCache, errText } from '@/lib/adminClient';
import { norm } from '@/lib/menu';

type Ing = { id: string; name: string; origin: string };
type Alias = { id: string; ingredient_id: string; alias: string };
type Link = { dish_id: string; ingredient_id: string };
type Dish = { id: string; name: string };

const field = 'min-h-[44px] w-full rounded-xl border border-white/15 bg-plum/70 px-3 text-cream placeholder:text-cream/40';
const smallBtn = 'min-h-[40px] rounded-xl border-2 px-4 text-sm font-bold';

export default function IngredientsTab() {
  const [ings, setIngs] = useState<Ing[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [q, setQ] = useState('');
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = adminSb();
      const [i, a, l, d] = await Promise.all([
        s.from('ingredients').select('id,name,origin').eq('is_active', true).order('name'),
        s.from('ingredient_aliases').select('id,ingredient_id,alias').order('alias'),
        s.from('dish_ingredients').select('dish_id,ingredient_id'),
        s.from('dishes').select('id,name'),
      ]);
      for (const r of [i, a, l, d]) if (r.error) throw r.error;
      setIngs(i.data as Ing[]); setAliases(a.data as Alias[]); setLinks(l.data as Link[]); setDishes(d.data as Dish[]);
      setErr(''); setReady(true);
    } catch (e) { setErr(errText(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const dishName = useMemo(() => new Map(dishes.map((d) => [d.id, d.name])), [dishes]);
  const aliasBy = useMemo(() => {
    const m = new Map<string, Alias[]>();
    for (const a of aliases) { const x = m.get(a.ingredient_id) ?? []; x.push(a); m.set(a.ingredient_id, x); }
    return m;
  }, [aliases]);
  const dishesBy = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of links) { const x = m.get(l.ingredient_id) ?? []; x.push(l.dish_id); m.set(l.ingredient_id, x); }
    return m;
  }, [links]);

  async function run(fn: () => PromiseLike<{ error: unknown }>, okText: string, after?: () => void) {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) { setMsg({ ok: false, t: errText(error) }); return false; }
    dropMenuCache(); await load(); after?.(); setMsg({ ok: true, t: okText });
    return true;
  }

  async function addNew() {
    const n = newName.trim().replace(/\s+/g, ' ');
    if (!n) return;
    await run(() => adminSb().from('ingredients').insert({ name: n, origin: 'admin' }), `Добавлен ингредиент «${n}».`, () => setNewName(''));
  }

  const nq = norm(q);
  const list = ings.filter((i) => {
    if (onlyUnused && (dishesBy.get(i.id)?.length ?? 0) > 0) return false;
    if (!nq) return true;
    return norm(i.name).includes(nq) || (aliasBy.get(i.id) ?? []).some((a) => norm(a.alias).includes(nq));
  });

  if (err && !ready) return <p className="panel p-5 text-pink" role="alert">{err}</p>;
  if (!ready) return <p className="text-cream/70">Загружаю…</p>;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input className={field} placeholder="Поиск по названию или алиасу" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск ингредиента" />
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={onlyUnused} onChange={(e) => setOnlyUnused(e.target.checked)} /> Только неиспользуемые</label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input className={field + ' max-w-sm'} placeholder="Новый ингредиент" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Название нового ингредиента" onKeyDown={(e) => { if (e.key === 'Enter') addNew(); }} />
        <button className={smallBtn + ' border-teal text-teal hover:bg-teal/10'} onClick={addNew} disabled={busy}>Добавить</button>
      </div>
      {msg && <p role="status" className={`mt-3 ${msg.ok ? 'text-teal' : 'text-pink'}`}>{msg.t}</p>}
      <p className="mt-4 text-sm text-cream/60">Ингредиентов: {list.length} из {ings.length}</p>

      <ul className="mt-3 space-y-2">
        {list.map((i) => {
          const used = dishesBy.get(i.id) ?? [];
          const open = openId === i.id;
          return (
            <li key={i.id} className="panel">
              <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : i.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                <span className="font-semibold">{i.name}</span>
                <span className="shrink-0 text-xs text-cream/60">блюд: {used.length} · алиасов: {aliasBy.get(i.id)?.length ?? 0}</span>
              </button>
              {open && (
                <Detail
                  ing={i} all={ings} aliases={aliasBy.get(i.id) ?? []} used={used.map((id) => dishName.get(id) ?? '?')} busy={busy}
                  onRename={(n) => run(() => adminSb().from('ingredients').update({ name: n }).eq('id', i.id), 'Переименовано. Старое название осталось алиасом.')}
                  onDelete={() => run(() => adminSb().from('ingredients').delete().eq('id', i.id), 'Ингредиент удалён.', () => setOpenId(null))}
                  onMerge={(keep, drop) => run(() => adminSb().rpc('admin_merge_ingredients', { p_keep: keep, p_merge: drop }), 'Объединено. Алиасы и связи с блюдами перенесены.', () => setOpenId(keep))}
                  onSplit={(ids, nm) => run(() => adminSb().rpc('admin_split_ingredient', { p_ingredient: i.id, p_alias_ids: ids, p_new_name: nm || null }), 'Выделено в отдельный ингредиент.')}
                />
              )}
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="mt-6 text-cream/70">Ничего не найдено.</p>}
    </>
  );
}

function Detail(props: {
  ing: Ing; all: Ing[]; aliases: Alias[]; used: string[]; busy: boolean;
  onRename: (n: string) => Promise<boolean>; onDelete: () => Promise<boolean>;
  onMerge: (keep: string, drop: string) => Promise<boolean>; onSplit: (ids: string[], name: string) => Promise<boolean>;
}) {
  const { ing, aliases, busy } = props;
  const [name, setName] = useState(ing.name);
  const [other, setOther] = useState('');
  const [keepThis, setKeepThis] = useState(true);
  const [sel, setSel] = useState<string[]>([]);
  const [splitName, setSplitName] = useState('');

  const otherIng = props.all.find((x) => x.id === other);
  const mine = norm(ing.name);
  const movable = aliases.filter((a) => norm(a.alias) !== mine);
  const canDelete = props.used.length === 0;

  return (
    <div className="space-y-5 border-t border-white/10 px-4 py-4">
      <div>
        <p className="text-sm font-semibold">Используется в блюдах</p>
        <p className="mt-1 text-sm text-cream/70">{props.used.length ? props.used.join(', ') : 'ни в одном'}</p>
      </div>

      <div>
        <p className="text-sm font-semibold">Алиасы (все названия из меню)</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {aliases.map((a) => (
            <li key={a.id} className={`rounded-full border px-3 py-1 text-sm ${norm(a.alias) === mine ? 'border-pink text-pink' : 'border-white/25 text-cream/80'}`}>{a.alias}</li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-cream/50">Розовым выделено текущее название.</p>
      </div>

      <div>
        <p className="text-sm font-semibold">Переименовать</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input className={field + ' max-w-sm'} value={name} onChange={(e) => setName(e.target.value)} aria-label="Новое название" />
          <button className={smallBtn + ' border-teal text-teal hover:bg-teal/10'} disabled={busy || !name.trim() || name.trim() === ing.name} onClick={() => props.onRename(name.trim())}>Сохранить</button>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold">Объединить с другим ингредиентом</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className={field + ' max-w-sm'} value={other} onChange={(e) => setOther(e.target.value)} aria-label="Ингредиент для объединения">
            <option value="">Выберите ингредиент…</option>
            {props.all.filter((x) => x.id !== ing.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        {otherIng && (
          <div className="mt-3 space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={keepThis} onChange={() => setKeepThis(true)} /> Оставить «{ing.name}», «{otherIng.name}» станет его алиасом</label>
            <label className="flex items-center gap-2"><input type="radio" checked={!keepThis} onChange={() => setKeepThis(false)} /> Оставить «{otherIng.name}», «{ing.name}» станет его алиасом</label>
            <button className={smallBtn + ' border-sun text-sun hover:bg-sun/10'} disabled={busy}
              onClick={() => { if (window.confirm(`Объединить «${ing.name}» и «${otherIng.name}»? Это можно отменить через «Разделить».`)) props.onMerge(keepThis ? ing.id : otherIng.id, keepThis ? otherIng.id : ing.id); }}>
              Объединить
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold">Разделить: выделить алиасы в отдельный ингредиент</p>
        {movable.length === 0 ? (
          <p className="mt-1 text-sm text-cream/60">Нет алиасов, которые можно выделить (название ингредиента выделить нельзя).</p>
        ) : (
          <div className="mt-2 space-y-2">
            <ul className="flex flex-wrap gap-2">
              {movable.map((a) => (
                <li key={a.id}>
                  <label className={`flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${sel.includes(a.id) ? 'border-teal text-teal' : 'border-white/25'}`}>
                    <input type="checkbox" checked={sel.includes(a.id)} onChange={(e) => setSel(e.target.checked ? [...sel, a.id] : sel.filter((x) => x !== a.id))} /> {a.alias}
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <input className={field + ' max-w-sm'} placeholder="Название нового ингредиента (необязательно)" value={splitName} onChange={(e) => setSplitName(e.target.value)} />
              <button className={smallBtn + ' border-sun text-sun hover:bg-sun/10'} disabled={busy || sel.length === 0}
                onClick={async () => { if (await props.onSplit(sel, splitName.trim())) { setSel([]); setSplitName(''); } }}>Выделить</button>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold">Удалить</p>
        {canDelete ? (
          <button className={smallBtn + ' mt-2 border-pink text-pink hover:bg-pink/10'} disabled={busy}
            onClick={() => { if (window.confirm(`Удалить «${ing.name}» вместе с алиасами?`)) props.onDelete(); }}>Удалить ингредиент</button>
        ) : (
          <p className="mt-1 text-sm text-cream/60">Ингредиент используется в блюдах. Уберите его из составов или объедините с другим.</p>
        )}
      </div>
    </div>
  );
}
