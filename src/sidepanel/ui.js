// Bouwstenen van het zijpaneel: kleuren (T, SERIE), typografie (TYPE),
// elementen (el, txt, kaart), knoppen, iconen en datumhulpjes. Alles met
// inline stijl: de pagina's bouwen hun DOM hiermee op.

import { dagKort, dagLang as dagLangNl, isoWeek as isoWeekNl, maandagVan as maandagNl, uitYmd, werkweekTekst as werkweekNl, ymd as ymdNl } from '../shared/datum.js';

export var T = {
  ink: '#201d1f', inkSoft: '#6b6367', line: '#ece7e5', lineSoft: '#f6f2f0',
  brand: '#cc087d', brandDeep: '#8c0a58', brandWash: '#fdf1f8',
  ok: '#1b7f3b', okWash: '#eaf6ee', bad: '#a3241f', badWash: '#fbeceb',
  warn: '#8a5a00', warnWash: '#fff4d6'
};
export var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
// Direct, indirect en reistijd (palet 'Rustig'): blauwgrijs, oud roze en
// oker. Overal dezelfde: weekoverzicht, opbouw, verhouding per uursoort en de
// grafiek productieverloop. Het roze is gedempt, zodat het niet op een knop lijkt.
export var SERIE = { direct: '#2f5d7c', indirect: '#b4507a', travel: '#d6a24c' };

export var SVG_NS = 'http://www.w3.org/2000/svg';

export function fmtMin(min) {
  min = Math.max(0, Math.round(min || 0));
  var h = Math.floor(min / 60), m = min % 60;
  return h ? (h + ' u' + (m ? ' ' + m + ' m' : '')) : (m + ' m');
}
// Datums in het Nederlands: date-fns, zie src/shared/datum.js.
// 'Donderdag 8 oktober' (lang) of 'Do 8 oktober' (kort).
export function dagLang(date, kort) { return dagLangNl(date, kort); }
// 'van 9:00 tot 12:00' zonder voorloopnul.
export function vanTot(a, b) { var f = function (m) { return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }; return 'van ' + f(a) + ' tot ' + f(b); }
// 'do 8 okt'
export function dayLabel(date) { return dagKort(date); }
export function el(tag, styles, text) {
  var n = document.createElement(tag);
  if (styles) Object.assign(n.style, styles);
  if (text != null) n.textContent = text;
  return n;
}
// Focusrand alleen bij toetsenbordfocus (:focus-visible), niet na een klik
// met de muis. binnen: de rand binnen de knop (voor rijen in een kaart die
// de rand anders afsnijdt tot een losse lijn).
export function focusRing(node, color, binnen) {
  node.addEventListener('focus', function () {
    var zichtbaar = true;
    try { zichtbaar = node.matches(':focus-visible'); } catch (e) {}
    if (!zichtbaar) return;
    node.style.outline = '2px solid ' + (color || T.brand); node.style.outlineOffset = binnen ? '-2px' : '2px';
  });
  node.addEventListener('blur', function () { node.style.outline = 'none'; });
}
function liftOnHover(card) {
  card.addEventListener('mouseenter', function () { card.style.transform = 'translateY(-1px)'; card.style.boxShadow = '0 4px 12px -6px rgba(32,20,15,.22)'; });
  card.addEventListener('mouseleave', function () { card.style.transform = 'none'; card.style.boxShadow = 'none'; });
}

/* ── Typografie ────────────────────────────────────────────────────────── */

export var TYPE = {
  pageTitle: { fontSize: '15px', fontWeight: '700', color: T.ink },
  section:   { fontSize: '13px', fontWeight: '700', color: T.ink, margin: '0 0 8px' },
  text:      { fontSize: '13px', fontWeight: '400', color: T.ink, lineHeight: '1.45' },
  help:      { fontSize: '12px', fontWeight: '400', color: T.inkSoft, lineHeight: '1.45' },
  label:     { fontSize: '12px', fontWeight: '600', color: T.inkSoft },
  small:     { fontSize: '11px', fontWeight: '600' }
};
export function txt(kind, text, extra) {
  var n = el('div', Object.assign({}, TYPE[kind], extra || {}), text);
  return n;
}
// Sectie met een kop en een dunne lijn erboven (behalve de eerste op een pagina).
// Kopje boven een kaart: vet, met optioneel een grijze toelichting en rechts
// een label (zoals 'geregistreerd'). Geen lijnen; de kaarten zelf scheiden.
export function sectionHead(text, first, sub, label) {
  var h = el('div', { display: 'flex', alignItems: 'baseline', gap: '8px', margin: first ? '0 2px 8px' : '20px 2px 8px', minWidth: '0' });
  h.appendChild(el('span', { fontSize: '14px', fontWeight: '700', color: T.ink, whiteSpace: 'nowrap' }, text));
  if (sub) h.appendChild(el('span', { fontSize: '12px', color: T.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, sub));
  if (label) {
    h.appendChild(el('span', { flex: '1 1 auto' }));
    h.appendChild(el('span', { fontSize: '11px', fontWeight: '600', color: T.inkSoft, background: T.lineSoft, borderRadius: '6px', padding: '1px 7px', whiteSpace: 'nowrap' }, label));
  }
  return h;
}
// Rustige melding midden op de pagina (fout of leeg): icoon in een zacht vlak,
// wat er aan de hand is in gewone taal, en zo mogelijk één knop die helpt.
// o: { icoon, kleur: [voorgrond, vlak], titel, tekst, knop, knopIcoon, onKnop }
export function foutStaat(o) {
  var w = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '28px 18px 20px' });
  w.setAttribute('data-staat', '');
  var kl = o.kleur || [T.brand, T.brandWash];
  var ic = el('div', { width: '64px', height: '64px', borderRadius: '20px', background: kl[1], color: kl[0], display: 'flex', alignItems: 'center', justifyContent: 'center' });
  ic.appendChild(svgPath(o.icoon, 30));
  w.appendChild(ic);
  w.appendChild(el('div', { fontSize: '15px', fontWeight: '700', color: T.ink, marginTop: '12px' }, o.titel));
  if (o.tekst) w.appendChild(el('div', { fontSize: '12.5px', color: T.inkSoft, marginTop: '4px', maxWidth: '280px', lineHeight: '1.45' }, o.tekst));
  if (o.knop && o.onKnop) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-staat-knop', '');
    Object.assign(b.style, { display: 'inline-flex', alignItems: 'center', gap: '7px', height: '38px', padding: '0 18px', marginTop: '14px', border: '0', borderRadius: '10px',
      background: T.brand, color: '#fff', font: '700 13px ' + FONT, cursor: 'pointer' });
    if (o.knopIcoon) b.appendChild(svgPath(o.knopIcoon, 16));
    b.appendChild(document.createTextNode(o.knop));
    focusRing(b);
    b.addEventListener('click', function (e) { e.preventDefault(); o.onKnop(); });
    w.appendChild(b);
  }
  return w;
}
// Witte kaart met dunne rand, zoals op het startscherm.
export function kaart(extra) {
  return el('div', Object.assign({ border: '1px solid ' + T.line, borderRadius: '12px', background: '#fff', padding: '12px 14px', boxSizing: 'border-box' }, extra || {}));
}

/* ── Iconen ────────────────────────────────────────────────────────────── */
export function svgSpineCheck() {
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '11'); svg.setAttribute('height', '11'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  var p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', 'M3 7.2l2.6 2.6L11 4');
  svg.appendChild(p); return svg;
}
export function svgSpinePause() {
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
export function svgInfoIcon() {
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
export function svgPath(d, size) {
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size || 18); svg.setAttribute('height', size || 18);
  svg.setAttribute('aria-hidden', 'true');
  var p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('fill', 'currentColor'); p.setAttribute('d', d);
  svg.appendChild(p); return svg;
}
export var CHEV_RECHTS = 'M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z';
export var CHEV_LINKS = 'M15 5.4 8.4 12l6.6 6.6 1.4-1.4-5.2-5.2 5.2-5.2z';
export var ICON_VERVERS = 'M17.7 6.3A8 8 0 1 0 19.7 14h-2.1a6 6 0 1 1-1.4-6.2L13 11h7V4z';
// Kalender met vinkje · klok · verdeelde balk (verhouding).
export var ICON_RANGE = 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v10H5zm5.6 8.2-3.1-3.1 1.4-1.4 1.7 1.7 4.5-4.5 1.4 1.4z';
export var ICON_QUICK = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l5 3 1-1.7-4-2.4z';
 // Kalender met zoekglas.
export var ICON_PLAN = 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6v-2H5V9h14v2h2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm9.5 11a3.5 3.5 0 1 0 1.9 6.4l2.2 2.2 1.4-1.4-2.2-2.2A3.5 3.5 0 0 0 16.5 13zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z';
// Route: kaartspeld.
export var ICON_ROUTE = 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z';
// Vraagteken in een rondje (rondleiding).
export var ICON_HELP = 'M11 18h2v-2h-2zm1-16a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 4 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 0 0-4-4z';
export var ICON_RATIO = 'M3 5h18v4H3zm0 5h11v4H3zm12 0h6v4h-6zM3 15h7v4H3zm8 0h10v4H11z';

/* ── Bouwstenen ────────────────────────────────────────────────────────── */

export function tag(text, tone) {
  var c = tone === 'bad' ? [T.bad, T.badWash] : tone === 'warn' ? [T.warn, T.warnWash] : tone === 'ok' ? [T.ok, T.okWash] : [T.inkSoft, T.lineSoft];
  return el('span', Object.assign({}, TYPE.small, {
    display: 'inline-block', color: c[0], background: c[1], borderRadius: '8px',
    padding: '1px 7px', marginLeft: '6px', verticalAlign: '1px', whiteSpace: 'nowrap'
  }), text);
}
export function noteBox(text, tone) {
  var c = tone === 'bad' ? [T.badWash, T.bad] : tone === 'ok' ? [T.okWash, T.ok] : [T.warnWash, T.warn];
  return el('div', {
    marginTop: '10px', padding: '9px 11px', borderRadius: '10px', background: c[0], color: c[1],
    fontSize: '13px', fontWeight: '600', lineHeight: '1.4'
  }, text);
}
export function baseButton(text, onClick, primary, disabled) {
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
export function primaryBtn(text, onClick, disabled) { var b = baseButton(text, onClick, true, disabled); b.style.marginTop = '10px'; return b; }
export function secondaryBtn(text, onClick) { return baseButton(text, onClick, false, false); }

export function fieldLabel(text, input) {
  var w = el('label', Object.assign({}, TYPE.label, { display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 0', minWidth: '0' }));
  w.appendChild(document.createTextNode(text));
  w.appendChild(input);
  return w;
}
export function inputEl(type, value, onChange) {
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
export function clickCard(onClick, title) {
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
// Hulpmiddelen op het startscherm: elk een eigen zachte kleur voor het icoon.
export var HULP_KLEUR = {
  open: ['#c2185b', '#fde8f0'], plan: ['#1f7a8c', '#e3f3f5'], snel: ['#6a4fb3', '#efeafb'],
  route: ['#c06a12', '#fdf0e1'], verhouding: ['#2f5d7c', '#e6eef4'], info: ['#6b6367', '#f1edec']
};
var CHEV_GRIJS = '#b9b0b4';
// Eén regel in de lijst hulpmiddelen: gekleurd icoon, titel, eventueel een
// teller, grijs pijltje. Tussen de regels een lijn vanaf de titel.
export function hulpRij(soort, icoon, titel, onClick, teller, eerste) {
  var b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('data-hulp', soort);
  Object.assign(b.style, {
    display: 'flex', alignItems: 'center', gap: '12px', width: '100%', boxSizing: 'border-box', height: '56px',
    padding: '0 10px 0 12px', border: '0', background: '#fff', color: T.ink, cursor: 'pointer', textAlign: 'left',
    font: 'inherit', position: 'relative', transition: 'background .12s ease'
  });
  if (!eerste) b.appendChild(el('span', { position: 'absolute', left: '60px', right: '0', top: '0', height: '1px', background: T.line }));
  var kl = HULP_KLEUR[soort] || [T.brand, T.brandWash];
  var ic = el('span', {
    width: '36px', height: '36px', borderRadius: '10px', background: kl[1], color: kl[0],
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto'
  });
  ic.appendChild(svgPath(icoon, 20));
  b.appendChild(ic);
  b.appendChild(el('span', { flex: '1 1 auto', minWidth: '0', fontSize: '13.5px', fontWeight: '600', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, titel));
  if (teller) {
    var t = el('span', { background: T.brand, color: '#fff', fontWeight: '700', fontSize: '11.5px', borderRadius: '10px', minWidth: '22px', height: '20px', padding: '0 7px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', flex: '0 0 auto' }, String(teller));
    t.setAttribute('data-hulp-teller', String(teller));
    t.setAttribute('aria-label', teller + ' open');
    b.appendChild(t);
  }
  var pijl = svgPath(CHEV_RECHTS, 20);
  pijl.style.color = CHEV_GRIJS; pijl.style.flex = '0 0 auto';
  b.appendChild(pijl);
  b.addEventListener('mouseenter', function () { b.style.background = T.lineSoft; });
  b.addEventListener('mouseleave', function () { b.style.background = '#fff'; });
  focusRing(b, null, true);
  b.addEventListener('click', onClick);
  return b;
}

// Keyframes kunnen niet als inline-stijl; één klein stijlblok per document.
export function zorgVoorStijl(doc) {
  var d = doc || document;
  if (d.getElementById('ons-agendapanel-stijl')) return;
  var st = d.createElement('style');
  st.id = 'ons-agendapanel-stijl';
  st.textContent =
    '@keyframes onsAhSchuif{0%{transform:translateX(-60%)}100%{transform:translateX(260%)}}' +
    '@keyframes onsAhPuls{0%,100%{opacity:.55}50%{opacity:.9}}' +
    '@keyframes onsAhDraai{to{transform:rotate(360deg)}}';
  (d.head || d.documentElement).appendChild(st);
}
// Slanke onbepaalde voortgangsbalk: we weten niet hoe lang het duurt.
export function laadBalk() {
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
export function voortgang(done, total) {
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


/* ── Datum- en tijdkiezer in de stijl van de hulp ──────────────────────────
   Het keuzevenster van de browser (input type=date/time) is niet op te maken.
   Deze kiezers klappen open ONDER de rij met velden, over de volle breedte van
   het paneel: twee velden naast elkaar zijn te smal voor een maandkalender.
   Eén kiezer tegelijk per groep. */
export function ymdVan(d) { return ymdNl(d); }
export function datumUitYmd(s) { return uitYmd(s); }
// 'do 8 okt', in een ander jaar 'do 8 okt 2025'. Met het jaar erbij past de
// datum niet in een smal paneel (twee velden naast elkaar).
export function datumTekst(s) { var d = uitYmd(s); return d ? dagKort(s, d.getFullYear() !== new Date().getFullYear()) : ''; }
export function chipKnop(tekst, gekozen, onClick, extra) {
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
export function veldKnop(tekst, leeg, icoon) {
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
  ic.style.color = '#8d8589'; ic.style.flex = '0 0 auto';
  b.appendChild(ic);
  b.addEventListener('mouseenter', function () { if (b.getAttribute('aria-expanded') !== 'true') b.style.borderColor = T.brand; });
  b.addEventListener('mouseleave', function () { if (b.getAttribute('aria-expanded') !== 'true') b.style.borderColor = T.line; });
  focusRing(b);
  b._tekst = t;
  return b;
}
export var ICON_KALENDER = 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v10H5z';
// ISO-weeknummer en maandag van de week van 'YYYY-MM-DD'.
export function isoWeek(s) { return isoWeekNl(s); }
// '5 tot en met 9 oktober' (werkweek van die dag).
export function werkweekTekst(s) { return werkweekNl(s); }
export function maandagVan(s) { return maandagNl(s) || s; }
// 'YYYY-MM-DD' + n weken -> 'YYYY-MM-DD' (lokale datum).
export function plusWeken(ymd, n) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  d.setDate(d.getDate() + 7 * n);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

export function hm(min) { return ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + (min % 60)).slice(-2); }

// Tekstknop met icoon (Terug, Lijst bijwerken): licht, roze, geen rand.
export function tekstKnop(icoon, tekst, onClick, disabled) {
  var b = document.createElement('button');
  b.type = 'button';
  b.disabled = !!disabled;
  Object.assign(b.style, {
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px 6px 6px',
    borderRadius: '8px', cursor: disabled ? 'default' : 'pointer', border: '0', background: 'transparent',
    color: disabled ? T.inkSoft : T.ink, font: '600 13px/1 ' + FONT
  });
  b.appendChild(svgPath(icoon, 16));
  b.appendChild(document.createTextNode(tekst));
  b.addEventListener('mouseenter', function () { if (!b.disabled) b.style.background = T.lineSoft; });
  b.addEventListener('mouseleave', function () { b.style.background = 'transparent'; });
  focusRing(b);
  b.addEventListener('click', function (e) { e.preventDefault(); if (!b.disabled) onClick(); });
  return b;
}
