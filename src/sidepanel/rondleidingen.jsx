// De rondleidingen per scherm (stappen en wanneer ze starten). Elk scherm met
// een rondleiding heeft bovenin een vraagteken naast de i-knop (Kop in
// agenda-panel.jsx). Alleen die van het startscherm start vanzelf, bij elke
// nieuwe versie. De weergave zelf zit in rondleiding.jsx.

import { BEWAARD, momentIndex } from './bewaard.js';
import { ICON_HELP, ICON_PLAN, ICON_QUICK, ICON_RANGE, ICON_RATIO, ICON_ROUTE, Icoon, T } from './ui.jsx';
import { rondleidingActief, rondleidingGedaan, startRondleiding } from './rondleiding.jsx';
import { extensionVersion } from '../shared/version.js';

function versie() { try { return extensionVersion() || ''; } catch (e) { return ''; } }

/* ── Rondleidingen ── */
function welkomIcoon(d) { return <Icoon d={d} size={24} style={{ color: T.brand }} />; }

export function maakRondleidingen(ctx) {
  const { fAan, naarPagina, renderPagina } = ctx;
  // De onderdelen die de rondleiding aanwijst (zie ctx.el in agenda-panel.jsx).
  const el = ctx.el;
  function zoek(sel) { return el.paginaBox ? el.paginaBox.querySelector(sel) : null; }
  function zoekAlle(sel) { return el.paginaBox ? el.paginaBox.querySelectorAll(sel) : []; }

  function navKaart(t) { return el.navBox ? Array.prototype.filter.call(el.navBox.querySelectorAll('[data-hulp]'), function (c) { return String(c.textContent || '').indexOf(t) === 0; })[0] || null : null; }
  function opHoofd() { if (ctx.pagina !== 'hoofd') naarPagina('hoofd'); }
  function startHoofdRondleiding() {
    opHoofd();
    startRondleiding({
      naam: 'zijpaneel', versie: versie(), icoon: welkomIcoon(ICON_RANGE),
      stappen: [
        { titel: 'Welkom bij Agendahulp', tekst: 'In een paar stappen laten we zien wat het zijpaneel voor je doet. Het duurt nog geen minuut.', knop: 'Rondleiding starten', voor: opHoofd },
        { titel: 'Aan of uit', tekst: 'Hiermee zet je de hulp in ONS aan of uit. Staat hij uit, dan werkt ONS gewoon zoals altijd.', voor: opHoofd, vind: function () { return el.onoff; } },
        { titel: 'Je week in één oogopslag', tekst: 'Cliënttijd en niet-cliënttijd van de week die je in ONS bekijkt, met direct, indirect en reistijd. Onderin vind je de opbouw en het productieverloop.', voor: opHoofd, vind: function () { return el.weekBox; } },
        { titel: 'Open registraties', tekst: 'Controleer een periode op afspraken die nog niet geregistreerd zijn en werk ze één voor één af.', voor: opHoofd, vind: function () { return navKaart('Open registraties'); } },
        { titel: 'Planhulp', tekst: 'Vind vrije tijd voor een afspraak, kies een of meer momenten en maak de afspraak meteen in ONS.', voor: opHoofd, vind: function () { return navKaart('Planhulp'); } },
        { titel: 'Route van de dag', tekst: 'Je huisbezoeken van een dag op volgorde in Google Maps. Met een QR-code zet je de route op je telefoon.', voor: opHoofd, vind: function () { return navKaart('Route van de dag'); } },
        { titel: 'Verlof aanvragen', tekst: 'Vraag verlof aan zonder door ONS te zoeken. Je kiest de dagen, de hulp vult de rest in.', voor: opHoofd, vind: function () { return !el.leaveBar || el.leaveBar.style.display === 'none' ? null : el.leaveBtn; } },
        { titel: 'Rondleiding per scherm', tekst: 'Op elk scherm staat bovenin dit vraagteken. Daaronder vind je een rondleiding van dat scherm, bijvoorbeeld van de Planhulp. Hier op het startscherm start je deze rondleiding opnieuw.', voor: opHoofd, vind: function () { return el.hulp; } },
        { titel: 'Legenda en versie', tekst: 'Onder het i-tje vind je wat de kleuren in ONS betekenen en welke versie je hebt.', voor: opHoofd, vind: function () { return el.info; }, knop: 'Klaar' }
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
      const c = zoek('[data-dag][data-start]');
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
    const inst = function () { return zoek('[data-plan-instellingen]'); };
    const alle = function (sel) { return function () { return zoekAlle(sel); }; };
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
            const c = zoek('[data-dag][data-start]');
            if (!c) return null;
            const els = Array.prototype.slice.call(zoekAlle('[data-dag="' + c.getAttribute('data-dag') + '"]'));
            if (c.parentNode && c.parentNode.previousSibling) els.push(c.parentNode.previousSibling);
            return els;
          } },
        { titel: 'Je gekozen momenten', tekst: 'Hier staan je keuzes. Tik op de teller om ze te bekijken of te wissen, en ga dan door naar Afspraak maken.', voor: eenMoment, vind: function () { return el.balkHost && el.balkHost.firstChild; } },
        { titel: 'De weekplanning', tekst: 'Groen is vrij. Tik in het groen op de begintijd, of sleep vanaf de begintijd omlaag voor een andere eindtijd. Met de pijlen blader je, met Vandaag ben je zo terug. Feestdagen hebben een eigen kleur.', voor: function () { naarPlan('raster'); },
          vind: alle('[data-raster],[data-week-titel],[data-week-vandaag]') },
        { titel: 'Zelfde of per afspraak anders', tekst: 'Bij meerdere momenten kies je of elke afspraak dezelfde cliënt(en) krijgt, of per afspraak andere.', als: ctx.kanDirect, voor: naarMakenPagina, vind: alle('[data-maak-modus]') },
        { titel: 'Cliënt zoeken', tekst: 'Typ een naam zoals in ONS. Je ziet cliëntnummer, geboortedatum en postcode. Vink aan om ook cliënten uit zorg te vinden.', als: ctx.kanDirect, voor: naarMakenPagina,
          vind: function () { const z = zoek('[data-maak-zoek]'), v = zoek('[data-client-uit-zorg]'); return [z, v && v.parentNode].filter(Boolean); } },
        { titel: 'Afspraak maken', tekst: 'Maak de afspraken meteen in ONS, of open liever het ONS Afspraakformulier met alles al ingevuld.', als: ctx.kanDirect, voor: naarMakenPagina,
          vind: function () { return el.balkHost ? el.balkHost.querySelectorAll('[data-maak-knop],[data-maak-ons]') : null; }, knop: 'Klaar' }
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
  /* ── De andere schermen: dezelfde opbouw, een welkom en dan de onderdelen. ── */
  function welkom(titel, tekst) { return { titel: titel, tekst: tekst, knop: 'Rondleiding starten' }; }
  function stap(titel, tekst, sel) {
    return { titel: titel, tekst: tekst, vind: typeof sel === 'function' ? sel : function () { return zoek(sel); } };
  }
  function laatste(s) { return Object.assign({}, s, { knop: 'Klaar' }); }
  function inBalk(sel) { return function () { return el.balkHost ? (sel ? el.balkHost.querySelectorAll(sel) : el.balkHost.firstChild) : null; }; }
  const SCHERMEN = {
    open: { kop: 'Rondleiding Open registraties', icoon: ICON_RANGE, als: function () { return fAan('openRegistrations'); }, stappen: [
      welkom('Open registraties', 'Hier vind je afgelopen afspraken die nog niet geregistreerd zijn, zodat je ze een voor een kunt afwerken.'),
      stap('Kies een periode', 'Kies van welke dag tot en met welke dag je wilt controleren, hooguit 26 weken. Tik dan op Controleren.', '[data-tour="open-periode"]'),
      stap('Wat nog open staat', 'Per dag de afspraken die nog geregistreerd moeten worden. Met de knop bij een afspraak open je de registratie in ONS.', '[data-tour="open-lijst"]'),
      laatste(stap('Afvinken', 'Registreer je een afspraak of zet je hem op niet registreren, dan wordt hij afgevinkt. Bijwerken kijkt meteen opnieuw.', '[data-tour="open-bijwerken"]'))
    ] },
    snel: { kop: 'Rondleiding Snel registreren', icoon: ICON_QUICK, als: function () { return fAan('quickRegister'); }, stappen: [
      welkom('Snel registreren', 'Registreer tijd zonder afspraak, zoals overleg of verslaglegging. De hulp opent het registratieformulier van ONS met alles al ingevuld.'),
      stap('Dag en begintijd', 'Kies de dag en de begintijd van wat je wilt registreren.', '[data-tour="snel-moment"]'),
      stap('Hoe lang', 'Kies de duur, of typ zelf een aantal minuten.', '[data-tour="snel-duur"]'),
      laatste(stap('Formulier openen', 'Opent het registratieformulier van ONS met dag, begin en eind ingevuld. Overlapt het met een andere registratie, dan zie je dat eerst.', inBalk()))
    ] },
    route: { kop: 'Rondleiding Route van de dag', icoon: ICON_ROUTE, stappen: [
      welkom('Route van de dag', 'Je huisbezoeken van een dag op volgorde van begintijd, met de route in Google Maps.'),
      stap('Dag en vertrekpunt', 'Kies de dag. Vul eventueel een vertrekpunt in, zoals je kantoor; dat onthoudt het zijpaneel.', '[data-tour="route-dag"]'),
      stap('Je huisbezoeken', 'Per bezoek de tijd en het adres, op volgorde van begintijd.', '[data-route-persoon]'),
      stap('Route openen', 'Opent de hele route in Google Maps.', '[data-route-url]'),
      stap('Kaart', 'Laat de route op een kaart in het zijpaneel zien.', '[data-route-kaart-knop]'),
      laatste(stap('Op je telefoon', 'Scan de QR-code met je telefoon en je hebt de route bij je.', '[data-route-qr-knop]'))
    ] },
    clienttijd: { kop: 'Rondleiding Cliënttijd', icoon: ICON_RATIO, stappen: [
      welkom('Cliënttijd', 'De opbouw van je week: hoeveel tijd met en zonder cliënt, en hoe die verdeeld is.'),
      stap('Opbouw van de week', 'Cliënttijd en niet-cliënttijd van de week die je in ONS bekijkt, met direct, indirect en reistijd.', '[data-tour="clienttijd-opbouw"]'),
      laatste(stap('Productieverloop', 'Kies een periode en zie het totaal geregistreerd tussen die datums, en je uren per week.', '[data-tour="clienttijd-productie"]'))
    ] },
    verhouding: { kop: 'Rondleiding Verhouding per uursoort', icoon: ICON_RATIO, als: function () { return fAan('weekRatio'); }, stappen: [
      welkom('Verhouding per uursoort', 'Zie per uursoort hoe je tijd in een week verdeeld is.'),
      stap('Andere week', 'Blader met de pijlen naar een vorige of volgende week.', '[data-tour="verhouding-week"]'),
      laatste(stap('Per uursoort', 'Per uursoort hoeveel tijd je die week hebt, en hoe dat zich verhoudt.', '[data-tour="verhouding-kaarten"]'))
    ] },
    info: { kop: 'Rondleiding Over de Agendahulp', icoon: ICON_HELP, stappen: [
      welkom('Over de Agendahulp', 'Hier vind je wat de kleuren in ONS betekenen en welke versie je hebt.'),
      stap('Legenda', 'Wat de kleuren in je agenda betekenen.', '[data-tour="info-legenda"]'),
      laatste(stap('Versie', 'Het versienummer van de Agendahulp. Handig als je een vraag of melding hebt.', '[data-tour="info-versie"]'))
    ] },
    maken: { kop: 'Rondleiding Afspraak maken', icoon: ICON_PLAN, als: function () { return !!BEWAARD.maak; }, stappen: [
      welkom('Afspraak maken', 'Maak de afspraken op de gekozen momenten meteen in ONS.'),
      stap('Zelfde of per afspraak anders', 'Bij meerdere momenten kies je of elke afspraak dezelfde cliënt(en) krijgt, of per afspraak andere.', '[data-maak-modus]'),
      stap('Voor alle afspraken', 'Kies de cliënt(en), de uursoort en het afspraaktype voor alle afspraken tegelijk.', '[data-maak-alle]'),
      stap('Elke afspraak', 'Per afspraak de dag, de tijd en wat er gemaakt wordt. Met Aanpassen kies je voor één afspraak iets anders, met Verwijderen haal je hem weg.', '[data-maak-afspraak="0"]'),
      stap('Eindtijd', 'Tik op de eindtijd om hem te typen. Ben je dan bezet of overlapt hij een andere afspraak, dan zie je dat meteen.', '[data-maak-eind="0"]'),
      stap('Medewerkers', 'Zet een collega erbij; de hulp kijkt na of die op dat moment kan.', '[data-mw-kaart]'),
      laatste(stap('Afspraak maken', 'Maak de afspraken meteen in ONS, of open liever het ONS Afspraakformulier met alles al ingevuld.', inBalk('[data-maak-knop],[data-maak-ons]')))
    ] }
  };
  // Heeft dit scherm een rondleiding (vraagteken in de kop)?
  function heeftRondleiding(pagina) {
    if (pagina === 'hoofd') return true;
    if (pagina === 'plan') return fAan('planner');
    const d = SCHERMEN[pagina];
    return !!d && (!d.als || d.als());
  }
  // Het vraagteken: de rondleiding van het scherm waar je bent.
  function startSchermRondleiding(pagina) {
    if (pagina === 'hoofd') { startHoofdRondleiding(); return; }
    if (pagina === 'plan') { startPlanRondleiding(); return; }
    const d = SCHERMEN[pagina];
    if (!d || !heeftRondleiding(pagina)) return;
    const hier = function () { if (ctx.pagina !== pagina) naarPagina(pagina); };
    startRondleiding({
      naam: pagina, kop: d.kop, stapLabel: 'Stap', icoon: welkomIcoon(d.icoon),
      stappen: d.stappen.map(function (s) { return Object.assign({ voor: hier }, s); })
    });
  }
  // Vanzelf alleen die van het startscherm: bij elke nieuwe versie één keer,
  // als er een agenda is. De Planhulp start alleen vanzelf als je zijn
  // vraagteken al had aangetikt en de vrije tijd toen nog niet binnen was.
  let tourGepland = false;
  function misschienRondleiding() {
    if (tourGepland || rondleidingActief() || !ctx.state) return;
    const v = versie();
    if (ctx.pagina === 'hoofd' && el.navBox && el.navBox.children.length && !rondleidingGedaan('zijpaneel', v)) {
      tourGepland = true;
      setTimeout(function () { tourGepland = false; if (ctx.pagina === 'hoofd' && !rondleidingActief() && !rondleidingGedaan('zijpaneel', v) && el.root && el.root.isConnected) startHoofdRondleiding(); }, 600);
    } else if (ctx.pagina === 'plan' && ctx.plan.result && !ctx.plan.busy && planTourWacht) {
      tourGepland = true;
      setTimeout(function () { tourGepland = false; if (ctx.pagina === 'plan' && !rondleidingActief() && planTourWacht && el.root && el.root.isConnected) startPlanRondleiding(); }, 400);
    }
  }

  return { heeftRondleiding, misschienRondleiding, startHoofdRondleiding, startPlanRondleiding, startSchermRondleiding };
}
