// Planhulp: afspraken in ONS maken zonder het afspraakformulier.
//
// Het zijpaneel vraagt eerst de keuzes op (afspraaktypes en per cliënt de
// toegestane uursoorten, dezelfde API's als het formulier) en stuurt daarna
// de afspraken die de medewerker heeft bevestigd. We maken ze één voor één
// met hetzelfde verzoek als het formulier (domain/event-create.js).
//
// PRIVACY: alleen id's (medewerker, cliënt, uursoort, type) en de naam van de
// afspraak; het verzoek gaat alleen naar dezelfde ONS-omgeving. Van het
// formulier bewaren we alleen de instellingen in 'meta' (ja/nee en getallen).

import { PAGE_BRIDGE } from '../../../shared/messages.js';
import { PAGE_LOCAL } from '../../../shared/storage-keys.js';
import { buildEventPayload, learnEventMeta, parseLabels, parseProductOptions } from '../../domain/event-create.js';
import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { getJson, postJson } from '../../services/ons-api/http.js';
import { currentInviteeId, currentInviteeIds } from './navigation.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { APP_CONFIG } from '../../config/app-config.js';

const META_KEY = PAGE_LOCAL.EVENT_META_TEMPLATE;

export function directCreateEnabled() {
  var f = APP_CONFIG.features || {};
  return f.planner !== false && f.plannerDirect !== false;
}

function medewerkers() {
  var ids = currentInviteeIds();
  if (!ids.length) { var een = currentInviteeId(null) || resolveInviteeId(); if (een != null) ids = [String(een)]; }
  return ids;
}
function leesMeta() {
  try { return learnEventMeta(JSON.parse(localStorage.getItem(META_KEY) || 'null')); } catch (e) { return null; }
}

// clientIds -> Promise<{ labels, hourTypes: { id: [...] }, metaKnown }>
export function eventOptions(clientIds) {
  if (!directCreateEnabled()) return Promise.reject(new Error('Afspraken maken vanuit de planhulp staat uit (beheer).'));
  var ids = medewerkers();
  if (!ids.length) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  var uniek = (clientIds || []).map(String).filter(function (c, i, a) { return /^\d+$/.test(c) && a.indexOf(c) === i; }).slice(0, 10);
  var types = {};
  return Promise.all([
    getJson(_apiUrl('availableLabels')).then(parseLabels, function () { return []; }),
    Promise.all(uniek.map(function (c) {
      return getJson(_apiUrl('productOptions', { employeeId: ids[0], clientId: c })).then(function (j) { types[c] = parseProductOptions(j); }, function () { types[c] = []; });
    }))
  ]).then(function (r) { return { labels: r[0], hourTypes: types, metaKnown: !!leesMeta() }; });
}

// events: [{ date, startMin, minutes, clients: [{ id, hourTypeId }] (of clientId +
//           hourTypeId), labelId, name, travelBefore, travelAfter }]
// post: (url, body) -> Promise (voor tests te vervangen).
export async function createEvents(events, post) {
  if (!directCreateEnabled()) throw new Error('Afspraken maken vanuit de planhulp staat uit (beheer).');
  post = post || postJson;
  var ids = medewerkers();
  if (!ids.length) throw new Error('Open eerst je agenda in ONS.');
  var meta = leesMeta(), results = [];
  for (const e of (events || []).slice(0, 20)) {
    var payload = buildEventPayload({
      date: e.date, startMin: e.startMin, minutes: e.minutes, employeeIds: ids,
      // Eén of meer cliënten, elk met een eigen uursoort.
      clients: Array.isArray(e.clients) ? e.clients.slice(0, 10) : [{ id: e.clientId, hourTypeId: e.hourTypeId }], labelId: e.labelId, name: e.name,
      travelBefore: e.travelBefore, travelAfter: e.travelAfter
    }, meta);
    if (!payload) { results.push({ ok: false, error: 'Onvolledig (cliënt, uursoort of tijd).' }); continue; }
    try { await post(_apiUrl('createEvent'), payload); results.push({ ok: true }); }
    catch (err) { results.push({ ok: false, error: (err && err.message) || 'Mislukt.' }); }
  }
  return results;
}

// Instellingen van het formulier leren als de medewerker zelf een afspraak opslaat.
export function listenForEventMeta() {
  try {
    window.addEventListener('message', function (ev) {
      if (!ev || ev.origin !== location.origin) return;
      if (ev.source && ev.source !== window) return;
      var d = ev.data;
      if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.FROM_MAIN || d.type !== 'eventMeta') return;
      var m = learnEventMeta(d.meta);
      if (m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {} }
    }, false);
  } catch (e) {}
}
