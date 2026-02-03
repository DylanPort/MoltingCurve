/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Monochrome Dark Theme - Pure Black/White/Grey
        arena: {
          // Backgrounds - pure black to dark grey
          bg: '#000000',             // Pure black
          'bg-elevated': '#0A0A0A',  // Slightly elevated
          'bg-hover': '#111111',     // Hover state
          
          // Cards - subtle elevation
          card: '#0A0A0A',           // Card background
          'card-hover': '#111111',   // Card hover
          'card-elevated': '#151515', // Modal/overlay
          
          // Borders - subtle separation
          border: '#1A1A1A',         // Primary border
          'border-light': '#151515', // Subtle border
          'border-hover': '#2A2A2A', // Border on hover
          
          // Text hierarchy - white to grey
          text: '#FFFFFF',           // Primary text - pure white
          'text-secondary': '#A0A0A0', // Secondary text
          'text-tertiary': '#707070',  // Tertiary/muted text
          'text-muted': '#505050',     // Very muted
          
          // Accent - white with glow
          accent: '#FFFFFF',         // Pure white accent
          'accent-dim': '#C0C0C0',   // Dimmed accent
          
          // Status colors - monochrome versions
          success: '#FFFFFF',        // White for success
          'success-dim': '#1A1A1A',  // Dark background
          warning: '#FFFFFF',        // White for warning
          'warning-dim': '#1A1A1A',  // Dark background
          error: '#FFFFFF',          // White for error
          'error-dim': '#1A1A1A',    // Dark background
          info: '#FFFFFF',           // White for info
          'info-dim': '#1A1A1A',     // Dark background
          
          // Special
          glow: 'rgba(255,255,255,0.05)',  // Subtle white glow
          overlay: 'rgba(0,0,0,0.8)',      // Modal overlay
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'SF Mono',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        'xxs': '0.625rem',
      },
      boxShadow: {
        'card': '0 0 30px rgba(255,255,255,0.02)',
        'card-hover': '0 0 40px rgba(255,255,255,0.05)',
        'subtle': '0 0 10px rgba(255,255,255,0.02)',
        'glow': '0 0 30px rgba(255,255,255,0.1)',
        'glow-strong': '0 0 50px rgba(255,255,255,0.15)',
        'inner': 'inset 0 0 20px rgba(255,255,255,0.02)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(180deg, #0A0A0A 0%, #000000 100%)',
        'gradient-card': 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)',
        'gradient-shine': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255,255,255,0.05)' },
          '50%': { boxShadow: '0 0 40px rgba(255,255,255,0.1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
