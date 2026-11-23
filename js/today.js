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
      e.kind === 'function' && e.fd ? h('div', { class: 'fn-facts' },
        e.fd.guests ? h('span', {}, '👥 ' + e.fd.guests + ' guests') : h('span', { class: 'missing' }, '👥 Numbers?'),
        e.time ? h('span', {}, '🕒 ' + e.time) : h('span', { class: 'missing' }, '🕒 Time?'),
        (e.fd.on || []).length ? h('span', {}, '👤 ' + e.fd.on.join(', ')) : h('span', { class: 'missing' }, '👤 Who\'s on?')) : null,
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
  const pool = W.poolFor(D);
  const prep = s.events.filter(e => e.date > D && e.date <= W.addDays(D, 7)).sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1);
  const hr = new Date().getHours();
  const title = isToday ? (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + ' 👋' : W.relDay(D);

  // Coming up: next 3 days (2 weeks with Show more), not daily ones, each repeating task shown once
  const seen = new Set(items.map(i => i.task.id).concat(overdue.map(i => i.task.id)));
  const upDays = [...Array(W.upMore ? 14 : 3)].map((_, i) => W.addDays(D, i + 1)).map(d => ({
    d, items: W.dayItems(d).filter(i => i.task.repeat !== 'daily' && !W.isDone(i.task, i.occ) && !seen.has(i.task.id) && seen.add(i.task.id))
  })).filter(x => x.items.length);
  const anytime = s.tasks.filter(x => x.repeat === 'none' && !x.done && !x.date);

  const jn = (s.journal[D] || []), jOpen = jn.filter(n => !n.sorted).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  let planNote = null;
  if (!total) planNote = !W.isShift(D) && (shift && shift.off || s.tasks.some(x => x.repeat !== 'none')) ? 'Day off 🎉 No tasks today. Anything set for today moves to your next shift.' : !shift && dailyCount ? 'No shift on the rota, so no daily tasks. Tap the shift above to add one.' : 'Nothing planned yet. Add a task above.';

  const top = [
    h('div', { class: 'brand' }, h('span', { class: 'dot' }), 'Organised Hotel'),
    h('div', { class: 'info-line', onclick: () => W.editShift(D) },
      h('span', {}, W.niceDate(D)),
      h('span', {}, '⏰ ' + (shift ? W.fmtShift(shift) : 'No shift set')),
      h('span', { class: 'muted' }, (isToday ? 'Tomorrow ' : W.dayName(W.addDays(D, 1)) + ' ') + (next ? W.fmtShift(next) : '—')))];
  if (isToday && (W.closing || s.closed[t])) return closeView(app, top, items, done, total, jn, jOpen);

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

    // TO DO LIST
    h('h2', { class: 'todo-h' }, h('span', {}, 'To do list'), total ? h('span', { class: 'count' }, done + ' of ' + total) : null),
    total ? h('div', { class: 'todo-bar' }, h('i', { style: 'width:' + pct + '%' })) : null,
    h('div', { class: 'card todo' },
      isToday && total && done === total ? h('div', { class: 'all-done' }, '🎉 All done for today. Nice work!') : null,
      total ? W.planList(items) : h('div', { class: 'ov-empty' }, planNote),
      pool.length && (W.isShift(D) || !s.shifts[D]) ? h('div', { class: 'todo-foot', onclick: () => W.addToDaySheet(D) }, '📋 Add a weekly job to this day (' + pool.length + ' to plan) ›') : null),

    // WEEKLY JOBS STILL TO PLAN
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
      upDays.map(x => [h('div', { class: 'up-day' }, W.relDay(x.d) + (W.daysBetween(t, x.d) > 1 ? (W.daysBetween(t, x.d) < 7 ? ' · ' + W.shortDate(x.d) : '') : '')), x.items.map(i => W.taskRow(i))]),
      anytime.length ? [h('div', { class: 'up-day' }, 'Anytime'), anytime.map(x => W.taskRow({ task: x, occ: '' }))] : null)
      : h('div', { class: 'empty' }, W.upMore ? 'Nothing else in the next 2 weeks' : 'Nothing in the next 3 days'),
    h('button', { class: 'btn ghost small block', style: 'margin:-2px 0 6px', onclick: () => { W.upMore = !W.upMore; W.render(); } }, W.upMore ? 'Show less' : 'Show more (next 2 weeks)'),
    upDays.length ? h('p', { class: 'muted small', style: 'text-align:center' }, 'Finished today\'s plan? Tick something off early to get ahead.') : null,

    // CLOSE DAY
    isToday ? h('button', { class: 'btn ghost block close-btn', onclick: () => { W.closing = true; W.render(); window.scrollTo(0, 0); } }, '🌙 Close day') : null,

    // JOURNAL
    h('div', { class: 'card tap', style: 'margin-top:18px', onclick: () => { W.journalDay = D; W.go('journal'); } },
      h('div', { class: 'row between' }, h('div', {}, h('div', { style: 'font-weight:800' }, '📓 Journal'),
        h('div', { class: 'muted small' }, jn.length ? jn.length + ' note' + (jn.length > 1 ? 's' : '') + (jOpen ? ' · ' + jOpen + ' to sort' : ' · all sorted') : 'Jot things down as the day goes on')),
        h('span', { class: 'pill blue' }, 'Open ›')))
  );
};

/* ---------- Close day: wrap-up, then a calm closed view ---------- */
function closeView(app, top, items, done, total, jn, jOpen) {
  const s = S(), t = W.today(), tm = W.addDays(t, 1);
  let nextShiftDay = tm; for (let i = 1; i <= 14; i++) { const d = W.addDays(t, i); if (W.isShift(d)) { nextShiftDay = d; break; } }
  const nItems = W.dayItems(nextShiftDay), nEvents = W.dayEvents(nextShiftDay);
  const nextBlock = [
    W.head('Next shift · ' + W.relDay(nextShiftDay) + (W.isShift(nextShiftDay) ? ' ' + W.fmtShift(s.shifts[nextShiftDay]) : ''), null),
    W.card(nItems.length ? nItems.map(i => h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 't' }, (i.task.flag ? '🚩 ' : '') + i.task.title), i.task.time ? h('div', { class: 'sub' }, h('span', { class: 'pill time' }, i.task.time)) : null)))
      : h('div', { class: 'ov-empty' }, 'Nothing planned yet'),
      nEvents.map(e => W.eventRow(e, false)))
  ];
  if (s.closed[t]) {
    W.fill(app, top,
      h('div', { class: 'closed-card' },
        h('div', { class: 'closed-moon' }, '🌙'),
        h('div', { class: 'closed-title' }, 'Day closed'),
        h('div', { class: 'closed-sub' }, total ? done + ' of ' + total + ' tasks done' + (done === total ? ' 🎉' : '') : 'No tasks today', jn.length ? ' · ' + jn.length + ' journal note' + (jn.length > 1 ? 's' : '') : ''),
        h('button', { class: 'btn ghost small', style: 'margin-top:10px', onclick: () => { delete s.closed[t]; W.save(); W.render(); } }, 'Reopen day')),
      nextBlock);
    return;
  }
  const left = items.filter(i => !W.isDone(i.task, i.occ));
  const note = h('textarea', { placeholder: 'Anything to remember for next time?', style: 'min-height:70px' });
  W.fill(app, top,
    h('h1', {}, '🌙 Close day'),
    h('p', { class: 'muted', style: 'margin-top:-10px' }, 'Quick wrap-up before you finish.'),
    W.head('Left to do', left.length || null),
    left.length ? W.card(left.map(i => h('div', { class: 'close-row' }, W.taskRow(i),
      i.task.repeat === 'none' ? h('button', { class: 'btn ghost small', onclick: () => { i.task.date = nextShiftDay; W.save(); W.toast('Moved to ' + W.relDay(nextShiftDay).toLowerCase()); W.render(); } }, '→ ' + (nextShiftDay === tm ? 'Tomorrow' : W.dayName(nextShiftDay)))
        : h('span', { class: 'muted small', style: 'padding-right:4px' }, i.task.repeat === 'daily' ? 'drops off' : 'goes to overdue'))))
      : h('div', { class: 'card all-done' }, '🎉 Everything done today.'),
    W.head('Journal', jn.length || null),
    W.card(h('div', { class: 'muted small', style: 'padding:8px 0' }, jn.length ? (jOpen ? jOpen + ' note' + (jOpen > 1 ? 's' : '') + ' still to sort.' : 'All notes sorted.') : 'No notes today.'),
      jOpen ? h('button', { class: 'btn ghost small', style: 'margin-bottom:8px', onclick: () => { W.journalDay = t; W.go('journal'); } }, 'Sort notes ›') : null,
      note),
    nextBlock,
    h('button', { class: 'btn block', style: 'margin-top:16px', onclick: () => {
      const txt = note.value.trim();
      if (txt) { const now = new Date(); (s.journal[t] = s.journal[t] || []).push({ id: W.uid(), time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), text: txt, sorted: '' }); }
      s.closed[t] = true; W.closing = false; W.save(); W.render(); window.scrollTo(0, 0);
      W.celebrate(done === total && total ? '🌙 Day closed. All done!' : '🌙 Day closed');
    } }, '✓ Close the day'),
    h('button', { class: 'btn ghost block', onclick: () => { W.closing = false; W.render(); } }, 'Not yet'));
}

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
W.MEETINGS = [['note', 'Note'], ['m1030', '10:30 meeting'], ['m1500', '15:00 meeting'], ['ops', 'Ops meeting']];
const meetName = k => (W.MEETINGS.find(m => m[0] === k) || [0, 'Meeting'])[1];
let jMode = 'note';
W.views.journal = function (app) {
  const t = W.today(), s = S();
  const D = W.journalDay || t;
  const notes = s.journal[D] || [];
  const open = notes.filter(n => !n.sorted);
  const isMeet = jMode !== 'note';
  const box = h('textarea', { placeholder: isMeet ? 'One point per line, e.g.\nJess to restock fridges before 5\nWedding Saturday: 80 guests now\nIdea: cocktail of the week board' : 'What happened? What should you remember? e.g. "Ran out of limes by 9pm"', style: 'min-height:' + (isMeet ? 150 : 90) + 'px' });
  const stamp = () => { const now = new Date(); return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'); };
  const add = () => {
    const txt = box.value.trim(); if (!txt) return W.toast('Write something first');
    const list = (s.journal[D] = s.journal[D] || []), time = stamp();
    if (isMeet) {
      const mid = W.uid();
      txt.split('\n').map(x => x.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean).forEach(line => list.push({ id: W.uid(), time, text: line, sorted: '', meet: jMode, mid }));
      W.toast(meetName(jMode) + ' saved');
    } else { list.push({ id: W.uid(), time, text: txt, sorted: '' }); W.toast('Noted'); }
    W.save(); W.render();
  };
  const markSorted = (n, where) => { n.sorted = where; W.save(); };
  const pastDays = Object.keys(s.journal).filter(d => d !== D && (s.journal[d] || []).length).sort().reverse().slice(0, 14);

  const noteRow = n => h('div', { class: 'jnote' + (n.sorted ? ' sorted' : '') },
    h('div', { class: 'row between' }, n.meet ? h('span') : h('span', { class: 'jtime' }, n.time), n.sorted ? h('span', { class: 'pill ok' }, '✓ ' + n.sorted) : null),
    h('div', { class: 'jtext', onclick: () => {
      const ed = h('textarea', { value: n.text, style: 'min-height:140px' });
      W.sheet('Edit note', [ed, h('button', { class: 'btn block', onclick: () => { n.text = ed.value.trim() || n.text; W.save(); W.close(); W.render(); } }, 'Save'),
        n.sorted ? h('button', { class: 'btn ghost block', onclick: () => { n.sorted = ''; W.save(); W.close(); W.render(); } }, 'Mark as not sorted') : null,
        h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete this note?', () => { s.journal[D] = s.journal[D].filter(x => x.id !== n.id); W.save(); W.render(); }) }, 'Delete')]);
    } }, n.text),
    !n.sorted ? h('div', { class: 'jactions' },
      h('span', { class: 'chip', onclick: () => W.editTask(null, Object.assign(W.parseQuick(n.text.slice(0, 160)), { notes: n.text.length > 160 ? n.text : '' }), () => markSorted(n, 'Task')) }, '→ Task'),
      h('span', { class: 'chip', onclick: () => W.editTeam(null, { title: n.text.slice(0, 160) }, x => markSorted(n, 'Team' + (x.who ? ' · ' + x.who : ''))) }, '→ Team'),
      h('span', { class: 'chip', onclick: () => W.editEvent(null, null, { title: n.text.slice(0, 120) }, () => markSorted(n, 'Hotel')) }, '→ Hotel'),
      h('span', { class: 'chip', onclick: () => W.editIdea(null, { title: n.text.slice(0, 120), notes: n.text.length > 120 ? n.text : '' }, () => markSorted(n, 'Idea')) }, '→ Idea'),
      h('span', { class: 'chip', onclick: () => { markSorted(n, 'Done'); W.render(); } }, '✓ Nothing to do')) : null);

  // group meeting points under their meeting
  const plain = notes.filter(n => !n.mid), meets = [];
  notes.filter(n => n.mid).forEach(n => { let g = meets.find(x => x.mid === n.mid); if (!g) meets.push(g = { mid: n.mid, meet: n.meet, time: n.time, notes: [] }); g.notes.push(n); });
  const shareTxt = () => 'Journal: ' + W.niceDate(D) + '\n\n' + [plain.length ? plain.map(n => n.time + '  ' + n.text).join('\n') : '',
    meets.map(g => meetName(g.meet).toUpperCase() + ' (' + g.time + ')\n' + g.notes.map(n => '• ' + n.text).join('\n')).join('\n\n')].filter(Boolean).join('\n\n');

  W.fill(app,
    h('h1', {}, 'Journal'),
    h('div', { class: 'week-nav' },
      h('button', { class: 'icon-btn', onclick: () => { W.journalDay = W.addDays(D, -1); W.render(); } }, '‹'),
      h('div', { class: 'grow' }, D === t ? 'Today' : W.relDay(D), h('div', { class: 'muted small', style: 'font-weight:600' }, W.niceDate(D))),
      h('button', { class: 'icon-btn', disabled: D >= t, onclick: () => { W.journalDay = W.addDays(D, 1); W.render(); } }, '›')),

    D === t ? h('div', { class: 'card' },
      W.chips(W.MEETINGS, jMode, v => { jMode = v; W.render(); }),
      box, h('button', { class: 'btn block', onclick: add }, isMeet ? 'Save ' + meetName(jMode).toLowerCase() + ' notes' : 'Add note'),
      isMeet ? h('p', { class: 'muted small' }, 'Each line becomes its own point, so you can send each one to the right place afterwards.') : null) : null,

    plain.length || !meets.length ? [head(D === t ? 'Today\'s notes' : 'Notes', plain.length || null),
      plain.length ? card(plain.map(noteRow)) : h('div', { class: 'empty' }, D === t ? 'No notes yet today. Add things as they come up.' : 'No notes this day')] : null,

    meets.map(g => [h('h2', {}, h('span', {}, '🗣 ' + meetName(g.meet) + ' · ' + g.time), h('span', { class: 'count' }, g.notes.filter(n => !n.sorted).length ? g.notes.filter(n => !n.sorted).length + ' to sort' : '✓')),
      h('div', { class: 'card meet' }, g.notes.map(noteRow))]),

    notes.length ? h('div', { class: 'card review' },
      h('div', { style: 'font-weight:800' }, open.length ? '🌙 ' + open.length + ' point' + (open.length > 1 ? 's' : '') + ' to sort' : '🌙 All sorted. Nice work'),
      h('div', { class: 'muted small' }, open.length ? 'Send each one to where it belongs: your tasks, a team task, the hotel diary, ideas, or mark it as nothing to do.' : 'Everything from this day has been organised.'),
      h('button', { class: 'btn ghost block', onclick: () => W.share('Journal ' + W.niceDate(D), shareTxt()) }, 'Share notes')) : null,

    pastDays.length ? [head('Earlier', null), card(pastDays.map(d => {
      const ns = s.journal[d], o = ns.filter(n => !n.sorted).length, mt = [...new Set(ns.filter(n => n.meet).map(n => meetName(n.meet)))];
      return h('div', { class: 'item', style: 'cursor:pointer', onclick: () => { W.journalDay = d; W.render(); window.scrollTo(0, 0); } },
        h('div', { class: 'grow' }, h('div', { class: 't' }, W.niceDate(d)), h('div', { class: 'sub' }, ns.length + ' notes' + (mt.length ? ' · ' + mt.join(', ') : '') + (o ? ' · ' : ''), o ? h('span', { class: 'pill warn' }, o + ' to sort') : null)),
        h('span', { class: 'muted' }, '›'));
    }))] : null
  );
};
})();
