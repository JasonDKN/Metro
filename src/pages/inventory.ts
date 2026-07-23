// ============================================================================
// Inventory page — the main hub for everything you've unlocked: themes,
// avatars, titles, celebration effects, streak freeze tokens, wildcard
// tokens, and any custom reward categories added from the Battlepass page.
// This is where you equip a theme/avatar/title (replacing the old
// "Appearance & Rank" section that used to live on Settings) and browse
// what's still locked, with a heads-up on which tier unlocks it.
// ============================================================================

import { store } from "../data/store.js";
import { mountNav } from "../ui/nav.js";
import { el, clear, qs } from "../ui/dom.js";
import { rarityLabel } from "../data/rewards.js";
import { rewardVisual, renderProfileBanner } from "../ui/rewardVisuals.js";
import { DEFAULT_THEME_ID, DEFAULT_AVATAR_ID, BUILT_IN_THEMES, BUILT_IN_AVATARS } from "../data/defaults.js";
import { showToast } from "../ui/toast.js";
import type { RewardItem } from "../types.js";

/** Which tier (if any) grants this item, for a locked item's "Unlocks at
 * Tier N" hint. */
function tierForItem(itemId: string): number | null {
  const bp = store.getState().battlepass;
  return bp.rewardRoadmap.find((r) => r.itemId === itemId)?.tier ?? null;
}

function equipButtonFor(categoryId: string, item: RewardItem): HTMLElement | null {
  const s = store.getState().settings;

  if (categoryId === "cat-themes") {
    const active = s.activeThemeId === item.id;
    return el(
      "button",
      {
        class: `small${active ? "" : " primary"}`,
        disabled: active,
        onclick: () => {
          store.setActiveTheme(item.id);
          showToast("Theme equipped", item.name);
        },
      },
      [active ? "Equipped ✓" : "Equip"]
    );
  }
  if (categoryId === "cat-avatars") {
    const active = s.activeAvatarId === item.id;
    return el(
      "button",
      {
        class: `small${active ? "" : " primary"}`,
        disabled: active,
        onclick: () => {
          store.setActiveAvatar(item.id);
          showToast("Avatar equipped", item.name);
        },
      },
      [active ? "Equipped ✓" : "Equip"]
    );
  }
  if (categoryId === "cat-titles") {
    const active = s.activeTitleId === item.id;
    return el(
      "button",
      {
        class: `small${active ? "" : " primary"}`,
        disabled: active,
        onclick: () => {
          store.setActiveTitle(item.id);
          showToast("Title equipped", item.name);
        },
      },
      [active ? "Equipped ✓" : "Equip"]
    );
  }
  return null;
}

function renderBuiltInBaseline(): HTMLElement {
  const s = store.getState().settings;
  return el("div", { class: "card" }, [
    el("h2", {}, ["Always Available"]),
    el("p", { class: "muted small" }, ["Your baseline theme and avatar — no unlocking required."]),
    el("div", { class: "reward-grid" }, [
      ...BUILT_IN_THEMES.map((t) =>
        el("div", { class: "reward-chip" }, [
          rewardVisual("cat-themes", t.id),
          el("div", {}, [
            el("div", { class: "name" }, [t.name]),
            el("div", { class: "muted" }, ["Default theme"]),
            equipButtonFor("cat-themes", { id: t.id, categoryId: "cat-themes", name: t.name, rarity: "common", kind: "unlock" }),
          ]),
        ])
      ),
      ...BUILT_IN_AVATARS.map((a) =>
        el("div", { class: "reward-chip" }, [
          rewardVisual("cat-avatars", a.id, a.emoji),
          el("div", {}, [
            el("div", { class: "name" }, [a.name]),
            el("div", { class: "muted" }, ["Default avatar"]),
            equipButtonFor("cat-avatars", { id: a.id, categoryId: "cat-avatars", name: a.name, rarity: "common", kind: "unlock" }),
          ]),
        ])
      ),
    ]),
    s.activeTitleId
      ? el("div", { style: "margin-top:14px;" }, [
          el("button", { class: "small danger ghost", onclick: () => { store.setActiveTitle(null); showToast("Title removed"); } }, ["Remove equipped title"]),
        ])
      : null,
  ]);
}

function renderCategory(categoryId: string): HTMLElement | null {
  const bp = store.getState().battlepass;
  const cat = bp.categories.find((c) => c.id === categoryId);
  if (!cat || cat.items.length === 0) return null;

  const earnedIds = new Set(store.getUnlockedItemIds(categoryId));
  const inventory = bp.inventory;

  const sorted = [...cat.items].sort((a, b) => {
    const aEarned = a.kind === "consumable" || earnedIds.has(a.id);
    const bEarned = b.kind === "consumable" || earnedIds.has(b.id);
    if (aEarned !== bEarned) return aEarned ? -1 : 1;
    return 0;
  });

  return el("div", { class: "card" }, [
    el("h2", {}, [cat.name]),
    cat.description ? el("p", { class: "muted small" }, [cat.description]) : null,
    el(
      "div",
      { class: "reward-grid" },
      sorted.map((item) => {
        const owned = item.kind === "consumable" ? true : earnedIds.has(item.id);
        const locked = !owned;
        const equip = owned ? equipButtonFor(categoryId, item) : null;
        const unlockTier = locked ? tierForItem(item.id) : null;

        return el("div", { class: `reward-chip${locked ? " locked-chip" : ""}` }, [
          rewardVisual(categoryId, item.id, item.description),
          el("div", { style: "flex:1;" }, [
            el("div", { class: "name" }, [item.name + (item.kind === "unlock" && owned ? " ✓" : "")]),
            el("div", { class: `rarity-${item.rarity}` }, [
              rarityLabel(item.rarity),
              item.kind === "consumable" ? ` · consumable · have ${inventory[item.id] ?? 0}` : "",
            ]),
            locked
              ? el("div", { class: "muted small" }, [unlockTier ? `🔒 Unlocks at Tier ${unlockTier}` : "🔒 Not yet on the roadmap"])
              : null,
            equip ? el("div", { style: "margin-top:6px;" }, [equip]) : null,
          ]),
        ]);
      })
    ),
  ]);
}

function render(): void {
  const root = qs<HTMLElement>("#page-root");
  clear(root);
  root.appendChild(renderProfileBanner());
  root.appendChild(renderBuiltInBaseline());

  const bp = store.getState().battlepass;
  for (const cat of bp.categories) {
    const block = renderCategory(cat.id);
    if (block) root.appendChild(block);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountNav("inventory");
  render();
  store.subscribe(render);
});
