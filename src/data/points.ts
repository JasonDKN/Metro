// ============================================================================
// Points math — kept tiny and pure so it's trivial to unit-test or tweak.
// ============================================================================

import type { Difficulty, PointsConfig } from "../types.js";

export function pointsForDifficulty(config: PointsConfig, difficulty: Difficulty): number {
  return config[difficulty] ?? 0;
}
