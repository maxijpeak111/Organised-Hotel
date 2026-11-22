(function () {
'use strict';
const W = window.W, h = W.h, S = () => W.state;

let editing = false, search = '';
const openSecs = new Set();

// How often each item has been on recent orders (last 6).
function history() {
  const recent = S().orders.slice(-6), map = {};
  recent.forEach(o => o.items.forEach(n => { map[n] = (map[n] || 0) + 1; }));
  const last = {};
  S().orders.forEach(o => o.items.forEach(n => { last[n] = o.date; }));
  return { n: recent.length, map, last };
}

function orderText() {
  const lines = ['Drinks order – ' + W.niceDate(W.today()), ''];
  S().stock.forEach(sec => { const low = sec.items.filter(i => i.low); if (low.length) { lines.push(sec.name.toUpperCase()); low.forEach(i => lines.push('☐ ' + i.name)); lines.push(''); } });
  return lines.join('\n').trim();
}

function editItem(sec, it) {
  const name = h('input', { value: it ? it.name : '', placeholder: 'Drink name' });
  const move = h('select', {}, S().stock.map(s => h('option', { value: s.id, selected: s.id === sec.id }, s.name)));
  W.sheet(it ? 'Edit item' : 'Add to ' + sec.name, [
    W.field('Name', name), it ? W.field('Section', move) : null,
    h('button', { class: 'btn block', onclick: () => {
      const n = name.value.trim(); if (!n) return W.toast('Add a name');
      if (!it) { sec.items.push({ id: W.uid(), name: n, low: false }); }
      else {
        it.name = n;
        if (move.value !== sec.id) { sec.items = sec.items.filter(x => x.id !== it.id); S().stock.find(s => s.id === move.value).items.push(it); }
      }
      S().stock.forEach(s => s.items.sort((a, b) => a.name.localeCompare(b.name)));
      W.save(); W.close(); W.render();
    } }, 'Save'),
    it ? h('button', { class: 'btn danger block', onclick: () => W.confirm('Remove ' + it.name + ' from the list?', () => { sec.items = sec.items.filter(x => x.id !== it.id); W.save(); W.render(); }) }, 'Remove item') : null
  ]);
  setTimeout(() => name.focus(), 50);
}

function editSection(sec) {
  const name = h('input', { value: sec ? sec.name : '', placeholder: 'e.g. Snacks, Glassware, Cleaning supplies' });
  W.sheet(sec ? 'Edit section' : 'New section', [
    W.field('Section name', name),
    h('button', { class: 'btn block', onclick: () => {
      const n = name.value.trim(); if (!n) return W.toast('Add a name');
      if (sec) sec.name = n; else { const s = { id: W.uid(), name: n, items: [] }; S().stock.push(s); openSecs.add(s.id); }
      W.save(); W.close(); W.render();
    } }, 'Save'),
    sec ? h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete the ' + sec.name + ' section and its ' + sec.items.length + ' items?', () => { S().stock = S().stock.filter(x => x.id !== sec.id); W.save(); W.render(); }) }, 'Delete section') : null
  ]);
}

function showOrder(o) {
  W.sheet('Order · ' + W.niceDate(o.date), [
    h('p', { class: 'muted' }, o.items.length + ' items'),
    h('div', { class: 'card' }, o.items.map(n => h('div', { class: 'item' }, h('div', { class: 'grow' }, n)))),
    h('button', { class: 'btn block', onclick: () => {
      let n = 0; S().stock.forEach(s => s.items.forEach(i => { if (o.items.includes(i.name) && !i.low) { i.low = true; n++; } }));
      W.save(); W.close(); W.render(); W.toast(n + ' added to order list');
    } }, 'Add these to this week\'s order'),
    h('button', { class: 'btn danger block', onclick: () => W.confirm('Delete this order from history?', () => { S().orders = S().orders.filter(x => x.id !== o.id); W.save(); W.render(); }) }, 'Delete from history')
  ]);
}

W.views.stock = function (app) {
  const s = S(), t = W.today();
  const low = W.lowItems(), hist = history();
  const od = W.nextOrderDate(), odIn = W.daysBetween(t, od);
  const q = search.toLowerCase();
  const usual = name => hist.n >= 2 && (hist.map[name] || 0) / hist.n >= 0.5;
  const usualMissing = s.stock.flatMap(sec => sec.items.filter(i => !i.low && usual(i.name)));

  const searchBox = h('input', { type: 'search', placeholder: 'Search drinks…', value: search, oninput: e => {
    search = e.target.value; const pos = e.target.selectionStart; W.render();
    const el = document.querySelector('#app input[type=search]'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (er) { /* ignore */ } }
  } });

  W.fill(app,
    h('div', { class: 'top' }, h('h1', {}, 'Stock'),
      h('button', { class: 'btn ghost small', style: 'margin-top:10px', onclick: () => { editing = !editing; W.render(); } }, editing ? 'Done editing' : 'Edit list')),

    !editing && h('div', { class: 'card' + (odIn === 0 ? ' alert' : '') },
      h('div', { class: 'row between' },
        h('div', {}, h('div', { class: 'muted small' }, 'Next order'), h('div', { style: 'font-weight:900;font-size:20px' }, odIn === 0 ? 'Today' : odIn === 1 ? 'Tomorrow' : W.niceDate(od))),
        h('div', { style: 'text-align:right' }, h('div', { class: 'big-num' + (low.length ? ' blue' : '') }, low.length), h('div', { class: 'muted small' }, 'on order list'))),
      s.orders.length ? h('p', { class: 'muted small' }, 'Last order: ' + W.relDay(s.orders[s.orders.length - 1].date).toLowerCase() + ' (' + s.orders[s.orders.length - 1].items.length + ' items)') : h('p', { class: 'muted small' }, 'Tap a drink below when it\'s running low. It goes on the order list.'),
      usualMissing.length ? h('div', { class: 'card', style: 'background:var(--panel2);margin:10px 0 0' },
        h('div', { style: 'font-weight:800' }, 'Usually ordered, not on the list yet'),
        h('div', { style: 'margin-top:6px' }, usualMissing.map(i => h('span', { class: 'chip', onclick: () => { i.low = true; W.save(); W.render(); } }, '+ ' + i.name)))) : null,
      low.length ? h('div', { class: 'grid2', style: 'margin-top:10px' },
        h('button', { class: 'btn ghost', onclick: () => W.share('Drinks order', orderText()) }, 'Share list'),
        h('button', { class: 'btn', onclick: () => W.confirm('Mark this order as placed? The ' + low.length + ' items are saved to order history and the list is cleared.', () => {
          s.orders.push({ id: W.uid(), date: t, items: low.map(i => i.name) });
          s.stock.forEach(sec => sec.items.forEach(i => { i.low = false; }));
          W.save(); W.render(); W.toast('Order saved');
        }) }, 'Order placed')) : null),

    searchBox,
    h('div', { style: 'height:12px' }),
    editing ? h('p', { class: 'muted small' }, 'Tap a drink to rename, move or remove it. Tap a section name to rename it.') : null,

    s.stock.map(sec => {
      const items = sec.items.filter(i => !q || i.name.toLowerCase().includes(q));
      if (q && !items.length) return null;
      const nLow = sec.items.filter(i => i.low).length;
      const det = h('details', { class: 'stock-sec', open: !!(q || editing || openSecs.has(sec.id)), ontoggle: e => { if (e.target.open) openSecs.add(sec.id); else openSecs.delete(sec.id); } },
        h('summary', {}, h('span', { class: 'grow' }, sec.name), nLow ? h('span', { class: 'pill blue' }, nLow + ' to order') : h('span', { class: 'muted small' }, sec.items.length)),
        editing ? h('div', { class: 'sitem', onclick: () => editSection(sec) }, h('span', { class: 'muted' }, '✎ Rename / delete section')) : null,
        items.map(it => {
          const lastO = hist.last[it.name];
          return h('div', { class: 'sitem' + (it.low && !editing ? ' low' : ''), onclick: () => {
            if (editing) return editItem(sec, it);
            it.low = !it.low; W.save(); W.render();
          } },
            editing ? h('span', { class: 'muted' }, '✎') : h('span', { class: 'box' }, it.low ? '✓' : ''),
            h('div', { class: 'grow' }, h('div', {}, it.name),
              !editing && (lastO || usual(it.name)) ? h('div', { class: 'sub' }, [usual(it.name) ? 'Usually ordered' : null, lastO ? 'last ordered ' + W.relDay(lastO).toLowerCase() : null].filter(Boolean).join(' · ')) : null));
        }),
        editing ? h('div', { class: 'sitem', onclick: () => editItem(sec) }, h('span', { class: 'blue', style: 'font-weight:800' }, '+ Add item')) : null);
      return det;
    }),
    editing ? h('button', { class: 'btn ghost block', onclick: () => editSection() }, '+ Add section') : null,

    !editing && low.length ? h('button', { class: 'btn ghost block', onclick: () => W.confirm('Untick everything on the order list?', () => { s.stock.forEach(sec => sec.items.forEach(i => { i.low = false; })); W.save(); W.render(); }) }, 'Clear order list') : null,

    !editing && s.orders.length ? [h('h2', {}, h('span', {}, 'Order history'), h('span', { class: 'count' }, s.orders.length)),
      h('div', { class: 'card' }, s.orders.slice(-10).reverse().map(o => h('div', { class: 'item', style: 'cursor:pointer', onclick: () => showOrder(o) },
        h('div', { class: 'grow' }, h('div', { class: 't' }, W.niceDate(o.date)), h('div', { class: 'sub' }, o.items.length + ' items: ' + o.items.slice(0, 4).join(', ') + (o.items.length > 4 ? '…' : ''))),
        h('span', { class: 'muted' }, '›'))))] : null
  );
};
})();
