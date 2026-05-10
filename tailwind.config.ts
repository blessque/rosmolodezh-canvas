/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:           ['"ALSHaussNext"',     'sans-serif'],
        mono:           ['"ALSHaussMono"',     'monospace'],
        'cond':         ['"ALSHaussNextCond"', 'sans-serif'],
        'cond-regular': ['"ALSHaussNextCond"', 'sans-serif'],
        'cond-black':   ['"ALSHaussNextCond"', 'sans-serif'],
        'mono-book':    ['"ALSHaussMonoBook"', 'monospace'],
      },
      colors: {
        surface: {
          50: '#f8f9fa',
          100: '#f1f3f5',
          200: '#e9ecef',
          300: '#dee2e6',
          400: '#ced4da',
          500: '#adb5bd',
          600: '#868e96',
          700: '#495057',
          800: '#343a40',
          900: '#212529',
          950: '#0d1117',
        },
      },
    },
  },
  plugins: [],
};
