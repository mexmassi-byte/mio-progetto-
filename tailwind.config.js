/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cockpit / data-platform dark palette
        base: {
          950: '#050506',
          900: '#0a0a0c',
          850: '#101014',
          800: '#16161c',
          700: '#1e1e26',
          600: '#2a2a34',
        },
        line: '#23232c',
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
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(225,6,0,0.25), 0 0 24px -6px rgba(225,6,0,0.45)',
        panel: '0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 24px -12px rgba(0,0,0,0.8)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}
