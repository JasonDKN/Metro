// ============================================================================
// Battlepass reward roadmap helpers. Rewards are fully deterministic — each
// tier grants one specific item, in ascending rarity order, never randomly
// rolled. The curated tier 1-15 assignments live in DEFAULT_REWARD_ROADMAP
// (data/defaults.ts); this file provides the rarity helpers plus a fallback
// for picking a reward for any tier that doesn't have a curated entry (e.g.
// a tier added later in Settings, past the built-in 15).
// ============================================================================

import type { Rarity, RewardCategory } from "../types.js";

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export function rarityLabel(r: Rarity): string {
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

/** Picks the next not-yet-assigned reward item, lowest rarity first, for a
 * tier that doesn't have a curated roadmap entry. `excludeItemIds` should
 * include every item id already assigned to another tier (so 'unlock' kind
 * rewards are never promised twice) — consumables (Streak Freeze, Wildcard)
 * are fine to exclude too here since each is only meant to anchor one tier
 * in the roadmap, even though they can still stack in your inventory. */
export function nextRoadmapItem(
  categories: RewardCategory[],
  excludeItemIds: Set<string>
): { categoryId: string; itemId: string } | null {
  const eligible: { categoryId: string; itemId: string; rarity: Rarity }[] = [];
  for (const cat of categories) {
    for (const item of cat.items) {
      if (excludeItemIds.has(item.id)) continue;
      eligible.push({ categoryId: cat.id, itemId: item.id, rarity: item.rarity });
    }
  }
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity));
  return eligible[0];
}
