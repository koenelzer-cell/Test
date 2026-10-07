// Is het zijpaneel open, en voor welk tabblad?
//
// Het zijpaneel houdt een poort open zolang het zichtbaar is. Daarmee weet de
// ONS-pagina dat hij zijn randlipje (en een eventueel eigen paneel) moet
// verbergen. Gaat het zijpaneel dicht (of de hele browser), dan valt de poort
// vanzelf weg; daar hoeft niemand iets voor op te ruimen.
//
// Precies één tabblad mag voor het zijpaneel melden: het tabblad dat de
// gebruiker op dit moment bekijkt. Anders blijft een agenda-tab op de
// achtergrond zijn weekoverzicht sturen terwijl je op een vragenlijst zit.
//
// Deze toestand staat bewust in variabelen en niet in opslag: de poort zelf
// houdt de worker wakker zolang het zijpaneel open is.

import { MSG, SIDEPANEL_PORT } from '../shared/messages.js';
import { isOnsUrl } from '../shared/ons-hosts.js';

let sidePanelPorts = 0;
let zijpaneelTab = null;   // het ENIGE tabblad dat nu voor het zijpaneel meldt

function stuurStand(tabId, open) {
  if (tabId == null) return;
  try {
    chrome.tabs.sendMessage(tabId, { type: MSG.SIDEPANEL_STATE, open: open },
      function () { void chrome.runtime.lastError; });
  } catch (e) {}
}

function zetZijpaneelTab(tabId) {
  if (zijpaneelTab === tabId) return;
  const vorige = zijpaneelTab;
  zijpaneelTab = tabId;
  if (vorige != null) stuurStand(vorige, false);
  if (tabId != null) stuurStand(tabId, true);
}

export function verversZijpaneelTab() {
  if (sidePanelPorts === 0) { zetZijpaneelTab(null); return; }
  try {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      void chrome.runtime.lastError;
      const t = tabs && tabs[0];
      zetZijpaneelTab(t && isOnsUrl(t.url) ? t.id : null);
    });
  } catch (e) {}
}

export function onConnect(port) {
  if (!port || port.name !== SIDEPANEL_PORT) return;
  sidePanelPorts++;
  verversZijpaneelTab();
  port.onDisconnect.addListener(function () {
    void chrome.runtime.lastError;
    sidePanelPorts = Math.max(0, sidePanelPorts - 1);
    verversZijpaneelTab();
  });
}

export function onTabUpdated(tabId, info) {
  if (info && (info.url || info.status === 'complete')) verversZijpaneelTab();
}

// Een pagina die net geladen is weet nog niet of het zijpaneel openstaat.
// 'Open' geldt alleen voor het tabblad dat de gebruiker nu bekijkt.
export function answerSidePanelQuery(tabId, sendResponse) {
  if (sidePanelPorts === 0 || tabId == null) { try { sendResponse({ open: false }); } catch (e) {} return; }
  try {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      void chrome.runtime.lastError;
      const t = tabs && tabs[0];
      try { sendResponse({ open: !!(t && t.id === tabId) }); } catch (e) {}
    });
  } catch (e) { try { sendResponse({ open: false }); } catch (e2) {} }
}

// Het randlipje in de pagina vraagt hierom. Chrome staat sidePanel.open()
// alleen toe vanuit een gebaar op de BROWSER-UI; een klik op een knop die wij
// in de pagina zetten telt daar formeel niet voor. Lukt het niet, dan zeggen
// we dat eerlijk terug zodat het lipje naar het rechtermuismenu kan wijzen —
// die route werkt altijd, want daar is het gebaar wél van de browser.
const OPEN_ANSWER_TIMEOUT_MS = 600;
export function openSidePanel(tabId, sendResponse) {
  let klaar = false;
  const antwoord = function (ok) {
    if (klaar) return; klaar = true;
    try { sendResponse({ ok: ok }); } catch (e) {}
  };
  try {
    const r = chrome.sidePanel.open({ tabId: tabId });
    if (r && typeof r.then === 'function') r.then(function () { antwoord(true); }, function () { antwoord(false); });
    else antwoord(true);
  } catch (e) { antwoord(false); }
  // Blijft het antwoord uit (oudere Chrome geeft geen promise terug), dan
  // gaan we ervan uit dat het gelukt is — anders krijg je een tip te zien
  // terwijl het paneel gewoon openging.
  setTimeout(function () { antwoord(true); }, OPEN_ANSWER_TIMEOUT_MS);
}
