// ============================================================================
// Checkbox marks.
//
// These used to be text glyphs — "✓", "✗", "★", "✦" — set in whatever font
// happened to resolve them. That never centred reliably, and the reason is
// worth writing down so it doesn't get "fixed" back:
//
//   * A glyph's ink is not centred in its em box. ★ and ✗ in particular are
//     drawn sitting on the baseline with most of their mass above it, so a
//     geometrically centred *box* puts the visible mark low.
//   * The horizontal advance includes side bearings that differ per glyph, so
//     centring the box doesn't centre the ink there either.
//   * Both of those vary by font, and therefore by machine. Windows resolves
//     these to Segoe UI Symbol; a Mac picks Apple Symbols. Nudging one into
//     place by hand simply moves the problem to the other.
//
// So the built-in marks are drawn here instead, as SVG paths on a shared
// 24×24 box with the ink centred on (12, 12) by construction. No font is
// consulted, nothing to nudge, and every style lands in the same place.
//
// A mark added by the user is still arbitrary text (usually an emoji), which
// can't be drawn from a path. Those get measured instead: the glyph is
// rendered once to an offscreen canvas, its ink centroid is compared to where
// CSS will put its box, and the difference is handed back as a correction.
// Measuring beats guessing here — across common emoji the offset ranges from
// about 1.8px above centre to 0.8px below, so any fixed nudge is wrong for
// most of them.
// ============================================================================

import { el, svgEl } from "./dom.js";

/** The built-in marks, keyed by the checkbox reward's id. Each path is drawn
 * inside a 24×24 viewBox with its BOUNDING BOX centred on (12, 12) — checked
 * by test/checkbox-align. Bounding box, not centre of construction: a star
 * built about its polar centre puts more of itself below that point than
 * above, which is exactly what makes it look like it's sitting low. */
const MARK_PATHS: Record<string, { d: string; fill?: boolean; width?: number }> = {
  // A tick. The stroke is added evenly either side of this spine, so centring
  // the spine centres the ink — with a half-unit lift, because the long arm
  // rising to the right leaves slightly more mass low than high.
  "check-pen-tick": { d: "M5.5 11.65 L10 16.25 L18.5 6.75", width: 2.6 },
  // The same tick — Highlighter differs by its colour and the band it draws
  // across the task text, not by its mark.
  "check-highlighter": { d: "M5.5 11.65 L10 16.25 L18.5 6.75", width: 2.6 },
  // A cross: two strokes of equal length crossing exactly at the centre.
  "check-red-pen": { d: "M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5", width: 2.6 },
  // A five-pointed star: outer radius 7.4, inner radius 2.9, top point first,
  // then translated so its bounding box lands on (12, 12) and lifted a further
  // 0.75. Even bbox-centred it reads low, because a star's ink is concentrated
  // in the wide lower body while the top is a single thin point — the lift
  // splits the difference between centring the box and centring the mass.
  "check-gold-star": {
    d: "M12.00 4.56 L13.70 9.61 L19.04 9.67 L14.76 12.85 L16.35 17.94 L12.00 14.86 L7.65 17.94 L9.24 12.85 L4.96 9.67 L10.30 9.61 Z",
    fill: true,
  },
  // A four-pointed seal mark: a concave diamond, symmetrical on both axes
  // about (12, 12), so its bounding box is centred by construction.
  "check-wax-seal": {
    d: "M12 4.4 C12.9 9.4 14.6 11.1 19.6 12 C14.6 12.9 12.9 14.6 12 19.6 C11.1 14.6 9.4 12.9 4.4 12 C9.4 11.1 11.1 9.4 12 4.4 Z",
    fill: true,
  },
};

/** The font a text mark is set in. Pinned so a mark can't drift when a Font
 * reward is equipped, and so the measurement below describes the same
 * rendering the page will actually do. */
const MARK_FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI Symbol", "Apple Symbols", sans-serif`;

/** Measured ink offsets, keyed by glyph. Each measurement costs one small
 * canvas draw, and the answer never changes for a given glyph on a given
 * machine, so it's worth keeping. */
const inkOffsets = new Map<string, { x: number; y: number }>();

/** How far a glyph's ink sits from the centre of the box CSS gives it, as a
 * fraction of the font size (so one measurement serves every size it's drawn
 * at). Positive x is right, positive y is down.
 *
 * The box CSS centres is the inline box: `advance width` wide, and — with
 * line-height: 1 — one em tall, sitting half-leading below the ascent. Both
 * of those are reconstructed here from the same font metrics the layout uses,
 * so the ink position is measured against the real box rather than a guess at
 * it. Returns zero if a canvas isn't available or the glyph paints nothing. */
function measureInkOffset(text: string): { x: number; y: number } {
  const cached = inkOffsets.get(text);
  if (cached) return cached;
  const zero = { x: 0, y: 0 };
  try {
    const F = 48; // measure large; the result is normalised back to 1em
    const canvas = document.createElement("canvas");
    canvas.width = F * 4;
    canvas.height = F * 4;
    const ctx = canvas.getContext("2d");
    if (!ctx) return zero;
    ctx.font = `${F}px ${MARK_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const metrics = ctx.measureText(text);
    const advance = metrics.width;
    const ascent = metrics.fontBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent;
    if (!advance || ascent === undefined || descent === undefined) return zero;

    const originX = F;
    const originY = F * 2.5;
    ctx.fillStyle = "#fff";
    ctx.fillText(text, originX, originY);

    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let total = 0;
    let sx = 0;
    let sy = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha <= 8) continue;
        total += alpha;
        sx += alpha * (x + 0.5);
        sy += alpha * (y + 0.5);
      }
    }
    if (total === 0) return zero;

    // The inline box, in the same canvas coordinates.
    const boxCentreX = originX + advance / 2;
    const boxTop = originY - (F + ascent - descent) / 2;
    const boxCentreY = boxTop + F / 2;

    const offset = { x: (sx / total - boxCentreX) / F, y: (sy / total - boxCentreY) / F };
    inkOffsets.set(text, offset);
    return offset;
  } catch {
    return zero;
  }
}

/** True if this checkbox style has a drawn mark rather than a text one.
 * Custom styles added from Settings carry an emoji instead and fall back. */
export function hasDrawnMark(checkboxId: string | null | undefined): boolean {
  return !!checkboxId && checkboxId in MARK_PATHS;
}

/** The mark for a checkbox style, ready to drop inside the box: an SVG for
 * the built-ins, or the text glyph for anything user-added. `size` is the
 * rendered edge length in px — the drawing scales, so the same mark is used
 * for a 22px checkbox and a small reward preview without redrawing it. */
export function checkboxMark(checkboxId: string | null | undefined, fallbackText: string, size = 14): HTMLElement {
  // No style equipped is the plain tick, drawn the same way as the rest —
  // the default shouldn't be the one shape still at the mercy of a font.
  const spec = MARK_PATHS[checkboxId || "check-pen-tick"];
  if (!spec) {
    // Arbitrary text — can't be drawn from a path, so it gets measured and
    // corrected. The correction is published as two em-relative custom
    // properties; the centring itself stays in CSS (see .mark-glyph-text).
    const text = fallbackText || "✓";
    const ink = measureInkOffset(text);
    const span = el("span", { class: "mark-glyph mark-glyph-text" }, [text]);
    span.style.setProperty("--ink-x", String(-ink.x));
    span.style.setProperty("--ink-y", String(-ink.y));
    return span;

  }
  const path = svgEl("path", {
    d: spec.d,
    fill: spec.fill ? "currentColor" : "none",
    stroke: spec.fill ? "none" : "currentColor",
    "stroke-width": String(spec.width ?? 2.6),
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  return svgEl(
    "svg",
    {
      class: "mark-glyph mark-glyph-svg",
      viewBox: "0 0 24 24",
      width: String(size),
      height: String(size),
      "aria-hidden": "true",
      focusable: "false",
    },
    [path]
  ) as unknown as HTMLElement;
}
