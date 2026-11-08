import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: { extend: { colors: { night: '#12062b', plum: '#1f0d47', pink: '#ff2e93', teal: '#19e3d2', sun: '#ffb45e', cream: '#fff4e6' },
    fontFamily: { display: ['var(--font-display)', 'system-ui', 'sans-serif'], body: ['var(--font-body)', 'system-ui', 'sans-serif'] } } },
  plugins: [],
} satisfies Config;
