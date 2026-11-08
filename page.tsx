import Link from 'next/link';
import { MODES } from '@/lib/modes';
const CHIPS = [['Моцарелла', '8%', '6%', '-6deg'], ['Базилик', '78%', '2%', '5deg'], ['Орегано', '2%', '58%', '4deg'], ['Дор-блю', '84%', '52%', '-5deg'], ['Шампиньоны', '30%', '90%', '3deg']];
export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-24">
      <section className="grid items-center gap-12 py-10 md:grid-cols-[1.1fr_.9fr] md:py-20">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl">Выучи состав всего меню Make Love Pizza</h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-cream/80">Собирай блюда, проходи квизы, листай карточки. Все составы взяты только из официального меню Алматы.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/guest/" className="btn-primary">Войти как гость</Link>
            <Link href="/developer/" className="btn-ghost">Разработчик</Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
          <div className="sun" />
          {CHIPS.map(([t, x, y, r]) => (<span key={t} className="chip" style={{ left: x, top: y, ['--r' as string]: r, transform: `rotate(${r})` }}>{t}</span>))}
        </div>
      </section>
      <section className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
        <div className="panel p-6">
          <h2 className="font-display text-xl font-semibold">Твой прогресс</h2>
          <p className="mt-3 text-cream/75">Войди как гость, и изученные блюда, ошибки и опыт будут сохраняться в облаке. Код восстановления вернёт профиль на другом устройстве.</p>
        </div>
        <div className="panel p-6">
          <h2 className="font-display text-xl font-semibold">Режимы обучения</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {MODES.map((m) => (<li key={m.slug}><Link href={`/play/${m.slug}/`} className="block py-1.5 font-semibold text-teal hover:text-sun">{m.title}</Link></li>))}
          </ul>
          <Link href="/modes/" className="btn-ghost mt-5">Выбрать режим</Link>
        </div>
      </section>
    </main>
  );
}
