(function () {
'use strict';
const W = window.W, h = W.h, S = () => W.state;
const M = () => { const s = S(); s.money = s.money || { perReview: 5, goal: null, days: {} }; s.money.days = s.money.days || {}; return s.money; };
const gbp = n => '£' + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0);
const dayTotal = e => (Number(e.reviews) || 0) * (Number(M().perReview) || 0) + (Number(e.tips) || 0);
const sumRange = (a, b, f) => Object.keys(M().days).filter(d => d >= a && d <= b).reduce((x, d) => x + f(M().days[d]), 0);
const monthStart = D => D.slice(0, 8) + '01';
const monthEnd = D => { const d = W.parse(D); return W.dstr(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };

W.backToMore = () => h('a', { class: 'back', href: '#more' }, '‹ More');

/* ============ MORE TAB ============ */
W.views.more = function (app) {
  const m = M(), t = W.today();
  const g = m.goal;
  let moneySub = 'Track your 5★ bonus and tips';
  if (g) { const [a, b] = g.period === 'week' ? [W.weekStart(t), W.addDays(W.weekStart(t), 6)] : [monthStart(t), monthEnd(t)]; moneySub = gbp(sumRange(a, b, dayTotal)) + ' of ' + gbp(g.amount) + ' this ' + g.period; }
  const item = (href, icon, title, sub, soon) => h(soon ? 'div' : 'a', { class: 'card more-item' + (soon ? ' soon' : ''), href: soon ? null : href },
    h('span', { class: 'more-icon' }, icon), h('div', { class: 'grow' }, h('div', { class: 't' }, title), h('div', { class: 'muted small' }, sub)), soon ? h('span', { class: 'pill' }, 'Soon') : h('span', { class: 'muted' }, '›'));
  W.fill(app,
    h('h1', {}, 'More'),
    item('#money', '💷', 'Tips & bonus', moneySub),
    item('#rota', '📅', 'Rota', 'Your shifts and what\'s on each day'),
    item('#ideas', '💡', 'Ideas', 'Ways to improve the business'),
    item('', '🛠', 'Resolutions', 'How to fix things that keep going wrong', true)
  );
};

/* ============ TIPS & BONUS ============ */
let logDay = null;
W.views.money = function (app) {
  const m = M(), t = W.today();
  logDay = logDay || t;
  const e = m.days[logDay] || { reviews: 0, tips: '' };
  let reviews = Number(e.reviews) || 0;

  // goal progress
  const g = m.goal;
  let goalCard;
  if (g) {
    const [a, b] = g.period === 'week' ? [W.weekStart(t), W.addDays(W.weekStart(t), 6)] : [monthStart(t), monthEnd(t)];
    const tot = sumRange(a, b, dayTotal), rev = sumRange(a, b, x => (Number(x.reviews) || 0) * (Number(m.perReview) || 0)), tips = sumRange(a, b, x => Number(x.tips) || 0);
    const pct = Math.min(100, Math.round(tot / g.amount * 100)), left = Math.max(0, g.amount - tot), daysLeft = W.daysBetween(t, b);
    goalCard = h('div', { class: 'card money-goal' },
      h('div', { class: 'row between' }, h('div', { class: 'muted small' }, 'This ' + g.period + '\'s goal'), h('button', { class: 'link-btn', onclick: setGoal }, 'Change')),
      h('div', { class: 'money-big' }, gbp(tot), h('span', { class: 'muted', style: 'font-size:18px;font-weight:700' }, ' of ' + gbp(g.amount))),
      h('div', { class: 'money-bar' }, h('i', { style: 'width:' + pct + '%' })),
      h('div', { class: 'row between small', style: 'margin-top:8px' },
        h('span', { style: 'font-weight:700;color:var(--brown)' }, tot >= g.amount ? '🎉 Goal reached!' : gbp(left) + ' to go'),
        h('span', { class: 'muted' }, daysLeft > 0 ? daysLeft + ' day' + (daysLeft > 1 ? 's' : '') + ' left' : 'Last day')),
      h('div', { class: 'money-split' }, h('span', {}, '⭐ Bonus ' + gbp(rev)), h('span', {}, '💷 Tips ' + gbp(tips))));
  } else {
    goalCard = h('div', { class: 'card money-goal' }, h('div', { style: 'font-weight:800;color:var(--brown)' }, 'Set a goal'),
      h('p', { class: 'muted small' }, 'Choose how much you\'d like to make from your bonus and tips each week or month.'),
      h('button', { class: 'btn block', onclick: setGoal }, 'Set goal'));
  }

  // weekly stats (last 8 weeks that have something logged)
  const ws = W.weekStart(t);
  const weeks = [...Array(8)].map((_, i) => W.addDays(ws, -7 * i)).map(w => ({ w, tot: sumRange(w, W.addDays(w, 6), dayTotal), tips: sumRange(w, W.addDays(w, 6), x => Number(x.tips) || 0), rev: sumRange(w, W.addDays(w, 6), x => Number(x.reviews) || 0), any: Object.keys(m.days).some(d => d >= w && d <= W.addDays(w, 6)) }));
  const used = weeks.filter(x => x.any);
  const avg = f => used.length ? used.reduce((a, x) => a + f(x), 0) / used.length : 0;
  const best = used.reduce((a, x) => x.tot > a.tot ? x : a, { tot: 0 });
  const thisWeek = weeks[0];

  // log form
  const revOut = h('span', { class: 'stepper-val' }, String(reviews));
  const tipsIn = h('input', { type: 'number', inputmode: 'decimal', min: 0, step: '0.01', placeholder: '£0', value: e.tips === '' || e.tips == null ? '' : e.tips });
  const totOut = h('span', {});
  const upd = () => { revOut.textContent = reviews; totOut.textContent = 'Day total ' + gbp(reviews * (Number(m.perReview) || 0) + (Number(tipsIn.value) || 0)); };
  tipsIn.addEventListener('input', upd); upd();

  const recent = Object.keys(m.days).sort().reverse().slice(0, 10);
  W.fill(app,
    W.backToMore(),
    h('h1', {}, 'Tips & bonus'),
    goalCard,
    h('h2', {}, h('span', {}, 'Log a day')),
    h('div', { class: 'card' },
      h('div', { class: 'row between', style: 'margin:6px 0 4px' }, h('button', { class: 'icon-btn', style: 'margin:0', onclick: () => { logDay = W.addDays(logDay, -1); W.render(); } }, '‹'),
        h('div', { style: 'font-weight:800;text-align:center' }, W.relDay(logDay), h('div', { class: 'muted small' }, W.niceDate(logDay))),
        h('button', { class: 'icon-btn', style: 'margin:0', disabled: logDay >= t, onclick: () => { logDay = W.addDays(logDay, 1); W.render(); } }, '›')),
      W.field('5★ reviews (' + gbp(Number(m.perReview) || 0) + ' each)', h('div', { class: 'stepper' },
        h('button', { class: 'icon-btn', onclick: () => { reviews = Math.max(0, reviews - 1); upd(); } }, '−'), revOut,
        h('button', { class: 'icon-btn', onclick: () => { reviews++; upd(); } }, '+'))),
      W.field('Cash / card tips', tipsIn),
      h('div', { class: 'muted small', style: 'margin-top:8px;font-weight:700' }, totOut),
      h('button', { class: 'btn block', onclick: () => {
        const tv = tipsIn.value === '' ? '' : Math.max(0, Number(tipsIn.value) || 0);
        if (!reviews && tv === '') { delete m.days[logDay]; } else m.days[logDay] = { reviews, tips: tv };
        W.save(); W.toast('Saved'); W.render();
      } }, 'Save')),
    h('h2', {}, h('span', {}, 'Your numbers')),
    h('div', { class: 'stat-grid' },
      stat('This week', gbp(thisWeek.tot), thisWeek.rev + ' review' + (thisWeek.rev === 1 ? '' : 's') + ' · ' + gbp(thisWeek.tips) + ' tips'),
      stat('Avg per week', gbp(avg(x => x.tot)), used.length ? 'over ' + used.length + ' week' + (used.length > 1 ? 's' : '') : 'log a few days'),
      stat('Avg tips / week', gbp(avg(x => x.tips)), 'cash and card'),
      stat('Avg 5★ / week', String(Math.round(avg(x => x.rev) * 10) / 10), best.tot ? 'best week ' + gbp(best.tot) : '')),
    recent.length ? [h('h2', {}, h('span', {}, 'Recent days')), W.card(recent.map(d => { const x = m.days[d]; return h('div', { class: 'item', style: 'cursor:pointer', onclick: () => { logDay = d; W.render(); window.scrollTo(0, 0); } },
      h('div', { class: 'grow' }, h('div', { class: 't' }, W.niceDate(d)), h('div', { class: 'sub' }, '⭐ ' + (x.reviews || 0) + '  ·  💷 ' + gbp(Number(x.tips) || 0))),
      h('b', { style: 'color:var(--brown)' }, gbp(dayTotal(x)))); }))] : null,
    h('p', { class: 'muted small', style: 'text-align:center;margin-top:14px' }, 'Bonus per 5★ review: ' + gbp(Number(m.perReview) || 0) + ' · ', h('button', { class: 'link-btn', onclick: setRate }, 'change'))
  );
  function stat(label, big, sub) { return h('div', { class: 'stat' }, h('div', { class: 'muted small' }, label), h('div', { class: 'stat-big' }, big), sub ? h('div', { class: 'muted small' }, sub) : null); }
};
function setGoal() {
  const m = M(); const cur = m.goal || {};
  let period = cur.period || null;
  const amt = h('input', { type: 'number', inputmode: 'decimal', min: 1, placeholder: 'e.g. 300', value: cur.amount || '' });
  W.sheet('Your goal', [
    W.field('How much (£)', amt),
    W.field('Per', W.chips([['week', 'Week'], ['month', 'Month']], period, v => { period = v; })),
    h('button', { class: 'btn block', onclick: () => {
      const a = Number(amt.value); if (!(a > 0)) return W.toast('Enter an amount'); if (!period) return W.toast('Choose week or month');
      m.goal = { amount: a, period }; W.save(); W.close(); W.render();
    } }, 'Save goal'),
    m.goal ? h('button', { class: 'btn danger block', onclick: () => { m.goal = null; W.save(); W.close(); W.render(); } }, 'Remove goal') : null
  ]);
}
function setRate() {
  const m = M();
  const r = h('input', { type: 'number', inputmode: 'decimal', min: 0, step: '0.5', value: m.perReview });
  W.sheet('Bonus per 5★ review', [W.field('£ per review', r), h('button', { class: 'btn block', onclick: () => { m.perReview = Math.max(0, Number(r.value) || 0); W.save(); W.close(); W.render(); } }, 'Save')]);
}
})();
