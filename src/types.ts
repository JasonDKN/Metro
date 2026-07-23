// ============================================================================
// Metro — Core Type Definitions
//
// This file is the single source of truth for the app's data shape. New
// features should extend these interfaces (or add new ones) rather than
// bolting state on elsewhere, so the whole app stays typed and discoverable.
// ============================================================================

/** Difficulty levels a task can be assigned. Point values for each level are
 * configurable in Settings (see PointsConfig), so adding a new level here
 * just means adding a matching entry to the default PointsConfig map. */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "Easy",
  2: "Medium",
  3: "Hard",
  4: "Very Hard",
  5: "Extreme",
};

/** A single actionable item on any checklist. */
export interface Task {
  id: string;
  text: string;
  difficulty: Difficulty;
  completed: boolean;
  /** ISO timestamp of when this task was completed, if it is. */
  completedAt?: string;
  /** True once points have been awarded for this task's current completion
   * cycle. Prevents re-earning points by unchecking and rechecking the same
   * task — points are purely additive (never revoked), so this flag is the
   * only guard against double-awarding rather than a subtraction on uncheck.
   * Cleared back to false whenever the task's checklist resets (see
   * ResetSchedule 'daily'). */
  pointsAwarded?: boolean;
  notes?: string;
  createdAt: string;
  /** Which days of the week (0 = Sunday … 6 = Saturday, matching
   * Date.getDay()) this task recurs on. Only meaningful for checklists with
   * resetSchedule 'daily' — a 'never' checklist ignores this and always
   * shows every task. Omitted/undefined means "every day", so tasks created
   * before this field existed keep behaving exactly as before. */
  recurDays?: number[];
}

/** How (and whether) a checklist's tasks auto-uncheck on a schedule.
 * 'daily' powers the highlighted daily checklist but is intentionally not
 * restricted to a single checklist — a user-created list could opt into
 * 'daily' reset too, which is why this lives per-checklist rather than as a
 * single global flag. */
export type ResetSchedule = "daily" | "never";

export interface Checklist {
  id: string;
  name: string;
  description?: string;
  resetSchedule: ResetSchedule;
  /** True for the single built-in daily checklist; used to prevent deletion
   * and to decide which list gets top billing on the home page. */
  isPrimary: boolean;
  tasks: Task[];
  createdAt: string;
  /** For resetSchedule 'daily' lists: the last date (YYYY-MM-DD) this
   * checklist was rolled over. Used to detect when a new day has begun. */
  lastResetDate?: string;
  /** For resetSchedule 'daily' lists: a log of past days' outcomes, keyed by
   * ISO date (YYYY-MM-DD), used for streaks/history and "missed yesterday". */
  history: Record<string, DailyLogEntry>;
}

export interface DailyLogEntry {
  date: string; // YYYY-MM-DD
  totalTasks: number;
  completedTaskIds: string[];
  missedTaskTexts: string[];
  pointsEarned: number;
  fullyCompleted: boolean;
  /** Set true when a Streak Freeze token was spent to protect this day even
   * though it wasn't fully completed. */
  streakProtected?: boolean;
}

// ---------------------------------------------------------------------------
// Shortcuts
// ---------------------------------------------------------------------------

export type ShortcutKind = "website" | "file" | "program";

export interface Shortcut {
  id: string;
  label: string;
  kind: ShortcutKind;
  /** For 'website': a URL. For 'file': a file:// or plain path used to build
   * a file:// link. For 'program': a path/command shown as reference text
   * only, since browsers cannot launch local executables. */
  target: string;
  category: string;
  notes?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Points / Battlepass
// ---------------------------------------------------------------------------

/** Points awarded per difficulty level. Fully editable in Settings so the
 * user can rebalance scoring without a code change. */
export type PointsConfig = Record<Difficulty, number>;

export interface Tier {
  tier: number;
  pointsRequired: number;
}

export type RewardKind = "unlock" | "consumable";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/** A single reward that can be handed out when a battlepass tier is reached. */
export interface RewardItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  rarity: Rarity;
  kind: RewardKind;
}

/** A grouping of rewards (e.g. "Themes", "Titles"). New categories can be
 * appended at any time from Settings; doing so never touches previously
 * rolled/unlocked rewards, so existing progress is preserved. */
export interface RewardCategory {
  id: string;
  name: string;
  description?: string;
  /** If true, this category ships with Metro and can't be deleted (but more
   * items can still be added to it). User-created categories can be removed. */
  builtIn: boolean;
  items: RewardItem[];
}

/** A reward actually granted to the user at a specific tier. Snapshots the
 * reward's name/rarity/category/kind at grant time so this historical record
 * stays meaningful even if the reward pool is edited later. */
export interface UnlockedReward {
  tier: number;
  monthKey: string; // YYYY-MM, which battlepass season this was earned in
  rewardId: string;
  categoryId: string;
  name: string;
  rarity: Rarity;
  kind: RewardKind;
  categoryName: string;
  unlockedAt: string;
}

export interface Battlepass {
  /** Current season, e.g. "2026-07". Points reset to 0 when this rolls over. */
  currentMonthKey: string;
  /** Points earned this season (purely additive, never penalized). */
  seasonPoints: number;
  /** Points ever earned, across all seasons — never resets. */
  lifetimePoints: number;
  /** Highest tier reached in the current season. */
  currentTier: number;
  tiers: Tier[];
  categories: RewardCategory[];
  unlocked: UnlockedReward[];
  /** Consumable reward counts by reward id (e.g. streak freezes, wildcards). */
  inventory: Record<string, number>;
  /** History of past seasons for reference, keyed by monthKey. */
  seasonHistory: Record<string, { pointsEarned: number; highestTier: number }>;
}

// ---------------------------------------------------------------------------
// Settings / App-wide
// ---------------------------------------------------------------------------

export interface Settings {
  assistantName: string;
  activeThemeId: string;
  unlockedThemeIds: string[];
  activeAvatarId: string;
  unlockedAvatarIds: string[];
  activeTitleId: string | null;
  unlockedTitleIds: string[];
  pointsConfig: PointsConfig;
}

/** The full application state, persisted as a single JSON document in
 * localStorage. `schemaVersion` exists so future releases can migrate old
 * saves forward without losing data — see data/store.ts. */
export interface AppState {
  schemaVersion: number;
  settings: Settings;
  checklists: Checklist[];
  shortcuts: Shortcut[];
  battlepass: Battlepass;
}
