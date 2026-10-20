// Pure logica op registraties: responses normaliseren (zonder
// persoonsgegevens) en optellen.

import { APP_CONFIG } from '../config/app-config.js';

// ===== Afgeronde registraties (widget-endpoint van de sessie-gebruiker, per dag) =====
// Anders dan de events/registrations-feed heeft dit endpoint per regel een 'type'
// (direct/indirect/reistijd) + 'duration' in minuten -> de ECHTE directe/indirecte tijd.
export function _regUnwrap(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    const keys = ['data', 'registrations', 'items', 'results', 'content', 'rows'];
    for (let i = 0; i < keys.length; i++) if (Array.isArray(json[keys[i]])) return json[keys[i]];
    if (json.presenceLogs || json.type || json.duration != null || json.startTime) return [json]; // enkel object
  }
  return [];
}
// Platt de respons uit naar losse presence-log-regels. De endpoint geeft REGISTRATIES
// met geneste 'presenceLogs' (duration in MINUTEN, type direct/indirect/travel); soms
// zijn de items al losse regels. Het registratie-niveau (duration in seconden,
// type 'registration') NEGEREN we bewust — dat gaf de 240u-fout.
function _regFlattenLogs(json) {
  const items = _regUnwrap(json), logs = [];
  items.forEach(function (it) {
    if (it && Array.isArray(it.presenceLogs)) { it.presenceLogs.forEach(function (l) { if (l) logs.push(l); }); }
    else if (it && (it.type != null || it.duration != null) && it.type !== 'registration') { logs.push(it); }
  });
  return logs;
}
function _regType(t) {
  const s = String(t == null ? '' : t).toLowerCase();
  if (/indirect/.test(s)) return 'indirect';
  if (/direct/.test(s)) return 'direct';
  if (/travel|reis/.test(s)) return 'travel';
  return 'overig';
}
// Normaliseer één registratieregel — PRIVACY: geen cliëntnaam/bsn, alleen wel/niet cliënt.
export function normalizeRegistrationLine(r) {
  if (!r || typeof r !== 'object') return null;
  const start = r.startTime || r.start_time || null, end = r.endTime || r.end_time || null;
  const dur = (typeof r.duration === 'number') ? r.duration
    : (start && end ? Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60000)) : 0);
  return {
    type: _regType(r.type), minutes: dur,
    date: start ? String(start).slice(0, 10) : null,
    removed: !!r.isRemoved, status: r.status || null,
    clientPresent: !!(r.client && (r.client.id != null || r.client.externalId != null))
  };
}
export function summarizeRegistrations(json) {
  const lines = _regFlattenLogs(json).map(normalizeRegistrationLine).filter(function (x) { return x && !x.removed; });
  let total = 0, direct = 0, indirect = 0, travel = 0, other = 0, clientMin = 0, nonClientMin = 0;
  lines.forEach(function (l) {
    total += l.minutes;
    if (l.type === 'direct') direct += l.minutes;
    else if (l.type === 'indirect') indirect += l.minutes;
    else if (l.type === 'travel') travel += l.minutes;
    else other += l.minutes;
    if (l.clientPresent) clientMin += l.minutes; else nonClientMin += l.minutes;
  });
  const base = direct + indirect;
  return {
    count: lines.length, totalMinutes: total,
    directMinutes: direct, indirectMinutes: indirect, travelMinutes: travel, otherMinutes: other,
    clientMinutes: clientMin, nonClientMinutes: nonClientMin,
    directPct: base > 0 ? Math.round(direct / base * 1000) / 10 : 0, directTargetPct: 80
  };
}
// ===== Declarabiliteit per WEEK via de calendar-registratie-endpoints =====
// Werkt voor elke week die je in de agenda bekijkt, óók weken vóór deze.
//  Stap 1: /calendar/invitee/{id}/entries/week?date=..&layer=registrations
//          &sub_layers[]=registrations/created  -> registraties (occurrence_id) van die week.
//  Stap 2: /calendar/invitee/{id}/registrations/{occurrence_id}/details
//          -> direct_time/indirect_time/travel + hour_type. Gekoppeld op id.
// PRIVACY: we lezen alleen occurrence_id, de tijden en de hour_type-naam (zorgsoort),
// nooit cliëntnaam/bsn/geboortedatum (title/clients-namen worden genegeerd).
// Zaterdag/zondag? Dan niet meetellen.
function _isWeekendYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return false;
  const wd = new Date(+m[1], +m[2] - 1, +m[3]).getDay();
  return wd === 0 || wd === 6;
}
// Instelbaar in het beheerscherm (generalSettings): weekenden meetellen ja/nee en
// de markering waaraan een niet-cliënt uursoort te herkennen is (standaard '*').
export function _agGenSettings() { try { return (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.generalSettings) || {}; } catch (e) { return {}; } }
function _countWeekends() { return !!_agGenSettings().countWeekends; }
export function _excludeWeekendYmd(ymd) { return _isWeekendYmd(ymd) && !_countWeekends(); }
export function _nonClientMarker() { const m = _agGenSettings().nonClientMarker; return (typeof m === 'string' && m) ? m : '*'; }
// Extra (expliciete) lijst van niet-cliënt uursoorten uit het beheerscherm.
function _agListSetting(key, dflt) { try { const v = _agGenSettings()[key]; if (Array.isArray(v)) return v; } catch (e) {} return dflt; }
export function _nonClientUursoortList() { return _agListSetting('nonClientUursoorten', []); }
function _excludedStatuses() { return _agListSetting('excludedRegistrationStatuses', ['do_not_declare']); }
function _excludedCalendarTypes() { return _agListSetting('excludedCalendarTypes', ['unavailability', 'presence']); }
export function parseWeekRegistrationOccurrences(json) {
  let rows = _regUnwrap(json);
  if (!rows.length && json && Array.isArray(json.entries)) rows = json.entries;
  const out = [], seen = Object.create(null);
  const exTypes = _excludedCalendarTypes();
  rows.forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    // Uitgesloten calendar-items (beheerscherm; standaard afwezigheid + aanwezigheid).
    for (let x = 0; x < exTypes.length; x++) { if (r[exTypes[x]]) return; }
    if (r.type != null && String(r.type).toLowerCase() !== 'registration') return;
    const dymd = r.date || (r.start_time ? String(r.start_time).slice(0, 10) : '');
    if (_excludeWeekendYmd(dymd)) return; // geen weekenden (tenzij ingesteld)
    const occ = r.occurrence_id || r.occurrenceId || null;
    if (!occ || seen[occ]) return;
    seen[occ] = 1;
    out.push({ occurrenceId: String(occ), clientPresent: Array.isArray(r.clients) && r.clients.length > 0 });
  });
  return out;
}
// Detail-respons ({registration:{...}} of kaal) -> ALLEEN de niet-gevoelige velden.
// PRIVACY (belangrijk): de detail-respons bevat óók cliënt-/medewerker-PII
// (naam, bsn/identification_no, geboortedatum, adres, telefoon, e-mail, dossier-url,
// declaration.on_date met een naam, enz.). Wij lezen daar BEWUST NIETS van: alleen
// de tijden (getallen), de start/eind-timestamps en de hour_type-naam (zorgsoort,
// geen persoonsgegeven). De rest van het JSON-object blijft onaangeroerd en wordt
// meteen weggegooid (nergens opgeslagen, gelogd of verzonden).
export function parseRegistrationDetails(json) {
  if (!json || typeof json !== 'object') return null;
  // Andere calendar-items dan registraties uitsluiten (beheerscherm; standaard
  // afwezigheid 'unavailability' en aanwezigheid/locatie 'presence' zoals thuiswerken).
  // Die hebben een eigen wrapper en géén registratietijden -> nooit meetellen.
  if (!json.registration) { const exT = _excludedCalendarTypes(); for (let x = 0; x < exT.length; x++) { if (json[exT[x]]) return null; } }
  const r = json.registration ? json.registration : json;
  if (!r || typeof r !== 'object') return null;
  // Uitgesloten registratie-statussen (beheerscherm; standaard 'do_not_declare' = niet
  // declareren). We lezen alleen declaration.status (een enum, geen persoonsgegeven) —
  // nooit declaration.on_date (bevat een naam).
  if (r.declaration && typeof r.declaration === 'object' && r.declaration.status != null) {
    const status = String(r.declaration.status), exS = _excludedStatuses();
    for (let y = 0; y < exS.length; y++) { if (status === String(exS[y])) return null; }
  }
  // Weekenddatum defensief uitsluiten (naast de filter in de weeklijst).
  const dymd = r.date || (r.start_time ? String(r.start_time).slice(0, 10) : '');
  if (_excludeWeekendYmd(dymd)) return null;
  const num = function (v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; };
  const ht = (r.hour_type && typeof r.hour_type === 'object') ? r.hour_type : null;
  let htName = (ht && ht.name != null) ? String(ht.name) : '';
  let htId = (ht && ht.id != null) ? ht.id : null;
  // MULTI-CLIËNT: bij meerdere cliënten is het uursoort op registratie-niveau vaak null
  // en staat het PER CLIËNT onder clients[].hour_type. We lezen daar UITSLUITEND de
  // hour_type (zorgsoortnaam/id) — nooit naam/bsn/adres e.d. van de cliënt.
  if (!htName && Array.isArray(r.clients)) {
    for (let ci = 0; ci < r.clients.length; ci++) {
      const cht = r.clients[ci] && r.clients[ci].hour_type;
      if (cht && cht.name != null && String(cht.name).trim()) { htName = String(cht.name); if (htId == null && cht.id != null) htId = cht.id; break; }
    }
  }
  const direct = num(r.direct_time), indirect = num(r.indirect_time);
  const travel = num(r.travel_time_before) + num(r.travel_time_after);
  // Totale duur uit start/eind (of time_slot.duration in seconden). De niet-cliëntgebonden
  // tijd (pauze/overleg/overig/verplichte nevenactiviteiten) zit NIET in direct/indirect/
  // reis, maar is wél onderdeel van de duur -> anders telt die tijd niet mee.
  let durMin = 0;
  const st = r.start_time, et = r.end_time;
  if (st && et) { const ms = Date.parse(et) - Date.parse(st); if (isFinite(ms) && ms > 0) durMin = Math.round(ms / 60000); }
  if (!durMin && r.time_slot && typeof r.time_slot.duration === 'number') durMin = Math.round(r.time_slot.duration / 60);
  const accounted = direct + indirect + travel;
  const otherMin = Math.max(0, durMin - accounted); // niet-cliënt/overige tijd
  return {
    directMin: direct, indirectMin: indirect, travelMin: travel, otherMin: otherMin,
    durationMin: durMin || accounted,
    hourTypeName: htName,
    hourTypeId: htId
  };
}
// Aggregeer de detailregels tot een summary die declarabiliteitPct begrijpt.
export function summarizeWeekRegistrations(detailsList) {
  let direct = 0, indirect = 0, travel = 0, other = 0, count = 0, byType = Object.create(null);
  const n = function (v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; };
  (detailsList || []).forEach(function (d) {
    if (!d) return;
    const dir = n(d.directMin), ind = n(d.indirectMin), tra = n(d.travelMin), oth = n(d.otherMin);
    count++; direct += dir; indirect += ind; travel += tra; other += oth;
    const name = d.hourTypeName || 'Onbekend';
    // Per uursoort de opbouw bijhouden (direct/indirect/reistijd/overig).
    if (!byType[name]) byType[name] = { type: name, direct: 0, indirect: 0, travel: 0, other: 0 };
    byType[name].direct += dir; byType[name].indirect += ind; byType[name].travel += tra; byType[name].other += oth;
  });
  const clientMin = direct + indirect + travel;        // cliënttijd = direct + indirect + REISTIJD
  const nonClientMin = other;                          // niet-cliënt = pauze/overleg/overig (uursoorten met *)
  const total = direct + indirect + travel + other;    // totale geschreven tijd
  const byHourType = Object.keys(byType).map(function (k) {
    const r = byType[k]; r.minutes = r.direct + r.indirect + r.travel + r.other; return r;
  }).sort(function (a, b) { return b.minutes - a.minutes; });
  return {
    count: count, totalMinutes: total,
    directMinutes: direct, indirectMinutes: indirect, travelMinutes: travel, otherMinutes: other,
    unknownMinutes: other, // 4e verdeling-vak toont de niet-cliënt/overige tijd
    clientMinutes: clientMin, nonClientMinutes: nonClientMin,
    directPct: (direct + indirect) > 0 ? Math.round(direct / (direct + indirect) * 1000) / 10 : 0, directTargetPct: 80,
    byHourType: byHourType,
    byType: byHourType // per-uursoort opbouw; agendaWeekPanelEl toont .minutes
  };
}
