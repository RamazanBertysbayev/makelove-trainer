import Link from 'next/link';
import { MODES } from '@/lib/modes';
export const metadata = { title: 'Режимы обучения' };
export default function Modes() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-24">
      <h1 className="font-display py-8 text-3xl font-extrabold sm:text-4xl">Выбери режим</h1>
      <div className="grid gap-5 md:grid-cols-3">
        {MODES.map((m) => m.main ? (
          <Link key={m.slug} href={`/play/${m.slug}/`} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink to-[#8a1fff] p-7 text-night md:col-span-2 md:row-span-2 md:p-10">
            <h2 className="font-display text-3xl font-extrabold md:text-4xl">{m.title}</h2>
            <p className="mt-4 max-w-md text-lg font-semibold">{m.text}</p>
            <span className="mt-8 inline-flex min-h-[48px] items-center rounded-xl bg-night px-6 font-bold text-pink">Начать сборку</span>
          </Link>
        ) : (
          <Link key={m.slug} href={`/play/${m.slug}/`} className="panel block p-6 transition hover:border-teal">
            <h2 className="font-display text-xl font-semibold text-teal">{m.title}</h2>
            <p className="mt-3 text-cream/75">{m.text}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
