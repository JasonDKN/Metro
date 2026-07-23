// ============================================================================
// Battlepass page — season progress, tier track, reward gallery, inventory,
// season history, and management of the reward pool (new categories/items
// can be added at any time without touching previously unlocked rewards).
// ============================================================================

import { store } from "../data/store.js";
import { mountNav } from "../ui/nav.js";
import { el, clear, qs } from "../ui/dom.js";
import type { Rarity, RewardKind } from "../types.js";
import { formatMonthLabel } from "../util/date.js";
import { rarityLabel } from "../data/rewards.js";
import { BUILT_IN_AVATARS } from "../data/defaults.js";

const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** Accent-color pairs mirroring each built-in theme's CSS custom properties
 * (see body[data-theme="..."] in styles.css) — used to render a small
 * gradient swatch for theme rewards instead of a generic icon, so you can
 * see roughly what you're getting. User-added themes fall back to the
 * default gradient. */
const THEME_SWATCHES: Record<string, [string, string]> = {
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
 * icon. Keeps the page from being a wall of plain text. */
function rewardVisual(categoryId: string, itemId: string, description?: string): HTMLElement {
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

function renderProfileBanner(): HTMLElement {
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

function renderHeader(): HTMLElement {
  const state = store.getState();
  const bp = state.battlepass;
  return el("div", { class: "stat-row", style: "margin-bottom: 20px;" }, [
    el("div", { class: "stat-tile" }, [el("div", { class: "value" }, [formatMonthLabel(bp.currentMonthKey)]), el("div", { class: "label" }, ["Current Season"])]),
    el("div", { class: "stat-tile" }, [el("div", { class: "value" }, [String(bp.seasonPoints)]), el("div", { class: "label" }, ["Season Points"])]),
    el("div", { class: "stat-tile" }, [el("div", { class: "value" }, [String(bp.currentTier)]), el("div", { class: "label" }, [`Tier (of ${bp.tiers.length})`])]),
    el("div", { class: "stat-tile" }, [el("div", { class: "value" }, [String(bp.lifetimePoints)]), el("div", { class: "label" }, ["Lifetime Points"])]),
  ]);
}

function renderTierTrack(): HTMLElement {
  const bp = store.getState().battlepass;
  const roadmapByTier = new Map(bp.rewardRoadmap.map((r) => [r.tier, r]));

  return el("div", { class: "card" }, [
    el("h2", {}, ["Tier Track"]),
    el("p", { class: "muted small" }, [
      "Every tier grants one specific reward — no randomization — in increasing rarity as you climb. Here's the whole roadmap.",
    ]),
    el(
      "div",
      { class: "tier-roadmap" },
      bp.tiers.map((t) => {
        const roadmap = roadmapByTier.get(t.tier);
        const category = roadmap ? bp.categories.find((c) => c.id === roadmap.categoryId) : undefined;
        const item = roadmap ? category?.items.find((i) => i.id === roadmap.itemId) : undefined;
        const status: "reached" | "next" | "locked" =
          t.tier <= bp.currentTier ? "reached" : t.tier === bp.currentTier + 1 ? "next" : "locked";

        return el("div", { class: `tier-card tier-${status}` }, [
          el("div", { class: "tier-card-top" }, [
            el("div", { class: "tier-badge" }, [String(t.tier)]),
            el("div", { class: "muted small" }, [`${t.pointsRequired} pts`]),
          ]),
          item && category
            ? el("div", { class: "tier-reward" }, [
                rewardVisual(category.id, item.id, item.description),
                el("div", {}, [
                  el("div", { class: "tier-reward-name" }, [item.name]),
                  el("div", { class: `rarity-${item.rarity} small` }, [
                    rarityLabel(item.rarity),
                    item.kind === "consumable" ? " · consumable" : "",
                  ]),
                ]),
              ])
            : el("p", { class: "muted small", style: "margin:0;" }, ["No reward assigned yet — add one from the pool below."]),
          el("div", { class: `tier-status${status === "locked" ? " locked" : ""}` }, [
            status === "reached" ? "✓ Unlocked" : status === "next" ? "Next up" : "🔒 Locked",
          ]),
        ]);
      })
    ),
  ]);
}

function renderInventory(): HTMLElement {
  return el("div", { class: "card" }, [
    el("h2", {}, ["Inventory"]),
    el("div", { class: "stat-row" }, [
      el("div", { class: "stat-tile" }, [el("div", { class: "value" }, [`❄️ ${store.streakFreezeCount()}`]), el("div", { class: "label" }, ["Streak Freezes"])]),
      el("div", { class: "stat-tile" }, [el("div", { class: "value" }, [`🃏 ${store.wildcardCount()}`]), el("div", { class: "label" }, ["Wildcards"])]),
    ]),
    el("p", { class: "muted small", style: "margin-top:10px;" }, ["Use Streak Freezes and Wildcards from the Daily Checklist page."]),
  ]);
}

function renderUnlockedGallery(): HTMLElement {
  const bp = store.getState().battlepass;
  if (bp.unlocked.length === 0) {
    return el("div", { class: "card" }, [el("h2", {}, ["Unlocked Rewards"]), el("div", { class: "empty-state" }, ["Complete tasks to earn your first reward!"])]);
  }
  const sorted = [...bp.unlocked].sort((a, b) => (a.unlockedAt < b.unlockedAt ? 1 : -1));
  return el("div", { class: "card" }, [
    el("h2", {}, ["Unlocked Rewards"]),
    el(
      "div",
      { class: "reward-grid" },
      sorted.map((r) => {
        const item = bp.categories.find((c) => c.id === r.categoryId)?.items.find((i) => i.id === r.rewardId);
        return el("div", { class: "reward-chip" }, [
          rewardVisual(r.categoryId, r.rewardId, item?.description),
          el("div", {}, [
            el("div", { class: "name" }, [r.name]),
            el("div", { class: `rarity-${r.rarity}` }, [rarityLabel(r.rarity)]),
            el("div", { class: "muted" }, [`${r.categoryName} · Tier ${r.tier}`]),
          ]),
        ]);
      })
    ),
  ]);
}

function renderRewardPool(): HTMLElement {
  const bp = store.getState().battlepass;
  const unlockedUnlockIds = new Set(bp.unlocked.filter((u) => u.kind === "unlock").map((u) => u.rewardId));

  const categoryBlocks = bp.categories.map((cat) => {
    const addItemForm = renderAddItemForm(cat.id);
    return el("div", { class: "category-block" }, [
      el("h4", {}, [
        cat.name,
        !cat.builtIn
          ? el("button", { class: "small danger ghost", style: "margin-left:8px;", onclick: () => store.deleteRewardCategory(cat.id) }, ["Delete category"])
          : null,
      ]),
      cat.description ? el("p", { class: "muted small" }, [cat.description]) : null,
      el(
        "div",
        { class: "reward-grid" },
        cat.items.map((item) => {
          const owned = item.kind === "consumable" || unlockedUnlockIds.has(item.id);
          return el("div", { class: "reward-chip", style: owned ? "" : "opacity:0.5;" }, [
            rewardVisual(cat.id, item.id, item.description),
            el("div", {}, [
              el("div", { class: "name" }, [item.name + (owned ? " ✓" : "")]),
              el("div", { class: `rarity-${item.rarity}` }, [rarityLabel(item.rarity), item.kind === "consumable" ? " · consumable" : ""]),
              el("button", { class: "small danger ghost", style: "margin-top:4px;", onclick: () => store.deleteRewardItem(cat.id, item.id) }, ["Remove"]),
            ]),
          ]);
        })
      ),
      addItemForm,
    ]);
  });

  return el("div", { class: "card" }, [
    el("h2", {}, ["Reward Pool"]),
    el("p", { class: "muted small" }, [
      "Each tier grants one specific reward from this pool, assigned in ascending rarity order — see the Tier Track above for exactly what's coming, no surprises. Add new categories or items any time; it never affects what you've already unlocked, and new items become available to fill any tier that's still waiting on one.",
    ]),
    ...categoryBlocks,
    renderAddCategoryForm(),
  ]);
}

function renderAddItemForm(categoryId: string): HTMLElement {
  const nameInput = el("input", { type: "text", placeholder: "Reward name" }) as HTMLInputElement;
  const raritySelect = el("select", {}, RARITIES.map((r, i) => el("option", { value: r, selected: i === 0 }, [rarityLabel(r)]))) as HTMLSelectElement;
  const kindSelect = el("select", {}, [
    el("option", { value: "unlock", selected: true }, ["One-time unlock"]),
    el("option", { value: "consumable" }, ["Consumable (stackable)"]),
  ]) as HTMLSelectElement;
  const submit = () => {
    if (!nameInput.value.trim()) return;
    store.addRewardItem(categoryId, nameInput.value, raritySelect.value as Rarity, kindSelect.value as RewardKind);
    nameInput.value = "";
  };
  return el("div", { class: "inline-form", style: "margin-top: 6px;" }, [
    el("div", { class: "field" }, [el("label", {}, ["New reward"]), nameInput]),
    el("div", { class: "field", style: "flex: 0 0 150px;" }, [el("label", {}, ["Rarity"]), raritySelect]),
    el("div", { class: "field", style: "flex: 0 0 180px;" }, [el("label", {}, ["Kind"]), kindSelect]),
    el("button", { class: "small primary", onclick: submit }, ["Add to pool"]),
  ]);
}

function renderAddCategoryForm(): HTMLElement {
  const nameInput = el("input", { type: "text", placeholder: "e.g. Playlists, Snacks, Screen Time" }) as HTMLInputElement;
  const descInput = el("input", { type: "text", placeholder: "Optional description" }) as HTMLInputElement;
  const submit = () => {
    if (!nameInput.value.trim()) return;
    store.addRewardCategory(nameInput.value, descInput.value);
    nameInput.value = "";
    descInput.value = "";
  };
  return el("div", { class: "inline-form", style: "margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border);" }, [
    el("div", { class: "field" }, [el("label", {}, ["New reward category"]), nameInput]),
    el("div", { class: "field" }, [el("label", {}, ["Description"]), descInput]),
    el("button", { class: "primary", onclick: submit }, ["Add Category"]),
  ]);
}

function renderSeasonHistory(): HTMLElement | null {
  const bp = store.getState().battlepass;
  const entries = Object.entries(bp.seasonHistory).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  if (entries.length === 0) return null;
  return el("div", { class: "card" }, [
    el("h2", {}, ["Past Seasons"]),
    el(
      "div",
      { class: "history-list" },
      entries.map(([monthKey, data]) =>
        el("div", { class: "history-row" }, [
          el("span", {}, [formatMonthLabel(monthKey)]),
          el("span", {}, [`${data.pointsEarned} pts · Tier ${data.highestTier}`]),
        ])
      )
    ),
  ]);
}

function render(): void {
  const root = qs<HTMLElement>("#page-root");
  clear(root);
  root.appendChild(renderProfileBanner());
  root.appendChild(renderHeader());
  root.appendChild(renderTierTrack());
  root.appendChild(renderInventory());
  root.appendChild(renderUnlockedGallery());
  root.appendChild(renderRewardPool());
  const history = renderSeasonHistory();
  if (history) root.appendChild(history);
}

document.addEventListener("DOMContentLoaded", () => {
  mountNav("battlepass");
  render();
  store.subscribe(render);
});
