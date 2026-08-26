// ============================================================================
// Inventory page — the main hub for everything you've unlocked: themes,
// avatars, titles, celebration effects, any consumable tokens,
// tokens, and any custom reward categories added from the Battlepass page.
// This is where you equip a theme/avatar/title/effect (replacing the old
// "Appearance & Rank" section that used to live on Settings). Only rewards
// you've actually unlocked are shown here — this is a trophy case, not a
// browsable catalog of what's still locked (that's what the Battlepass
// page's Tier Track is for).
// ============================================================================

import { store } from "../data/store.js";
import { mountNav } from "../ui/nav.js";
import { el, clear, qs } from "../ui/dom.js";
import { rarityLabel } from "../data/rewards.js";
import { rewardVisual, renderProfileBanner } from "../ui/rewardVisuals.js";
import { DEFAULT_THEME_ID, DEFAULT_AVATAR_ID, BUILT_IN_THEMES, BUILT_IN_AVATARS } from "../data/defaults.js";
import { showToast } from "../ui/toast.js";
import type { RewardItem } from "../types.js";

/** Whether this specific reward item is actually owned — 'unlock' kind
 * items use the live equip-eligibility check; consumables (only ever
 * user-added now) use "has this ever been granted", since their current
 * inventory count can legitimately drop to 0 from spending without that
 * meaning you never earned it. */
function isOwned(categoryId: string, item: RewardItem): boolean {
  return item.kind === "consumable" ? store.hasBeenGranted(categoryId, item.id) : store.isRewardEarned(categoryId, item.id);
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
  if (categoryId === "cat-effects") {
    const active = s.activeEffectId === item.id;
    return el(
      "button",
      {
        class: `small${active ? "" : " primary"}`,
        disabled: active,
        onclick: () => {
          store.setActiveEffect(item.id);
          showToast("Celebration effect equipped", `${item.name} will now play when you clear your daily checklist.`);
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

/** Only unlocked rewards are shown — this page is a trophy case of what
 * you've actually earned, not a catalog of everything still locked (that
 * preview lives on the Battlepass page's Tier Track instead). A category
 * with nothing unlocked yet in it is hidden entirely rather than shown
 * empty. */
function renderCategory(categoryId: string): HTMLElement | null {
  const bp = store.getState().battlepass;
  const s = store.getState().settings;
  const cat = bp.categories.find((c) => c.id === categoryId);
  if (!cat || cat.items.length === 0) return null;

  const ownedItems = cat.items.filter((item) => isOwned(categoryId, item));
  if (ownedItems.length === 0) return null;

  const inventory = bp.inventory;

  return el("div", { class: "card" }, [
    el("h2", {}, [cat.name]),
    cat.description ? el("p", { class: "muted small" }, [cat.description]) : null,
    el(
      "div",
      { class: "reward-grid" },
      ownedItems.map((item) => {
        const equip = equipButtonFor(categoryId, item);
        return el("div", { class: "reward-chip" }, [
          rewardVisual(categoryId, item.id, item.description, {
            imageDataUrl: item.imageDataUrl,
            revealed: true,
            title: item.name,
            subtitle: rarityLabel(item.rarity),
            caption: item.flavorText,
          }),
          el("div", { style: "flex:1;" }, [
            el("div", { class: "name" }, [item.name + (item.kind === "unlock" ? " ✓" : "")]),
            el("div", { class: `rarity-${item.rarity}` }, [
              rarityLabel(item.rarity),
              item.kind === "consumable" ? ` · consumable · have ${inventory[item.id] ?? 0}` : "",
            ]),
            item.flavorText ? el("div", { class: "muted small", style: "margin-top:4px;" }, [item.flavorText]) : null,
            equip ? el("div", { style: "margin-top:6px;" }, [equip]) : null,
          ]),
        ]);
      })
    ),
    categoryId === "cat-effects" && s.activeEffectId
      ? el("div", { style: "margin-top:14px;" }, [
          el(
            "button",
            {
              class: "small danger ghost",
              onclick: () => {
                store.setActiveEffect(null);
                showToast("Reset to default effect", "Confetti Burst will play again.");
              },
            },
            ["Reset to default (Confetti Burst)"]
          ),
        ])
      : null,
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
