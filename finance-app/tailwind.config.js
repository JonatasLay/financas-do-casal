/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        brand: {
          income: '#10B981',
          expense: '#EF4444',
          pending: '#F59E0B',
          info: '#6366F1',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.1)',
        'float': '0 8px 32px 0 rgba(99,102,241,0.2)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'bounce-soft': 'bounceSoft 0.5s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
        'typing': 'typing 1.4s infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-4px)' },
        },
      },
      backgroundImage: {
        'gradient-app': 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 50%, #FDF2F8 100%)',
        'gradient-app-dark': 'linear-gradient(135deg, #1E1B4B 0%, #1F2937 50%, #1E1B4B 100%)',
        'gradient-card': 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        'gradient-income': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        'gradient-expense': 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
        'gradient-ai': 'linear-gradient(135deg, #6366F1 0%, #EC4899 100%)',
      },
    },
  },
  plugins: [],
}
