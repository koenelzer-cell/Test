// Planhulp: vrije tijd zoeken (lijst per dag of weekplanning), Meer laden,
// momenten kiezen (balk onderin) en de eerste blokken bij ONS' eigen
// overlapcontrole nakijken nadat de lijst er staat.

import { useLayoutEffect, useRef } from 'react';
import { BEWAARD, momentIndex } from './bewaard.js';
import { AgendaPil, ChipKnop, FONT, FoutStrook, GeluktBalk, ICON_KALENDER, Icoon, KaleKnop, KleineKnop, LaadBalk, LegeStaat, MeldKaart, PrimaryBtn, Regel, SecondaryBtn, T, Txt, Wissel, dagLang, datumUitYmd, dayLabel, fmtMin, hm, isoWeek, opsomming, useHover, vanTot, ymdVan } from './ui.jsx';
import { feestdagAnimatie, feestdagIcoonSvg, feestdagSlingerSvg, feestdagStijl } from './feestdagen.js';
import { MaandKalender } from './kiezers.jsx';
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
function KopieUitslag() {
  const k = BEWAARD.kopie;
  if (!k) return null;
  const lbl = function (m) { return dayLabel(m.date) + ' ' + hm(m.startMin); };
  if (k.reason) return <Regel toon="let" tekst={'Geen kopieën gemaakt: ' + (k.reason === 'herhalende afspraak' ? 'het is een herhalende afspraak.' : 'de afspraak was niet te lezen.')} />;
  if (k.failed && k.failed.length) return <FoutStrook tekst={(k.made || []).length + ' kopieën gemaakt. Niet gelukt: ' + opsomming(k.failed.map(lbl)) + '. Maak die zelf aan in ONS.'} />;
  const verder = k.next ? ' Nu het formulier voor ' + lbl(k.next) + (k.left > 1 ? ' (nog ' + k.left + ' met eigen instellingen).' : ' (eigen instellingen).') : '';
  if (k.made && k.made.length) return <GeluktBalk tekst={'Afspraak ook gemaakt op ' + opsomming(k.made.map(lbl)) + '.' + verder} />;
  if (verder) return <GeluktBalk tekst={'Afspraak opgeslagen.' + verder} />;
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

/* ── Feestdagen ── */

// Kleine animatie per feestdag: één keer als de dag in beeld komt (loopt door
// als het paneel intussen opnieuw getekend wordt), met de muis erover nog
// eens. Bij 'minder beweging' niet. start: wanneer elke animatie begon.
function kanAnimeren() {
  if (typeof document === 'undefined' || typeof document.documentElement.animate !== 'function') return false;
  try { return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return true; }
}
function useFeestAnimatie(start, naam, sleutel) {
  const ref = useRef(null);
  const a = feestdagAnimatie(naam);
  const speel = function (vanaf) {
    const ic = ref.current;
    if (!ic || !ic.animate) return;
    try { ic.animate(a.frames, { duration: a.duur, delay: -(vanaf || 0) + (vanaf ? 0 : 250), easing: 'ease-in-out' }); } catch (e) {}
  };
  useLayoutEffect(function () {
    if (!kanAnimeren()) return;
    const nu = Date.now();
    if (!start[sleutel]) { start[sleutel] = nu; speel(0); }
    else if (nu - start[sleutel] < a.duur + 250) speel(Math.max(0, nu - start[sleutel] - 250));
  }, [sleutel]);   // alleen bij een nieuwe dag (sleutel), niet bij elke keer tekenen
  const aan = kanAnimeren();
  return {
    ref: ref,
    // Op de tekening: draaipunt en kenmerk, alleen als hij beweegt.
    stijl: aan ? { transformOrigin: a.origin, transformBox: 'fill-box' } : null,
    attr: aan ? { 'data-feestdag-animatie': '' } : null,
    opnieuw: aan ? function () { speel(0); } : undefined
  };
}
// De tekening van een feestdag: vaste SVG uit feestdagen.js (geen ONS-gegevens).
function FeestIcoon({ naam, anim, style, ...rest }) {
  return (
    <svg ref={anim.ref} viewBox="0 0 48 48" aria-hidden="true" style={Object.assign({}, style, anim.stijl)} {...anim.attr} {...rest}
      dangerouslySetInnerHTML={{ __html: feestdagIcoonSvg(naam) }} />
  );
}
// Feestdag in de lijst: gekleurde regel met tekening, zonder tijden.
function FeestdagRegel({ h, start }) {
  const st = feestdagStijl(h.name);
  const anim = useFeestAnimatie(start, h.name, 'regel|' + h.date);
  return (
    <div data-feestdag={h.date} data-feestdag-stijl={st.sleutel} onMouseEnter={anim.opnieuw}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px', padding: '8px 10px', margin: '14px 0 6px', background: st.achtergrond, color: st.ink }}>
      <FeestIcoon naam={h.name} anim={anim} width="32" height="32" style={{ flex: '0 0 auto' }} />
      <div style={{ minWidth: '0' }}>
        <div style={{ fontWeight: '700', fontSize: '13.5px' }}>{dagLang(h.date)}</div>
        <div style={{ fontSize: '11.5px', opacity: '.9' }}>{h.name + ', geen tijden'}</div>
      </div>
    </div>
  );
}
// Feestdag in het weekraster: de hele kolom, met tekening en de naam.
function FeestdagKolom({ h, hoog, start, week }) {
  const st = feestdagStijl(h.name);
  const anim = useFeestAnimatie(start, h.name, 'kolom|' + h.date + '|' + week);
  return (
    <div data-raster-dag={h.date} data-raster-feestdag={h.name} data-feestdag-stijl={st.sleutel} title={h.name} onMouseEnter={anim.opnieuw}
      style={{ position: 'relative', height: hoog + 'px', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: st.achtergrond, color: st.ink, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06)' }}>
      {st.slinger ? (
        <svg viewBox="0 0 60 10" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '10px' }}
          dangerouslySetInnerHTML={{ __html: feestdagSlingerSvg() }} />
      ) : null}
      <FeestIcoon naam={h.name} anim={anim} style={{ width: '78%', maxWidth: '44px', marginTop: '14px', flex: '0 0 auto', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.12))' }} />
      <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: '800', fontSize: '13px', letterSpacing: '.3px', margin: '12px 0 12px', flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden' }}>{h.name}</div>
    </div>
  );
}

/* ── Kleine bouwstenen ── */

// Een begintijd in het weekraster: een strookje van een kwartier.
function RasterStrook({ date, m, duur, top, onKies }) {
  const [over, hover] = useHover();
  return (
    <button type="button" {...hover} title={hm(m) + ' tot ' + hm(m + duur) + ' kiezen'} aria-label={dayLabel(date) + ' ' + hm(m) + ' kiezen'} data-dag={date} data-start={hm(m)}
      onClick={onKies}
      style={{ position: 'absolute', left: '0', right: '0', top: top + 'px', height: (15 * 0.75) + 'px', border: '0', padding: '0', background: over ? 'rgba(204,8,125,.18)' : 'transparent', cursor: 'pointer' }} />
  );
}

export function maakPlanhulp(ctx) {
  const { actions, fAan, naarPagina, renderPagina } = ctx;
  ctx.feestStart = {};

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
    balkFout = '';
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
  let balkFout = '';
  function momentenBalk() {
    const n = BEWAARD.momenten.length;
    const aantalEigen = BEWAARD.momenten.filter(function (m) { return m.eigen; }).length;
    const direct = ctx.kanDirect();
    const titel = direct ? 'Kies cliënt(en), afspraaktype en uursoort; de hulp maakt ' + (n > 1 ? 'de afspraken' : 'de afspraak') + ' meteen in ONS.'
      : n > 1 ? 'Je maakt de afspraak één keer in ONS; na het opslaan maakt de hulp hem ook op de andere momenten' +
        (aantalEigen ? ', en opent hij voor ' + aantalEigen + (aantalEigen === 1 ? ' moment' : ' momenten') + ' met andere instellingen een nieuw formulier.' : '.') : 'Opent een nieuwe afspraak in ONS met datum en begintijd ingevuld.';
    return (
      <div data-selectie={String(n)} style={{ background: '#fff', padding: '10px 12px 12px', borderTop: '1px solid ' + T.line, boxShadow: '0 -10px 24px -18px rgba(32,20,15,.35)' }}>
        {BEWAARD.balkOpen ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', margin: '0 0 6px' }}>
              {BEWAARD.momenten.map(function (m, i) {
                // Het eerste moment is het formulier zelf: geen vinkje.
                const vink = i === 0 || direct;
                return (
                  <div key={m.date + '|' + m.startMin} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: T.ink, minHeight: '30px', borderBottom: '1px solid ' + T.lineSoft }}>
                    <span style={{ flex: '0 0 74px', fontWeight: '600' }}>{dayLabel(m.date)}</span>
                    <span style={{ flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{hm(m.startMin) + ' tot ' + hm(m.startMin + ctx.plan.minutes)}</span>
                    {vink ? <span style={{ flex: '1 1 auto' }} /> : (
                      // Vinkje 'Apart formulier': dit moment krijgt geen kopie maar een eigen
                      // afspraakformulier, waarin de afspraakhulp opnieuw wordt doorlopen.
                      <label title="Aangevinkt: na het opslaan opent een nieuw afspraakformulier voor dit moment, zodat je andere instellingen kiest. Niet aangevinkt: een kopie van de eerste afspraak."
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: T.inkSoft, cursor: 'pointer', userSelect: 'none', flex: '1 1 auto', justifyContent: 'flex-end' }}>
                        <input type="checkbox" checked={!!m.eigen} data-eigen={m.date + ' ' + hm(m.startMin)} style={{ accentColor: T.brand, margin: '0' }}
                          onChange={function (e) { m.eigen = e.target.checked; BEWAARD.kopie = null; renderPagina(); }} />
                        Apart formulier
                      </label>
                    )}
                    <button type="button" title="Uit selectie halen" aria-label={'Uit selectie halen: ' + dayLabel(m.date) + ' ' + hm(m.startMin)}
                      onClick={function () { wisselMoment(m.date, m.startMin); if (!BEWAARD.momenten.length) BEWAARD.balkOpen = false; renderPagina(); }}
                      style={{ border: '0', background: 'transparent', color: T.inkSoft, cursor: 'pointer', fontSize: '16px', lineHeight: '1', padding: '2px 6px', borderRadius: '6px' }}>{'×'}</button>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={function () { BEWAARD.momenten = []; BEWAARD.balkOpen = false; BEWAARD.kopie = null; renderPagina(); }}
              style={{ display: 'block', margin: '0 0 8px auto', border: '0', background: 'transparent', color: T.inkSoft, cursor: 'pointer', font: '400 12px ' + FONT, textDecoration: 'underline', padding: '2px 0' }}>Alles wissen</button>
          </>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button type="button" aria-expanded={BEWAARD.balkOpen ? 'true' : 'false'} data-teller="" title={BEWAARD.balkOpen ? 'Lijst inklappen' : 'Gekozen momenten bekijken'}
            onClick={function () { BEWAARD.balkOpen = !BEWAARD.balkOpen; renderPagina(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '0', background: 'transparent', cursor: 'pointer', padding: '0', font: '700 13px ' + FONT, color: T.ink, whiteSpace: 'nowrap' }}>
            {n === 1 ? '1 moment' : n + ' momenten'}
            <span style={{ color: T.brand, fontSize: '11px' }}>{BEWAARD.balkOpen ? '▼' : '▲'}</span>
          </button>
          <PrimaryBtn tekst={n > 1 ? 'Afspraak maken op ' + n + ' momenten' : 'Afspraak maken'} title={titel} style={{ marginTop: '0', flex: '1 1 auto', width: 'auto' }}
            onClick={function () {
              // Meteen in ONS maken: cliënt(en), type en uursoort kies je op de volgende pagina.
              if (ctx.kanDirect()) { ctx.naarMaken(BEWAARD.momenten, ctx.plan.minutes); return; }
              maakOpMomenten(function (f) { balkFout = f; renderPagina(); });
            }} />
        </div>
        <div>{balkFout ? <FoutStrook tekst={balkFout} /> : null}</div>
      </div>
    );
  }

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
    const wat = m.meer ? 'Er is een agenda bijgekomen' : m.minder ? 'Er is een agenda gesloten' : 'Er staan andere agenda’s open';
    const nu = m.aantal === 1 ? 'Nu staat er 1 open.' : 'Nu staan er ' + m.aantal + ' open.';
    return (
      <MeldKaart data-agenda-melding="" titel={wat} tekst={'Je momenten zijn gezocht met de vorige agenda’s. ' + nu}>
        <KleineKnop hoofd tekst="Opnieuw beginnen" data-agenda-opnieuw=""
          onClick={function () {
            BEWAARD.momenten = []; BEWAARD.balkOpen = false; BEWAARD.maak = null; BEWAARD.agendaMelding = null;
            ctx.plan.result = null; ctx.plan.error = ''; ctx.plan.raster = null;
            naarPagina('plan');
          }} />
        <KleineKnop tekst="Negeren" data-agenda-negeren="" onClick={function () { BEWAARD.agendaMelding = null; renderPagina(); }} />
      </MeldKaart>
    );
  }

  // Planhulp: bovenaan Lijst of Weekraster en de instellingen (duur en
  // vooruit). Lijst: per dag de begintijden, meteen te kiezen.
  // Weekraster: mini-agenda per week; tik in de vrije tijd. Gekozen momenten
  // staan in de balk onderin.
  function pagePlan() {
    const meer = (ctx.state && ctx.state.inviteeCount > 1) ? ctx.state.inviteeCount : 0;
    const lijst = (ctx.plan.weergave || 'lijst') === 'lijst';
    // Instellingen als compacte tabel: per regel een label links en de keuzes
    // even breed op één regel, met korte teksten (30m, 1u, 2 wk) en Tot datum
    // als kalendertje. Voluit staat in aria-label en title. Gekozen is roze,
    // ook bij de dagen. Een wijziging zoekt meteen opnieuw.
    const opnieuw = function () { ctx.plan.result = null; ctx.plan.limit = PLAN_STAP; startPlan(); };
    const rijen = [];
    const instRij = function (label, keuzes) {
      rijen.push(
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '46px', borderTop: rijen.length ? '1px solid ' + T.line : '0' }}>
          <span style={{ flex: '0 0 52px', fontSize: '12px', fontWeight: '600', color: T.inkSoft }}>{label}</span>
          <div style={{ display: 'flex', gap: '5px', flex: '1 1 auto', minWidth: '0' }}>{keuzes}</div>
        </div>
      );
    };
    const keuze = function (sleutel, tekst, voluit, aan, fn, attr, extra, props) {
      return (
        <ChipKnop key={sleutel} tekst={tekst} gekozen={aan} onClick={fn} {...{ [attr[0]]: attr[1] }} aria-pressed={aan ? 'true' : 'false'} aria-label={voluit} title={voluit}
          extra={Object.assign({ flex: '1 1 0', minWidth: '0', height: '30px', fontSize: '12.5px', border: '1px solid ' + (aan ? T.brand : T.line) }, extra)} {...props} />
      );
    };
    instRij('Duur', [[30, '30m', '30 minuten'], [45, '45m', '45 minuten'], [60, '1u', '1 uur'], [90, '1,5u', '1,5 uur'], [120, '2u', '2 uur']].map(function (d) {
      return keuze(d[0], d[1], d[2], ctx.plan.minutes === d[0], function () { ctx.plan.minutes = d[0]; opnieuw(); }, ['data-plan-duur', String(d[0])]);
    }));
    if (lijst) {
      const per = [[1, '1 wk', '1 week'], [2, '2 wk', '2 weken'], [4, '4 wk', '4 weken']].map(function (w) {
        return keuze(w[0], w[1], w[2], !ctx.plan.tot && !ctx.plan.totOpen && ctx.plan.weeks === w[0], function () { ctx.plan.weeks = w[0]; ctx.plan.tot = ''; ctx.plan.totOpen = false; opnieuw(); }, ['data-plan-weken', String(w[0])]);
      });
      // Tot datum: een kalendertje; met een gekozen datum staat die er kort
      // naast. Een tik klapt de maandkalender onder de tabel open of dicht;
      // terug naar weken = een tik op 1, 2 of 4 wk (geen aparte Wissen-knop).
      const totDag = ctx.plan.tot ? dagLang(ctx.plan.tot, true).replace(/^\S+ /, '') : '';
      per.push(keuze('tot', totDag.replace(/^(\d+ \S{3})\S*$/, '$1'), ctx.plan.tot ? 'Tot en met ' + totDag : 'Tot een datum', !!(ctx.plan.tot || ctx.plan.totOpen),
        function () { ctx.plan.totOpen = !ctx.plan.totOpen; renderPagina(); }, ['data-plan-tot', ''],
        Object.assign({ flex: '0 0 auto', minWidth: '34px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }, ctx.plan.totOpen ? { boxShadow: '0 0 0 3px ' + T.brandWash } : null),
        { 'aria-haspopup': 'dialog', 'aria-expanded': ctx.plan.totOpen ? 'true' : 'false', children: <Icoon d={ICON_KALENDER} size={15} /> }));
      instRij('Vooruit', per);
      // Optioneel, alleen in de lijst: vrije tijd op bepaalde dagen (standaard
      // alle dagen aan). De weekplanning toont altijd de hele week.
      const gek = gekozenDagen() || [1, 2, 3, 4, 5];
      instRij('Dagen', ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag'].map(function (naam, i) {
        const wd = i + 1, aan = gek.indexOf(wd) >= 0;
        return keuze(wd, naam.slice(0, 2), naam, aan, function () {
          const nieuw = aan ? gek.filter(function (x) { return x !== wd; }) : gek.concat([wd]).sort();
          if (!nieuw.length) return;   // minstens één dag
          ctx.plan.dagen = nieuw.length === 5 ? null : nieuw;
          dagenGewijzigd();
        }, ['data-plan-dag', String(wd)], null, { title: aan ? (gek.length === 1 ? 'Minstens één dag' : naam + ' niet tonen') : naam + ' ook tonen' });
      }));
    }
    const res = lijst ? metDagen(ctx.plan.result) : null;
    return (
      <div>
        {agendaMeldingBlok()}
        {meer ? <AgendaPil data-agendas={String(meer)} aantal={meer} tekst="tijd waarop iedereen vrij is" /> : null}
        <Wissel opties={[['lijst', 'Lijst'], ['raster', 'Weekplanning']]} gekozen={ctx.plan.weergave || 'lijst'} attr="data-plan-weergave"
          onKies={function (w) { ctx.plan.weergave = w; renderPagina(); }} />
        <div data-plan-instellingen="" style={{ border: '1px solid ' + T.line, borderRadius: '12px', padding: '0 12px' }}>{rijen}</div>
        {/* Maandkalender voor Tot datum: een dag kiezen zoekt meteen en klapt hem dicht. */}
        {lijst && ctx.plan.totOpen ? (
          <div data-plan-kalender="" role="dialog" aria-label="Zoek tot en met"
            onKeyDown={function (e) { if (e.key === 'Escape') { e.preventDefault(); ctx.plan.totOpen = false; renderPagina(); } }}
            style={{ margin: '8px 0 2px', padding: '10px', borderRadius: '12px', border: '1px solid ' + T.line, background: '#fff', boxShadow: '0 10px 28px -14px rgba(32,20,15,.35)' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: T.inkSoft, margin: '0 2px 6px' }}>Zoek tot en met</div>
            <MaandKalender huidig={ctx.plan.tot} kies={function (ymd) { ctx.plan.tot = ymd; ctx.plan.totOpen = false; opnieuw(); }} />
          </div>
        ) : null}
        {/* Weekraster: eigen gegevens per week, los van 'Vooruit' in de lijst. */}
        {!lijst ? <KopieUitslag /> : null}
        {!lijst ? planRaster() : null}
        {lijst && ctx.plan.busy && !ctx.plan.meerBezig ? <LaadBalk style={{ marginTop: '10px' }} /> : null}
        {lijst && ctx.plan.error ? <FoutStrook tekst={ctx.plan.error} knop="Opnieuw" onKnop={function () { startPlan(); }} /> : null}
        {lijst ? <KopieUitslag /> : null}
        {lijst && !res && !ctx.plan.busy && !ctx.plan.error ? <PrimaryBtn tekst="Vrije tijd zoeken" onClick={function () { startPlan(); }} /> : null}
        {lijst && res && !(ctx.plan.busy && !res.gaps.length) ? (
          !res.gaps.length ? (
            <>
              {feestdagenOpWerkdag(res).length ? planLijst(res) : null}
              <LegeStaat icoon={ICON_KALENDER} data-geen-vrij="" titel={'Geen vrije tijd ' + (res.to ? 'tot en met ' + dayLabel(res.to) : 'in de komende ' + (res.weeks === 1 ? 'week' : res.weeks + ' weken'))}
                tekst={'Er is geen blok van ' + fmtMin(res.minutes) + ' vrij. Laad een week meer of kies een kortere duur.'} />
              {meerKnop()}
            </>
          ) : (
            <>
              {planLijst(res)}
              {meerKnop()}
              {res.onsCheck === 'unknown' ? <Txt kind="help" style={{ margin: '10px 0 0', fontSize: '11.5px' }}>Open één keer een afspraak in ONS; daarna kijkt de planhulp gekozen tijden ook na met de overlapcontrole van ONS.</Txt> : null}
            </>
          )
        ) : null}
      </div>
    );
  }
  // Meer laden onderaan de lijst: altijd verder (een week per klik); tijdens
  // het laden een draaiende cirkel in de knop.
  function meerKnop() {
    const bezig = !!ctx.plan.meerBezig;
    return (
      <SecondaryBtn data-plan-meer="" aria-busy={bezig ? 'true' : 'false'} title="Eén week verder zoeken" disabled={bezig}
        onClick={function () { if (!ctx.plan.meerBezig) meerLaden(ctx.plan.result); }}
        style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {bezig ? <span data-laadcirkel="" style={{ width: '14px', height: '14px', borderRadius: '50%', boxSizing: 'border-box', flex: '0 0 auto', border: '2px solid #f0b6d6', borderTopColor: T.brand, animation: 'onsAhDraai .8s linear infinite' }} /> : null}
        {bezig ? 'Volgende week laden…' : 'Meer laden'}
      </SecondaryBtn>
    );
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
        vraagOns(g.date, g.startMin, duur, function (o) {
          bezig--;
          g.ons = o;
          if (o === true) onsTekenen();
          volgende();
        });
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
  function planLijst(res) {
    const duur = res.minutes, d = dagenVan(res);
    ctx.plan.open = ctx.plan.open || {};
    const feest = feestdagPer(res);
    const alleDagen = d.dagen.concat(Object.keys(feest).filter(function (k) { return !d.per[k]; })).sort();
    const metRes = res.gaps.some(function (g) { return (g.reservations || []).length; });
    return (
      <div>
        {alleDagen.map(function (date) {
          if (feest[date] && !d.per[date]) return <FeestdagRegel key={date} h={feest[date]} start={ctx.feestStart} />;
          const gaps = d.per[date];
          const vrij = gaps.map(function (g) { return vanTot(g.startMin, g.endMin); });
          const tijden = [];
          gaps.forEach(function (g) { for (let m = g.startMin; m + duur <= g.endMin; m += 15) tijden.push({ g: g, m: m }); });
          const alle = ctx.plan.open[date];
          // Gekozen tijden altijd tonen, ook als ze na de eerste reeks vallen.
          const zicht = tijden.filter(function (t, i) { return alle || i < TOON_TIJDEN || momentIndex(date, t.m) >= 0; });
          const meldingen = [];
          const chips = zicht.map(function (t) {
            const gek = momentIndex(date, t.m) >= 0;
            const mo = gek ? BEWAARD.momenten[momentIndex(date, t.m)] : null;
            const resIn = reserveringenIn(t.g, t.m, duur);
            const onsOverlap = (mo && mo.ons === true) || (!gek && t.m === t.g.startMin && t.g.ons === true);
            if (onsOverlap && gek) meldingen.push(hm(t.m));
            const titel = onsOverlap ? 'ONS meldt overlap op dit tijdstip' : resIn.length ? 'Valt in reservering: ' + reserveringTekst(resIn) : undefined;
            return (
              <ChipKnop key={t.m} gekozen={gek} onClick={function () { tikMoment(date, t.m, duur); }} title={titel}
                data-reservering={resIn.length ? (resIn[0].label || '') : undefined} data-ons-overlap={onsOverlap ? '' : undefined}
                data-dag={date} data-start={hm(t.m)} aria-pressed={gek ? 'true' : 'false'}
                extra={{ minWidth: '54px', padding: '0 8px', height: '30px', border: '1px ' + (resIn.length && !gek ? 'dashed ' : 'solid ') + (gek ? T.brand : (onsOverlap ? T.warn : T.line)) }}>
                {hm(t.m)}
                {resIn.length ? <small style={{ fontSize: '9px', fontWeight: '800', marginLeft: '2px', color: gek ? '#fff' : T.warn, verticalAlign: 'super' }}>R</small> : null}
              </ChipKnop>
            );
          });
          return (
            <div key={date}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', margin: '14px 0 6px', paddingBottom: '5px', borderBottom: '1px solid ' + T.line }}>
                <div style={{ flex: '1 1 auto', minWidth: '0' }}>
                  <div style={{ fontWeight: '700', fontSize: '13.5px', color: T.ink }}>{dagLang(date)}</div>
                  <div style={{ fontSize: '11.5px', color: T.inkSoft }}>{'Vrij ' + (vrij.length > 1 ? vrij.slice(0, -1).join(', ') + ' en ' + vrij[vrij.length - 1] : vrij[0])}</div>
                </div>
                <button type="button" title="Deze dag openen in de agenda" onClick={function () { if (actions.onJumpToDay) actions.onJumpToDay(date, true); }}
                  style={{ border: '0', background: 'transparent', color: T.brand, cursor: 'pointer', font: '600 11.5px ' + FONT, padding: '0', whiteSpace: 'nowrap' }}>Naar dag</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>{chips}</div>
              {tijden.length > zicht.length ? (
                <button type="button" data-meer-tijden={date} onClick={function () { ctx.plan.open[date] = true; renderPagina(); }}
                  style={{ border: '0', background: 'transparent', color: T.brand, cursor: 'pointer', font: '600 12px ' + FONT, padding: '4px 0 0' }}>
                  {'Nog ' + (tijden.length - zicht.length) + (tijden.length - zicht.length === 1 ? ' tijd' : ' tijden')}
                </button>
              ) : null}
              {meldingen.length ? <Regel toon="let" data-ons-melding="" tekst={'ONS ziet om ' + opsomming(meldingen) + ' al een afspraak.'} /> : null}
            </div>
          );
        })}
        {metRes ? <Txt kind="help" style={{ margin: '10px 0 0', fontSize: '11.5px' }}>R = valt in een reservering (tijd vastgehouden voor een soort werk).</Txt> : null}
      </div>
    );
  }
  // Weekraster: per week de vrije tijd ophalen (ma t/m vr), zonder grens hoe
  // ver vooruit; niet terug voor de huidige week. Vóór het tekenen (zie
  // voorbereiden in agenda-panel.jsx).
  function zorgVoorRaster() {
    const huidigeWeek = ymdVan(maandag(ymdVan(new Date())));
    if (!ctx.plan.rasterWeek || ctx.plan.rasterWeek < huidigeWeek) ctx.plan.rasterWeek = huidigeWeek;
    const rs = ctx.plan.raster;
    if ((!rs || rs.key !== ctx.plan.rasterWeek + '|' + ctx.plan.minutes) && actions.onFreeSlots) laadRaster();
  }
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
      // Een antwoord uit het geheugen komt meteen (tijdens het voorbereiden);
      // renderPagina tekent dan na de huidige opbouw nog een keer.
      if (ctx.pagina === 'plan' && ctx.plan.weergave === 'raster') renderPagina();
    }, vr, false, false, ma > vandaag ? ma : vandaag);
  }
  function planRaster() {
    const huidigeWeek = ymdVan(maandag(ymdVan(new Date())));
    const rs = ctx.plan.raster;
    const res = (rs && rs.result) || { gaps: [] };
    const duur = ctx.plan.minutes, d = dagenVan(res);
    const ma = datumUitYmd(ctx.plan.rasterWeek);
    const naarWeek = function (delta) {
      const m = datumUitYmd(ctx.plan.rasterWeek);
      ctx.plan.rasterWeek = ymdVan(new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7 * delta));
      renderPagina();
    };
    // Weeknavigatie: vooruit zonder maximum.
    const pijl = function (tekst, delta, attr) {
      const verborgen = delta < 0 && ctx.plan.rasterWeek <= huidigeWeek;
      return (
        <button type="button" {...{ [attr]: '' }} aria-label={delta < 0 ? 'Vorige week' : 'Volgende week'} onClick={function () { naarWeek(delta); }}
          style={{ border: '0', background: 'transparent', color: T.ink, cursor: 'pointer', font: '700 16px ' + FONT, padding: '0 6px', visibility: verborgen ? 'hidden' : 'visible' }}>{tekst}</button>
      );
    };
    // Vandaag: terug naar de huidige week (grijs als je daar al bent).
    const hier = ctx.plan.rasterWeek === huidigeWeek;
    // Raster: uren links, ma t/m vr. Grijs = bezet (buiten de vrije tijd), groen = vrij.
    const ws = Math.floor((res.windowStart != null ? res.windowStart : 480) / 60) * 60;
    const we = Math.ceil((res.windowEnd != null ? res.windowEnd : 1020) / 60) * 60;
    const PX = 0.75, hoog = (we - ws) * PX;
    const feest = feestdagPer(res);
    const nuD = new Date(), vandaagYmd = ymdVan(nuD), nuMin = nuD.getHours() * 60 + nuD.getMinutes();
    const uurLabels = [];
    // Uurlabel midden op de uurlijn.
    for (let u = ws; u < we; u += 60) uurLabels.push(<span key={u} style={{ position: 'absolute', top: Math.max(0, (u - ws) * PX - 7) + 'px', color: T.inkSoft, fontVariantNumeric: 'tabular-nums', lineHeight: '14px' }}>{String(u / 60)}</span>);
    const kolommen = [];
    for (let i = 0; i < 5; i++) {
      const dag = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + i);
      const date = ymdVan(dag);
      if (feest[date]) { kolommen.push(<FeestdagKolom key={date} h={feest[date]} hoog={hoog} start={ctx.feestStart} week={ctx.plan.rasterWeek} />); continue; }
      const lijnen = [];
      for (let uu = ws + 60; uu < we; uu += 60) lijnen.push(<div key={'u' + uu} style={{ position: 'absolute', left: '0', right: '0', top: ((uu - ws) * PX) + 'px', height: '1px', background: 'rgba(32,29,31,.16)', pointerEvents: 'none', zIndex: '1' }} />);
      kolommen.push(
        <div key={date} data-raster-dag={date} style={{ position: 'relative', height: hoog + 'px', borderRadius: '6px', background: '#ece7e5' }}>
          {(d.per[date] || []).map(function (g) {
            const stroken = [];
            // Elke mogelijke begintijd is een strookje van een kwartier: tik = kiezen.
            for (let m = g.startMin; m + duur <= g.endMin; m += 15) {
              stroken.push(<RasterStrook key={m} date={date} m={m} duur={duur} top={(m - g.startMin) * PX} onKies={function () { tikMoment(date, m, duur); }} />);
            }
            return (
              <div key={g.startMin} data-raster-vrij={hm(g.startMin) + '-' + hm(g.endMin)}
                style={{ position: 'absolute', left: '2px', right: '2px', top: ((g.startMin - ws) * PX) + 'px', height: ((g.endMin - g.startMin) * PX) + 'px', background: '#e6f4ec', border: '1px dashed #7cc19c', borderRadius: '5px', boxSizing: 'border-box' }}>
                {(g.reservations || []).map(function (r, k) {
                  const a = Math.max(r.startMin, g.startMin), b = Math.min(r.endMin, g.endMin);
                  if (b <= a) return null;
                  return <div key={'r' + k} title={'Reservering: ' + reserveringTekst([r])} style={{ position: 'absolute', left: '0', right: '0', top: ((a - g.startMin) * PX) + 'px', height: ((b - a) * PX) + 'px', background: '#fdf3e2', color: '#8a5a00', fontSize: '9px', fontWeight: '800', padding: '1px 3px', boxSizing: 'border-box', pointerEvents: 'none' }}>R</div>;
                })}
                {stroken}
              </div>
            );
          })}
          {/* Gekozen momenten (roze); tik om los te laten. */}
          {BEWAARD.momenten.filter(function (mo) { return mo.date === date; }).map(function (mo) {
            return (
              <button key={'m' + mo.startMin} type="button" data-raster-gekozen={date + ' ' + hm(mo.startMin)} title={mo.ons === true ? 'ONS meldt overlap; tik om los te laten' : 'Gekozen; tik om los te laten'}
                onClick={function () { tikMoment(date, mo.startMin, duur); }}
                style={{ position: 'absolute', left: '2px', right: '2px', top: ((mo.startMin - ws) * PX) + 'px', height: (duur * PX) + 'px', border: '0', borderRadius: '5px',
                  background: mo.ons === true ? T.warn : T.brand, color: '#fff', font: '700 10px ' + FONT, textAlign: 'left', padding: '2px 4px', cursor: 'pointer', zIndex: '2' }}>{hm(mo.startMin) + ' ✓'}</button>
            );
          })}
          {/* Vandaag: wat voorbij is gestreept, met een stip en lijn op nu. */}
          {date === vandaagYmd && nuMin > ws ? (
            <div data-raster-voorbij="" style={{ position: 'absolute', left: '0', right: '0', top: '0', height: ((Math.min(nuMin, we) - ws) * PX) + 'px', borderRadius: '6px 6px 0 0', pointerEvents: 'none', zIndex: '1',
              background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.55) 0 4px, transparent 4px 8px)' }} />
          ) : null}
          {date === vandaagYmd && nuMin > ws && nuMin < we ? (
            <div data-raster-nu={hm(nuMin)} title={'Nu ' + hm(nuMin)} style={{ position: 'absolute', left: '-2px', right: '0', top: ((nuMin - ws) * PX - 1) + 'px', height: '2px', background: T.brand, pointerEvents: 'none', zIndex: '3' }}>
              <i style={{ position: 'absolute', left: '-3px', top: '-3px', width: '8px', height: '8px', borderRadius: '4px', background: T.brand }} />
            </div>
          ) : null}
          {lijnen}
          {/* Geen vrije tijd: 'Bezet' (of 'Voorbij' voor eerdere dagen); niet tijdens het laden. */}
          {!(d.per[date] || []).length && !(rs && rs.busy) ? <div style={{ position: 'absolute', top: '4px', left: '0', right: '0', textAlign: 'center', color: T.inkSoft, fontSize: '10px' }}>{date < ymdVan(new Date()) ? 'Voorbij' : 'Bezet'}</div> : null}
        </div>
      );
    }
    const legenda = [['#ece7e5', 'Bezet'], ['#e6f4ec', 'Vrij'], ['#fdf3e2', 'Reservering'], [T.brand, 'Gekozen']];
    if (Object.keys(feest).length) legenda.push(['linear-gradient(135deg,#ff9a33,#cfe8fd,#24684a)', 'Feestdag']);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0 6px' }}>
          {pijl('‹', -1, 'data-week-terug')}
          {/* 'Week 42' met eronder '12 tot en met 16 oktober'. */}
          <div data-week-titel="" style={{ textAlign: 'center', flex: '1 1 auto', minWidth: '0' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', color: T.ink }}>{'Week ' + isoWeek(ctx.plan.rasterWeek)}</div>
            <div style={{ fontSize: '11.5px', color: T.inkSoft }}>{werkweekNl(ctx.plan.rasterWeek, true)}</div>
          </div>
          {pijl('›', 1, 'data-week-verder')}
          <KaleKnop disabled={hier} data-week-vandaag="" title={hier ? 'Je bekijkt de week van vandaag' : 'Naar de week van vandaag'}
            onClick={function () { if (ctx.plan.rasterWeek !== huidigeWeek) { ctx.plan.rasterWeek = huidigeWeek; renderPagina(); } }}
            style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 9px', marginLeft: '4px', whiteSpace: 'nowrap',
              border: '1px solid ' + (hier ? T.line : T.brand), borderRadius: '8px', background: '#fff', color: hier ? '#b9b0b4' : T.brand, font: '600 12px ' + FONT, cursor: hier ? 'default' : 'pointer' }}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="3" width="12" height="11" rx="2" /><path d="M2 7h12M5 1.5v3M11 1.5v3" /><circle cx="8" cy="10.5" r="1.4" fill="currentColor" stroke="none" />
            </svg>
            Vandaag
          </KaleKnop>
        </div>
        {rs && rs.busy ? <LaadBalk style={{ margin: '0 0 8px' }} /> : null}
        {rs && rs.error ? <FoutStrook tekst={rs.error} style={{ margin: '0 0 8px' }} knop="Opnieuw" onKnop={function () { ctx.plan.raster = null; renderPagina(); }} /> : null}
        <div data-raster="" style={{ display: 'grid', gridTemplateColumns: '26px repeat(5, 1fr)', gap: '3px', fontSize: '11px' }}>
          <div />
          {['ma', 'di', 'wo', 'do', 'vr'].map(function (n, i) {
            const dag = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + i);
            const fh = feest[ymdVan(dag)], fst = fh ? feestdagStijl(fh.name) : null;
            const isVandaag = ymdVan(dag) === vandaagYmd;
            return (
              <div key={n} data-raster-vandaag={isVandaag ? '' : undefined} title={fst ? fh.name : isVandaag ? 'Vandaag' : undefined}
                style={Object.assign({ textAlign: 'center', color: isVandaag ? '#fff' : (fst ? fst.kop : T.inkSoft), fontWeight: '600', lineHeight: '1.2' },
                  isVandaag ? { background: T.brand, borderRadius: '6px', padding: '1px 0' } : null)}>
                {n}
                <div style={{ color: isVandaag ? '#fff' : (fst ? fst.kop : T.ink), fontWeight: '700' }}>{String(dag.getDate())}</div>
                {fst ? <i style={{ display: 'block', width: '6px', height: '6px', borderRadius: '3px', margin: '2px auto 0', background: fst.stip }} /> : null}
              </div>
            );
          })}
          <div style={{ position: 'relative', height: hoog + 'px' }}>{uurLabels}</div>
          {kolommen}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: T.inkSoft, marginTop: '8px' }}>
          {legenda.map(function (l) {
            return <span key={l[1]}><i style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: l[0], marginRight: '4px', verticalAlign: '-1px' }} />{l[1]}</span>;
          })}
        </div>
        <Txt kind="help" style={{ margin: '6px 0 0', fontSize: '11.5px' }}>{'Tik in het groen op de begintijd; de afspraak duurt ' + fmtMin(duur) + '.'}</Txt>
      </div>
    );
  }

  return { agendaMeldingBlok, agendasGewijzigd, momentenBalk, pagePlan, startPlan, wisselMoment, zorgVoorRaster };
}
