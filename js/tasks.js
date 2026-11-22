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
// Flexible = weekly/2-weekly with no day chosen, or monthly with no date: you pick the day each period.
W.isFlex = t => ((t.repeat === 'weekly' || t.repeat === 'biweekly') && !(t.days || []).length) || (t.repeat === 'monthly' && !t.mday);
W.repeatLabel = t => t.repeat === 'daily' ? 'Every shift' :
  t.repeat === 'weekly' ? 'Weekly · ' + (daysLabel(t.days) || 'you pick the day') :
  t.repeat === 'biweekly' ? 'Every 2 weeks · ' + (daysLabel(t.days) || 'you pick the day') :
  t.repeat === 'monthly' ? 'Monthly · ' + (t.mday ? ord(t.mday) : 'you pick the day') : 'One-off';

W.isShift = D => { const sh = S().shifts[D]; return !!(sh && !sh.off); };
const isOff = D => { const sh = S().shifts[D]; return !!(sh && sh.off); };
const lastDayOfMonth = D => { const d = W.parse(D); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
// First day of the period (week / fortnight / month) that day D falls in
W.periodStart = function (t, D) {
  if (t.repeat === 'monthly') return D.slice(0, 8) + '01';
  const ws = W.weekStart(D);
  if (t.repeat === 'biweekly') { const odd = Math.abs(W.daysBetween(W.weekStart(t.start || D), ws) / 7) % 2; return odd ? W.addDays(ws, -7) : ws; }
  return ws;
};
W.periodEnd = function (t, D) {
  if (t.repeat === 'monthly') { const d = W.parse(D); return W.dstr(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
  if (t.repeat === 'biweekly') return W.addDays(W.periodStart(t, D), 13);
  if (t.repeat === 'weekly') return W.addDays(W.weekStart(D), 6);
  return D;
};
// The day a task is set for (before moving it off days off)
W.occursOn = function (t, D) {
  if (t.repeat === 'none' || !t.repeat) return t.date === D;
  if (D < (t.start || '0') && !(W.isFlex(t) && W.periodEnd(t, D) >= (t.start || '0'))) return false;
  if (t.repeat === 'daily') return W.isShift(D);
  if (W.isFlex(t)) return (t.placed || {})[W.periodStart(t, D)] === D;
  if (t.repeat === 'weekly') return (t.days || []).includes(dow(D));
  if (t.repeat === 'biweekly') return (t.days || []).includes(dow(D)) && W.periodStart(t, D) === W.weekStart(D);
  if (t.repeat === 'monthly') return W.parse(D).getDate() === Math.min(t.mday, lastDayOfMonth(D));
  return false;
};
// No tasks on days off: a set day that isn't a shift moves to your next shift
// (it never rolls past the task's next repeat; if there's no shift before then, it stays where it was)
W.effDate = function (t, occ) {
  if (t.repeat === 'none' || t.repeat === 'daily' || W.isShift(occ)) return occ;
  let limit = 31; for (let i = 1; i <= 31; i++) if (W.occursOn(t, W.addDays(occ, i))) { limit = i; break; }
  for (let i = 1; i < limit; i++) { const d = W.addDays(occ, i); if (W.isShift(d)) return d; }
  for (let i = 1; i < limit; i++) { const d = W.addDays(occ, i); if (!isOff(d) && !W.isShift(d) && !S().shifts[d]) return d; }
  return occ;
};
// Which period to plan a flexible job in: this one, or the next if no working days are left in this one
W.planPeriod = function (t) {
  const t0 = W.today(), ps = W.periodStart(t, t0), pe = W.periodEnd(t, t0);
  if ((t.placed || {})[ps] || doneInPeriod(t, ps)) return ps;
  for (let d = t0; d <= pe; d = W.addDays(d, 1)) if (W.isShift(d) || (!S().shifts[d] && d > t0)) return ps;
  return W.addDays(pe, 1);
};
W.isDone = (t, occ) => t.repeat === 'none' || !t.repeat ? !!t.done : !!(t.doneDates || {})[occ];
W.setDone = function (t, occ, val) {
  if (t.repeat === 'none' || !t.repeat) { t.done = val; t.doneAt = val ? W.today() : ''; }
  else { t.doneDates = t.doneDates || {}; if (val) t.doneDates[occ] = W.today(); else delete t.doneDates[occ]; }
  W.save();
};
const doneInPeriod = (t, ps) => { const pe = W.periodEnd(t, ps); return Object.keys(t.doneDates || {}).some(k => k >= ps && k <= pe); };

const sortItems = arr => arr.sort((a, b) => {
  const at = a.task.time || '', bt = b.task.time || '';
  if (!!at !== !!bt) return at ? -1 : 1;           // timed first
  if (at !== bt) return at < bt ? -1 : 1;
  if (!!a.task.flag !== !!b.task.flag) return a.task.flag ? -1 : 1;
  return 0;
});
// Everything planned on day D: [{task, occ}] (occ = the day it was set for; it may have moved here from a day off)
W.dayItems = function (D) {
  const out = [];
  S().tasks.forEach(t => {
    if (t.repeat === 'none' || t.repeat === 'daily' || !t.repeat) { if (W.occursOn(t, D)) out.push({ task: t, occ: D }); return; }
    for (let i = 0; i <= 14; i++) { const o = W.addDays(D, -i); if (W.occursOn(t, o) && W.effDate(t, o) === D) out.push({ task: t, occ: o }); }
  });
  return sortItems(out);
};
// Overdue: one-offs past their date, and weekly/2-weekly/monthly missed earlier this period. Daily ones just disappear.
W.overdueItems = function () {
  const t0 = W.today(), out = [];
  S().tasks.forEach(t => {
    if (t.repeat === 'none' || !t.repeat) { if (!t.done && t.date && t.date < t0) out.push({ task: t, occ: t.date }); return; }
    if (t.repeat === 'daily') return;
    for (let i = 45; i >= 1; i--) {
      const o = W.addDays(t0, -i);
      if (!W.occursOn(t, o) || W.isDone(t, o)) continue;
      const e = W.effDate(t, o);
      if (e < t0 && (W.periodEnd(t, o) >= t0 || e >= W.addDays(t0, -1))) out.push({ task: t, occ: o });
    }
  });
  return out.sort((a, b) => (!!b.task.flag - !!a.task.flag) || (a.occ < b.occ ? -1 : 1));
};
// Flexible tasks that still need a day this week / fortnight / month
W.needsDay = function () {
  const t0 = W.today();
  return S().tasks.filter(t => {
    if (!W.isFlex(t)) return false;
    const ps = W.planPeriod(t);
    if (W.periodEnd(t, ps) < (t.start || t0)) return false;
    const pl = (t.placed || {})[ps];
    return !pl && !doneInPeriod(t, ps);
  });
};
// Pick (or change) the day for a flexible task this period
W.placeSheet = function (t) {
  const t0 = W.today(), ps = W.planPeriod(t), pe = W.periodEnd(t, ps);
  const nextP = ps > t0;
  const per = (nextP ? 'next ' : 'this ') + (t.repeat === 'monthly' ? 'month' : t.repeat === 'biweekly' ? 'fortnight' : 'week');
  const set = v => { t.placed = t.placed || {}; t.placed[ps] = v; W.save(); W.close(); W.render(); };
  const days = []; for (let d = nextP ? ps : t0; d <= pe; d = W.addDays(d, 1)) if (!isOff(d)) days.push(d);
  const cur = (t.placed || {})[ps];
  W.sheet(t.title, [
    h('p', { class: 'muted' }, 'Which day will you do it ' + per + '?'),
    h('div', {}, days.map(d => h('span', { class: 'chip day-chip' + (cur === d ? ' on' : '') + (W.isShift(d) ? '' : ' dim'), onclick: () => set(d) },
      h('b', {}, W.relDay(d) === 'Today' || W.relDay(d) === 'Tomorrow' ? W.relDay(d) : W.dayName(d) + ' ' + W.parse(d).getDate()),
      h('small', {}, W.isShift(d) ? W.fmtShift(S().shifts[d]) : 'no shift yet')))),
    !days.length ? h('p', { class: 'muted small' }, 'No working days left ' + per + '.') : null,
    h('div', { class: 'grid2', style: 'margin-top:10px' },
      nextP ? null : h('button', { class: 'btn ghost', onclick: () => { W.setDone(t, t0, true); t.placed = t.placed || {}; t.placed[ps] = t0; W.save(); W.close(); W.render(); W.toast('Done ✓'); } }, '✓ Done already'),
      h('button', { class: 'btn ghost', onclick: () => set('skip') }, 'Skip ' + per)),
    cur ? h('button', { class: 'btn danger block', onclick: () => { delete t.placed[ps]; W.save(); W.close(); W.render(); } }, 'Unplan it') : null
  ]);
};
W.needsDaySection = function () {
  const list = W.needsDay();
  if (!list.length) return null;
  return h('div', { class: 'card needs' },
    h('div', { class: 'needs-head' }, '📌 Pick a day for ' + (list.length === 1 ? 'this job' : 'these ' + list.length + ' jobs'), h('div', { class: 'muted small', style: 'font-weight:600' }, 'Flexible jobs. Choose when you\'ll do them.')),
    list.map(t => h('div', { class: 'item', style: 'cursor:pointer', onclick: () => W.placeSheet(t) },
      h('div', { class: 'grow' }, h('div', { class: 't' }, t.flag ? '🚩 ' : '', t.clean ? '🧽 ' : '', t.title),
        h('div', { class: 'sub' }, h('span', { class: 'pill' }, W.repeatLabel(t).split(' · ')[0]), (W.planPeriod(t) > W.today() ? (t.repeat === 'monthly' ? 'next month' : 'next ' + (t.repeat === 'biweekly' ? 'fortnight' : 'week')) : 'by ' + W.niceDate(W.periodEnd(t, W.today()))))),
      h('span', { class: 'pill blue' }, 'Pick day ›'))));
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
  else if (take(/\s(monthly|every\s+month)(?=\s)/i)) { r.repeat = 'monthly'; const d = take(/\s(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?=\s)/i); r.mday = d ? Math.min(31, +d[1]) : 0; }
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
const newTask = p => Object.assign({ id: W.uid(), title: '', notes: '', repeat: 'none', date: '', days: [], mday: 0, time: '', flag: false, clean: false, done: false, doneAt: '', doneDates: {}, start: W.today() }, p || {});
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
  const mday = h('input', { type: 'number', inputmode: 'numeric', min: 1, max: 31, value: d.mday || '', placeholder: 'Leave blank to pick each month' });
  const notes = h('textarea', { value: d.notes, placeholder: 'Notes (optional)' });
  const when = h('div');
  const drawWhen = () => W.fill(when,
    d.repeat === 'none' ? W.field('Date', h('div', {}, date, W.chips([[W.today(), 'Today'], [W.addDays(W.today(), 1), 'Tomorrow'], ['', 'No date']], isNew && !d.date ? null : d.date, v => { date.value = v; }))) : null,
    d.repeat === 'daily' ? h('p', { class: 'muted small' }, 'Shows on every day you have a shift on the rota. If it isn\'t done, it just drops off. A fresh one comes next shift.') : null,
    d.repeat === 'weekly' || d.repeat === 'biweekly' ? W.field('On which day(s)', h('div', {},
      WEEK_ORDER.map(n => h('span', { class: 'chip' + (d.days.includes(n) ? ' on' : ''), onclick: e => { d.days = d.days.includes(n) ? d.days.filter(x => x !== n) : d.days.concat(n); e.target.classList.toggle('on'); } }, DAY_SHORT[n])),
      h('p', { class: 'muted small' }, 'Optional. Leave blank if you\'ll decide the day each ' + (d.repeat === 'weekly' ? 'week' : 'fortnight') + '. You\'ll get a reminder to pick one. If it lands on a day off, it moves to your next shift.'))) : null,
    d.repeat === 'monthly' ? W.field('Day of the month (optional)', mday) : null);
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
      Object.assign(d, { title: title.value.trim(), date: d.repeat === 'none' ? date.value : '', time: time.value, notes: notes.value.trim(), mday: mday.value ? Math.min(31, Math.max(1, Number(mday.value))) : 0 });
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
        opts.overdue ? h('span', { class: 'pill red' }, (t.repeat === 'none' ? 'Was due ' : 'Missed ') + W.relDay(W.effDate(t, it.occ)).toLowerCase()) : null,
        t.repeat !== 'none' && t.repeat !== 'daily' && it.occ && W.effDate(t, it.occ) !== it.occ && !opts.overdue ? h('span', { class: 'pill' }, 'Moved from ' + W.dayName(it.occ) + ' (day off)') : null,
        W.isFlex(t) && !done ? h('span', { class: 'pill blue', onclick: e => { e.stopPropagation(); W.placeSheet(t); } }, '📌 Change day') : null,
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
      W.needsDaySection(),
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


function nextOcc(t) { if (W.isFlex(t)) return 'you pick the day'; for (let i = 0; i < 70; i++) { const d = W.addDays(W.today(), i); if (W.occursOn(t, d)) { const e = W.effDate(t, d); return W.relDay(e) + (W.daysBetween(W.today(), e) > 1 && W.daysBetween(W.today(), e) < 7 ? ' ' + W.shortDate(e) : ''); } } return '—'; }
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
    status = W.isShift(t0) ? (W.isDone(t, t0) ? ['ok', '✓ Done today'] : ['', 'To do today']) : ['', 'Next shift (day off today)'];
    dots = shifts.slice(W.isShift(t0) ? 1 : 0, (W.isShift(t0) ? 1 : 0) + 5).reverse().map(d => W.isDone(t, d));
  } else {
    const ps = W.periodStart(t, t0), pe = W.periodEnd(t, t0);
    const per = t.repeat === 'monthly' ? 'month' : t.repeat === 'biweekly' ? 'fortnight' : 'week';
    const occs = []; for (let d = ps; d <= pe; d = W.addDays(d, 1)) if (W.occursOn(t, d)) occs.push(d);
    const doneOn = () => W.dayName(Object.values(t.doneDates || {}).filter(x => x >= ps).sort().pop() || t0);
    if (W.isFlex(t)) {
      const pl = (t.placed || {})[ps];
      status = doneInPeriod(t, ps) ? ['ok', '✓ Done ' + doneOn()] : pl === 'skip' ? ['', 'Skipped this ' + per]
        : pl ? (W.effDate(t, pl) < t0 ? ['red', '⚠ Not done (was ' + W.dayName(W.effDate(t, pl)) + ')'] : ['warn', '⏳ Planned ' + W.relDay(W.effDate(t, pl)).toLowerCase()])
        : ['red', '📌 Needs a day'];
    } else {
      const missed = occs.filter(d => W.effDate(t, d) < t0 && !W.isDone(t, d)), next = occs.filter(d => W.effDate(t, d) >= t0 && !W.isDone(t, d));
      status = missed.length ? ['red', '⚠ Not done yet (' + missed.map(d => W.dayName(W.effDate(t, d))).join(', ') + ')'] : next.length ? ['warn', '⏳ Due ' + W.relDay(W.effDate(t, next[0])).toLowerCase()] : occs.some(d => W.isDone(t, d)) ? ['ok', '✓ Done ' + doneOn()] : ['', 'Next: ' + nextOcc(t)];
    }
    // last 4 periods: green = done, red = missed
    let p0 = ps;
    for (let i = 0; i < 4; i++) {
      p0 = W.periodStart(t, W.addDays(p0, -1));
      if (W.periodEnd(t, p0) < (t.start || t0)) break;
      if (W.isFlex(t)) { if ((t.placed || {})[p0] !== 'skip') dots.unshift(doneInPeriod(t, p0)); }
      else { const os = []; for (let d = p0, e = W.periodEnd(t, p0); d <= e; d = W.addDays(d, 1)) if (W.occursOn(t, d)) os.push(d); if (os.length) dots.unshift(os.every(d => W.isDone(t, d))); }
    }
  }
  return h('div', { class: 'item', style: 'cursor:pointer', onclick: () => W.editTask(t) },
    h('div', { class: 'grow' },
      h('div', { class: 't' }, t.flag ? '🚩 ' : '', t.clean ? '🧽 ' : '', t.title),
      h('div', { class: 'sub' }, t.repeat !== 'daily' ? h('span', { class: 'pill' }, W.repeatLabel(t).replace(/^.*· /, '')) : null, t.time ? h('span', { class: 'pill time' }, t.time) : null,
        h('span', { class: 'pill ' + status[0] }, status[1]))),
    dots.length ? h('div', { class: 'dots', title: 'Recent history' }, dots.map(ok => h('i', { class: ok ? 'y' : 'n' }))) : null);
}
})();
