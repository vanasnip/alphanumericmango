/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#0d1117',
          surface: '#161b22',
          border: '#30363d',
          text: '#c9d1d9',
          green: '#3fb950',
          red: '#f85149',
          blue: '#58a6ff',
          yellow: '#d29922',
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { 
            opacity: '1',
            boxShadow: '0 0 20px rgba(88, 166, 255, 0.5)'
          },
          '50%': { 
            opacity: '0.8',
            boxShadow: '0 0 40px rgba(88, 166, 255, 0.8)'
          },
        }
      }
    },
  },
  plugins: [],
}