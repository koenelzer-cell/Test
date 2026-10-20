// Verhouding direct / indirect / reistijd per cliëntgebonden uursoort, voor
// elke week (de pagina 'Verhouding per uursoort' kan terug- en vooruitbladeren).
//
//   deze week en eerder  -> wat er GEREGISTREERD is (registratie-details,
//                           dezelfde berekening als het weekoverzicht)
//   latere weken         -> wat er GEPLAND staat, met direct/indirect uit de
//                           labels (domain/agenda-entries.js computeDirectIndirect;
//                           geen label maar wel een cliënt = direct)
//
// PRIVACY: alleen uursoortnamen en minuten.

import { inviteeName, viewedInviteeIds } from './navigation.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaWeekNumber, agendaYmd } from '../../core/datetime.js';
import { APP_CONFIG } from '../../config/app-config.js';
import { computeDirectIndirect, _entryMinutes } from '../../domain/agenda-entries.js';
import { _isClientUursoortName } from '../../domain/hour-types.js';
import { weekStartsBetween } from '../../domain/open-registrations.js';
import { fetchInviteeWeek, fetchWeekRegistrationDeclarabiliteit } from '../../services/ons-api/calendar.js';

function round(n) { return Math.round(n || 0); }

// Geplande afspraken van een week -> rijen per cliëntgebonden uursoort.
export function plannedRatioRows(entries, forms) {
  forms = forms || (APP_CONFIG && APP_CONFIG.registrationForms) || [];
  const map = Object.create(null);
  (entries || []).forEach(function (e) {
    if (!e || e.type !== 'event' || e.allDay) return;
    let naam = (e.hourType && String(e.hourType).trim()) || '';
    if (!naam && !e.clientPresent) return;          // geen uursoort en geen cliënt: pauze e.d.
    if (naam && !_isClientUursoortName(naam)) return; // niet-cliënturen tellen hier niet mee
    if (!naam) naam = 'Zonder uursoort';
    const di = computeDirectIndirect(e, forms);
    const r = map[naam] || (map[naam] = { type: naam, direct: 0, indirect: 0, travel: 0, other: 0, minutes: 0 });
    r.direct += di.directMin; r.indirect += di.indirectMin; r.travel += di.travelMin; r.other += di.unknownMin;
    r.minutes += _entryMinutes(e) + di.travelMin;
  });
  return Object.keys(map).map(function (k) {
    const r = map[k];
    return { type: r.type, direct: round(r.direct), indirect: round(r.indirect), travel: round(r.travel), other: round(r.other), minutes: round(r.minutes) };
  }).sort(function (a, b) { return b.minutes - a.minutes; });
}

// date: een dag in de gewenste week. -> { weekStart, week, mode, rows, persons }
// Bij meerdere agenda's naast elkaar: per collega (persons); rows is die van de eerste.
export function fetchWeekRatio(date) {
  const ids = viewedInviteeIds(resolveInviteeId());
  if (!ids.length) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  const start = weekStartsBetween(date, date)[0];
  if (!start) return Promise.reject(new Error('Ongeldige datum.'));
  return Promise.all(ids.map(function (id) { return ratioVoor(id, start); })).then(function (lijst) {
    const r = lijst[0];
    r.persons = lijst.map(function (x, i) { return { id: ids[i], name: ids.length > 1 ? inviteeName(ids[i]) : '', rows: x.rows }; });
    return r;
  });
}
function ratioVoor(id, start) {
  const vandaag = agendaYmd(new Date());
  const dezeWeek = weekStartsBetween(vandaag, vandaag)[0];
  const basis = { weekStart: start, week: agendaWeekNumber(start) };
  if (start > dezeWeek) {
    return fetchInviteeWeek(id, start).then(function (entries) {
      return Object.assign(basis, { mode: 'gepland', rows: plannedRatioRows(entries) });
    });
  }
  return fetchWeekRegistrationDeclarabiliteit(id, start).then(function (s) {
    const rows = ((s && s.byHourType) || []).filter(function (r) { return r && r.type && _isClientUursoortName(r.type); })
      .map(function (r) { return { type: r.type, direct: r.direct || 0, indirect: r.indirect || 0, travel: r.travel || 0, other: r.other || 0, minutes: r.minutes || 0 }; });
    return Object.assign(basis, { mode: 'geregistreerd', rows: rows });
  });
}
