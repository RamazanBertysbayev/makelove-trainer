import Link from 'next/link';
export default function Developer() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-24">
      <h1 className="font-display py-8 text-3xl font-extrabold">Разработчик</h1>
      <div className="panel p-6">
        <p className="text-cream/80">Административная панель ещё в разработке. Вход будет по почте и паролю через Supabase, а права проверяет база данных.</p>
        <Link href="/" className="btn-ghost mt-5">На главную</Link>
      </div>
    </main>
  );
}
