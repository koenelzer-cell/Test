// Een afspraak in ONS maken zonder het afspraakformulier (planhulp).
//
// Hetzelfde verzoek als het formulier van ONS verstuurt (POST /calendar/events):
// medewerker(s), cliënt met per cliënt een uursoort (client_information
// -> hour_type_id), afspraaktype (label_ids), naam, begin- en eindtijd.
//
// 'meta' (instellingen van het formulier, bijv. extended_workflow) leert de
// hulp van een afspraak die de medewerker zelf via het formulier opslaat;
// daarvan bewaren we alleen ja/nee- en getalwaarden (learnEventMeta).

import { isoLocalWithOffset } from './open-registrations.js';

// product_list -> [{ id, name, recent }] (ontdubbeld op id, 'Onlangs gebruikt' eerst).
// Een item is [naam, id, activiteiten, …].
export function parseProductOptions(json) {
  var groepen = json && Array.isArray(json.basic_list) ? json.basic_list : [];
  var uit = [], gezien = Object.create(null);
  ['Onlangs gebruikt', 'Geadviseerd', 'Toegestaan'].forEach(function (cat) {
    groepen.forEach(function (g) {
      if (!Array.isArray(g) || g[0] !== cat || !Array.isArray(g[1])) return;
      g[1].forEach(function (item) {
        if (!Array.isArray(item)) return;
        var naam = String(item[0] == null ? '' : item[0]).trim(), id = item[1];
        if (!naam || !(typeof id === 'number' || /^\d+$/.test(String(id)))) return;
        id = Number(id);
        if (gezien[id]) return;
        gezien[id] = true;
        uit.push({ id: id, name: naam, recent: cat === 'Onlangs gebruikt' });
      });
    });
  });
  return uit;
}

// available_labels -> [{ id, name }]
export function parseLabels(json) {
  return (Array.isArray(json) ? json : []).filter(function (l) { return l && l.id != null && l.name; })
    .map(function (l) { return { id: Number(l.id), name: String(l.name) }; });
}

// Alleen ja/nee, getallen en null uit meta; geen teksten of lijsten.
export function learnEventMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  var uit = {}, n = 0;
  Object.keys(meta).forEach(function (k) {
    var v = meta[k];
    if (!/^[a-z_]{1,60}$/.test(k)) return;
    if (typeof v === 'boolean' || v === null || (typeof v === 'number' && isFinite(v))) { uit[k] = v; n++; }
  });
  return n ? uit : null;
}

// 'Face to face' + 'Tamara Test' -> 'Face to face - Tamara'
export function defaultEventName(labelName, clientName) {
  var voornaam = String(clientName || '').trim().split(/\s+/)[0] || '';
  var l = String(labelName || '').trim();
  return l && voornaam ? l + ' - ' + voornaam : (l || voornaam || 'Afspraak');
}

// spec: { date, startMin, minutes, employeeIds: [..], clients: [{ id, hourTypeId }],
//         labelId, name, comment } -> { event } of null als iets ontbreekt.
export function buildEventPayload(spec, meta) {
  spec = spec || {};
  var start = spec.startMin, eind = start + spec.minutes;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(spec.date || '')) || !(start >= 0) || !(spec.minutes > 0) || eind >= 24 * 60) return null;
  var emp = (spec.employeeIds || []).map(Number).filter(function (x) { return x > 0; });
  var cl = (spec.clients || []).filter(function (c) { return c && Number(c.id) > 0 && Number(c.hourTypeId) > 0; });
  if (!emp.length || !cl.length || cl.length !== (spec.clients || []).length) return null;
  var info = {};
  cl.forEach(function (c) { info[Number(c.id)] = { hour_type_id: Number(c.hourTypeId), care_order_external_id: null, activity_ids: [] }; });
  var ev = {
    valid_from: spec.date,
    start_time: isoLocalWithOffset(spec.date, start),
    end_time: isoLocalWithOffset(spec.date, eind),
    client_ids: cl.map(function (c) { return Number(c.id); }),
    client_information: info,
    client_present: true,
    clients: [],
    comment: String(spec.comment || ''),
    custom_location: null,
    employee_ids: emp,
    employees: [],
    group: null,
    groups: [],
    hour_type_id: null,
    label_ids: Number(spec.labelId) > 0 ? [Number(spec.labelId)] : [],
    labels: [],
    location: null,
    location_id: null,
    name: String(spec.name || 'Afspraak').slice(0, 200),
    team_ids: [],
    teams: [],
    travel_time_after: 0,
    travel_time_before: 0
  };
  var m = learnEventMeta(meta);
  if (m) ev.meta = m;
  return { event: ev };
}
