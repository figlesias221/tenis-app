import type { Config } from "tailwindcss";

/**
 * Every colour resolves to a CSS custom property in global.css.
 *
 * Light only: the page is a paper artifact, and a dark scoring card is not a
 * thing that exists.
 */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        card: "rgb(var(--card) / <alpha-value>)",
        sheet: "rgb(var(--sheet) / <alpha-value>)",
        "sheet-2": "rgb(var(--sheet-2) / <alpha-value>)",
        grid: "rgb(var(--grid) / <alpha-value>)",
        rule: "rgb(var(--rule) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-2": "rgb(var(--ink-2) / <alpha-value>)",
        "ink-3": "rgb(var(--ink-3) / <alpha-value>)",
        pencil: "rgb(var(--pencil) / <alpha-value>)",
        clay: "rgb(var(--clay) / <alpha-value>)",
        grass: "rgb(var(--grass) / <alpha-value>)",
        hard: "rgb(var(--hard) / <alpha-value>)",
        carpet: "rgb(var(--carpet) / <alpha-value>)",
      },
      fontFamily: { sans: ["var(--font-ui)"], mono: ["var(--font-mono)"] },
      borderRadius: { none: "0" },
    },
  },
  plugins: [],
} satisfies Config;
