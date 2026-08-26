import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseScore,
  toPeriodScores,
  wentToDecider,
} from "../src/lib/utils/score-parser.ts";

test("the parenthesised number is the tiebreak loser's points", () => {
  // 7-6(5) is a 7-5 breaker, NOT 5-0 (the bug this replaces) and not 5-3.
  const p = parseScore("7-6(5) 6-4");
  assert.ok(p);
  assert.equal(p.sets[0].setWinnerTiebreakPoints, 7);
  assert.equal(p.sets[0].setLoserTiebreakPoints, 5);
  assert.equal(p.tiebreaksWon, 1);
  assert.equal(p.tiebreaksLost, 0);
});

test("a tiebreak past 7 points extends past 7", () => {
  // 7-6(8) is 10-8, not 8-6.
  const p = parseScore("7-6(8)");
  assert.ok(p);
  assert.equal(p.sets[0].setWinnerTiebreakPoints, 10);
  assert.equal(p.sets[0].setLoserTiebreakPoints, 8);
});

test("tiebreaks are counted from the match winner's point of view", () => {
  // Match winner lost the first breaker, won the second.
  const p = parseScore("6-7(4) 7-6(3) 6-3");
  assert.ok(p);
  assert.equal(p.tiebreaksWon, 1);
  assert.equal(p.tiebreaksLost, 1);
  assert.equal(p.sets.length, 3);
  assert.equal(wentToDecider(p, 3), true);
});

test("a match tiebreak replaces a final set and counts as one of each", () => {
  const p = parseScore("3-6 6-4 [10-5]");
  assert.ok(p);
  assert.equal(p.sets.length, 3);
  assert.equal(p.sets[2].matchTiebreak, true);
  assert.equal(p.tiebreaksWon, 1);
  assert.equal(wentToDecider(p, 3), true);
});

test("a match tiebreak the winner trailed in is still oriented correctly", () => {
  const p = parseScore("6-3 3-6 [8-10]");
  assert.ok(p);
  assert.equal(p.sets[2].setWinnerTiebreakPoints, 10);
  assert.equal(p.sets[2].setLoserTiebreakPoints, 8);
});

test("retirements, walkovers and defaults are rejected outright", () => {
  assert.equal(parseScore("6-2 0-0 RET"), null);
  assert.equal(parseScore("W/O"), null);
  assert.equal(parseScore("6-1 DEF"), null);
  assert.equal(parseScore(""), null);
  assert.equal(parseScore(undefined), null);
});

test("literal junk in the historical rows is rejected", () => {
  assert.equal(parseScore("unfinished"), null);
  assert.equal(parseScore("Played and abandoned"), null);
});

test("a long final set with no tiebreak is not counted as one", () => {
  // Wimbledon-style: 13-12(7) had a breaker; 24-22 did not.
  const withBreaker = parseScore("13-12(7) 6-4");
  assert.ok(withBreaker);
  assert.equal(withBreaker.tiebreaksWon, 1);

  const without = parseScore("6-4 24-22");
  assert.ok(without);
  assert.equal(without.tiebreaksWon, 0);
  assert.equal(without.tiebreaksLost, 0);
});

test("straight sets did not go to a decider", () => {
  const p = parseScore("6-4 6-4");
  assert.ok(p);
  assert.equal(wentToDecider(p, 3), false);
  assert.equal(wentToDecider(p, 5), false);
});

test("period scores orient tiebreak points to winner and loser", () => {
  // Match winner LOST this set, so home gets the tiebreak loser's points.
  const periods = toPeriodScores("6-7(4) 7-6(3) 6-3");
  assert.equal(periods[0].home_score, 6);
  assert.equal(periods[0].away_score, 7);
  assert.equal(periods[0].home_tiebreak_score, 4);
  assert.equal(periods[0].away_tiebreak_score, 7);
  // Second set: match winner won the breaker 7-3.
  assert.equal(periods[1].home_tiebreak_score, 7);
  assert.equal(periods[1].away_tiebreak_score, 3);
  // Third set had no tiebreak.
  assert.equal(periods[2].home_tiebreak_score, undefined);
});
