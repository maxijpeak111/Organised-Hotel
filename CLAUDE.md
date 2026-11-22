# Organised Hotel — Project Notes

A personal work organiser for the owner (works on a hotel bar team), used as a home-screen web app on an iPhone.
Separate from the PT app — do not link or merge them.

## How it works
- Plain HTML, CSS and vanilla JavaScript at the repo root. No build step, no backend.
- Hosted by GitHub Pages from `main` / root: https://maxijpeak111.github.io/Organised-Hotel/
- All data lives on the phone only (localStorage key `work.v1`). Backup/restore in Today → ⚙ Settings.
- Publishing = commit and push to `main`. Claude does this from chat; explain things in plain language.

## Files
- `js/stocklist.js` starting drinks list (must load before core.js)
- `js/core.js` state, dates, DOM helper `W.h` / `W.fill`, sheets, toasts, share
- `js/views.js` event editor (with function details `fd`), shift editor, ideas editor, quick-add menu, Rota, Ideas, Settings
- `js/tasks.js` THE TASK ENGINE (main part of the app). Task: `{repeat: none|daily|weekly|biweekly|monthly, date, days[], mday, time, flag, clean, done/doneAt (one-off), doneDates{occ: doneOn} (repeating), start}`.
  Daily = every day with a shift on the rota; undone daily tasks just drop off. Weekly/2-weekly on chosen days, monthly on a date;
  undone ones go to Overdue until done or the period ends (`W.periodEnd`). One-offs stay overdue until done.
  `W.parseQuick` reads typed dates/times/repeats/"!" for the quick-add box (tags under the box let the owner fix it).
  Team tasks (`state.team`, handed out to staff: who/date/time) are separate. Tasks tab: To do (chronological) / Repeating (this week's status + last 4 periods dots) / Team / Done (delete).
  `W.planList` folds 2+ cleaning tasks on a day into a "Cleaning ▸" dropdown. `W.migrate` converted v1 tasks + cleaning (tv: 2).
- `js/today.js` Today (day-by-day, ‹ › and swipe): info line, quick-add, Today's plan (timed first, flagged next) → Overdue → Team → In the hotel (+ Get ready for) → Coming up → Journal link; and the Journal tab
- `js/stock.js` stock list: tap to flag low → order list; "Order placed" saves to `orders` history
- `js/app.js` router + nav (Today, Tasks, Stock, Journal, Rota, Ideas). Adding a JS file: add to `index.html` and `SHELL` in `sw.js`.
- Every release: bump `?v=N` on all script/css links in `index.html` and in `SHELL` in `sw.js`, and bump `V` in `sw.js`. Stops phones mixing old and new files (that caused a blank page once).

## Rules
- Friendly, light look in the hotel colours: blue (menus/uniform) as main colour, yellow (logo) for highlights, warm brown (building) for text/headings, cream + white backgrounds. Big tap targets, few taps. Relative paths only.
- Build DOM with `W.h` (text is always text, never HTML).

## Owner's preferences
- Shift time pickers start at 00:00. No stock-order banner on Today (stock badge on the tab is enough).
- Tasks are the heart of the app: one list, chronological, timed tasks above untimed. No "asked of me"; notes cover who asked.
- Plan first, then Overdue. Flag = one level (🚩). Done tasks stay until deleted. Functions stay separate ("In the hotel") with full details.
- No pre-selections or pre-made tasks/templates: tasks start blank (no default weekday). Presets only exist when the owner saves one (⭐ Save as preset → `state.presets`, chips under the task box, managed in Tasks → Repeating).
- Owner is a manager: team tasks are handed out to staff and shared to keep everyone in line.
