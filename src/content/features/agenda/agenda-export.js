// Agenda exporteren (zijpaneel, Excel): alles wat de medewerker aanvinkt uit
// de agenda('s) die open staan, van een begindatum tot en met een einddatum
// (hooguit 26 weken). Per week de gekozen lagen (afspraken, afwezigheid,
// Outlook, geplande bezoeken, reserveringen) en zo nodig de registraties met
// hun details (direct, indirect, reistijd).
//
// PRIVACY: zie domain/agenda-export.js. Altijd vers opgehaald, niets in het
// weekgeheugen of ergens anders bewaard; de regels gaan alleen in het antwoord
// aan het zijpaneel, dat er het bestand van maakt.

import { inviteeName, viewedInviteeIds } from './navigation.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { opNieuwFormulierHost } from '../../ons/nieuwe-formulieren.js';
import { EXPORT_SOORTEN, clientNummersUit, exportRegel, registratieRegel, sorteerRegels } from '../../domain/agenda-export.js';
import { weekStartsBetween } from '../../domain/open-registrations.js';
import { parseRegistrationDetails, parseWeekRegistrationOccurrences } from '../../domain/registrations.js';
import { createLimiter } from '../../services/ons-api/calendar.js';
import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { weekEntriesVoorExport } from '../../services/ons-api/formaat.js';
import { getJson } from '../../services/ons-api/http.js';

export const MAX_EXPORT_WEKEN = 26;
// Hooguit zoveel verzoeken tegelijk naar ONS.
const GELIJKTIJDIG = 6;
// [endpoint, laag, soorten die deze laag nodig hebben]
const LAGEN = [
  ['weekEvents', 'events', ['open', 'geregistreerd', 'nietRegistreren', 'gepland', 'overig']],
  ['weekUnavailabilities', 'unavailabilities', ['onbeschikbaarheid']],
  ['weekOutlook', 'outlook_appointments', ['outlook']],
  ['weekPlannedVisits', 'planned_visits', ['bezoeken']],
  ['weekReservations', 'reservations', ['reserveringen']]
];

// req: { from, to, soorten: [...], clientNummers } ; onProgress(klaar, totaal)
// -> Promise<{ from, to, metNummers, rijen: [...], nummersOntbreken }>
export function agendaExport(req, onProgress) {
  const r = req || {};
  const van = String(r.from || ''), tot = String(r.to || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(van) || !/^\d{4}-\d{2}-\d{2}$/.test(tot)) return Promise.reject(new Error('Kies een begin- en einddatum.'));
  if (van > tot) return Promise.reject(new Error('De begindatum ligt na de einddatum.'));
  const soorten = (Array.isArray(r.soorten) ? r.soorten : []).filter(function (s) { return EXPORT_SOORTEN.indexOf(s) >= 0; });
  if (!soorten.length) return Promise.reject(new Error('Vink aan wat je wilt meenemen.'));
  const weken = weekStartsBetween(van, tot);
  if (!weken.length) return Promise.reject(new Error('Ongeldige periode.'));
  if (weken.length > MAX_EXPORT_WEKEN) return Promise.reject(new Error('Periode te lang (hooguit ' + MAX_EXPORT_WEKEN + ' weken).'));
  const ids = viewedInviteeIds(resolveInviteeId());
  if (!ids.length) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  const metNummers = r.clientNummers === true;
  const now = Date.now();
  const lagen = LAGEN.filter(function (l) { return l[2].some(function (s) { return soorten.indexOf(s) >= 0; }); });
  const metRegistraties = soorten.indexOf('registraties') >= 0;
  const wachtrij = createLimiter(GELIJKTIJDIG);
  let klaar = 0, totaal = 0;
  const taak = function (fn) {
    totaal++;
    return wachtrij(fn).then(function (uit) {
      klaar++;
      if (onProgress) { try { onProgress(klaar, totaal); } catch (e) {} }
      return uit;
    });
  };
  const binnen = function (regel) { return regel && regel.datum <= tot && regel.einddatum >= van; };
  const conceptTeltNiet = opNieuwFormulierHost();

  const voorAgenda = function (id) {
    const agenda = ids.length > 1 ? (inviteeName(id) || String(id)) : '';
    const opts = { soorten: soorten, now: now, metNummers: metNummers, agenda: agenda };
    const gezien = Object.create(null);
    const perWeek = weken.map(function (week) {
      const delen = lagen.map(function (l, i) {
        const p = taak(function () { return getJson(_apiUrl(l[0], { inviteeId: id, date: week })); }).then(function (json) {
          return weekEntriesVoorExport(json, metNummers).map(function (e) {
            // Dezelfde afspraak in twee weken (over middernacht, meerdaags): één keer.
            if (e.id != null) { const k = l[1] + '|' + e.id + '|' + e.date; if (gezien[k]) return null; gezien[k] = 1; }
            return exportRegel(e, l[1], opts);
          }).filter(binnen);
        });
        // Een laag die ONS hier niet heeft (of die mislukt), behalve de afspraken: dan zonder.
        return i === 0 && l[1] === 'events' ? p : p.catch(function () { return []; });
      });
      if (metRegistraties) {
        delen.push(taak(function () { return getJson(_apiUrl('weekRegistrations', { inviteeId: id, date: week })); }).then(function (json) {
          // Hooguit 200 per week; een registratie die in twee weken staat één keer.
          const occs = parseWeekRegistrationOccurrences(json).slice(0, 200).filter(function (o) {
            const k = 'reg|' + o.occurrenceId; if (gezien[k]) return false; gezien[k] = 1; return true;
          });
          return Promise.all(occs.map(function (o) {
            return taak(function () { return getJson(_apiUrl('registrationDetails', { inviteeId: id, occurrenceId: o.occurrenceId })); }).then(function (detail) {
              const d = parseRegistrationDetails(detail, { conceptTeltNiet: conceptTeltNiet });
              if (!d) return null;
              const reg = detail && detail.registration ? detail.registration : detail;
              return registratieRegel(d, metNummers ? clientNummersUit(reg && reg.clients) : null, opts);
            });
          })).then(function (lijst) { return lijst.filter(binnen); });
        }));
      }
      return Promise.all(delen).then(function (stukken) { return [].concat.apply([], stukken); });
    });
    return Promise.all(perWeek).then(function (w) { return [].concat.apply([], w); });
  };

  return Promise.all(ids.map(voorAgenda)).then(function (perAgenda) {
    const rijen = sorteerRegels([].concat.apply([], perAgenda));
    const nummersOntbreken = metNummers ? rijen.filter(function (x) { return x.clienten > 0 && !x.clientNummers; }).length : 0;
    return { from: van, to: tot, metNummers: metNummers, rijen: rijen, nummersOntbreken: nummersOntbreken };
  });
}
