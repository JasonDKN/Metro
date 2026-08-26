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
import { rewardVisual, renderProfileBanner } from "../ui/rewardVisuals.js";
import { showToast } from "../ui/toast.js";
import { fileToResizedDataUrl } from "../ui/image.js";

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
  const roadmapByTier = new Map(bp.rewardRoadmap.map((r) => [r.tier, r]));

  return el("div", { class: "card" }, [
    el("h2", {}, ["Tier Track"]),
    el("p", { class: "muted small" }, [
      `Every tier grants one specific reward — no randomization — in increasing rarity as you climb. All ${bp.tiers.length} tiers in this season are listed below, locked ones included, so you can always see exactly what's coming.`,
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
                rewardVisual(category.id, item.id, item.description, {
                  imageDataUrl: item.imageDataUrl,
                  revealed: status === "reached",
                  title: item.name,
                  subtitle: rarityLabel(item.rarity),
                  caption: item.flavorText,
                }),
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

function renderUnlockedGallery(): HTMLElement {
  const bp = store.getState().battlepass;
  if (bp.unlocked.length === 0) {
    return el("div", { class: "card" }, [el("h2", {}, ["Unlocked Rewards"]), el("div", { class: "empty-state" }, ["Complete tasks to earn your first reward!"])]);
  }
  const inventoryNote = el("p", { class: "muted small" }, [
    "Everything you've earned lives on the ",
    el("a", { href: "inventory.html" }, ["Inventory"]),
    " page, where themes, avatars, titles, and celebration effects can be equipped.",
  ]);
  const sorted = [...bp.unlocked].sort((a, b) => (a.unlockedAt < b.unlockedAt ? 1 : -1));
  return el("div", { class: "card" }, [
    el("h2", {}, ["Unlocked Rewards"]),
    inventoryNote,
    el(
      "div",
      { class: "reward-grid" },
      sorted.map((r) => {
        const item = bp.categories.find((c) => c.id === r.categoryId)?.items.find((i) => i.id === r.rewardId);
        return el("div", { class: "reward-chip" }, [
          rewardVisual(r.categoryId, r.rewardId, item?.description, {
            imageDataUrl: item?.imageDataUrl,
            revealed: true,
            title: r.name,
            subtitle: `${rarityLabel(r.rarity)} · ${r.categoryName} · Tier ${r.tier}`,
            caption: item?.flavorText,
          }),
          el("div", {}, [
            el("div", { class: "name" }, [r.name]),
            el("div", { class: `rarity-${r.rarity}` }, [rarityLabel(r.rarity)]),
            el("div", { class: "muted" }, [`${r.categoryName} · Tier ${r.tier}`]),
            item?.flavorText ? el("div", { class: "muted small", style: "margin-top:4px;" }, [item.flavorText]) : null,
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
            rewardVisual(cat.id, item.id, item.description, {
              imageDataUrl: item.imageDataUrl,
              revealed: owned,
              title: item.name,
              subtitle: rarityLabel(item.rarity),
              caption: item.flavorText,
            }),
            el("div", { style: "flex:1;" }, [
              el("div", { class: "name" }, [item.name + (owned ? " ✓" : "")]),
              el("div", { class: `rarity-${item.rarity}` }, [rarityLabel(item.rarity), item.kind === "consumable" ? " · consumable" : ""]),
              item.flavorText && owned ? el("div", { class: "muted small", style: "margin-top:2px;" }, [item.flavorText]) : null,
              cat.id === "cat-photocards" ? renderPhotoUploadControl(cat.id, item.id, !!item.imageDataUrl) : null,
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
      "Each tier grants one specific reward from this pool, assigned in ascending rarity order — see the Tier Track above for exactly what's coming (Photocards are the one exception: the name shows, but the photo itself stays hidden until you actually unlock it). Add new categories or items any time; it never affects what you've already unlocked, and new items become available to fill any tier that's still waiting on one.",
    ]),
    ...categoryBlocks,
    renderAddCategoryForm(),
  ]);
}

function renderAddItemForm(categoryId: string): HTMLElement {
  const isPhotocards = categoryId === "cat-photocards";
  const nameInput = el("input", { type: "text", placeholder: isPhotocards ? "Photocard name" : "Reward name" }) as HTMLInputElement;
  const raritySelect = el("select", {}, RARITIES.map((r, i) => el("option", { value: r, selected: i === 0 }, [rarityLabel(r)]))) as HTMLSelectElement;
  const kindSelect = el("select", {}, [
    el("option", { value: "unlock", selected: true }, ["One-time unlock"]),
    el("option", { value: "consumable" }, ["Consumable (stackable)"]),
  ]) as HTMLSelectElement;

  let pendingImage: string | undefined;
  const preview = el("img", { class: "photocard-upload-preview", style: "display:none;" }) as HTMLImageElement;
  const fileInput = el("input", { type: "file", accept: "image/*" }) as HTMLInputElement;
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      pendingImage = await fileToResizedDataUrl(file);
      preview.src = pendingImage;
      preview.style.display = "inline-block";
    } catch {
      showToast("Couldn't read that image", "Try a different file.");
    }
  });

  const submit = () => {
    if (!nameInput.value.trim()) return;
    const kind = isPhotocards ? "unlock" : (kindSelect.value as RewardKind);
    store.addRewardItem(categoryId, nameInput.value, raritySelect.value as Rarity, kind, "", { imageDataUrl: pendingImage });
    nameInput.value = "";
    fileInput.value = "";
    pendingImage = undefined;
    preview.style.display = "none";
  };

  return el("div", { class: "inline-form", style: "margin-top: 6px;" }, [
    el("div", { class: "field" }, [el("label", {}, ["New reward"]), nameInput]),
    el("div", { class: "field", style: "flex: 0 0 150px;" }, [el("label", {}, ["Rarity"]), raritySelect]),
    isPhotocards ? null : el("div", { class: "field", style: "flex: 0 0 180px;" }, [el("label", {}, ["Kind"]), kindSelect]),
    isPhotocards
      ? el("div", { class: "field" }, [
          el("label", {}, ["Photo (optional — you can add this later instead)"]),
          fileInput,
          preview,
        ])
      : null,
    el("button", { class: "small primary", onclick: submit }, ["Add to pool"]),
  ]);
}

/** Lets a photo be attached (or replaced) on an existing Photocard item at
 * any time — independent of when the item itself was created, so August's
 * placeholder can get its real photo whenever it's ready. The image stays
 * hidden everywhere else in the app until the item is actually owned (see
 * rewardVisual). */
function renderPhotoUploadControl(categoryId: string, itemId: string, hasImage: boolean): HTMLElement {
  const fileInput = el("input", { type: "file", accept: "image/*", style: "font-size:11px; max-width:150px;" }) as HTMLInputElement;
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      store.setRewardItemImage(categoryId, itemId, dataUrl);
      showToast("Photo saved", "It'll stay hidden until this tier is actually unlocked.");
    } catch {
      showToast("Couldn't read that image", "Try a different file.");
    }
  });
  return el("div", { style: "margin-top:4px;" }, [
    el("label", { class: "muted small", style: "display:block;" }, [hasImage ? "Replace photo" : "Add photo"]),
    fileInput,
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
