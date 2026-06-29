/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        nyx: {
          core:   '#7c3aed',
          bright: '#a78bfa',
          dim:    '#4c1d95',
          glow:   '#6d28d9',
          pulse:  '#c4b5fd',
        },
        void:    '#05050f',
        deep:    '#080814',
        panel:   '#0b0b1a',
        surface: '#0f0f22',
      },
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        mono:    ['Share Tech Mono', 'monospace'],
        body:    ['Exo 2', 'sans-serif'],
      },
      animation: {
        'orb-float':   'orbFloat 6s ease-in-out infinite',
        'pulse-ring':  'pulseRing 3s ease-in-out infinite',
        'fade-up':     'fadeUp 0.4s ease forwards',
        'glow-pulse':  'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        orbFloat: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-12px)' },
        },
        pulseRing: {
          '0%,100%': { opacity: 0.5, transform: 'scale(1)' },
          '50%':     { opacity: 1,   transform: 'scale(1.03)' },
        },
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%,100%': { boxShadow: '0 0 20px rgba(124,58,237,0.3)' },
          '50%':     { boxShadow: '0 0 40px rgba(124,58,237,0.6)' },
        },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
}