/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Work Sans"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        // The whole palette IS the palette now, not a neutral shell with
        // accent touches: https://colorhunt.co/palette/4060934c8ce391d06cfff799
        // Page ground is the palette's own pale yellow, not beige. Body
        // text is the palette's own deep blue, not black/brown.
        sun: {
          DEFAULT: '#E2F6CA',
        },
        ink: {
          DEFAULT: '#406093',
          soft: '#5F7FA8',
          faint: '#93ABCB',
        },
        haze: {
          200: '#C9DCF0',
        },
        // Primary brand/action color — the same palette's bright sky blue,
        // deepening to its own darker blue (also `ink`) on hover.
        sky: {
          DEFAULT: '#4C8CE4',
          dark: '#406093',
          soft: '#DCEAFB',
        },
        grass: { DEFAULT: '#5FA83D', soft: '#D9F0C7' },
        sunshine: { DEFAULT: '#D4AE1F', soft: '#FFF799' },
      },
    },
  },
  plugins: [],
}
