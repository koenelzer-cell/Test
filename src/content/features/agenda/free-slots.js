// Planhulp: vrije tijd in de komende weken voor een afspraak van een gekozen
// duur. Haalt per week alles op wat tijd kan bezetten (ONS-afspraken,
// onbeschikbaarheid, Outlook-afspraken, geplande bezoeken) en rekent in
// domain/free-slots.js.
//
// Snelheid: opgehaalde weken blijven even in het geheugen (week-cache.js, dat
// ook het weekoverzicht vult), een verre periode wordt in stukken opgehaald
// tot de lijst vol is, een laag die ONS hier niet heeft wordt niet steeds
// opnieuw gevraagd, de week na de lijst wordt alvast opgehaald (Meer laden),
// en de overlapcontrole van ONS doet het zijpaneel pas als de lijst er al staat.

import { currentInviteeId, currentInviteeIds } from './navigation.js';
import { activeZones } from './zones.js';
import { agendaPage } from './state.js';
import { weekRange, workWindowFor } from '../../../shared/work-hours.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';
import { findFreeGaps, reservationBlocks, reservationsOverlapping } from '../../domain/free-slots.js';
import { addressFromDetails, isAtClient, postcodeFromAddress } from '../../domain/route.js';
import { officeForLocation } from '../../domain/offices.js';
import { weekStartsBetween } from '../../domain/open-registrations.js';
import { holidaysBetween, parseHolidays } from '../../domain/holidays.js';
import { maandagenTussen, plusDagen } from '../../../shared/datum.js';
import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { getJson } from '../../services/ons-api/http.js';
import { createLimiter } from '../../services/ons-api/calendar.js';
import { haalWeek } from '../../services/ons-api/week-cache.js';
import { fetchEventOverlap, overlapCheckStatus } from '../../services/ons-api/event-overlap.js';

// Werkvenster (minuten): de eigen werktijden uit de popup (vroegste begin en
// laatste einde van de week), anders het vroegste begin en het laatste eind
// van de gekozen dagindeling. Alleen als grens; wat er BINNEN dat venster
// bezet is, komt uit de agenda zelf (afspraken en onbeschikbaarheid), niet uit
// de kleurzones.
export function workWindow() {
  const eigen = weekRange(agendaPage.workHours);
  if (eigen) return eigen;
  const z = activeZones() || [];
  if (!z.length) return { start: 8 * 60, end: 17 * 60 };
  const start = Math.round(Math.min.apply(null, z.map(function (x) { return x.from; })) * 60);
  const end = Math.round(Math.max.apply(null, z.map(function (x) { return x.to; })) * 60);
  return { start: start, end: end };
}

function agendaIds() {
  let ids = currentInviteeIds();
  if (!ids.length) { const een = currentInviteeId(null) || resolveInviteeId(); if (een != null) ids = [String(een)]; }
  return ids;
}

// Eén tijdvak bij ONS zelf nakijken (overlap_detection).
//   { date, startMin, minutes, clientIds? } -> Promise<{ status, overlap }>
//   clientIds: ook de gekozen cliënt(en) meenemen (Afspraak maken).
//   status: 'ready' (overlap true/false/null) | 'unreadable' | 'unknown'
export function checkSlotWithOns(req) {
  req = req || {};
  const status = overlapCheckStatus();
  const startMin = parseInt(req.startMin, 10), minutes = parseInt(req.minutes, 10);
  if (status !== 'ready' || !(startMin >= 0) || !(minutes > 0)) return Promise.resolve({ status: status, overlap: null });
  const cl = (Array.isArray(req.clientIds) ? req.clientIds : []).map(String).filter(function (c) { return /^\d+$/.test(c); }).slice(0, 10);
  return fetchEventOverlap({ ids: agendaIds(), clientIds: cl, date: req.date, startMin: startMin, endMin: startMin + minutes })
    .then(function (o) { return { status: status, overlap: o }; });
}

// Zoeken tot en met een datum: hooguit een jaar vooruit in één keer. 'Meer
// laden' gaat in stukjes van een week verder (met van) en heeft geen grens.
export const MAX_ZOEK_DAGEN = 366;

// Feestdagen uit ONS, één keer per pagina opgehaald. Mislukt het, dan zonder
// (en de volgende zoekactie probeert het opnieuw).
let feestdagenBelofte = null;
export function holidays() {
  if (!feestdagenBelofte) {
    feestdagenBelofte = Promise.resolve().then(function () { return getJson(_apiUrl('holidays')); })
      .then(parseHolidays).catch(function () { feestdagenBelofte = null; return []; });
  }
  return feestdagenBelofte;
}
export function _forgetHolidays() { feestdagenBelofte = null; }

// Eén laag van één week, met de laag en de medewerker erbij.
function weekLaag(sjabloon, laag, start, id, wachtrij) {
  return haalWeek(sjabloon, id, start, { wachtrij: wachtrij })
    .then(function (lijst) { return lijst.map(function (e) { e.layer = laag; e.inviteeId = id; return e; }); });
}
// Lagen die ONS hier niet heeft (bijv. geen Outlook-koppeling) geven een
// 4xx-antwoord. Die vraagt de hulp de rest van deze pagina niet meer. Een
// storing (5xx, netwerk, afgemeld) telt niet: dan de volgende keer opnieuw.
const ontbrekendeLagen = Object.create(null);
const NIET_BESCHIKBAAR = [400, 403, 404, 405, 410, 422, 501];
function nietBeschikbaar(err) {
  const m = /^HTTP (\d{3})$/.exec(String((err && err.message) || ''));
  return !!m && NIET_BESCHIKBAAR.indexOf(+m[1]) >= 0;
}
// De andere lagen: mislukt er een, dan zonder.
function bijLaag(sjabloon, laag, start, id, wachtrij) {
  const k = sjabloon + '|' + id;
  if (ontbrekendeLagen[k]) return Promise.resolve([]);
  return weekLaag(sjabloon, laag, start, id, wachtrij).catch(function (err) {
    if (nietBeschikbaar(err)) ontbrekendeLagen[k] = true;
    return [];
  });
}
// Alles wat tijd kan bezetten in één week, voor elke agenda.
function weekVoor(ids, start, wachtrij) {
  return Promise.all(ids.map(function (id) {
    return Promise.all([
      weekLaag('weekEvents', 'events', start, id, wachtrij),
      bijLaag('weekUnavailabilities', 'unavailabilities', start, id, wachtrij),
      bijLaag('weekOutlook', 'outlook_appointments', start, id, wachtrij),
      bijLaag('weekPlannedVisits', 'planned_visits', start, id, wachtrij),
      bijLaag('weekReservations', 'reservations', start, id, wachtrij)
    ]);
  }));
}
// Meer laden (en de volgende week in het weekraster) vraagt de week na
// lastDate. Die alvast ophalen als de lijst er staat en het tabblad zichtbaar
// is: rustig, twee verzoeken tegelijk. Gaat het mis, dan haalt Meer laden hem
// gewoon zelf op.
const VOORAF_NA_MS = 1000;
function volgendeWeekVooraf(ids, lastDate) {
  setTimeout(function () {
    if (document.visibilityState !== 'visible') return;
    const wachtrij = createLimiter(2);
    maandagenTussen(plusDagen(lastDate, 1), plusDagen(lastDate, 7)).forEach(function (start) {
      weekVoor(ids, start, wachtrij).catch(function () {});
    });
  }, VOORAF_NA_MS);
}
// Zoveel weken per keer. Een korte periode (tot drie weken) gaat in één keer;
// een verre periode stopt na het stuk waarin de lijst vol raakt.
const WEKEN_PER_KEER = 3;

export function maxBlokken(limiet, standaard) {
  const n = parseInt(limiet, 10);
  return n > 0 ? Math.min(400, n) : standaard;
}

// [1..5] -> gesorteerd en uniek; leeg of alle vijf = geen filter (null).
export function weekdagen(dagen) {
  const d = (Array.isArray(dagen) ? dagen : []).map(Number).filter(function (x, i, a) { return x >= 1 && x <= 5 && a.indexOf(x) === i; }).sort();
  return d.length && d.length < 5 ? d : null;
}

// Waar ben je op de dagen met vrije tijd? Afspraken op een kantoorlocatie
// (postcode van het kantoor, uit de ONS-locatie; zie domain/offices.js) en
// andere afspraken met een cliënt (postcode van de cliënt, uit de details).
// Geen labelcontrole. Zo telt een tussendoor
// terug naar kantoor mee. ALLEEN postcodes: geen adres, geen naam.
// -> { 'YYYY-MM-DD': [{ startMin, endMin, pc, soort: 'client'|'kantoor', kantoor? }] }
function huisbezoekenPerDag(alles, datums) {
  const gezien = Object.create(null);
  const opDag = alles.filter(function (e) {
    if (!(e.layer === 'events' && datums[e.date] && !e.allDay && e.startMs != null && e.endMs != null)) return false;
    // Dezelfde afspraak bij meerdere medewerkers (of twee keer opgehaald): één keer.
    const k = (e.id != null ? e.id : '') + '|' + e.date + '|' + e.startMs;
    if (gezien[k]) return false;
    gezien[k] = true;
    return true;
  });
  const limiet = createLimiter(3), uit = {};
  const zet = function (e, extra) {
    const dag = new Date(e.startMs); dag.setHours(0, 0, 0, 0);
    (uit[e.date] = uit[e.date] || []).push(Object.assign({
      startMin: Math.round((e.startMs - dag.getTime()) / 60000),
      endMin: Math.round((e.endMs - dag.getTime()) / 60000)
    }, extra));
  };
  return Promise.all(opDag.map(function (e) {
    const k = officeForLocation(e.locationName);
    if (k && k.postcode) { zet(e, { pc: k.postcode, soort: 'kantoor', kantoor: k.name }); return null; }
    if (!isAtClient(e, false)) return null;
    const url = e.detailsUrl || (e.occurrenceId ? _apiUrl('eventDetails', { inviteeId: e.inviteeId, occurrenceId: e.occurrenceId }) : null);
    if (!url) return null;
    return limiet(function () { return getJson(url); }).then(function (d) {
      const pc = postcodeFromAddress(addressFromDetails(d));
      if (pc) zet(e, { pc: pc, soort: 'client' });
    }, function () {});
  })).then(function () {
    Object.keys(uit).forEach(function (d) { uit[d].sort(function (a, b) { return a.startMin - b.startMin; }); });
    return uit;
  });
}

// minutes: gewenste duur; weeks: hoe ver vooruit (1-8); tot: 'YYYY-MM-DD'
// (optioneel) zoekt tot en met die datum en gaat voor op weeks. metBezoeken:
// ook de postcodes van de afspraken op die dagen meegeven (afstand).
// Staan er meerdere agenda's open (/invitees/13970,45267/...), dan zoekt hij
// tijd waarop IEDEREEN vrij is: alles wat bij één van hen bezet is, telt als
// bezet. veel: alle vrije blokken in de periode (meerdere afspraken plannen).
// ONS' eigen overlapcontrole per blok doet het zijpaneel, als de lijst er al
// staat (onsCheck zegt of die controle bekend is).
// van: 'YYYY-MM-DD' (optioneel, met tot): zoeken vanaf die dag i.p.v. vandaag,
// zonder grens hoe ver vooruit (weekraster: één week per keer).
// dagen: [1..5] (optioneel): alleen vrije tijd op deze weekdagen (1 = maandag).
// limiet (optioneel): hoeveel vrije blokken (lijst: 'Meer laden'), max. 400.
export function findFreeSlots(minutes, weeks, tot, metBezoeken, veel, van, dagen, limiet) {
  const ids = agendaIds();
  if (!ids.length) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  minutes = parseInt(minutes, 10);
  if (!(minutes >= 5)) return Promise.reject(new Error('Kies een duur.'));
  weeks = Math.max(1, Math.min(8, parseInt(weeks, 10) || 2));
  const nu = new Date();
  let vandaag = nu;
  // Aantal kalenderdagen. (Niet 'dagen' noemen: dat is het weekdagfilter.)
  let aantalDagen = weeks * 7;
  const totDatum = /^\d{4}-\d{2}-\d{2}$/.test(String(tot || '')) ? String(tot) : '';
  // Vanaf een latere dag (middernacht): dan telt 'nu' niet mee.
  const vanDatum = totDatum && /^\d{4}-\d{2}-\d{2}$/.test(String(van || '')) ? String(van) : '';
  if (vanDatum) {
    const pv = vanDatum.split('-');
    const vanDag = new Date(+pv[0], +pv[1] - 1, +pv[2]);
    if (vanDag > nu) vandaag = vanDag;
  }
  const startMs = vandaag === nu ? Date.now() : vandaag.getTime();
  if (totDatum) {
    const p = totDatum.split('-');
    const eind = new Date(+p[0], +p[1] - 1, +p[2]);
    const begin = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
    aantalDagen = Math.round((eind - begin) / 86400000) + 1;
    if (aantalDagen < 1) return Promise.reject(new Error('Kies een datum vanaf vandaag.'));
    if (aantalDagen > MAX_ZOEK_DAGEN) return Promise.reject(new Error('Kies een datum binnen een jaar.'));
  }
  const laatste = new Date(vandaag); laatste.setDate(laatste.getDate() + aantalDagen - 1);
  const laatsteYmd = agendaYmd(laatste);
  const weken = weekStartsBetween(agendaYmd(vandaag), laatsteYmd);
  const maxRes = veel ? 400 : maxBlokken(limiet, totDatum ? 40 : 12);
  // Hooguit 4 verzoeken tegelijk naar ONS. (Niet 'limiet' noemen: dat is
  // het aantal blokken dat het zijpaneel vraagt.)
  const wachtrij = createLimiter(4);
  const week = function (start) { return weekVoor(ids, start, wachtrij); };
  const plat = function (a) { return Array.isArray(a) ? [].concat.apply([], a.map(plat)) : [a]; };
  const win = workWindow();
  // Vrije blokken in wat er tot nu toe is opgehaald (t/m eindYmd).
  function reken(alles, fd, eindYmd) {
    const eindDag = new Date(+eindYmd.slice(0, 4), +eindYmd.slice(5, 7) - 1, +eindYmd.slice(8, 10));
    const begin = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
    const dagenTot = Math.round((eindDag - begin) / 86400000) + 1;
    // Op een feestdag geen vrije tijd.
    const feest = holidaysBetween(fd, agendaYmd(vandaag), eindYmd);
    const isFeest = {}; feest.forEach(function (h) { isFeest[h.date] = true; });
    // Reserveringen houden tijd vast maar bezetten hem niet: apart houden.
    const isRes = function (e) { return e.layer === 'reservations' || e.type === 'reservation'; };
    const reserveringen = reservationBlocks(alles.filter(isRes));
    const bezet = alles.filter(function (e) { return !isRes(e); });
    const gaps = findFreeGaps(bezet, {
      now: startMs, days: dagenTot, minMinutes: minutes, stepMin: 15,
      windowStart: win.start, windowEnd: win.end, maxResults: maxRes,
      skipDates: isFeest, weekdays: weekdagen(dagen),
      // Eigen werktijden per dag (een vrije dag: geen vrije tijd).
      dayWindow: agendaPage.workHours ? function (weekday) { return workWindowFor(agendaPage.workHours, weekday); } : null
    });
    // Per blok de reserveringen erin (voor elke begintijd in het zijpaneel) en
    // die het begin van het blok raken.
    gaps.forEach(function (g) {
      g.reservations = reservationsOverlapping(reserveringen, g.date, g.startMin, g.endMin);
    });
    return { bezet: bezet, gaps: gaps, feest: feest };
  }
  // Een stuk weken ophalen en rekenen; is de lijst nog niet vol, dan het
  // volgende stuk. lastDate is de laatste dag die echt bekeken is: daar gaat
  // Meer laden verder.
  function stuk(i, alles) {
    const deze = weken.slice(i, i + WEKEN_PER_KEER);
    return Promise.all([Promise.all(deze.map(week)), holidays()]).then(function (r) {
      alles = alles.concat(plat(r[0]));
      const klaar = i + WEKEN_PER_KEER >= weken.length;
      const zondag = plusDagen(deze[deze.length - 1], 6);
      const eindYmd = klaar || zondag > laatsteYmd ? laatsteYmd : zondag;
      const u = reken(alles, r[1], eindYmd);
      if (!klaar && u.gaps.length < maxRes) return stuk(i + WEKEN_PER_KEER, alles);
      const res = { minutes: minutes, weeks: weeks, to: totDatum, lastDate: eindYmd, windowStart: win.start, windowEnd: win.end, gaps: u.gaps, holidays: u.feest, invitees: ids.length,
        // Of ONS' overlapcontrole bekend is: dan kijkt het zijpaneel de eerste
        // blokken daar na, als de lijst er al staat.
        onsCheck: overlapCheckStatus() };
      volgendeWeekVooraf(ids, eindYmd);
      if (!metBezoeken) return res;
      const datums = {}; u.gaps.forEach(function (g) { datums[g.date] = true; });
      return huisbezoekenPerDag(u.bezet, datums).then(function (v) { res.visits = v; return res; }, function () { res.visits = {}; return res; });
    });
  }
  return stuk(0, []);
}
