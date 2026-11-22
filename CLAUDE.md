# Organised Hotel — Project Notes

A personal work organiser for the owner (works on a hotel bar team), used as a home-screen web app on an iPhone.
Separate from the PT app — do not link or merge them.

## How it works
- Plain HTML, CSS and vanilla JavaScript at the repo root. No build step, no backend.
- Hosted by GitHub Pages from `main` / root: https://maxijpeak111.github.io/Organised-Hotel/
- All data lives on the phone only (localStorage key `work.v1`). Backup/restore in Today → ⚙ Settings.
- Publishing = commit and push to `main`. Claude does this from chat; explain things in plain language.

## Files
- `js/stocklist.js` starting drinks list + optional cleaning template (must load before core.js)
- `js/core.js` state, dates, DOM helper `W.h` / `W.fill`, sheets, toasts, share
- `js/today.js` Today page (day-by-day, ‹ › and swipe): info line, Your day overview (tasks + progress), In the hotel (events with `kind`: function/event/busy/delivery/meeting/other, plus 'Get ready for' next 7 days), Cleaning (`W.cleanOn`), Coming up (next 7 days, non-daily cleaning shown once); and the Journal tab (`state.journal[date] = [{id,time,text,sorted}]`, notes turned into Task/Hotel/Idea at end of shift)
- `js/views.js` editors, Tasks (incl. "asked of me" via `from`), Rota (shifts + events), Clean (recurring, `every` days, `last` done), Ideas, Settings
- `js/stock.js` stock list: tap to flag low → order list; "Order placed" saves to `orders` history; "usually ordered" = on ≥50% of last 6 orders
- `js/app.js` router + nav. Adding a JS file: add to `index.html` and `SHELL` in `sw.js`, bump `V`.
- Every release: bump `?v=N` on all script/css links in `index.html` and in `SHELL` in `sw.js`, and bump `V` in `sw.js`. Stops phones mixing old and new files (that caused a blank page once).

## Rules
- Friendly, light look in the hotel colours: blue (menus/uniform) as main colour, yellow (logo) for highlights, warm brown (building) for text/headings, cream + white backgrounds. Big tap targets, few taps. Relative paths only.
- Build DOM with `W.h` (text is always text, never HTML).

## Owner's preferences
- Shift time pickers start at 00:00. No stock-order banner on Today (stock badge on the tab is enough).
