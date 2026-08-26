# Metro

Metro is a personal virtual-assistant web app: a highlighted daily checklist that resets every morning, unlimited custom checklists, a quick-access shortcuts page, and a "Battlepass" points system that rewards you for clearing harder tasks.

It's a static site (plain TypeScript compiled to JavaScript, no framework, no backend) that runs entirely in your browser. All of your data — checklists, shortcuts, assistant name, battlepass progress — is stored in this browser's local storage on whatever computer you open it on.

## Pages

- **Daily General Checklist** (`index.html`) — the highlighted, top-priority list. Retitles itself each day (e.g. "Thursday Daily General Checklist") and shows only the tasks scheduled for today — see "Weekday recurrence" below. Auto-resets every day; shows what you missed yesterday and your streak.
- **Daily Trials Checklist** (`trials.html`) — six independent, auto-resetting daily checklists ("DC 1"–"DC 6" by default, rename each to whatever your DCs actually are). Turn individual DCs on/off depending on which ones you're targeting that day — a DC that's off is paused and won't reset until you turn it back on. A bulk-add form lets you add one task to all six DCs at once, and an "Order" strip at the top of the page lets you drag the six DCs into whatever running order you like — the cards below follow it.
- **Checklists** (`checklists.html`) — create as many additional checklists as you want. They don't auto-reset by default (you can opt a checklist into daily reset too).
- **Shortcuts** (`shortcuts.html`) — quick links to websites and local files/folders (both open as real clickable links). Programs are listed as copyable reference paths, since browsers can't launch installed desktop applications for security reasons.
- **Battlepass** (`battlepass.html`) — season progress, tier track, your unlocked reward gallery, and reward-pool management (add new reward categories/items any time without losing existing progress).
- **Inventory** (`inventory.html`) — your trophy case: only shows themes, avatars, titles, celebration effects, and any custom reward category items you've actually earned — nothing locked is listed. Equip a theme/avatar/title/celebration effect directly from here.
- **Settings** (`settings.html`) — rename your assistant, tune points-per-difficulty and tier thresholds, manage your Daily Puzzles (add, remove, hide, reorder), and export/import a backup file. Appearance (themes/avatars/titles) moved to the Inventory page — see above.

## Weekday recurrence

Every task on the Daily Checklist (or on any custom checklist you've opted into daily reset) can be scheduled for any subset of the week — every day, weekdays only, or just one specific day. Rather than maintaining seven separate checklists, Metro keeps one shared task pool and filters it down to whatever's scheduled for today, so streaks, history, and points all stay in one continuous trail instead of being split across seven lists.

- When adding or editing a task, pick which days it recurs on. Leaving every day checked (the default) means it shows up every day.
- The checklist card only shows today's active tasks. To see or edit tasks scheduled for other days (e.g. setting up next Thursday's meeting while it's Monday), open "Manage all recurring tasks" underneath the list.
- A day with nothing scheduled counts as complete for streak purposes, so days off don't break your streak.

## Reordering tasks

Drag any task by its ⋮⋮ handle to reorder it within its checklist — drop it above or below another task depending on which half of that row you release over. This works on the currently-visible list of any checklist (today's active tasks on a daily checklist, or the full list on a "never resets" checklist). Reordering only rearranges the tasks you can see; tasks scheduled for other days on a daily checklist stay anchored in place. The "Manage all recurring tasks" section isn't reorderable — it's sorted by creation date on purpose, as a separate view for scheduling.

Completed tasks automatically sink to the bottom of the visible list, on every checklist. Unchecking a task puts it right back where it was among the still-open ones. This happens on top of your manual drag order — within the open tasks and within the completed tasks, your ordering is preserved; only the open/completed grouping is automatic.

## Archiving on non-daily checklists

A "never resets" checklist keeps completed tasks checked off indefinitely — deleting one is the only way to remove it, and deleting revokes its points. Archiving is a better fit for tidying up: it tucks a completed task out of the main list (and out of the progress count) without deleting it or touching the points it earned.

- Each completed task on a non-daily checklist gets an **Archive** button next to Edit/✕.
- **Archive All Completed** archives every currently-completed task on that checklist in one click.
- Archived tasks live in a collapsible **Archived** section underneath the list — expand it to see them, **Unarchive** to bring one back, or delete it from there if you're done with it for good.

This only applies to "never resets" checklists (including custom ones) — daily checklists (the Daily General Checklist and the six Daily Trials slots) already clear completed tasks on their own each day, so there's nothing to archive.

## Daily Puzzles

The Daily General Checklist page has a "Daily Puzzles" card where you can log today's score for each puzzle and earn Battlepass points scaled to how well you did. It ships with five — Minute Cryptic, Maptap.gg, Wordle, the Countries of the World Quiz (Sporcle), and 18 Words — but the list is yours: manage it under "Daily Puzzles" on the Settings page, where you can add your own, remove any of them (built-ins included), hide one you're taking a break from, and drag them into whatever order you want. Each puzzle also shows a "🏆 Personal Record" badge with the best result you've ever logged for it.

Adding a puzzle asks three things: its name, how it's scored (a score where higher or lower is better, a time in seconds, or a guess count), and the minimum and maximum scores possible. Those bounds anchor the point curve, and the form previews what each end is worth before you commit. Hiding a puzzle keeps every logged day and its Personal Record — only removing discards those, and even then the Battlepass points it earned stay on your season.

Every puzzle's score maps into the same 0–100 point range: a floor-level result earns nothing, a perfect one earns 100, and everything in between scales smoothly. The same range applies to any puzzle you add yourself. Points are still purely additive — a bad day earns zero, it never subtracts — but unlike the original 10–50 range, simply showing up is no longer worth points on its own.

- **Maptap.gg** — raw score 500–1000 scales linearly to 0–100 points (500 or below = 0, 1000 = 100).
- **Wordle** — 1 guess = 100 points, 6 guesses = 0, linear in between. A Fail is a separate case with its own value (0 by default), since it's a loss rather than just a worse solve.
- **Minute Cryptic** — since "the best possible score" varies puzzle to puzzle, you enter two numbers each day: your guesses-under-par, and that day's best-possible guesses-under-par. Matching the day's best earns the full 100 points; sitting at or below par earns 0.
- **Countries of the World Quiz** — enter your finishing time (or check "Didn't finish / 15:00+"). 10 minutes (600s) or faster earns the full 100 points; 15 minutes or a DNF earns 0.
- **18 Words** — raw score 0–18 scales linearly to 0–100 points (0 = 0, 18 = 100).

Each puzzle can also carry a link to where you play it, editable in Settings, which turns the Daily Puzzles card into a launcher — a linked puzzle shows a "Play ↗" button that opens it in a new tab. Only http(s) addresses are accepted, and every link is re-validated at render time rather than trusted from storage.

Recording a score again for the same day replaces the previous entry and corrects the points it earned (mirrors how deleting a task revokes its points) — handy for fixing a typo. The scoring patterns behind these games (a linear score/time range, a guess count with a fail case, and a daily-relative "beat the best possible" range) are reusable, so more games can be added later without new scoring code.

## How points & the Battlepass work

- Every task you add gets a difficulty (Easy → Extreme). Completing it awards points based on that difficulty (values are editable in Settings).
- Points are purely additive — there's no penalty for missing or unchecking a task. Deleting a task you'd already completed does revoke the points it earned (they'd otherwise be sitting there with nothing behind them), but any battlepass tier/reward you already unlocked along the way stays unlocked.
- Season points reset to 0 on the 1st of each month; lifetime points never reset.
- Reaching a new tier grants one **specific** reward — no randomization. Rewards are assigned to tiers in advance, in strictly increasing rarity as you climb (common early tiers, legendary at the top), so the Tier Track on the Battlepass page always shows exactly what every tier gives, including ones you haven't reached yet. Reward categories: themes, avatars, titles, and celebration effects — every category, including Celebration Effects, is guaranteed at least one tier in the roadmap. (Streak Freeze and Wildcard tokens were retired; an in-progress season is re-dealt against the shortened roadmap so nobody ends up short a reward — see Store.removeConsumableRewards.) A tier not yet reached picks up curated design changes like this automatically; a tier you've already earned a reward from keeps exactly what it granted.
- You can add brand-new reward categories and items from the Battlepass page at any time — this never resets or removes anything you've already unlocked, and new items become available to fill any tier that was still waiting on one (e.g. if you extend the tier track further than the pool currently covers).
- The Battlepass and Inventory pages both show a profile banner (your equipped avatar, name, title, and progress to the next tier) and icons throughout — a color swatch for each theme, an emoji for avatars/titles/effects/consumables — so it's not just plain text and numbers.
- What's equippable is always computed live from your actual grant history (`battlepass.unlocked`) — there's no separate "unlocked items" cache anywhere to fall out of sync, so what the Inventory page shows as earned is exactly what the Battlepass page says you've earned, by construction. If something you had equipped stops being valid (e.g. its item was deleted from the pool while equipped), it falls back to the default rather than leaving a broken selection.
- On every load, Metro also double-checks that every tier you've already reached actually has its roadmap reward recorded in your grant history, and silently backfills it if not — a safety net for older saves from before the deterministic roadmap existed. This can only ever fill in something missing; it never changes or duplicates a reward you've already been granted.

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
index.html, trials.html, checklists.html, shortcuts.html, battlepass.html, inventory.html, settings.html
css/styles.css        — design system, including all theme definitions
src/types.ts          — shared data model
src/data/             — store (state + persistence), points, rewards, defaults
src/ui/                — shared DOM/nav/toast/checklist-card/reward-visual helpers
src/pages/             — one entry-point script per HTML page
dist/                  — compiled JS output (generated by `npm run build`, not committed)
```

## Extending Metro

The app was built with room to grow:

- **New reward categories** — add them from the Battlepass page, no code changes needed.
- **New pages** — add an HTML file (copy an existing one's shell), a matching `src/pages/yourpage.ts`, and a `NAV_ITEMS` entry in `src/ui/nav.ts`.
- **New settings** — extend `Settings` in `src/types.ts`, give it a default in `src/data/defaults.ts`, then read/write it from `src/data/store.ts`.
- **Schema changes** — bump `SCHEMA_VERSION` in `src/data/store.ts` and add a migration step in `migrate()` so existing users' saved data upgrades cleanly.
