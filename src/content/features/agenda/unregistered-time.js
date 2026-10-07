// Ongeregistreerde tijd per dag en aankomende tijd, uit de DOM of uit de
// week-API.

import { agendaPage } from './state.js';
import {
  classifyOccurrence,
  isClientAppointment,
  isDeclared,
  isWontDeclare,
  occurrenceIsPast,
  occurrenceName,
  occurrenceOverdue24h,
} from './occurrences.js';
import { apiClientPresentById } from './week-overview.js';
import { ONS } from '../../ons/selectors.js';
import { APP_CONFIG } from '../../config/app-config.js';
import { _excludeWeekendYmd } from '../../domain/registrations.js';
import { _entryMinutes } from '../../domain/agenda-entries.js';

export function computeTotals() {
  const past = {};
  const future = { client: 0, overig: 0 };
  let occs;
  try { occs = document.querySelectorAll(ONS.occurrenceBase); }
  catch (e) { return { past: past, future: future }; }
  const seen = new Set();
  occs.forEach((occ) => {
    if (occ.getAttribute('data-type') !== 'event') return;
    const date = occ.getAttribute('data-date'); if (!date) return;
    const id = occ.getAttribute('data-id'); // dubbele weergaven (grid/lijst) niet dubbel tellen
    if (id) { if (seen.has(id)) return; seen.add(id); }
    if (isWontDeclare(occ)) return; // hoeft nooit geregistreerd
    const cls = classifyOccurrence(occ);
    if (cls === 'skip') return; // vrije dag
    const dur = parseInt(occ.getAttribute('data-duration'), 10) || 0;
    if (occurrenceIsPast(occ, date)) {
      if (isDeclared(occ)) return; // verleden: alleen ongeregistreerd
      if (!past[date]) past[date] = { client: 0, overig: 0, lateMin: 0, lateCount: 0 };
      past[date][cls] += dur;
      // Te laat: meer dan 24 uur na afloop nog niet geregistreerd.
      if (occurrenceOverdue24h(occ, date)) { past[date].lateMin += dur; past[date].lateCount++; }
    } else {
      future[cls] += dur; // toekomst: alle aankomende afspraken
    }
  });
  return { past: past, future: future };
}
// 'declared' vs 'not-declared' uit het classes-veld van de API-afspraak.
function _isDeclaredClasses(classes) {
  var c = ' ' + String(classes || '') + ' ';
  if (/not-declared/.test(c)) return false;
  return /declared/.test(c);
}
// API-variant van computeTotals: gebruikt de opgehaalde week-afspraken (_agLastEntries)
// i.p.v. een DOM-scan. Regel: een afspraak in het VERLEDEN (afgelopen) die nog NIET
// 'declared' is en waaraan een cliënt en/of uursoort hangt, is ongeregistreerde tijd
// (planning = realisatie -> we gebruiken de geplande duur). Geen weekenden.
export function computeTotalsApi() {
  var past = {}, future = { client: 0, overig: 0 };
  var now = Date.now();
  var entries = agendaPage._agLastEntries || [];
  var lateH = (APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.lateThresholdHours > 0) ? APP_CONFIG.generalSettings.lateThresholdHours : 24;
  entries.forEach(function (e) {
    if (!e || e.type !== 'event' || e.allDay) return;
    var date = e.date; if (!date) return;
    if (_excludeWeekendYmd(date)) return; // geen weekenden (tenzij ingesteld)
    var hasClient = !!e.clientPresent;
    var hasUursoort = !!(e.hourType && String(e.hourType).trim());
    if (!hasClient && !hasUursoort) return; // geen cliënt én geen uursoort -> pauze/vrije dag e.d.
    var dur = _entryMinutes(e); if (!(dur > 0)) return;
    var startMs = (e.startMs != null) ? e.startMs : Date.parse(date + 'T00:00:00');
    var endMs = (e.endMs != null) ? e.endMs : (startMs + dur * 60000);
    var cls = hasClient ? 'client' : 'overig';
    if (endMs <= now) {
      if (_isDeclaredClasses(e.classes)) return; // al geregistreerd
      if (!past[date]) past[date] = { client: 0, overig: 0, lateMin: 0, lateCount: 0 };
      past[date][cls] += dur;
      if (endMs <= now - lateH * 3600000) { past[date].lateMin += dur; past[date].lateCount++; }
    } else {
      future[cls] += dur;
    }
  });
  return { past: past, future: future };
}
// Nog niet afgeronde (niet-declared) registraties in de huidige weergave.
export function listUnfinished() {
  const out = [];
  let occs;
  try { occs = document.querySelectorAll(ONS.occurrenceBase); }
  catch (e) { return out; }
  const seen = new Set();
  occs.forEach((occ) => {
    if (occ.getAttribute('data-type') !== 'event') return;
    const date = occ.getAttribute('data-date'); if (!date) return;
    const id = occ.getAttribute('data-id');
    if (id) { if (seen.has(id)) return; seen.add(id); }
    if (isWontDeclare(occ)) return;
    if (classifyOccurrence(occ) === 'skip') return;
    if (isDeclared(occ)) return; // al afgerond
    // Cliënt-check: eerst de API (is er een cliënt gekoppeld?), anders het label.
    var apiClient = apiClientPresentById(id);
    var isClient = (apiClient != null) ? apiClient : isClientAppointment(occ);
    out.push({ id: id || '', name: occurrenceName(occ), time: occ.getAttribute('data-time') || '', client: isClient, el: occ });
  });
  out.sort((a, b) => a.time.localeCompare(b.time));
  return out;
}
