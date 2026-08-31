export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  darkMode: 'selector',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        popover: 'var(--popover)',
        'popover-foreground': 'var(--popover-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        destructive: 'var(--destructive)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        'chart-1': 'var(--chart-1)',
        'chart-2': 'var(--chart-2)',
        'chart-3': 'var(--chart-3)',
        'chart-4': 'var(--chart-4)',
        'chart-5': 'var(--chart-5)',
        sidebar: 'var(--sidebar)',
        'sidebar-foreground': 'var(--sidebar-foreground)',
        'sidebar-primary': 'var(--sidebar-primary)',
        'sidebar-primary-foreground': 'var(--sidebar-primary-foreground)',
        'sidebar-accent': 'var(--sidebar-accent)',
        'sidebar-accent-foreground': 'var(--sidebar-accent-foreground)',
        'sidebar-border': 'var(--sidebar-border)',
        'sidebar-ring': 'var(--sidebar-ring)',
        'destructive-foreground': 'var(--destructive-foreground)',

        /* ---- VyaparPulse design tokens ---- */
        vp: {
          bg: 'var(--vp-bg)',
          surface: 'var(--vp-surface)',
          'surface-2': 'var(--vp-surface-2)',
          line: 'var(--vp-line)',
          'line-strong': 'var(--vp-line-strong)',
          ink: 'var(--vp-ink)',
          'ink-2': 'var(--vp-ink-2)',
          'ink-3': 'var(--vp-ink-3)',
          'ink-inv': 'var(--vp-ink-inv)',
          brand: 'var(--vp-brand)',
          'brand-strong': 'var(--vp-brand-strong)',
          'brand-soft': 'var(--vp-brand-soft)',
          'brand-line': 'var(--vp-brand-line)',
          'brand-mid': 'var(--vp-brand-mid)',
          'brand-light': 'var(--vp-brand-light)',
          gold: 'var(--vp-gold)',
          'gold-ink': 'var(--vp-gold-ink)',
          'gold-soft': 'var(--vp-gold-soft)',
          'gold-line': 'var(--vp-gold-line)',
          paid: 'var(--vp-paid)',
          'paid-soft': 'var(--vp-paid-soft)',
          'paid-line': 'var(--vp-paid-line)',
          pending: 'var(--vp-pending)',
          'pending-soft': 'var(--vp-pending-soft)',
          'pending-line': 'var(--vp-pending-line)',
          review: 'var(--vp-review)',
          'review-soft': 'var(--vp-review-soft)',
          'review-line': 'var(--vp-review-line)',
          danger: 'var(--vp-danger)',
          'danger-soft': 'var(--vp-danger-soft)',
          'danger-line': 'var(--vp-danger-line)',
          insight: 'var(--vp-insight)',
          'insight-soft': 'var(--vp-insight-soft)',
          'insight-line': 'var(--vp-insight-line)',
          forecast: 'var(--vp-forecast)',
          'forecast-soft': 'var(--vp-forecast-soft)',
          'forecast-line': 'var(--vp-forecast-line)'
        }
      },
      fontFamily: {
        heading: ['Geist'],
        mono: ['"Geist Mono"'],
        sans: ['Geist', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Geist', 'system-ui', 'sans-serif']
      },
      fontSize: {
        'vp-caption': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.06em' }],
        'vp-small': ['0.8125rem', { lineHeight: '1.15rem' }],
        'vp-body': ['0.9375rem', { lineHeight: '1.4rem' }],
        'vp-label': ['1rem', { lineHeight: '1.4rem' }],
        'vp-h2': ['1.125rem', { lineHeight: '1.55rem', letterSpacing: '-0.01em' }],
        'vp-h1': ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.02em' }],
        'vp-num': ['1.75rem', { lineHeight: '2rem', letterSpacing: '-0.03em' }],
        'vp-hero': ['2.375rem', { lineHeight: '2.5rem', letterSpacing: '-0.035em' }]
      },
      borderRadius: {
        'vp-sm': '0.5rem',
        vp: '0.875rem',
        'vp-lg': '1.25rem'
      },
      boxShadow: {
        vp: '0 1px 2px 0 rgba(26, 24, 21, 0.04)',
        'vp-raised': '0 6px 18px -8px rgba(26, 24, 21, 0.18)',
        'vp-sheet': '0 -12px 40px -12px rgba(26, 24, 21, 0.28)'
      },
      spacing: {
        touch: '2.75rem'
      }
    }
  }
}
