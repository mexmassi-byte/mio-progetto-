/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cockpit / data-platform dark palette
        base: {
          950: '#050506',
          900: '#0b0b0e',
          850: '#111116',
          800: '#17171e',
          700: '#20202a',
          600: '#2d2d38',
        },
        line: '#282833',
        'line-strong': '#33333f',
        accent: {
          DEFAULT: '#e10600', // F1 red
          soft: '#ff2b26',
          muted: '#7a0a08',
        },
        signal: {
          DEFAULT: '#22d3ee', // telemetry cyan
          green: '#34d399',
          amber: '#fbbf24',
          purple: '#a78bfa',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(225,6,0,0.25), 0 0 24px -6px rgba(225,6,0,0.45)',
        panel: '0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 24px -12px rgba(0,0,0,0.8)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.7' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'page-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fade-in 0.9s ease-out both',
        'glow-pulse': 'glow-pulse 5s ease-in-out infinite',
        'scan': 'scan 6s linear infinite',
        'page-in': 'page-in 0.35s cubic-bezier(0.16,1,0.3,1) both',
        'shimmer': 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
