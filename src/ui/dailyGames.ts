// ============================================================================
// Daily Puzzles card (Daily General Checklist page) — lets you log today's
// score for each configured game and see the Battlepass points it earns.
// Scoring math lives in src/data/dailyGames.ts; this file is purely the input
// UI for each of the three scoring patterns (see DailyGameScoring in
// types.ts).
// ============================================================================

import { store } from "../data/store.js";
import { el } from "./dom.js";
import { showToast } from "./toast.js";
import { todayISO } from "../util/date.js";
import type { DailyGameConfig, DailyGameEntry } from "../types.js";

type GameInput = { rawValue?: number; guesses?: number | null; actualUnderPar?: number; bestUnderPar?: number };

function secondsToParts(total: number): { m: number; s: number } {
  return { m: Math.floor(total / 60), s: total % 60 };
}

export function renderDailyGamesCard(): HTMLElement {
  const date = todayISO();
  const dg = store.getState().dailyGames;
  const games = store.getDailyGames();

  return el("div", { class: "card" }, [
    el("h2", {}, ["Daily Puzzles"]),
    el("p", { class: "muted small" }, [
      `Log today's score for each puzzle — points scale from ${dg.minPoints} to ${dg.maxPoints}, roughly matching a Medium-to-Extreme task.`,
    ]),
    el(
      "div",
      { class: "task-list", style: "margin-top: 12px;" },
      games.map((g) => renderGameRow(g, date))
    ),
  ]);
}

function renderGameRow(config: DailyGameConfig, date: string): HTMLElement {
  const existing = store.getDailyGameEntry(config.id, date);
  const best = store.getBestDailyGameScore(config.id);
  const controls = buildInputs(config, existing);

  const submit = () => {
    const input = controls.read();
    if (input === null) {
      showToast("Enter a score first", `Fill in ${config.name}'s result before saving.`);
      return;
    }
    const result = store.recordDailyGameResult(config.id, date, input);
    if (!result) return;
    const isNewRecord = best === null || result.pointsAwarded > best;
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
        best !== null ? el("span", { class: "weekday-tag record-tag" }, [`🏆 Personal Record: ${best} pts`]) : null,
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
