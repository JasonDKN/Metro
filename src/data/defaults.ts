// ============================================================================
// Default content: starting points config, battlepass tiers, and the seed
// reward pool. All of this is editable/extendable at runtime from Settings —
// nothing here is hardcoded into the logic, it's just the initial state for
// a brand-new install.
// ============================================================================

import type { PointsConfig, RewardCategory, Tier, Settings } from "../types.js";

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
    unlockedThemeIds: [DEFAULT_THEME_ID],
    activeAvatarId: DEFAULT_AVATAR_ID,
    unlockedAvatarIds: [DEFAULT_AVATAR_ID],
    activeTitleId: null,
    unlockedTitleIds: [],
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
      id: "cat-badges",
      name: "Badges",
      description: "Trophies on display in your profile.",
      builtIn: true,
      items: [
        { id: "badge-bronze", categoryId: "cat-badges", name: "Bronze Star", rarity: "common", kind: "unlock" },
        { id: "badge-silver", categoryId: "cat-badges", name: "Silver Star", rarity: "uncommon", kind: "unlock" },
        { id: "badge-gold", categoryId: "cat-badges", name: "Gold Star", rarity: "rare", kind: "unlock" },
        { id: "badge-platinum", categoryId: "cat-badges", name: "Platinum Medal", rarity: "epic", kind: "unlock" },
        { id: "badge-trophy", categoryId: "cat-badges", name: "Metro Trophy", rarity: "legendary", kind: "unlock" },
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
