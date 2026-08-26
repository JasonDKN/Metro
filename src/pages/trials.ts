// ============================================================================
// Daily Trials Checklist page — six fixed, independently toggleable
// daily-reset checklists ("DC 1"–"DC 6" by default, rename them to whatever
// your DCs actually are). Includes a bulk-add form for tasks common to
// every DC.
// ============================================================================

import { store } from "../data/store.js";
import { mountNav } from "../ui/nav.js";
import { el, clear, qs } from "../ui/dom.js";
import { renderChecklistCard, difficultySelect, weekdayPicker } from "../ui/taskList.js";
import { showToast } from "../ui/toast.js";
import { enableDragReorder } from "../ui/dragList.js";
import type { Checklist, Difficulty } from "../types.js";

function renderBulkAddForm(): HTMLElement {
  const textInput = el("input", { type: "text", placeholder: "Add a task to all six DCs at once…" }) as HTMLInputElement;
  const diffSelect = difficultySelect(2);
  const picker = weekdayPicker();
  const submit = () => {
    if (!textInput.value.trim()) return;
    const selectedDays = picker.getSelected();
    if (selectedDays.length === 0) {
      showToast("Pick at least one day", "These tasks need to recur on at least one day of the week.");
      return;
    }
    const count = store.addTaskToAllTrials(textInput.value, Number(diffSelect.value) as Difficulty, selectedDays);
    if (count > 0) {
      showToast(`Added to ${count} DC checklist${count === 1 ? "" : "s"}`, textInput.value, "success");
      textInput.value = "";
    }
  };
  textInput.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") submit();
  });
  return el("div", { class: "card", style: "border-color: var(--accent);" }, [
    el("h2", {}, ["Add to All Six DCs"]),
    el("p", { class: "muted small" }, ["For tasks that belong on every trial checklist, regardless of which ones are turned on today."]),
    el("div", { class: "inline-form" }, [
      el("div", { class: "field" }, [el("label", {}, ["Task"]), textInput]),
      el("div", { class: "field", style: "flex: 0 0 170px;" }, [el("label", {}, ["Difficulty"]), diffSelect]),
      el("button", { class: "primary", onclick: submit }, ["Add to All 6"]),
    ]),
    el("div", { class: "field", style: "margin-top: 10px;" }, [
      el("label", {}, ["Recurs on (applies to all 6 — defaults to every day)"]),
      picker.wrap,
    ]),
  ]);
}

/** A compact strip listing just the six DC names, draggable into any order.
 * The cards below re-render to match.
 *
 * Deliberately separate from the cards themselves: a DC card carries its whole
 * task list, so dragging one would mean hauling a tall, scrolling element past
 * its neighbours. Dragging six short rows in a fixed-height panel is the same
 * gesture without the wrestling. */
function renderReorderStrip(): HTMLElement | null {
  const trials = store.getTrialChecklists();
  if (trials.length < 2) return null;

  const list = el("div", { class: "dc-reorder-list" });
  const attachDrag = enableDragReorder(list, {
    itemSelector: ".dc-reorder-row",
    order: () => store.getTrialChecklists().map((c) => c.id),
    onReorder: (orderedIds) => store.reorderTrialChecklists(orderedIds),
  });

  trials.forEach((checklist, i) => {
    const enabled = checklist.enabled !== false;
    const row = el("div", { class: "dc-reorder-row" });
    row.appendChild(attachDrag(row, checklist.id));
    row.appendChild(el("span", { class: "dc-reorder-position" }, [String(i + 1)]));
    row.appendChild(el("span", { class: "dc-reorder-name" }, [checklist.name]));
    row.appendChild(
      el("span", { class: "muted small" }, [
        enabled ? `${checklist.tasks.length} task${checklist.tasks.length === 1 ? "" : "s"}` : "Paused",
      ])
    );
    list.appendChild(row);
  });

  return el("div", { class: "card" }, [
    el("h2", {}, ["Order"]),
    el("p", { class: "muted small" }, ["Drag to rearrange your DCs — the checklists below follow this order."]),
    list,
  ]);
}

function renderTrialCard(checklist: Checklist): HTMLElement {
  const enabled = checklist.enabled !== false;

  const header = el(
    "div",
    { class: "checklist-controls", style: "justify-content: space-between; margin-top: 22px;" },
    [
      el("div", { style: "display:flex; align-items:center; gap:10px;" }, [
        el("strong", { style: "font-size:15px;" }, [checklist.name]),
        !enabled ? el("span", { class: "weekday-tag" }, ["Paused"]) : null,
      ]),
      el("div", { class: "controls-right" }, [
        el(
          "button",
          {
            class: "small ghost",
            onclick: () => {
              const name = window.prompt("Label this DC (e.g. \"DC3 — Boss Rush\")", checklist.name);
              if (name && name.trim()) store.renameChecklist(checklist.id, name);
            },
          },
          ["Rename"]
        ),
        el(
          "button",
          {
            class: `small ${enabled ? "" : "primary"}`,
            onclick: () => store.setChecklistEnabled(checklist.id, !enabled),
          },
          [enabled ? "Turn Off" : "Turn On"]
        ),
      ]),
    ]
  );

  if (!enabled) {
    return el("div", {}, [
      header,
      el("div", { class: "card", style: "opacity: 0.55;" }, [
        el("p", { class: "muted small", style: "margin:0;" }, [
          `${checklist.tasks.length} task${checklist.tasks.length === 1 ? "" : "s"} — paused, and won't reset until you turn it back on.`,
        ]),
      ]),
    ]);
  }

  return el("div", {}, [header, renderChecklistCard(checklist, { hideHeading: true })]);
}

function render(): void {
  const root = qs<HTMLElement>("#page-root");
  clear(root);
  root.appendChild(renderBulkAddForm());
  const strip = renderReorderStrip();
  if (strip) root.appendChild(strip);
  for (const checklist of store.getTrialChecklists()) {
    root.appendChild(renderTrialCard(checklist));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountNav("trials");
  render();
  store.subscribe(render);
});
