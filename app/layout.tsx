import type { Metadata } from 'next';
import Link from 'next/link';
import { Unbounded, Manrope } from 'next/font/google';
import './globals.css';
const display = Unbounded({ subsets: ['cyrillic', 'latin'], variable: '--font-display', weight: ['600', '800'] });
const body = Manrope({ subsets: ['cyrillic', 'latin'], variable: '--font-body' });
export const metadata: Metadata = { title: 'Make Love Pizza: состав блюд', description: 'Тренажёр состава блюд меню Make Love Pizza Алматы' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-display text-lg font-extrabold text-pink">MLP·Состав</Link>
          <nav className="flex gap-5 text-sm font-semibold text-cream/80">
            <Link href="/modes/" className="py-2 hover:text-teal">Режимы</Link>
            <Link href="/menu/" className="py-2 hover:text-teal">Меню</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
