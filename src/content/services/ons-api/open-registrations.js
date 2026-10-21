// Openstaande registraties bij ONS: de overlapcontrole van ONS zelf en de
// week-afspraken van een hele periode.
//
// De overlapcontrole is een ongedocumenteerd endpoint. Wordt het antwoord niet
// herkend, dan geeft hij null en valt de aanroeper terug op de eigen
// berekening.

import { isoLocalWithOffset, weekStartsBetween } from '../../domain/open-registrations.js';
import { parseDetectOverlap } from '../../../shared/overlap.js';
import { _apiUrl } from './endpoints.js';
import { getJson } from './http.js';
import { weekEntries } from './formaat.js';

// Overlapcontrole door ONS: true, false of null (onbekend). Het antwoord wordt
// een minuut onthouden, zodat het compleetheidsvak (dat vaak opnieuw tekent)
// niet bij elke tekening een aanroep doet.
const OVERLAP_TTL_MS = 60000;
const _overlapCache = Object.create(null);
function overlapKey(ymd, startMin, endMin, hourTypeId) {
  return ymd + '|' + startMin + '|' + endMin + '|' + (hourTypeId || '');
}
export function fetchOnsOverlap(ymd, startMin, endMin, hourTypeId) {
  const startTime = isoLocalWithOffset(ymd, startMin);
  const endTime = isoLocalWithOffset(ymd, endMin);
  if (!startTime || !endTime || !(endMin > startMin)) return Promise.resolve(null);
  const key = overlapKey(ymd, startMin, endMin, hourTypeId);
  const c = _overlapCache[key];
  if (c && (Date.now() - c.ts) < OVERLAP_TTL_MS) return c.promise;
  const promise = getJson(_apiUrl('detectOverlap', { date: ymd, startTime: startTime, endTime: endTime, hourTypeId: hourTypeId || '' }))
    .then(parseDetectOverlap)
    .catch(function () { return null; })
    .then(function (v) { _overlapCache[key].value = v; return v; });
  _overlapCache[key] = { ts: Date.now(), promise: promise, value: undefined };
  return promise;
}
// Wat ONS al geantwoord heeft (synchroon): true/false/null, of undefined als
// het antwoord er nog niet is.
export function knownOnsOverlap(ymd, startMin, endMin, hourTypeId) {
  const c = _overlapCache[overlapKey(ymd, startMin, endMin, hourTypeId)];
  if (!c || (Date.now() - c.ts) >= OVERLAP_TTL_MS) return undefined;
  return c.value;
}
export function _setOnsOverlapForTest(ymd, startMin, endMin, value) {
  _overlapCache[overlapKey(ymd, startMin, endMin, '')] = { ts: Date.now(), promise: Promise.resolve(value), value: value };
}

// Alle week-afspraken van de weken die [van, tot] raken. Hooguit 3 weken
// tegelijk, zodat ONS geen tientallen aanroepen tegelijk krijgt.
// onProgress(klaar, totaal) na elke week. Een mislukte week laat de hele
// controle mislukken: een stil ontbrekende week zou 'alles geregistreerd'
// suggereren terwijl dat niet gecontroleerd is.
export const MAX_RANGE_WEEKS = 26;
export function fetchEntriesForRange(inviteeId, fromYmd, toYmd, onProgress) {
  const weeks = weekStartsBetween(fromYmd, toYmd);
  if (!weeks.length) return Promise.reject(new Error('ongeldige periode'));
  if (weeks.length > MAX_RANGE_WEEKS) return Promise.reject(new Error('periode te lang (max ' + MAX_RANGE_WEEKS + ' weken)'));
  const results = new Array(weeks.length);
  let next = 0, done = 0;
  return new Promise(function (resolve, reject) {
    let failed = false;
    function worker() {
      if (failed) return;
      if (next >= weeks.length) return;
      const idx = next++;
      getJson(_apiUrl('weekEvents', { inviteeId: inviteeId, date: weeks[idx] }))
        .then(weekEntries)
        .then(function (rows) {
          results[idx] = rows;
          done++;
          if (onProgress) { try { onProgress(done, weeks.length); } catch (e) {} }
          if (done === weeks.length) resolve([].concat.apply([], results));
          else worker();
        }, function (e) {
          if (failed) return;
          failed = true;
          // Een andere vorm van ONS: die melding zelf, die zegt wat er aan de hand is.
          reject(e && e.name === 'OnsFormaatFout' ? e : new Error('week van ' + weeks[idx] + ' kon niet worden opgehaald (' + ((e && e.message) || 'fout') + ')'));
        });
    }
    for (let i = 0; i < Math.min(3, weeks.length); i++) worker();
  });
}
