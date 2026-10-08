/* ============================================================================
   agenda-panel.js — de Agendahulp in het zijpaneel.

   Opbouw: een spine links (roze als de hulp aanstaat, grijs als hij uitstaat)
   en een inhoudskolom. De kolom toont één pagina tegelijk:

     hoofd        status, (dagweergave: nog te registreren), het weekoverzicht
                  en knoppen naar de andere pagina's
     clienttijd   opbouw van de cliënttijd + het productieverloop (directe en
                  indirecte tijd per week, als lijngrafiek)
     verhouding   verhouding direct / indirect / reistijd per uursoort
     open         open registraties in een gekozen periode
     snel         registratieformulier van ONS openen, vooraf ingevuld
     info         legenda en versie

   Vroeger openden 'cliënttijd' en 'verhouding' een dialoog in de ONS-pagina;
   nu blijven ze in het zijpaneel, met 'Terug' naar de hoofdpagina.

   Typografie (overal hetzelfde, zie TYPE):
     paginatitel 15px/700 · sectiekop 13px/700 · tekst 13px/400
     hulptekst en labels 12px (400 resp. 600) in gedempte inkt · labels 11px/600
   Tekst staat altijd in inkt of gedempte inkt; roze is voor knoppen en accenten.

   Het paneel rekent zelf niets uit. Het krijgt een toestand (getallen, datums)
   en een setje acties, en meldt klikken terug via die acties. De domeinlogica
   blijft in het content-script op de ONS-pagina
   (src/content/features/agenda/side-panel-bridge.js levert de toestand).
   ========================================================================== */

var T = {
  ink: '#201d1f', inkSoft: '#6b6367', line: '#ece7e5', lineSoft: '#f6f2f0',
  brand: '#cc087d', brandDeep: '#8c0a58', brandWash: '#fdf1f8',
  ok: '#1b7f3b', okWash: '#eaf6ee', bad: '#a3241f', badWash: '#fbeceb',
  warn: '#8a5a00', warnWash: '#fff4d6'
};
var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
// De reeksen in de grafiek productieverloop (gevalideerd op kleurenblindheid);
// dezelfde kleuren als op de pagina 'Verhouding per uursoort'.
var SERIE = { direct: '#2a78d6', indirect: '#cc087d', travel: '#1baf7a' };

var SVG_NS = 'http://www.w3.org/2000/svg';
var WD = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
var MON = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function fmtHM(min) { var h = Math.floor(min / 60), m = min % 60; return h + ':' + (m < 10 ? '0' : '') + m; }
function fmtMin(min) {
  min = Math.max(0, Math.round(min || 0));
  var h = Math.floor(min / 60), m = min % 60;
  return h ? (h + ' u' + (m ? ' ' + m + ' m' : '')) : (m + ' m');
}
function dayLabel(date) {
  var d = new Date(date + 'T00:00:00');
  if (isNaN(d.getTime())) return date;
  return WD[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
}
function el(tag, styles, text) {
  var n = document.createElement(tag);
  if (styles) Object.assign(n.style, styles);
  if (text != null) n.textContent = text;
  return n;
}
function focusRing(node, color) {
  node.addEventListener('focus', function () { node.style.outline = '2px solid ' + (color || T.brand); node.style.outlineOffset = '2px'; });
  node.addEventListener('blur', function () { node.style.outline = 'none'; });
}
function liftOnHover(card) {
  card.addEventListener('mouseenter', function () { card.style.transform = 'translateY(-1px)'; card.style.boxShadow = '0 4px 12px -6px rgba(32,20,15,.22)'; });
  card.addEventListener('mouseleave', function () { card.style.transform = 'none'; card.style.boxShadow = 'none'; });
}

/* ── Typografie ────────────────────────────────────────────────────────── */

var TYPE = {
  pageTitle: { fontSize: '15px', fontWeight: '700', color: T.ink },
  section:   { fontSize: '13px', fontWeight: '700', color: T.ink, margin: '0 0 8px' },
  text:      { fontSize: '13px', fontWeight: '400', color: T.ink, lineHeight: '1.45' },
  help:      { fontSize: '12px', fontWeight: '400', color: T.inkSoft, lineHeight: '1.45' },
  label:     { fontSize: '12px', fontWeight: '600', color: T.inkSoft },
  small:     { fontSize: '11px', fontWeight: '600' }
};
function txt(kind, text, extra) {
  var n = el('div', Object.assign({}, TYPE[kind], extra || {}), text);
  return n;
}
// Sectie met een kop en een dunne lijn erboven (behalve de eerste op een pagina).
function sectionHead(text, first) {
  return txt('section', text, first ? null : { borderTop: '1px solid ' + T.line, paddingTop: '12px', marginTop: '4px' });
}

/* ── Iconen ────────────────────────────────────────────────────────────── */
function svgSpineCheck() {
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '11'); svg.setAttribute('height', '11'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  var p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', 'M3 7.2l2.6 2.6L11 4');
  svg.appendChild(p); return svg;
}
function svgSpinePause() {
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '11'); svg.setAttribute('height', '11'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round');
  [5, 9].forEach(function (x) {
    var l = document.createElementNS(SVG_NS, 'line');
    l.setAttribute('x1', x); l.setAttribute('y1', '3.5'); l.setAttribute('x2', x); l.setAttribute('y2', '10.5');
    svg.appendChild(l);
  });
  return svg;
}
function svgInfoIcon() {
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '14'); svg.setAttribute('height', '14'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.6'); svg.setAttribute('stroke-linecap', 'round');
  var line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', '7'); line.setAttribute('y1', '6.2'); line.setAttribute('x2', '7'); line.setAttribute('y2', '10.4');
  var dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', '7'); dot.setAttribute('cy', '3.6'); dot.setAttribute('r', '.9'); dot.setAttribute('fill', 'currentColor'); dot.setAttribute('stroke', 'none');
  var ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('cx', '7'); ring.setAttribute('cy', '7'); ring.setAttribute('r', '6.1');
  svg.appendChild(ring); svg.appendChild(line); svg.appendChild(dot);
  return svg;
}
function svgPath(d, size) {
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size || 18); svg.setAttribute('height', size || 18);
  svg.setAttribute('aria-hidden', 'true');
  var p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('fill', 'currentColor'); p.setAttribute('d', d);
  svg.appendChild(p); return svg;
}
var CHEV_RECHTS = 'M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z';
var PIJL_TERUG = 'M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20z';
var ICON_VERVERS = 'M17.7 6.3A8 8 0 1 0 19.7 14h-2.1a6 6 0 1 1-1.4-6.2L13 11h7V4z';
// Kalender met vinkje · klok · verdeelde balk (verhouding).
var ICON_RANGE = 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v10H5zm5.6 8.2-3.1-3.1 1.4-1.4 1.7 1.7 4.5-4.5 1.4 1.4z';
var ICON_QUICK = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l5 3 1-1.7-4-2.4z';
 // Kalender met zoekglas.
var ICON_PLAN = 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6v-2H5V9h14v2h2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm9.5 11a3.5 3.5 0 1 0 1.9 6.4l2.2 2.2 1.4-1.4-2.2-2.2A3.5 3.5 0 0 0 16.5 13zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z';
var ICON_RATIO = 'M3 5h18v4H3zm0 5h11v4H3zm12 0h6v4h-6zM3 15h7v4H3zm8 0h10v4H11z';

/* ── Bouwstenen ────────────────────────────────────────────────────────── */

function tag(text, tone) {
  var c = tone === 'bad' ? [T.bad, T.badWash] : tone === 'warn' ? [T.warn, T.warnWash] : tone === 'ok' ? [T.ok, T.okWash] : [T.inkSoft, T.lineSoft];
  return el('span', Object.assign({}, TYPE.small, {
    display: 'inline-block', color: c[0], background: c[1], borderRadius: '8px',
    padding: '1px 7px', marginLeft: '6px', verticalAlign: '1px', whiteSpace: 'nowrap'
  }), text);
}
function minutesLine(client, overig) {
  return txt('help', 'Cliënt ' + fmtHM(client) + ' · Overig ' + fmtHM(overig) + ' · Totaal ' + fmtHM(client + overig),
    { fontVariantNumeric: 'tabular-nums' });
}
function noteBox(text, tone) {
  var c = tone === 'bad' ? [T.badWash, T.bad] : tone === 'ok' ? [T.okWash, T.ok] : [T.warnWash, T.warn];
  return el('div', {
    marginTop: '10px', padding: '9px 11px', borderRadius: '10px', background: c[0], color: c[1],
    fontSize: '13px', fontWeight: '600', lineHeight: '1.4'
  }, text);
}
function baseButton(text, onClick, primary, disabled) {
  var b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.disabled = !!disabled;
  Object.assign(b.style, {
    width: '100%', boxSizing: 'border-box', borderRadius: '10px', padding: '10px 12px',
    font: '600 13px/1 ' + FONT, cursor: disabled ? 'default' : 'pointer',
    border: primary ? '0' : '1px solid ' + T.brand,
    background: primary ? (disabled ? '#d9c2cf' : T.brand) : '#fff',
    color: primary ? '#fff' : T.brand,
    transition: 'background .12s ease, transform .12s ease, box-shadow .12s ease'
  });
  if (!disabled) {
    b.addEventListener('mouseenter', function () { b.style.background = primary ? T.brandDeep : T.brandWash; });
    b.addEventListener('mouseleave', function () { b.style.background = primary ? T.brand : '#fff'; });
  }
  focusRing(b, primary ? T.brandDeep : T.brand);
  b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (!b.disabled) onClick(); });
  return b;
}
function primaryBtn(text, onClick, disabled) { var b = baseButton(text, onClick, true, disabled); b.style.marginTop = '10px'; return b; }
function secondaryBtn(text, onClick) { return baseButton(text, onClick, false, false); }

function fieldLabel(text, input) {
  var w = el('label', Object.assign({}, TYPE.label, { display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 0', minWidth: '0' }));
  w.appendChild(document.createTextNode(text));
  w.appendChild(input);
  return w;
}
function inputEl(type, value, onChange) {
  var i = document.createElement('input');
  i.type = type;
  i.value = value || '';
  Object.assign(i.style, {
    width: '100%', boxSizing: 'border-box', padding: '7px 8px', borderRadius: '8px',
    border: '1px solid ' + T.line, font: '400 13px ' + FONT, color: T.ink, background: '#fff'
  });
  focusRing(i);
  i.addEventListener('input', function () { onChange(i.value); });
  i.addEventListener('change', function () { onChange(i.value); });
  return i;
}
// Klikbare kaart (dagen in een resultaat, afspraken in dagweergave).
function clickCard(onClick, title) {
  var card = el('div', {
    padding: '9px 11px', borderRadius: '12px', background: '#fff', border: '1px solid ' + T.line,
    cursor: 'pointer', boxSizing: 'border-box', transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease'
  });
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  if (title) card.title = title;
  card.addEventListener('mouseenter', function () { card.style.borderColor = T.brand; });
  card.addEventListener('mouseleave', function () { card.style.borderColor = T.line; });
  liftOnHover(card);
  focusRing(card);
  card.addEventListener('click', onClick);
  card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } });
  return card;
}
// Knop die een andere pagina opent (icoon, kop, uitleg, pijl).
function navCard(icoon, kop, uitleg, onClick) {
  var b = document.createElement('button');
  b.type = 'button';
  Object.assign(b.style, {
    display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', borderRadius: '12px', border: '1px solid ' + T.line, background: '#fff',
    color: T.ink, cursor: 'pointer', textAlign: 'left', font: 'inherit',
    transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease'
  });
  var ic = el('span', {
    width: '32px', height: '32px', borderRadius: '9px', background: T.brandWash, color: T.brand,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto'
  });
  ic.appendChild(svgPath(icoon, 18));
  b.appendChild(ic);
  var tekst = el('span', { flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '2px' });
  tekst.appendChild(el('span', { fontSize: '13px', fontWeight: '700', color: T.ink }, kop));
  tekst.appendChild(el('span', TYPE.help, uitleg));
  b.appendChild(tekst);
  var pijl = svgPath(CHEV_RECHTS, 16);
  pijl.style.color = T.brand; pijl.style.flex = '0 0 auto';
  b.appendChild(pijl);
  b.addEventListener('mouseenter', function () { b.style.borderColor = T.brand; b.style.transform = 'translateY(-1px)'; b.style.boxShadow = '0 4px 12px -6px rgba(32,20,15,.22)'; });
  b.addEventListener('mouseleave', function () { b.style.borderColor = T.line; b.style.transform = 'none'; b.style.boxShadow = 'none'; });
  focusRing(b);
  b.addEventListener('click', function (e) { e.preventDefault(); onClick(); });
  return b;
}

// Keyframes kunnen niet als inline-stijl; één klein stijlblok per document.
function zorgVoorStijl(doc) {
  var d = doc || document;
  if (d.getElementById('ons-agendapanel-stijl')) return;
  var st = d.createElement('style');
  st.id = 'ons-agendapanel-stijl';
  st.textContent =
    '@keyframes onsAhSchuif{0%{transform:translateX(-60%)}100%{transform:translateX(260%)}}' +
    '@keyframes onsAhPuls{0%,100%{opacity:.55}50%{opacity:.9}}';
  (d.head || d.documentElement).appendChild(st);
}
// Slanke onbepaalde voortgangsbalk: we weten niet hoe lang het duurt.
function laadBalk() {
  var spoor = el('div', {
    position: 'relative', height: '3px', borderRadius: '999px',
    background: T.lineSoft, overflow: 'hidden', margin: '0 0 10px'
  });
  spoor.setAttribute('role', 'progressbar');
  spoor.setAttribute('aria-label', 'Bezig met ophalen');
  spoor.appendChild(el('div', {
    position: 'absolute', top: '0', bottom: '0', left: '0', width: '38%',
    borderRadius: '999px', background: T.brand,
    animation: 'onsAhSchuif 1.1s cubic-bezier(.4,0,.6,1) infinite'
  }));
  return spoor;
}
// Voortgang met bekend totaal: 'Week 3 van 9'.
function voortgang(done, total) {
  zorgVoorStijl();
  var p = el('div', { marginTop: '10px' });
  p.appendChild(txt('label', total ? ('Week ' + done + ' van ' + total + ' opgehaald') : 'Weken ophalen…', { marginBottom: '5px' }));
  if (total) {
    var spoor = el('div', { height: '4px', borderRadius: '999px', background: T.lineSoft, overflow: 'hidden' });
    spoor.setAttribute('role', 'progressbar');
    spoor.setAttribute('aria-valuemin', '0'); spoor.setAttribute('aria-valuemax', String(total)); spoor.setAttribute('aria-valuenow', String(done));
    spoor.appendChild(el('div', { height: '100%', width: Math.round(done / total * 100) + '%', background: T.brand, transition: 'width .2s ease' }));
    p.appendChild(spoor);
  } else {
    p.appendChild(laadBalk());
  }
  return p;
}
// Grijze balkjes in de vorm van het overzicht dat eraan komt.
function skelet() {
  var wrap = el('div', { animation: 'onsAhPuls 1.4s ease-in-out infinite' });
  var streep = function (breedte, hoogte, marge) {
    return el('div', { height: (hoogte || 10) + 'px', width: breedte, borderRadius: '6px', background: T.lineSoft, margin: marge || '0 0 8px' });
  };
  wrap.appendChild(streep('55%', 12, '0 0 10px'));
  var rij = el('div', { display: 'flex', gap: '8px', margin: '0 0 12px' });
  rij.appendChild(el('div', { flex: '1 1 0', height: '56px', borderRadius: '12px', background: T.lineSoft }));
  rij.appendChild(el('div', { flex: '1 1 0', height: '56px', borderRadius: '12px', background: T.lineSoft }));
  wrap.appendChild(rij);
  wrap.appendChild(streep('40%', 9));
  ['85%', '70%', '78%'].forEach(function (b) {
    wrap.appendChild(streep('100%', 8, '0 0 4px'));
    wrap.appendChild(streep(b, 6, '0 0 12px'));
  });
  return wrap;
}


/* ── Datum- en tijdkiezer in de stijl van de hulp ──────────────────────────
   Het keuzevenster van de browser (input type=date/time) is niet op te maken.
   Deze kiezers klappen open ONDER de rij met velden, over de volle breedte van
   het paneel: twee velden naast elkaar zijn te smal voor een maandkalender.
   Eén kiezer tegelijk per groep. */
var MAANDEN_LANG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
function ymdVan(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function datumUitYmd(ymd) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function datumTekst(ymd) {
  var d = datumUitYmd(ymd);
  return d ? (WD[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear()) : '';
}
function chipKnop(tekst, gekozen, onClick, extra) {
  var b = document.createElement('button');
  b.type = 'button';
  b.textContent = tekst;
  Object.assign(b.style, {
    height: '32px', padding: '0', borderRadius: '8px', boxSizing: 'border-box', cursor: 'pointer',
    border: '1px solid ' + (gekozen ? T.brand : 'transparent'), background: gekozen ? T.brand : 'transparent',
    color: gekozen ? '#fff' : T.ink, font: (gekozen ? '600' : '400') + ' 13px/1 ' + FONT, fontVariantNumeric: 'tabular-nums',
    transition: 'background .12s ease, border-color .12s ease'
  }, extra || {});
  if (!gekozen) {
    b.addEventListener('mouseenter', function () { b.style.background = T.brandWash; });
    b.addEventListener('mouseleave', function () { b.style.background = (extra && extra.background) || 'transparent'; });
  }
  focusRing(b);
  b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(); });
  return b;
}
function veldKnop(tekst, leeg, icoon) {
  var b = document.createElement('button');
  b.type = 'button';
  Object.assign(b.style, {
    width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '6px',
    padding: '7px 8px', borderRadius: '8px', border: '1px solid ' + T.line, background: '#fff', cursor: 'pointer',
    font: '400 13px/1.2 ' + FONT, color: leeg ? T.inkSoft : T.ink, textAlign: 'left'
  });
  var t = el('span', { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }, tekst);
  b.appendChild(t);
  var ic = svgPath(icoon, 16);
  ic.style.color = T.brand; ic.style.flex = '0 0 auto';
  b.appendChild(ic);
  b.addEventListener('mouseenter', function () { if (b.getAttribute('aria-expanded') !== 'true') b.style.borderColor = T.brand; });
  b.addEventListener('mouseleave', function () { if (b.getAttribute('aria-expanded') !== 'true') b.style.borderColor = T.line; });
  focusRing(b);
  b._tekst = t;
  return b;
}
var ICON_KALENDER = 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v10H5z';

export function maakKiezers() {
  var host = el('div');           // hier klapt de open kiezer uit
  var open = null;                // { knop, sluit }
  function sluit() {
    if (!open) return;
    open.knop.setAttribute('aria-expanded', 'false');
    open.knop.style.borderColor = T.line;
    open.knop.style.boxShadow = 'none';
    host.innerHTML = '';
    open = null;
  }
  function paneel() {
    var p = el('div', {
      margin: '8px 0 2px', padding: '10px', borderRadius: '12px', border: '1px solid ' + T.line,
      background: '#fff', boxShadow: '0 10px 28px -14px rgba(32,20,15,.35)'
    });
    p.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); var k = open && open.knop; sluit(); if (k) k.focus(); } });
    return p;
  }
  function openVoor(knop, bouw) {
    var was = open && open.knop === knop;
    sluit();
    if (was) return;
    open = { knop: knop };
    knop.setAttribute('aria-expanded', 'true');
    knop.style.borderColor = T.brand;
    knop.style.boxShadow = '0 0 0 3px ' + T.brandWash;
    var p = paneel();
    bouw(p);
    host.appendChild(p);
  }

  // Datumveld: knop met de datum voluit; klik opent een maandkalender.
  function datum(waarde, onChange) {
    var huidig = waarde;
    var knop = veldKnop(datumTekst(huidig) || 'Kies een datum', !huidig, ICON_KALENDER);
    knop.setAttribute('aria-haspopup', 'dialog');
    knop.setAttribute('aria-expanded', 'false');
    knop.setAttribute('data-datum', huidig || '');
    var toon = new Date();
    function kies(ymd) {
      huidig = ymd;
      knop._tekst.textContent = datumTekst(ymd);
      knop.style.color = T.ink;
      knop.setAttribute('data-datum', ymd);
      onChange(ymd);
      sluit();
      knop.focus();
    }
    knop.addEventListener('click', function (e) {
      e.preventDefault();
      var start = datumUitYmd(huidig) || new Date();
      toon = new Date(start.getFullYear(), start.getMonth(), 1);
      openVoor(knop, function (p) {
        p.setAttribute('role', 'dialog');
        p.setAttribute('aria-label', 'Kies een datum');
        function teken() {
          p.innerHTML = '';
          var kop = el('div', { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' });
          var vorige = chipKnop('', false, function () { toon = new Date(toon.getFullYear(), toon.getMonth() - 1, 1); teken(); }, { width: '32px', color: T.brand });
          vorige.appendChild(svgPath('M15 5.4 8.4 12 15 18.6 16.4 17.2 11.2 12 16.4 6.8z', 18));
          vorige.setAttribute('aria-label', 'Vorige maand');
          var volgende = chipKnop('', false, function () { toon = new Date(toon.getFullYear(), toon.getMonth() + 1, 1); teken(); }, { width: '32px', color: T.brand });
          volgende.appendChild(svgPath(CHEV_RECHTS, 18));
          volgende.setAttribute('aria-label', 'Volgende maand');
          kop.appendChild(vorige);
          kop.appendChild(el('div', Object.assign({}, TYPE.section, { margin: '0', flex: '1 1 auto', textAlign: 'center' }), MAANDEN_LANG[toon.getMonth()] + ' ' + toon.getFullYear()));
          kop.appendChild(volgende);
          p.appendChild(kop);
          var rooster = el('div', { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' });
          ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].forEach(function (w) {
            rooster.appendChild(el('div', Object.assign({}, TYPE.small, { color: T.inkSoft, textAlign: 'center', padding: '4px 0', fontWeight: '600' }), w));
          });
          var eerste = new Date(toon.getFullYear(), toon.getMonth(), 1);
          var begin = new Date(eerste); begin.setDate(1 - ((eerste.getDay() + 6) % 7));
          var vandaag = ymdVan(new Date());
          for (var i = 0; i < 42; i++) {
            var d = new Date(begin); d.setDate(begin.getDate() + i);
            if (i >= 35 && d.getMonth() !== toon.getMonth()) break;
            (function (d) {
              var ymd = ymdVan(d);
              var buiten = d.getMonth() !== toon.getMonth();
              var gekozen = ymd === huidig;
              var extra = { width: '100%' };
              if (buiten) extra.color = '#b9b1b5';
              if (!gekozen && ymd === vandaag) { extra.border = '1px solid ' + T.brand; extra.fontWeight = '600'; }
              var dag = chipKnop(String(d.getDate()), gekozen, function () { kies(ymd); }, extra);
              dag.setAttribute('aria-label', datumTekst(ymd) + (ymd === vandaag ? ' (vandaag)' : ''));
              if (gekozen) dag.setAttribute('aria-pressed', 'true');
              dag.setAttribute('data-ymd', ymd);
              rooster.appendChild(dag);
            })(d);
          }
          p.appendChild(rooster);
          var voet = el('div', { display: 'flex', justifyContent: 'flex-end', marginTop: '6px' });
          var nu = chipKnop('Vandaag', false, function () { kies(vandaag); }, { padding: '0 10px', color: T.brand, fontWeight: '600' });
          voet.appendChild(nu);
          p.appendChild(voet);
        }
        teken();
      });
    });
    return knop;
  }

  // Tijdveld: twee scrollbare kolommen (uren en minuten), zoals de
  // twee-koloms-kiezer van de hulp (src/content/ui/duration-picker.js). Kies je
  // een uur, dan blijft de kiezer open voor de minuten; kies je de minuten, dan
  // sluit hij.
  function tijd(waarde, onChange, opties) {
    opties = opties || {};
    var stap = opties.minutenStap || 5;
    var huidig = waarde;
    var knop = veldKnop(huidig || 'Kies een tijd', !huidig, ICON_QUICK);
    knop.setAttribute('aria-haspopup', 'dialog');
    knop.setAttribute('aria-expanded', 'false');
    function delen() { var m = /^(\d{1,2}):(\d{2})$/.exec(huidig || ''); return m ? { u: +m[1], m: +m[2] } : { u: null, m: null }; }
    function zet(u, m) {
      huidig = ('0' + u).slice(-2) + ':' + ('0' + m).slice(-2);
      knop._tekst.textContent = huidig;
      knop.style.color = T.ink;
      onChange(huidig);
    }
    function itemKnop(tekst, gekozen, onClick) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = tekst;
      b.setAttribute('data-gekozen', gekozen ? '1' : '0');
      Object.assign(b.style, {
        width: '100%', flex: '0 0 auto', padding: '7px 6px', borderRadius: '9px', boxSizing: 'border-box',
        border: '1px solid ' + (gekozen ? T.brand : T.line), background: gekozen ? T.brand : '#fff',
        color: gekozen ? '#fff' : T.ink, font: '600 13px/1 ' + FONT, fontVariantNumeric: 'tabular-nums',
        textAlign: 'center', cursor: 'pointer', transition: 'background .12s ease, border-color .12s ease'
      });
      if (!gekozen) {
        b.addEventListener('mouseenter', function () { b.style.background = T.brandWash; b.style.borderColor = 'transparent'; });
        b.addEventListener('mouseleave', function () { b.style.background = '#fff'; b.style.borderColor = T.line; });
      }
      focusRing(b);
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(); });
      return b;
    }
    function kolom(titel) {
      var col = el('div', { flex: '1 1 0', minWidth: '0', display: 'flex', flexDirection: 'column' });
      col.appendChild(txt('label', titel, { textAlign: 'center', margin: '0 0 6px' }));
      var lijst = el('div', {
        height: '196px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px',
        padding: '2px 4px', boxSizing: 'border-box', overscrollBehavior: 'contain', scrollbarWidth: 'thin'
      });
      lijst.setAttribute('role', 'listbox');
      lijst.setAttribute('aria-label', titel);
      col.appendChild(lijst);
      col._lijst = lijst;
      return col;
    }
    knop.addEventListener('click', function (e) {
      e.preventDefault();
      openVoor(knop, function (p) {
        p.setAttribute('role', 'dialog');
        p.setAttribute('aria-label', 'Kies een tijd');
        var urenKol, minKol;
        function scrollNaarKeuze(lijst, terug) {
          var doel = lijst.querySelector('[data-gekozen="1"]') || lijst.children[terug] || null;
          if (doel) lijst.scrollTop = Math.max(0, doel.offsetTop - lijst.offsetTop - 70);
        }
        function teken(behoudScroll) {
          var su = urenKol ? urenKol._lijst.scrollTop : 0, sm = minKol ? minKol._lijst.scrollTop : 0;
          p.innerHTML = '';
          var dl = delen();
          var rij = el('div', { display: 'flex', gap: '10px' });
          urenKol = kolom('Uur');
          for (var u = 0; u < 24; u++) {
            (function (u) {
              urenKol._lijst.appendChild(itemKnop(('0' + u).slice(-2), dl.u === u, function () { zet(u, dl.m == null ? 0 : dl.m); teken(true); }));
            })(u);
          }
          minKol = kolom('Minuten');
          for (var m = 0; m < 60; m += stap) {
            (function (m) {
              minKol._lijst.appendChild(itemKnop(('0' + m).slice(-2), dl.m === m && dl.u != null, function () {
                zet(dl.u == null ? 9 : dl.u, m); sluit(); knop.focus();
              }));
            })(m);
          }
          rij.appendChild(urenKol); rij.appendChild(minKol);
          p.appendChild(rij);
          // Na een klik op een uur blijft de scrollpositie staan; bij openen
          // springt elke kolom naar de gekozen waarde (anders 09:00).
          setTimeout(function () {
            if (behoudScroll) { urenKol._lijst.scrollTop = su; minKol._lijst.scrollTop = sm; }
            else { scrollNaarKeuze(urenKol._lijst, 9); scrollNaarKeuze(minKol._lijst, 0); }
          }, 0);
        }
        teken(false);
      });
    });
    return knop;
  }

  return { host: host, datum: datum, tijd: tijd, sluit: sluit };
}

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
    tip.appendChild(el('div', { fontWeight: '700', marginBottom: '3px' }, 'Week ' + (w.week || '') + ' · ' + dayLabel(w.weekStart) + (w.planned ? ' · gepland' : '')));
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
function productionTable(weeks) {
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

/* ── Het paneel ────────────────────────────────────────────────────────── */

/* Wat je op de pagina's invult en opvraagt, blijft bewaard zolang het
   zijpaneel open is, ook als het paneel opnieuw wordt opgebouwd. Dat gebeurt
   bij elke paginawissel in ONS (bijv. naar een registratieformulier en terug).
   Zo blijft de lijst open registraties een afwerklijst. */
var BEWAARD = {
  pagina: 'hoofd',
  // result: de lijst zoals hij getoond wordt; afgewerkt: sleutels van afspraken
  // die bij een latere controle niet meer open stonden.
  range: { from: '', to: '', busy: false, done: 0, total: 0, result: null, error: '', afgewerkt: {}, bijwerken: false, laatst: 0 },
  prod: { from: '', to: '', busy: false, done: 0, total: 0, result: null, error: '' },
  quick: { date: '', time: '', minutes: '15', busy: false, error: '', overlap: '' },
  // Verhouding per uursoort: hoeveel weken vanaf de bekeken week (0 = die week).
  ratio: { offset: 0, busy: false, result: null, error: '', voor: '' },
  // Planhulp: vrije tijd zoeken.
  // tot: zoek tot en met die datum (gaat voor op weeks).
  plan: { minutes: 60, weeks: 2, tot: '', busy: false, result: null, error: '' },
  // Gekozen vrij blok uit de planhulp: { gap, start (minuten), error }.
  slot: null,
  // Planhulp: gekozen momenten [{ date, startMin }] voor één afspraak die na
  // het opslaan wordt gekopieerd; kopie: uitslag van de laatste kopieerronde.
  momenten: [],
  kopie: null,
  balkOpen: false,
  inviteeId: null
};
function legeResultaten() {
  BEWAARD.range = { from: '', to: '', busy: false, done: 0, total: 0, result: null, error: '', afgewerkt: {}, bijwerken: false, laatst: 0 };
  BEWAARD.prod = { from: '', to: '', busy: false, done: 0, total: 0, result: null, error: '' };
  BEWAARD.ratio = { offset: 0, busy: false, result: null, error: '', voor: '' };
  BEWAARD.plan = { minutes: BEWAARD.plan ? BEWAARD.plan.minutes : 60, weeks: BEWAARD.plan ? BEWAARD.plan.weeks : 2, tot: BEWAARD.plan ? BEWAARD.plan.tot : '', busy: false, result: null, error: '' };
  BEWAARD.momenten = [];
  BEWAARD.kopie = null;
  BEWAARD.balkOpen = false;
}
export function _resetBewaardVoorTest() {
  BEWAARD.pagina = 'hoofd';
  BEWAARD.inviteeId = null;
  legeResultaten();
  BEWAARD.quick = { date: '', time: '', minutes: '15', busy: false, error: '', overlap: '' };
}
// ISO-weeknummer en maandag van de week van 'YYYY-MM-DD'.
function isoWeek(ymd) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return null;
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  var dag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dag);
  var jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - jan1) / 86400000 + 1) / 7);
}
function maandagVan(ymd) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return ymd;
  var d = new Date(+m[1], +m[2] - 1, +m[3]);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
// 'YYYY-MM-DD' + n weken -> 'YYYY-MM-DD' (lokale datum).
function plusWeken(ymd, n) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  d.setDate(d.getDate() + 7 * n);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

// Een nieuwe controle samenvoegen met de getoonde lijst: wat er niet meer in
// staat is afgewerkt (geregistreerd of 'niet registreren'); wat er nieuw bij
// staat (bijv. een afspraak die intussen is afgelopen) komt erbij.
export function mergeOpenRange(oud, nieuw, afgewerkt) {
  var open = {};
  (nieuw.days || []).forEach(function (d) { d.items.forEach(function (it) { open[it.key] = true; }); });
  var dagen = {};
  (oud.days || []).forEach(function (d) { dagen[d.date] = { date: d.date, items: d.items.slice() }; });
  (nieuw.days || []).forEach(function (d) {
    var dag = dagen[d.date] || (dagen[d.date] = { date: d.date, items: [] });
    d.items.forEach(function (it) {
      if (!dag.items.some(function (x) { return x.key === it.key; })) dag.items.push(it);
    });
  });
  Object.keys(dagen).forEach(function (dt) {
    dagen[dt].items.forEach(function (it) { if (it.key && !open[it.key]) afgewerkt[it.key] = true; else if (it.key) delete afgewerkt[it.key]; });
  });
  return { from: oud.from, to: oud.to, days: Object.keys(dagen).sort().map(function (dt) {
    var items = dagen[dt].items.sort(function (a, b) { return a.start - b.start; });
    return { date: dt, items: items };
  }) };
}
// Tellingen per dag en totaal, met afgewerkte afspraken apart.
function telOpen(result, afgewerkt) {
  var t = { count: 0, done: 0, openMinutes: 0, late: 0, days: 0 };
  (result.days || []).forEach(function (d) {
    var dagOpen = 0;
    d.items.forEach(function (it) {
      t.count++;
      if (afgewerkt[it.key]) t.done++;
      else { t.openMinutes += it.minutes; dagOpen++; if (it.late) t.late++; }
    });
    if (dagOpen) t.days++;
  });
  return t;
}

var PAGINA_TITEL = {
  hoofd: 'Agendahulp', clienttijd: 'Cliënttijd', verhouding: 'Verhouding per uursoort',
  open: 'Open registraties', snel: 'Snel registreren', info: 'Over de Agendahulp', vrijblok: 'Vrij blok', plan: 'Planhulp'
};

export function create(host, actions) {
  actions = actions || {};
  var state = null;
  var pagina = 'hoofd';
  var vorigePagina = BEWAARD.pagina;   // na opnieuw opbouwen terug naar deze pagina
  var vergelijkSig = '';               // agenda-inhoud van de vorige update

  var root = el('div', {
    background: '#fff', color: T.ink, font: '400 13px/1.45 ' + FONT,
    overflow: 'hidden', display: 'flex', flexDirection: 'row', alignItems: 'stretch',
    height: '100%', width: '100%'
  });

  // ── Spine ──
  var spine = el('div', {
    width: '16px', flex: '0 0 auto', display: 'flex', flexDirection: 'column',
    alignItems: 'center', padding: '12px 0', userSelect: 'none'
  });
  spine.setAttribute('aria-hidden', 'true');
  var spineChip = el('span', {
    width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,.24)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: '0 0 auto'
  });
  spine.appendChild(spineChip);

  // ── Inhoudskolom ──
  var mainCol = el('div', {
    flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column',
    overflowY: 'auto', overflowX: 'hidden'
  });

  var header = el('div', {
    display: 'flex', alignItems: 'center', background: '#fff', padding: '12px',
    userSelect: 'none', borderBottom: '1px solid ' + T.line, flex: '0 0 auto'
  });
  var title = el('span', Object.assign({}, TYPE.pageTitle, {
    flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  }), PAGINA_TITEL.hoofd);
  title.setAttribute('data-paneel-titel', '');
  header.appendChild(title);

  var controls = el('div', { display: 'inline-flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', marginLeft: '8px' });

  // Aan/uit-schakelaar.
  var onoff = document.createElement('button');
  onoff.type = 'button';
  Object.assign(onoff.style, {
    position: 'relative', background: 'transparent', border: '0', borderRadius: '999px',
    color: '#fff', cursor: 'pointer', lineHeight: '1', padding: '0', width: '58px', height: '24px',
    overflow: 'hidden', flex: '0 0 auto', fontFamily: 'inherit'
  });
  var swTrack = el('span', {
    position: 'absolute', inset: '0', borderRadius: '999px', border: '1px solid rgba(255,255,255,.45)',
    transition: 'background .16s ease, opacity .16s ease'
  });
  var swText = el('span', {
    position: 'absolute', top: '0', bottom: '0', display: 'flex', alignItems: 'center',
    fontSize: '11px', fontWeight: '600', color: '#fff',
    transition: 'left .16s ease, right .16s ease', pointerEvents: 'none'
  });
  var swKnob = el('span', {
    position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%',
    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.22)', transition: 'left .16s ease'
  });
  onoff.appendChild(swTrack); onoff.appendChild(swText); onoff.appendChild(swKnob);
  focusRing(onoff);
  onoff.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    var next = !(state && state.enabled);
    if (state) state.enabled = next;
    paintOnoff();
    if (actions.onToggleEnabled) actions.onToggleEnabled(next);
    if (pagina === 'hoofd') renderStatus();
  });

  var info = document.createElement('button');
  info.type = 'button';
  info.title = 'Legenda en versie';
  info.setAttribute('aria-label', 'Legenda en versie');
  info.appendChild(svgInfoIcon());
  Object.assign(info.style, {
    background: T.lineSoft, border: '1px solid ' + T.line, borderRadius: '8px', color: T.inkSoft,
    cursor: 'pointer', width: '28px', height: '28px', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', flex: '0 0 auto'
  });
  focusRing(info);
  info.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    naarPagina(pagina === 'info' ? 'hoofd' : 'info');
  });

  controls.appendChild(onoff); controls.appendChild(info);
  header.appendChild(controls);
  mainCol.appendChild(header);

  // Hoofdpagina: status, totalen (dagweergave), weekoverzicht, knoppen.
  var hoofd = el('div', { flex: '0 0 auto' });
  var statusBox = el('div', { padding: '12px 12px 0' });
  var totals = el('div', { padding: '0 12px' });
  var weekBox = el('div', { padding: '12px 12px 0' });
  // Twee gescheiden kinderen: de laadstrook is van ons, de container daaronder
  // is van React. Zelf iets in een React-container zetten laat zijn interne
  // boekhouding los van de echte DOM.
  var laadStrook = el('div');
  var weekHost = el('div', { transition: 'opacity .15s ease' });
  weekBox.appendChild(laadStrook);
  weekBox.appendChild(weekHost);
  var navBox = el('div', { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' });
  hoofd.appendChild(statusBox); hoofd.appendChild(totals); hoofd.appendChild(weekBox); hoofd.appendChild(navBox);

  // Andere pagina's.
  var paginaBox = el('div', { padding: '12px', flex: '0 0 auto', display: 'none' });
  mainCol.appendChild(hoofd); mainCol.appendChild(paginaBox);

  // ── Voet ── blijft onderaan in beeld, ook als je scrolt of de pagina kort
  // is: de balk met gekozen momenten (planhulp) en Verlof aanvragen.
  var voet = el('div', { position: 'sticky', bottom: '0', marginTop: 'auto', flex: '0 0 auto', background: '#fff', zIndex: '2' });
  var balkHost = el('div');
  voet.appendChild(balkHost);
  var leaveBar = el('div', { padding: '10px 12px', background: '#fff', borderTop: '1px solid ' + T.line });
  var leaveBtn = baseButton('Verlof aanvragen', function () { if (actions.onRequestLeave) actions.onRequestLeave(); }, true, false);
  leaveBtn.title = 'Verlof vastleggen in de agenda en aanvragen in AFAS';
  leaveBar.appendChild(leaveBtn);
  voet.appendChild(leaveBar);
  mainCol.appendChild(voet);

  root.appendChild(spine); root.appendChild(mainCol);
  host.appendChild(root);

  var bridge = function () { return window.__onsahReact; };

  /* ── Hoofdpagina ── */

  function paintOnoff() {
    var aan = !!(state && state.enabled);
    swText.textContent = aan ? 'Aan' : 'Uit';
    swTrack.style.background = aan ? T.ok : T.bad;
    swTrack.style.opacity = aan ? '1' : '.82';
    swKnob.style.left = aan ? '37px' : '3px';
    swText.style.left = aan ? '9px' : '27px';
    swText.style.right = aan ? '25px' : '7px';
    onoff.setAttribute('aria-label', aan ? 'Agendahulp uitschakelen' : 'Agendahulp inschakelen');
    onoff.setAttribute('aria-pressed', aan ? 'true' : 'false');
    onoff.title = aan ? 'Aan' : 'Uit';
    spine.style.background = aan ? T.brand : '#9a9296';
    spineChip.innerHTML = '';
    spineChip.appendChild(aan ? svgSpineCheck() : svgSpinePause());
  }

  function renderStatus() {
    statusBox.innerHTML = '';
    var tekst, toon;
    if (!state || !state.enabled) { tekst = 'Gekleurde dagindeling staat uit.'; toon = 'off'; }
    else if (!state.profileLabel) { tekst = 'Kies eerst een indeling via het extensie-icoontje in de browser.'; toon = 'warn'; }
    else { tekst = 'Gekleurde dagindeling staat aan (' + state.profileLabel + ').'; toon = 'ok'; }
    var bg = toon === 'ok' ? T.okWash : (toon === 'warn' ? T.warnWash : T.lineSoft);
    var fg = toon === 'ok' ? T.ok : (toon === 'warn' ? T.warn : T.inkSoft);
    var card = el('div', {
      display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '9px 11px',
      borderRadius: '10px', background: bg, color: fg, fontSize: '13px', lineHeight: '1.4', fontWeight: '600'
    });
    var icon = toon === 'ok' ? svgSpineCheck() : svgInfoIcon();
    icon.setAttribute('width', '13'); icon.setAttribute('height', '13');
    Object.assign(icon.style, { width: '13px', height: '13px', flex: '0 0 auto', marginTop: '2px' });
    card.appendChild(icon);
    card.appendChild(el('span', null, tekst));
    statusBox.appendChild(card);
  }

  function renderTotals() {
    totals.innerHTML = '';
    if (!state) return;
    var view = state.view || '';

    // Knop naar de weekweergave — alleen buiten de (werk)week-weergave.
    if (view !== 'workweek' && view !== 'week') {
      var weekBtn = secondaryBtn('Naar weekweergave', function () { if (actions.onJumpToWeek) actions.onJumpToWeek(); });
      weekBtn.style.marginTop = '12px';
      totals.appendChild(weekBtn);
    }

    // In dagweergave: nog te registreren (klikbaar).
    if (view === 'day') {
      var items = state.unfinished || [];
      totals.appendChild(sectionHead('Nog te registreren' + (items.length ? ' (' + items.length + ')' : ''), false));
      if (!items.length) {
        totals.appendChild(noteBox('Alles geregistreerd.', 'ok'));
        totals.lastChild.style.marginTop = '0';
      } else {
        var list = el('div', { display: 'flex', flexDirection: 'column', gap: '6px' });
        items.forEach(function (it) {
          var card = clickCard(function () { if (actions.onOpenOccurrence) actions.onOpenOccurrence(it.id); }, 'Afspraak openen');
          Object.assign(card.style, { display: 'flex', alignItems: 'center', gap: '8px' });
          card.appendChild(el('span', { fontSize: '13px', fontWeight: '600', color: T.ink, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }, it.time || '--:--'));
          card.appendChild(el('span', { fontSize: '13px', color: T.ink, flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, it.name));
          card.appendChild(tag(it.client ? 'cliënt' : 'overig', it.client ? 'ok' : null));
          list.appendChild(card);
        });
        totals.appendChild(list);
      }
    }
  }

  // Het weekoverzicht is een React-component (src/react/components/AgendaWeekPanel.jsx).
  function renderWeek() {
    var w = state && state.week;
    var bezig = !!(state && state.weekLoading);
    var fout = (state && state.weekError) || '';
    var b = bridge();

    if (fout && !bezig) {
      if (b && b.unmount) b.unmount(weekHost);
      weekHost.innerHTML = '';
      laadStrook.innerHTML = '';
      weekHost.appendChild(noteBox(fout, 'bad'));
      weekHost.lastChild.style.marginTop = '0';
      return;
    }
    if (!w || !w.summary) {
      if (b && b.unmount) b.unmount(weekHost);
      weekHost.innerHTML = '';
      weekHost.style.opacity = '1';
      laadStrook.innerHTML = '';
      zorgVoorStijl(weekBox.ownerDocument);
      // Nooit een stil leeg vak: of we halen op, of we wachten op de agenda.
      laadStrook.appendChild(txt('section', 'Weekoverzicht'));
      if (bezig) {
        laadStrook.appendChild(laadBalk());
        laadStrook.appendChild(skelet());
      } else {
        laadStrook.appendChild(txt('help', 'Wordt opgehaald zodra de agenda van deze week geladen is.'));
      }
      return;
    }
    if (!b || !b.renderWeekPanel) {
      laadStrook.innerHTML = '';
      weekHost.innerHTML = '';
      weekHost.appendChild(noteBox('Weekoverzicht kon niet laden (bundel ontbreekt).', 'bad'));
      return;
    }
    b.renderWeekPanel(weekHost, w.summary, Object.assign({}, w.opts || {}, { perInvitee: w.perInvitee || null }), T, w.clientRows || [], w.overigRows || [], fmtMin, {
      onOpenClientTime: function () { naarPagina('clienttijd'); }
    });
    weekHost.style.opacity = bezig ? '.45' : '1';
    laadStrook.innerHTML = '';
    if (bezig) { zorgVoorStijl(weekBox.ownerDocument); laadStrook.appendChild(laadBalk()); }
  }

  function hm(min) { return ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + (min % 60)).slice(-2); }
  function startPlan() {
    if (plan.busy || !actions.onFreeSlots) return;
    plan.busy = true; plan.error = ''; plan.result = null;
    if (pagina === 'plan') renderPagina();
    actions.onFreeSlots(plan.minutes, plan.weeks, function (res) {
      plan.busy = false;
      if (res && res.ok && res.result) plan.result = res.result;
      else plan.error = (res && res.error) || 'Zoeken mislukt.';
      if (pagina === 'plan') renderPagina();
    }, plan.tot);
  }
  /* ── Meerdere momenten: één afspraak, daarna kopieën ── */
  // Reserveringen (uit het vrije blok) die [start, start+duur) raken.
  function reserveringenIn(g, start, duur) {
    return (g.reservations || []).filter(function (r) { return r.startMin < start + duur && r.endMin > start; });
  }
  function reserveringTekst(rs) {
    return rs.map(function (r) { return (r.label || 'Reservering') + ' (' + hm(r.startMin) + '–' + hm(r.endMin) + ')'; }).join(', ');
  }
  function momentIndex(date, startMin) {
    for (var i = 0; i < BEWAARD.momenten.length; i++) {
      var m = BEWAARD.momenten[i];
      if (m.date === date && m.startMin === startMin) return i;
    }
    return -1;
  }
  function wisselMoment(date, startMin) {
    var i = momentIndex(date, startMin);
    if (i >= 0) BEWAARD.momenten.splice(i, 1);
    else {
      // Twee keer dezelfde afspraak die elkaar overlapt kan niet: de oude eruit.
      var duur = plan.minutes;
      BEWAARD.momenten = BEWAARD.momenten.filter(function (m) { return !(m.date === date && m.startMin < startMin + duur && m.startMin + duur > startMin); });
      BEWAARD.momenten.push({ date: date, startMin: startMin });
    }
    BEWAARD.momenten.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin; });
    // Het eerste moment is altijd het formulier zelf, nooit apart.
    if (BEWAARD.momenten[0]) BEWAARD.momenten[0].eigen = false;
    BEWAARD.kopie = null;
  }
  // Vinkje 'Andere instellingen': dit moment krijgt geen kopie maar een eigen
  // afspraakformulier, waarin de afspraakhulp opnieuw wordt doorlopen.
  function eigenVinkje(m, tekst) {
    var lab = el('label', { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: T.ink, cursor: 'pointer', userSelect: 'none' });
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!m.eigen;
    cb.setAttribute('data-eigen', m.date + ' ' + hm(m.startMin));
    cb.style.accentColor = T.brand;
    cb.style.margin = '0';
    cb.addEventListener('change', function () { m.eigen = cb.checked; BEWAARD.kopie = null; renderPagina(); });
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(tekst));
    lab.title = 'Aangevinkt: na het opslaan opent een nieuw afspraakformulier voor dit moment, zodat je andere instellingen kiest. Niet aangevinkt: een kopie van de eerste afspraak.';
    return lab;
  }
  function momentenInBlok(g, duur) {
    return BEWAARD.momenten.filter(function (m) { return m.date === g.date && m.startMin >= g.startMin && m.startMin + duur <= g.endMin; }).length;
  }
  // De eerste (vroegste) opent het formulier; de rest wordt na het opslaan gekopieerd.
  function maakOpMomenten(fout) {
    var ms = BEWAARD.momenten;
    if (!ms.length || !actions.onNewEvent) return;
    // Het eerste moment opent het formulier; daarop lijken de kopieën.
    // Momenten met een apart formulier krijgen daarna elk een eigen formulier.
    var eerste = ms[0];
    var zelfde = ms.slice(1).filter(function (m) { return !m.eigen; });
    var eigen = ms.slice(1).filter(function (m) { return m.eigen; });
    var tijd = function (m) { return { date: m.date, time: hm(m.startMin) }; };
    actions.onNewEvent({
      date: eerste.date, time: hm(eerste.startMin), minutes: plan.minutes,
      extra: zelfde.map(tijd), eigen: eigen.map(tijd)
    }, function (res) {
      if (!(res && res.ok)) { fout((res && res.error) || 'Openen mislukt.'); }
    });
  }
  // Vaste balk onderin de planhulp en het vrije blok: hoeveel momenten er
  // gekozen zijn en één knop om de afspraak te maken. Klik op de teller om de
  // lijst open te klappen; alleen daar kun je momenten weghalen of alles wissen.
  function momentenBalk() {
    var n = BEWAARD.momenten.length;
    var balk = el('div', {
      background: '#fff', padding: '10px 12px 12px',
      borderTop: '1px solid ' + T.line, boxShadow: '0 -10px 24px -18px rgba(32,20,15,.35)'
    });
    balk.setAttribute('data-selectie', String(n));
    if (BEWAARD.balkOpen) {
      var lijst = el('div', { display: 'flex', flexDirection: 'column', margin: '0 0 6px' });
      BEWAARD.momenten.forEach(function (m, i) {
        var rij = el('div', { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: T.ink, minHeight: '30px', borderBottom: '1px solid ' + T.lineSoft });
        rij.appendChild(el('span', { flex: '0 0 74px', fontWeight: '600' }, dayLabel(m.date)));
        rij.appendChild(el('span', { flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }, hm(m.startMin) + ' – ' + hm(m.startMin + plan.minutes)));
        // Het eerste moment is het formulier zelf: geen vinkje.
        var vink = i === 0 ? el('span', { flex: '1 1 auto' }) : eigenVinkje(m, 'Apart formulier');
        if (i > 0) { vink.style.flex = '1 1 auto'; vink.style.justifyContent = 'flex-end'; vink.style.color = T.inkSoft; vink.style.fontSize = '12px'; }
        rij.appendChild(vink);
        var weg = el('button', { border: '0', background: 'transparent', color: T.inkSoft, cursor: 'pointer', fontSize: '16px', lineHeight: '1', padding: '2px 6px', borderRadius: '6px' }, '\u00d7');
        weg.type = 'button';
        weg.title = 'Uit selectie halen';
        weg.setAttribute('aria-label', 'Uit selectie halen: ' + dayLabel(m.date) + ' ' + hm(m.startMin));
        weg.addEventListener('click', function () { wisselMoment(m.date, m.startMin); if (!BEWAARD.momenten.length) BEWAARD.balkOpen = false; renderPagina(); });
        rij.appendChild(weg);
        lijst.appendChild(rij);
      });
      balk.appendChild(lijst);
      var wis = el('button', { display: 'block', margin: '0 0 8px auto', border: '0', background: 'transparent', color: T.inkSoft, cursor: 'pointer', font: '400 12px ' + FONT, textDecoration: 'underline', padding: '2px 0' }, 'Alles wissen');
      wis.type = 'button';
      wis.addEventListener('click', function () { BEWAARD.momenten = []; BEWAARD.balkOpen = false; BEWAARD.kopie = null; renderPagina(); });
      balk.appendChild(wis);
    }
    var rij2 = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });
    var teller = el('button', { display: 'flex', alignItems: 'center', gap: '6px', border: '0', background: 'transparent', cursor: 'pointer', padding: '0', font: '700 13px ' + FONT, color: T.ink, whiteSpace: 'nowrap' });
    teller.type = 'button';
    teller.setAttribute('aria-expanded', BEWAARD.balkOpen ? 'true' : 'false');
    teller.setAttribute('data-teller', '');
    teller.title = BEWAARD.balkOpen ? 'Lijst inklappen' : 'Gekozen momenten bekijken';
    teller.appendChild(document.createTextNode(n === 1 ? '1 moment' : n + ' momenten'));
    teller.appendChild(el('span', { color: T.brand, fontSize: '11px' }, BEWAARD.balkOpen ? '\u25bc' : '\u25b2'));
    teller.addEventListener('click', function () { BEWAARD.balkOpen = !BEWAARD.balkOpen; renderPagina(); });
    rij2.appendChild(teller);
    var foutHost = el('div');
    var knop = primaryBtn(n > 1 ? 'Afspraak maken op ' + n + ' momenten' : 'Afspraak maken', function () {
      maakOpMomenten(function (f) { foutHost.innerHTML = ''; foutHost.appendChild(noteBox(f, 'bad')); });
    });
    Object.assign(knop.style, { marginTop: '0', flex: '1 1 auto', width: 'auto' });
    var aantalEigen = BEWAARD.momenten.filter(function (m) { return m.eigen; }).length;
    knop.title = n > 1 ? 'Je maakt de afspraak één keer in ONS; na het opslaan maakt de hulp hem ook op de andere momenten' +
      (aantalEigen ? ', en opent hij voor ' + aantalEigen + (aantalEigen === 1 ? ' moment' : ' momenten') + ' met andere instellingen een nieuw formulier.' : '.') : 'Opent een nieuwe afspraak in ONS met datum en begintijd ingevuld.';
    rij2.appendChild(knop);
    balk.appendChild(rij2);
    balk.appendChild(foutHost);
    return balk;
  }
  function kopieUitslag() {
    var k = BEWAARD.kopie;
    if (!k) return null;
    var lbl = function (m) { return dayLabel(m.date) + ' ' + hm(m.startMin); };
    if (k.reason) return noteBox('Geen kopieën gemaakt: ' + (k.reason === 'herhalende afspraak' ? 'het is een herhalende afspraak.' : 'de afspraak was niet te lezen.'), 'warn');
    if (k.failed && k.failed.length) return noteBox((k.made || []).length + ' kopieën gemaakt. Niet gelukt: ' + k.failed.map(lbl).join(', ') + '. Maak die zelf aan in ONS.', 'warn');
    var verder = k.next ? ' Nu het formulier voor ' + lbl(k.next) + (k.left > 1 ? ' (nog ' + k.left + ' met eigen instellingen).' : ' (eigen instellingen).') : '';
    if (k.made && k.made.length) return noteBox('Afspraak ook gemaakt op ' + k.made.map(lbl).join(', ') + '.' + verder, 'ok');
    if (verder) return noteBox('Afspraak opgeslagen.' + verder, 'ok');
    return null;
  }

  // Planhulp (eigen pagina): kies duur en periode, zoek vrije blokken binnen
  // je werktijden.
  function pagePlan() {
    var planBox = el('div');
    var meer = (state && state.inviteeCount > 1) ? state.inviteeCount : 0;
    if (meer) planBox.appendChild(noteBox('Er staan ' + meer + ' agenda\u2019s open: de planhulp zoekt tijd waarop iedereen vrij is.', 'ok'));
    if (meer) planBox.lastChild.style.margin = '0 0 10px';
    planBox.appendChild(txt('help', 'Zoek vrije tijd voor een afspraak binnen je werktijden' +
      ((state && state.windowLabel) ? ' (' + state.windowLabel + ')' : '') + '. Afspraken (ook uit Outlook, met reistijd) en onbeschikbaarheid tellen als bezet.', { margin: '0 0 10px' }));
    var duur = el('div', { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' });
    [30, 45, 60, 90, 120].forEach(function (m) {
      var g = plan.minutes === m;
      duur.appendChild(chipKnop(fmtMin(m), g, function () { plan.minutes = m; plan.result = null; renderPagina(); },
        { padding: '0 10px', border: '1px solid ' + (g ? T.brand : T.line) }));
    });
    planBox.appendChild(fieldLabel('Duur', duur));
    var per = el('div', { display: 'flex', gap: '4px', marginTop: '0' });
    [[1, '1 week'], [2, '2 weken'], [4, '4 weken']].forEach(function (w) {
      var g = !plan.tot && plan.weeks === w[0];
      per.appendChild(chipKnop(w[1], g, function () { plan.weeks = w[0]; plan.tot = ''; plan.result = null; renderPagina(); },
        { padding: '0 10px', border: '1px solid ' + (g ? T.brand : T.line) }));
    });
    planBox.appendChild(fieldLabel('Vooruit', per));
    // Of zelf een einddatum: zoeken tot en met die dag (hooguit een half jaar).
    var kz = maakKiezers();
    var totRij = el('div', { display: 'flex', alignItems: 'flex-end', gap: '8px', marginTop: '10px' });
    totRij.appendChild(fieldLabel('Of zoek tot en met', kz.datum(plan.tot, function (v) { plan.tot = v; plan.result = null; renderPagina(); })));
    if (plan.tot) {
      var wis = secondaryBtn('Wissen', function () { plan.tot = ''; plan.result = null; renderPagina(); });
      Object.assign(wis.style, { width: 'auto', padding: '0 12px', marginBottom: '8px' });
      totRij.appendChild(wis);
    }
    planBox.appendChild(totRij);
    planBox.appendChild(kz.host);
    planBox.appendChild(primaryBtn(plan.busy ? 'Bezig met zoeken…' : 'Vrije tijd zoeken', startPlan, plan.busy));
    if (plan.busy) { zorgVoorStijl(); var lb = laadBalk(); lb.style.marginTop = '10px'; planBox.appendChild(lb); }
    if (plan.error) planBox.appendChild(noteBox(plan.error, 'bad'));
    var uitslag = kopieUitslag();
    if (uitslag) planBox.appendChild(uitslag);
    var res = plan.result;
    if (res && !plan.busy) {
      if (!res.gaps.length) {
        planBox.appendChild(noteBox('Geen vrij blok van ' + fmtMin(res.minutes) + ' gevonden ' +
          (res.to ? 't/m ' + dayLabel(res.to) : 'in de komende ' + (res.weeks === 1 ? 'week' : res.weeks + ' weken')) + '.', 'warn'));
      } else {
        var lijst = el('div', { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' });
        res.gaps.forEach(function (g) {
          var kaart = clickCard(function () { BEWAARD.slot = { gap: g, minutes: res.minutes, start: null, error: '' }; naarPagina('vrijblok'); }, 'Opties voor dit vrije blok');
          Object.assign(kaart.style, { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 11px' });
          kaart.appendChild(el('span', { fontSize: '13px', fontWeight: '600', color: T.ink, flex: '0 0 74px' }, dayLabel(g.date)));
          kaart.appendChild(el('span', { fontSize: '13px', color: T.ink, flex: '1 1 auto', fontVariantNumeric: 'tabular-nums' }, hm(g.startMin) + ' – ' + hm(g.endMin)));
          // ons: wat ONS' eigen overlapcontrole zegt over het begin van dit blok.
          // Overlap met een reservering: dan 'Reservering' (met het label als uitleg).
          var resIn = reserveringenIn(g, g.startMin, res.minutes);
          var badge;
          if (resIn.length) {
            badge = el('span', Object.assign({}, TYPE.help, { flex: '0 0 auto', color: T.brand, fontWeight: '600' }), 'Reservering');
            badge.title = 'Reservering: ' + reserveringTekst(resIn);
            badge.setAttribute('data-reservering', resIn[0].label || '');
          } else if (g.ons === true) {
            badge = el('span', Object.assign({}, TYPE.help, { flex: '0 0 auto', color: T.warn, fontWeight: '600' }), 'ONS: overlap');
          } else {
            badge = el('span', Object.assign({}, TYPE.help, { flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }), fmtMin(g.minutes) + ' vrij');
          }
          kaart.appendChild(badge);
          var gekozen = momentenInBlok(g, res.minutes);
          if (gekozen) {
            var stip = el('span', { flex: '0 0 auto', minWidth: '18px', height: '18px', borderRadius: '9px', background: T.brand, color: '#fff', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', boxSizing: 'border-box' }, String(gekozen));
            stip.title = gekozen === 1 ? '1 moment gekozen in dit blok' : gekozen + ' momenten gekozen in dit blok';
            kaart.appendChild(stip);
          }
          if (g.ons === false && !resIn.length) {
            var vink = el('span', { flex: '0 0 auto', color: T.ok, fontSize: '13px', fontWeight: '700' }, '\u2713');
            vink.title = 'ONS meldt geen overlap';
            kaart.appendChild(vink);
          }
          var pijl = svgPath(CHEV_RECHTS, 16); pijl.style.color = T.brand; pijl.style.flex = '0 0 auto';
          kaart.appendChild(pijl);
          lijst.appendChild(kaart);
        });
        planBox.appendChild(lijst);
        planBox.appendChild(txt('help', 'Open een blok en tik op begintijden om ze te kiezen; dat kan in meerdere blokken. Je maakt de afspraak één keer, de hulp kopieert hem naar de andere momenten.', { margin: '8px 0 0' }));
        if (res.onsCheck === 'ready') planBox.appendChild(txt('help', '\u2713 betekent: ONS\u2019 eigen overlapcontrole is akkoord voor het begin van het blok.', { margin: '8px 0 0' }));
        else if (res.onsCheck === 'unknown') planBox.appendChild(txt('help', 'Open één keer een afspraak in ONS; daarna kijkt de planhulp elk blok ook na met de overlapcontrole van ONS.', { margin: '8px 0 0' }));
        else planBox.appendChild(txt('help', 'De overlapcontrole van ONS gaf een antwoord dat de hulp niet herkent; de blokken zijn alleen uit de agenda berekend.', { margin: '8px 0 0' }));
      }
    }
    return planBox;
  }

  function renderNav() {
    navBox.innerHTML = '';
    navBox.appendChild(navCard(ICON_RATIO, 'Verhouding per uursoort', 'Direct, indirect en reistijd per cliëntgebonden uursoort', function () { naarPagina('verhouding'); }));
    navBox.appendChild(navCard(ICON_RANGE, 'Open registraties', 'Controleer een periode op afspraken die nog niet geregistreerd zijn', function () { naarPagina('open'); }));
    navBox.appendChild(navCard(ICON_QUICK, 'Snel registreren', 'Registratieformulier openen met datum en tijd ingevuld', function () { naarPagina('snel'); }));
    navBox.appendChild(navCard(ICON_PLAN, 'Planhulp', 'Vrije tijd vinden voor een afspraak in de komende weken', function () { naarPagina('plan'); }));
  }

  /* ── Navigatie tussen pagina's ── */

  // Containers van React op de huidige pagina; vóór het leegmaken loskoppelen.
  var liveHost = null;
  // Per collega een eigen React-container in liveHost (bij één medewerker één).
  var liveSubs = {}, liveSleutel = '';
  function subsLos() {
    var b = bridge();
    Object.keys(liveSubs).forEach(function (k) { if (b && b.unmount) b.unmount(liveSubs[k]); });
    liveSubs = {}; liveSleutel = '';
  }
  function losKoppelen() {
    subsLos();
    liveHost = null;
  }
  // Containers voor deze personen klaarzetten (alleen opnieuw opbouwen als de
  // personen veranderen, anders verliest React zijn toestand).
  function subsVoor(personen) {
    var sleutel = personen.map(function (p) { return p.id + ':' + p.name; }).join('|');
    if (sleutel !== liveSleutel) {
      subsLos();
      liveHost.innerHTML = '';
      personen.forEach(function (p, i) {
        var blok = el('div', { marginTop: i ? '14px' : '0' });
        if (p.name) blok.appendChild(el('div', Object.assign({}, TYPE.label, { margin: '0 0 6px', color: T.ink }), p.name));
        var sub = el('div');
        blok.appendChild(sub);
        liveHost.appendChild(blok);
        liveSubs[p.id || ('p' + i)] = sub;
      });
      liveSleutel = sleutel;
    }
    return personen.map(function (p, i) { return liveSubs[p.id || ('p' + i)]; });
  }

  function naarPagina(p) {
    losKoppelen();
    pagina = p;
    BEWAARD.pagina = p;
    var opHoofd = pagina === 'hoofd';
    hoofd.style.display = opHoofd ? '' : 'none';
    paginaBox.style.display = opHoofd ? 'none' : '';
    leaveBar.style.display = (opHoofd && !(state && state.leaveRequest === false)) ? '' : 'none';
    title.textContent = PAGINA_TITEL[pagina] || PAGINA_TITEL.hoofd;
    info.style.background = pagina === 'info' ? T.brandWash : T.lineSoft;
    info.style.color = pagina === 'info' ? T.brand : T.inkSoft;
    renderPagina();
    mainCol.scrollTop = 0;
    if (p === 'verhouding') { ratio.offset = 0; laadRatio(); }
    // Meteen tonen wat er (vooraf geladen) klaarstaat: geen knop nodig.
    if (p === 'clienttijd' && !prod.result && !prod.busy && !prod.error) { vulStandaarden(); startProduction(); }
    if (p === 'open' && !range.result && !range.busy && !range.error) { vulStandaarden(); startRangeCheck(); }
    if (p === 'plan' && !plan.result && !plan.busy && !plan.error) startPlan();
  }

  // Tekstknop met icoon (Terug, Lijst bijwerken): licht, roze, geen rand.
  function tekstKnop(icoon, tekst, onClick, disabled) {
    var b = document.createElement('button');
    b.type = 'button';
    b.disabled = !!disabled;
    Object.assign(b.style, {
      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px 6px 6px',
      borderRadius: '8px', cursor: disabled ? 'default' : 'pointer', border: '0', background: 'transparent',
      color: disabled ? T.inkSoft : T.brand, font: '600 13px/1 ' + FONT
    });
    b.appendChild(svgPath(icoon, 16));
    b.appendChild(document.createTextNode(tekst));
    b.addEventListener('mouseenter', function () { if (!b.disabled) b.style.background = T.brandWash; });
    b.addEventListener('mouseleave', function () { b.style.background = 'transparent'; });
    focusRing(b);
    b.addEventListener('click', function (e) { e.preventDefault(); if (!b.disabled) onClick(); });
    return b;
  }
  function terugKnop() {
    // Een vrij blok hoort bij de planhulp: terug naar die lijst.
    var doel = pagina === 'vrijblok' ? 'plan' : 'hoofd';
    var back = tekstKnop(PIJL_TERUG, 'Terug', function () { naarPagina(doel); });
    back.style.margin = '0 0 10px -6px';
    return back;
  }

  /* ── Pagina's ── */

  // Eigen toestand per pagina, los van de pagina-toestand: die wordt bij elke
  // update vervangen, maar wat je invult of opvraagt moet blijven staan.
  var range = BEWAARD.range;
  var prod = BEWAARD.prod;
  var quick = BEWAARD.quick;
  var ratio = BEWAARD.ratio;
  var plan = BEWAARD.plan;

  function vulStandaarden() {
    if (!state) return;
    if (!range.from && state.rangeDefaultFrom) range.from = state.rangeDefaultFrom;
    if (!range.to && state.today) range.to = state.today;
    if (!prod.from && state.productionDefaultFrom) prod.from = state.productionDefaultFrom;
    // Standaard tot vier weken vooruit, zodat ook de planning zichtbaar is
    // (dezelfde periode die de pagina vooraf heeft geladen).
    if (!prod.to && state.today) prod.to = state.productionDefaultTo || plusWeken(state.today, 4);
    if (!quick.date && state.today) quick.date = state.today;
  }

  function weekNaam() {
    var w = state && state.week;
    return (w && w.opts && w.opts.week) ? 'week ' + w.opts.week : 'deze week';
  }

  // React-inhoud die met de pagina-toestand meeloopt (opbouw, verhouding).
  function renderLive() {
    if (!liveHost) return;
    var b = bridge();
    if (pagina === 'verhouding') {
      if (!ratio.result) return;
      if (!b) { liveHost.innerHTML = ''; liveHost.appendChild(noteBox('Kon niet laden (bundel ontbreekt).', 'bad')); return; }
      var rp = (ratio.result.persons && ratio.result.persons.length > 1) ? ratio.result.persons : [{ id: '', name: '', rows: ratio.result.rows || [] }];
      subsVoor(rp).forEach(function (sub, i) {
        b.renderCalcBody(sub, rp[i].rows || [], (state && state.nonClientMarker) || '*', fmtMin, T, ratio.result.mode);
      });
      return;
    }
    var w = state && state.week;
    if (!w || !w.summary) {
      subsLos();
      liveHost.innerHTML = '';
      liveHost.appendChild(txt('help', state && state.weekLoading ? 'Weekoverzicht wordt opgehaald…' : 'Nog geen weekoverzicht beschikbaar.'));
      return;
    }
    if (!b) { liveHost.innerHTML = ''; liveHost.appendChild(noteBox('Kon niet laden (bundel ontbreekt).', 'bad')); return; }
    if (pagina === 'clienttijd') {
      var cp = (w.perInvitee && w.perInvitee.length > 1) ? w.perInvitee : [{ id: '', name: '', summary: w.summary }];
      subsVoor(cp).forEach(function (sub, i) { b.renderBreakdownBody(sub, cp[i].summary, w.opts || {}, fmtMin, T); });
    }
  }

  function pageClientTime() {
    var box = el('div');
    box.appendChild(sectionHead('Opbouw ' + weekNaam(), true));
    liveHost = el('div');
    box.appendChild(liveHost);

    box.appendChild(sectionHead('Productieverloop', false));
    box.appendChild(txt('help', 'Directe, indirecte en reistijd per week in uren. Tot en met deze week uit je registraties, latere weken uit de planning (direct of indirect via het label). Hooguit 26 weken.', { margin: '0 0 10px' }));
    var rij = el('div', { display: 'flex', gap: '8px' });
    var k = maakKiezers();
    rij.appendChild(fieldLabel('Van', k.datum(prod.from, function (v) { prod.from = v; })));
    rij.appendChild(fieldLabel('Tot en met', k.datum(prod.to, function (v) { prod.to = v; })));
    box.appendChild(rij);
    box.appendChild(k.host);
    box.appendChild(primaryBtn(prod.busy ? 'Bezig met berekenen…' : 'Productieverloop berekenen', startProduction, prod.busy));
    if (prod.busy) box.appendChild(voortgang(prod.done, prod.total));
    if (prod.error) box.appendChild(noteBox(prod.error, 'bad'));
    if (prod.result && !prod.busy) {
      var weken = prod.result.weeks || [];
      if (!weken.length) box.appendChild(noteBox('Geen weken in deze periode.', 'warn'));
      else {
        var personen = (prod.result.persons && prod.result.persons.length > 1) ? prod.result.persons : [{ id: '', name: '', weeks: weken }];
        prod.tabelOpen = prod.tabelOpen || {};
        personen.forEach(function (p, i) {
          var grafiek = el('div', { marginTop: '14px', paddingTop: i ? '14px' : '0', borderTop: i ? '1px solid ' + T.line : '0' });
          grafiek.setAttribute('data-grafiek-persoon', p.id || 'een');
          if (p.name) grafiek.appendChild(txt('section', p.name));
          grafiek.appendChild(productionChart(p.weeks));
          // De tabel met dezelfde getallen, standaard ingeklapt.
          var sleutel = p.id || 'een';
          var open = !!prod.tabelOpen[sleutel];
          var wissel = tekstKnop(CHEV_RECHTS, open ? 'Tabel verbergen' : 'Tabel tonen', function () {
            prod.tabelOpen[sleutel] = !open; renderPagina();
          });
          wissel.setAttribute('aria-expanded', open ? 'true' : 'false');
          wissel.style.margin = '8px 0 0 -6px';
          var pijl = wissel.querySelector('svg');
          if (pijl) { pijl.style.transition = 'transform .15s ease'; pijl.style.transform = open ? 'rotate(90deg)' : 'none'; }
          grafiek.appendChild(wissel);
          if (open) grafiek.appendChild(productionTable(p.weeks));
          box.appendChild(grafiek);
        });
      }
    }
    return box;
  }

  // Verhouding per uursoort, per week te bladeren. Deze en eerdere weken:
  // geregistreerd; latere weken: gepland (direct/indirect uit de labels).
  function ratioDatum() { return plusWeken((state && state.viewDate) || (state && state.today), ratio.offset); }
  function laadRatio() {
    if (!actions.onWeekRatio) return;
    var datum = ratioDatum();
    ratio.busy = true; ratio.error = ''; ratio.voor = datum; ratio.result = null;
    if (pagina === 'verhouding') renderPagina();
    actions.onWeekRatio(datum, function (res) {
      if (ratio.voor !== datum) return; // ondertussen verder gebladerd
      ratio.busy = false;
      if (res && res.ok && res.result) ratio.result = res.result;
      else { ratio.result = null; ratio.error = (res && res.error) || 'Ophalen mislukt.'; }
      if (pagina === 'verhouding') renderPagina();
    });
  }
  function bladerKnop(icoon, label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    Object.assign(b.style, {
      width: '32px', height: '32px', borderRadius: '8px', border: '1px solid ' + T.line, background: '#fff',
      color: T.brand, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto'
    });
    b.appendChild(svgPath(icoon, 18));
    b.addEventListener('mouseenter', function () { b.style.borderColor = T.brand; });
    b.addEventListener('mouseleave', function () { b.style.borderColor = T.line; });
    focusRing(b);
    b.addEventListener('click', function (e) { e.preventDefault(); onClick(); });
    return b;
  }
  function ratioSkelet() {
    zorgVoorStijl();
    var wrap = el('div', { animation: 'onsAhPuls 1.4s ease-in-out infinite' });
    wrap.setAttribute('aria-hidden', 'true');
    wrap.appendChild(el('div', { height: '9px', width: '80%', borderRadius: '6px', background: T.lineSoft, margin: '0 0 14px' }));
    [0, 1].forEach(function () {
      var kaart = el('div', { border: '1px solid ' + T.line, borderRadius: '12px', padding: '12px', marginBottom: '8px' });
      kaart.appendChild(el('div', { height: '11px', width: '60%', borderRadius: '6px', background: T.lineSoft, margin: '0 0 12px' }));
      ['85%', '40%', '20%'].forEach(function (bw) {
        kaart.appendChild(el('div', { height: '8px', width: '35%', borderRadius: '6px', background: T.lineSoft, margin: '0 0 6px' }));
        kaart.appendChild(el('div', { height: '4px', width: bw, borderRadius: '2px', background: T.line, margin: '0 0 12px' }));
      });
      wrap.appendChild(kaart);
    });
    return wrap;
  }
  function pageRatio() {
    var box = el('div');
    var r0 = ratio.result;
    var doel = maandagVan(ratioDatum());
    var nav = el('div', { display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px' });
    nav.appendChild(bladerKnop('M15 5.4 8.4 12 15 18.6 16.4 17.2 11.2 12 16.4 6.8z', 'Vorige week', function () { ratio.offset--; laadRatio(); }));
    var midden = el('div', { flex: '1 1 auto', textAlign: 'center', minWidth: '0' });
    // Het weeknummer staat er meteen, ook tijdens het laden.
    midden.appendChild(el('div', Object.assign({}, TYPE.section, { margin: '0' }), 'Week ' + ((r0 && r0.week) || isoWeek(doel) || '')));
    var sub = ratio.busy ? 'ophalen…' : (r0 ? (r0.mode === 'gepland' ? 'gepland' : 'geregistreerd') : '');
    midden.appendChild(txt('help', (sub ? sub + ' · ' : '') + 'vanaf ' + dayLabel(doel)));
    nav.appendChild(midden);
    nav.appendChild(bladerKnop(CHEV_RECHTS, 'Volgende week', function () { ratio.offset++; laadRatio(); }));
    box.appendChild(nav);
    if (ratio.busy) {
      box.appendChild(laadBalk());
      box.appendChild(ratioSkelet());
      return box;
    }
    if (ratio.error) { box.appendChild(noteBox(ratio.error, 'bad')); return box; }
    liveHost = el('div');
    box.appendChild(liveHost);
    return box;
  }

  // Groen vinkje (afgewerkt).
  function vinkje() {
    var v = svgSpineCheck();
    v.setAttribute('width', '14'); v.setAttribute('height', '14');
    Object.assign(v.style, { color: T.ok, flex: '0 0 auto', width: '14px', height: '14px' });
    return v;
  }
  function rangeResultEl(r) {
    var wrap = el('div', { marginTop: '14px' });
    var t = telOpen(r, range.afgewerkt);
    if (!t.count) {
      wrap.appendChild(noteBox('Alles geregistreerd van ' + dayLabel(r.from) + ' t/m ' + dayLabel(r.to) + '.', 'ok'));
      return wrap;
    }
    // Kop: hoeveel er nog open staat en hoever de afwerklijst is.
    var kop = el('div', { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', margin: '0 0 6px' });
    var open = t.count - t.done;
    kop.appendChild(txt('section', open ? (open + (open === 1 ? ' afspraak' : ' afspraken') + ' open · ' + fmtMin(t.openMinutes)) : 'Alles afgewerkt', { margin: '0' }));
    if (t.late > 0) kop.firstChild.appendChild(tag('te laat: ' + t.late, 'bad'));
    var teller = txt('label', null, { flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: '4px', fontVariantNumeric: 'tabular-nums' });
    teller.appendChild(vinkje());
    teller.appendChild(document.createTextNode(t.done + ' van ' + t.count));
    teller.title = t.done + ' van ' + t.count + ' afgewerkt';
    kop.appendChild(teller);
    wrap.appendChild(kop);
    var spoor = el('div', { height: '4px', borderRadius: '999px', background: T.lineSoft, overflow: 'hidden', margin: '0 0 10px' });
    spoor.setAttribute('role', 'progressbar');
    spoor.setAttribute('aria-label', 'Afgewerkt');
    spoor.setAttribute('aria-valuemin', '0'); spoor.setAttribute('aria-valuemax', String(t.count)); spoor.setAttribute('aria-valuenow', String(t.done));
    spoor.appendChild(el('div', { height: '100%', width: Math.round(t.done / t.count * 100) + '%', background: T.ok, transition: 'width .3s ease' }));
    wrap.appendChild(spoor);

    var list = el('div', { display: 'flex', flexDirection: 'column', gap: '6px' });
    r.days.forEach(function (d) {
      var dagKlaar = d.items.every(function (it) { return range.afgewerkt[it.key]; });
      var card = clickCard(function () { if (actions.onJumpToDay) actions.onJumpToDay(d.date, true); }, 'Klik om naar deze dag te gaan');
      if (dagKlaar) card.style.background = T.okWash;
      var head = el('div', { display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: '600', color: T.ink, marginBottom: '2px' });
      if (dagKlaar) {
        var ok = svgSpineCheck(); ok.setAttribute('width', '13'); ok.setAttribute('height', '13');
        Object.assign(ok.style, { color: T.ok, marginRight: '6px', flex: '0 0 auto' });
        head.appendChild(ok);
      }
      head.appendChild(document.createTextNode(dayLabel(d.date)));
      var dagLaat = d.items.filter(function (it) { return it.late && !range.afgewerkt[it.key]; }).length;
      if (dagLaat > 0) head.appendChild(tag('te laat: ' + dagLaat, 'bad'));
      var ws = (state && state.windowStatus || {})[d.date];
      if (ws === 'soon' && !dagKlaar) head.appendChild(tag('verloopt binnenkort', 'warn'));
      card.appendChild(head);
      d.items.forEach(function (it) {
        var klaar = !!range.afgewerkt[it.key];
        var row = el('div', { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: klaar ? T.inkSoft : T.ink, marginTop: '4px', fontVariantNumeric: 'tabular-nums' });
        var dt = new Date(it.start);
        var tijd = el('span', { fontWeight: '600', flex: '0 0 auto', textDecoration: klaar ? 'line-through' : 'none' }, ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2));
        row.appendChild(tijd);
        row.appendChild(el('span', { color: T.inkSoft, flex: '0 0 auto' }, fmtMin(it.minutes)));
        row.appendChild(el('span', { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: klaar ? 'line-through' : 'none' }, (it.persoon ? it.persoon + ' · ' : '') + (it.uursoort || '')));
        if (klaar) {
          var v = vinkje();
          v.setAttribute('data-afgewerkt', '1');
          v.setAttribute('aria-label', 'Afgewerkt');
          v.setAttribute('role', 'img');
          v.removeAttribute('aria-hidden');
          row.appendChild(v);
        } else {
          row.appendChild(tag(it.client ? 'cliënt' : 'overig', it.client ? 'ok' : null));
        }
        card.appendChild(row);
      });
      list.appendChild(card);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function pageOpen() {
    var box = el('div');
    box.appendChild(txt('help', 'Haalt elke week in deze periode op bij ONS (hooguit 26 weken) en toont per dag welke afgelopen afspraken nog niet geregistreerd zijn.', { margin: '0 0 10px' }));
    var rij = el('div', { display: 'flex', gap: '8px' });
    var k = maakKiezers();
    rij.appendChild(fieldLabel('Van', k.datum(range.from, function (v) { range.from = v; })));
    rij.appendChild(fieldLabel('Tot en met', k.datum(range.to, function (v) { range.to = v; })));
    box.appendChild(rij);
    box.appendChild(k.host);
    box.appendChild(primaryBtn(range.busy ? 'Bezig met controleren…' : 'Controleren', startRangeCheck, range.busy));
    if (range.busy) box.appendChild(voortgang(range.done, range.total));
    if (range.error) box.appendChild(noteBox(range.error, 'bad'));
    if (range.result && !range.busy) {
      // Afwerklijst bijwerken: gebeurt vanzelf als je terugkomt in het
      // zijpaneel; deze knop doet het meteen.
      box.appendChild(rangeResultEl(range.result));
      var voet = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '8px' });
      voet.appendChild(txt('help', 'Registreer je een afspraak of zet je hem op \u2018niet registreren\u2019, dan wordt hij hier afgevinkt.', { flex: '1 1 auto' }));
      var bij = tekstKnop(ICON_VERVERS, range.bijwerken ? 'Bijwerken…' : 'Bijwerken', function () { hercontrole(); }, range.bijwerken);
      bij.style.flex = '0 0 auto';
      voet.appendChild(bij);
      box.appendChild(voet);
    }
    return box;
  }

  function pageQuick() {
    var box = el('div');
    box.appendChild(txt('help', 'Opent het registratieformulier van ONS met deze tijden ingevuld. Registreer je een afspraak? Open dan de afspraak zelf, zodat de registratie eraan gekoppeld wordt.', { margin: '0 0 10px' }));
    var k = maakKiezers();
    var rij = el('div', { display: 'flex', gap: '8px' });
    rij.appendChild(fieldLabel('Datum', k.datum(quick.date, function (v) { quick.date = v; quick.overlap = ''; })));
    rij.appendChild(fieldLabel('Begintijd', k.tijd(quick.time, function (v) { quick.time = v; quick.overlap = ''; })));
    box.appendChild(rij);
    box.appendChild(k.host);
    var rij2 = el('div', { display: 'flex', gap: '8px', marginTop: '10px' });
    function duurKiezer() {
      var w = el('div', { display: 'flex', flexWrap: 'wrap', gap: '4px' });
      var vast = ['15', '30', '45', '60', '90', '120'];
      vast.forEach(function (m) {
        var g = String(quick.minutes) === m;
        w.appendChild(chipKnop(fmtMin(+m), g, function () { quick.minutes = m; quick.overlap = ''; renderPagina(); },
          { padding: '0 10px', border: '1px solid ' + (g ? T.brand : T.line) }));
      });
      var eigen = inputEl('number', vast.indexOf(String(quick.minutes)) === -1 ? quick.minutes : '', function (v) { quick.minutes = v; quick.overlap = ''; });
      eigen.min = '5'; eigen.max = '1440'; eigen.step = '5'; eigen.placeholder = 'min';
      eigen.setAttribute('aria-label', 'Andere duur in minuten');
      Object.assign(eigen.style, { width: '64px', height: '32px', padding: '0 8px' });
      w.appendChild(eigen);
      return w;
    }
    // Duur als chips; 'Anders' voor een eigen aantal minuten.
    rij2.appendChild(fieldLabel('Duur', duurKiezer()));
    box.appendChild(rij2);
    if (quick.overlap) {
      box.appendChild(noteBox(quick.overlap, 'warn'));
      box.appendChild(primaryBtn(quick.busy ? 'Openen…' : 'Toch openen', function () { startQuickRegister(true); }, quick.busy));
    } else {
      box.appendChild(primaryBtn(quick.busy ? 'Controleren…' : 'Formulier openen', function () { startQuickRegister(false); }, quick.busy));
    }
    if (quick.error) box.appendChild(noteBox(quick.error, 'bad'));
    return box;
  }

  // Wat ONS' eigen overlapcontrole zegt over het gekozen tijdstip. Vraagt het
  // na bij elke andere begintijd; het antwoord komt in sl.ons.
  function onsSlotRegel(sl, date, duur) {
    var sleutel = date + '|' + sl.start + '|' + duur;
    if (actions.onSlotCheck && (!sl.ons || sl.ons.key !== sleutel)) {
      sl.ons = { key: sleutel, busy: true };
      actions.onSlotCheck({ date: date, startMin: sl.start, minutes: duur }, function (res) {
        if (!sl.ons || sl.ons.key !== sleutel) return;
        sl.ons = { key: sleutel, busy: false, status: (res && res.status) || 'unknown', overlap: res ? res.overlap : null };
        // Niet midden in de lopende opbouw opnieuw tekenen (antwoord kan direct komen).
        setTimeout(function () { if (pagina === 'vrijblok' && BEWAARD.slot === sl) renderPagina(); }, 0);
      });
    }
    var o = sl.ons || {}, regel;
    var resIn = reserveringenIn(sl.gap, sl.start, duur);
    // Valt de tijd in een reservering, dan staat dat al bij de begintijd (R);
    // een overlap van ONS is dan de reservering zelf.
    if (resIn.length && !o.busy) {
      regel = o.overlap === true ? noteBox('ONS meldt overlap: dit valt in de reservering ' + reserveringTekst(resIn) + '.', 'warn') : el('div');
    } else if (o.busy) regel = txt('help', 'ONS kijkt dit tijdstip na…', { margin: '8px 0 0' });
    // Geen overlap: niets tonen (alleen afwijkingen verdienen een regel).
    else if (o.status === 'ready' && o.overlap === false) regel = el('div');
    else if (o.status === 'ready' && o.overlap === true) regel = noteBox('ONS meldt overlap met een andere afspraak op dit tijdstip.', 'warn');
    else if (o.status === 'unknown') regel = txt('help', 'Nog niet nagekeken bij ONS: open één keer een afspraak in ONS, dan leert de hulp de overlapcontrole.', { margin: '8px 0 0' });
    else regel = txt('help', 'ONS\u2019 overlapcontrole gaf geen herkenbaar antwoord.', { margin: '8px 0 0' });
    if (regel.childNodes.length && regel.style && !regel.style.margin) regel.style.margin = '8px 0 0';
    return regel;
  }

  // Een vrij blok uit de planhulp: tik op begintijden om ze te kiezen (aan/uit).
  // Gekozen momenten staan in de balk onderin; daar maak je de afspraak.
  function pageSlot() {
    var box = el('div');
    var sl = BEWAARD.slot;
    if (!sl) { box.appendChild(txt('help', 'Kies eerst een vrij blok in de planhulp.')); return box; }
    var g = sl.gap, duur = sl.minutes;
    var kop = el('div', { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' });
    kop.appendChild(txt('section', dayLabel(g.date) + ' · ' + hm(g.startMin) + ' – ' + hm(g.endMin)));
    var dag = el('button', { border: '0', background: 'transparent', color: T.brand, cursor: 'pointer', font: '600 12.5px ' + FONT, padding: '0', whiteSpace: 'nowrap' }, 'Naar deze dag');
    dag.type = 'button';
    dag.title = 'Deze dag openen in de agenda';
    dag.addEventListener('click', function () { if (actions.onJumpToDay) actions.onJumpToDay(g.date, true); });
    kop.appendChild(dag);
    box.appendChild(kop);
    box.appendChild(txt('help', fmtMin(g.minutes) + ' vrij · afspraak van ' + fmtMin(duur) + '. Tik op een begintijd om hem te kiezen.', { margin: '2px 0 10px' }));
    var starts = el('div', { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' });
    var metRes = [];
    for (var m = g.startMin; m + duur <= g.endMin; m += 15) {
      (function (m) {
        var gek = momentIndex(g.date, m) >= 0;
        var res = reserveringenIn(g, m, duur);
        if (res.length) res.forEach(function (r) { if (metRes.indexOf(r) < 0) metRes.push(r); });
        var c = chipKnop((gek ? '\u2713 ' : '') + hm(m), gek, function () {
          var aan = momentIndex(g.date, m) < 0;
          wisselMoment(g.date, m);
          sl.start = aan ? m : null;
          renderPagina();
        }, { width: '100%', height: '34px', border: '1px ' + (res.length && !gek ? 'dashed ' : 'solid ') + (gek ? T.brand : T.line) });
        if (res.length) {
          var r = el('small', { fontSize: '10px', fontWeight: '700', marginLeft: '4px', opacity: '.8' }, 'R');
          c.appendChild(r);
          c.title = 'Valt in reservering: ' + reserveringTekst(res);
          c.setAttribute('data-reservering', res[0].label || '');
        }
        c.setAttribute('data-start', hm(m));
        c.setAttribute('aria-pressed', gek ? 'true' : 'false');
        starts.appendChild(c);
      })(m);
    }
    box.appendChild(fieldLabel('Begintijd', starts));
    if (metRes.length) box.appendChild(txt('help', 'R = valt in reservering ' + reserveringTekst(metRes), { margin: '8px 0 0' }));
    // Per gekozen tijd in dit blok: andere instellingen dan de rest?
    var hier = BEWAARD.momenten.slice(1).filter(function (x) { return x.date === g.date && x.startMin >= g.startMin && x.startMin + duur <= g.endMin; });
    if (hier.length && BEWAARD.momenten.length > 1) {
      var vinken = el('div', { display: 'flex', flexDirection: 'column', gap: '6px', margin: '10px 0 0' });
      // Eén gekozen tijd in dit blok: alleen de tekst; meer: met de tijd ervoor.
      hier.forEach(function (x) { vinken.appendChild(eigenVinkje(x, (hier.length > 1 ? hm(x.startMin) + ' · ' : '') + 'Apart afspraakformulier')); });
      box.appendChild(vinken);
    }
    // ONS' overlapcontrole voor de laatst gekozen begintijd.
    if (sl.start != null && momentIndex(g.date, sl.start) >= 0) box.appendChild(onsSlotRegel(sl, g.date, duur));
    if (sl.error) box.appendChild(noteBox(sl.error, 'bad'));
    var uitslag = kopieUitslag();
    if (uitslag) box.appendChild(uitslag);
    return box;
  }

  function pageInfo() {
    var box = el('div');
    box.appendChild(txt('help', 'Gebruik de Agendahulp voor een duidelijk agenda-overzicht.', { margin: '0 0 12px' }));
    box.appendChild(sectionHead('Legenda (' + ((state && state.windowLabel) || '08:00–17:00') + ')', true));
    var wrap = el('div', { display: 'flex', flexDirection: 'column', gap: '6px' });
    ((state && state.legend) || []).forEach(function (item) {
      var row = el('div', { display: 'flex', alignItems: 'center', gap: '8px' });
      row.appendChild(el('span', { width: '12px', height: '12px', borderRadius: '4px', background: item.color, border: '1px solid rgba(0,0,0,.12)', flex: '0 0 auto' }));
      row.appendChild(el('span', TYPE.text, item.text));
      wrap.appendChild(row);
    });
    box.appendChild(wrap);
    box.appendChild(txt('help', 'Versie ' + ((state && state.version) || ''), { marginTop: '14px', paddingTop: '10px', borderTop: '1px solid ' + T.line }));
    return box;
  }

  // Tekent de huidige (niet-hoofd)pagina opnieuw. Gebeurt bij het openen en bij
  // een eigen actie, niet bij elke pagina-update: dat zou een half ingevuld
  // veld wissen. De React-inhoud loopt wel mee via renderLive().
  // Balk met gekozen momenten in de voet: alleen op de planhulp-pagina's.
  function renderBalk() {
    balkHost.innerHTML = '';
    if ((pagina === 'plan' || pagina === 'vrijblok') && BEWAARD.momenten.length) balkHost.appendChild(momentenBalk());
  }
  function renderPagina() {
    losKoppelen();
    paginaBox.innerHTML = '';
    renderBalk();
    if (pagina === 'hoofd') return;
    vulStandaarden();
    paginaBox.appendChild(terugKnop());
    var inhoud = pagina === 'clienttijd' ? pageClientTime()
      : pagina === 'verhouding' ? pageRatio()
      : pagina === 'open' ? pageOpen()
      : pagina === 'snel' ? pageQuick()
      : pagina === 'vrijblok' ? pageSlot()
      : pagina === 'plan' ? pagePlan()
      : pageInfo();
    paginaBox.appendChild(inhoud);
    renderLive();
  }

  /* ── Acties ── */

  function startRangeCheck() {
    if (range.busy || !actions.onCheckRange) return;
    range.busy = true; range.done = 0; range.total = 0; range.error = ''; range.result = null;
    renderPagina();
    range.afgewerkt = {};
    actions.onCheckRange(range.from, range.to, function (res) {
      range.busy = false;
      range.laatst = Date.now();
      if (res && res.ok && res.result) range.result = { from: res.result.from, to: res.result.to, days: res.result.days.map(function (d) { return { date: d.date, items: d.items }; }) };
      else range.error = (res && res.error) || 'Controleren mislukt.';
      if (pagina === 'open') renderPagina();
      // Vooraf geladen lijst: meteen tonen, en direct vers bijwerken zodat wat
      // intussen geregistreerd is, al afgevinkt staat.
      if (res && res.ok && res.uitCache) { range.laatst = 0; hercontrole(); }
    });
  }
  // Dezelfde periode opnieuw controleren en de lijst afvinken. Stil: de lijst
  // blijft staan, alleen de knop toont dat er bijgewerkt wordt.
  function hercontrole() {
    if (!range.result || range.busy || range.bijwerken || !actions.onCheckRange) return;
    range.bijwerken = true;
    if (pagina === 'open') renderPagina();
    actions.onCheckRange(range.result.from, range.result.to, function (res) {
      range.bijwerken = false;
      range.laatst = Date.now();
      if (res && res.ok && res.result && range.result) range.result = mergeOpenRange(range.result, res.result, range.afgewerkt);
      if (pagina === 'open') renderPagina();
    }, true);
  }
  // Terug in het zijpaneel (na iets in ONS te hebben gedaan): lijst bijwerken.
  function bijFocus() {
    if (pagina === 'open' && range.result && Date.now() - range.laatst > 3000) hercontrole();
  }
  window.addEventListener('focus', bijFocus);
  // Ook terug met de muis in het zijpaneel, of het zijpaneel weer zichtbaar.
  root.addEventListener('mouseenter', bijFocus);
  function bijZichtbaar() { if (document.visibilityState === 'visible') bijFocus(); }
  document.addEventListener('visibilitychange', bijZichtbaar);
  // De agenda in ONS verandert (bijv. een afspraak is net geregistreerd of op
  // 'niet registreren' gezet): het content-script stuurt dan een nieuwe
  // toestand. Even wachten tot ONS klaar is, dan de lijst bijwerken.
  var planTimer = null;
  function planHercontrole() {
    if (pagina !== 'open' || !range.result) return;
    if (planTimer) clearTimeout(planTimer);
    planTimer = setTimeout(function () { planTimer = null; bijFocus(); }, 1500);
  }
  function startProduction() {
    if (prod.busy || !actions.onProduction) return;
    prod.busy = true; prod.done = 0; prod.total = 0; prod.error = ''; prod.result = null;
    renderPagina();
    actions.onProduction(prod.from, prod.to, function (res) {
      prod.busy = false;
      if (res && res.ok && res.result) prod.result = res.result;
      else prod.error = (res && res.error) || 'Berekenen mislukt.';
      if (pagina === 'clienttijd') renderPagina();
    });
  }
  function startQuickRegister(force) {
    if (quick.busy || !actions.onQuickRegister) return;
    quick.busy = true; quick.error = ''; if (!force) quick.overlap = '';
    renderPagina();
    actions.onQuickRegister({ date: quick.date, time: quick.time, minutes: quick.minutes, force: !!force }, function (res) {
      quick.busy = false;
      if (res && res.ok) { quick.overlap = ''; quick.error = ''; }
      else if (res && res.overlap) quick.overlap = res.overlap;
      else quick.error = (res && res.error) || 'Openen mislukt.';
      if (pagina === 'snel') renderPagina();
    });
  }

  function render() {
    paintOnoff();
    if (pagina !== 'hoofd') { renderLive(); return; }
    // Beheer kan de verlofknop uitzetten (config.features.leaveRequest).
    leaveBar.style.display = (state && state.leaveRequest === false) ? 'none' : '';
    renderStatus();
    renderTotals();
    renderWeek();
  }

  renderNav();
  render();
  // Na opnieuw opbouwen (paginawissel in ONS) terug naar de pagina waar je was;
  // stond je op de afwerklijst, dan meteen bijwerken.
  if (vorigePagina && vorigePagina !== 'hoofd') {
    naarPagina(vorigePagina);
    if (vorigePagina === 'open' && range.result) setTimeout(hercontrole, 0);
  }

  return {
    update: function (next) {
      var vorigeSig = vergelijkSig;
      state = next || null;
      // Andere medewerker (invitee) in de URL: resultaten van de vorige horen
      // er niet meer bij. Terug naar de hoofdpagina met een schone lei.
      var inv = state && state.inviteeId;
      if (inv && BEWAARD.inviteeId && inv !== BEWAARD.inviteeId) {
        legeResultaten();
        range = BEWAARD.range; prod = BEWAARD.prod; ratio = BEWAARD.ratio; plan = BEWAARD.plan;
        BEWAARD.inviteeId = inv;
        vergelijkSig = '';
        naarPagina('hoofd');
        render();
        return;
      }
      if (inv) BEWAARD.inviteeId = inv;
      render();
      // Alleen bijwerken als er echt iets in de agenda veranderde.
      vergelijkSig = state ? JSON.stringify([state.past, state.unfinished, state.week && state.week.summary]) : '';
      if (vorigeSig && vergelijkSig !== vorigeSig) planHercontrole();
    },
    // Uitslag van de kopieën (content-script, na het opslaan in ONS).
    setDuplicates: function (info) {
      BEWAARD.kopie = { made: (info && info.made) || [], failed: (info && info.failed) || [], reason: (info && info.reason) || '', next: (info && info.next) || null, left: (info && info.left) || 0 };
      if (!BEWAARD.kopie.reason && !BEWAARD.kopie.failed.length) BEWAARD.momenten = [];
      if (pagina === 'plan' || pagina === 'vrijblok') renderPagina();
    },
    setRangeProgress: function (kind, done, total) {
      var doel = kind === 'productie' ? prod : range;
      if (!doel.busy) return;
      doel.done = done; doel.total = total;
      if ((kind === 'productie' && pagina === 'clienttijd') || (kind !== 'productie' && pagina === 'open')) renderPagina();
    },
    destroy: function () {
      window.removeEventListener('focus', bijFocus);
      document.removeEventListener('visibilitychange', bijZichtbaar);
      if (planTimer) clearTimeout(planTimer);
      try { var b = bridge(); if (b) { b.unmount(weekHost); if (liveHost) b.unmount(liveHost); } } catch (e) {}
      if (root.parentNode) root.parentNode.removeChild(root);
    }
  };
}
