// ============================================================================
// Settings page — assistant identity, points/tier tuning, and backup/
// restore. Appearance & Rank (theme/avatar/title selection) lives on the
// Inventory page now, alongside the rest of your unlocked rewards.
// ============================================================================

import { store } from "../data/store.js";
import { mountNav } from "../ui/nav.js";
import { el, clear, qs } from "../ui/dom.js";
import { DIFFICULTY_LABELS } from "../types.js";
import type { Difficulty, Tier } from "../types.js";
import { showToast } from "../ui/toast.js";

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

function renderTierEditor(): HTMLElement {
  const state = store.getState();
  let workingTiers: { pointsRequired: number }[] = state.battlepass.tiers.map((t) => ({ pointsRequired: t.pointsRequired }));

  const container = el("div", { class: "card" });
  paint();
  return container;

  function paint() {
    clear(container);
    container.appendChild(el("h2", {}, ["Battlepass Tier Thresholds"]));
    container.appendChild(el("p", { class: "muted small" }, ["Total season points required to reach each tier. Add or remove tiers to change how long a season takes."]));

    const rowsContainer = el("div", {});
    workingTiers.forEach((t, idx) => {
      const pointsInput = el("input", { type: "text", inputmode: "numeric", value: String(t.pointsRequired) }) as HTMLInputElement;
      pointsInput.addEventListener("change", () => {
        const n = Number(pointsInput.value);
        if (Number.isFinite(n) && n >= 0) workingTiers[idx].pointsRequired = Math.round(n);
      });
      rowsContainer.appendChild(
        el("div", { class: "inline-form", style: "margin-bottom: 6px;" }, [
          el("div", { style: "flex: 0 0 60px; font-weight:700;" }, [`Tier ${idx + 1}`]),
          el("div", { class: "field" }, [pointsInput]),
          el("button", {
            class: "small danger ghost",
            onclick: () => {
              workingTiers.splice(idx, 1);
              paint();
            },
          }, ["Remove"]),
        ])
      );
    });
    container.appendChild(rowsContainer);

    container.appendChild(
      el("div", { style: "display:flex; gap:8px; margin-top:10px;" }, [
        el("button", {
          onclick: () => {
            const last = workingTiers[workingTiers.length - 1]?.pointsRequired ?? 0;
            workingTiers.push({ pointsRequired: last + 200 });
            paint();
          },
        }, ["+ Add Tier"]),
        el("button", {
          class: "primary",
          onclick: () => {
            const sorted = [...workingTiers].sort((a, b) => a.pointsRequired - b.pointsRequired);
            const tiers: Tier[] = sorted.map((t, i) => ({ tier: i + 1, pointsRequired: t.pointsRequired }));
            store.updateTiers(tiers);
            showToast("Tiers updated");
          },
        }, ["Save Tiers"]),
      ])
    );
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
  root.appendChild(renderBackup());
  root.appendChild(renderDangerZone());
}

document.addEventListener("DOMContentLoaded", () => {
  mountNav("settings");
  render();
  store.subscribe(render);
});
