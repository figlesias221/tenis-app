import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
import plugin from "tailwindcss/plugin";

export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bgColor: "hsl(var(--theme-bg) / <alpha-value>)",
        textColor: "hsl(var(--theme-text) / <alpha-value>)",
        link: "hsl(var(--theme-link) / <alpha-value>)",
        accent: "hsl(var(--theme-accent) / <alpha-value>)",
        "accent-2": "hsl(var(--theme-accent-2) / <alpha-value>)",

        // Premium Tennis Brand Colors
        tennis: {
          50: '#f0fdf4',   // Lightest green (court background)
          100: '#dcfce7',  // Very light green
          200: '#bbf7d0',  // Light green
          300: '#86efac',  // Medium-light green
          400: '#4ade80',  // Tennis ball green
          500: '#22c55e',  // Primary tennis green
          600: '#16a34a',  // Darker tennis green
          700: '#15803d',  // Deep green
          800: '#166534',  // Very dark green
          900: '#14532d',  // Darkest green
          950: '#0f2419',  // Ultra dark green
        },

        // Premium Accent Colors
        electric: {
          50: '#f0f9ff',   // Lightest electric blue
          100: '#e0f2fe',  // Very light electric blue
          200: '#bae6fd',  // Light electric blue
          300: '#7dd3fc',  // Medium electric blue
          400: '#38bdf8',  // Electric blue
          500: '#0ea5e9',  // Primary electric blue
          600: '#0284c7',  // Darker electric blue
          700: '#0369a1',  // Deep electric blue
          800: '#075985',  // Very dark electric blue
          900: '#0c4a6e',  // Darkest electric blue
          950: '#082f49',  // Ultra dark electric blue
        },

        // High-contrast surfaces
        surface: {
          50: '#fafafa',   // Pure white surface
          100: '#f5f5f5',  // Near white
          200: '#e5e5e5',  // Light gray
          300: '#d4d4d4',  // Medium-light gray
          400: '#a3a3a3',  // Medium gray
          500: '#737373',  // Base gray
          600: '#525252',  // Dark gray
          700: '#404040',  // Darker gray
          800: '#262626',  // Very dark gray
          900: '#171717',  // Near black
        },

        // Status colors with high-contrast
        status: {
          live: {
            bg: '#fee2e2',     // Light red background
            text: '#dc2626',   // Red text
            accent: '#ef4444', // Red accent
            dark: {
              bg: '#7f1d1d',   // Dark red background
              text: '#fca5a5', // Light red text
              accent: '#f87171' // Light red accent
            }
          },
          scheduled: {
            bg: '#dbeafe',     // Light blue background
            text: '#2563eb',   // Blue text
            accent: '#3b82f6', // Blue accent
            dark: {
              bg: '#1e3a8a',   // Dark blue background
              text: '#93c5fd', // Light blue text
              accent: '#60a5fa' // Light blue accent
            }
          },
          completed: {
            bg: '#d1fae5',     // Light green background
            text: '#059669',   // Green text
            accent: '#10b981', // Green accent
            dark: {
              bg: '#064e3b',   // Dark green background
              text: '#6ee7b7', // Light green text
              accent: '#34d399' // Light green accent
            }
          }
        }
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'court-texture': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        'electric-glow': 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      },

      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'electric': '0 0 20px rgba(14, 165, 233, 0.3)',
        'tennis': '0 0 20px rgba(34, 197, 94, 0.3)',
        'premium': '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },

      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce-subtle 2s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slide-up 0.3s ease-out',
      },

      keyframes: {
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        'glow': {
          'from': { boxShadow: '0 0 5px rgba(34, 197, 94, 0.5)' },
          'to': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.8)' },
        },
        'slide-up': {
          'from': { transform: 'translateY(10px)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Consolas",
          "Liberation Mono",
          "Menlo",
          ...defaultTheme.fontFamily.mono,
        ],
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".text-balance": {
          "text-wrap": "balance",
        },
      });
    }),
  ],
} satisfies Config;