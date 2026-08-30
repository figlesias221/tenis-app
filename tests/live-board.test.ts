import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizeMatch, type RawMatch } from "../src/lib/live/client.ts";
import { iocToIso2 } from "../src/lib/live/countries.ts";
import {
  CALLS_PER_REFRESH,
  MAX_RESOLUTIONS_PER_REFRESH,
  TTL_IDLE_MS,
  TTL_LIVE_MS,
  applyResolutions,
  canAfford,
  isOnDay,
  isStale,
  mergeSnapshot,
  resolutionBudget,
  ttlFor,
  utcDay,
} from "../src/lib/live/snapshot.ts";
import type { LiveMatch, Snapshot } from "../src/lib/live/types.ts";

const load = (name: string): RawMatch[] =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"),
  ).data;

// Recorded from the live API on 2026-08-28, so these assertions describe the
// wire format as it actually arrived, not as the spec describes it.
const RAW_LIVE = load("live-matches-live.json");
const RAW_UPCOMING = load("live-matches-upcoming.json");
const DAY = "2026-08-28";
const NOW = new Date("2026-08-28T18:30:32Z");

const live = () => RAW_LIVE.map((m) => normalizeMatch(m, "live"));
const upcoming = () => RAW_UPCOMING.map((m) => normalizeMatch(m, "upcoming"));

test("the country code is IOC, not the ISO-3 the archive uses", () => {
  // The two vocabularies disagree on precisely the countries tennis is full
  // of. Reusing the archive's ISO-3 map would drop these three flags.
  assert.equal(iocToIso2("ger"), "DE");
  assert.equal(iocToIso2("ned"), "NL");
  assert.equal(iocToIso2("sui"), "CH");
});

test("an absent country becomes the neutral flag, never a broken image", () => {
  assert.equal(iocToIso2(null), "UN");
  assert.equal(iocToIso2("zzz"), "UN");
});

test("a live match keeps its games set by set and who is serving", () => {
  const match = live().find((m) => m.id === 179642);
  assert.ok(match);
  assert.deepEqual(match.score?.sets, [1, 1]);
  assert.deepEqual(match.score?.games, [
    [4, 7, 4],
    [6, 5, 3],
  ]);
  assert.deepEqual(match.score?.points, ["40", "40"]);
  assert.equal(match.score?.server, 2);
  assert.equal(match.score?.isTiebreak, false);
  assert.equal(match.players[0].ranking, 180);
});

test("an upcoming match has no score at all, rather than an empty one", () => {
  const match = upcoming()[0];
  assert.equal(match.score, null);
  assert.equal(match.phase, "upcoming");
});

test("a player with no stated country still renders", () => {
  // One competitor in the recording has country: null.
  const anonymous = live()
    .flatMap((m) => m.players)
    .find((p) => p.countryIoc === null);
  assert.ok(anonymous);
  assert.equal(anonymous.countryIso2, "UN");
});

test("unrecognised enum values become null instead of leaking through", () => {
  const raw = {
    ...RAW_LIVE[0],
    surface: "carpet",
    tour: "seniors",
  } as RawMatch;
  const match = normalizeMatch(raw, "live");
  assert.equal(match.surface, null);
  assert.equal(match.tour, null);
});

test("upcoming spans several days, so the board keeps only today's", () => {
  // The recording holds 49 upcoming matches: 2 today and 47 two days out. A
  // board that skipped this filter would claim the US Open first round was
  // being played today.
  const all = upcoming();
  assert.equal(all.length, 49);
  assert.equal(all.filter((m) => isOnDay(m, DAY)).length, 2);
  assert.equal(all.filter((m) => isOnDay(m, "2026-08-30")).length, 47);
});

test("the merged board carries only today's upcoming matches", () => {
  const board = mergeSnapshot(null, live(), upcoming(), NOW, 67);
  assert.equal(board.day, DAY);
  assert.equal(board.live.length, 3);
  assert.equal(board.upcoming.length, 2);
  assert.equal(board.finished.length, 0);
  assert.equal(board.pending.length, 0);
  assert.equal(board.callsRemaining, 67);
});

test("a match that drops off the live list is queued for resolution, marked observed", () => {
  // Paging completed matches is a paid capability, so a match that vanishes
  // from the live list is queued to be read back one call at a time. Until
  // then the last score seen stands in for the result.
  const first = mergeSnapshot(null, live(), upcoming(), NOW, 67);
  const later = new Date("2026-08-28T19:30:00Z");
  const stillLive = live().filter((m) => m.id !== 179642);

  const second = mergeSnapshot(first, stillLive, upcoming(), later, 65);

  assert.equal(second.live.length, 2);
  assert.equal(second.pending.length, 1);
  assert.equal(second.finished.length, 0);
  const done = second.pending[0];
  assert.equal(done.id, 179642);
  assert.equal(done.observed, true);
  assert.deepEqual(done.score?.sets, [1, 1]);
});

test("an upcoming match that never appears live is still queued as played", () => {
  // It started and finished between two refreshes. Dropping it would lose a
  // result outright.
  const first = mergeSnapshot(null, [], upcoming(), NOW, 67);
  assert.equal(first.upcoming.length, 2);
  const vanished = first.upcoming[0].id;

  const second = mergeSnapshot(first, [], [], NOW, 65);

  assert.equal(second.pending.map((m) => m.id).includes(vanished), true);
});

test("resolving a pending match replaces the observed score with the real one", () => {
  const first = mergeSnapshot(null, live(), upcoming(), NOW, 67);
  const second = mergeSnapshot(first, [], upcoming(), NOW, 65);
  assert.equal(second.pending.length, 3);

  const target = second.pending[0];
  const resolved: LiveMatch = {
    ...target,
    phase: "finished",
    winner: 2,
    observed: true,
    score: target.score && { ...target.score, sets: [1, 2] },
  };

  const third = applyResolutions(second, [resolved]);

  assert.equal(third.pending.length, 2);
  assert.equal(third.finished.length, 1);
  assert.equal(third.finished[0].winner, 2);
  // Resolved from the feed, so no longer merely observed.
  assert.equal(third.finished[0].observed, false);
});

test("a match the feed still calls live goes back to pending, not to results", () => {
  // A rain delay is not a result.
  const first = mergeSnapshot(null, live(), upcoming(), NOW, 67);
  const second = mergeSnapshot(first, [], upcoming(), NOW, 65);
  const target = second.pending[0];

  const third = applyResolutions(second, [{ ...target, phase: "live" }]);

  assert.equal(third.finished.length, 0);
  assert.equal(third.pending.filter((m) => m.id === target.id).length, 0);
});

test("a resolved result survives later refreshes untouched", () => {
  const first = mergeSnapshot(null, live(), upcoming(), NOW, 67);
  const second = mergeSnapshot(first, [], upcoming(), NOW, 65);
  const settled = applyResolutions(second, [
    { ...second.pending[0], phase: "finished", winner: 1 },
  ]);

  const later = mergeSnapshot(settled, [], upcoming(), NOW, 63);

  assert.equal(later.finished.length, 1);
  assert.equal(later.finished[0].winner, 1);
});

test("the resolution budget never digs into the reserve", () => {
  const reserve = 20;
  // Plenty left: capped by how many are waiting.
  assert.equal(resolutionBudget(90, 3, reserve), 3);
  // Capped by the per-refresh limit rather than by budget.
  assert.equal(resolutionBudget(90, 50, reserve), MAX_RESOLUTIONS_PER_REFRESH);
  // Four calls above the reserve: four results, not five.
  assert.equal(resolutionBudget(reserve + 4, 50, reserve), 4);
  assert.equal(resolutionBudget(reserve, 50, reserve), 0);
  assert.equal(resolutionBudget(reserve - 5, 50, reserve), 0);
});

test("a match still in play has its score updated, not duplicated", () => {
  const first = mergeSnapshot(null, live(), upcoming(), NOW, 67);
  const moved = live().map((m) =>
    m.id === 179642 && m.score
      ? { ...m, score: { ...m.score, sets: [2, 1] as [number, number] } }
      : m,
  );

  const second = mergeSnapshot(first, moved, upcoming(), NOW, 65);

  assert.equal(second.live.length, 3);
  assert.equal(second.pending.length, 0);
  assert.deepEqual(
    second.live.find((m) => m.id === 179642)?.score?.sets,
    [2, 1],
  );
});

test("a settled result is not resurrected by a lagging upcoming list", () => {
  const first = mergeSnapshot(null, live(), upcoming(), NOW, 67);
  const second = mergeSnapshot(first, [], upcoming(), NOW, 65);
  const settled = applyResolutions(second, [
    { ...second.pending[0], phase: "finished", winner: 1 },
  ]);
  const done = settled.finished[0];

  // The feed still lists it as upcoming today. It must not reappear there.
  const lagging = [...upcoming(), { ...done, phase: "upcoming" as const }];
  const third = mergeSnapshot(settled, [], lagging, NOW, 63);

  assert.equal(third.upcoming.filter((m) => m.id === done.id).length, 0);
  assert.equal(third.finished.filter((m) => m.id === done.id).length, 1);
});

test("yesterday's results do not carry into a new day", () => {
  const yesterday = mergeSnapshot(null, live(), upcoming(), NOW, 67);
  const played = mergeSnapshot(yesterday, [], upcoming(), NOW, 65);
  const settled = applyResolutions(played, [
    { ...played.pending[0], phase: "finished", winner: 1 },
  ]);
  assert.equal(settled.finished.length, 1);
  assert.equal(settled.pending.length, 2);

  const tomorrow = new Date("2026-08-29T09:00:00Z");
  const fresh = mergeSnapshot(settled, [], upcoming(), tomorrow, 63);

  assert.equal(fresh.day, "2026-08-29");
  assert.equal(fresh.finished.length, 0);
  assert.equal(fresh.pending.length, 0);
});

test("a match with no stated time is not claimed to be today", () => {
  // The board's promise is "today". A match the feed has not scheduled cannot
  // be placed on a day, so it is left off rather than assumed into one.
  const undated: LiveMatch = { ...upcoming()[0], id: 999, scheduledTime: null };
  const board = mergeSnapshot(null, [], [...upcoming(), undated], NOW, 67);
  assert.equal(board.upcoming.filter((m) => m.id === 999).length, 0);
});

test("matches are ordered by start time, and an unscheduled one sorts last", () => {
  // Live matches carry no day filter - one can run past midnight UTC - so
  // this is where an undated row actually reaches the sort.
  const undated: LiveMatch = { ...live()[0], id: 999, scheduledTime: null };
  const board = mergeSnapshot(null, [...live(), undated], [], NOW, 67);
  assert.equal(board.live.at(-1)?.id, 999);
  const times = board.live
    .map((m) => m.scheduledTime)
    .filter((t): t is string => t !== null);
  assert.deepEqual(times, [...times].sort());
});

test("the refresh interval tightens when something is being played", () => {
  const playing = mergeSnapshot(null, live(), upcoming(), NOW, 67);
  const quiet = mergeSnapshot(null, [], upcoming(), NOW, 67);
  assert.equal(ttlFor(playing), TTL_LIVE_MS);
  assert.equal(ttlFor(quiet), TTL_IDLE_MS);
});

test("a board is stale once its own interval has elapsed", () => {
  const board = mergeSnapshot(null, live(), upcoming(), NOW, 67);
  assert.equal(
    isStale(board, new Date(NOW.getTime() + TTL_LIVE_MS - 1000)),
    false,
  );
  assert.equal(isStale(board, new Date(NOW.getTime() + TTL_LIVE_MS)), true);
});

test("a corrupt timestamp counts as stale rather than fresh forever", () => {
  const board: Snapshot = {
    ...mergeSnapshot(null, live(), upcoming(), NOW, 67),
    fetchedAt: "not a date",
  };
  assert.equal(isStale(board, NOW), true);
});

test("the budget floor stops a refresh before the reserve is touched", () => {
  const reserve = 20;
  assert.equal(canAfford(reserve + CALLS_PER_REFRESH, reserve), true);
  assert.equal(canAfford(reserve + CALLS_PER_REFRESH - 1, reserve), false);
  assert.equal(canAfford(0, reserve), false);
});

test("a tier with no daily cap is never blocked by the floor", () => {
  assert.equal(canAfford(null), true);
});

test("the UTC day is taken from the instant, not the local zone", () => {
  assert.equal(utcDay(new Date("2026-08-28T23:59:59Z")), "2026-08-28");
  assert.equal(utcDay(new Date("2026-08-29T00:00:01Z")), "2026-08-29");
});
