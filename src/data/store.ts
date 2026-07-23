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
import {
  DEFAULT_AVATAR_ID,
  DEFAULT_REWARD_ROADMAP,
  DEFAULT_THEME_ID,
  defaultRewardCategories,
  defaultSettings,
  DEFAULT_TIERS,
} from "./defaults.js";
import { computeDailyGamePoints, defaultDailyGamesState, findDailyGameEntry } from "./dailyGames.js";
import { pointsForDifficulty } from "./points.js";
import { nextRoadmapItem } from "./rewards.js";
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
      rewardRoadmap: [],
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
    this.ensureRewardRoadmap();
    this.syncUpcomingTiersToCuratedRoadmap();
    this.removeBadgesCategory();
    this.dedupeDuplicateTierGrants();
    this.backfillMissingTierRewards();
    this.ensureActiveCosmeticsValid();
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

  /** Builds/extends the deterministic tier -> reward roadmap so every
   * currently-defined tier has a known reward, in ascending rarity order —
   * see DEFAULT_REWARD_ROADMAP for the curated tiers 1-15. A tier added
   * later (Settings lets you add more) gets the next lowest-rarity unused
   * item automatically. Items already owned via an 'unlock' reward (even one
   * granted before this deterministic system existed) are skipped so a
   * future tier is never promised something you already have. Entries
   * already assigned are never changed, so a tier's promised reward stays
   * stable even if the pool changes later. Idempotent. */
  private ensureRewardRoadmap(): void {
    const bp = this.state.battlepass;
    if (!bp.rewardRoadmap) bp.rewardRoadmap = [];
    const assignedTiers = new Set(bp.rewardRoadmap.map((r) => r.tier));
    const usedItemIds = new Set(bp.rewardRoadmap.map((r) => r.itemId));
    for (const u of bp.unlocked) {
      if (u.kind === "unlock") usedItemIds.add(u.rewardId);
    }

    const itemExists = (categoryId: string, itemId: string) =>
      !!bp.categories.find((c) => c.id === categoryId)?.items.find((i) => i.id === itemId);

    for (const tierDef of [...bp.tiers].sort((a, b) => a.tier - b.tier)) {
      if (assignedTiers.has(tierDef.tier)) continue;

      let categoryId: string | undefined;
      let itemId: string | undefined;
      const curated = DEFAULT_REWARD_ROADMAP.find(
        (r) => r.tier === tierDef.tier && !usedItemIds.has(r.itemId) && itemExists(r.categoryId, r.itemId)
      );
      if (curated) {
        categoryId = curated.categoryId;
        itemId = curated.itemId;
      } else {
        const next = nextRoadmapItem(bp.categories, usedItemIds);
        if (next) {
          categoryId = next.categoryId;
          itemId = next.itemId;
        }
      }
      if (!categoryId || !itemId) continue; // pool exhausted; tier gets no reward for now

      bp.rewardRoadmap.push({ tier: tierDef.tier, categoryId, itemId });
      usedItemIds.add(itemId);
      assignedTiers.add(tierDef.tier);
    }
    bp.rewardRoadmap.sort((a, b) => a.tier - b.tier);
  }

  /** Re-applies the curated DEFAULT_REWARD_ROADMAP to any tier that hasn't
   * been reached yet, so a deliberate design change (e.g. swapping which
   * category a tier grants from) takes effect for tiers still ahead of you
   * — without this, ensureRewardRoadmap's "never change an assigned entry"
   * stability guarantee would keep the OLD curated pick forever, even after
   * the curated table itself is edited. Tiers already reached always keep
   * whatever they actually granted (never revoked/reshuffled), and a
   * curated pick is skipped if its item is already owned some other way
   * (an already-reached tier, or a legacy grant) so nothing gets promised
   * twice. Idempotent. */
  private syncUpcomingTiersToCuratedRoadmap(): void {
    const bp = this.state.battlepass;
    const itemExists = (categoryId: string, itemId: string) =>
      !!bp.categories.find((c) => c.id === categoryId)?.items.find((i) => i.id === itemId);
    const ownedItemIds = new Set<string>();
    for (const u of bp.unlocked) {
      if (u.kind === "unlock") ownedItemIds.add(u.rewardId);
    }
    for (const r of bp.rewardRoadmap) {
      if (r.tier <= bp.currentTier) ownedItemIds.add(r.itemId);
    }

    for (const curated of DEFAULT_REWARD_ROADMAP) {
      if (curated.tier <= bp.currentTier) continue; // already reached — never touch
      if (ownedItemIds.has(curated.itemId)) continue; // already granted elsewhere — don't duplicate
      if (!itemExists(curated.categoryId, curated.itemId)) continue; // pool changed; leave existing assignment

      const idx = bp.rewardRoadmap.findIndex((r) => r.tier === curated.tier);
      if (idx === -1) {
        bp.rewardRoadmap.push({ tier: curated.tier, categoryId: curated.categoryId, itemId: curated.itemId });
      } else if (bp.rewardRoadmap[idx].itemId !== curated.itemId) {
        bp.rewardRoadmap[idx] = { tier: curated.tier, categoryId: curated.categoryId, itemId: curated.itemId };
      }
    }
    bp.rewardRoadmap.sort((a, b) => a.tier - b.tier);
  }

  /** Drops any roadmap entries for tiers not yet reached that point at a
   * reward which no longer exists (its item/category was deleted from the
   * pool), then refills those tiers from what's left — keeps the
   * upcoming-rewards preview always accurate. Already-reached tiers' entries
   * are left untouched, same as their granted UnlockedReward record. */
  private reconcileRoadmapForUpcomingTiers(): void {
    const bp = this.state.battlepass;
    const itemExists = (categoryId: string, itemId: string) =>
      !!bp.categories.find((c) => c.id === categoryId)?.items.find((i) => i.id === itemId);
    bp.rewardRoadmap = bp.rewardRoadmap.filter((r) => r.tier <= bp.currentTier || itemExists(r.categoryId, r.itemId));
    this.ensureRewardRoadmap();
  }

  /** One-time-but-idempotent cleanup: the built-in "Badges" reward category
   * has been removed in favor of the fully deterministic reward roadmap
   * above (which never included badges). Any tier that had already been
   * granted a Badge under the old random-roll system gets a real
   * replacement reward from the new roadmap instead, so hitting that tier
   * still means something. */
  private removeBadgesCategory(): void {
    const bp = this.state.battlepass;
    if (!bp.categories.some((c) => c.id === "cat-badges")) return;
    bp.categories = bp.categories.filter((c) => c.id !== "cat-badges");
    const orphanedTiers = bp.unlocked.filter((u) => u.categoryId === "cat-badges").map((u) => u.tier);
    bp.unlocked = bp.unlocked.filter((u) => u.categoryId !== "cat-badges");
    for (const tier of orphanedTiers) {
      this.grantTierReward(tier, []);
    }
  }

  /** Safety net: for every tier already reached, make sure its
   * roadmap-assigned reward actually made it into `bp.unlocked`. Under
   * normal play this is always already true — awardPoints grants a tier's
   * reward the moment it's reached — but a handful of historical edge
   * cases (saves from before the deterministic roadmap existed, the
   * Badges-removal migration, or the roadmap itself not being fully built
   * out yet the moment a tier was reached) could leave a reached tier
   * without a matching grant, which shows up as "I know I earned this but
   * it's locked."
   *
   * Explicitly skips any tier that already has ANY unlocked entry — never
   * calls grantTierReward for a tier twice. That check is load-bearing:
   * grantTierReward's own re-grant guard only covers 'unlock' kind items
   * (an early version of this method called it unconditionally for every
   * reached tier on every load, which was harmless for one-time unlocks
   * but handed out a brand-new consumable — a Streak Freeze or Wildcard —
   * on every single page refresh, since consumables are meant to legitimately
   * stack across *different* tiers and so don't dedupe against themselves).
   * With the per-tier check here, this can only ever fill in a tier with
   * zero recorded grants — it never touches a tier that already has one. */
  private backfillMissingTierRewards(): void {
    const bp = this.state.battlepass;
    const tiersWithAGrant = new Set(bp.unlocked.map((u) => u.tier));
    for (const tierDef of bp.tiers) {
      if (tierDef.tier > bp.currentTier) continue;
      if (tiersWithAGrant.has(tierDef.tier)) continue;
      this.grantTierReward(tierDef.tier, []);
    }
  }

  /** One-time-but-idempotent repair for the bug described on
   * backfillMissingTierRewards above: collapses any tier that ended up with
   * more than one grant recorded (from that bug re-granting a consumable on
   * every page load) down to the single earliest one, and corrects the
   * inventory count by however many spurious extra copies were granted.
   * 'Unlock' kind rewards can't be affected — grantTierReward always
   * refused to re-grant those regardless of this bug. A no-op for anyone
   * who never hit the buggy code path (the by-far-common case going
   * forward). */
  private dedupeDuplicateTierGrants(): void {
    const bp = this.state.battlepass;
    const seenTiers = new Set<number>();
    const kept: UnlockedReward[] = [];
    const extraCopiesByItemId = new Map<string, number>();

    for (const u of [...bp.unlocked].sort((a, b) => (a.unlockedAt < b.unlockedAt ? -1 : 1))) {
      if (seenTiers.has(u.tier)) {
        if (u.kind === "consumable") {
          extraCopiesByItemId.set(u.rewardId, (extraCopiesByItemId.get(u.rewardId) ?? 0) + 1);
        }
        continue; // drop the duplicate grant
      }
      seenTiers.add(u.tier);
      kept.push(u);
    }

    if (kept.length === bp.unlocked.length) return; // nothing duplicated — no-op
    bp.unlocked = kept;
    for (const [itemId, extraCopies] of extraCopiesByItemId) {
      bp.inventory[itemId] = Math.max(0, (bp.inventory[itemId] ?? 0) - extraCopies);
    }
  }

  /** Whether a specific reward item has actually been earned — the ONE
   * source of truth for "can this be equipped/is this unlocked", checked
   * live against battlepass.unlocked rather than a separate cached list.
   * (A denormalized "unlockedThemeIds"-style cache used to exist here and
   * repeatedly drifted out of sync with what was actually earned — this
   * replaces it entirely rather than patching the sync logic again.) */
  isRewardEarned(categoryId: string, itemId: string): boolean {
    return this.state.battlepass.unlocked.some(
      (u) => u.kind === "unlock" && u.categoryId === categoryId && u.rewardId === itemId
    );
  }

  /** All item ids earned so far in a given reward category — used by the
   * Inventory page (and anywhere else) to list what's actually unlocked,
   * always computed fresh from battlepass.unlocked. */
  getUnlockedItemIds(categoryId: string): string[] {
    return this.state.battlepass.unlocked
      .filter((u) => u.kind === "unlock" && u.categoryId === categoryId)
      .map((u) => u.rewardId);
  }

  /** Idempotent safety check: if your currently-equipped theme/avatar/title
   * ever stops being valid (e.g. its item was deleted from the reward pool
   * while equipped), fall back to the default/none rather than leaving a
   * dangling selection. Since eligibility is now always checked live via
   * isRewardEarned, this can't drift — it only ever needs to catch the
   * pool-changed-out-from-under-you case. */
  private ensureActiveCosmeticsValid(): void {
    const s = this.state.settings;
    if (s.activeThemeId !== DEFAULT_THEME_ID && !this.isRewardEarned("cat-themes", s.activeThemeId)) {
      s.activeThemeId = DEFAULT_THEME_ID;
    }
    if (s.activeAvatarId !== DEFAULT_AVATAR_ID && !this.isRewardEarned("cat-avatars", s.activeAvatarId)) {
      s.activeAvatarId = DEFAULT_AVATAR_ID;
    }
    if (s.activeTitleId && !this.isRewardEarned("cat-titles", s.activeTitleId)) {
      s.activeTitleId = null;
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
    if (themeId !== DEFAULT_THEME_ID && !this.isRewardEarned("cat-themes", themeId)) return;
    this.state.settings.activeThemeId = themeId;
    this.emit();
  }

  setActiveAvatar(avatarId: string): void {
    if (avatarId !== DEFAULT_AVATAR_ID && !this.isRewardEarned("cat-avatars", avatarId)) return;
    this.state.settings.activeAvatarId = avatarId;
    this.emit();
  }

  setActiveTitle(titleId: string | null): void {
    if (titleId && !this.isRewardEarned("cat-titles", titleId)) return;
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
    this.ensureRewardRoadmap();
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

    const highestEligible = [...bp.tiers]
      .filter((t) => bp.seasonPoints >= t.pointsRequired)
      .sort((a, b) => a.tier - b.tier);

    for (const tierDef of highestEligible) {
      if (tierDef.tier <= bp.currentTier) continue;
      bp.currentTier = tierDef.tier;
      tiersGainedOut.push(tierDef.tier);
      this.grantTierReward(tierDef.tier, rewardsGrantedOut);
    }
  }

  /** Grants the deterministic roadmap reward for a tier — used both when a
   * tier is freshly reached (from awardPoints) and when backfilling a
   * replacement for a reward that's since been invalidated (see
   * removeBadgesCategory). Won't double-grant an 'unlock' kind reward that's
   * already owned; consumables always stack so they're granted regardless. */
  private grantTierReward(tierNumber: number, rewardsGrantedOut: UnlockedReward[]): void {
    const bp = this.state.battlepass;
    const roadmapEntry = bp.rewardRoadmap.find((r) => r.tier === tierNumber);
    if (!roadmapEntry) return;
    const category = bp.categories.find((c) => c.id === roadmapEntry.categoryId);
    const item = category?.items.find((i) => i.id === roadmapEntry.itemId);
    if (!category || !item) return;
    if (item.kind === "unlock" && bp.unlocked.some((u) => u.rewardId === item.id)) return;

    const unlocked: UnlockedReward = {
      tier: tierNumber,
      monthKey: bp.currentMonthKey,
      rewardId: item.id,
      categoryId: item.categoryId,
      name: item.name,
      rarity: item.rarity,
      kind: item.kind,
      categoryName: category.name,
      unlockedAt: new Date().toISOString(),
    };
    bp.unlocked.push(unlocked);
    rewardsGrantedOut.push(unlocked);

    // Consumables stack in inventory; 'unlock' kind rewards need nothing
    // further here — they become equippable/visible purely by virtue of
    // being in battlepass.unlocked now (see isRewardEarned/getUnlockedItemIds).
    if (item.kind === "consumable") {
      bp.inventory[item.id] = (bp.inventory[item.id] ?? 0) + 1;
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
    this.reconcileRoadmapForUpcomingTiers();
    this.emit();
  }

  /** Adds a new reward item to the pool. Also extends the tier roadmap in
   * case an earlier tier had run out of eligible rewards and was left
   * without one — this new item becomes available to fill it in. */
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
    this.ensureRewardRoadmap();
    this.emit();
  }

  deleteRewardItem(categoryId: string, itemId: string): void {
    const cat = this.state.battlepass.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    cat.items = cat.items.filter((i) => i.id !== itemId);
    this.reconcileRoadmapForUpcomingTiers();
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
      this.ensureRewardRoadmap();
      this.syncUpcomingTiersToCuratedRoadmap();
      this.removeBadgesCategory();
      this.dedupeDuplicateTierGrants();
      this.backfillMissingTierRewards();
      this.ensureActiveCosmeticsValid();
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
