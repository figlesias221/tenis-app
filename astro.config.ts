import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import { defineConfig, passthroughImageService } from "astro/config";

export default defineConfig({
  site: "https://tennis-app.dev",
  // Static by default, still. Every page built from the frozen archive is
  // prerendered, which is what stopped /rankings, /competitions and /player
  // 500ing on Cloudflare: csv-parser reads the filesystem, and Workers do not
  // have one.
  //
  // The single exception is /live, which marks itself `prerender = false`. It
  // is the only route that runs at request time, it reads its data from KV
  // rather than from disk, and nothing under src/lib/live imports the CSV
  // reader or the clutch JSON. `npm run check:bundle` enforces the second half
  // of that sentence.
  output: "static",
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  // Every image on this site is a static SVG flag or a plain <img>; nothing is
  // transformed. The default service is sharp, which drags a native binary and
  // its loader into the worker bundle for no benefit.
  image: { service: passthroughImageService() },
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
