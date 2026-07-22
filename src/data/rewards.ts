// ============================================================================
// Battlepass reward rolling. Kept separate from the store so the "randomized
// reward" rules can be tuned or replaced without touching state management.
// ============================================================================

import type { Rarity, RewardCategory, RewardItem } from "../types.js";

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** How likely each rarity is to be picked, based on how far through the
 * season's tier track the reached tier is. Early tiers lean common; late
 * tiers lean toward epic/legendary. Weights don't need to sum to 100 — they
 * are normalized at roll time. */
function rarityWeightsForProgress(progress: number): Record<Rarity, number> {
  if (progress <= 0.25) return { common: 60, uncommon: 30, rare: 8, epic: 2, legendary: 0 };
  if (progress <= 0.5) return { common: 35, uncommon: 40, rare: 20, epic: 4, legendary: 1 };
  if (progress <= 0.75) return { common: 15, uncommon: 30, rare: 35, epic: 15, legendary: 5 };
  return { common: 5, uncommon: 15, rare: 30, epic: 30, legendary: 20 };
}

export interface RollOptions {
  tierNumber: number;
  totalTiers: number;
  categories: RewardCategory[];
  /** Reward ids that are 'unlock' kind and already owned — excluded from
   * future rolls so you don't get a duplicate cosmetic. Consumables are
   * always eligible since stacking them is expected. */
  alreadyUnlockedUnlockIds: Set<string>;
  rng?: () => number;
}

/** Picks one reward item for a newly-reached tier, weighted by rarity. Returns
 * null only if literally every unlock-kind item across every category has
 * already been claimed and no consumables exist — meaning there's nothing
 * left to roll (a sign the user should add more reward categories/items). */
export function rollReward(opts: RollOptions): RewardItem | null {
  const { tierNumber, totalTiers, categories, alreadyUnlockedUnlockIds } = opts;
  const rng = opts.rng ?? Math.random;
  const progress = totalTiers > 0 ? tierNumber / totalTiers : 1;
  const weights = rarityWeightsForProgress(progress);

  const eligible: RewardItem[] = [];
  for (const cat of categories) {
    for (const item of cat.items) {
      if (item.kind === "unlock" && alreadyUnlockedUnlockIds.has(item.id)) continue;
      eligible.push(item);
    }
  }
  if (eligible.length === 0) return null;

  // Build a weighted pool: each item's weight comes from its rarity band.
  const weighted = eligible.map((item) => ({ item, weight: weights[item.rarity] || 1 }));
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);

  // If every eligible item happens to be in a zero-weight band (e.g. only
  // legendary items left at a low tier), fall back to uniform selection
  // rather than returning nothing.
  if (totalWeight <= 0) {
    return eligible[Math.floor(rng() * eligible.length)];
  }

  let roll = rng() * totalWeight;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.item;
  }
  return weighted[weighted.length - 1].item;
}

export function rarityLabel(r: Rarity): string {
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}
