// Pure logica rond openstaande registraties: wat telt als 'nog te registreren',
// welke weken een periode beslaat, en het lezen van het antwoord van de
// overlapcontrole van ONS.
//
// PRIVACY: alles hier werkt op tijden, datums, de uursoortnaam en een
// wel/niet-cliënt-vlag. Geen namen, geen titels.

import { _excludeWeekendYmd } from './registrations.js';
import { _entryMinutes } from './agenda-entries.js';
import { format } from 'date-fns';
import { maandagenTussen, uitYmd } from '../../shared/datum.js';

// 'declared' vs 'not-declared' uit het classes-veld van de API-afspraak.
export function isDeclaredClasses(classes) {
  const c = ' ' + String(classes || '') + ' ';
  if (/not-declared/.test(c)) return false;
  return /declared/.test(c);
}

// 'Niet registreren' gemarkeerd in ONS (klasse wont-declare, net als in de DOM).
export function isWontDeclareClasses(classes) {
  return /(^|\s)wont-declare(\s|$)/.test(String(classes || ''));
}

// Eén afspraak uit entries/week beoordelen. Regel (dezelfde als het
// weekoverzicht): een afspraak met een cliënt en/of uursoort, op een werkdag,
// die al afgelopen is en nog niet 'declared' is, is ongeregistreerde tijd.
// Geeft null als de afspraak niet meetelt, anders
//   { date, cls: 'client'|'overig', minutes, startMs, endMs, past, late, declared }.
export function classifyAgendaEntry(e, now, lateMs) {
  if (!e || e.type !== 'event' || e.allDay) return null;
  const date = e.date; if (!date) return null;
  if (_excludeWeekendYmd(date)) return null;
  const hasClient = !!e.clientPresent;
  const hasUursoort = !!(e.hourType && String(e.hourType).trim());
  if (!hasClient && !hasUursoort) return null; // pauze, vrije dag e.d.
  const dur = _entryMinutes(e); if (!(dur > 0)) return null;
  const startMs = (e.startMs != null) ? e.startMs : Date.parse(date + 'T00:00:00');
  const endMs = (e.endMs != null) ? e.endMs : (startMs + dur * 60000);
  const past = endMs <= now;
  return {
    date: date, cls: hasClient ? 'client' : 'overig', minutes: dur,
    startMs: startMs, endMs: endMs, past: past,
    // 'Niet registreren' (wont-declare) telt als afgehandeld, net als geregistreerd.
    declared: isDeclaredClasses(e.classes) || isWontDeclareClasses(e.classes),
    late: past && endMs <= now - lateMs
  };
}

// De maandagen van alle weken die [van, tot] raken, oud naar nieuw. De
// week-endpoint accepteert elke dag in de week; maandag maakt het eenduidig.
// Geeft [] bij een ongeldige of omgekeerde periode.
export function weekStartsBetween(fromYmd, toYmd) {
  return maandagenTussen(fromYmd, toYmd);
}

// Alle opgehaalde afspraken van een periode samenvatten tot open tijd per dag.
// Alleen dagen binnen [van, tot] en alleen afspraken die al afgelopen zijn.
// Dubbele afspraken (zelfde id) tellen één keer.
//   -> { days: [{ date, client, overig, count, lateCount, items: [{ key, occurrenceId, start, minutes, client, late, uursoort }] }],
//        totalMinutes, totalCount, lateCount }
export function summarizeOpenRange(entries, opts) {
  opts = opts || {};
  const now = opts.now != null ? opts.now : Date.now();
  const lateMs = (opts.lateHours > 0 ? opts.lateHours : 24) * 3600000;
  const from = opts.from || '0000-00-00', to = opts.to || '9999-99-99';
  const byDay = Object.create(null), seen = Object.create(null);
  (entries || []).forEach(function (e) {
    if (!e) return;
    if (e.id != null) { const k = String(e.id) + '|' + (e.date || ''); if (seen[k]) return; seen[k] = 1; }
    const c = classifyAgendaEntry(e, now, lateMs);
    if (!c || !c.past || c.declared) return;
    if (c.date < from || c.date > to) return;
    const day = byDay[c.date] || (byDay[c.date] = { date: c.date, client: 0, overig: 0, count: 0, lateCount: 0, items: [] });
    day[c.cls] += c.minutes;
    day.count++;
    if (c.late) day.lateCount++;
    day.items.push({
      // Sleutel om bij een nieuwe controle te zien of deze afspraak is afgewerkt.
      key: (e.id != null ? String(e.id) : 'x') + '|' + c.date + '|' + c.startMs,
      // Voor de knop Registreren: de details van deze afspraak (meta.declareUrl).
      occurrenceId: e.occurrenceId ? String(e.occurrenceId) : null,
      start: c.startMs, minutes: c.minutes, client: c.cls === 'client', late: c.late,
      uursoort: (e.hourType && String(e.hourType).trim()) || ''
    });
  });
  const days = Object.keys(byDay).sort().map(function (d) {
    byDay[d].items.sort(function (x, y) { return x.start - y.start; });
    return byDay[d];
  });
  return {
    days: days,
    totalMinutes: days.reduce(function (t, d) { return t + d.client + d.overig; }, 0),
    totalCount: days.reduce(function (t, d) { return t + d.count; }, 0),
    lateCount: days.reduce(function (t, d) { return t + d.lateCount; }, 0)
  };
}

// Lokale datum + minuten sinds middernacht -> ISO-tijd met de tijdzone van die
// dag, zoals ONS hem meestuurt: 2026-10-06T12:45:00+02:00.
export function isoLocalWithOffset(dag, minutes) {
  let d = uitYmd(dag);
  if (!d || typeof minutes !== 'number' || !(minutes >= 0) || minutes >= 24 * 60) return null;
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutes / 60), minutes % 60);
  return format(d, "yyyy-MM-dd'T'HH:mm:ssxxx");
}
