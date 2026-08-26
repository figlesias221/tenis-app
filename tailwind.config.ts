import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

/**
 * Every colour resolves to a CSS custom property defined in global.css, so
 * light and dark are one set of class names with two sets of values.
 *
 * There is no decorative palette here on purpose. The only chromatic colours
 * are the four court surfaces, and they are only ever used to mean the surface
 * they name.
 */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",
        "paper-2": "rgb(var(--paper-2) / <alpha-value>)",
        "paper-3": "rgb(var(--paper-3) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-2": "rgb(var(--ink-2) / <alpha-value>)",
        "ink-3": "rgb(var(--ink-3) / <alpha-value>)",
        rule: "rgb(var(--rule) / <alpha-value>)",
        "rule-strong": "rgb(var(--rule-strong) / <alpha-value>)",

        // Court surfaces
        clay: "rgb(var(--clay) / <alpha-value>)",
        grass: "rgb(var(--grass) / <alpha-value>)",
        hard: "rgb(var(--hard) / <alpha-value>)",
        carpet: "rgb(var(--carpet) / <alpha-value>)",

        positive: "rgb(var(--positive) / <alpha-value>)",
        negative: "rgb(var(--negative) / <alpha-value>)",
        focus: "rgb(var(--focus) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-ui)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        // An almanac has square corners.
        none: "0",
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        ".text-balance": { "text-wrap": "balance" },
      });
    }),
  ],
} satisfies Config;
