import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import {
  BUDGET_RESERVE,
  CALLS_PER_REFRESH,
  TTL_LIVE_MS,
  type KVLike,
  getBoard,
} from "../src/lib/live/snapshot.ts";

/**
 * These exercise the path that actually spends money: which requests reach the
 * network at all. The client is driven through a stubbed global fetch so the
 * assertions are about call counts, not about parsing.
 */

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"),
  );

const LIVE = fixture("live-matches-live.json");
const UPCOMING = fixture("live-matches-upcoming.json");
const NOW = new Date("2026-08-28T18:30:32Z");

class FakeKV implements KVLike {
  store = new Map<string, string>();
  writes = 0;

  get(key: string, type: "json"): Promise<unknown | null>;
  get(key: string): Promise<string | null>;
  async get(key: string, type?: "json"): Promise<unknown> {
    const raw = this.store.get(key);
    if (raw === undefined) return null;
    return type === "json" ? JSON.parse(raw) : raw;
  }

  async put(key: string, value: string): Promise<void> {
    this.writes += 1;
    this.store.set(key, value);
  }
}

let calls: string[] = [];
let remainingDay = 90;

beforeEach(() => {
  calls = [];
  remainingDay = 90;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const body = url.includes("/usage")
      ? {
          tier: "free",
          limits: { per_day: 100, per_minute: 30 },
          today: { calls: 100 - remainingDay, remaining_day: remainingDay },
        }
      : url.includes("status=live")
        ? LIVE
        : url.includes("status=upcoming")
          ? UPCOMING
          : // A by-id read: the match, now over, with a winner.
            { ...LIVE.data[0], id: Number(url.split("/").pop()), status: "completed", winner: 1 };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

/** Calls that actually consume quota - /usage is exempt. */
const billed = () => calls.filter((c) => !c.includes("/usage"));
const byId = () => calls.filter((c) => /\/matches\/\d+$/.test(c));
const noWaitUntil = () => {
  throw new Error("waitUntil must not be reached on this path");
};

test("the first request of the day fetches and stores a board", async () => {
  const kv = new FakeKV();
  const board = await getBoard(kv, "k", noWaitUntil, NOW);

  assert.equal(board.live.length, 3);
  assert.equal(billed().length, CALLS_PER_REFRESH);
  assert.ok(kv.store.has("atp:today:v2"));
  // The remaining count is reported net of the calls just made.
  assert.equal(board.callsRemaining, 90 - CALLS_PER_REFRESH);
});

test("a fresh board costs nothing at all - not even a usage check", async () => {
  const kv = new FakeKV();
  await getBoard(kv, "k", noWaitUntil, NOW);
  calls = [];

  const again = await getBoard(
    kv,
    "k",
    noWaitUntil,
    new Date(NOW.getTime() + 60_000),
  );

  assert.equal(calls.length, 0);
  assert.equal(again.live.length, 3);
});

test("a stale board is served immediately and refreshed in the background", async () => {
  const kv = new FakeKV();
  await getBoard(kv, "k", noWaitUntil, NOW);
  kv.store.delete("atp:today:v2:lock");
  calls = [];

  const deferred: Promise<unknown>[] = [];
  const later = new Date(NOW.getTime() + TTL_LIVE_MS + 1000);
  const board = await getBoard(kv, "k", (p) => deferred.push(p), later);

  // The visitor waited for nothing.
  assert.equal(billed().length, 0);
  assert.equal(board.fetchedAt, NOW.toISOString());
  assert.equal(deferred.length, 1);

  await deferred[0];
  assert.equal(billed().length, CALLS_PER_REFRESH);
});

test("at the budget floor the board is held rather than refreshed", async () => {
  const kv = new FakeKV();
  await getBoard(kv, "k", noWaitUntil, NOW);
  kv.store.delete("atp:today:v2:lock");
  calls = [];
  remainingDay = BUDGET_RESERVE + CALLS_PER_REFRESH - 1;

  const deferred: Promise<unknown>[] = [];
  const later = new Date(NOW.getTime() + TTL_LIVE_MS + 1000);
  await getBoard(kv, "k", (p) => deferred.push(p), later);
  await Promise.all(deferred);

  // It asked what was left, and then declined to spend it.
  assert.equal(calls.filter((c) => c.includes("/usage")).length, 1);
  assert.equal(billed().length, 0);

  const held = (await kv.get("atp:today:v2", "json")) as {
    degraded: string | null;
  };
  // The stored board is untouched; the degraded marker is on what was served.
  assert.equal(held.degraded, null);
});

test("a held lock stops a second refresh from starting", async () => {
  const kv = new FakeKV();
  await getBoard(kv, "k", noWaitUntil, NOW);
  calls = [];

  // The lock written by the first refresh is still in place.
  const later = new Date(NOW.getTime() + TTL_LIVE_MS + 1000);
  const board = await getBoard(kv, "k", noWaitUntil, later);

  assert.equal(calls.length, 0);
  assert.equal(board.degraded, "locked");
});

test("a failed first fetch renders an empty board rather than a 500", async () => {
  const kv = new FakeKV();
  globalThis.fetch = (async () =>
    new Response("nope", { status: 500 })) as typeof fetch;

  const board = await getBoard(kv, "k", noWaitUntil, NOW);

  assert.equal(board.degraded, "error");
  assert.deepEqual(board.live, []);
  assert.equal(kv.store.has("atp:today:v2"), false);
});

test("a refresh resolves the matches that ended, one call each", async () => {
  const kv = new FakeKV();
  await getBoard(kv, "k", noWaitUntil, NOW);
  kv.store.delete("atp:today:v2:lock");

  // Everything has finished: nothing live, nothing left today.
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const body = url.includes("/usage")
      ? {
          tier: "free",
          limits: { per_day: 100, per_minute: 30 },
          today: { calls: 100 - remainingDay, remaining_day: remainingDay },
        }
      : url.includes("status=live") || url.includes("status=upcoming")
        ? { data: [] }
        : {
            ...LIVE.data[0],
            id: Number(url.split("/").pop()),
            status: "completed",
            winner: 1,
          };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  calls = [];

  const deferred: Promise<unknown>[] = [];
  const later = new Date(NOW.getTime() + TTL_LIVE_MS + 1000);
  await getBoard(kv, "k", (p) => deferred.push(p), later);
  await Promise.all(deferred);

  // Three live plus two upcoming were on the board; all five ended.
  assert.equal(byId().length, 5);
  const stored = (await kv.get("atp:today:v2", "json")) as {
    finished: { winner: number | null; observed: boolean }[];
    pending: unknown[];
  };
  assert.equal(stored.finished.length, 5);
  assert.equal(stored.pending.length, 0);
  assert.ok(stored.finished.every((m) => m.winner === 1 && m.observed === false));
});

test("resolution stops at the reserve, leaving the rest pending", async () => {
  const kv = new FakeKV();
  await getBoard(kv, "k", noWaitUntil, NOW);
  kv.store.delete("atp:today:v2:lock");

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const body = url.includes("/usage")
      ? {
          tier: "free",
          limits: { per_day: 100, per_minute: 30 },
          today: { calls: 100 - remainingDay, remaining_day: remainingDay },
        }
      : url.includes("status=live") || url.includes("status=upcoming")
        ? { data: [] }
        : {
            ...LIVE.data[0],
            id: Number(url.split("/").pop()),
            status: "completed",
            winner: 1,
          };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  calls = [];
  // Two calls go on the refresh itself, leaving room for exactly two results.
  remainingDay = BUDGET_RESERVE + CALLS_PER_REFRESH + 2;

  const deferred: Promise<unknown>[] = [];
  const later = new Date(NOW.getTime() + TTL_LIVE_MS + 1000);
  await getBoard(kv, "k", (p) => deferred.push(p), later);
  await Promise.all(deferred);

  assert.equal(byId().length, 2);
  const stored = (await kv.get("atp:today:v2", "json")) as {
    finished: unknown[];
    pending: unknown[];
  };
  assert.equal(stored.finished.length, 2);
  assert.equal(stored.pending.length, 3);
});
