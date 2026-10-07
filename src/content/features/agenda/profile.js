// Het gekozen team (dagindeling) uit chrome.storage.sync, live gevolgd.

import { schedulePaint } from './painting.js';
import { pushPanelState } from './side-panel-bridge.js';
import { profileExists, PROFILES } from './zones.js';
import { agendaPage } from './state.js';
import { SYNC } from '../../../shared/storage-keys.js';

// Het gekozen profiel komt uit de extensie-popup (chrome.storage.sync, zodat
// de keuze meereist naar andere apparaten). Async geladen, live bijgewerkt.
function applyProfileValue(p) {
  agendaPage.currentProfile = (p && (profileExists(p) || PROFILES[p])) ? p : null;
  if (agendaPage.active) schedulePaint();
  // Meteen doorgeven aan het zijpaneel. Niet wachten op de 300ms-lus: die
  // staat stil zolang de pagina geen focus heeft (document.hasFocus()), en
  // juist tijdens het kiezen in de popup of het zijpaneel is dat zo. Anders
  // blijft er 'Kies eerst een indeling' staan terwijl je die net koos.
  try { pushPanelState(true); } catch (e) {}
}
export function loadProfileFromStorage() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const area = chrome.storage.sync || chrome.storage.local;
    area.get([SYNC.COLOR_PROFILE], function (res) {
      if (res && res[SYNC.COLOR_PROFILE]) { applyProfileValue(res[SYNC.COLOR_PROFILE]); return; }
      // Migratie: eenmalig een oude keuze uit local naar sync overzetten.
      if (chrome.storage.sync && chrome.storage.local) {
        chrome.storage.local.get([SYNC.COLOR_PROFILE], function (loc) {
          if (loc && loc[SYNC.COLOR_PROFILE]) { chrome.storage.sync.set({ [SYNC.COLOR_PROFILE]: loc[SYNC.COLOR_PROFILE] }); applyProfileValue(loc[SYNC.COLOR_PROFILE]); }
          else applyProfileValue(null);
        });
      } else applyProfileValue(null);
    });
  } catch (e) {}
}
// Opstarten: teamkeuze (popup) live volgen.
export function watchProfileChanges() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if ((area === 'sync' || area === 'local') && changes[SYNC.COLOR_PROFILE]) applyProfileValue(changes[SYNC.COLOR_PROFILE].newValue);
      });
    }
  } catch (e) {}
}
