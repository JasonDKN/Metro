// ============================================================================
// Shared reward-display helpers — used by both the Battlepass page (tier
// track, reward pool) and the Inventory page (equip hub), so a reward looks
// the same wherever it shows up instead of two divergent implementations.
// ============================================================================

import { store } from "../data/store.js";
import { el } from "./dom.js";
import { BUILT_IN_AVATARS } from "../data/defaults.js";
import { openImageLightbox } from "./lightbox.js";

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
  "theme-i-purple-you": ["#a374ff", "#6c3fc9"],
};

/** Extra display info for rewardVisual, beyond what's needed for the plain
 * text/emoji cases. Photocard images are opt-in and gated by `revealed` —
 * see rewardVisual's Photocards branch — so a caller can never accidentally
 * leak a photo attached ahead of time to a tier that isn't reached yet. */
export interface RewardVisualOptions {
  imageDataUrl?: string;
  revealed?: boolean;
  /** Captions for the enlarged view opened when an owned Photocard's
   * thumbnail is clicked. Purely cosmetic — a Photocard with none of these
   * still opens, just without a caption block. */
  title?: string;
  subtitle?: string;
  caption?: string;
}

/** A little visual stand-in for a reward: a color swatch for themes (pulled
 * from THEME_SWATCHES), the stored emoji for avatars, an actual photo
 * thumbnail for an owned Photocard (a mystery card back otherwise, even if
 * a photo has already been uploaded — see RewardVisualOptions), and a
 * fitting emoji per other built-in category. Anything from a user-added
 * category — where there's no way to know what it should look like — gets
 * a generic gift icon. Keeps pages from being a wall of plain text. */
export function rewardVisual(categoryId: string, itemId: string, description?: string, opts?: RewardVisualOptions): HTMLElement {
  if (categoryId === "cat-themes") {
    // A user-created theme has no THEME_SWATCHES entry — its colours live on
    // the item itself, so the swatch shows what it will actually look like
    // rather than a generic default gradient.
    const custom = store
      .getState()
      .battlepass.categories.find((c) => c.id === "cat-themes")
      ?.items.find((i) => i.id === itemId)?.colors;
    const [c1, c2] = custom ?? THEME_SWATCHES[itemId] ?? THEME_SWATCHES["theme-default"];
    return el("span", { class: "reward-icon theme-swatch", style: `background: linear-gradient(135deg, ${c1}, ${c2});` });
  }
  if (categoryId === "cat-photocards") {
    if (opts?.revealed && opts.imageDataUrl) {
      // A real, owned photo — make it clickable so it can be viewed at a
      // size worth looking at. This is deliberately the ONLY place a
      // lightbox gets wired up for Photocards: it sits behind the same
      // `revealed && imageDataUrl` check that decides whether the photo is
      // rendered at all, so a locked card can never become openable no
      // matter which page is doing the rendering.
      const src = opts.imageDataUrl;
      return el(
        "button",
        {
          type: "button",
          class: "reward-icon photocard-thumb photocard-openable",
          title: opts.title ? `${opts.title} — click to enlarge` : "Click to enlarge",
          "aria-label": opts.title ? `Enlarge ${opts.title}` : "Enlarge photocard",
          onclick: (e: Event) => {
            // Photocards render inside cards and rows that have their own
            // click behavior in places; keep the click from doing double duty.
            e.stopPropagation();
            openImageLightbox({ src, title: opts.title, subtitle: opts.subtitle, caption: opts.caption });
          },
        },
        [el("img", { src, alt: opts.title ?? "Photocard" })]
      );
    }
    // Not yet unlocked (or unlocked with no photo attached yet) — always a
    // mystery card back, regardless of whether a photo already exists on
    // the item, so nothing leaks before the tier is actually reached.
    return el("span", { class: "reward-icon photocard-mystery" }, ["🎴"]);
  }
  const icon =
    categoryId === "cat-avatars"
      ? description || "🧑"
      : categoryId === "cat-stickers"
        ? description || "⭐"
        : categoryId === "cat-titles"
          ? "🎖️"
          : categoryId === "cat-effects"
            ? "✨"
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
