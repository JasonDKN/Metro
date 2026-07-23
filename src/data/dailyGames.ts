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

import type { DailyGameConfig, DailyGameEntry, DailyGamesState } from "../types.js";

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
