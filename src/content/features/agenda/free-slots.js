// Planhulp: vrije tijd in de komende weken voor een afspraak van een gekozen
// duur. Haalt per week alles op wat tijd kan bezetten (ONS-afspraken,
// onbeschikbaarheid, Outlook-afspraken, geplande bezoeken) en rekent in
// domain/free-slots.js.

import { currentInviteeId, currentInviteeIds } from './navigation.js';
import { activeZones } from './zones.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';
import { findFreeGaps, reservationBlocks, reservationsOverlapping } from '../../domain/free-slots.js';
import { addressFromDetails, isAtClient, postcodeFromAddress } from '../../domain/route.js';
import { officeForLocation } from '../../domain/offices.js';
import { weekStartsBetween } from '../../domain/open-registrations.js';
import { holidaysBetween, parseHolidays } from '../../domain/holidays.js';
import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { getJson } from '../../services/ons-api/http.js';
import { weekEntries } from '../../services/ons-api/formaat.js';
import { createLimiter } from '../../services/ons-api/calendar.js';
import { fetchEventOverlap, overlapCheckStatus } from '../../services/ons-api/event-overlap.js';

// Werkvenster (minuten): vroegste begin en laatste eind van de gekozen
// dagindeling. Alleen als grens; wat er BINNEN dat venster bezet is, komt uit
// de agenda zelf (afspraken en onbeschikbaarheid), niet uit de kleurzones.
export function workWindow() {
  var z = activeZones() || [];
  if (!z.length) return { start: 8 * 60, end: 17 * 60 };
  var start = Math.round(Math.min.apply(null, z.map(function (x) { return x.from; })) * 60);
  var end = Math.round(Math.max.apply(null, z.map(function (x) { return x.to; })) * 60);
  return { start: start, end: end };
}

function agendaIds() {
  var ids = currentInviteeIds();
  if (!ids.length) { var een = currentInviteeId(null) || resolveInviteeId(); if (een != null) ids = [String(een)]; }
  return ids;
}

// Eén tijdvak bij ONS zelf nakijken (overlap_detection).
//   { date, startMin, minutes, clientIds? } -> Promise<{ status, overlap }>
//   clientIds: ook de gekozen cliënt(en) meenemen (Afspraak maken).
//   status: 'ready' (overlap true/false/null) | 'unreadable' | 'unknown'
export function checkSlotWithOns(req) {
  req = req || {};
  var status = overlapCheckStatus();
  var startMin = parseInt(req.startMin, 10), minutes = parseInt(req.minutes, 10);
  if (status !== 'ready' || !(startMin >= 0) || !(minutes > 0)) return Promise.resolve({ status: status, overlap: null });
  var cl = (Array.isArray(req.clientIds) ? req.clientIds : []).map(String).filter(function (c) { return /^\d+$/.test(c); }).slice(0, 10);
  return fetchEventOverlap({ ids: agendaIds(), clientIds: cl, date: req.date, startMin: startMin, endMin: startMin + minutes })
    .then(function (o) { return { status: status, overlap: o }; });
}

// Zoeken tot en met een datum: hooguit een jaar vooruit in één keer. 'Meer
// laden' gaat in stukjes van een week verder (met van) en heeft geen grens.
export const MAX_ZOEK_DAGEN = 366;

// Feestdagen uit ONS, één keer per pagina opgehaald. Mislukt het, dan zonder
// (en de volgende zoekactie probeert het opnieuw).
var feestdagenBelofte = null;
export function holidays() {
  if (!feestdagenBelofte) {
    feestdagenBelofte = Promise.resolve().then(function () { return getJson(_apiUrl('holidays')); })
      .then(parseHolidays).catch(function () { feestdagenBelofte = null; return []; });
  }
  return feestdagenBelofte;
}
export function _forgetHolidays() { feestdagenBelofte = null; }

var ONS_CONTROLE_MAX = 12;
export function maxBlokken(limiet, standaard) {
  var n = parseInt(limiet, 10);
  return n > 0 ? Math.min(400, n) : standaard;
}

// [1..5] -> gesorteerd en uniek; leeg of alle vijf = geen filter (null).
export function weekdagen(dagen) {
  var d = (Array.isArray(dagen) ? dagen : []).map(Number).filter(function (x, i, a) { return x >= 1 && x <= 5 && a.indexOf(x) === i; }).sort();
  return d.length && d.length < 5 ? d : null;
}

// Waar ben je op de dagen met vrije tijd? Afspraken op een kantoorlocatie
// (postcode van het kantoor, uit de ONS-locatie; zie domain/offices.js) en
// andere afspraken met een cliënt (postcode van de cliënt, uit de details).
// Geen labelcontrole. Zo telt een tussendoor
// terug naar kantoor mee. ALLEEN postcodes: geen adres, geen naam.
// -> { 'YYYY-MM-DD': [{ startMin, endMin, pc, soort: 'client'|'kantoor', kantoor? }] }
function huisbezoekenPerDag(alles, datums) {
  var gezien = Object.create(null);
  var opDag = alles.filter(function (e) {
    if (!(e.layer === 'events' && datums[e.date] && !e.allDay && e.startMs != null && e.endMs != null)) return false;
    // Dezelfde afspraak bij meerdere medewerkers (of twee keer opgehaald): één keer.
    var k = (e.id != null ? e.id : '') + '|' + e.date + '|' + e.startMs;
    if (gezien[k]) return false;
    gezien[k] = true;
    return true;
  });
  var limiet = createLimiter(3), uit = {};
  var zet = function (e, extra) {
    var dag = new Date(e.startMs); dag.setHours(0, 0, 0, 0);
    (uit[e.date] = uit[e.date] || []).push(Object.assign({
      startMin: Math.round((e.startMs - dag.getTime()) / 60000),
      endMin: Math.round((e.endMs - dag.getTime()) / 60000)
    }, extra));
  };
  return Promise.all(opDag.map(function (e) {
    var k = officeForLocation(e.locationName);
    if (k && k.postcode) { zet(e, { pc: k.postcode, soort: 'kantoor', kantoor: k.name }); return null; }
    if (!isAtClient(e, false)) return null;
    var url = e.detailsUrl || (e.occurrenceId ? _apiUrl('eventDetails', { inviteeId: e.inviteeId, occurrenceId: e.occurrenceId }) : null);
    if (!url) return null;
    return limiet(function () { return getJson(url); }).then(function (d) {
      var pc = postcodeFromAddress(addressFromDetails(d));
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
// bezet. veel: alle vrije blokken in de periode (meerdere afspraken plannen);
// dan geen ONS-controle per blok (het zijpaneel controleert het voorstel).
// van: 'YYYY-MM-DD' (optioneel, met tot): zoeken vanaf die dag i.p.v. vandaag,
// zonder grens hoe ver vooruit (weekraster: één week per keer).
// dagen: [1..5] (optioneel): alleen vrije tijd op deze weekdagen (1 = maandag).
// limiet (optioneel): hoeveel vrije blokken (lijst: 'Meer laden'), max. 400.
export function findFreeSlots(minutes, weeks, tot, metBezoeken, veel, van, dagen, limiet) {
  var ids = agendaIds();
  if (!ids.length) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  minutes = parseInt(minutes, 10);
  if (!(minutes >= 5)) return Promise.reject(new Error('Kies een duur.'));
  weeks = Math.max(1, Math.min(8, parseInt(weeks, 10) || 2));
  var nu = new Date();
  var vandaag = nu;
  var dagen = weeks * 7;
  var totDatum = /^\d{4}-\d{2}-\d{2}$/.test(String(tot || '')) ? String(tot) : '';
  // Vanaf een latere dag (middernacht): dan telt 'nu' niet mee.
  var vanDatum = totDatum && /^\d{4}-\d{2}-\d{2}$/.test(String(van || '')) ? String(van) : '';
  if (vanDatum) {
    var pv = vanDatum.split('-');
    var vanDag = new Date(+pv[0], +pv[1] - 1, +pv[2]);
    if (vanDag > nu) vandaag = vanDag;
  }
  var startMs = vandaag === nu ? Date.now() : vandaag.getTime();
  if (totDatum) {
    var p = totDatum.split('-');
    var eind = new Date(+p[0], +p[1] - 1, +p[2]);
    var begin = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
    dagen = Math.round((eind - begin) / 86400000) + 1;
    if (dagen < 1) return Promise.reject(new Error('Kies een datum vanaf vandaag.'));
    if (dagen > MAX_ZOEK_DAGEN) return Promise.reject(new Error('Kies een datum binnen een jaar.'));
  }
  var laatste = new Date(vandaag); laatste.setDate(laatste.getDate() + dagen - 1);
  var weken = weekStartsBetween(agendaYmd(vandaag), agendaYmd(laatste));
  var limiet = createLimiter(4);
  var haal = function (sjabloon, laag, start, id) {
    return limiet(function () { return getJson(_apiUrl(sjabloon, { inviteeId: id, date: start })); })
      .then(function (j) { return weekEntries(j).map(function (e) { e.layer = laag; e.inviteeId = id; return e; }); });
  };
  var zonder = function () { return []; };
  var taken = [];
  ids.forEach(function (id) {
    weken.forEach(function (start) {
      taken.push(Promise.all([
        haal('weekEvents', 'events', start, id),
        // De andere lagen: mislukt er een (laag niet beschikbaar), dan zonder.
        haal('weekUnavailabilities', 'unavailabilities', start, id).catch(zonder),
        haal('weekOutlook', 'outlook_appointments', start, id).catch(zonder),
        haal('weekPlannedVisits', 'planned_visits', start, id).catch(zonder),
        haal('weekReservations', 'reservations', start, id).catch(zonder)
      ]));
    });
  });
  return Promise.all([Promise.all(taken), holidays()]).then(function (r) {
    var perWeek = r[0];
    // Op een feestdag geen vrije tijd.
    var feest = holidaysBetween(r[1], agendaYmd(vandaag), agendaYmd(laatste));
    var isFeest = {}; feest.forEach(function (h) { isFeest[h.date] = true; });
    var alles = [].concat.apply([], perWeek.map(function (w) { return [].concat.apply([], w); }));
    // Reserveringen houden tijd vast maar bezetten hem niet: apart houden.
    var isRes = function (e) { return e.layer === 'reservations' || e.type === 'reservation'; };
    var reserveringen = reservationBlocks(alles.filter(isRes));
    alles = alles.filter(function (e) { return !isRes(e); });
    var win = workWindow();
    var gaps = findFreeGaps(alles, {
      now: startMs, days: dagen, minMinutes: minutes, stepMin: 15,
      windowStart: win.start, windowEnd: win.end, maxResults: veel ? 400 : maxBlokken(limiet, totDatum ? 40 : 12),
      skipDates: isFeest, weekdays: weekdagen(dagen)
    });
    // Per blok de reserveringen erin (voor elke begintijd in het zijpaneel) en
    // die het begin van het blok raken.
    gaps.forEach(function (g) {
      g.reservations = reservationsOverlapping(reserveringen, g.date, g.startMin, g.endMin);
    });
    var res = { minutes: minutes, weeks: weeks, to: totDatum, lastDate: agendaYmd(laatste), windowStart: win.start, windowEnd: win.end, gaps: gaps, holidays: feest, invitees: ids.length, onsCheck: overlapCheckStatus() };
    var datums = {}; gaps.forEach(function (g) { datums[g.date] = true; });
    var bezoeken = metBezoeken ? huisbezoekenPerDag(alles, datums).then(function (v) { res.visits = v; }, function () { res.visits = {}; }) : Promise.resolve();
    return bezoeken.then(function () { return onsNakijken(res); });
  });
  function onsNakijken(res) {
    if (res.onsCheck !== 'ready' || veel) return res;
    // Alleen de eerste blokken (zoveel als vroeger): 'Meer laden' kost zo
    // geen extra controles bij ONS.
    var gaps = res.gaps.slice(0, ONS_CONTROLE_MAX);
    // Kent de hulp ONS' eigen overlapcontrole, dan per blok het begin (met de
    // gekozen duur) daar ook nakijken. Lukt dat niet, dan blijft ons null.
    var nakijk = createLimiter(3);
    return Promise.all(gaps.map(function (g) {
      return nakijk(function () {
        return fetchEventOverlap({ ids: ids, date: g.date, startMin: g.startMin, endMin: g.startMin + minutes });
      }).then(function (o) { g.ons = o; }, function () { g.ons = null; });
    })).then(function () { return res; });
  }
}
