/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#fbfbfa',
          100: '#f5f5f2',
          200: '#e7e7df',
          300: '#d5d4c6',
          800: '#232326',
          900: '#151517',
          950: '#0c0c0e',
        },
        amber: {
          450: '#f59e0b',
        }
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
};
