/**
 * The only module that touches the generated Clutch JSON.
 *
 * IMPORTANT: import this ONLY from the prerendered clutch pages and their
 * components. The Cloudflare adapter builds every route into the SSR bundle
 * before prerendering, so importing it from tennisApi.ts or anything under
 * src/pages/api/ would pull ~1.2 MB of JSON into _worker.js and eat the
 * Workers size limit.
 */

import careerJson from "@/data/clutch/career.json";
import seasonsJson from "@/data/clutch/seasons.json";
import highlightsJson from "@/data/clutch/highlights.json";
import metaJson from "@/data/clutch/meta.json";

import type {
  ClutchHighlight,
  ClutchMeta,
  ClutchPlayer,
  ClutchSeasonRow,
} from "./types";

export const career = careerJson as unknown as ClutchPlayer[];
export const seasons = seasonsJson as unknown as ClutchSeasonRow[];
export const highlights = highlightsJson as unknown as ClutchHighlight[];
export const meta = metaJson as unknown as ClutchMeta;

export function seasonRows(year: number): ClutchSeasonRow[] {
  return seasons.filter((r) => r.y === year).sort((a, b) => a.rank - b.rank);
}

export function availableSeasons(): number[] {
  return [...new Set(seasons.map((r) => r.y))].sort((a, b) => a - b);
}

export function playerById(id: string): ClutchPlayer | undefined {
  return career.find((p) => p.id === id);
}
