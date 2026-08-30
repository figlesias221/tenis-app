/**
 * Types for the live ATP board.
 *
 * Deliberately separate from src/lib/api/types.ts. The archive's `Match` was
 * shaped for finished results - `score.sets: {player1, player2}[]` - and
 * cannot express a match in progress: games won per set, the points in the
 * game being played, or which player is serving. Widening the archive type to
 * fit would have made every frozen page carry fields that are always null.
 */

export type Tour = "atp" | "wta" | "challenger" | "itf" | "juniors";
export type Surface = "hard" | "clay" | "grass";
export type Draw = "singles" | "doubles";
export type Hand = "R" | "L";
export type RankingMovement = "up" | "down" | "same";

/** Where a match sits on the board. Not the API's `status`: see `phase` below. */
export type MatchPhase = "live" | "upcoming" | "finished";

/** How a match ended or paused, when it did not run its course. */
export type EventStatus =
  | "Retired"
  | "Cancelled"
  | "Walk Over"
  | "Postponed"
  | "Interrupted";

export interface LivePlayer {
  id: number | null;
  name: string;
  /** Already mapped to a flag asset name; "UN" when unknown. */
  countryIso2: string;
  /** The feed's own IOC code, kept for the flag's alt text. */
  countryIoc: string | null;
  ranking: number | null;
  rankingPoints: number | null;
  rankingMovement: RankingMovement | null;
  hand: Hand | null;
}

export interface LiveScore {
  /** Sets won, [p1, p2]. */
  sets: [number, number];
  /** Games per set, [p1[], p2[]] - the two arrays are the same length. */
  games: [number[], number[]];
  /** Points in the game being played, e.g. ["40", "30"]. Null between games. */
  points: [string, string] | null;
  server: 1 | 2 | null;
  isTiebreak: boolean;
  /** The feed's own staleness flag - it knows when it has stopped receiving. */
  stale: boolean;
  ageSeconds: number | null;
  timestamp: string | null;
}

export interface LiveMatch {
  id: number;
  tournament: string;
  tournamentId: string | null;
  tour: Tour | null;
  surface: Surface | null;
  indoor: boolean;
  format: "BO3" | "BO5" | null;
  /** The feed's free-text label, e.g. "ATP US Open - Final". */
  round: string | null;
  /** The normalized round, the field to branch on. Null when unrecognised. */
  roundCode: string | null;
  isQualifying: boolean;
  draw: Draw | null;
  /** ISO-8601 UTC. Null when the feed has not stated a time. */
  scheduledTime: string | null;
  players: [LivePlayer, LivePlayer];
  score: LiveScore | null;
  phase: MatchPhase;
  eventStatus: EventStatus | null;
  /** 1 or 2 where the feed named a winner; null while unresolved. */
  winner: 1 | 2 | null;
  /**
   * True when this match reached `finished` because we watched it drop off the
   * live list, not because the feed told us it was over. The FREE tier cannot
   * page completed matches, so every result this board shows is observed -
   * and the page says so rather than passing it off as official.
   */
  observed: boolean;
  /** When we last saw this match in a live response. */
  lastSeenAt: string | null;
}

/** Why the board is serving data older than its TTL. */
export type DegradedReason = "budget" | "error" | "locked";

export interface Snapshot {
  version: 2;
  /** The UTC day this board describes, YYYY-MM-DD. */
  day: string;
  fetchedAt: string;
  live: LiveMatch[];
  upcoming: LiveMatch[];
  /** Over, and resolved against the feed unless `observed` says otherwise. */
  finished: LiveMatch[];
  /**
   * Known to have been played today, gone from both live and upcoming, and not
   * yet resolved. Each costs one call to turn into a real result, so they are
   * resolved a few at a time as the budget allows and shown meanwhile with
   * whatever score was last seen.
   */
  pending: LiveMatch[];
  /** The API's own count of calls left today. Null when we could not ask. */
  callsRemaining: number | null;
  degraded: DegradedReason | null;
}

/** What /usage reports back. Reading it is free and does not consume quota. */
export interface UsageReport {
  tier: string;
  perDay: number | null;
  perMinute: number | null;
  callsToday: number;
  remainingDay: number | null;
}
