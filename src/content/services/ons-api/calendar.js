// Agenda- en registratiegegevens ophalen (week-entries, registratiedetails,
// widget).

import { resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';
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
import { haalWeek } from './week-cache.js';

// De afspraken van de week waarin `date` valt. Altijd vers; het antwoord gaat
// ook in het weekgeheugen, zodat de planhulp deze week niet nog eens ophaalt.
export function fetchInviteeWeek(inviteeId, date) {
  const id = (inviteeId != null) ? inviteeId : resolveInviteeId();
  if (id == null) return Promise.reject(new Error('geen invitee-id gevonden'));
  const d = agendaYmd(date) || agendaYmd(new Date());
  return haalWeek('weekEvents', id, d, { vers: true });
}
// Fetch de afgeronde registraties (sessie-gebruiker) voor één dag; gepagineerd.
function fetchEmployeeRegistrations(date, opts) {
  opts = opts || {};
  const d = agendaYmd(date) || agendaYmd(new Date());
  let limit = opts.limit || 50, maxPages = opts.maxPages || 8, all = [];
  function page(offset, n) {
    return getJson(_apiUrl('employeeRegistrations', { date: d, offset: offset, limit: limit }))
      .then(function (j) {
        const rows = _regUnwrap(j); all = all.concat(rows);
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
    let results = new Array(items.length), i = 0, active = 0, done = 0;
    if (!items.length) { resolve(results); return; }
    function next() {
      while (active < limit && i < items.length) {
        const idx = i++; active++;
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
// Begrenzer die over meerdere weken heen geldt: hooguit `n` aanroepen tegelijk.
// Zo kan het productieverloop alle weken tegelijk ophalen zonder ONS te
// overspoelen (week voor week was traag: elke week wachtte op de vorige).
export function createLimiter(n) {
  let active = 0, queue = [];
  function next() {
    if (active >= n || !queue.length) return;
    const job = queue.shift();
    active++;
    Promise.resolve().then(job.fn).then(job.resolve, job.reject).then(function () { active--; next(); });
  }
  return function (fn) {
    return new Promise(function (resolve, reject) { queue.push({ fn: fn, resolve: resolve, reject: reject }); next(); });
  };
}
const _weekRegCache = Object.create(null);
// Weekcijfers uit de registratie-details. opts.limiter: een gedeelde begrenzer
// (createLimiter); zonder begrenzer hooguit 6 details tegelijk. opts.ttlMs: hoe
// lang een eerder opgehaalde week geldig blijft (standaard 2 minuten).
export function fetchWeekRegistrationDeclarabiliteit(inviteeId, date, opts) {
  opts = opts || {};
  const d = agendaYmd(date) || agendaYmd(new Date());
  const cacheKey = inviteeId + '|' + d;
  const cached = _weekRegCache[cacheKey];
  const ttl = opts.ttlMs || 120000;
  if (cached && (Date.now() - cached.ts) < ttl) return Promise.resolve(cached.summary);
  const limit = opts.limiter || null;
  const lijst = function () { return getJson(_apiUrl('weekRegistrations', { inviteeId: inviteeId, date: d })); };
  return (limit ? limit(lijst) : lijst())
    .then(function (j) {
      const occs = parseWeekRegistrationOccurrences(j).slice(0, 200); // veiligheidsplafond
      if (limit) return Promise.all(occs.map(function (o) { return limit(function () { return fetchRegistrationDetails(inviteeId, o.occurrenceId); }); }));
      return _mapPool(occs, 6, function (o) { return fetchRegistrationDetails(inviteeId, o.occurrenceId); });
    })
    .then(function (details) {
      const summary = summarizeWeekRegistrations(details.filter(Boolean));
      _weekRegCache[cacheKey] = { ts: Date.now(), summary: summary };
      return summary;
    });
}
// Kies de beste bron voor de declarabiliteit van de bekeken week: eerst de nauwkeurige
// calendar-registratie-endpoints (per week, ook verleden), anders het widget-endpoint.
export function fetchDeclarabiliteitSummary(date) {
  return Promise.resolve().then(function () {
    const inviteeId = resolveInviteeId();
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
