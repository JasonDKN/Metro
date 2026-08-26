// ============================================================================
// Daily Puzzles card (Daily General Checklist page) — lets you log today's
// score for each configured game and see the Battlepass points it earns.
// Scoring math lives in src/data/dailyGames.ts; this file is purely the input
// UI for each of the three scoring patterns (see DailyGameScoring in
// types.ts).
// ============================================================================

import { store } from "../data/store.js";
import { el } from "./dom.js";
import { enableDragReorder } from "./dragList.js";
import { showToast } from "./toast.js";
import { todayISO } from "../util/date.js";
import {
  buildDailyGameScoring,
  computeDailyGamePoints,
  describeDailyGameScoring,
  formatDailyGameRawValue,
} from "../data/dailyGames.js";
import type { DailyGameScoringKind } from "../data/dailyGames.js";
import type { DailyGameConfig, DailyGameEntry } from "../types.js";

type GameInput = { rawValue?: number; guesses?: number | null; actualUnderPar?: number; bestUnderPar?: number };

function secondsToParts(total: number): { m: number; s: number } {
  return { m: Math.floor(total / 60), s: total % 60 };
}

export function renderDailyGamesCard(): HTMLElement {
  const date = todayISO();
  const dg = store.getState().dailyGames;
  const games = store.getVisibleDailyGames();
  const hiddenCount = store.getDailyGames().length - games.length;

  return el("div", { class: "card" }, [
    el("h2", {}, ["Daily Puzzles"]),
    el("p", { class: "muted small" }, [
      `Log today's score for each puzzle — points scale from ${dg.minPoints} to ${dg.maxPoints}, roughly matching a Medium-to-Extreme task.`,
    ]),
    games.length === 0
      ? el("div", { class: "empty-state", style: "margin-top:12px;" }, [
          hiddenCount > 0
            ? "Every puzzle is hidden right now — unhide one in Settings to start logging again."
            : "No puzzles yet — add one in Settings and it'll show up here to log every day.",
        ])
      : el(
          "div",
          { class: "task-list", style: "margin-top: 12px;" },
          games.map((g) => renderGameRow(g, date))
        ),
    el("p", { class: "muted small", style: "margin-top:12px;" }, [
      "Add, hide, or reorder puzzles on the ",
      el("a", { href: "settings.html" }, ["Settings"]),
      " page.",
      hiddenCount > 0 ? ` ${hiddenCount} hidden.` : "",
    ]),
  ]);
}

function renderGameRow(config: DailyGameConfig, date: string): HTMLElement {
  const existing = store.getDailyGameEntry(config.id, date);
  const bestEntry = store.getBestDailyGameEntry(config.id);
  const controls = buildInputs(config, existing);

  const submit = () => {
    const input = controls.read();
    if (input === null) {
      showToast("Enter a score first", `Fill in ${config.name}'s result before saving.`);
      return;
    }
    const result = store.recordDailyGameResult(config.id, date, input);
    if (!result) return;
    const isNewRecord = bestEntry === null || result.pointsAwarded > bestEntry.pointsAwarded;
    showToast(
      `${config.name}: ${result.pointsAwarded} pts`,
      (existing ? "Updated today's score." : "Recorded for today.") + (isNewRecord ? " 🏆 New Personal Record!" : ""),
      "success"
    );
  };

  return el("div", { class: "task-item puzzle-row" }, [
    el("div", { style: "display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:6px;" }, [
      el("strong", { style: "font-size:14px;" }, [config.name]),
      el("div", { style: "display:flex; gap:6px; align-items:center;" }, [
        bestEntry !== null
          ? el("span", { class: "weekday-tag record-tag" }, [`🏆 Personal Record: ${formatDailyGameRawValue(config, bestEntry)}`])
          : null,
        existing
          ? el("span", { class: "weekday-tag" }, [`Today: ${existing.pointsAwarded} pts`])
          : el("span", { class: "muted small" }, ["Not recorded today"]),
      ]),
    ]),
    el("div", { style: "display:flex; flex-wrap:wrap; align-items:flex-end; gap:10px; width:100%;" }, [
      controls.wrap,
      el("button", { class: "small primary", onclick: submit }, [existing ? "Update Score" : "Save Score"]),
    ]),
  ]);
}

function buildInputs(
  config: DailyGameConfig,
  existing: DailyGameEntry | undefined
): { wrap: HTMLElement; read: () => GameInput | null } {
  const scoring = config.scoring;

  if (scoring.method === "linearRange" && scoring.unit === "seconds") {
    const startParts = existing?.rawValue !== undefined ? secondsToParts(existing.rawValue) : null;
    const wasDnf = existing?.rawValue !== undefined && existing.rawValue >= scoring.worst;
    const minInput = el("input", {
      type: "number",
      min: "0",
      style: "width:70px;",
      value: startParts ? String(startParts.m) : "",
    }) as HTMLInputElement;
    const secInput = el("input", {
      type: "number",
      min: "0",
      max: "59",
      style: "width:70px;",
      value: startParts ? String(startParts.s) : "",
    }) as HTMLInputElement;
    const dnfBox = el("input", { type: "checkbox" }) as HTMLInputElement;
    dnfBox.checked = !!wasDnf;
    minInput.disabled = dnfBox.checked;
    secInput.disabled = dnfBox.checked;
    dnfBox.addEventListener("change", () => {
      minInput.disabled = dnfBox.checked;
      secInput.disabled = dnfBox.checked;
    });
    const wrap = el("div", { style: "display:flex; align-items:flex-end; gap:8px; flex-wrap:wrap;" }, [
      el("div", { class: "field", style: "margin:0;" }, [el("label", {}, ["Minutes"]), minInput]),
      el("div", { class: "field", style: "margin:0;" }, [el("label", {}, ["Seconds"]), secInput]),
      el("label", { class: "check-inline", style: "margin-bottom:9px;" }, [dnfBox, "Didn't finish / 15:00+"]),
    ]);
    return {
      wrap,
      read: () => {
        if (dnfBox.checked) return { rawValue: scoring.worst };
        if (minInput.value === "" || secInput.value === "") return null;
        const m = Number(minInput.value);
        const s = Number(secInput.value);
        if (Number.isNaN(m) || Number.isNaN(s)) return null;
        return { rawValue: Math.min(scoring.worst, Math.max(0, m * 60 + s)) };
      },
    };
  }

  if (scoring.method === "linearRange") {
    const lo = Math.min(scoring.worst, scoring.best);
    const hi = Math.max(scoring.worst, scoring.best);
    const input = el("input", {
      type: "number",
      min: String(lo),
      max: String(hi),
      style: "width:110px;",
      value: existing?.rawValue !== undefined ? String(existing.rawValue) : "",
      placeholder: `${lo}-${hi}`,
    }) as HTMLInputElement;
    const wrap = el("div", { class: "field", style: "margin:0;" }, [el("label", {}, ["Score"]), input]);
    return {
      wrap,
      read: () => {
        if (input.value === "") return null;
        const v = Number(input.value);
        if (Number.isNaN(v)) return null;
        return { rawValue: v };
      },
    };
  }

  if (scoring.method === "guessCount") {
    const select = el("select", { style: "width:160px;" }) as HTMLSelectElement;
    select.appendChild(el("option", { value: "" }, ["Select result…"]));
    for (let i = scoring.bestGuesses; i <= scoring.worstGuesses; i++) {
      select.appendChild(el("option", { value: String(i) }, [`${i} guess${i === 1 ? "" : "es"}`]));
    }
    select.appendChild(el("option", { value: "fail" }, ["Fail"]));
    if (existing) select.value = existing.guesses === null ? "fail" : String(existing.guesses ?? "");
    const wrap = el("div", { class: "field", style: "margin:0;" }, [el("label", {}, ["Result"]), select]);
    return {
      wrap,
      read: () => {
        if (select.value === "") return null;
        return select.value === "fail" ? { guesses: null } : { guesses: Number(select.value) };
      },
    };
  }

  // underParDailyBest
  const actualInput = el("input", {
    type: "number",
    style: "width:90px;",
    value: existing?.actualUnderPar !== undefined ? String(existing.actualUnderPar) : "",
    placeholder: "e.g. 1",
  }) as HTMLInputElement;
  const bestInput = el("input", {
    type: "number",
    min: "0",
    style: "width:90px;",
    value: existing?.bestUnderPar !== undefined ? String(existing.bestUnderPar) : "",
    placeholder: "e.g. 2",
  }) as HTMLInputElement;
  const wrap = el("div", { style: "display:flex; align-items:flex-end; gap:8px; flex-wrap:wrap;" }, [
    el("div", { class: "field", style: "margin:0;" }, [el("label", {}, ["Your guesses under par"]), actualInput]),
    el("div", { class: "field", style: "margin:0;" }, [el("label", {}, ["Best possible today"]), bestInput]),
  ]);
  return {
    wrap,
    read: () => {
      if (actualInput.value === "" || bestInput.value === "") return null;
      const actual = Number(actualInput.value);
      const best = Number(bestInput.value);
      if (Number.isNaN(actual) || Number.isNaN(best)) return null;
      return { actualUnderPar: actual, bestUnderPar: best };
    },
  };
}

// ---------------------------------------------------------------------------
// Managing the puzzle list
//
// Adding a puzzle asks three things: what it's called, how it's scored, and
// the minimum and maximum scores possible. Those bounds are the anchors the
// point curve is built from — see buildDailyGameScoring — so the form shows a
// live preview of what each end is actually worth rather than making the user
// guess at how their numbers will be interpreted.
// ---------------------------------------------------------------------------

interface ScoringKindMeta {
  label: string;
  minLabel: string;
  maxLabel: string;
  /** Whether the minimum or the maximum is the better result — drives the
   * preview wording and nothing else (the real mapping lives in
   * buildDailyGameScoring). */
  betterEnd: "min" | "max";
  step: string;
}

const SCORING_KINDS: Record<DailyGameScoringKind, ScoringKindMeta> = {
  higherScore: { label: "A score — higher is better", minLabel: "Minimum score", maxLabel: "Maximum score", betterEnd: "max", step: "any" },
  lowerScore: { label: "A score — lower is better", minLabel: "Minimum score", maxLabel: "Maximum score", betterEnd: "min", step: "any" },
  fasterTime: { label: "A time in seconds — faster is better", minLabel: "Fastest time (seconds)", maxLabel: "Slowest time (seconds)", betterEnd: "min", step: "1" },
  fewerGuesses: { label: "Guesses — fewer is better", minLabel: "Fewest guesses", maxLabel: "Most guesses", betterEnd: "min", step: "1" },
};

/** The full manage UI, as a standalone card for the Settings page. Kept in
 * this module rather than in pages/settings.ts so it sits next to the logging
 * UI and the scoring helpers it shares. */
export function renderManagePuzzlesCard(): HTMLElement {
  return el("div", { class: "card puzzle-manage" }, [
    el("h2", {}, ["Daily Puzzles"]),
    el("p", { class: "muted small" }, [
      "Add a puzzle you've picked up, hide one you're taking a break from, or drag them into the order you like. Hiding keeps every logged day and your Personal Record — only removing throws those away, and even then the Battlepass points it earned stay on your season.",
    ]),
    renderManageList(),
    renderAddPuzzleForm(),
  ]);
}

function renderManageList(): HTMLElement {
  const dg = store.getState().dailyGames;
  const games = store.getDailyGames();
  if (games.length === 0) {
    return el("p", { class: "muted small" }, ["Nothing to manage yet."]);
  }

  const list = el("div", { class: "puzzle-manage-list" });
  // Same drag behaviour as checklist tasks and the DC strip — see ui/dragList.
  const attachDrag =
    games.length > 1
      ? enableDragReorder(list, {
          itemSelector: ".puzzle-manage-row",
          order: () => store.getDailyGames().map((c) => c.id),
          onReorder: (orderedIds) => store.reorderDailyGames(orderedIds),
        })
      : null;

  for (const config of games) {
    const hidden = !!config.hidden;
    const entryCount = dg.entries.filter((e) => e.gameId === config.id).length;
    const row = el("div", { class: `puzzle-manage-row${hidden ? " hidden-puzzle" : ""}` });
    if (attachDrag) row.appendChild(attachDrag(row, config.id));
    row.appendChild(
      el("div", { style: "flex:1; min-width:180px;" }, [
        el("div", { class: "puzzle-manage-name" }, [
          config.name,
          hidden ? el("span", { class: "weekday-tag", style: "margin-left:8px;" }, ["Hidden"]) : null,
        ]),
        el("div", { class: "puzzle-manage-rule" }, [describeDailyGameScoring(config, dg)]),
      ])
    );

    // Two-step confirm, inline rather than a browser confirm() dialog:
    // removal throws away logged history, so it shouldn't be one stray
    // click away, but a modal for a puzzle you no longer play is heavy.
    const actions = el("div", { style: "display:flex; gap:6px; align-items:center; flex-wrap:wrap;" });
    const showConfirm = () => {
      while (actions.firstChild) actions.removeChild(actions.firstChild);
      actions.appendChild(
        el("span", { class: "muted small" }, [
          entryCount > 0 ? `Remove and discard ${entryCount} logged ${entryCount === 1 ? "day" : "days"}?` : "Remove this puzzle?",
        ])
      );
      actions.appendChild(
        el(
          "button",
          {
            class: "small danger",
            onclick: () => {
              if (store.removeDailyGame(config.id)) {
                showToast("Puzzle removed", `${config.name} is gone. The points it earned are still yours.`);
              }
            },
          },
          ["Yes, remove"]
        )
      );
      actions.appendChild(el("button", { class: "small ghost", onclick: showDefault }, ["Cancel"]));
    };
    const showDefault = () => {
      while (actions.firstChild) actions.removeChild(actions.firstChild);
      actions.appendChild(
        el(
          "button",
          {
            class: "small",
            title: hidden ? "Show this puzzle on the Daily page again" : "Keep this puzzle out of the daily list, without losing its history",
            onclick: () => {
              store.setDailyGameHidden(config.id, !hidden);
              showToast(
                hidden ? "Puzzle shown" : "Puzzle hidden",
                hidden
                  ? `${config.name} is back on the Daily page.`
                  : `${config.name} is off the daily list. Its history and Personal Record are kept.`
              );
            },
          },
          [hidden ? "👁 Show" : "🙈 Hide"]
        )
      );
      actions.appendChild(el("button", { class: "small danger ghost", onclick: showConfirm }, ["Remove"]));
    };
    showDefault();

    row.appendChild(actions);
    list.appendChild(row);
  }

  return list;
}

function renderAddPuzzleForm(): HTMLElement {
  const dg = store.getState().dailyGames;

  const nameInput = el("input", { type: "text", placeholder: "e.g. Connections" }) as HTMLInputElement;
  const kindSelect = el(
    "select",
    {},
    (Object.keys(SCORING_KINDS) as DailyGameScoringKind[]).map((k, i) =>
      el("option", { value: k, selected: i === 0 }, [SCORING_KINDS[k].label])
    )
  ) as HTMLSelectElement;

  const minInput = el("input", { type: "number", step: "any", style: "width:130px;" }) as HTMLInputElement;
  const maxInput = el("input", { type: "number", step: "any", style: "width:130px;" }) as HTMLInputElement;
  const failInput = el("input", { type: "number", min: "0", step: "1", value: "0", style: "width:130px;" }) as HTMLInputElement;

  const minLabel = el("label", {}, [SCORING_KINDS.higherScore.minLabel]);
  const maxLabel = el("label", {}, [SCORING_KINDS.higherScore.maxLabel]);
  const minField = el("div", { class: "field", style: "flex: 0 0 150px;" }, [minLabel, minInput]);
  const maxField = el("div", { class: "field", style: "flex: 0 0 150px;" }, [maxLabel, maxInput]);
  const failField = el("div", { class: "field", style: "flex: 0 0 150px;" }, [el("label", {}, ["Points if you fail"]), failInput]);

  const preview = el("div", { class: "puzzle-scoring-preview" });

  const currentKind = (): DailyGameScoringKind => kindSelect.value as DailyGameScoringKind;

  const readDraft = () => ({
    kind: currentKind(),
    minValue: minInput.value === "" ? NaN : Number(minInput.value),
    maxValue: maxInput.value === "" ? NaN : Number(maxInput.value),
    failPoints: failInput.value === "" ? 0 : Number(failInput.value),
  });

  const refresh = () => {
    const meta = SCORING_KINDS[currentKind()];
    minLabel.textContent = meta.minLabel;
    maxLabel.textContent = meta.maxLabel;
    minInput.step = meta.step;
    maxInput.step = meta.step;
    failField.style.display = currentKind() === "fewerGuesses" ? "" : "none";

    while (preview.firstChild) preview.removeChild(preview.firstChild);
    preview.className = "puzzle-scoring-preview";

    const draft = readDraft();
    if (Number.isNaN(draft.minValue) || Number.isNaN(draft.maxValue)) {
      preview.appendChild(
        el("span", { class: "muted" }, ["Fill in the minimum and maximum and I'll work out what each score is worth."])
      );
      return;
    }

    const built = buildDailyGameScoring(draft);
    if (!built.ok) {
      preview.className = "puzzle-scoring-preview invalid";
      preview.appendChild(el("span", {}, [built.error]));
      return;
    }

    // Run the real scoring function rather than restating the formula, so
    // the preview can never drift from what actually gets awarded.
    const probe: DailyGameConfig = { id: "preview", name: "preview", scoring: built.scoring, builtIn: false, createdAt: "" };
    const asInput = (value: number) =>
      built.scoring.method === "guessCount" ? { guesses: value } : { rawValue: value };
    const minPts = computeDailyGamePoints(probe, asInput(draft.minValue), dg);
    const maxPts = computeDailyGamePoints(probe, asInput(draft.maxValue), dg);
    const meta2 = SCORING_KINDS[currentKind()];
    const minIsBetter = meta2.betterEnd === "min";

    preview.appendChild(el("div", {}, [`${meta2.minLabel} (${draft.minValue}) earns `, el("strong", { class: minIsBetter ? "puzzle-preview-good" : "puzzle-preview-bad" }, [`${minPts} pts`])]));
    preview.appendChild(el("div", {}, [`${meta2.maxLabel} (${draft.maxValue}) earns `, el("strong", { class: minIsBetter ? "puzzle-preview-bad" : "puzzle-preview-good" }, [`${maxPts} pts`])]));
    if (built.scoring.method === "guessCount") {
      preview.appendChild(el("div", { class: "muted" }, [`A failed day earns ${built.scoring.failPoints} pts.`]));
    }
    preview.appendChild(el("div", { class: "muted" }, ["Anything in between scales smoothly across that range."]));
  };

  kindSelect.addEventListener("change", refresh);
  for (const input of [minInput, maxInput, failInput]) input.addEventListener("input", refresh);
  refresh();

  const submit = () => {
    const name = nameInput.value.trim();
    if (!name) {
      showToast("Name it first", "Give the puzzle a name so you can tell it apart in the list.");
      return;
    }
    const built = buildDailyGameScoring(readDraft());
    if (!built.ok) {
      showToast("Check the scores", built.error);
      return;
    }
    const added = store.addDailyGame(name, built.scoring);
    if (!added) {
      showToast("Already have that one", `A puzzle called "${name}" is already in your list.`);
      return;
    }
    // The store emit re-renders the whole card, so there's no need to reset
    // these inputs — this element is about to be replaced wholesale.
    showToast("Puzzle added", `${added.name} is ready to log.`, "success");
  };

  return el("div", {}, [
    el("h3", { style: "margin-top:4px;" }, ["Add a puzzle"]),
    el("div", { class: "inline-form" }, [
      el("div", { class: "field" }, [el("label", {}, ["Puzzle name"]), nameInput]),
      el("div", { class: "field", style: "flex: 0 0 260px;" }, [el("label", {}, ["How is it scored?"]), kindSelect]),
      minField,
      maxField,
      failField,
      el("button", { class: "small primary", onclick: submit }, ["Add Puzzle"]),
    ]),
    preview,
  ]);
}
