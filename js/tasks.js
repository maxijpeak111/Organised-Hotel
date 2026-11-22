(function () {
'use strict';
const W = window.W, h = W.h, S = () => W.state;
const dow = D => W.parse(D).getDay();
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const card = (...kids) => h('div', { class: 'card' }, kids);
const head = (title, n) => h('h2', {}, h('span', {}, title), n != null ? h('span', { class: 'count' }, n) : null);
W.card = card; W.head = head;

/* ============ MODEL ============
 task: {id, title, notes, repeat: none|daily|weekly|biweekly|monthly, date (one-off), days [0-6], mday,
        time, flag, clean, done, doneAt (one-off), doneDates {occurrence: doneOn} (repeating), start}
 team: {id, title, who, date, time, notes, done, doneAt}                                              */
W.REPEATS = [['none', 'One-off'], ['daily', 'Every shift'], ['weekly', 'Weekly'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Monthly']];
const daysLabel = ds => WEEK_ORDER.filter(d => (ds || []).includes(d)).map(d => DAY_SHORT[d]).join(', ');
const ord = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
W.repeatLabel = t => t.repeat === 'daily' ? 'Every shift' : t.repeat === 'weekly' ? 'Weekly · ' + (daysLabel(t.days) || 'pick a day') :
  t.repeat === 'biweekly' ? 'Every 2 weeks · ' + (daysLabel(t.days) || 'pick a day') : t.repeat === 'monthly' ? 'Monthly · ' + ord(t.mday || 1) : 'One-off';

W.isShift = D => { const sh = S().shifts[D]; return !!(sh && !sh.off); };
const lastDayOfMonth = D => { const d = W.parse(D); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
W.occursOn = function (t, D) {
  if (t.repeat === 'none' || !t.repeat) return t.date === D;
  if (D < (t.start || '0')) return false;
  if (t.repeat === 'daily') return W.isShift(D);
  if (t.repeat === 'weekly') return (t.days || []).includes(dow(D));
  if (t.repeat === 'biweekly') return (t.days || []).includes(dow(D)) && (W.daysBetween(W.weekStart(t.start || D), W.weekStart(D)) / 7) % 2 === 0;
  if (t.repeat === 'monthly') return W.parse(D).getDate() === Math.min(t.mday || 1, lastDayOfMonth(D));
  return false;
};
// last day an occurrence can still be done before it counts as missed
W.periodEnd = function (t, occ) {
  if (t.repeat === 'weekly') return W.addDays(W.weekStart(occ), 6);
  if (t.repeat === 'biweekly') { const ws = W.weekStart(occ); const odd = (W.daysBetween(W.weekStart(t.start || occ), ws) / 7) % 2; return W.addDays(ws, odd ? 6 : 13); }
  if (t.repeat === 'monthly') { const d = W.parse(occ); return W.dstr(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
  return occ;
};
W.isDone = (t, occ) => t.repeat === 'none' || !t.repeat ? !!t.done : !!(t.doneDates || {})[occ];
W.setDone = function (t, occ, val) {
  if (t.repeat === 'none' || !t.repeat) { t.done = val; t.doneAt = val ? W.today() : ''; }
  else { t.doneDates = t.doneDates || {}; if (val) t.doneDates[occ] = W.today(); else delete t.doneDates[occ]; }
  W.save();
};

const sortItems = arr => arr.sort((a, b) => {
  const at = a.task.time || '', bt = b.task.time || '';
  if (!!at !== !!bt) return at ? -1 : 1;           // timed first
  if (at !== bt) return at < bt ? -1 : 1;
  if (!!a.task.flag !== !!b.task.flag) return a.task.flag ? -1 : 1;
  return 0;
});
// Everything planned on day D: [{task, occ}]
W.dayItems = D => sortItems(S().tasks.filter(t => W.occursOn(t, D)).map(t => ({ task: t, occ: D })));
// Overdue: one-offs past their date, and weekly/2-weekly/monthly missed earlier this period. Daily ones just disappear.
W.overdueItems = function () {
  const t0 = W.today(), out = [];
  S().tasks.forEach(t => {
    if (t.repeat === 'none' || !t.repeat) { if (!t.done && t.date && t.date < t0) out.push({ task: t, occ: t.date }); return; }
    if (t.repeat === 'daily') return;
    for (let i = 31; i >= 1; i--) {
      const d = W.addDays(t0, -i);
      if (W.occursOn(t, d) && !W.isDone(t, d) && W.periodEnd(t, d) >= t0) out.push({ task: t, occ: d });
    }
  });
  return out.sort((a, b) => (!!b.task.flag - !!a.task.flag) || (a.occ < b.occ ? -1 : 1));
};
W.openTeam = () => S().team.filter(x => !x.done);

/* ============ MIGRATION from the first version (tasks + separate cleaning) ============ */
W.migrate = function () {
  const s = S();
  if (s.tv >= 2) return;
  s.team = s.team || [];
  s.tasks = (s.tasks || []).map(o => o.repeat ? o : ({
    id: o.id || W.uid(), title: o.title, repeat: 'none', date: o.due || '', time: '', flag: false, clean: false,
    notes: [o.from ? 'Asked by ' + o.from : '', o.notes || ''].filter(Boolean).join('\n'), done: !!o.done, doneAt: o.doneAt || '', start: o.created || W.today()
  }));
  (s.cleaning || []).forEach(c => {
    const every = Number(c.every) || 1, due = W.cleanDue ? W.cleanDue(c) : W.today();
    const rep = every === 1 ? 'daily' : every <= 10 ? 'weekly' : every <= 20 ? 'biweekly' : 'monthly';
    s.tasks.push({ id: W.uid(), title: c.title, notes: c.area ? 'Area: ' + c.area : '', repeat: rep, days: [dow(due < W.today() ? W.today() : due)],
      mday: W.parse(due).getDate(), date: '', time: '', flag: false, clean: true, doneDates: {}, start: W.today() });
  });
  s.cleaning = [];
  s.tv = 2;
  W.save();
};
W.migrate();

/* ============ QUICK-ADD: understands typed dates, times and repeats ============ */
const DAYRE = '(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const dayNum = w => ({ mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 })[w.slice(0, 3).toLowerCase()];
const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
W.parseQuick = function (text) {
  let s = ' ' + text + ' ';
  const take = re => { const m = s.match(re); if (m) s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length); return m; };
  const r = { title: '', date: '', time: '', repeat: 'none', days: [], mday: 0, flag: false, clean: false };
  const t0 = W.today();

  if (take(/\s(!+|urgent|important|asap)(?=\s)/i)) r.flag = true;

  let m;
  if ((m = take(/\s(?:at\s+)?(\d{1,2})[:.](\d{2})\s*(am|pm)?(?=\s)/i))) r.time = hhmm(+m[1], +m[2], m[3]);
  else if ((m = take(/\s(?:at\s+)?(\d{1,2})\s*(am|pm)(?=\s)/i))) r.time = hhmm(+m[1], 0, m[2]);
  else if ((m = take(/\sat\s+(\d{1,2})(?=\s)/i))) r.time = hhmm(+m[1], 0, +m[1] < 8 ? 'pm' : '');
  else if ((m = take(/\s(?:at\s+)?(noon|midday)(?=\s)/i))) r.time = '12:00';

  const grabDays = () => { const out = []; let g; while ((g = take(new RegExp('\\s(?:on\\s+|and\\s+|&\\s*|,\\s*)?' + DAYRE + 's?(?=[\\s,&])', 'i')))) out.push(dayNum(g[1])); return [...new Set(out)]; };

  if (take(/\s(every\s+shift|each\s+shift|daily|every\s*day|each\s+day)(?=\s)/i)) r.repeat = 'daily';
  else if (take(/\s(every\s+other(\s+week)?|fortnightly|bi-?weekly|every\s+(?:2|two)\s+weeks)(?=\s)/i)) { r.repeat = 'biweekly'; r.days = grabDays(); }
  else if (take(/\s(monthly|every\s+month)(?=\s)/i)) { r.repeat = 'monthly'; const d = take(/\s(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?=\s)/i); r.mday = d ? Math.min(31, +d[1]) : W.parse(t0).getDate(); }
  else if (take(/\s(weekly|every\s+week|each\s+week)(?=\s)/i)) { r.repeat = 'weekly'; r.days = grabDays(); }
  else if ((m = s.match(new RegExp('\\s(?:every|each)\\s+' + DAYRE, 'i')))) { s = s.replace(/\s(every|each)\s+/i, ' '); r.repeat = 'weekly'; r.days = grabDays(); }

  if (r.repeat === 'none') {
    if (take(/\s(today|tonight)(?=\s)/i)) r.date = t0;
    else if (take(/\s(tomorrow|tmrw|tmr|tomoz)(?=\s)/i)) r.date = W.addDays(t0, 1);
    else if ((m = take(/\sin\s+(\d+|a|an|one|two|three|four|five|six|seven)\s+(days?|weeks?)(?=\s)/i))) { const n = NUMW[m[1].toLowerCase()] || +m[1]; r.date = W.addDays(t0, /week/i.test(m[2]) ? n * 7 : n); }
    else if (take(/\snext\s+week(?=\s)/i)) r.date = W.addDays(W.weekStart(t0), 7);
    else if ((m = take(new RegExp('\\s(?:on\\s+)?(next|this)?\\s*' + DAYRE + '(?=\\s)', 'i')))) {
      const target = dayNum(m[2]);
      if (m[1] && m[1].toLowerCase() === 'next') r.date = W.addDays(W.weekStart(t0), 7 + (target + 6) % 7);
      else { let diff = (target - dow(t0) + 7) % 7; if (diff === 0 && !m[1]) diff = 7; r.date = W.addDays(t0, diff); }
    }
    else if ((m = take(/\s(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?=\s)/i))) r.date = ymd(+m[1], MONTHS.indexOf(m[2].toLowerCase()));
    else if ((m = take(/\s(?:on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?=\s)/i))) r.date = ymd(+m[2], MONTHS.indexOf(m[1].toLowerCase()));
    else if ((m = take(/\s(?:on\s+)?(\d{1,2})\/(\d{1,2})(?=\s)/))) r.date = ymd(+m[1], +m[2] - 1);
    else if ((m = take(/\s(?:on\s+)?(?:the\s+)?(\d{1,2})(st|nd|rd|th)(?=\s)/i))) { const now = W.parse(t0); let d = new Date(now.getFullYear(), now.getMonth(), +m[1]); if (W.dstr(d) < t0) d = new Date(now.getFullYear(), now.getMonth() + 1, +m[1]); r.date = W.dstr(d); }
  }
  r.clean = /\b(clean|cleaning|mop|wipe|sweep|polish|scrub|hoover|descale|bleach|deep clean)\b/i.test(text);
  r.title = s.replace(/\s+/g, ' ').replace(/\s(on|by|at|for|every|each|the|and)\s*$/i, '').replace(/^\s*[-–,]\s*/, '').trim();
  r.title = r.title.charAt(0).toUpperCase() + r.title.slice(1);
  return r;

  function hhmm(hr, mn, ap) { ap = (ap || '').toLowerCase(); if (ap === 'pm' && hr < 12) hr += 12; if (ap === 'am' && hr === 12) hr = 0; return String(Math.min(hr, 23)).padStart(2, '0') + ':' + String(Math.min(mn, 59)).padStart(2, '0'); }
  function ymd(d, mo) { const now = W.parse(t0); let x = new Date(now.getFullYear(), mo, d); if (W.dstr(x) < t0) x = new Date(now.getFullYear() + 1, mo, d); return W.dstr(x); }
};
const newTask = p => Object.assign({ id: W.uid(), title: '', notes: '', repeat: 'none', date: '', days: [], mday: 1, time: '', flag: false, clean: false, done: false, doneAt: '', doneDates: {}, start: W.today() }, p || {});
W.usePreset = p => W.editTask(null, { title: p.title, notes: p.notes, repeat: p.repeat, days: (p.days || []).slice(), mday: p.mday, time: p.time, flag: p.flag, clean: p.clean });
const describe = p => [
  p.repeat === 'none' ? '📅 ' + (p.date ? W.relDay(p.date) + (W.daysBetween(W.today(), p.date) > 6 ? '' : ' · ' + W.shortDate(p.date)) : 'No date') : '🔁 ' + W.repeatLabel(p),
  p.time ? '⏰ ' + p.time : null, p.flag ? '🚩 Important' : null, p.clean ? '🧽 Cleaning' : null
].filter(Boolean);

W.quickBox = function (defaultDate, mode) {
  const input = h('input', { class: 'qa-input', placeholder: 'Add a task… e.g. "Order ice machine next Fri 3pm !"', enterkeyhint: 'done' });
  const tags = h('div', { class: 'qa-tags' });
  let parsed = null;
  const update = () => {
    const v = input.value.trim();
    if (!v) { parsed = null; W.fill(tags); tags.style.display = 'none'; return; }
    parsed = W.parseQuick(v);
    if (parsed.repeat === 'none' && !parsed.date && defaultDate) parsed.date = defaultDate;
    tags.style.display = '';
    W.fill(tags, describe(parsed).map(x => h('span', { class: 'qa-tag', onclick: more }, x)), h('span', { class: 'qa-tag edit', onclick: more }, '✎ Change'));
  };
  const add = () => {
    if (!parsed) return W.openSectionForm(mode, defaultDate);
    if (!parsed.title) return W.toast('Add what the task is');
    if (mode === 'repeat' && parsed.repeat === 'none') { W.toast('Choose how often'); return more(); }
    if ((parsed.repeat === 'weekly' || parsed.repeat === 'biweekly') && !parsed.days.length) { W.toast('Pick which day'); return more(); }
    S().tasks.push(newTask(parsed)); W.save(); input.value = ''; W.toast('Added'); W.render();
  };
  function more() { const p = parsed || { title: input.value.trim(), date: defaultDate || '' }; W.editTask(null, p, null, mode === 'repeat' && p.repeat === 'none' ? 'repeat' : undefined); input.value = ''; }
  input.addEventListener('input', update);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  tags.style.display = 'none';
  const pres = S().presets;
  return h('div', { class: 'qa' }, h('div', { class: 'row' }, input, h('button', { class: 'btn qa-btn', onclick: add, 'aria-label': 'Add task' }, '+')), tags,
    pres.length ? h('div', { class: 'qa-presets' }, h('span', { class: 'muted small' }, '⭐'), pres.map(p => h('span', { class: 'qa-tag', onclick: () => W.usePreset(p) }, p.title))) : null);
};

/* ============ FULL TASK EDITOR ============ */
// mode: 'oneoff' (To do: task + date, no repeat options), 'repeat' (Repeating: must choose how often, nothing pre-picked), or full
W.editTask = function (t, preset, onSave, mode) {
  const isNew = !t;
  const d = isNew ? newTask(preset) : JSON.parse(JSON.stringify(t));
  if (mode === 'repeat' && d.repeat === 'none') d.repeat = '';
  d.days = d.days || [];
  const title = h('input', { value: d.title, placeholder: 'What needs doing?' });
  const date = h('input', { type: 'date', value: d.date });
  const time = h('input', { type: 'time', value: d.time });
  const mday = h('input', { type: 'number', inputmode: 'numeric', min: 1, max: 31, value: d.mday || W.parse(W.today()).getDate() });
  const notes = h('textarea', { value: d.notes, placeholder: 'Notes (optional)' });
  const when = h('div');
  const drawWhen = () => W.fill(when,
    d.repeat === 'none' ? W.field('Date', h('div', {}, date, W.chips([[W.today(), 'Today'], [W.addDays(W.today(), 1), 'Tomorrow'], ['', 'No date']], isNew && !d.date ? null : d.date, v => { date.value = v; }))) : null,
    d.repeat === 'daily' ? h('p', { class: 'muted small' }, 'Shows on every day you have a shift on the rota. If it isn\'t done, it just drops off. A fresh one comes next shift.') : null,
    d.repeat === 'weekly' || d.repeat === 'biweekly' ? W.field('On which day(s)', h('div', {},
      WEEK_ORDER.map(n => h('span', { class: 'chip' + (d.days.includes(n) ? ' on' : ''), onclick: e => { d.days = d.days.includes(n) ? d.days.filter(x => x !== n) : d.days.concat(n); e.target.classList.toggle('on'); } }, DAY_SHORT[n])),
      h('p', { class: 'muted small' }, 'If it\'s not done on the day, it moves to Overdue until it\'s done or the ' + (d.repeat === 'weekly' ? 'week' : 'fortnight') + ' ends.'))) : null,
    d.repeat === 'monthly' ? W.field('Day of the month', mday) : null);
  const flagBtn = h('span', { class: 'chip' + (d.flag ? ' on' : ''), onclick: e => { d.flag = !d.flag; e.target.classList.toggle('on'); } }, '🚩 Important');
  const cleanBtn = h('span', { class: 'chip' + (d.clean ? ' on' : ''), onclick: e => { d.clean = !d.clean; e.target.classList.toggle('on'); } }, '🧽 Cleaning');
  let asPreset = false;
  const presetBtn = h('span', { class: 'chip', onclick: e => { asPreset = !asPreset; e.target.classList.toggle('on'); } }, '⭐ Save as preset');
  drawWhen();
  W.sheet(isNew ? (mode === 'repeat' ? 'New repeating task' : mode === 'oneoff' ? 'New task' : 'New task') : 'Edit task', [
    W.field('Task', title),
    mode === 'oneoff' ? null : W.field('How often', W.chips(mode === 'repeat' ? W.REPEATS.filter(r => r[0] !== 'none') : W.REPEATS, d.repeat, v => { d.repeat = v; drawWhen(); })),
    when,
    W.field('Time (optional)', h('div', { class: 'row' }, time, h('button', { class: 'btn ghost small', onclick: () => { time.value = ''; } }, 'No time'))),
    W.field('Extras', h('div', {}, flagBtn, cleanBtn, presetBtn)),
    W.field('Notes', notes),
    h('button', { class: 'btn block', onclick: () => {
      if (!title.value.trim()) return W.toast('Add a task name');
      if (!d.repeat) return W.toast('Choose how often');
      if ((d.repeat === 'weekly' || d.repeat === 'biweekly') && !d.days.length) return W.toast('Pick at least one day');
      Object.assign(d, { title: title.value.trim(), date: d.repeat === 'none' ? date.value : '', time: time.value, notes: notes.value.trim(), mday: Math.min(31, Math.max(1, Number(mday.value) || 1)) });
      if (isNew) S().tasks.push(d); else Object.assign(t, d);
      if (asPreset) { S().presets.push({ id: W.uid(), title: d.title, notes: d.notes, repeat: d.repeat, days: d.days.slice(), mday: d.mday, time: d.time, flag: d.flag, clean: d.clean }); W.toast('Saved as a preset'); }
      if (onSave) onSave(d);
      W.save(); W.close(); W.render();
    } }, 'Save'),
    !isNew && h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete this task' + (t.repeat !== 'none' ? ' and all its repeats' : '') + '?', () => { S().tasks = S().tasks.filter(x => x.id !== t.id); W.save(); W.render(); }) }, 'Delete')
  ]);
  if (isNew && !d.title) setTimeout(() => title.focus(), 50);
};

/* ============ ROWS ============ */
// opts: {overdue, showDate}
W.taskRow = function (it, opts) {
  opts = opts || {};
  const t = it.task, done = W.isDone(t, it.occ);
  return h('div', { class: 'item' + (done ? ' done' : '') + (t.flag && !done ? ' flagged' : '') },
    h('input', { type: 'checkbox', checked: done, onchange: e => { W.setDone(t, it.occ, e.target.checked); W.toast(e.target.checked ? 'Done ✓' : 'Re-opened'); setTimeout(W.render, 250); } }),
    h('div', { class: 'grow', onclick: () => W.editTask(t) },
      h('div', { class: 't' }, t.flag ? h('span', { class: 'flag' }, '🚩 ') : null, t.title),
      h('div', { class: 'sub' },
        t.time ? h('span', { class: 'pill time' }, t.time) : null,
        opts.overdue ? h('span', { class: 'pill red' }, (t.repeat === 'none' ? 'Was due ' : 'Missed ') + W.relDay(it.occ).toLowerCase()) : null,
        opts.showDate && !opts.overdue && t.repeat === 'none' && t.date ? h('span', { class: 'pill' }, W.niceDate(t.date)) : null,
        t.repeat !== 'none' ? h('span', { class: 'pill' }, '🔁 ' + W.repeatLabel(t)) : null,
        t.clean ? h('span', { class: 'pill' }, '🧽') : null,
        t.notes ? h('span', {}, t.notes.length > 45 ? t.notes.slice(0, 45) + '…' : t.notes) : null)));
};
// Several cleaning jobs on one day fold into one "Cleaning ▸" row
W.planList = function (items, opts) {
  const cleans = items.filter(i => i.task.clean), rest = items.filter(i => !i.task.clean || cleans.length < 2);
  const out = [];
  const undone = rest.filter(i => !W.isDone(i.task, i.occ)), doneI = rest.filter(i => W.isDone(i.task, i.occ));
  undone.forEach(i => out.push(W.taskRow(i, opts)));
  if (cleans.length >= 2) {
    const nDone = cleans.filter(i => W.isDone(i.task, i.occ)).length;
    out.push(h('details', { class: 'clean-group', open: W._cleanOpen || null, ontoggle: e => { W._cleanOpen = e.target.open; } },
      h('summary', {}, h('span', { class: 'cg-icon' }, '🧽'), h('div', { class: 'grow' }, h('div', { class: 't' }, 'Cleaning'), h('div', { class: 'sub' }, nDone + ' of ' + cleans.length + ' done')),
        nDone === cleans.length ? h('span', { class: 'pill ok' }, '✓ All done') : null),
      h('div', { class: 'cg-list' }, cleans.sort((a, b) => W.isDone(a.task, a.occ) - W.isDone(b.task, b.occ)).map(i => W.taskRow(i, opts)))));
  }
  doneI.forEach(i => out.push(W.taskRow(i, opts)));
  return out;
};

/* ============ TEAM TASKS (handed out to staff) ============ */
W.editTeam = function (x) {
  const isNew = !x;
  const d = x ? { ...x } : { id: W.uid(), title: '', who: '', date: '', time: '', notes: '', done: false, doneAt: '' };
  const title = h('input', { value: d.title, placeholder: 'e.g. Restock fridges before 5pm' });
  const names = [...new Set(S().team.map(t => t.who).filter(Boolean))];
  const who = h('input', { value: d.who, placeholder: 'Who is it for? (optional)', list: 'who-list' });
  const date = h('input', { type: 'date', value: d.date });
  const time = h('input', { type: 'time', value: d.time });
  const notes = h('textarea', { value: d.notes, placeholder: 'Details (optional)' });
  W.sheet(isNew ? 'Hand out a task' : 'Team task', [
    W.field('Task', title),
    W.field('For', h('div', {}, who, h('datalist', { id: 'who-list' }, names.map(n => h('option', { value: n }))),
      names.length ? h('div', { style: 'margin-top:6px' }, names.slice(0, 8).map(n => h('span', { class: 'chip', onclick: () => { who.value = n; } }, n))) : null)),
    h('div', { class: 'grid2' }, W.field('When (optional)', date), W.field('Time (optional)', time)),
    W.chips([[W.today(), 'Today'], [W.addDays(W.today(), 1), 'Tomorrow'], ['', 'No date']], isNew && !d.date ? null : d.date, v => { date.value = v; }),
    W.field('Notes', notes),
    h('button', { class: 'btn block', onclick: () => {
      if (!title.value.trim()) return W.toast('Add the task');
      Object.assign(d, { title: title.value.trim(), who: who.value.trim(), date: date.value, time: time.value, notes: notes.value.trim() });
      if (isNew) S().team.push(d); else Object.assign(x, d);
      W.save(); W.close(); W.render();
    } }, 'Save'),
    !isNew && h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete this team task?', () => { S().team = S().team.filter(y => y.id !== x.id); W.save(); W.render(); }) }, 'Delete')
  ]);
  if (isNew) setTimeout(() => title.focus(), 50);
};
W.teamRow = function (x) {
  const late = !x.done && x.date && x.date < W.today();
  return h('div', { class: 'item' + (x.done ? ' done' : '') },
    h('input', { type: 'checkbox', checked: x.done, onchange: e => { x.done = e.target.checked; x.doneAt = x.done ? W.today() : ''; W.save(); W.toast(x.done ? 'Marked done' : 'Re-opened'); setTimeout(W.render, 250); } }),
    h('div', { class: 'grow', onclick: () => W.editTeam(x) },
      h('div', { class: 't' }, x.title),
      h('div', { class: 'sub' }, x.who ? h('span', { class: 'pill who' }, '👤 ' + x.who) : null,
        x.date ? h('span', { class: 'pill' + (late ? ' red' : '') }, (late ? 'Overdue · ' : '') + W.relDay(x.date) + (x.time ? ' ' + x.time : '')) : x.time ? h('span', { class: 'pill time' }, x.time) : null,
        x.notes ? h('span', {}, x.notes.length > 40 ? x.notes.slice(0, 40) + '…' : x.notes) : null)));
};
const sortTeam = arr => arr.slice().sort((a, b) => ((a.date || '9') + (a.time || '')) < ((b.date || '9') + (b.time || '')) ? -1 : 1);
W.shareTeam = function () {
  const open = sortTeam(W.openTeam());
  if (!open.length) return W.toast('No open team tasks');
  const groups = {};
  open.forEach(x => { (groups[x.who || 'Anyone'] = groups[x.who || 'Anyone'] || []).push(x); });
  const txt = 'Team tasks – ' + W.niceDate(W.today()) + '\n\n' + Object.keys(groups).map(k => k.toUpperCase() + '\n' + groups[k].map(x => '☐ ' + x.title + (x.date ? ' (' + W.relDay(x.date) + (x.time ? ' ' + x.time : '') + ')' : '')).join('\n')).join('\n\n');
  W.share('Team tasks', txt);
};

/* ============ TASKS TAB ============ */
let tab = 'todo';
W.views.tasks = function (app) {
  const s = S(), t0 = W.today();
  const overdue = W.overdueItems();
  let body;
  if (tab === 'todo') {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = W.addDays(t0, i);
      const items = W.dayItems(d).filter(x => x.task.repeat !== 'daily' && (!W.isDone(x.task, x.occ) || d === t0));
      if (items.length) days.push([d, items]);
    }
    const later = s.tasks.filter(x => x.repeat === 'none' && !x.done && x.date > W.addDays(t0, 13)).sort((a, b) => a.date < b.date ? -1 : 1);
    const nodate = s.tasks.filter(x => x.repeat === 'none' && !x.done && !x.date);
    const daily = s.tasks.filter(x => x.repeat === 'daily');
    body = [
      overdue.length ? [head('Overdue', overdue.length), h('div', { class: 'card overdue' }, overdue.map(i => W.taskRow(i, { overdue: true })))] : null,
      days.map(([d, items]) => [h('h2', {}, h('span', {}, W.relDay(d) + (W.daysBetween(t0, d) < 7 && W.daysBetween(t0, d) > 1 ? ' · ' + W.shortDate(d) : '')), !W.isShift(d) && d !== t0 ? h('span', { class: 'muted small', style: 'text-transform:none;letter-spacing:0' }, 'no shift') : null),
        card(W.planList(items))]),
      later.length ? [head('Later', later.length), card(later.map(x => W.taskRow({ task: x, occ: x.date }, { showDate: true })))] : null,
      nodate.length ? [head('No date', nodate.length), card(nodate.map(x => W.taskRow({ task: x, occ: '' })))] : null,
      !days.length && !later.length && !nodate.length && !overdue.length ? h('div', { class: 'empty' }, 'No tasks yet. Type one in the box above.') : null,
      daily.length ? h('p', { class: 'muted small', style: 'text-align:center;margin-top:14px' }, 'Plus ' + daily.length + ' daily task' + (daily.length > 1 ? 's' : '') + ' on each shift. See them under Repeating.') : null
    ];
  } else if (tab === 'repeat') {
    const groups = [['daily', 'Every shift'], ['weekly', 'Weekly'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Monthly']];
    body = [
      groups.map(([k, label]) => {
        const list = s.tasks.filter(x => x.repeat === k).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
        if (!list.length) return null;
        return [head(label, list.length), card(list.map(x => repeatRow(x)))];
      }),
      !s.tasks.some(x => x.repeat !== 'none') ? h('div', { class: 'empty' }, 'No repeating tasks yet. Type one in the box above the way you\'d say it, with how often and which day.') : null,
      presetSection()
    ];
  } else if (tab === 'team') {
    const open = sortTeam(W.openTeam());
    body = [
      h('p', { class: 'muted', style: 'margin-top:0' }, 'Tasks you\'ve handed out to the team, so everyone stays on track.'),
      open.length ? card(open.map(W.teamRow)) : h('div', { class: 'empty' }, 'Nothing handed out right now'),
      h('div', { class: 'grid2' }, h('button', { class: 'btn', onclick: () => W.editTeam() }, '+ Hand out task'), h('button', { class: 'btn ghost', onclick: W.shareTeam }, 'Share list'))
    ];
  } else {
    const done = s.tasks.filter(x => x.repeat === 'none' && x.done).map(x => ({ kind: 'me', x, at: x.doneAt || '' }))
      .concat(s.team.filter(x => x.done).map(x => ({ kind: 'team', x, at: x.doneAt || '' }))).sort((a, b) => a.at < b.at ? 1 : -1);
    body = [
      done.length ? card(done.map(({ kind, x }) => h('div', { class: 'item done' },
        h('input', { type: 'checkbox', checked: true, onchange: () => { x.done = false; x.doneAt = ''; W.save(); W.toast('Moved back to your list'); W.render(); } }),
        h('div', { class: 'grow' }, h('div', { class: 't' }, x.title), h('div', { class: 'sub' }, kind === 'team' ? h('span', { class: 'pill who' }, '👤 ' + (x.who || 'Team')) : null, 'Done ' + (x.doneAt ? W.relDay(x.doneAt).toLowerCase() : ''))),
        h('button', { class: 'del', 'aria-label': 'Delete', onclick: () => { if (kind === 'team') s.team = s.team.filter(y => y !== x); else s.tasks = s.tasks.filter(y => y !== x); W.save(); W.render(); } }, '✕'))))
        : h('div', { class: 'empty' }, 'Finished tasks land here'),
      done.length ? h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete all ' + done.length + ' finished tasks?', () => { s.tasks = s.tasks.filter(x => !(x.repeat === 'none' && x.done)); s.team = s.team.filter(x => !x.done); W.save(); W.render(); }) }, 'Delete all finished') : null,
      h('p', { class: 'muted small', style: 'text-align:center' }, 'Untick a task to put it back on your list. Repeating tasks keep their own history under Repeating.')
    ];
  }
  W.fill(app,
    h('h1', {}, 'Tasks'),
    tab === 'todo' || tab === 'repeat' ? W.quickBox('', tab === 'repeat' ? 'repeat' : 'oneoff') : null,
    W.seg([['todo', 'To do'], ['repeat', 'Repeating'], ['team', 'Team' + (W.openTeam().length ? ' (' + W.openTeam().length + ')' : '')], ['done', 'Done']], tab, v => { tab = v; W.render(); }),
    body
  );
};
W.tasksTab = v => { tab = v; };
W.tasksTabNow = () => tab;
// The + for each section opens that section's own form
W.openSectionForm = function (mode, date) {
  if (mode === 'team') return W.editTeam();
  if (mode === 'repeat') return W.editTask(null, { repeat: '' }, null, 'repeat');
  return W.editTask(null, { repeat: 'none', date: date || '' }, null, 'oneoff');
};


function nextOcc(t) { for (let i = 0; i < 70; i++) { const d = W.addDays(W.today(), i); if (W.occursOn(t, d)) return W.relDay(d) + (i > 1 && i < 7 ? ' ' + W.shortDate(d) : ''); } return '—'; }
function presetSection() {
  const pres = S().presets;
  return [h('h2', {}, h('span', {}, '⭐ Presets'), pres.length ? h('span', { class: 'count' }, pres.length) : null),
    pres.length ? W.card(pres.map(p => h('div', { class: 'item' },
      h('div', { class: 'grow', style: 'cursor:pointer', onclick: () => W.usePreset(p) }, h('div', { class: 't' }, p.title), h('div', { class: 'sub' }, h('span', { class: 'pill' }, W.repeatLabel(p)), p.time ? h('span', { class: 'pill time' }, p.time) : null, 'Tap to add')),
      h('button', { class: 'del', 'aria-label': 'Delete preset', onclick: () => W.confirm('Delete the preset "' + p.title + '"? Tasks already made from it stay.', () => { S().presets = S().presets.filter(x => x.id !== p.id); W.save(); W.render(); }) }, '✕'))))
      : h('p', { class: 'muted small' }, 'None yet. When adding or editing a task, tap ⭐ Save as preset to reuse it later. Presets show as quick buttons under the task box.')];
}
// A repeating task with this period's status and the last 4 periods as dots
function repeatRow(t) {
  const t0 = W.today();
  let status, dots = [];
  if (t.repeat === 'daily') {
    const shifts = []; for (let i = 0; i < 60 && shifts.length < 6; i++) { const d = W.addDays(t0, -i); if (d >= (t.start || t0) && W.isShift(d)) shifts.push(d); }
    status = W.isShift(t0) ? (W.isDone(t, t0) ? ['ok', '✓ Done today'] : ['', 'To do today']) : ['', 'Next shift'];
    dots = shifts.slice(W.isShift(t0) ? 1 : 0, (W.isShift(t0) ? 1 : 0) + 5).reverse().map(d => W.isDone(t, d));
  } else {
    const len = t.repeat === 'monthly' ? 0 : t.repeat === 'weekly' ? 7 : 14;
    const periodOf = d => t.repeat === 'monthly' ? d.slice(0, 7) : W.periodEnd(t, d);
    const occs = []; for (let i = 0; i < 130; i++) { const d = W.addDays(t0, -i); if (W.occursOn(t, d)) occs.push(d); }
    const curEnd = periodOf(t0);
    const thisP = []; for (let i = -40; i <= 40; i++) { const d = W.addDays(t0, i); if (W.occursOn(t, d) && periodOf(d) === curEnd) thisP.push(d); }
    const missed = thisP.filter(d => d < t0 && !W.isDone(t, d)), doneP = thisP.filter(d => W.isDone(t, d)), next = thisP.filter(d => d >= t0 && !W.isDone(t, d));
    status = missed.length ? ['red', '⚠ Not done yet (' + missed.map(d => W.dayName(d)).join(', ') + ')'] : next.length ? ['warn', '⏳ Due ' + W.relDay(next[0]).toLowerCase()] : doneP.length ? ['ok', '✓ Done ' + W.dayName(Object.values(t.doneDates || {}).sort().pop() || t0)] : ['', 'Next: ' + nextOcc(t)];
    const byP = {}; occs.filter(d => periodOf(d) !== curEnd).forEach(d => { (byP[periodOf(d)] = byP[periodOf(d)] || []).push(d); });
    dots = Object.keys(byP).sort().slice(-4).map(k => byP[k].every(d => W.isDone(t, d)));
    void len;
  }
  return h('div', { class: 'item', style: 'cursor:pointer', onclick: () => W.editTask(t) },
    h('div', { class: 'grow' },
      h('div', { class: 't' }, t.flag ? '🚩 ' : '', t.clean ? '🧽 ' : '', t.title),
      h('div', { class: 'sub' }, t.repeat !== 'daily' ? h('span', { class: 'pill' }, W.repeatLabel(t).replace(/^.*· /, '')) : null, t.time ? h('span', { class: 'pill time' }, t.time) : null,
        h('span', { class: 'pill ' + status[0] }, status[1]))),
    dots.length ? h('div', { class: 'dots', title: 'Recent history' }, dots.map(ok => h('i', { class: ok ? 'y' : 'n' }))) : null);
}
})();
