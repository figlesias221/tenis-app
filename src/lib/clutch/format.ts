import type { ClutchPlayer, ComponentKey } from "./types";

/**
 * Percentile shading. The classes must be written out in full: Tailwind's JIT
 * scans source text, so a constructed class name like `bg-${tone}-500` would
 * never be emitted.
 *
 * The ramp tops out at 0.30 alpha, where ink over it still measures about 10:1.
 */
const SHADE_STEPS = [0, 0.06, 0.12, 0.2, 0.3];

export function shadeStyle(percentile: number, positive: boolean): string {
  // Only the tails are shaded; the middle of the distribution stays plain so
  // the eye is drawn to genuine outliers rather than to everyone.
  const distance = Math.abs(percentile - 50) / 50;
  let step = 0;
  if (distance > 0.9) step = 4;
  else if (distance > 0.75) step = 3;
  else if (distance > 0.6) step = 2;
  else if (distance > 0.45) step = 1;

  const tone = positive ? "var(--positive)" : "var(--negative)";
  return `--shade:${SHADE_STEPS[step]};--shade-tone:${tone}`;
}

/** A signed value in percentage points, e.g. "+3.1". */
export function signedPoints(value: number, dp = 1): string {
  const pts = value * 100;
  const sign = pts >= 0.05 ? "+" : pts <= -0.05 ? "" : "";
  return `${sign}${pts.toFixed(dp)}`;
}

export function pct(value: number, dp = 1): string {
  return `${(value * 100).toFixed(dp)}%`;
}

/** "1991–2004", or "1991–" when the player was still active at the cutoff. */
export function span(p: Pick<ClutchPlayer, "y0" | "y1" | "trunc">): string {
  return `${p.y0}–${p.y1}`;
}

export const COMPONENT_ORDER: ComponentKey[] = [
  "serve",
  "return",
  "tiebreak",
  "decider",
];

export function surfaceClass(surface: string): string {
  const k = surface.toLowerCase();
  if (k === "clay") return "tag--clay";
  if (k === "grass") return "tag--grass";
  if (k === "hard") return "tag--hard";
  return "tag--carpet";
}
