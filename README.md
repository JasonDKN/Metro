# Metro

Metro is a personal virtual-assistant web app: a highlighted daily checklist that resets every morning, unlimited custom checklists, a quick-access shortcuts page, and a "Battlepass" points system that rewards you for clearing harder tasks.

It's a static site (plain TypeScript compiled to JavaScript, no framework, no backend) that runs entirely in your browser. All of your data — checklists, shortcuts, assistant name, battlepass progress — is stored in this browser's local storage on whatever computer you open it on.

## Pages

- **Daily General Checklist** (`index.html`) — the highlighted, top-priority list. Retitles itself each day (e.g. "Thursday Daily General Checklist") and shows only the tasks scheduled for today — see "Weekday recurrence" below. Auto-resets every day; shows what you missed yesterday, your streak, and lets you spend a Streak Freeze or Wildcard token.
- **Daily Trials Checklist** (`trials.html`) — six independent, auto-resetting daily checklists ("DC 1"–"DC 6" by default, rename each to whatever your DCs actually are). Turn individual DCs on/off depending on which ones you're targeting that day — a DC that's off is paused and won't reset until you turn it back on. A bulk-add form lets you add one task to all six DCs at once.
- **Checklists** (`checklists.html`) — create as many additional checklists as you want. They don't auto-reset by default (you can opt a checklist into daily reset too).
- **Shortcuts** (`shortcuts.html`) — quick links to websites and local files/folders (both open as real clickable links). Programs are listed as copyable reference paths, since browsers can't launch installed desktop applications for security reasons.
- **Battlepass** (`battlepass.html`) — season progress, tier track, your unlocked reward gallery, and reward-pool management (add new reward categories/items any time without losing existing progress).
- **Settings** (`settings.html`) — rename your assistant, apply unlocked themes/avatars/titles, tune points-per-difficulty and tier thresholds, and export/import a backup file.

## Weekday recurrence

Every task on the Daily Checklist (or on any custom checklist you've opted into daily reset) can be scheduled for any subset of the week — every day, weekdays only, or just one specific day. Rather than maintaining seven separate checklists, Metro keeps one shared task pool and filters it down to whatever's scheduled for today, so streaks, history, and points all stay in one continuous trail instead of being split across seven lists.

- When adding or editing a task, pick which days it recurs on. Leaving every day checked (the default) means it shows up every day.
- The checklist card only shows today's active tasks. To see or edit tasks scheduled for other days (e.g. setting up next Thursday's meeting while it's Monday), open "Manage all recurring tasks" underneath the list.
- A day with nothing scheduled counts as complete for streak purposes, so days off don't break your streak.

## Reordering tasks

Drag any task by its ⋮⋮ handle to reorder it within its checklist — drop it above or below another task depending on which half of that row you release over. This works on the currently-visible list of any checklist (today's active tasks on a daily checklist, or the full list on a "never resets" checklist). Reordering only rearranges the tasks you can see; tasks scheduled for other days on a daily checklist stay anchored in place. The "Manage all recurring tasks" section isn't reorderable — it's sorted by creation date on purpose, as a separate view for scheduling.

## How points & the Battlepass work

- Every task you add gets a difficulty (Easy → Extreme). Completing it awards points based on that difficulty (values are editable in Settings).
- Points are purely additive — there's no penalty for missing or unchecking a task. Deleting a task you'd already completed does revoke the points it earned (they'd otherwise be sitting there with nothing behind them), but any battlepass tier/reward you already unlocked along the way stays unlocked.
- Season points reset to 0 on the 1st of each month; lifetime points never reset.
- Reaching a new tier randomly rolls a reward from the reward pool (rarer rewards get more likely at higher tiers): themes, avatars, titles, celebration effects, badges, and consumable Streak Freeze / Wildcard tokens.
- You can add brand-new reward categories and items from the Battlepass page at any time — this never resets or removes anything you've already unlocked.

## Local development

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm run build   # compiles src/**/*.ts -> dist/**/*.js
npm run serve   # serves the site locally at http://localhost:8080
```

Or just open `index.html` directly in a browser after building — no server required, though some browsers restrict `file://` module loading, so `npm run serve` (or any static file server) is the more reliable option for local use.

## Deploying to GitHub Pages

This repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds the TypeScript and deploys the site to GitHub Pages automatically on every push to `main`. Once Pages is enabled for this repository (Settings → Pages → Source: GitHub Actions), your live site will be available at the URL shown there.

## Project structure

```
index.html, trials.html, checklists.html, shortcuts.html, battlepass.html, settings.html
css/styles.css        — design system, including all theme definitions
src/types.ts          — shared data model
src/data/             — store (state + persistence), points, rewards, defaults
src/ui/                — shared DOM/nav/toast/checklist-card helpers
src/pages/             — one entry-point script per HTML page
dist/                  — compiled JS output (generated by `npm run build`, not committed)
```

## Extending Metro

The app was built with room to grow:

- **New reward categories** — add them from the Battlepass page, no code changes needed.
- **New pages** — add an HTML file (copy an existing one's shell), a matching `src/pages/yourpage.ts`, and a `NAV_ITEMS` entry in `src/ui/nav.ts`.
- **New settings** — extend `Settings` in `src/types.ts`, give it a default in `src/data/defaults.ts`, then read/write it from `src/data/store.ts`.
- **Schema changes** — bump `SCHEMA_VERSION` in `src/data/store.ts` and add a migration step in `migrate()` so existing users' saved data upgrades cleanly.
