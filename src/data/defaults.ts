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
  { tier: 5, categoryId: "cat-effects", itemId: "effect-fireworks" },
  { tier: 6, categoryId: "cat-avatars", itemId: "avatar-fox" },
  { tier: 7, categoryId: "cat-titles", itemId: "title-taskmaster" },
  { tier: 8, categoryId: "cat-themes", itemId: "theme-neon" },
  { tier: 9, categoryId: "cat-avatars", itemId: "avatar-star" },
  { tier: 10, categoryId: "cat-titles", itemId: "title-pro" },
  { tier: 11, categoryId: "cat-effects", itemId: "effect-starfall" },
  { tier: 12, categoryId: "cat-themes", itemId: "theme-sakura" },
  { tier: 13, categoryId: "cat-avatars", itemId: "avatar-dragon" },
  { tier: 14, categoryId: "cat-titles", itemId: "title-legend" },
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
    activeFontId: null,
    activeBackgroundId: null,
    activeCheckboxId: null,
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

/** August 2026's tier ladder — 30 tiers instead of the evergreen 15, with a
 * gentler climb (delta(tier) = 30 + 10*tier, vs. the default's much steeper
 * growth) so more rewards land, closer together, over the season.
 *
 * This briefly ran to 32 tiers, to make room for two extra celebration
 * effects. Retiring the Streak Freeze and Wildcard consumables then freed
 * two roadmap slots higher up, so those effects moved to tiers 29-30 and
 * the ladder came back down to 30 — same thresholds for every tier that
 * survived, so nothing already reached moved underneath anyone. Swapped in
 * via SEASONAL_TIERS at
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
];


/** August 2026's full 30-tier curated roadmap — ascending rarity top to
 * bottom, same as the evergreen table, just BTS/Arirang-themed and with
 * five Photocard slots and seven Sticker slots instead of one and zero.
 * A few thematic placements: tier 7 (Sticker) nods to the 7 members; tier
 * 13 (Photocard) to the 6/13 debut date; tier 28 lands the "I Purple You"
 * theme, with the two newest celebration effects closing the season at 29
 * and 30. Title Sunshine, Avatar Cooky, and Sticker Hooligan are left as
 * bonus pool items rather than crowding the roadmap further.
 *
 * This table used to be 32 entries long, with a Streak Freeze at tier 14
 * and a Wildcard at tier 22. Both consumables were retired from Metro
 * entirely, so every entry after them shifted up one and the season now
 * ends at tier 30 — see Store.removeConsumableRewards, which re-deals an
 * in-progress season against this table so a player past those tiers ends
 * up owning exactly what they'd own if the tokens had never existed. */
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
  { tier: 14, categoryId: "cat-photocards", itemId: "photocard-surprise-02" },
  { tier: 15, categoryId: "cat-stickers", itemId: "sticker-no-29" },
  { tier: 16, categoryId: "cat-stickers", itemId: "sticker-merry-go-round" },
  { tier: 17, categoryId: "cat-titles", itemId: "title-god-of-destruction" },
  { tier: 18, categoryId: "cat-titles", itemId: "title-agust-d" },
  { tier: 19, categoryId: "cat-avatars", itemId: "avatar-tata" },
  { tier: 20, categoryId: "cat-effects", itemId: "effect-purple-ocean" },
  { tier: 21, categoryId: "cat-photocards", itemId: "photocard-surprise-03" },
  { tier: 22, categoryId: "cat-stickers", itemId: "sticker-body-to-body" },
  { tier: 23, categoryId: "cat-avatars", itemId: "avatar-chimmy" },
  { tier: 24, categoryId: "cat-photocards", itemId: "photocard-surprise-04" },
  { tier: 25, categoryId: "cat-stickers", itemId: "sticker-bangtan-bomb" },
  { tier: 26, categoryId: "cat-avatars", itemId: "avatar-van" },
  { tier: 27, categoryId: "cat-photocards", itemId: "photocard-surprise-05" },
  { tier: 28, categoryId: "cat-themes", itemId: BTS_NEW_THEME.id },
  { tier: 29, categoryId: "cat-effects", itemId: "effect-divine-bell" },
  { tier: 30, categoryId: "cat-effects", itemId: "effect-bangtan-flash" },
];


export function defaultPhotocardAlbum(): PhotocardAlbum {
  return { coverStickers: [] };
}

// ============================================================================
// Study Season — September 2026.
//
// A stationery season, and deliberately not a fan season: every tier hands
// back a piece of the interface rather than a souvenir from outside it. That
// premise is why it introduces three new reward categories — a Font, a
// Background texture and a Checkbox Style — alongside the existing themes,
// titles, avatars and effects.
//
// No Photocards this month. Nothing here is BTS-themed.
// ============================================================================

export const STUDY_SEASON_MONTH_KEY = "2026-09";

/** Font stacks a Font reward can apply, keyed by id. Only these ids are ever
 * written into a style declaration (see applyTheme in ui/nav.ts), so a reward
 * naming something not in this table simply does nothing rather than
 * injecting arbitrary CSS. All system faces — no webfont, no network. */
export const FONT_STACKS: Record<string, string> = {
  "font-ledger": '"Trebuchet MS", Verdana, Geneva, sans-serif',
  "font-manuscript": 'Georgia, "Times New Roman", Times, serif',
  "font-marginalia": '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  "font-typewriter": '"Courier New", Courier, monospace',
  "font-copperplate": 'Baskerville, "Hoefler Text", Garamond, "Times New Roman", serif',
};

/** Background patterns, as ids matched by a body[data-background="..."] rule
 * in styles.css. Every pattern is drawn in translucent black/white rather
 * than fixed colours, so it reads as texture over any theme instead of
 * fighting the one you have equipped. */
export const BACKGROUND_PATTERNS: string[] = [
  "bg-legal-pad",
  "bg-dot-grid",
  "bg-graph-paper",
  "bg-cork-board",
  "bg-marbled-cover",
];

interface SeedReward {
  id: string;
  name: string;
  rarity: Rarity;
  flavorText: string;
  /** Emoji, for avatars and checkbox marks — both render from `description`. */
  description?: string;
  colors?: [string, string];
  effectAnimation?: string;
  fontFamily?: string;
  backgroundPattern?: string;
}

export const STUDY_FONTS: SeedReward[] = [
  { id: "font-ledger", name: "Ledger", rarity: "common", fontFamily: "font-ledger", flavorText: "A clean everyday sans — the hand you'd use for a list you actually intend to finish." },
  { id: "font-manuscript", name: "Manuscript", rarity: "uncommon", fontFamily: "font-manuscript", flavorText: "A bookish serif. Makes a grocery list feel like it has footnotes." },
  { id: "font-marginalia", name: "Marginalia", rarity: "rare", fontFamily: "font-marginalia", flavorText: "Humanist and slightly hand-set, like something written in the margin and never tidied up." },
  { id: "font-typewriter", name: "Typewriter", rarity: "epic", fontFamily: "font-typewriter", flavorText: "Monospace, with the clack implied. Every task the same width, whether it deserves it or not." },
  { id: "font-copperplate", name: "Copperplate", rarity: "legendary", fontFamily: "font-copperplate", flavorText: "The good stationery, kept in the drawer for things that matter." },
];

export const STUDY_BACKGROUNDS: SeedReward[] = [
  { id: "bg-legal-pad", name: "Legal Pad", rarity: "common", backgroundPattern: "bg-legal-pad", flavorText: "Faint horizontal rules. Somewhere to put the thought before it escapes." },
  { id: "bg-dot-grid", name: "Dot Grid", rarity: "common", backgroundPattern: "bg-dot-grid", flavorText: "The bullet-journal standard — structure if you want it, blank if you don't." },
  { id: "bg-graph-paper", name: "Graph Paper", rarity: "uncommon", backgroundPattern: "bg-graph-paper", flavorText: "A fine grid, for the days that need to be squared off." },
  { id: "bg-cork-board", name: "Cork Board", rarity: "rare", backgroundPattern: "bg-cork-board", flavorText: "Fine speckled texture, like something you'd pin a note to and then never look at again." },
  { id: "bg-marbled-cover", name: "Marbled Cover", rarity: "epic", backgroundPattern: "bg-marbled-cover", flavorText: "The mottled composition notebook. Indestructible, and slightly menacing." },
];

export const STUDY_CHECKBOXES: SeedReward[] = [
  { id: "check-pen-tick", name: "Pen Tick", rarity: "common", description: "✓", flavorText: "A hand-drawn check. The oldest reward in productivity." },
  { id: "check-red-pen", name: "Red Pen", rarity: "uncommon", description: "✗", flavorText: "Struck through in red, teacher-style. Done is done." },
  { id: "check-gold-star", name: "Gold Star", rarity: "rare", description: "★", flavorText: "The one you actually wanted, all along." },
  { id: "check-wax-seal", name: "Wax Seal", rarity: "epic", description: "✦", flavorText: "Pressed, and therefore final. No take-backs." },
  { id: "check-highlighter", name: "Highlighter", rarity: "legendary", description: "✓", flavorText: "Sweeps a band of colour clean across the finished task." },
];

export const STUDY_THEMES: SeedReward[] = [
  { id: "theme-foolscap", name: "Foolscap", rarity: "common", colors: ["#8a6a3b", "#b08d55"], flavorText: "Warm paper and graphite. Named for the sheet size, and for the watermark of a jester's cap that used to be on it." },
  { id: "theme-blueprint", name: "Blueprint", rarity: "uncommon", colors: ["#4aa3d8", "#7ec8e8"], flavorText: "Deep blue and cyan rules — for a day you'd rather draft than write." },
  { id: "theme-fountain-pen", name: "Fountain Pen", rarity: "rare", colors: ["#6b8cd6", "#c9a227"], flavorText: "Ink navy and brass nib. Heavier in the hand than it needs to be, on purpose." },
  { id: "theme-midnight-oil", name: "Midnight Oil", rarity: "legendary", colors: ["#f0a850", "#c9772f"], flavorText: "Near-black, with one warm lamp. The finale, for whatever you're still up finishing." },
];

export const STUDY_AVATARS: SeedReward[] = [
  { id: "avatar-pencil", name: "Pencil", rarity: "common", description: "✏️", flavorText: "Erasable, which is the whole point." },
  { id: "avatar-paperclip", name: "Paperclip", rarity: "uncommon", description: "\u{1F4CE}", flavorText: "Holds unrelated things together through sheer tension." },
  { id: "avatar-fountain-pen", name: "Fountain Pen", rarity: "rare", description: "✒️", flavorText: "Commits. No pencil about it." },
];

export const STUDY_TITLES: SeedReward[] = [
  { id: "title-note-taker", name: "Note Taker", rarity: "common", flavorText: "You've started a list, which is most of it." },
  { id: "title-margin-scribbler", name: "Margin Scribbler", rarity: "uncommon", flavorText: "The good ideas were never in the middle of the page anyway." },
  { id: "title-desk-marshal", name: "Desk Marshal", rarity: "rare", flavorText: "Order imposed, daily, by force of will." },
  { id: "title-keeper-of-lists", name: "Keeper of Lists", rarity: "epic", flavorText: "Custodian of every loose intention you've ever had." },
  { id: "title-curator-loose-ends", name: "Curator of Loose Ends", rarity: "legendary", flavorText: "Not finished. Catalogued, which is close enough." },
];

export const STUDY_EFFECTS: SeedReward[] = [
  { id: "effect-paper-confetti", name: "Paper Confetti", rarity: "uncommon", effectAnimation: "effect-paper-confetti", flavorText: "Torn scraps and hole-punch dots, drifting down over a cleared list." },
  { id: "effect-ink-bloom", name: "Ink Bloom", rarity: "rare", effectAnimation: "effect-ink-bloom", flavorText: "A drop of ink spreading out through the page." },
  { id: "effect-page-turn", name: "Page Turn", rarity: "epic", effectAnimation: "effect-page-turn", flavorText: "The whole screen turns over like a sheet of paper. Next." },
];

/** September's tier ladder — 30 tiers topping out at 6,600.
 *
 * Between August's 5,550 and the 8,220 an every-single-day month would
 * justify. August's number was set when a perfect puzzle day was worth 50
 * points; it's worth 100 now, so that ladder runs at roughly half its
 * intended difficulty. 6,600 is about twenty active days at ~330 points —
 * comfortably inside a good month without requiring every day of it, which
 * is the point: the season should survive a few days off. */
export const SEPTEMBER_STUDY_TIERS: Tier[] = [
  { tier: 1, pointsRequired: 100 }, { tier: 2, pointsRequired: 160 }, { tier: 3, pointsRequired: 240 },
  { tier: 4, pointsRequired: 330 }, { tier: 5, pointsRequired: 440 }, { tier: 6, pointsRequired: 550 },
  { tier: 7, pointsRequired: 670 }, { tier: 8, pointsRequired: 810 }, { tier: 9, pointsRequired: 950 },
  { tier: 10, pointsRequired: 1110 }, { tier: 11, pointsRequired: 1280 }, { tier: 12, pointsRequired: 1460 },
  { tier: 13, pointsRequired: 1650 }, { tier: 14, pointsRequired: 1850 }, { tier: 15, pointsRequired: 2060 },
  { tier: 16, pointsRequired: 2290 }, { tier: 17, pointsRequired: 2530 }, { tier: 18, pointsRequired: 2770 },
  { tier: 19, pointsRequired: 3030 }, { tier: 20, pointsRequired: 3300 }, { tier: 21, pointsRequired: 3580 },
  { tier: 22, pointsRequired: 3870 }, { tier: 23, pointsRequired: 4180 }, { tier: 24, pointsRequired: 4490 },
  { tier: 25, pointsRequired: 4820 }, { tier: 26, pointsRequired: 5150 }, { tier: 27, pointsRequired: 5500 },
  { tier: 28, pointsRequired: 5860 }, { tier: 29, pointsRequired: 6230 }, { tier: 30, pointsRequired: 6600 },
];

/** September's curated roadmap — ascending rarity, with each of the three new
 * categories spread across five tiers so no stretch of the climb is all one
 * kind of thing. Bands: common 1-7, uncommon 8-14, rare 15-21, epic 22-26,
 * legendary 27-30. */
export const SEPTEMBER_STUDY_ROADMAP: RewardRoadmapEntry[] = [
  { tier: 1, categoryId: "cat-titles", itemId: "title-note-taker" },
  { tier: 2, categoryId: "cat-avatars", itemId: "avatar-pencil" },
  { tier: 3, categoryId: "cat-checkboxes", itemId: "check-pen-tick" },
  { tier: 4, categoryId: "cat-backgrounds", itemId: "bg-legal-pad" },
  { tier: 5, categoryId: "cat-fonts", itemId: "font-ledger" },
  { tier: 6, categoryId: "cat-themes", itemId: "theme-foolscap" },
  { tier: 7, categoryId: "cat-backgrounds", itemId: "bg-dot-grid" },
  { tier: 8, categoryId: "cat-titles", itemId: "title-margin-scribbler" },
  { tier: 9, categoryId: "cat-checkboxes", itemId: "check-red-pen" },
  { tier: 10, categoryId: "cat-fonts", itemId: "font-manuscript" },
  { tier: 11, categoryId: "cat-backgrounds", itemId: "bg-graph-paper" },
  { tier: 12, categoryId: "cat-avatars", itemId: "avatar-paperclip" },
  { tier: 13, categoryId: "cat-effects", itemId: "effect-paper-confetti" },
  { tier: 14, categoryId: "cat-themes", itemId: "theme-blueprint" },
  { tier: 15, categoryId: "cat-titles", itemId: "title-desk-marshal" },
  { tier: 16, categoryId: "cat-checkboxes", itemId: "check-gold-star" },
  { tier: 17, categoryId: "cat-fonts", itemId: "font-marginalia" },
  { tier: 18, categoryId: "cat-backgrounds", itemId: "bg-cork-board" },
  { tier: 19, categoryId: "cat-avatars", itemId: "avatar-fountain-pen" },
  { tier: 20, categoryId: "cat-effects", itemId: "effect-ink-bloom" },
  { tier: 21, categoryId: "cat-themes", itemId: "theme-fountain-pen" },
  { tier: 22, categoryId: "cat-titles", itemId: "title-keeper-of-lists" },
  { tier: 23, categoryId: "cat-checkboxes", itemId: "check-wax-seal" },
  { tier: 24, categoryId: "cat-fonts", itemId: "font-typewriter" },
  { tier: 25, categoryId: "cat-backgrounds", itemId: "bg-marbled-cover" },
  { tier: 26, categoryId: "cat-effects", itemId: "effect-page-turn" },
  { tier: 27, categoryId: "cat-titles", itemId: "title-curator-loose-ends" },
  { tier: 28, categoryId: "cat-checkboxes", itemId: "check-highlighter" },
  { tier: 29, categoryId: "cat-fonts", itemId: "font-copperplate" },
  { tier: 30, categoryId: "cat-themes", itemId: "theme-midnight-oil" },
];

/** Monthly-keyed tier-ladder overrides, mirroring SEASONAL_REWARD_ROADMAPS
 * below. Store.processDueRollovers looks up the new season's monthKey here;
 * a match swaps bp.tiers to it (snapshotting the outgoing ladder to
 * bp.baselineTiers first), no match restores bp.baselineTiers if one was
 * saved, or otherwise leaves bp.tiers untouched entirely. */
export const SEASONAL_TIERS: Record<string, Tier[]> = {
  [BTS_SEASON_MONTH_KEY]: AUGUST_BTS_TIERS,
  "2026-09": SEPTEMBER_STUDY_TIERS,
};

/** Monthly-keyed curated roadmap overrides. Store.activeCuratedRoadmap looks
 * up the current season's monthKey here first, falling back to the
 * evergreen DEFAULT_REWARD_ROADMAP for every month that isn't specifically
 * scheduled — so adding a season here never touches any other month. */
export const SEASONAL_REWARD_ROADMAPS: Record<string, RewardRoadmapEntry[]> = {
  [BTS_SEASON_MONTH_KEY]: AUGUST_BTS_REWARD_ROADMAP,
  "2026-09": SEPTEMBER_STUDY_ROADMAP,
};
