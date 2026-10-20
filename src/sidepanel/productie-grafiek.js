import { FONT, SERIE, SVG_NS, T, TYPE, dayLabel, el, fmtMin } from './ui.js';

/* ── Grafiek: productieverloop ─────────────────────────────────────────────
   Lijngrafiek met drie reeksen (directe, indirecte en reistijd per week), één
   y-as in uren. Dunne lijnen (2px), punten met een witte ring, een
   haarfijn raster, een legenda boven de grafiek en de reeksnaam aan het eind
   van elke lijn. Bij hover een hulplijn met de waarden van die week. De tabel
   eronder geeft dezelfde getallen als tekst. */

function niceStep(maxH) {
  var steps = [1, 2, 4, 5, 10, 20, 25, 50];
  for (var i = 0; i < steps.length; i++) if (maxH / steps[i] <= 4) return steps[i];
  return 100;
}
function svgEl(tag, attrs, parent) {
  var n = document.createElementNS(SVG_NS, tag);
  for (var k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
export function productionChart(weeks) {
  var wrap = el('div', { position: 'relative' });
  var reeksen = [
    { key: 'directMinutes', naam: 'Direct', kleur: SERIE.direct },
    { key: 'indirectMinutes', naam: 'Indirect', kleur: SERIE.indirect },
    { key: 'travelMinutes', naam: 'Reistijd', kleur: SERIE.travel }
  ];

  // Legenda (meerdere reeksen: altijd een legenda).
  var legenda = el('div', { display: 'flex', flexWrap: 'wrap', gap: '4px 14px', margin: '0 0 6px' });
  reeksen.forEach(function (r) {
    var item = el('span', Object.assign({}, TYPE.label, { display: 'inline-flex', alignItems: 'center', gap: '6px', color: T.ink, fontWeight: '400' }));
    item.appendChild(el('span', { width: '14px', height: '2px', borderRadius: '2px', background: r.kleur, display: 'inline-block' }));
    item.appendChild(document.createTextNode(r.naam));
    legenda.appendChild(item);
  });
  if (weeks.some(function (w) { return w.planned; })) {
    var gepl = el('span', Object.assign({}, TYPE.label, { display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '400' }));
    var streep = svgEl('svg', { width: 16, height: 4, 'aria-hidden': 'true' });
    svgEl('line', { x1: 0, x2: 16, y1: 2, y2: 2, stroke: T.inkSoft, 'stroke-width': 2, 'stroke-dasharray': '4 3' }, streep);
    gepl.appendChild(streep);
    gepl.appendChild(document.createTextNode('gepland'));
    legenda.appendChild(gepl);
  }
  wrap.appendChild(legenda);

  var W = 300, H = 170, ml = 30, mr = 52, mt = 8, mb = 22;
  var pw = W - ml - mr, ph = H - mt - mb;
  var maxMin = 0;
  weeks.forEach(function (w) { reeksen.forEach(function (r) { maxMin = Math.max(maxMin, w[r.key] || 0); }); });
  var maxH = Math.max(1, maxMin / 60);
  var step = niceStep(maxH);
  var top = Math.ceil(maxH / step) * step;
  var x = function (i) { return weeks.length === 1 ? ml + pw / 2 : ml + i * (pw / (weeks.length - 1)); };
  var y = function (min) { return mt + ph - (min / 60) / top * ph; };

  var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img',
    'aria-label': 'Directe, indirecte en reistijd per week (uren)' });
  svg.style.display = 'block';
  svg.style.overflow = 'visible';

  // Raster + y-as (haarlijnen, recessief).
  for (var v = 0; v <= top; v += step) {
    var gy = y(v * 60);
    svgEl('line', { x1: ml, x2: ml + pw, y1: gy, y2: gy, stroke: T.line, 'stroke-width': 1 }, svg);
    var t = svgEl('text', { x: ml - 6, y: gy + 3.5, 'text-anchor': 'end', 'font-size': 10, fill: T.inkSoft, 'font-family': FONT }, svg);
    t.textContent = v + ' u';
  }
  // x-labels: elke week bij weinig weken, anders om de paar; de laatste altijd.
  var elke = Math.max(1, Math.ceil(weeks.length / 7));
  weeks.forEach(function (w, i) {
    if ((weeks.length - 1 - i) % elke !== 0) return;   // terugtellend vanaf de laatste week: gelijke afstand
    var lt = svgEl('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', 'font-size': 10, fill: T.inkSoft, 'font-family': FONT }, svg);
    lt.textContent = 'wk ' + (w.week || '');
  });

  // Hulplijn bij hover (onder de lijnen).
  var cross = svgEl('line', { x1: 0, x2: 0, y1: mt, y2: mt + ph, stroke: T.inkSoft, 'stroke-width': 1, opacity: 0 }, svg);

  // Lijnen, punten en eindlabels.
  var eind = [];
  // Geregistreerde weken: doorgetrokken lijn, gevulde punten. Geplande
  // (latere) weken: gestippelde lijn vanaf de laatste geregistreerde week, open
  // punten.
  var eersteGepland = weeks.findIndex(function (w) { return w.planned; });
  if (eersteGepland < 0) eersteGepland = weeks.length;
  var pad = function (r, van, tot) {
    var d = '';
    for (var i = van; i <= tot; i++) d += (i === van ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(weeks[i][r.key] || 0).toFixed(1) + ' ';
    return d;
  };
  reeksen.forEach(function (r) {
    if (eersteGepland > 1) svgEl('path', { d: pad(r, 0, eersteGepland - 1), fill: 'none', stroke: r.kleur, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    if (eersteGepland < weeks.length && weeks.length > 1) {
      svgEl('path', { d: pad(r, Math.max(0, eersteGepland - 1), weeks.length - 1), fill: 'none', stroke: r.kleur, 'stroke-width': 2,
        'stroke-dasharray': '4 4', 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'data-gepland': '1' }, svg);
    }
    weeks.forEach(function (w, i) {
      if (w.planned) svgEl('circle', { cx: x(i), cy: y(w[r.key] || 0), r: 4, fill: '#fff', stroke: r.kleur, 'stroke-width': 2 }, svg);
      else svgEl('circle', { cx: x(i), cy: y(w[r.key] || 0), r: 4, fill: r.kleur, stroke: '#fff', 'stroke-width': 2 }, svg);
    });
    var last = weeks.length - 1;
    eind.push({ naam: r.naam, y: y(weeks[last][r.key] || 0) });
  });
  // Eindlabels niet over elkaar: van boven naar beneden minstens 12px uit
  // elkaar, en niet onder de x-as.
  var gesorteerd = eind.slice().sort(function (a, b) { return a.y - b.y; });
  for (var g = 1; g < gesorteerd.length; g++) {
    if (gesorteerd[g].y - gesorteerd[g - 1].y < 12) gesorteerd[g].y = gesorteerd[g - 1].y + 12;
  }
  var overloop = gesorteerd.length ? gesorteerd[gesorteerd.length - 1].y - (mt + ph) : 0;
  if (overloop > 0) gesorteerd.forEach(function (e) { e.y -= overloop; });
  eind.forEach(function (e) {
    var et = svgEl('text', { x: x(weeks.length - 1) + 8, y: e.y + 3.5, 'font-size': 11, fill: T.ink, 'font-family': FONT }, svg);
    et.textContent = e.naam;
  });

  // Tooltip (HTML, zodat hij netjes afbreekt en de tekstkleuren volgt).
  var tip = el('div', {
    position: 'absolute', pointerEvents: 'none', display: 'none', zIndex: '2',
    background: '#fff', border: '1px solid ' + T.line, borderRadius: '8px',
    boxShadow: '0 6px 18px -8px rgba(32,20,15,.35)', padding: '7px 9px',
    fontSize: '12px', color: T.ink, whiteSpace: 'nowrap'
  });
  function toonTip(i) {
    var w = weeks[i];
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', '0.5');
    tip.innerHTML = '';
    tip.appendChild(el('div', { fontWeight: '700', marginBottom: '3px' }, 'Week ' + (w.week || '') + ', vanaf ' + dayLabel(w.weekStart) + (w.planned ? ' (gepland)' : '')));
    reeksen.forEach(function (r) {
      var rij = el('div', { display: 'flex', alignItems: 'center', gap: '6px', fontVariantNumeric: 'tabular-nums' });
      rij.appendChild(el('span', { width: '10px', height: '2px', background: r.kleur, display: 'inline-block' }));
      rij.appendChild(document.createTextNode(r.naam + ' ' + fmtMin(w[r.key])));
      tip.appendChild(rij);
    });
    tip.style.display = 'block';
    var rect = svg.getBoundingClientRect();
    var schaal = rect.width ? rect.width / W : 1;
    var px = x(i) * schaal;
    // Rechts van de hulplijn, tenzij hij dan over de eindlabels zou vallen.
    var links = px + 10;
    if (rect.width && links + 150 > rect.width - mr * schaal) links = Math.max(0, px - 160);
    tip.style.left = links + 'px';
    tip.style.top = (legenda.offsetHeight + mt * schaal) + 'px';
  }
  function verbergTip() { tip.style.display = 'none'; cross.setAttribute('opacity', '0'); }
  // Raakvlakken per week: breder dan de punten.
  var band = weeks.length === 1 ? pw : pw / (weeks.length - 1);
  weeks.forEach(function (w, i) {
    var hit = svgEl('rect', { x: x(i) - band / 2, y: mt, width: band, height: ph, fill: 'transparent' }, svg);
    hit.addEventListener('mouseenter', function () { toonTip(i); });
    hit.addEventListener('mouseleave', verbergTip);
  });

  wrap.appendChild(svg);
  wrap.appendChild(tip);
  return wrap;
}
// Dezelfde getallen als tabel (toegankelijk, en exact af te lezen).
export function productionTable(weeks) {
  var t = document.createElement('table');
  Object.assign(t.style, { width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '12px', color: T.ink, fontVariantNumeric: 'tabular-nums' });
  var kop = t.createTHead().insertRow();
  ['Week', 'Direct', 'Indirect', 'Reistijd', 'Cliënttijd'].forEach(function (k, i) {
    var th = document.createElement('th');
    th.textContent = k;
    Object.assign(th.style, { textAlign: i ? 'right' : 'left', fontWeight: '600', color: T.inkSoft, padding: '0 0 6px', borderBottom: '1px solid ' + T.line });
    kop.appendChild(th);
  });
  var tb = t.createTBody();
  weeks.slice().reverse().forEach(function (w) {
    var r = tb.insertRow();
    [String(w.week || ''), fmtMin(w.directMinutes), fmtMin(w.indirectMinutes), fmtMin(w.travelMinutes), fmtMin(w.clientMinutes)].forEach(function (v, i) {
      var td = r.insertCell();
      td.textContent = v;
      Object.assign(td.style, { textAlign: i ? 'right' : 'left', padding: '6px 0', borderBottom: '1px solid ' + T.lineSoft, color: w.planned ? T.inkSoft : T.ink });
      if (!i && w.planned) td.appendChild(el('span', { fontSize: '11px', marginLeft: '4px' }, 'gepland'));
    });
  });
  return t;
}
