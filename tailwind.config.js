/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF7F2',
        cream: '#F2EBDC',
        surface: '#FFFFFF',
        ink: '#1A1612',
        ink2: '#5C544A',
        taupe: '#D6CCB8',
        taupe2: '#A89E89',
        moss: {
          50:  '#EBEFEC',
          600: '#2D4A3E',
          700: '#1F362C',
        },
        ochre: {
          50:  '#F5ECD3',
          600: '#C89B3C',
          700: '#9B7728',
        },
        clay: {
          50:  '#F5E0DA',
          600: '#A0341F',
          700: '#7B2614',
        },
        ember: {
          50:  '#FBE5D2',
          600: '#D97A1F',
          700: '#A85510',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
