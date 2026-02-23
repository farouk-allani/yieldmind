import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a0f1e',
          800: '#111827',
          700: '#1a2332',
          600: '#243044',
        },
        cyan: {
          400: '#00f0ff',
          500: '#00d4e0',
        },
        amber: {
          400: '#f59e0b',
          500: '#d97706',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        heading: ['Space Grotesk', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
    },
  },
  plugins: [],
};

export default config;
