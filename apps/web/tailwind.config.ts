import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        periwinkle: {
          DEFAULT: '#9999FF',
          50: '#F5F5FF',
          100: '#E6E6FF',
          200: '#CCCCFF',
          300: '#B3B3FF',
          400: '#9999FF',
          500: '#8080FF',
          600: '#6666FF',
          700: '#4D4DFF',
          800: '#3333FF',
          900: '#1A1AFF',
        },
        'light-green': {
          DEFAULT: '#90EE90',
          50: '#F7FEF7',
          100: '#E8FCE8',
          200: '#D1F9D1',
          300: '#B9F6B9',
          400: '#90EE90',
          500: '#7AE67A',
          600: '#64DE64',
          700: '#4DD64D',
          800: '#37CE37',
          900: '#21C621',
        },
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          dark: 'rgba(0, 0, 0, 0.05)',
          border: 'rgba(255, 255, 255, 0.1)',
          'border-dark': 'rgba(0, 0, 0, 0.1)',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-geist-mono)', ...defaultTheme.fontFamily.mono],
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
      },
      animation: {
        'fade-in': 'fade-in 0.6s ease-out forwards',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'float-slower': 'float 10s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 2s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        ripple: 'ripple 0.6s linear',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'rotate-slow': 'rotate-slow 20s linear infinite',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '25%': { transform: 'translateY(-10px) translateX(5px)' },
          '50%': { transform: 'translateY(5px) translateX(-5px)' },
          '75%': { transform: 'translateY(-5px) translateX(10px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(153, 153, 255, 0.5)' },
          '50%': { boxShadow: '0 0 40px rgba(153, 153, 255, 0.8)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          from: { transform: 'translateY(-100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.9)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'rotate-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [
    ({ addUtilities }: any) => {
      const newUtilities = {
        '.glass': {
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)',
        },
        '.glass-dark': {
          background: 'rgba(0, 0, 0, 0.05)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
        },
        '.glass-card': {
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 8px 32px var(--glass-shadow)',
        },
        '.glass-button': {
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid var(--glass-border)',
          transition: 'all 0.3s ease',
        },
        '.glass-button:hover': {
          background: 'var(--glass-highlight)',
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 20px var(--glass-shadow)',
        },
        '.text-gradient': {
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          backgroundImage:
            'linear-gradient(to right, var(--tw-gradient-stops))',
        },
        '.animation-delay-200': {
          animationDelay: '200ms',
        },
        '.animation-delay-400': {
          animationDelay: '400ms',
        },
        '.animation-delay-600': {
          animationDelay: '600ms',
        },
        '.animation-delay-800': {
          animationDelay: '800ms',
        },
        '.animation-delay-1000': {
          animationDelay: '1000ms',
        },
        '.animation-delay-2000': {
          animationDelay: '2000ms',
        },
      };
      addUtilities(newUtilities);
    },
  ],
};

export default config;
