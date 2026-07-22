// ============================================================================
// Shortcuts page — quick links to websites, local files/folders, and
// programs. Websites and local files render as real clickable links.
// Programs are listed as reference entries (name + copyable path) because
// browsers cannot launch installed desktop applications for security
// reasons — there is no web-only workaround for that.
// ============================================================================

import { store } from "../data/store.js";
import { mountNav } from "../ui/nav.js";
import { el, clear, qs } from "../ui/dom.js";
import type { Shortcut, ShortcutKind } from "../types.js";
import { showToast } from "../ui/toast.js";

function fileHref(target: string): string {
  if (/^[a-z]+:\/\//i.test(target)) return target; // already a full URI (file://, smb://, etc.)
  // Turn a plain path into a file:// URI. Handles both "C:\Users\..." and
  // "/home/user/..." reasonably well for local browser use.
  const normalized = target.replace(/\\/g, "/");
  const withSlash = normalized.startsWith("/") ? normalized : "/" + normalized;
  return "file://" + withSlash;
}

function websiteHref(target: string): string {
  return /^[a-z]+:\/\//i.test(target) ? target : "https://" + target;
}

function renderAddForm(): HTMLElement {
  const kindSelect = el("select", {}, [
    el("option", { value: "website", selected: true }, ["Website"]),
    el("option", { value: "file" }, ["Local file / folder"]),
    el("option", { value: "program" }, ["Program (reference only)"]),
  ]) as HTMLSelectElement;
  const labelInput = el("input", { type: "text", placeholder: "e.g. Work Email" }) as HTMLInputElement;
  const targetInput = el("input", { type: "text", placeholder: "https://... or a file/program path" }) as HTMLInputElement;
  const categoryInput = el("input", { type: "text", placeholder: "e.g. Work", value: "General" }) as HTMLInputElement;

  const submit = () => {
    if (!labelInput.value.trim() || !targetInput.value.trim()) return;
    store.addShortcut(labelInput.value, kindSelect.value as ShortcutKind, targetInput.value, categoryInput.value);
    labelInput.value = "";
    targetInput.value = "";
  };

  return el("div", { class: "card" }, [
    el("h2", {}, ["Add Shortcut"]),
    el("div", { class: "inline-form" }, [
      el("div", { class: "field", style: "flex: 0 0 170px;" }, [el("label", {}, ["Type"]), kindSelect]),
      el("div", { class: "field" }, [el("label", {}, ["Label"]), labelInput]),
      el("div", { class: "field" }, [el("label", {}, ["Target (URL / path)"]), targetInput]),
      el("div", { class: "field", style: "flex: 0 0 160px;" }, [el("label", {}, ["Category"]), categoryInput]),
      el("button", { class: "primary", onclick: submit }, ["Add"]),
    ]),
    el("p", { class: "muted small", style: "margin-top: 10px;" }, [
      "Websites and local files open as real links. Programs can't be launched from a browser for security reasons, so they're shown as a copyable path instead.",
    ]),
  ]);
}

function kindLabel(kind: ShortcutKind): string {
  return kind === "website" ? "Website" : kind === "file" ? "File / Folder" : "Program";
}

function renderShortcutCard(s: Shortcut): HTMLElement {
  const actions = el("div", { class: "actions" });

  if (s.kind === "website") {
    actions.appendChild(el("a", { href: websiteHref(s.target), target: "_blank", rel: "noopener", class: "btn small" }, ["Open ↗"]));
  } else if (s.kind === "file") {
    actions.appendChild(el("a", { href: fileHref(s.target), class: "btn small" }, ["Open"]));
  } else {
    actions.appendChild(
      el("button", {
        class: "small",
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(s.target);
            showToast("Path copied", s.target);
          } catch {
            window.prompt("Copy this path:", s.target);
          }
        },
      }, ["Copy Path"])
    );
  }
  actions.appendChild(
    el("button", {
      class: "small ghost",
      onclick: () => {
        const label = window.prompt("Rename shortcut", s.label);
        if (label && label.trim()) store.editShortcut(s.id, { label });
      },
    }, ["Rename"])
  );
  actions.appendChild(
    el("button", { class: "small danger ghost", onclick: () => store.deleteShortcut(s.id) }, ["✕"])
  );

  return el("div", { class: "shortcut-card" }, [
    el("div", { class: "kind-tag" }, [kindLabel(s.kind)]),
    el("div", { class: "label" }, [s.label]),
    el("div", { class: "target" }, [s.target]),
    actions,
  ]);
}

function render(): void {
  const root = qs<HTMLElement>("#page-root");
  clear(root);
  root.appendChild(renderAddForm());

  const state = store.getState();
  if (state.shortcuts.length === 0) {
    root.appendChild(el("div", { class: "empty-state" }, ["No shortcuts yet — add your first one above."]));
    return;
  }

  const byCategory = new Map<string, Shortcut[]>();
  for (const s of state.shortcuts) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  for (const [category, items] of byCategory) {
    root.appendChild(
      el("div", { class: "category-block" }, [
        el("h4", {}, [category]),
        el("div", { class: "shortcut-grid" }, items.map(renderShortcutCard)),
      ])
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountNav("shortcuts");
  render();
  store.subscribe(render);
});
