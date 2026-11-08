import { sb } from './supabase';

export type Category = { id: string; slug: string; name: string; sort_order: number };
export type Dish = { id: string; category_id: string; kind: 'dish' | 'bundle'; name: string; status: 'confirmed' | 'no_data' | 'needs_review'; photo_path: string | null; ingredients: string[] };
export type Ingredient = { id: string; name: string; aliases: string[] };
export type Menu = { categories: Category[]; dishes: Dish[]; ingredients: Ingredient[] };

const KEY = 'mlp_menu_v1';
const TTL = 10 * 60 * 1000;

// Всё меню одним запросом; кэш на 10 минут в sessionStorage (меньше запросов к базе).
export async function getMenu(force = false): Promise<Menu> {
  if (!force) {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) { const o = JSON.parse(raw); if (Date.now() - o.t < TTL) return o.m as Menu; }
    } catch { /* кэш недоступен — идём в базу */ }
  }
  const { data, error } = await sb().rpc('get_menu');
  if (error) throw error;
  const m = data as Menu;
  try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), m })); } catch { /* не страшно */ }
  return m;
}

// Только подтверждённые блюда с заполненным составом участвуют в обучении.
export const trainable = (m: Menu) => m.dishes.filter((d) => d.kind === 'dish' && d.status === 'confirmed' && d.ingredients.length > 0);

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

export const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();
