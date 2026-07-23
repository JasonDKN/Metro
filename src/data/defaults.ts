// ============================================================================
// Default content: starting points config, battlepass tiers, and the seed
// reward pool. All of this is editable/extendable at runtime from Settings —
// nothing here is hardcoded into the logic, it's just the initial state for
// a brand-new install.
// ============================================================================

import type { PointsConfig, RewardCategory, RewardRoadmapEntry, Tier, Settings } from "../types.js";

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
