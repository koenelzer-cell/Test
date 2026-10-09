// Planhulp: vrije tijd in de komende weken voor een afspraak van een gekozen
// duur. Haalt per week alles op wat tijd kan bezetten (ONS-afspraken,
// onbeschikbaarheid, Outlook-afspraken, geplande bezoeken) en rekent in
// domain/free-slots.js.

import { currentInviteeId, currentInviteeIds } from './navigation.js';
import { activeZones } from './zones.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';
import { mapAgendaWeekResponse } from '../../domain/agenda-entries.js';
import { findFreeGaps, reservationBlocks, reservationsOverlapping } from '../../domain/free-slots.js';
import { addressFromDetails, isHomeVisit, postcodeFromAddress } from '../../domain/route.js';
import { officeForLocation } from '../../domain/offices.js';
import { weekStartsBetween } from '../../domain/open-registrations.js';
import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { getJson } from '../../services/ons-api/http.js';
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
//   { date, startMin, minutes } -> Promise<{ status, overlap }>
//   status: 'ready' (overlap true/false/null) | 'unreadable' | 'unknown'
export function checkSlotWithOns(req) {
  req = req || {};
  var status = overlapCheckStatus();
  var startMin = parseInt(req.startMin, 10), minutes = parseInt(req.minutes, 10);
  if (status !== 'ready' || !(startMin >= 0) || !(minutes > 0)) return Promise.resolve({ status: status, overlap: null });
  return fetchEventOverlap({ ids: agendaIds(), date: req.date, startMin: startMin, endMin: startMin + minutes })
    .then(function (o) { return { status: status, overlap: o }; });
}

// Zoeken tot en met een datum: hooguit een half jaar vooruit.
export const MAX_ZOEK_DAGEN = 182;

// Waar ben je op de dagen met vrije tijd? Huisbezoeken (postcode van de
// cliënt, uit de details) en afspraken op een kantoorlocatie (postcode van het
// kantoor, uit de ONS-locatie; zie domain/offices.js). Zo telt een tussendoor
// terug naar kantoor mee. ALLEEN postcodes: geen adres, geen naam.
// -> { 'YYYY-MM-DD': [{ startMin, endMin, pc, soort: 'huis'|'kantoor', kantoor? }] }
function huisbezoekenPerDag(alles, datums) {
  var opDag = alles.filter(function (e) {
    return e.layer === 'events' && datums[e.date] && !e.allDay && e.startMs != null && e.endMs != null;
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
    if (!isHomeVisit(e)) {
      var k = officeForLocation(e.locationName);
      if (k && k.postcode) zet(e, { pc: k.postcode, soort: 'kantoor', kantoor: k.name });
      return null;
    }
    var url = e.detailsUrl || (e.occurrenceId ? _apiUrl('eventDetails', { inviteeId: e.inviteeId, occurrenceId: e.occurrenceId }) : null);
    if (!url) return null;
    return limiet(function () { return getJson(url); }).then(function (d) {
      var pc = postcodeFromAddress(addressFromDetails(d));
      if (pc) zet(e, { pc: pc, soort: 'huis' });
    }, function () {});
  })).then(function () {
    Object.keys(uit).forEach(function (d) { uit[d].sort(function (a, b) { return a.startMin - b.startMin; }); });
    return uit;
  });
}

// minutes: gewenste duur; weeks: hoe ver vooruit (1-8); tot: 'YYYY-MM-DD'
// (optioneel) zoekt tot en met die datum en gaat voor op weeks. metBezoeken:
// ook de postcodes van de huisbezoeken op die dagen meegeven (afstand).
// Staan er meerdere agenda's open (/invitees/13970,45267/...), dan zoekt hij
// tijd waarop IEDEREEN vrij is: alles wat bij één van hen bezet is, telt als
// bezet.
export function findFreeSlots(minutes, weeks, tot, metBezoeken) {
  var ids = agendaIds();
  if (!ids.length) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  minutes = parseInt(minutes, 10);
  if (!(minutes >= 5)) return Promise.reject(new Error('Kies een duur.'));
  weeks = Math.max(1, Math.min(8, parseInt(weeks, 10) || 2));
  var vandaag = new Date();
  var dagen = weeks * 7;
  var totDatum = /^\d{4}-\d{2}-\d{2}$/.test(String(tot || '')) ? String(tot) : '';
  if (totDatum) {
    var p = totDatum.split('-');
    var eind = new Date(+p[0], +p[1] - 1, +p[2]);
    var begin = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
    dagen = Math.round((eind - begin) / 86400000) + 1;
    if (dagen < 1) return Promise.reject(new Error('Kies een datum vanaf vandaag.'));
    if (dagen > MAX_ZOEK_DAGEN) return Promise.reject(new Error('Kies een datum binnen een half jaar.'));
  }
  var laatste = new Date(vandaag); laatste.setDate(laatste.getDate() + dagen - 1);
  var weken = weekStartsBetween(agendaYmd(vandaag), agendaYmd(laatste));
  var limiet = createLimiter(4);
  var haal = function (sjabloon, laag, start, id) {
    return limiet(function () { return getJson(_apiUrl(sjabloon, { inviteeId: id, date: start })); })
      .then(function (j) { return mapAgendaWeekResponse(j).map(function (e) { e.layer = laag; e.inviteeId = id; return e; }); });
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
  return Promise.all(taken).then(function (perWeek) {
    var alles = [].concat.apply([], perWeek.map(function (w) { return [].concat.apply([], w); }));
    // Reserveringen houden tijd vast maar bezetten hem niet: apart houden.
    var isRes = function (e) { return e.layer === 'reservations' || e.type === 'reservation'; };
    var reserveringen = reservationBlocks(alles.filter(isRes));
    alles = alles.filter(function (e) { return !isRes(e); });
    var win = workWindow();
    var gaps = findFreeGaps(alles, {
      now: Date.now(), days: dagen, minMinutes: minutes, stepMin: 15,
      windowStart: win.start, windowEnd: win.end, maxResults: totDatum ? 40 : 12
    });
    // Per blok de reserveringen erin (voor elke begintijd in het zijpaneel) en
    // die het begin van het blok raken.
    gaps.forEach(function (g) {
      g.reservations = reservationsOverlapping(reserveringen, g.date, g.startMin, g.endMin);
    });
    var res = { minutes: minutes, weeks: weeks, to: totDatum, lastDate: agendaYmd(laatste), windowStart: win.start, windowEnd: win.end, gaps: gaps, invitees: ids.length, onsCheck: overlapCheckStatus() };
    var datums = {}; gaps.forEach(function (g) { datums[g.date] = true; });
    var bezoeken = metBezoeken ? huisbezoekenPerDag(alles, datums).then(function (v) { res.visits = v; }, function () { res.visits = {}; }) : Promise.resolve();
    return bezoeken.then(function () { return onsNakijken(res); });
  });
  function onsNakijken(res) {
    if (res.onsCheck !== 'ready') return res;
    var gaps = res.gaps;
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
