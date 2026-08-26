/**
 * Fails if an emoji reaches the source.
 *
 * The first pass at this missed U+1F194 because it only covered
 * U+1F300-1FAFF; the SQUARED ID glyph sits in the enclosed-alphanumerics
 * block below that and shipped 304 times across the tournament pages. This
 * covers every emoji block rather than the obvious one.
 *
 * Typographic marks are deliberately allowed: en/em dashes, angle quotes and
 * the small triangles used as UI affordances are not emoji.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";

const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F100}-\u{1F1FF}\u{FE0F}\u{FE0E}\u{24C2}\u{203C}\u{2049}\u{2139}]/gu;

const EXTS = new Set([".astro", ".ts", ".tsx", ".js", ".mjs", ".css", ".json", ".md"]);

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (EXTS.has(extname(p))) out.push(p);
  }
  return out;
}

const found = [];
for (const f of walk("src")) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    for (const m of line.matchAll(EMOJI)) {
      found.push(`${f}:${i + 1}  ${m[0]}  U+${m[0].codePointAt(0).toString(16).toUpperCase()}`);
    }
  });
}

if (found.length) {
  console.error(`FAIL: ${found.length} emoji in source:\n  ${found.join("\n  ")}`);
  process.exit(1);
}
console.log("OK: no emoji in source.");
