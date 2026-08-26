/**
 * The Clutch Index artifact contract.
 *
 * Shared by the build script that produces the JSON and the pages that render
 * it. Field names are short because this ships as ~1 MB of JSON.
 */

export type ComponentKey = "serve" | "return" | "tiebreak" | "decider";

export const COMPONENT_KEYS: ComponentKey[] = [
  "serve",
  "return",
  "tiebreak",
  "decider",
];

export const COMPONENT_LABELS: Record<ComponentKey, string> = {
  serve: "Serving",
  return: "Returning",
  tiebreak: "Tiebreaks",
  decider: "Deciders",
};

/** What each component actually measures, in one line, for the page. */
export const COMPONENT_BLURBS: Record<ComponentKey, string> = {
  serve: "Break points saved, against what his ordinary service game predicts",
  return: "Break points converted, against what his ordinary return game predicts",
  tiebreak: "Tiebreaks won, against what his overall point-winning predicts",
  decider: "Deciding sets won, against what his overall match record predicts",
};

export interface ClutchComponent {
  /** Observed rate, 0-1. */
  r: number;
  /** Rate the era model expected of him, 0-1. */
  e: number;
  /** Standardised score after shrinkage. */
  z: number;
  /** Percentile within the qualifying pool, 0-100. */
  p: number;
  /** Sample size: break points, tiebreaks or deciding sets. */
  n: number;
}

export interface ClutchPlayer {
  id: string;
  name: string;
  /** ISO-2, already normalised from the dataset's IOC codes. */
  cc: string;
  ioc: string;
  /** 50 + 10z, one decimal. */
  rating: number;
  rank: number;
  /** Percentile within the career-qualifying pool. */
  pct: number;
  /** Eligible matches and wins. */
  m: number;
  w: number;
  /** First and last season with an eligible match. */
  y0: number;
  y1: number;
  /** Decade in which he played the most eligible matches. */
  era: string;
  /** Best rank held at the time of any eligible match. */
  bestRank: number | null;
  peak: { y: number; rating: number } | null;
  /**
   * start: career began before 1991, when serve statistics start, so his
   * record here is truncated. end: still active at the 2024 cutoff.
   */
  trunc: { start: boolean; end: boolean };
  surf: { hard: number; clay: number; grass: number; carpet: number };
  c: Record<ComponentKey, ClutchComponent>;
}

/**
 * A season leaderboard row. Carries less per component than a career row:
 * expected rates and sample sizes are dropped because they are recoverable
 * from meta.fits and together accounted for ~40% of the artifact's size.
 */
export interface ClutchSeasonRow {
  id: string;
  name: string;
  cc: string;
  y: number;
  rating: number;
  rank: number;
  m: number;
  w: number;
  c: Record<ComponentKey, Pick<ClutchComponent, "r" | "z" | "p">>;
}

export interface ClutchSeasonFit {
  y: number;
  matches: number;
  qualifiers: number;
  fit: Record<ComponentKey, { a: number; b: number; sd: number }>;
  /** Tour-wide pooled rates, for the era-drift table on the page. */
  tour: { spw: number; bpSaved: number; acesPerMatch: number };
}

export interface ClutchHighlight {
  id: string;
  name: string;
  cc: string;
  oppName: string;
  oppCc: string;
  y: number;
  tourney: string;
  round: string;
  surface: string;
  score: string;
  bpSaved: number;
  bpFaced: number;
  bpWon: number;
  bpAgainst: number;
  /** Break points won above what the era model expected, one decimal. */
  above: number;
}

export interface ClutchMeta {
  generatedAt: string;
  source: { name: string; url: string; license: string; attribution: string };
  seasons: [number, number];
  matchesSeen: number;
  matchesUsed: number;
  /** Rejections by rule name. Rendered directly into the methodology table. */
  excluded: Record<string, number>;
  careerQualifiers: number;
  seasonRows: number;
  thresholds: {
    seasonMatches: number;
    seasonBpFaced: number;
    careerMatches: number;
    careerBpFaced: number;
    careerSeasons: number;
  };
  /** Weights, derived from signalShare rather than chosen. */
  weights: Record<ComponentKey, number>;
  /**
   * Fraction of the between-player spread in each component that binomial
   * sampling noise cannot explain. A component at 0 is pure chance.
   */
  signalShare: Record<ComponentKey, number>;
  shrinkage: Record<ComponentKey, number>;
  ratingScale: { mid: number; perSd: number; min: number; max: number };
  /**
   * The headline correlation the page argues from: how much of the spread in
   * raw break-point rates is explained by ordinary serve and return quality.
   * The career figures are what a reader would compute for themselves; the
   * season figures are what the model actually fits on.
   */
  premise: {
    serveR2: number;
    returnR2: number;
    serveSlope: number;
    returnSlope: number;
    seasonServeR2: number;
    seasonReturnR2: number;
  };
  fits: ClutchSeasonFit[];
}
