/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#111111',
          green: '#333333',
        },
        cream: {
          DEFAULT: '#F5F5F5',
          soft: '#FFFFFF',
          deep: '#E8E8E8',
        },
        ink: {
          DEFAULT: '#111111',
          soft: '#242424',
          muted: '#5C5C5C',
        },
        butter: {
          DEFAULT: '#E6E6E6',
          soft: '#F0F0F0',
          deep: '#CFCFCF',
        },
        blush: {
          DEFAULT: '#D8D8D8',
          soft: '#E7E7E7',
          deep: '#BDBDBD',
        },
        sage: {
          DEFAULT: '#C8C8C8',
          soft: '#DDDDDD',
          deep: '#AFAFAF',
        },
        sky: {
          DEFAULT: '#D0D0D0',
          soft: '#E2E2E2',
          deep: '#B5B5B5',
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
        pop: '0 2px 0 0 rgba(21,19,15,1)',
        popLg: '0 4px 0 0 rgba(21,19,15,1)',
      },
    },
  },
  plugins: [],
}