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
/** Resolves the equipped effect to the id of an animation this file actually
 * implements. A user-created effect can't ship its own animation — animation
 * is code, not data — so it stores which built-in it plays (see
 * RewardItem.effectAnimation) and that is what fires. */
function activeAnimationId(): string | null {
  const state = store.getState();
  const effectId = state.settings.activeEffectId;
  if (!effectId) return null;
  const item = state.battlepass.categories
    .find((c) => c.id === "cat-effects")
    ?.items.find((i) => i.id === effectId);
  return item?.effectAnimation ?? effectId;
}

export function celebrate(): void {
  const layer = document.getElementById("celebration-layer");
  if (!layer) return;
  switch (activeAnimationId()) {
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
    case "effect-purple-ocean":
      purpleOcean(layer);
      break;
    case "effect-divine-bell":
      divineBellChime(layer);
      break;
    case "effect-bangtan-flash":
      bangtanBombFlash(layer);
      break;
    case "effect-paper-confetti":
      paperConfetti(layer);
      break;
    case "effect-ink-bloom":
      inkBloom(layer);
      break;
    case "effect-page-turn":
      pageTurn(layer);
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

/** A sea of small glowing lights rising and swaying up from the bottom of
 * the screen, in ARMY Bomb purple/lilac/white — modeled on the ocean of
 * lightsticks BTS fans raise at concerts. Part of the BTS Season pack. */
function purpleOcean(layer: HTMLElement, pieceCount = 55): void {
  const glows = ["#b18aff", "#8a5cf6", "#d8c4ff", "#ffffff", "#6c3fc9"];
  for (let i = 0; i < pieceCount; i++) {
    const light = el("div", {
      class: "ocean-light",
      style: `left:${Math.random() * 100}%; --glow:${glows[i % glows.length]}; --sway:${
        Math.random() * 40 - 20
      }px; animation-duration:${2.4 + Math.random() * 1.6}s; animation-delay:${Math.random() * 0.6}s;`,
    });
    layer.appendChild(light);
    setTimeout(() => light.remove(), 4600);
  }
}

/** A few slow, expanding golden rings from the center of the screen, plus a
 * handful of gently rising gold particles — modeled on "No. 29," Arirang's
 * closing track, which is just a single toll of the Divine Bell of King
 * Seongdeok. Quieter and more solemn than the other effects on purpose.
 * Part of the BTS Season pack. */
function divineBellChime(layer: HTMLElement, ringCount = 3): void {
  for (let i = 0; i < ringCount; i++) {
    setTimeout(() => {
      const ring = el("div", { class: "bell-ring" });
      layer.appendChild(ring);
      setTimeout(() => ring.remove(), 1800);
    }, i * 450);
  }
  for (let i = 0; i < 22; i++) {
    const particle = el("div", {
      class: "bell-particle",
      style: `left:${38 + Math.random() * 24}%; animation-delay:${Math.random() * 0.6}s; animation-duration:${
        2.2 + Math.random() * 1.2
      }s;`,
    });
    layer.appendChild(particle);
    setTimeout(() => particle.remove(), 4200);
  }
}

/** A rapid volley of camera-flash bursts at random spots on screen — a nod
 * to Bangtan Bomb, BTS's long-running behind-the-scenes video series,
 * always catching another candid moment. Part of the BTS Season pack. */
function bangtanBombFlash(layer: HTMLElement, flashCount = 12): void {
  for (let i = 0; i < flashCount; i++) {
    setTimeout(() => {
      const flash = el("div", {
        class: "camera-flash",
        style: `left:${Math.random() * 88}%; top:${Math.random() * 70}%;`,
      });
      layer.appendChild(flash);
      setTimeout(() => flash.remove(), 260);
    }, i * 130 + Math.random() * 90);
  }
}

/** Torn paper scraps and hole-punch dots drifting down — the confetti burst
 * rendered in stationery. Deliberately slower and less saturated than
 * confettiBurst: paper falls, it doesn't fly. Part of the Study Season pack. */
function paperConfetti(layer: HTMLElement, pieceCount = 70): void {
  const papers = ["#f3efe4", "#e8e2d2", "#dcd5c2", "#fbf8f0", "#cfc7b2"];
  for (let i = 0; i < pieceCount; i++) {
    const isDot = i % 4 === 0;
    const piece = el("div", {
      class: isDot ? "paper-dot" : "paper-scrap",
      style: `left:${Math.random() * 100}%; background:${papers[i % papers.length]}; --spin:${
        Math.random() * 720 - 360
      }deg; animation-duration:${2.6 + Math.random() * 1.8}s; animation-delay:${Math.random() * 0.5}s;`,
    });
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 5200);
  }
}

/** A drop of ink landing and spreading out through the page — one slow
 * expanding stain plus a few smaller satellites. The quietest effect in the
 * set, and the only one that isn't confetti-shaped. Part of the Study Season
 * pack. */
function inkBloom(layer: HTMLElement, blotCount = 5): void {
  for (let i = 0; i < blotCount; i++) {
    setTimeout(() => {
      const size = i === 0 ? 360 : 90 + Math.random() * 110;
      const blot = el("div", {
        class: "ink-blot",
        style: `left:${i === 0 ? 50 : 20 + Math.random() * 60}%; top:${
          i === 0 ? 45 : 25 + Math.random() * 50
        }%; width:${size}px; height:${size}px;`,
      });
      layer.appendChild(blot);
      setTimeout(() => blot.remove(), 2600);
    }, i * 190);
  }
}

/** The whole screen turns over like a sheet of paper. A single sweeping
 * element rather than particles, so it reads as one deliberate gesture —
 * fitting for the epic tier. Part of the Study Season pack. */
function pageTurn(layer: HTMLElement): void {
  const page = el("div", { class: "page-turn" });
  layer.appendChild(page);
  setTimeout(() => page.remove(), 1300);
  const edge = el("div", { class: "page-turn-edge" });
  layer.appendChild(edge);
  setTimeout(() => edge.remove(), 1300);
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
