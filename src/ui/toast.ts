// ============================================================================
// Toast notifications + celebration effects (confetti, etc). Kept as simple
// DOM-injecting functions rather than a component system, matching the rest
// of Metro's no-framework approach.
// ============================================================================

import { el, qs } from "./dom.js";
import type { UnlockedReward } from "../types.js";

function region(): HTMLElement {
  return qs<HTMLElement>("#toast-region");
}

export function showToast(title: string, body?: string, tone: "info" | "success" = "info"): void {
  const toast = el(
    "div",
    { class: "toast", style: tone === "success" ? "border-color: var(--success)" : "" },
    [el("div", { class: "title" }, [title]), body ? el("div", { class: "muted small" }, [body]) : null]
  );
  region().appendChild(toast);
  setTimeout(() => toast.remove(), 5200);
}

export function announceRewards(rewards: UnlockedReward[]): void {
  for (const r of rewards) {
    showToast(
      `Tier ${r.tier} reached! 🎉`,
      `Unlocked: ${r.name} (${r.rarity}) — ${r.categoryName}`,
      "success"
    );
  }
}

/** Fires a burst of falling confetti pieces across the viewport. Used when a
 * whole checklist is cleared, or a bigger celebration effect is unlocked. */
export function celebrate(pieceCount = 90): void {
  const layer = document.getElementById("celebration-layer");
  if (!layer) return;
  const colors = ["#5b8cff", "#7b6bff", "#3ecf8e", "#f0b84f", "#ef6a6a", "#38c6d9"];
  for (let i = 0; i < pieceCount; i++) {
    const piece = el("div", {
      class: "confetti-piece",
      style: `left:${Math.random() * 100}%; background:${colors[i % colors.length]}; animation-duration:${
        1.8 + Math.random() * 1.4
      }s; animation-delay:${Math.random() * 0.4}s;`,
    });
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}
