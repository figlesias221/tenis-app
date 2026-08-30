# The Tennis Almanac

A record of professional men's tennis, built with Astro and deployed to
Cloudflare Pages. Almost all of it is a frozen archive: 34 seasons of ATP
match records, rendered once at build time. One page is not.

## The two halves

**The archive.** `data/` holds Jeff Sackmann's `tennis_atp` dataset — 108,375
matches from 1991 to 2024, plus players and ranking weeks — vendored into the
repository because the upstream repo was removed from GitHub. See
[`data/SOURCE.md`](data/SOURCE.md) for provenance and licence.
`src/lib/utils/csv-parser.ts` reads it with `readFileSync`, which is why every
archive route is prerendered: Workers have no filesystem, and serving these
pages on demand is what used to 500 in production.

**The live board.** `/live` shows today's ATP singles matches from
[LiveTennisAPI](https://livetennisapi.com). It is the only route that runs at
request time. Nothing in `src/lib/live/` imports the CSV reader or the clutch
JSON, and `npm run check:bundle` fails the build if that changes.

## Running it

```bash
npm install
npm run dev
```

`/live` needs two things, and renders an explanatory notice without them:

1. **An API key.** Put it in `.dev.vars` (gitignored):

   ```
   LIVETENNIS_API_KEY=your_key_here
   ```

   In production it is a Cloudflare secret, never a committed file.

2. **A KV namespace**, which caches the board so every visitor shares one copy:

   ```bash
   npx wrangler kv namespace create LIVE_CACHE
   npx wrangler kv namespace create LIVE_CACHE --preview
   ```

   Paste the two ids into `wrangler.toml`.

## The API budget

The free tier allows **100 requests a day**, shared across every visitor, so the
board is designed around that number rather than around freshness:

- One request returns every ATP singles match, because `tour` and `draw` are
  filtered server-side. A refresh costs **two** — the live list and the
  upcoming list.
- The snapshot lives in KV. A thousand readers cost what one reader costs, and
  a day with no visitors costs nothing: refreshes happen lazily, on a request
  that finds the cache stale.
- `/usage` is quota-exempt, so the governor asks the API how much budget is
  left before spending any of it, and stops at a reserve of 20 calls. That
  count is authoritative across production, previews and local development,
  which all share one key.
- Refresh interval: 15 minutes while matches are in play, 60 when they are not.
  All four numbers are constants at the top of `src/lib/live/snapshot.ts`.

**What the free tier does not give you:** completed matches. `status=completed`
returns `403 upgrade_required`. The board therefore reports a result only for a
match it watched drop off the live list, carrying the last score it saw, and
labels those as observed rather than official.

## Layout

```
data/                     Vendored CSVs, ~52 MB, the frozen archive
src/lib/api/              Archive access: LocalDatasetProvider over the CSVs
src/lib/clutch/           The Clutch Index, from prebuilt JSON in src/data/
src/lib/live/             The live board: client, governor, types, formatting
src/pages/live.astro      The only route with `prerender = false`
scripts/                  Build-time and guard scripts
tests/                    node:test units, no network
```

## Scripts

| | |
|---|---|
| `npm run dev` | Astro dev server, with Cloudflare bindings proxied |
| `npm run build` | `astro check` then `astro build` |
| `npm run test:clutch` | `node:test` units for the score parser and the live board |
| `npm run build:clutch` | Regenerates `src/data/clutch/*.json` from the archive |
| `npm run check:bundle` | Fails if the clutch JSON leaks into `_worker.js` |
| `npm run check:emoji` | Fails on any emoji codepoint |
| `npm run lint` / `format` | Biome, Prettier |

## Licence and attribution

Match and ranking records are © Jeff Sackmann, published as `tennis_atp` under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). This
archive is non-commercial and shares alike. Live scores are supplied by
LiveTennisAPI under its own terms. Not affiliated with the ATP, WTA or ITF.
