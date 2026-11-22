(function () {
'use strict';
const W = window.W, h = W.h, S = () => W.state;
const card = (...kids) => h('div', { class: 'card' }, kids);
const head = (title, n) => h('h2', {}, h('span', {}, title), n != null ? h('span', { class: 'count' }, n) : null);

W.dayEvents = D => S().events.filter(e => e.date === D).sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1);
const KIND_ICON = { function: '🥂', event: '🎉', busy: '🔥', delivery: '📦', meeting: '💬', other: '📌' };
W.eventRow = function (e, showDay) {
  return h('div', { class: 'item', style: 'cursor:pointer', onclick: () => W.editEvent(e) },
    h('div', { class: 'ev-icon' }, KIND_ICON[e.kind] || '🎉'),
    h('div', { class: 'grow' },
      h('div', { class: 't' }, e.title),
      h('div', { class: 'sub' }, h('span', { class: 'pill' + (e.kind === 'busy' ? ' warn' : '') }, W.eventKind(e.kind)),
        [showDay ? W.relDay(e.date) : null, e.time].filter(Boolean).join(' · ')),
      e.kind === 'function' && e.fd ? h('div', { class: 'sub', style: 'margin-top:4px' }, [e.fd.guests ? '👥 ' + e.fd.guests + ' guests' : null, e.fd.timings ? '🕒 ' + e.fd.timings.split('\n')[0] : null].filter(Boolean).join('  ·  ')) : null,
      e.notes ? h('div', { class: 'sub', style: 'margin-top:4px' }, '📝 ' + e.notes) : null));
};

/* =================== TODAY (scroll through days) =================== */
let viewDay = null;
W.views.today = function (app) {
  const t = W.today(), s = S();
  if (!viewDay || (viewDay < t)) viewDay = t;
  const D = viewDay, isToday = D === t;
  const shift = s.shifts[D], next = s.shifts[W.addDays(D, 1)];
  const items = W.dayItems(D);
  const total = items.length, done = items.filter(i => W.isDone(i.task, i.occ)).length;
  const dailyCount = s.tasks.filter(x => x.repeat === 'daily').length;
  const overdue = isToday ? W.overdueItems() : [];
  const team = W.openTeam().filter(x => x.date === D || (isToday && (!x.date || x.date < t)));
  const events = W.dayEvents(D);
  const prep = s.events.filter(e => e.date > D && e.date <= W.addDays(D, 7)).sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1);
  const hr = new Date().getHours();
  const title = isToday ? (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + ' 👋' : W.relDay(D);

  // Coming up: next 7 days (not daily ones), each repeating task shown once
  const seen = new Set();
  const upDays = [...Array(7)].map((_, i) => W.addDays(D, i + 1)).map(d => ({
    d, items: W.dayItems(d).filter(i => i.task.repeat !== 'daily' && !W.isDone(i.task, i.occ) && !seen.has(i.task.id) && seen.add(i.task.id))
  })).filter(x => x.items.length);
  const anytime = s.tasks.filter(x => x.repeat === 'none' && !x.done && !x.date);

  const jn = (s.journal[D] || []), jOpen = jn.filter(n => !n.sorted).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  let planNote = null;
  if (!total) planNote = !W.isShift(D) && (shift && shift.off || s.tasks.some(x => x.repeat !== 'none')) ? 'Day off 🎉 No tasks today. Anything set for today moves to your next shift.' : !shift && dailyCount ? 'No shift on the rota, so no daily tasks. Tap the shift above to add one.' : 'Nothing planned yet. Add a task above.';

  W.fill(app,
    h('div', { class: 'brand' }, h('span', { class: 'dot' }), 'Organised Hotel'),
    h('div', { class: 'info-line', onclick: () => W.editShift(D) },
      h('span', {}, W.niceDate(D)),
      h('span', {}, '⏰ ' + (shift ? W.fmtShift(shift) : 'No shift set')),
      h('span', { class: 'muted' }, (isToday ? 'Tomorrow ' : W.dayName(W.addDays(D, 1)) + ' ') + (next ? W.fmtShift(next) : '—'))),
    h('div', { class: 'day-nav' },
      h('button', { class: 'icon-btn', disabled: isToday, onclick: () => { viewDay = W.addDays(D, -1); W.render(); }, 'aria-label': 'Previous day' }, '‹'),
      h('h1', { class: 'grow' }, title),
      h('button', { class: 'icon-btn', onclick: () => { viewDay = W.addDays(D, 1); W.render(); }, 'aria-label': 'Next day' }, '›'),
      h('button', { class: 'icon-btn', onclick: W.settings, 'aria-label': 'Settings' }, '⚙')),
    !isToday ? h('button', { class: 'btn ghost small', style: 'margin:0 0 12px', onclick: () => { viewDay = t; W.render(); } }, '← Back to today') : null,

    W.quickBox(isToday ? '' : D),

    // YOUR DAY
    h('div', { class: 'overview' },
      h('div', { class: 'ov-head' },
        h('div', {}, h('div', { class: 'ov-title' }, isToday ? 'Today\'s plan' : W.DAYS_LONG[W.parse(D).getDay()] + '\'s plan'),
          h('div', { class: 'ov-sub' }, total ? done + ' of ' + total + ' done' : 'Nothing yet')),
        total ? h('div', { class: 'ov-num' }, pct + '%') : null),
      total ? h('div', { class: 'ov-bar' }, h('i', { style: 'width:' + pct + '%' })) : null,
      total ? h('div', { class: 'ov-list' }, W.planList(items)) : h('div', { class: 'ov-empty' }, planNote)),

    // FLEXIBLE JOBS THAT NEED A DAY
    isToday ? W.needsDaySection() : null,

    // OVERDUE
    overdue.length ? [W.head('Overdue', overdue.length), h('div', { class: 'card overdue' }, overdue.map(i => W.taskRow(i, { overdue: true })))] : null,

    // TEAM
    team.length ? [h('h2', {}, h('span', {}, 'Team tasks'), h('span', { class: 'count' }, team.length)), W.card(team.map(W.teamRow))] : null,

    // IN THE HOTEL
    W.head('In the hotel', events.length || null),
    events.length ? W.card(events.map(e => W.eventRow(e, false))) : h('div', { class: 'empty' }, 'Nothing special on. Add functions, events or busy days with +.'),
    prep.length ? [h('div', { class: 'sub-head' }, 'Get ready for'), W.card(prep.map(e => W.eventRow(e, true)))] : null,

    // COMING UP
    W.head('Coming up', null),
    upDays.length || anytime.length ? W.card(
      upDays.map(x => [h('div', { class: 'up-day' }, W.relDay(x.d) + (W.daysBetween(t, x.d) > 1 && W.daysBetween(t, x.d) < 7 ? ' · ' + W.shortDate(x.d) : '')), x.items.map(i => W.taskRow(i))]),
      anytime.length ? [h('div', { class: 'up-day' }, 'Anytime'), anytime.map(x => W.taskRow({ task: x, occ: '' }))] : null)
      : h('div', { class: 'empty' }, 'Nothing else in the next week'),
    upDays.length ? h('p', { class: 'muted small', style: 'text-align:center' }, 'Finished today\'s plan? Tick something off early to get ahead.') : null,

    // JOURNAL
    h('div', { class: 'card tap', style: 'margin-top:18px', onclick: () => { W.journalDay = D; W.go('journal'); } },
      h('div', { class: 'row between' }, h('div', {}, h('div', { style: 'font-weight:800' }, '📓 Journal'),
        h('div', { class: 'muted small' }, jn.length ? jn.length + ' note' + (jn.length > 1 ? 's' : '') + (jOpen ? ' · ' + jOpen + ' to sort' : ' · all sorted') : 'Jot things down as the day goes on')),
        h('span', { class: 'pill blue' }, 'Open ›')))
  );
};

// Swipe left/right on Today to change day
let sx = null, sy = null;
document.addEventListener('touchstart', e => { if (location.hash && location.hash !== '#today') return; if (e.target.closest('#modal')) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
document.addEventListener('touchend', e => {
  if (sx == null) return;
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
  if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
  const t = W.today();
  if (dx < 0) viewDay = W.addDays(viewDay || t, 1); else if ((viewDay || t) > t) viewDay = W.addDays(viewDay, -1); else return;
  W.render(); window.scrollTo(0, 0);
}, { passive: true });

/* =================== JOURNAL =================== */
W.journalDay = null;
W.views.journal = function (app) {
  const t = W.today(), s = S();
  const D = W.journalDay || t;
  const notes = s.journal[D] || [];
  const open = notes.filter(n => !n.sorted);
  const box = h('textarea', { placeholder: 'What happened? What should you remember? e.g. "Ran out of limes by 9pm", "Guest in room 12 wants a cake Friday"', style: 'min-height:90px' });
  const add = () => {
    const txt = box.value.trim(); if (!txt) return W.toast('Write something first');
    const now = new Date();
    (s.journal[D] = s.journal[D] || []).push({ id: W.uid(), time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), text: txt, sorted: '' });
    W.save(); W.render(); W.toast('Noted');
  };
  const markSorted = (n, where) => { n.sorted = where; W.save(); };
  const pastDays = Object.keys(s.journal).filter(d => d !== D && (s.journal[d] || []).length).sort().reverse().slice(0, 14);

  W.fill(app,
    h('h1', {}, 'Journal'),
    h('div', { class: 'week-nav' },
      h('button', { class: 'icon-btn', onclick: () => { W.journalDay = W.addDays(D, -1); W.render(); } }, '‹'),
      h('div', { class: 'grow' }, D === t ? 'Today' : W.relDay(D), h('div', { class: 'muted small', style: 'font-weight:600' }, W.niceDate(D))),
      h('button', { class: 'icon-btn', disabled: D >= t, onclick: () => { W.journalDay = W.addDays(D, 1); W.render(); } }, '›')),

    D === t ? h('div', { class: 'card' }, box, h('button', { class: 'btn block', onclick: add }, 'Add note')) : null,

    head(D === t ? 'Today\'s notes' : 'Notes', notes.length || null),
    notes.length ? card(notes.map(n => h('div', { class: 'jnote' + (n.sorted ? ' sorted' : '') },
      h('div', { class: 'row between' }, h('span', { class: 'jtime' }, n.time), n.sorted ? h('span', { class: 'pill ok' }, '✓ ' + n.sorted) : null),
      h('div', { class: 'jtext', onclick: () => {
        const ed = h('textarea', { value: n.text, style: 'min-height:140px' });
        W.sheet('Edit note', [ed, h('button', { class: 'btn block', onclick: () => { n.text = ed.value.trim() || n.text; W.save(); W.close(); W.render(); } }, 'Save'),
          h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete this note?', () => { s.journal[D] = s.journal[D].filter(x => x.id !== n.id); W.save(); W.render(); }) }, 'Delete')]);
      } }, n.text),
      !n.sorted ? h('div', { class: 'jactions' },
        h('span', { class: 'chip', onclick: () => W.editTask(null, Object.assign(W.parseQuick(n.text.slice(0, 160)), { notes: n.text.length > 160 ? n.text : '' }), () => markSorted(n, 'Task')) }, '→ Task'),
        h('span', { class: 'chip', onclick: () => W.editEvent(null, null, { title: n.text.slice(0, 120) }, () => markSorted(n, 'Hotel')) }, '→ Hotel'),
        h('span', { class: 'chip', onclick: () => W.editIdea(null, { title: n.text.slice(0, 120), notes: n.text.length > 120 ? n.text : '' }, () => markSorted(n, 'Idea')) }, '→ Idea'),
        h('span', { class: 'chip', onclick: () => { markSorted(n, 'Done'); W.render(); } }, '✓ Nothing to do')) : null)))
      : h('div', { class: 'empty' }, D === t ? 'No notes yet today. Add things as they come up.' : 'No notes this day'),

    notes.length ? h('div', { class: 'card review' },
      h('div', { style: 'font-weight:800' }, open.length ? '🌙 End of shift: ' + open.length + ' note' + (open.length > 1 ? 's' : '') + ' to sort' : '🌙 All sorted. Nice work'),
      h('div', { class: 'muted small' }, open.length ? 'Read back over your notes and turn each one into a task, something happening in the hotel, an idea, or mark it as nothing to do.' : 'Everything from this day has been organised.'),
      h('button', { class: 'btn ghost block', onclick: () => W.share('Journal ' + W.niceDate(D), 'Journal: ' + W.niceDate(D) + '\n\n' + notes.map(n => n.time + '  ' + n.text).join('\n')) }, 'Share notes')) : null,

    pastDays.length ? [head('Earlier', null), card(pastDays.map(d => {
      const ns = s.journal[d], o = ns.filter(n => !n.sorted).length;
      return h('div', { class: 'item', style: 'cursor:pointer', onclick: () => { W.journalDay = d; W.render(); window.scrollTo(0, 0); } },
        h('div', { class: 'grow' }, h('div', { class: 't' }, W.niceDate(d)), h('div', { class: 'sub' }, ns.length + ' notes' + (o ? ' · ' : ''), o ? h('span', { class: 'pill warn' }, o + ' to sort') : null)),
        h('span', { class: 'muted' }, '›'));
    }))] : null
  );
};
})();
