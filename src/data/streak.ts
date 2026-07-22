// ============================================================================
// Streak calculation — pure function over a checklist's history log.
// ============================================================================

import type { Checklist } from "../types.js";
import { previousDayISO, todayISO } from "../util/date.js";

/** Counts consecutive fully-completed (or streak-protected) days ending
 * yesterday. Today doesn't count yet since the day isn't over / hasn't
 * rolled into history. A missing history entry (app not opened that day, or
 * a genuinely missed day) breaks the streak. */
export function computeStreak(checklist: Checklist): number {
  let streak = 0;
  let cursor = previousDayISO(todayISO());
  // Guard against runaway loops on corrupted data.
  for (let i = 0; i < 3650; i++) {
    const entry = checklist.history[cursor];
    if (!entry) break;
    if (!entry.fullyCompleted && !entry.streakProtected) break;
    streak++;
    cursor = previousDayISO(cursor);
  }
  return streak;
}

/** Returns the most recent N history entries (newest first) for display. */
export function recentHistory(checklist: Checklist, count = 14) {
  return Object.values(checklist.history)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, count);
}
