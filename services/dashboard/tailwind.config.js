/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Avenlo Brand Colors
        avenlo: {
          cyan: '#00D4FF',
          purple: '#8B5CF6',
          pink: '#EC4899',
          dark: '#0F0F23',
          darker: '#080814',
          card: '#1A1A2E',
          border: '#2D2D44',
          // Sovereign Tier
          obsidian: '#050505',
          void: '#020202',
        },
        // Neon State Indicators (CSI Sovereign Tier)
        neon: {
          red: '#FF3B3B',
          amber: '#FFAA00',
          cyan: '#00FFEA',
          purple: '#A855F7',
          green: '#00FF7F',
        },
        // Scepter Executive Layer (Owner-Class)
        scepter: {
          gold: '#D4AF37',
          goldLight: '#F5E6A3',
          goldDark: '#8B7355',
        },
        // Status Colors
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cal Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-pattern': 'url("/grid-pattern.svg")',
        'glow-cyan': 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(0, 212, 255, 0.15), transparent 40%)',
        'glow-purple': 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(139, 92, 246, 0.15), transparent 40%)',
        // CSI Sovereign Tier - Radial Heat Maps
        'heat-cold': 'radial-gradient(circle at center, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
        'heat-warm': 'radial-gradient(circle at center, rgba(245, 158, 11, 0.2) 0%, transparent 70%)',
        'heat-hot': 'radial-gradient(circle at center, rgba(239, 68, 68, 0.3) 0%, transparent 70%)',
        'heat-critical': 'radial-gradient(circle at center, rgba(255, 59, 59, 0.4) 0%, rgba(255, 59, 59, 0.1) 40%, transparent 70%)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'gradient': 'gradient 8s ease infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        // CSI Sovereign Tier Animations
        'pulse-neon': 'pulse-neon 2s ease-in-out infinite',
        'scan-line': 'scan-line 4s linear infinite',
        'ripple': 'ripple 0.6s ease-out',
        'highlight-flash': 'highlight-flash 0.8s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(0, 212, 255, 0.6)' },
        },
        // CSI Sovereign Tier Keyframes
        'pulse-neon': {
          '0%, 100%': { boxShadow: '0 0 5px var(--neon-color, #00FFEA), 0 0 10px var(--neon-color, #00FFEA)' },
          '50%': { boxShadow: '0 0 15px var(--neon-color, #00FFEA), 0 0 30px var(--neon-color, #00FFEA), 0 0 45px var(--neon-color, #00FFEA)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'ripple': {
          '0%': { transform: 'scale(0.8)', opacity: '1' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        'highlight-flash': {
          '0%': { backgroundColor: 'rgba(255, 59, 59, 0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(0, 212, 255, 0.3)',
        'glow-md': '0 0 20px rgba(0, 212, 255, 0.4)',
        'glow-lg': '0 0 40px rgba(0, 212, 255, 0.5)',
        'glow-purple': '0 0 30px rgba(139, 92, 246, 0.4)',
        'inner-glow': 'inset 0 0 20px rgba(0, 212, 255, 0.1)',
        // CSI Sovereign Tier Neon Shadows
        'neon-red': '0 0 10px rgba(255, 59, 59, 0.5), 0 0 20px rgba(255, 59, 59, 0.3), 0 0 30px rgba(255, 59, 59, 0.2)',
        'neon-amber': '0 0 10px rgba(255, 170, 0, 0.5), 0 0 20px rgba(255, 170, 0, 0.3), 0 0 30px rgba(255, 170, 0, 0.2)',
        'neon-cyan': '0 0 10px rgba(0, 255, 234, 0.5), 0 0 20px rgba(0, 255, 234, 0.3), 0 0 30px rgba(0, 255, 234, 0.2)',
        'neon-purple': '0 0 10px rgba(168, 85, 247, 0.5), 0 0 20px rgba(168, 85, 247, 0.3), 0 0 30px rgba(168, 85, 247, 0.2)',
      },
    },
  },
  plugins: [],
};
