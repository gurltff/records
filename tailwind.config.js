/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#15130F',
          green: '#24211E',
        },
        // Warm cream scheme, matching the live Smart Attendance Tracker.
        cream: {
          DEFAULT: '#F7F1E3', // page background
          soft: '#F4F2F1', // cards, navbar
          deep: '#EFE6D2', // table headers
        },
        ink: {
          DEFAULT: '#15130F',
          soft: '#24211E',
          muted: '#6B6659',
        },
        line: '#D6D4D3', // thin card borders
        chip: '#E8E5E3', // navbar chips
        butter: {
          DEFAULT: '#F3EAD6',
          soft: '#F8F2E5',
          deep: '#E5D7B8',
        },
        blush: {
          DEFAULT: '#F1E2DC',
          soft: '#F7EEEA',
          deep: '#E2C9BF',
        },
        sage: {
          DEFAULT: '#E3E8D9',
          soft: '#EEF1E7',
          deep: '#C9D3B8',
        },
        sky: {
          DEFAULT: '#E9E4DA',
          soft: '#F1EDE6',
          deep: '#D3CBBB',
        },
      },
      borderRadius: {
        '2xl': '1.1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        pop: '0 6px 18px -10px rgba(21,19,15,0.35)',
        popLg: '0 10px 28px -12px rgba(21,19,15,0.35)',
        card: '0 1px 2px rgba(21,19,15,0.04), 0 10px 24px -14px rgba(21,19,15,0.22)',
      },
    },
  },
  plugins: [],
}