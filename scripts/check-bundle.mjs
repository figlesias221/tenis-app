/**
 * Fails the build if the Clutch artifact leaks into the Cloudflare SSR worker.
 *
 * The adapter bundles every route before prerendering, so a single import of
 * src/lib/clutch/data.ts from anything Layout touches drags ~1.2 MB of JSON
 * into _worker.js and eats the Workers size limit. That happened once; this
 * makes it loud rather than silent.
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const WORKER = "dist/_worker.js";
const NEEDLE = "careerQualifiers";
const MAX_MB = 1.5;

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

if (!existsSync(WORKER)) {
  // The site is fully static now; there is no SSR bundle to police. Kept so
  // the check fails loudly again if a server route is ever reintroduced.
  console.log("No _worker.js: site is fully static. Nothing to check.");
  process.exit(0);
}

let bytes = 0;
const offenders = [];
for (const f of walk(WORKER)) {
  bytes += statSync(f).size;
  if (/\.(m?js)$/.test(f) && readFileSync(f, "utf8").includes(NEEDLE)) offenders.push(f);
}

const mb = bytes / 1024 / 1024;
console.log(`_worker.js: ${mb.toFixed(2)} MB`);

if (offenders.length) {
  console.error(`\nFAIL: Clutch data is inside the SSR worker:\n  ${offenders.join("\n  ")}`);
  console.error(`\nOnly prerendered clutch pages and their components may import src/lib/clutch/data.ts.`);
  process.exit(1);
}
if (mb > MAX_MB) {
  console.error(`\nFAIL: worker is ${mb.toFixed(2)} MB, over the ${MAX_MB} MB budget.`);
  process.exit(1);
}
console.log("OK: no clutch data in the worker, size within budget.");
