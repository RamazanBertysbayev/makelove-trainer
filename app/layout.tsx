import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = { title: 'Make Love Pizza: состав блюд', description: 'Тренажёр состава блюд меню Make Love Pizza Алматы' };
const fontVars = { '--font-display': "'Unbounded'", '--font-body': "'Manrope'" } as CSSProperties;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" style={fontVars}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@600;800&display=swap&subset=cyrillic,latin" />
      </head>
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
