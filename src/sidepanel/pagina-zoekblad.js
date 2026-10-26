// Planhulp zoeken: een blad over het hele zijpaneel met één stap per keer
// (Duur, Wanneer, Dagen en, als je wilt, Cliënten). De knop onderaan telt
// meteen hoeveel begintijden er met deze keuzes zijn en telt mee als je iets
// wijzigt; een tik toont de lijst in de planhulp. Bovenaan de eerste stap de
// recente filters. Gekoppelde cliënten staan met hun postcode op de kaart
// (pil 'Kaart') en zijn in Afspraak maken al ingevuld.
//
// Tellen: de vrije blokken van de periode één keer ophalen met de kortste
// duur (30 min); daarin passen alle langere afspraken. Duur en dagen tellen
// we daarna hier na, zonder ONS opnieuw te vragen. Een andere periode haalt
// opnieuw op (de weken zelf onthoudt de ONS-pagina al).
//
// PRIVACY: de recente filters (localStorage van het zijpaneel) bewaren alleen
// duur, periode en dagen, nooit cliënten. Gekoppelde cliënten staan alleen in
// het geheugen van het zijpaneel. Naar Google Maps gaan alleen postcodes, pas
// na een tik op de kaartpil.

import { BEWAARD } from './bewaard.js';
import { FONT, ICON_KALENDER, ICON_QUICK, T, dagLang, dayLabel, datumUitYmd, el, focusRing, svgPath, ymdVan, zorgVoorStijl } from './ui.js';
import { maandKalender } from './kiezers.js';
import { embedUrl, mapsUrls, normPostcode } from './geo.js';
import { PANEL_LOCAL } from '../shared/storage-keys.js';

const DUREN = [[30, '30 min', '30 minuten'], [45, '45 min', '45 minuten'], [60, '1 uur', '1 uur'], [90, '1,5 uur', '1,5 uur'], [120, '2 uur', '2 uur']];
const WEKEN = [[1, '1 week'], [2, '2 weken'], [4, '4 weken']];
const DAGEN = [[1, 'ma', 'maandag'], [2, 'di', 'dinsdag'], [3, 'wo', 'woensdag'], [4, 'do', 'donderdag'], [5, 'vr', 'vrijdag']];
const STAPPEN = [['duur', 'Duur', 'Hoe lang duurt de afspraak?'], ['wanneer', 'Wanneer', 'Hoe ver vooruit zoeken?'], ['dagen', 'Dagen', 'Op welke dagen?'], ['clienten', 'Cliënten', 'Voor wie is de afspraak?']];
const STANDAARD = { minutes: 60, weeks: 2, tot: '', dagen: null };
const TEL_DUUR = 30;       // de kortste duur: daarin passen alle langere
const TEL_LIMIET = 150;    // vrije blokken per telling; meer = '150+'
const TEL_TTL = 60000;     // zo lang is een telling goed (de agenda kan veranderen)
const RECENT_MAX = 3;
const CLIENTEN_MAX = 10;

const ICON_KRUIS = 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z';
const ICON_ZOEK = 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z';
const ICON_KAART = 'M20.5 3l-.2.1L15 5.1 9 3 3.4 4.9c-.2.1-.4.3-.4.5v15.1c0 .3.2.5.5.5l.2-.1L9 18.9l6 2.1 5.6-1.9c.2-.1.4-.3.4-.5V3.5c0-.3-.2-.5-.5-.5zM15 19l-6-2.1V5l6 2.1V19z';
const ICON_VINK = 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z';
const ICON_PLUS = 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z';
const ICON_VERDER = 'M12 4l-1.4 1.4 5.6 5.6H4v2h12.2l-5.6 5.6L12 20l8-8z';
const ICON_TERUG = 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z';

/* ── Teksten ── */
function duurTekst(m) { const d = DUREN.filter(function (x) { return x[0] === m; })[0]; return d ? d[1] : m + ' min'; }
function kortDatum(ymd) { return dayLabel(ymd).replace(/^\S+ /, ''); }   // '20 nov'
function periodeTekst(f) { return f.tot ? 'tot ' + kortDatum(f.tot) : (f.weeks === 1 ? '1 week' : f.weeks + ' weken'); }
function dagenTekst(dagen) {
  if (!dagen || dagen.length >= 5) return 'alle dagen';
  const n = dagen.slice().sort().map(function (d) { return DAGEN[d - 1][1]; });
  return n.length === 1 ? 'alleen ' + n[0] : n.slice(0, -1).join(', ') + ' en ' + n[n.length - 1];
}
function groot(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
// '1 uur, 2 weken, alle dagen'
function filterTekst(f) { return [duurTekst(f.minutes), periodeTekst(f), dagenTekst(f.dagen)].join(', '); }
function tijdenTekst(n, plus) { return n === 1 && !plus ? '1 tijd' : n + (plus ? '+' : '') + ' tijden'; }
function clientenTekst(n) { return n === 1 ? '1 cliënt' : n + ' cliënten'; }
function pcTekst(pc) { pc = normPostcode(pc); return pc ? pc.slice(0, 4) + ' ' + pc.slice(4) : ''; }
function initialen(naam) { return String(naam || '?').split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase(); }
function dagSleutel(d) { return d && d.length < 5 ? d.slice().sort().join('') : ''; }
function zelfdeFilter(a, b) { return a.minutes === b.minutes && (a.tot || '') === (b.tot || '') && (a.tot || a.weeks === b.weeks) && dagSleutel(a.dagen) === dagSleutel(b.dagen); }

/* ── Tellen ── */
// Begintijden (elk kwartier) waarop een afspraak van 'minutes' past, op de
// gekozen weekdagen; plus het aantal dagen met minstens één tijd.
export function telBegintijden(gaps, minutes, dagen) {
  let tijden = 0;
  const per = {};
  (gaps || []).forEach(function (g) {
    if (dagen && dagen.length < 5) { const d = datumUitYmd(g.date); if (!d || dagen.indexOf(d.getDay()) < 0) return; }
    const vrij = g.endMin - g.startMin;
    if (!(vrij >= minutes)) return;
    tijden += Math.floor((vrij - minutes) / 15) + 1;
    per[g.date] = true;
  });
  return { tijden: tijden, dagen: Object.keys(per).length };
}

/* ── Recente filters (zonder cliënten) ── */
function geldigFilter(r) {
  if (!r || typeof r !== 'object') return null;
  const m = parseInt(r.minutes, 10);
  if (!DUREN.some(function (d) { return d[0] === m; })) return null;
  const tot = /^\d{4}-\d{2}-\d{2}$/.test(String(r.tot || '')) ? String(r.tot) : '';
  if (tot && tot < ymdVan(new Date())) return null;   // een datum die al voorbij is
  const w = parseInt(r.weeks, 10);
  const d = Array.isArray(r.dagen) ? r.dagen.map(Number).filter(function (x, i, a) { return x >= 1 && x <= 5 && a.indexOf(x) === i; }).sort() : null;
  return { minutes: m, weeks: [1, 2, 4].indexOf(w) >= 0 ? w : 2, tot: tot, dagen: d && d.length && d.length < 5 ? d : null };
}
export function leesRecent() {
  try {
    const r = JSON.parse(window.localStorage.getItem(PANEL_LOCAL.PLAN_RECENT) || '[]');
    return Array.isArray(r) ? r.map(geldigFilter).filter(Boolean).slice(0, RECENT_MAX) : [];
  } catch (e) { return []; }
}
function bewaarRecent(f) {
  const nieuw = geldigFilter(f);
  if (!nieuw) return;
  const lijst = [nieuw].concat(leesRecent().filter(function (x) { return !zelfdeFilter(x, nieuw); })).slice(0, RECENT_MAX);
  try { window.localStorage.setItem(PANEL_LOCAL.PLAN_RECENT, JSON.stringify(lijst)); } catch (e) {}
}

export function maakZoekblad(ctx) {
  const { actions, renderPagina } = ctx;
  let laag = null;          // het blad, over het hele paneel
  let stapTimer = null, zoekTimer = null, zoekNr = 0;
  const zb = function () { return BEWAARD.zoekblad; };

  /* ── Telling ── */
  function telSleutel(f) { return f.tot ? 'tot|' + f.tot : 'w|' + f.weeks; }
  function zorgTelling(f) {
    if (!actions.onFreeSlots) return;
    const k = telSleutel(f), oud = BEWAARD.telling[k];
    if (oud && (oud.busy || Date.now() - oud.ts < TEL_TTL)) return;
    const t = BEWAARD.telling[k] = { busy: true, gaps: null, afgekapt: false, fout: '', ts: Date.now() };
    actions.onFreeSlots(TEL_DUUR, f.tot ? 2 : f.weeks, function (res) {
      if (BEWAARD.telling[k] !== t) return;
      t.busy = false; t.ts = Date.now();
      if (res && res.ok && res.result) { t.gaps = res.result.gaps || []; t.afgekapt = t.gaps.length >= TEL_LIMIET; }
      else t.fout = (res && res.error) || 'Tellen mislukt.';
      // Pas na de huidige opbouw opnieuw tekenen (een antwoord uit het geheugen komt meteen).
      setTimeout(function () {
        if (zb().open) teken();
        else if (ctx.pagina === 'plan') renderPagina();
      }, 0);
    }, f.tot || '', false, false, '', null, TEL_LIMIET);
  }
  // { status: 'bezig' | 'klaar' | 'fout', tijden, dagen, plus }
  function telStand(f) {
    const t = BEWAARD.telling[telSleutel(f)];
    if (!t || t.busy) return { status: 'bezig' };
    if (t.fout) return { status: 'fout', fout: t.fout };
    const u = telBegintijden(t.gaps, f.minutes, f.dagen);
    return { status: 'klaar', tijden: u.tijden, dagen: u.dagen, plus: t.afgekapt };
  }
  function vergeetTelling() { BEWAARD.telling = {}; }

  /* ── Openen, sluiten, toepassen ── */
  function planFilters() {
    const p = ctx.plan;
    return { minutes: p.minutes, weeks: p.weeks, tot: p.tot || '', dagen: p.dagen && p.dagen.length < 5 ? p.dagen.slice() : null, clients: (p.clients || []).slice() };
  }
  function openZoekblad(stap) {
    const z = zb();
    clearTimeout(stapTimer);
    z.open = true; z.scherm = 'blad'; z.stap = stap || 'duur'; z.kalender = false;
    z.concept = planFilters();
    z.zoek = { term: '', treffers: null };
    z.scroll = 0;
    zorgTelling(z.concept);
    teken();
    const s = laag && laag.querySelector('[data-zoek-sluit]');
    if (s) try { s.focus(); } catch (e) {}
  }
  // stil: zonder de pagina opnieuw te tekenen (bij een paginawissel).
  function sluitZoekblad(stil) {
    const z = zb();
    clearTimeout(stapTimer); clearTimeout(zoekTimer);
    z.open = false; z.concept = null; z.kalender = false;
    if (laag && laag.parentNode) laag.parentNode.removeChild(laag);
    laag = null;
    if (!stil && ctx.pagina === 'plan') { renderPagina(); setTimeout(ctx.misschienRondleiding, 0); }
  }
  function toon() {
    const c = zb().concept, p = ctx.plan;
    if (!c) return;
    // Andere duur of periode: een nieuwe lijst. Alleen andere dagen: de lijst
    // filtert meteen (pagina-plan.js) en blijft staan tot de nieuwe er is.
    const andersZoeken = p.minutes !== c.minutes || (p.tot || '') !== c.tot || (!c.tot && p.weeks !== c.weeks);
    const andereDagen = dagSleutel(p.dagen) !== dagSleutel(c.dagen);
    p.minutes = c.minutes; p.weeks = c.weeks; p.tot = c.tot; p.dagen = c.dagen ? c.dagen.slice() : null;
    p.clients = c.clients.slice();
    bewaarRecent(c);
    sluitZoekblad(true);
    if (andersZoeken || (!p.result && !p.busy)) { p.result = null; p.error = ''; p.limit = 0; p.open = {}; ctx.startPlan(); }
    else if (andereDagen) { p.limit = 0; ctx.startPlan(true); }
    if (ctx.pagina === 'plan') renderPagina();
    setTimeout(ctx.misschienRondleiding, 0);
  }
  // Na opnieuw opbouwen van het paneel (paginawissel in ONS): het blad terug.
  function herstelZoekblad() {
    if (zb().open && !(laag && laag.isConnected)) teken();
  }
  function zoekbladOpen() { return !!zb().open; }

  function naarStap(s, wacht) {
    clearTimeout(stapTimer);
    if (!wacht) { zb().stap = s; zb().scroll = 0; teken(); return; }
    stapTimer = setTimeout(function () { if (zb().open && zb().scherm === 'blad') { zb().stap = s; zb().scroll = 0; teken(); } }, wacht);
  }
  function wijzig(fn, volgende) {
    const c = zb().concept;
    fn(c);
    zorgTelling(c);
    teken();
    if (volgende) naarStap(volgende, 300);
  }

  /* ── Kaart ── */
  function openKaart(vanaf) {
    const z = zb();
    clearTimeout(stapTimer);
    if (vanaf === 'plan') { z.open = true; z.concept = null; }
    z.scherm = 'kaart'; z.kaartVan = vanaf;
    teken();
    const t = laag && laag.querySelector('[data-kaart-terug]');
    if (t) try { t.focus(); } catch (e) {}
  }
  function kaartTerug() {
    const z = zb();
    if (z.kaartVan === 'plan') { sluitZoekblad(); return; }
    z.scherm = 'blad';
    teken();
  }
  function kaartClients() { const z = zb(); return z.kaartVan === 'plan' || !z.concept ? (ctx.plan.clients || []) : z.concept.clients; }

  /* ── Bouwstenen ── */
  function icoonKnop(icoon, tekst, onClick, attr) {
    const b = el('button', { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '40px', padding: '0 14px 0 10px', flex: '0 0 auto',
      border: '1px solid ' + T.line, borderRadius: '999px', background: '#fff', color: T.ink, font: '600 13px ' + FONT, cursor: 'pointer', whiteSpace: 'nowrap' });
    b.type = 'button';
    b.setAttribute(attr, '');
    b.appendChild(svgPath(icoon, 16));
    b.appendChild(document.createTextNode(tekst));
    focusRing(b);
    b.addEventListener('click', onClick);
    return b;
  }
  function keuze(tekst, aan, onClick, extra) {
    const b = el('button', Object.assign({ height: '46px', minWidth: '0', padding: '0 6px', boxSizing: 'border-box', borderRadius: '12px', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap',
      border: '1px solid ' + (aan ? T.brand : T.line), background: aan ? T.brand : '#fff', color: aan ? '#fff' : T.ink, font: '600 14px ' + FONT }, extra || {}), tekst);
    b.type = 'button';
    b.setAttribute('aria-pressed', aan ? 'true' : 'false');
    if (!aan) {
      b.addEventListener('mouseenter', function () { b.style.background = T.brandWash; });
      b.addEventListener('mouseleave', function () { b.style.background = '#fff'; });
    }
    focusRing(b);
    b.addEventListener('click', onClick);
    return b;
  }
  function rooster(kolommen) { return el('div', { display: 'grid', gridTemplateColumns: 'repeat(' + kolommen + ', minmax(0, 1fr))', gap: '8px' }); }
  function uitleg(tekst, extra) { return el('div', Object.assign({ fontSize: '12px', color: T.inkSoft, marginTop: '10px', lineHeight: '1.4' }, extra || {}), tekst); }
  function spinner(kleur) {
    zorgVoorStijl();
    return el('span', { width: '14px', height: '14px', flex: '0 0 auto', borderRadius: '50%', boxSizing: 'border-box',
      border: '2px solid ' + (kleur ? 'rgba(255,255,255,.45)' : '#f0b6d6'), borderTopColor: kleur || T.brand, animation: 'onsAhDraai .8s linear infinite' });
  }
  // De zwarte pil 'Kaart' met het aantal gekoppelde cliënten.
  function kaartPil(vanaf) {
    const n = vanaf === 'plan' ? (ctx.plan.clients || []).length : zb().concept.clients.length;
    const b = el('button', { display: 'inline-flex', alignItems: 'center', gap: '8px', height: '44px', padding: '0 12px 0 14px', border: '0', borderRadius: '999px',
      background: T.ink, color: '#fff', font: '600 13.5px ' + FONT, cursor: 'pointer', boxShadow: '0 6px 18px rgba(32,29,31,.28)', pointerEvents: 'auto' });
    b.type = 'button';
    b.setAttribute('data-kaart-pil', vanaf);
    b.setAttribute('aria-label', 'Kaart met ' + (n === 1 ? '1 gekoppelde cliënt' : n + ' gekoppelde cliënten'));
    b.appendChild(svgPath(ICON_KAART, 16));
    b.appendChild(document.createTextNode('Kaart'));
    b.appendChild(el('span', { minWidth: '20px', height: '20px', padding: '0 6px', boxSizing: 'border-box', borderRadius: '999px', background: T.brand, color: '#fff',
      fontSize: '11.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }, String(n)));
    focusRing(b, '#fff');
    b.addEventListener('click', function () { openKaart(vanaf); });
    return b;
  }

  /* ── Het blad tekenen ── */
  function teken() {
    const z = zb();
    if (!z.open) return;
    if (!laag || !laag.isConnected) {
      laag = el('div', { position: 'fixed', inset: '0', zIndex: '2147482000', background: '#fff', color: T.ink, font: '400 13px/1.45 ' + FONT,
        display: 'flex', flexDirection: 'column' });
      laag.setAttribute('role', 'dialog');
      laag.setAttribute('aria-modal', 'true');
      laag.setAttribute('data-zoekblad', '');
      laag.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        if (zb().scherm === 'kaart') kaartTerug(); else sluitZoekblad();
      });
      (ctx.root || document.body).appendChild(laag);
    }
    // Wat bewaard moet blijven: scrollstand en het zoekveld met de cursor.
    const oudBody = laag.querySelector('[data-zoek-body]');
    if (oudBody) z.scroll = oudBody.scrollTop;
    const actief = document.activeElement && laag.contains(document.activeElement) && document.activeElement.hasAttribute('data-zoek-client') ? document.activeElement : null;
    const sel = actief ? [actief.selectionStart, actief.selectionEnd] : null;
    laag.innerHTML = '';
    laag.setAttribute('data-scherm', z.scherm);
    laag.setAttribute('aria-label', z.scherm === 'kaart' ? 'Kaart' : 'Vrije tijd zoeken');
    if (z.scherm === 'kaart') tekenKaart(); else tekenBlad();
    const body = laag.querySelector('[data-zoek-body]');
    if (body && z.scroll) body.scrollTop = z.scroll;
    if (sel) {
      const inp = laag.querySelector('[data-zoek-client]');
      if (inp) try { inp.focus(); inp.setSelectionRange(sel[0], sel[1]); } catch (e) {}
    }
  }

  function tekenBlad() {
    const z = zb(), c = z.concept;
    const idx = STAPPEN.map(function (s) { return s[0]; }).indexOf(z.stap);
    // Kop: Sluiten, titel en welke stap.
    const kop = el('div', { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px 8px', flex: '0 0 auto' });
    kop.appendChild(icoonKnop(ICON_KRUIS, 'Sluiten', function () { sluitZoekblad(); }, 'data-zoek-sluit'));
    kop.appendChild(el('div', { flex: '1 1 auto', minWidth: '0', textAlign: 'center', fontSize: '15px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, 'Vrije tijd zoeken'));
    const nr = el('div', { flex: '0 0 auto', fontSize: '12px', fontWeight: '600', color: T.inkSoft, whiteSpace: 'nowrap' }, 'Stap ' + (idx + 1) + ' van ' + STAPPEN.length);
    nr.setAttribute('data-zoek-stapnr', String(idx + 1));
    kop.appendChild(nr);
    laag.appendChild(kop);
    const balken = el('div', { display: 'flex', gap: '4px', padding: '0 14px 10px', flex: '0 0 auto' });
    balken.setAttribute('aria-hidden', 'true');
    STAPPEN.forEach(function (s, i) { balken.appendChild(el('span', { flex: '1 1 0', height: '4px', borderRadius: '2px', background: i <= idx ? T.ink : T.line })); });
    laag.appendChild(balken);

    // Midden: de stappen (scrollt), met de kaartpil eroverheen.
    const midden = el('div', { position: 'relative', flex: '1 1 auto', minHeight: '0' });
    const body = el('div', { position: 'absolute', inset: '0', overflowY: 'auto', padding: '4px 14px ' + (c.clients.length ? '76px' : '16px'), display: 'flex', flexDirection: 'column', gap: '8px' });
    body.setAttribute('data-zoek-body', '');
    if (z.stap === 'duur') {
      const recent = leesRecent();
      if (recent.length) body.appendChild(recentBlok(recent, c));
    }
    STAPPEN.forEach(function (s) {
      body.appendChild(s[0] === z.stap ? stapOpen(s) : stapDicht(s));
    });
    midden.appendChild(body);
    if (c.clients.length) {
      const pilRij = el('div', { position: 'absolute', left: '0', right: '0', bottom: '14px', display: 'flex', justifyContent: 'center', pointerEvents: 'none' });
      pilRij.appendChild(kaartPil('blad'));
      midden.appendChild(pilRij);
    }
    laag.appendChild(midden);

    // Voet: Alles wissen en de knop met de telling.
    const voet = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderTop: '1px solid ' + T.line, background: '#fff', flex: '0 0 auto' });
    const wis = el('button', { height: '44px', padding: '0 2px', border: '0', background: 'transparent', color: T.ink, font: '600 13.5px ' + FONT, textDecoration: 'underline', textUnderlineOffset: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }, 'Alles wissen');
    wis.type = 'button';
    wis.setAttribute('data-zoek-wissen', '');
    focusRing(wis);
    wis.addEventListener('click', function () {
      z.concept = Object.assign({}, STANDAARD, { clients: [] });
      z.kalender = false;
      z.zoek = { term: '', treffers: null };
      zorgTelling(z.concept);
      naarStap('duur');
    });
    voet.appendChild(wis);
    voet.appendChild(toonKnop(c));
    laag.appendChild(voet);
  }

  function toonKnop(c) {
    const t = telStand(c);
    const leeg = t.status === 'klaar' && !t.tijden;
    const b = el('button', { flex: '0 1 auto', minWidth: '0', height: '48px', padding: '0 18px', border: '0', borderRadius: '12px', cursor: leeg ? 'default' : 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap',
      background: leeg ? T.line : T.brand, color: leeg ? T.inkSoft : '#fff', font: '700 14.5px ' + FONT });
    b.type = 'button';
    b.setAttribute('data-zoek-toon', '');
    b.setAttribute('aria-live', 'polite');
    if (t.status === 'bezig') { b.appendChild(spinner('#fff')); b.appendChild(document.createTextNode('Tellen')); b.setAttribute('data-telling', ''); }
    else {
      b.appendChild(svgPath(ICON_ZOEK, 16));
      const tekst = t.status === 'fout' ? 'Toon tijden' : leeg ? 'Geen tijden gevonden' : 'Toon ' + tijdenTekst(t.tijden, t.plus);
      b.appendChild(document.createTextNode(tekst));
      b.setAttribute('data-telling', t.status === 'klaar' ? String(t.tijden) + (t.plus ? '+' : '') : '');
      if (t.status === 'fout') b.title = t.fout;
    }
    b.disabled = leeg;
    focusRing(b);
    b.addEventListener('click', function () { if (!leeg) toon(); });
    return b;
  }

  function recentBlok(recent, c) {
    const box = el('div', { margin: '0 -14px 4px' });
    box.appendChild(el('div', { padding: '0 14px 8px', fontSize: '12px', fontWeight: '600', color: T.inkSoft }, 'Recente filters'));
    const rij = el('div', { display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 14px 2px' });
    rij.setAttribute('data-zoek-recent', '');
    recent.forEach(function (f, i) {
      const aan = zelfdeFilter(f, c);
      const b = el('button', { flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: '6px', height: '40px', padding: '0 14px 0 12px', borderRadius: '999px', cursor: 'pointer',
        border: '1px solid ' + (aan ? T.brand : T.line), background: aan ? T.brandWash : '#fff', color: T.ink, font: '600 12.5px ' + FONT, whiteSpace: 'nowrap' });
      b.type = 'button';
      b.setAttribute('data-zoek-recent-filter', String(i));
      b.setAttribute('aria-pressed', aan ? 'true' : 'false');
      const ic = svgPath(ICON_QUICK, 14); ic.style.color = T.inkSoft;
      b.appendChild(ic);
      b.appendChild(document.createTextNode(groot(filterTekst(f))));
      focusRing(b);
      b.addEventListener('click', function () {
        wijzig(function (x) { x.minutes = f.minutes; x.weeks = f.weeks; x.tot = f.tot; x.dagen = f.dagen ? f.dagen.slice() : null; zb().kalender = false; });
      });
      rij.appendChild(b);
    });
    box.appendChild(rij);
    return box;
  }

  // Een ingeklapte stap: label links, de keuze rechts; tik = openen.
  function stapDicht(s) {
    const c = zb().concept;
    const waarde = s[0] === 'duur' ? duurTekst(c.minutes)
      : s[0] === 'wanneer' ? groot(periodeTekst(c))
      : s[0] === 'dagen' ? groot(dagenTekst(c.dagen))
      : c.clients.length ? (c.clients.length === 1 ? c.clients[0].name : clientenTekst(c.clients.length)) : 'Geen';
    const b = el('button', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%', minHeight: '50px', padding: '0 16px', flex: '0 0 auto',
      border: '1px solid ' + T.line, borderRadius: '12px', background: '#fff', color: T.ink, font: '400 13px ' + FONT, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' });
    b.type = 'button';
    b.setAttribute('data-zoek-stap', s[0]);
    b.setAttribute('aria-label', s[1] + ': ' + waarde + '. Wijzigen');
    b.appendChild(el('span', { fontSize: '12px', fontWeight: '600', color: T.inkSoft, flex: '0 0 auto' }, s[1]));
    b.appendChild(el('span', { fontSize: '13.5px', fontWeight: '600', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, waarde));
    focusRing(b);
    b.addEventListener('click', function () { naarStap(s[0]); });
    return b;
  }
  // De open stap: een kaart met de vraag en de keuzes.
  function stapOpen(s) {
    const kaart = el('section', { border: '1px solid ' + T.line, borderRadius: '12px', padding: '14px', background: '#fff', boxShadow: '0 6px 20px rgba(32,29,31,.08)', flex: '0 0 auto' });
    kaart.setAttribute('data-zoek-open', s[0]);
    kaart.appendChild(el('div', { fontSize: '12px', fontWeight: '600', color: T.inkSoft }, s[0] === 'clienten' ? 'Cliënten, optioneel' : s[1]));
    kaart.appendChild(el('h2', { margin: '2px 0 12px', fontSize: '18px', fontWeight: '700', lineHeight: '1.25', color: T.ink }, s[2]));
    if (s[0] === 'duur') stapDuur(kaart);
    else if (s[0] === 'wanneer') stapWanneer(kaart);
    else if (s[0] === 'dagen') stapDagen(kaart);
    else stapClienten(kaart);
    return kaart;
  }

  function stapDuur(kaart) {
    const c = zb().concept;
    const r = rooster(3);
    DUREN.forEach(function (d) {
      const b = keuze(d[1], c.minutes === d[0], function () { wijzig(function (x) { x.minutes = d[0]; }, 'wanneer'); });
      b.setAttribute('data-plan-duur', String(d[0]));
      b.setAttribute('aria-label', d[2]);
      r.appendChild(b);
    });
    kaart.appendChild(r);
    kaart.appendChild(uitleg('Je ziet alleen begintijden waarop de afspraak helemaal past, elk kwartier.'));
  }

  function stapWanneer(kaart) {
    const z = zb(), c = z.concept;
    const r = rooster(2);
    WEKEN.forEach(function (w) {
      const b = keuze(w[1], !c.tot && !z.kalender && c.weeks === w[0], function () {
        wijzig(function (x) { x.weeks = w[0]; x.tot = ''; z.kalender = false; }, 'dagen');
      });
      b.setAttribute('data-plan-weken', String(w[0]));
      r.appendChild(b);
    });
    const tot = keuze(c.tot ? 'Tot ' + kortDatum(c.tot) : 'Tot datum', !!(c.tot || z.kalender), function () { clearTimeout(stapTimer); z.kalender = !z.kalender; teken(); });
    tot.insertBefore(svgPath(ICON_KALENDER, 16), tot.firstChild);
    tot.setAttribute('data-plan-tot', '');
    tot.setAttribute('aria-label', c.tot ? 'Tot en met ' + dagLang(c.tot).toLowerCase() : 'Tot een datum');
    tot.setAttribute('aria-haspopup', 'dialog');
    tot.setAttribute('aria-expanded', z.kalender ? 'true' : 'false');
    r.appendChild(tot);
    kaart.appendChild(r);
    if (z.kalender) {
      const kal = el('div', { marginTop: '10px', padding: '10px', borderRadius: '12px', border: '1px solid ' + T.line, background: '#fff' });
      kal.setAttribute('data-plan-kalender', '');
      kal.setAttribute('role', 'dialog');
      kal.setAttribute('aria-label', 'Zoek tot en met');
      kal.appendChild(el('div', { fontSize: '12px', fontWeight: '600', color: T.inkSoft, margin: '0 2px 6px' }, 'Zoek tot en met'));
      const maand = el('div');
      maandKalender(maand, c.tot, function (ymd) { wijzig(function (x) { x.tot = ymd; z.kalender = false; }, 'dagen'); });
      kal.appendChild(maand);
      kaart.appendChild(kal);
    } else kaart.appendChild(uitleg('Vanaf vandaag, ' + dagLang(ymdVan(new Date())).toLowerCase() + '.'));
  }

  function stapDagen(kaart) {
    const c = zb().concept;
    const gek = c.dagen || [1, 2, 3, 4, 5];
    const r = rooster(5);
    DAGEN.forEach(function (d) {
      const aan = gek.indexOf(d[0]) >= 0;
      const b = keuze(d[1], aan, function () {
        const nieuw = aan ? gek.filter(function (x) { return x !== d[0]; }) : gek.concat([d[0]]).sort();
        if (!nieuw.length) return;   // minstens één dag
        wijzig(function (x) { x.dagen = nieuw.length === 5 ? null : nieuw; });
      }, { height: '50px', fontSize: '15px' });
      b.setAttribute('data-plan-dag', String(d[0]));
      b.setAttribute('aria-label', d[2]);
      b.title = aan ? (gek.length === 1 ? 'Minstens één dag' : d[2] + ' niet zoeken') : d[2] + ' ook zoeken';
      r.appendChild(b);
    });
    kaart.appendChild(r);
    kaart.appendChild(uitleg('Minstens één dag blijft aan.'));
    const wt = ctx.state && ctx.state.workHours;
    const noot = el('div', { display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '10px', padding: '10px 12px', borderRadius: '10px', background: T.lineSoft, fontSize: '12.5px', lineHeight: '1.4' });
    const ic = svgPath(ICON_QUICK, 16); ic.style.flex = '0 0 auto'; ic.style.color = T.inkSoft; ic.style.marginTop = '1px';
    noot.appendChild(ic);
    noot.appendChild(el('span', null, wt ? 'Alleen binnen je werktijden: ' + wt + '. Aanpassen kan in de popup van de extensie.' : 'Alleen binnen de werktijden van je dagindeling. Eigen werktijden stel je in in de popup van de extensie.'));
    kaart.appendChild(noot);
    const rij = el('div', { display: 'flex', justifyContent: 'flex-end', marginTop: '12px' });
    const verder = el('button', { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '44px', padding: '0 14px 0 16px', border: '1px solid ' + T.line, borderRadius: '10px',
      background: '#fff', color: T.ink, font: '600 13.5px ' + FONT, cursor: 'pointer' });
    verder.type = 'button';
    verder.setAttribute('data-zoek-volgende', '');
    verder.appendChild(document.createTextNode('Volgende'));
    verder.appendChild(svgPath(ICON_VERDER, 16));
    focusRing(verder);
    verder.addEventListener('click', function () { naarStap('clienten'); });
    rij.appendChild(verder);
    kaart.appendChild(rij);
  }

  function stapClienten(kaart) {
    const z = zb(), c = z.concept;
    kaart.appendChild(uitleg('Gekoppelde cliënten zie je op de kaart en staan straks al in Afspraak maken.', { margin: '-6px 0 12px' }));
    if (c.clients.length) {
      const chips = el('div', { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' });
      c.clients.forEach(function (cl) {
        const chip = el('span', { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '40px', maxWidth: '100%', padding: '0 2px 0 4px', borderRadius: '999px', background: T.brandWash, boxSizing: 'border-box' });
        chip.setAttribute('data-zoek-gekoppeld', String(cl.clientId));
        chip.appendChild(el('span', { flex: '0 0 auto', width: '30px', height: '30px', borderRadius: '50%', background: T.brand, color: '#fff', fontSize: '11px', fontWeight: '700',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }, initialen(cl.name)));
        chip.appendChild(el('span', { fontSize: '13px', fontWeight: '600', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, cl.name));
        const weg = el('button', { flex: '0 0 auto', width: '36px', height: '36px', padding: '0', border: '0', borderRadius: '50%', background: 'transparent', color: T.brandDeep, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });
        weg.type = 'button';
        weg.setAttribute('data-zoek-ontkoppel', String(cl.clientId));
        weg.setAttribute('aria-label', cl.name + ' ontkoppelen');
        weg.appendChild(svgPath(ICON_KRUIS, 16));
        focusRing(weg);
        weg.addEventListener('click', function () { c.clients = c.clients.filter(function (x) { return x !== cl; }); teken(); });
        chip.appendChild(weg);
        chips.appendChild(chip);
      });
      kaart.appendChild(chips);
    }
    const lab = el('label', { display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '600', color: T.inkSoft }, 'Zoek cliënt');
    const veld = el('div', { position: 'relative' });
    const ic = svgPath(ICON_ZOEK, 18);
    Object.assign(ic.style, { position: 'absolute', left: '11px', top: '13px', color: T.inkSoft, pointerEvents: 'none' });
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.inputMode = 'search';
    inp.enterKeyHint = 'search';
    inp.value = z.zoek.term;
    inp.placeholder = 'Naam cliënt';
    inp.autocomplete = 'off';
    inp.setAttribute('data-zoek-client', '');
    Object.assign(inp.style, { width: '100%', boxSizing: 'border-box', height: '44px', padding: '0 12px 0 36px', border: '1px solid ' + T.line, borderRadius: '10px',
      background: '#fff', color: T.ink, font: '400 14px ' + FONT });
    focusRing(inp, T.brand, true);
    const id = 'zoek-client-' + Math.random().toString(36).slice(2, 8);
    inp.id = id; lab.htmlFor = id;
    veld.appendChild(ic);
    veld.appendChild(inp);
    kaart.appendChild(lab);
    kaart.appendChild(veld);
    const treffers = el('div');
    treffers.setAttribute('data-zoek-treffers', '');
    kaart.appendChild(treffers);
    vulTreffers(treffers);
    inp.addEventListener('input', function () {
      z.zoek.term = inp.value;
      clearTimeout(zoekTimer);
      const term = inp.value.trim();
      if (term.length < 2 || !actions.onClientSearch) { z.zoek.treffers = null; vulTreffers(treffers); return; }
      zoekTimer = setTimeout(function () {
        const mijn = ++zoekNr;
        z.zoek.treffers = { zoekt: true, lijst: [] };
        vulTreffers(laag && laag.querySelector('[data-zoek-treffers]'));
        actions.onClientSearch(term, function (res) {
          if (mijn !== zoekNr || !zb().open) return;   // intussen verder getypt of gesloten
          z.zoek.treffers = res && res.ok ? { lijst: res.clients || [] } : { fout: (res && res.error) || 'Zoeken mislukt.', lijst: [] };
          vulTreffers(laag && laag.querySelector('[data-zoek-treffers]'));
        }, false);
      }, 350);
    });
    kaart.appendChild(uitleg('Namen komen uit ONS en worden nergens bewaard. De recente filters onthouden geen cliënten.'));
  }
  function vulTreffers(host) {
    if (!host) return;
    const z = zb(), c = z.concept, t = z.zoek.treffers;
    host.innerHTML = '';
    if (!t) return;
    const lijst = el('div', { marginTop: '8px', border: '1px solid ' + T.line, borderRadius: '12px', overflow: 'hidden' });
    const regel = function (tekst, kleur) { return el('div', { padding: '10px 12px', fontSize: '12.5px', color: kleur || T.inkSoft }, tekst); };
    if (t.zoekt) lijst.appendChild(regel('Zoeken in ONS…'));
    else if (t.fout) lijst.appendChild(regel(t.fout, T.bad));
    else if (!t.lijst.length) lijst.appendChild(regel('Geen cliënt gevonden.'));
    else t.lijst.forEach(function (cl, i) {
      const aan = c.clients.some(function (x) { return String(x.clientId) === String(cl.id); });
      const rij = el('div', { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px 6px 10px', borderTop: i ? '1px solid ' + T.lineSoft : '0' });
      rij.appendChild(el('span', { flex: '0 0 auto', width: '32px', height: '32px', borderRadius: '50%', background: T.lineSoft, fontSize: '11.5px', fontWeight: '700',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }, initialen(cl.name)));
      const nm = el('span', { flex: '1 1 auto', minWidth: '0' });
      nm.appendChild(el('span', { display: 'block', fontSize: '13.5px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, cl.name || 'Cliënt ' + cl.id));
      const extra = [cl.number ? 'Cl ' + cl.number : '', pcTekst(cl.pc)].filter(Boolean).join(', ');
      if (extra) nm.appendChild(el('span', { display: 'block', fontSize: '12px', color: T.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, extra));
      rij.appendChild(nm);
      const vol = !aan && c.clients.length >= CLIENTEN_MAX;
      const b = el('button', { flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: '5px', height: '40px', padding: '0 12px 0 10px', borderRadius: '999px', cursor: vol ? 'default' : 'pointer',
        border: '1px solid ' + (aan ? T.brandWash : T.brand), background: aan ? T.brandWash : '#fff', color: aan ? T.brandDeep : T.brand, font: '600 12.5px ' + FONT, opacity: vol ? '.5' : '1' });
      b.type = 'button';
      b.disabled = vol;
      b.setAttribute('data-zoek-koppel', String(cl.id));
      b.setAttribute('aria-pressed', aan ? 'true' : 'false');
      b.setAttribute('aria-label', (aan ? 'Ontkoppel ' : 'Koppel ') + (cl.name || 'cliënt'));
      b.appendChild(svgPath(aan ? ICON_VINK : ICON_PLUS, 14));
      b.appendChild(document.createTextNode(aan ? 'Gekoppeld' : 'Koppelen'));
      focusRing(b);
      b.addEventListener('click', function () {
        if (aan) c.clients = c.clients.filter(function (x) { return String(x.clientId) !== String(cl.id); });
        else if (!vol) c.clients = c.clients.concat([{ clientId: String(cl.id), name: cl.name || 'Cliënt ' + cl.id, number: cl.number || '', pc: normPostcode(cl.pc) }]);
        teken();
      });
      rij.appendChild(b);
      lijst.appendChild(rij);
    });
    host.appendChild(lijst);
  }

  /* ── De kaart ── */
  function tekenKaart() {
    const clients = kaartClients();
    const kop = el('div', { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', flex: '0 0 auto' });
    kop.appendChild(icoonKnop(ICON_TERUG, 'Terug', kaartTerug, 'data-kaart-terug'));
    kop.appendChild(el('div', { flex: '1 1 auto', fontSize: '15px', fontWeight: '700' }, 'Kaart'));
    kop.appendChild(el('div', { flex: '0 0 auto', fontSize: '12px', fontWeight: '600', color: T.inkSoft }, clientenTekst(clients.length)));
    laag.appendChild(kop);
    const body = el('div', { flex: '1 1 auto', minHeight: '0', overflowY: 'auto', padding: '0 14px 16px' });
    body.setAttribute('data-zoek-body', '');
    const met = clients.filter(function (cl) { return normPostcode(cl.pc); });
    const adressen = met.map(function (cl) { return pcTekst(cl.pc) + ', Nederland'; });
    const sleutel = ctx.state && ctx.state.mapsEmbedKey;
    // Letters zoals op de kaart (A, B, C) als er meer dan één postcode is.
    const letter = function (cl) { const i = met.indexOf(cl); return met.length > 1 && i >= 0 ? String.fromCharCode(65 + i) : ''; };
    if (sleutel && met.length) {
      const ifr = document.createElement('iframe');
      ifr.src = embedUrl(sleutel, adressen, '');
      ifr.title = 'Kaart met de postcodes van de gekoppelde cliënten';
      ifr.setAttribute('loading', 'lazy');
      ifr.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      ifr.setAttribute('data-kaart-frame', '');
      Object.assign(ifr.style, { width: '100%', height: '360px', border: '1px solid ' + T.line, borderRadius: '12px', display: 'block' });
      body.appendChild(ifr);
    } else if (!met.length) {
      body.appendChild(el('div', { padding: '12px', borderRadius: '12px', background: T.lineSoft, fontSize: '12.5px' }, 'Van de gekoppelde cliënten is geen postcode bekend, dus er is niets op de kaart te zetten.'));
    } else {
      body.appendChild(el('div', { padding: '12px', borderRadius: '12px', background: T.lineSoft, fontSize: '12.5px', lineHeight: '1.4' }, 'Voor de kaart in het zijpaneel: vul in het beheerscherm (Functies → Google Maps) een sleutel voor de Maps Embed API in. Openen in Google Maps kan wel.'));
    }
    const lijst = el('div', { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' });
    lijst.setAttribute('data-kaart-lijst', '');
    clients.forEach(function (cl) {
      const rij = el('div', { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '28px' });
      const l = letter(cl);
      rij.appendChild(el('span', { flex: '0 0 auto', width: '24px', height: '24px', borderRadius: '50%', background: normPostcode(cl.pc) ? T.brand : T.line, color: normPostcode(cl.pc) ? '#fff' : T.inkSoft,
        fontSize: '11.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }, l || initialen(cl.name).slice(0, 1)));
      rij.appendChild(el('span', { fontSize: '13.5px', fontWeight: '600', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, cl.name));
      rij.appendChild(el('span', { fontSize: '12px', color: T.inkSoft, whiteSpace: 'nowrap', marginLeft: 'auto' }, pcTekst(cl.pc) || 'geen postcode bekend'));
      lijst.appendChild(rij);
    });
    body.appendChild(lijst);
    if (met.length) {
      const a = document.createElement('a');
      a.href = mapsUrls(adressen, '', false)[0];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.setAttribute('data-kaart-link', '');
      Object.assign(a.style, { display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '14px', color: T.brand, font: '600 13px ' + FONT, textDecoration: 'none' });
      a.appendChild(svgPath(ICON_KAART, 16));
      a.appendChild(document.createTextNode('Openen in Google Maps'));
      focusRing(a);
      body.appendChild(a);
    }
    body.appendChild(uitleg('Naar Google Maps gaan alleen de postcodes. Namen blijven in het zijpaneel.', { marginTop: '12px' }));
    laag.appendChild(body);
  }

  /* ── Op de planhulp: de zoekpil en de kaartpil ── */
  // Wat je zoekt en hoeveel tijden er zijn; een tik opent het blad.
  function zoekPil() {
    const f = planFilters();
    zorgTelling(f);
    const t = telStand(f);
    const b = el('button', { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', minHeight: '56px', padding: '8px 16px 8px 14px', margin: '0 0 10px', boxSizing: 'border-box',
      border: '1px solid ' + T.line, borderRadius: '999px', background: '#fff', color: T.ink, font: '400 13px ' + FONT, textAlign: 'left', cursor: 'pointer', boxShadow: '0 2px 10px rgba(32,29,31,.08)' });
    b.type = 'button';
    b.setAttribute('data-plan-zoekpil', '');
    const ic = svgPath(ICON_ZOEK, 18); ic.style.flex = '0 0 auto';
    b.appendChild(ic);
    const tekst = el('span', { flex: '1 1 auto', minWidth: '0' });
    tekst.appendChild(el('span', { display: 'block', fontSize: '13.5px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, groot(filterTekst(f))));
    const delen = [];
    if (t.status === 'bezig') delen.push('Tijden tellen…');
    else if (t.status === 'klaar') delen.push(t.tijden ? tijdenTekst(t.tijden, t.plus) + ' op ' + t.dagen + (t.dagen === 1 ? ' dag' : ' dagen') : 'Geen tijden');
    if (f.clients.length) delen.push(clientenTekst(f.clients.length));
    const sub = el('span', { display: 'block', fontSize: '12px', color: T.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, delen.join(', '));
    sub.setAttribute('data-plan-telling', t.status === 'klaar' ? String(t.tijden) : '');
    tekst.appendChild(sub);
    b.appendChild(tekst);
    b.appendChild(el('span', { flex: '0 0 auto', fontSize: '12.5px', fontWeight: '600', color: T.brand }, 'Wijzig'));
    b.setAttribute('aria-label', 'Zoekopdracht: ' + filterTekst(f) + (delen.length ? '. ' + delen.join(', ') : '') + '. Wijzigen');
    focusRing(b);
    b.addEventListener('click', function () { openZoekblad('duur'); });
    return b;
  }
  // Onderaan de planhulp (blijft in beeld bij scrollen), alleen met gekoppelde cliënten.
  function planKaartPil() {
    if (!(ctx.plan.clients || []).length) return null;
    const rij = el('div', { position: 'sticky', bottom: '12px', display: 'flex', justifyContent: 'center', marginTop: '12px', pointerEvents: 'none', zIndex: '1' });
    rij.appendChild(kaartPil('plan'));
    return rij;
  }

  return { herstelZoekblad, openZoekblad, planKaartPil, sluitZoekblad, vergeetTelling, zoekPil, zoekbladOpen };
}
