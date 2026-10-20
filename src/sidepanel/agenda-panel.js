/* ============================================================================
   agenda-panel.js: de Agendahulp in het zijpaneel (de schil).

   Opbouw: een spine links (roze als de hulp aanstaat, grijs als hij uitstaat)
   en een inhoudskolom met een kop (terugpijl, titel, aan/uit, info), het
   startscherm of een andere pagina, en een voet die onderaan blijft (balk van
   de pagina, Verlof aanvragen). Eén pagina tegelijk:

     hoofd        status, nog te registreren (dagweergave), het weekoverzicht
                  en de hulpmiddelen                       (deze schil)
     plan         Planhulp                                 pagina-plan.js
     maken        Afspraak maken                           pagina-maken.js
     open         Open registraties                        pagina-open.js
     snel         Snel registreren                         pagina-snel.js
     route        Route van de dag                         pagina-route.js
     clienttijd   opbouw cliënttijd en productieverloop    pagina-clienttijd.js
     verhouding   verhouding per uursoort                  pagina-verhouding.js
     info         legenda, versie, rondleidingen           pagina-info.js

   Elke pagina is een functie maakX(ctx) die zijn eigen functies teruggeeft;
   de pagina's kennen elkaar alleen via ctx (zie create). Wat blijft staan als
   het paneel opnieuw wordt opgebouwd, staat in bewaard.js; bouwstenen
   (kleuren, knoppen, iconen) in ui.js.

   Typografie (overal hetzelfde, zie TYPE): paginatitel 15px/700, sectiekop
   13px/700, tekst 13px/400, hulptekst en labels 12px (400 en 600) in gedempte
   inkt, labels 11px/600. Tekst staat altijd in inkt of gedempte inkt; roze is
   voor knoppen en accenten.

   Het paneel rekent zelf niets uit. Het krijgt een toestand (getallen, datums)
   en een setje acties, en meldt klikken terug via die acties. De domeinlogica
   blijft in het content-script op de ONS-pagina
   (src/content/features/agenda/side-panel-bridge.js levert de toestand).
   ========================================================================== */

import { BEWAARD, legeResultaten } from './bewaard.js';
import { CHEV_LINKS, FONT, ICON_HELP, ICON_PLAN, ICON_QUICK, ICON_RANGE, ICON_RATIO, ICON_ROUTE, T, TYPE, baseButton, clickCard, el, fmtMin, focusRing, hulpRij, laadBalk, noteBox, plusWeken, secondaryBtn, sectionHead, svgInfoIcon, svgPath, svgSpineCheck, svgSpinePause, tag, tekstKnop, txt, zorgVoorStijl } from './ui.js';
import { sluitRondleiding } from './rondleiding.js';
import { maakPlanhulp } from './pagina-plan.js';
import { maakAfspraakMaken } from './pagina-maken.js';
import { maakClienttijd } from './pagina-clienttijd.js';
import { maakVerhouding } from './pagina-verhouding.js';
import { maakOpenRegistraties, telOpen } from './pagina-open.js';
import { maakSnelRegistreren } from './pagina-snel.js';
import { maakRoute } from './pagina-route.js';
import { maakInfo } from './pagina-info.js';
import { maakRondleidingen } from './rondleidingen.js';

const PAGINA_TITEL = {
  hoofd: 'Agendahulp', clienttijd: 'Cliënttijd', verhouding: 'Verhouding per uursoort',
  open: 'Open registraties', snel: 'Snel registreren', info: 'Over de Agendahulp', plan: 'Planhulp', route: 'Route van de dag', maken: 'Afspraak maken'
};

export function create(host, actions) {
  actions = actions || {};
  // Wat de pagina's (pagina-*.js, rondleidingen.js) delen:
  //   state     de laatste toestand van het content-script (update)
  //   pagina    de pagina die nu open is
  //   range, prod, ratio, plan   wat je op die pagina's invult (uit BEWAARD;
  //             nieuw bij een andere medewerker)
  //   liveHost  de React-container van Cliënttijd of Verhouding
  //   onsGezien wat ONS' overlapcontrole per tijdvak zei (planhulp)
  // Daarnaast de elementen en functies van deze schil die een pagina nodig
  // heeft, en wat elke pagina zelf teruggeeft (pageX, startX, …).
  const ctx = { actions: actions, host: host, state: null, pagina: 'hoofd' };
  let vorigePagina = BEWAARD.pagina;   // na opnieuw opbouwen terug naar deze pagina
  let vergelijkSig = '';               // agenda-inhoud van de vorige update

  const root = el('div', {
    background: '#fff', color: T.ink, font: '400 13px/1.45 ' + FONT,
    overflow: 'hidden', display: 'flex', flexDirection: 'row', alignItems: 'stretch',
    height: '100%', width: '100%'
  });

  // ── Spine ──
  const spine = el('div', {
    width: '16px', flex: '0 0 auto', display: 'flex', flexDirection: 'column',
    alignItems: 'center', padding: '12px 0', userSelect: 'none'
  });
  spine.setAttribute('aria-hidden', 'true');
  const spineChip = el('span', {
    width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,.24)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: '0 0 auto'
  });
  spine.appendChild(spineChip);

  // ── Inhoudskolom ──
  const mainCol = el('div', {
    flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column',
    overflowY: 'auto', overflowX: 'hidden'
  });

  const header = el('div', {
    display: 'flex', alignItems: 'center', background: '#fff', padding: '12px',
    userSelect: 'none', borderBottom: '1px solid ' + T.line, flex: '0 0 auto'
  });
  // Terugpijl in de kop (niet op de hoofdpagina): zelfde regel als vroeger de
  // losse knop 'Terug'. Afspraak maken gaat terug naar de planhulp.
  const terugPijl = document.createElement('button');
  terugPijl.type = 'button';
  terugPijl.setAttribute('data-terug', '');
  terugPijl.setAttribute('aria-label', 'Terug');
  terugPijl.title = 'Terug';
  Object.assign(terugPijl.style, {
    display: 'none', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', flex: '0 0 auto',
    margin: '0 4px 0 -6px', padding: '0', border: '0', borderRadius: '8px', background: 'transparent', color: T.ink, cursor: 'pointer'
  });
  terugPijl.appendChild(svgPath(CHEV_LINKS, 22));
  terugPijl.addEventListener('mouseenter', function () { terugPijl.style.background = T.lineSoft; });
  terugPijl.addEventListener('mouseleave', function () { terugPijl.style.background = 'transparent'; });
  focusRing(terugPijl);
  terugPijl.addEventListener('click', function (e) { e.preventDefault(); naarPagina(ctx.pagina === 'maken' ? 'plan' : 'hoofd'); });
  header.appendChild(terugPijl);
  const title = el('span', Object.assign({}, TYPE.pageTitle, {
    flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  }), PAGINA_TITEL.hoofd);
  title.setAttribute('data-paneel-titel', '');
  header.appendChild(title);

  const controls = el('div', { display: 'inline-flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', marginLeft: '8px' });

  // Aan/uit-schakelaar.
  const onoff = document.createElement('button');
  onoff.type = 'button';
  Object.assign(onoff.style, {
    position: 'relative', background: 'transparent', border: '0', borderRadius: '999px',
    color: '#fff', cursor: 'pointer', lineHeight: '1', padding: '0', width: '58px', height: '24px',
    overflow: 'hidden', flex: '0 0 auto', fontFamily: 'inherit'
  });
  const swTrack = el('span', {
    position: 'absolute', inset: '0', borderRadius: '999px', border: '1px solid rgba(255,255,255,.45)',
    transition: 'background .16s ease, opacity .16s ease'
  });
  const swText = el('span', {
    position: 'absolute', top: '0', bottom: '0', display: 'flex', alignItems: 'center',
    fontSize: '11px', fontWeight: '600', color: '#fff',
    transition: 'left .16s ease, right .16s ease', pointerEvents: 'none'
  });
  const swKnob = el('span', {
    position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%',
    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.22)', transition: 'left .16s ease'
  });
  onoff.appendChild(swTrack); onoff.appendChild(swText); onoff.appendChild(swKnob);
  focusRing(onoff);
  onoff.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    const next = !(ctx.state && ctx.state.enabled);
    if (ctx.state) ctx.state.enabled = next;
    paintOnoff();
    if (actions.onToggleEnabled) actions.onToggleEnabled(next);
    if (ctx.pagina === 'hoofd') renderStatus();
  });

  const info = document.createElement('button');
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
    naarPagina(ctx.pagina === 'info' ? 'hoofd' : 'info');
  });

  controls.appendChild(onoff); controls.appendChild(info);
  header.appendChild(controls);
  mainCol.appendChild(header);

  // Hoofdpagina: status, totalen (dagweergave), weekoverzicht, knoppen.
  const hoofd = el('div', { flex: '0 0 auto' });
  const statusBox = el('div', { padding: '12px 12px 0' });
  const totals = el('div', { padding: '0 12px' });
  const weekBox = el('div', { padding: '16px 12px 0' });
  // Twee gescheiden kinderen: de laadstrook is van ons, de container daaronder
  // is van React. Zelf iets in een React-container zetten laat zijn interne
  // boekhouding los van de echte DOM.
  const laadStrook = el('div');
  const weekHost = el('div', { transition: 'opacity .15s ease' });
  weekBox.appendChild(laadStrook);
  weekBox.appendChild(weekHost);
  const navBox = el('div', { padding: '18px 12px 12px' });
  hoofd.appendChild(statusBox); hoofd.appendChild(totals); hoofd.appendChild(weekBox); hoofd.appendChild(navBox);

  // Andere pagina's.
  const paginaBox = el('div', { padding: '16px 12px 12px', flex: '0 0 auto', display: 'none' });
  mainCol.appendChild(hoofd); mainCol.appendChild(paginaBox);

  // ── Voet ── blijft onderaan in beeld, ook als je scrolt of de pagina kort
  // is: de balk met gekozen momenten (planhulp) en Verlof aanvragen.
  const voet = el('div', { position: 'sticky', bottom: '0', marginTop: 'auto', flex: '0 0 auto', background: '#fff', zIndex: '2' });
  const balkHost = el('div');
  voet.appendChild(balkHost);
  const leaveBar = el('div', { padding: '10px 12px', background: '#fff', borderTop: '1px solid ' + T.line });
  const leaveBtn = baseButton('Verlof aanvragen', function () { if (actions.onRequestLeave) actions.onRequestLeave(); }, true, false);
  leaveBtn.title = 'Verlof vastleggen in de agenda en aanvragen in AFAS';
  leaveBar.appendChild(leaveBtn);
  voet.appendChild(leaveBar);
  mainCol.appendChild(voet);

  root.appendChild(spine); root.appendChild(mainCol);
  host.appendChild(root);

  const bridge = function () { return window.__onsahReact; };

  /* ── Hoofdpagina ── */

  function paintOnoff() {
    const aan = !!(ctx.state && ctx.state.enabled);
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
    let tekst, toon;
    if (!ctx.state || !ctx.state.enabled) { tekst = 'Gekleurde dagindeling staat uit.'; toon = 'off'; }
    else if (!ctx.state.profileLabel) { tekst = 'Kies eerst een indeling via het extensie-icoontje in de browser.'; toon = 'warn'; }
    // Staat alles goed aan, dan geen melding (alleen uit of nog te kiezen).
    else { statusBox.style.display = 'none'; return; }
    statusBox.style.display = '';
    const bg = toon === 'ok' ? T.okWash : (toon === 'warn' ? T.warnWash : T.lineSoft);
    const fg = toon === 'ok' ? T.ok : (toon === 'warn' ? T.warn : T.inkSoft);
    const card = el('div', {
      display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '9px 11px',
      borderRadius: '10px', background: bg, color: fg, fontSize: '13px', lineHeight: '1.4', fontWeight: '600'
    });
    const icon = toon === 'ok' ? svgSpineCheck() : svgInfoIcon();
    icon.setAttribute('width', '13'); icon.setAttribute('height', '13');
    Object.assign(icon.style, { width: '13px', height: '13px', flex: '0 0 auto', marginTop: '2px' });
    card.appendChild(icon);
    card.appendChild(el('span', null, tekst));
    statusBox.appendChild(card);
  }

  function renderTotals() {
    totals.innerHTML = '';
    if (!ctx.state) return;
    const view = ctx.state.view || '';

    // Knop naar de weekweergave — alleen buiten de (werk)week-weergave.
    if (view !== 'workweek' && view !== 'week') {
      const weekBtn = secondaryBtn('Naar weekweergave', function () { if (actions.onJumpToWeek) actions.onJumpToWeek(); });
      weekBtn.style.marginTop = '12px';
      totals.appendChild(weekBtn);
    }

    // In dagweergave: nog te registreren (klikbaar).
    if (view === 'day') {
      const items = ctx.state.unfinished || [];
      totals.appendChild(sectionHead('Nog te registreren' + (items.length ? ' (' + items.length + ')' : ''), false));
      if (!items.length) {
        totals.appendChild(noteBox('Alles geregistreerd.', 'ok'));
        totals.lastChild.style.marginTop = '0';
      } else {
        const list = el('div', { display: 'flex', flexDirection: 'column', gap: '6px' });
        items.forEach(function (it) {
          const card = clickCard(function () { if (actions.onOpenOccurrence) actions.onOpenOccurrence(it.id); }, 'Afspraak openen');
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
    const w = ctx.state && ctx.state.week;
    const bezig = !!(ctx.state && ctx.state.weekLoading);
    const fout = (ctx.state && ctx.state.weekError) || '';
    const b = bridge();

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
      // Zelfde vorm als de weekkaart, zodat het scherm niet verspringt.
      laadStrook.appendChild(el('div', { fontSize: '15px', fontWeight: '700', color: T.ink, margin: '0 2px 8px' }, 'Weekoverzicht'));
      const lk = el('div', { border: '1px solid ' + T.line, borderRadius: '12px', padding: '12px 14px', background: '#fff' });
      if (bezig) {
        [['40%', '10px', '0'], ['58%', '22px', '8px'], ['100%', '8px', '16px'], ['82%', '10px', '10px']].forEach(function (b) {
          lk.appendChild(el('div', { width: b[0], height: b[1], marginTop: b[2], borderRadius: '5px', background: '#f1ecea', animation: 'onsAhPuls 1.4s ease-in-out infinite' }));
        });
        const lb = laadBalk(); lb.style.marginTop = '14px';
        lk.appendChild(lb);
      } else {
        lk.appendChild(txt('help', 'Wordt opgehaald zodra de agenda van deze week geladen is.'));
      }
      laadStrook.appendChild(lk);
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

  // Schakelaar uit het beheerscherm (state.features; ontbreekt = aan).
  function fAan(k) { return !(ctx.state && ctx.state.features && ctx.state.features[k] === false); }
  // Teller bij Open registraties: wat je zelf al hebt opgehaald (min wat je
  // hebt afgewerkt), anders wat de hulp vooraf heeft geladen. Onbekend = geen teller.
  function openTeller() {
    if (ctx.range.result) { const t = telOpen(ctx.range.result, ctx.range.afgewerkt || {}); return t.count - t.done; }
    return ctx.state && ctx.state.openCount != null ? ctx.state.openCount : null;
  }
  let navRouteAan = null;
  function navSleutel() { return JSON.stringify((ctx.state && ctx.state.features) || {}) + (ctx.state && ctx.state.routeEnabled === false) + '|' + openTeller(); }
  function renderNav() {
    navRouteAan = navSleutel();
    navBox.innerHTML = '';
    const rijen = [];
    if (fAan('openRegistrations')) rijen.push(['open', ICON_RANGE, 'Open registraties', function () { naarPagina('open'); }, openTeller()]);
    if (fAan('planner')) rijen.push(['plan', ICON_PLAN, 'Planhulp', function () { naarPagina('plan'); }]);
    if (fAan('quickRegister')) rijen.push(['snel', ICON_QUICK, 'Snel registreren', function () { naarPagina('snel'); }]);
    if (!(ctx.state && ctx.state.routeEnabled === false) && fAan('routeLink')) rijen.push(['route', ICON_ROUTE, 'Route van de dag', function () { naarPagina('route'); }]);
    if (fAan('weekRatio')) rijen.push(['verhouding', ICON_RATIO, 'Verhouding per uursoort', function () { naarPagina('verhouding'); }]);
    if (!rijen.length) return;
    navBox.appendChild(el('div', { fontSize: '12px', fontWeight: '700', color: T.inkSoft, margin: '0 2px 8px' }, 'Hulpmiddelen'));
    const lijst = el('div', { border: '1px solid ' + T.line, borderRadius: '12px', overflow: 'hidden', background: '#fff' });
    lijst.setAttribute('data-hulpmiddelen', '');
    rijen.forEach(function (r, i) { lijst.appendChild(hulpRij(r[0], r[1], r[2], r[3], r[4], i === 0)); });
    navBox.appendChild(lijst);
  }

  function naarPagina(p) {
    ctx.losKoppelen();
    ctx.pagina = p;
    BEWAARD.pagina = p;
    const opHoofd = ctx.pagina === 'hoofd';
    hoofd.style.display = opHoofd ? '' : 'none';
    paginaBox.style.display = opHoofd ? 'none' : '';
    leaveBar.style.display = (opHoofd && !(ctx.state && ctx.state.leaveRequest === false)) ? '' : 'none';
    title.textContent = PAGINA_TITEL[ctx.pagina] || PAGINA_TITEL.hoofd;
    terugPijl.style.display = opHoofd ? 'none' : 'inline-flex';
    info.style.background = ctx.pagina === 'info' ? T.brandWash : T.lineSoft;
    info.style.color = ctx.pagina === 'info' ? T.brand : T.inkSoft;
    renderPagina();
    if (opHoofd && navSleutel() !== navRouteAan) renderNav();
    mainCol.scrollTop = 0;
    if (p === 'verhouding') { ctx.ratio.offset = 0; ctx.laadRatio(); }
    // Meteen tonen wat er (vooraf geladen) klaarstaat: geen knop nodig.
    if (p === 'clienttijd' && fAan('production') && !ctx.prod.result && !ctx.prod.busy && !ctx.prod.error) { vulStandaarden(); ctx.startProduction(); }
    if (p === 'open' && !ctx.range.result && !ctx.range.busy && !ctx.range.error) { vulStandaarden(); ctx.startRangeCheck(); }
    if (p === 'plan' && !ctx.plan.result && !ctx.plan.busy && !ctx.plan.error) ctx.startPlan();
    if (p === 'route') ctx.startRoute();
    setTimeout(ctx.misschienRondleiding, 0);
  }

  /* ── Pagina's ── */

  // Eigen toestand per pagina, los van de pagina-toestand: die wordt bij elke
  // update vervangen, maar wat je invult of opvraagt moet blijven staan.
  ctx.range = BEWAARD.range;
  ctx.prod = BEWAARD.prod;
  const quick = BEWAARD.quick;
  ctx.ratio = BEWAARD.ratio;
  ctx.plan = BEWAARD.plan;

  function vulStandaarden() {
    if (!ctx.state) return;
    if (!ctx.range.from && ctx.state.rangeDefaultFrom) ctx.range.from = ctx.state.rangeDefaultFrom;
    if (!ctx.range.to && ctx.state.today) ctx.range.to = ctx.state.today;
    if (!ctx.prod.from && ctx.state.productionDefaultFrom) ctx.prod.from = ctx.state.productionDefaultFrom;
    // Standaard tot vier weken vooruit, zodat ook de planning zichtbaar is
    // (dezelfde periode die de pagina vooraf heeft geladen).
    if (!ctx.prod.to && ctx.state.today) ctx.prod.to = ctx.state.productionDefaultTo || plusWeken(ctx.state.today, 4);
    if (!quick.date && ctx.state.today) quick.date = ctx.state.today;
  }

  // Balk in de voet: gekozen momenten (planhulp), Afspraak maken of Snel
  // registreren.
  function renderBalk() {
    balkHost.innerHTML = '';
    if (ctx.pagina === 'plan' && BEWAARD.momenten.length) balkHost.appendChild(ctx.momentenBalk());
    if (ctx.pagina === 'maken' && BEWAARD.maak) balkHost.appendChild(ctx.maakBalk());
    if (ctx.pagina === 'snel') balkHost.appendChild(ctx.snelBalk());
  }
  // Het veld waar je in zit, zodat het na het opnieuw tekenen weer focus
  // krijgt (bijv. van reistijd heen naar terug tikken). Herkend aan zijn
  // data-attribuut (liefst een met een waarde).
  function veldMetFocus() {
    const a = document.activeElement;
    if (!a || !paginaBox.contains(a) || !/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return null;
    const attrs = Array.prototype.filter.call(a.attributes, function (x) { return /^data-/.test(x.name); });
    const at = attrs.filter(function (x) { return x.value; })[0] || attrs[0];
    if (!at) return null;
    const f = { sel: '[' + at.name + '="' + String(at.value).replace(/["\\]/g, '\\$&') + '"]' };
    try { f.start = a.selectionStart; f.end = a.selectionEnd; } catch (e) {}
    return f;
  }
  function focusTerug(f) {
    if (!f) return;
    const n = paginaBox.querySelector(f.sel);
    if (!n) return;
    try { n.focus(); if (f.start != null && n.setSelectionRange) n.setSelectionRange(f.start, f.end); } catch (e) {}
  }
  // Tekent de huidige (niet-hoofd)pagina opnieuw. Gebeurt bij het openen en bij
  // een eigen actie, niet bij elke pagina-update: dat zou een half ingevuld
  // veld wissen. De React-inhoud loopt wel mee via renderLive().
  function renderPagina() {
    const focus = veldMetFocus();
    ctx.losKoppelen();
    paginaBox.innerHTML = '';
    renderBalk();
    if (ctx.pagina === 'hoofd') return;
    vulStandaarden();
    if (ctx.pagina === 'plan' && fAan('planner')) {
      const kopRij = el('div', { display: 'flex', justifyContent: 'flex-end', margin: '-6px -6px 4px 0' });
      const rk = tekstKnop(ICON_HELP, 'Rondleiding', function () { ctx.startPlanRondleiding(); });
      rk.setAttribute('data-plan-rondleiding', '');
      rk.title = 'Rondleiding door de Planhulp';
      rk.style.color = T.inkSoft;
      kopRij.appendChild(rk);
      paginaBox.appendChild(kopRij);
    }
    const inhoud = ctx.pagina === 'clienttijd' ? ctx.pageClientTime()
      : ctx.pagina === 'verhouding' ? ctx.pageRatio()
      : ctx.pagina === 'open' ? ctx.pageOpen()
      : ctx.pagina === 'snel' ? ctx.pageQuick()
      : ctx.pagina === 'plan' ? ctx.pagePlan()
      : ctx.pagina === 'route' ? ctx.pageRoute()
      : ctx.pagina === 'maken' ? ctx.pageMaken()
      : ctx.pageInfo();
    paginaBox.appendChild(inhoud);
    focusTerug(focus);
    ctx.renderLive();
  }
  // Na het verlaten van een veld opnieuw tekenen, maar pas als de focus al in
  // het volgende veld staat (anders verdwijnt dat veld onder je klik).
  function straksTekenen() { setTimeout(function () { renderPagina(); }, 0); }

  function render() {
    paintOnoff();
    if (ctx.pagina !== 'hoofd') { ctx.renderLive(); return; }
    // Beheer kan de verlofknop uitzetten (config.features.leaveRequest).
    leaveBar.style.display = (ctx.state && ctx.state.leaveRequest === false) ? 'none' : '';
    renderStatus();
    renderTotals();
    renderWeek();
  }

  // De pagina's opbouwen. Ze roepen elkaar alleen aan via ctx, dus de
  // volgorde maakt niet uit.
  Object.assign(ctx, { balkHost, bridge, fAan, info, leaveBar, leaveBtn, naarPagina, navBox, onoff, paginaBox, quick, renderPagina, root, straksTekenen, weekBox });
  Object.assign(ctx, maakPlanhulp(ctx));
  Object.assign(ctx, maakAfspraakMaken(ctx));
  Object.assign(ctx, maakClienttijd(ctx));
  Object.assign(ctx, maakVerhouding(ctx));
  Object.assign(ctx, maakOpenRegistraties(ctx));
  Object.assign(ctx, maakSnelRegistreren(ctx));
  Object.assign(ctx, maakRoute(ctx));
  Object.assign(ctx, maakInfo(ctx));
  Object.assign(ctx, maakRondleidingen(ctx));

  renderNav();
  render();
  setTimeout(ctx.misschienRondleiding, 0);
  // Na opnieuw opbouwen (paginawissel in ONS) terug naar de pagina waar je was;
  // stond je op de afwerklijst, dan meteen bijwerken.
  if (vorigePagina === 'vrijblok') vorigePagina = 'plan';
  if (vorigePagina && vorigePagina !== 'hoofd') {
    naarPagina(vorigePagina);
    if (vorigePagina === 'open' && ctx.range.result) setTimeout(ctx.hercontrole, 0);
  }

  return {
    update: function (next) {
      const vorigeSig = vergelijkSig;
      ctx.state = next || null;
      // Andere medewerker (invitee) in de URL: resultaten van de vorige horen
      // er niet meer bij. Terug naar de hoofdpagina met een schone lei.
      const inv = ctx.state && ctx.state.inviteeId;
      // Agenda's erbij of eraf (meerdere naast elkaar): planhulp bijwerken.
      const agendas = (ctx.state && ctx.state.inviteeIds) || '';
      const vorigeAgendas = BEWAARD.agendaSleutel;
      const gedeeld = function (a, b) { const x = String(a || '').split(','); return String(b || '').split(',').some(function (id) { return id && x.indexOf(id) >= 0; }); };
      if (agendas && vorigeAgendas && agendas !== vorigeAgendas && gedeeld(agendas, vorigeAgendas)) {
        BEWAARD.agendaSleutel = agendas;
        if (inv) BEWAARD.inviteeId = inv;
        ctx.agendasGewijzigd(vorigeAgendas, agendas);
        render();
        return;
      }
      if (agendas) BEWAARD.agendaSleutel = agendas;
      if (inv && BEWAARD.inviteeId && inv !== BEWAARD.inviteeId) {
        legeResultaten();
        ctx.range = BEWAARD.range; ctx.prod = BEWAARD.prod; ctx.ratio = BEWAARD.ratio; ctx.plan = BEWAARD.plan;
        BEWAARD.inviteeId = inv;
        vergelijkSig = '';
        naarPagina('hoofd');
        render();
        return;
      }
      if (inv) BEWAARD.inviteeId = inv;
      // Knoppen opnieuw als de beheerschakelaar voor de route verandert.
      if (navSleutel() !== navRouteAan) renderNav();
      render();
      // Alleen bijwerken als er echt iets in de agenda veranderde.
      vergelijkSig = ctx.state ? JSON.stringify([ctx.state.past, ctx.state.unfinished, ctx.state.week && ctx.state.week.summary]) : '';
      if (vorigeSig && vergelijkSig !== vorigeSig) ctx.planHercontrole();
      ctx.misschienRondleiding();
    },
    // Uitslag van de kopieën (content-script, na het opslaan in ONS).
    setDuplicates: function (info) {
      BEWAARD.kopie = { made: (info && info.made) || [], failed: (info && info.failed) || [], reason: (info && info.reason) || '', next: (info && info.next) || null, left: (info && info.left) || 0 };
      if (!BEWAARD.kopie.reason && !BEWAARD.kopie.failed.length) BEWAARD.momenten = [];
      if (ctx.pagina === 'plan') renderPagina();
    },
    setRangeProgress: function (kind, done, total) {
      const doel = kind === 'productie' ? ctx.prod : ctx.range;
      if (!doel.busy) return;
      doel.done = done; doel.total = total;
      if ((kind === 'productie' && ctx.pagina === 'clienttijd') || (kind !== 'productie' && ctx.pagina === 'open')) renderPagina();
    },
    destroy: function () {
      sluitRondleiding();
      ctx.stopOpen();
      try { const b = bridge(); if (b) { b.unmount(weekHost); if (ctx.liveHost) b.unmount(ctx.liveHost); } } catch (e) {}
      if (root.parentNode) root.parentNode.removeChild(root);
    }
  };
}
