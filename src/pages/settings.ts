// ============================================================================
// Settings page — assistant identity, points/tier tuning, Daily Puzzles
// management, and backup/restore. Appearance & Rank (theme/avatar/title selection) lives on the
// Inventory page now, alongside the rest of your unlocked rewards.
// ============================================================================

import { store } from "../data/store.js";
import type { RewardExtras } from "../data/store.js";
import { mountNav } from "../ui/nav.js";
import { el, clear, qs } from "../ui/dom.js";
import { DIFFICULTY_LABELS } from "../types.js";
import { rarityLabel } from "../data/rewards.js";
import { fileToResizedDataUrl } from "../ui/image.js";
import { emojiPicker } from "../ui/emojiPicker.js";
import { BACKGROUND_PATTERNS, FONT_STACKS } from "../data/defaults.js";
import type { Difficulty, Rarity, RewardItem, Tier } from "../types.js";
import { showToast } from "../ui/toast.js";
import { renderManagePuzzlesCard } from "../ui/dailyGames.js";

function renderIdentity(): HTMLElement {
  const state = store.getState();
  const nameInput = el("input", { type: "text", value: state.settings.assistantName }) as HTMLInputElement;
  return el("div", { class: "card" }, [
    el("h2", {}, ["Assistant Identity"]),
    el("div", { class: "inline-form" }, [
      el("div", { class: "field" }, [el("label", {}, ["Assistant name"]), nameInput]),
      el("button", { class: "primary", onclick: () => store.renameAssistant(nameInput.value) }, ["Save Name"]),
    ]),
    el("p", { class: "muted small" }, ["This name is saved on this computer and stays every time you reopen Metro."]),
  ]);
}

function renderPointsConfig(): HTMLElement {
  const state = store.getState();
  const inputs: Record<Difficulty, HTMLInputElement> = {} as any;
  const rows = ([1, 2, 3, 4, 5] as Difficulty[]).map((d) => {
    const input = el("input", { type: "text", inputmode: "numeric", value: String(state.settings.pointsConfig[d]) }) as HTMLInputElement;
    inputs[d] = input;
    return el("div", { class: "field", style: "flex: 0 0 140px;" }, [el("label", {}, [DIFFICULTY_LABELS[d]]), input]);
  });
  const save = () => {
    const next = { ...state.settings.pointsConfig };
    for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
      const n = Number(inputs[d].value);
      if (Number.isFinite(n) && n >= 0) next[d] = Math.round(n);
    }
    store.updatePointsConfig(next);
    showToast("Points updated", "New task completions will use these values.");
  };
  return el("div", { class: "card" }, [
    el("h2", {}, ["Points Per Difficulty"]),
    el("p", { class: "muted small" }, ["Harder tasks are worth more. Tune these values to whatever feels fair."]),
    el("div", { class: "inline-form" }, [...rows, el("button", { class: "primary", onclick: save }, ["Save"])]),
  ]);
}

const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** The animations celebrate() actually implements, offered when creating a
 * Celebration Effect. A user can't author a new animation — that's code — so
 * they pick which existing one their reward plays. */
const EFFECT_ANIMATIONS: { id: string; label: string }[] = [
  { id: "effect-confetti", label: "Confetti Burst" },
  { id: "effect-fireworks", label: "Fireworks" },
  { id: "effect-starfall", label: "Starfall" },
  { id: "effect-aurora", label: "Aurora Wave" },
  { id: "effect-purple-ocean", label: "Purple Ocean" },
  { id: "effect-divine-bell", label: "Divine Bell Chime" },
  { id: "effect-bangtan-flash", label: "Bangtan Bomb Flash" },
  { id: "effect-fanfare", label: "Metro Fanfare" },
];

/** Describes the reward a tier currently grants, for the editor's rows. */
function tierRewardLabel(tier: number): { text: string; manual: boolean } {
  const bp = store.getState().battlepass;
  const entry = bp.rewardRoadmap.find((r) => r.tier === tier);
  if (!entry) return { text: "No reward assigned", manual: false };
  const category = bp.categories.find((c) => c.id === entry.categoryId);
  const item = category?.items.find((i) => i.id === entry.itemId);
  if (!category || !item) return { text: "Reward no longer in the pool", manual: !!entry.manual };
  return { text: `${item.name} · ${rarityLabel(item.rarity)} · ${category.name}`, manual: !!entry.manual };
}

/** A <select> of every item in the reward pool, grouped by category. */
function rewardItemSelect(selectedItemId?: string): HTMLSelectElement {
  const bp = store.getState().battlepass;
  const select = el("select", { class: "reward-item-select", style: "max-width:280px;" }) as HTMLSelectElement;
  select.appendChild(el("option", { value: "" }, ["Let Metro choose"]));
  for (const cat of bp.categories) {
    if (cat.items.length === 0) continue;
    const group = el("optgroup", { label: cat.name }) as HTMLOptGroupElement;
    for (const item of cat.items) {
      const option = el("option", { value: `${cat.id}::${item.id}` }, [`${item.name} (${rarityLabel(item.rarity)})`]) as HTMLOptionElement;
      if (item.id === selectedItemId) option.selected = true;
      group.appendChild(option);
    }
    select.appendChild(group);
  }
  return select;
}

/** The per-category inputs for inventing a brand-new reward. Which fields
 * appear depends entirely on the category: a Photocard needs a picture, a
 * Sticker or Avatar needs an emoji, a Theme needs colours, an Effect needs to
 * know which animation to play, and a Title needs nothing but its name. */
/** Human names for the font stacks and background patterns, so the builder
 * offers "Typewriter" rather than a raw id. Anything not listed falls back to
 * its id, which keeps this from becoming a second place to forget to update. */
const FONT_LABELS: Record<string, string> = {
  "font-ledger": "Ledger — clean sans",
  "font-manuscript": "Manuscript — bookish serif",
  "font-marginalia": "Marginalia — humanist serif",
  "font-typewriter": "Typewriter — monospace",
  "font-copperplate": "Copperplate — display serif",
};

const PATTERN_LABELS: Record<string, string> = {
  "bg-legal-pad": "Legal Pad — horizontal rules",
  "bg-dot-grid": "Dot Grid",
  "bg-graph-paper": "Graph Paper",
  "bg-cork-board": "Cork Board — fine speckle",
  "bg-marbled-cover": "Marbled Cover — diagonal streaks",
};

function renderRewardBuilder(): { wrap: HTMLElement; create: () => { item: RewardItem; categoryId: string } | { error: string } } {
  const bp = store.getState().battlepass;

  const categorySelect = el(
    "select",
    { class: "reward-category-select" },
    bp.categories.map((c, i) => el("option", { value: c.id, selected: i === 0 }, [c.name]))
  ) as HTMLSelectElement;
  const nameInput = el("input", { type: "text", class: "reward-name-input", placeholder: "Reward name" }) as HTMLInputElement;
  const raritySelect = el(
    "select",
    { class: "reward-rarity-select" },
    RARITIES.map((r, i) => el("option", { value: r, selected: i === 0 }, [rarityLabel(r)]))
  ) as HTMLSelectElement;

  // --- Photocards: a picture ------------------------------------------------
  let pendingImage: string | undefined;
  const imagePreview = el("img", { class: "photocard-upload-preview", style: "display:none;" }) as HTMLImageElement;
  const fileInput = el("input", { type: "file", accept: "image/*" }) as HTMLInputElement;
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      pendingImage = await fileToResizedDataUrl(file);
      imagePreview.src = pendingImage;
      imagePreview.style.display = "inline-block";
    } catch {
      showToast("Couldn't read that image", "Try a different file.");
    }
  });
  const imageField = el("div", { class: "field" }, [
    el("label", {}, ["Photo (optional — you can upload it later)"]),
    fileInput,
    imagePreview,
  ]);

  // --- Stickers and Avatars: an emoji ---------------------------------------
  const picker = emojiPicker();
  const emojiField = el("div", { class: "field", style: "flex-basis:100%;" }, [el("label", {}, ["Pick an emoji"]), picker.wrap]);

  // --- Themes: two accent colours -------------------------------------------
  const color1 = el("input", { type: "color", value: "#5b8cff", class: "theme-color-input" }) as HTMLInputElement;
  const color2 = el("input", { type: "color", value: "#7b6bff", class: "theme-color-input" }) as HTMLInputElement;
  const swatch = el("span", { class: "reward-icon theme-swatch" });
  const paintSwatch = () => {
    swatch.setAttribute("style", `background: linear-gradient(135deg, ${color1.value}, ${color2.value});`);
  };
  color1.addEventListener("input", paintSwatch);
  color2.addEventListener("input", paintSwatch);
  paintSwatch();
  const themeField = el("div", { class: "field", style: "flex-basis:100%;" }, [
    el("label", {}, ["Theme colours"]),
    el("div", { style: "display:flex; align-items:center; gap:10px;" }, [color1, color2, swatch]),
    el("p", { class: "muted small", style: "margin:4px 0 0;" }, [
      "These become the app's two accent colours while the theme is equipped.",
    ]),
  ]);

  // --- Fonts: which stack it applies ----------------------------------------
  const fontSelect = el(
    "select",
    { class: "reward-font-select" },
    Object.keys(FONT_STACKS).map((id, i) =>
      el("option", { value: id, selected: i === 0, style: `font-family: ${FONT_STACKS[id]};` }, [FONT_LABELS[id] ?? id])
    )
  ) as HTMLSelectElement;
  const fontField = el("div", { class: "field" }, [el("label", {}, ["Typeface"]), fontSelect]);

  // --- Backgrounds: which pattern it shows ----------------------------------
  const patternSelect = el(
    "select",
    { class: "reward-pattern-select" },
    BACKGROUND_PATTERNS.map((id, i) => el("option", { value: id, selected: i === 0 }, [PATTERN_LABELS[id] ?? id]))
  ) as HTMLSelectElement;
  const patternField = el("div", { class: "field" }, [el("label", {}, ["Pattern"]), patternSelect]);

  // --- Celebration Effects: which animation plays ---------------------------
  const animationSelect = el(
    "select",
    { class: "reward-animation-select" },
    EFFECT_ANIMATIONS.map((a, i) => el("option", { value: a.id, selected: i === 0 }, [a.label]))
  ) as HTMLSelectElement;
  const effectField = el("div", { class: "field" }, [el("label", {}, ["Plays like"]), animationSelect]);

  const fieldsWrap = el("div", { class: "inline-form", style: "flex-wrap:wrap;" }, [
    el("div", { class: "field" }, [el("label", {}, ["Category"]), categorySelect]),
    el("div", { class: "field" }, [el("label", {}, ["Reward name"]), nameInput]),
    el("div", { class: "field", style: "flex: 0 0 150px;" }, [el("label", {}, ["Rarity"]), raritySelect]),
    imageField,
    effectField,
    fontField,
    patternField,
    emojiField,
    themeField,
  ]);

  const syncFields = () => {
    const id = categorySelect.value;
    imageField.style.display = id === "cat-photocards" ? "" : "none";
    // Checkbox styles render from a glyph, exactly like stickers and avatars.
    emojiField.style.display = id === "cat-stickers" || id === "cat-avatars" || id === "cat-checkboxes" ? "" : "none";
    themeField.style.display = id === "cat-themes" ? "" : "none";
    effectField.style.display = id === "cat-effects" ? "" : "none";
    fontField.style.display = id === "cat-fonts" ? "" : "none";
    patternField.style.display = id === "cat-backgrounds" ? "" : "none";
  };
  categorySelect.addEventListener("change", syncFields);
  syncFields();

  return {
    wrap: fieldsWrap,
    create: () => {
      const categoryId = categorySelect.value;
      const name = nameInput.value.trim();
      if (!name) return { error: "Give the reward a name." };
      const rarity = raritySelect.value as Rarity;

      // Stickers and Avatars render as their emoji, so one is required —
      // without it they'd fall back to a generic placeholder icon.
      let description = "";
      const extras: RewardExtras = {};
      if (categoryId === "cat-stickers" || categoryId === "cat-avatars" || categoryId === "cat-checkboxes") {
        const emoji = picker.value();
        if (!emoji) {
          return { error: categoryId === "cat-checkboxes" ? "Pick the mark this checkbox shows." : "Pick an emoji for this reward." };
        }
        description = emoji;
      } else if (categoryId === "cat-fonts") {
        extras.fontFamily = fontSelect.value;
      } else if (categoryId === "cat-backgrounds") {
        extras.backgroundPattern = patternSelect.value;
      } else if (categoryId === "cat-photocards") {
        extras.imageDataUrl = pendingImage;
      } else if (categoryId === "cat-themes") {
        extras.colors = [color1.value, color2.value];
      } else if (categoryId === "cat-effects") {
        extras.effectAnimation = animationSelect.value;
      }

      const item = store.addRewardItem(categoryId, name, rarity, "unlock", description, extras);
      if (!item) return { error: "Couldn't create that reward." };
      return { item, categoryId };
    },
  };
}

function renderTierEditor(): HTMLElement {
  const container = el("div", { class: "card" });
  paint();
  // No subscription here on purpose: the page itself re-renders on every
  // store change (see render() at the bottom of this file), so subscribing
  // would both duplicate that work and leak a listener painting a detached
  // container on every repaint.
  return container;

  function paint() {
    const state = store.getState();
    const bp = state.battlepass;
    clear(container);
    container.appendChild(el("h2", {}, ["Battlepass Tiers & Rewards"]));
    container.appendChild(
      el("p", { class: "muted small" }, [
        "Total season points needed to reach each tier, and exactly what it grants. Tiers you've already reached are locked in — their rewards were really earned, so they can't be swapped out from here.",
      ])
    );

    const rows = el("div", { style: "margin-top:12px;" });
    for (const tier of bp.tiers) {
      rows.appendChild(renderTierRow(tier));
    }
    container.appendChild(rows);
    container.appendChild(renderAddTierPanel());
  }

  function renderTierRow(tier: Tier): HTMLElement {
    const bp = store.getState().battlepass;
    const reached = tier.tier <= bp.currentTier;
    const reward = tierRewardLabel(tier.tier);
    const entry = bp.rewardRoadmap.find((r) => r.tier === tier.tier);

    const pointsInput = el("input", {
      type: "text",
      inputmode: "numeric",
      value: String(tier.pointsRequired),
      style: "width:110px;",
      disabled: reached,
    }) as HTMLInputElement;
    pointsInput.addEventListener("change", () => {
      const n = Number(pointsInput.value);
      if (!Number.isFinite(n) || n < 0) {
        pointsInput.value = String(tier.pointsRequired);
        return;
      }
      store.updateTiers(
        store.getState().battlepass.tiers.map((t) => (t.tier === tier.tier ? { ...t, pointsRequired: Math.round(n) } : t))
      );
      showToast("Tier threshold updated", `Tier ${tier.tier} now needs ${Math.round(n)} pts.`);
    });

    const actions = el("div", { style: "display:flex; gap:6px; align-items:center; flex-wrap:wrap;" });
    if (reached) {
      actions.appendChild(el("span", { class: "weekday-tag" }, ["✓ Reached"]));
    } else {
      const select = rewardItemSelect(entry?.itemId);
      select.addEventListener("change", () => {
        if (!select.value) {
          store.clearTierReward(tier.tier);
          showToast("Back to automatic", `Tier ${tier.tier} will pick its own reward.`);
          return;
        }
        const [categoryId, itemId] = select.value.split("::");
        const result = store.setTierReward(tier.tier, categoryId, itemId);
        if (!result.ok) {
          showToast("Couldn't set that reward", result.error);
          paint();
        }
      });
      actions.appendChild(select);
      actions.appendChild(
        el(
          "button",
          {
            class: "small danger ghost",
            onclick: () => {
              // store.removeTier, not a filter + updateTiers: removing a tier
              // renumbers everything above it, and the roadmap is keyed by
              // that number, so the rewards have to be remapped in step or
              // they slide onto the wrong tiers.
              if (store.removeTier(tier.tier)) {
                showToast("Tier removed", "Its reward is free to use on another tier.");
              }
            },
          },
          ["Remove"]
        )
      );
    }

    return el("div", { class: `tier-editor-row${reached ? " reached" : ""}` }, [
      el("div", { style: "flex: 0 0 62px; font-weight:700;" }, [`Tier ${tier.tier}`]),
      el("div", { class: "field", style: "margin:0; flex:0 0 120px;" }, [pointsInput]),
      el("div", { style: "flex:1; min-width:180px;" }, [
        el("div", { class: "tier-editor-reward" }, [reward.text]),
        reward.manual ? el("div", { class: "muted small" }, ["Chosen by you"]) : null,
      ]),
      actions,
    ]);
  }

  function renderAddTierPanel(): HTMLElement {
    const bp = store.getState().battlepass;
    const highest = bp.tiers.reduce((max, t) => Math.max(max, t.pointsRequired), 0);

    const pointsInput = el("input", {
      type: "text",
      class: "tier-points-input",
      inputmode: "numeric",
      value: String(highest + 350),
      style: "width:120px;",
    }) as HTMLInputElement;

    const modeSelect = el("select", { class: "tier-mode-select" }, [
      el("option", { value: "new", selected: true }, ["Create a new reward"]),
      el("option", { value: "existing" }, ["Use a reward already in the pool"]),
      el("option", { value: "auto" }, ["Let Metro choose"]),
    ]) as HTMLSelectElement;

    const builder = renderRewardBuilder();
    const existingSelect = rewardItemSelect();
    const existingField = el("div", { class: "field" }, [el("label", {}, ["Which reward"]), existingSelect]);

    const syncMode = () => {
      builder.wrap.style.display = modeSelect.value === "new" ? "" : "none";
      existingField.style.display = modeSelect.value === "existing" ? "" : "none";
    };
    modeSelect.addEventListener("change", syncMode);
    syncMode();

    const submit = () => {
      const points = Number(pointsInput.value);
      if (!Number.isFinite(points) || points < 0) {
        showToast("Check the points", "A tier needs a points total of 0 or more.");
        return;
      }

      // Resolve the reward BEFORE adding the tier, so a validation failure
      // doesn't leave a stray empty tier behind.
      let assignment: { categoryId: string; itemId: string } | null = null;
      let createdItemId: string | null = null;
      if (modeSelect.value === "new") {
        const created = builder.create();
        if ("error" in created) {
          showToast("Couldn't add that tier", created.error);
          return;
        }
        createdItemId = created.item.id;
        assignment = { categoryId: created.categoryId, itemId: created.item.id };
      } else if (modeSelect.value === "existing") {
        if (!existingSelect.value) {
          showToast("Pick a reward", "Choose one from the pool, or switch to letting Metro choose.");
          return;
        }
        const [categoryId, itemId] = existingSelect.value.split("::");
        assignment = { categoryId, itemId };
      }

      const tierNumber = store.addTier(points);
      if (tierNumber === null) {
        showToast("Couldn't add that tier", "Check the points total.");
        return;
      }
      if (assignment) {
        const result = store.setTierReward(tierNumber, assignment.categoryId, assignment.itemId);
        if (!result.ok) {
          // A reward invented for this tier and then rejected would otherwise
          // sit in the pool forever, unassigned and indistinguishable from the
          // real ones — which is how a Photocards list fills up with cards
          // nobody remembers creating. Undo it along with the tier.
          if (createdItemId) store.deleteRewardItem(assignment.categoryId, createdItemId);
          store.removeTier(tierNumber);
          showToast("Couldn't add that tier", result.error);
          return;
        }
      }
      showToast(`Tier ${tierNumber} added`, `Needs ${Math.round(points)} pts.`, "success");
    };

    return el("div", { class: "tier-add-panel" }, [
      el("h3", {}, ["Add a tier"]),
      el("p", { class: "muted small" }, [
        "Set what it costs and what it gives. A brand-new reward is created in its category and pinned to this tier, so it won't be handed out anywhere else.",
      ]),
      el("div", { class: "inline-form" }, [
        el("div", { class: "field", style: "flex: 0 0 150px;" }, [el("label", {}, ["Points required"]), pointsInput]),
        el("div", { class: "field", style: "flex: 0 0 250px;" }, [el("label", {}, ["Reward"]), modeSelect]),
        existingField,
      ]),
      builder.wrap,
      el("button", { class: "primary", style: "margin-top:8px;", onclick: submit }, ["Add Tier"]),
    ]);
  }
}

function renderBackup(): HTMLElement {
  const fileInput = el("input", { type: "file", accept: "application/json" }) as HTMLInputElement;
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = store.importData(text);
    showToast(result.ok ? "Backup restored" : "Import failed", result.error, result.ok ? "success" : "info");
    fileInput.value = "";
  });

  const exportBtn = el("button", {
    class: "primary",
    onclick: () => {
      const json = store.exportData();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = el("a", { href: url, download: `metro-backup-${new Date().toISOString().slice(0, 10)}.json` }) as HTMLAnchorElement;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  }, ["Export Backup (.json)"]);

  return el("div", { class: "card" }, [
    el("h2", {}, ["Backup & Restore"]),
    el("p", { class: "muted small" }, ["Everything in Metro lives in this browser's local storage. Export a backup file periodically so you don't lose progress."]),
    el("div", { style: "display:flex; gap: 16px; flex-wrap: wrap; align-items:center;" }, [
      exportBtn,
      el("div", {}, [el("label", {}, ["Import from file"]), fileInput]),
    ]),
  ]);
}

function renderDangerZone(): HTMLElement {
  return el("div", { class: "card" }, [
    el("h2", {}, ["Danger Zone"]),
    el("button", {
      class: "danger",
      onclick: () => {
        if (window.confirm("This wipes ALL Metro data on this computer — checklists, shortcuts, and battlepass progress. This can't be undone. Continue?")) {
          store.resetAllData();
          showToast("Metro has been reset");
        }
      },
    }, ["Reset All Data"]),
  ]);
}

function render(): void {
  const root = qs<HTMLElement>("#page-root");
  clear(root);
  root.appendChild(renderIdentity());
  root.appendChild(renderPointsConfig());
  root.appendChild(renderTierEditor());
  root.appendChild(renderManagePuzzlesCard());
  root.appendChild(renderBackup());
  root.appendChild(renderDangerZone());
}

document.addEventListener("DOMContentLoaded", () => {
  mountNav("settings");
  render();
  store.subscribe(render);
});
