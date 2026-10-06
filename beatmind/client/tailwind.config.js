/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0a0a0a', 900: '#0a0a0a', 850: '#0e0e10', 800: '#121214', 700: '#18181b', 600: '#222226', 500: '#2e2e33' },
        neon: { DEFAULT: '#8b5cf6', soft: '#a78bfa', deep: '#6d28d9', glow: '#c4b5fd' },
        mute: { DEFAULT: '#8a8a93', dim: '#5c5c66' },
      },
      fontFamily: {
        display: ['"Unbounded"', 'system-ui', 'sans-serif'],
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(139,92,246,.55), 0 0 24px -4px rgba(139,92,246,.55)',
        'neon-lg': '0 0 0 1px rgba(167,139,250,.6), 0 0 48px -6px rgba(139,92,246,.7)',
      },
      keyframes: {
        pulsebar: { '0%,100%': { transform: 'scaleY(.35)' }, '50%': { transform: 'scaleY(1)' } },
        rise: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        'beates-ring': { '0%,100%': { boxShadow: '0 0 0 0 rgba(167,139,250,.7), 0 0 24px rgba(139,92,246,.6)' }, '50%': { boxShadow: '0 0 0 8px rgba(167,139,250,0), 0 0 36px rgba(139,92,246,.9)' } },
      },
      animation: { pulsebar: 'pulsebar 1.1s ease-in-out infinite', rise: 'rise .35s ease-out both', 'beates-ring': 'beates-ring 1.6s ease-in-out infinite' },
    },
  },
  plugins: [],
};
