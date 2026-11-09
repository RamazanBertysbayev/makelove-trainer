import { norm, shuffle, trainable, type Dish, type Menu } from './menu';
import type { CustomQuestion } from './questions';

// Все задания строятся ТОЛЬКО из реальных ингредиентов и блюд базы:
// неверные варианты берутся из составов других подтверждённых блюд, ничего не выдумывается.

export type Kind = 'assemble' | 'quiz' | 'find_error' | 'compare';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Opt = { id: string; label: string };
export type QType = 'pick_composition' | 'which_in' | 'missing' | 'extra' | 'which_dishes' | 'diff' | 'custom';
export type ErrType = 'extra' | 'missing' | 'replaced';
export type Side = 'both' | 'a' | 'b';

export type Task =
  | { kind: 'assemble'; dishIds: string[] }
  | { kind: 'quiz'; qtype: QType; dishIds: string[]; prompt: string; shown?: string[]; options: Opt[]; correct: string; explain: string; subject?: string }
  | { kind: 'find_error'; dishIds: string[]; etype: ErrType; shown: string[]; target: string; options: Opt[]; explain: string }
  | { kind: 'compare'; dishIds: string[]; rows: string[]; truth: Record<string, Side> };

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export class Ctx {
  pool: Dish[];
  byId = new Map<string, Dish>();
  names = new Map<string, string>();
  cats = new Map<string, string>();
  used: string[];
  constructor(public menu: Menu, public diff: Difficulty) {
    this.pool = trainable(menu);
    this.pool.forEach((d) => this.byId.set(d.id, d));
    menu.dishes.forEach((d) => this.byId.set(d.id, d));
    menu.ingredients.forEach((i) => this.names.set(i.id, i.name));
    menu.categories.forEach((c) => this.cats.set(c.id, c.name));
    this.used = [...new Set(this.pool.flatMap((d) => d.ingredients))];
  }
  label = (id: string) => this.names.get(id) ?? '';
  list = (ids: string[]) => ids.map(this.label).join(', ');
  shared = (a: Dish, b: Dish) => a.ingredients.filter((i) => b.ingredients.includes(i)).length;
  // другие блюда: сначала самые похожие (при равенстве порядок случайный)
  similar(d: Dish): Dish[] {
    return shuffle(this.pool.filter((o) => o.id !== d.id)).sort((x, y) => this.shared(d, y) - this.shared(d, x));
  }
  // «лук» и «красный лук» не должны путать вопрос: такие пары считаем неоднозначными
  confusable(id: string, set: Iterable<string>): boolean {
    const n = norm(this.label(id));
    for (const s of set) {
      if (s === id) return true;
      const m = norm(this.label(s));
      if (n.includes(m) || m.includes(n)) return true;
    }
    return false;
  }
  // реальные ингредиенты, которых нет в exclude; на сложном уровне берутся из похожих блюд
  pickIng(exclude: Iterable<string>, n: number, near?: Dish): string[] {
    const ex = [...exclude];
    const ok = this.used.filter((i) => !this.confusable(i, ex));
    let out: string[] = [];
    if (near && this.diff !== 'easy') {
      const nearIds = shuffle([...new Set(this.similar(near).slice(0, 5).flatMap((d) => d.ingredients))].filter((i) => ok.includes(i)));
      out = nearIds.slice(0, this.diff === 'hard' ? n : Math.ceil(n / 2));
    }
    const rest = shuffle(ok.filter((i) => !out.includes(i)));
    return [...out, ...rest].slice(0, n);
  }
  opts = (ids: string[]): Opt[] => ids.map((id) => ({ id, label: this.label(id) }));
}

function whichIn(c: Ctx, d: Dish): Task | null {
  const correct = pick(d.ingredients);
  const ids = shuffle([correct, ...c.pickIng(d.ingredients, 3, d)]);
  if (ids.length < 2) return null;
  return { kind: 'quiz', qtype: 'which_in', dishIds: [d.id], prompt: `Какой ингредиент входит в «${d.name}»?`, options: c.opts(ids), correct, explain: `Состав «${d.name}»: ${c.list(d.ingredients)}.` };
}
function missing(c: Ctx, d: Dish): Task | null {
  if (d.ingredients.length < 3) return null;
  const gone = pick(d.ingredients);
  const shown = d.ingredients.filter((i) => i !== gone);
  const ids = shuffle([gone, ...c.pickIng(d.ingredients, 3, d)]);
  return { kind: 'quiz', qtype: 'missing', dishIds: [d.id], prompt: `В составе «${d.name}» не хватает одного ингредиента. Какого?`, shown, options: c.opts(ids), correct: gone, explain: `Не хватало: ${c.label(gone)}. Полный состав: ${c.list(d.ingredients)}.` };
}
function extra(c: Ctx, d: Dish): Task | null {
  if (d.ingredients.length < 2) return null;
  const [e] = c.pickIng(d.ingredients, 1, d);
  if (!e) return null;
  const shown = shuffle([...d.ingredients, e]);
  return { kind: 'quiz', qtype: 'extra', dishIds: [d.id], prompt: `В составе «${d.name}» один ингредиент лишний. Какой?`, options: c.opts(shown), correct: e, explain: `Лишний: ${c.label(e)}. Правильный состав: ${c.list(d.ingredients)}.` };
}
function whichDishes(c: Ctx, d: Dish): Task | null {
  const cand = d.ingredients.filter((i) => {
    const n = c.pool.filter((o) => o.ingredients.includes(i)).length;
    return n <= c.pool.length - 3;
  });
  if (cand.length === 0) return null;
  const ing = pick(cand);
  const lacking = (o: Dish) => !o.ingredients.some((i) => i === ing || c.confusable(i, [ing]));
  const others = c.similar(d).filter(lacking);
  const near = c.diff === 'easy' ? shuffle(others) : c.diff === 'hard' ? others : [...others.slice(0, 2), ...shuffle(others.slice(2))];
  const wrong = near.slice(0, 3);
  if (wrong.length < 1) return null;
  const withIt = c.pool.filter((o) => o.ingredients.includes(ing)).map((o) => o.name);
  return { kind: 'quiz', qtype: 'which_dishes', dishIds: [d.id], subject: ing, prompt: `В каком блюде используется «${c.label(ing)}»?`, options: shuffle([d, ...wrong]).map((o) => ({ id: o.id, label: o.name })), correct: d.id, explain: `«${c.label(ing)}» есть в: ${withIt.slice(0, 8).join(', ')}${withIt.length > 8 ? ' и других' : ''}.` };
}
function pickComposition(c: Ctx, d: Dish): Task | null {
  const key = (x: Dish) => [...x.ingredients].sort().join('|');
  const seen = new Set([key(d)]);
  const wrong: Dish[] = [];
  const order = c.diff === 'easy' ? shuffle(c.pool.filter((o) => o.id !== d.id)) : c.similar(d);
  for (const o of order) {
    if (wrong.length >= 3) break;
    if (seen.has(key(o))) continue;
    seen.add(key(o)); wrong.push(o);
  }
  if (wrong.length < 1) return null;
  const options = shuffle([d, ...wrong]).map((o) => ({ id: o.id, label: c.list(o.ingredients) }));
  return { kind: 'quiz', qtype: 'pick_composition', dishIds: [d.id], prompt: `Выбери правильный состав блюда «${d.name}»`, options, correct: d.id, explain: `Состав «${d.name}»: ${c.list(d.ingredients)}.` };
}
function partnerFor(c: Ctx, d: Dish, maxUnion = 99): Dish | null {
  const pool = c.similar(d).slice(0, 4);
  for (const o of c.diff === 'easy' ? shuffle(pool) : pool) {
    const union = new Set([...d.ingredients, ...o.ingredients]).size;
    if (c.shared(d, o) >= 1 && union <= maxUnion && union > c.shared(d, o)) return o;
  }
  return null;
}
function diffTask(c: Ctx, d: Dish): Task | null {
  const o = partnerFor(c, d);
  if (!o) return null;
  const onlyA = d.ingredients.filter((i) => !o.ingredients.includes(i) && !c.confusable(i, o.ingredients));
  if (onlyA.length === 0) return null;
  const correct = pick(onlyA);
  const onlyB = o.ingredients.filter((i) => !d.ingredients.includes(i) && !c.confusable(i, d.ingredients));
  const both = d.ingredients.filter((i) => o.ingredients.includes(i));
  let wrong = [...shuffle(onlyB).slice(0, 2), ...shuffle(both).slice(0, 2)].slice(0, 3);
  if (wrong.length < 3) wrong = [...wrong, ...c.pickIng([...d.ingredients, ...o.ingredients, ...wrong], 3 - wrong.length, d)];
  const ids = shuffle([correct, ...wrong]);
  const only = (x: Dish, y: Dish) => x.ingredients.filter((i) => !y.ingredients.includes(i));
  return { kind: 'quiz', qtype: 'diff', dishIds: [d.id, o.id], prompt: `Чем «${d.name}» отличается от «${o.name}»? Какой ингредиент есть в «${d.name}», но нет в «${o.name}»?`, options: c.opts(ids), correct, explain: `Общие: ${c.list(both) || 'нет'}. Только в «${d.name}»: ${c.list(only(d, o)) || 'нет'}. Только в «${o.name}»: ${c.list(only(o, d)) || 'нет'}.` };
}
function findError(c: Ctx, d: Dish): Task | null {
  const types: ErrType[] = ['extra'];
  if (d.ingredients.length >= 2) types.push('replaced');
  if (d.ingredients.length >= 3) types.push('missing');
  const etype = pick(types);
  const full = `Правильный состав «${d.name}»: ${c.list(d.ingredients)}.`;
  if (etype === 'missing') {
    const gone = pick(d.ingredients);
    const ids = shuffle([gone, ...c.pickIng(d.ingredients, 3, d)]);
    return { kind: 'find_error', dishIds: [d.id], etype, shown: d.ingredients.filter((i) => i !== gone), target: gone, options: c.opts(ids), explain: `Не хватало: ${c.label(gone)}. ${full}` };
  }
  const [e] = c.pickIng(d.ingredients, 1, d);
  if (!e) return null;
  if (etype === 'extra') {
    return { kind: 'find_error', dishIds: [d.id], etype, shown: shuffle([...d.ingredients, e]), target: e, options: [], explain: `Лишний: ${c.label(e)}. ${full}` };
  }
  const out = pick(d.ingredients);
  return { kind: 'find_error', dishIds: [d.id], etype, shown: d.ingredients.map((i) => (i === out ? e : i)), target: e, options: [], explain: `Вместо «${c.label(out)}» подставили «${c.label(e)}». ${full}` };
}
function compareTask(c: Ctx, d: Dish): Task | null {
  const o = partnerFor(c, d, 12);
  if (!o) return null;
  const rows = shuffle([...new Set([...d.ingredients, ...o.ingredients])]);
  const truth: Record<string, Side> = {};
  rows.forEach((i) => { const a = d.ingredients.includes(i), b = o.ingredients.includes(i); truth[i] = a && b ? 'both' : a ? 'a' : 'b'; });
  return { kind: 'compare', dishIds: [d.id, o.id], rows, truth };
}

const QTYPES: Record<Difficulty, Exclude<QType, 'custom'>[]> = {
  easy: ['which_in', 'which_dishes', 'pick_composition'],
  medium: ['which_in', 'which_dishes', 'pick_composition', 'missing', 'extra', 'diff'],
  hard: ['pick_composition', 'missing', 'extra', 'diff', 'which_dishes'],
};
const QB: Record<Exclude<QType, 'custom'>, (c: Ctx, d: Dish) => Task | null> = { which_in: whichIn, missing, extra, which_dishes: whichDishes, pick_composition: pickComposition, diff: diffTask };

export function build(c: Ctx, kind: Kind, d: Dish): Task | null {
  if (kind === 'assemble') return { kind, dishIds: [d.id] };
  if (kind === 'find_error') return findError(c, d);
  if (kind === 'compare') return compareTask(c, d);
  for (const q of shuffle(QTYPES[c.diff])) { const t = QB[q](c, d); if (t) return t; }
  return null;
}

function customTask(q: CustomQuestion): Task {
  const right = q.options.find((o) => o.is_correct)!;
  return { kind: 'quiz', qtype: 'custom', dishIds: [q.dish_id], prompt: q.prompt, options: q.options.map((o) => ({ id: o.id, label: o.label })), correct: right.id, explain: q.explanation || `Правильный ответ: ${right.label}.` };
}

export function makeTasks(menu: Menu, o: { kinds: Kind[]; count: number; categoryId: string; difficulty: Difficulty; custom?: CustomQuestion[] }): Task[] {
  const c = new Ctx(menu, o.difficulty);
  const subjects = shuffle(c.pool.filter((d) => o.categoryId === 'all' || d.category_id === o.categoryId));
  const out: Task[] = [];
  for (const d of subjects) {
    if (out.length >= o.count) break;
    for (const kind of shuffle(o.kinds)) { const t = build(c, kind, d); if (t) { out.push(t); break; } }
  }
  // Свои вопросы из админки: в режимах с квизом часть обычных квизов заменяется ими (примерно каждый второй).
  if (o.kinds.includes('quiz') && o.custom?.length) {
    const queue = shuffle(o.custom.filter((q) => {
      const d = c.byId.get(q.dish_id);
      return d && (o.categoryId === 'all' || d.category_id === o.categoryId);
    }));
    for (let i = 0; i < out.length && queue.length; i++) {
      if (out[i].kind === 'quiz' && Math.random() < 0.5) out[i] = customTask(queue.pop()!);
    }
    // если обычных заданий не хватило до нужного числа — добираем своими
    while (out.length < o.count && queue.length) out.push(customTask(queue.pop()!));
  }
  return out;
}

// Подсказки не раскрывают ответ: только категория, число ингредиентов и похожее блюдо.
export function hintFor(c: Ctx, t: Task): string {
  if (t.kind === 'compare') {
    const [a, b] = t.dishIds.map((id) => c.byId.get(id)!);
    return `В «${a.name}» ${a.ingredients.length} ингредиентов, в «${b.name}» ${b.ingredients.length}.`;
  }
  if (t.kind === 'quiz' && t.qtype === 'which_dishes' && t.subject) {
    const n = c.pool.filter((o) => o.ingredients.includes(t.subject!)).length;
    return `Этот ингредиент встречается в блюдах меню: ${n}.`;
  }
  const d = c.byId.get(t.dishIds[0])!;
  const best = c.similar(d)[0];
  return `Категория: ${c.cats.get(d.category_id)}. Ингредиентов в составе: ${d.ingredients.length}.${best ? ` Похоже на «${best.name}» (общих ингредиентов: ${c.shared(d, best)}).` : ''}`;
}
