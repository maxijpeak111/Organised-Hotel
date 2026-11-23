(function () {
'use strict';
const W = window.W, h = W.h, S = () => W.state;
/* Resolution: {id, title, area, contact {name, phone}, fixes: [{id, steps: [{id, text, photo}], note, worked}], log: [{date, fixId, note}], created} */
W.RES_AREAS = ['Rooms', 'Reception', 'Restaurant', 'Other'];
const R = () => { const s = S(); s.res = s.res || []; return s.res; };
const monthKey = W.today().slice(0, 7);
const thisMonth = r => (r.log || []).filter(l => l.date.slice(0, 7) === W.today().slice(0, 7)).length;
const sortedFixes = r => r.fixes.slice().sort((a, b) => (b.worked || 0) - (a.worked || 0));
const newFix = () => ({ id: W.uid(), steps: [{ id: W.uid(), text: '', photo: '' }], note: '', worked: 0 });

// The four problems the owner named: titles and areas only — he writes the steps.
(function seed() {
  const s = S();
  if (s.resV) return;
  s.res = s.res || [];
  [['TV Chromecast not working', 'Other'], ['Guest key card won\'t open room door', 'Rooms'], ['Room sockets have no power', 'Rooms'], ['Blocked sink', 'Other']]
    .forEach(([title, area]) => s.res.push({ id: W.uid(), title, area, contact: { name: '', phone: '' }, fixes: [{ id: W.uid(), steps: [], note: '', worked: 0 }], log: [], created: W.today() }));
  s.resV = 1; W.save();
})();

// Shrink a photo so lots fit on the phone
function readPhoto(file, cb) {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 900, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => W.toast('Couldn\'t read that photo');
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}

/* ============ LIST ============ */
let q = '', areaF = null;
W.resOpen = null; let fixIdx = 0;
W.views.res = function (app) {
  if (W.resOpen) { const r = R().find(x => x.id === W.resOpen); if (r) return detail(app, r); W.resOpen = null; }
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = r => (r.title + ' ' + r.area + ' ' + r.fixes.map(f => f.steps.map(s => s.text).join(' ') + ' ' + f.note).join(' ')).toLowerCase();
  const list = R().filter(r => (!areaF || r.area === areaF) && words.every(w => hay(r).includes(w)))
    .sort((a, b) => thisMonth(b) - thisMonth(a) || (b.log || []).length - (a.log || []).length || a.title.localeCompare(b.title));
  const search = h('input', { type: 'search', placeholder: 'What\'s the problem? e.g. chromecast', value: q, oninput: e => {
    q = e.target.value; const pos = e.target.selectionStart; W.render();
    const el = document.querySelector('#app input[type=search]'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (er) { /* ignore */ } }
  } });
  W.fill(app,
    W.backToMore(),
    h('h1', {}, 'Resolutions'),
    search,
    h('div', { style: 'margin-top:10px' }, W.RES_AREAS.map(a => h('span', { class: 'chip' + (areaF === a ? ' on' : ''), onclick: () => { areaF = areaF === a ? null : a; W.render(); } }, a))),
    list.length ? W.card(list.map(r => {
      const n = thisMonth(r), steps = r.fixes.reduce((x, f) => x + f.steps.length, 0);
      return h('div', { class: 'item', style: 'cursor:pointer', onclick: () => { W.resOpen = r.id; fixIdx = 0; W.render(); window.scrollTo(0, 0); } },
        h('div', { class: 'grow' }, h('div', { class: 't' }, r.title),
          h('div', { class: 'sub' }, h('span', { class: 'pill' }, r.area), steps ? r.fixes.length + ' fix' + (r.fixes.length > 1 ? 'es' : '') : h('span', { class: 'pill warn' }, 'Add the steps'))),
        n ? h('span', { class: 'pill warn' }, n + '× this month') : h('span', { class: 'muted' }, '›'));
    })) : h('div', { class: 'empty' }, q ? 'Nothing matches "' + q + '". Add it once you\'ve fixed it.' : 'No resolutions yet'),
    h('button', { class: 'btn block', onclick: () => W.editRes(null, q ? { title: q.charAt(0).toUpperCase() + q.slice(1) } : null) }, '+ New resolution')
  );
};

/* ============ DETAIL ============ */
function detail(app, r) {
  const fixes = sortedFixes(r);
  if (fixIdx >= fixes.length) fixIdx = 0;
  const f = fixes[fixIdx];
  const log = (r.log || []).slice().sort((a, b) => a.date < b.date ? 1 : -1);
  const n = thisMonth(r);
  const fixNo = id => sortedFixes(r).findIndex(x => x.id === id) + 1;
  const byFix = {}; (r.log || []).forEach(l => { byFix[l.fixId] = (byFix[l.fixId] || 0) + 1; });
  const hasSteps = f && (f.steps.length || f.note);
  W.fill(app,
    h('a', { class: 'back', href: '#res', onclick: e => { e.preventDefault(); W.resOpen = null; W.render(); window.scrollTo(0, 0); } }, '‹ Resolutions'),
    h('div', { class: 'top' }, h('h1', {}, r.title), h('button', { class: 'btn ghost small', style: 'margin-top:12px', onclick: () => W.editRes(r) }, 'Edit')),
    h('div', { style: 'margin:-10px 0 12px' }, h('span', { class: 'pill' }, r.area)),
    r.contact && r.contact.phone ? h('a', { class: 'btn ghost block call-btn', href: 'tel:' + r.contact.phone.replace(/[^\d+]/g, '') }, '📞 Call ' + (r.contact.name || '') + ' ' + r.contact.phone) : null,
    hasSteps ? h('div', { class: 'card fix-card' },
      h('div', { class: 'row between' }, h('div', { class: 'fix-head' }, fixes.length > 1 ? 'Fix ' + (fixIdx + 1) + ' of ' + fixes.length : 'How to fix it'),
        f.worked ? h('span', { class: 'pill ok' }, 'Worked ' + f.worked + '×') : null),
      f.steps.map((st, i) => h('div', { class: 'res-step' }, h('span', { class: 'res-n' }, String(i + 1)),
        h('div', { class: 'grow' }, h('div', {}, st.text), st.photo ? h('img', { class: 'res-photo', src: st.photo, alt: 'Photo for step ' + (i + 1), onclick: () => W.sheet('Step ' + (i + 1), h('img', { src: st.photo, style: 'width:100%;border-radius:12px;margin-top:10px' })) }) : null))),
      f.note ? h('div', { class: 'res-note' }, '📝 ' + f.note) : null)
      : h('div', { class: 'empty' }, 'No steps yet. Next time you fix it, tap Edit and write down what you did.'),
    hasSteps ? h('div', { class: 'grid2' },
      h('button', { class: 'btn', style: 'background:var(--ok)', onclick: () => worked(r, f) }, '✓ That worked'),
      fixes.length > 1 ? h('button', { class: 'btn ghost', onclick: () => { fixIdx = (fixIdx + 1) % fixes.length; W.render(); window.scrollTo(0, 0); } }, fixIdx + 1 < fixes.length ? 'Try fix ' + (fixIdx + 2) : 'Back to fix 1')
        : h('button', { class: 'btn ghost', onclick: () => W.editRes(r, null, true) }, '+ Another way')) : null,

    h('h2', {}, h('span', {}, 'History'), log.length ? h('span', { class: 'count' }, log.length) : null),
    log.length ? [
      h('div', { class: 'card' }, h('div', { style: 'font-weight:800;color:var(--brown)' }, n + ' time' + (n === 1 ? '' : 's') + ' this month'),
        fixes.length > 1 ? h('div', { class: 'muted small' }, fixes.map((x, i) => 'Fix ' + (i + 1) + ' worked ' + (byFix[x.id] || 0) + '×').join(' · ')) : null),
      W.card(log.slice(0, 12).map(l => h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 't' }, W.niceDate(l.date)),
        h('div', { class: 'sub' }, fixes.length > 1 ? 'Fix ' + fixNo(l.fixId) : 'Fixed', l.note ? ' · ' + l.note : '')),
        h('button', { class: 'del', 'aria-label': 'Delete', onclick: () => W.confirm('Remove this from the history?', () => { r.log = r.log.filter(x => x !== l); const fx = r.fixes.find(x => x.id === l.fixId); if (fx) fx.worked = Math.max(0, (fx.worked || 0) - 1); W.save(); W.render(); }) }, '✕')))),
      h('button', { class: 'btn ghost block', onclick: () => shareReport(r) }, 'Share report')
    ] : h('p', { class: 'muted small' }, 'Each time you tap "That worked", it\'s logged here, so you can see how often it goes wrong.')
  );
}
function worked(r, f) {
  const note = h('input', { placeholder: 'Optional note, e.g. room 12' });
  W.sheet('Nice one', [
    h('p', { class: 'muted' }, 'This gets logged in the history.'),
    W.field('Note', note),
    h('button', { class: 'btn block', onclick: () => {
      r.log = r.log || []; r.log.push({ date: W.today(), fixId: f.id, note: note.value.trim() });
      f.worked = (f.worked || 0) + 1; fixIdx = 0; W.save(); W.close(); W.render(); W.toast('Logged ✓');
    } }, 'Save')
  ]);
}
function shareReport(r) {
  const log = (r.log || []).slice().sort((a, b) => a.date < b.date ? 1 : -1);
  const months = {}; log.forEach(l => { const k = W.parse(l.date).toLocaleString('en-GB', { month: 'long', year: 'numeric' }); months[k] = (months[k] || 0) + 1; });
  const txt = r.title + ' – how often it\'s happened\n\n' + Object.keys(months).map(k => k + ': ' + months[k] + ' time' + (months[k] > 1 ? 's' : '')).join('\n') + '\n\nDates:\n' + log.map(l => '• ' + W.niceDate(l.date) + (l.note ? ' (' + l.note + ')' : '')).join('\n');
  W.share(r.title, txt);
}

/* ============ EDITOR ============ */
// addFix: jump straight to adding another way
W.editRes = function (r, preset, addFix, onSave) {
  const isNew = !r;
  const d = r ? JSON.parse(JSON.stringify(r)) : Object.assign({ id: W.uid(), title: '', area: null, contact: { name: '', phone: '' }, fixes: [newFix()], log: [], created: W.today() }, preset || {});
  d.contact = d.contact || { name: '', phone: '' };
  if (!d.fixes.length) d.fixes.push(newFix());
  if (addFix) d.fixes.push(newFix());
  const title = h('input', { value: d.title, placeholder: 'e.g. Blocked sink' });
  const cName = h('input', { value: d.contact.name, placeholder: 'Who (optional), e.g. Maintenance' });
  const cPhone = h('input', { type: 'tel', value: d.contact.phone, placeholder: 'Number (optional)' });
  const fixesBox = h('div');
  const draw = () => W.fill(fixesBox, d.fixes.map((f, fi) => h('div', { class: 'fix-edit' },
    h('div', { class: 'row between' }, h('div', { class: 'fix-head' }, d.fixes.length > 1 ? 'Fix ' + (fi + 1) : 'Steps'),
      d.fixes.length > 1 ? h('button', { class: 'link-btn', style: 'color:var(--bad)', onclick: () => W.confirm('Remove fix ' + (fi + 1) + '?', () => { d.fixes.splice(fi, 1); draw(); }) }, 'Remove fix') : null),
    f.steps.map((st, si) => h('div', { class: 'step-edit' },
      h('span', { class: 'res-n' }, String(si + 1)),
      h('div', { class: 'grow' },
        h('textarea', { value: st.text, placeholder: si === 0 ? 'e.g. Turn the water off under the sink' : 'Next step', style: 'min-height:54px', oninput: e => { st.text = e.target.value; } }),
        st.photo ? h('div', { class: 'row', style: 'margin-top:6px' }, h('img', { class: 'res-photo small', src: st.photo, alt: '' }), h('button', { class: 'link-btn', style: 'color:var(--bad)', onclick: () => { st.photo = ''; draw(); } }, 'Remove photo')) : null,
        h('div', { class: 'row', style: 'gap:4px;margin-top:4px;flex-wrap:wrap' },
          h('label', { class: 'link-btn' }, st.photo ? '📷 Change photo' : '📷 Add photo', h('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: e => { const file = e.target.files[0]; if (file) readPhoto(file, url => { st.photo = url; draw(); }); } })),
          si > 0 ? h('button', { class: 'link-btn', onclick: () => { f.steps.splice(si - 1, 0, f.steps.splice(si, 1)[0]); draw(); } }, '↑ Up') : null,
          si < f.steps.length - 1 ? h('button', { class: 'link-btn', onclick: () => { f.steps.splice(si + 1, 0, f.steps.splice(si, 1)[0]); draw(); } }, '↓ Down') : null,
          h('button', { class: 'link-btn', style: 'color:var(--bad)', onclick: () => { f.steps.splice(si, 1); draw(); } }, 'Delete'))))),
    h('button', { class: 'btn ghost small', style: 'margin-top:8px', onclick: () => { f.steps.push({ id: W.uid(), text: '', photo: '' }); draw(); setTimeout(() => { const tas = fixesBox.querySelectorAll('.fix-edit')[fi].querySelectorAll('textarea'); if (tas.length) tas[tas.length - 1].focus(); }, 30); } }, '+ Add step'),
    W.field('Note (optional)', h('textarea', { value: f.note, placeholder: 'Anything else worth knowing', style: 'min-height:54px', oninput: e => { f.note = e.target.value; } })))),
    h('button', { class: 'btn ghost block', onclick: () => { d.fixes.push(newFix()); draw(); } }, '+ Another way to fix it'));
  d.fixes.forEach(f => { if (!f.steps.length) f.steps.push({ id: W.uid(), text: '', photo: '' }); });
  draw();
  W.sheet(isNew ? 'New resolution' : 'Edit resolution', [
    W.field('Problem', title),
    W.field('Area', W.chips(W.RES_AREAS.map(a => [a, a]), d.area, v => { d.area = v; })),
    fixesBox,
    W.field('Who to call if it doesn\'t work', h('div', { class: 'grid2' }, cName, cPhone)),
    h('button', { class: 'btn block', onclick: () => {
      if (!title.value.trim()) return W.toast('Name the problem');
      if (!d.area) return W.toast('Choose an area');
      d.title = title.value.trim(); d.contact = { name: cName.value.trim(), phone: cPhone.value.trim() };
      d.fixes.forEach(f => { f.steps = f.steps.filter(s => s.text.trim() || s.photo).map(s => ({ ...s, text: s.text.trim() })); f.note = (f.note || '').trim(); });
      d.fixes = d.fixes.filter((f, i) => f.steps.length || f.note || i === 0);
      if (isNew) R().push(d); else Object.assign(r, d);
      if (onSave) onSave(d);
      if (!W.save()) return;
      W.close(); if (isNew) { W.resOpen = d.id; fixIdx = 0; W.go('res'); } W.render();
    } }, 'Save'),
    !isNew ? h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete "' + r.title + '" and its history?', () => { S().res = R().filter(x => x.id !== r.id); W.resOpen = null; W.save(); W.render(); }) }, 'Delete resolution') : null
  ]);
};
void monthKey;
})();
