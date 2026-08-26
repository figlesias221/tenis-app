/**
 * Canonical parser for Jeff Sackmann-format tennis score strings.
 *
 * Everything here is expressed from the MATCH WINNER's point of view, because
 * that is how the dataset stores it: the winner's games always come first.
 *
 * The one rule worth stating plainly, because it is easy to get backwards:
 * in `7-6(5)` the parenthesised number is the TIEBREAK LOSER's point total.
 * So `7-6(5)` is a 7-5 breaker and `7-6(8)` is a 10-8 breaker.
 */

export interface ParsedSet {
  /** Games won by the match winner in this set. */
  winnerGames: number;
  /** Games won by the match loser in this set. */
  loserGames: number;
  /** True when this set was decided by a tiebreak. */
  tiebreak: boolean;
  /** Points won in the tiebreak by whoever won this set. */
  setWinnerTiebreakPoints?: number;
  /** Points won in the tiebreak by whoever lost this set. */
  setLoserTiebreakPoints?: number;
  /** True for `[10-8]`-style match tiebreaks that replace a final set. */
  matchTiebreak: boolean;
}

export interface ParsedScore {
  sets: ParsedSet[];
  /** Tiebreaks won / lost by the MATCH winner across the whole match. */
  tiebreaksWon: number;
  tiebreaksLost: number;
}

/** Markers for matches that never reached a natural conclusion. */
const INCOMPLETE = /\b(RET|W\/O|WO|DEF|ABD|ABN|Def|Walkover|Unfinished|In\s*Progress|UNK)\b/i;

/** Literal junk that appears in a handful of historical rows. */
const JUNK = /^(unfinished|played|and|default|score)$/i;

/**
 * Parse a score string. Returns null when the score is unusable — a
 * retirement, walkover, default, or anything that does not fit the grammar.
 *
 * Returning null rather than a partial result is deliberate: a retirement's
 * set count is meaningless for deciding-set detection, and quietly counting
 * one would corrupt every downstream rate.
 */
export function parseScore(score: string | undefined | null): ParsedScore | null {
  if (!score) return null;
  const trimmed = score.trim();
  if (trimmed === "" || INCOMPLETE.test(trimmed)) return null;

  const sets: ParsedSet[] = [];
  let tiebreaksWon = 0;
  let tiebreaksLost = 0;

  for (const token of trimmed.split(/\s+/)) {
    if (JUNK.test(token)) return null;

    const parsed = parseToken(token);
    if (!parsed) return null;

    sets.push(parsed);
    if (parsed.tiebreak) {
      // The set winner won the tiebreak; the match winner won the set iff
      // he took more games in it.
      if (parsed.winnerGames > parsed.loserGames) tiebreaksWon++;
      else tiebreaksLost++;
    }
  }

  if (sets.length === 0) return null;
  return { sets, tiebreaksWon, tiebreaksLost };
}

function parseToken(token: string): ParsedSet | null {
  // Match tiebreak replacing a final set: [10-8]
  const bracket = token.match(/^\[(\d+)-(\d+)\]$/);
  if (bracket) {
    const winnerGames = Number(bracket[1]);
    const loserGames = Number(bracket[2]);
    return {
      winnerGames,
      loserGames,
      tiebreak: true,
      setWinnerTiebreakPoints: Math.max(winnerGames, loserGames),
      setLoserTiebreakPoints: Math.min(winnerGames, loserGames),
      matchTiebreak: true,
    };
  }

  const normal = token.match(/^(\d+)-(\d+)(?:\((\d+)\))?$/);
  if (!normal) return null;

  const winnerGames = Number(normal[1]);
  const loserGames = Number(normal[2]);
  if (!Number.isFinite(winnerGames) || !Number.isFinite(loserGames)) return null;
  // A set nobody won is not a set.
  if (winnerGames === loserGames) return null;

  if (normal[3] === undefined) {
    return { winnerGames, loserGames, tiebreak: false, matchTiebreak: false };
  }

  // The parenthesised value is the tiebreak LOSER's points.
  const setLoserTiebreakPoints = Number(normal[3]);
  const setWinnerTiebreakPoints = Math.max(7, setLoserTiebreakPoints + 2);

  return {
    winnerGames,
    loserGames,
    tiebreak: true,
    setWinnerTiebreakPoints,
    setLoserTiebreakPoints,
    matchTiebreak: false,
  };
}

/**
 * True when the match went the full distance — a third set in a best-of-three,
 * a fifth in a best-of-five.
 */
export function wentToDecider(parsed: ParsedScore, bestOf: number): boolean {
  return parsed.sets.length === bestOf;
}

/** True when the MATCH winner also won the final set. Always true for a
 *  completed match, and kept only for readability at call sites. */
export function winnerWonDecider(parsed: ParsedScore): boolean {
  const last = parsed.sets[parsed.sets.length - 1];
  return last.winnerGames > last.loserGames;
}

export interface PeriodScore {
  number: number;
  /** Always "set" — match tiebreaks are still reported as the set they replaced. */
  type: string;
  home_score: number;
  away_score: number;
  home_tiebreak_score?: number;
  away_tiebreak_score?: number;
}

/**
 * Render a parsed score as the `period_scores` shape the API layer expects,
 * where `home` is the match winner.
 */
export function toPeriodScores(score: string | undefined | null): PeriodScore[] {
  const parsed = parseScore(score);
  if (!parsed) return [];

  return parsed.sets.map((set, index) => {
    const period: PeriodScore = {
      number: index + 1,
      type: "set",
      home_score: set.winnerGames,
      away_score: set.loserGames,
    };

    if (set.tiebreak && !set.matchTiebreak) {
      // Orient the tiebreak points to match winner / match loser.
      const winnerTookSet = set.winnerGames > set.loserGames;
      period.home_tiebreak_score = winnerTookSet
        ? set.setWinnerTiebreakPoints
        : set.setLoserTiebreakPoints;
      period.away_tiebreak_score = winnerTookSet
        ? set.setLoserTiebreakPoints
        : set.setWinnerTiebreakPoints;
    }

    return period;
  });
}
