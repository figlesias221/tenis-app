/**
 * The board's governor: what is worth spending a call on, and when.
 *
 * The whole design turns on one fact about the FREE tier - 100 calls a day,
 * shared by everyone who visits. So the snapshot is cached in KV and every
 * visitor reads the same copy: a thousand readers cost exactly what one costs.
 * A refresh happens lazily, on a request that finds the cache stale, which
 * means a day with no visitors spends nothing at all.
 *
 * The second fact is that /usage is quota-exempt. We can always afford to ask
 * how much budget is left before deciding to use any of it, so the floor below
 * is enforced against the API's own count rather than a tally of our own that
 * would drift across deploys, previews and local development sharing one key.
 *
 * The third is that results have to be assembled by hand. Paging completed
 * matches is a paid capability and returns 403 here, but reading ONE match by
 * id is free and works after it ends. So the board keeps a roster of every
 * match it has seen today, notices which have dropped off both lists, and
 * resolves them a few at a time.
 */
import { fetchMatch, fetchMatches, fetchUsage } from "./client";
import type { DegradedReason, LiveMatch, Snapshot } from "./types";

/** Refresh interval while at least one match is in progress. */
export const TTL_LIVE_MS = 15 * 60 * 1000;
/** Refresh interval when nothing is being played. */
export const TTL_IDLE_MS = 60 * 60 * 1000;
/** Never spend the last of the day's quota: leave this many calls unused. */
export const BUDGET_RESERVE = 20;
/** Calls one refresh costs before any results are resolved. */
export const CALLS_PER_REFRESH = 2;
/**
 * Results resolved per refresh, at one call each. Capped so a slam day, where
 * sixty matches can finish, drains the budget gradually across the day's
 * refreshes instead of in the first one after the last ball.
 */
export const MAX_RESOLUTIONS_PER_REFRESH = 6;
/** How long one refresh may hold the lock before another may retry. */
export const LOCK_TTL_SECONDS = 60;

const SNAPSHOT_KEY = "atp:today:v2";
const LOCK_KEY = "atp:today:v2:lock";
/** KV keeps the snapshot well past its TTL: stale data beats a blank board. */
const SNAPSHOT_RETENTION_SECONDS = 3 * 24 * 60 * 60;

/** The slice of the KV binding this module uses. */
export interface KVLike {
  get(key: string, type: "json"): Promise<unknown | null>;
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

/** The UTC calendar day, YYYY-MM-DD. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Whether a match is scheduled on the given UTC day.
 *
 * This matters more than it looks: `status=upcoming` returns everything the
 * feed has scheduled, which spans several days - 49 rows covering three dates
 * when this was written, only 2 of them today. Without the filter the board
 * would bill itself as today and show the day after tomorrow.
 */
export function isOnDay(match: LiveMatch, day: string): boolean {
  return match.scheduledTime != null && match.scheduledTime.slice(0, 10) === day;
}

function byScheduledTime(a: LiveMatch, b: LiveMatch): number {
  // A match with no stated time sorts last rather than first, where a zero
  // would put it.
  const at = a.scheduledTime ?? "9999";
  const bt = b.scheduledTime ?? "9999";
  return at < bt ? -1 : at > bt ? 1 : a.id - b.id;
}

/**
 * Folds a fresh pair of responses into the previous board.
 *
 * A match that was on the board and is now in neither list has been played, so
 * it moves to `pending` carrying the last score seen. Resolution turns those
 * into real results; until then they are shown as observed.
 */
export function mergeSnapshot(
  previous: Snapshot | null,
  freshLive: LiveMatch[],
  freshUpcoming: LiveMatch[],
  now: Date,
  callsRemaining: number | null,
): Snapshot {
  const day = utcDay(now);
  const nowIso = now.toISOString();
  const carried = previous?.day === day ? previous : null;

  const live = freshLive
    .map((m) => ({ ...m, phase: "live" as const, lastSeenAt: nowIso }))
    .sort(byScheduledTime);
  const liveIds = new Set(live.map((m) => m.id));

  const todaysUpcoming = freshUpcoming.filter((m) => isOnDay(m, day));
  const upcomingIds = new Set(todaysUpcoming.map((m) => m.id));

  // Results already resolved are settled and never revisited.
  const finished = new Map<number, LiveMatch>(
    (carried?.finished ?? []).map((m) => [m.id, m]),
  );

  const pending = new Map<number, LiveMatch>();
  const stillListed = (m: LiveMatch) => liveIds.has(m.id) || upcomingIds.has(m.id);

  for (const match of carried?.pending ?? []) {
    if (!finished.has(match.id) && !stillListed(match)) {
      pending.set(match.id, match);
    }
  }
  // Anything that was on the previous board and has now dropped off both lists
  // was played while we were not looking.
  for (const match of [...(carried?.live ?? []), ...(carried?.upcoming ?? [])]) {
    if (!finished.has(match.id) && !stillListed(match)) {
      pending.set(match.id, { ...match, phase: "finished", observed: true });
    }
  }

  const upcoming = todaysUpcoming
    .filter((m) => !liveIds.has(m.id) && !finished.has(m.id) && !pending.has(m.id))
    .map((m) => ({ ...m, phase: "upcoming" as const }))
    .sort(byScheduledTime);

  return {
    version: 2,
    day,
    fetchedAt: nowIso,
    live,
    upcoming,
    finished: [...finished.values()].sort(byScheduledTime),
    pending: [...pending.values()].sort(byScheduledTime),
    callsRemaining,
    degraded: null,
  };
}

/** How long this snapshot stays fresh: often enough to be live, rarely enough to last. */
export function ttlFor(snapshot: Snapshot): number {
  return snapshot.live.length > 0 ? TTL_LIVE_MS : TTL_IDLE_MS;
}

export function isStale(snapshot: Snapshot, now: Date): boolean {
  const age = now.getTime() - Date.parse(snapshot.fetchedAt);
  return !Number.isFinite(age) || age >= ttlFor(snapshot);
}

/** Whether one refresh fits inside the budget without touching the reserve. */
export function canAfford(
  remainingDay: number | null,
  reserve = BUDGET_RESERVE,
): boolean {
  // A tier with no daily cap reports null; that is permission, not ignorance.
  if (remainingDay === null) return true;
  return remainingDay - CALLS_PER_REFRESH >= reserve;
}

/**
 * How many results this refresh may resolve, at one call each, after the two
 * the refresh itself has already spent.
 */
export function resolutionBudget(
  remainingAfterRefresh: number | null,
  waiting: number,
  reserve = BUDGET_RESERVE,
): number {
  const cap = Math.min(waiting, MAX_RESOLUTIONS_PER_REFRESH);
  if (remainingAfterRefresh === null) return cap;
  return Math.max(0, Math.min(cap, remainingAfterRefresh - reserve));
}

/**
 * Turns pending matches into real results, oldest first.
 *
 * A match the feed still calls live or upcoming is put back rather than
 * recorded: the lists can lag a beat behind each other, and a rain delay is
 * not a result.
 */
export function applyResolutions(
  snapshot: Snapshot,
  resolved: LiveMatch[],
): Snapshot {
  if (resolved.length === 0) return snapshot;
  const settled = new Map<number, LiveMatch>();
  const returned = new Set<number>();

  for (const match of resolved) {
    if (match.phase === "finished") {
      settled.set(match.id, { ...match, observed: false });
    } else {
      returned.add(match.id);
    }
  }

  return {
    ...snapshot,
    finished: [...snapshot.finished, ...settled.values()].sort(byScheduledTime),
    pending: snapshot.pending.filter(
      (m) => !settled.has(m.id) && !returned.has(m.id),
    ),
  };
}

function degrade(snapshot: Snapshot, reason: DegradedReason): Snapshot {
  return { ...snapshot, degraded: reason };
}

/**
 * An empty board, used only before the first successful fetch of a day. It
 * carries `degraded` so the page never presents "no matches" as a finding
 * when the truth is that we have not managed to look.
 */
function emptySnapshot(now: Date, reason: DegradedReason | null): Snapshot {
  return {
    version: 2,
    day: utcDay(now),
    fetchedAt: now.toISOString(),
    live: [],
    upcoming: [],
    finished: [],
    pending: [],
    callsRemaining: null,
    degraded: reason,
  };
}

async function refresh(
  kv: KVLike,
  apiKey: string,
  previous: Snapshot | null,
  now: Date,
): Promise<Snapshot> {
  const usage = await fetchUsage(apiKey);
  if (!canAfford(usage.remainingDay)) {
    return degrade(previous ?? emptySnapshot(now, "budget"), "budget");
  }

  const [live, upcoming] = await Promise.all([
    fetchMatches(apiKey, "live"),
    fetchMatches(apiKey, "upcoming"),
  ]);

  let remaining =
    usage.remainingDay === null ? null : usage.remainingDay - CALLS_PER_REFRESH;
  let next = mergeSnapshot(previous, live, upcoming, now, remaining);

  const toResolve = next.pending.slice(
    0,
    resolutionBudget(remaining, next.pending.length),
  );
  if (toResolve.length > 0) {
    const resolved = await Promise.all(
      toResolve.map((m) =>
        // One failure must not cost the whole refresh: the match simply stays
        // pending and is retried next time.
        fetchMatch(apiKey, m.id).catch(() => null),
      ),
    );
    const usable = resolved.filter((m): m is LiveMatch => m !== null);
    remaining = remaining === null ? null : remaining - toResolve.length;
    next = { ...applyResolutions(next, usable), callsRemaining: remaining };
  }

  await kv.put(SNAPSHOT_KEY, JSON.stringify(next), {
    expirationTtl: SNAPSHOT_RETENTION_SECONDS,
  });
  return next;
}

/**
 * Reads the board, refreshing it in the background when it has gone stale.
 *
 * The caller passes `waitUntil` so the visitor who happens to arrive on a
 * stale cache is served immediately from it rather than paying for the
 * refresh with their own page load. Only the very first request of a day,
 * which has nothing to serve, waits for the network.
 */
export async function getBoard(
  kv: KVLike,
  apiKey: string,
  waitUntil: (promise: Promise<unknown>) => void,
  now = new Date(),
): Promise<Snapshot> {
  const cached = (await kv
    .get(SNAPSHOT_KEY, "json")
    .catch(() => null)) as Snapshot | null;

  if (cached && cached.version === 2 && !isStale(cached, now)) {
    return cached;
  }

  // One refresh at a time. Without this, a burst arriving on an expired cache
  // would each start their own, and a handful of simultaneous readers would
  // spend a tenth of the day's budget in a second.
  const locked = await kv.get(LOCK_KEY).catch(() => null);
  if (locked) {
    return cached ? degrade(cached, "locked") : emptySnapshot(now, "locked");
  }
  await kv
    .put(LOCK_KEY, now.toISOString(), { expirationTtl: LOCK_TTL_SECONDS })
    .catch(() => {});

  // Nothing to show yet: this request has to wait for the first fetch.
  if (!cached) {
    try {
      return await refresh(kv, apiKey, null, now);
    } catch {
      return emptySnapshot(now, "error");
    }
  }

  waitUntil(
    refresh(kv, apiKey, cached, now).catch(() => {
      // Swallowed on purpose: the visitor already has the previous board, and
      // a background failure must not turn into a 500 on a page that rendered.
    }),
  );
  return cached;
}
