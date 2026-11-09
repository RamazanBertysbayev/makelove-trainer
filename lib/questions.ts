import { sb } from './supabase';

export type CustomOption = { id: string; label: string; is_correct: boolean; sort_order: number };
export type CustomQuestion = { id: string; dish_id: string; prompt: string; explanation: string | null; sort_order: number; is_active: boolean; options: CustomOption[] };

// Свои вопросы из админки. Если таблицы ещё нет (миграция 05 не применена) или запрос не удался — просто без них.
export async function getCustomQuestions(): Promise<CustomQuestion[]> {
  try {
    const { data, error } = await sb()
      .from('custom_questions')
      .select('id,dish_id,prompt,explanation,sort_order,is_active,custom_options(id,label,is_correct,sort_order)')
      .eq('is_active', true)
      .order('sort_order');
    if (error || !data) return [];
    return (data as unknown as (Omit<CustomQuestion, 'options'> & { custom_options: CustomOption[] })[])
      .map(({ custom_options, ...q }) => ({ ...q, options: [...custom_options].sort((a, b) => a.sort_order - b.sort_order) }))
      .filter((q) => q.options.length >= 2 && q.options.filter((o) => o.is_correct).length === 1);
  } catch { return []; }
}
