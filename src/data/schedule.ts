// ============================================================================
// Weekday recurrence — lets a single 'daily' checklist behave like a
// different checklist each day (e.g. a "Thursday Daily Checklist") by
// filtering its tasks down to whichever ones are scheduled for today, rather
// than maintaining seven separate checklist objects. That keeps one shared
// streak, one shared history, and one shared points/battlepass trail instead
// of fragmenting them across seven checklists.
// ============================================================================

import type { Checklist, Task } from "../types.js";

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A task with no recurDays (or an empty array, which shouldn't normally
 * happen but is guarded against) is treated as recurring every day — this
 * keeps tasks created before this feature existed behaving unchanged. */
export function recurDaysOf(task: Task): number[] {
  return task.recurDays && task.recurDays.length > 0 ? task.recurDays : ALL_WEEKDAYS;
}

export function isTaskActiveOnWeekday(task: Task, dow: number): boolean {
  return recurDaysOf(task).includes(dow);
}

export function tasksActiveOnWeekday(tasks: Task[], dow: number): Task[] {
  return tasks.filter((t) => isTaskActiveOnWeekday(t, dow));
}

/** Returns the tasks that should actually show/count for a checklist on a
 * given date. For 'never' (non-daily) checklists every task always counts —
 * weekday recurrence only applies to checklists that reset daily. */
export function activeTasksForChecklist(checklist: Checklist, date: Date = new Date()): Task[] {
  if (checklist.resetSchedule !== "daily") return checklist.tasks;
  return tasksActiveOnWeekday(checklist.tasks, date.getDay());
}

export function weekdayOfISODate(iso: string): number {
  return new Date(iso + "T00:00:00").getDay();
}

export function weekdayLabel(dow: number): string {
  return WEEKDAY_NAMES[dow] ?? "";
}

/** Short human summary of a task's recurrence, e.g. "Every day", "Thu",
 * "Mon, Tue, Wed, Thu, Fri". Returns null for "every day" so callers can
 * skip rendering a tag in the common case. */
export function describeRecurDays(task: Task): string | null {
  const days = recurDaysOf(task);
  if (days.length >= 7) return null;
  const sorted = [...days].sort((a, b) => a - b);
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(", ");
}
