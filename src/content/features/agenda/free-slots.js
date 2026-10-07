// Planhulp: vrije tijd in de komende weken voor een afspraak van een gekozen
// duur. Haalt per week alles op wat tijd kan bezetten (ONS-afspraken,
// onbeschikbaarheid, Outlook-afspraken, geplande bezoeken) en rekent in
// domain/free-slots.js.

import { currentInviteeId, currentInviteeIds } from './navigation.js';
import { activeZones } from './zones.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';
import { mapAgendaWeekResponse } from '../../domain/agenda-entries.js';
import { findFreeGaps } from '../../domain/free-slots.js';
import { weekStartsBetween } from '../../domain/open-registrations.js';
import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { getJson } from '../../services/ons-api/http.js';
import { createLimiter } from '../../services/ons-api/calendar.js';

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

// minutes: gewenste duur; weeks: hoe ver vooruit (1-8).
// Staan er meerdere agenda's open (/invitees/13970,45267/...), dan zoekt hij
// tijd waarop IEDEREEN vrij is: alles wat bij één van hen bezet is, telt als
// bezet.
export function findFreeSlots(minutes, weeks) {
  var ids = currentInviteeIds();
  if (!ids.length) { var een = currentInviteeId(null) || resolveInviteeId(); if (een != null) ids = [String(een)]; }
  if (!ids.length) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  minutes = parseInt(minutes, 10);
  if (!(minutes >= 5)) return Promise.reject(new Error('Kies een duur.'));
  weeks = Math.max(1, Math.min(8, parseInt(weeks, 10) || 2));
  var vandaag = new Date();
  var tot = new Date(vandaag); tot.setDate(tot.getDate() + weeks * 7 - 1);
  var weken = weekStartsBetween(agendaYmd(vandaag), agendaYmd(tot));
  var limiet = createLimiter(4);
  var haal = function (sjabloon, laag, start, id) {
    return limiet(function () { return getJson(_apiUrl(sjabloon, { inviteeId: id, date: start })); })
      .then(function (j) { return mapAgendaWeekResponse(j).map(function (e) { e.layer = laag; return e; }); });
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
        haal('weekPlannedVisits', 'planned_visits', start, id).catch(zonder)
      ]));
    });
  });
  return Promise.all(taken).then(function (perWeek) {
    var alles = [].concat.apply([], perWeek.map(function (w) { return [].concat.apply([], w); }));
    var win = workWindow();
    var gaps = findFreeGaps(alles, {
      now: Date.now(), days: weeks * 7, minMinutes: minutes, stepMin: 15,
      windowStart: win.start, windowEnd: win.end, maxResults: 12
    });
    return { minutes: minutes, weeks: weeks, windowStart: win.start, windowEnd: win.end, gaps: gaps, invitees: ids.length };
  });
}
