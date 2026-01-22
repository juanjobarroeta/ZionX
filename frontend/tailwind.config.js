/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        // ZIONX Minimal Canvas Palette - Clean & Sophisticated
        zionx: {
          // Primary - Pure Black (for text)
          primary: '#000000',
          // Secondary - Soft Gray (subtle backgrounds)
          secondary: '#C6C6C6',
          // Tertiary - Pure White (canvas background)
          tertiary: '#FFFFFF',
          // Accent - Warm Beige (minimal accent)
          accent: '#DFD8CB',
          // Highlight - Soft Gray (hover states)
          highlight: '#C6C6C6',
          // Minimal color system
          black: '#000000', // Pure black
          white: '#FFFFFF', // Pure white
          gray: '#C6C6C6', // Soft gray
          beige: '#DFD8CB', // Warm beige accent
          'gray-light': '#F5F5F5', // Very light gray
          'gray-border': '#E8E8E8', // Subtle borders
        },
        // Extended palette for UI components
        primary: {
          50: '#f8f8f8',
          100: '#f0f0f0',
          200: '#e6e6e6',
          300: '#d4d4d4',
          400: '#bfbfbf',
          500: '#1b1b1b',
          600: '#171717',
          700: '#141414',
          800: '#111111',
          900: '#0e0e0e',
        },
        secondary: {
          50: '#f8f8f8',
          100: '#f0f0f0',
          200: '#e6e6e6',
          300: '#d4d4d4',
          400: '#bfbfbf',
          500: '#bfbfbf',
          600: '#a8a8a8',
          700: '#919191',
          800: '#7a7a7a',
          900: '#636363',
        },
        accent: {
          50: '#f7f8f9',
          100: '#eef0f2',
          200: '#dde1e5',
          300: '#cbd2d8',
          400: '#b9c3cb',
          500: '#2c2f36',
          600: '#272a30',
          700: '#22252a',
          800: '#1d2024',
          900: '#181b1e',
        },
        highlight: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#41c1ff',
          600: '#3ba8e6',
          700: '#358fcc',
          800: '#2f76b3',
          900: '#295d99',
        },
        neutral: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'], // Friendly geometric sans for headers
        body: ['Montserrat', 'Inter', 'system-ui', 'sans-serif'], // Same friendly font for body
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
    },
  },
  plugins: [],
}