import Link from 'next/link';

// Запасная страница: все режимы уже имеют собственные адреса.
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ slug: 'unknown' }];
}
export default function NotFoundMode() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-24">
      <h1 className="font-display py-8 text-3xl font-extrabold">Режим не найден</h1>
      <Link href="/modes/" className="btn-primary">К режимам</Link>
    </main>
  );
}
