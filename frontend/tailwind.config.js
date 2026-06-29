/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Modern academic-editorial palette. Theme-aware tokens are driven by
        // CSS variables (see :root / .dark in index.css) so the whole UI flips
        // for dark mode; the `<alpha-value>` form keeps Tailwind opacity
        // modifiers (e.g. text-muted/60, bg-brand-tint/40) working.
        paper: 'rgb(var(--c-paper) / <alpha-value>)', // page canvas
        surface: 'rgb(var(--c-surface) / <alpha-value>)', // raised content
        ink: 'rgb(var(--c-ink) / <alpha-value>)', // primary text
        muted: 'rgb(var(--c-muted) / <alpha-value>)', // secondary text
        hairline: 'rgb(var(--c-hairline) / <alpha-value>)', // subtle borders
        line: 'rgb(var(--c-line) / <alpha-value>)', // stronger borders
        section: 'rgb(var(--c-section) / <alpha-value>)', // faint blocks
        ochre: 'rgb(var(--c-ochre) / <alpha-value>)', // whisper accent (rank #1)
        brand: {
          DEFAULT: '#00819C', // FER teal — constant (white-text contrast on buttons)
          dark: 'rgb(var(--c-brand-dark) / <alpha-value>)', // accent text / link hover (lightens in dark)
          deep: '#0B3D46', // dark teal surfaces (top bar) — constant
          tint: 'rgb(var(--c-brand-tint) / <alpha-value>)', // teal panels
          50: 'rgb(var(--c-brand-50) / <alpha-value>)', // faint teal (select active row)
          100: '#E3EFF1',
          200: '#BFDDE3',
          300: '#8FC4CE',
          400: '#4FA3B3',
          500: '#00819C',
          600: '#00748C',
          700: '#005A6E', // constant deep teal — button hover in both themes
          800: '#0B3D46',
          900: '#0A2E35',
        },
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tightish: '-0.015em',
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      maxWidth: {
        prose: '40rem',
      },
    },
  },
  plugins: [],
}
