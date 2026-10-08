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
// Zijpanelen per tabblad: poort -> tabblad waarvoor dat paneel open is.
const paneelTabs = new Map();

/* ── Een zijpaneel per ONS-tabblad ─────────────────────────────────────────
   Het zijpaneel hoort bij het ONS-tabblad waarin je het opent, niet bij het
   hele venster. Ga je naar een ander tabblad, dan verbergt Chrome het; kom je
   terug, dan staat het er weer, uitgeklapt. (Een extensie mag het paneel niet
   zelf openen zonder klik; daarom laten we Chrome het per tabblad onthouden.)
   Buiten ONS staat het paneel uit. */
const PANEEL_PAD = 'pages/sidepanel.html';
function zetOpties(opties) {
  try {
    const r = chrome.sidePanel && chrome.sidePanel.setOptions && chrome.sidePanel.setOptions(opties);
    if (r && typeof r.catch === 'function') r.catch(function () {});
  } catch (e) {}
}
// Alleen bij een wissel opnieuw instellen: binnen ONS navigeren (de agenda is
// een single-page app) mag een open paneel niet herladen.
const tabStand = new Map();
export function syncPanelForTab(tabId, url) {
  if (tabId == null) return;
  const aan = isOnsUrl(url);
  if (tabStand.get(tabId) === aan) return;
  tabStand.set(tabId, aan);
  if (aan) zetOpties({ tabId: tabId, path: PANEEL_PAD, enabled: true });
  else zetOpties({ tabId: tabId, enabled: false });
}
export function ensurePanelForTab(tabId) {
  if (tabId == null) return;
  if (tabStand.get(tabId) !== true) { tabStand.set(tabId, true); zetOpties({ tabId: tabId, path: PANEEL_PAD, enabled: true }); }
}
export function forgetTab(tabId) { tabStand.delete(tabId); }
export function initTabPanels() {
  // Standaard (zonder tabblad) uit; per ONS-tabblad aan.
  zetOpties({ enabled: false });
  try {
    chrome.tabs.query({}, function (tabs) {
      void chrome.runtime.lastError;
      (tabs || []).forEach(function (t) { syncPanelForTab(t.id, t.url); });
    });
  } catch (e) {}
}

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

// Staat er voor dit tabblad een zijpaneel open? Panelen die hun tabblad (nog)
// niet hebben gemeld, gelden zoals vroeger voor elk actief ONS-tabblad.
function paneelVoor(t) {
  if (!t) return false;
  let zonderTab = false;
  for (const id of paneelTabs.values()) { if (id === t.id) return true; if (id == null) zonderTab = true; }
  return zonderTab && isOnsUrl(t.url);
}

export function verversZijpaneelTab() {
  if (sidePanelPorts === 0) { zetZijpaneelTab(null); return; }
  try {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      void chrome.runtime.lastError;
      const t = tabs && tabs[0];
      zetZijpaneelTab(paneelVoor(t) ? t.id : null);
    });
  } catch (e) {}
}

export function onConnect(port) {
  if (!port || port.name !== SIDEPANEL_PORT) return;
  sidePanelPorts++;
  paneelTabs.set(port, null);
  verversZijpaneelTab();
  // Het paneel meldt bij welk tabblad het hoort.
  try {
    port.onMessage.addListener(function (m) {
      if (m && typeof m.tabId === 'number') { paneelTabs.set(port, m.tabId); verversZijpaneelTab(); }
    });
  } catch (e) {}
  port.onDisconnect.addListener(function () {
    void chrome.runtime.lastError;
    sidePanelPorts = Math.max(0, sidePanelPorts - 1);
    paneelTabs.delete(port);
    verversZijpaneelTab();
  });
}

export function onTabUpdated(tabId, info, tab) {
  // Naar of binnen ONS: paneel aan voor dit tabblad; ergens anders heen: uit
  // (dat sluit een open paneel in dit tabblad).
  if (info && (info.url || info.status === 'loading')) syncPanelForTab(tabId, (tab && tab.url) || info.url);
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
      try { sendResponse({ open: !!(t && t.id === tabId && paneelVoor(t)) }); } catch (e) {}
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
    // Zeker weten dat het paneel voor dit tabblad aan staat (ook direct na
    // een update van de extensie, vóór de eerste navigatie).
    ensurePanelForTab(tabId);
    const r = chrome.sidePanel.open({ tabId: tabId });
    if (r && typeof r.then === 'function') r.then(function () { antwoord(true); }, function () { antwoord(false); });
    else antwoord(true);
  } catch (e) { antwoord(false); }
  // Blijft het antwoord uit (oudere Chrome geeft geen promise terug), dan
  // gaan we ervan uit dat het gelukt is — anders krijg je een tip te zien
  // terwijl het paneel gewoon openging.
  setTimeout(function () { antwoord(true); }, OPEN_ANSWER_TIMEOUT_MS);
}
