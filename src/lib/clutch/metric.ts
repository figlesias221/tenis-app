/**
 * Pure statistics for the Clutch Index. No I/O, no domain knowledge beyond
 * arithmetic, so it can be unit-tested in isolation.
 */

export interface Fit {
  /** Intercept. */
  a: number;
  /** Slope. */
  b: number;
  /** Standard deviation of the residuals. */
  sd: number;
  /** Share of variance the predictor explains. This is the number the whole
   *  page argues from: if it is high, the "clutch" stat is mostly baseline. */
  r2: number;
}

/**
 * Ordinary least squares of y on x, plus the residual spread.
 *
 * Returns a null-slope fit when x has no variance, so a degenerate season
 * degrades to "everyone is average" rather than producing infinities.
 */
export function fitOls(xs: number[], ys: number[]): Fit {
  const n = xs.length;
  if (n < 2) return { a: mean(ys) || 0, b: 0, sd: 1, r2: 0 };

  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0) return { a: my, b: 0, sd: Math.sqrt(syy / n) || 1, r2: 0 };

  const b = sxy / sxx;
  const a = my - b * mx;

  let ss = 0;
  for (let i = 0; i < n; i++) {
    const resid = ys[i] - (a + b * xs[i]);
    ss += resid * resid;
  }
  const sd = Math.sqrt(ss / n) || 1;
  const r2 = syy === 0 ? 0 : 1 - ss / syy;

  return { a, b, sd, r2 };
}

export function predict(fit: Fit, x: number): number {
  return fit.a + fit.b * x;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 1;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / xs.length) || 1;
}

/**
 * Pull an estimate toward zero in proportion to how little evidence supports
 * it. A player with k observations keeps half his signal; one with 10k keeps
 * over 90%.
 *
 * This is what stops a 20-match journeyman with a hot streak from topping a
 * leaderboard built on residuals.
 */
export function shrink(z: number, n: number, k: number): number {
  return z * (n / (n + k));
}

/** Rescale a set of values to mean 0, SD 1. */
export function standardize(xs: number[]): number[] {
  const m = mean(xs);
  const s = stdev(xs);
  return xs.map((x) => (x - m) / s);
}

/**
 * Percentile rank within a pool, 0-100. Ties share the midpoint so that an
 * all-equal pool reports 50 rather than 0 or 100.
 */
export function percentileRanks(xs: number[]): number[] {
  const n = xs.length;
  if (n === 0) return [];
  if (n === 1) return [50];

  const order = xs.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v);
  const out = new Array<number>(n);

  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && order[j + 1].v === order[i].v) j++;
    // Midpoint of the tied block.
    const pct = ((i + j) / 2 / (n - 1)) * 100;
    for (let k = i; k <= j; k++) out[order[k].i] = pct;
    i = j + 1;
  }
  return out;
}

/** Round for serialisation. Keeps the artifact roughly 30% smaller. */
export function round(v: number, dp: number): number {
  return Number(v.toFixed(dp));
}

/**
 * Empirical-Bayes shrinkage for a set of rate residuals.
 *
 * `shrink()` above pulls an estimate toward zero by raw sample count, which
 * treats every observation as equally informative. For rates that is wrong: a
 * break-point-save figure over 700 attempts has a far wider sampling
 * distribution than one over 5,000, so the two residuals are not comparable
 * even after weighting.
 *
 * This estimator splits the observed spread of residuals into the part that
 * sampling noise alone would produce and the part that must be real, then
 * keeps only each player's share of the real part:
 *
 *     v_i  = e_i(1 - e_i) / n_i        binomial sampling variance
 *     tau2 = Var(d) - mean(v_i)        variance that noise cannot explain
 *     d*_i = d_i * tau2 / (tau2 + v_i)
 *
 * A player with little evidence keeps little of his residual; one with a great
 * deal keeps nearly all of it. Players with no opportunities collapse to zero.
 */
export function empiricalBayes(
  residuals: number[],
  expected: number[],
  ns: number[],
): { shrunk: number[]; tau: number } {
  const n = residuals.length;
  if (n === 0) return { shrunk: [], tau: 1 };

  const samplingVar = expected.map((e, i) => {
    if (!ns[i] || ns[i] <= 0) return Number.POSITIVE_INFINITY;
    const p = Math.min(Math.max(e, 0.01), 0.99);
    return (p * (1 - p)) / ns[i];
  });

  const observed = residuals.filter((_, i) => Number.isFinite(samplingVar[i]));
  const m = mean(observed);
  const totalVar =
    observed.length > 1
      ? observed.reduce((s, d) => s + (d - m) * (d - m), 0) / observed.length
      : 0;

  const finiteVars = samplingVar.filter(Number.isFinite);
  const meanSampling = finiteVars.length > 0 ? mean(finiteVars) : 0;

  // What sampling noise cannot account for. Floored so a component whose
  // spread is entirely noise degrades to "nobody differs" rather than dividing
  // by zero.
  const tau2 = Math.max(totalVar - meanSampling, 1e-8);

  const shrunk = residuals.map((d, i) =>
    Number.isFinite(samplingVar[i]) ? d * (tau2 / (tau2 + samplingVar[i])) : 0,
  );

  return { shrunk, tau: Math.sqrt(tau2) };
}
