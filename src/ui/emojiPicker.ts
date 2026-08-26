// ============================================================================
// Emoji picker — used when creating a Sticker or an Avatar reward, both of
// which are "a name plus one emoji" (the emoji lives in RewardItem.description,
// see rewardVisual).
//
// A grid of curated emoji plus a free-text box, rather than the full Unicode
// set. Two reasons: the complete emoji list is thousands of entries and needs
// real search to be usable at all, and browsers already ship a proper picker
// behind the OS emoji shortcut. So the grid covers the obvious choices in one
// glance, and anything else can be pasted or typed into the box next to it.
// ============================================================================

import { el } from "./dom.js";

/** Grouped so the grid reads as sections rather than one undifferentiated
 * wall. Kept deliberately broad — faces, people, animals, food, activities,
 * travel, objects, symbols — so most reward ideas land somewhere. */
export const EMOJI_GROUPS: { label: string; emoji: string[] }[] = [
  {
    label: "Smileys",
    emoji: ["😀", "😄", "😁", "😊", "🙂", "😉", "😍", "🥰", "😘", "😎", "🤩", "🥳", "🤗", "🤔", "😴", "😇", "🙃", "😌", "😏", "🥺", "😭", "😤", "😱", "🤯"],
  },
  {
    label: "People",
    emoji: ["👋", "👍", "👏", "🙌", "💪", "🤝", "🫶", "✌️", "🤙", "🧑", "👤", "🧙", "🦸", "🥷", "👑", "🎤", "🕺", "💃", "🧘", "🏃", "🚶", "🤺"],
  },
  {
    label: "Animals",
    emoji: ["🐶", "🐱", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦆", "🦉", "🦄", "🐝", "🦋", "🐢", "🐙", "🦈", "🐳", "🦕", "🐉"],
  },
  {
    label: "Food",
    emoji: ["🍎", "🍊", "🍋", "🍉", "🍇", "🍓", "🍑", "🥭", "🍍", "🥑", "🍔", "🍕", "🌮", "🍜", "🍣", "🍙", "🍩", "🍪", "🎂", "🍰", "🍫", "🍭", "☕", "🧋", "🍺"],
  },
  {
    label: "Activities",
    emoji: ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏓", "🏸", "🥊", "🎯", "🎳", "🎮", "🕹️", "🎲", "🧩", "♟️", "🎸", "🎹", "🥁", "🎺", "🎬", "🎨", "🏆", "🥇", "🎖️", "🏅"],
  },
  {
    label: "Travel",
    emoji: ["🚗", "🚕", "🚌", "🚑", "🚚", "🏎️", "🚲", "🛴", "✈️", "🚀", "🛸", "🚢", "⛵", "🗺️", "🧭", "🏔️", "🌋", "🏝️", "🏜️", "🌇", "🗽", "🗼", "🎡", "🎢"],
  },
  {
    label: "Objects",
    emoji: ["💡", "🔑", "🔒", "📱", "💻", "⌨️", "🖨️", "📷", "🎧", "📻", "⏰", "⌛", "🔋", "🔦", "📚", "📖", "✏️", "📝", "📌", "📎", "✂️", "🧪", "🔬", "🔭", "🎁", "📦"],
  },
  {
    label: "Nature",
    emoji: ["🌱", "🌿", "🍀", "🌵", "🌴", "🌳", "🌸", "🌺", "🌻", "🌼", "🌷", "🍁", "🍂", "🌊", "🔥", "❄️", "⛄", "☀️", "🌤️", "🌈", "⚡", "🌙", "⭐", "✨", "💫", "☄️"],
  },
  {
    label: "Symbols",
    emoji: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💯", "✅", "❌", "⚠️", "🔔", "🎵", "🎶", "💬", "♻️", "⚓", "⚙️", "🛡️", "⚔️", "🃏", "🎴", "🔮", "🏁"],
  },
];

export interface EmojiPicker {
  wrap: HTMLElement;
  /** The chosen emoji, or "" if nothing is selected. */
  value: () => string;
}

/** Builds a picker. `initial` preselects an emoji (used when editing). */
export function emojiPicker(initial = ""): EmojiPicker {
  let chosen = initial;

  const preview = el("span", { class: "emoji-picker-preview" }, [chosen || "—"]);
  const input = el("input", {
    type: "text",
    class: "emoji-picker-input",
    placeholder: "or paste any emoji",
    value: chosen,
    maxlength: "8",
  }) as HTMLInputElement;

  const grid = el("div", { class: "emoji-picker-grid" });
  const buttons: HTMLButtonElement[] = [];

  const select = (emoji: string, fromInput = false) => {
    chosen = emoji;
    preview.textContent = emoji || "—";
    if (!fromInput) input.value = emoji;
    for (const b of buttons) b.classList.toggle("selected", b.textContent === emoji && emoji !== "");
  };

  for (const group of EMOJI_GROUPS) {
    grid.appendChild(el("div", { class: "emoji-picker-group-label" }, [group.label]));
    const row = el("div", { class: "emoji-picker-row" });
    for (const emoji of group.emoji) {
      const button = el(
        "button",
        { type: "button", class: "emoji-picker-button", onclick: () => select(emoji) },
        [emoji]
      ) as HTMLButtonElement;
      buttons.push(button);
      row.appendChild(button);
    }
    grid.appendChild(row);
  }

  // Typing wins over the grid, so anything the grid doesn't cover is still
  // reachable — the grid is a shortcut, not the whole vocabulary.
  input.addEventListener("input", () => select(input.value.trim(), true));

  const wrap = el("div", { class: "emoji-picker" }, [
    el("div", { class: "emoji-picker-top" }, [
      el("span", { class: "muted small" }, ["Chosen:"]),
      preview,
      input,
    ]),
    grid,
  ]);

  select(chosen);
  return { wrap, value: () => chosen };
}
