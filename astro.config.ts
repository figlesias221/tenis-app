import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://tennis-app.dev",
  // Fully static. Every route is prerendered from a frozen archive, so there
  // is nothing to run at request time - which permanently removes the class of
  // failure that had /rankings, /competitions and /player 500ing on Cloudflare:
  // csv-parser reads the filesystem, and Workers do not have one.
  output: "static",
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap(),
    mdx(),
  ],
  markdown: {
    shikiConfig: {
      theme: "github-dark-dimmed",
      wrap: true,
    },
  },
});