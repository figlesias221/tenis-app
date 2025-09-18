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
          defaultTheme.fontFamily.mono,
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