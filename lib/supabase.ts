import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  if (!client) {
    if (!url || !key) throw new Error('Supabase не настроен: нет переменных NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return client;
}

// Гостевая сессия: при повторном открытии на том же устройстве возвращается прежняя.
export async function ensureSession() {
  const c = sb();
  const { data } = await c.auth.getSession();
  if (data.session) return data.session;
  const { data: d2, error } = await c.auth.signInAnonymously();
  if (error || !d2.session) throw error ?? new Error('Не удалось создать гостевую сессию');
  return d2.session;
}

export type Profile = { id: string; nickname: string; xp: number };
export async function getMyProfile(): Promise<Profile | null> {
  await ensureSession();
  const { data, error } = await sb().from('profiles').select('id,nickname,xp').maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}
