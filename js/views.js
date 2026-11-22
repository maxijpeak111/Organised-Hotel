(function () {
'use strict';
const W = window.W, h = W.h, S = () => W.state;

/* =================== EDITORS =================== */
W.editTask = function (t, preset) {
  const isNew = !t;
  const d = t ? { ...t } : Object.assign({ id: W.uid(), title: '', notes: '', from: '', due: '', done: false, created: W.today() }, preset || {});
  const title = h('input', { value: d.title, placeholder: 'What needs doing?' });
  const from = h('input', { value: d.from, placeholder: 'e.g. Sarah (manager). Leave blank if it\'s your own' });
  const due = h('input', { type: 'date', value: d.due });
  const notes = h('textarea', { value: d.notes, placeholder: 'Notes (optional)' });
  W.sheet(isNew ? (preset && preset.from !== undefined ? 'Someone asked me…' : 'New task') : 'Edit task', [
    W.field('Task', title), W.field('Who asked?', from),
    W.field('Due', h('div', {}, due, W.chips([[W.today(), 'Today'], [W.addDays(W.today(), 1), 'Tomorrow'], [W.addDays(W.today(), 7), 'Next week'], ['', 'No date']], d.due, v => { due.value = v; }))),
    W.field('Notes', notes),
    h('button', { class: 'btn block', onclick: () => {
      if (!title.value.trim()) return W.toast('Add a task name');
      Object.assign(d, { title: title.value.trim(), from: from.value.trim(), due: due.value, notes: notes.value.trim() });
      if (isNew) S().tasks.push(d); else Object.assign(t, d);
      W.save(); W.close(); W.render();
    } }, 'Save'),
    !isNew && h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete this task?', () => { S().tasks = S().tasks.filter(x => x.id !== t.id); W.save(); W.render(); }) }, 'Delete')
  ]);
  if (isNew) setTimeout(() => title.focus(), 50);
};

W.editEvent = function (ev, date) {
  const isNew = !ev;
  const d = ev ? { ...ev } : { id: W.uid(), date: date || W.today(), time: '', title: '', notes: '' };
  const title = h('input', { value: d.title, placeholder: 'e.g. Christmas party booking, team meeting' });
  const dt = h('input', { type: 'date', value: d.date });
  const tm = h('input', { type: 'time', value: d.time });
  const notes = h('textarea', { value: d.notes, placeholder: 'Numbers, set-up, who\'s involved…' });
  W.sheet(isNew ? 'New event' : 'Edit event', [
    W.field('Event', title), h('div', { class: 'grid2' }, W.field('Date', dt), W.field('Time', tm)), W.field('Notes', notes),
    h('button', { class: 'btn block', onclick: () => {
      if (!title.value.trim() || !dt.value) return W.toast('Add a name and date');
      Object.assign(d, { title: title.value.trim(), date: dt.value, time: tm.value, notes: notes.value.trim() });
      if (isNew) S().events.push(d); else Object.assign(ev, d);
      W.save(); W.close(); W.render();
    } }, 'Save'),
    !isNew && h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete this event?', () => { S().events = S().events.filter(x => x.id !== ev.id); W.save(); W.render(); }) }, 'Delete')
  ]);
};

W.editShift = function (date) {
  const cur = S().shifts[date] || {};
  const start = h('input', { type: 'time', value: cur.start || '' });
  const end = h('input', { type: 'time', value: cur.end || '' });
  const note = h('input', { value: cur.note || '', placeholder: 'e.g. Bar, closing, training' });
  const presets = S().settings.shiftPresets;
  const save = obj => { S().shifts[date] = obj; W.save(); W.close(); W.render(); };
  W.sheet('Shift · ' + W.niceDate(date), [
    presets.length ? W.field('Quick pick', h('div', {}, presets.map(p => h('span', { class: 'chip', onclick: () => save({ start: p.start, end: p.end, note: p.note || '' }) }, p.label)))) : null,
    h('div', { class: 'grid2' }, W.field('Start', start), W.field('Finish', end)), W.field('Note', note),
    h('button', { class: 'btn block', onclick: () => { if (!start.value) return W.toast('Add a start time'); save({ start: start.value, end: end.value, note: note.value.trim() }); } }, 'Save shift'),
    h('button', { class: 'btn ghost block', onclick: () => {
      if (!start.value) return W.toast('Add a start time first');
      const label = start.value + '–' + (end.value || '?') + (note.value.trim() ? ' ' + note.value.trim() : '');
      presets.push({ label, start: start.value, end: end.value, note: note.value.trim() }); W.save(); W.toast('Saved as quick pick');
    } }, 'Save as quick pick'),
    h('div', { class: 'grid2', style: 'margin-top:10px' },
      h('button', { class: 'btn ghost', onclick: () => save({ off: true }) }, 'Day off'),
      h('button', { class: 'btn danger', onclick: () => { delete S().shifts[date]; W.save(); W.close(); W.render(); } }, 'Clear'))
  ]);
};

W.editClean = function (c) {
  const isNew = !c;
  const d = c ? { ...c } : { id: W.uid(), title: '', area: '', every: 1, last: '' };
  const title = h('input', { value: d.title, placeholder: 'e.g. Clean glass washer' });
  const areas = [...new Set(S().cleaning.map(x => x.area).filter(Boolean))];
  const area = h('input', { value: d.area, placeholder: 'e.g. Bar, Cellar, Toilets', list: 'areas' });
  const every = h('input', { type: 'number', inputmode: 'numeric', min: 1, value: d.every });
  W.sheet(isNew ? 'New cleaning job' : 'Edit cleaning job', [
    W.field('Job', title), W.field('Area', h('div', {}, area, h('datalist', { id: 'areas' }, areas.map(a => h('option', { value: a }))))),
    W.field('How often (days)', h('div', {}, every, W.chips([[1, 'Daily'], [2, 'Every 2 days'], [7, 'Weekly'], [14, 'Fortnightly'], [30, 'Monthly']], Number(d.every), v => { every.value = v; }))),
    h('button', { class: 'btn block', onclick: () => {
      if (!title.value.trim()) return W.toast('Add a job name');
      Object.assign(d, { title: title.value.trim(), area: area.value.trim(), every: Math.max(1, Number(every.value) || 1) });
      if (isNew) S().cleaning.push(d); else Object.assign(c, d);
      W.save(); W.close(); W.render();
    } }, 'Save'),
    !isNew && h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete this cleaning job?', () => { S().cleaning = S().cleaning.filter(x => x.id !== c.id); W.save(); W.render(); }) }, 'Delete')
  ]);
};

W.IDEA_CATS = ['Drinks', 'Service', 'Events', 'Marketing', 'Saving money', 'Team', 'Other'];
W.IDEA_STATUS = [['new', 'New'], ['try', 'To try'], ['doing', 'Trying'], ['done', 'Done'], ['no', 'Dropped']];
W.editIdea = function (i) {
  const isNew = !i;
  const d = i ? { ...i } : { id: W.uid(), title: '', notes: '', cat: 'Other', status: 'new', created: W.today() };
  const title = h('input', { value: d.title, placeholder: 'e.g. Happy hour on cocktails Mon–Wed' });
  const notes = h('textarea', { value: d.notes, placeholder: 'Why it would help, how it would work, who to pitch it to…' });
  W.sheet(isNew ? 'New idea' : 'Edit idea', [
    W.field('Idea', title),
    W.field('Type', W.chips(W.IDEA_CATS.map(c => [c, c]), d.cat, v => { d.cat = v; })),
    W.field('Status', W.chips(W.IDEA_STATUS, d.status, v => { d.status = v; })),
    W.field('Notes', notes),
    h('button', { class: 'btn block', onclick: () => {
      if (!title.value.trim()) return W.toast('Add the idea');
      Object.assign(d, { title: title.value.trim(), notes: notes.value.trim() });
      if (isNew) S().ideas.push(d); else Object.assign(i, d);
      W.save(); W.close(); W.render();
    } }, 'Save'),
    !isNew && h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete this idea?', () => { S().ideas = S().ideas.filter(x => x.id !== i.id); W.save(); W.render(); }) }, 'Delete')
  ]);
  if (isNew) setTimeout(() => title.focus(), 50);
};

W.quickAdd = function () {
  const go = fn => () => { W.close(); setTimeout(fn, 10); };
  W.sheet('Add', h('div', { class: 'menu', style: 'margin-top:12px' },
    h('div', { class: 'card tap', onclick: go(() => W.editTask(null, { from: '' })) }, 'Someone asked me to…'),
    h('div', { class: 'card tap', onclick: go(() => W.editTask()) }, 'Work task'),
    h('div', { class: 'card tap', onclick: go(() => W.editEvent()) }, 'Event'),
    h('div', { class: 'card tap', onclick: go(() => W.editShift(W.today())) }, 'Shift'),
    h('div', { class: 'card tap', onclick: go(() => W.editClean()) }, 'Cleaning job'),
    h('div', { class: 'card tap', onclick: go(() => W.editIdea()) }, 'Business idea')));
};

/* =================== SHARED ROWS =================== */
W.taskRow = function (t) {
  const due = t.due ? W.daysBetween(W.today(), t.due) : null;
  const dueTxt = t.due ? (due < 0 ? 'Overdue · ' + W.shortDate(t.due) : 'Due ' + W.relDay(t.due).toLowerCase()) : null;
  return h('div', { class: 'item' + (t.done ? ' done' : '') },
    h('input', { type: 'checkbox', checked: !!t.done, onchange: e => { t.done = e.target.checked; t.doneAt = t.done ? W.today() : ''; W.save(); W.toast(t.done ? 'Done' : 'Re-opened'); setTimeout(W.render, 250); } }),
    h('div', { class: 'grow', onclick: () => W.editTask(t) },
      h('div', { class: 't' }, t.title),
      (t.from || dueTxt || t.notes) && h('div', { class: 'sub' },
        t.from && h('span', { class: 'pill warn' }, 'From ' + t.from),
        dueTxt && h('span', { class: 'pill' + (due < 0 ? ' red' : due === 0 ? ' warn' : '') }, dueTxt),
        t.notes && h('span', {}, t.notes.length > 50 ? t.notes.slice(0, 50) + '…' : t.notes))));
};
const sortTasks = arr => arr.slice().sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0);

W.cleanRow = function (c) {
  const n = W.cleanOverdue(c);
  const tag = n < 0 ? h('span', { class: 'pill red' }, Math.abs(n) + 'd overdue') : n === 0 ? h('span', { class: 'pill warn' }, 'Due today') : h('span', { class: 'pill' }, 'In ' + n + 'd');
  const every = c.every == 1 ? 'Daily' : c.every == 7 ? 'Weekly' : 'Every ' + c.every + ' days';
  return h('div', { class: 'item' },
    h('input', { type: 'checkbox', checked: c.last === W.today(), onchange: e => {
      if (e.target.checked) { c.prev = c.last; c.last = W.today(); W.toast('Cleaned'); } else { c.last = c.prev || ''; }
      W.save(); setTimeout(W.render, 250);
    } }),
    h('div', { class: 'grow', onclick: () => W.editClean(c) },
      h('div', { class: 't' }, c.title),
      h('div', { class: 'sub' }, tag, (c.area ? c.area + ' · ' : '') + every)));
};

const card = (...kids) => h('div', { class: 'card' }, kids);
const head = (title, n) => h('h2', {}, h('span', {}, title), n != null ? h('span', { class: 'count' }, n) : null);

/* =================== TODAY =================== */
W.views.today = function (app) {
  const t = W.today(), s = S();
  const shift = s.shifts[t], tmr = s.shifts[W.addDays(t, 1)];
  const asked = sortTasks(W.openTasks().filter(x => x.from));
  const mine = sortTasks(W.openTasks().filter(x => !x.from && x.due && x.due <= t));
  const later = W.openTasks().filter(x => !x.from && !(x.due && x.due <= t)).length;
  const clean = s.cleaning.filter(c => W.cleanOverdue(c) <= 0).sort((a, b) => W.cleanOverdue(a) - W.cleanOverdue(b));
  const cleanedToday = s.cleaning.filter(c => c.last === t);
  const events = s.events.filter(e => e.date >= t && e.date <= W.addDays(t, 7)).sort((a, b) => (a.date + a.time) < (b.date + b.time) ? -1 : 1);
  const low = W.lowItems(), od = W.nextOrderDate(), odIn = W.daysBetween(t, od);

  const hr = new Date().getHours();
  const hello = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  W.fill(app,
    h('div', { class: 'brand' }, h('span', { class: 'dot' }), 'Organised Hotel'),
    h('div', { class: 'top' }, h('h1', {}, hello + ' 👋', h('div', { class: 'muted', style: 'font-size:15px;font-weight:600;margin-top:4px' }, W.DAYS_LONG[W.parse(t).getDay()] + ' ' + W.niceDate(t).slice(4))),
      h('button', { class: 'icon-btn', onclick: W.settings, 'aria-label': 'Settings' }, '⚙')),
    h('div', { class: 'card tap', onclick: () => W.editShift(t) },
      h('div', { class: 'row between' }, h('div', {}, h('div', { class: 'muted small' }, 'Shift today'), h('div', { class: 'big-num', style: 'font-size:26px;margin-top:2px' }, shift ? W.fmtShift(shift) : 'Not set')),
        h('div', { style: 'text-align:right' }, h('div', { class: 'muted small' }, 'Tomorrow'), h('div', { style: 'font-weight:800' }, tmr ? W.fmtShift(tmr) : '—'))),
      shift && shift.note ? h('div', { class: 'muted small', style: 'margin-top:4px' }, shift.note) : null),
    (low.length || odIn <= 1) && h('div', { class: 'card tap' + (odIn === 0 ? ' alert' : ''), onclick: () => W.go('stock') },
      h('div', { class: 'row between' }, h('div', {}, h('div', { style: 'font-weight:800' }, odIn === 0 ? 'Stock order day' : odIn === 1 ? 'Stock order tomorrow' : 'Stock to order'),
        h('div', { class: 'muted small' }, low.length ? low.length + ' item' + (low.length > 1 ? 's' : '') + ' on the order list' : 'Nothing flagged yet. Do a stock check')),
        h('span', { class: 'pill blue' }, 'Stock ›'))),
    head('Asked of me', asked.length || null),
    asked.length ? card(asked.map(W.taskRow)) : h('div', { class: 'empty' }, 'Nobody\'s waiting on you. Tap + when someone asks you to do something.'),
    head('To do today', mine.length || null),
    mine.length ? card(mine.map(W.taskRow)) : h('div', { class: 'empty' }, 'Nothing due today.' + (later ? ' ' + later + ' more in Tasks.' : '')),
    head('Cleaning due', clean.length || null),
    clean.length ? card(clean.map(W.cleanRow)) : h('div', { class: 'empty' }, s.cleaning.length ? 'All cleaning up to date' + (cleanedToday.length ? ' · ' + cleanedToday.length + ' done today' : '') : 'No cleaning jobs yet. Add them in Clean.'),
    head('Coming up', null),
    events.length ? card(events.map(e => h('div', { class: 'ev', onclick: () => W.editEvent(e) }, h('b', {}, e.date === t ? (e.time || 'Today') : W.dayName(e.date)), h('div', {}, e.title, e.date !== t && e.time ? h('span', { class: 'muted small' }, ' · ' + e.time) : null))))
      : h('div', { class: 'empty' }, 'No events in the next 7 days')
  );
};

/* =================== TASKS =================== */
let taskTab = 'open';
W.views.tasks = function (app) {
  const s = S();
  const open = sortTasks(W.openTasks());
  const list = taskTab === 'asked' ? open.filter(t => t.from) : taskTab === 'done' ? s.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || '') < (a.doneAt || '') ? -1 : 1) : open;
  W.fill(app,
    h('h1', {}, 'Tasks'),
    W.seg([['open', 'To do (' + open.length + ')'], ['asked', 'Asked of me'], ['done', 'Done']], taskTab, v => { taskTab = v; W.render(); }),
    list.length ? card(list.map(W.taskRow)) : h('div', { class: 'empty' }, taskTab === 'done' ? 'Nothing finished yet' : 'All clear'),
    taskTab === 'done' && list.length ? h('button', { class: 'btn ghost block', onclick: () => W.confirm('Clear all finished tasks?', () => { s.tasks = s.tasks.filter(t => !t.done); W.save(); W.render(); }) }, 'Clear finished tasks') : null,
    h('div', { class: 'grid2', style: 'margin-top:12px' },
      h('button', { class: 'btn', onclick: () => W.editTask(null, { from: '' }) }, 'Someone asked'),
      h('button', { class: 'btn ghost', onclick: () => W.editTask() }, 'My task'))
  );
};

/* =================== ROTA & EVENTS =================== */
let rotaWeek = null;
W.views.rota = function (app) {
  const s = S(), t = W.today();
  rotaWeek = rotaWeek || W.weekStart(t);
  const days = [...Array(7)].map((_, i) => W.addDays(rotaWeek, i));
  let hours = 0;
  days.forEach(d => { const sh = s.shifts[d]; if (sh && sh.start && sh.end) { let [a, b] = [sh.start, sh.end].map(x => { const [hh, mm] = x.split(':').map(Number); return hh + mm / 60; }); if (b <= a) b += 24; hours += b - a; } });
  W.fill(app,
    h('h1', {}, 'Rota'),
    h('div', { class: 'week-nav' },
      h('button', { class: 'icon-btn', onclick: () => { rotaWeek = W.addDays(rotaWeek, -7); W.render(); } }, '‹'),
      h('div', { class: 'grow' }, W.shortDate(days[0]) + ' – ' + W.shortDate(days[6]), h('div', { class: 'muted small', style: 'font-weight:600' }, hours ? Math.round(hours * 10) / 10 + ' hours this week' : (rotaWeek === W.weekStart(t) ? 'This week' : ''))),
      h('button', { class: 'icon-btn', onclick: () => { rotaWeek = W.addDays(rotaWeek, 7); W.render(); } }, '›')),
    rotaWeek !== W.weekStart(t) ? h('button', { class: 'btn ghost small', style: 'margin:-4px 0 12px', onclick: () => { rotaWeek = W.weekStart(t); W.render(); } }, 'Back to this week') : null,
    days.map(d => {
      const sh = s.shifts[d];
      const evs = s.events.filter(e => e.date === d).sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1);
      const due = s.tasks.filter(x => !x.done && x.due === d);
      return h('div', { class: 'day' + (d === t ? ' today' : '') },
        h('div', { class: 'day-head' },
          h('div', { class: 'day-name' }, W.dayName(d), h('span', { class: 'day-date' }, W.shortDate(d))),
          h('span', { class: 'pill' + (sh && !sh.off ? ' shift' : ''), style: 'cursor:pointer;padding:6px 12px;font-size:13px', onclick: () => W.editShift(d) }, sh ? W.fmtShift(sh) : '+ Shift')),
        sh && sh.note ? h('div', { class: 'muted small', style: 'margin-top:4px' }, sh.note) : null,
        evs.map(e => h('div', { class: 'ev', onclick: () => W.editEvent(e) }, h('b', {}, e.time || '•'), h('div', {}, e.title))),
        due.map(x => h('div', { class: 'ev', onclick: () => W.editTask(x) }, h('b', {}, '☐'), h('div', { class: 'muted' }, x.title))),
        h('div', { style: 'margin-top:8px' }, h('span', { class: 'chip', style: 'margin:0', onclick: () => W.editEvent(null, d) }, '+ Event')));
    }),
    h('button', { class: 'btn ghost block', onclick: () => {
      const prev = W.addDays(rotaWeek, -7); let n = 0;
      for (let i = 0; i < 7; i++) { const from = s.shifts[W.addDays(prev, i)]; const to = W.addDays(rotaWeek, i); if (from && !s.shifts[to]) { s.shifts[to] = { ...from }; n++; } }
      W.save(); W.render(); W.toast(n ? 'Copied ' + n + ' shifts' : 'Nothing to copy');
    } }, 'Copy last week\'s shifts into empty days')
  );
};

/* =================== CLEANING =================== */
let cleanBy = 'due';
W.views.clean = function (app) {
  const s = S();
  const list = s.cleaning.slice().sort((a, b) => W.cleanOverdue(a) - W.cleanOverdue(b) || a.title.localeCompare(b.title));
  const dueN = list.filter(c => W.cleanOverdue(c) <= 0).length;
  let body;
  if (!list.length) body = [h('div', { class: 'empty' }, 'No cleaning jobs yet.'),
    h('button', { class: 'btn block', onclick: () => { (window.W_CLEAN_TEMPLATE || []).forEach(([title, area, every], i) => s.cleaning.push({ id: W.uid(), title, area, every, last: every > 1 ? W.addDays(W.today(), -(i % every)) : '' })); W.save(); W.render(); W.toast('Added. Edit or delete any that don\'t fit'); } }, 'Add common bar cleaning jobs'),
    h('p', { class: 'muted small', style: 'text-align:center' }, 'A starter list you can edit, or add your own with +')];
  else if (cleanBy === 'area') {
    const areas = [...new Set(list.map(c => c.area || 'Other'))].sort();
    body = areas.map(a => [head(a, null), card(list.filter(c => (c.area || 'Other') === a).map(W.cleanRow))]);
  } else body = [
    dueN ? [head('Due now', dueN), card(list.filter(c => W.cleanOverdue(c) <= 0).map(W.cleanRow))] : h('div', { class: 'card', style: 'text-align:center;font-weight:800' }, h('span', { class: 'ok' }, '✓ '), 'Everything is up to date'),
    list.some(c => W.cleanOverdue(c) > 0) ? [head('Later', null), card(list.filter(c => W.cleanOverdue(c) > 0).map(W.cleanRow))] : null];
  W.fill(app,
    h('h1', {}, 'Cleaning'),
    list.length ? W.seg([['due', 'By due date'], ['area', 'By area']], cleanBy, v => { cleanBy = v; W.render(); }) : null,
    body,
    list.length ? h('p', { class: 'muted small', style: 'text-align:center;margin-top:14px' }, 'Tick a job when it\'s done. It comes back when it\'s next due.') : null
  );
};

/* =================== IDEAS =================== */
let ideaTab = 'open';
W.views.ideas = function (app) {
  const s = S();
  const order = { doing: 0, try: 1, new: 2, done: 3, no: 4 };
  const list = s.ideas.filter(i => ideaTab === 'open' ? !['done', 'no'].includes(i.status) : ['done', 'no'].includes(i.status)).sort((a, b) => order[a.status] - order[b.status] || (b.created < a.created ? -1 : 1));
  const lab = Object.fromEntries(W.IDEA_STATUS);
  W.fill(app,
    h('h1', {}, 'Ideas'),
    h('p', { class: 'muted', style: 'margin-top:-10px' }, 'Ways to improve the business. Note them down before you forget.'),
    W.seg([['open', 'Open'], ['closed', 'Done / dropped']], ideaTab, v => { ideaTab = v; W.render(); }),
    list.length ? card(list.map(i => h('div', { class: 'item' },
      h('div', { class: 'grow', onclick: () => W.editIdea(i) }, h('div', { class: 't' }, i.title),
        h('div', { class: 'sub' }, h('span', { class: 'pill' + (i.status === 'doing' ? ' ok' : i.status === 'try' ? ' warn' : '') }, lab[i.status]), h('span', { class: 'pill' }, i.cat), i.notes ? (i.notes.length > 60 ? i.notes.slice(0, 60) + '…' : i.notes) : '')))))
      : h('div', { class: 'empty' }, ideaTab === 'open' ? 'No ideas yet. Tap + to add one.' : 'Nothing here yet'),
    s.ideas.length ? h('button', { class: 'btn ghost block', onclick: () => {
      const txt = W.IDEA_STATUS.map(([k, l]) => { const g = s.ideas.filter(i => i.status === k); return g.length ? l.toUpperCase() + '\n' + g.map(i => '• ' + i.title + ' (' + i.cat + ')' + (i.notes ? '\n   ' + i.notes : '')).join('\n') : ''; }).filter(Boolean).join('\n\n');
      W.share('Business ideas', txt);
    } }, 'Share ideas list') : null
  );
};

/* =================== SETTINGS =================== */
W.settings = function () {
  const s = S();
  W.sheet('Settings', [
    W.field('Stock order day', W.chips(W.DAYS_LONG.map((d, i) => [i, d.slice(0, 3)]), Number(s.settings.orderDay), v => { s.settings.orderDay = v; W.save(); W.render(); })),
    W.field('Shift quick picks', s.settings.shiftPresets.length ? h('div', {}, s.settings.shiftPresets.map((p, i) => h('span', { class: 'chip', onclick: () => W.confirm('Remove quick pick "' + p.label + '"?', () => { s.settings.shiftPresets.splice(i, 1); W.save(); }) }, p.label + '  ✕'))) : h('p', { class: 'muted small' }, 'None yet. Add one when setting a shift.')),
    h('h2', {}, 'Backup'),
    h('p', { class: 'muted small' }, 'Everything is saved on this phone only. Make a backup now and then, so you can restore it if you change phone or clear Safari.'),
    h('button', { class: 'btn block', onclick: () => {
      const blob = new Blob([JSON.stringify(s)], { type: 'application/json' });
      const file = new File([blob], 'work-backup-' + W.today() + '.json', { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file] }).catch(() => {});
      else { const a = h('a', { href: URL.createObjectURL(blob), download: file.name }); document.body.append(a); a.click(); a.remove(); }
    } }, 'Save backup'),
    h('label', { class: 'btn ghost block' }, 'Restore from backup', h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(txt => { const o = JSON.parse(txt); if (!o || !Array.isArray(o.tasks)) throw new Error('bad'); W.confirm('Replace everything on this phone with this backup?', () => { W.replaceState(o); W.render(); W.toast('Restored'); }); })
        .catch(() => W.toast('That file isn\'t a backup'));
    } })),
    h('h2', {}, 'Reset'),
    h('button', { class: 'btn danger block', onclick: () => W.confirm('Put the stock list back to the original drinks list? Your order history is kept.', () => { W.seedStock(); W.save(); W.render(); W.toast('Stock list reset'); }) }, 'Reset stock list')
  ]);
};
})();
