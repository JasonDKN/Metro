// ============================================================================
// Custom Checklists page — create and manage any number of additional,
// persistent checklists beyond the highlighted daily one.
// ============================================================================

import { store } from "../data/store.js";
import { mountNav } from "../ui/nav.js";
import { el, clear, qs } from "../ui/dom.js";
import { renderChecklistCard } from "../ui/taskList.js";
import type { ResetSchedule } from "../types.js";
import { isTrialChecklistId } from "../data/trials.js";

function renderAddChecklistForm(): HTMLElement {
  const nameInput = el("input", { type: "text", placeholder: "e.g. Weekly Errands" }) as HTMLInputElement;
  const descInput = el("input", { type: "text", placeholder: "Optional description" }) as HTMLInputElement;
  const resetSelect = el("select", {}, [
    el("option", { value: "never", selected: true }, ["Doesn't auto-reset"]),
    el("option", { value: "daily" }, ["Auto-resets daily"]),
  ]) as HTMLSelectElement;

  const submit = () => {
    if (!nameInput.value.trim()) return;
    store.addChecklist(nameInput.value, resetSelect.value as ResetSchedule, descInput.value);
    nameInput.value = "";
    descInput.value = "";
  };

  return el("div", { class: "card" }, [
    el("h2", {}, ["New Checklist"]),
    el("div", { class: "inline-form" }, [
      el("div", { class: "field" }, [el("label", {}, ["Name"]), nameInput]),
      el("div", { class: "field" }, [el("label", {}, ["Description"]), descInput]),
      el("div", { class: "field", style: "flex: 0 0 190px;" }, [el("label", {}, ["Reset schedule"]), resetSelect]),
      el("button", { class: "primary", onclick: submit }, ["Create Checklist"]),
    ]),
  ]);
}

function render(): void {
  const root = qs<HTMLElement>("#page-root");
  clear(root);
  root.appendChild(renderAddChecklistForm());

  const state = store.getState();
  const others = state.checklists.filter((c) => !c.isPrimary && !isTrialChecklistId(c.id));

  if (others.length === 0) {
    root.appendChild(
      el("div", { class: "empty-state" }, [
        "No custom checklists yet — create one above. (Looking for the six DC checklists? Those live on the Daily Trials Checklist page.)",
      ])
    );
    return;
  }

  for (const checklist of others) {
    const wrapper = el("div", {});
    const controls = el("div", { class: "checklist-controls", style: "justify-content: flex-end;" }, [
      el("div", { class: "controls-right" }, [
        el("button", {
          class: "small ghost",
          onclick: () => {
            const name = window.prompt("Rename checklist", checklist.name);
            if (name && name.trim()) store.renameChecklist(checklist.id, name);
          },
        }, ["Rename"]),
        el("button", {
          class: "small danger ghost",
          onclick: () => {
            if (window.confirm(`Delete "${checklist.name}"? This can't be undone.`)) {
              store.deleteChecklist(checklist.id);
            }
          },
        }, ["Delete"]),
      ]),
    ]);
    wrapper.appendChild(controls);
    wrapper.appendChild(renderChecklistCard(checklist, { allowWildcard: false }));
    root.appendChild(wrapper);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountNav("checklists");
  render();
  store.subscribe(render);
});
