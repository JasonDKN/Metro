// ============================================================================
// Daily Puzzles — scoring math + default game configs.
//
// Every game's raw daily input scales into the same shared point range
// (DailyGamesState.minPoints..maxPoints, 10-50 by default) so a great puzzle
// day feels roughly as rewarding as clearing a Medium/Hard task, and a
// mediocre one still earns something — consistent with the rest of Metro's
// "no penalties, purely additive" points philosophy (a bad score still lands
// at the floor, never below it, except Wordle's explicit fail case).
//
// Adding a new game later just means picking whichever DailyGameScoring
// pattern fits (see types.ts) and appending a config — no new scoring code.
// ============================================================================

import type { DailyGameConfig, DailyGameEntry, DailyGameScoring, DailyGamesState } from "../types.js";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Computes the Battlepass points a given input earns for a game, per its
 * scoring method and the shared min/max point range. Pure and side-effect
 * free so it's easy to reuse from the UI (e.g. a live preview) and the store. */
export function computeDailyGamePoints(
  config: DailyGameConfig,
  input: Pick<DailyGameEntry, "rawValue" | "guesses" | "actualUnderPar" | "bestUnderPar">,
  range: Pick<DailyGamesState, "minPoints" | "maxPoints">
): number {
  const { minPoints, maxPoints } = range;
  const span = maxPoints - minPoints;
  const scoring = config.scoring;

  if (scoring.method === "linearRange") {
    if (input.rawValue === undefined || Number.isNaN(input.rawValue)) return 0;
    const { worst, best } = scoring;
    if (best === worst) return input.rawValue >= best ? maxPoints : minPoints;
    const ratio = clamp01((input.rawValue - worst) / (best - worst));
    return Math.round(minPoints + ratio * span);
  }

  if (scoring.method === "guessCount") {
    if (input.guesses === null) return scoring.failPoints;
    if (input.guesses === undefined || Number.isNaN(input.guesses)) return 0;
    const { bestGuesses, worstGuesses } = scoring;
    if (worstGuesses === bestGuesses) return input.guesses <= bestGuesses ? maxPoints : minPoints;
    const ratio = clamp01((worstGuesses - input.guesses) / (worstGuesses - bestGuesses));
    return Math.round(minPoints + ratio * span);
  }

  // underParDailyBest — actual/best are guesses-under-par (0 = matched par;
  // negative = worse than par, which clamps to the floor since the day's
  // best is always >= par).
  const actual = input.actualUnderPar;
  const best = input.bestUnderPar;
  if (actual === undefined || best === undefined || Number.isNaN(actual) || Number.isNaN(best)) return 0;
  if (best <= 0) return actual >= best ? maxPoints : minPoints;
  const ratio = clamp01(actual / best);
  return Math.round(minPoints + ratio * span);
}

export function defaultDailyGamesState(): DailyGamesState {
  const now = new Date().toISOString();
  return {
    minPoints: 10,
    maxPoints: 50,
    configs: [
      {
        id: "game-minute-cryptic",
        name: "Minute Cryptic",
        scoring: { method: "underParDailyBest" },
        builtIn: true,
        createdAt: now,
      },
      {
        id: "game-maptap",
        name: "Maptap.gg",
        scoring: { method: "linearRange", worst: 500, best: 1000, unit: "score" },
        builtIn: true,
        createdAt: now,
      },
      {
        id: "game-wordle",
        name: "Wordle",
        scoring: { method: "guessCount", bestGuesses: 1, worstGuesses: 6, failPoints: 0 },
        builtIn: true,
        createdAt: now,
      },
      {
        id: "game-countries-quiz",
        name: "Countries of the World Quiz",
        scoring: { method: "linearRange", worst: 900, best: 600, unit: "seconds" },
        builtIn: true,
        createdAt: now,
      },
      {
        id: "game-18-words",
        name: "18 Words",
        scoring: { method: "linearRange", worst: 0, best: 18, unit: "score" },
        builtIn: true,
        createdAt: now,
      },
    ],
    entries: [],
  };
}

export function findDailyGameEntry(state: DailyGamesState, gameId: string, date: string): DailyGameEntry | undefined {
  return state.entries.find((e) => e.gameId === gameId && e.date === date);
}

/** The best (highest points-earning) result ever recorded for a game, or
 * null if it's never been logged. Points already normalize every scoring
 * method (a raw score, a guess count, minutes-and-seconds, under-par) onto
 * the same shared range, so "best" is simply the highest pointsAwarded
 * across all of that game's entries — the same number already shown for
 * "today", just maxed over history instead of looked up for one date. */
export function bestDailyGameScore(state: DailyGamesState, gameId: string): number | null {
  const points = state.entries.filter((e) => e.gameId === gameId).map((e) => e.pointsAwarded);
  return points.length > 0 ? Math.max(...points) : null;
}

/** True if entry `a`'s raw input is a strictly better performance than
 * entry `b`'s, per the game's scoring method. Used only to break ties
 * between entries that happen to earn the same pointsAwarded — since
 * points clamp at the floor/ceiling of a game's range, two different raw
 * performances can tie on points while one is still objectively better
 * (e.g. two Maptap.gg scores that both hit the point ceiling). */
function isRawValueBetter(config: DailyGameConfig, a: DailyGameEntry, b: DailyGameEntry): boolean {
  const scoring = config.scoring;
  if (scoring.method === "linearRange") {
    if (a.rawValue === undefined) return false;
    if (b.rawValue === undefined) return true;
    return scoring.best >= scoring.worst ? a.rawValue > b.rawValue : a.rawValue < b.rawValue;
  }
  if (scoring.method === "guessCount") {
    const aVal = a.guesses === null || a.guesses === undefined ? Infinity : a.guesses;
    const bVal = b.guesses === null || b.guesses === undefined ? Infinity : b.guesses;
    return aVal < bVal;
  }
  // underParDailyBest — compare the same actual/best ratio the points are
  // derived from, so the tie-break agrees with how points were computed.
  const ratio = (e: DailyGameEntry) => {
    if (e.actualUnderPar === undefined || e.bestUnderPar === undefined) return -Infinity;
    if (e.bestUnderPar <= 0) return e.actualUnderPar >= e.bestUnderPar ? 1 : 0;
    return clamp01(e.actualUnderPar / e.bestUnderPar);
  };
  return ratio(a) > ratio(b);
}

/** The single best-performing entry ever recorded for a game (by points,
 * with raw-value tie-breaking — see isRawValueBetter), or null if it's
 * never been logged. Unlike bestDailyGameScore, this returns the whole
 * entry so the UI can display the actual value the user entered (guesses,
 * a raw score, a time, under-par) rather than just the points it earned. */
export function bestDailyGameEntry(state: DailyGamesState, config: DailyGameConfig): DailyGameEntry | null {
  let best: DailyGameEntry | null = null;
  for (const e of state.entries) {
    if (e.gameId !== config.id) continue;
    if (!best || e.pointsAwarded > best.pointsAwarded || (e.pointsAwarded === best.pointsAwarded && isRawValueBetter(config, e, best))) {
      best = e;
    }
  }
  return best;
}

function secondsToClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Renders an entry's raw input as a short human-readable string, in the
 * same terms the user entered it in — a guess count, a raw score, a
 * clock time, or an under-par pair — rather than the points it earned. */
export function formatDailyGameRawValue(config: DailyGameConfig, entry: DailyGameEntry): string {
  const scoring = config.scoring;
  if (scoring.method === "linearRange") {
    if (entry.rawValue === undefined) return "—";
    if (scoring.unit === "seconds") {
      return entry.rawValue >= scoring.worst ? `DNF (${secondsToClock(scoring.worst)}+)` : secondsToClock(entry.rawValue);
    }
    return String(entry.rawValue);
  }
  if (scoring.method === "guessCount") {
    if (entry.guesses === null) return "Fail";
    if (entry.guesses === undefined) return "—";
    return `${entry.guesses} guess${entry.guesses === 1 ? "" : "es"}`;
  }
  // underParDailyBest
  if (entry.actualUnderPar === undefined || entry.bestUnderPar === undefined) return "—";
  return `${entry.actualUnderPar}/${entry.bestUnderPar} under par`;
}

// ---------------------------------------------------------------------------
// User-defined puzzles
//
// Everything below exists so a puzzle can be added from the UI without a code
// change. The app asks for nothing more than a name, how the puzzle is scored,
// and the minimum/maximum scores it's possible to get — those three answers
// are enough to pick one of the DailyGameScoring patterns above and anchor it,
// which is what turns a raw daily score into Battlepass points.
// ---------------------------------------------------------------------------

/** How a user says their puzzle is scored, in plain terms. Each maps onto one
 * of the three DailyGameScoring patterns — this type exists purely so the UI
 * can ask a human question ("is a higher score better?") instead of exposing
 * `worst`/`best` anchors, whose ordering encodes direction and is easy to get
 * backwards. */
export type DailyGameScoringKind = "higherScore" | "lowerScore" | "fasterTime" | "fewerGuesses";

export interface DailyGameDraft {
  kind: DailyGameScoringKind;
  /** The literal lowest number achievable — NOT "the worst result". For a
   * lower-is-better puzzle this is the best you could ever do. */
  minValue: number;
  /** The literal highest number achievable. */
  maxValue: number;
  /** Only used by "fewerGuesses": points for an outright loss. */
  failPoints?: number;
}

export type BuildScoringResult =
  | { ok: true; scoring: DailyGameScoring }
  | { ok: false; error: string };

/** Turns the user's plain-language answers into a DailyGameScoring. Returns a
 * message rather than throwing on bad input, so the form can show it inline.
 *
 * The min/max the user gives are always the literal numeric bounds; which end
 * earns the most points is decided by `kind`, not by their order. That's the
 * whole reason this indirection exists — `linearRange` encodes direction in
 * whether `best` is above or below `worst`, which is exactly the kind of thing
 * a person shouldn't have to reason about while adding a puzzle. */
export function buildDailyGameScoring(draft: DailyGameDraft): BuildScoringResult {
  const { kind, minValue, maxValue } = draft;

  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return { ok: false, error: "Enter both a minimum and a maximum score." };
  }
  if (minValue === maxValue) {
    return { ok: false, error: "The minimum and maximum can't be the same — there'd be nothing to scale between." };
  }
  if (minValue > maxValue) {
    return { ok: false, error: "The minimum has to be smaller than the maximum." };
  }

  if (kind === "fewerGuesses") {
    if (!Number.isInteger(minValue) || !Number.isInteger(maxValue)) {
      return { ok: false, error: "Guess counts have to be whole numbers." };
    }
    if (minValue < 1) {
      return { ok: false, error: "The fewest guesses has to be at least 1." };
    }
    const failPoints = draft.failPoints ?? 0;
    if (!Number.isFinite(failPoints) || failPoints < 0) {
      return { ok: false, error: "Points for a failed day can't be negative." };
    }
    return {
      ok: true,
      scoring: { method: "guessCount", bestGuesses: minValue, worstGuesses: maxValue, failPoints: Math.round(failPoints) },
    };
  }

  if (kind === "fasterTime") {
    if (minValue < 0) return { ok: false, error: "A time can't be negative." };
    // worst = the slowest time (the high end), best = the fastest.
    return { ok: true, scoring: { method: "linearRange", worst: maxValue, best: minValue, unit: "seconds" } };
  }

  if (kind === "lowerScore") {
    return { ok: true, scoring: { method: "linearRange", worst: maxValue, best: minValue, unit: "score" } };
  }

  // higherScore
  return { ok: true, scoring: { method: "linearRange", worst: minValue, best: maxValue, unit: "score" } };
}

/** A one-line plain-English summary of how a puzzle converts scores into
 * points, for the manage list — so the rule a puzzle was set up with stays
 * visible instead of being buried in whatever the add form said at the time. */
export function describeDailyGameScoring(
  config: DailyGameConfig,
  range: Pick<DailyGamesState, "minPoints" | "maxPoints">
): string {
  const scoring = config.scoring;
  const pts = `${range.minPoints}–${range.maxPoints} pts`;

  if (scoring.method === "guessCount") {
    return `${scoring.bestGuesses}–${scoring.worstGuesses} guesses → ${pts} (fewer is better; a fail earns ${scoring.failPoints})`;
  }
  if (scoring.method === "underParDailyBest") {
    return `Guesses under par vs. the day's best → ${pts}`;
  }
  const unit = scoring.unit === "seconds" ? "s" : "";
  const lowerIsBetter = scoring.best < scoring.worst;
  const lo = Math.min(scoring.worst, scoring.best);
  const hi = Math.max(scoring.worst, scoring.best);
  return `${lo}${unit}–${hi}${unit} → ${pts} (${lowerIsBetter ? "lower" : "higher"} is better)`;
}
