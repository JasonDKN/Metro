// ============================================================================
// Default content: starting points config, battlepass tiers, and the seed
// reward pool. All of this is editable/extendable at runtime from Settings —
// nothing here is hardcoded into the logic, it's just the initial state for
// a brand-new install.
// ============================================================================

import type { PointsConfig, Rarity, RewardCategory, RewardRoadmapEntry, Tier, Settings } from "../types.js";

export const DEFAULT_POINTS_CONFIG: PointsConfig = {
  1: 5, // Easy
  2: 10, // Medium
  3: 20, // Hard
  4: 35, // Very Hard
  5: 50, // Extreme
};

/** Cumulative season points required to reach each tier. Feel free to edit
 * these in Settings — the array just needs to stay sorted ascending. */
export const DEFAULT_TIERS: Tier[] = [
  { tier: 1, pointsRequired: 50 },
  { tier: 2, pointsRequired: 120 },
  { tier: 3, pointsRequired: 200 },
  { tier: 4, pointsRequired: 300 },
  { tier: 5, pointsRequired: 420 },
  { tier: 6, pointsRequired: 560 },
  { tier: 7, pointsRequired: 720 },
  { tier: 8, pointsRequired: 900 },
  { tier: 9, pointsRequired: 1100 },
  { tier: 10, pointsRequired: 1320 },
  { tier: 11, pointsRequired: 1560 },
  { tier: 12, pointsRequired: 1820 },
  { tier: 13, pointsRequired: 2100 },
  { tier: 14, pointsRequired: 2400 },
  { tier: 15, pointsRequired: 2720 },
];

/** The curated, deterministic tier -> reward assignments for tiers 1-15 —
 * strictly ascending rarity (common through legendary), so what you'll earn
 * at each tier is knowable in advance rather than randomly rolled. Item ids
 * reference the built-in categories below. If a tier from here is ever
 * unreachable (its item was deleted, or the roadmap already used that item
 * for an earlier tier), Store.ensureRewardRoadmap falls back to the next
 * lowest-rarity item still available — and any tier beyond 15 (added later
 * in Settings) is assigned the same way. */
export const DEFAULT_REWARD_ROADMAP: RewardRoadmapEntry[] = [
  { tier: 1, categoryId: "cat-themes", itemId: "theme-sunset" },
  { tier: 2, categoryId: "cat-avatars", itemId: "avatar-owl" },
  { tier: 3, categoryId: "cat-titles", itemId: "title-rookie" },
  { tier: 4, categoryId: "cat-effects", itemId: "effect-confetti" },
  { tier: 5, categoryId: "cat-streak-freeze", itemId: "item-streak-freeze" },
  { tier: 6, categoryId: "cat-effects", itemId: "effect-fireworks" },
  { tier: 7, categoryId: "cat-avatars", itemId: "avatar-fox" },
  { tier: 8, categoryId: "cat-titles", itemId: "title-taskmaster" },
  { tier: 9, categoryId: "cat-wildcard", itemId: "item-wildcard" },
  { tier: 10, categoryId: "cat-themes", itemId: "theme-neon" },
  { tier: 11, categoryId: "cat-avatars", itemId: "avatar-star" },
  { tier: 12, categoryId: "cat-titles", itemId: "title-pro" },
  { tier: 13, categoryId: "cat-themes", itemId: "theme-sakura" },
  { tier: 14, categoryId: "cat-avatars", itemId: "avatar-dragon" },
  { tier: 15, categoryId: "cat-themes", itemId: "theme-aurora" },
];

export const DEFAULT_THEME_ID = "theme-default";
export const DEFAULT_AVATAR_ID = "avatar-default";

export const BUILT_IN_THEMES: { id: string; name: string }[] = [
  { id: "theme-default", name: "Metro Classic" },
];

export const BUILT_IN_AVATARS: { id: string; name: string; emoji: string }[] = [
  { id: "avatar-default", name: "Compass", emoji: "\u{1F9ED}" },
];

export function defaultSettings(): Settings {
  return {
    assistantName: "Metro",
    activeThemeId: DEFAULT_THEME_ID,
    activeAvatarId: DEFAULT_AVATAR_ID,
    activeTitleId: null,
    activeEffectId: null,
    pointsConfig: { ...DEFAULT_POINTS_CONFIG },
  };
}

/** Seed reward categories. `builtIn: true` just means the category itself
 * can't be deleted from Settings (its items can still grow over time) — the
 * user can always add brand-new categories alongside these. */
export function defaultRewardCategories(): RewardCategory[] {
  return [
    {
      id: "cat-themes",
      name: "Themes",
      description: "Unlockable color themes for the whole app.",
      builtIn: true,
      items: [
        { id: "theme-sunset", categoryId: "cat-themes", name: "Sunset", rarity: "common", kind: "unlock" },
        { id: "theme-forest", categoryId: "cat-themes", name: "Forest", rarity: "common", kind: "unlock" },
        { id: "theme-midnight", categoryId: "cat-themes", name: "Midnight", rarity: "uncommon", kind: "unlock" },
        { id: "theme-ocean", categoryId: "cat-themes", name: "Ocean", rarity: "uncommon", kind: "unlock" },
        { id: "theme-neon", categoryId: "cat-themes", name: "Neon", rarity: "rare", kind: "unlock" },
        { id: "theme-sakura", categoryId: "cat-themes", name: "Sakura", rarity: "epic", kind: "unlock" },
        { id: "theme-aurora", categoryId: "cat-themes", name: "Aurora", rarity: "legendary", kind: "unlock" },
      ],
    },
    {
      id: "cat-avatars",
      name: "Avatars",
      description: "New icons for your assistant.",
      builtIn: true,
      items: [
        { id: "avatar-owl", categoryId: "cat-avatars", name: "Owl", description: "\u{1F989}", rarity: "common", kind: "unlock" },
        { id: "avatar-cat", categoryId: "cat-avatars", name: "Cat", description: "\u{1F431}", rarity: "common", kind: "unlock" },
        { id: "avatar-fox", categoryId: "cat-avatars", name: "Fox", description: "\u{1F98A}", rarity: "uncommon", kind: "unlock" },
        { id: "avatar-robot", categoryId: "cat-avatars", name: "Robot", description: "\u{1F916}", rarity: "uncommon", kind: "unlock" },
        { id: "avatar-star", categoryId: "cat-avatars", name: "Star", description: "⭐", rarity: "rare", kind: "unlock" },
        { id: "avatar-dragon", categoryId: "cat-avatars", name: "Dragon", description: "\u{1F409}", rarity: "epic", kind: "unlock" },
        { id: "avatar-rocket", categoryId: "cat-avatars", name: "Rocket", description: "\u{1F680}", rarity: "legendary", kind: "unlock" },
      ],
    },
    {
      id: "cat-titles",
      name: "Titles",
      description: "A rank shown next to your assistant's name.",
      builtIn: true,
      items: [
        { id: "title-rookie", categoryId: "cat-titles", name: "Task Rookie", rarity: "common", kind: "unlock" },
        { id: "title-apprentice", categoryId: "cat-titles", name: "Task Apprentice", rarity: "common", kind: "unlock" },
        { id: "title-taskmaster", categoryId: "cat-titles", name: "Taskmaster", rarity: "uncommon", kind: "unlock" },
        { id: "title-pro", categoryId: "cat-titles", name: "Productivity Pro", rarity: "rare", kind: "unlock" },
        { id: "title-expert", categoryId: "cat-titles", name: "Efficiency Expert", rarity: "rare", kind: "unlock" },
        { id: "title-legend", categoryId: "cat-titles", name: "Productivity Legend", rarity: "epic", kind: "unlock" },
        { id: "title-metromaster", categoryId: "cat-titles", name: "Metro Master", rarity: "legendary", kind: "unlock" },
      ],
    },
    {
      id: "cat-effects",
      name: "Celebration Effects",
      description: "Animation shown when you clear your daily checklist.",
      builtIn: true,
      items: [
        { id: "effect-confetti", categoryId: "cat-effects", name: "Confetti Burst", rarity: "common", kind: "unlock" },
        { id: "effect-fireworks", categoryId: "cat-effects", name: "Fireworks", rarity: "uncommon", kind: "unlock" },
        { id: "effect-starfall", categoryId: "cat-effects", name: "Starfall", rarity: "rare", kind: "unlock" },
        { id: "effect-aurora", categoryId: "cat-effects", name: "Aurora Wave", rarity: "epic", kind: "unlock" },
        { id: "effect-fanfare", categoryId: "cat-effects", name: "Metro Fanfare", rarity: "legendary", kind: "unlock" },
      ],
    },
    {
      id: "cat-streak-freeze",
      name: "Streak Freezes",
      description: "Protects your daily streak if you miss a day. Consumable.",
      builtIn: true,
      items: [
        { id: "item-streak-freeze", categoryId: "cat-streak-freeze", name: "Streak Freeze Token", rarity: "uncommon", kind: "consumable" },
      ],
    },
    {
      id: "cat-wildcard",
      name: "Wildcards",
      description: "Swap one daily task for a bonus task without breaking your streak. Consumable.",
      builtIn: true,
      items: [
        { id: "item-wildcard", categoryId: "cat-wildcard", name: "Wildcard Token", rarity: "rare", kind: "consumable" },
      ],
    },
  ];
}

// ============================================================================
// BTS Season — a themed reward pack scheduled for August 2026. Everything
// below is added to the pool ahead of time (see Store.ensureBtsRewardPack)
// so it exists and can be inspected/edited immediately, but none of it is
// reachable until the season actually rolls over to BTS_SEASON_MONTH_KEY —
// see SEASONAL_REWARD_ROADMAPS and Store.activeCuratedRoadmap. Every
// reference here is a nickname, character name, or an original color
// palette — text and original artwork only, nothing reproduces official
// photos, artwork, or lyrics.
// ============================================================================

/** The season this pack activates for. Store.syncUpcomingTiersToCuratedRoadmap
 * only swaps in AUGUST_BTS_REWARD_ROADMAP once bp.currentMonthKey actually
 * becomes this value (i.e. once the monthly rollover crosses into August
 * 2026) — every tier not yet reached at that point, so July's roadmap is
 * completely untouched until then. */
export const BTS_SEASON_MONTH_KEY = "2026-08";

interface SeedTitle {
  id: string;
  name: string;
  flavorText: string;
  rarity: Rarity;
}

/** Five go on August's roadmap (tiers 1, 3, 6, 8, 12); three are bonus pool
 * items available to slot into a future tier from Settings. */
export const BTS_NEW_TITLES: SeedTitle[] = [
  { id: "title-bangtan-sonyeondan", name: "Bangtan Sonyeondan", rarity: "common", flavorText: "The literal meaning of BTS's full name: \"Bulletproof Boy Scouts\" — later paired with the Western-facing \"Beyond The Scene.\"" },
  { id: "title-army", name: "ARMY", rarity: "common", flavorText: "Adorable Representative M.C. for Youth — the fandom's official name, adopted July 9, 2013." },
  { id: "title-worldwide-handsome", name: "Worldwide Handsome", rarity: "uncommon", flavorText: "Jin's self-given nickname, fully embraced by fans ever since." },
  { id: "title-golden-maknae", name: "Golden Maknae", rarity: "uncommon", flavorText: "Jungkook's title as the group's youngest member — sings, dances, raps, and always has a new cover out." },
  { id: "title-god-of-destruction", name: "God of Destruction", rarity: "rare", flavorText: "RM's long-running nickname, earned by a legendary knack for accidentally breaking things." },
  { id: "title-agust-d", name: "Agust D", rarity: "rare", flavorText: "Suga's producer/rapper alter ego and mixtape name." },
  { id: "title-mochi", name: "Mochi", rarity: "uncommon", flavorText: "Jimin's nickname — soft, round cheeks, impossible not to love." },
  { id: "title-sunshine", name: "Sunshine", rarity: "uncommon", flavorText: "J-Hope's nickname. He is, quite literally, ARMY's hope." },
];

interface SeedAvatar {
  id: string;
  name: string;
  emoji: string;
  flavorText: string;
  rarity: Rarity;
}

/** BT21 (LINE FRIENDS x BTS) character stand-ins — one per member, plus VAN,
 * the collective guardian character. Five go on August's roadmap (tiers 2,
 * 4, 7, 10, 14); three are bonus pool items. */
export const BTS_NEW_AVATARS: SeedAvatar[] = [
  { id: "avatar-koya", name: "Koya", emoji: "\u{1F428}", rarity: "common", flavorText: "RM's BT21 alter ego — a sleepy, thoughtful koala who loves to read." },
  { id: "avatar-rj", name: "RJ", emoji: "\u{1F999}", rarity: "common", flavorText: "Jin's BT21 alter ego — a fluffy alpaca who loves to cook." },
  { id: "avatar-shooky", name: "Shooky", emoji: "\u{1F36A}", rarity: "uncommon", flavorText: "Suga's BT21 alter ego — a mischievous gingerbread cookie who really hates milk." },
  { id: "avatar-tata", name: "Tata", emoji: "\u{1F47D}", rarity: "rare", flavorText: "V's BT21 alter ego — an artistic alien prince from planet BT." },
  { id: "avatar-chimmy", name: "Chimmy", emoji: "\u{1F436}", rarity: "epic", flavorText: "Jimin's BT21 alter ego — an upbeat, dedicated little puppy." },
  { id: "avatar-mang", name: "Mang", emoji: "\u{1F434}", rarity: "uncommon", flavorText: "J-Hope's BT21 alter ego — a high-energy dancer who never takes his mask off." },
  { id: "avatar-cooky", name: "Cooky", emoji: "\u{1F430}", rarity: "epic", flavorText: "Jungkook's BT21 alter ego — a cute rabbit who's secretly built like a tank." },
  { id: "avatar-van", name: "Van", emoji: "\u{1F916}", rarity: "legendary", flavorText: "BT21's guardian robot, created together by all seven members — some say it represents ARMY itself." },
];

/** The legendary finale of August's roadmap (tier 15). */
export const BTS_NEW_THEME = {
  id: "theme-i-purple-you",
  name: "I Purple You",
  rarity: "legendary" as Rarity,
  flavorText: "Coined by V at BTS's 3rd Muster in 2016 — purple is the last color of the rainbow, so it means trust and love that lasts. It became BTS and ARMY's signature color.",
};

/** Placed at tier 11 of August's roadmap. */
export const BTS_NEW_EFFECT = {
  id: "effect-purple-ocean",
  name: "Purple Ocean",
  rarity: "rare" as Rarity,
  flavorText: "A sea of glowing purple light, just like the ARMY Bombs raised at every concert.",
};

/** The one Photocard reserved for August, tier 13. Ships with no photo
 * attached — Store.setRewardItemImage lets one be uploaded whenever you're
 * ready, before or after the tier is reached; either way it stays hidden
 * until then. Tier 13 isn't arbitrary: BTS debuted 6/13/2013, and FESTA (the
 * annual anniversary celebration) falls on June 13 every year. */
export const PHOTOCARD_SEED_ITEM = {
  id: "photocard-surprise-01",
  name: "Surprise Photocard",
  rarity: "epic" as Rarity,
  flavorText: "Reserved for Tier 13 of the August season — 6/13 for a reason. The photo stays hidden until you get there.",
};

/** August 2026's full 15-tier curated roadmap — same ascending-rarity shape
 * as DEFAULT_REWARD_ROADMAP (4 common, 4 uncommon, 4 rare, 2 epic, 1
 * legendary), just BTS-themed top to bottom. Tier 5 and 9 keep the ordinary
 * Streak Freeze / Wildcard consumables so those mechanics don't skip a
 * season. Tier 7 (avatar) is a small nod to the 7 members; tier 13
 * (Photocard) to the 6/13 debut date. */
export const AUGUST_BTS_REWARD_ROADMAP: RewardRoadmapEntry[] = [
  { tier: 1, categoryId: "cat-titles", itemId: "title-bangtan-sonyeondan" },
  { tier: 2, categoryId: "cat-avatars", itemId: "avatar-koya" },
  { tier: 3, categoryId: "cat-titles", itemId: "title-army" },
  { tier: 4, categoryId: "cat-avatars", itemId: "avatar-rj" },
  { tier: 5, categoryId: "cat-streak-freeze", itemId: "item-streak-freeze" },
  { tier: 6, categoryId: "cat-titles", itemId: "title-worldwide-handsome" },
  { tier: 7, categoryId: "cat-avatars", itemId: "avatar-shooky" },
  { tier: 8, categoryId: "cat-titles", itemId: "title-golden-maknae" },
  { tier: 9, categoryId: "cat-wildcard", itemId: "item-wildcard" },
  { tier: 10, categoryId: "cat-avatars", itemId: "avatar-tata" },
  { tier: 11, categoryId: "cat-effects", itemId: "effect-purple-ocean" },
  { tier: 12, categoryId: "cat-titles", itemId: "title-god-of-destruction" },
  { tier: 13, categoryId: "cat-photocards", itemId: PHOTOCARD_SEED_ITEM.id },
  { tier: 14, categoryId: "cat-avatars", itemId: "avatar-chimmy" },
  { tier: 15, categoryId: "cat-themes", itemId: BTS_NEW_THEME.id },
];

/** Monthly-keyed curated roadmap overrides. Store.activeCuratedRoadmap looks
 * up the current season's monthKey here first, falling back to the
 * evergreen DEFAULT_REWARD_ROADMAP for every month that isn't specifically
 * scheduled — so adding a season here never touches any other month. */
export const SEASONAL_REWARD_ROADMAPS: Record<string, RewardRoadmapEntry[]> = {
  [BTS_SEASON_MONTH_KEY]: AUGUST_BTS_REWARD_ROADMAP,
};
