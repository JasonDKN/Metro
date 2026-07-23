// ============================================================================
// Shared reward-display helpers — used by both the Battlepass page (tier
// track, reward pool) and the Inventory page (equip hub), so a reward looks
// the same wherever it shows up instead of two divergent implementations.
// ============================================================================

import { store } from "../data/store.js";
import { el } from "./dom.js";
import { BUILT_IN_AVATARS } from "../data/defaults.js";

/** Accent-color pairs mirroring each built-in theme's CSS custom properties
 * (see body[data-theme="..."] in styles.css) — used to render a small
 * gradient swatch for theme rewards instead of a generic icon, so you can
 * see roughly what you're getting. User-added themes fall back to the
 * default gradient. */
export const THEME_SWATCHES: Record<string, [string, string]> = {
  "theme-default": ["#5b8cff", "#7b6bff"],
  "theme-sunset": ["#ff8a5c", "#ff5c8a"],
  "theme-forest": ["#4fbf7a", "#8fd35e"],
  "theme-midnight": ["#7b8bff", "#4a5bcf"],
  "theme-ocean": ["#38c6d9", "#4f8ff0"],
  "theme-neon": ["#ff2fd0", "#2ff3ff"],
  "theme-sakura": ["#ff9ec4", "#ffc9de"],
  "theme-aurora": ["#4ff0c0", "#9a6bff"],
};

/** A little visual stand-in for a reward: a color swatch for themes (pulled
 * from THEME_SWATCHES), the stored emoji for avatars, and a fitting emoji
 * per other built-in category. Anything from a user-added category — where
 * there's no way to know what it should look like — gets a generic gift
 * icon. Keeps pages from being a wall of plain text. */
export function rewardVisual(categoryId: string, itemId: string, description?: string): HTMLElement {
  if (categoryId === "cat-themes") {
    const [c1, c2] = THEME_SWATCHES[itemId] ?? THEME_SWATCHES["theme-default"];
    return el("span", { class: "reward-icon theme-swatch", style: `background: linear-gradient(135deg, ${c1}, ${c2});` });
  }
  const icon =
    categoryId === "cat-avatars"
      ? description || "🧑"
      : categoryId === "cat-titles"
        ? "🎖️"
        : categoryId === "cat-effects"
          ? "✨"
          : categoryId === "cat-streak-freeze"
            ? "❄️"
            : categoryId === "cat-wildcard"
              ? "🃏"
              : "🎁";
  return el("span", { class: "reward-icon" }, [icon]);
}

/** The avatar/name/title/tier-progress banner shown at the top of both the
 * Battlepass and Inventory pages. */
export function renderProfileBanner(): HTMLElement {
  const state = store.getState();
  const s = state.settings;
  const bp = state.battlepass;

  const builtInAvatar = BUILT_IN_AVATARS.find((a) => a.id === s.activeAvatarId);
  const avatarEmoji =
    builtInAvatar?.emoji ??
    bp.categories.find((c) => c.id === "cat-avatars")?.items.find((i) => i.id === s.activeAvatarId)?.description ??
    "🧭";
  const titleItem = s.activeTitleId
    ? bp.categories.find((c) => c.id === "cat-titles")?.items.find((i) => i.id === s.activeTitleId)
    : null;

  const nextTier = bp.tiers.find((t) => t.tier === bp.currentTier + 1);
  const currentTierPoints = bp.tiers.find((t) => t.tier === bp.currentTier)?.pointsRequired ?? 0;
  const span = nextTier ? nextTier.pointsRequired - currentTierPoints : 1;
  const progress = nextTier ? Math.min(1, Math.max(0, (bp.seasonPoints - currentTierPoints) / (span || 1))) : 1;

  return el("div", { class: "card profile-banner" }, [
    el("div", { class: "profile-avatar" }, [avatarEmoji]),
    el("div", { style: "flex:1; min-width:160px;" }, [
      el("div", { class: "profile-name" }, [s.assistantName, titleItem ? el("span", { class: "profile-title" }, [titleItem.name]) : null]),
      el("div", { class: "muted small" }, [
        nextTier ? `${bp.seasonPoints} / ${nextTier.pointsRequired} pts to Tier ${nextTier.tier}` : `${bp.seasonPoints} pts — max tier reached`,
      ]),
      el("div", { class: "progress-bar", style: "margin-top:6px;" }, [el("div", { style: `width:${Math.round(progress * 100)}%` })]),
    ]),
    el("div", { class: "profile-tier-badge" }, [el("div", {}, [String(bp.currentTier)]), el("div", { class: "small" }, ["TIER"])]),
  ]);
}
