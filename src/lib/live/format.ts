/**
 * Display helpers for the live board. Pure, so they are testable and so no
 * component has to hold formatting rules of its own.
 */
import type { LiveMatch, LivePlayer, LiveScore, Surface } from "./types";

const ROUND_LABELS: Record<string, string> = {
  F: "Final",
  SF: "Semi-final",
  QF: "Quarter-final",
  R16: "Round of 16",
  R32: "Round of 32",
  R64: "Round of 64",
  R128: "Round of 128",
  RR: "Round robin",
  BR: "Bronze medal match",
  Q: "Qualifying",
  Q1: "Qualifying, first round",
  Q2: "Qualifying, second round",
  Q3: "Qualifying, third round",
  Q4: "Qualifying, fourth round",
  ER: "Early round",
};

/**
 * The round, in words.
 *
 * The feed's free-text `round` repeats the tour and tournament - "ATP US Open
 * - Final" - which is noise next to a column that already names the event, so
 * the normalized code is preferred and the label is only a fallback.
 */
export function roundLabel(match: LiveMatch): string {
  const base = match.roundCode ? ROUND_LABELS[match.roundCode] : undefined;
  if (base) {
    // A qualifying draw reaches its own final, and calling that "Final" on the
    // same board as the main draw's would be a lie of omission.
    return match.isQualifying && !base.startsWith("Qualifying")
      ? `Qualifying ${base.toLowerCase()}`
      : base;
  }
  const raw = match.round?.split(" - ").at(-1)?.trim();
  return raw && raw.length > 0 ? raw : "Round not stated";
}

export function surfaceClass(surface: Surface | null): string | null {
  return surface ? `swatch--${surface}` : null;
}

export function surfaceLabel(match: LiveMatch): string | null {
  if (!match.surface) return null;
  const name = match.surface[0].toUpperCase() + match.surface.slice(1);
  return match.indoor ? `Indoor ${name.toLowerCase()}` : name;
}

/** Games per set for one player, padded so both rows line up column for column. */
export function gamesFor(score: LiveScore | null, player: 1 | 2): number[] {
  if (!score) return [];
  const own = score.games[player - 1] ?? [];
  const other = score.games[player === 1 ? 1 : 0] ?? [];
  const length = Math.max(own.length, other.length);
  return Array.from({ length }, (_, i) => own[i] ?? 0);
}

/**
 * A one-line score, for the finished list: "6-4 3-6 7-6", from p1's side.
 */
export function scoreLine(score: LiveScore | null): string | null {
  if (!score) return null;
  const [p1, p2] = score.games;
  const sets = Math.max(p1.length, p2.length);
  if (sets === 0) return null;
  return Array.from(
    { length: sets },
    (_, i) => `${p1[i] ?? 0}-${p2[i] ?? 0}`,
  ).join(" ");
}

/**
 * How out of date a score is, in words, or null when it is current.
 *
 * The feed carries its own `stale` flag and an age in seconds; a board that
 * showed a frozen score as though it were live would be worse than one that
 * admits it has lost the thread.
 */
export function stalenessNote(score: LiveScore | null): string | null {
  if (!score) return null;
  if (score.stale) return "Feed has stopped updating this match";
  const age = score.ageSeconds;
  if (age === null || age < 300) return null;
  const minutes = Math.round(age / 60);
  return `Last change ${minutes} min ago`;
}

/**
 * The board's own freshness, kept short: it sits in a narrow KPI cell, and
 * "13 minutes ago" wrapped onto a second line and stretched the whole row.
 */
export function relativeAge(fetchedAt: string, now: Date): string {
  const ms = now.getTime() - Date.parse(fetchedAt);
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

/**
 * The final score written from one player's side: "6-4 3-6 7-5".
 *
 * Results are conventionally written winner-first, so the board flips the pairs
 * when the winner is the second competitor rather than printing the feed's
 * order and leaving the reader to work it out.
 */
export function scoreLineFrom(
  score: LiveScore | null,
  from: 1 | 2,
): string | null {
  if (!score) return null;
  const [first, second] =
    from === 1
      ? [score.games[0], score.games[1]]
      : [score.games[1], score.games[0]];
  const sets = Math.max(first.length, second.length);
  if (sets === 0) return null;
  return Array.from(
    { length: sets },
    (_, i) => `${first[i] ?? 0}-${second[i] ?? 0}`,
  ).join(" ");
}

/**
 * Winner and loser, in that order, or null when no winner is known - which is
 * every match the board only observed rather than resolved.
 */
export function outcomeOrder(
  match: LiveMatch,
): { winner: LivePlayer; loser: LivePlayer; from: 1 | 2 } | null {
  if (match.winner === null) return null;
  const from = match.winner;
  return {
    winner: match.players[from - 1],
    loser: match.players[from === 1 ? 1 : 0],
    from,
  };
}

export type SetOutcome = "won" | "lost" | "playing" | "none";

/**
 * How each set went for one player, so the board can weight the set that is
 * being played differently from the ones already decided.
 *
 * Only the last set can be in progress: a completed set has a winner, and the
 * feed never reports two unfinished sets.
 */
export function setOutcomes(
  score: LiveScore | null,
  player: 1 | 2,
  matchOver = false,
): SetOutcome[] {
  if (!score) return [];
  const own = score.games[player - 1] ?? [];
  const other = score.games[player === 1 ? 1 : 0] ?? [];
  const count = Math.max(own.length, other.length);
  return Array.from({ length: count }, (_, i) => {
    const mine = own[i] ?? 0;
    const theirs = other[i] ?? 0;
    if (i === count - 1 && !matchOver) return "playing";
    if (mine === theirs) return "none";
    return mine > theirs ? "won" : "lost";
  });
}

/** Sets won, as the headline number beside each name. */
export function setsWon(score: LiveScore | null, player: 1 | 2): number {
  return score?.sets[player - 1] ?? 0;
}
