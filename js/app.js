(function () {
'use strict';
const W = window.W, h = W.h;
const svg = d => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = d; return s; };
const TABS = [
  ['today', 'Today', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
  ['tasks', 'Tasks', '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'],
  ['rota', 'Rota', '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'],
  ['journal', 'Journal', '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/><path d="M9 7h7M9 11h5"/>'],
  ['clean', 'Clean', '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M19 15l.8 1.7 1.7.8-1.7.8L19 20l-.8-1.7-1.7-.8 1.7-.8z"/>'],
  ['stock', 'Stock', '<path d="M8 22h8M12 15v7M5 3h14l-1.5 7a5.5 5.5 0 0 1-11 0z"/>'],
  ['ideas', 'Ideas', '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>']
];
let cur = 'today';
W.go = tab => { location.hash = tab; };
function badge(tab) {
  const s = W.state, t = W.today();
  if (tab === 'tasks') return W.openTasks().filter(x => x.from || (x.due && x.due <= t)).length;
  if (tab === 'clean') return s.cleaning.filter(c => W.cleanOverdue(c) <= 0).length;
  if (tab === 'stock') return W.lowItems().length;
  if (tab === 'journal') return (s.journal[t] || []).filter(n => !n.sorted).length;
  return 0;
}
W.render = function () {
  cur = (location.hash || '#today').slice(1);
  if (!W.views[cur]) cur = 'today';
  const app = document.getElementById('app');
  const y = window.scrollY;
  W.views[cur](app);
  if (cur !== 'stock' && cur !== 'journal') app.append(h('button', { class: 'fab', onclick: () => {
    if (cur === 'clean') W.editClean(); else if (cur === 'ideas') W.editIdea(); else if (cur === 'rota') W.editEvent(); else W.quickAdd();
  }, 'aria-label': 'Add' }, '+'));
  W.fill(document.getElementById('nav'), TABS.map(([id, label, icon]) => {
    const n = badge(id);
    return h('a', { href: '#' + id, class: id === cur ? 'on' : '' }, svg(icon), label, n ? h('i', {}, n) : null);
  }));
  window.scrollTo(0, y);
};
let lastTab = null;
window.addEventListener('hashchange', () => { W.close(); if (cur === 'journal' && location.hash !== '#journal') W.journalDay = null; W.render(); if (cur !== lastTab) window.scrollTo(0, 0); lastTab = cur; });
// Refresh "today" if the app is left open past midnight
let day = W.today();
document.addEventListener('visibilitychange', () => { if (!document.hidden && W.today() !== day) { day = W.today(); W.render(); } });
W.render(); lastTab = cur;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
