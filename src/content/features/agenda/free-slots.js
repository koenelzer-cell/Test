// Planhulp: vrije tijd in de komende weken voor een afspraak van een gekozen
// duur. Haalt per week de afspraken en de afwezigheid op en rekent in
// domain/free-slots.js.

import { currentInviteeId } from './navigation.js';
import { activeZones } from './zones.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';
import { mapAgendaWeekResponse } from '../../domain/agenda-entries.js';
import { findFreeGaps } from '../../domain/free-slots.js';
import { weekStartsBetween } from '../../domain/open-registrations.js';
import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { getJson } from '../../services/ons-api/http.js';
import { createLimiter } from '../../services/ons-api/calendar.js';

// Werkvenster (minuten) en pauzezones uit de gekozen dagindeling.
export function workWindow() {
  var z = activeZones() || [];
  if (!z.length) return { start: 8 * 60, end: 17 * 60, blocked: [] };
  var start = Math.round(Math.min.apply(null, z.map(function (x) { return x.from; })) * 60);
  var end = Math.round(Math.max.apply(null, z.map(function (x) { return x.to; })) * 60);
  var blocked = z.filter(function (x) { return /pauze/i.test(x.label || ''); })
    .map(function (x) { return { from: Math.round(x.from * 60), to: Math.round(x.to * 60) }; });
  return { start: start, end: end, blocked: blocked };
}

// minutes: gewenste duur; weeks: hoe ver vooruit (1-8).
export function findFreeSlots(minutes, weeks) {
  var id = currentInviteeId(null) || resolveInviteeId();
  if (id == null) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  minutes = parseInt(minutes, 10);
  if (!(minutes >= 5)) return Promise.reject(new Error('Kies een duur.'));
  weeks = Math.max(1, Math.min(8, parseInt(weeks, 10) || 2));
  var vandaag = new Date();
  var tot = new Date(vandaag); tot.setDate(tot.getDate() + weeks * 7 - 1);
  var weken = weekStartsBetween(agendaYmd(vandaag), agendaYmd(tot));
  var limiet = createLimiter(4);
  var haal = function (sjabloon, laag, start) {
    return limiet(function () { return getJson(_apiUrl(sjabloon, { inviteeId: id, date: start })); })
      .then(function (j) { return mapAgendaWeekResponse(j).map(function (e) { e.layer = laag; return e; }); });
  };
  return Promise.all(weken.map(function (start) {
    return Promise.all([
      haal('weekEvents', 'events', start),
      // Afwezigheid (verlof): mislukt dat, dan gewoon zonder.
      haal('weekUnavailabilities', 'unavailabilities', start).catch(function () { return []; })
    ]);
  })).then(function (perWeek) {
    var alles = [].concat.apply([], perWeek.map(function (w) { return w[0].concat(w[1]); }));
    var win = workWindow();
    var gaps = findFreeGaps(alles, {
      now: Date.now(), days: weeks * 7, minMinutes: minutes, stepMin: 15,
      windowStart: win.start, windowEnd: win.end, blocked: win.blocked, maxResults: 12
    });
    return { minutes: minutes, weeks: weeks, windowStart: win.start, windowEnd: win.end, gaps: gaps };
  });
}
