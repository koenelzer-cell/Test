// Pure logica rond openstaande registraties: wat telt als 'nog te registreren',
// welke weken een periode beslaat, en het lezen van het antwoord van de
// overlapcontrole van ONS.
//
// PRIVACY: alles hier werkt op tijden, datums, de uursoortnaam en een
// wel/niet-cliënt-vlag. Geen namen, geen titels.

import { _excludeWeekendYmd } from './registrations.js';
import { _entryMinutes } from './agenda-entries.js';

// 'declared' vs 'not-declared' uit het classes-veld van de API-afspraak.
export function isDeclaredClasses(classes) {
  var c = ' ' + String(classes || '') + ' ';
  if (/not-declared/.test(c)) return false;
  return /declared/.test(c);
}

// Eén afspraak uit entries/week beoordelen. Regel (dezelfde als het
// weekoverzicht): een afspraak met een cliënt en/of uursoort, op een werkdag,
// die al afgelopen is en nog niet 'declared' is, is ongeregistreerde tijd.
// Geeft null als de afspraak niet meetelt, anders
//   { date, cls: 'client'|'overig', minutes, startMs, endMs, past, late, declared }.
export function classifyAgendaEntry(e, now, lateMs) {
  if (!e || e.type !== 'event' || e.allDay) return null;
  var date = e.date; if (!date) return null;
  if (_excludeWeekendYmd(date)) return null;
  var hasClient = !!e.clientPresent;
  var hasUursoort = !!(e.hourType && String(e.hourType).trim());
  if (!hasClient && !hasUursoort) return null; // pauze, vrije dag e.d.
  var dur = _entryMinutes(e); if (!(dur > 0)) return null;
  var startMs = (e.startMs != null) ? e.startMs : Date.parse(date + 'T00:00:00');
  var endMs = (e.endMs != null) ? e.endMs : (startMs + dur * 60000);
  var past = endMs <= now;
  return {
    date: date, cls: hasClient ? 'client' : 'overig', minutes: dur,
    startMs: startMs, endMs: endMs, past: past,
    declared: isDeclaredClasses(e.classes),
    late: past && endMs <= now - lateMs
  };
}

// 'YYYY-MM-DD' -> lokale Date om 00:00, of null.
function parseYmd(ymd) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return null;
  var d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d.getTime()) ? null : d;
}
function fmtYmd(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

// De maandagen van alle weken die [van, tot] raken, oud naar nieuw. De
// week-endpoint accepteert elke dag in de week; maandag maakt het eenduidig.
// Geeft [] bij een ongeldige of omgekeerde periode.
export function weekStartsBetween(fromYmd, toYmd) {
  var a = parseYmd(fromYmd), b = parseYmd(toYmd);
  if (!a || !b || a > b) return [];
  var mon = new Date(a.getFullYear(), a.getMonth(), a.getDate() - ((a.getDay() + 6) % 7));
  var out = [];
  while (mon <= b) {
    out.push(fmtYmd(mon));
    mon = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
  }
  return out;
}

// Alle opgehaalde afspraken van een periode samenvatten tot open tijd per dag.
// Alleen dagen binnen [van, tot] en alleen afspraken die al afgelopen zijn.
// Dubbele afspraken (zelfde id) tellen één keer.
//   -> { days: [{ date, client, overig, count, lateCount, items: [{ start, minutes, client, uursoort }] }],
//        totalMinutes, totalCount, lateCount }
export function summarizeOpenRange(entries, opts) {
  opts = opts || {};
  var now = opts.now != null ? opts.now : Date.now();
  var lateMs = (opts.lateHours > 0 ? opts.lateHours : 24) * 3600000;
  var from = opts.from || '0000-00-00', to = opts.to || '9999-99-99';
  var byDay = Object.create(null), seen = Object.create(null);
  (entries || []).forEach(function (e) {
    if (!e) return;
    if (e.id != null) { var k = String(e.id) + '|' + (e.date || ''); if (seen[k]) return; seen[k] = 1; }
    var c = classifyAgendaEntry(e, now, lateMs);
    if (!c || !c.past || c.declared) return;
    if (c.date < from || c.date > to) return;
    var day = byDay[c.date] || (byDay[c.date] = { date: c.date, client: 0, overig: 0, count: 0, lateCount: 0, items: [] });
    day[c.cls] += c.minutes;
    day.count++;
    if (c.late) day.lateCount++;
    day.items.push({
      start: c.startMs, minutes: c.minutes, client: c.cls === 'client',
      uursoort: (e.hourType && String(e.hourType).trim()) || ''
    });
  });
  var days = Object.keys(byDay).sort().map(function (d) {
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

/* ── Antwoord van ONS lezen ──────────────────────────────────────────────
   Dit endpoint is niet gedocumenteerd. De vorm van het antwoord is
   afgeleid, niet gegarandeerd. Daarom: herkennen wat we kunnen en anders
   null teruggeven, zodat de aanroeper op zijn eigen berekening terugvalt in
   plaats van op een gok te handelen. */

// /worksheet/registrations/detect_overlap -> true (overlap), false (geen) of
// null (antwoord niet herkend).
export function parseDetectOverlap(json) {
  if (typeof json === 'boolean') return json;
  if (Array.isArray(json)) return json.length > 0;
  if (!json || typeof json !== 'object') return null;
  var boolKeys = ['overlap', 'overlaps', 'has_overlap', 'hasOverlap', 'overlapping', 'is_overlapping', 'isOverlapping'];
  for (var i = 0; i < boolKeys.length; i++) {
    var v = json[boolKeys[i]];
    if (typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.length > 0;
  }
  var listKeys = ['registrations', 'overlapping_registrations', 'conflicts', 'items', 'data'];
  for (var j = 0; j < listKeys.length; j++) {
    if (Array.isArray(json[listKeys[j]])) return json[listKeys[j]].length > 0;
  }
  return null;
}

// Lokale datum + minuten sinds middernacht -> ISO-tijd met de tijdzone van die
// dag, zoals ONS hem meestuurt: 2026-10-06T12:45:00+02:00.
export function isoLocalWithOffset(ymd, minutes) {
  var d = parseYmd(ymd);
  if (!d || typeof minutes !== 'number' || !(minutes >= 0) || minutes >= 24 * 60) return null;
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutes / 60), minutes % 60);
  var off = -d.getTimezoneOffset();
  var sign = off >= 0 ? '+' : '-';
  var abs = Math.abs(off);
  var pad = function (n) { return ('0' + n).slice(-2); };
  return fmtYmd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00' +
    sign + pad(Math.floor(abs / 60)) + ':' + pad(abs % 60);
}
