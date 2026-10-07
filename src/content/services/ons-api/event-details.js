// Afspraaklabels uit de details-API: meegelezen via mainworld.js of zelf
// opgehaald.

import { resolveInviteeId } from '../../ons/agenda-location.js';
import { _agEntryLabels } from '../../domain/agenda-entries.js';
import { _apiUrl } from './endpoints.js';
import { getJson } from './http.js';
import { PAGE_BRIDGE } from '../../../shared/messages.js';

/* ===== Afspraaklabels uit de details-API =====
   De detailpopup van een afspraak wordt door ONS gevoed met
     /calendar/invitee/{invitee}/events/{occurrence}/details
   en die respons bevat het label expliciet:
     "labels": [{ "id": 16, "name": "JG Huisbezoek", "icon": "home", ... }]
   Dat is een stuk steviger dan de opmaak van de popup, die ONS regelmatig
   herbouwt. We lezen UITSLUITEND labels[].name en de uursoortnaam — geen
   cliëntgegevens, geen vrije titel.
   ========================================================================== */
// Pel de details-respons af: {data:{…}} / {event:{…}} / {occurrence:{…}} /
// {registration:{…}} of het object zelf.
function _detailsBody(json) {
  if (!json || typeof json !== 'object') return null;
  var keys = ['data', 'event', 'occurrence', 'registration', 'entry'];
  for (var i = 0; i < keys.length; i++) {
    var v = json[keys[i]];
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  }
  return json;
}
// Labelnamen uit een details-respons, als schone tekstlijst.
export function detailsLabelNames(json) {
  var body = _detailsBody(json);
  if (!body) return [];
  return _agEntryLabels(body);
}
// De LAATSTE details-call telt: dat is per definitie de popup die nu open
// staat. De main-world-watcher (mainworld.js) meldt elke details-respons; hier
// bewaren we alleen de labelnamen + het occurrence-id uit de URL.
var _laatsteDetails = null;
var DETAILS_MAX_AGE_MS = 5 * 60 * 1000; // ouder dan dit = niet meer "de open popup"
function _occurrenceIdFromDetailsUrl(url) {
  var m = /\/(?:events|registrations)\/([^/?#]+)\/details/.exec(String(url == null ? '' : url));
  return m ? m[1] : null;
}
// Neem een details-respons op. Geeft de gevonden labelnamen terug (of []).
export function noteDetailsResponse(url, json) {
  var labels = detailsLabelNames(json);
  if (!labels.length) return [];
  _laatsteDetails = {
    occurrenceId: _occurrenceIdFromDetailsUrl(url),
    url: String(url == null ? '' : url),
    labels: labels,
    ts: Date.now()
  };
  return labels;
}
export function clearLaatsteDetails() { _laatsteDetails = null; } // testhaak
// De labels van de laatst geziene details-call, mits vers genoeg.
export function laatsteDetailsLabels() {
  if (!_laatsteDetails) return [];
  if ((Date.now() - _laatsteDetails.ts) > DETAILS_MAX_AGE_MS) return [];
  return _laatsteDetails.labels.slice();
}
// Haal de details van één afspraak zelf op (relatief pad => same-origin => de
// sessiecookie gaat mee). Vangnet voor als de watcher niets zag.
function fetchEventDetailsLabels(occurrenceId, inviteeId) {
  var id = (inviteeId != null) ? inviteeId : resolveInviteeId();
  if (id == null || !occurrenceId) return Promise.resolve([]);
  var url = _apiUrl('eventDetails', { inviteeId: id, occurrenceId: occurrenceId });
  return getJson(url)
    .then(function (j) { return noteDetailsResponse(url, j); })
    .catch(function () { return []; });
}
// Het occurrence-id van de open detailpopup uit de opmaak: ONS zet in de popup
// altijd wel één link/attribuut met /events/{id}/details of /registrations/{id}/.
export function occurrenceIdFromPopover(scope) {
  var root = scope || document;
  var nodes;
  try { nodes = root.querySelectorAll('a[href], [data-qa-url]'); } catch (e) { return null; }
  for (var i = 0; i < nodes.length; i++) {
    var v = nodes[i].getAttribute('data-qa-url') || nodes[i].getAttribute('href') || '';
    var m = /\/(?:events|registrations)\/([^/?#]+)\/(?:details|edit)/.exec(v);
    if (m) return m[1];
  }
  return null;
}
// Zodra een detailpopup opent, zorgen we dat de labels klaarstaan vóór er op
// 'Registreren' wordt geklikt. Zag de main-world-watcher de details-call van
// ONS zelf al (het normale geval), dan doen we niets — anders halen we ze één
// keer zelf op.
export function warmPopoverDetails(scope) {
  if (laatsteDetailsLabels().length) return Promise.resolve([]);
  var occ = occurrenceIdFromPopover(scope);
  if (!occ) return Promise.resolve([]);
  return fetchEventDetailsLabels(occ);
}
// De main-world-watcher (mainworld.js) meldt elke details-respons van ONS zelf.
// Alleen berichten uit dit venster en deze origin worden vertrouwd.
// Opstarten: luister naar de details-meldingen van mainworld.js.
export function listenForMainWorldDetails() {
  try {
    window.addEventListener('message', function (ev) {
      if (!ev || ev.origin !== location.origin) return;
      if (ev.source && ev.source !== window) return;
      var d = ev.data;
      if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.FROM_MAIN || d.type !== 'details') return;
      if (!Array.isArray(d.labels) || !d.labels.length) return;
      _laatsteDetails = {
        occurrenceId: _occurrenceIdFromDetailsUrl(d.url) || null,
        url: String(d.url == null ? '' : d.url),
        labels: d.labels.map(function (l) { return String(l == null ? '' : l).trim(); }).filter(Boolean),
        ts: Date.now()
      };
    }, false);
  } catch (e) {}
}
