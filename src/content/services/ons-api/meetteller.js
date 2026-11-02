// Meetteller (beheer: features.meetteller, standaard uit). Telt per soort
// adres de verzoeken van de hulp (http.js) en die van ONS zelf (de main-world
// meldt ze, PAGE_EVENT.REQUEST_SEEN), en telt ze elke 10 seconden op bij de
// telling in chrome.storage.local. Het zijpaneel toont die onder Info.
// Alleen aantallen per soort adres (zie shared/meetteller.js), geen inhoud.

import { APP_CONFIG } from '../../config/app-config.js';
import { onPageEvent, toMainWorld } from '../../core/page-bridge.js';
import { PAGE_COMMAND, PAGE_EVENT } from '../../../shared/messages.js';
import { LOCAL } from '../../../shared/storage-keys.js';
import { isPatroon, meetPatroon, voegTellingToe } from '../../../shared/meetteller.js';

const SCHRIJF_NA_MS = 10000;
let aan = false, buffer = {}, timer = null, stoppen = [];

function tel(patroon, bron) {
  if (!aan || !isPatroon(patroon)) return;
  const b = buffer[patroon] || (buffer[patroon] = { ons: 0, hulp: 0 });
  b[bron]++;
  if (!timer) timer = setTimeout(schrijf, SCHRIJF_NA_MS);
}
// Een verzoek van de hulp zelf (vanuit http.js).
export function telVerzoekVanHulp(url, methode) {
  if (aan) tel(meetPatroon(url, methode, location.origin), 'hulp');
}
function schrijf() {
  clearTimeout(timer); timer = null;
  const delta = buffer; buffer = {};
  if (!Object.keys(delta).length) return;
  try {
    chrome.storage.local.get([LOCAL.METER], function (r) {
      try { chrome.storage.local.set({ [LOCAL.METER]: voegTellingToe(r && r[LOCAL.METER], delta, Date.now()) }); } catch (e) {}
    });
  } catch (e) {}
}
// Aan of uit volgens de configuratie; bij elke wijziging opnieuw aangeroepen.
export function werkMeettellerBij() {
  const moet = !!(APP_CONFIG.features && APP_CONFIG.features.meetteller === true);
  if (moet === aan) return;
  aan = moet;
  toMainWorld(PAGE_COMMAND.SET_METER, { aan: aan });
  if (aan) {
    stoppen.push(onPageEvent(PAGE_EVENT.REQUEST_SEEN, function (d) { tel(d.patroon, 'ons'); }));
    // Laadt de main-world later dan dit script, dan nog een keer.
    stoppen.push(onPageEvent(PAGE_EVENT.MAIN_READY, function () { toMainWorld(PAGE_COMMAND.SET_METER, { aan: true }); }));
    window.addEventListener('pagehide', schrijf);
  } else {
    stoppen.forEach(function (s) { s(); }); stoppen = [];
    window.removeEventListener('pagehide', schrijf);
    schrijf();
  }
}
