# Organised Hotel — Project Notes

A personal work organiser for the owner (works on a hotel bar team), used as a home-screen web app on an iPhone.
Separate from the PT app — do not link or merge them.

## How it works
- Plain HTML, CSS and vanilla JavaScript at the repo root. No build step, no backend.
- Hosted by GitHub Pages from `main` / root: https://maxijpeak111.github.io/Organised-Hotel/
- Data lives in localStorage key `work.v1`. **Cloud save** (`js/sync.js`, ⚙ Settings): every real change is pushed to the owner's
  own PRIVATE GitHub data repo as `work.json` (fine-grained access key kept on the device only). `state._at`/`_rev` stamp real changes;
  newer side wins; both changed → user picks. `js/sync.js` is a copy of the PT app's (adapter at the top differs). File backup still in Settings.
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
  Flexible jobs (`W.isFlex`: weekly/2-weekly with no days, monthly with no date): owner picks the day each period → `t.placed[periodStart] = date | 'skip'`; `W.needsDay` / `W.needsDaySection` alert (Today + Tasks To do) until placed; `W.planPeriod` switches to next period when no working days are left.
  Days off: repeating tasks never land on a non-shift day — `W.effDate` moves them to the next shift (never past the task's next repeat). `W.dayItems(D)` uses effDate.
  `W.planList` folds 2+ cleaning tasks on a day into a "Cleaning ▸" dropdown. `W.migrate` converted v1 tasks + cleaning (tv: 2).
- `js/today.js` Today (day-by-day, ‹ › and swipe): info line, quick-add, To do list (timed first, flagged next) → Overdue → Team → In the hotel (+ Get ready for) → Coming up → Journal link; and the Journal tab
- `js/stock.js` stock list: tap to tick → order list, optional qty box on ticked items; "Order placed" saves `orders` as `{name, qty}` (old orders were plain names — use `nm()/qy()`), clears ticks. "📋 View order list (N)" button at the top opens the whole list in one sheet (qty, ✕ to remove, Share). "avg N" = average qty of last 6 orders with a qty. Sections: Draught Beer (Camden Hells, Camden Pale Ale, Seven Brothers IPA, Stella), Bottled Beers & Ciders, Wines (all wines incl. rosé/prosecco), Aperol Spritz in Liqueurs (`W.migrateStock`, stockV 2)
- `js/money.js` More tab (Tips & bonus, Rota, Ideas, Resolutions-soon) + Tips & bonus tracker: `state.money = {perReview (£5), goal {amount, period week|month}, days[date] = {reviews, tips}}`; goal bar, weekly averages over last 8 weeks with entries.
- `js/resolutions.js` Resolutions (fix-it guides) under More, route `#res` (`W.resOpen` = open item): search by typing, areas Rooms / Reception / Restaurant / Other; each has fixes (numbered steps, optional photo per step shrunk to ~900px JPEG, note), optional call contact (tel: link), log of "✓ That worked" (date, fix, note) → most-successful fix shown first, monthly count + Share report. Read-only steps (no ticking). Journal note → Resolution prefills title + steps. Seeded 4 titles only (resV 1): Chromecast, key card, room sockets, blocked sink.
- `js/app.js` router + nav (Today, Tasks, Stock, Journal, More; Rota/Ideas/Money live under More with a ‹ More link). Adding a JS file: add to `index.html` and `SHELL` in `sw.js`.
- Every release: bump `?v=N` on all script/css links in `index.html` and in `SHELL` in `sw.js`, and bump `V` in `sw.js`. Stops phones mixing old and new files (that caused a blank page once).

## Rules
- Friendly, light look in the hotel colours: blue (menus/uniform) as main colour, yellow (logo) for highlights, warm brown (building) for text/headings, cream + white backgrounds. Big tap targets, few taps. Relative paths only.
- Build DOM with `W.h` (text is always text, never HTML).

## Owner's preferences
- Shift time pickers start at 00:00. No stock-order banner on Today (stock badge on the tab is enough).
- Tasks are the heart of the app: one list, chronological, timed tasks above untimed. No "asked of me"; notes cover who asked.
- Today's tasks sit under a "To do list" heading (like "In the hotel") in a plain white card with a thin yellow progress bar and an "x of y" count (owner chose option A; no blue box).
- Plan first, then Overdue. Flag = one level (🚩). Done tasks stay until deleted. Functions stay separate ("In the hotel") with full details.
- No pre-selections or pre-made tasks/templates: tasks start blank (no default weekday). Presets only exist when the owner saves one (⭐ Save as preset → `state.presets`, chips under the task box, managed in Tasks → Repeating).
- Each Tasks section's + (round button and the + by the typing box) opens that section's own form: To do → one-off task + date (no repeat options); Repeating → must choose how often (nothing pre-picked); Team → hand out task. No + on Done. Date chips start unselected on new tasks.
- Weekly jobs don't need a set day: they sit in a calm "Weekly jobs to plan" pool (`W.poolFor(D)`), and each day's plan has "📋 Add a weekly job to this day" to drop one in (`W.addToDaySheet`). Statuses use the planning period (`W.planPeriod`), never an alarm. No tasks on days off.
- Coming up never repeats a task that's already in that day's plan or Overdue.
- Deleting a repeating task from a day (To do / Today / Rota) removes only that occurrence (`t.skip[occ]`); deleting it for good is only in Tasks → Repeating.
- Flexible weekly jobs can be N× a week (`t.times`; `t.placed[ps]` is a list of dates — use `W.placedIn`). "🗓 Plan my week" (`W.planWeek`) plans every flexible job at once (also on Rota). Aim: week planned at the start.
- Close day (button at bottom of Today) → wrap-up page (left to do with "→ next shift" for one-offs, journal, next shift preview) → `state.closed[date]` → Today jumps to tomorrow (‹ › / swipe still work); a "🌙 Today is closed" strip leads back to the "Day closed" card (Reopen, "See tomorrow & the days ahead"). Owner uses the app before and during shifts.
- Finishing the day's list shows "🎉 All done" + confetti (`W.celebrate`).
- Staff names saved once (`state.staff`, Settings) and tapped in team tasks and functions ("Who's on", `fd.on`). Functions must show guests, start time and who's on. Team list is for the owner's own tracking (he tells staff verbally).
- Stock is ordered on ProcureWizard; drinks all from one supplier. Par stock page planned (owner will send a photo of his sheet).
- Today's Coming up shows only the next 3 days; "Show more" expands to 2 weeks.
- Journal is for notes through the day AND the 10:30 / 15:00 daily meetings and the fortnightly Ops meeting: meeting mode saves one point per line (`note.meet`, `note.mid`), each point sent → Task / Team / Hotel / Idea / nothing.
- Stock also has Crisps (Tyrrells) and Chocolate (Cadbury Dairy Milk, KitKat Chunky) — `W.migrateStock3`, stockV 3.
- Resolutions: owner writes fixes after the fact and improves them over time (add another way rather than overwrite). Not shared with staff. No auto journal entry when a fix works.
- Owner is a manager: team tasks are handed out to staff and shared to keep everyone in line.
