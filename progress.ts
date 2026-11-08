import { sb } from './supabase';

export type Mode = 'quiz' | 'assemble' | 'find_error' | 'compare' | 'flashcards' | 'free';
export type Outcome = 'right' | 'wrong' | 'review';

export async function startAttempt(profileId: string, mode: Mode, categoryId: string, difficulty: string | null, exam: boolean, total: number): Promise<string> {
  const { data, error } = await sb().from('attempts').insert({
    profile_id: profileId, mode, category_id: categoryId === 'all' ? null : categoryId, difficulty, exam_mode: exam, total_questions: total,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

// Сохраняет ответ и обновляет прогресс по каждому блюду из задания.
export async function saveAnswer(profileId: string, attemptId: string, dishIds: string[], qtype: string, outcome: Outcome, expected: unknown, given: unknown) {
  const c = sb();
  const { error } = await c.from('attempt_items').insert({ attempt_id: attemptId, dish_id: dishIds[0], question_type: qtype, is_correct: outcome === 'right', expected, given });
  if (error) throw error;
  for (const dishId of dishIds) {
    const { data: cur } = await c.from('dish_progress').select('correct_count,wrong_count').eq('profile_id', profileId).eq('dish_id', dishId).maybeSingle();
    const cc = (cur?.correct_count ?? 0) + (outcome === 'right' ? 1 : 0);
    const wc = (cur?.wrong_count ?? 0) + (outcome === 'wrong' ? 1 : 0);
    const status = outcome !== 'right' ? 'review' : cc >= 3 ? 'known' : 'learning';
    const { error: e2 } = await c.from('dish_progress').upsert(
      { profile_id: profileId, dish_id: dishId, correct_count: cc, wrong_count: wc, status, last_seen_at: new Date().toISOString() },
      { onConflict: 'profile_id,dish_id' });
    if (e2) throw e2;
  }
}

export async function finishAttempt(attemptId: string, correct: number) {
  const { error } = await sb().from('attempts').update({ correct_count: correct, finished_at: new Date().toISOString() }).eq('id', attemptId);
  if (error) throw error;
}
