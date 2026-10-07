// Productieverloop: de geregistreerde directe, indirecte en reistijd per week
// over een periode.
// Per week dezelfde berekening als het weekoverzicht (registratie-details per
// week, services/ons-api/calendar.js), zodat de grafiek en het weekoverzicht
// nooit verschillende getallen tonen.
//
// PRIVACY: alleen minuten, weeknummers en datums. Geen namen.

import { currentInviteeId } from './navigation.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaWeekNumber, agendaYmd } from '../../core/datetime.js';
import { ACTIVE_PROFILE } from '../../config/app-config.js';
import { declarabiliteitPct } from '../../domain/declarabiliteit.js';
import { weekStartsBetween } from '../../domain/open-registrations.js';
import { createLimiter, fetchWeekRegistrationDeclarabiliteit } from '../../services/ons-api/calendar.js';

// Hooguit zoveel aanroepen tegelijk naar ONS, over alle weken samen.
const GELIJKTIJDIG = 8;
// Een week die je net hebt berekend, hoeft binnen tien minuten niet opnieuw.
const WEEK_TTL_MS = 10 * 60 * 1000;

export const MAX_PRODUCTION_WEEKS = 26;

// Standaardperiode: de laatste acht weken t/m vandaag.
export function defaultProductionFrom() {
  var d = new Date(); d.setDate(d.getDate() - 7 * 7);
  return agendaYmd(d);
}

// Eén week samenvatten tot de getallen die de grafiek en de tabel nodig hebben.
export function productionWeekRow(weekStart, summary, profile) {
  var s = summary || {};
  var dec = declarabiliteitPct(s, profile);
  return {
    weekStart: weekStart,
    week: agendaWeekNumber(weekStart),
    directMinutes: s.directMinutes || 0,
    indirectMinutes: s.indirectMinutes || 0,
    travelMinutes: s.travelMinutes || 0,
    clientMinutes: s.clientMinutes || 0,
    nonClientMinutes: s.nonClientMinutes || 0,
    totalMinutes: s.totalMinutes || 0,
    declarabelPct: dec.pct,
    count: s.count || 0
  };
}

// Alle weken tegelijk ophalen, met één gedeelde begrenzer (GELIJKTIJDIG) voor
// alle aanroepen samen. onProgress(klaar, totaal). Een mislukte week laat de
// berekening mislukken: een gat in de grafiek zou eruitzien als een week
// zonder productie.
export function computeProduction(fromYmd, toYmd, onProgress) {
  var id = currentInviteeId(null) || resolveInviteeId();
  if (id == null) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  if (!fromYmd || !toYmd) return Promise.reject(new Error('Kies een begin- en einddatum.'));
  if (fromYmd > toYmd) return Promise.reject(new Error('De begindatum ligt na de einddatum.'));
  var today = agendaYmd(new Date());
  if (toYmd > today) toYmd = today; // toekomstige weken hebben nog geen registraties
  var weeks = weekStartsBetween(fromYmd, toYmd);
  if (!weeks.length) return Promise.reject(new Error('Ongeldige periode.'));
  if (weeks.length > MAX_PRODUCTION_WEEKS) return Promise.reject(new Error('Periode te lang (hooguit ' + MAX_PRODUCTION_WEEKS + ' weken).'));
  var prof = (typeof ACTIVE_PROFILE !== 'undefined') ? ACTIVE_PROFILE : null;
  var limiter = createLimiter(GELIJKTIJDIG);
  var klaar = 0;
  return Promise.all(weeks.map(function (start) {
    return fetchWeekRegistrationDeclarabiliteit(id, start, { limiter: limiter, ttlMs: WEEK_TTL_MS }).then(function (summary) {
      klaar++;
      if (onProgress) { try { onProgress(klaar, weeks.length); } catch (e) {} }
      return productionWeekRow(start, summary, prof);
    }, function (e) {
      throw new Error('Week ' + (agendaWeekNumber(start) || start) + ' kon niet worden opgehaald (' + ((e && e.message) || 'fout') + ').');
    });
  })).then(function (rows) { return { from: fromYmd, to: toYmd, weeks: rows }; });
}
