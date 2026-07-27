// ============================================================================
// Photocard Album page — a binder for unlocked Photocards, 3x3 (9 per page),
// with a decoratable front cover for owned Stickers. Only ever shows
// Photocards that are actually owned (store.getOwnedPhotocards() already
// filters to that), so this page never risks revealing one ahead of its
// tier — mirroring the same guarantee rewardVisual enforces elsewhere.
// ============================================================================

import { store } from "../data/store.js";
import { mountNav } from "../ui/nav.js";
import { el, clear, qs } from "../ui/dom.js";
import { rarityLabel } from "../data/rewards.js";
import { rewardVisual, renderProfileBanner } from "../ui/rewardVisuals.js";
import { showToast } from "../ui/toast.js";
import type { RewardItem } from "../types.js";

const PHOTOCARDS_PER_PAGE = 9;
const GRID_SIZE = 3;

/** Page 0 is always the front cover; pages 1..N are photocard pages. Kept as
 * page-local state (not in the store) since "which page you're looking at"
 * isn't something worth persisting — reset to the cover on every fresh load
 * of the page, but preserved across in-page re-renders (e.g. placing a
 * sticker shouldn't bounce you back to the cover... it IS the cover, so that
 * case is moot, but removing/placing a sticker while mid-album should also
 * not reset your page). */
let currentPage = 0;

function totalPhotocardPages(ownedCount: number): number {
  return Math.max(1, Math.ceil(ownedCount / PHOTOCARDS_PER_PAGE));
}

function renderCoverPage(): HTMLElement {
  const ownedStickers = store.getOwnedStickers();
  const placed = store.getCoverStickers();
  const placedIds = new Set(placed.map((s) => s.itemId));
  const tray = ownedStickers.filter((s) => !placedIds.has(s.id));

  const bp = store.getState().battlepass;
  const stickerItem = (itemId: string): RewardItem | undefined =>
    bp.categories.find((c) => c.id === "cat-stickers")?.items.find((i) => i.id === itemId);

  const coverEl = el(
    "div",
    { class: "album-cover" },
    [
      el("div", { class: "album-cover-plate" }, [
        el("div", { class: "album-cover-title" }, ["Photocard Album"]),
        el("div", { class: "album-cover-subtitle" }, ["Decorate the front with any Stickers you've unlocked."]),
      ]),
      ...placed.map((ps) => {
        const item = stickerItem(ps.itemId);
        if (!item) return null;
        return el(
          "button",
          {
            class: "cover-sticker",
            title: `${item.name} — click to remove`,
            style: `left:${ps.xPct}%; top:${ps.yPct}%; transform: translate(-50%, -50%) rotate(${ps.rotationDeg}deg);`,
            onclick: () => {
              store.removeStickerFromCover(ps.itemId);
              showToast("Sticker removed", `${item.name} is back in your tray.`);
            },
          },
          [item.description || "⭐"]
        );
      }),
    ].filter((n) => n !== null) as HTMLElement[]
  );

  const trayEl =
    ownedStickers.length === 0
      ? el("p", { class: "muted small" }, ["No Stickers unlocked yet — earn some from the Battlepass and they'll show up here to place on the cover."])
      : el("div", { class: "sticker-tray" }, [
          tray.length === 0
            ? el("p", { class: "muted small" }, ["All your Stickers are already placed on the cover — click one on the cover to peel it back off."])
            : el(
                "div",
                { class: "sticker-tray-grid" },
                tray.map((item) =>
                  el(
                    "button",
                    {
                      class: "sticker-tray-item",
                      title: `${item.name} — click to place on the cover`,
                      onclick: () => {
                        store.placeStickerOnCover(item.id);
                        showToast("Sticker placed", item.name);
                      },
                    },
                    [
                      el("div", { class: "sticker-tray-emoji" }, [item.description || "⭐"]),
                      el("div", { class: "sticker-tray-name" }, [item.name]),
                    ]
                  )
                )
              ),
        ]);

  return el("div", { class: "card album-page" }, [
    el("h2", {}, ["Front Cover"]),
    coverEl,
    el("div", { style: "margin-top:16px;" }, [el("h3", { style: "margin-bottom:8px;" }, ["Sticker Tray"]), trayEl]),
  ]);
}

function renderPhotocardPage(pageIndex: number, owned: RewardItem[]): HTMLElement {
  const start = pageIndex * PHOTOCARDS_PER_PAGE;
  const pageItems = owned.slice(start, start + PHOTOCARDS_PER_PAGE);
  const slots: (RewardItem | null)[] = [...pageItems];
  while (slots.length < PHOTOCARDS_PER_PAGE) slots.push(null);

  return el("div", { class: "card album-page" }, [
    el("h2", {}, [`Page ${pageIndex + 1}`]),
    owned.length === 0
      ? el("p", { class: "muted small" }, ["No Photocards unlocked yet — keep climbing the Battlepass tiers and any you unlock will show up here."])
      : el(
          "div",
          { class: "photocard-binder-grid", style: `grid-template-columns: repeat(${GRID_SIZE}, 1fr);` },
          slots.map((item) =>
            item
              ? el("div", { class: "photocard-pocket filled" }, [
                  rewardVisual("cat-photocards", item.id, item.description, { imageDataUrl: item.imageDataUrl, revealed: true }),
                  el("div", { class: "photocard-pocket-caption" }, [
                    el("div", { class: "name" }, [item.name]),
                    el("div", { class: `rarity-${item.rarity}` }, [rarityLabel(item.rarity)]),
                  ]),
                ])
              : el("div", { class: "photocard-pocket empty" }, [el("div", { class: "photocard-pocket-placeholder" }, ["empty pocket"])])
          )
        ),
  ]);
}

function renderPagination(totalPages: number): HTMLElement {
  return el("div", { class: "album-pagination" }, [
    el(
      "button",
      { class: "small", disabled: currentPage === 0, onclick: () => { currentPage--; render(); } },
      ["← Previous"]
    ),
    el("span", { class: "muted small" }, [currentPage === 0 ? "Front Cover" : `Page ${currentPage} of ${totalPages - 1}`]),
    el(
      "button",
      { class: "small", disabled: currentPage >= totalPages - 1, onclick: () => { currentPage++; render(); } },
      ["Next →"]
    ),
    el(
      "button",
      { class: "small ghost", disabled: currentPage === 0, onclick: () => { currentPage = 0; render(); } },
      ["⏮ Return to Front"]
    ),
  ]);
}

function render(): void {
  const root = qs<HTMLElement>("#page-root");
  clear(root);
  root.appendChild(renderProfileBanner());

  const owned = store.getOwnedPhotocards();
  const photocardPages = totalPhotocardPages(owned.length);
  const totalPages = 1 + photocardPages; // + the cover
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  if (currentPage < 0) currentPage = 0;

  root.appendChild(renderPagination(totalPages));
  root.appendChild(currentPage === 0 ? renderCoverPage() : renderPhotocardPage(currentPage - 1, owned));
  root.appendChild(renderPagination(totalPages));
}

document.addEventListener("DOMContentLoaded", () => {
  mountNav("photocardAlbum");
  render();
  store.subscribe(render);
});
