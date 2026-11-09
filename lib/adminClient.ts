import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const adminConfigured = Boolean(url && key);

// Отдельный клиент со своим ключом хранилища: вход админа не затирает гостевую сессию на этом устройстве.
let client: SupabaseClient | null = null;
export function adminSb(): SupabaseClient {
  if (!client) {
    if (!url || !key) throw new Error('Supabase не настроен: нет NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'mlp-admin-auth' },
    });
  }
  return client;
}

// Права проверяет база (public.is_admin), а не браузер.
export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await adminSb().rpc('is_admin');
  if (error) throw error;
  return data === true;
}

export const PHOTO_BUCKET = 'dish-photos';
export function photoUrl(path: string | null): string | null {
  if (!path) return null;
  return adminSb().storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Публичная часть сайта кэширует меню 10 минут — после правок сбрасываем кэш.
export function dropMenuCache() {
  try { sessionStorage.removeItem('mlp_menu_v1'); } catch { /* не страшно */ }
}

export const errText = (e: unknown): string => {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/row-level security|forbidden|42501/i.test(m)) return 'Нет прав: этот пользователь не записан в app_admins.';
  if (/duplicate key|23505/i.test(m)) return 'Такое название уже есть (в названиях или алиасах).';
  if (/violates foreign key|23503/i.test(m)) return 'Нельзя: на запись есть ссылки в других таблицах.';
  return m;
};
