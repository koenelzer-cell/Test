// Pure logica op agenda-entries: normaliseren (zonder persoonsgegevens),
// type/vorm bepalen, weektotalen.

import { APP_CONFIG } from '../config/app-config.js';

// Normaliseer één ruwe entry uit 'entries/week' naar een schoon, stabiel model.
export function mapAgendaEntry(e) {
  if (!e || typeof e !== 'object') return null;
  var ts = e.time_slot || {};
  var start = e.start_time || ts.start_time || ts.start_date_time || null;
  var end = e.end_time || ts.end_time || ts.end_date_time || null;
  var loc = e.location || {};
  return {
    id: (e.id != null ? String(e.id) : null),
    occurrenceId: e.occurrence_id || null,
    date: e.date || (start ? String(start).slice(0, 10) : null),
    start: start,
    end: end,
    startMs: start ? Date.parse(start) : null,
    endMs: end ? Date.parse(end) : null,
    allDay: !!ts.all_day,
    durationSec: (typeof ts.duration === 'number') ? ts.duration : null,
    travelBefore: (ts.travel_time_before != null ? ts.travel_time_before : null),
    travelAfter: (ts.travel_time_after != null ? ts.travel_time_after : null),
    type: e.type || null,
    // Outlook: hoe de afspraak de agenda bezet (busy/oof/tentative/free/
    // workingElsewhere). Geen persoonsgegeven; de planhulp gebruikt het.
    showAs: (e.show_as != null ? String(e.show_as) : null),
    // Alleen de echte uursoort; NIET e.title als fallback — die bevat bij
    // registraties de cliëntnaam (PII).
    hourType: e.hour_type || '',
    recurring: !!e.recurring,
    editable: !!e.is_editable,
    classes: e.classes || '',
    // PRIVACY: cliëntgegevens (naam/bsn/geboortedatum), de vrije titel (e.name) en de
    // opmerking worden bewust NIET overgenomen. Alleen een telling + wel/niet-gekoppeld.
    clientCount: (Array.isArray(e.clients) ? e.clients.length : 0),
    // Medewerkers zonder naam (alleen id's/rol) — geen persoonsnamen in het model.
    employees: (Array.isArray(e.employees) ? e.employees : []).map(function (m) {
      return { id: (m && m.id != null ? m.id : null), externalId: (m && m.external_id != null ? m.external_id : null), authorized: !!(m && m.authorized), inviteeType: (m && m.invitee_type_name) || '' };
    }),
    teams: Array.isArray(e.teams) ? e.teams : [],
    groups: Array.isArray(e.groups) ? e.groups : [],
    labels: Array.isArray(e.labels) ? e.labels : [], // afspraaklabels (voor type/vorm), geen cliëntdata
    detailsUrl: (e.meta && e.meta.detailsUrl) || null,
    // "Cliëntafspraak" = er is een cliënt GEKOPPELD (clients niet leeg), bewust NIET
    // het 'cliënten aanwezig'-vinkje uit de API.
    clientPresent: (Array.isArray(e.clients) && e.clients.length > 0)
  };
}
// Zet de volledige respons ({ data: [...] }) om naar een op starttijd gesorteerde lijst.
export function mapAgendaWeekResponse(json) {
  var rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
  return rows.map(mapAgendaEntry).filter(Boolean)
    .sort(function (a, b) { return (a.startMs || 0) - (b.startMs || 0); });
}
// Duur van een entry in minuten (uit duration in sec, anders uit start/eind).
export function _entryMinutes(e) {
  if (e && typeof e.durationSec === 'number' && e.durationSec > 0) return e.durationSec / 60;
  if (e && e.startMs != null && e.endMs != null && e.endMs > e.startMs) return (e.endMs - e.startMs) / 60000;
  return 0;
}
// ONS-labels van een entry als schone tekstlijst.
export function _agEntryLabels(e) {
  return (e && Array.isArray(e.labels) ? e.labels : []).map(function (l) {
    return String((l && (l.name || l.label || l.title) != null) ? (l.name || l.label || l.title) : (l == null ? '' : l)).trim();
  }).filter(Boolean);
}
// Vertaal één ONS-label naar het ingestelde afspraaktype (choice.label uit het
// beheerscherm, via etiket/etiketten). Geen match -> null.
export function labelToAfspraaktype(labelText, choices) {
  var key = _agNorm(labelText); if (!key) return null;
  choices = choices || ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.choices) || []);
  for (var i = 0; i < choices.length; i++) {
    var c = choices[i]; var ets = [];
    if (Array.isArray(c.etiketten)) ets = ets.concat(c.etiketten);
    if (c.etiket) ets.push(c.etiket);
    if (ets.map(_agNorm).indexOf(key) !== -1) return c.label || null;
  }
  return null;
}
// Het "type" is het afspraaktype uit het beheerscherm (label -> type). Geen label of
// geen match -> "Niet-gedefinieerd". Bewust NOOIT de vrije titel/uursoort/cliëntnaam.
export function agendaEntryType(e, choices) {
  var labels = _agEntryLabels(e);
  for (var i = 0; i < labels.length; i++) {
    var t = labelToAfspraaktype(labels[i], choices);
    if (t) return t;
  }
  return 'Niet-gedefinieerd';
}
// Startverdeling "N% direct/indirect" -> percentage directe tijd (0..100), of null.
export function parseStartVerdeling(sv) {
  var m = /(\d+)\s*%\s*(direct|indirect)/i.exec(String(sv == null ? '' : sv));
  if (!m) return null;
  var pct = Math.max(0, Math.min(100, parseInt(m[1], 10) || 0));
  return /indirect/i.test(m[2]) ? (100 - pct) : pct;
}
function _agNorm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
// Koppel een agenda-entry aan een registratievorm. Volgorde:
//   1) het Labels-veld van de vorm bevat het afspraaklabel,
//   2) de uursoort van de vorm is gelijk aan die van de afspraak,
//   3) laatste redmiddel: de vorm-NAAM is gelijk aan het afspraaklabel.
export function entryToVorm(entry, forms) {
  forms = forms || [];
  if (!entry) return null;
  var labels = _agEntryLabels(entry).map(_agNorm).filter(Boolean);
  for (var i = 0; i < forms.length; i++) {
    var fl = (Array.isArray(forms[i].labels) ? forms[i].labels : []).map(_agNorm);
    if (fl.some(function (x) { return x && labels.indexOf(x) !== -1; })) return forms[i];
  }
  var ht = _agNorm(entry.hourType);
  if (ht) { for (var j = 0; j < forms.length; j++) { if (_agNorm(forms[j].uursoort) === ht) return forms[j]; } }
  for (var k = 0; k < forms.length; k++) {
    var vn = _agNorm(forms[k].vorm);
    if (vn && labels.indexOf(vn) !== -1) return forms[k];
  }
  return null;
}
// Reistijd staat in time_slot.travel_time_* ; aanname: seconden (net als 'duration').
// Klopt de schaal niet, zet deze deler op 1 (dan worden het minuten).
var AGENDA_TRAVEL_DIVISOR = 60;
// Splits de duur van één (geplande) entry in directe/indirecte minuten +
// reistijd. Volgorde:
//   1) het label hoort bij een registratievorm -> de startverdeling van die vorm;
//   2) het label zelf zegt 'direct' of 'indirect';
//   3) geen label, wel een cliënt gekoppeld -> direct;
//   4) anders "onbekend" (niet gokken).
export function computeDirectIndirect(entry, forms) {
  var min = _entryMinutes(entry);
  var travelRaw = ((entry && entry.travelBefore) || 0) + ((entry && entry.travelAfter) || 0);
  var travel = travelRaw / AGENDA_TRAVEL_DIVISOR;
  var vorm = entryToVorm(entry, forms);
  var directPct = vorm ? parseStartVerdeling(vorm.startVerdeling) : null;
  if (directPct == null) {
    var labels = _agEntryLabels(entry).map(_agNorm);
    if (labels.some(function (l) { return /\bindirect\b/.test(l); })) directPct = 0;
    else if (labels.some(function (l) { return /\bdirect\b/.test(l); })) directPct = 100;
    else if (!labels.length && entry && entry.clientPresent) directPct = 100;
  }
  if (directPct == null) return { directMin: 0, indirectMin: 0, unknownMin: min, travelMin: travel };
  var directMin = min * directPct / 100;
  return { directMin: directMin, indirectMin: min - directMin, unknownMin: 0, travelMin: travel };
}
// Tel een lijst genormaliseerde entries op: totaal, cliënt/niet-cliënt, directe/
// indirecte tijd + reistijd (uit de startverdeling van de registratievormen),
// percentage directe tijd t.o.v. 80%, en uitsplitsing per type en per dag.
export function summarizeAgendaWeek(entries, forms, choices) {
  forms = forms || ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.registrationForms) || []);
  choices = choices || ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.choices) || []);
  var list = Array.isArray(entries) ? entries : [];
  var totalMin = 0, clientMin = 0, nonClientMin = 0, directMin = 0, indirectMin = 0, unknownMin = 0, travelMin = 0, typeMap = {}, dateMap = {};
  list.forEach(function (e) {
    var min = _entryMinutes(e);
    totalMin += min;
    if (e && e.clientPresent) clientMin += min; else nonClientMin += min;
    var di = computeDirectIndirect(e, forms);
    directMin += di.directMin; indirectMin += di.indirectMin; unknownMin += di.unknownMin; travelMin += di.travelMin;
    var t = agendaEntryType(e, choices);
    if (!typeMap[t]) typeMap[t] = { type: t, minutes: 0, count: 0 };
    typeMap[t].minutes += min; typeMap[t].count += 1;
    var d = (e && e.date) || 'onbekend';
    if (!dateMap[d]) dateMap[d] = { date: d, minutes: 0, direct: 0, indirect: 0, unknown: 0, travel: 0, count: 0 };
    dateMap[d].minutes += min; dateMap[d].direct += di.directMin; dateMap[d].indirect += di.indirectMin; dateMap[d].unknown += di.unknownMin; dateMap[d].travel += di.travelMin; dateMap[d].count += 1;
  });
  var round = function (m) { return Math.round(m); };
  var byType = Object.keys(typeMap).map(function (k) { return { type: typeMap[k].type, minutes: round(typeMap[k].minutes), count: typeMap[k].count }; })
    .sort(function (a, b) { return b.minutes - a.minutes; });
  var byDate = Object.keys(dateMap).map(function (k) { var r = dateMap[k]; return { date: r.date, minutes: round(r.minutes), direct: round(r.direct), indirect: round(r.indirect), unknown: round(r.unknown), travel: round(r.travel), count: r.count }; })
    .sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  var base = directMin + indirectMin;
  var directPct = base > 0 ? (directMin / base * 100) : 0;
  return {
    count: list.length,
    totalMinutes: round(totalMin), clientMinutes: round(clientMin), nonClientMinutes: round(nonClientMin),
    directMinutes: round(directMin), indirectMinutes: round(indirectMin), unknownMinutes: round(unknownMin), travelMinutes: round(travelMin),
    directPct: Math.round(directPct * 10) / 10, directTargetPct: 80,
    byType: byType, byDate: byDate
  };
}
