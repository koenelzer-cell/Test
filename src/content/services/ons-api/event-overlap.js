// ONS' overlapcontrole voor afspraken (/event_planner/overlap_detection)
// gebruiken vanuit de planhulp.
//
// De vorm van het verzoek leren we van ONS zelf (zie domain/event-overlap.js):
// de main-world-watcher meldt elke aanroep die ONS doet. Het geleerde
// sjabloon staat in de localStorage van de ONS-pagina. Zolang er geen
// sjabloon is, of ONS' antwoord niet te lezen is, geeft de controle null
// ('weet niet') en rekent de planhulp alleen op zijn eigen berekening.

import { PAGE_EVENT } from '../../../shared/messages.js';
import { onPageEvent } from '../../core/page-bridge.js';
import { PAGE_LOCAL } from '../../../shared/storage-keys.js';
import { buildOverlapUrl, learnOverlapTemplate } from '../../domain/event-overlap.js';
import { parseEventOverlap } from '../../../shared/overlap.js';
import { getJson } from './http.js';

const KEY = PAGE_LOCAL.EVENT_OVERLAP_TEMPLATE;

export function loadOverlapTemplate() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || 'null');
    return (t && Array.isArray(t.params)) ? t : null;
  } catch (e) { return null; }
}
function saveOverlapTemplate(t) {
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {}
}

// 'ready': sjabloon en leesbaar antwoord; 'unreadable': sjabloon, maar het
// antwoord van ONS herkennen we niet; 'unknown': nog niets geleerd.
export function overlapCheckStatus() {
  const t = loadOverlapTemplate();
  if (!t) return 'unknown';
  return t.readable ? 'ready' : 'unreadable';
}

// Eén aanroep van ONS verwerken: het adres, en of de main-world het antwoord
// kon lezen.
export function learnFromOnsCall(url, leesbaar) {
  const tpl = learnOverlapTemplate(url);
  if (!tpl) return false;
  tpl.readable = leesbaar === true;
  tpl.learnedAt = Date.now();
  saveOverlapTemplate(tpl);
  return true;
}

export function listenForOnsOverlapCalls() {
  onPageEvent(PAGE_EVENT.OVERLAP, function (d) { learnFromOnsCall(d.url, d.leesbaar === true); });
}

// { ids, date, startMin, endMin } -> Promise<true|false|null>
export function fetchEventOverlap(req) {
  const t = loadOverlapTemplate();
  if (!t || !t.readable) return Promise.resolve(null);
  const url = buildOverlapUrl(t, req);
  if (!url) return Promise.resolve(null);
  return getJson(url).then(parseEventOverlap, function () { return null; });
}
