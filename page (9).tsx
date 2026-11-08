'use client';
import { useEffect, useMemo, useState } from 'react';
import { getMenu, norm, type Menu } from '@/lib/menu';
import { configured } from '@/lib/supabase';

export default function MenuPage() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [ingQ, setIngQ] = useState('');

  useEffect(() => {
    if (!configured) { setErr('Сайт не подключён к базе (нет ключей Supabase).'); return; }
    getMenu().then(setMenu).catch((e) => setErr(e.message || 'Не удалось загрузить меню'));
  }, []);

  const ingName = useMemo(() => new Map((menu?.ingredients ?? []).map((i) => [i.id, i])), [menu]);
  const catName = useMemo(() => new Map((menu?.categories ?? []).map((c) => [c.id, c.name])), [menu]);

  const list = useMemo(() => {
    if (!menu) return [];
    const nq = norm(q), ni = norm(ingQ);
    return menu.dishes.filter((d) => {
      if (cat !== 'all' && d.category_id !== cat) return false;
      if (nq && !norm(d.name).includes(nq)) return false;
      if (ni) {
        const hit = d.ingredients.some((id) => { const i = ingName.get(id); return i && (norm(i.name).includes(ni) || i.aliases.some((a) => norm(a).includes(ni))); });
        if (!hit) return false;
      }
      return true;
    });
  }, [menu, q, cat, ingQ, ingName]);

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24">
      <h1 className="font-display py-8 text-3xl font-extrabold sm:text-4xl">Справочник меню</h1>
      {err && <p className="panel p-5 text-pink" role="alert">{err}</p>}
      {!menu && !err && <p className="text-cream/70">Загружаю меню…</p>}
      {menu && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="min-h-[48px] rounded-xl border border-white/15 bg-plum/70 px-4 text-cream placeholder:text-cream/40" placeholder="Поиск по названию" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск по названию" />
            <input className="min-h-[48px] rounded-xl border border-white/15 bg-plum/70 px-4 text-cream placeholder:text-cream/40" placeholder="Блюда с ингредиентом…" value={ingQ} onChange={(e) => setIngQ(e.target.value)} aria-label="Поиск по ингредиенту" />
            <select className="min-h-[48px] rounded-xl border border-white/15 bg-plum px-4 text-cream" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Категория">
              <option value="all">Все категории</option>
              {menu.categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <p className="mt-4 text-sm text-cream/60">Найдено: {list.length}{ingQ && ' · нажми на ингредиент, чтобы найти все блюда с ним'}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((d) => (
              <article key={d.id} className="panel flex flex-col p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal">{catName.get(d.category_id)}{d.kind === 'bundle' && ' · набор'}</p>
                <h2 className="font-display mt-1 text-lg font-semibold">{d.name}</h2>
                {d.status === 'needs_review' && <p className="mt-2 inline-block w-fit rounded-full border border-sun px-3 py-0.5 text-xs font-bold text-sun">Требует проверки</p>}
                {d.kind === 'bundle' ? (
                  <p className="mt-3 text-sm text-cream/60">Набор из пицц: состав не тренируется.</p>
                ) : d.ingredients.length === 0 ? (
                  <p className="mt-3 inline-block w-fit rounded-full border border-white/25 px-3 py-1 text-sm text-cream/70">Нет данных</p>
                ) : (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {d.ingredients.map((id) => { const i = ingName.get(id); return i ? (
                      <li key={id}><button type="button" onClick={() => { setIngQ(i.name); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-full border border-teal/60 px-3 py-1 text-sm text-teal hover:bg-teal/10">{i.name}</button></li>
                    ) : null; })}
                  </ul>
                )}
              </article>
            ))}
          </div>
          {list.length === 0 && <p className="mt-8 text-cream/70">Ничего не найдено.</p>}
        </>
      )}
    </main>
  );
}
