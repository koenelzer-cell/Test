// Planhulp: vrije tijd zoeken (lijst per dag of weekplanning), Meer laden,
// momenten kiezen (balk onderin) en de eerste blokken bij ONS' eigen
// overlapcontrole nakijken nadat de lijst er staat.

import { BEWAARD, momentIndex } from './bewaard.js';
import { FONT, ICON_KALENDER, SVG_NS, T, chipKnop, dagLang, datumUitYmd, dayLabel, el, fmtMin, hm, isoWeek, laadBalk, noteBox, primaryBtn, secondaryBtn, svgPath, txt, vanTot, ymdVan, zorgVoorStijl } from './ui.js';
import { feestdagAnimatie, feestdagIcoon, feestdagSlinger, feestdagStijl } from './feestdagen.js';
import { maandKalender } from './kiezers.js';
import { werkweekTekst as werkweekNl } from '../shared/datum.js';

const PLAN_STAP = 24;
// Meer laden: elke klik één week verder, zonder grens. Alleen dat nieuwe
// stuk wordt opgehaald en onder de lijst gezet. Toonde de lijst nog niet
// alles van de periode (afgekapt), dan vanaf de dag van het laatste blok,
// zodat er geen gat valt; blokken die er al staan, komen er niet dubbel in.
const MEER_MAX = 100;
/* ── Meerdere momenten: één afspraak, daarna kopieën ── */
// Reserveringen (uit het vrije blok) die [start, start+duur) raken.
function reserveringenIn(g, start, duur) {
  return (g.reservations || []).filter(function (r) { return r.startMin < start + duur && r.endMin > start; });
}
function reserveringTekst(rs) {
  return rs.map(function (r) { return (r.label || 'Reservering') + ' (' + hm(r.startMin) + ' tot ' + hm(r.endMin) + ')'; }).join(', ');
}
function kopieUitslag() {
  const k = BEWAARD.kopie;
  if (!k) return null;
  const lbl = function (m) { return dayLabel(m.date) + ' ' + hm(m.startMin); };
  if (k.reason) return noteBox('Geen kopieën gemaakt: ' + (k.reason === 'herhalende afspraak' ? 'het is een herhalende afspraak.' : 'de afspraak was niet te lezen.'), 'warn');
  if (k.failed && k.failed.length) return noteBox((k.made || []).length + ' kopieën gemaakt. Niet gelukt: ' + k.failed.map(lbl).join(', ') + '. Maak die zelf aan in ONS.', 'warn');
  const verder = k.next ? ' Nu het formulier voor ' + lbl(k.next) + (k.left > 1 ? ' (nog ' + k.left + ' met eigen instellingen).' : ' (eigen instellingen).') : '';
  if (k.made && k.made.length) return noteBox('Afspraak ook gemaakt op ' + k.made.map(lbl).join(', ') + '.' + verder, 'ok');
  if (verder) return noteBox('Afspraak opgeslagen.' + verder, 'ok');
  return null;
}
// ONS' eigen overlapcontrole voor één begintijd. Een antwoord blijft even
// bewaard (per dag, begintijd en duur), zodat een andere duur en weer terug,
// of andere dagen, ONS niet opnieuw vraagt. cb(overlap): true, false of null.
const ONS_TTL = 5 * 60000;
// Eerst de lijst, dan ONS: het begin van de eerste blokken wordt pas
// nagekeken als de lijst er al staat (hooguit drie vragen tegelijk). Een
// waarschuwing verschijnt zodra ONS antwoordt. Alleen als de hulp ONS'
// controle kent (onsCheck 'ready').
const ONS_NAKIJK_MAX = 12;
function dagenVan(res) {
  const dagen = [], per = {};
  res.gaps.forEach(function (g) { if (!per[g.date]) { per[g.date] = []; dagen.push(g.date); } per[g.date].push(g); });
  return { dagen: dagen, per: per };
}
// Feestdagen (uit ONS) van maandag tot en met vrijdag: { date, name }.
function feestdagenOpWerkdag(res) {
  // Goede Vrijdag is geen vrije dag (ook al stuurt ONS hem mee).
  return ((res && res.holidays) || []).filter(function (h) { const w = datumUitYmd(h.date).getDay(); return w > 0 && w < 6 && !/goede\s*vrijdag/i.test(String(h.name || '')); });
}
function feestdagPer(res) { const per = {}; feestdagenOpWerkdag(res).forEach(function (h) { per[h.date] = h; }); return per; }
const TOON_TIJDEN = 8;
// Maandag van de week van een datum ('YYYY-MM-DD').
function maandag(ymd) { const d = datumUitYmd(ymd); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }

export function maakPlanhulp(ctx) {
  const { actions, fAan, naarPagina, renderPagina } = ctx;

  // Zoeken. Een nieuwe zoekactie gaat altijd door (ook als er nog een loopt):
  // het antwoord van een oudere telt dan niet meer. houd: het huidige
  // resultaat blijven tonen tot het nieuwe er is (dagen, 'Meer laden').
  let planNr = 0;
  function startPlan(houd) {
    if (!actions.onFreeSlots) return;
    // Opnieuw zoeken gaat vanaf vandaag in één keer: hooguit een jaar (Meer
    // laden kan verder, maar haalt alleen het nieuwe stuk op).
    const jaar = new Date(); jaar.setDate(jaar.getDate() + 365);
    if (ctx.plan.tot && ctx.plan.tot > ymdVan(jaar)) ctx.plan.tot = ymdVan(jaar);
    const mijn = ++planNr;
    ctx.plan.busy = true; ctx.plan.error = '';
    if (!houd) ctx.plan.result = null;
    if (ctx.pagina === 'plan') renderPagina();
    const voor = ctx.plan;
    actions.onFreeSlots(ctx.plan.minutes, ctx.plan.weeks, function (res) {
      if (BEWAARD.plan !== voor || mijn !== planNr) return;
      ctx.plan.busy = false; ctx.plan.meerBezig = false;
      if (!(res && res.ok && res.result)) ctx.plan.error = (res && res.error) || 'Zoeken mislukt.';
      else { ctx.plan.result = res.result; nakijkenBijOns(res.result.gaps, res.result.minutes, res.result.onsCheck); }
      if (ctx.pagina === 'plan') setTimeout(function () { if (ctx.pagina === 'plan' && mijn === planNr) { renderPagina(); ctx.misschienRondleiding(); } }, 0);
    }, ctx.plan.tot, false, false, '', gekozenDagen(), ctx.plan.limit || PLAN_STAP);
  }
  // Dagen aan- of uitvinken: meteen zichtbaar (filter in het paneel), het
  // nieuwe zoeken pas als je even niets meer aanklikt.
  let dagenTimer = null;
  function dagenGewijzigd() {
    renderPagina();
    clearTimeout(dagenTimer);
    dagenTimer = setTimeout(function () { ctx.plan.limit = PLAN_STAP; startPlan(true); }, 300);
  }
  function meerLaden(res) {
    if (!actions.onFreeSlots || !res) return;
    const gaps = res.gaps || [];
    const afgekapt = res.afgekapt != null ? res.afgekapt : gaps.length >= (ctx.plan.limit || PLAN_STAP);
    const laatste = datumUitYmd(res.lastDate || res.to || ymdVan(new Date()));
    const tot = new Date(laatste); tot.setDate(tot.getDate() + 7);
    const van = afgekapt && gaps.length ? gaps[gaps.length - 1].date : ymdVan(new Date(laatste.getFullYear(), laatste.getMonth(), laatste.getDate() + 1));
    const totYmd = ymdVan(tot);
    const mijn = ++planNr, voor = ctx.plan;
    ctx.plan.meerBezig = true; ctx.plan.error = '';
    if (ctx.pagina === 'plan') renderPagina();
    actions.onFreeSlots(ctx.plan.minutes, ctx.plan.weeks, function (r) {
      if (BEWAARD.plan !== voor || mijn !== planNr) return;
      ctx.plan.meerBezig = false;
      if (!(r && r.ok && r.result)) { ctx.plan.error = (r && r.error) || 'Meer laden mislukt.'; if (ctx.pagina === 'plan') renderPagina(); return; }
      const bekend = {};
      gaps.forEach(function (g) { bekend[g.date + '|' + g.startMin] = true; });
      const nieuw = (r.result.gaps || []).filter(function (g) { return !bekend[g.date + '|' + g.startMin]; });
      const feest = (res.holidays || []).slice();
      (r.result.holidays || []).forEach(function (h) { if (!feest.some(function (x) { return x.date === h.date; })) feest.push(h); });
      ctx.plan.tot = totYmd;   // de periode loopt nu tot en met deze dag
      ctx.plan.result = Object.assign({}, res, { gaps: gaps.concat(nieuw), holidays: feest, to: totYmd, lastDate: r.result.lastDate || totYmd,
        afgekapt: (r.result.gaps || []).length >= MEER_MAX });
      nakijkenBijOns(nieuw, r.result.minutes || res.minutes, r.result.onsCheck);
      if (ctx.pagina === 'plan') setTimeout(function () { if (ctx.pagina === 'plan' && mijn === planNr) renderPagina(); }, 0);
    }, totYmd, false, false, van, gekozenDagen(), MEER_MAX);
  }
  // Dagenfilter in het paneel (alleen de lijst): meteen zichtbaar, ook op een
  // resultaat van voor de wijziging.
  function opGekozenDag(date) { const a = gekozenDagen(); return !a || a.indexOf(datumUitYmd(date).getDay()) >= 0; }
  function metDagen(res) {
    if (!res || !gekozenDagen()) return res;
    return Object.assign({}, res, { gaps: (res.gaps || []).filter(function (g) { return opGekozenDag(g.date); }), holidays: (res.holidays || []).filter(function (h) { return opGekozenDag(h.date); }) });
  }
  // Dagenfilter: [1..5] (1 = maandag); null of alle vijf = alle dagen.
  function gekozenDagen() { return ctx.plan.dagen && ctx.plan.dagen.length && ctx.plan.dagen.length < 5 ? ctx.plan.dagen.slice() : null; }
  function wisselMoment(date, startMin) {
    const i = momentIndex(date, startMin);
    if (i >= 0) BEWAARD.momenten.splice(i, 1);
    else if (!fAan('plannerCopies')) BEWAARD.momenten = [{ date: date, startMin: startMin }]; // kopieën uit: één moment
    else {
      // Twee keer dezelfde afspraak die elkaar overlapt kan niet: de oude eruit.
      const duur = ctx.plan.minutes;
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
    const lab = el('label', { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: T.ink, cursor: 'pointer', userSelect: 'none' });
    const cb = document.createElement('input');
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
    const ms = BEWAARD.momenten;
    if (!ms.length || !actions.onNewEvent) return;
    // Het eerste moment opent het formulier; daarop lijken de kopieën.
    // Momenten met een apart formulier krijgen daarna elk een eigen formulier.
    const eerste = ms[0];
    const zelfde = ms.slice(1).filter(function (m) { return !m.eigen; });
    const eigen = ms.slice(1).filter(function (m) { return m.eigen; });
    const tijd = function (m) { return { date: m.date, time: hm(m.startMin) }; };
    actions.onNewEvent({
      date: eerste.date, time: hm(eerste.startMin), minutes: ctx.plan.minutes,
      extra: zelfde.map(tijd), eigen: eigen.map(tijd)
    }, function (res) {
      if (!(res && res.ok)) { fout((res && res.error) || 'Openen mislukt.'); }
    });
  }
  // Vaste balk onderin de planhulp en het vrije blok: hoeveel momenten er
  // gekozen zijn en één knop om de afspraak te maken. Klik op de teller om de
  // lijst open te klappen; alleen daar kun je momenten weghalen of alles wissen.
  function momentenBalk() {
    const n = BEWAARD.momenten.length;
    const balk = el('div', {
      background: '#fff', padding: '10px 12px 12px',
      borderTop: '1px solid ' + T.line, boxShadow: '0 -10px 24px -18px rgba(32,20,15,.35)'
    });
    balk.setAttribute('data-selectie', String(n));
    if (BEWAARD.balkOpen) {
      const lijst = el('div', { display: 'flex', flexDirection: 'column', margin: '0 0 6px' });
      BEWAARD.momenten.forEach(function (m, i) {
        const rij = el('div', { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: T.ink, minHeight: '30px', borderBottom: '1px solid ' + T.lineSoft });
        rij.appendChild(el('span', { flex: '0 0 74px', fontWeight: '600' }, dayLabel(m.date)));
        rij.appendChild(el('span', { flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }, hm(m.startMin) + ' tot ' + hm(m.startMin + ctx.plan.minutes)));
        // Het eerste moment is het formulier zelf: geen vinkje.
        const vink = i === 0 || ctx.kanDirect() ? el('span', { flex: '1 1 auto' }) : eigenVinkje(m, 'Apart formulier');
        if (i > 0) { vink.style.flex = '1 1 auto'; vink.style.justifyContent = 'flex-end'; vink.style.color = T.inkSoft; vink.style.fontSize = '12px'; }
        rij.appendChild(vink);
        const weg = el('button', { border: '0', background: 'transparent', color: T.inkSoft, cursor: 'pointer', fontSize: '16px', lineHeight: '1', padding: '2px 6px', borderRadius: '6px' }, '\u00d7');
        weg.type = 'button';
        weg.title = 'Uit selectie halen';
        weg.setAttribute('aria-label', 'Uit selectie halen: ' + dayLabel(m.date) + ' ' + hm(m.startMin));
        weg.addEventListener('click', function () { wisselMoment(m.date, m.startMin); if (!BEWAARD.momenten.length) BEWAARD.balkOpen = false; renderPagina(); });
        rij.appendChild(weg);
        lijst.appendChild(rij);
      });
      balk.appendChild(lijst);
      const wis = el('button', { display: 'block', margin: '0 0 8px auto', border: '0', background: 'transparent', color: T.inkSoft, cursor: 'pointer', font: '400 12px ' + FONT, textDecoration: 'underline', padding: '2px 0' }, 'Alles wissen');
      wis.type = 'button';
      wis.addEventListener('click', function () { BEWAARD.momenten = []; BEWAARD.balkOpen = false; BEWAARD.kopie = null; renderPagina(); });
      balk.appendChild(wis);
    }
    const rij2 = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });
    const teller = el('button', { display: 'flex', alignItems: 'center', gap: '6px', border: '0', background: 'transparent', cursor: 'pointer', padding: '0', font: '700 13px ' + FONT, color: T.ink, whiteSpace: 'nowrap' });
    teller.type = 'button';
    teller.setAttribute('aria-expanded', BEWAARD.balkOpen ? 'true' : 'false');
    teller.setAttribute('data-teller', '');
    teller.title = BEWAARD.balkOpen ? 'Lijst inklappen' : 'Gekozen momenten bekijken';
    teller.appendChild(document.createTextNode(n === 1 ? '1 moment' : n + ' momenten'));
    teller.appendChild(el('span', { color: T.brand, fontSize: '11px' }, BEWAARD.balkOpen ? '\u25bc' : '\u25b2'));
    teller.addEventListener('click', function () { BEWAARD.balkOpen = !BEWAARD.balkOpen; renderPagina(); });
    rij2.appendChild(teller);
    const foutHost = el('div');
    const knop = primaryBtn(n > 1 ? 'Afspraak maken op ' + n + ' momenten' : 'Afspraak maken', function () {
      const viaForm = function () { maakOpMomenten(function (f) { foutHost.innerHTML = ''; foutHost.appendChild(noteBox(f, 'bad')); }); };
      // Meteen in ONS maken: cliënt(en), type en uursoort kies je op de volgende pagina.
      if (ctx.kanDirect()) { ctx.naarMaken(BEWAARD.momenten, ctx.plan.minutes); return; }
      viaForm();
    });
    Object.assign(knop.style, { marginTop: '0', flex: '1 1 auto', width: 'auto' });
    const aantalEigen = BEWAARD.momenten.filter(function (m) { return m.eigen; }).length;
    if (ctx.kanDirect()) knop.title = 'Kies cliënt(en), afspraaktype en uursoort; de hulp maakt ' + (n > 1 ? 'de afspraken' : 'de afspraak') + ' meteen in ONS.';
    else knop.title = n > 1 ? 'Je maakt de afspraak één keer in ONS; na het opslaan maakt de hulp hem ook op de andere momenten' +
      (aantalEigen ? ', en opent hij voor ' + aantalEigen + (aantalEigen === 1 ? ' moment' : ' momenten') + ' met andere instellingen een nieuw formulier.' : '.') : 'Opent een nieuwe afspraak in ONS met datum en begintijd ingevuld.';
    rij2.appendChild(knop);
    balk.appendChild(rij2);
    balk.appendChild(foutHost);
    return balk;
  }

  // Planhulp: bovenaan Lijst of Weekraster en de instellingen (duur en
  // vooruit). Lijst: per dag de begintijden, meteen te kiezen.
  // Weekraster: mini-agenda per week; tik in de vrije tijd. Gekozen momenten
  // staan in de balk onderin.
  // Agenda's erbij of eraf: zonder gekozen momenten meteen opnieuw zoeken;
  // met gekozen momenten eerst vragen (opnieuw beginnen of negeren).
  function agendasGewijzigd(oud, nieuw) {
    const nOud = oud.split(',').length, nNieuw = nieuw.split(',').length;
    const bezig = BEWAARD.momenten.length > 0 || (ctx.pagina === 'maken' && BEWAARD.maak && !BEWAARD.maak.uitslag);
    if (bezig) {
      BEWAARD.agendaMelding = { meer: nNieuw > nOud, minder: nNieuw < nOud, aantal: nNieuw };
      if (ctx.pagina === 'plan' || ctx.pagina === 'maken') renderPagina();
      return;
    }
    planVernieuwen();
  }
  function planVernieuwen() {
    ctx.plan.result = null; ctx.plan.error = ''; ctx.plan.raster = null;
    BEWAARD.agendaMelding = null;
    if (ctx.pagina === 'plan') { startPlan(); renderPagina(); }
  }
  function agendaMeldingBlok() {
    const m = BEWAARD.agendaMelding;
    if (!m) return null;
    const box = el('div', { border: '1px solid #f0d6a8', background: '#fdf3e2', borderRadius: '12px', padding: '10px 12px', margin: '0 0 10px' });
    box.setAttribute('data-agenda-melding', '');
    const wat = m.meer ? 'Er is een agenda geopend' : m.minder ? 'Er is een agenda gesloten' : 'Er staan andere agenda\u2019s open';
    box.appendChild(el('div', { fontWeight: '700', fontSize: '13px', color: T.warn }, wat + (m.aantal > 1 ? ' (nu ' + m.aantal + ' agenda\u2019s).' : '.')));
    box.appendChild(el('div', { fontSize: '12px', color: T.ink, margin: '2px 0 8px' }, 'Je gekozen momenten zijn gezocht met de vorige agenda\u2019s. Opnieuw beginnen zoekt tijd die nu voor iedereen vrij is.'));
    const rij = el('div', { display: 'flex', gap: '8px' });
    const opnieuw = primaryBtn('Opnieuw beginnen', function () {
      BEWAARD.momenten = []; BEWAARD.balkOpen = false; BEWAARD.maak = null; BEWAARD.agendaMelding = null;
      ctx.plan.result = null; ctx.plan.error = ''; ctx.plan.raster = null;
      naarPagina('plan');
    });
    Object.assign(opnieuw.style, { marginTop: '0', flex: '1 1 0' });
    opnieuw.setAttribute('data-agenda-opnieuw', '');
    const negeer = secondaryBtn('Negeren', function () { BEWAARD.agendaMelding = null; renderPagina(); });
    negeer.style.flex = '1 1 0';
    negeer.setAttribute('data-agenda-negeren', '');
    rij.appendChild(opnieuw); rij.appendChild(negeer);
    box.appendChild(rij);
    return box;
  }
  function pagePlan() {
    const planBox = el('div');
    const melding = agendaMeldingBlok();
    if (melding) planBox.appendChild(melding);
    const meer = (ctx.state && ctx.state.inviteeCount > 1) ? ctx.state.inviteeCount : 0;
    if (meer) { planBox.appendChild(noteBox('Er staan ' + meer + ' agenda’s open: de planhulp zoekt tijd waarop iedereen vrij is.', 'ok')); planBox.lastChild.style.margin = '0 0 10px'; }
    // Lijst of weekraster.
    const seg = el('div', { display: 'flex', background: T.lineSoft, borderRadius: '10px', padding: '3px', marginBottom: '10px' });
    [['lijst', 'Lijst'], ['raster', 'Weekplanning']].forEach(function (o) {
      const aan = (ctx.plan.weergave || 'lijst') === o[0];
      const b = el('button', { flex: '1 1 0', border: '0', borderRadius: '8px', padding: '6px 0', cursor: 'pointer', font: '600 12.5px ' + FONT,
        background: aan ? '#fff' : 'transparent', color: aan ? T.ink : T.inkSoft, boxShadow: aan ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }, o[1]);
      b.type = 'button'; b.setAttribute('data-plan-weergave', o[0]); b.setAttribute('aria-pressed', aan ? 'true' : 'false');
      b.addEventListener('click', function () { ctx.plan.weergave = o[0]; renderPagina(); });
      seg.appendChild(b);
    });
    planBox.appendChild(seg);
    // Instellingen als compacte tabel: per regel een label links en de keuzes
    // even breed op één regel, met korte teksten (30m, 1u, 2 wk) en Tot datum
    // als kalendertje. Voluit staat in aria-label en title. Gekozen is roze,
    // ook bij de dagen. Een wijziging zoekt meteen opnieuw.
    const opnieuw = function () { ctx.plan.result = null; ctx.plan.limit = PLAN_STAP; startPlan(); };
    const inst = el('div', { border: '1px solid ' + T.line, borderRadius: '12px', padding: '0 12px' });
    inst.setAttribute('data-plan-instellingen', '');
    const instRij = function (label, keuzes) {
      const r = el('div', { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '46px', borderTop: inst.firstChild ? '1px solid ' + T.line : '0' });
      r.appendChild(el('span', { flex: '0 0 52px', fontSize: '12px', fontWeight: '600', color: T.inkSoft }, label));
      const k = el('div', { display: 'flex', gap: '5px', flex: '1 1 auto', minWidth: '0' });
      keuzes.forEach(function (c) { k.appendChild(c); });
      r.appendChild(k);
      inst.appendChild(r);
    };
    const keuze = function (tekst, voluit, aan, fn, attr) {
      const c = chipKnop(tekst, aan, fn, { flex: '1 1 0', minWidth: '0', height: '30px', fontSize: '12.5px', border: '1px solid ' + (aan ? T.brand : T.line) });
      c.setAttribute(attr[0], attr[1]);
      c.setAttribute('aria-pressed', aan ? 'true' : 'false');
      c.setAttribute('aria-label', voluit);
      c.title = voluit;
      return c;
    };
    instRij('Duur', [[30, '30m', '30 minuten'], [45, '45m', '45 minuten'], [60, '1u', '1 uur'], [90, '1,5u', '1,5 uur'], [120, '2u', '2 uur']].map(function (d) {
      return keuze(d[1], d[2], ctx.plan.minutes === d[0], function () { ctx.plan.minutes = d[0]; opnieuw(); }, ['data-plan-duur', String(d[0])]);
    }));
    if ((ctx.plan.weergave || 'lijst') === 'lijst') {
      const per = [[1, '1 wk', '1 week'], [2, '2 wk', '2 weken'], [4, '4 wk', '4 weken']].map(function (w) {
        return keuze(w[1], w[2], !ctx.plan.tot && !ctx.plan.totOpen && ctx.plan.weeks === w[0], function () { ctx.plan.weeks = w[0]; ctx.plan.tot = ''; ctx.plan.totOpen = false; opnieuw(); }, ['data-plan-weken', String(w[0])]);
      });
      // Tot datum: een kalendertje; met een gekozen datum staat die er kort
      // naast. Een tik klapt de maandkalender onder de tabel open of dicht;
      // terug naar weken = een tik op 1, 2 of 4 wk (geen aparte Wissen-knop).
      const totDag = ctx.plan.tot ? dagLang(ctx.plan.tot, true).replace(/^\S+ /, '') : '';
      const tot = keuze(totDag.replace(/^(\d+ \S{3})\S*$/, '$1'), ctx.plan.tot ? 'Tot en met ' + totDag : 'Tot een datum', !!(ctx.plan.tot || ctx.plan.totOpen), function () { ctx.plan.totOpen = !ctx.plan.totOpen; renderPagina(); }, ['data-plan-tot', '']);
      Object.assign(tot.style, { flex: '0 0 auto', minWidth: '34px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' });
      tot.insertBefore(svgPath(ICON_KALENDER, 15), tot.firstChild);
      tot.setAttribute('aria-haspopup', 'dialog');
      tot.setAttribute('aria-expanded', ctx.plan.totOpen ? 'true' : 'false');
      if (ctx.plan.totOpen) tot.style.boxShadow = '0 0 0 3px ' + T.brandWash;
      per.push(tot);
      instRij('Vooruit', per);
    }
    // Optioneel, alleen in de lijst: vrije tijd op bepaalde dagen (standaard
    // alle dagen aan). De weekplanning toont altijd de hele week.
    const gek = gekozenDagen() || [1, 2, 3, 4, 5];
    if ((ctx.plan.weergave || 'lijst') === 'lijst') instRij('Dagen', ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag'].map(function (naam, i) {
      const wd = i + 1, aan = gek.indexOf(wd) >= 0;
      const c = keuze(naam.slice(0, 2), naam, aan, function () {
        const nieuw = aan ? gek.filter(function (x) { return x !== wd; }) : gek.concat([wd]).sort();
        if (!nieuw.length) return;   // minstens één dag
        ctx.plan.dagen = nieuw.length === 5 ? null : nieuw;
        dagenGewijzigd();
      }, ['data-plan-dag', String(wd)]);
      c.title = aan ? (gek.length === 1 ? 'Minstens één dag' : naam + ' niet tonen') : naam + ' ook tonen';
      return c;
    }));
    planBox.appendChild(inst);
    // Maandkalender voor Tot datum: een dag kiezen zoekt meteen en klapt hem dicht.
    if ((ctx.plan.weergave || 'lijst') === 'lijst' && ctx.plan.totOpen) {
      const kal = el('div', { margin: '8px 0 2px', padding: '10px', borderRadius: '12px', border: '1px solid ' + T.line, background: '#fff', boxShadow: '0 10px 28px -14px rgba(32,20,15,.35)' });
      kal.setAttribute('data-plan-kalender', '');
      kal.setAttribute('role', 'dialog');
      kal.setAttribute('aria-label', 'Zoek tot en met');
      kal.appendChild(el('div', { fontSize: '12px', fontWeight: '600', color: T.inkSoft, margin: '0 2px 6px' }, 'Zoek tot en met'));
      const maand = el('div');
      maandKalender(maand, ctx.plan.tot, function (ymd) { ctx.plan.tot = ymd; ctx.plan.totOpen = false; opnieuw(); });
      kal.appendChild(maand);
      kal.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); ctx.plan.totOpen = false; renderPagina(); } });
      planBox.appendChild(kal);
    }
    const uitslag = kopieUitslag();
    // Weekraster: eigen gegevens per week, los van 'Vooruit' in de lijst.
    if (ctx.plan.weergave === 'raster') {
      if (uitslag) planBox.appendChild(uitslag);
      planBox.appendChild(planRaster());
      return planBox;
    }
    if (ctx.plan.busy && !ctx.plan.meerBezig) { zorgVoorStijl(); const lb = laadBalk(); lb.style.marginTop = '10px'; planBox.appendChild(lb); }
    if (ctx.plan.error) { planBox.appendChild(noteBox(ctx.plan.error, 'bad')); planBox.appendChild(primaryBtn('Opnieuw zoeken', function () { startPlan(); })); }
    if (uitslag) planBox.appendChild(uitslag);
    const res = metDagen(ctx.plan.result);
    if (!res && !ctx.plan.busy && !ctx.plan.error) planBox.appendChild(primaryBtn('Vrije tijd zoeken', function () { startPlan(); }));
    if (res && !(ctx.plan.busy && !res.gaps.length)) {
      if (!res.gaps.length) {
        if (feestdagenOpWerkdag(res).length) planBox.appendChild(planLijst(res));
        planBox.appendChild(noteBox('Geen vrij blok van ' + fmtMin(res.minutes) + ' gevonden ' +
          (res.to ? 't/m ' + dayLabel(res.to) : 'in de komende ' + (res.weeks === 1 ? 'week' : res.weeks + ' weken')) + '.', 'warn'));
        planBox.appendChild(meerKnop());
      } else {
        planBox.appendChild(planLijst(res));
        planBox.appendChild(meerKnop());
        if (res.onsCheck === 'unknown') planBox.appendChild(txt('help', 'Open één keer een afspraak in ONS; daarna kijkt de planhulp gekozen tijden ook na met de overlapcontrole van ONS.', { margin: '10px 0 0', fontSize: '11.5px' }));
      }
    }
    return planBox;
  }
  // Meer laden onderaan de lijst: altijd verder (een week per klik); tijdens
  // het laden een draaiende cirkel in de knop.
  function meerKnop() {
    zorgVoorStijl();
    const bezig = !!ctx.plan.meerBezig;
    const b = secondaryBtn('', function () { if (!ctx.plan.meerBezig) meerLaden(ctx.plan.result); });
    b.textContent = '';
    Object.assign(b.style, { marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' });
    if (bezig) {
      const cirkel = el('span', { width: '14px', height: '14px', borderRadius: '50%', boxSizing: 'border-box', flex: '0 0 auto',
        border: '2px solid #f0b6d6', borderTopColor: T.brand, animation: 'onsAhDraai .8s linear infinite' });
      cirkel.setAttribute('data-laadcirkel', '');
      b.appendChild(cirkel);
    }
    b.appendChild(document.createTextNode(bezig ? 'Volgende week laden…' : 'Meer laden'));
    b.setAttribute('data-plan-meer', '');
    b.setAttribute('aria-busy', bezig ? 'true' : 'false');
    b.title = 'Eén week verder zoeken';
    b.disabled = bezig;
    return b;
  }
  ctx.onsGezien = {};
  function vraagOns(date, startMin, duur, cb) {
    const k = date + '|' + startMin + '|' + duur, c = ctx.onsGezien[k];
    if (c && Date.now() - c.ts < ONS_TTL) { cb(c.overlap); return; }
    actions.onSlotCheck({ date: date, startMin: startMin, minutes: duur }, function (r) {
      const klaar = r && r.status === 'ready';
      if (klaar) ctx.onsGezien[k] = { ts: Date.now(), overlap: r.overlap };
      cb(klaar ? r.overlap : null);
    });
  }
  let onsTekenTimer = null;
  function onsTekenen() {
    if (onsTekenTimer) return;
    onsTekenTimer = setTimeout(function () { onsTekenTimer = null; if (ctx.pagina === 'plan' && (ctx.plan.weergave || 'lijst') === 'lijst') renderPagina(); }, 40);
  }
  function nakijkenBijOns(gaps, duur, status) {
    if (status !== 'ready' || !actions.onSlotCheck || !(duur > 0)) return;
    const rij = (gaps || []).slice(0, ONS_NAKIJK_MAX).filter(function (g) { return g.ons === undefined; });
    let bezig = 0;
    (function volgende() {
      while (bezig < 3 && rij.length) {
        const g = rij.shift();
        bezig++;
        (function (g) {
          vraagOns(g.date, g.startMin, duur, function (o) {
            bezig--;
            g.ons = o;
            if (o === true) onsTekenen();
            volgende();
          });
        })(g);
      }
    })();
  }
  // Een begintijd kiezen of loslaten; bij kiezen ook ONS' overlapcontrole.
  function tikMoment(date, m, duur) {
    const aan = momentIndex(date, m) < 0;
    wisselMoment(date, m);
    const mo = BEWAARD.momenten[momentIndex(date, m)];
    if (aan && mo && actions.onSlotCheck) {
      vraagOns(date, m, duur, function (o) {
        mo.ons = o;
        setTimeout(function () { if (ctx.pagina === 'plan') renderPagina(); }, 0);
      });
    }
    renderPagina();
  }
  // Kleine animatie per feestdag: één keer als de dag in beeld komt (loopt
  // door als het paneel intussen opnieuw getekend wordt), met de muis erover
  // nog eens. Bij 'minder beweging' niet.
  const feestStart = {};
  function animeerFeestdag(ic, naam, sleutel, houder) {
    if (!ic.animate) return;
    let rustig = false;
    try { rustig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    if (rustig) return;
    const a = feestdagAnimatie(naam);
    ic.style.transformOrigin = a.origin;
    ic.style.transformBox = 'fill-box';
    ic.setAttribute('data-feestdag-animatie', '');
    const speel = function (vanaf) {
      try { ic.animate(a.frames, { duration: a.duur, delay: -(vanaf || 0) + (vanaf ? 0 : 250), easing: 'ease-in-out' }); } catch (e) {}
    };
    const nu = Date.now();
    if (!feestStart[sleutel]) { feestStart[sleutel] = nu; speel(0); }
    else if (nu - feestStart[sleutel] < a.duur + 250) speel(Math.max(0, nu - feestStart[sleutel] - 250));
    if (houder) houder.addEventListener('mouseenter', function () { speel(0); });
  }
  // Feestdag in de lijst: gekleurde regel met tekening, zonder tijden.
  function feestdagRegel(h) {
    const st = feestdagStijl(h.name);
    const r = el('div', { display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px', padding: '8px 10px', margin: '14px 0 6px', background: st.achtergrond, color: st.ink });
    r.setAttribute('data-feestdag', h.date);
    r.setAttribute('data-feestdag-stijl', st.sleutel);
    const ic = feestdagIcoon(document, h.name);
    ic.setAttribute('width', '32'); ic.setAttribute('height', '32'); ic.style.flex = '0 0 auto';
    r.appendChild(ic);
    animeerFeestdag(ic, h.name, 'regel|' + h.date, r);
    const t = el('div', { minWidth: '0' });
    t.appendChild(el('div', { fontWeight: '700', fontSize: '13.5px' }, dagLang(h.date)));
    t.appendChild(el('div', { fontSize: '11.5px', opacity: '.9' }, h.name + ', geen tijden'));
    r.appendChild(t);
    return r;
  }
  // Feestdag in het weekraster: de hele kolom, met tekening en de naam.
  function feestdagKolom(h, hoog) {
    const st = feestdagStijl(h.name);
    const k = el('div', { position: 'relative', height: hoog + 'px', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: st.achtergrond, color: st.ink, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06)' });
    k.setAttribute('data-raster-dag', h.date);
    k.setAttribute('data-raster-feestdag', h.name);
    k.setAttribute('data-feestdag-stijl', st.sleutel);
    k.title = h.name;
    if (st.slinger) { const sl = feestdagSlinger(document); Object.assign(sl.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '10px' }); k.appendChild(sl); }
    const ic = feestdagIcoon(document, h.name);
    Object.assign(ic.style, { width: '78%', maxWidth: '44px', marginTop: '14px', flex: '0 0 auto', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.12))' });
    k.appendChild(ic);
    animeerFeestdag(ic, h.name, 'kolom|' + h.date + '|' + ctx.plan.rasterWeek, k);
    const nm = el('div', { writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: '800', fontSize: '13px', letterSpacing: '.3px', margin: '12px 0 12px', flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden' }, h.name);
    k.appendChild(nm);
    return k;
  }
  function planLijst(res) {
    const box = el('div');
    const duur = res.minutes, d = dagenVan(res);
    ctx.plan.open = ctx.plan.open || {};
    const feest = feestdagPer(res);
    const alleDagen = d.dagen.concat(Object.keys(feest).filter(function (k) { return !d.per[k]; })).sort();
    alleDagen.forEach(function (date) {
      if (feest[date] && !d.per[date]) { box.appendChild(feestdagRegel(feest[date])); return; }
      const gaps = d.per[date];
      const kop = el('div', { display: 'flex', alignItems: 'flex-end', gap: '8px', margin: '14px 0 6px', paddingBottom: '5px', borderBottom: '1px solid ' + T.line });
      const kopTekst = el('div', { flex: '1 1 auto', minWidth: '0' });
      kopTekst.appendChild(el('div', { fontWeight: '700', fontSize: '13.5px', color: T.ink }, dagLang(date)));
      const vrij = gaps.map(function (g) { return vanTot(g.startMin, g.endMin); });
      kopTekst.appendChild(el('div', { fontSize: '11.5px', color: T.inkSoft }, 'Vrij ' + (vrij.length > 1 ? vrij.slice(0, -1).join(', ') + ' en ' + vrij[vrij.length - 1] : vrij[0])));
      kop.appendChild(kopTekst);
      const naar = el('button', { border: '0', background: 'transparent', color: T.brand, cursor: 'pointer', font: '600 11.5px ' + FONT, padding: '0', whiteSpace: 'nowrap' }, 'Naar dag');
      naar.type = 'button'; naar.title = 'Deze dag openen in de agenda';
      naar.addEventListener('click', function () { if (actions.onJumpToDay) actions.onJumpToDay(date, true); });
      kop.appendChild(naar);
      box.appendChild(kop);
      const tijden = [];
      gaps.forEach(function (g) { for (let m = g.startMin; m + duur <= g.endMin; m += 15) tijden.push({ g: g, m: m }); });
      const alle = ctx.plan.open[date];
      // Gekozen tijden altijd tonen, ook als ze na de eerste reeks vallen.
      const zicht = tijden.filter(function (t, i) { return alle || i < TOON_TIJDEN || momentIndex(date, t.m) >= 0; });
      const rij = el('div', { display: 'flex', flexWrap: 'wrap', gap: '5px' });
      const meldingen = [];
      zicht.forEach(function (t) {
        const gek = momentIndex(date, t.m) >= 0;
        const mo = gek ? BEWAARD.momenten[momentIndex(date, t.m)] : null;
        const resIn = reserveringenIn(t.g, t.m, duur);
        const onsOverlap = (mo && mo.ons === true) || (!gek && t.m === t.g.startMin && t.g.ons === true);
        const c = chipKnop(hm(t.m), gek, function () { tikMoment(date, t.m, duur); },
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
        const meer = el('button', { border: '0', background: 'transparent', color: T.brand, cursor: 'pointer', font: '600 12px ' + FONT, padding: '4px 0 0' }, 'Nog ' + (tijden.length - zicht.length) + (tijden.length - zicht.length === 1 ? ' tijd' : ' tijden'));
        meer.type = 'button'; meer.setAttribute('data-meer-tijden', date);
        meer.addEventListener('click', function () { ctx.plan.open[date] = true; renderPagina(); });
        box.appendChild(meer);
      }
      if (meldingen.length) { const nb = noteBox('ONS meldt overlap op ' + meldingen.join(', ') + '.', 'warn'); nb.style.margin = '6px 0 0'; box.appendChild(nb); }
    });
    const metRes = res.gaps.some(function (g) { return (g.reservations || []).length; });
    if (metRes) box.appendChild(txt('help', 'R = valt in een reservering (tijd vastgehouden voor een soort werk).', { margin: '10px 0 0', fontSize: '11.5px' }));
    return box;
  }
  // Weekraster: per week de vrije tijd ophalen (ma t/m vr), zonder grens hoe
  // ver vooruit; niet terug voor de huidige week.
  function laadRaster() {
    const vandaag = ymdVan(new Date());
    const ma = ctx.plan.rasterWeek, vr = ymdVan(new Date(datumUitYmd(ma).getFullYear(), datumUitYmd(ma).getMonth(), datumUitYmd(ma).getDate() + 4));
    const rs = ctx.plan.raster = { key: ma + '|' + ctx.plan.minutes, busy: true, result: null, error: '' };
    if (vr < vandaag) { rs.busy = false; rs.result = { gaps: [] }; return; }
    actions.onFreeSlots(ctx.plan.minutes, 1, function (res) {
      if (ctx.plan.raster !== rs) return;
      rs.busy = false;
      if (res && res.ok && res.result) rs.result = res.result;
      else rs.error = (res && res.error) || 'Vrije tijd ophalen mislukt.';
      // Pas na de huidige opbouw opnieuw tekenen (een antwoord uit het geheugen
      // komt meteen; anders staat het raster er twee keer).
      setTimeout(function () { if (ctx.plan.raster === rs && ctx.pagina === 'plan' && ctx.plan.weergave === 'raster') renderPagina(); }, 0);
    }, vr, false, false, ma > vandaag ? ma : vandaag);
  }
  function planRaster() {
    const box = el('div');
    const huidigeWeek = ymdVan(maandag(ymdVan(new Date())));
    if (!ctx.plan.rasterWeek || ctx.plan.rasterWeek < huidigeWeek) ctx.plan.rasterWeek = huidigeWeek;
    let rs = ctx.plan.raster;
    if ((!rs || rs.key !== ctx.plan.rasterWeek + '|' + ctx.plan.minutes) && actions.onFreeSlots) { laadRaster(); rs = ctx.plan.raster; }
    const res = (rs && rs.result) || { gaps: [] };
    const duur = ctx.plan.minutes, d = dagenVan(res);
    const ma = datumUitYmd(ctx.plan.rasterWeek);
    const vr = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + 4);
    // Weeknavigatie: vooruit zonder maximum.
    const nav = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0 6px' });
    const pijl = function (tekst, delta, attr) {
      const verborgen = delta < 0 && ctx.plan.rasterWeek <= huidigeWeek;
      const b = el('button', { border: '0', background: 'transparent', color: T.ink, cursor: 'pointer', font: '700 16px ' + FONT, padding: '0 6px', visibility: verborgen ? 'hidden' : 'visible' }, tekst);
      b.type = 'button'; b.setAttribute(attr, '');
      b.setAttribute('aria-label', delta < 0 ? 'Vorige week' : 'Volgende week');
      b.addEventListener('click', function () {
        const m = datumUitYmd(ctx.plan.rasterWeek);
        ctx.plan.rasterWeek = ymdVan(new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7 * delta));
        renderPagina();
      });
      return b;
    };
    nav.appendChild(pijl('‹', -1, 'data-week-terug'));
    // 'Week 42' met eronder '12 tot en met 16 oktober'.
    const titel = el('div', { textAlign: 'center', flex: '1 1 auto', minWidth: '0' });
    titel.appendChild(el('div', { fontWeight: '700', fontSize: '13px', color: T.ink }, 'Week ' + isoWeek(ctx.plan.rasterWeek)));
    titel.appendChild(el('div', { fontSize: '11.5px', color: T.inkSoft }, werkweekNl(ctx.plan.rasterWeek, true)));
    titel.setAttribute('data-week-titel', '');
    nav.appendChild(titel);
    nav.appendChild(pijl('›', 1, 'data-week-verder'));
    // Vandaag: terug naar de huidige week (grijs als je daar al bent).
    const hier = ctx.plan.rasterWeek === huidigeWeek;
    const vk = el('button', { flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 9px', marginLeft: '4px', whiteSpace: 'nowrap',
      border: '1px solid ' + (hier ? T.line : T.brand), borderRadius: '8px', background: '#fff', color: hier ? '#b9b0b4' : T.brand, font: '600 12px ' + FONT, cursor: hier ? 'default' : 'pointer' });
    vk.type = 'button'; vk.disabled = hier; vk.setAttribute('data-week-vandaag', '');
    vk.title = hier ? 'Je bekijkt de week van vandaag' : 'Naar de week van vandaag';
    const kal = document.createElementNS(SVG_NS, 'svg');
    kal.setAttribute('viewBox', '0 0 16 16'); kal.setAttribute('width', '14'); kal.setAttribute('height', '14'); kal.setAttribute('aria-hidden', 'true');
    kal.setAttribute('fill', 'none'); kal.setAttribute('stroke', 'currentColor'); kal.setAttribute('stroke-width', '1.6');
    [['rect', { x: '2', y: '3', width: '12', height: '11', rx: '2' }], ['path', { d: 'M2 7h12M5 1.5v3M11 1.5v3' }], ['circle', { cx: '8', cy: '10.5', r: '1.4', fill: 'currentColor', stroke: 'none' }]].forEach(function (v) {
      const n = document.createElementNS(SVG_NS, v[0]); Object.keys(v[1]).forEach(function (k) { n.setAttribute(k, v[1][k]); }); kal.appendChild(n);
    });
    vk.appendChild(kal); vk.appendChild(document.createTextNode('Vandaag'));
    vk.addEventListener('click', function () { if (ctx.plan.rasterWeek !== huidigeWeek) { ctx.plan.rasterWeek = huidigeWeek; renderPagina(); } });
    nav.appendChild(vk);
    box.appendChild(nav);
    if (rs && rs.busy) { zorgVoorStijl(); const lb = laadBalk(); lb.style.margin = '0 0 8px'; box.appendChild(lb); }
    if (rs && rs.error) { const fb = noteBox(rs.error, 'bad'); fb.style.margin = '0 0 8px'; box.appendChild(fb); }
    // Raster: uren links, ma t/m vr. Grijs = bezet (buiten de vrije tijd), groen = vrij.
    const ws = Math.floor((res.windowStart != null ? res.windowStart : 480) / 60) * 60;
    const we = Math.ceil((res.windowEnd != null ? res.windowEnd : 1020) / 60) * 60;
    const PX = 0.75, hoog = (we - ws) * PX;
    const raster = el('div', { display: 'grid', gridTemplateColumns: '26px repeat(5, 1fr)', gap: '3px', fontSize: '11px' });
    raster.setAttribute('data-raster', '');
    raster.appendChild(el('div'));
    const feest = feestdagPer(res);
    const nuD = new Date(), vandaagYmd = ymdVan(nuD), nuMin = nuD.getHours() * 60 + nuD.getMinutes();
    ['ma', 'di', 'wo', 'do', 'vr'].forEach(function (n, i) {
      const dag = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + i);
      const fh = feest[ymdVan(dag)], fst = fh ? feestdagStijl(fh.name) : null;
      const isVandaag = ymdVan(dag) === vandaagYmd;
      const hk = el('div', { textAlign: 'center', color: isVandaag ? '#fff' : (fst ? fst.kop : T.inkSoft), fontWeight: '600', lineHeight: '1.2' }, n);
      hk.appendChild(el('div', { color: isVandaag ? '#fff' : (fst ? fst.kop : T.ink), fontWeight: '700' }, String(dag.getDate())));
      if (isVandaag) { Object.assign(hk.style, { background: T.brand, borderRadius: '6px', padding: '1px 0' }); hk.setAttribute('data-raster-vandaag', ''); hk.title = 'Vandaag'; }
      if (fst) { hk.title = fh.name; hk.appendChild(el('i', { display: 'block', width: '6px', height: '6px', borderRadius: '3px', margin: '2px auto 0', background: fst.stip })); }
      raster.appendChild(hk);
    });
    const uren = el('div', { position: 'relative', height: hoog + 'px' });
    // Uurlabel midden op de uurlijn.
    for (let u = ws; u < we; u += 60) uren.appendChild(el('span', { position: 'absolute', top: Math.max(0, (u - ws) * PX - 7) + 'px', color: T.inkSoft, fontVariantNumeric: 'tabular-nums', lineHeight: '14px' }, String(u / 60)));
    raster.appendChild(uren);
    for (let i = 0; i < 5; i++) {
      (function (i) {
        const dag = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + i);
        const date = ymdVan(dag);
        if (feest[date]) { raster.appendChild(feestdagKolom(feest[date], hoog)); return; }
        const kol = el('div', { position: 'relative', height: hoog + 'px', borderRadius: '6px', background: '#ece7e5' });
        kol.setAttribute('data-raster-dag', date);
        (d.per[date] || []).forEach(function (g) {
          const vrij = el('div', { position: 'absolute', left: '2px', right: '2px', top: ((g.startMin - ws) * PX) + 'px', height: ((g.endMin - g.startMin) * PX) + 'px',
            background: '#e6f4ec', border: '1px dashed #7cc19c', borderRadius: '5px', boxSizing: 'border-box' });
          vrij.setAttribute('data-raster-vrij', hm(g.startMin) + '-' + hm(g.endMin));
          (g.reservations || []).forEach(function (r) {
            const a = Math.max(r.startMin, g.startMin), b = Math.min(r.endMin, g.endMin);
            if (b <= a) return;
            const rb = el('div', { position: 'absolute', left: '0', right: '0', top: ((a - g.startMin) * PX) + 'px', height: ((b - a) * PX) + 'px', background: '#fdf3e2', color: '#8a5a00', fontSize: '9px', fontWeight: '800', padding: '1px 3px', boxSizing: 'border-box', pointerEvents: 'none' }, 'R');
            rb.title = 'Reservering: ' + reserveringTekst([r]);
            vrij.appendChild(rb);
          });
          // Elke mogelijke begintijd is een strookje van een kwartier: tik = kiezen.
          for (let m = g.startMin; m + duur <= g.endMin; m += 15) {
            (function (m) {
              const s = el('button', { position: 'absolute', left: '0', right: '0', top: ((m - g.startMin) * PX) + 'px', height: (15 * PX) + 'px', border: '0', padding: '0', background: 'transparent', cursor: 'pointer' });
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
          const b = el('button', { position: 'absolute', left: '2px', right: '2px', top: ((mo.startMin - ws) * PX) + 'px', height: (duur * PX) + 'px', border: '0', borderRadius: '5px',
            background: mo.ons === true ? T.warn : T.brand, color: '#fff', font: '700 10px ' + FONT, textAlign: 'left', padding: '2px 4px', cursor: 'pointer', zIndex: '2' }, hm(mo.startMin) + ' ✓');
          b.type = 'button'; b.setAttribute('data-raster-gekozen', date + ' ' + hm(mo.startMin));
          b.title = mo.ons === true ? 'ONS meldt overlap; tik om los te laten' : 'Gekozen; tik om los te laten';
          b.addEventListener('click', function () { tikMoment(date, mo.startMin, duur); });
          kol.appendChild(b);
        });
        // Vandaag: wat voorbij is gestreept, met een stip en lijn op nu.
        if (date === vandaagYmd && nuMin > ws) {
          const voorbij = el('div', { position: 'absolute', left: '0', right: '0', top: '0', height: ((Math.min(nuMin, we) - ws) * PX) + 'px', borderRadius: '6px 6px 0 0', pointerEvents: 'none', zIndex: '1',
            background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.55) 0 4px, transparent 4px 8px)' });
          voorbij.setAttribute('data-raster-voorbij', '');
          kol.appendChild(voorbij);
          if (nuMin < we) {
            const nuLijn = el('div', { position: 'absolute', left: '-2px', right: '0', top: ((nuMin - ws) * PX - 1) + 'px', height: '2px', background: T.brand, pointerEvents: 'none', zIndex: '3' });
            nuLijn.appendChild(el('i', { position: 'absolute', left: '-3px', top: '-3px', width: '8px', height: '8px', borderRadius: '4px', background: T.brand }));
            nuLijn.setAttribute('data-raster-nu', hm(nuMin)); nuLijn.title = 'Nu ' + hm(nuMin);
            kol.appendChild(nuLijn);
          }
        }
        for (let uu = ws + 60; uu < we; uu += 60) kol.appendChild(el('div', { position: 'absolute', left: '0', right: '0', top: ((uu - ws) * PX) + 'px', height: '1px', background: 'rgba(32,29,31,.16)', pointerEvents: 'none', zIndex: '1' }));
        // Geen vrije tijd: 'Bezet' (of 'Voorbij' voor eerdere dagen); niet tijdens het laden.
        if (!(d.per[date] || []).length && !(rs && rs.busy)) kol.appendChild(el('div', { position: 'absolute', top: '4px', left: '0', right: '0', textAlign: 'center', color: T.inkSoft, fontSize: '10px' }, date < ymdVan(new Date()) ? 'Voorbij' : 'Bezet'));
        raster.appendChild(kol);
      })(i);
    }
    box.appendChild(raster);
    const leg = el('div', { display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: T.inkSoft, marginTop: '8px' });
    const legenda = [['#ece7e5', 'Bezet'], ['#e6f4ec', 'Vrij'], ['#fdf3e2', 'Reservering'], [T.brand, 'Gekozen']];
    if (Object.keys(feest).length) legenda.push(['linear-gradient(135deg,#ff9a33,#cfe8fd,#24684a)', 'Feestdag']);
    legenda.forEach(function (l) {
      const s = el('span'); s.appendChild(el('i', { display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: l[0], marginRight: '4px', verticalAlign: '-1px' })); s.appendChild(document.createTextNode(l[1])); leg.appendChild(s);
    });
    box.appendChild(leg);
    box.appendChild(txt('help', 'Tik in het groen op de begintijd; de afspraak duurt ' + fmtMin(duur) + '.', { margin: '6px 0 0', fontSize: '11.5px' }));
    return box;
  }

  return { agendaMeldingBlok, agendasGewijzigd, momentenBalk, pagePlan, startPlan, wisselMoment };
}
