// ============================================================================
// Daily Checklist page (index.html) — Metro's home page and the checklist
// that's highlighted above all others.
// ============================================================================

import { store } from "../data/store.js";
import { mountNav } from "../ui/nav.js";
import { el, clear, qs } from "../ui/dom.js";
import { renderChecklistCard } from "../ui/taskList.js";
import { computeStreak, recentHistory } from "../data/streak.js";
import { formatFriendlyDate, todayISO } from "../util/date.js";
import { pointsForDifficulty } from "../data/points.js";
import { showToast } from "../ui/toast.js";
import { activeTasksForChecklist, weekdayLabel } from "../data/schedule.js";

function render(): void {
  const root = qs<HTMLElement>("#page-root");
  clear(root);
  const state = store.getState();
  const primary = store.getPrimaryChecklist();
  const streak = computeStreak(primary);
  const todayPoints = activeTasksForChecklist(primary)
    .filter((t) => t.completed)
    .reduce((sum, t) => sum + pointsForDifficulty(state.settings.pointsConfig, t.difficulty), 0);

  qs("#today-date").textContent = formatFriendlyDate(todayISO());
  const todayLabel = `${weekdayLabel(new Date().getDay())} ${primary.name}`;
  qs("#page-title").textContent = todayLabel;
  document.title = `Metro — ${todayLabel}`;

  const yLog = store.getYesterdayLog(primary.id);
  if (yLog && !yLog.fullyCompleted && !yLog.streakProtected && Object.keys(primary.history).length > 0) {
    const freezeCount = store.streakFreezeCount();
    root.appendChild(
      el("div", { class: "warn-banner" }, [
        el("strong", {}, ["Yesterday: "]),
        yLog.missedTaskTexts.length > 0
          ? `you missed ${yLog.missedTaskTexts.length} task${yLog.missedTaskTexts.length === 1 ? "" : "s"} — ${yLog.missedTaskTexts.join(", ")}.`
          : "no tasks were on the list.",
        freezeCount > 0
          ? el("div", { style: "margin-top:8px;" }, [
              el(
                "button",
                {
                  class: "small primary",
                  onclick: () => {
                    const ok = store.useStreakFreeze(primary.id);
                    showToast(ok ? "Streak Freeze used" : "Couldn't use Streak Freeze", ok ? "Yesterday is now protected." : "", ok ? "success" : "info");
                    render();
                  },
                },
                [`❄️ Use a Streak Freeze (${freezeCount} available)`]
              ),
            ])
          : null,
      ])
    );
  }

  root.appendChild(
    el("div", { class: "stat-row", style: "margin-bottom: 20px;" }, [
      el("div", { class: "stat-tile" }, [el("div", { class: "value" }, [String(streak)]), el("div", { class: "label" }, ["Day Streak"])]),
      el("div", { class: "stat-tile" }, [el("div", { class: "value" }, [String(todayPoints)]), el("div", { class: "label" }, ["Points earned today"])]),
      el("div", { class: "stat-tile" }, [el("div", { class: "value" }, [String(state.battlepass.currentTier)]), el("div", { class: "label" }, ["Battlepass Tier"])]),
    ])
  );

  root.appendChild(renderChecklistCard(primary, { allowWildcard: true, hideHeading: true }));

  const history = recentHistory(primary, 7);
  if (history.length > 0) {
    root.appendChild(
      el("div", { class: "card" }, [
        el("h3", {}, ["Last 7 Days"]),
        el(
          "div",
          { class: "history-list" },
          history.map((h) =>
            el("div", { class: `history-row${h.fullyCompleted ? " full" : ""}` }, [
              el("span", {}, [h.date]),
              el(
                "span",
                {},
                [
                  `${h.completedTaskIds.length}/${h.totalTasks} · ${h.pointsEarned} pts` +
                    (h.streakProtected ? " · ❄️ protected" : h.fullyCompleted ? " · ✓" : ""),
                ]
              ),
            ])
          )
        ),
      ])
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mountNav("daily");
  render();
  store.subscribe(render);
});
