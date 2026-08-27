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
  DailyGameScoring,
  Difficulty,
  PlacedSticker,
  PointsConfig,
  ResetSchedule,
  Rarity,
  RewardItem,
  RewardKind,
  RewardRoadmapEntry,
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
  BTS_NEW_AVATARS,
  BTS_NEW_EFFECTS,
  BTS_NEW_PHOTOCARDS,
  BTS_NEW_STICKERS,
  BTS_NEW_THEME,
  BTS_NEW_TITLES,
  DEFAULT_AVATAR_ID,
  DEFAULT_REWARD_ROADMAP,
  DEFAULT_THEME_ID,
  defaultPhotocardAlbum,
  defaultRewardCategories,
  defaultSettings,
  DEFAULT_TIERS,
  SEASONAL_REWARD_ROADMAPS,
  SEASONAL_TIERS,
  STUDY_AVATARS,
  STUDY_BACKGROUNDS,
  STUDY_CHECKBOXES,
  STUDY_EFFECTS,
  STUDY_FONTS,
  STUDY_THEMES,
  STUDY_TITLES,
} from "./defaults.js";

/** The category-specific fields a new reward can carry, kept as one bag
 * rather than growing addRewardItem's argument list once per category. */
export interface RewardExtras {
  imageDataUrl?: string;
  colors?: [string, string];
  effectAnimation?: string;
  fontFamily?: string;
  backgroundPattern?: string;
}

/** Shape of the Study Season seed lists in defaults.ts. Declared here rather
 * than exported from there because the seeding loop below is its only
 * consumer. */
interface StudySeed {
  id: string;
  name: string;
  rarity: Rarity;
  flavorText: string;
  description?: string;
  colors?: [string, string];
  effectAnimation?: string;
  fontFamily?: string;
  backgroundPattern?: string;
}
import {
  bestDailyGameEntry,
  bestDailyGameScore,
  computeDailyGamePoints,
  DAILY_GAME_MAX_POINTS,
  DAILY_GAME_MIN_POINTS,
  defaultDailyGamesState,
  findDailyGameEntry,
  normalizeGameUrl,
} from "./dailyGames.js";
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

  // A brand-new install started DURING a scheduled season (e.g. someone's
  // very first load happens to land in August) never goes through
  // processDueRollovers' month-change branch — there's no "previous month"
  // to roll over FROM. Without this, it would seed the evergreen 15-tier
  // ladder while ensureRewardRoadmap/activeCuratedRoadmap already assume
  // the season's full tier range, leaving high tiers with roadmap entries
  // pointing at rewards no tier actually exists to grant. Seeding directly
  // from SEASONAL_TIERS here keeps a fresh install consistent with what an
  // actual rollover into that same month would have produced.
  const startingMonthKey = currentMonthKey();
  const startingTiers = SEASONAL_TIERS[startingMonthKey] ?? DEFAULT_TIERS;

  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
    checklists: [primaryChecklist, ...makeTrialChecklists()],
    shortcuts: [],
    battlepass: {
      currentMonthKey: startingMonthKey,
      seasonPoints: 0,
      lifetimePoints: 0,
      currentTier: 0,
      tiers: startingTiers.map((t) => ({ ...t })),
      categories: defaultRewardCategories(),
      rewardRoadmap: [],
      unlocked: [],
      inventory: {},
      seasonHistory: {},
    },
    dailyGames: defaultDailyGamesState(),
    photocardAlbum: defaultPhotocardAlbum(),
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
    this.ensurePhotocardAlbum();
    this.ensureSeasonalTierLadder();
    this.pruneOrphanedRoadmapEntries();
    this.ensureBtsRewardPack();
    this.ensureStudySeasonPack();
    this.removeConsumableRewards();
    this.ensureRewardRoadmap();
    this.syncUpcomingTiersToCuratedRoadmap();
    this.rescaleDailyGamePoints();
    this.removeBadgesCategory();
    this.reconcileTierGrantsWithRoadmap();
    this.dedupeDuplicateTierGrants();
    this.ensureActiveCosmeticsValid();
    this.renamePrimaryIfDefault();
    const rolledOver = this.processDueRollovers();
    // A month boundary just crossed — if the new season has its own
    // scheduled curated table (see SEASONAL_REWARD_ROADMAPS), swap it into
    // the now-fully-upcoming tiers right away instead of waiting for the
    // next full page load. Idempotent, so re-running it here is safe.
    if (rolledOver) this.syncUpcomingTiersToCuratedRoadmap();
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
    const dg = this.state.dailyGames;
    if (!dg.removedBuiltInIds) dg.removedBuiltInIds = [];
    const existingIds = new Set(dg.configs.map((c) => c.id));
    // A built-in the user deliberately removed must NOT come back. Without
    // this check the additive backfill below — which is what delivers
    // newly-shipped built-ins to existing saves — would silently undo every
    // deletion on the next load. See DailyGamesState.removedBuiltInIds.
    const removed = new Set(dg.removedBuiltInIds);
    const seeds = defaultDailyGamesState().configs;
    for (const config of seeds) {
      if (existingIds.has(config.id) || removed.has(config.id)) continue;
      dg.configs.push(config);
    }
    // Built-in puzzles gained a `url` after they'd already shipped, so a save
    // that predates it has them without one. Backfill only where the field was
    // never set at all: a link the user explicitly cleared is stored as ""
    // (see setDailyGameUrl) and must stay cleared.
    const seedUrlById = new Map(seeds.map((c) => [c.id, c.url]));
    for (const config of dg.configs) {
      if (!config.builtIn || config.url !== undefined) continue;
      const seeded = seedUrlById.get(config.id);
      if (seeded) config.url = seeded;
    }
  }

  /** Seeds the BTS Season reward pack into the pool ahead of time — new
   * titles/avatars/a theme/an effect appended to their existing built-in
   * categories, plus brand-new Photocards and Stickers categories. See
   * defaults.ts for the item lists and BTS_SEASON_MONTH_KEY.
   *
   * Adding these to the pool does NOT grant, promise, or reveal anything by
   * itself — only SEASONAL_REWARD_ROADMAPS decides which season's roadmap
   * is active, and that only takes effect once the season actually rolls
   * over to that monthKey (see activeCuratedRoadmap). Must run before
   * ensureRewardRoadmap/syncUpcomingTiersToCuratedRoadmap so those see the
   * new items. Idempotent — only adds items not already present, matched
   * by id, so re-running this after the user has edited/deleted any of
   * them is safe (it won't resurrect a deleted one... unless the category
   * itself still exists and the specific item id is gone, in which case
   * treat that the same as any other user deletion: left alone). */
  private ensureBtsRewardPack(): void {
    const bp = this.state.battlepass;

    const titles = bp.categories.find((c) => c.id === "cat-titles");
    if (titles) {
      for (const t of BTS_NEW_TITLES) {
        if (titles.items.some((i) => i.id === t.id)) continue;
        titles.items.push({ id: t.id, categoryId: "cat-titles", name: t.name, flavorText: t.flavorText, rarity: t.rarity, kind: "unlock" });
      }
    }

    const avatars = bp.categories.find((c) => c.id === "cat-avatars");
    if (avatars) {
      for (const a of BTS_NEW_AVATARS) {
        if (avatars.items.some((i) => i.id === a.id)) continue;
        avatars.items.push({ id: a.id, categoryId: "cat-avatars", name: a.name, description: a.emoji, flavorText: a.flavorText, rarity: a.rarity, kind: "unlock" });
      }
    }

    const themes = bp.categories.find((c) => c.id === "cat-themes");
    if (themes && !themes.items.some((i) => i.id === BTS_NEW_THEME.id)) {
      themes.items.push({ id: BTS_NEW_THEME.id, categoryId: "cat-themes", name: BTS_NEW_THEME.name, flavorText: BTS_NEW_THEME.flavorText, rarity: BTS_NEW_THEME.rarity, kind: "unlock" });
    }

    const effects = bp.categories.find((c) => c.id === "cat-effects");
    if (effects) {
      for (const e of BTS_NEW_EFFECTS) {
        if (effects.items.some((i) => i.id === e.id)) continue;
        effects.items.push({ id: e.id, categoryId: "cat-effects", name: e.name, flavorText: e.flavorText, rarity: e.rarity, kind: "unlock" });
      }
    }

    if (!bp.categories.some((c) => c.id === "cat-photocards")) {
      bp.categories.push({
        id: "cat-photocards",
        name: "Photocards",
        description: "Surprise photocards — the photo stays hidden until you actually reach the tier that grants it. Browse unlocked ones in the Photocard Album.",
        builtIn: true,
        items: [],
      });
    }
    const photocards = bp.categories.find((c) => c.id === "cat-photocards")!;
    for (const p of BTS_NEW_PHOTOCARDS) {
      if (photocards.items.some((i) => i.id === p.id)) continue;
      photocards.items.push({ id: p.id, categoryId: "cat-photocards", name: p.name, flavorText: p.flavorText, rarity: p.rarity, kind: "unlock" });
    }

    if (!bp.categories.some((c) => c.id === "cat-stickers")) {
      bp.categories.push({
        id: "cat-stickers",
        name: "Stickers",
        description: "Decorations for the front of your Photocard Album.",
        builtIn: true,
        items: [],
      });
    }
    const stickers = bp.categories.find((c) => c.id === "cat-stickers")!;
    for (const s of BTS_NEW_STICKERS) {
      if (stickers.items.some((i) => i.id === s.id)) continue;
      stickers.items.push({ id: s.id, categoryId: "cat-stickers", name: s.name, description: s.emoji, flavorText: s.flavorText, rarity: s.rarity, kind: "unlock" });
    }
  }

  /** Backfills `photocardAlbum` for saves from before this feature shipped.
   * Idempotent. */
  private ensurePhotocardAlbum(): void {
    if (!this.state.photocardAlbum) {
      this.state.photocardAlbum = defaultPhotocardAlbum();
    }
  }

  /** Seeds the Study Season pack: the three new reward categories (Fonts,
   * Backgrounds, Checkbox Styles) plus September's themes, titles, avatars
   * and effects.
   *
   * Same additive contract as ensureBtsRewardPack — matched by id, only ever
   * adding what's missing, so it's safe on every load and never resurrects
   * something the user deleted (unless the whole category went with it, which
   * is treated like any other user deletion: left alone). Putting items in
   * the pool grants nothing by itself; only SEASONAL_REWARD_ROADMAPS decides
   * when they become reachable. Must run before ensureRewardRoadmap so
   * September's tiers can find them. */
  private ensureStudySeasonPack(): void {
    const bp = this.state.battlepass;

    const ensureCategory = (id: string, name: string, description: string) => {
      if (bp.categories.some((c) => c.id === id)) return;
      bp.categories.push({ id, name, description, builtIn: true, items: [] });
    };

    const seedInto = (categoryId: string, seeds: StudySeed[]) => {
      const cat = bp.categories.find((c) => c.id === categoryId);
      if (!cat) return;
      for (const seed of seeds) {
        if (cat.items.some((i) => i.id === seed.id)) continue;
        cat.items.push({
          id: seed.id,
          categoryId,
          name: seed.name,
          description: seed.description,
          flavorText: seed.flavorText,
          rarity: seed.rarity,
          kind: "unlock",
          colors: seed.colors,
          effectAnimation: seed.effectAnimation,
          fontFamily: seed.fontFamily,
          backgroundPattern: seed.backgroundPattern,
        });
      }
    };

    ensureCategory("cat-fonts", "Fonts", "The typeface the whole app is set in.");
    ensureCategory("cat-backgrounds", "Backgrounds", "A texture behind the cards. Layers under whichever theme you have on.");
    ensureCategory("cat-checkboxes", "Checkbox Styles", "The mark that lands when you complete a task.");

    seedInto("cat-fonts", STUDY_FONTS);
    seedInto("cat-backgrounds", STUDY_BACKGROUNDS);
    seedInto("cat-checkboxes", STUDY_CHECKBOXES);
    seedInto("cat-themes", STUDY_THEMES);
    seedInto("cat-avatars", STUDY_AVATARS);
    seedInto("cat-titles", STUDY_TITLES);
    seedInto("cat-effects", STUDY_EFFECTS);
  }

  /** Re-syncs the tier ladder when the current season's scheduled ladder
   * (see SEASONAL_TIERS) has changed length since the save last entered
   * that season — in either direction.
   *
   * processDueRollovers only swaps bp.tiers at a month BOUNDARY, so a save
   * that rolled into a scheduled season back when its ladder had 30 tiers
   * keeps a 30-tier ladder forever, even after the ladder is later extended
   * to 32. The Battlepass Tier Track renders straight from bp.tiers, so
   * those extra tiers — and the rewards curated for them — were invisible:
   * the roadmap promised rewards at tiers the user could never even see.
   * The reverse happens too: retiring the Streak Freeze and Wildcard
   * consumables freed two roadmap slots and brought August back down to 30
   * tiers, which would otherwise leave a save showing two trailing tiers
   * that no longer exist and can never grant anything.
   *
   * Only ever acts when one ladder is an exact prefix of the other. That
   * check is the safety catch: if the user has customized their thresholds
   * in Settings (see updateTiers), neither is a prefix of the other and we
   * leave the ladder completely alone rather than stomping their setup on
   * every page load. Shared tiers are never modified, so nothing already
   * reached shifts underneath the user. Idempotent.
   *
   * Must run before ensureRewardRoadmap so a newly-appended tier gets its
   * curated reward assigned in the same pass. */
  private ensureSeasonalTierLadder(): void {
    const bp = this.state.battlepass;
    const seasonal = SEASONAL_TIERS[bp.currentMonthKey];
    if (!seasonal) return;

    // A ladder the user edited in Settings is theirs, not a stale copy of the
    // season's — re-syncing it would delete tiers they deliberately added.
    if (bp.tiersCustomized) return;

    const current = [...bp.tiers].sort((a, b) => a.tier - b.tier);
    if (current.length === seasonal.length) return;

    const shorter = current.length < seasonal.length ? current : seasonal;
    const longer = current.length < seasonal.length ? seasonal : current;
    const isPrefix = shorter.every(
      (t, i) => longer[i] && t.tier === longer[i].tier && t.pointsRequired === longer[i].pointsRequired
    );
    if (!isPrefix) return;

    bp.tiers = seasonal.map((t) => ({ ...t }));

    // Shrinking: drop roadmap entries for tiers that no longer exist, and
    // don't leave currentTier pointing past the end of the ladder. Points
    // are never touched — the climb the user already did still counts, it
    // just tops out at the new final tier.
    const validTiers = new Set(bp.tiers.map((t) => t.tier));
    bp.rewardRoadmap = bp.rewardRoadmap.filter((r) => validTiers.has(r.tier));
    const highestTier = bp.tiers.length === 0 ? 0 : Math.max(...bp.tiers.map((t) => t.tier));
    if (bp.currentTier > highestTier) bp.currentTier = highestTier;
  }

  /** Retires the Streak Freeze and Wildcard consumables from an existing
   * save, and re-deals the current season as though they had never been
   * rewards at all.
   *
   * Both used to anchor a roadmap tier (August: Streak Freeze at 14,
   * Wildcard at 22). Removing them shifts every later reward up one, which
   * is fine for tiers still ahead of the user — syncUpcomingTiersToCuratedRoadmap
   * already re-syncs those — but NOT for tiers already reached. Someone
   * sitting at tier 25 earned a Wildcard at 22; under the new table tier 22
   * grants what tier 23 used to, tier 23 grants what 24 used to, and so on,
   * which means they're now owed two rewards they never received. Metro's
   * usual rule is that a reached tier keeps exactly what it granted, so
   * this is a deliberate, one-time exception: the shift has to reach
   * backwards or the user is simply short two rewards forever.
   *
   * Past seasons are left completely alone. Their tier numbers are a
   * historical record with no live roadmap to shift against, so re-dealing
   * them would mean inventing rewards rather than correcting them.
   *
   * Days already rescued by a Streak Freeze keep their `streakProtected`
   * flag (see DailyLogEntry) — the protection was legitimately earned at
   * the time, and clearing it would retroactively break streaks the user
   * actually has. Only the ability to earn or spend new tokens goes away.
   *
   * Gated on actually finding something to remove, so it runs once per
   * affected save and is a no-op on every load after that (and on fresh
   * installs, which never had the categories). */
  private removeConsumableRewards(): void {
    const bp = this.state.battlepass;
    const removedCategoryIds = new Set(["cat-streak-freeze", "cat-wildcard"]);
    const removedItemIds = new Set(["item-streak-freeze", "item-wildcard"]);
    let found = false;

    if (bp.categories.some((c) => removedCategoryIds.has(c.id))) {
      bp.categories = bp.categories.filter((c) => !removedCategoryIds.has(c.id));
      found = true;
    }
    for (const itemId of removedItemIds) {
      if (bp.inventory[itemId] !== undefined) {
        delete bp.inventory[itemId];
        found = true;
      }
    }
    const roadmapBefore = bp.rewardRoadmap.length;
    bp.rewardRoadmap = bp.rewardRoadmap.filter((r) => !removedItemIds.has(r.itemId));
    if (bp.rewardRoadmap.length !== roadmapBefore) found = true;

    // Capture when each tier was originally earned BEFORE dropping anything,
    // including the tiers whose grant was a token. Those tiers still happened
    // — the user hit tier 22 on some particular day — so the replacement
    // reward should carry that date rather than looking like it appeared the
    // moment they loaded this version.
    const originalTimestampByTier = new Map<number, string>();
    for (const u of bp.unlocked) {
      if (u.monthKey === bp.currentMonthKey) originalTimestampByTier.set(u.tier, u.unlockedAt);
    }

    // Only THIS season's token grants are dropped; past seasons keep theirs.
    const unlockedBefore = bp.unlocked.length;
    bp.unlocked = bp.unlocked.filter(
      (u) => !(u.monthKey === bp.currentMonthKey && removedItemIds.has(u.rewardId))
    );
    if (bp.unlocked.length !== unlockedBefore) found = true;

    if (!found) return;
    this.redealCurrentSeason(originalTimestampByTier);
  }

  /** Rebuilds the current season's roadmap AND its recorded grants from the
   * season's curated table, reached tiers included — the backwards half of
   * removeConsumableRewards.
   *
   * Deliberately a wholesale rebuild rather than an incremental patch. The
   * incremental machinery can't express this change: grantTierReward
   * refuses to hand out an 'unlock' item the user already owns, so after a
   * shift it would decline to re-grant at tier N an item currently recorded
   * at tier N+1, and the tier would end up empty. Re-dealing the whole
   * season sidesteps the ordering problem entirely — every reached tier
   * gets exactly what the new table says, each item appears once, and the
   * result doesn't depend on what order the corrections are applied in.
   *
   * Each tier keeps the timestamp of whatever was originally granted there,
   * so the history reads as though the user earned the shifted reward at
   * the moment they actually hit that tier — not as a pile of rewards that
   * all appeared the day they loaded this version. */
  private redealCurrentSeason(originalTimestampByTier: Map<number, string>): void {
    const bp = this.state.battlepass;
    const monthKey = bp.currentMonthKey;
    const curated = this.activeCuratedRoadmap();
    if (curated.length === 0) return;

    const lookup = (categoryId: string, itemId: string) => {
      const category = bp.categories.find((c) => c.id === categoryId);
      const item = category?.items.find((i) => i.id === itemId);
      return category && item ? { category, item } : null;
    };

    // 1. Re-point every tier at what the curated table now says, including
    //    tiers already reached.
    for (const entry of curated) {
      if (!lookup(entry.categoryId, entry.itemId)) continue;
      const idx = bp.rewardRoadmap.findIndex((r) => r.tier === entry.tier);
      if (idx === -1) bp.rewardRoadmap.push({ ...entry });
      else bp.rewardRoadmap[idx] = { ...entry };
    }
    const validTiers = new Set(bp.tiers.map((t) => t.tier));
    bp.rewardRoadmap = bp.rewardRoadmap.filter((r) => validTiers.has(r.tier));
    bp.rewardRoadmap.sort((a, b) => a.tier - b.tier);

    // 2. Rebuild this season's grants from that roadmap. Timestamps come from
    //    the caller, captured before any pruning — see removeConsumableRewards.
    // Anything this season contributed to a consumable stack is withdrawn
    // before the rebuild re-adds it, so counts can't drift upward.
    for (const u of bp.unlocked) {
      if (u.monthKey === monthKey && u.kind === "consumable") {
        bp.inventory[u.rewardId] = Math.max(0, (bp.inventory[u.rewardId] ?? 0) - 1);
      }
    }
    // An 'unlock' item earned in an EARLIER season is already owned for
    // good; re-granting it here would double it up, so those tiers are
    // skipped rather than duplicated (mirroring grantTierReward's guard).
    const ownedInPastSeasons = new Set(
      bp.unlocked.filter((u) => u.monthKey !== monthKey && u.kind === "unlock").map((u) => u.rewardId)
    );
    bp.unlocked = bp.unlocked.filter((u) => u.monthKey !== monthKey);

    const now = new Date().toISOString();
    for (const tierDef of [...bp.tiers].sort((a, b) => a.tier - b.tier)) {
      if (tierDef.tier > bp.currentTier) continue;
      const entry = bp.rewardRoadmap.find((r) => r.tier === tierDef.tier);
      if (!entry) continue;
      const found = lookup(entry.categoryId, entry.itemId);
      if (!found) continue;
      const { category, item } = found;
      if (item.kind === "unlock" && ownedInPastSeasons.has(item.id)) continue;

      bp.unlocked.push({
        tier: tierDef.tier,
        monthKey,
        rewardId: item.id,
        categoryId: item.categoryId,
        name: item.name,
        rarity: item.rarity,
        kind: item.kind,
        categoryName: category.name,
        unlockedAt: originalTimestampByTier.get(tierDef.tier) ?? now,
      });
      if (item.kind === "consumable") {
        bp.inventory[item.id] = (bp.inventory[item.id] ?? 0) + 1;
      }
    }
  }

  /** Which curated tier->reward table is "live" right now — the current
   * season's scheduled table (see SEASONAL_REWARD_ROADMAPS) if one exists
   * for bp.currentMonthKey, otherwise the evergreen DEFAULT_REWARD_ROADMAP.
   * Centralizing the lookup here is what lets a season like BTS August be
   * scheduled ahead of time without touching any other month's tiers. */
  private activeCuratedRoadmap(): RewardRoadmapEntry[] {
    return SEASONAL_REWARD_ROADMAPS[this.state.battlepass.currentMonthKey] ?? DEFAULT_REWARD_ROADMAP;
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

    // Photocards are only ever granted via an explicit curated roadmap
    // entry (see AUGUST_BTS_REWARD_ROADMAP), never as a generic
    // rarity-ordered filler for some unrelated tier — otherwise a
    // Photocard could leak into a season it was never scheduled for.
    const fallbackExcludeIds = new Set(usedItemIds);
    for (const cat of bp.categories) {
      if (cat.id !== "cat-photocards") continue;
      for (const item of cat.items) fallbackExcludeIds.add(item.id);
    }

    const curatedRoadmap = this.activeCuratedRoadmap();
    for (const tierDef of [...bp.tiers].sort((a, b) => a.tier - b.tier)) {
      if (assignedTiers.has(tierDef.tier)) continue;

      let categoryId: string | undefined;
      let itemId: string | undefined;
      const curated = curatedRoadmap.find(
        (r) => r.tier === tierDef.tier && !usedItemIds.has(r.itemId) && itemExists(r.categoryId, r.itemId)
      );
      if (curated) {
        categoryId = curated.categoryId;
        itemId = curated.itemId;
      } else {
        const next = nextRoadmapItem(bp.categories, fallbackExcludeIds);
        if (next) {
          categoryId = next.categoryId;
          itemId = next.itemId;
        }
      }
      if (!categoryId || !itemId) continue; // pool exhausted; tier gets no reward for now

      bp.rewardRoadmap.push({ tier: tierDef.tier, categoryId, itemId });
      usedItemIds.add(itemId);
      fallbackExcludeIds.add(itemId);
      assignedTiers.add(tierDef.tier);
    }
    bp.rewardRoadmap.sort((a, b) => a.tier - b.tier);
  }

  /** Re-applies the active curated roadmap (see activeCuratedRoadmap — the
   * current season's scheduled table if one exists, otherwise the evergreen
   * DEFAULT_REWARD_ROADMAP) to any tier that hasn't been reached yet, so a
   * deliberate design change (e.g. swapping which category a tier grants
   * from, or a season boundary swapping in a whole new table) takes effect
   * for tiers still ahead of you — without this, ensureRewardRoadmap's
   * "never change an assigned entry" stability guarantee would keep the OLD
   * curated pick forever, even after the curated table itself changes.
   * Tiers already reached always keep whatever they actually granted (never
   * revoked/reshuffled), and a curated pick is skipped if its item is
   * already owned some other way (an already-reached tier, or a legacy
   * grant) so nothing gets promised twice. Idempotent. */
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

    for (const curated of this.activeCuratedRoadmap()) {
      if (curated.tier <= bp.currentTier) continue; // already reached — never touch
      // A reward the user pinned to this tier outranks the curated table.
      if (bp.rewardRoadmap.find((r) => r.tier === curated.tier)?.manual) continue;
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

  /** Makes sure every tier you've already reached has ITS OWN
   * roadmap-assigned reward recorded in `bp.unlocked` — not just *some*
   * grant, the correct one. Two different situations land here, and this
   * covers both:
   *
   *  - a tier with ZERO grants recorded (a historical gap — the original
   *    "I should already have this but it's locked" report)
   *  - a tier whose only recorded grant predates the deterministic roadmap
   *    (e.g. a reward from the old random-roll system) and simply isn't
   *    what today's roadmap promises for that tier — an earlier version of
   *    this method only checked "does this tier have ANY grant", so it
   *    silently left these alone even though they don't match
   *
   * In both cases this ADDS the roadmap-correct grant — it never removes
   * anything itself. If that leaves a tier with two grants (the old
   * mismatched one plus the new correct one), dedupeDuplicateTierGrants —
   * which runs right after this — resolves it by keeping the roadmap
   * match and dropping the rest, correcting inventory for any dropped
   * consumable. A tier whose existing grant already matches the roadmap is
   * left completely untouched, so this is idempotent and safe on every
   * load. */
  private reconcileTierGrantsWithRoadmap(): void {
    const bp = this.state.battlepass;
    const roadmapItemIdByTier = new Map(bp.rewardRoadmap.map((r) => [r.tier, r.itemId]));
    for (const tierDef of bp.tiers) {
      if (tierDef.tier > bp.currentTier) continue;
      const roadmapItemId = roadmapItemIdByTier.get(tierDef.tier);
      if (!roadmapItemId) continue; // no roadmap assignment yet for this tier
      // Scoped to THIS season (monthKey) as well as the tier number — tier
      // numbers restart at 1 every month (see processDueRollovers), so tier 5
      // reached in July and tier 5 reached in August are two entirely
      // different grants, not the same one. Checking tier alone here used to
      // treat a past season's grant as already covering this season's tier,
      // which (combined with the same bug in dedupeDuplicateTierGrants right
      // below) silently deleted prior months' earned rewards the moment you
      // reached the same tier number again in a new season.
      const alreadyHasIt = bp.unlocked.some(
        (u) => u.tier === tierDef.tier && u.monthKey === bp.currentMonthKey && u.rewardId === roadmapItemId
      );
      if (alreadyHasIt) continue;
      this.grantTierReward(tierDef.tier, []);
    }
  }

  /** One-time-but-idempotent repair for a tier that ended up with more than
   * one grant recorded in `bp.unlocked`. Two different situations produce
   * this, and they need opposite tie-breaks:
   *
   *  1. A past bug that re-granted the same consumable repeatedly on every
   *     page load. Here every duplicate is identical, so which one
   *     survives doesn't matter.
   *  2. A tier whose *original* grant predates the deterministic roadmap
   *     (or predates a since-removed category like the old Badges), sitting
   *     alongside a *newer, correct* grant that reconcileTierGrantsWithRoadmap
   *     just added because the roadmap's assigned item for that tier was
   *     missing from history. Naively keeping "whichever grant is oldest"
   *     gets this backwards — it throws away the fix and keeps the stale
   *     reward.
   *
   * So the tie-break is: prefer whichever duplicate's reward matches this
   * tier's CURRENT roadmap assignment — that's the one the deterministic
   * system says you're actually owed — falling back to the earliest grant
   * only if none of the duplicates match the roadmap (e.g. the roadmap
   * itself later changed). Dropped consumable duplicates still get
   * subtracted back out of inventory; dropped 'unlock' kind duplicates need
   * no further cleanup since they never touched inventory. No-op for any
   * tier that only ever had one grant (the common case).
   *
   * IMPORTANT: grouped by (monthKey, tier) together, NOT tier alone. Tier
   * numbers restart at 1 every season (see processDueRollovers), so reaching
   * tier 5 in July and tier 5 again in August produces two legitimately
   * separate grants, often for two completely different items. Grouping by
   * tier only used to treat those as duplicates of each other and silently
   * drop whichever one didn't match the CURRENT season's roadmap — meaning
   * a reward earned in a past season could vanish the moment you reached
   * the same tier number again in a new one. Only the current season's
   * duplicates are compared against today's live roadmap; a past season's
   * duplicates (a leftover from that historical bug) fall back to keeping
   * the earliest grant, since that season's roadmap may no longer be
   * around to check against. */
  private dedupeDuplicateTierGrants(): void {
    const bp = this.state.battlepass;
    const roadmapItemIdByTier = new Map(bp.rewardRoadmap.map((r) => [r.tier, r.itemId]));
    const byMonthAndTier = new Map<string, UnlockedReward[]>();
    for (const u of bp.unlocked) {
      const key = `${u.monthKey}::${u.tier}`;
      const list = byMonthAndTier.get(key);
      if (list) list.push(u);
      else byMonthAndTier.set(key, [u]);
    }

    const kept: UnlockedReward[] = [];
    const extraCopiesByItemId = new Map<string, number>();

    for (const entries of byMonthAndTier.values()) {
      if (entries.length === 1) {
        kept.push(entries[0]);
        continue;
      }
      const sorted = [...entries].sort((a, b) => (a.unlockedAt < b.unlockedAt ? -1 : 1));
      const roadmapItemId = entries[0].monthKey === bp.currentMonthKey ? roadmapItemIdByTier.get(entries[0].tier) : undefined;
      const winner = sorted.find((e) => e.rewardId === roadmapItemId) ?? sorted[0];
      kept.push(winner);
      for (const e of entries) {
        if (e === winner) continue;
        if (e.kind === "consumable") {
          extraCopiesByItemId.set(e.rewardId, (extraCopiesByItemId.get(e.rewardId) ?? 0) + 1);
        }
      }
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

  /** Whether a reward has ever been granted to you at all, regardless of
   * kind. Broader than isRewardEarned (which only covers 'unlock' kind
   * items, for the equip-eligibility check): this also covers consumables
   * (a user-added consumable reward), where "owned" means "granted at least
   * once" rather than "currently equipped" — a consumable stays visible in
   * your Inventory even after your stock of it drops to 0 from spending. */
  hasBeenGranted(categoryId: string, itemId: string): boolean {
    return this.state.battlepass.unlocked.some((u) => u.categoryId === categoryId && u.rewardId === itemId);
  }

  /** Idempotent safety check: if your currently-equipped theme/avatar/
   * title/effect ever stops being valid (e.g. its item was deleted from
   * the reward pool while equipped), fall back to the default/none rather
   * than leaving a dangling selection. Since eligibility is now always
   * checked live via isRewardEarned, this can't drift — it only ever needs
   * to catch the pool-changed-out-from-under-you case. */
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
    if (s.activeEffectId && !this.isRewardEarned("cat-effects", s.activeEffectId)) {
      s.activeEffectId = null;
    }
    // The three Study Season slots. Also normalises a save from before they
    // existed, where the fields are absent rather than null.
    if (s.activeFontId && !this.isRewardEarned("cat-fonts", s.activeFontId)) s.activeFontId = null;
    if (s.activeBackgroundId && !this.isRewardEarned("cat-backgrounds", s.activeBackgroundId)) s.activeBackgroundId = null;
    if (s.activeCheckboxId && !this.isRewardEarned("cat-checkboxes", s.activeCheckboxId)) s.activeCheckboxId = null;
    if (s.activeFontId === undefined) s.activeFontId = null;
    if (s.activeBackgroundId === undefined) s.activeBackgroundId = null;
    if (s.activeCheckboxId === undefined) s.activeCheckboxId = null;
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
    if (changed) {
      // Same reasoning as the constructor — a season boundary crossed
      // while the app was open, so re-sync in case the new month has its
      // own scheduled roadmap.
      this.syncUpcomingTiersToCuratedRoadmap();
      this.emit();
    }
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

      // If the new season has its own scheduled tier ladder (see
      // SEASONAL_TIERS), swap it in — snapshotting the user's current
      // ladder into `baselineTiers` first (only if not already snapshotted,
      // so hopping between two scheduled seasons back-to-back doesn't
      // overwrite the ORIGINAL custom ladder with an intermediate seasonal
      // one). If the new month has no scheduled ladder but a snapshot
      // exists from a previous season, restore it so a custom Settings
      // tier setup isn't lost. Otherwise leave `bp.tiers` untouched
      // entirely — this preserves current behavior for all ordinary months.
      const seasonalTiers = SEASONAL_TIERS[monthKey];
      if (seasonalTiers) {
        if (!bp.baselineTiers) {
          bp.baselineTiers = bp.tiers.map((t) => ({ ...t }));
        }
        bp.tiers = seasonalTiers.map((t) => ({ ...t }));
        // The ladder now in place is the season's, not the user's edit, so
        // it's free to re-sync again until they edit this one too.
        bp.tiersCustomized = undefined;
      } else if (bp.baselineTiers) {
        bp.tiers = bp.baselineTiers.map((t) => ({ ...t }));
        bp.baselineTiers = undefined;
      }

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

  /** null means "use the built-in default confetti burst" — always
   * allowed, since that's the celebration everyone gets before earning
   * anything. Any specific effect id must actually be earned first. */
  /** Equips a Font, Background or Checkbox Style. null means "Metro's
   * built-in look" for that slot — the app had a typeface, a plain ground and
   * a checkmark long before these were earnable, and null restores exactly
   * that rather than leaving the slot empty. */
  setActiveFont(fontId: string | null): void {
    // Refuses anything not actually earned, matching setActiveEffect — the UI
    // only offers Equip on owned rewards, but the guard belongs on the store
    // so an unearned reward can't be equipped by any other route either.
    if (fontId && !this.isRewardEarned("cat-fonts", fontId)) return;
    this.state.settings.activeFontId = fontId;
    this.emit();
  }

  setActiveBackground(backgroundId: string | null): void {
    if (backgroundId && !this.isRewardEarned("cat-backgrounds", backgroundId)) return;
    this.state.settings.activeBackgroundId = backgroundId;
    this.emit();
  }

  setActiveCheckbox(checkboxId: string | null): void {
    if (checkboxId && !this.isRewardEarned("cat-checkboxes", checkboxId)) return;
    this.state.settings.activeCheckboxId = checkboxId;
    this.emit();
  }

  setActiveEffect(effectId: string | null): void {
    if (effectId && !this.isRewardEarned("cat-effects", effectId)) return;
    this.state.settings.activeEffectId = effectId;
    this.emit();
  }

  updatePointsConfig(config: PointsConfig): void {
    this.state.settings.pointsConfig = { ...config };
    this.emit();
  }

  updateTiers(tiers: Tier[]): void {
    const sorted = [...tiers].sort((a, b) => a.tier - b.tier);
    this.state.battlepass.tiers = sorted;
    // Marks the ladder as the user's own, so ensureSeasonalTierLadder stops
    // treating it as a stale copy of the season's and resetting it.
    this.state.battlepass.tiersCustomized = true;
    this.pruneOrphanedRoadmapEntries();
    this.ensureRewardRoadmap();
    this.emit();
  }

  /** Drops roadmap entries pointing at tiers that no longer exist.
   *
   * Shortening the ladder used to leave the removed tier's entry behind, and
   * because setTierReward refuses an item already promised somewhere else,
   * that dead entry made its reward permanently unassignable: the tier was
   * gone from every screen, but the reward it held was still spoken for. The
   * only way out was to invent a replacement reward, which is how a pool
   * fills up with near-identical Photocards nobody remembers creating.
   *
   * Runs on load as well as after every ladder edit, so a save already
   * carrying orphans from that bug repairs itself and frees the rewards.
   * Idempotent. */
  private pruneOrphanedRoadmapEntries(): void {
    const bp = this.state.battlepass;
    const liveTiers = new Set(bp.tiers.map((t) => t.tier));
    bp.rewardRoadmap = bp.rewardRoadmap.filter((r) => liveTiers.has(r.tier));
  }

  /** Removes one tier and renumbers what's left, carrying each surviving
   * tier's reward with it.
   *
   * The renumbering is the reason this exists rather than the caller just
   * filtering and calling updateTiers: tier numbers are positional, so
   * deleting tier 25 turns 26 into 25, 27 into 26 and so on — but the roadmap
   * is keyed by that same number, so without remapping, every reward above
   * the deleted tier would silently shift down onto the wrong tier.
   *
   * Refuses a tier already reached; its reward was really granted, and
   * renumbering underneath a recorded grant would desynchronise history.
   * Since only tiers above currentTier can go, the reached ones keep their
   * numbers and their `unlocked` records stay aligned. */
  removeTier(tier: number): boolean {
    const bp = this.state.battlepass;
    if (tier <= bp.currentTier) return false;
    if (!bp.tiers.some((t) => t.tier === tier)) return false;

    const ordered = [...bp.tiers].sort((a, b) => a.tier - b.tier);
    const entryByTier = new Map(bp.rewardRoadmap.map((r) => [r.tier, r]));
    const remaining = ordered.filter((t) => t.tier !== tier);

    const nextRoadmap: RewardRoadmapEntry[] = [];
    remaining.forEach((t, i) => {
      const entry = entryByTier.get(t.tier);
      if (entry) nextRoadmap.push({ ...entry, tier: i + 1 });
    });

    bp.tiers = remaining.map((t, i) => ({ tier: i + 1, pointsRequired: t.pointsRequired }));
    bp.rewardRoadmap = nextRoadmap.sort((a, b) => a.tier - b.tier);
    bp.tiersCustomized = true;
    this.ensureRewardRoadmap();
    this.emit();
    return true;
  }

  /** Which tier currently promises this reward, or null if none does. Lets
   * the Reward Pool show where each item is actually used — and, just as
   * usefully, which items are spoken for by nothing at all. */
  roadmapTierForItem(itemId: string): number | null {
    return this.state.battlepass.rewardRoadmap.find((r) => r.itemId === itemId)?.tier ?? null;
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
  /** The six DC checklists, in display order. Order comes from their relative
   * positions in `state.checklists` rather than from TRIAL_SLOT_IDS, so the
   * user can rearrange them (see reorderTrialChecklists) — the slot ids stay
   * fixed as identity, they just no longer dictate the running order. */
  getTrialChecklists(): Checklist[] {
    return this.state.checklists.filter((c) => isTrialChecklistId(c.id));
  }

  /** Rearranges the DC checklists to match `orderedIds`.
   *
   * Only the positions that already held a trial checklist are rewritten, so
   * the primary daily checklist and any user-created lists stay exactly where
   * they are in `state.checklists` — the same approach reorderTasks uses to
   * avoid disturbing rows it isn't reordering. Any trial missing from
   * `orderedIds` keeps its place at the end rather than vanishing. */
  reorderTrialChecklists(orderedIds: string[]): void {
    const slots: number[] = [];
    this.state.checklists.forEach((c, i) => {
      if (isTrialChecklistId(c.id)) slots.push(i);
    });
    if (slots.length === 0) return;

    const trials = slots.map((i) => this.state.checklists[i]);
    const byId = new Map(trials.map((c) => [c.id, c]));
    const reordered: Checklist[] = [];
    for (const id of orderedIds) {
      const cl = byId.get(id);
      if (cl && !reordered.includes(cl)) reordered.push(cl);
    }
    for (const cl of trials) {
      if (!reordered.includes(cl)) reordered.push(cl);
    }
    if (reordered.every((c, i) => c === trials[i])) return;

    slots.forEach((slotIndex, i) => {
      this.state.checklists[slotIndex] = reordered[i];
    });
    this.emit();
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
   * without one — this new item becomes available to fill it in.
   * `imageDataUrl` is only meaningful for Photocards — see
   * setRewardItemImage for the hidden-until-owned guarantee. */
  /** Adds an item to a reward category and returns it, so a caller that
   * just created a reward can immediately pin it to a tier (see
   * setTierReward) without having to go hunting for it by name.
   *
   * `extras` carries the fields only some categories use — a Photocard's
   * photo, a Theme's colour pair, a Celebration Effect's animation choice —
   * rather than growing the positional argument list once per category. */
  addRewardItem(
    categoryId: string,
    name: string,
    rarity: Rarity,
    kind: RewardKind,
    description = "",
    extras: RewardExtras = {}
  ): RewardItem | null {
    const cat = this.state.battlepass.categories.find((c) => c.id === categoryId);
    if (!cat || !name.trim()) return null;
    const item: RewardItem = {
      id: makeId("reward"),
      categoryId,
      name: name.trim(),
      description: description.trim() || undefined,
      imageDataUrl: extras.imageDataUrl,
      colors: extras.colors,
      effectAnimation: extras.effectAnimation,
      fontFamily: extras.fontFamily,
      backgroundPattern: extras.backgroundPattern,
      rarity,
      kind,
    };
    cat.items.push(item);
    this.ensureRewardRoadmap();
    this.emit();
    return item;
  }

  /** Pins a specific reward to a specific tier, overriding whatever the
   * automatic assignment picked.
   *
   * Refuses in three cases, each returning a reason the caller can show:
   *  - the tier has already been reached, since changing it would rewrite
   *    what the user was actually granted;
   *  - the item is already promised to a different tier, or already owned,
   *    which would mean earning the same one-time unlock twice;
   *  - the tier or item simply doesn't exist.
   *
   * The entry is flagged `manual` so a curated seasonal table can't quietly
   * overwrite it on the next load. */
  setTierReward(tier: number, categoryId: string, itemId: string): { ok: true } | { ok: false; error: string } {
    const bp = this.state.battlepass;
    if (!bp.tiers.some((t) => t.tier === tier)) return { ok: false, error: "That tier doesn't exist." };
    if (tier <= bp.currentTier) {
      return { ok: false, error: "You've already reached that tier — its reward is locked in." };
    }
    const category = bp.categories.find((c) => c.id === categoryId);
    const item = category?.items.find((i) => i.id === itemId);
    if (!category || !item) return { ok: false, error: "That reward isn't in the pool any more." };

    if (item.kind === "unlock") {
      if (bp.unlocked.some((u) => u.rewardId === itemId)) {
        return { ok: false, error: `You already own ${item.name}.` };
      }
      const clash = bp.rewardRoadmap.find((r) => r.itemId === itemId && r.tier !== tier);
      if (clash) {
        return { ok: false, error: `${item.name} is already promised at tier ${clash.tier}.` };
      }
    }

    const idx = bp.rewardRoadmap.findIndex((r) => r.tier === tier);
    const entry: RewardRoadmapEntry = { tier, categoryId, itemId, manual: true };
    if (idx === -1) bp.rewardRoadmap.push(entry);
    else bp.rewardRoadmap[idx] = entry;
    bp.rewardRoadmap.sort((a, b) => a.tier - b.tier);
    this.emit();
    return { ok: true };
  }

  /** Hands a tier back to automatic assignment: drops the pinned entry and
   * lets ensureRewardRoadmap refill it (from the season's curated table if
   * one covers that tier, otherwise the next lowest-rarity unused item).
   * A tier already reached is left alone. */
  clearTierReward(tier: number): void {
    const bp = this.state.battlepass;
    if (tier <= bp.currentTier) return;
    const before = bp.rewardRoadmap.length;
    bp.rewardRoadmap = bp.rewardRoadmap.filter((r) => r.tier !== tier);
    if (bp.rewardRoadmap.length === before) return;
    this.ensureRewardRoadmap();
    this.syncUpcomingTiersToCuratedRoadmap();
    this.emit();
  }

  /** Appends a tier at `pointsRequired` and returns its number, so the
   * caller can immediately assign it a reward. Kept separate from
   * updateTiers (which rewrites the whole ladder from the editor's working
   * copy) because adding one tier shouldn't require restating every other. */
  addTier(pointsRequired: number): number | null {
    if (!Number.isFinite(pointsRequired) || pointsRequired < 0) return null;
    const bp = this.state.battlepass;
    const tiers = [...bp.tiers, { tier: 0, pointsRequired: Math.round(pointsRequired) }]
      .sort((a, b) => a.pointsRequired - b.pointsRequired)
      .map((t, i) => ({ ...t, tier: i + 1 }));
    bp.tiers = tiers;
    bp.tiersCustomized = true;
    const added = tiers.find((t) => t.pointsRequired === Math.round(pointsRequired));
    this.ensureRewardRoadmap();
    this.emit();
    return added ? added.tier : null;
  }

  /** Attaches (or clears, with `null`) the photo on an existing reward
   * item — lets a Photocard's image be uploaded any time, independent of
   * when the item itself was created (e.g. well before its tier is ever
   * reached). Doesn't reveal anything on its own: the image only renders
   * anywhere the caller has confirmed the item is actually owned — see
   * rewardVisual's `revealed` option. */
  setRewardItemImage(categoryId: string, itemId: string, imageDataUrl: string | null): void {
    const item = this.state.battlepass.categories.find((c) => c.id === categoryId)?.items.find((i) => i.id === itemId);
    if (!item) return;
    item.imageDataUrl = imageDataUrl ?? undefined;
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
  // Photocard Album
  // ---------------------------------------------------------------------

  /** All Photocards actually owned, in pool order — this is the ONLY list
   * the Photocard Album page should ever render from, since it's already
   * filtered to owned items (a locked Photocard should never appear here,
   * mirroring the same hidden-until-owned guarantee rewardVisual enforces
   * for the image itself). */
  getOwnedPhotocards(): RewardItem[] {
    const cat = this.state.battlepass.categories.find((c) => c.id === "cat-photocards");
    if (!cat) return [];
    const ownedIds = new Set(this.getUnlockedItemIds("cat-photocards"));
    return cat.items.filter((i) => ownedIds.has(i.id));
  }

  /** All Stickers actually owned, in pool order — feeds the Photocard
   * Album's sticker tray (owned-but-not-yet-placed ones show up there). */
  getOwnedStickers(): RewardItem[] {
    const cat = this.state.battlepass.categories.find((c) => c.id === "cat-stickers");
    if (!cat) return [];
    const ownedIds = new Set(this.getUnlockedItemIds("cat-stickers"));
    return cat.items.filter((i) => ownedIds.has(i.id));
  }

  /** Stickers currently placed on the Photocard Album's front cover, with
   * their persisted position/rotation. */
  getCoverStickers(): PlacedSticker[] {
    return this.state.photocardAlbum.coverStickers;
  }

  /** Moves an owned-but-unplaced sticker onto the album cover at a random
   * spot, so decorating the cover feels a bit like actually sticking
   * something onto a binder rather than snapping to a grid. No-ops (and
   * returns false) if the sticker isn't owned or is already placed.
   * Position/rotation are picked once and then persisted, not re-rolled on
   * every render. */
  placeStickerOnCover(itemId: string): boolean {
    if (!this.isRewardEarned("cat-stickers", itemId)) return false;
    const album = this.state.photocardAlbum;
    if (album.coverStickers.some((s) => s.itemId === itemId)) return false;
    album.coverStickers.push({
      itemId,
      xPct: 10 + Math.random() * 80,
      yPct: 10 + Math.random() * 80,
      rotationDeg: -25 + Math.random() * 50,
    });
    this.emit();
    return true;
  }

  /** Peels a sticker back off the cover — it stays owned and returns to the
   * sticker tray, ready to be placed again (possibly somewhere new). */
  removeStickerFromCover(itemId: string): void {
    const album = this.state.photocardAlbum;
    const before = album.coverStickers.length;
    album.coverStickers = album.coverStickers.filter((s) => s.itemId !== itemId);
    if (album.coverStickers.length !== before) this.emit();
  }

  // ---------------------------------------------------------------------
  // Daily Puzzles
  // ---------------------------------------------------------------------

  /** Every configured puzzle, hidden ones included, in display order. This is
   * the list the manage UI works from; the daily logging list wants
   * getVisibleDailyGames instead. */
  getDailyGames(): DailyGameConfig[] {
    return this.state.dailyGames.configs;
  }

  /** Just the puzzles to actually show for logging today. */
  getVisibleDailyGames(): DailyGameConfig[] {
    return this.state.dailyGames.configs.filter((c) => !c.hidden);
  }

  /** Sets (or clears) the link for a puzzle. Returns false if the text isn't
   * a usable http(s) address, so the caller can say so rather than silently
   * dropping it; clearing with an empty string always succeeds. */
  setDailyGameUrl(gameId: string, url: string): boolean {
    const config = this.state.dailyGames.configs.find((c) => c.id === gameId);
    if (!config) return false;
    if (!url.trim()) {
      // Cleared is stored as "" rather than undefined, so it stays
      // distinguishable from "never had one" — that's what stops
      // ensureDailyGames from helpfully putting the seeded link back on a
      // built-in the user deliberately emptied.
      if (config.url === "") return true;
      config.url = "";
      this.emit();
      return true;
    }
    const normalized = normalizeGameUrl(url);
    if (!normalized) return false;
    if (config.url === normalized) return true;
    config.url = normalized;
    this.emit();
    return true;
  }

  /** Hides or unhides a puzzle. Nothing is deleted — its logged days and
   * Personal Record stay exactly where they are, so unhiding restores the
   * puzzle complete with its history. */
  setDailyGameHidden(gameId: string, hidden: boolean): void {
    const config = this.state.dailyGames.configs.find((c) => c.id === gameId);
    if (!config || !!config.hidden === hidden) return;
    config.hidden = hidden;
    this.emit();
  }

  /** Reorders the puzzle list to match `orderedIds`. Any configured puzzle
   * missing from that list keeps its relative position at the end rather than
   * being dropped — a reorder should never be able to lose a puzzle, even if
   * the caller passes a stale or partial list. */
  reorderDailyGames(orderedIds: string[]): void {
    const dg = this.state.dailyGames;
    const byId = new Map(dg.configs.map((c) => [c.id, c]));
    const reordered: DailyGameConfig[] = [];
    for (const id of orderedIds) {
      const config = byId.get(id);
      if (config && !reordered.includes(config)) reordered.push(config);
    }
    for (const config of dg.configs) {
      if (!reordered.includes(config)) reordered.push(config);
    }
    if (reordered.every((c, i) => c === dg.configs[i])) return;
    dg.configs = reordered;
    this.emit();
  }

  getDailyGameEntry(gameId: string, date: string): DailyGameEntry | undefined {
    return findDailyGameEntry(this.state.dailyGames, gameId, date);
  }

  /** Migrates an existing save to the current shared point range.
   *
   * The range moved from 10-50 to 0-100 (see DAILY_GAME_MIN/MAX_POINTS), and
   * every already-logged day was scored on the old one, with those points
   * already banked in season and lifetime totals. Rather than leave history
   * on a mix of scales, each entry is rescored and the difference is applied
   * to the totals.
   *
   * The season/lifetime split matters: `entries` spans every month, but
   * `seasonPoints` only covers the current one. So the delta from entries
   * dated inside the current season goes through awardPoints — which credits
   * both totals and grants any tier the extra points now reach — while the
   * rest only adjusts lifetimePoints. Crediting the whole delta to
   * seasonPoints would hand this season points earned back in July.
   *
   * Gated on the stored range so it runs once per save and is a no-op
   * afterwards (and on fresh installs, seeded at the new range already).
   *
   * Runs after the roadmap is built, since awardPoints may need to grant a
   * tier reward. */
  private rescaleDailyGamePoints(): void {
    const dg = this.state.dailyGames;
    if (dg.minPoints === DAILY_GAME_MIN_POINTS && dg.maxPoints === DAILY_GAME_MAX_POINTS) return;

    dg.minPoints = DAILY_GAME_MIN_POINTS;
    dg.maxPoints = DAILY_GAME_MAX_POINTS;

    const configById = new Map(dg.configs.map((c) => [c.id, c]));
    const bp = this.state.battlepass;
    let seasonDelta = 0;
    let lifetimeDelta = 0;

    for (const entry of dg.entries) {
      const config = configById.get(entry.gameId);
      if (!config) continue; // no config to rescore against; leave it alone
      const before = entry.pointsAwarded;
      const after = computeDailyGamePoints(config, entry, dg);
      if (after === before) continue;
      entry.pointsAwarded = after;
      lifetimeDelta += after - before;
      // entry.date is YYYY-MM-DD, so its first 7 characters are its monthKey.
      if (entry.date.slice(0, 7) === bp.currentMonthKey) seasonDelta += after - before;
    }

    const lifetimeOnly = lifetimeDelta - seasonDelta;
    if (lifetimeOnly !== 0) {
      bp.lifetimePoints = Math.max(0, bp.lifetimePoints + lifetimeOnly);
    }
    if (seasonDelta > 0) this.awardPoints(seasonDelta, [], []);
    else if (seasonDelta < 0) this.revokePoints(-seasonDelta);
  }

  /** Adds a user-defined puzzle to the Daily Puzzles list. Returns null (and
   * changes nothing) if the name is blank or already taken — the caller shows
   * the reason, since a silently-ignored submit is worse than a message.
   * Name matching is case-insensitive so "wordle" can't shadow "Wordle". */
  addDailyGame(name: string, scoring: DailyGameScoring, url?: string): DailyGameConfig | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const dg = this.state.dailyGames;
    if (dg.configs.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())) return null;

    const config: DailyGameConfig = {
      id: makeId("game"),
      name: trimmed,
      scoring,
      builtIn: false,
      createdAt: new Date().toISOString(),
      url: url ? normalizeGameUrl(url) ?? undefined : undefined,
    };
    dg.configs.push(config);
    this.emit();
    return config;
  }

  /** Removes a puzzle and its logged history, keeping every Battlepass point
   * it ever awarded.
   *
   * Points are deliberately NOT revoked here, unlike deleting a task. A task
   * is a thing you did today; a puzzle is a fixture you've been logging for
   * weeks or months, so revoking its points could yank the season back below
   * tiers already reached and rewards already celebrated. Metro's points are
   * additive by design, and "I don't play this one anymore" shouldn't read as
   * "none of those mornings counted".
   *
   * Removing a built-in also records a tombstone so ensureDailyGames doesn't
   * re-add it on the next load. Returns false if there was no such puzzle. */
  removeDailyGame(gameId: string): boolean {
    const dg = this.state.dailyGames;
    const config = dg.configs.find((c) => c.id === gameId);
    if (!config) return false;

    dg.configs = dg.configs.filter((c) => c.id !== gameId);
    dg.entries = dg.entries.filter((e) => e.gameId !== gameId);
    if (config.builtIn) {
      if (!dg.removedBuiltInIds) dg.removedBuiltInIds = [];
      if (!dg.removedBuiltInIds.includes(gameId)) dg.removedBuiltInIds.push(gameId);
    }
    this.emit();
    return true;
  }

  /** The best score ever recorded for a game, in points — or null if it's
   * never been logged. See bestDailyGameScore for how "best" is defined. */
  getBestDailyGameScore(gameId: string): number | null {
    return bestDailyGameScore(this.state.dailyGames, gameId);
  }

  /** The single best-performing entry ever recorded for a game, or null if
   * it's never been logged. Use this (plus formatDailyGameRawValue) to show
   * the actual value the user entered — a guess count, a raw score, a
   * time, an under-par pair — rather than the points it earned. */
  getBestDailyGameEntry(gameId: string): DailyGameEntry | null {
    const config = this.state.dailyGames.configs.find((c) => c.id === gameId);
    if (!config) return null;
    return bestDailyGameEntry(this.state.dailyGames, config);
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
      this.ensurePhotocardAlbum();
      this.ensureSeasonalTierLadder();
      this.pruneOrphanedRoadmapEntries();
      this.ensureBtsRewardPack();
      this.ensureStudySeasonPack();
      this.removeConsumableRewards();
      this.ensureRewardRoadmap();
      this.syncUpcomingTiersToCuratedRoadmap();
      this.rescaleDailyGamePoints();
      this.removeBadgesCategory();
      this.reconcileTierGrantsWithRoadmap();
      this.dedupeDuplicateTierGrants();
      this.ensureActiveCosmeticsValid();
      this.renamePrimaryIfDefault();
      const rolledOver = this.processDueRollovers();
      if (rolledOver) this.syncUpcomingTiersToCuratedRoadmap();
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
