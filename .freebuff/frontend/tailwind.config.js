/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefaf5',
          100: '#d5f2e4',
          200: '#aee4cd',
          300: '#7bd0b0',
          400: '#47b58f',
          500: '#259a74',
          600: '#187c5e',
          700: '#14644d',
          800: '#11503f',
          900: '#0e4235',
        },
        saffron: {
          50: '#fff8ed',
          100: '#ffefd4',
          200: '#ffdba8',
          300: '#ffc070',
          400: '#fb9d37',
          500: '#f57f11',
          600: '#e26507',
          700: '#bb4b08',
          800: '#953b0f',
          900: '#78330f',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(16, 42, 67, 0.08), 0 4px 16px rgba(16, 42, 67, 0.06)',
      },
    },
  },
  plugins: [],
}