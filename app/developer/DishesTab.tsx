'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminSb, dropMenuCache, errText, PHOTO_BUCKET, photoUrl } from '@/lib/adminClient';
import { norm } from '@/lib/menu';

type Status = 'confirmed' | 'no_data' | 'needs_review';
type Cat = { id: string; name: string; sort_order: number };
type Dish = { id: string; category_id: string; kind: 'dish' | 'bundle'; name: string; status: Status; note: string | null; photo_path: string | null; sort_order: number };
type Ing = { id: string; name: string };
type Alias = { ingredient_id: string; alias: string };
type Link = { dish_id: string; ingredient_id: string; position: number };

const STATUS: Record<Status, string> = { confirmed: 'Подтверждено', needs_review: 'Требует проверки', no_data: 'Нет данных' };
const field = 'min-h-[44px] w-full rounded-xl border border-white/15 bg-plum/70 px-3 text-cream placeholder:text-cream/40';

export default function DishesTab() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ings, setIngs] = useState<Ing[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [st, setSt] = useState('all');
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const createLock = useRef(false);
  const deleteLock = useRef(false);

  const load = useCallback(async () => {
    try {
      const s = adminSb();
      const [c, d, i, a, l] = await Promise.all([
        s.from('categories').select('id,name,sort_order').order('sort_order'),
        s.from('dishes').select('id,category_id,kind,name,status,note,photo_path,sort_order').order('sort_order'),
        s.from('ingredients').select('id,name').eq('is_active', true).order('name'),
        s.from('ingredient_aliases').select('ingredient_id,alias'),
        s.from('dish_ingredients').select('dish_id,ingredient_id,position').order('position'),
      ]);
      for (const r of [c, d, i, a, l]) if (r.error) throw r.error;
      setCats(c.data as Cat[]); setDishes(d.data as Dish[]); setIngs(i.data as Ing[]);
      setAliases(a.data as Alias[]); setLinks(l.data as Link[]); setErr(''); setReady(true);
    } catch (e) { setErr(errText(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const catName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats]);
  const ingName = useMemo(() => new Map(ings.map((i) => [i.id, i.name])), [ings]);
  const byDish = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of links) { const a = m.get(l.dish_id) ?? []; a.push(l.ingredient_id); m.set(l.dish_id, a); }
    return m;
  }, [links]);

  const list = dishes.filter((d) =>
    (cat === 'all' || d.category_id === cat) && (st === 'all' || d.status === st) && (!q || norm(d.name).includes(norm(q))));

  const editing = dishes.find((d) => d.id === editId) ?? null;

  async function createDish() {
    const cleanName = newName.trim().replace(/\s+/g, ' ');
    if (!cleanName || createLock.current || !cats.length) return;
    createLock.current = true; setCreateBusy(true); setCreateMsg('');
    try {
      const s = adminSb();
      const { data, error } = await s.from('dishes').insert({
        category_id: cats[0].id, kind: 'dish', name: cleanName, status: 'needs_review',
        note: null, sort_order: Math.max(0, ...dishes.map((d) => d.sort_order)) + 1,
      }).select('id').single();
      if (error) throw error;
      setNewName(''); dropMenuCache(); await load(); setEditId(data.id);
    } catch (e) { setCreateMsg(errText(e)); }
    finally { createLock.current = false; setCreateBusy(false); }
  }

  async function deleteDish(id: string) {
    const target = dishes.find((d) => d.id === id);
    if (deleteLock.current || !target || !window.confirm(`Удалить блюдо «${target.name}»? Это действие нельзя отменить.`)) return;
    deleteLock.current = true;
    try {
      const s = adminSb();
      const { error } = await s.from('dishes').delete().eq('id', id);
      if (error) { window.alert(errText(error)); return; }
      if (target.photo_path) await s.storage.from(PHOTO_BUCKET).remove([target.photo_path]);
      setEditId(null); dropMenuCache(); await load();
    } finally { deleteLock.current = false; }
  }

  if (err && !ready) return <p className="panel p-5 text-pink" role="alert">{err}</p>;
  if (!ready) return <p className="text-cream/70">Загружаю…</p>;

  if (editing) {
    return (
      <DishEditor
        key={editing.id}
        dish={editing} cats={cats} ings={ings} aliases={aliases}
        initial={byDish.get(editing.id) ?? []}
        onClose={() => setEditId(null)}
        onDelete={() => deleteDish(editing.id)}
        onSaved={async () => { dropMenuCache(); await load(); }}
        onIngCreated={async () => { await load(); }}
        ingName={ingName}
      />
    );
  }

  return (
    <>
      <div className="panel mb-5 flex flex-wrap gap-3 p-4">
        <input className={field + ' max-w-md'} placeholder="Название нового блюда" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void createDish(); }} />
        <button type="button" className="btn-primary" disabled={createBusy || !newName.trim() || !cats.length} onClick={() => void createDish()}>{createBusy ? 'Создаю…' : 'Добавить блюдо'}</button>
        {createMsg && <p role="alert" className="w-full text-sm text-pink">{createMsg}</p>}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <input className={field} placeholder="Поиск по названию" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск по названию" />
        <select className={field} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Категория">
          <option value="all">Все категории</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={field} value={st} onChange={(e) => setSt(e.target.value)} aria-label="Статус">
          <option value="all">Все статусы</option>
          {(Object.keys(STATUS) as Status[]).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}
        </select>
      </div>
      <p className="mt-4 text-sm text-cream/60">Блюд: {list.length}</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((d) => {
          const n = byDish.get(d.id)?.length ?? 0;
          const url = photoUrl(d.photo_path);
          return (
            <li key={d.id}>
              <button type="button" onClick={() => setEditId(d.id)} className="panel flex w-full items-center gap-3 p-3 text-left hover:border-teal/60">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-night text-xs text-cream/40">
                  {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : 'нет фото'}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-teal">{catName.get(d.category_id)}{d.kind === 'bundle' && ' · набор'}</span>
                  <span className="block truncate font-display font-semibold">{d.name}</span>
                  <span className="block text-xs text-cream/60">{STATUS[d.status]}{d.kind === 'dish' && ` · ингредиентов: ${n}`}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function DishEditor(props: {
  dish: Dish; cats: Cat[]; ings: Ing[]; aliases: Alias[]; initial: string[]; ingName: Map<string, string>;
  onClose: () => void; onDelete: () => Promise<void>; onSaved: () => Promise<void>; onIngCreated: () => Promise<void>;
}) {
  const { dish, cats, ings, aliases, ingName } = props;
  const [name, setName] = useState(dish.name);
  const [status, setStatus] = useState<Status>(dish.status);
  const [note, setNote] = useState(dish.note ?? '');
  const [catId, setCatId] = useState(dish.category_id);
  const [list, setList] = useState<string[]>(props.initial);
  const [photoPath, setPhotoPath] = useState<string | null>(dish.photo_path);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [localIngs, setLocalIngs] = useState<Ing[]>([]);
  const busyRef = useRef(false);

  const all = useMemo(() => [...ings, ...localIngs.filter((x) => !ings.some((i) => i.id === x.id))], [ings, localIngs]);
  const nameOf = (id: string) => ingName.get(id) ?? all.find((i) => i.id === id)?.name ?? '???';

  const aliasByIng = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of aliases) { const x = m.get(a.ingredient_id) ?? []; x.push(a.alias); m.set(a.ingredient_id, x); }
    return m;
  }, [aliases]);

  const nq = norm(q);
  const matches = nq
    ? all.filter((i) => !list.includes(i.id) && (norm(i.name).includes(nq) || (aliasByIng.get(i.id) ?? []).some((a) => norm(a).includes(nq)))).slice(0, 8)
    : [];
  const exact = nq ? all.some((i) => norm(i.name) === nq) || aliases.some((a) => norm(a.alias) === nq) : false;

  function pickFile(f: File | null) {
    setMsg(null);
    if (preview) URL.revokeObjectURL(preview);
    if (!f) { setFile(null); setPreview(null); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { setMsg({ ok: false, t: 'Фото: только JPG, PNG или WebP.' }); return; }
    if (f.size > 2 * 1024 * 1024) { setMsg({ ok: false, t: 'Фото больше 2 МБ. Сожмите его и загрузите снова.' }); return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  }

  function move(i: number, d: -1 | 1) {
    const j = i + d; if (j < 0 || j >= list.length) return;
    const a = [...list]; [a[i], a[j]] = [a[j], a[i]]; setList(a);
  }

  async function createIngredient() {
    const n = q.trim().replace(/\s+/g, ' ');
    if (!n || busyRef.current) return;
    busyRef.current = true; setBusy(true); setMsg(null);
    const { data, error } = await adminSb().from('ingredients').insert({ name: n, origin: 'admin' }).select('id,name').single();
    setBusy(false); busyRef.current = false;
    if (error) { setMsg({ ok: false, t: errText(error) }); return; }
    setLocalIngs((p) => [...p, data as Ing]);
    setList((p) => [...p, (data as Ing).id]); setQ('');
    props.onIngCreated();
  }

  async function save() {
    if (!name.trim()) { setMsg({ ok: false, t: 'Название не может быть пустым.' }); return; }
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMsg(null);
    const s = adminSb();
    try {
      let newPhoto = photoPath;
      let uploaded: string | null = null;
      if (file) {
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${dish.id}/${Date.now()}.${ext}`;
        const up = await s.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' });
        if (up.error) throw up.error;
        newPhoto = path; uploaded = path;
      }
      const upd = await s.from('dishes').update({
        name: name.trim(), status, note: note.trim() || null, category_id: catId, photo_path: newPhoto, manually_edited: true,
      }).eq('id', dish.id);
      if (upd.error) {
        if (uploaded) await s.storage.from(PHOTO_BUCKET).remove([uploaded]);
        throw upd.error;
      }
      if (dish.photo_path && dish.photo_path !== newPhoto) await s.storage.from(PHOTO_BUCKET).remove([dish.photo_path]);

      if (dish.kind === 'dish') {
        const before = props.initial;
        const removed = before.filter((id) => !list.includes(id));
        if (removed.length) {
          const r = await s.from('dish_ingredients').delete().eq('dish_id', dish.id).in('ingredient_id', removed);
          if (r.error) throw r.error;
        }
        const keep = list.map((id, position) => ({ id, position })).filter((x) => before.includes(x.id));
        for (const x of keep) {
          const r = await s.from('dish_ingredients').update({ position: x.position }).eq('dish_id', dish.id).eq('ingredient_id', x.id);
          if (r.error) throw r.error;
        }
        const added = list.map((id, position) => ({ dish_id: dish.id, ingredient_id: id, position, origin: 'admin' })).filter((x) => !before.includes(x.ingredient_id));
        if (added.length) {
          const r = await s.from('dish_ingredients').insert(added);
          if (r.error) throw r.error;
        }
      }
      setFile(null); setPreview(null); setPhotoPath(newPhoto);
      await props.onSaved();
      setMsg({ ok: true, t: 'Сохранено.' });
    } catch (e) {
      setMsg({ ok: false, t: errText(e) });
    } finally { busyRef.current = false; setBusy(false); }
  }

  const shown = preview ?? photoUrl(photoPath);
  return (
    <div className="space-y-5">
      <button className="btn-ghost min-h-[40px] px-4 text-sm" onClick={props.onClose}>← К списку</button>
      <section className="panel space-y-4 p-5">
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <div>
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-night text-sm text-cream/40">
              {shown ? <img src={shown} alt="Фото блюда" className="h-full w-full object-cover" /> : 'нет фото'}
            </div>
            <label className="btn-ghost mt-3 w-full cursor-pointer text-sm">
              {shown ? 'Заменить фото' : 'Загрузить фото'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            </label>
            {(shown) && <button type="button" className="mt-2 w-full text-sm text-cream/60 underline" onClick={() => { pickFile(null); setPhotoPath(null); }}>Убрать фото</button>}
            <p className="mt-2 text-xs text-cream/50">JPG, PNG или WebP до 2 МБ.</p>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-semibold">Название
              <input className={field + ' mt-1'} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Категория
                <select className={field + ' mt-1'} value={catId} onChange={(e) => setCatId(e.target.value)}>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">Статус
                <select className={field + ' mt-1'} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                  {(Object.keys(STATUS) as Status[]).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs text-cream/50">В тренировку попадают только блюда со статусом «Подтверждено» и непустым составом.</p>
            <label className="block text-sm font-semibold">Заметка
              <textarea className={field + ' mt-1 py-2'} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
        </div>
      </section>

      {dish.kind === 'dish' ? (
        <section className="panel space-y-4 p-5">
          <h2 className="font-display text-lg font-semibold">Состав</h2>
          {list.length === 0 && <p className="text-sm text-cream/60">Состав пуст.</p>}
          <ol className="space-y-2">
            {list.map((id, i) => (
              <li key={id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-night/40 px-3 py-2">
                <span className="w-6 text-sm text-cream/50">{i + 1}.</span>
                <span className="flex-1">{nameOf(id)}</span>
                <button type="button" aria-label="Выше" className="min-h-[36px] min-w-[36px] rounded-lg border border-white/15 hover:border-teal" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                <button type="button" aria-label="Ниже" className="min-h-[36px] min-w-[36px] rounded-lg border border-white/15 hover:border-teal" onClick={() => move(i, 1)} disabled={i === list.length - 1}>↓</button>
                <button type="button" aria-label={`Убрать ${nameOf(id)}`} className="min-h-[36px] min-w-[36px] rounded-lg border border-pink/60 text-pink hover:bg-pink/10" onClick={() => setList(list.filter((x) => x !== id))}>✕</button>
              </li>
            ))}
          </ol>
          <div>
            <input className={field} placeholder="Добавить ингредиент: начните вводить название" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск ингредиента" />
            {nq && (
              <ul className="mt-2 space-y-1">
                {matches.map((i) => (
                  <li key={i.id}><button type="button" className="w-full rounded-lg border border-white/10 px-3 py-2 text-left hover:border-teal" onClick={() => { setList([...list, i.id]); setQ(''); }}>+ {i.name}</button></li>
                ))}
                {!exact && (
                  <li><button type="button" disabled={busy} className="w-full rounded-lg border border-sun/70 px-3 py-2 text-left text-sun hover:bg-sun/10" onClick={createIngredient}>Создать новый ингредиент «{q.trim()}»</button></li>
                )}
                {matches.length === 0 && exact && <li className="px-1 text-sm text-cream/60">Этот ингредиент уже в составе (или объединён с другим).</li>}
              </ul>
            )}
          </div>
        </section>
      ) : (
        <p className="panel p-5 text-sm text-cream/70">Это набор из пицц: у наборов нет состава из ингредиентов, можно менять название, фото, категорию и статус.</p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
        <button type="button" className="btn-ghost !border-pink !text-pink" disabled={busy} onClick={() => void props.onDelete()}>Удалить блюдо</button>
        {msg && <p role="status" className={msg.ok ? 'text-teal' : 'text-pink'}>{msg.t}</p>}
      </div>
    </div>
  );
}
