// ============================================================================
// Image lightbox — a full-screen overlay for viewing an earned Photocard at
// a size you can actually appreciate, instead of the thumbnail-sized crop
// used everywhere a reward is listed.
//
// Deliberately generic (it takes a plain image src + captions rather than a
// RewardItem) so anything else with a picture worth enlarging can reuse it
// later. The hidden-until-unlocked rule is NOT enforced here — it's enforced
// at the one place that decides whether a photo is even rendered, in
// rewardVisual, which only wires up a click handler for a Photocard that's
// genuinely owned. Keeping the check there means a caller can't reach this
// function with a locked card's photo by mistake.
// ============================================================================

import { el } from "./dom.js";

export interface LightboxOptions {
  /** The image to display, typically a stored data: URL. */
  src: string;
  title?: string;
  /** A short line under the title — e.g. the reward's rarity. */
  subtitle?: string;
  /** Optional longer caption, e.g. the item's flavor text. */
  caption?: string;
}

/** The currently-open overlay, if any. Tracked so a second click can't stack
 * two overlays and so the Escape/backdrop handlers always act on the right
 * one. */
let openOverlay: HTMLElement | null = null;
let lastFocused: HTMLElement | null = null;

export function closeLightbox(): void {
  if (!openOverlay) return;
  document.removeEventListener("keydown", onKeydown);
  openOverlay.remove();
  openOverlay = null;
  // Send focus back where it came from, so keyboard users aren't dumped at
  // the top of the document after closing.
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  lastFocused = null;
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    e.preventDefault();
    closeLightbox();
  }
}

export function openImageLightbox(opts: LightboxOptions): void {
  // Re-opening while one is already up (e.g. a stray double-click) replaces
  // it rather than stacking, so there's never more than one overlay to
  // dismiss.
  if (openOverlay) closeLightbox();
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const closeButton = el("button", { class: "lightbox-close", "aria-label": "Close", onclick: closeLightbox }, ["✕"]);

  const figure = el("div", { class: "lightbox-figure" }, [
    el("img", { class: "lightbox-image", src: opts.src, alt: opts.title ?? "Photocard" }),
    opts.title || opts.subtitle || opts.caption
      ? el("div", { class: "lightbox-caption" }, [
          opts.title ? el("div", { class: "lightbox-title" }, [opts.title]) : null,
          opts.subtitle ? el("div", { class: "lightbox-subtitle" }, [opts.subtitle]) : null,
          opts.caption ? el("div", { class: "lightbox-flavor" }, [opts.caption]) : null,
        ])
      : null,
  ]);

  const overlay = el(
    "div",
    {
      class: "lightbox-overlay",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": opts.title ?? "Enlarged image",
      // Only a click on the backdrop itself closes — a click that lands on
      // the image or its caption bubbles up to here too, so the target check
      // is what keeps "click the photo" from immediately dismissing it.
      onclick: (e: Event) => {
        if (e.target === overlay) closeLightbox();
      },
    },
    [closeButton, figure]
  );

  document.body.appendChild(overlay);
  openOverlay = overlay;
  document.addEventListener("keydown", onKeydown);
  closeButton.focus();
}
