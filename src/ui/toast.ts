// ============================================================================
// Toast notifications + celebration effects (confetti, etc). Kept as simple
// DOM-injecting functions rather than a component system, matching the rest
// of Metro's no-framework approach.
// ============================================================================

import { el, qs } from "./dom.js";
import { store } from "../data/store.js";
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

const CONFETTI_COLORS = ["#5b8cff", "#7b6bff", "#3ecf8e", "#f0b84f", "#ef6a6a", "#38c6d9"];

/** Fires whichever Celebration Effect is currently equipped (Settings ->
 * Inventory), falling back to the built-in confetti burst if none is
 * equipped or the equipped one is no longer valid. Used when a whole
 * checklist is cleared. */
export function celebrate(): void {
  const layer = document.getElementById("celebration-layer");
  if (!layer) return;
  switch (store.getState().settings.activeEffectId) {
    case "effect-fireworks":
      fireworks(layer);
      break;
    case "effect-starfall":
      starfall(layer);
      break;
    case "effect-aurora":
      auroraWave(layer);
      break;
    case "effect-fanfare":
      metroFanfare(layer);
      break;
    case "effect-confetti":
    default:
      confettiBurst(layer);
      break;
  }
}

function confettiBurst(layer: HTMLElement, pieceCount = 90): void {
  for (let i = 0; i < pieceCount; i++) {
    const piece = el("div", {
      class: "confetti-piece",
      style: `left:${Math.random() * 100}%; background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}; animation-duration:${
        1.8 + Math.random() * 1.4
      }s; animation-delay:${Math.random() * 0.4}s;`,
    });
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

/** A handful of firework bursts, each a ring of particles radiating outward
 * from a random point and fading as they fly. */
function fireworks(layer: HTMLElement, burstCount = 5): void {
  for (let b = 0; b < burstCount; b++) {
    setTimeout(() => {
      const originX = 15 + Math.random() * 70; // vw
      const originY = 15 + Math.random() * 45; // vh
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const particleCount = 26;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = 60 + Math.random() * 70;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        const particle = el("div", {
          class: "firework-particle",
          style: `left:${originX}vw; top:${originY}vh; background:${color}; --dx:${dx}px; --dy:${dy}px; animation-duration:${
            0.7 + Math.random() * 0.4
          }s;`,
        });
        layer.appendChild(particle);
        setTimeout(() => particle.remove(), 1200);
      }
    }, b * 280);
  }
}

/** Sparse, gently drifting stars that twinkle as they fall — a quieter,
 * slower effect than confetti. */
function starfall(layer: HTMLElement, pieceCount = 40): void {
  const glyphs = ["✧", "✦", "✴", "⭐", "✨"];
  for (let i = 0; i < pieceCount; i++) {
    const piece = el(
      "div",
      {
        class: "star-piece",
        style: `left:${Math.random() * 100}%; color:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}; --drift:${
          Math.random() * 120 - 60
        }px; animation-duration:${2.6 + Math.random() * 2}s; animation-delay:${Math.random() * 0.8}s;`,
      },
      [glyphs[i % glyphs.length]]
    );
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 5600);
  }
}

/** A couple of soft, blurred gradient bands sweeping across the screen. */
function auroraWave(layer: HTMLElement): void {
  const gradients = [
    ["#4ff0c0", "#9a6bff"],
    ["#38c6d9", "#4f8ff0"],
    ["#7b8bff", "#3ecf8e"],
  ];
  gradients.forEach(([c1, c2], i) => {
    setTimeout(() => {
      const band = el("div", {
        class: "aurora-band",
        style: `background: linear-gradient(120deg, transparent, ${c1}, ${c2}, transparent); animation-duration:${
          2.2 + i * 0.3
        }s;`,
      });
      layer.appendChild(band);
      setTimeout(() => band.remove(), 2800);
    }, i * 260);
  });
}

/** The grand finale — a bigger confetti burst plus a couple of firework
 * bursts and a brief flash. Reserved for the legendary-tier effect. */
function metroFanfare(layer: HTMLElement): void {
  const flash = el("div", { class: "fanfare-flash" });
  layer.appendChild(flash);
  setTimeout(() => flash.remove(), 800);
  confettiBurst(layer, 140);
  fireworks(layer, 3);
}
