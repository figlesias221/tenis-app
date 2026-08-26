import type { APIRoute } from "astro";
import { LocalDatasetProvider } from "@/lib/api/tennisApi";

/**
 * One static file per player: every match he played, keyed by opponent.
 *
 * Head-to-head cannot be prerendered pair-by-pair - 2,600 ranked players is
 * over three million combinations - so the client fetches one player's file
 * and filters it to the opponent. Average file is a few KB.
 */
export const prerender = true;

export function getStaticPaths() {
  return new LocalDatasetProvider("./data")
    .getAllPlayerIds()
    .map((id) => ({ params: { id } }));
}

export const GET: APIRoute = ({ params }) => {
  const id = params.id as string;
  const provider = new LocalDatasetProvider("./data");
  const { recent } = provider.getPlayerRecord(id, Number.MAX_SAFE_INTEGER);

  // Short keys: this ships to the browser.
  const matches = recent.map((m) => ({
    o: m.opponentId,
    n: m.opponent,
    d: m.date,
    t: m.tourney,
    r: m.round,
    s: m.surface,
    w: m.won ? 1 : 0,
    c: m.score,
  }));

  return new Response(JSON.stringify({ id, matches }), {
    headers: { "Content-Type": "application/json" },
  });
};
