(function () {
'use strict';
const W = window.W, h = W.h, S = () => W.state;

/* =================== EDITORS =================== */
W.EVENT_KINDS = [['function', 'Function'], ['event', 'Event'], ['busy', 'Busy day'], ['delivery', 'Delivery'], ['meeting', 'Meeting'], ['other', 'Other']];
W.eventKind = k => (W.EVENT_KINDS.find(x => x[0] === k) || [0, 'Event'])[1];
W.editEvent = function (ev, date, preset, onSave) {
  const isNew = !ev;
  const d = ev ? { kind: 'event', ...ev } : Object.assign({ id: W.uid(), date: date || W.today(), time: '', title: '', notes: '', kind: 'event' }, preset || {});
  const title = h('input', { value: d.title, placeholder: 'e.g. Christmas party (40 people), big match on TV' });
  const dt = h('input', { type: 'date', value: d.date });
  const tm = h('input', { type: 'time', value: d.time });
  const notes = h('textarea', { value: d.notes, placeholder: 'Anything else to prepare: extra stock, reminders…' });
  d.fd = Object.assign({ guests: '', setup: '', timings: '', food: '', drinks: '', staff: '', contact: '' }, d.fd || {});
  const F = {};
  const fdField = (k, label, ph, big) => W.field(label, F[k] = h(big ? 'textarea' : 'input', Object.assign({ value: d.fd[k], placeholder: ph }, k === 'guests' ? { type: 'number', inputmode: 'numeric' } : {}, big ? { style: 'min-height:64px' } : {})));
  d.fd.on = (d.fd.on || []).slice();
  const whoOn = h('div');
  const drawWho = () => W.fill(whoOn,
    W.staffNames().map(n => h('span', { class: 'chip' + (d.fd.on.includes(n) ? ' on' : ''), onclick: () => { d.fd.on = d.fd.on.includes(n) ? d.fd.on.filter(x => x !== n) : d.fd.on.concat(n); drawWho(); } }, n)),
    h('div', { class: 'row', style: 'margin-top:4px' }, h('input', { placeholder: 'Add a name', id: 'new-staff' }),
      h('button', { class: 'btn ghost small', onclick: () => { const i = document.getElementById('new-staff'); const n = i.value.trim(); if (!n) return; W.addStaff(n); if (!d.fd.on.includes(n)) d.fd.on.push(n); drawWho(); } }, 'Add')));
  drawWho();
  const fn = h('div', { class: 'fn-box', style: d.kind === 'function' ? '' : 'display:none' },
    h('div', { class: 'fn-title' }, '🥂 Function details'),
    h('div', { class: 'grid2' }, fdField('guests', 'Guests', 'e.g. 60'), fdField('contact', 'Organiser / contact', 'Name, room or phone')),
    fdField('timings', 'Timings', 'e.g. 18:30 arrive, 19:00 speeches, 23:00 finish', true),
    fdField('setup', 'Set-up', 'Room, tables, glassware, decorations…', true),
    fdField('food', 'Food', 'Menu, dietary needs, when it\'s served', true),
    fdField('drinks', 'Drinks', 'Package, drinks on arrival, bar tab…', true),
    W.field('Who\'s on', whoOn),
    fdField('staff', 'Staff notes', 'Roles, extra cover, finish times…', true));
  W.sheet(isNew ? 'In the hotel' : 'Edit', [
    W.field('What', title), W.field('Type', W.chips(W.EVENT_KINDS, d.kind, v => { d.kind = v; fn.style.display = v === 'function' ? '' : 'none'; })),
    h('div', { class: 'grid2' }, W.field('Date', dt), W.field('Start time', tm)),
    fn,
    W.field('To prepare / notes', notes),
    h('button', { class: 'btn block', onclick: () => {
      if (!title.value.trim() || !dt.value) return W.toast('Add a name and date');
      Object.keys(F).forEach(k => { d.fd[k] = F[k].value.trim(); });
      Object.assign(d, { title: title.value.trim(), date: dt.value, time: tm.value, notes: notes.value.trim() });
      if (isNew) S().events.push(d); else Object.assign(ev, d);
      if (onSave) onSave(d);
      W.save(); W.close(); W.render();
    } }, 'Save'),
    !isNew && h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete this event?', () => { S().events = S().events.filter(x => x.id !== ev.id); W.save(); W.render(); }) }, 'Delete')
  ]);
};

W.editShift = function (date) {
  const cur = S().shifts[date] || {};
  const start = h('input', { type: 'time', value: cur.start || '00:00' });
  const end = h('input', { type: 'time', value: cur.end || '00:00' });
  const note = h('input', { value: cur.note || '', placeholder: 'e.g. Bar, closing, training' });
  const presets = S().settings.shiftPresets;
  const save = obj => { S().shifts[date] = obj; W.save(); W.close(); W.render(); };
  W.sheet('Shift · ' + W.niceDate(date), [
    presets.length ? W.field('Quick pick', h('div', {}, presets.map(p => h('span', { class: 'chip', onclick: () => save({ start: p.start, end: p.end, note: p.note || '' }) }, p.label)))) : null,
    h('div', { class: 'grid2' }, W.field('Start', start), W.field('Finish', end)), W.field('Note', note),
    h('button', { class: 'btn block', onclick: () => { if (!start.value || start.value === end.value) return W.toast('Set your start and finish times'); save({ start: start.value, end: end.value, note: note.value.trim() }); } }, 'Save shift'),
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

W.IDEA_CATS = ['Drinks', 'Service', 'Events', 'Marketing', 'Saving money', 'Team', 'Other'];
W.IDEA_STATUS = [['new', 'New'], ['try', 'To try'], ['doing', 'Trying'], ['done', 'Done'], ['no', 'Dropped']];
W.editIdea = function (i, preset, onSave) {
  const isNew = !i;
  const d = i ? { ...i } : Object.assign({ id: W.uid(), title: '', notes: '', cat: 'Other', status: 'new', created: W.today() }, preset || {});
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
      if (onSave) onSave(d);
      W.save(); W.close(); W.render();
    } }, 'Save'),
    !isNew && h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete this idea?', () => { S().ideas = S().ideas.filter(x => x.id !== i.id); W.save(); W.render(); }) }, 'Delete')
  ]);
  if (isNew) setTimeout(() => title.focus(), 50);
};

W.quickAdd = function () {
  const go = fn => () => { W.close(); setTimeout(fn, 10); };
  W.sheet('Add', h('div', { class: 'menu', style: 'margin-top:12px' },
    h('div', { class: 'card tap', onclick: go(() => W.editTask()) }, '✅ My task'),
    h('div', { class: 'card tap', onclick: go(() => W.editTeam()) }, '👤 Hand out a task to the team'),
    h('div', { class: 'card tap', onclick: go(() => W.editEvent()) }, '🥂 Function, event or busy day'),
    h('div', { class: 'card tap', onclick: go(() => W.go('journal')) }, '📓 Journal note'),
    h('div', { class: 'card tap', onclick: go(() => W.editShift(W.today())) }, '⏰ Shift'),
    h('div', { class: 'card tap', onclick: go(() => W.editIdea()) }, '💡 Business idea')));
};

const card = (...kids) => h('div', { class: 'card' }, kids);
const head = (title, n) => h('h2', {}, h('span', {}, title), n != null ? h('span', { class: 'count' }, n) : null);

/* =================== ROTA & EVENTS =================== */
let rotaWeek = null;
W.views.rota = function (app) {
  const s = S(), t = W.today();
  rotaWeek = rotaWeek || W.weekStart(t);
  const days = [...Array(7)].map((_, i) => W.addDays(rotaWeek, i));
  let hours = 0;
  days.forEach(d => { const sh = s.shifts[d]; if (sh && sh.start && sh.end) { let [a, b] = [sh.start, sh.end].map(x => { const [hh, mm] = x.split(':').map(Number); return hh + mm / 60; }); if (b <= a) b += 24; hours += b - a; } });
  W.fill(app,
    W.backToMore(),
    h('h1', {}, 'Rota'),
    h('div', { class: 'week-nav' },
      h('button', { class: 'icon-btn', onclick: () => { rotaWeek = W.addDays(rotaWeek, -7); W.render(); } }, '‹'),
      h('div', { class: 'grow' }, W.shortDate(days[0]) + ' – ' + W.shortDate(days[6]), h('div', { class: 'muted small', style: 'font-weight:600' }, hours ? Math.round(hours * 10) / 10 + ' hours this week' : (rotaWeek === W.weekStart(t) ? 'This week' : ''))),
      h('button', { class: 'icon-btn', onclick: () => { rotaWeek = W.addDays(rotaWeek, 7); W.render(); } }, '›')),
    rotaWeek !== W.weekStart(t) ? h('button', { class: 'btn ghost small', style: 'margin:-4px 0 12px', onclick: () => { rotaWeek = W.weekStart(t); W.render(); } }, 'Back to this week') : null,
    days.map(d => {
      const sh = s.shifts[d];
      const evs = s.events.filter(e => e.date === d).sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1);
      const due = W.dayItems(d).filter(i => i.task.repeat !== 'daily' && !W.isDone(i.task, i.occ));
      const nDaily = W.isShift(d) ? s.tasks.filter(x => x.repeat === 'daily').length : 0;
      return h('div', { class: 'day' + (d === t ? ' today' : '') },
        h('div', { class: 'day-head' },
          h('div', { class: 'day-name' }, W.dayName(d), h('span', { class: 'day-date' }, W.shortDate(d))),
          h('span', { class: 'pill' + (sh && !sh.off ? ' shift' : ''), style: 'cursor:pointer;padding:6px 12px;font-size:13px', onclick: () => W.editShift(d) }, sh ? W.fmtShift(sh) : '+ Shift')),
        sh && sh.note ? h('div', { class: 'muted small', style: 'margin-top:4px' }, sh.note) : null,
        evs.map(e => h('div', { class: 'ev', onclick: () => W.editEvent(e) }, h('b', {}, e.time || '•'), h('div', {}, e.title))),
        due.map(i => h('div', { class: 'ev', onclick: () => W.editTask(i.task, null, null, undefined, i.occ) }, h('b', {}, i.task.time || '☐'), h('div', { class: 'muted' }, (i.task.flag ? '🚩 ' : '') + i.task.title))),
        nDaily ? h('div', { class: 'muted small', style: 'margin-top:6px' }, '+ ' + nDaily + ' daily task' + (nDaily > 1 ? 's' : '')) : null,
        h('div', { style: 'margin-top:8px' }, h('span', { class: 'chip', style: 'margin:0', onclick: () => W.editEvent(null, d) }, '+ Event')));
    }),
    h('button', { class: 'btn block', onclick: W.planWeek }, '🗓 Plan my week'),
    h('button', { class: 'btn ghost block', onclick: () => {
      const prev = W.addDays(rotaWeek, -7); let n = 0;
      for (let i = 0; i < 7; i++) { const from = s.shifts[W.addDays(prev, i)]; const to = W.addDays(rotaWeek, i); if (from && !s.shifts[to]) { s.shifts[to] = { ...from }; n++; } }
      W.save(); W.render(); W.toast(n ? 'Copied ' + n + ' shifts' : 'Nothing to copy');
    } }, 'Copy last week\'s shifts into empty days')
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
    W.backToMore(),
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
    W.field('Staff', h('div', {},
      (s.staff || []).length ? s.staff.map((n, i) => h('span', { class: 'chip', onclick: () => W.confirm('Remove ' + n + ' from your staff list?', () => { s.staff.splice(i, 1); W.save(); }) }, n + '  ✕')) : h('p', { class: 'muted small' }, 'Add your team once, then just tap their names.'),
      h('div', { class: 'row', style: 'margin-top:4px' }, h('input', { placeholder: 'Name', id: 'staff-add' }), h('button', { class: 'btn small', onclick: () => { const i = document.getElementById('staff-add'); W.addStaff(i.value); W.settings(); } }, 'Add')))),
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
