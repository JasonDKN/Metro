// ============================================================================
// Reusable checklist card: progress bar, task rows (toggle/edit/delete), and
// an add-task form. Shared between the Daily Checklist page and the custom
// Checklists page so behavior stays identical everywhere a checklist shows.
// ============================================================================

import type { Checklist, Difficulty } from "../types.js";
import { store } from "../data/store.js";
import { el, clear } from "./dom.js";
import { DIFFICULTY_LABELS } from "../types.js";
import { announceRewards, celebrate, showToast } from "./toast.js";

export interface TaskListOptions {
  allowWildcard?: boolean;
  allowRename?: boolean;
  allowDelete?: boolean;
}

function difficultySelect(selected: Difficulty = 2): HTMLSelectElement {
  const select = el("select", {}) as HTMLSelectElement;
  for (let d = 1 as Difficulty; d <= 5; d++) {
    const opt = el("option", { value: String(d) }, [`${DIFFICULTY_LABELS[d]} (${d})`]) as HTMLOptionElement;
    if (d === selected) opt.selected = true;
    select.appendChild(opt);
  }
  return select;
}

export function renderChecklistCard(checklist: Checklist, opts: TaskListOptions = {}): HTMLElement {
  const container = el("div", { class: "card" });
  paint();
  return container;

  function paint() {
    clear(container);
    const total = checklist.tasks.length;
    const done = checklist.tasks.filter((t) => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    const header = el("div", {}, [
      el("h2", {}, [checklist.name]),
      checklist.description ? el("p", { class: "muted small" }, [checklist.description]) : null,
      el("div", { class: "progress-bar", style: "margin: 10px 0 4px;" }, [el("div", { style: `width:${pct}%` })]),
      el("div", { class: "muted small" }, [`${done} / ${total} complete`]),
    ]);
    container.appendChild(header);

    const list = el("div", { class: "task-list", style: "margin-top: 16px;" });
    if (total === 0) {
      list.appendChild(el("div", { class: "empty-state" }, ["No tasks yet — add your first one below."]));
    }
    for (const task of checklist.tasks) {
      list.appendChild(renderTaskRow(task));
    }
    container.appendChild(list);

    container.appendChild(renderAddForm());
  }

  function renderTaskRow(task: Checklist["tasks"][number]) {
    const row = el("div", { class: `task-item${task.completed ? " completed" : ""}` });

    const checkbox = el("button", {
      class: "task-checkbox",
      "aria-label": "toggle task",
      onclick: () => {
        const result = store.toggleTask(checklist.id, task.id);
        if (!result) return;
        if (result.pointsAwarded > 0) {
          showToast(`+${result.pointsAwarded} pts`, task.text, "success");
        }
        if (result.rewardsGranted.length > 0) {
          announceRewards(result.rewardsGranted);
        }
        if (result.checklistFullyCompleted) {
          celebrate();
          showToast("Checklist complete! 🎉", `You cleared "${checklist.name}".`, "success");
        }
        paint();
      },
    }, [task.completed ? "✓" : ""]);
    row.appendChild(checkbox);

    row.appendChild(el("div", { class: "task-text" }, [task.text]));
    row.appendChild(el("div", { class: `difficulty-pill difficulty-${task.difficulty}` }, [DIFFICULTY_LABELS[task.difficulty]]));

    if (opts.allowWildcard && !task.completed && store.wildcardCount() > 0) {
      row.appendChild(
        el("button", {
          class: "small",
          title: "Use a Wildcard to swap this task",
          onclick: () => openWildcardForm(task.id, task.text, task.difficulty),
        }, ["🃏 Swap"])
      );
    }

    row.appendChild(
      el("button", { class: "small ghost", onclick: () => openEditForm(task.id, task.text, task.difficulty) }, ["Edit"])
    );
    row.appendChild(
      el("button", { class: "small danger ghost", onclick: () => { store.deleteTask(checklist.id, task.id); paint(); } }, ["✕"])
    );

    return row;
  }

  function openEditForm(taskId: string, text: string, difficulty: Difficulty) {
    const textInput = el("input", { type: "text", value: text }) as HTMLInputElement;
    const diffSelect = difficultySelect(difficulty);
    const form = el("div", { class: "inline-form card", style: "margin: 8px 0;" }, [
      el("div", { class: "field" }, [el("label", {}, ["Task"]), textInput]),
      el("div", { class: "field" }, [el("label", {}, ["Difficulty"]), diffSelect]),
      el("button", {
        class: "primary small",
        onclick: () => {
          store.editTask(checklist.id, taskId, {
            text: textInput.value,
            difficulty: Number(diffSelect.value) as Difficulty,
          });
          paint();
        },
      }, ["Save"]),
      el("button", { class: "small ghost", onclick: () => paint() }, ["Cancel"]),
    ]);
    container.insertBefore(form, container.lastElementChild);
  }

  function openWildcardForm(taskId: string, currentText: string, currentDifficulty: Difficulty) {
    const textInput = el("input", { type: "text", placeholder: "Replacement task" }) as HTMLInputElement;
    const diffSelect = difficultySelect(currentDifficulty);
    const form = el("div", { class: "inline-form card", style: "margin: 8px 0; border-color: var(--accent);" }, [
      el("div", { style: "width:100%;" }, [`🃏 Swap out "${currentText}" for something else (1 Wildcard):`]),
      el("div", { class: "field" }, [el("label", {}, ["New task"]), textInput]),
      el("div", { class: "field" }, [el("label", {}, ["Difficulty"]), diffSelect]),
      el("button", {
        class: "primary small",
        onclick: () => {
          const ok = store.useWildcard(checklist.id, taskId, textInput.value, Number(diffSelect.value) as Difficulty);
          if (!ok) { showToast("Couldn't use Wildcard", "Check you have one available and typed a new task.", "info"); }
          paint();
        },
      }, ["Swap"]),
      el("button", { class: "small ghost", onclick: () => paint() }, ["Cancel"]),
    ]);
    container.insertBefore(form, container.lastElementChild);
  }

  function renderAddForm() {
    const textInput = el("input", { type: "text", placeholder: "Add a task…" }) as HTMLInputElement;
    const diffSelect = difficultySelect(2);
    const submit = () => {
      if (!textInput.value.trim()) return;
      store.addTask(checklist.id, textInput.value, Number(diffSelect.value) as Difficulty);
      paint();
    };
    textInput.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") submit();
    });
    return el("div", { class: "inline-form", style: "margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);" }, [
      el("div", { class: "field" }, [el("label", {}, ["New task"]), textInput]),
      el("div", { class: "field", style: "flex: 0 0 170px;" }, [el("label", {}, ["Difficulty"]), diffSelect]),
      el("button", { class: "primary", onclick: submit }, ["Add Task"]),
    ]);
  }
}
