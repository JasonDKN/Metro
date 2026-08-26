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
  /** The exact number of points granted when pointsAwarded was set — kept so
   * deleting the task later revokes the exact amount it earned, even if the
   * points-per-difficulty settings changed in the meantime. */
  pointsAwardedAmount?: number;
  notes?: string;
  createdAt: string;
  /** Which days of the week (0 = Sunday … 6 = Saturday, matching
   * Date.getDay()) this task recurs on. Only meaningful for checklists with
   * resetSchedule 'daily' — a 'never' checklist ignores this and always
   * shows every task. Omitted/undefined means "every day", so tasks created
   * before this field existed keep behaving exactly as before. */
  recurDays?: number[];
  /** True once a completed task on a resetSchedule 'never' checklist has been
   * tucked into that checklist's "Archived" section — hidden from the main
   * list and progress count, but not deleted, so it keeps whatever points it
   * already earned. Not used on 'daily' checklists, which already clear
   * completed tasks every reset instead of accumulating them. */
  archived?: boolean;
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
  /** Defaults to true when omitted. Lets a resetSchedule 'daily' checklist be
   * paused without deleting it — while disabled it's frozen (no nightly
   * reset/history logging) until re-enabled. Powers the on/off toggle on the
   * Daily Trials Checklist page. */
  enabled?: boolean;
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
  /** Optional short trivia/flavor caption shown under the item's name once
   * it's actually owned (Inventory, Unlocked Rewards) — lets a reward carry
   * some context without cluttering the name itself. */
  flavorText?: string;
  /** Base64 data: URL of a user-uploaded photo. Currently only used by the
   * Photocards category. Callers must only render this where ownership is
   * already confirmed — see rewardVisual's `revealed` option — so a photo
   * attached ahead of time stays hidden until its tier is actually reached. */
  imageDataUrl?: string;
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

/** A fixed, deterministic assignment of one reward item to one tier — the
 * whole point being that you can look this up in advance instead of a
 * reward being randomly rolled when you get there. Built ascending by
 * rarity; see DEFAULT_REWARD_ROADMAP in data/defaults.ts for the curated
 * starting lineup and Store.ensureRewardRoadmap for how it extends to tiers
 * added later. */
export interface RewardRoadmapEntry {
  tier: number;
  categoryId: string;
  itemId: string;
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
  /** The deterministic tier -> reward mapping (ascending rarity). Reaching a
   * tier grants exactly the item its roadmap entry points to — nothing is
   * randomly rolled. */
  rewardRoadmap: RewardRoadmapEntry[];
  unlocked: UnlockedReward[];
  /** Consumable reward counts by reward id (e.g. streak freezes, wildcards). */
  inventory: Record<string, number>;
  /** History of past seasons for reference, keyed by monthKey. */
  seasonHistory: Record<string, { pointsEarned: number; highestTier: number }>;
  /** A snapshot of `tiers` taken right before a scheduled season (see
   * SEASONAL_TIERS in defaults.ts) temporarily swaps in its own tier
   * ladder — restored the moment a season without a scheduled ladder
   * begins, so a custom tier setup made in Settings survives a themed
   * season without being permanently overwritten. Absent/undefined outside
   * of an active scheduled season. */
  baselineTiers?: Tier[];
}

// ---------------------------------------------------------------------------
// Settings / App-wide
// ---------------------------------------------------------------------------

export interface Settings {
  assistantName: string;
  /** Which theme/avatar/title is currently equipped. Whether something is
   * *eligible* to be equipped is deliberately NOT tracked here — that used
   * to be mirrored into separate unlockedThemeIds/unlockedAvatarIds/
   * unlockedTitleIds arrays, which could silently drift out of sync with
   * what's actually recorded as earned. Store.isRewardEarned() checks
   * eligibility live against battlepass.unlocked instead, so there's only
   * ever one source of truth. */
  activeThemeId: string;
  activeAvatarId: string;
  activeTitleId: string | null;
  /** Which Celebration Effect plays when you clear your daily checklist.
   * null means the built-in default confetti burst — the same animation
   * that always played before Celebration Effects existed as an earnable
   * reward, so a fresh install (or anyone who hasn't equipped one) sees
   * unchanged behavior. */
  activeEffectId: string | null;
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
  dailyGames: DailyGamesState;
  photocardAlbum: PhotocardAlbum;
}

// ---------------------------------------------------------------------------
// Photocard Album — a binder-style page for browsing unlocked Photocards
// (cat-photocards rewards) and decorating the album's front cover with
// unlocked Stickers (cat-stickers rewards). See src/pages/photocardAlbum.ts.
// ---------------------------------------------------------------------------

/** One Sticker placed on the album's front cover. Each owned sticker can
 * only be placed once (they're one-time unlocks, not stackable) — position
 * is randomized at placement time and then persisted so the cover doesn't
 * rearrange itself between visits. */
export interface PlacedSticker {
  itemId: string;
  xPct: number; // 0-100, left offset within the cover
  yPct: number; // 0-100, top offset within the cover
  rotationDeg: number;
}

export interface PhotocardAlbum {
  coverStickers: PlacedSticker[];
}

// ---------------------------------------------------------------------------
// Daily Puzzles — external daily games (Wordle, etc.) that award Battlepass
// points scaled to how well you did, so they feel proportionate to clearing
// a regular task. See src/data/dailyGames.ts for the actual scoring math.
// ---------------------------------------------------------------------------

/** How a game's raw daily input converts into Battlepass points. Each
 * variant is a reusable pattern — a new game can be added later by picking
 * whichever of these fits its scoring style, with no new scoring code. */
export type DailyGameScoring =
  | {
      /** A raw score (or time) that scales linearly between two anchors:
       * `worst` maps to the floor points, `best` maps to the ceiling points.
       * `best` can be numerically lower than `worst` (e.g. a timed game where
       * less time is better) — direction is inferred from which is larger. */
      method: "linearRange";
      worst: number;
      best: number;
      unit?: "score" | "seconds";
    }
  | {
      /** A guess count where fewer guesses is better, plus a fixed point
       * value for an outright failure/loss (kept separate since a fail isn't
       * just "one worse than the worst successful guess"). */
      method: "guessCount";
      bestGuesses: number;
      worstGuesses: number;
      failPoints: number;
    }
  | {
      /** Guesses-under-par relative to a best-possible value that's entered
       * fresh each day, for puzzles where "the best you could do" varies
       * day to day rather than being a fixed personal record. */
      method: "underParDailyBest";
    };

export interface DailyGameConfig {
  id: string;
  name: string;
  scoring: DailyGameScoring;
  /** True for the games Metro ships with by default. */
  builtIn: boolean;
  createdAt: string;
}

/** One day's recorded result for one game. At most one per (gameId, date) —
 * recording again for the same day replaces the previous entry and corrects
 * the points it earned, see Store.recordDailyGameResult. */
export interface DailyGameEntry {
  gameId: string;
  date: string; // YYYY-MM-DD
  /** Raw input(s) — which fields are used depends on the game's scoring
   * method (see DailyGameScoring). */
  rawValue?: number; // linearRange
  guesses?: number | null; // guessCount; null = failed/lost
  actualUnderPar?: number; // underParDailyBest
  bestUnderPar?: number; // underParDailyBest
  pointsAwarded: number;
  recordedAt: string;
}

export interface DailyGamesState {
  /** The point range every game's score maps into — shared across all games
   * so they feel proportionate to each other and to regular task points. */
  minPoints: number;
  maxPoints: number;
  configs: DailyGameConfig[];
  entries: DailyGameEntry[];
  /** Ids of built-in puzzles the user has deliberately removed. Needed
   * because Store.ensureDailyGames additively re-adds any built-in a save is
   * missing (that's how newly-shipped built-ins reach existing users) —
   * without a tombstone here, deleting a built-in would silently undo itself
   * on the very next page load. Only built-ins need this; a user-added
   * puzzle is simply gone once removed, since nothing ever re-seeds it.
   * Optional so saves from before puzzles were editable still load. */
  removedBuiltInIds?: string[];
}
