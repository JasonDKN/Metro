// ============================================================================
// Drag-to-reorder for any vertical list of rows.
//
// Metro has three reorderable lists — a checklist's tasks, the Daily Puzzles
// list, and the DC checklists on the Daily Trials page — and they should all
// feel identical: same grip handle, same accent line showing where the row
// will land, same rules about dropping above or below the midpoint. Rather
// than three copies of the same fiddly HTML5 drag-and-drop wiring, they share
// this one.
//
// The caller owns the rows and the persistence; this only translates drags
// into "here is the new order of ids" and hands that back.
// ============================================================================

import { el } from "./dom.js";

export interface DragReorderOptions {
  /** Selector identifying a draggable row within the list container. */
  itemSelector: string;
  /** The ids currently in the list, top to bottom. Read fresh on each drop
   * rather than captured once, so a list re-rendered between drags (which
   * happens on every store change) reorders against what's actually on
   * screen instead of a stale snapshot. */
  order: () => string[];
  onReorder: (orderedIds: string[]) => void;
}

/** Wires drag-and-drop onto `list` and returns a function to register each
 * row. The returned function sets up the row and yields a grip handle element
 * for the caller to place wherever it fits that row's layout. */
export function enableDragReorder(
  list: HTMLElement,
  opts: DragReorderOptions
): (row: HTMLElement, id: string) => HTMLElement {
  let draggedId: string | null = null;

  const clearIndicators = () => {
    list
      .querySelectorAll(".drag-over-top, .drag-over-bottom")
      .forEach((n) => n.classList.remove("drag-over-top", "drag-over-bottom"));
  };

  const rowUnder = (e: DragEvent): HTMLElement | null =>
    ((e.target as HTMLElement)?.closest(opts.itemSelector) as HTMLElement | null) ?? null;

  /** Above or below the row's midpoint — decides which side of the target
   * the dragged row lands on. */
  const dropsBefore = (e: DragEvent, row: HTMLElement): boolean => {
    const rect = row.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2;
  };

  list.addEventListener("dragover", (e) => {
    const event = e as DragEvent;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    const target = rowUnder(event);
    clearIndicators();
    if (!target || !draggedId || target.dataset.dragId === draggedId) return;
    target.classList.add(dropsBefore(event, target) ? "drag-over-top" : "drag-over-bottom");
  });

  list.addEventListener("drop", (e) => {
    const event = e as DragEvent;
    event.preventDefault();
    const target = rowUnder(event);
    clearIndicators();
    if (!draggedId || !target) return;
    const targetId = target.dataset.dragId;
    if (!targetId || targetId === draggedId) return;

    const ordered = opts.order();
    const from = ordered.indexOf(draggedId);
    if (from !== -1) ordered.splice(from, 1);
    let to = ordered.indexOf(targetId);
    if (to === -1) to = ordered.length;
    else if (!dropsBefore(event, target)) to += 1;
    ordered.splice(to, 0, draggedId);

    opts.onReorder(ordered);
  });

  return (row: HTMLElement, id: string): HTMLElement => {
    row.dataset.dragId = id;
    row.draggable = true;
    row.addEventListener("dragstart", (e) => {
      draggedId = id;
      row.classList.add("dragging");
      const dt = (e as DragEvent).dataTransfer;
      if (dt) {
        dt.effectAllowed = "move";
        dt.setData("text/plain", id);
      }
    });
    row.addEventListener("dragend", () => {
      draggedId = null;
      row.classList.remove("dragging");
      clearIndicators();
    });
    return el("span", { class: "drag-handle", title: "Drag to reorder" }, ["⋮⋮"]);
  };
}
