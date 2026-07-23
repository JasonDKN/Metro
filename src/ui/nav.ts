// ============================================================================
// Shared sidebar navigation, mounted on every page. Also owns applying the
// active theme to <body> and keeping the mini battlepass bar live.
// ============================================================================

import { store } from "../data/store.js";
import { el, clear, qs } from "./dom.js";
import { defaultRewardCategories } from "../data/defaults.js";

export type PageId = "daily" | "trials" | "checklists" | "shortcuts" | "battlepass" | "settings";

const NAV_ITEMS: { id: PageId; label: string; icon: string; href: string }[] = [
  { id: "daily", label: "Daily General", icon: "✓", href: "index.html" },
  { id: "trials", label: "Daily Trials", icon: "⚔", href: "trials.html" },
  { id: "checklists", label: "Checklists", icon: "≡", href: "checklists.html" },
  { id: "shortcuts", label: "Shortcuts", icon: "⚡", href: "shortcuts.html" },
  { id: "battlepass", label: "Battlepass", icon: "★", href: "battlepass.html" },
  { id: "settings", label: "Settings", icon: "⚙", href: "settings.html" },
];

function avatarEmoji(avatarId: string): string {
  if (avatarId === "avatar-default") return "\u{1F9ED}";
  const all = defaultRewardCategories().find((c) => c.id === "cat-avatars");
  const state = store.getState();
  const cat = state.battlepass.categories.find((c) => c.id === "cat-avatars") ?? all;
  const item = cat?.items.find((i) => i.id === avatarId);
  return item?.description ?? "\u{1F9ED}";
}

function applyTheme(): void {
  document.body.setAttribute("data-theme", store.getState().settings.activeThemeId);
}

export function mountNav(active: PageId): void {
  applyTheme();
  render(active);
  store.subscribe(() => {
    applyTheme();
    render(active);
  });
  // Catch a rollover that happens while the app is left open.
  setInterval(() => store.checkRollovers(), 60_000);
}

function render(active: PageId): void {
  const root = qs<HTMLElement>("#nav-root");
  clear(root);
  const state = store.getState();
  const bp = state.battlepass;
  const title = state.settings.activeTitleId
    ? bp.categories.flatMap((c) => c.items).find((i) => i.id === state.settings.activeTitleId)?.name
    : null;

  const currentTierDef = bp.tiers.find((t) => t.tier === bp.currentTier + 1);
  const prevRequired = bp.tiers.find((t) => t.tier === bp.currentTier)?.pointsRequired ?? 0;
  const nextRequired = currentTierDef?.pointsRequired ?? prevRequired;
  const span = Math.max(1, nextRequired - prevRequired);
  const progressPct = currentTierDef
    ? Math.min(100, Math.round(((bp.seasonPoints - prevRequired) / span) * 100)
    )
    : 100;

  root.appendChild(
    el("div", { class: "nav-brand" }, [
      el("div", { class: "avatar" }, [avatarEmoji(state.settings.activeAvatarId)]),
      el("div", { class: "names" }, [
        el("div", { class: "assistant-name" }, [state.settings.assistantName]),
        title ? el("div", { class: "assistant-title" }, [title]) : null,
      ]),
    ])
  );

  const links = el(
    "div",
    { class: "nav-links" },
    NAV_ITEMS.map((item) =>
      el("a", { class: `nav-link${item.id === active ? " active" : ""}`, href: item.href }, [
        el("span", { class: "icon" }, [item.icon]),
        el("span", {}, [item.label]),
      ])
    )
  );
  root.appendChild(links);

  root.appendChild(
    el("div", { class: "nav-bp-mini" }, [
      el("div", { class: "row" }, [
        el("span", {}, [`Tier ${bp.currentTier}`]),
        el("span", {}, [`${bp.seasonPoints} pts`]),
      ]),
      el("div", { class: "bar" }, [el("div", { style: `width:${progressPct}%` })]),
      el("div", { class: "row", style: "margin-top:6px; margin-bottom:0;" }, [
        el("span", {}, [currentTierDef ? `Next: Tier ${currentTierDef.tier}` : "Max tier!"]),
      ]),
    ])
  );

  root.appendChild(
    el("div", { class: "nav-footer" }, [`Metro — ${new Date().getFullYear()}`])
  );
}
