/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Modern academic-editorial palette: warm paper canvas, deep teal-ink,
        // FER teal as a precise accent (not a wash).
        paper: '#F6F4EF', // page canvas (warm off-white)
        surface: '#FFFFFF', // raised content
        ink: '#16201E', // primary text — deep warm teal-charcoal
        muted: '#6B6A63', // secondary text
        hairline: '#E4E0D8', // subtle borders on paper
        line: '#CFC9BD', // stronger borders
        section: '#F1EDE6', // faint warm blocks
        ochre: '#B07D2B', // whisper accent, used sparingly (rank #1)
        brand: {
          DEFAULT: '#00819C', // FER teal
          dark: '#005A6E', // hover / deeper
          deep: '#0B3D46', // dark teal surfaces (top bar)
          tint: '#E3EFF1', // pale teal panels
          50: '#F0F7F8',
          100: '#E3EFF1',
          200: '#BFDDE3',
          300: '#8FC4CE',
          400: '#4FA3B3',
          500: '#00819C',
          600: '#00748C',
          700: '#005A6E',
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
