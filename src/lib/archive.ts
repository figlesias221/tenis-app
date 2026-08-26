/**
 * Canonical facts about what this archive actually contains.
 *
 * Every date and range label on the site comes from here rather than being
 * typed into markup, so the labels follow the data instead of drifting from
 * it. The previous code derived its year window from `new Date()`, which meant
 * the player pages announced "2026 Season Stats" over 2024 data and would
 * silently drop the earliest season each January.
 */

/** Seasons for which match files are vendored in data/. */
export const MATCH_SEASONS = { first: 1991, last: 2024 } as const;

/**
 * The span the archive actually holds. Match files exist upstream back to
 * 1968, but they carry no serve statistics before 1991 and are not vendored
 * here, so the site must not claim them.
 */
export const ARCHIVE_RANGE = { first: 1991, last: 2024 } as const;

/** The last ranking week present in atp_rankings_current.csv. */
export const RANKINGS_AS_OF = "2024-12-30";

export const ARCHIVE_RANGE_LABEL = `${ARCHIVE_RANGE.first}–${ARCHIVE_RANGE.last}`;
export const MATCH_SEASONS_LABEL = `${MATCH_SEASONS.first}–${MATCH_SEASONS.last}`;

export const RANKINGS_AS_OF_LABEL = (() => {
  const d = new Date(`${RANKINGS_AS_OF}T00:00:00Z`);
  const formatted = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `week of ${formatted}`;
})();

/** The years for which match data exists, oldest first. */
export function matchYears(): number[] {
  const out: number[] = [];
  for (let y = MATCH_SEASONS.first; y <= MATCH_SEASONS.last; y++) out.push(y);
  return out;
}
