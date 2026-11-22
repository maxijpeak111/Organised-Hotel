(function () {
'use strict';
const W = window.W = { views: {} };

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, '0');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
W.DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
W.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
W.dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
W.today = () => W.dstr(new Date());
W.parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
W.addDays = (s, n) => { const d = W.parse(s); d.setDate(d.getDate() + n); return W.dstr(d); };
W.weekStart = s => { const d = W.parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return W.dstr(d); };
W.dayName = s => DAYS[W.parse(s).getDay()];
W.niceDate = s => { const d = W.parse(s); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
W.shortDate = s => { const d = W.parse(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
W.daysBetween = (a, b) => Math.round((W.parse(b) - W.parse(a)) / 86400000);
W.relDay = s => {
  const n = W.daysBetween(W.today(), s);
  if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday';
  if (n < 0) return Math.abs(n) + ' days ago';
  if (n < 7) return W.DAYS_LONG[W.parse(s).getDay()];
  return W.niceDate(s);
};

/* ---------- state (saved on this phone only) ---------- */
const KEY = 'work.v1';
function defaults() {
  return {
    v: 1,
    settings: { orderDay: 1, shiftPresets: [] },
    tasks: [],      // {id, title, notes, from, due, done, doneAt, created}
    shifts: {},     // date -> {start, end, note}
    events: [],     // {id, date, time, title, notes}
    cleaning: [],   // {id, title, area, every, last}
    stock: null,    // [{id, name, items:[{id, name, low}]}]
    orders: [],     // {id, date, items:[name]}
    ideas: [],      // {id, title, notes, cat, status, created}
    journal: {},    // date -> [{id, time, text, sorted}]
    team: []        // tasks handed out to staff (see tasks.js)
  };
}
function load() {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const o = JSON.parse(raw); return Object.assign(d, o, { settings: Object.assign(d.settings, o.settings || {}) }); }
  } catch (e) { console.warn('load failed', e); }
  return d;
}
W.state = load();
W.seedStock = () => {
  W.state.stock = (window.W_STOCK_DEFAULT || []).map(([name, items]) => ({ id: W.uid(), name, items: items.map(n => ({ id: W.uid(), name: n, low: false })) }));
};
if (!W.state.stock) W.seedStock();
W.save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(W.state)); return true; }
  catch (e) { alert('Could not save. Storage may be full or blocked in this browser.'); return false; }
};
W.replaceState = obj => { const d = defaults(); W.state = Object.assign(d, obj, { settings: Object.assign(d.settings, obj.settings || {}) }); if (!W.state.stock) W.seedStock(); if (W.migrate) W.migrate(); W.save(); };
W.save();
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }

/* ---------- tiny DOM helper (text is always text, never HTML) ---------- */
const PROPS = new Set(['value', 'checked', 'selected', 'disabled']);
W.h = function (tag, props, ...kids) {
  const el = document.createElement(tag);
  const later = [];
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) later.push([k, v]);
    else el.setAttribute(k, v === true ? '' : v);
  }
  W.append(el, kids);
  for (const [k, v] of later) el[k] = v;
  return el;
};
W.append = (el, kids) => { kids.flat(Infinity).forEach(k => { if (k == null || k === false) return; el.append(k.nodeType ? k : document.createTextNode(String(k))); }); return el; };
W.fill = (el, ...kids) => { el.replaceChildren(); return W.append(el, kids); };
const h = W.h;

/* ---------- sheets, toasts ---------- */
W.close = () => { W.fill(document.getElementById('modal')); };
W.sheet = function (title, content) {
  const m = document.getElementById('modal');
  const body = h('div', { class: 'sheet-body' }, content);
  W.fill(m, h('div', { class: 'backdrop', onclick: W.close }),
    h('div', { class: 'sheet' }, h('div', { class: 'sheet-head' }, h('span', {}, title), h('button', { class: 'x', onclick: W.close }, '✕')), body));
  return body;
};
W.confirm = (msg, yes) => {
  W.sheet('Are you sure?', h('div', {}, h('p', {}, msg),
    h('button', { class: 'btn block', onclick: () => { W.close(); yes(); } }, 'Yes'),
    h('button', { class: 'btn ghost block', onclick: W.close }, 'Cancel')));
};
W.toast = m => { document.querySelectorAll('.toast').forEach(x => x.remove()); const t = h('div', { class: 'toast' }, m); document.body.append(t); setTimeout(() => t.remove(), 1700); };
W.share = async (title, text) => {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); W.toast('Copied'); }
  catch (e) { W.sheet(title, h('textarea', { style: 'min-height:300px', value: text })); }
};

/* ---------- form helpers ---------- */
W.field = (label, input) => h('div', {}, h('label', { class: 'f' }, label), input);
W.chips = (opts, cur, onPick) => {
  const wrap = h('div', { style: 'margin-top:4px' });
  const draw = v => W.fill(wrap, opts.map(([val, lab]) => h('span', { class: 'chip' + (val === v ? ' on' : ''), onclick: () => { onPick(val); draw(val); } }, lab)));
  draw(cur);
  return wrap;
};
W.seg = (opts, cur, onPick) => h('div', { class: 'seg' }, opts.map(([v, l]) => h('button', { class: v === cur ? 'on' : '', onclick: () => onPick(v) }, l)));

/* ---------- shared logic ---------- */
W.cleanDue = c => c.last ? W.addDays(c.last, Number(c.every) || 1) : W.today();
// Is cleaning job c due on date D? (overdue jobs count as due today; repeats every N days after that)
W.cleanOn = (c, D) => { const t = W.today(); let d0 = W.cleanDue(c); if (d0 < t) d0 = t; if (D < d0) return false; return W.daysBetween(d0, D) % (Number(c.every) || 1) === 0; };
W.cleanOverdue = c => W.daysBetween(W.today(), W.cleanDue(c)); // <0 overdue, 0 due today
W.lowItems = () => W.state.stock.flatMap(s => s.items.filter(i => i.low).map(i => ({ ...i, section: s.name })));
W.nextOrderDate = () => { const t = W.today(); const diff = (Number(W.state.settings.orderDay) - W.parse(t).getDay() + 7) % 7; return W.addDays(t, diff); };
W.fmtShift = s => s ? (s.off ? 'Off' : ((s.start || '?') + '–' + (s.end || '?'))) : '';
})();
