/**
 * Builds the Clutch Index artifact from the vendored ATP CSVs.
 *
 * Run: npm run build:clutch
 *
 * Everything happens here, at build time, because the site deploys to
 * Cloudflare Workers where there is no filesystem. The pages import the
 * emitted JSON statically and prerender.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  loadAtpMatches,
  normalizeCountryCode,
  type AtpMatch,
} from "../src/lib/utils/csv-parser.ts";
import { parseScore, wentToDecider } from "../src/lib/utils/score-parser.ts";
import {
  fitOls,
  predict,
  shrink,
  mean,
  stdev,
  percentileRanks,
  empiricalBayes,
  round,
  type Fit,
} from "../src/lib/clutch/metric.ts";
import {
  COMPONENT_KEYS,
  type ClutchComponent,
  type ClutchHighlight,
  type ClutchMeta,
  type ClutchPlayer,
  type ClutchSeasonFit,
  type ClutchSeasonRow,
  type ComponentKey,
} from "../src/lib/clutch/types.ts";

// ---------------------------------------------------------------------------
// Configuration. Everything tunable lives here and is echoed into meta.json.
// ---------------------------------------------------------------------------

const FIRST_SEASON = 1991; // when serve statistics begin
const LAST_SEASON = 2024;

const THRESHOLDS = {
  seasonMatches: 15,
  seasonBpFaced: 60,
  careerMatches: 100,
  careerBpFaced: 400,
  careerSeasons: 3,
};

/** Observations at which a player keeps half his measured signal. */
const SHRINKAGE: Record<ComponentKey, number> = {
  serve: 600,
  return: 600,
  tiebreak: 60,
  decider: 40,
};

/**
 * Weights are NOT chosen. They are measured.
 *
 * Each component is weighted by its signal share - the fraction of the spread
 * between players that binomial sampling noise cannot account for. A component
 * that turns out to be pure chance earns a weight of zero on its own, without
 * anyone deciding to exclude it.
 *
 * Populated during the career pass and echoed into meta.json.
 */
const WEIGHTS: Record<ComponentKey, number> = {
  serve: 0, return: 0, tiebreak: 0, decider: 0,
};
const SIGNAL_SHARE: Record<ComponentKey, number> = {
  serve: 0, return: 0, tiebreak: 0, decider: 0,
};

const KEEP_LEVELS = new Set(["G", "M", "A", "F", "O"]);

/**
 * Team events and exhibitions that survive the level filter, plus Next Gen —
 * which uses no-ad scoring, making every deuce a break point and poisoning
 * both break-point components.
 */
const EXCLUDED_EVENTS =
  /davis\s*cup|laver\s*cup|united\s*cup|atp\s*cup|world\s*team|next\s*gen|hopman/i;

const STAT_FIELDS = [
  "w_svpt", "w_1stIn", "w_1stWon", "w_2ndWon", "w_bpSaved", "w_bpFaced",
  "l_svpt", "l_1stIn", "l_1stWon", "l_2ndWon", "l_bpSaved", "l_bpFaced",
] as const;

// ---------------------------------------------------------------------------
// Accumulators
// ---------------------------------------------------------------------------

interface Acc {
  id: string;
  name: string;
  ioc: string;
  m: number;
  w: number;
  // serving
  svpt: number; spw: number; bps: number; bpf: number;
  // returning
  rpt: number; rpw: number; conv: number; obpf: number;
  // tiebreaks and deciders
  tbw: number; tbl: number; dec: number; decw: number;
  // predictor for tiebreaks: overall point-winning
  ptsWon: number; ptsAll: number;
  surf: { hard: number; clay: number; grass: number; carpet: number };
  bestRank: number | null;
  minAge: number | null;
}

function emptyAcc(id: string, name: string, ioc: string): Acc {
  return {
    id, name, ioc, m: 0, w: 0,
    svpt: 0, spw: 0, bps: 0, bpf: 0,
    rpt: 0, rpw: 0, conv: 0, obpf: 0,
    tbw: 0, tbl: 0, dec: 0, decw: 0,
    ptsWon: 0, ptsAll: 0,
    surf: { hard: 0, clay: 0, grass: 0, carpet: 0 },
    bestRank: null, minAge: null,
  };
}

interface HighlightCandidate {
  y: number; id: string; name: string; ioc: string;
  oppName: string; oppIoc: string;
  tourney: string; round: string; surface: string; score: string;
  bpSaved: number; bpFaced: number; bpWon: number; bpAgainst: number;
}

const excluded: Record<string, number> = {
  "Team events and exhibitions": 0,
  "Retired, walkover or defaulted": 0,
  "No serve statistics recorded": 0,
  "Score could not be parsed": 0,
  "Failed a consistency check": 0,
};

let matchesSeen = 0;
let matchesUsed = 0;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

// ---------------------------------------------------------------------------
// Pass 1 — ingest and aggregate
// ---------------------------------------------------------------------------

/** player id -> season -> accumulator */
const bySeason = new Map<number, Map<string, Acc>>();
const highlightPool: HighlightCandidate[] = [];
const tourBySeason = new Map<number, { spw: number; bpSaved: number; aces: number; n: number;
                                        svpt: number; pts: number; bps: number; bpf: number }>();

function surfaceKey(s: string): keyof Acc["surf"] | null {
  const k = (s || "").toLowerCase();
  if (k === "hard") return "hard";
  if (k === "clay") return "clay";
  if (k === "grass") return "grass";
  if (k === "carpet") return "carpet";
  return null;
}

for (let year = FIRST_SEASON; year <= LAST_SEASON; year++) {
  const matches = loadAtpMatches(year);
  const accs = new Map<string, Acc>();
  bySeason.set(year, accs);
  const tour = { spw: 0, bpSaved: 0, aces: 0, n: 0, svpt: 0, pts: 0, bps: 0, bpf: 0 };
  tourBySeason.set(year, tour);

  for (const m of matches as AtpMatch[]) {
    matchesSeen++;

    if (!KEEP_LEVELS.has(m.tourney_level) || EXCLUDED_EVENTS.test(m.tourney_name)) {
      excluded["Team events and exhibitions"]++;
      continue;
    }

    const anyM = m as unknown as Record<string, string>;
    if (STAT_FIELDS.some((f) => !anyM[f] || !Number.isFinite(Number(anyM[f])))) {
      excluded["No serve statistics recorded"]++;
      continue;
    }

    const parsed = parseScore(m.score);
    if (!parsed) {
      // Distinguish a retirement from genuinely malformed data for the report.
      if (/\b(RET|W\/O|WO|DEF|ABD|Walkover)\b/i.test(m.score || "")) {
        excluded["Retired, walkover or defaulted"]++;
      } else {
        excluded["Score could not be parsed"]++;
      }
      continue;
    }

    const wSvpt = num(anyM.w_svpt), lSvpt = num(anyM.l_svpt);
    const wSpw = num(anyM.w_1stWon) + num(anyM.w_2ndWon);
    const lSpw = num(anyM.l_1stWon) + num(anyM.l_2ndWon);
    const wBps = num(anyM.w_bpSaved), wBpf = num(anyM.w_bpFaced);
    const lBps = num(anyM.l_bpSaved), lBpf = num(anyM.l_bpFaced);

    if (
      wSvpt <= 0 || lSvpt <= 0 ||
      wBps > wBpf || lBps > lBpf ||
      wSpw > wSvpt || lSpw > lSvpt ||
      num(anyM.w_1stIn) > wSvpt || num(anyM.l_1stIn) > lSvpt
    ) {
      excluded["Failed a consistency check"]++;
      continue;
    }

    matchesUsed++;
    tour.n++;
    tour.svpt += wSvpt + lSvpt;
    tour.pts += wSpw + lSpw;
    tour.bps += wBps + lBps;
    tour.bpf += wBpf + lBpf;
    tour.aces += num(anyM.w_ace) + num(anyM.l_ace);

    const bestOf = num(m.best_of);
    const decider = wentToDecider(parsed, bestOf);
    const sk = surfaceKey(m.surface);

    // Both players, from each one's own point of view.
    for (const isWinner of [true, false]) {
      const id = isWinner ? m.winner_id : m.loser_id;
      const name = isWinner ? m.winner_name : m.loser_name;
      const ioc = isWinner ? m.winner_ioc : m.loser_ioc;
      if (!id) continue;

      let a = accs.get(id);
      if (!a) { a = emptyAcc(id, name, ioc); accs.set(id, a); }

      const mySvpt = isWinner ? wSvpt : lSvpt;
      const mySpw = isWinner ? wSpw : lSpw;
      const myBps = isWinner ? wBps : lBps;
      const myBpf = isWinner ? wBpf : lBpf;
      const oppSvpt = isWinner ? lSvpt : wSvpt;
      const oppSpw = isWinner ? lSpw : wSpw;
      const oppBps = isWinner ? lBps : wBps;
      const oppBpf = isWinner ? lBpf : wBpf;

      a.m++;
      if (isWinner) a.w++;
      a.svpt += mySvpt; a.spw += mySpw; a.bps += myBps; a.bpf += myBpf;
      a.rpt += oppSvpt; a.rpw += oppSvpt - oppSpw;
      a.conv += oppBpf - oppBps; a.obpf += oppBpf;
      a.ptsWon += mySpw + (oppSvpt - oppSpw);
      a.ptsAll += mySvpt + oppSvpt;

      // Tiebreaks are recorded from the match winner's point of view.
      a.tbw += isWinner ? parsed.tiebreaksWon : parsed.tiebreaksLost;
      a.tbl += isWinner ? parsed.tiebreaksLost : parsed.tiebreaksWon;
      if (decider) { a.dec++; if (isWinner) a.decw++; }

      if (sk) a.surf[sk]++;

      const rank = num(isWinner ? m.winner_rank : m.loser_rank);
      if (Number.isFinite(rank) && rank > 0) {
        a.bestRank = a.bestRank === null ? rank : Math.min(a.bestRank, rank);
      }
      const age = num(isWinner ? m.winner_age : m.loser_age);
      if (Number.isFinite(age) && age > 0) {
        a.minAge = a.minAge === null ? age : Math.min(a.minAge, age);
      }

      if (myBpf + oppBpf >= 12) {
        highlightPool.push({
          y: year, id, name, ioc,
          oppName: isWinner ? m.loser_name : m.winner_name,
          oppIoc: isWinner ? m.loser_ioc : m.winner_ioc,
          tourney: m.tourney_name, round: m.round, surface: m.surface,
          score: m.score,
          bpSaved: myBps, bpFaced: myBpf,
          bpWon: oppBpf - oppBps, bpAgainst: oppBpf,
        });
      }
    }
  }
  process.stdout.write(
    `  ${year}: ${String(matches.length).padStart(4)} rows -> ${String(accs.size).padStart(4)} players\n`,
  );
}

// ---------------------------------------------------------------------------
// Pass 2 — fit each season, on that season's qualifiers
// ---------------------------------------------------------------------------

interface SeasonModel {
  fits: Record<ComponentKey, Fit>;
  qualifiers: number;
}

const rates = (a: Acc) => ({
  serveR: a.bpf > 0 ? a.bps / a.bpf : 0,
  serveX: a.svpt > 0 ? a.spw / a.svpt : 0,
  returnR: a.obpf > 0 ? a.conv / a.obpf : 0,
  returnX: a.rpt > 0 ? a.rpw / a.rpt : 0,
  tiebreakR: a.tbw + a.tbl > 0 ? a.tbw / (a.tbw + a.tbl) : 0,
  tiebreakX: a.ptsAll > 0 ? a.ptsWon / a.ptsAll : 0,
  deciderR: a.dec > 0 ? a.decw / a.dec : 0,
  deciderX: a.m > 0 ? a.w / a.m : 0,
});

const sampleOf = (a: Acc, c: ComponentKey): number =>
  c === "serve" ? a.bpf : c === "return" ? a.obpf : c === "tiebreak" ? a.tbw + a.tbl : a.dec;

function seasonQualifiers(accs: Map<string, Acc>): Acc[] {
  return [...accs.values()].filter(
    (a) => a.m >= THRESHOLDS.seasonMatches && a.bpf >= THRESHOLDS.seasonBpFaced &&
           a.obpf >= THRESHOLDS.seasonBpFaced,
  );
}

const models = new Map<number, SeasonModel>();
const seasonFits: ClutchSeasonFit[] = [];

for (const [year, accs] of bySeason) {
  const pool = seasonQualifiers(accs);
  const R = pool.map(rates);

  const fitFor = (c: ComponentKey): Fit => {
    // Components 3 and 4 rest on few events, so restrict the fit to players
    // who actually played some; otherwise zeros dominate the regression.
    const idx = pool
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => sampleOf(a, c) > 0)
      .map(({ i }) => i);
    const xs = idx.map((i) => R[i][`${c}X` as keyof (typeof R)[0]] as number);
    const ys = idx.map((i) => R[i][`${c}R` as keyof (typeof R)[0]] as number);
    return fitOls(xs, ys);
  };

  const fits = {
    serve: fitFor("serve"),
    return: fitFor("return"),
    tiebreak: fitFor("tiebreak"),
    decider: fitFor("decider"),
  } as Record<ComponentKey, Fit>;

  models.set(year, { fits, qualifiers: pool.length });

  const t = tourBySeason.get(year)!;
  seasonFits.push({
    y: year,
    matches: t.n,
    qualifiers: pool.length,
    fit: Object.fromEntries(
      COMPONENT_KEYS.map((c) => [c, { a: round(fits[c].a, 5), b: round(fits[c].b, 4), sd: round(fits[c].sd, 5) }]),
    ) as ClutchSeasonFit["fit"],
    tour: {
      spw: round(t.svpt > 0 ? t.pts / t.svpt : 0, 4),
      bpSaved: round(t.bpf > 0 ? t.bps / t.bpf : 0, 4),
      acesPerMatch: round(t.n > 0 ? t.aces / t.n : 0, 1),
    },
  });
}

// ---------------------------------------------------------------------------
// Pass 3 — per-season z-scores, then career aggregation
// ---------------------------------------------------------------------------

/** Raw residual and its within-season z, per player per season per component. */
interface SeasonZ {
  z: Record<ComponentKey, number>;
  n: Record<ComponentKey, number>;
  expected: Record<ComponentKey, number>;
  observed: Record<ComponentKey, number>;
}

const seasonZ = new Map<number, Map<string, SeasonZ>>();

for (const [year, accs] of bySeason) {
  const model = models.get(year)!;
  const out = new Map<string, SeasonZ>();
  seasonZ.set(year, out);

  for (const a of accs.values()) {
    const r = rates(a);
    const z = {} as Record<ComponentKey, number>;
    const n = {} as Record<ComponentKey, number>;
    const expected = {} as Record<ComponentKey, number>;
    const observed = {} as Record<ComponentKey, number>;

    for (const c of COMPONENT_KEYS) {
      const sample = sampleOf(a, c);
      const x = r[`${c}X` as keyof typeof r] as number;
      const obs = r[`${c}R` as keyof typeof r] as number;
      const exp = predict(model.fits[c], x);
      n[c] = sample;
      observed[c] = obs;
      expected[c] = exp;
      z[c] = sample > 0 ? (obs - exp) / model.fits[c].sd : 0;
    }
    out.set(a.id, { z, n, expected, observed });
  }
}

/** Career totals, summed across every season a player appears in. */
const career = new Map<string, Acc & { y0: number; y1: number; seasons: number[] }>();

for (const [year, accs] of bySeason) {
  for (const a of accs.values()) {
    let c = career.get(a.id);
    if (!c) {
      c = { ...emptyAcc(a.id, a.name, a.ioc), y0: year, y1: year, seasons: [] };
      career.set(a.id, c);
    }
    c.name = a.name;
    c.ioc = a.ioc;
    c.y0 = Math.min(c.y0, year);
    c.y1 = Math.max(c.y1, year);
    c.seasons.push(year);
    c.m += a.m; c.w += a.w;
    c.svpt += a.svpt; c.spw += a.spw; c.bps += a.bps; c.bpf += a.bpf;
    c.rpt += a.rpt; c.rpw += a.rpw; c.conv += a.conv; c.obpf += a.obpf;
    c.tbw += a.tbw; c.tbl += a.tbl; c.dec += a.dec; c.decw += a.decw;
    c.ptsWon += a.ptsWon; c.ptsAll += a.ptsAll;
    for (const k of ["hard", "clay", "grass", "carpet"] as const) c.surf[k] += a.surf[k];
    if (a.bestRank !== null) c.bestRank = c.bestRank === null ? a.bestRank : Math.min(c.bestRank, a.bestRank);
    if (a.minAge !== null) c.minAge = c.minAge === null ? a.minAge : Math.min(c.minAge, a.minAge);
  }
}

/** Which seasons count toward the "qualifying seasons" threshold. */
const qualifyingSeasonCount = new Map<string, number>();
for (const [year, accs] of bySeason) {
  for (const a of seasonQualifiers(accs)) {
    qualifyingSeasonCount.set(a.id, (qualifyingSeasonCount.get(a.id) ?? 0) + 1);
  }
  void year;
}

const careerPool = [...career.values()].filter(
  (c) =>
    c.m >= THRESHOLDS.careerMatches &&
    c.bpf >= THRESHOLDS.careerBpFaced &&
    (qualifyingSeasonCount.get(c.id) ?? 0) >= THRESHOLDS.careerSeasons,
);

// Career residuals, measured against an opportunity-weighted expectation.
// Using each season's own fitted expectation and then weighting keeps the era
// adjustment intact while letting the rate itself be pooled across a career.
interface CareerStat { r: number; e: number; n: number; d: number }
const careerStats = new Map<string, Record<ComponentKey, CareerStat>>();

for (const c of careerPool) {
  const pooled = rates(c);
  const rec = {} as Record<ComponentKey, CareerStat>;
  for (const key of COMPONENT_KEYS) {
    let we = 0;
    let wn = 0;
    for (const year of c.seasons) {
      const sz = seasonZ.get(year)?.get(c.id);
      if (!sz) continue;
      we += sz.expected[key] * sz.n[key];
      wn += sz.n[key];
    }
    const e = wn > 0 ? we / wn : 0;
    const r = pooled[`${key}R` as keyof typeof pooled] as number;
    rec[key] = { r, e, n: wn, d: wn > 0 ? r - e : 0 };
  }
  careerStats.set(c.id, rec);
}

// Empirical-Bayes shrinkage, per component, across the career pool.
const finalZ = new Map<string, Record<ComponentKey, number>>();
const pctByComponent = new Map<ComponentKey, Map<string, number>>();

for (const key of COMPONENT_KEYS) {
  const stats = careerPool.map((c) => careerStats.get(c.id)![key]);
  const { shrunk, tau } = empiricalBayes(
    stats.map((s) => s.d),
    stats.map((s) => s.e),
    stats.map((s) => s.n),
  );
  const zs = shrunk.map((d) => d / tau);
  {
    const ds = stats.map((x) => x.d);
    const dm = ds.reduce((a, b) => a + b, 0) / ds.length;
    const totalVar = ds.reduce((a, d) => a + (d - dm) * (d - dm), 0) / ds.length;
    const sv = stats
      .map((x) => {
        const pr2 = Math.min(Math.max(x.e, 0.01), 0.99);
        return x.n > 0 ? (pr2 * (1 - pr2)) / x.n : NaN;
      })
      .filter(Number.isFinite);
    const meanSv = sv.reduce((a, b) => a + b, 0) / sv.length;
    // Share of the between-player spread that sampling noise cannot explain.
    SIGNAL_SHARE[key] = Math.max(0, totalVar > 0 ? 1 - meanSv / totalVar : 0);
    console.log(
      `  [signal] ${key.padEnd(9)} observed sd=${Math.sqrt(totalVar).toFixed(5)}` +
        ` noise sd=${Math.sqrt(meanSv).toFixed(5)}` +
        ` real share=${(SIGNAL_SHARE[key] * 100).toFixed(1)}%` +
        ` medianN=${stats.map((x) => x.n).sort((a, b) => a - b)[Math.floor(stats.length / 2)]}`,
    );
  }

  const pr = percentileRanks(zs);
  const pmap = new Map<string, number>();
  careerPool.forEach((c, i) => {
    const cur = finalZ.get(c.id) ?? ({} as Record<ComponentKey, number>);
    cur[key] = zs[i];
    finalZ.set(c.id, cur);
    pmap.set(c.id, pr[i]);
  });
  pctByComponent.set(key, pmap);
}

// Normalise the measured signal shares into weights.
{
  const total = COMPONENT_KEYS.reduce((sum, k) => sum + SIGNAL_SHARE[k], 0);
  for (const k of COMPONENT_KEYS) {
    WEIGHTS[k] = total > 0 ? round(SIGNAL_SHARE[k] / total, 3) : 0.25;
  }
  console.log(
    `\n  weights (from measured signal): ` +
      COMPONENT_KEYS.map((k) => `${k} ${WEIGHTS[k]}`).join(", "),
  );
}

// Combine, then re-standardise the composite.
const rawComposite = careerPool.map((c) =>
  COMPONENT_KEYS.reduce((s, k) => s + WEIGHTS[k] * finalZ.get(c.id)![k], 0),
);
const rcMean = mean(rawComposite);
const rcSd = stdev(rawComposite);
const ratings = rawComposite.map((v) => 50 + 10 * ((v - rcMean) / rcSd));
const overallPct = percentileRanks(ratings);

// ---------------------------------------------------------------------------
// Season leaderboards — same formula, standardised within each season
// ---------------------------------------------------------------------------

const seasonRows: ClutchSeasonRow[] = [];
for (const [year, accs] of bySeason) {
  const pool = seasonQualifiers(accs);
  if (pool.length < 10) continue;

  const sh = pool.map((a) => {
    const sz = seasonZ.get(year)!.get(a.id)!;
    const o = {} as Record<ComponentKey, number>;
    for (const k of COMPONENT_KEYS) o[k] = shrink(sz.z[k], sz.n[k], SHRINKAGE[k] / 4);
    return o;
  });

  const zByKey = {} as Record<ComponentKey, number[]>;
  const pctByKey = {} as Record<ComponentKey, number[]>;
  for (const k of COMPONENT_KEYS) {
    const vals = sh.map((o) => o[k]);
    const m = mean(vals);
    const s = stdev(vals);
    zByKey[k] = vals.map((v) => (v - m) / s);
    pctByKey[k] = percentileRanks(vals);
  }

  const raw = pool.map((_, i) =>
    COMPONENT_KEYS.reduce((s, k) => s + WEIGHTS[k] * zByKey[k][i], 0),
  );
  const rm = mean(raw);
  const rs = stdev(raw);
  const rated = raw.map((v) => 50 + 10 * ((v - rm) / rs));

  const order = pool.map((_, i) => i).sort((p, q) => rated[q] - rated[p]);
  order.forEach((i, rankIdx) => {
    const a = pool[i];
    const sz = seasonZ.get(year)!.get(a.id)!;
    seasonRows.push({
      id: a.id,
      name: a.name,
      cc: normalizeCountryCode(a.ioc),
      y: year,
      rating: round(rated[i], 1),
      rank: rankIdx + 1,
      m: a.m,
      w: a.w,
      c: Object.fromEntries(
        COMPONENT_KEYS.map((k) => [k, {
          r: round(sz.observed[k], 3),
          z: round(zByKey[k][i], 2),
          p: Math.round(pctByKey[k][i]),
        }]),
      ) as ClutchSeasonRow["c"],
    });
  });
}

const peakByPlayer = new Map<string, { y: number; rating: number }>();
for (const row of seasonRows) {
  const cur = peakByPlayer.get(row.id);
  if (!cur || row.rating > cur.rating) peakByPlayer.set(row.id, { y: row.y, rating: row.rating });
}

// ---------------------------------------------------------------------------
// Assemble career rows
// ---------------------------------------------------------------------------

const decadeOf = (y: number) => `${Math.floor(y / 10) * 10}s`;

const players: ClutchPlayer[] = careerPool.map((c, i) => {
  const fz = finalZ.get(c.id)!;
  const cs = careerStats.get(c.id)!;

  const decades = new Map<string, number>();
  for (const y of c.seasons) {
    const acc = bySeason.get(y)!.get(c.id)!;
    decades.set(decadeOf(y), (decades.get(decadeOf(y)) ?? 0) + acc.m);
  }
  const era = [...decades.entries()].sort((a, b) => b[1] - a[1])[0][0];

  return {
    id: c.id,
    name: c.name,
    cc: normalizeCountryCode(c.ioc),
    ioc: c.ioc,
    rating: round(ratings[i], 1),
    rank: 0,
    pct: Math.round(overallPct[i]),
    m: c.m,
    w: c.w,
    y0: c.y0,
    y1: c.y1,
    era,
    bestRank: c.bestRank,
    peak: peakByPlayer.get(c.id) ?? null,
    trunc: {
      start: c.y0 <= FIRST_SEASON + 1 && (c.minAge ?? 0) > 21,
      end: c.y1 === LAST_SEASON,
    },
    surf: c.surf,
    c: Object.fromEntries(
      COMPONENT_KEYS.map((k) => [k, {
        r: round(cs[k].r, 4),
        e: round(cs[k].e, 4),
        z: round(fz[k], 2),
        p: Math.round(pctByComponent.get(k)!.get(c.id)!),
        n: sampleOf(c, k),
      } satisfies ClutchComponent]),
    ) as Record<ComponentKey, ClutchComponent>,
  };
});

players.sort((a, b) => b.rating - a.rating);
players.forEach((p, i) => { p.rank = i + 1; });

// ---------------------------------------------------------------------------
// Highlights — single-match performances furthest above expectation
// ---------------------------------------------------------------------------

const qualifiedIds = new Set(players.map((p) => p.id));
const highlights: ClutchHighlight[] = highlightPool
  .filter((h) => qualifiedIds.has(h.id))
  .map((h) => {
    const sz = seasonZ.get(h.y)?.get(h.id);
    if (!sz) return null;
    const above =
      (h.bpSaved - sz.expected.serve * h.bpFaced) +
      (h.bpWon - sz.expected.return * h.bpAgainst);
    return { ...h, cc: normalizeCountryCode(h.ioc), oppCc: normalizeCountryCode(h.oppIoc), above: round(above, 1) };
  })
  .filter((h): h is NonNullable<typeof h> => h !== null)
  .sort((a, b) => b.above - a.above)
  .slice(0, 8)
  .map(({ ioc: _i, oppIoc: _o, ...rest }) => rest as ClutchHighlight);

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Findings the page leads with.
//
// Computed here rather than on the page so the copy cannot drift from the data,
// and so every figure a reader sees is traceable to the artifact.
// ---------------------------------------------------------------------------

const RANK_BUCKETS: Array<[number, number, string]> = [
  [1, 5, "1-5"],
  [6, 20, "6-20"],
  [21, 50, "21-50"],
  [51, 9999, "51+"],
];

const byRank = RANK_BUCKETS.map(([lo, hi, label]) => {
  const group = players.filter((p) => p.bestRank !== null && p.bestRank >= lo && p.bestRank <= hi);
  return {
    label,
    n: group.length,
    meanRating: round(group.length ? mean(group.map((p) => p.rating)) : 0, 1),
  };
}).filter((b) => b.n > 0);

// The objection every informed reader raises: is this just penalising good
// players? Correlate how good a man was (the rate the model expected of him)
// against his clutch rating. Near zero means no.
const qualityFit = fitOls(
  players.map((p) => p.c.serve.e),
  players.map((p) => p.rating),
);
const qualityCorr =
  Math.sign(qualityFit.b) * Math.sqrt(Math.max(0, qualityFit.r2));

/** The single most extreme showing in any one component. */
function extremeIn(key: ComponentKey, dir: 1 | -1) {
  const pool = players.filter((p) => p.c[key].n > 0);
  const best = pool.reduce((a, b) => (b.c[key].z * dir > a.c[key].z * dir ? b : a));
  return { id: best.id, name: best.name, z: best.c[key].z, rank: best.rank };
}

// The widest gap between a man's serving and his returning under pressure.
const widestSplit = players.reduce((a, b) =>
  Math.abs(b.c.serve.z - b.c.return.z) > Math.abs(a.c.serve.z - a.c.return.z) ? b : a,
);

// The headline claim, measured over the career pool itself: how much of the
// spread in raw break-point rates is explained by ordinary serve/return
// quality. This is the number a reader would arrive at independently.
const premiseServe = fitOls(
  careerPool.map((c) => rates(c).serveX),
  careerPool.map((c) => rates(c).serveR),
);
const premiseReturn = fitOls(
  careerPool.map((c) => rates(c).returnX),
  careerPool.map((c) => rates(c).returnR),
);
console.log(
  `\n  premise (career pool): serve R2=${premiseServe.r2.toFixed(3)} slope=${premiseServe.b.toFixed(3)}, ` +
    `return R2=${premiseReturn.r2.toFixed(3)} slope=${premiseReturn.b.toFixed(3)}`,
);
const meta: ClutchMeta = {
  generatedAt: new Date().toISOString().slice(0, 10),
  source: {
    name: "Jeff Sackmann, tennis_atp",
    url: "https://github.com/JeffSackmann",
    license: "CC BY-NC-SA 4.0",
    attribution: "Match records compiled by Jeff Sackmann.",
  },
  seasons: [FIRST_SEASON, LAST_SEASON],
  matchesSeen,
  matchesUsed,
  excluded,
  careerQualifiers: players.length,
  seasonRows: seasonRows.length,
  thresholds: THRESHOLDS,
  weights: WEIGHTS,
  signalShare: Object.fromEntries(
    COMPONENT_KEYS.map((k) => [k, round(SIGNAL_SHARE[k], 4)]),
  ) as Record<ComponentKey, number>,
  shrinkage: SHRINKAGE,
  ratingScale: {
    mid: 50,
    perSd: 10,
    min: round(Math.min(...players.map((p) => p.rating)), 1),
    max: round(Math.max(...players.map((p) => p.rating)), 1),
  },
  findings: {
    byRank,
    qualityCorr: round(qualityCorr, 3),
    bestTiebreak: extremeIn("tiebreak", 1),
    bestServe: extremeIn("serve", 1),
    bestReturn: extremeIn("return", 1),
    widestSplit: {
      id: widestSplit.id,
      name: widestSplit.name,
      rank: widestSplit.rank,
      serve: widestSplit.c.serve.z,
      return: widestSplit.c.return.z,
      tiebreak: widestSplit.c.tiebreak.z,
    },
  },
  premise: {
    serveR2: round(premiseServe.r2, 3),
    returnR2: round(premiseReturn.r2, 3),
    serveSlope: round(premiseServe.b, 3),
    returnSlope: round(premiseReturn.b, 3),
    seasonServeR2: round(mean([...models.values()].map((m) => m.fits.serve.r2)), 3),
    seasonReturnR2: round(mean([...models.values()].map((m) => m.fits.return.r2)), 3),
  },
  fits: seasonFits,
};

const outDir = join(process.cwd(), "src", "data", "clutch");
mkdirSync(outDir, { recursive: true });
const write = (name: string, data: unknown) => {
  const json = JSON.stringify(data);
  writeFileSync(join(outDir, name), json);
  return (json.length / 1024).toFixed(0);
};

const sizes = {
  career: write("career.json", players),
  seasons: write("seasons.json", seasonRows),
  highlights: write("highlights.json", highlights),
  meta: write("meta.json", meta),
};

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`\n${"=".repeat(72)}`);
console.log(`Matches seen ${matchesSeen}, used ${matchesUsed} (${((matchesUsed / matchesSeen) * 100).toFixed(1)}%)`);
for (const [rule, n] of Object.entries(excluded)) {
  console.log(`  excluded, ${rule}: ${n}`);
}
console.log(`\nCareer qualifiers: ${players.length}   Season rows: ${seasonRows.length}`);
console.log(`Rating range: ${meta.ratingScale.min} to ${meta.ratingScale.max}`);
console.log(`Mean R2 across seasons - serve ${meta.premise.serveR2}, return ${meta.premise.returnR2}`);
console.log(`JSON: career ${sizes.career}KB, seasons ${sizes.seasons}KB, highlights ${sizes.highlights}KB, meta ${sizes.meta}KB`);

const f2024 = seasonFits.find((f) => f.y === 2024)!;
console.log(`\n2024 checkpoint: ${f2024.matches} matches used, ${f2024.qualifiers} qualifiers`);
console.log(`  serve  fit b=${f2024.fit.serve.b} a=${f2024.fit.serve.a} sd=${f2024.fit.serve.sd}`);
console.log(`  return fit b=${f2024.fit.return.b} a=${f2024.fit.return.a} sd=${f2024.fit.return.sd}`);

console.log(`\n  findings: quality-vs-clutch r=${round(qualityCorr, 3)} (near zero = not penalising good players)`);
for (const b of byRank) console.log(`    best rank ${b.label.padEnd(6)} n=${String(b.n).padStart(3)}  mean clutch ${b.meanRating}`);

console.log(`\n${"-".repeat(72)}\nACCEPTANCE GATE - top 25 career\n${"-".repeat(72)}`);
for (const p of players.slice(0, 25)) {
  const c = p.c;
  console.log(
    `${String(p.rank).padStart(3)}  ${p.rating.toFixed(1).padStart(5)}  ${p.name.padEnd(24)}` +
    ` ${p.y0}-${p.y1}  m=${String(p.m).padStart(4)}` +
    `  srv${c.serve.z >= 0 ? "+" : ""}${c.serve.z.toFixed(2)}` +
    ` ret${c.return.z >= 0 ? "+" : ""}${c.return.z.toFixed(2)}` +
    ` tb${c.tiebreak.z >= 0 ? "+" : ""}${c.tiebreak.z.toFixed(2)}` +
    ` dec${c.decider.z >= 0 ? "+" : ""}${c.decider.z.toFixed(2)}`,
  );
}
console.log(`\nBottom 10:`);
for (const p of players.slice(-10)) {
  console.log(`${String(p.rank).padStart(3)}  ${p.rating.toFixed(1).padStart(5)}  ${p.name.padEnd(24)} ${p.y0}-${p.y1}  m=${p.m}`);
}
