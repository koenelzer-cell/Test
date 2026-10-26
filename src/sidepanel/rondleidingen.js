// De rondleidingen van het startscherm en de planhulp (stappen en wanneer ze
// starten). De weergave zelf zit in rondleiding.js.

import { BEWAARD, momentIndex } from './bewaard.js';
import { ICON_PLAN, ICON_RANGE, T, svgPath } from './ui.js';
import { rondleidingActief, rondleidingGedaan, startRondleiding } from './rondleiding.js';

/* ── Rondleidingen ── */
function welkomIcoon(d) { return function () { const i = svgPath(d, 24); i.style.color = T.brand; return i; }; }

export function maakRondleidingen(ctx) {
  const { balkHost, fAan, info, leaveBar, leaveBtn, naarPagina, navBox, onoff, paginaBox, renderPagina, root, weekBox } = ctx;

  function navKaart(t) { return Array.prototype.filter.call(navBox.querySelectorAll('[data-hulp]'), function (c) { return String(c.textContent || '').indexOf(t) === 0; })[0] || null; }
  function opHoofd() { if (ctx.pagina !== 'hoofd') naarPagina('hoofd'); }
  function startHoofdRondleiding() {
    opHoofd();
    startRondleiding({
      naam: 'zijpaneel', icoon: welkomIcoon(ICON_RANGE),
      stappen: [
        { titel: 'Welkom bij Agendahulp', tekst: 'In een paar stappen laten we zien wat het zijpaneel voor je doet. Het duurt nog geen minuut.', knop: 'Rondleiding starten', voor: opHoofd },
        { titel: 'Aan of uit', tekst: 'Hiermee zet je de hulp in ONS aan of uit. Staat hij uit, dan werkt ONS gewoon zoals altijd.', voor: opHoofd, vind: function () { return onoff; } },
        { titel: 'Je week in één oogopslag', tekst: 'Cliënttijd en niet-cliënttijd van de week die je in ONS bekijkt, met direct, indirect en reistijd. Onderin vind je de opbouw en het productieverloop.', voor: opHoofd, vind: function () { return weekBox; } },
        { titel: 'Open registraties', tekst: 'Controleer een periode op afspraken die nog niet geregistreerd zijn en werk ze één voor één af.', voor: opHoofd, vind: function () { return navKaart('Open registraties'); } },
        { titel: 'Planhulp', tekst: 'Vind vrije tijd voor een afspraak, kies een of meer momenten en maak de afspraak meteen in ONS. De eerste keer krijg je daar een eigen rondleiding.', voor: opHoofd, vind: function () { return navKaart('Planhulp'); } },
        { titel: 'Route van de dag', tekst: 'Je huisbezoeken van een dag op volgorde in Google Maps. Met een QR-code zet je de route op je telefoon.', voor: opHoofd, vind: function () { return navKaart('Route van de dag'); } },
        { titel: 'Verlof aanvragen', tekst: 'Vraag verlof aan zonder door ONS te zoeken. Je kiest de dagen, de hulp vult de rest in.', voor: opHoofd, vind: function () { return leaveBar.style.display === 'none' ? null : leaveBtn; } },
        { titel: 'Later nog eens?', tekst: 'Via deze knop vind je de rondleidingen terug, en de legenda en de versie.', voor: opHoofd, vind: function () { return info; }, knop: 'Klaar' }
      ]
    });
  }
  // Planhulp: voorbeeldmoment, weergave en pagina na afloop terugzetten.
  let tourTijdelijk = null;
  let planTourWacht = false;
  function startPlanRondleiding() {
    if (!fAan('planner')) return;
    if (ctx.pagina !== 'plan') naarPagina('plan');
    // Eerst de vrije tijd: anders zijn er nog geen tijden om te laten zien.
    if (!ctx.plan.result || ctx.plan.busy) { planTourWacht = true; if (!ctx.plan.busy && !ctx.plan.error) ctx.startPlan(); return; }
    planTourWacht = false;
    const oud = { weergave: ctx.plan.weergave || 'lijst', momenten: BEWAARD.momenten.length, maak: BEWAARD.maak };
    tourTijdelijk = null;
    function naarPlan(w) {
      if (ctx.pagina !== 'plan') naarPagina('plan');
      if ((ctx.plan.weergave || 'lijst') !== w) { ctx.plan.weergave = w; renderPagina(); }
    }
    function lijstKlaar() { naarPlan('lijst'); }
    function eenMoment() {
      lijstKlaar();
      if (BEWAARD.momenten.length) return;
      const c = paginaBox.querySelector('[data-dag][data-start]');
      if (!c) return;
      const d = c.getAttribute('data-dag'), t = c.getAttribute('data-start').split(':');
      tourTijdelijk = { date: d, startMin: (+t[0]) * 60 + (+t[1]) };
      ctx.wisselMoment(tourTijdelijk.date, tourTijdelijk.startMin);
      renderPagina();
    }
    function naarMakenPagina() {
      if (ctx.pagina === 'maken') return;
      if (!BEWAARD.momenten.length) eenMoment();
      if (BEWAARD.momenten.length && ctx.kanDirect()) ctx.naarMaken(BEWAARD.momenten, ctx.plan.minutes);
    }
    const inst = function () { return paginaBox.querySelector('[data-plan-instellingen]'); };
    const alle = function (sel) { return function () { return paginaBox.querySelectorAll(sel); }; };
    startRondleiding({
      naam: 'planhulp', kop: 'Rondleiding Planhulp', stapLabel: 'Planhulp, stap', icoon: welkomIcoon(ICON_PLAN),
      stappen: [
        { titel: 'Welkom in de Planhulp', tekst: 'Zo vind je in een paar tikken vrije tijd en maak je de afspraak meteen in ONS. Deze rondleiding duurt een halve minuut.', knop: 'Rondleiding starten', voor: lijstKlaar },
        { titel: 'Lijst of weekplanning', tekst: 'In de lijst zie je per dag de begintijden. De weekplanning toont je week als mini agenda.', voor: lijstKlaar, vind: alle('[data-plan-weergave]') },
        { titel: 'Hoe lang duurt de afspraak?', tekst: 'Kies de duur. Je ziet dan alleen tijden waarop de afspraak helemaal past.', voor: lijstKlaar, vind: alle('[data-plan-duur]'), breedte: inst },
        { titel: 'Hoe ver vooruit', tekst: 'Zoek 1, 2 of 4 weken vooruit. Met het kalendertje zoek je tot een datum die je zelf kiest.', voor: lijstKlaar, vind: alle('[data-plan-weken],[data-plan-tot]'), breedte: inst },
        { titel: 'Alleen bepaalde dagen', tekst: 'Werk je bijvoorbeeld niet op woensdag? Vink de dag uit en hij verdwijnt meteen uit de lijst.', voor: lijstKlaar, vind: alle('[data-plan-dag]'), breedte: inst },
        { titel: 'Tik op een begintijd', tekst: 'Een tik kiest de tijd, nog een tik laat hem los. Je kunt meerdere momenten kiezen, ook op verschillende dagen. ONS kijkt meteen na of er overlap is.', voor: lijstKlaar,
          vind: function () {
            const c = paginaBox.querySelector('[data-dag][data-start]');
            if (!c) return null;
            const els = Array.prototype.slice.call(paginaBox.querySelectorAll('[data-dag="' + c.getAttribute('data-dag') + '"]'));
            if (c.parentNode && c.parentNode.previousSibling) els.push(c.parentNode.previousSibling);
            return els;
          } },
        { titel: 'Je gekozen momenten', tekst: 'Hier staan je keuzes. Tik op de teller om ze te bekijken of te wissen, en ga dan door naar Afspraak maken.', voor: eenMoment, vind: function () { return balkHost.firstChild; } },
        { titel: 'De weekplanning', tekst: 'Groen is vrij. Tik in het groen op de begintijd. Met de pijlen blader je, met Vandaag ben je zo terug. Feestdagen hebben een eigen kleur.', voor: function () { naarPlan('raster'); },
          vind: alle('[data-raster],[data-week-titel],[data-week-vandaag]') },
        { titel: 'Zelfde of per afspraak anders', tekst: 'Bij meerdere momenten kies je of elke afspraak dezelfde cliënt(en) krijgt, of per afspraak andere.', als: ctx.kanDirect, voor: naarMakenPagina, vind: alle('[data-maak-modus]') },
        { titel: 'Cliënt zoeken', tekst: 'Typ een naam zoals in ONS. Je ziet cliëntnummer, geboortedatum en postcode. Vink aan om ook cliënten uit zorg te vinden.', als: ctx.kanDirect, voor: naarMakenPagina,
          vind: function () { const z = paginaBox.querySelector('[data-maak-zoek]'), v = paginaBox.querySelector('[data-client-uit-zorg]'); return [z, v && v.parentNode].filter(Boolean); } },
        { titel: 'Afspraak maken', tekst: 'Maak de afspraken meteen in ONS, of open liever het ONS Afspraakformulier met alles al ingevuld.', als: ctx.kanDirect, voor: naarMakenPagina,
          vind: function () { return balkHost.querySelectorAll('[data-maak-knop],[data-maak-ons]'); }, knop: 'Klaar' }
      ],
      onEinde: function () {
        // Alles terug zoals het was.
        if (tourTijdelijk && momentIndex(tourTijdelijk.date, tourTijdelijk.startMin) >= 0 && BEWAARD.momenten.length > oud.momenten) ctx.wisselMoment(tourTijdelijk.date, tourTijdelijk.startMin);
        tourTijdelijk = null;
        if (ctx.pagina === 'maken' && BEWAARD.maak !== oud.maak) { BEWAARD.maak = oud.maak; naarPagina('plan'); }
        ctx.plan.weergave = oud.weergave;
        if (ctx.pagina === 'plan') renderPagina();
      }
    });
  }
  // Vanzelf, één keer: het zijpaneel als er een agenda is, de Planhulp als de
  // eerste vrije tijd binnen is.
  let tourGepland = false;
  function misschienRondleiding() {
    if (tourGepland || rondleidingActief() || !ctx.state) return;
    if (ctx.pagina === 'hoofd' && navBox.children.length && !rondleidingGedaan('zijpaneel')) {
      tourGepland = true;
      setTimeout(function () { tourGepland = false; if (ctx.pagina === 'hoofd' && !rondleidingActief() && !rondleidingGedaan('zijpaneel') && root.isConnected) startHoofdRondleiding(); }, 600);
    } else if (ctx.pagina === 'plan' && ctx.plan.result && !ctx.plan.busy && (planTourWacht || !rondleidingGedaan('planhulp'))) {
      tourGepland = true;
      setTimeout(function () { tourGepland = false; if (ctx.pagina === 'plan' && !rondleidingActief() && (planTourWacht || !rondleidingGedaan('planhulp')) && root.isConnected) startPlanRondleiding(); }, 400);
    }
  }

  return { misschienRondleiding, startHoofdRondleiding, startPlanRondleiding };
}
