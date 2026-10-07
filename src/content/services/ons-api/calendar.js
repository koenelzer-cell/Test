// Agenda- en registratiegegevens ophalen (week-entries, registratiedetails,
// widget).

import { resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';
import { mapAgendaWeekResponse } from '../../domain/agenda-entries.js';
import {
  _regUnwrap,
  parseRegistrationDetails,
  parseWeekRegistrationOccurrences,
  summarizeRegistrations,
  summarizeWeekRegistrations,
} from '../../domain/registrations.js';
import { _apiUrl } from './endpoints.js';
import { getEmployeeIdAsync } from './employee.js';
import { getJson } from './http.js';

// Fetch de weekafspraken. Relatieve URL => same-origin => de sessiecookie gaat mee.
export function fetchInviteeWeek(inviteeId, date) {
  var id = (inviteeId != null) ? inviteeId : resolveInviteeId();
  if (id == null) return Promise.reject(new Error('geen invitee-id gevonden'));
  var d = agendaYmd(date) || agendaYmd(new Date());
  return getJson(_apiUrl('weekEvents', { inviteeId: id, date: d }))
    .then(function (j) { return mapAgendaWeekResponse(j); });
}
// Fetch de afgeronde registraties (sessie-gebruiker) voor één dag; gepagineerd.
function fetchEmployeeRegistrations(date, opts) {
  opts = opts || {};
  var d = agendaYmd(date) || agendaYmd(new Date());
  var limit = opts.limit || 50, maxPages = opts.maxPages || 8, all = [];
  function page(offset, n) {
    return getJson(_apiUrl('employeeRegistrations', { date: d, offset: offset, limit: limit }))
      .then(function (j) {
        var rows = _regUnwrap(j); all = all.concat(rows);
        if (rows.length >= limit && n + 1 < maxPages) return page(offset + limit, n + 1);
        return all;
      });
  }
  return page(0, 0).then(function (rows) { return summarizeRegistrations(rows); });
}
// Kleine concurrency-pool: draait max 'limit' workers tegelijk (voorkomt tientallen
// gelijktijdige detail-calls).
function _mapPool(items, limit, worker) {
  return new Promise(function (resolve) {
    var results = new Array(items.length), i = 0, active = 0, done = 0;
    if (!items.length) { resolve(results); return; }
    function next() {
      while (active < limit && i < items.length) {
        var idx = i++; active++;
        Promise.resolve().then(function () { return worker(items[idx]); })
          .then(function (r) { results[idx] = r; }, function () { results[idx] = null; })
          .then(function () { active--; done++; if (done === items.length) resolve(results); else next(); });
      }
    }
    next();
  });
}
function fetchRegistrationDetails(inviteeId, occurrenceId) {
  return getJson(_apiUrl('registrationDetails', { inviteeId: inviteeId, occurrenceId: occurrenceId }))
    .then(parseRegistrationDetails)
    .catch(function () { return null; });
}
var _weekRegCache = Object.create(null);
export function fetchWeekRegistrationDeclarabiliteit(inviteeId, date) {
  var d = agendaYmd(date) || agendaYmd(new Date());
  var cacheKey = inviteeId + '|' + d;
  var cached = _weekRegCache[cacheKey];
  if (cached && (Date.now() - cached.ts) < 120000) return Promise.resolve(cached.summary);
  return getJson(_apiUrl('weekRegistrations', { inviteeId: inviteeId, date: d }))
    .then(function (j) {
      var occs = parseWeekRegistrationOccurrences(j).slice(0, 200); // veiligheidsplafond
      return _mapPool(occs, 6, function (o) { return fetchRegistrationDetails(inviteeId, o.occurrenceId); });
    })
    .then(function (details) {
      var summary = summarizeWeekRegistrations(details.filter(Boolean));
      _weekRegCache[cacheKey] = { ts: Date.now(), summary: summary };
      return summary;
    });
}
// Kies de beste bron voor de declarabiliteit van de bekeken week: eerst de nauwkeurige
// calendar-registratie-endpoints (per week, ook verleden), anders het widget-endpoint.
export function fetchDeclarabiliteitSummary(date) {
  return Promise.resolve().then(function () {
    var inviteeId = resolveInviteeId();
    if (inviteeId != null) return inviteeId;
    return getEmployeeIdAsync().catch(function () { return null; });
  }).then(function (inviteeId) {
    if (inviteeId != null) {
      return fetchWeekRegistrationDeclarabiliteit(inviteeId, date)
        .catch(function () { return fetchEmployeeRegistrations(date); });
    }
    return fetchEmployeeRegistrations(date);
  });
}
