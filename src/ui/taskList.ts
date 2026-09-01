// ============================================================================
// Reusable checklist card: progress bar, task rows (toggle/edit/delete), and
// an add-task form. Shared between the Daily Checklist page and the custom
// Checklists page so behavior stays identical everywhere a checklist shows.
//
// Checklists with resetSchedule 'daily' additionally support per-task
// weekday recurrence: a task can be scheduled for any subset of the week
// (e.g. "Mon–Fri" for a recurring work task, or just "Thu" for a weekly
// meeting). The card automatically shows only today's active tasks, with a
// collapsible "manage all" section underneath for scheduling/editing tasks
// that aren't active today. See src/data/schedule.ts for the filtering
// logic this is built on.
// ============================================================================

import type { Checklist, Difficulty, Task } from "../types.js";
import { store } from "../data/store.js";
import { el, clear } from "./dom.js";
import { enableDragReorder } from "./dragList.js";
import { DIFFICULTY_LABELS } from "../types.js";
import { announceRewards, celebrate, showToast } from "./toast.js";
import {
  ALL_WEEKDAYS,
  activeTasksForChecklist,
  describeRecurDays,
  weekdayLabel,
  WEEKDAY_SHORT,
} from "../data/schedule.js";

export interface TaskListOptions {
  /** Skip rendering the card's own name/heading — use when the page already
   * shows its own title above the card (e.g. the Daily Checklist page). */
  hideHeading?: boolean;
}

export function difficultySelect(selected: Difficulty = 2): HTMLSelectElement {
  const select = el("select", {}) as HTMLSelectElement;
  for (let d = 1 as Difficulty; d <= 5; d++) {
    const opt = el("option", { value: String(d) }, [`${DIFFICULTY_LABELS[d]} (${d})`]) as HTMLOptionElement;
    if (d === selected) opt.selected = true;
    select.appendChild(opt);
  }
  return select;
}

/** A row of 7 day-of-week checkboxes, defaulting to whatever `selected` is
 * (all 7 days if omitted). Used by the add-task/edit-task forms, and by the
 * Daily Trials Checklist page's "add to all six" bulk form. */
export function weekdayPicker(selected: number[] = ALL_WEEKDAYS): { wrap: HTMLElement; getSelected: () => number[] } {
  const boxes: HTMLInputElement[] = [];
  const wrap = el(
    "div",
    { class: "weekday-picker" },
    WEEKDAY_SHORT.map((label, i) => {
      const cb = el("input", { type: "checkbox" }) as HTMLInputElement;
      cb.checked = selected.includes(i);
      boxes.push(cb);
      return el("label", { class: "weekday-check" }, [cb, label]);
    })
  );
  return {
    wrap,
    getSelected: () => boxes.map((b, i) => (b.checked ? i : -1)).filter((i) => i >= 0),
  };
}

/** The glyph a completed task shows, from the equipped Checkbox Style. The
 * mark lives in the reward's `description` (the same field avatars and
 * stickers use for their emoji), so a user-created style needs nothing beyond
 * picking a character. Falls back to Metro's original checkmark whenever
 * nothing is equipped or the equipped item has since been deleted. */
function completedMark(): string {
  const s = store.getState();
  const id = s.settings.activeCheckboxId;
  if (!id) return "✓";
  const item = s.battlepass.categories.find((c) => c.id === "cat-checkboxes")?.items.find((i) => i.id === id);
  return item?.description || "✓";
}

export function renderChecklistCard(checklist: Checklist, opts: TaskListOptions = {}): HTMLElement {
  const container = el("div", { class: "card" });
  /** Set by paint() on every repaint — see enableDragReorder in ui/dragList.ts,
   * which owns the actual drag wiring shared with the Daily Puzzles and DC
   * checklist lists. */
  let attachDrag: ((row: HTMLElement, id: string) => HTMLElement) | null = null;
  paint();
  return container;

  function paint() {
    clear(container);
    const isDaily = checklist.resetSchedule === "daily";
    // Completed tasks automatically sink to the bottom of the visible list —
    // a stable sort keeps everything else in its existing relative order, so
    // unchecking a task puts it right back where it was among the still-open
    // ones, and dragging still works normally within each group.
    const todaysTasks = activeTasksForChecklist(checklist)
      .filter((t) => !t.archived)
      .sort((a, b) => Number(a.completed) - Number(b.completed));
    const total = todaysTasks.length;
    const done = todaysTasks.filter((t) => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    if (!opts.hideHeading) {
      const heading = isDaily ? `${weekdayLabel(new Date().getDay())} ${checklist.name}` : checklist.name;
      container.appendChild(el("h2", {}, [heading]));
    }
    if (checklist.description) container.appendChild(el("p", { class: "muted small" }, [checklist.description]));
    container.appendChild(el("div", { class: "progress-bar", style: "margin: 10px 0 4px;" }, [el("div", { style: `width:${pct}%` })]));
    container.appendChild(
      el("div", { class: "muted small", style: "display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;" }, [
        el("span", {}, [`${done} / ${total} complete${isDaily ? " today" : ""}`]),
        !isDaily && done > 0
          ? el(
              "button",
              {
                class: "small ghost",
                onclick: () => {
                  const count = store.archiveAllCompleted(checklist.id);
                  if (count > 0) showToast(`Archived ${count} task${count === 1 ? "" : "s"}`, undefined, "success");
                  paint();
                },
              },
              [`Archive All Completed (${done})`]
            )
          : null,
      ])
    );

    const list = el("div", { class: "task-list", style: "margin-top: 16px;" });
    attachDrag =
      todaysTasks.length > 1
        ? enableDragReorder(list, {
            itemSelector: ".task-item",
            // Read live rather than closing over todaysTasks: completed tasks
            // sink to the bottom, so the on-screen order is what a drop must
            // reorder against.
            order: () => [...list.querySelectorAll<HTMLElement>(".task-item")].map((n) => n.dataset.dragId ?? "").filter(Boolean),
            onReorder: (orderedIds) => {
              store.reorderTasks(checklist.id, orderedIds);
              paint();
            },
          })
        : null;
    if (total === 0) {
      list.appendChild(
        el("div", { class: "empty-state" }, [
          isDaily ? "Nothing scheduled for today — add a task below, or check “Manage all recurring tasks”." : "No tasks yet — add your first one below.",
        ])
      );
    }
    for (const task of todaysTasks) {
      list.appendChild(renderTaskRow(task, {}));
    }
    container.appendChild(list);

    container.appendChild(renderAddForm(isDaily));

    if (isDaily && checklist.tasks.length > 0) {
      container.appendChild(renderManageAll());
    }

    if (!isDaily) {
      const archivedTasks = checklist.tasks.filter((t) => t.archived);
      if (archivedTasks.length > 0) container.appendChild(renderArchived(archivedTasks));
    }
  }

  function renderTaskRow(task: Task, rowOpts: { manageMode?: boolean }) {
    const isDaily = checklist.resetSchedule === "daily";
    const row = el("div", { class: `task-item${task.completed ? " completed" : ""}` });

    if (rowOpts.manageMode) {
      row.appendChild(el("div", { class: "muted small", style: "width:22px; text-align:center;" }, ["•"]));
    } else {
      // Drag-and-drop reordering — only wired up for the main visible list,
      // not the "manage all" section (which is sorted by creation date, a
      // different order than the checklist's own task order). A single-task
      // list has nothing to reorder, so attachDrag is null there and the row
      // simply gets no handle.
      row.dataset.taskId = task.id;
      if (attachDrag) row.appendChild(attachDrag(row, task.id));
    }

    if (!rowOpts.manageMode) {
      const checkbox = el(
        "button",
        {
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
        },
        [task.completed ? el("span", { class: "mark-glyph" }, [completedMark()]) : null]
      );
      row.appendChild(checkbox);
    }

    row.appendChild(el("div", { class: "task-text" }, [task.text]));
    row.appendChild(el("div", { class: `difficulty-pill difficulty-${task.difficulty}` }, [DIFFICULTY_LABELS[task.difficulty]]));

    if (isDaily) {
      const recurText = describeRecurDays(task);
      if (rowOpts.manageMode || recurText) {
        row.appendChild(el("div", { class: "weekday-tag" }, [recurText ?? "Every day"]));
      }
    }

    if (!rowOpts.manageMode && !isDaily && task.completed) {
      row.appendChild(
        el(
          "button",
          {
            class: "small ghost",
            title: "Tuck this completed task into Archived — keeps its points, hides it from the list",
            onclick: () => {
              store.archiveTask(checklist.id, task.id);
              paint();
            },
          },
          ["Archive"]
        )
      );
    }

    row.appendChild(
      el("button", { class: "small ghost", onclick: () => openEditForm(task.id, task.text, task.difficulty, task.recurDays) }, ["Edit"])
    );
    row.appendChild(
      el(
        "button",
        {
          class: "small danger ghost",
          onclick: () => {
            store.deleteTask(checklist.id, task.id);
            paint();
          },
        },
        ["✕"]
      )
    );

    return row;
  }

  function renderArchived(archivedTasks: Task[]) {
    return el("details", { class: "manage-recurring" }, [
      el("summary", {}, [`Archived (${archivedTasks.length})`]),
      el("p", { class: "muted small", style: "margin: 8px 0 10px;" }, [
        "Completed tasks tucked out of the way — still counted for points, just off the main list. Unarchive to bring one back.",
      ]),
      el(
        "div",
        { class: "task-list" },
        archivedTasks.map((task) => {
          const row = el("div", { class: "task-item completed" });
          row.appendChild(el("div", { class: "muted small", style: "width:22px; text-align:center;" }, ["✓"]));
          row.appendChild(el("div", { class: "task-text" }, [task.text]));
          row.appendChild(el("div", { class: `difficulty-pill difficulty-${task.difficulty}` }, [DIFFICULTY_LABELS[task.difficulty]]));
          row.appendChild(
            el(
              "button",
              {
                class: "small ghost",
                onclick: () => {
                  store.unarchiveTask(checklist.id, task.id);
                  paint();
                },
              },
              ["Unarchive"]
            )
          );
          row.appendChild(
            el(
              "button",
              {
                class: "small danger ghost",
                onclick: () => {
                  store.deleteTask(checklist.id, task.id);
                  paint();
                },
              },
              ["✕"]
            )
          );
          return row;
        })
      ),
    ]);
  }

  function renderManageAll() {
    return el("details", { class: "manage-recurring" }, [
      el("summary", {}, [`Manage all recurring tasks (${checklist.tasks.length})`]),
      el("p", { class: "muted small", style: "margin: 8px 0 10px;" }, [
        "Every task on this checklist, regardless of which day it's scheduled for — handy for setting up next Thursday's meeting while you're looking at today.",
      ]),
      el(
        "div",
        { class: "task-list" },
        checklist.tasks
          .slice()
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
          .map((t) => renderTaskRow(t, { manageMode: true }))
      ),
    ]);
  }

  function openEditForm(taskId: string, text: string, difficulty: Difficulty, recurDays?: number[]) {
    const isDaily = checklist.resetSchedule === "daily";
    const textInput = el("input", { type: "text", value: text }) as HTMLInputElement;
    const diffSelect = difficultySelect(difficulty);
    const picker = isDaily ? weekdayPicker(recurDays && recurDays.length > 0 ? recurDays : ALL_WEEKDAYS) : null;

    const form = el("div", { class: "inline-form card", style: "margin: 8px 0;" }, [
      el("div", { class: "field" }, [el("label", {}, ["Task"]), textInput]),
      el("div", { class: "field" }, [el("label", {}, ["Difficulty"]), diffSelect]),
      picker ? el("div", { class: "field", style: "flex-basis:100%;" }, [el("label", {}, ["Recurs on"]), picker.wrap]) : null,
      el(
        "button",
        {
          class: "primary small",
          onclick: () => {
            const selectedDays = picker?.getSelected();
            if (picker && (!selectedDays || selectedDays.length === 0)) {
              showToast("Pick at least one day", "A task needs to recur on at least one day of the week.");
              return;
            }
            store.editTask(checklist.id, taskId, {
              text: textInput.value,
              difficulty: Number(diffSelect.value) as Difficulty,
              recurDays: selectedDays,
            });
            paint();
          },
        },
        ["Save"]
      ),
      el("button", { class: "small ghost", onclick: () => paint() }, ["Cancel"]),
    ]);
    container.insertBefore(form, container.lastElementChild);
  }

  function renderAddForm(isDaily: boolean) {
    const textInput = el("input", { type: "text", placeholder: "Add a task…" }) as HTMLInputElement;
    const diffSelect = difficultySelect(2);
    const picker = isDaily ? weekdayPicker(ALL_WEEKDAYS) : null;
    const submit = () => {
      if (!textInput.value.trim()) return;
      const selectedDays = picker?.getSelected();
      if (picker && (!selectedDays || selectedDays.length === 0)) {
        showToast("Pick at least one day", "A task needs to recur on at least one day of the week.");
        return;
      }
      store.addTask(checklist.id, textInput.value, Number(diffSelect.value) as Difficulty, selectedDays);
      paint();
    };
    textInput.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") submit();
    });
    return el("div", { style: "margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);" }, [
      el("div", { class: "inline-form" }, [
        el("div", { class: "field" }, [el("label", {}, ["New task"]), textInput]),
        el("div", { class: "field", style: "flex: 0 0 170px;" }, [el("label", {}, ["Difficulty"]), diffSelect]),
        el("button", { class: "primary", onclick: submit }, ["Add Task"]),
      ]),
      picker
        ? el("div", { class: "field", style: "margin-top: 10px;" }, [
            el("label", {}, ["Recurs on (defaults to every day)"]),
            picker.wrap,
          ])
        : null,
    ]);
  }
}
