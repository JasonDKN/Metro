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

const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

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
  return el("div", { class: "card" }, [
    el("h2", {}, ["Tier Track"]),
    el(
      "div",
      { class: "tier-track" },
      bp.tiers.map((t) =>
        el("div", { class: `tier-node${t.tier <= bp.currentTier ? " reached" : ""}` }, [
          el("div", { class: "tier-num" }, [String(t.tier)]),
          el("div", { class: "muted" }, [`${t.pointsRequired} pts`]),
        ])
      )
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
      sorted.map((r) =>
        el("div", { class: "reward-chip" }, [
          el("div", { class: "name" }, [r.name]),
          el("div", { class: `rarity-${r.rarity}` }, [rarityLabel(r.rarity)]),
          el("div", { class: "muted" }, [`${r.categoryName} · Tier ${r.tier}`]),
        ])
      )
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
            el("div", { class: "name" }, [item.name + (owned ? " ✓" : "")]),
            el("div", { class: `rarity-${item.rarity}` }, [rarityLabel(item.rarity), item.kind === "consumable" ? " · consumable" : ""]),
            el("button", { class: "small danger ghost", onclick: () => store.deleteRewardItem(cat.id, item.id) }, ["Remove"]),
          ]);
        })
      ),
      addItemForm,
    ]);
  });

  return el("div", { class: "card" }, [
    el("h2", {}, ["Reward Pool"]),
    el("p", { class: "muted small" }, [
      "Every tier grants a randomly-rolled reward from this pool — rarer rewards get more likely at higher tiers. Add new categories or items any time; it never affects what you've already unlocked.",
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
