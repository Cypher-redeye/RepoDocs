/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          DEFAULT: '#e8564a',
          50: '#fef2f1',
          100: '#fde3e1',
          200: '#fcccc8',
          300: '#f9a8a1',
          400: '#f3736a',
          500: '#e8564a',
          600: '#d53a2e',
          700: '#b32d22',
          800: '#94291f',
          900: '#7b2720',
        },
        lime: {
          DEFAULT: '#c8f135',
          50: '#f8fee7',
          100: '#eefccb',
          200: '#dff99d',
          300: '#c8f135',
          400: '#b5e31a',
          500: '#96c70e',
          600: '#749e08',
          700: '#58780c',
          800: '#475f10',
          900: '#3c5013',
        },
        dark: {
          DEFAULT: '#0d0d0d',
          50: '#f7f7f7',
          100: '#e0e0e0',
          200: '#2a2a2a',
          300: '#1e1e1e',
          400: '#1a1a1a',
          500: '#161616',
          600: '#0d0d0d',
        },
      },
      fontFamily: {
        inter: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '20px',
        'input': '12px',
        'chip': '8px',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-in-out',
        'slide-up': 'slideUp 300ms ease-out',
        'pulse-dot': 'pulseDot 1.4s infinite ease-in-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 80%, 100%': { transform: 'scale(0)', opacity: '0' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
