// ============================================================================
// Default content: starting points config, battlepass tiers, and the seed
// reward pool. All of this is editable/extendable at runtime from Settings —
// nothing here is hardcoded into the logic, it's just the initial state for
// a brand-new install.
// ============================================================================

import type { PhotocardAlbum, PointsConfig, Rarity, RewardCategory, RewardRoadmapEntry, Tier, Settings } from "../types.js";

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

/** The grand finale of August's roadmap (tier 30). */
export const BTS_NEW_THEME = {
  id: "theme-i-purple-you",
  name: "I Purple You",
  rarity: "legendary" as Rarity,
  flavorText: "Coined by V at BTS's 3rd Muster in 2016 — purple is the last color of the rainbow, so it means trust and love that lasts. It became BTS and ARMY's signature color.",
};

interface SeedEffect {
  id: string;
  name: string;
  rarity: Rarity;
  flavorText: string;
}

/** Celebration effects (Settings/Inventory equippable, played when a daily
 * checklist is fully cleared — see toast.ts's celebrate()). Three go on
 * August's roadmap now (tiers 21, 31, 32) instead of just one. */
export const BTS_NEW_EFFECTS: SeedEffect[] = [
  { id: "effect-purple-ocean", name: "Purple Ocean", rarity: "rare", flavorText: "A sea of glowing purple light, just like the ARMY Bombs raised at every concert." },
  { id: "effect-divine-bell", name: "Divine Bell Chime", rarity: "rare", flavorText: "A single resonant ring, straight out of \"No. 29\" — Arirang's closing track, just the Divine Bell of King Seongdeok tolling once." },
  { id: "effect-bangtan-flash", name: "Bangtan Bomb Flash", rarity: "epic", flavorText: "A burst of camera flashes, like the crew catching another candid moment for a Bangtan Bomb." },
];
/** Kept for backwards compatibility with anything referencing the original
 * single seed effect by name. */
export const BTS_NEW_EFFECT = BTS_NEW_EFFECTS[0];

interface SeedPhotocard {
  id: string;
  name: string;
  flavorText: string;
  rarity: Rarity;
}

/** Five Photocard slots on August's roadmap now (up from just one) — all
 * ship with no photo attached. Store.setRewardItemImage lets a photo be
 * uploaded for any of them whenever you're ready, before or after its tier
 * is reached; either way it stays hidden until then (see rewardVisual's
 * `revealed` option). Tier 13 isn't arbitrary: BTS debuted 6/13/2013, and
 * FESTA (the annual anniversary celebration) falls on June 13 every year. */
export const BTS_NEW_PHOTOCARDS: SeedPhotocard[] = [
  { id: "photocard-surprise-01", name: "Surprise Photocard", rarity: "uncommon", flavorText: "Reserved for Tier 13 of the August season — 6/13 for a reason. The photo stays hidden until you get there." },
  { id: "photocard-surprise-02", name: "Surprise Photocard #2", rarity: "uncommon", flavorText: "Another slot, waiting for a photo — attach one any time from the Reward Pool." },
  { id: "photocard-surprise-03", name: "Surprise Photocard #3", rarity: "rare", flavorText: "Another slot, waiting for a photo — attach one any time from the Reward Pool." },
  { id: "photocard-surprise-04", name: "Surprise Photocard #4", rarity: "epic", flavorText: "Another slot, waiting for a photo — attach one any time from the Reward Pool." },
  { id: "photocard-surprise-05", name: "Surprise Photocard #5", rarity: "legendary", flavorText: "The rarest pull of the album — save something special for this one." },
];
/** Kept for backwards compatibility with anything referencing the original
 * single seed item by name. */
export const PHOTOCARD_SEED_ITEM = BTS_NEW_PHOTOCARDS[0];

interface SeedSticker {
  id: string;
  name: string;
  emoji: string;
  flavorText: string;
  rarity: Rarity;
}

/** Decorations for the Photocard Album's front cover (see
 * Store.placeStickerOnCover) — themed around BTS's 2026 comeback album
 * *Arirang* (named for the traditional Korean folk song; Big Hit
 * described it as capturing "BTS' identity as a group that began in
 * Korea") plus general ARMY/BT21 iconography. Seven go on August's
 * roadmap; "Hooligan" is a bonus pool item. */
export const BTS_NEW_STICKERS: SeedSticker[] = [
  { id: "sticker-purple-heart", name: "Purple Heart", emoji: "\u{1F49C}", rarity: "common", flavorText: "The universal ARMY symbol — \"I Purple You,\" always." },
  { id: "sticker-swim", name: "Swim", emoji: "\u{1F3CA}", rarity: "common", flavorText: "\"Swim\" — Arirang's lead single, about moving forward through whatever the current throws at you." },
  { id: "sticker-army-bomb", name: "ARMY Bomb", emoji: "\u{1F52E}", rarity: "common", flavorText: "A nod to the official lightstick — the whole crowd glowing as one." },
  { id: "sticker-no-29", name: "No. 29", emoji: "\u{1F514}", rarity: "uncommon", flavorText: "Arirang's closing track — just a single chime of the Divine Bell of King Seongdeok." },
  { id: "sticker-merry-go-round", name: "Merry Go Round", emoji: "\u{1F3A0}", rarity: "uncommon", flavorText: "Arirang's psychedelic rock detour." },
  { id: "sticker-body-to-body", name: "Body to Body", emoji: "\u{1F941}", rarity: "rare", flavorText: "Samples the traditional Arirang folk melody itself — old song, new sound." },
  { id: "sticker-bangtan-bomb", name: "Bangtan Bomb", emoji: "\u{1F3AC}", rarity: "epic", flavorText: "A nod to Bangtan Bomb, their long-running behind-the-scenes video series." },
  { id: "sticker-hooligan", name: "Hooligan", emoji: "\u{1F608}", rarity: "rare", flavorText: "One of Arirang's tracks — a little mischief never hurt." },
];

/** August 2026's tier ladder — 32 tiers instead of the evergreen 15, with a
 * gentler climb (delta(tier) = 30 + 10*tier, vs. the default's much steeper
 * growth) so more rewards land, closer together, over the season. Tiers 31
 * and 32 were appended (rather than reshuffling 1-30) purely to make room
 * for two more celebration effects without touching any tier a returning
 * player may have already reached. Swapped in via SEASONAL_TIERS at
 * rollover; see Store — the previous ladder is snapshotted to
 * bp.baselineTiers first and restored the moment a season without a
 * scheduled ladder begins, so a custom Settings tier setup is never
 * permanently lost. */
export const AUGUST_BTS_TIERS: Tier[] = [
  { tier: 1, pointsRequired: 40 }, { tier: 2, pointsRequired: 90 }, { tier: 3, pointsRequired: 150 },
  { tier: 4, pointsRequired: 220 }, { tier: 5, pointsRequired: 300 }, { tier: 6, pointsRequired: 390 },
  { tier: 7, pointsRequired: 490 }, { tier: 8, pointsRequired: 600 }, { tier: 9, pointsRequired: 720 },
  { tier: 10, pointsRequired: 850 }, { tier: 11, pointsRequired: 990 }, { tier: 12, pointsRequired: 1140 },
  { tier: 13, pointsRequired: 1300 }, { tier: 14, pointsRequired: 1470 }, { tier: 15, pointsRequired: 1650 },
  { tier: 16, pointsRequired: 1840 }, { tier: 17, pointsRequired: 2040 }, { tier: 18, pointsRequired: 2250 },
  { tier: 19, pointsRequired: 2470 }, { tier: 20, pointsRequired: 2700 }, { tier: 21, pointsRequired: 2940 },
  { tier: 22, pointsRequired: 3190 }, { tier: 23, pointsRequired: 3450 }, { tier: 24, pointsRequired: 3720 },
  { tier: 25, pointsRequired: 4000 }, { tier: 26, pointsRequired: 4290 }, { tier: 27, pointsRequired: 4590 },
  { tier: 28, pointsRequired: 4900 }, { tier: 29, pointsRequired: 5220 }, { tier: 30, pointsRequired: 5550 },
  { tier: 31, pointsRequired: 5890 }, { tier: 32, pointsRequired: 6240 },
];

/** Monthly-keyed tier-ladder overrides, mirroring SEASONAL_REWARD_ROADMAPS
 * below. Store.processDueRollovers looks up the new season's monthKey here;
 * a match swaps bp.tiers to it (snapshotting the outgoing ladder to
 * bp.baselineTiers first), no match restores bp.baselineTiers if one was
 * saved, or otherwise leaves bp.tiers untouched entirely. */
export const SEASONAL_TIERS: Record<string, Tier[]> = {
  [BTS_SEASON_MONTH_KEY]: AUGUST_BTS_TIERS,
};

/** August 2026's full 32-tier curated roadmap — ascending rarity top to
 * bottom, same as the evergreen table, just BTS/Arirang-themed and with
 * five Photocard slots and seven Sticker slots instead of one and zero.
 * A few thematic placements: tier 7 (Sticker) nods to the 7 members; tier
 * 13 (Photocard) to the 6/13 debut date; tier 30 closes the original
 * 30-tier board on the "I Purple You" theme. Tiers 31-32 are a later
 * addition — two more celebration effects, appended past the original
 * finale rather than swapped in for anything, so nothing already reached
 * ever changes underneath a returning player. Title Sunshine, Avatar
 * Cooky, and Sticker Hooligan are left as bonus pool items rather than
 * crowding the roadmap further. */
export const AUGUST_BTS_REWARD_ROADMAP: RewardRoadmapEntry[] = [
  { tier: 1, categoryId: "cat-titles", itemId: "title-bangtan-sonyeondan" },
  { tier: 2, categoryId: "cat-titles", itemId: "title-army" },
  { tier: 3, categoryId: "cat-avatars", itemId: "avatar-koya" },
  { tier: 4, categoryId: "cat-avatars", itemId: "avatar-rj" },
  { tier: 5, categoryId: "cat-stickers", itemId: "sticker-purple-heart" },
  { tier: 6, categoryId: "cat-stickers", itemId: "sticker-swim" },
  { tier: 7, categoryId: "cat-stickers", itemId: "sticker-army-bomb" },
  { tier: 8, categoryId: "cat-titles", itemId: "title-worldwide-handsome" },
  { tier: 9, categoryId: "cat-titles", itemId: "title-golden-maknae" },
  { tier: 10, categoryId: "cat-titles", itemId: "title-mochi" },
  { tier: 11, categoryId: "cat-avatars", itemId: "avatar-shooky" },
  { tier: 12, categoryId: "cat-avatars", itemId: "avatar-mang" },
  { tier: 13, categoryId: "cat-photocards", itemId: "photocard-surprise-01" },
  { tier: 14, categoryId: "cat-streak-freeze", itemId: "item-streak-freeze" },
  { tier: 15, categoryId: "cat-photocards", itemId: "photocard-surprise-02" },
  { tier: 16, categoryId: "cat-stickers", itemId: "sticker-no-29" },
  { tier: 17, categoryId: "cat-stickers", itemId: "sticker-merry-go-round" },
  { tier: 18, categoryId: "cat-titles", itemId: "title-god-of-destruction" },
  { tier: 19, categoryId: "cat-titles", itemId: "title-agust-d" },
  { tier: 20, categoryId: "cat-avatars", itemId: "avatar-tata" },
  { tier: 21, categoryId: "cat-effects", itemId: "effect-purple-ocean" },
  { tier: 22, categoryId: "cat-wildcard", itemId: "item-wildcard" },
  { tier: 23, categoryId: "cat-photocards", itemId: "photocard-surprise-03" },
  { tier: 24, categoryId: "cat-stickers", itemId: "sticker-body-to-body" },
  { tier: 25, categoryId: "cat-avatars", itemId: "avatar-chimmy" },
  { tier: 26, categoryId: "cat-photocards", itemId: "photocard-surprise-04" },
  { tier: 27, categoryId: "cat-stickers", itemId: "sticker-bangtan-bomb" },
  { tier: 28, categoryId: "cat-avatars", itemId: "avatar-van" },
  { tier: 29, categoryId: "cat-photocards", itemId: "photocard-surprise-05" },
  { tier: 30, categoryId: "cat-themes", itemId: BTS_NEW_THEME.id },
  { tier: 31, categoryId: "cat-effects", itemId: "effect-divine-bell" },
  { tier: 32, categoryId: "cat-effects", itemId: "effect-bangtan-flash" },
];

/** Monthly-keyed curated roadmap overrides. Store.activeCuratedRoadmap looks
 * up the current season's monthKey here first, falling back to the
 * evergreen DEFAULT_REWARD_ROADMAP for every month that isn't specifically
 * scheduled — so adding a season here never touches any other month. */
export const SEASONAL_REWARD_ROADMAPS: Record<string, RewardRoadmapEntry[]> = {
  [BTS_SEASON_MONTH_KEY]: AUGUST_BTS_REWARD_ROADMAP,
};

export function defaultPhotocardAlbum(): PhotocardAlbum {
  return { coverStickers: [] };
}
