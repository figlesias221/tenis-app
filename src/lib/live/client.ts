/**
 * A minimal read-only client for LiveTennisAPI (docs.livetennisapi.com).
 *
 * No caching and no state: every decision about whether a call is affordable
 * lives in snapshot.ts, so this module stays a pure translation layer between
 * the wire format and our own types. Normalization is exported separately from
 * fetching so it can be tested against recorded payloads without a network.
 */
import { iocToIso2 } from "./countries";
import type {
  Draw,
  EventStatus,
  Hand,
  LiveMatch,
  LivePlayer,
  LiveScore,
  MatchPhase,
  RankingMovement,
  Surface,
  Tour,
  UsageReport,
} from "./types";

const BASE = "https://api.livetennisapi.com/api/public/v1";

/** The wire shapes, narrowed to the fields this board reads. */
interface RawPlayer {
  id?: number | null;
  name?: string | null;
  country?: string | null;
  ranking?: number | null;
  ranking_points?: number | null;
  ranking_movement?: string | null;
  hand?: string | null;
}

interface RawScore {
  sets?: number[] | null;
  games?: number[][] | null;
  points?: string[] | null;
  server?: number | null;
  is_tiebreak?: boolean | null;
  stale?: boolean | null;
  age_seconds?: number | null;
  timestamp?: string | null;
}

export interface RawMatch {
  id: number;
  tournament?: string | null;
  tournament_id?: string | null;
  tour?: string | null;
  surface?: string | null;
  indoor?: boolean | null;
  format?: string | null;
  round?: string | null;
  round_code?: string | null;
  is_qualifying?: boolean | null;
  draw?: string | null;
  scheduled_time?: string | null;
  status?: string | null;
  event_status?: string | null;
  winner?: number | null;
  players?: { p1?: RawPlayer | null; p2?: RawPlayer | null } | null;
  score?: RawScore | null;
}

const TOURS: readonly string[] = ["atp", "wta", "challenger", "itf", "juniors"];
const SURFACES: readonly string[] = ["hard", "clay", "grass"];
const MOVEMENTS: readonly string[] = ["up", "down", "same"];
const EVENT_STATUSES: readonly string[] = [
  "Retired",
  "Cancelled",
  "Walk Over",
  "Postponed",
  "Interrupted",
];

/** Narrows a wire string to a union member, or null. Never guesses. */
function oneOf<T extends string>(
  value: string | null | undefined,
  allowed: readonly string[],
): T | null {
  return value != null && allowed.includes(value) ? (value as T) : null;
}

function normalizePlayer(raw: RawPlayer | null | undefined): LivePlayer {
  return {
    id: raw?.id ?? null,
    // A name is always present per the feed's contract, but a missing one must
    // not render as "undefined" on the board.
    name: raw?.name?.trim() || "To be confirmed",
    countryIso2: iocToIso2(raw?.country),
    countryIoc: raw?.country ?? null,
    ranking: raw?.ranking ?? null,
    rankingPoints: raw?.ranking_points ?? null,
    rankingMovement: oneOf<RankingMovement>(raw?.ranking_movement, MOVEMENTS),
    hand: oneOf<Hand>(raw?.hand, ["R", "L"]),
  };
}

function normalizeScore(raw: RawScore | null | undefined): LiveScore | null {
  if (!raw) return null;
  const sets = raw.sets ?? [];
  const games = raw.games ?? [];
  const points = raw.points ?? null;
  return {
    sets: [sets[0] ?? 0, sets[1] ?? 0],
    games: [games[0] ?? [], games[1] ?? []],
    // Two real entries or nothing. A finished match reports [null, null], and
    // a half-filled pair would render a lopsided game.
    points:
      points && points.length >= 2 && points[0] != null && points[1] != null
        ? [String(points[0]), String(points[1])]
        : null,
    server: raw.server === 1 || raw.server === 2 ? raw.server : null,
    isTiebreak: raw.is_tiebreak === true,
    stale: raw.stale === true,
    ageSeconds: raw.age_seconds ?? null,
    timestamp: raw.timestamp ?? null,
  };
}

/**
 * `phase` is passed in rather than read from `status` because the board's
 * notion of finished is our own: the FREE tier never returns a completed
 * match, so a match only becomes finished by dropping off the live list.
 */
export function normalizeMatch(raw: RawMatch, phase: MatchPhase): LiveMatch {
  return {
    id: raw.id,
    tournament: raw.tournament?.trim() || "Unnamed event",
    tournamentId: raw.tournament_id ?? null,
    tour: oneOf<Tour>(raw.tour, TOURS),
    surface: oneOf<Surface>(raw.surface, SURFACES),
    indoor: raw.indoor === true,
    format: oneOf<"BO3" | "BO5">(raw.format, ["BO3", "BO5"]),
    round: raw.round ?? null,
    roundCode: raw.round_code ?? null,
    isQualifying: raw.is_qualifying === true,
    draw: oneOf<Draw>(raw.draw, ["singles", "doubles"]),
    scheduledTime: raw.scheduled_time ?? null,
    players: [
      normalizePlayer(raw.players?.p1),
      normalizePlayer(raw.players?.p2),
    ],
    score: normalizeScore(raw.score),
    phase,
    eventStatus: oneOf<EventStatus>(raw.event_status, EVENT_STATUSES),
    winner: raw.winner === 1 || raw.winner === 2 ? raw.winner : null,
    observed: false,
    lastSeenAt: null,
  };
}

export class LiveTennisApiError extends Error {
  constructor(
    readonly status: number,
    readonly endpoint: string,
    body: string,
  ) {
    super(`LiveTennisAPI ${status} on ${endpoint}: ${body.slice(0, 200)}`);
    this.name = "LiveTennisApiError";
  }
}

async function request<T>(endpoint: string, apiKey: string): Promise<T> {
  const response = await fetch(`${BASE}${endpoint}`, {
    headers: { accept: "application/json", "X-API-Key": apiKey },
  });
  if (!response.ok) {
    throw new LiveTennisApiError(
      response.status,
      endpoint,
      await response.text().catch(() => ""),
    );
  }
  return (await response.json()) as T;
}

/**
 * Reads the key's own quota. The API documents this endpoint as quota-exempt,
 * which is what makes the budget floor in snapshot.ts possible: we can always
 * afford to ask how much we have left before deciding to spend any of it.
 */
export async function fetchUsage(apiKey: string): Promise<UsageReport> {
  const data = await request<{
    tier?: string;
    limits?: { per_day?: number | null; per_minute?: number | null };
    today?: { calls?: number; remaining_day?: number | null };
  }>("/usage", apiKey);
  return {
    tier: data.tier ?? "unknown",
    perDay: data.limits?.per_day ?? null,
    perMinute: data.limits?.per_minute ?? null,
    callsToday: data.today?.calls ?? 0,
    remainingDay: data.today?.remaining_day ?? null,
  };
}

/**
 * One call returns the whole ATP singles picture for a lifecycle status: the
 * tour and draw filters are applied server-side, before pagination.
 *
 * `status=completed` is deliberately not offered - it is a paid capability and
 * returns 403 on this tier.
 */
export async function fetchMatches(
  apiKey: string,
  status: "live" | "upcoming",
  { tour = "atp", draw = "singles", limit = 100 } = {},
): Promise<LiveMatch[]> {
  const query = new URLSearchParams({
    status,
    tour,
    draw,
    limit: String(limit),
  });
  const data = await request<{ data?: RawMatch[] }>(
    `/matches?${query}`,
    apiKey,
  );
  const phase: MatchPhase = status === "live" ? "live" : "upcoming";
  return (data.data ?? []).map((raw) => normalizeMatch(raw, phase));
}

/** Full detail for one match. Free on every tier, and resolves after the match ends. */
export async function fetchMatch(
  apiKey: string,
  id: number,
): Promise<LiveMatch> {
  const raw = await request<RawMatch>(`/matches/${id}`, apiKey);
  const phase: MatchPhase =
    raw.status === "live"
      ? "live"
      : raw.status === "upcoming"
        ? "upcoming"
        : "finished";
  return normalizeMatch(raw, phase);
}
