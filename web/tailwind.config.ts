import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#0B0E17',
        surface: {
          DEFAULT: '#171923',
          hover: '#1D202C',
        },
        card: {
          DEFAULT: 'rgba(255,255,255,0.03)',
          hover: 'rgba(255,255,255,0.02)',
        },
        border: {
          subtle: 'rgba(255,255,255,0.1)',
        },
        text: {
          primary: '#F7F6F0',
          secondary: 'rgba(247,246,240,0.75)',
          muted: 'rgba(247,246,240,0.45)',
        },
        supply: '#10B981',
        borrow: '#FFA500',
        accent: '#3B82F6',
        points: '#FACC15',
        danger: '#EF4444',
        badge: {
          supply: '#103A2E',
          borrow: '#462704',
          accent: '#1E3A5F',
          danger: '#3B1111',
        },
      },
      fontFamily: {
        display: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
