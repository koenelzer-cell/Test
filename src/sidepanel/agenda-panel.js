import { buren, extraKmVan, planMany } from './multi-plan.js';
import { qrSvg } from './qr.js';
import { feestdagAnimatie, feestdagIcoon, feestdagSlinger, feestdagStijl } from './feestdagen.js';
import { rondleidingActief, rondleidingGedaan, sluitRondleiding, startRondleiding } from './rondleiding.js';
import { embedUrl, mapsUrls, normPostcode, optimizeRoute, roadMatrix, vraagRoutes } from './geo.js';
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
var WD_LANG = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
var MON_LANG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
// 'Donderdag 8 oktober' (lang) of 'Do 8 oktober' (kort).
function dagLang(date, kort) {
  var d = new Date(date + 'T00:00:00');
  if (isNaN(d.getTime())) return date;
  var w = WD_LANG[d.getDay()];
  return (kort ? w.slice(0, 2) : w) + ' ' + d.getDate() + ' ' + MON_LANG[d.getMonth()];
}
// 'van 9:00 tot 12:00' zonder voorloopnul.
function vanTot(a, b) { var f = function (m) { return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }; return 'van ' + f(a) + ' tot ' + f(b); }
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
// Route: kaartspeld.
var ICON_ROUTE = 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z';
// Vraagteken in een rondje (rondleiding).
var ICON_HELP = 'M11 18h2v-2h-2zm1-16a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 4 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 0 0-4-4z';
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
  return txt('help', 'Cliënt ' + fmtHM(client) + ', overig ' + fmtHM(overig) + ', totaal ' + fmtHM(client + overig),
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
  // pc: postcode van de cliënt (optioneel) voor de afstand; sorteer: 'tijd' | 'afstand'.
  plan: { minutes: 60, weeks: 2, tot: '', busy: false, result: null, error: '' },
  // Planhulp: gekozen momenten [{ date, startMin }] voor één afspraak die na
  // het opslaan wordt gekopieerd; kopie: uitslag van de laatste kopieerronde.
  momenten: [],
  kopie: null,
  balkOpen: false,
  // Route van de dag (geen cache van adressen buiten dit paneel).
  route: { date: '', busy: false, result: null, error: '' },
  inviteeId: null
};
function legeResultaten() {
  BEWAARD.range = { from: '', to: '', busy: false, done: 0, total: 0, result: null, error: '', afgewerkt: {}, bijwerken: false, laatst: 0 };
  BEWAARD.prod = { from: '', to: '', busy: false, done: 0, total: 0, result: null, error: '' };
  BEWAARD.ratio = { offset: 0, busy: false, result: null, error: '', voor: '' };
  BEWAARD.plan = { minutes: BEWAARD.plan ? BEWAARD.plan.minutes : 60, weeks: BEWAARD.plan ? BEWAARD.plan.weeks : 2, tot: BEWAARD.plan ? BEWAARD.plan.tot : '', dagen: BEWAARD.plan ? BEWAARD.plan.dagen : null, busy: false, result: null, error: '' };
  BEWAARD.momenten = [];
  BEWAARD.kopie = null;
  BEWAARD.balkOpen = false;
  BEWAARD.route = { date: '', busy: false, result: null, error: '' };
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
  open: 'Open registraties', snel: 'Snel registreren', info: 'Over de Agendahulp', plan: 'Planhulp', route: 'Route van de dag', maken: 'Afspraak maken'
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
    // Staat alles goed aan, dan geen melding (alleen uit of nog te kiezen).
    else { statusBox.style.display = 'none'; return; }
    statusBox.style.display = '';
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
  // Zoeken. Een nieuwe zoekactie gaat altijd door (ook als er nog een loopt):
  // het antwoord van een oudere telt dan niet meer. houd: het huidige
  // resultaat blijven tonen tot het nieuwe er is (dagen, 'Meer laden').
  var planNr = 0;
  var PLAN_STAP = 24;
  function startPlan(houd) {
    if (!actions.onFreeSlots) return;
    var mijn = ++planNr;
    plan.busy = true; plan.error = '';
    if (!houd) plan.result = null;
    if (pagina === 'plan') renderPagina();
    var voor = plan;
    actions.onFreeSlots(plan.minutes, plan.weeks, function (res) {
      if (BEWAARD.plan !== voor || mijn !== planNr) return;
      plan.busy = false; plan.meerBezig = false;
      if (!(res && res.ok && res.result)) plan.error = (res && res.error) || 'Zoeken mislukt.';
      else plan.result = res.result;
      if (pagina === 'plan') setTimeout(function () { if (pagina === 'plan' && mijn === planNr) { renderPagina(); misschienRondleiding(); } }, 0);
    }, plan.tot, false, false, '', gekozenDagen(), plan.limit || PLAN_STAP);
  }
  // Dagen aan- of uitvinken: meteen zichtbaar (filter in het paneel), het
  // nieuwe zoeken pas als je even niets meer aanklikt.
  var dagenTimer = null;
  function dagenGewijzigd() {
    renderPagina();
    clearTimeout(dagenTimer);
    dagenTimer = setTimeout(function () { plan.limit = PLAN_STAP; startPlan(true); }, 300);
  }
  // Meer laden: meer blokken in dezelfde periode, of (als de periode op is)
  // twee weken verder zoeken, tot een half jaar vooruit.
  function meerLaden(res) {
    plan.meerBezig = true;
    if (res.gaps.length >= (plan.limit || PLAN_STAP)) plan.limit = (plan.limit || PLAN_STAP) + PLAN_STAP;
    else plan.tot = verderTot(res);
    startPlan(true);
  }
  function verderTot(res) {
    var laatste = res.lastDate || res.to;
    if (!laatste) return '';
    var d = datumUitYmd(laatste); d.setDate(d.getDate() + 14);
    var grens = new Date(); grens.setHours(0, 0, 0, 0); grens.setDate(grens.getDate() + 181);
    return d > grens ? '' : ymdVan(d);
  }
  // Dagenfilter in het paneel: meteen zichtbaar, ook op een resultaat van
  // voor de wijziging (en in het weekraster).
  function opGekozenDag(date) { var a = gekozenDagen(); return !a || a.indexOf(datumUitYmd(date).getDay()) >= 0; }
  function metDagen(res) {
    if (!res || !gekozenDagen()) return res;
    return Object.assign({}, res, { gaps: (res.gaps || []).filter(function (g) { return opGekozenDag(g.date); }), holidays: (res.holidays || []).filter(function (h) { return opGekozenDag(h.date); }) });
  }
  function kanMeer(res) { return res.gaps.length >= (plan.limit || PLAN_STAP) || !!verderTot(res); }
  // Dagenfilter: [1..5] (1 = maandag); null of alle vijf = alle dagen.
  function gekozenDagen() { return plan.dagen && plan.dagen.length && plan.dagen.length < 5 ? plan.dagen.slice() : null; }
  /* ── Meerdere momenten: één afspraak, daarna kopieën ── */
  // Reserveringen (uit het vrije blok) die [start, start+duur) raken.
  function reserveringenIn(g, start, duur) {
    return (g.reservations || []).filter(function (r) { return r.startMin < start + duur && r.endMin > start; });
  }
  function reserveringTekst(rs) {
    return rs.map(function (r) { return (r.label || 'Reservering') + ' (' + hm(r.startMin) + ' tot ' + hm(r.endMin) + ')'; }).join(', ');
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
    else if (!fAan('plannerCopies')) BEWAARD.momenten = [{ date: date, startMin: startMin }]; // kopieën uit: één moment
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
        rij.appendChild(el('span', { flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }, hm(m.startMin) + ' tot ' + hm(m.startMin + plan.minutes)));
        // Het eerste moment is het formulier zelf: geen vinkje.
        var vink = i === 0 || kanDirect() ? el('span', { flex: '1 1 auto' }) : eigenVinkje(m, 'Apart formulier');
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
      var viaForm = function () { maakOpMomenten(function (f) { foutHost.innerHTML = ''; foutHost.appendChild(noteBox(f, 'bad')); }); };
      // Meteen in ONS maken: cliënt(en), type en uursoort kies je op de volgende pagina.
      if (kanDirect()) { naarMaken(BEWAARD.momenten, plan.minutes); return; }
      viaForm();
    });
    Object.assign(knop.style, { marginTop: '0', flex: '1 1 auto', width: 'auto' });
    var aantalEigen = BEWAARD.momenten.filter(function (m) { return m.eigen; }).length;
    if (kanDirect()) knop.title = 'Kies cliënt(en), afspraaktype en uursoort; de hulp maakt ' + (n > 1 ? 'de afspraken' : 'de afspraak') + ' meteen in ONS.';
    else knop.title = n > 1 ? 'Je maakt de afspraak één keer in ONS; na het opslaan maakt de hulp hem ook op de andere momenten' +
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

  /* ── Cliënt zoeken (zoals in ONS) ── */
  // Cliënt zoeken: pas als je even stopt met typen (ONS zelf zoekt bij elke
  // letter); een later antwoord op een oude zoekterm telt niet meer.
  // r: { zoek, name, clientId, pc, pcUitOns, treffers }; naKiezen: na een keuze.
  function clientZoeker(r, nr, naKiezen) {
    var wrap = el('div', { flex: '1 1 auto', minWidth: '0' });
    var veld = el('div', { position: 'relative' });
    var inp = inputEl('text', r.name || r.zoek, function () {});
    inp.placeholder = 'Naam cliënt';
    inp.setAttribute('data-client-zoek', String(nr));
    inp.setAttribute('autocomplete', 'off');
    inp.style.width = '100%';
    var lijst = el('div', { position: 'absolute', left: '0', right: '0', top: '100%', zIndex: '5', background: '#fff', border: '1px solid ' + T.line, borderRadius: '8px', boxShadow: '0 10px 24px -14px rgba(32,20,15,.45)', marginTop: '2px', display: 'none', maxHeight: '220px', overflowY: 'auto' });
    lijst.setAttribute('role', 'listbox');
    var timer = null, vraagNr = 0;
    function toon() {
      lijst.innerHTML = '';
      var t = r.treffers;
      if (!t) { lijst.style.display = 'none'; return; }
      lijst.style.display = '';
      if (t.zoekt) { lijst.appendChild(el('div', { padding: '8px 10px', fontSize: '12.5px', color: T.inkSoft }, 'Zoeken in ONS…')); return; }
      if (t.fout) { lijst.appendChild(el('div', { padding: '8px 10px', fontSize: '12.5px', color: T.bad }, t.fout)); return; }
      if (!t.lijst.length) { lijst.appendChild(el('div', { padding: '8px 10px', fontSize: '12.5px', color: T.inkSoft }, 'Geen cliënt gevonden.')); return; }
      t.lijst.forEach(function (c) {
        var b = el('button', { display: 'flex', flexDirection: 'column', width: '100%', gap: '1px', border: '0', background: '#fff', padding: '7px 10px', cursor: 'pointer', font: '400 13px ' + FONT, color: T.ink, textAlign: 'left' });
        b.type = 'button';
        b.setAttribute('role', 'option');
        b.setAttribute('data-client-id', c.id);
        b.appendChild(el('span', { fontWeight: '600' }, c.name || 'Cliënt ' + c.id));
        // Cliëntnummer, geboortedatum en postcode: om de juiste cliënt te kiezen.
        // Cliëntnummer, geboortedatum en postcode als labels: om de juiste cliënt te kiezen.
        if (c.number || c.birth || c.pc || c.outOfCare) b.appendChild(labels([c.number ? 'Cl ' + c.number : '', c.birth ? 'Geb ' + c.birth : '', pcTekst(c.pc), c.outOfCare ? 'Uit zorg' : ''], 'data-client-extra'));
        b.addEventListener('mouseenter', function () { b.style.background = T.brandWash; });
        b.addEventListener('mouseleave', function () { b.style.background = '#fff'; });
        b.addEventListener('mousedown', function (e) { e.preventDefault(); });
        b.addEventListener('click', function () {
          r.clientId = c.id; r.name = c.name; r.number = c.number || ''; r.zoek = ''; r.treffers = null;
          r.pc = c.pc ? c.pc.slice(0, 4) + ' ' + c.pc.slice(4) : '';
          r.pcUitOns = !!c.pc;
          if (naKiezen) naKiezen();
          renderPagina();
        });
        lijst.appendChild(b);
      });
    }
    function zoek(wacht) {
      clearTimeout(timer);
      var term = inp.value.trim();
      if (term.length < 2 || !actions.onClientSearch) { r.treffers = null; toon(); return; }
      timer = setTimeout(function () {
        var mijn = ++vraagNr;
        r.treffers = { zoekt: true, lijst: [] }; toon();
        actions.onClientSearch(term, function (res) {
          if (mijn !== vraagNr) return;   // intussen verder getypt
          r.treffers = res && res.ok ? { lijst: res.clients || [] } : { fout: (res && res.error) || 'Zoeken mislukt.', lijst: [] };
          // Is het paneel intussen opnieuw getekend, dan de lijst van het nieuwe veld bijwerken.
          (r._toon || toon)();
        }, !!r.uitZorg);
      }, wacht);
    }
    inp.addEventListener('input', function () {
      r.zoek = inp.value; r.name = ''; r.clientId = ''; r.pcUitOns = false;
      zoek(350);
    });
    inp.addEventListener('blur', function () { setTimeout(function () { r.treffers = null; toon(); }, 150); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') { r.treffers = null; toon(); } });
    veld.appendChild(inp);
    veld.appendChild(lijst);
    wrap.appendChild(veld);
    // Vinkje: ook cliënten die uit zorg zijn (ONS: out_of_care=true).
    var vink = el('label', { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '12px', color: T.inkSoft, cursor: 'pointer', userSelect: 'none' });
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!r.uitZorg; cb.setAttribute('data-client-uit-zorg', String(nr));
    Object.assign(cb.style, { margin: '0', accentColor: T.brand });
    // Klikken op het vinkje laat het zoekveld (en de lijst) open.
    vink.addEventListener('mousedown', function (e) { e.preventDefault(); });
    cb.addEventListener('change', function () { r.uitZorg = cb.checked; if (inp.value.trim().length >= 2) zoek(0); });
    vink.appendChild(cb);
    vink.appendChild(document.createTextNode('Inclusief cliënten uit zorg'));
    wrap.appendChild(vink);
    r._toon = toon;
    toon();
    return wrap;
  }
  function nummer(n) {
    return el('span', { flex: '0 0 auto', width: '20px', height: '20px', borderRadius: '10px', background: T.brand, color: '#fff', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }, String(n));
  }
  /* ── Afspraak meteen in ONS maken (zonder formulier) ──
     Pas hier kies je de cliënt(en). Bij meerdere momenten:
       Gedupliceerd: dezelfde cliënt(en) in elke afspraak;
       Los: per afspraak een eigen cliënt.
     Afspraaktype per afspraak; wat je bovenaan kiest, nemen de andere over
     tot je ze zelf wijzigt. Uursoort per cliënt. Geavanceerd: reistijd en een
     knop met padicoon voor een efficiëntere indeling op rijtijd (Google
     Routes, multi-plan.js). */
  var ICON_PAD = 'M19 15.18V7c0-2.21-1.79-4-4-4s-4 1.79-4 4v10c0 1.1-.9 2-2 2s-2-.9-2-2V8.82C8.16 8.4 9 7.3 9 6c0-1.66-1.34-3-3-3S3 4.34 3 6c0 1.3.84 2.4 2 2.82V17c0 2.21 1.79 4 4 4s4-1.79 4-4V7c0-1.1.9-2 2-2s2 .9 2 2v8.18c-1.16.41-2 1.51-2 2.82 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.3-.84-2.4-2-2.82z';
  function leegClient() { return { zoek: '', name: '', clientId: '', pc: '', pcUitOns: false, treffers: null }; }
  function kanDirect() { return fAan('plannerDirect') && !!actions.onEventOptions && !!actions.onCreateEvents; }
  function naarMaken(momenten, minutes) {
    var items = momenten.map(function (m) {
      return { date: m.date, startMin: m.startMin, minutes: minutes, labelId: '', typeAangepast: false, titel: '', titelAangepast: false, reisHeen: 0, reisTerug: 0, clients: [leegClient()] };
    });
    BEWAARD.maak = { items: items, modus: 'dup', clients: [leegClient()], geavanceerd: false, labels: [], hourTypes: {}, uursoort: {}, metaKnown: true, laden: true, busy: false, error: '', uitslag: null, eff: null };
    naarPagina('maken');
    var mk = BEWAARD.maak;
    actions.onEventOptions([], function (res) {
      if (BEWAARD.maak !== mk) return;
      mk.laden = false;
      if (!(res && res.ok)) mk.error = (res && res.error) || 'Kon de keuzes niet ophalen uit ONS.';
      else { mk.labels = res.labels || []; mk.metaKnown = !!res.metaKnown; standaardType(mk); }
      if (pagina === 'maken') renderPagina();
    });
  }
  function labelMet(mk, naam) { return mk.labels.filter(function (l) { return l.name.toLowerCase() === naam.toLowerCase(); })[0]; }
  // Standaard afspraaktype voor wat nog niet zelf gekozen is.
  function standaardType(mk) {
    var l = labelMet(mk, 'Face to face');
    zetTypeAlle(mk, l ? String(l.id) : '');
  }
  // Type voor alle afspraken: geldt voor elke afspraak die geen eigen type heeft.
  function zetTypeAlle(mk, v) {
    mk.typeAlle = v;
    mk.items.forEach(function (it) { if (!it.typeAangepast) it.labelId = v; });
  }
  // Eigen type voor één afspraak (gelijk aan het gemeenschappelijke = weer gewoon).
  function zetType(mk, k, v) {
    mk.items[k].labelId = v;
    mk.items[k].typeAangepast = v !== mk.typeAlle;
  }
  function typeNaamVan(mk, id) { var l = mk.labels.filter(function (x) { return String(x.id) === String(id); })[0]; return l ? l.name : ''; }
  function clientsVan(mk, it) { return (mk.modus === 'dup' ? mk.clients : it.clients).filter(function (c) { return c.clientId; }); }
  function titelVan(mk, it) {
    if (it.titelAangepast) return it.titel;
    // 'Huisbezoek Tamara', bij meer cliënten 'Huisbezoek Tamara en Bram'.
    var namen = namenVan(mk, it);
    var t = typeNaamVan(mk, it.labelId);
    return t && namen ? t + ' ' + namen : (t || namen || 'Afspraak');
  }
  // Voornamen: 'Tamara', 'Tamara en Bram', 'Tamara, Bram en Sem'.
  function namenVan(mk, it) {
    var n = clientsVan(mk, it).map(function (c) { return String(c.name || '').trim().split(/\s+/)[0]; }).filter(Boolean);
    return n.length > 1 ? n.slice(0, -1).join(', ') + ' en ' + n[n.length - 1] : (n[0] || '');
  }
  // Uursoorten van een cliënt ophalen zodra hij gekozen is (één keer per cliënt).
  function haalUursoorten(mk, cid) {
    if (!cid || mk.hourTypes[cid]) return;
    mk.hourTypes[cid] = 'laden';
    actions.onEventOptions([cid], function (res) {
      mk.hourTypes[cid] = res && res.ok ? ((res.hourTypes || {})[cid] || []) : [];
      if (BEWAARD.maak === mk && pagina === 'maken') renderPagina();
    });
  }
  function selectEl(attr, opties, waarde, onChange, leeg) {
    var sel = document.createElement('select');
    sel.setAttribute(attr[0], attr[1]);
    Object.assign(sel.style, { height: '34px', width: '100%', border: '1px solid ' + T.line, borderRadius: '8px', padding: '0 8px', font: '400 13px ' + FONT, color: T.ink, background: '#fff', boxSizing: 'border-box' });
    if (leeg) { var o0 = document.createElement('option'); o0.value = ''; o0.textContent = leeg; sel.appendChild(o0); }
    opties.forEach(function (o) {
      var host = sel;
      if (o.groep) {
        host = sel.querySelector('optgroup[label="' + o.groep + '"]');
        if (!host) { host = document.createElement('optgroup'); host.label = o.groep; sel.appendChild(host); }
      }
      var op = document.createElement('option'); op.value = String(o.id); op.textContent = o.name;
      if (String(o.id) === String(waarde)) op.selected = true;
      host.appendChild(op);
    });
    sel.addEventListener('change', function () { onChange(sel.value); });
    return sel;
  }
  // Cliënt: nog niet gekozen = zoekveld; gekozen = compacte regel met
  // initialen, naam, cliëntnummer en postcode, en rechts de uursoort.
  function clientBlok(mk, c, sleutel, weg) {
    if (!c.clientId) {
      var leeg = el('div', { display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '4px 0' });
      var zoeker = clientZoeker(c, sleutel, function () { haalUursoorten(mk, c.clientId); mk.eff = null; });
      zoeker.querySelector('[data-client-zoek]').setAttribute('data-maak-zoek', sleutel);
      leeg.appendChild(zoeker);
      if (weg) leeg.appendChild(wegKnop(weg, 'Cliënt weghalen'));
      return leeg;
    }
    var rij = el('div', { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' });
    rij.setAttribute('data-maak-client', sleutel);
    var ini = String(c.name || '?').split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    rij.appendChild(el('span', { flex: '0 0 auto', width: '26px', height: '26px', borderRadius: '13px', background: T.brandWash, color: T.brand, fontWeight: '800', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }, ini));
    var nm = el('span', { flex: '1 1 auto', minWidth: '0' });
    nm.appendChild(el('span', { display: 'block', fontWeight: '700', fontSize: '13px', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, c.name));
    if (c.number || c.pc) nm.appendChild(labels([c.number ? 'Cl ' + c.number : '', pcTekst(c.pc)]));
    rij.appendChild(nm);
    var types = mk.hourTypes[c.clientId];
    if (types === 'laden' || types == null) rij.appendChild(el('span', { fontSize: '11.5px', color: T.inkSoft }, 'uursoorten…'));
    else if (!types.length) { var g = el('span', { fontSize: '11.5px', color: T.warn, fontWeight: '600' }, 'geen uursoort'); g.title = 'ONS geeft geen uursoorten voor deze cliënt; maak deze via het ONS Afspraakformulier.'; rij.appendChild(g); }
    else {
      var opts = types.map(function (t) { return { id: t.id, name: t.name, groep: t.recent ? 'Onlangs gebruikt' : 'Toegestaan' }; });
      var sel = selectEl(['data-maak-uursoort', c.clientId], opts, mk.uursoort[c.clientId] || '', function (v) { mk.uursoort[c.clientId] = v; renderPagina(); }, 'Uursoort');
      sel.setAttribute('aria-label', 'Uursoort ' + c.name);
      Object.assign(sel.style, { width: '128px', flex: '0 0 128px', height: '30px', fontSize: '12px' });
      rij.appendChild(sel);
      // Nog geen uursoort: een uitroepteken erachter (de lijst zelf blijft gewoon).
      var uitroep = el('span', { flex: '0 0 auto', width: '10px', color: T.bad, fontWeight: '800', fontSize: '15px', textAlign: 'center', visibility: mk.uursoort[c.clientId] ? 'hidden' : 'visible' }, '!');
      uitroep.title = 'Kies een uursoort'; uitroep.setAttribute('data-uursoort-ontbreekt', mk.uursoort[c.clientId] ? '' : c.clientId);
      rij.appendChild(uitroep);
    }
    rij.appendChild(wegKnop(function () {
      // Weghalen; staat hij er alleen, dan weer leeg zoeken.
      if (weg) weg(); else { c.clientId = ''; c.name = ''; c.pc = ''; c.number = ''; c.zoek = ''; mk.eff = null; renderPagina(); }
    }, 'Cliënt ' + c.name + ' weghalen'));
    return rij;
  }
  // Kleine grijze labels naast elkaar (geen scheidingstekens).
  function labels(teksten, attr) {
    var rij = el('span', { display: 'flex', flexWrap: 'nowrap', overflow: 'hidden', gap: '4px', marginTop: '2px' });
    if (attr) rij.setAttribute(attr, '');
    teksten.filter(Boolean).forEach(function (t) {
      rij.appendChild(el('span', { fontSize: '10.5px', color: T.inkSoft, background: T.lineSoft, borderRadius: '5px', padding: '1px 5px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: '400' }, t));
    });
    return rij;
  }
  function pcTekst(pc) { pc = normPostcode(pc); return pc ? pc.slice(0, 4) + ' ' + pc.slice(4) : ''; }
  function wegKnop(fn, label) {
    var x = el('button', { border: '0', background: 'transparent', color: T.inkSoft, cursor: 'pointer', fontSize: '16px', lineHeight: '1', padding: '2px 4px', borderRadius: '6px', flex: '0 0 auto' }, '×');
    x.type = 'button'; x.setAttribute('aria-label', label);
    x.addEventListener('click', fn);
    return x;
  }
  // Lijst cliënten (elk met uursoort) met '+ Cliënt'. prefix: voor de
  // sleutels (dup0, dup1 / los0-0, los0-1).
  function clientsLijst(mk, lijst, prefix, host) {
    lijst.forEach(function (c, i) {
      var r = clientBlok(mk, c, prefix + i, lijst.length > 1 ? function () { lijst.splice(i, 1); mk.eff = null; renderPagina(); } : null);
      if (i) r.style.borderTop = '1px solid ' + T.lineSoft;
      host.appendChild(r);
    });
    if (lijst.length < 6 && lijst.every(function (c) { return c.clientId; })) {
      var plus = el('button', { border: '0', background: 'transparent', color: T.brand, cursor: 'pointer', font: '600 12.5px ' + FONT, padding: '4px 0 2px', textAlign: 'left' }, '+ Cliënt');
      plus.type = 'button'; plus.setAttribute('data-maak-plus', prefix);
      plus.addEventListener('click', function () { lijst.push(leegClient()); renderPagina(); });
      host.appendChild(plus);
    }
  }
  function sectieKop(tekst) { return el('div', { fontWeight: '700', fontSize: '12px', color: T.inkSoft, margin: '12px 0 6px' }, tekst); }
  function kaartDoos() { return el('div', { border: '1px solid ' + T.line, borderRadius: '12px', padding: '6px 12px', background: '#fff' }); }
  // Afspraak maken, opzet A: eerst wat voor alle afspraken geldt, daaronder
  // per afspraak één compacte regel (tik = uitklappen voor type, titel, reistijd).
  function pageMaken() {
    var mk = BEWAARD.maak, box = el('div');
    if (!mk) return box;
    var meldingM = agendaMeldingBlok();
    if (meldingM) box.appendChild(meldingM);
    var n = mk.items.length, klaar = !!mk.uitslag;
    mk.open = mk.open || {};
    if (mk.laden) { zorgVoorStijl(); box.appendChild(laadBalk()); return box; }
    if (mk.error && !mk.labels.length && !klaar) { box.appendChild(noteBox(mk.error, 'bad')); return box; }
    if (!klaar) onsMetClienten(mk);
    if (klaar) {
      var goed = mk.uitslag.filter(function (r) { return r && r.ok; }).length;
      var misN = n - goed;
      box.appendChild(noteBox(misN ? goed + ' van ' + n + ' gemaakt. Niet gelukt: ' + mk.items.filter(function (_, k) { return !(mk.uitslag[k] && mk.uitslag[k].ok); }).map(function (it) { return dayLabel(it.date) + ' ' + hm(it.startMin); }).join(', ') + '.' : (n === 1 ? 'Afspraak gemaakt in ONS.' : n + ' afspraken gemaakt in ONS.'), misN ? 'warn' : 'ok'));
    }
    // Zelfde cliënt(en) of per afspraak anders.
    if (n > 1 && !klaar) {
      var seg = el('div', { display: 'flex', background: T.lineSoft, borderRadius: '10px', padding: '3px', marginBottom: '2px' });
      [['dup', 'Zelfde cliënt(en)'], ['los', 'Per afspraak anders']].forEach(function (o) {
        var aan = mk.modus === o[0];
        var b = el('button', { flex: '1 1 0', border: '0', borderRadius: '8px', padding: '6px 0', cursor: 'pointer', font: '600 12.5px ' + FONT,
          background: aan ? '#fff' : 'transparent', color: aan ? T.ink : T.inkSoft, boxShadow: aan ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }, o[1]);
        b.type = 'button'; b.setAttribute('data-maak-modus', o[0]); b.setAttribute('aria-pressed', aan ? 'true' : 'false');
        b.addEventListener('click', function () { mk.modus = o[0]; mk.eff = null; renderPagina(); });
        seg.appendChild(b);
      });
      box.appendChild(seg);
    }
    if (n === 1) mk.modus = 'dup';
    // Voor alle afspraken: cliënt(en) met uursoort (zelfde) en het type.
    if (!klaar) {
      box.appendChild(sectieKop(n > 1 ? 'Voor alle ' + n + ' afspraken' : 'Afspraak'));
      var alle = kaartDoos();
      alle.setAttribute('data-maak-alle', '');
      if (mk.modus === 'dup') clientsLijst(mk, mk.clients, 'dup', alle);
      var typeRij = el('div', { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderTop: mk.modus === 'dup' ? '1px solid ' + T.lineSoft : '0' });
      typeRij.appendChild(el('span', { flex: '0 0 74px', fontSize: '12px', fontWeight: '600', color: T.inkSoft }, 'Type'));
      var typeAlle = selectEl(['data-maak-type-alle', ''], mk.labels, mk.typeAlle || '', function (v) { zetTypeAlle(mk, v); renderPagina(); }, 'Geen afspraaktype');
      typeRij.appendChild(typeAlle);
      alle.appendChild(typeRij);
      box.appendChild(alle);
    }
    // Afspraken: één regel per afspraak.
    box.appendChild(sectieKop(n > 1 ? 'Afspraken' : 'Moment'));
    var lijst = kaartDoos();
    mk.items.forEach(function (it, k) {
      var blok = el('div', { borderTop: k ? '1px solid ' + T.lineSoft : '0', padding: '4px 0' });
      blok.setAttribute('data-maak-afspraak', String(k));
      var kop = el('button', { display: 'flex', alignItems: 'center', gap: '8px', width: '100%', border: '0', background: 'transparent', padding: '6px 0', cursor: klaar ? 'default' : 'pointer', textAlign: 'left', font: 'inherit', color: T.ink });
      kop.type = 'button'; kop.setAttribute('data-maak-regel', String(k)); kop.setAttribute('aria-expanded', mk.open[k] ? 'true' : 'false');
      var wn = el('span', { flex: '0 0 100px', fontWeight: '700', fontSize: '12.5px' }, dagLang(it.date, true));
      wn.appendChild(el('span', { display: 'block', fontWeight: '400', color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }, hm(it.startMin) + ' tot ' + hm(it.startMin + it.minutes)));
      kop.appendChild(wn);
      // Type (of de eigen titel) als hoofdregel, de cliënten eronder.
      var wat = el('span', { flex: '1 1 auto', minWidth: '0', fontSize: '12.5px' });
      wat.appendChild(el('span', { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, it.titelAangepast ? it.titel : (typeNaamVan(mk, it.labelId) || 'Afspraak')));
      var namen = namenVan(mk, it);
      if (namen) wat.appendChild(el('span', { display: 'block', fontSize: '11px', color: T.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, namen));
      kop.appendChild(wat);
      var u = mk.uitslag && mk.uitslag[k];
      if (u) {
        var st = el('span', { flex: '0 0 auto', fontWeight: '700', fontSize: '12px', color: u.ok ? T.ok : T.bad }, u.ok ? '✓ gemaakt' : 'mislukt');
        if (!u.ok && u.error) st.title = u.error;
        st.setAttribute('data-maak-uitslag', u.ok ? 'ok' : 'fout');
        kop.appendChild(st);
      } else if (it.onsCl && it.onsCl.overlap === true) {
        var ob = el('span', { flex: '0 0 auto', fontSize: '10.5px', fontWeight: '700', borderRadius: '6px', padding: '2px 6px', background: '#fdf3e2', color: T.warn }, 'ONS: overlap');
        ob.setAttribute('data-maak-ons-overlap', String(k));
        ob.title = 'ONS meldt overlap met de gekozen cliënt(en) op dit tijdstip.';
        kop.appendChild(ob);
      } else if (it.typeAangepast && it.labelId !== mk.typeAlle) {
        var tg = el('span', { flex: '0 0 auto', fontSize: '10.5px', fontWeight: '700', borderRadius: '6px', padding: '2px 6px', background: T.brandWash, color: T.brand }, 'Eigen type');
        tg.setAttribute('data-eigen-type', String(k));
        kop.appendChild(tg);
      } else kop.appendChild(el('span', { flex: '0 0 auto', color: T.inkSoft }, mk.open[k] ? '▾' : '›'));
      if (!klaar) kop.addEventListener('click', function () { mk.open[k] = !mk.open[k]; renderPagina(); });
      blok.appendChild(kop);
      // Per afspraak anders: de cliënt(en) van deze afspraak staan in de regel.
      if (!klaar && mk.modus === 'los') {
        var cl = el('div', { padding: '0 0 4px 0' });
        clientsLijst(mk, it.clients, 'los' + k + '-', cl);
        blok.appendChild(cl);
      }
      if (!klaar && it.onsCl && it.onsCl.overlap === true) {
        var on = noteBox('ONS meldt overlap: de cliënt(en) hebben op dit tijdstip al een afspraak.', 'warn');
        on.style.margin = '0 0 6px'; blok.appendChild(on);
      }
      if (!klaar) reisProblemen(mk, it).forEach(function (t) {
        var rn = noteBox(t, 'warn'); rn.style.margin = '0 0 6px'; rn.setAttribute('data-maak-reis-conflict', String(k)); blok.appendChild(rn);
      });
      if (!klaar && mk.open[k]) {
        var det = el('div', { display: 'flex', flexDirection: 'column', gap: '6px', padding: '2px 0 8px' });
        var tSel = selectEl(['data-maak-type', String(k)], mk.labels, it.labelId, function (v) { zetType(mk, k, v); renderPagina(); }, 'Geen afspraaktype');
        det.appendChild(fieldLabel('Type (alleen deze)', tSel));
        var titel = inputEl('text', titelVan(mk, it), function (v) { it.titel = v; it.titelAangepast = true; });
        titel.setAttribute('data-maak-titel', String(k));
        det.appendChild(fieldLabel('Titel', titel));
        if (mk.geavanceerd) {
          var reisRij = el('div', { display: 'flex', gap: '8px' });
          [['reisHeen', 'Reistijd heen (min)', 'heen'], ['reisTerug', 'Reistijd terug (min)', 'terug']].forEach(function (rv) {
            var inp = inputEl('number', it[rv[0]] ? String(it[rv[0]]) : '', function (v) { var nn = parseInt(v, 10); it[rv[0]] = nn > 0 ? Math.min(nn, 240) : 0; });
            inp.min = '0'; inp.max = '240'; inp.step = '5'; inp.placeholder = '0';
            inp.setAttribute('data-maak-' + rv[2], String(k));
            // Na het invullen (niet bij elke toets) kijken of de reistijd past.
            inp.addEventListener('change', function () { renderPagina(); });
            reisRij.appendChild(fieldLabel(rv[1], inp));
          });
          det.appendChild(reisRij);
        }
        blok.appendChild(det);
      } else if (!klaar && mk.geavanceerd && (it.reisHeen || it.reisTerug)) {
        blok.appendChild(el('div', { fontSize: '11px', color: T.brand, fontWeight: '600', padding: '0 0 4px' }, 'reistijd ' + (it.reisHeen || 0) + ' / ' + (it.reisTerug || 0) + ' min'));
      }
      lijst.appendChild(blok);
    });
    box.appendChild(lijst);
    if (!klaar) {
      // Geavanceerd: reistijd per afspraak en Efficiënter indelen (Google Routes).
      var adv = el('label', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '12px', padding: '9px 12px', border: '1px dashed ' + T.line, borderRadius: '12px', color: T.inkSoft, fontWeight: '600', fontSize: '12.5px', cursor: 'pointer', userSelect: 'none' });
      var advT = el('span');
      advT.appendChild(el('span', { display: 'block', color: T.ink, fontWeight: '700' }, 'Geavanceerd'));
      advT.appendChild(el('span', { display: 'block', fontSize: '11px', fontWeight: '400' }, 'Reistijd en efficiënter indelen'));
      adv.appendChild(advT);
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = !!mk.geavanceerd; cb.setAttribute('data-maak-geavanceerd', ''); cb.setAttribute('role', 'switch');
      cb.style.accentColor = T.brand; cb.style.width = '18px'; cb.style.height = '18px'; cb.style.margin = '0';
      cb.addEventListener('change', function () { mk.geavanceerd = cb.checked; mk.eff = null; renderPagina(); });
      adv.appendChild(cb);
      box.appendChild(adv);
      if (mk.geavanceerd && fAan('plannerDistance')) box.appendChild(effBlok(mk));
      if (!mk.metaKnown) box.appendChild(txt('help', 'Tip: sla één keer zelf een afspraak op via het formulier van ONS; de hulp neemt dan de instellingen van dat formulier over.', { margin: '10px 0 0', fontSize: '11.5px' }));
      if (mk.error) box.appendChild(noteBox(mk.error, 'bad'));
    }
    return box;
  }
  // ONS' overlapcontrole opnieuw, nu met de gekozen cliënt(en) erbij: is de
  // cliënt op dat moment al ergens anders? Eén keer per afspraak en keuze.
  function onsMetClienten(mk) {
    if (!actions.onSlotCheck) return;
    mk.items.forEach(function (it) {
      var ids = clientsVan(mk, it).map(function (c) { return c.clientId; }).sort();
      if (!ids.length) { it.onsCl = null; return; }
      var sleutel = it.date + '|' + it.startMin + '|' + it.minutes + '|' + ids.join(',');
      if (it.onsCl && it.onsCl.key === sleutel) return;
      it.onsCl = { key: sleutel, busy: true };
      actions.onSlotCheck({ date: it.date, startMin: it.startMin, minutes: it.minutes, clientIds: ids }, function (r) {
        if (!it.onsCl || it.onsCl.key !== sleutel) return;
        it.onsCl = { key: sleutel, busy: false, overlap: r && r.status === 'ready' ? r.overlap : null };
        // Alleen opnieuw tekenen als er iets te melden is (geen zoeklijst onderbreken).
        if (it.onsCl.overlap === true) setTimeout(function () { if (pagina === 'maken' && BEWAARD.maak === mk) renderPagina(); }, 0);
      });
    });
  }
  // Past de reistijd? Vóór en na de afspraak moet zoveel vrije tijd zijn
  // (vrije blokken van de planhulp; andere nieuwe afspraken die dag tellen als
  // bezet). -> [tekst, …]; leeg als het past of als het blok onbekend is.
  function reisProblemen(mk, it) {
    if (!(it.reisHeen > 0 || it.reisTerug > 0)) return [];
    var gaps = (mk.gaps || []).concat((plan.result && plan.result.gaps) || [], (plan.raster && plan.raster.result && plan.raster.result.gaps) || []);
    var eind = it.startMin + it.minutes;
    var g = gaps.filter(function (x) { return x.date === it.date && x.startMin <= it.startMin && eind <= x.endMin; })[0];
    if (!g) return [];
    var vanaf = g.startMin, tot = g.endMin;
    mk.items.forEach(function (o) {
      if (o === it || o.date !== it.date) return;
      var oStart = o.startMin - (o.reisHeen || 0), oEind = o.startMin + o.minutes + (o.reisTerug || 0);
      if (oEind <= it.startMin) vanaf = Math.max(vanaf, oEind);
      if (oStart >= eind) tot = Math.min(tot, oStart);
    });
    var uit = [];
    if (it.reisHeen > it.startMin - vanaf) uit.push('Reistijd heen (' + it.reisHeen + ' min) past niet: er is ' + (it.startMin - vanaf) + ' min vrij voor ' + hm(it.startMin) + '.');
    if (it.reisTerug > tot - eind) uit.push('Reistijd terug (' + it.reisTerug + ' min) past niet: er is ' + (tot - eind) + ' min vrij na ' + hm(eind) + '.');
    return uit;
  }
  // Voetbalk van Afspraak maken: maken in ONS, of via het ONS-formulier.
  function maakBalk() {
    var mk = BEWAARD.maak;
    var balk = el('div', { background: '#fff', padding: '10px 12px 12px', borderTop: '1px solid ' + T.line, boxShadow: '0 -10px 24px -18px rgba(32,20,15,.35)' });
    if (!mk || mk.laden) return balk;
    var n = mk.items.length;
    var link = function (tekst, fn, attr) {
      var a = el('button', { display: 'block', margin: '6px auto 0', border: '0', background: 'transparent', color: T.inkSoft, cursor: 'pointer', font: '400 12px ' + FONT, textDecoration: 'underline' }, tekst);
      a.type = 'button'; if (attr) a.setAttribute(attr, '');
      a.addEventListener('click', fn);
      return a;
    };
    if (mk.uitslag) {
      var goed = mk.uitslag.some(function (r) { return r && r.ok; });
      var mis = mk.items.filter(function (_, k) { return !(mk.uitslag[k] && mk.uitslag[k].ok); });
      if (goed && actions.onReloadAgenda) { var v = primaryBtn('Agenda verversen', function () { actions.onReloadAgenda(); }); v.style.marginTop = '0'; balk.appendChild(v); }
      if (mis.length) balk.appendChild(link('Mislukte via het ONS Afspraakformulier', function () { viaFormulier(mk, mis); }));
      return balk;
    }
    if (mk.error && !mk.labels.length) { var f = primaryBtn('ONS Afspraakformulier', function () { viaFormulier(mk); }); f.style.marginTop = '0'; balk.appendChild(f); return balk; }
    var compleet = mk.items.every(function (it) {
      var cs = clientsVan(mk, it);
      return cs.length && cs.every(function (c) { return !!mk.uursoort[c.clientId]; });
    });
    var knop = primaryBtn(mk.busy ? 'Bezig met maken…' : (n === 1 ? 'Afspraak maken in ONS' : n + ' afspraken maken in ONS'), function () { maakInOns(mk); }, mk.busy || !compleet);
    knop.style.marginTop = '0';
    knop.setAttribute('data-maak-knop', '');
    if (!compleet) knop.title = 'Kies eerst bij elke afspraak een cliënt en per cliënt de uursoort.';
    balk.appendChild(knop);
    balk.appendChild(link('ONS Afspraakformulier', function () { viaFormulier(mk); }, 'data-maak-ons'));
    return balk;
  }
  function maakInOns(mk) {
    mk.busy = true; mk.error = ''; renderPagina();
    var lijst = mk.items.map(function (it) {
      return { date: it.date, startMin: it.startMin, minutes: it.minutes,
        clients: clientsVan(mk, it).map(function (c) { return { id: c.clientId, hourTypeId: Number(mk.uursoort[c.clientId]) }; }),
        labelId: it.labelId ? Number(it.labelId) : null, name: String(titelVan(mk, it) || '').trim() || 'Afspraak',
        travelBefore: it.reisHeen || 0, travelAfter: it.reisTerug || 0 };
    });
    actions.onCreateEvents(lijst, function (res) {
      mk.busy = false;
      if (!(res && res.ok)) { mk.error = (res && res.error) || 'Maken mislukt.'; renderPagina(); return; }
      mk.uitslag = res.results || [];
      // Wat gelukt is, bezet nu tijd: de planhulp zoekt straks opnieuw.
      if (mk.uitslag.some(function (r) { return r && r.ok; })) { BEWAARD.momenten = []; BEWAARD.balkOpen = false; plan.result = null; }
      renderPagina();
    });
  }
  // Toch via het formulier van ONS: gedupliceerd = één formulier + kopieën
  // (met dezelfde cliënten); los = een eigen formulier per afspraak.
  function viaFormulier(mk, alleen) {
    var items = alleen || mk.items;
    if (!items.length || !actions.onNewEvent) return;
    var ids = function (it) { return clientsVan(mk, it).map(function (c) { return c.clientId; }); };
    var tijd = function (it) { return { date: it.date, time: hm(it.startMin) }; };
    var eerste = items[0];
    var req = { date: eerste.date, time: hm(eerste.startMin), minutes: eerste.minutes, clientIds: ids(eerste), extra: [], eigen: [] };
    if (mk.modus === 'los') { req.multi = true; req.eigen = items.slice(1).map(function (it) { return Object.assign(tijd(it), { minutes: it.minutes, clientIds: ids(it) }); }); }
    else req.extra = items.slice(1).map(tijd);
    actions.onNewEvent(req, function (r) { if (!(r && r.ok)) { mk.error = (r && r.error) || 'Openen mislukt.'; renderPagina(); } });
  }

  /* ── Geavanceerd: efficiënter indelen op rijtijd (Google Routes) ── */
  function pcVan(mk, it) { var c = clientsVan(mk, it)[0]; return c ? normPostcode(c.pc) : ''; }
  function routesBron() { return state && state.routesProxy && (state.routesProxy.key || state.routesProxy.url) ? state.routesProxy : null; }
  function effBlok(mk) {
    var box = el('div', { marginTop: '8px' });
    if (!routesBron()) {
      box.appendChild(txt('help', 'Efficiënter indelen gebruikt de Google Routes API: vul in het beheerscherm (Functies → Google Maps) een Routes-sleutel in.', { margin: '0', fontSize: '11.5px' }));
      return box;
    }
    var ontbreekt = mk.items.filter(function (it) { return !pcVan(mk, it); }).length;
    var e = mk.eff;
    var knop = baseButton('', function () { startEff(mk); }, false, !!(e && e.busy) || ontbreekt > 0);
    knop.textContent = '';
    var ico = svgPath(ICON_PAD, 16); ico.style.marginRight = '6px'; ico.style.verticalAlign = '-3px';
    knop.appendChild(ico);
    knop.appendChild(document.createTextNode(e && e.busy ? 'Bezig met rekenen…' : 'Efficiënter indelen'));
    knop.setAttribute('data-maak-efficient', '');
    knop.title = 'Kijkt naar je andere afspraken op ' + (mk.items.length > 1 ? 'die dagen' : 'die dag') + ' en stelt een indeling met minder rijtijd voor (Google Routes; alleen postcodes).';
    box.appendChild(knop);
    if (ontbreekt) box.appendChild(txt('help', 'Kies eerst ' + (mk.items.length > 1 ? 'bij elke afspraak ' : '') + 'een cliënt met adres (postcode uit ONS).', { margin: '4px 0 0', fontSize: '11.5px' }));
    if (!e) return box;
    if (e.error) { box.appendChild(noteBox(e.error, 'warn')); return box; }
    if (!e.voorstel) return box;
    var v = e.voorstel;
    var anders = v.placed.some(function (p) { var it = mk.items[p.i]; return it.date !== p.date || it.startMin !== p.startMin; });
    var kmTekst = function (m) { return m < 1000 ? '< 1 km' : Math.round(m / 1000) + ' km'; };
    if (anders && v.nieuwMin < v.nuMin - 1) {
      var nb = noteBox('Efficiënter: ≈ ' + Math.round(v.nuMin - v.nieuwMin) + ' min minder rijden (' + kmTekst(Math.max(0, v.nuM - v.nieuwM)) + '). Nu ≈ ' + Math.round(v.nuMin) + ' min extra, voorstel ≈ ' + Math.round(v.nieuwMin) + ' min.', 'ok');
      nb.setAttribute('data-eff-voorstel', '');
      box.appendChild(nb);
      var lijst = el('div', { display: 'flex', flexDirection: 'column', gap: '2px', margin: '6px 0' });
      v.placed.slice().sort(function (a, b) { return a.i - b.i; }).forEach(function (p) {
        var it = mk.items[p.i];
        var c = clientsVan(mk, it)[0];
        var zelfde = it.date === p.date && it.startMin === p.startMin;
        lijst.appendChild(el('div', { fontSize: '12.5px', color: zelfde ? T.inkSoft : T.ink },
          (c ? c.name + ': ' : '') + dayLabel(it.date) + ' ' + hm(it.startMin) + (zelfde ? ' (blijft)' : ' → ' + dayLabel(p.date) + ' ' + hm(p.startMin))));
      });
      box.appendChild(lijst);
      var rij = el('div', { display: 'flex', gap: '8px' });
      var neem = primaryBtn('Voorstel overnemen', function () { overnemen(mk, v.placed, v.reisNieuw); });
      neem.style.marginTop = '0'; neem.setAttribute('data-eff-overnemen', '');
      var laat = secondaryBtn('Zo laten', function () { reisInvullen(mk, v.reisNu); mk.eff = null; renderPagina(); });
      rij.appendChild(neem); rij.appendChild(laat);
      box.appendChild(rij);
    } else {
      var ok = noteBox('Je indeling is al efficiënt (≈ ' + Math.round(v.nuMin) + ' min extra rijden). De reistijd is ingevuld.', 'ok');
      ok.setAttribute('data-eff-al-goed', '');
      box.appendChild(ok);
    }
    return box;
  }
  function reisInvullen(mk, reis) { (reis || []).forEach(function (r, i) { if (mk.items[i] && r) { mk.items[i].reisHeen = r.heen; mk.items[i].reisTerug = r.terug; } }); }
  function overnemen(mk, placed, reis) {
    // Reistijd hoort bij de afspraak (index), dus eerst invullen, dan sorteren.
    placed.forEach(function (p) { mk.items[p.i].date = p.date; mk.items[p.i].startMin = p.startMin; });
    reisInvullen(mk, reis);
    mk.items.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin; });
    BEWAARD.momenten = mk.items.map(function (it) { return { date: it.date, startMin: it.startMin, eigen: false }; });
    mk.eff = null;
    renderPagina();
  }
  function startEff(mk) {
    var bron = routesBron();
    if (!bron) return;
    var e = mk.eff = { busy: true };
    renderPagina();
    var klaar = function () { e.busy = false; if (BEWAARD.maak === mk && pagina === 'maken') renderPagina(); };
    var reken = function () {
      var kortste = Math.min.apply(null, mk.items.map(function (it) { return it.minutes; }));
      actions.onFreeSlots(kortste, plan.weeks, function (res) {
        if (!(res && res.ok && res.result)) { e.error = (res && res.error) || 'Zoeken mislukt.'; klaar(); return; }
        var dagen = {}, perDag = {};
        mk.items.forEach(function (it) { dagen[it.date] = true; perDag[it.date] = (perDag[it.date] || 0) + 1; });
        mk.gaps = res.result.gaps;   // ook voor de reistijdcontrole
        var gaps = res.result.gaps.filter(function (g) { return dagen[g.date]; });
        var visits = {};
        Object.keys(res.result.visits || {}).forEach(function (d) { if (dagen[d]) visits[d] = res.result.visits[d]; });
        var thuisPc = normPostcode((String(leesVertrek()).match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/) || [''])[0]);
        var verzoeken = mk.items.map(function (it) { return { pc: pcVan(mk, it), minutes: it.minutes }; });
        var pcs = verzoeken.map(function (v) { return v.pc; }).concat([thuisPc]);
        Object.keys(visits).forEach(function (d) { visits[d].forEach(function (b) { pcs.push(b.pc); }); });
        // Eén matrix voor alle postcodes van die dag(en): echte rijtijd en km.
        roadMatrix(bron, pcs.filter(Boolean)).then(function (pair) {
          var minuten = function (a, b) { var x = pair(a, b); return x ? x.s / 60 : null; };
          var meters = function (a, b) { var x = pair(a, b); return x ? x.m : null; };
          var ontbreekt = verzoeken.some(function (v) { return verzoeken.some(function (w) { return v.pc !== w.pc && minuten(v.pc, w.pc) == null; }); });
          if (ontbreekt) { e.error = 'Google Routes gaf niet voor alle adressen een rijtijd.'; klaar(); return; }
          var nu = mk.items.map(function (it, i) { return { i: i, date: it.date, startMin: it.startMin, minutes: it.minutes, pc: verzoeken[i].pc }; });
          var max = Math.max.apply(null, Object.keys(perDag).map(function (d) { return perDag[d]; }));
          var r = planMany(verzoeken, gaps, visits, { afstand: minuten, reistijd: function (a, b) { var x = minuten(a, b); return x == null ? 0 : Math.ceil(x); }, nieuweDag: 20, thuisPc: thuisPc, maxPerDag: max });
          var reis = function (placed) {
            var br = buren(placed, visits, thuisPc), uit = [];
            var leg = function (a, b) { var x = a && b && a !== b ? minuten(a, b) : 0; return x > 0 ? Math.ceil(x / 5) * 5 : 0; };
            placed.forEach(function (p, k) { uit[p.i] = { heen: leg(br[k].voor, p.pc), terug: thuisPc && br[k].na === thuisPc ? leg(p.pc, thuisPc) : 0 }; });
            return uit;
          };
          var gekozen = r.unplaced.length ? nu : r.placed;
          e.voorstel = {
            placed: gekozen,
            nuMin: extraKmVan(nu, visits, minuten, thuisPc), nieuwMin: extraKmVan(gekozen, visits, minuten, thuisPc),
            nuM: extraKmVan(nu, visits, meters, thuisPc), nieuwM: extraKmVan(gekozen, visits, meters, thuisPc),
            reisNu: reis(nu), reisNieuw: reis(gekozen)
          };
          // Al efficiënt: dan meteen de reistijd invullen.
          if (!(e.voorstel.nieuwMin < e.voorstel.nuMin - 1)) reisInvullen(mk, e.voorstel.reisNu);
          klaar();
        }, function () { e.error = 'Google Routes reageert niet.'; klaar(); });
      }, plan.tot, true, true);
    };
    // Directe sleutel: eerst (binnen deze klik) toestemming voor routes.googleapis.com.
    if (bron.key) vraagRoutes(function (ok) { if (ok) reken(); else { e.error = 'Geen toestemming voor Google Routes.'; klaar(); } });
    else reken();
  }

  // Planhulp: bovenaan Lijst of Weekraster en de instellingen (duur en
  // vooruit). Lijst: per dag de begintijden, meteen te kiezen.
  // Weekraster: mini-agenda per week; tik in de vrije tijd. Gekozen momenten
  // staan in de balk onderin.
  // Agenda's erbij of eraf: zonder gekozen momenten meteen opnieuw zoeken;
  // met gekozen momenten eerst vragen (opnieuw beginnen of negeren).
  function agendasGewijzigd(oud, nieuw) {
    var nOud = oud.split(',').length, nNieuw = nieuw.split(',').length;
    var bezig = BEWAARD.momenten.length > 0 || (pagina === 'maken' && BEWAARD.maak && !BEWAARD.maak.uitslag);
    if (bezig) {
      BEWAARD.agendaMelding = { meer: nNieuw > nOud, minder: nNieuw < nOud, aantal: nNieuw };
      if (pagina === 'plan' || pagina === 'maken') renderPagina();
      return;
    }
    planVernieuwen();
  }
  function planVernieuwen() {
    plan.result = null; plan.error = ''; plan.raster = null;
    BEWAARD.agendaMelding = null;
    if (pagina === 'plan') { startPlan(); renderPagina(); }
  }
  function agendaMeldingBlok() {
    var m = BEWAARD.agendaMelding;
    if (!m) return null;
    var box = el('div', { border: '1px solid #f0d6a8', background: '#fdf3e2', borderRadius: '12px', padding: '10px 12px', margin: '0 0 10px' });
    box.setAttribute('data-agenda-melding', '');
    var wat = m.meer ? 'Er is een agenda geopend' : m.minder ? 'Er is een agenda gesloten' : 'Er staan andere agenda\u2019s open';
    box.appendChild(el('div', { fontWeight: '700', fontSize: '13px', color: T.warn }, wat + (m.aantal > 1 ? ' (nu ' + m.aantal + ' agenda\u2019s).' : '.')));
    box.appendChild(el('div', { fontSize: '12px', color: T.ink, margin: '2px 0 8px' }, 'Je gekozen momenten zijn gezocht met de vorige agenda\u2019s. Opnieuw beginnen zoekt tijd die nu voor iedereen vrij is.'));
    var rij = el('div', { display: 'flex', gap: '8px' });
    var opnieuw = primaryBtn('Opnieuw beginnen', function () {
      BEWAARD.momenten = []; BEWAARD.balkOpen = false; BEWAARD.maak = null; BEWAARD.agendaMelding = null;
      plan.result = null; plan.error = ''; plan.raster = null;
      naarPagina('plan');
    });
    Object.assign(opnieuw.style, { marginTop: '0', flex: '1 1 0' });
    opnieuw.setAttribute('data-agenda-opnieuw', '');
    var negeer = secondaryBtn('Negeren', function () { BEWAARD.agendaMelding = null; renderPagina(); });
    negeer.style.flex = '1 1 0';
    negeer.setAttribute('data-agenda-negeren', '');
    rij.appendChild(opnieuw); rij.appendChild(negeer);
    box.appendChild(rij);
    return box;
  }
  function pagePlan() {
    var planBox = el('div');
    var melding = agendaMeldingBlok();
    if (melding) planBox.appendChild(melding);
    var meer = (state && state.inviteeCount > 1) ? state.inviteeCount : 0;
    if (meer) { planBox.appendChild(noteBox('Er staan ' + meer + ' agenda’s open: de planhulp zoekt tijd waarop iedereen vrij is.', 'ok')); planBox.lastChild.style.margin = '0 0 10px'; }
    // Lijst of weekraster.
    var seg = el('div', { display: 'flex', background: T.lineSoft, borderRadius: '10px', padding: '3px', marginBottom: '10px' });
    [['lijst', 'Lijst'], ['raster', 'Weekplanning']].forEach(function (o) {
      var aan = (plan.weergave || 'lijst') === o[0];
      var b = el('button', { flex: '1 1 0', border: '0', borderRadius: '8px', padding: '6px 0', cursor: 'pointer', font: '600 12.5px ' + FONT,
        background: aan ? '#fff' : 'transparent', color: aan ? T.ink : T.inkSoft, boxShadow: aan ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }, o[1]);
      b.type = 'button'; b.setAttribute('data-plan-weergave', o[0]); b.setAttribute('aria-pressed', aan ? 'true' : 'false');
      b.addEventListener('click', function () { plan.weergave = o[0]; renderPagina(); });
      seg.appendChild(b);
    });
    planBox.appendChild(seg);
    // Instellingen: Duur en (in de lijst) Vooruit als rijen keuzes. Een
    // wijziging zoekt meteen opnieuw.
    var opnieuw = function () { plan.result = null; plan.limit = PLAN_STAP; startPlan(); };
    var inst = el('div', { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px', alignItems: 'center', border: '1px solid ' + T.line, borderRadius: '12px', padding: '10px 12px' });
    inst.setAttribute('data-plan-instellingen', '');
    var rijLabel = function (t) { return el('span', { fontSize: '12px', fontWeight: '600', color: T.inkSoft }, t); };
    var keuze = function (tekst, aan, fn, attr) {
      var c = chipKnop(tekst, aan, fn, { padding: '0 9px', height: '28px', border: '1px solid ' + (aan ? T.brand : T.line) });
      if (attr) c.setAttribute(attr[0], attr[1]);
      return c;
    };
    var duur = el('div', { display: 'flex', flexWrap: 'wrap', gap: '4px' });
    [[30, '30 min'], [45, '45 min'], [60, '1 uur'], [90, '1,5 uur'], [120, '2 uur']].forEach(function (d) {
      duur.appendChild(keuze(d[1], plan.minutes === d[0], function () { plan.minutes = d[0]; opnieuw(); }, ['data-plan-duur', String(d[0])]));
    });
    inst.appendChild(rijLabel('Duur')); inst.appendChild(duur);
    if ((plan.weergave || 'lijst') === 'lijst') {
      var per = el('div', { display: 'flex', flexWrap: 'wrap', gap: '4px' });
      [[1, '1 week'], [2, '2 weken'], [4, '4 weken']].forEach(function (w) {
        per.appendChild(keuze(w[1], !plan.tot && !plan.totOpen && plan.weeks === w[0], function () { plan.weeks = w[0]; plan.tot = ''; plan.totOpen = false; opnieuw(); }, ['data-plan-weken', String(w[0])]));
      });
      var totAan = !!(plan.tot || plan.totOpen);
      per.appendChild(keuze(plan.tot ? 'Tot ' + dagLang(plan.tot, true).replace(/^\S+ /, '') : 'Tot datum', totAan, function () { plan.totOpen = true; renderPagina(); }, ['data-plan-tot', '']));
      inst.appendChild(rijLabel('Vooruit')); inst.appendChild(per);
    }
    // Optioneel: alleen vrije tijd op bepaalde dagen (standaard alle dagen aan).
    var dagRij = el('div', { display: 'flex', flexWrap: 'wrap', gap: '4px' });
    var gek = gekozenDagen() || [1, 2, 3, 4, 5];
    ['ma', 'di', 'wo', 'do', 'vr'].forEach(function (n, i) {
      var wd = i + 1, aan = gek.indexOf(wd) >= 0;
      var c = keuze(n, aan, function () {
        var nieuw = aan ? gek.filter(function (x) { return x !== wd; }) : gek.concat([wd]).sort();
        if (!nieuw.length) return;   // minstens één dag
        plan.dagen = nieuw.length === 5 ? null : nieuw;
        dagenGewijzigd();
      }, ['data-plan-dag', String(wd)]);
      c.style.minWidth = '36px';
      c.setAttribute('aria-pressed', aan ? 'true' : 'false');
      c.title = aan ? (gek.length === 1 ? 'Minstens één dag' : 'Deze dag niet tonen') : 'Deze dag ook tonen';
      dagRij.appendChild(c);
    });
    inst.appendChild(rijLabel('Dagen')); inst.appendChild(dagRij);
    planBox.appendChild(inst);
    if ((plan.weergave || 'lijst') === 'lijst' && (plan.tot || plan.totOpen)) {
      var kz = maakKiezers();
      var totRij = el('div', { display: 'flex', alignItems: 'flex-end', gap: '8px', marginTop: '8px' });
      totRij.appendChild(fieldLabel('Zoek tot en met', kz.datum(plan.tot, function (v) { plan.tot = v; opnieuw(); })));
      var wis = secondaryBtn('Wissen', function () { plan.tot = ''; plan.totOpen = false; opnieuw(); });
      Object.assign(wis.style, { width: 'auto', padding: '0 12px', marginBottom: '8px' });
      totRij.appendChild(wis);
      planBox.appendChild(totRij);
      planBox.appendChild(kz.host);
    }
    var uitslag = kopieUitslag();
    // Weekraster: eigen gegevens per week, los van 'Vooruit' in de lijst.
    if (plan.weergave === 'raster') {
      if (uitslag) planBox.appendChild(uitslag);
      planBox.appendChild(planRaster());
      return planBox;
    }
    if (plan.busy && !plan.meerBezig) { zorgVoorStijl(); var lb = laadBalk(); lb.style.marginTop = '10px'; planBox.appendChild(lb); }
    if (plan.error) { planBox.appendChild(noteBox(plan.error, 'bad')); planBox.appendChild(primaryBtn('Opnieuw zoeken', function () { startPlan(); })); }
    if (uitslag) planBox.appendChild(uitslag);
    var res = metDagen(plan.result);
    if (!res && !plan.busy && !plan.error) planBox.appendChild(primaryBtn('Vrije tijd zoeken', function () { startPlan(); }));
    if (res && !(plan.busy && !res.gaps.length)) {
      if (!res.gaps.length) {
        if (feestdagenOpWerkdag(res).length) planBox.appendChild(planLijst(res));
        planBox.appendChild(noteBox('Geen vrij blok van ' + fmtMin(res.minutes) + ' gevonden ' +
          (res.to ? 't/m ' + dayLabel(res.to) : 'in de komende ' + (res.weeks === 1 ? 'week' : res.weeks + ' weken')) + '.', 'warn'));
      } else {
        planBox.appendChild(planLijst(res));
        if (kanMeer(plan.result)) {
          var meerKnop = secondaryBtn(plan.meerBezig ? 'Meer laden…' : 'Meer laden', function () { if (!plan.meerBezig) meerLaden(plan.result); });
          meerKnop.setAttribute('data-plan-meer', '');
          meerKnop.disabled = !!plan.meerBezig;
          meerKnop.style.marginTop = '12px';
          planBox.appendChild(meerKnop);
        }
        if (res.onsCheck === 'unknown') planBox.appendChild(txt('help', 'Open één keer een afspraak in ONS; daarna kijkt de planhulp gekozen tijden ook na met de overlapcontrole van ONS.', { margin: '10px 0 0', fontSize: '11.5px' }));
      }
    }
    return planBox;
  }
  // Een begintijd kiezen of loslaten; bij kiezen ook ONS' overlapcontrole.
  function tikMoment(date, m, duur) {
    var aan = momentIndex(date, m) < 0;
    wisselMoment(date, m);
    var mo = BEWAARD.momenten[momentIndex(date, m)];
    if (aan && mo && actions.onSlotCheck) {
      actions.onSlotCheck({ date: date, startMin: m, minutes: duur }, function (r) {
        mo.ons = r && r.status === 'ready' ? r.overlap : null;
        setTimeout(function () { if (pagina === 'plan') renderPagina(); }, 0);
      });
    }
    renderPagina();
  }
  function dagenVan(res) {
    var dagen = [], per = {};
    res.gaps.forEach(function (g) { if (!per[g.date]) { per[g.date] = []; dagen.push(g.date); } per[g.date].push(g); });
    return { dagen: dagen, per: per };
  }
  // Feestdagen (uit ONS) van maandag tot en met vrijdag: { date, name }.
  function feestdagenOpWerkdag(res) {
    // Goede Vrijdag is geen vrije dag (ook al stuurt ONS hem mee).
    return ((res && res.holidays) || []).filter(function (h) { var w = datumUitYmd(h.date).getDay(); return w > 0 && w < 6 && !/goede\s*vrijdag/i.test(String(h.name || '')); });
  }
  function feestdagPer(res) { var per = {}; feestdagenOpWerkdag(res).forEach(function (h) { per[h.date] = h; }); return per; }
  // Kleine animatie per feestdag: één keer als de dag in beeld komt (loopt
  // door als het paneel intussen opnieuw getekend wordt), met de muis erover
  // nog eens. Bij 'minder beweging' niet.
  var feestStart = {};
  function animeerFeestdag(ic, naam, sleutel, houder) {
    if (!ic.animate) return;
    var rustig = false;
    try { rustig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    if (rustig) return;
    var a = feestdagAnimatie(naam);
    ic.style.transformOrigin = a.origin;
    ic.style.transformBox = 'fill-box';
    ic.setAttribute('data-feestdag-animatie', '');
    var speel = function (vanaf) {
      try { ic.animate(a.frames, { duration: a.duur, delay: -(vanaf || 0) + (vanaf ? 0 : 250), easing: 'ease-in-out' }); } catch (e) {}
    };
    var nu = Date.now();
    if (!feestStart[sleutel]) { feestStart[sleutel] = nu; speel(0); }
    else if (nu - feestStart[sleutel] < a.duur + 250) speel(Math.max(0, nu - feestStart[sleutel] - 250));
    if (houder) houder.addEventListener('mouseenter', function () { speel(0); });
  }
  // Feestdag in de lijst: gekleurde regel met tekening, zonder tijden.
  function feestdagRegel(h) {
    var st = feestdagStijl(h.name);
    var r = el('div', { display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px', padding: '8px 10px', margin: '14px 0 6px', background: st.achtergrond, color: st.ink });
    r.setAttribute('data-feestdag', h.date);
    r.setAttribute('data-feestdag-stijl', st.sleutel);
    var ic = feestdagIcoon(document, h.name);
    ic.setAttribute('width', '32'); ic.setAttribute('height', '32'); ic.style.flex = '0 0 auto';
    r.appendChild(ic);
    animeerFeestdag(ic, h.name, 'regel|' + h.date, r);
    var t = el('div', { minWidth: '0' });
    t.appendChild(el('div', { fontWeight: '700', fontSize: '13.5px' }, dagLang(h.date)));
    t.appendChild(el('div', { fontSize: '11.5px', opacity: '.9' }, h.name + ', geen tijden'));
    r.appendChild(t);
    return r;
  }
  // Feestdag in het weekraster: de hele kolom, met tekening en de naam.
  function feestdagKolom(h, hoog) {
    var st = feestdagStijl(h.name);
    var k = el('div', { position: 'relative', height: hoog + 'px', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: st.achtergrond, color: st.ink, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06)' });
    k.setAttribute('data-raster-dag', h.date);
    k.setAttribute('data-raster-feestdag', h.name);
    k.setAttribute('data-feestdag-stijl', st.sleutel);
    k.title = h.name;
    if (st.slinger) { var sl = feestdagSlinger(document); Object.assign(sl.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '10px' }); k.appendChild(sl); }
    var ic = feestdagIcoon(document, h.name);
    Object.assign(ic.style, { width: '78%', maxWidth: '44px', marginTop: '14px', flex: '0 0 auto', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.12))' });
    k.appendChild(ic);
    animeerFeestdag(ic, h.name, 'kolom|' + h.date + '|' + plan.rasterWeek, k);
    var nm = el('div', { writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: '800', fontSize: '13px', letterSpacing: '.3px', margin: '12px 0 12px', flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden' }, h.name);
    k.appendChild(nm);
    return k;
  }
  var TOON_TIJDEN = 8;
  function planLijst(res) {
    var box = el('div');
    var duur = res.minutes, d = dagenVan(res);
    plan.open = plan.open || {};
    var feest = feestdagPer(res);
    var alleDagen = d.dagen.concat(Object.keys(feest).filter(function (k) { return !d.per[k]; })).sort();
    alleDagen.forEach(function (date) {
      if (feest[date] && !d.per[date]) { box.appendChild(feestdagRegel(feest[date])); return; }
      var gaps = d.per[date];
      var kop = el('div', { display: 'flex', alignItems: 'flex-end', gap: '8px', margin: '14px 0 6px', paddingBottom: '5px', borderBottom: '1px solid ' + T.line });
      var kopTekst = el('div', { flex: '1 1 auto', minWidth: '0' });
      kopTekst.appendChild(el('div', { fontWeight: '700', fontSize: '13.5px', color: T.ink }, dagLang(date)));
      var vrij = gaps.map(function (g) { return vanTot(g.startMin, g.endMin); });
      kopTekst.appendChild(el('div', { fontSize: '11.5px', color: T.inkSoft }, 'Vrij ' + (vrij.length > 1 ? vrij.slice(0, -1).join(', ') + ' en ' + vrij[vrij.length - 1] : vrij[0])));
      kop.appendChild(kopTekst);
      var naar = el('button', { border: '0', background: 'transparent', color: T.brand, cursor: 'pointer', font: '600 11.5px ' + FONT, padding: '0', whiteSpace: 'nowrap' }, 'Naar dag');
      naar.type = 'button'; naar.title = 'Deze dag openen in de agenda';
      naar.addEventListener('click', function () { if (actions.onJumpToDay) actions.onJumpToDay(date, true); });
      kop.appendChild(naar);
      box.appendChild(kop);
      var tijden = [];
      gaps.forEach(function (g) { for (var m = g.startMin; m + duur <= g.endMin; m += 15) tijden.push({ g: g, m: m }); });
      var alle = plan.open[date];
      // Gekozen tijden altijd tonen, ook als ze na de eerste reeks vallen.
      var zicht = tijden.filter(function (t, i) { return alle || i < TOON_TIJDEN || momentIndex(date, t.m) >= 0; });
      var rij = el('div', { display: 'flex', flexWrap: 'wrap', gap: '5px' });
      var meldingen = [];
      zicht.forEach(function (t) {
        var gek = momentIndex(date, t.m) >= 0;
        var mo = gek ? BEWAARD.momenten[momentIndex(date, t.m)] : null;
        var resIn = reserveringenIn(t.g, t.m, duur);
        var onsOverlap = (mo && mo.ons === true) || (!gek && t.m === t.g.startMin && t.g.ons === true);
        var c = chipKnop(hm(t.m), gek, function () { tikMoment(date, t.m, duur); },
          { minWidth: '54px', padding: '0 8px', height: '30px', border: '1px ' + (resIn.length && !gek ? 'dashed ' : 'solid ') + (gek ? T.brand : (onsOverlap ? T.warn : T.line)) });
        if (resIn.length) {
          c.appendChild(el('small', { fontSize: '9px', fontWeight: '800', marginLeft: '2px', color: gek ? '#fff' : T.warn, verticalAlign: 'super' }, 'R'));
          c.title = 'Valt in reservering: ' + reserveringTekst(resIn);
          c.setAttribute('data-reservering', resIn[0].label || '');
        }
        if (onsOverlap) { c.title = 'ONS meldt overlap op dit tijdstip'; c.setAttribute('data-ons-overlap', ''); if (gek) meldingen.push(hm(t.m)); }
        c.setAttribute('data-dag', date);
        c.setAttribute('data-start', hm(t.m));
        c.setAttribute('aria-pressed', gek ? 'true' : 'false');
        rij.appendChild(c);
      });
      box.appendChild(rij);
      if (tijden.length > zicht.length) {
        var meer = el('button', { border: '0', background: 'transparent', color: T.brand, cursor: 'pointer', font: '600 12px ' + FONT, padding: '4px 0 0' }, 'Nog ' + (tijden.length - zicht.length) + (tijden.length - zicht.length === 1 ? ' tijd' : ' tijden'));
        meer.type = 'button'; meer.setAttribute('data-meer-tijden', date);
        meer.addEventListener('click', function () { plan.open[date] = true; renderPagina(); });
        box.appendChild(meer);
      }
      if (meldingen.length) { var nb = noteBox('ONS meldt overlap op ' + meldingen.join(', ') + '.', 'warn'); nb.style.margin = '6px 0 0'; box.appendChild(nb); }
    });
    var metRes = res.gaps.some(function (g) { return (g.reservations || []).length; });
    if (metRes) box.appendChild(txt('help', 'R = valt in een reservering (tijd vastgehouden voor een soort werk).', { margin: '10px 0 0', fontSize: '11.5px' }));
    return box;
  }
  // Maandag van de week van een datum ('YYYY-MM-DD').
  function maandag(ymd) { var d = datumUitYmd(ymd); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
  // Weekraster: per week de vrije tijd ophalen (ma t/m vr), zonder grens hoe
  // ver vooruit; niet terug voor de huidige week.
  function laadRaster() {
    var vandaag = ymdVan(new Date());
    var ma = plan.rasterWeek, vr = ymdVan(new Date(datumUitYmd(ma).getFullYear(), datumUitYmd(ma).getMonth(), datumUitYmd(ma).getDate() + 4));
    var rs = plan.raster = { key: ma + '|' + plan.minutes, busy: true, result: null, error: '' };
    if (vr < vandaag) { rs.busy = false; rs.result = { gaps: [] }; return; }
    actions.onFreeSlots(plan.minutes, 1, function (res) {
      if (plan.raster !== rs) return;
      rs.busy = false;
      if (res && res.ok && res.result) rs.result = res.result;
      else rs.error = (res && res.error) || 'Vrije tijd ophalen mislukt.';
      // Pas na de huidige opbouw opnieuw tekenen (een antwoord uit het geheugen
      // komt meteen; anders staat het raster er twee keer).
      setTimeout(function () { if (plan.raster === rs && pagina === 'plan' && plan.weergave === 'raster') renderPagina(); }, 0);
    }, vr, false, false, ma > vandaag ? ma : vandaag);
  }
  function planRaster() {
    var box = el('div');
    var huidigeWeek = ymdVan(maandag(ymdVan(new Date())));
    if (!plan.rasterWeek || plan.rasterWeek < huidigeWeek) plan.rasterWeek = huidigeWeek;
    var rs = plan.raster;
    if ((!rs || rs.key !== plan.rasterWeek + '|' + plan.minutes) && actions.onFreeSlots) { laadRaster(); rs = plan.raster; }
    var res = (rs && rs.result) || { gaps: [] };
    var duur = plan.minutes, d = dagenVan(res);
    var ma = datumUitYmd(plan.rasterWeek);
    var vr = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + 4);
    // Weeknavigatie: vooruit zonder maximum.
    var nav = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0 6px' });
    var pijl = function (tekst, delta, attr) {
      var verborgen = delta < 0 && plan.rasterWeek <= huidigeWeek;
      var b = el('button', { border: '0', background: 'transparent', color: T.brand, cursor: 'pointer', font: '700 16px ' + FONT, padding: '0 6px', visibility: verborgen ? 'hidden' : 'visible' }, tekst);
      b.type = 'button'; b.setAttribute(attr, '');
      b.setAttribute('aria-label', delta < 0 ? 'Vorige week' : 'Volgende week');
      b.addEventListener('click', function () {
        var m = datumUitYmd(plan.rasterWeek);
        plan.rasterWeek = ymdVan(new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7 * delta));
        renderPagina();
      });
      return b;
    };
    nav.appendChild(pijl('‹', -1, 'data-week-terug'));
    // 'Week 42' met eronder '12 tot en met 16 oktober'.
    var titel = el('div', { textAlign: 'center', flex: '1 1 auto', minWidth: '0' });
    titel.appendChild(el('div', { fontWeight: '700', fontSize: '13px', color: T.ink }, 'Week ' + isoWeek(plan.rasterWeek)));
    titel.appendChild(el('div', { fontSize: '11.5px', color: T.inkSoft }, ma.getDate() + (ma.getMonth() !== vr.getMonth() ? ' ' + MON_LANG[ma.getMonth()] : '') + ' tot en met ' + vr.getDate() + ' ' + MON_LANG[vr.getMonth()] + (ma.getFullYear() !== new Date().getFullYear() ? ' ' + ma.getFullYear() : '')));
    titel.setAttribute('data-week-titel', '');
    nav.appendChild(titel);
    nav.appendChild(pijl('›', 1, 'data-week-verder'));
    // Vandaag: terug naar de huidige week (grijs als je daar al bent).
    var hier = plan.rasterWeek === huidigeWeek;
    var vk = el('button', { flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 9px', marginLeft: '4px', whiteSpace: 'nowrap',
      border: '1px solid ' + (hier ? T.line : T.brand), borderRadius: '8px', background: '#fff', color: hier ? '#b9b0b4' : T.brand, font: '600 12px ' + FONT, cursor: hier ? 'default' : 'pointer' });
    vk.type = 'button'; vk.disabled = hier; vk.setAttribute('data-week-vandaag', '');
    vk.title = hier ? 'Je bekijkt de week van vandaag' : 'Naar de week van vandaag';
    var kal = document.createElementNS(SVG_NS, 'svg');
    kal.setAttribute('viewBox', '0 0 16 16'); kal.setAttribute('width', '14'); kal.setAttribute('height', '14'); kal.setAttribute('aria-hidden', 'true');
    kal.setAttribute('fill', 'none'); kal.setAttribute('stroke', 'currentColor'); kal.setAttribute('stroke-width', '1.6');
    [['rect', { x: '2', y: '3', width: '12', height: '11', rx: '2' }], ['path', { d: 'M2 7h12M5 1.5v3M11 1.5v3' }], ['circle', { cx: '8', cy: '10.5', r: '1.4', fill: 'currentColor', stroke: 'none' }]].forEach(function (v) {
      var n = document.createElementNS(SVG_NS, v[0]); Object.keys(v[1]).forEach(function (k) { n.setAttribute(k, v[1][k]); }); kal.appendChild(n);
    });
    vk.appendChild(kal); vk.appendChild(document.createTextNode('Vandaag'));
    vk.addEventListener('click', function () { if (plan.rasterWeek !== huidigeWeek) { plan.rasterWeek = huidigeWeek; renderPagina(); } });
    nav.appendChild(vk);
    box.appendChild(nav);
    if (rs && rs.busy) { zorgVoorStijl(); var lb = laadBalk(); lb.style.margin = '0 0 8px'; box.appendChild(lb); }
    if (rs && rs.error) { var fb = noteBox(rs.error, 'bad'); fb.style.margin = '0 0 8px'; box.appendChild(fb); }
    // Raster: uren links, ma t/m vr. Grijs = bezet (buiten de vrije tijd), groen = vrij.
    var ws = Math.floor((res.windowStart != null ? res.windowStart : 480) / 60) * 60;
    var we = Math.ceil((res.windowEnd != null ? res.windowEnd : 1020) / 60) * 60;
    var PX = 0.75, hoog = (we - ws) * PX;
    var raster = el('div', { display: 'grid', gridTemplateColumns: '26px repeat(5, 1fr)', gap: '3px', fontSize: '11px' });
    raster.setAttribute('data-raster', '');
    raster.appendChild(el('div'));
    var feest = feestdagPer(res);
    var nuD = new Date(), vandaagYmd = ymdVan(nuD), nuMin = nuD.getHours() * 60 + nuD.getMinutes();
    ['ma', 'di', 'wo', 'do', 'vr'].forEach(function (n, i) {
      var dag = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + i);
      var fh = feest[ymdVan(dag)], fst = fh ? feestdagStijl(fh.name) : null;
      var isVandaag = ymdVan(dag) === vandaagYmd;
      var dagUit = !fst && !opGekozenDag(ymdVan(dag));
      var hk = el('div', { textAlign: 'center', color: isVandaag ? '#fff' : (fst ? fst.kop : T.inkSoft), fontWeight: '600', lineHeight: '1.2', opacity: dagUit && !isVandaag ? '.45' : '1' }, n);
      hk.appendChild(el('div', { color: isVandaag ? '#fff' : (fst ? fst.kop : T.ink), fontWeight: '700' }, String(dag.getDate())));
      if (isVandaag) { Object.assign(hk.style, { background: T.brand, borderRadius: '6px', padding: '1px 0' }); hk.setAttribute('data-raster-vandaag', ''); hk.title = 'Vandaag'; }
      if (fst) { hk.title = fh.name; hk.appendChild(el('i', { display: 'block', width: '6px', height: '6px', borderRadius: '3px', margin: '2px auto 0', background: fst.stip })); }
      raster.appendChild(hk);
    });
    var uren = el('div', { position: 'relative', height: hoog + 'px' });
    // Uurlabel midden op de uurlijn.
    for (var u = ws; u < we; u += 60) uren.appendChild(el('span', { position: 'absolute', top: Math.max(0, (u - ws) * PX - 7) + 'px', color: T.inkSoft, fontVariantNumeric: 'tabular-nums', lineHeight: '14px' }, String(u / 60)));
    raster.appendChild(uren);
    for (var i = 0; i < 5; i++) {
      (function (i) {
        var dag = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + i);
        var date = ymdVan(dag);
        if (feest[date]) { raster.appendChild(feestdagKolom(feest[date], hoog)); return; }
        // Uitgevinkt in Dagen: geen vrije tijd tonen.
        if (!opGekozenDag(date)) {
          var uitK = el('div', { position: 'relative', height: hoog + 'px', borderRadius: '6px', background: 'repeating-linear-gradient(135deg, #f3efee 0 5px, #ece7e5 5px 10px)' });
          uitK.setAttribute('data-raster-dag', date); uitK.setAttribute('data-raster-uit', '');
          uitK.title = 'Uitgevinkt bij Dagen';
          uitK.appendChild(el('div', { position: 'absolute', top: '4px', left: '0', right: '0', textAlign: 'center', color: T.inkSoft, fontSize: '10px' }, 'Uit'));
          raster.appendChild(uitK);
          return;
        }
        var kol = el('div', { position: 'relative', height: hoog + 'px', borderRadius: '6px', background: '#ece7e5' });
        kol.setAttribute('data-raster-dag', date);
        (d.per[date] || []).forEach(function (g) {
          var vrij = el('div', { position: 'absolute', left: '2px', right: '2px', top: ((g.startMin - ws) * PX) + 'px', height: ((g.endMin - g.startMin) * PX) + 'px',
            background: '#e6f4ec', border: '1px dashed #7cc19c', borderRadius: '5px', boxSizing: 'border-box' });
          vrij.setAttribute('data-raster-vrij', hm(g.startMin) + '-' + hm(g.endMin));
          (g.reservations || []).forEach(function (r) {
            var a = Math.max(r.startMin, g.startMin), b = Math.min(r.endMin, g.endMin);
            if (b <= a) return;
            var rb = el('div', { position: 'absolute', left: '0', right: '0', top: ((a - g.startMin) * PX) + 'px', height: ((b - a) * PX) + 'px', background: '#fdf3e2', color: '#8a5a00', fontSize: '9px', fontWeight: '800', padding: '1px 3px', boxSizing: 'border-box', pointerEvents: 'none' }, 'R');
            rb.title = 'Reservering: ' + reserveringTekst([r]);
            vrij.appendChild(rb);
          });
          // Elke mogelijke begintijd is een strookje van een kwartier: tik = kiezen.
          for (var m = g.startMin; m + duur <= g.endMin; m += 15) {
            (function (m) {
              var s = el('button', { position: 'absolute', left: '0', right: '0', top: ((m - g.startMin) * PX) + 'px', height: (15 * PX) + 'px', border: '0', padding: '0', background: 'transparent', cursor: 'pointer' });
              s.type = 'button';
              s.title = hm(m) + ' tot ' + hm(m + duur) + ' kiezen';
              s.setAttribute('aria-label', dayLabel(date) + ' ' + hm(m) + ' kiezen');
              s.setAttribute('data-dag', date); s.setAttribute('data-start', hm(m));
              s.addEventListener('mouseenter', function () { s.style.background = 'rgba(204,8,125,.18)'; });
              s.addEventListener('mouseleave', function () { s.style.background = 'transparent'; });
              s.addEventListener('click', function () { tikMoment(date, m, duur); });
              vrij.appendChild(s);
            })(m);
          }
          kol.appendChild(vrij);
        });
        // Gekozen momenten (roze); tik om los te laten.
        BEWAARD.momenten.filter(function (mo) { return mo.date === date; }).forEach(function (mo) {
          var b = el('button', { position: 'absolute', left: '2px', right: '2px', top: ((mo.startMin - ws) * PX) + 'px', height: (duur * PX) + 'px', border: '0', borderRadius: '5px',
            background: mo.ons === true ? T.warn : T.brand, color: '#fff', font: '700 10px ' + FONT, textAlign: 'left', padding: '2px 4px', cursor: 'pointer', zIndex: '2' }, hm(mo.startMin) + ' ✓');
          b.type = 'button'; b.setAttribute('data-raster-gekozen', date + ' ' + hm(mo.startMin));
          b.title = mo.ons === true ? 'ONS meldt overlap; tik om los te laten' : 'Gekozen; tik om los te laten';
          b.addEventListener('click', function () { tikMoment(date, mo.startMin, duur); });
          kol.appendChild(b);
        });
        // Vandaag: wat voorbij is gestreept, met een stip en lijn op nu.
        if (date === vandaagYmd && nuMin > ws) {
          var voorbij = el('div', { position: 'absolute', left: '0', right: '0', top: '0', height: ((Math.min(nuMin, we) - ws) * PX) + 'px', borderRadius: '6px 6px 0 0', pointerEvents: 'none', zIndex: '1',
            background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.55) 0 4px, transparent 4px 8px)' });
          voorbij.setAttribute('data-raster-voorbij', '');
          kol.appendChild(voorbij);
          if (nuMin < we) {
            var nuLijn = el('div', { position: 'absolute', left: '-2px', right: '0', top: ((nuMin - ws) * PX - 1) + 'px', height: '2px', background: T.brand, pointerEvents: 'none', zIndex: '3' });
            nuLijn.appendChild(el('i', { position: 'absolute', left: '-3px', top: '-3px', width: '8px', height: '8px', borderRadius: '4px', background: T.brand }));
            nuLijn.setAttribute('data-raster-nu', hm(nuMin)); nuLijn.title = 'Nu ' + hm(nuMin);
            kol.appendChild(nuLijn);
          }
        }
        for (var uu = ws + 60; uu < we; uu += 60) kol.appendChild(el('div', { position: 'absolute', left: '0', right: '0', top: ((uu - ws) * PX) + 'px', height: '1px', background: 'rgba(32,29,31,.16)', pointerEvents: 'none', zIndex: '1' }));
        // Geen vrije tijd: 'Bezet' (of 'Voorbij' voor eerdere dagen); niet tijdens het laden.
        if (!(d.per[date] || []).length && !(rs && rs.busy)) kol.appendChild(el('div', { position: 'absolute', top: '4px', left: '0', right: '0', textAlign: 'center', color: T.inkSoft, fontSize: '10px' }, date < ymdVan(new Date()) ? 'Voorbij' : 'Bezet'));
        raster.appendChild(kol);
      })(i);
    }
    box.appendChild(raster);
    var leg = el('div', { display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: T.inkSoft, marginTop: '8px' });
    var legenda = [['#ece7e5', 'Bezet'], ['#e6f4ec', 'Vrij'], ['#fdf3e2', 'Reservering'], [T.brand, 'Gekozen']];
    if (Object.keys(feest).length) legenda.push(['linear-gradient(135deg,#ff9a33,#cfe8fd,#24684a)', 'Feestdag']);
    legenda.forEach(function (l) {
      var s = el('span'); s.appendChild(el('i', { display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: l[0], marginRight: '4px', verticalAlign: '-1px' })); s.appendChild(document.createTextNode(l[1])); leg.appendChild(s);
    });
    box.appendChild(leg);
    box.appendChild(txt('help', 'Tik in het groen op de begintijd; de afspraak duurt ' + fmtMin(duur) + '.', { margin: '6px 0 0', fontSize: '11.5px' }));
    return box;
  }

  // Schakelaar uit het beheerscherm (state.features; ontbreekt = aan).
  function fAan(k) { return !(state && state.features && state.features[k] === false); }
  var navRouteAan = null;
  function renderNav() {
    navRouteAan = JSON.stringify((state && state.features) || {}) + (state && state.routeEnabled === false);
    navBox.innerHTML = '';
    if (fAan('weekRatio')) navBox.appendChild(navCard(ICON_RATIO, 'Verhouding per uursoort', 'Direct, indirect en reistijd per cliëntgebonden uursoort', function () { naarPagina('verhouding'); }));
    if (fAan('openRegistrations')) navBox.appendChild(navCard(ICON_RANGE, 'Open registraties', 'Controleer een periode op afspraken die nog niet geregistreerd zijn', function () { naarPagina('open'); }));
    if (fAan('quickRegister')) navBox.appendChild(navCard(ICON_QUICK, 'Snel registreren', 'Registratieformulier openen met datum en tijd ingevuld', function () { naarPagina('snel'); }));
    if (fAan('planner')) navBox.appendChild(navCard(ICON_PLAN, 'Planhulp', 'Vrije tijd vinden voor een afspraak in de komende weken', function () { naarPagina('plan'); }));
    if (!(state && state.routeEnabled === false) && fAan('routeLink')) {
      navBox.appendChild(navCard(ICON_ROUTE, 'Route van de dag', 'Je afspraken bij cliënten van een dag op volgorde in Google Maps', function () { naarPagina('route'); }));
    }
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
    if (p === 'clienttijd' && fAan('production') && !prod.result && !prod.busy && !prod.error) { vulStandaarden(); startProduction(); }
    if (p === 'open' && !range.result && !range.busy && !range.error) { vulStandaarden(); startRangeCheck(); }
    if (p === 'plan' && !plan.result && !plan.busy && !plan.error) startPlan();
    if (p === 'route') startRoute();
    setTimeout(misschienRondleiding, 0);
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
    var doel = pagina === 'maken' ? 'plan' : 'hoofd';
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
    if (!fAan('production')) return box; // productieverloop uit (beheer)

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
    midden.appendChild(txt('help', (sub ? sub + ', ' : '') + 'vanaf ' + dayLabel(doel)));
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
    kop.appendChild(txt('section', open ? (open + (open === 1 ? ' afspraak' : ' afspraken') + ' open, samen ' + fmtMin(t.openMinutes)) : 'Alles afgewerkt', { margin: '0' }));
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
        row.appendChild(el('span', { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: klaar ? 'line-through' : 'none' }, (it.persoon ? it.persoon + ': ' : '') + (it.uursoort || '')));
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
  /* ── Route van de dag ── */
  // Vertrekpunt alleen op dit apparaat (localStorage van het zijpaneel).
  var VERTREK_KEY = 'onsah.routeVertrekpunt';
  var vertrekGeheugen = null;   // als localStorage niet beschikbaar is
  function leesVertrek() {
    if (vertrekGeheugen != null) return vertrekGeheugen;
    try { return localStorage.getItem(VERTREK_KEY) || ''; } catch (e) { return ''; }
  }
  function bewaarVertrek(v) {
    vertrekGeheugen = v || '';
    try { if (v) localStorage.setItem(VERTREK_KEY, v); else localStorage.removeItem(VERTREK_KEY); } catch (e) {}
  }
  function startRoute() {
    var rt = BEWAARD.route;
    if (!rt.date) rt.date = (state && (state.viewDate || state.today)) || '';
    if (rt.busy || !actions.onDayRoute || !rt.date) return;
    rt.busy = true; rt.error = '';
    if (pagina === 'route') renderPagina();
    var voor = rt.date;
    actions.onDayRoute(rt.date, leesVertrek(), function (res) {
      if (BEWAARD.route !== rt || rt.date !== voor) return;
      rt.busy = false;
      if (res && res.ok && res.result) rt.result = res.result;
      else { rt.result = null; rt.error = (res && res.error) || 'Route ophalen mislukt.'; }
      if (pagina === 'route') renderPagina();
    });
  }
  function pageRoute() {
    var box = el('div');
    var rt = BEWAARD.route;
    box.appendChild(txt('help', 'Je afspraken met een cliënt van een dag (niet op een kantoorlocatie) op volgorde van begintijd. \u2018Route openen\u2019 opent Google Maps met alle adressen; die gaan dan naar Google, net als met de kaartlink in het detailvenster van ONS.', { margin: '0 0 10px' }));
    var k = maakKiezers();
    box.appendChild(fieldLabel('Dag', k.datum(rt.date, function (v) { rt.date = v; rt.result = null; rt.busy = false; startRoute(); })));
    box.appendChild(k.host);
    var vertrek = inputEl('text', leesVertrek(), function () {});
    vertrek.placeholder = 'Bijv. kantooradres (optioneel)';
    vertrek.setAttribute('data-vertrekpunt', '');
    vertrek.addEventListener('change', function () { bewaarVertrek(vertrek.value.trim()); rt.result = null; startRoute(); });
    var vLab = fieldLabel('Vertrekpunt', vertrek);
    vLab.style.marginTop = '10px';
    box.appendChild(vLab);
    if (rt.busy) { zorgVoorStijl(); var lb = laadBalk(); lb.style.marginTop = '12px'; box.appendChild(lb); }
    if (rt.error) box.appendChild(noteBox(rt.error, 'bad'));
    var r = rt.result;
    if (r && !rt.busy) {
      (r.persons || []).forEach(function (p, i) {
        var blok = el('div', { marginTop: '14px', paddingTop: i ? '12px' : '0', borderTop: i ? '1px solid ' + T.line : '0' });
        blok.setAttribute('data-route-persoon', p.id || '');
        if (p.name) blok.appendChild(txt('section', p.name));
        if (!p.stops.length) { blok.appendChild(txt('help', 'Geen afspraken bij cliënten op ' + dayLabel(r.date) + '.')); box.appendChild(blok); return; }
        var lijst = el('div', { display: 'flex', flexDirection: 'column', gap: '4px', margin: '6px 0 0' });
        p.stops.forEach(function (st, j) {
          var rij = el('div', { display: 'flex', gap: '10px', alignItems: 'baseline', fontSize: '13px', color: T.ink, padding: '6px 0', borderBottom: '1px solid ' + T.lineSoft });
          rij.appendChild(el('span', { flex: '0 0 auto', width: '18px', height: '18px', borderRadius: '9px', background: st.address ? T.brand : T.line, color: '#fff', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }, String(j + 1)));
          rij.appendChild(el('span', { flex: '0 0 44px', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }, st.start));
          rij.appendChild(st.address ? el('span', { flex: '1 1 auto' }, st.address) : el('span', { flex: '1 1 auto', color: T.warn }, 'Adres onbekend'));
          lijst.appendChild(rij);
        });
        blok.appendChild(lijst);
        if (p.missing) blok.appendChild(txt('help', p.missing + (p.missing === 1 ? ' afspraak zonder adres staat' : ' afspraken zonder adres staan') + ' niet in de route.', { margin: '6px 0 0' }));
        var vertrekAdres = leesVertrek();
        // Kaart (Google Maps Embed), of na 'QR-code tonen' op dezelfde plek een
        // QR-code: scannen met de telefoon opent Google Maps met de route. Beide
        // volgen de kortste volgorde als die berekend is. De QR-code wordt hier
        // gemaakt; er gaat niets naar een QR-dienst.
        var pid = p.id || ('p' + i);
        rt.qr = rt.qr || {};
        var metPcQr = p.stops.filter(function (st) { return st.address && /\b[1-9]\d{3}\s?[A-Za-z]{2}\b/.test(st.address); });
        var kortVolg = p.kort && p.kort.order ? p.kort.order.map(function (k) { return metPcQr[k]; }).filter(Boolean) : null;
        var kaartStops = (kortVolg || p.stops.filter(function (st) { return st.address; })).map(function (st) { return st.address; });
        var qrUrls = kortVolg ? mapsUrls(kortVolg.map(function (st) { return st.address; }), vertrekAdres, true) : (p.urls || []);
        var kaartKey = state && state.mapsEmbedKey;
        if (rt.qr[pid] && qrUrls.length) {
          var qrBox = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '10px', padding: '12px', border: '1px solid ' + T.line, borderRadius: '12px', background: '#fff' });
          qrBox.setAttribute('data-route-qr', p.id || '');
          qrUrls.forEach(function (u, n) {
            if (qrUrls.length > 1) qrBox.appendChild(el('div', { fontSize: '12px', fontWeight: '600', color: T.inkSoft, marginTop: n ? '8px' : '0' }, 'Deel ' + (n + 1) + ' van ' + qrUrls.length));
            var svg = qrSvg(document, u, 220);
            if (svg) { svg.setAttribute('aria-label', 'QR-code van de route' + (qrUrls.length > 1 ? ', deel ' + (n + 1) : '')); svg.setAttribute('data-qr-url', u); qrBox.appendChild(svg); }
            else qrBox.appendChild(noteBox('Deze route is te lang voor een QR-code.', 'warn'));
          });
          qrBox.appendChild(txt('help', 'Scan met de camera van je telefoon; Google Maps opent met de route' + (kortVolg ? ' in de kortste volgorde' : '') + '.', { margin: '4px 0 0', fontSize: '11.5px', textAlign: 'center' }));
          blok.appendChild(qrBox);
        } else if (kaartKey && kaartStops.length) {
          var ifr = document.createElement('iframe');
          ifr.src = embedUrl(kaartKey, kaartStops, vertrekAdres);
          ifr.title = 'Kaart van de route';
          ifr.setAttribute('loading', 'lazy');
          ifr.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
          ifr.setAttribute('data-kaart', '');
          Object.assign(ifr.style, { width: '100%', height: '300px', border: '1px solid ' + T.line, borderRadius: '12px', marginTop: '10px', display: 'block' });
          blok.appendChild(ifr);
        } else if (!kaartKey && kaartStops.length) {
          blok.appendChild(txt('help', 'Voor de kaart: vul in het beheerscherm (Functies \u2192 Google Maps) een sleutel voor de Maps Embed API in.', { margin: '8px 0 0', fontSize: '11.5px' }));
        }
        if (qrUrls.length) {
          var wissel = secondaryBtn(rt.qr[pid] ? 'Kaart tonen' : 'QR-code tonen', function () { rt.qr[pid] = !rt.qr[pid]; renderPagina(); });
          wissel.style.marginTop = '8px';
          wissel.setAttribute('data-route-qr-knop', p.id || '');
          blok.appendChild(wissel);
        }
        // Kortste volgorde (rondrit vanaf het vertrekpunt) via de eigen server.
        var vertrekPc = normPostcode((String(vertrekAdres).match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/) || [''])[0]);
        var metPc = p.stops.filter(function (st) { return st.address && /\b[1-9]\d{3}\s?[A-Za-z]{2}\b/.test(st.address); });
        if (state && state.routesProxy && metPc.length >= 2) {
          if (!vertrekPc) blok.appendChild(txt('help', 'Vul een vertrekpunt met postcode in voor de kortste volgorde.', { margin: '6px 0 0' }));
          else {
            var kort = p.kort;
            if (kort && kort.fout) blok.appendChild(noteBox(kort.fout, 'warn'));
            if (kort && kort.order) {
              var volg = kort.order.map(function (i) { return metPc[i]; });
              var regel = volg.map(function (st) { return st.start; }).join(' \u2192 ');
              var nb = noteBox('Kortste rondrit: \u2248 ' + Math.round(kort.m / 1000) + ' km en ' + Math.round(kort.s / 60) + ' min (' + regel + '). Let op: je afspraken hebben vaste tijden; dit helpt bij het plannen.', 'ok');
              nb.setAttribute('data-kortste', regel);
              blok.appendChild(nb);
              mapsUrls(volg.map(function (st) { return st.address; }), vertrekAdres, true).forEach(function (u, n, all) {
                var b2 = secondaryBtn(all.length > 1 ? 'Kortste volgorde ' + (n + 1) + ' van ' + all.length + ' openen' : 'Kortste volgorde openen in Google Maps', function () { window.open(u, '_blank', 'noopener'); });
                b2.style.marginTop = '6px';
                blok.appendChild(b2);
              });
            } else {
              var kb = secondaryBtn(kort && kort.busy ? 'Kortste volgorde berekenen…' : 'Kortste volgorde berekenen', function () {
                if (p.kort && p.kort.busy) return;
                var pcs = metPc.map(function (st) { return normPostcode(st.address.match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/)[0]); });
                var reken = function () {
                  p.kort = { busy: true }; renderPagina();
                  optimizeRoute(state.routesProxy, vertrekPc, pcs).then(function (r) {
                    p.kort = (r && Array.isArray(r.order) && r.order.length === pcs.length) ? r : { fout: 'Geen kortste volgorde gevonden.' };
                  }, function () { p.kort = { fout: 'Google Routes reageert niet.' }; }).then(function () { if (pagina === 'route') renderPagina(); });
                };
                // Directe sleutel: eerst (binnen deze klik) toestemming voor Google Routes.
                if (state.routesProxy.key) vraagRoutes(function (ok) { if (ok) reken(); else { p.kort = { fout: 'Geen toestemming voor Google Routes.' }; renderPagina(); } });
                else reken();
              });
              kb.style.marginTop = '8px';
              blok.appendChild(kb);
            }
          }
        }
        (p.urls || []).forEach(function (u, n) {
          var label = p.urls.length > 1 ? 'Route ' + (n + 1) + ' van ' + p.urls.length + ' openen' : 'Route openen in Google Maps';
          var b = n === 0 ? primaryBtn(label, function () { window.open(u, '_blank', 'noopener'); }) : secondaryBtn(label, function () { window.open(u, '_blank', 'noopener'); });
          if (n > 0) b.style.marginTop = '6px';
          b.setAttribute('data-route-url', u);
          blok.appendChild(b);
        });
        box.appendChild(blok);
      });
    }
    return box;
  }

  function pageInfo() {
    var box = el('div');
    box.appendChild(txt('help', 'Gebruik de Agendahulp voor een duidelijk agenda-overzicht.', { margin: '0 0 12px' }));
    box.appendChild(sectionHead('Legenda (' + ((state && state.windowLabel) || '08:00 tot 17:00') + ')', true));
    var wrap = el('div', { display: 'flex', flexDirection: 'column', gap: '6px' });
    ((state && state.legend) || []).forEach(function (item) {
      var row = el('div', { display: 'flex', alignItems: 'center', gap: '8px' });
      row.appendChild(el('span', { width: '12px', height: '12px', borderRadius: '4px', background: item.color, border: '1px solid rgba(0,0,0,.12)', flex: '0 0 auto' }));
      row.appendChild(el('span', TYPE.text, item.text));
      wrap.appendChild(row);
    });
    box.appendChild(wrap);
    box.appendChild(sectionHead('Rondleiding'));
    var rl = el('div', { display: 'flex', flexDirection: 'column', gap: '8px' });
    var r1 = secondaryBtn('Rondleiding zijpaneel', function () { startHoofdRondleiding(); });
    r1.setAttribute('data-info-rondleiding', 'zijpaneel');
    rl.appendChild(r1);
    if (fAan('planner')) {
      var r2 = secondaryBtn('Rondleiding Planhulp', function () { naarPagina('plan'); startPlanRondleiding(); });
      r2.setAttribute('data-info-rondleiding', 'planhulp');
      rl.appendChild(r2);
    }
    box.appendChild(rl);
    box.appendChild(txt('help', 'Versie ' + ((state && state.version) || ''), { marginTop: '14px', paddingTop: '10px', borderTop: '1px solid ' + T.line }));
    return box;
  }

  // Tekent de huidige (niet-hoofd)pagina opnieuw. Gebeurt bij het openen en bij
  // een eigen actie, niet bij elke pagina-update: dat zou een half ingevuld
  // veld wissen. De React-inhoud loopt wel mee via renderLive().
  // Balk met gekozen momenten in de voet: alleen op de planhulp-pagina's.
  function renderBalk() {
    balkHost.innerHTML = '';
    if (pagina === 'plan' && BEWAARD.momenten.length) balkHost.appendChild(momentenBalk());
    if (pagina === 'maken' && BEWAARD.maak) balkHost.appendChild(maakBalk());
  }
  function renderPagina() {
    losKoppelen();
    paginaBox.innerHTML = '';
    renderBalk();
    if (pagina === 'hoofd') return;
    vulStandaarden();
    if (pagina === 'plan' && fAan('planner')) {
      var kopRij = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
      kopRij.appendChild(terugKnop());
      var rk = tekstKnop(ICON_HELP, 'Rondleiding', function () { startPlanRondleiding(); });
      rk.setAttribute('data-plan-rondleiding', '');
      rk.title = 'Rondleiding door de Planhulp';
      kopRij.appendChild(rk);
      paginaBox.appendChild(kopRij);
    } else paginaBox.appendChild(terugKnop());
    var inhoud = pagina === 'clienttijd' ? pageClientTime()
      : pagina === 'verhouding' ? pageRatio()
      : pagina === 'open' ? pageOpen()
      : pagina === 'snel' ? pageQuick()
      : pagina === 'plan' ? pagePlan()
      : pagina === 'route' ? pageRoute()
      : pagina === 'maken' ? pageMaken()
      : pageInfo();
    paginaBox.appendChild(inhoud);
    renderLive();
  }

  /* ── Rondleidingen ── */
  function welkomIcoon(d) { return function () { var i = svgPath(d, 24); i.style.color = T.brand; return i; }; }
  function navKaart(t) { return Array.prototype.filter.call(navBox.children, function (c) { return String(c.textContent || '').indexOf(t) === 0; })[0] || null; }
  function opHoofd() { if (pagina !== 'hoofd') naarPagina('hoofd'); }
  function startHoofdRondleiding() {
    opHoofd();
    startRondleiding({
      naam: 'zijpaneel', icoon: welkomIcoon(ICON_RANGE),
      stappen: [
        { titel: 'Welkom bij Agendahulp', tekst: 'In een paar stappen laten we zien wat het zijpaneel voor je doet. Het duurt nog geen minuut.', knop: 'Rondleiding starten', voor: opHoofd },
        { titel: 'Aan of uit', tekst: 'Hiermee zet je de hulp in ONS aan of uit. Staat hij uit, dan werkt ONS gewoon zoals altijd.', voor: opHoofd, vind: function () { return onoff; } },
        { titel: 'Je week in één oogopslag', tekst: 'Cliënttijd en niet-cliënttijd van de week die je in ONS bekijkt. Tik op Cliënttijd voor de verdeling per uursoort.', voor: opHoofd, vind: function () { return weekBox; } },
        { titel: 'Open registraties', tekst: 'Controleer een periode op afspraken die nog niet geregistreerd zijn en werk ze één voor één af.', voor: opHoofd, vind: function () { return navKaart('Open registraties'); } },
        { titel: 'Planhulp', tekst: 'Vind vrije tijd voor een afspraak, kies een of meer momenten en maak de afspraak meteen in ONS. De eerste keer krijg je daar een eigen rondleiding.', voor: opHoofd, vind: function () { return navKaart('Planhulp'); } },
        { titel: 'Route van de dag', tekst: 'Je huisbezoeken van een dag op volgorde in Google Maps. Met een QR-code zet je de route op je telefoon.', voor: opHoofd, vind: function () { return navKaart('Route van de dag'); } },
        { titel: 'Verlof aanvragen', tekst: 'Vraag verlof aan zonder door ONS te zoeken. Je kiest de dagen, de hulp vult de rest in.', voor: opHoofd, vind: function () { return leaveBar.style.display === 'none' ? null : leaveBtn; } },
        { titel: 'Later nog eens?', tekst: 'Via deze knop vind je de rondleidingen terug, en de legenda en de versie.', voor: opHoofd, vind: function () { return info; }, knop: 'Klaar' }
      ]
    });
  }
  // Planhulp: voorbeeldmoment, weergave en pagina na afloop terugzetten.
  var tourTijdelijk = null;
  var planTourWacht = false;
  function startPlanRondleiding() {
    if (!fAan('planner')) return;
    if (pagina !== 'plan') naarPagina('plan');
    // Eerst de vrije tijd: anders zijn er nog geen tijden om te laten zien.
    if (!plan.result || plan.busy) { planTourWacht = true; if (!plan.busy && !plan.error) startPlan(); return; }
    planTourWacht = false;
    var oud = { weergave: plan.weergave || 'lijst', momenten: BEWAARD.momenten.length, maak: BEWAARD.maak };
    tourTijdelijk = null;
    function naarPlan(w) {
      if (pagina !== 'plan') naarPagina('plan');
      if ((plan.weergave || 'lijst') !== w) { plan.weergave = w; renderPagina(); }
    }
    function lijstKlaar() { naarPlan('lijst'); }
    function eenMoment() {
      lijstKlaar();
      if (BEWAARD.momenten.length) return;
      var c = paginaBox.querySelector('[data-dag][data-start]');
      if (!c) return;
      var d = c.getAttribute('data-dag'), t = c.getAttribute('data-start').split(':');
      tourTijdelijk = { date: d, startMin: (+t[0]) * 60 + (+t[1]) };
      wisselMoment(tourTijdelijk.date, tourTijdelijk.startMin);
      renderPagina();
    }
    function naarMakenPagina() {
      if (pagina === 'maken') return;
      if (!BEWAARD.momenten.length) eenMoment();
      if (BEWAARD.momenten.length && kanDirect()) naarMaken(BEWAARD.momenten, plan.minutes);
    }
    var inst = function () { return paginaBox.querySelector('[data-plan-instellingen]'); };
    var alle = function (sel) { return function () { return paginaBox.querySelectorAll(sel); }; };
    startRondleiding({
      naam: 'planhulp', kop: 'Rondleiding Planhulp', stapLabel: 'Planhulp, stap', icoon: welkomIcoon(ICON_PLAN),
      stappen: [
        { titel: 'Welkom in de Planhulp', tekst: 'Zo vind je in een paar tikken vrije tijd en maak je de afspraak meteen in ONS. Deze rondleiding duurt een halve minuut.', knop: 'Rondleiding starten', voor: lijstKlaar },
        { titel: 'Lijst of weekplanning', tekst: 'In de lijst zie je per dag de begintijden. De weekplanning toont je week als mini agenda.', voor: lijstKlaar, vind: alle('[data-plan-weergave]') },
        { titel: 'Hoe lang duurt de afspraak?', tekst: 'Kies de duur. Je ziet dan alleen tijden waarop de afspraak helemaal past.', voor: lijstKlaar, vind: alle('[data-plan-duur]'), breedte: inst },
        { titel: 'Hoe ver vooruit', tekst: 'Zoek 1, 2 of 4 weken vooruit, of tot een datum die je zelf kiest.', voor: lijstKlaar, vind: alle('[data-plan-weken],[data-plan-tot]'), breedte: inst },
        { titel: 'Alleen bepaalde dagen', tekst: 'Werk je bijvoorbeeld niet op woensdag? Vink de dag uit en hij verdwijnt meteen uit de lijst.', voor: lijstKlaar, vind: alle('[data-plan-dag]'), breedte: inst },
        { titel: 'Tik op een begintijd', tekst: 'Een tik kiest de tijd, nog een tik laat hem los. Je kunt meerdere momenten kiezen, ook op verschillende dagen. ONS kijkt meteen na of er overlap is.', voor: lijstKlaar,
          vind: function () {
            var c = paginaBox.querySelector('[data-dag][data-start]');
            if (!c) return null;
            var els = Array.prototype.slice.call(paginaBox.querySelectorAll('[data-dag="' + c.getAttribute('data-dag') + '"]'));
            if (c.parentNode && c.parentNode.previousSibling) els.push(c.parentNode.previousSibling);
            return els;
          } },
        { titel: 'Je gekozen momenten', tekst: 'Hier staan je keuzes. Tik op de teller om ze te bekijken of te wissen, en ga dan door naar Afspraak maken.', voor: eenMoment, vind: function () { return balkHost.firstChild; } },
        { titel: 'De weekplanning', tekst: 'Groen is vrij. Tik in het groen op de begintijd. Met de pijlen blader je, met Vandaag ben je zo terug. Feestdagen hebben een eigen kleur.', voor: function () { naarPlan('raster'); },
          vind: alle('[data-raster],[data-week-titel],[data-week-vandaag]') },
        { titel: 'Zelfde of per afspraak anders', tekst: 'Bij meerdere momenten kies je of elke afspraak dezelfde cliënt(en) krijgt, of per afspraak andere.', als: kanDirect, voor: naarMakenPagina, vind: alle('[data-maak-modus]') },
        { titel: 'Cliënt zoeken', tekst: 'Typ een naam zoals in ONS. Je ziet cliëntnummer, geboortedatum en postcode. Vink aan om ook cliënten uit zorg te vinden.', als: kanDirect, voor: naarMakenPagina,
          vind: function () { var z = paginaBox.querySelector('[data-maak-zoek]'), v = paginaBox.querySelector('[data-client-uit-zorg]'); return [z, v && v.parentNode].filter(Boolean); } },
        { titel: 'Afspraak maken', tekst: 'Maak de afspraken meteen in ONS, of open liever het ONS Afspraakformulier met alles al ingevuld.', als: kanDirect, voor: naarMakenPagina,
          vind: function () { return balkHost.querySelectorAll('[data-maak-knop],[data-maak-ons]'); }, knop: 'Klaar' }
      ],
      onEinde: function () {
        // Alles terug zoals het was.
        if (tourTijdelijk && momentIndex(tourTijdelijk.date, tourTijdelijk.startMin) >= 0 && BEWAARD.momenten.length > oud.momenten) wisselMoment(tourTijdelijk.date, tourTijdelijk.startMin);
        tourTijdelijk = null;
        if (pagina === 'maken' && BEWAARD.maak !== oud.maak) { BEWAARD.maak = oud.maak; naarPagina('plan'); }
        plan.weergave = oud.weergave;
        if (pagina === 'plan') renderPagina();
      }
    });
  }
  // Vanzelf, één keer: het zijpaneel als er een agenda is, de Planhulp als de
  // eerste vrije tijd binnen is.
  var tourGepland = false;
  function misschienRondleiding() {
    if (tourGepland || rondleidingActief() || !state) return;
    if (pagina === 'hoofd' && navBox.children.length && !rondleidingGedaan('zijpaneel')) {
      tourGepland = true;
      setTimeout(function () { tourGepland = false; if (pagina === 'hoofd' && !rondleidingActief() && !rondleidingGedaan('zijpaneel') && root.isConnected) startHoofdRondleiding(); }, 600);
    } else if (pagina === 'plan' && plan.result && !plan.busy && (planTourWacht || !rondleidingGedaan('planhulp'))) {
      tourGepland = true;
      setTimeout(function () { tourGepland = false; if (pagina === 'plan' && !rondleidingActief() && (planTourWacht || !rondleidingGedaan('planhulp')) && root.isConnected) startPlanRondleiding(); }, 400);
    }
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
  setTimeout(misschienRondleiding, 0);
  // Na opnieuw opbouwen (paginawissel in ONS) terug naar de pagina waar je was;
  // stond je op de afwerklijst, dan meteen bijwerken.
  if (vorigePagina === 'vrijblok') vorigePagina = 'plan';
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
      // Agenda's erbij of eraf (meerdere naast elkaar): planhulp bijwerken.
      var agendas = (state && state.inviteeIds) || '';
      var vorigeAgendas = BEWAARD.agendaSleutel;
      var gedeeld = function (a, b) { var x = String(a || '').split(','); return String(b || '').split(',').some(function (id) { return id && x.indexOf(id) >= 0; }); };
      if (agendas && vorigeAgendas && agendas !== vorigeAgendas && gedeeld(agendas, vorigeAgendas)) {
        BEWAARD.agendaSleutel = agendas;
        if (inv) BEWAARD.inviteeId = inv;
        agendasGewijzigd(vorigeAgendas, agendas);
        render();
        return;
      }
      if (agendas) BEWAARD.agendaSleutel = agendas;
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
      // Knoppen opnieuw als de beheerschakelaar voor de route verandert.
      var routeAan = JSON.stringify((state && state.features) || {}) + (state && state.routeEnabled === false);
      if (routeAan !== navRouteAan) renderNav();
      render();
      // Alleen bijwerken als er echt iets in de agenda veranderde.
      vergelijkSig = state ? JSON.stringify([state.past, state.unfinished, state.week && state.week.summary]) : '';
      if (vorigeSig && vergelijkSig !== vorigeSig) planHercontrole();
      misschienRondleiding();
    },
    // Uitslag van de kopieën (content-script, na het opslaan in ONS).
    setDuplicates: function (info) {
      BEWAARD.kopie = { made: (info && info.made) || [], failed: (info && info.failed) || [], reason: (info && info.reason) || '', next: (info && info.next) || null, left: (info && info.left) || 0 };
      if (!BEWAARD.kopie.reason && !BEWAARD.kopie.failed.length) BEWAARD.momenten = [];
      if (pagina === 'plan') renderPagina();
    },
    setRangeProgress: function (kind, done, total) {
      var doel = kind === 'productie' ? prod : range;
      if (!doel.busy) return;
      doel.done = done; doel.total = total;
      if ((kind === 'productie' && pagina === 'clienttijd') || (kind !== 'productie' && pagina === 'open')) renderPagina();
    },
    destroy: function () {
      sluitRondleiding();
      window.removeEventListener('focus', bijFocus);
      document.removeEventListener('visibilitychange', bijZichtbaar);
      if (planTimer) clearTimeout(planTimer);
      try { var b = bridge(); if (b) { b.unmount(weekHost); if (liveHost) b.unmount(liveHost); } } catch (e) {}
      if (root.parentNode) root.parentNode.removeChild(root);
    }
  };
}
