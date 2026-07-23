// ============================================================================
// Metro's central state store. Single source of truth, persisted to
// localStorage as one JSON document. Pages import `store` (a singleton) and
// call methods on it; the store notifies subscribers after every change so
// each page can re-render.
//
// Extensibility notes for future features:
//   - Bump SCHEMA_VERSION and add a migration step in `migrate()` whenever
//     AppState's shape changes, so existing users' saves upgrade cleanly.
//   - New settings/state should be added to types.ts + defaults.ts first,
//     then read/written here — avoid parallel storage keys.
// ============================================================================

import type {
  AppState,
  Checklist,
  DailyGameConfig,
  DailyGameEntry,
  Difficulty,
  PointsConfig,
  ResetSchedule,
  Rarity,
  RewardKind,
  Shortcut,
  ShortcutKind,
  Task,
  Tier,
  UnlockedReward,
} from "../types.js";
import { loadRaw, saveRaw } from "../util/storage.js";
import { makeId } from "../util/id.js";
import { currentMonthKey, previousDayISO, todayISO } from "../util/date.js";
import { defaultRewardCategories, defaultSettings, DEFAULT_TIERS } from "./defaults.js";
import { computeDailyGamePoints, defaultDailyGamesState, findDailyGameEntry } from "./dailyGames.js";
import { pointsForDifficulty } from "./points.js";
import { rollReward } from "./rewards.js";
import { activeTasksForChecklist, ALL_WEEKDAYS, tasksActiveOnWeekday, weekdayOfISODate } from "./schedule.js";
import { isTrialChecklistId, TRIAL_SLOT_IDS, trialSlotNumber } from "./trials.js";

const DEFAULT_PRIMARY_NAME = "Daily General Checklist";
const LEGACY_PRIMARY_NAME = "Daily Checklist";

const STORAGE_KEY = "metro:v1:state";
export const SCHEMA_VERSION = 1;

export interface ToggleTaskResult {
  task: Task;
  pointsAwarded: number;
  checklistFullyCompleted: boolean;
  tiersGained: number[];
  rewardsGranted: UnlockedReward[];
}

function makeTrialChecklists(): Checklist[] {
  const now = new Date().toISOString();
  const today = todayISO();
  return TRIAL_SLOT_IDS.map((id) => ({
    id,
    name: `DC ${trialSlotNumber(id)}`,
    resetSchedule: "daily" as const,
    isPrimary: false,
    enabled: true,
    tasks: [],
    createdAt: now,
    lastResetDate: today,
    history: {},
  }));
}

function createDefaultState(): AppState {
  const now = new Date().toISOString();
  const today = todayISO();
  const primaryChecklist: Checklist = {
    id: makeId("checklist"),
    name: DEFAULT_PRIMARY_NAME,
    description: "Your highlighted, everyday checklist. Resets automatically each day.",
    resetSchedule: "daily",
    isPrimary: true,
    tasks: [],
    createdAt: now,
    lastResetDate: today,
    history: {},
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
    checklists: [primaryChecklist, ...makeTrialChecklists()],
    shortcuts: [],
    battlepass: {
      currentMonthKey: currentMonthKey(),
      seasonPoints: 0,
      lifetimePoints: 0,
      currentTier: 0,
      tiers: DEFAULT_TIERS.map((t) => ({ ...t })),
      categories: defaultRewardCategories(),
      unlocked: [],
      inventory: {},
      seasonHistory: {},
    },
    dailyGames: defaultDailyGamesState(),
  };
}

/** Upgrades an older persisted state to the current schema. Each case falls
 * through intentionally so a save can hop multiple versions in one go. */
function migrate(state: AppState): AppState {
  // No migrations needed yet — schemaVersion 1 is the first version.
  return state;
}

class Store {
  private state: AppState;
  private listeners = new Set<() => void>();

  constructor() {
    const loaded = loadRaw<AppState>(STORAGE_KEY);
    this.state = loaded ? migrate(loaded) : createDefaultState();
    this.ensureTrialChecklists();
    this.ensureDailyGames();
    this.renamePrimaryIfDefault();
    this.processDueRollovers();
    this.save();
  }

  /** Creates any of the six fixed Daily Trials Checklist slots that don't
   * already exist yet — covers both brand-new installs and existing saves
   * from before this feature shipped. Idempotent. */
  private ensureTrialChecklists(): void {
    const existingIds = new Set(this.state.checklists.map((c) => c.id));
    for (const id of TRIAL_SLOT_IDS) {
      if (existingIds.has(id)) continue;
      const now = new Date().toISOString();
      this.state.checklists.push({
        id,
        name: `DC ${trialSlotNumber(id)}`,
        resetSchedule: "daily",
        isPrimary: false,
        enabled: true,
        tasks: [],
        createdAt: now,
        lastResetDate: todayISO(),
        history: {},
      });
    }
  }

  /** Backfills `dailyGames` for existing saves from before this feature
   * shipped, and — since the built-in game list can grow over time — also
   * adds any newer built-in game a save doesn't have yet, the same additive
   * pattern as ensureTrialChecklists. Never touches a game already present
   * (so a user's own edits to it, once that's supported, would be safe).
   * Idempotent. */
  private ensureDailyGames(): void {
    if (!this.state.dailyGames) {
      this.state.dailyGames = defaultDailyGamesState();
      return;
    }
    const existingIds = new Set(this.state.dailyGames.configs.map((c) => c.id));
    for (const config of defaultDailyGamesState().configs) {
      if (!existingIds.has(config.id)) this.state.dailyGames.configs.push(config);
    }
  }

  /** One-time rename for existing saves: only touches the primary checklist
   * if it still has the old default name, so a user's own rename is never
   * overwritten. */
  private renamePrimaryIfDefault(): void {
    const primary = this.state.checklists.find((c) => c.isPrimary);
    if (primary && primary.name === LEGACY_PRIMARY_NAME) {
      primary.name = DEFAULT_PRIMARY_NAME;
    }
  }

  getState(): Readonly<AppState> {
    return this.state;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private save(): void {
    saveRaw(STORAGE_KEY, this.state);
  }

  /** Every render() in this app clears and rebuilds its container from
   * scratch (see src/ui — no framework, no diffing). That briefly shrinks
   * the document while the old nodes are gone and the new ones haven't been
   * added back yet, which makes the browser clamp the scroll position — in
   * practice, editing something far down the page (renaming a checklist,
   * adding a task) would jump you back to the top. Snapshotting the scroll
   * position before notifying subscribers and restoring it right after
   * keeps you exactly where you were. */
  private emit(): void {
    this.save();
    const hasWindow = typeof window !== "undefined";
    const scrollX = hasWindow ? window.scrollX : 0;
    const scrollY = hasWindow ? window.scrollY : 0;
    for (const fn of this.listeners) fn();
    if (hasWindow) window.scrollTo(scrollX, scrollY);
  }

  // ---------------------------------------------------------------------
  // Rollovers: daily checklist resets + monthly battlepass season change.
  // Safe to call repeatedly; it's a no-op if nothing is due.
  // ---------------------------------------------------------------------

  /** Call periodically (e.g. every minute the app is open) in addition to
   * on load, so a rollover happening while the app is left open is caught
   * without requiring a page refresh. */
  checkRollovers(): void {
    const changed = this.processDueRollovers();
    if (changed) this.emit();
  }

  private processDueRollovers(): boolean {
    let changed = false;
    const today = todayISO();
    const monthKey = currentMonthKey();

    for (const checklist of this.state.checklists) {
      if (checklist.resetSchedule !== "daily") continue;
      // A disabled checklist is paused: it doesn't roll over or log history
      // while off, and resumes cleanly (from today) once re-enabled.
      if (checklist.enabled === false) continue;
      if (!checklist.lastResetDate) {
        checklist.lastResetDate = today;
        continue;
      }
      if (checklist.lastResetDate === today) continue;

      // Only the tasks scheduled for the day that's ending count toward
      // that day's log — a Tuesday-only task shouldn't show up as "missed"
      // on a Monday. See src/data/schedule.ts.
      const endingDow = weekdayOfISODate(checklist.lastResetDate);
      const dayTasks = tasksActiveOnWeekday(checklist.tasks, endingDow);
      const totalTasks = dayTasks.length;
      const completedTaskIds = dayTasks.filter((t) => t.completed).map((t) => t.id);
      const missedTaskTexts = dayTasks.filter((t) => !t.completed).map((t) => t.text);
      const pointsEarned = dayTasks
        .filter((t) => t.completed)
        .reduce((sum, t) => sum + pointsForDifficulty(this.state.settings.pointsConfig, t.difficulty), 0);

      checklist.history[checklist.lastResetDate] = {
        date: checklist.lastResetDate,
        totalTasks,
        completedTaskIds,
        missedTaskTexts,
        pointsEarned,
        // A day with zero scheduled tasks (e.g. a non-work day) counts as
        // complete rather than missed, so rest days don't break a streak.
        fullyCompleted: completedTaskIds.length === totalTasks,
      };

      for (const t of checklist.tasks) {
        t.completed = false;
        t.completedAt = undefined;
        t.pointsAwarded = false;
        t.pointsAwardedAmount = undefined;
      }
      checklist.lastResetDate = today;
      changed = true;
    }

    if (this.state.battlepass.currentMonthKey !== monthKey) {
      const bp = this.state.battlepass;
      bp.seasonHistory[bp.currentMonthKey] = {
        pointsEarned: bp.seasonPoints,
        highestTier: bp.currentTier,
      };
      bp.currentMonthKey = monthKey;
      bp.seasonPoints = 0;
      bp.currentTier = 0;
      changed = true;
    }

    return changed;
  }

  /** Returns yesterday's log entry for a checklist, if any — used to show
   * "here's what you missed yesterday" on the daily checklist page. */
  getYesterdayLog(checklistId: string) {
    const cl = this.state.checklists.find((c) => c.id === checklistId);
    if (!cl) return null;
    return cl.history[previousDayISO(todayISO())] ?? null;
  }

  // ---------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------

  renameAssistant(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.state.settings.assistantName = trimmed;
    this.emit();
  }

  setActiveTheme(themeId: string): void {
    if (!this.state.settings.unlockedThemeIds.includes(themeId)) return;
    this.state.settings.activeThemeId = themeId;
    this.emit();
  }

  setActiveAvatar(avatarId: string): void {
    if (!this.state.settings.unlockedAvatarIds.includes(avatarId)) return;
    this.state.settings.activeAvatarId = avatarId;
    this.emit();
  }

  setActiveTitle(titleId: string | null): void {
    if (titleId && !this.state.settings.unlockedTitleIds.includes(titleId)) return;
    this.state.settings.activeTitleId = titleId;
    this.emit();
  }

  updatePointsConfig(config: PointsConfig): void {
    this.state.settings.pointsConfig = { ...config };
    this.emit();
  }

  updateTiers(tiers: Tier[]): void {
    const sorted = [...tiers].sort((a, b) => a.tier - b.tier);
    this.state.battlepass.tiers = sorted;
    this.emit();
  }

  // ---------------------------------------------------------------------
  // Checklists & tasks
  // ---------------------------------------------------------------------

  addChecklist(name: string, resetSchedule: ResetSchedule = "never", description = ""): Checklist {
    const checklist: Checklist = {
      id: makeId("checklist"),
      name: name.trim() || "Untitled Checklist",
      description: description.trim() || undefined,
      resetSchedule,
      isPrimary: false,
      tasks: [],
      createdAt: new Date().toISOString(),
      lastResetDate: resetSchedule === "daily" ? todayISO() : undefined,
      history: {},
    };
    this.state.checklists.push(checklist);
    this.emit();
    return checklist;
  }

  renameChecklist(checklistId: string, name: string, description?: string): void {
    const cl = this.findChecklist(checklistId);
    if (!cl) return;
    if (name.trim()) cl.name = name.trim();
    if (description !== undefined) cl.description = description.trim() || undefined;
    this.emit();
  }

  deleteChecklist(checklistId: string): void {
    const cl = this.findChecklist(checklistId);
    // The primary daily checklist and the six fixed Trials slots can't be
    // deleted outright — Trials checklists are toggled off instead.
    if (!cl || cl.isPrimary || isTrialChecklistId(cl.id)) return;
    this.revokePoints(this.sumAwardedPoints(cl.tasks));
    this.state.checklists = this.state.checklists.filter((c) => c.id !== checklistId);
    this.emit();
  }

  /** Enables/disables a resetSchedule 'daily' checklist. While disabled it's
   * paused: no nightly reset, no history logging — see processDueRollovers.
   * Used by the Daily Trials Checklist page to target specific DCs per day. */
  setChecklistEnabled(checklistId: string, enabled: boolean): void {
    const cl = this.findChecklist(checklistId);
    if (!cl) return;
    cl.enabled = enabled;
    this.emit();
  }

  /** The six Daily Trials Checklist slots, in a stable order. */
  getTrialChecklists(): Checklist[] {
    return TRIAL_SLOT_IDS.map((id) => this.findChecklist(id)).filter((c): c is Checklist => !!c);
  }

  addTask(checklistId: string, text: string, difficulty: Difficulty, recurDays?: number[]): Task | null {
    const cl = this.findChecklist(checklistId);
    if (!cl || !text.trim()) return null;
    const task: Task = {
      id: makeId("task"),
      text: text.trim(),
      difficulty,
      completed: false,
      createdAt: new Date().toISOString(),
      recurDays: recurDays && recurDays.length > 0 ? [...recurDays].sort((a, b) => a - b) : [...ALL_WEEKDAYS],
    };
    cl.tasks.push(task);
    this.emit();
    return task;
  }

  /** Adds the same task to all six Daily Trials Checklist slots in one go
   * (regardless of each slot's on/off state), so a task common to every DC
   * doesn't need to be typed six times. Returns how many checklists it was
   * added to. */
  addTaskToAllTrials(text: string, difficulty: Difficulty, recurDays?: number[]): number {
    if (!text.trim()) return 0;
    const trials = this.getTrialChecklists();
    const days = recurDays && recurDays.length > 0 ? [...recurDays].sort((a, b) => a - b) : [...ALL_WEEKDAYS];
    for (const cl of trials) {
      cl.tasks.push({
        id: makeId("task"),
        text: text.trim(),
        difficulty,
        completed: false,
        createdAt: new Date().toISOString(),
        recurDays: days,
      });
    }
    if (trials.length > 0) this.emit();
    return trials.length;
  }

  editTask(
    checklistId: string,
    taskId: string,
    updates: { text?: string; difficulty?: Difficulty; recurDays?: number[] }
  ): void {
    const cl = this.findChecklist(checklistId);
    const task = cl?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (updates.text !== undefined && updates.text.trim()) task.text = updates.text.trim();
    if (updates.difficulty !== undefined) task.difficulty = updates.difficulty;
    if (updates.recurDays !== undefined && updates.recurDays.length > 0) {
      task.recurDays = [...updates.recurDays].sort((a, b) => a - b);
    }
    this.emit();
  }

  /** Deletes a task. If it had already earned points, those points are
   * revoked (season + lifetime) since the task no longer exists — otherwise
   * the points would linger forever with nothing behind them. This is
   * distinct from unchecking a task, which never revokes points. */
  deleteTask(checklistId: string, taskId: string): void {
    const cl = this.findChecklist(checklistId);
    if (!cl) return;
    const task = cl.tasks.find((t) => t.id === taskId);
    if (task) this.revokePoints(this.sumAwardedPoints([task]));
    cl.tasks = cl.tasks.filter((t) => t.id !== taskId);
    this.emit();
  }

  /** Reorders a checklist's tasks to match `orderedVisibleIds` — the new
   * top-to-bottom order of whichever tasks are currently shown (e.g. today's
   * active tasks on a daily checklist, drag-and-dropped into a new order).
   * Tasks NOT in that list (e.g. other days' tasks on a daily checklist,
   * hidden from today's view) stay anchored in their existing slots; only
   * the slots that belonged to a visible task get refilled, in the new
   * order. That keeps a drag-and-drop reorder of "today" from scrambling
   * tasks scheduled for other days. */
  reorderTasks(checklistId: string, orderedVisibleIds: string[]): void {
    const cl = this.findChecklist(checklistId);
    if (!cl) return;
    const visibleSet = new Set(orderedVisibleIds);
    const byId = new Map(cl.tasks.map((t) => [t.id, t]));
    const queue = [...orderedVisibleIds];
    cl.tasks = cl.tasks.map((t) => {
      if (!visibleSet.has(t.id)) return t;
      const nextId = queue.shift();
      return (nextId && byId.get(nextId)) || t;
    });
    this.emit();
  }

  /** Tucks a completed task on a 'never resets' checklist into its Archived
   * section — hides it from the main list and progress count without
   * deleting it (points earned stay intact). No-op on daily checklists,
   * which already clear completed tasks on their own each reset, or on a
   * task that isn't completed yet. */
  archiveTask(checklistId: string, taskId: string): void {
    const cl = this.findChecklist(checklistId);
    const task = cl?.tasks.find((t) => t.id === taskId);
    if (!cl || !task || cl.resetSchedule === "daily" || !task.completed) return;
    task.archived = true;
    this.emit();
  }

  unarchiveTask(checklistId: string, taskId: string): void {
    const cl = this.findChecklist(checklistId);
    const task = cl?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.archived = false;
    this.emit();
  }

  /** Archives every currently-completed, not-yet-archived task on a 'never
   * resets' checklist in one go. Returns how many were archived. */
  archiveAllCompleted(checklistId: string): number {
    const cl = this.findChecklist(checklistId);
    if (!cl || cl.resetSchedule === "daily") return 0;
    let count = 0;
    for (const t of cl.tasks) {
      if (t.completed && !t.archived) {
        t.archived = true;
        count++;
      }
    }
    if (count > 0) this.emit();
    return count;
  }

  /** Toggles a task's completion. Awards points (and rolls battlepass tier
   * rewards) the first time a task is checked off; unchecking never revokes
   * points — see Task.pointsAwarded for why. */
  toggleTask(checklistId: string, taskId: string): ToggleTaskResult | null {
    const cl = this.findChecklist(checklistId);
    const task = cl?.tasks.find((t) => t.id === taskId);
    if (!cl || !task) return null;

    task.completed = !task.completed;
    let pointsAwarded = 0;
    const tiersGained: number[] = [];
    const rewardsGranted: UnlockedReward[] = [];

    if (task.completed) {
      task.completedAt = new Date().toISOString();
      if (!task.pointsAwarded) {
        pointsAwarded = pointsForDifficulty(this.state.settings.pointsConfig, task.difficulty);
        task.pointsAwarded = true;
        task.pointsAwardedAmount = pointsAwarded;
        this.awardPoints(pointsAwarded, tiersGained, rewardsGranted);
      }
    } else {
      task.completedAt = undefined;
      // Intentionally not revoking points — see pointsAwarded doc comment.
    }

    const todaysTasks = activeTasksForChecklist(cl);
    const checklistFullyCompleted = todaysTasks.length > 0 && todaysTasks.every((t) => t.completed);

    this.emit();
    return { task, pointsAwarded, checklistFullyCompleted, tiersGained, rewardsGranted };
  }

  private awardPoints(amount: number, tiersGainedOut: number[], rewardsGrantedOut: UnlockedReward[]): void {
    const bp = this.state.battlepass;
    bp.seasonPoints += amount;
    bp.lifetimePoints += amount;

    const totalTiers = bp.tiers.length;
    const highestEligible = [...bp.tiers]
      .filter((t) => bp.seasonPoints >= t.pointsRequired)
      .sort((a, b) => a.tier - b.tier);

    for (const tierDef of highestEligible) {
      if (tierDef.tier <= bp.currentTier) continue;
      bp.currentTier = tierDef.tier;
      tiersGainedOut.push(tierDef.tier);

      const alreadyUnlockedUnlockIds = new Set(
        bp.unlocked.filter((u) => u.kind === "unlock").map((u) => u.rewardId)
      );
      const reward = rollReward({
        tierNumber: tierDef.tier,
        totalTiers,
        categories: bp.categories,
        alreadyUnlockedUnlockIds,
      });
      if (!reward) continue;

      const category = bp.categories.find((c) => c.id === reward.categoryId);
      const unlocked: UnlockedReward = {
        tier: tierDef.tier,
        monthKey: bp.currentMonthKey,
        rewardId: reward.id,
        categoryId: reward.categoryId,
        name: reward.name,
        rarity: reward.rarity,
        kind: reward.kind,
        categoryName: category?.name ?? "Reward",
        unlockedAt: new Date().toISOString(),
      };
      bp.unlocked.push(unlocked);
      rewardsGrantedOut.push(unlocked);

      if (reward.kind === "consumable") {
        bp.inventory[reward.id] = (bp.inventory[reward.id] ?? 0) + 1;
      } else {
        this.applyUnlockEffect(reward.categoryId, reward.id);
      }
    }
  }

  /** Total points across a set of tasks that have already been awarded —
   * uses each task's exact snapshotted amount when available, falling back
   * to the current points config for older data that predates the
   * snapshot. */
  private sumAwardedPoints(tasks: Task[]): number {
    return tasks
      .filter((t) => t.pointsAwarded)
      .reduce((sum, t) => sum + (t.pointsAwardedAmount ?? pointsForDifficulty(this.state.settings.pointsConfig, t.difficulty)), 0);
  }

  /** Reverses previously-awarded points (used when the task that earned them
   * is deleted). Never revokes battlepass tier rewards already unlocked —
   * those stay earned — and never drops points below zero. */
  private revokePoints(amount: number): void {
    if (amount <= 0) return;
    const bp = this.state.battlepass;
    bp.seasonPoints = Math.max(0, bp.seasonPoints - amount);
    bp.lifetimePoints = Math.max(0, bp.lifetimePoints - amount);
  }

  /** Wires a freshly-unlocked cosmetic reward into Settings' unlocked lists
   * so it's immediately selectable, without auto-switching the user's
   * current selection. */
  private applyUnlockEffect(categoryId: string, rewardId: string): void {
    const s = this.state.settings;
    if (categoryId === "cat-themes" && !s.unlockedThemeIds.includes(rewardId)) {
      s.unlockedThemeIds.push(rewardId);
    } else if (categoryId === "cat-avatars" && !s.unlockedAvatarIds.includes(rewardId)) {
      s.unlockedAvatarIds.push(rewardId);
    } else if (categoryId === "cat-titles" && !s.unlockedTitleIds.includes(rewardId)) {
      s.unlockedTitleIds.push(rewardId);
    }
    // Other categories (badges, effects) are purely display-driven from
    // `battlepass.unlocked` and don't need a settings mirror.
  }

  // ---------------------------------------------------------------------
  // Consumables: streak freeze & wildcard
  // ---------------------------------------------------------------------

  streakFreezeCount(): number {
    return this.state.battlepass.inventory["item-streak-freeze"] ?? 0;
  }

  wildcardCount(): number {
    return this.state.battlepass.inventory["item-wildcard"] ?? 0;
  }

  /** Spends one Streak Freeze to retroactively protect yesterday's entry on
   * a daily checklist, even if it wasn't fully completed. */
  useStreakFreeze(checklistId: string): boolean {
    if (this.streakFreezeCount() <= 0) return false;
    const cl = this.findChecklist(checklistId);
    if (!cl) return false;
    const yKey = previousDayISO(todayISO());
    const entry = cl.history[yKey];
    if (!entry || entry.fullyCompleted || entry.streakProtected) return false;
    entry.streakProtected = true;
    this.state.battlepass.inventory["item-streak-freeze"] -= 1;
    this.emit();
    return true;
  }

  /** Spends one Wildcard to swap out a not-yet-completed task's text and
   * difficulty for something else, without any point/streak penalty. */
  useWildcard(checklistId: string, taskId: string, newText: string, newDifficulty: Difficulty): boolean {
    if (this.wildcardCount() <= 0) return false;
    const cl = this.findChecklist(checklistId);
    const task = cl?.tasks.find((t) => t.id === taskId);
    if (!cl || !task || task.completed || !newText.trim()) return false;
    task.text = newText.trim();
    task.difficulty = newDifficulty;
    this.state.battlepass.inventory["item-wildcard"] -= 1;
    this.emit();
    return true;
  }

  // ---------------------------------------------------------------------
  // Reward categories (user-extensible)
  // ---------------------------------------------------------------------

  addRewardCategory(name: string, description = ""): void {
    if (!name.trim()) return;
    this.state.battlepass.categories.push({
      id: makeId("cat"),
      name: name.trim(),
      description: description.trim() || undefined,
      builtIn: false,
      items: [],
    });
    this.emit();
  }

  deleteRewardCategory(categoryId: string): void {
    const cat = this.state.battlepass.categories.find((c) => c.id === categoryId);
    if (!cat || cat.builtIn) return;
    this.state.battlepass.categories = this.state.battlepass.categories.filter((c) => c.id !== categoryId);
    this.emit();
  }

  addRewardItem(categoryId: string, name: string, rarity: Rarity, kind: RewardKind, description = ""): void {
    const cat = this.state.battlepass.categories.find((c) => c.id === categoryId);
    if (!cat || !name.trim()) return;
    cat.items.push({
      id: makeId("reward"),
      categoryId,
      name: name.trim(),
      description: description.trim() || undefined,
      rarity,
      kind,
    });
    this.emit();
  }

  deleteRewardItem(categoryId: string, itemId: string): void {
    const cat = this.state.battlepass.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    cat.items = cat.items.filter((i) => i.id !== itemId);
    this.emit();
  }

  // ---------------------------------------------------------------------
  // Daily Puzzles
  // ---------------------------------------------------------------------

  getDailyGames(): DailyGameConfig[] {
    return this.state.dailyGames.configs;
  }

  getDailyGameEntry(gameId: string, date: string): DailyGameEntry | undefined {
    return findDailyGameEntry(this.state.dailyGames, gameId, date);
  }

  /** Records (or corrects) a daily puzzle's result for the given date and
   * awards the points it earns, rolling battlepass tiers/rewards the same
   * way completing a task does. Recording again for a date that's already
   * logged first revokes that entry's points, so fixing a typo doesn't
   * double-award — mirrors the delete-revokes-points behavior for tasks. */
  recordDailyGameResult(
    gameId: string,
    date: string,
    input: { rawValue?: number; guesses?: number | null; actualUnderPar?: number; bestUnderPar?: number }
  ): { pointsAwarded: number; tiersGained: number[]; rewardsGranted: UnlockedReward[] } | null {
    const dg = this.state.dailyGames;
    const config = dg.configs.find((c) => c.id === gameId);
    if (!config) return null;

    const existing = findDailyGameEntry(dg, gameId, date);
    if (existing) {
      this.revokePoints(existing.pointsAwarded);
      dg.entries = dg.entries.filter((e) => e !== existing);
    }

    const pointsAwarded = computeDailyGamePoints(config, input, dg);
    const entry: DailyGameEntry = {
      gameId,
      date,
      rawValue: input.rawValue,
      guesses: input.guesses,
      actualUnderPar: input.actualUnderPar,
      bestUnderPar: input.bestUnderPar,
      pointsAwarded,
      recordedAt: new Date().toISOString(),
    };
    dg.entries.push(entry);

    const tiersGained: number[] = [];
    const rewardsGranted: UnlockedReward[] = [];
    if (pointsAwarded > 0) this.awardPoints(pointsAwarded, tiersGained, rewardsGranted);
    this.emit();
    return { pointsAwarded, tiersGained, rewardsGranted };
  }

  // ---------------------------------------------------------------------
  // Shortcuts
  // ---------------------------------------------------------------------

  addShortcut(label: string, kind: ShortcutKind, target: string, category: string, notes = ""): Shortcut | null {
    if (!label.trim() || !target.trim()) return null;
    const shortcut: Shortcut = {
      id: makeId("shortcut"),
      label: label.trim(),
      kind,
      target: target.trim(),
      category: category.trim() || "General",
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    this.state.shortcuts.push(shortcut);
    this.emit();
    return shortcut;
  }

  editShortcut(id: string, updates: Partial<Pick<Shortcut, "label" | "kind" | "target" | "category" | "notes">>): void {
    const s = this.state.shortcuts.find((x) => x.id === id);
    if (!s) return;
    if (updates.label !== undefined && updates.label.trim()) s.label = updates.label.trim();
    if (updates.kind !== undefined) s.kind = updates.kind;
    if (updates.target !== undefined && updates.target.trim()) s.target = updates.target.trim();
    if (updates.category !== undefined) s.category = updates.category.trim() || "General";
    if (updates.notes !== undefined) s.notes = updates.notes.trim() || undefined;
    this.emit();
  }

  deleteShortcut(id: string): void {
    this.state.shortcuts = this.state.shortcuts.filter((s) => s.id !== id);
    this.emit();
  }

  // ---------------------------------------------------------------------
  // Backup / restore
  // ---------------------------------------------------------------------

  exportData(): string {
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION, state: this.state },
      null,
      2
    );
  }

  importData(json: string): { ok: boolean; error?: string } {
    try {
      const parsed = JSON.parse(json);
      const state: AppState = parsed?.state ?? parsed; // allow raw state or wrapped export
      if (!state || !Array.isArray(state.checklists) || !state.settings || !state.battlepass) {
        return { ok: false, error: "That file doesn't look like a Metro backup." };
      }
      this.state = migrate({ ...state, schemaVersion: state.schemaVersion ?? SCHEMA_VERSION });
      this.ensureTrialChecklists();
      this.ensureDailyGames();
      this.renamePrimaryIfDefault();
      this.processDueRollovers();
      this.emit();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: "Couldn't parse that file as JSON." };
    }
  }

  resetAllData(): void {
    this.state = createDefaultState();
    this.emit();
  }

  // ---------------------------------------------------------------------

  private findChecklist(id: string): Checklist | undefined {
    return this.state.checklists.find((c) => c.id === id);
  }

  getPrimaryChecklist(): Checklist {
    return this.state.checklists.find((c) => c.isPrimary) ?? this.state.checklists[0];
  }
}

export const store = new Store();
