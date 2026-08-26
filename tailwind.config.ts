import type { Config } from "tailwindcss";

/**
 * Every colour resolves to a CSS custom property in global.css.
 *
 * This design is dark only. A floodlit court does not have a light mode, and
 * offering one would mean two palettes to validate for contrast and colour
 * vision rather than one that is right.
 */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        court: "rgb(var(--court) / <alpha-value>)",
        "court-2": "rgb(var(--court-2) / <alpha-value>)",
        "court-3": "rgb(var(--court-3) / <alpha-value>)",
        chalk: "rgb(var(--chalk) / <alpha-value>)",
        "chalk-2": "rgb(var(--chalk-2) / <alpha-value>)",
        "chalk-3": "rgb(var(--chalk-3) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        "line-2": "rgb(var(--line-2) / <alpha-value>)",
        ball: "rgb(var(--ball) / <alpha-value>)",
        above: "rgb(var(--above) / <alpha-value>)",
        below: "rgb(var(--below) / <alpha-value>)",
        clay: "rgb(var(--clay) / <alpha-value>)",
        grass: "rgb(var(--grass) / <alpha-value>)",
        hard: "rgb(var(--hard) / <alpha-value>)",
        carpet: "rgb(var(--carpet) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-ui)"],
        mono: ["var(--font-num)"],
      },
      borderRadius: { none: "0" },
    },
  },
  plugins: [],
} satisfies Config;
