// Service worker van de extensie. Vier taken, elk in een eigen module en
// allemaal aangestuurd door het content-script of door de browser:
//
//   badge.js         aantal openstaande dagen op het extensie-icoon
//   snapshot.js      laatst bekende weekstand bewaren (alleen getallen)
//   reminder.js      wekelijkse herinnering (opt-in)
//   context-menu.js  rechtermuismenu "Registreren als…" en "Agendahulp in zijpaneel"
//   side-panel.js    bijhouden of het zijpaneel open is, en het openen ervan
//   (hieronder)      een tabblad openen (AFAS na een verlofaanvraag)
//
// Een MV3-worker wordt afgesloten zodra hij niets doet. Daarom staat alle
// blijvende toestand in chrome.storage.local en worden menu en wekker bij elke
// start opnieuw gezet. Listeners moeten synchroon bij het laden geregistreerd
// worden; dat gebeurt hieronder.

import { MSG } from '../shared/messages.js';
import { isOnsUrl } from '../shared/ons-hosts.js';
import { setBadge } from './badge.js';
import { saveSnapshot, loadSnapshot } from './snapshot.js';
import { ALARM_NAME, loadSettings, updateSettings, showReminder, rescheduleAlarm, onNotificationClicked } from './reminder.js';
import { rebuildMenuFromStorage, updateForms, onMenuClicked } from './context-menu.js';
import { onConnect, onTabUpdated, verversZijpaneelTab, answerSidePanelQuery, openSidePanel, resetPanelOptions } from './side-panel.js';

// Wie mag wat vragen. Een content-script in een ONS-tabblad (badge,
// momentopname, vormen, zijpaneel, tabblad openen), of een pagina van de
// extensie zelf (de popup: herinnering). Andere afzenders, ook een
// content-script in een ander tabblad, krijgen geen antwoord.
const VAN_ONS_TABBLAD = new Set([MSG.BADGE, MSG.SUMMARY, MSG.FORMS, MSG.OPEN_SIDE_PANEL, MSG.SIDEPANEL_QUERY, MSG.OPEN_TAB]);
const VAN_EXTENSIEPAGINA = new Set([MSG.REMINDER_GET, MSG.REMINDER_SETTINGS, MSG.REMINDER_TEST]);
function magBericht(type, sender) {
  if (!sender || sender.id !== chrome.runtime.id) return false;
  if (VAN_ONS_TABBLAD.has(type)) return !!sender.tab && isOnsUrl(sender.tab.url);
  if (VAN_EXTENSIEPAGINA.has(type)) return String(sender.url || '').startsWith(chrome.runtime.getURL(''));
  return false;
}

// Berichten. Een handler die later antwoordt, geeft true terug.
function onMessage(msg, sender, sendResponse) {
  if (!msg || typeof msg !== 'object' || !magBericht(msg.type, sender)) return;
  const tabId = sender.tab && sender.tab.id;

  switch (msg.type) {
    case MSG.BADGE:
      setBadge(msg.count | 0, tabId);
      return;
    case MSG.SIDEPANEL_QUERY:
      answerSidePanelQuery(tabId, sendResponse);
      return true;
    case MSG.SUMMARY:
      saveSnapshot(msg);
      return;
    case MSG.FORMS:
      updateForms(msg.forms);
      return;
    case MSG.REMINDER_SETTINGS:
      updateSettings(msg).then(function (next) {
        try { sendResponse({ ok: true, settings: next }); } catch (e) {}
      });
      return true;
    case MSG.REMINDER_GET:
      Promise.all([loadSettings(), loadSnapshot()]).then(function (r) {
        try { sendResponse({ settings: r[0], snapshot: r[1] }); } catch (e) {}
      });
      return true;
    case MSG.REMINDER_TEST:
      showReminder().then(function () { try { sendResponse({ ok: true }); } catch (e) {} });
      return true;
    case MSG.OPEN_TAB:
      openTab(msg.url, sender && sender.tab, sendResponse);
      return true;
    case MSG.OPEN_SIDE_PANEL:
      if (tabId == null) return;
      openSidePanel(tabId, sendResponse);
      return true;
    default:
      return;
  }
}

// Een nieuw tabblad naast het ONS-tabblad. Vanuit de worker, omdat de pagina
// zelf na een API-aanroep geen tabblad meer mag openen (pop-upblokkering).
// Alleen https-adressen.
function openTab(url, fromTab, sendResponse) {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) { try { sendResponse({ ok: false }); } catch (e) {} return; }
  const opts = { url: url, active: true };
  if (fromTab && typeof fromTab.index === 'number') opts.index = fromTab.index + 1;
  if (fromTab && fromTab.windowId != null) opts.windowId = fromTab.windowId;
  try {
    chrome.tabs.create(opts, function () {
      const ok = !chrome.runtime.lastError;
      try { sendResponse({ ok: ok }); } catch (e) {}
    });
  } catch (e) { try { sendResponse({ ok: false }); } catch (e2) {} }
}

chrome.runtime.onMessage.addListener(onMessage);
chrome.runtime.onConnect.addListener(onConnect);
chrome.contextMenus.onClicked.addListener(onMenuClicked);
chrome.alarms.onAlarm.addListener(function (a) { if (a && a.name === ALARM_NAME) showReminder(); });
chrome.notifications.onClicked.addListener(onNotificationClicked);

// Van tabblad wisselen of binnen een tabblad navigeren verplaatst wie er voor
// het zijpaneel meldt.
try {
  chrome.tabs.onActivated.addListener(function () { verversZijpaneelTab(); });
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  chrome.windows.onFocusChanged.addListener(function () { verversZijpaneelTab(); });
} catch (e) {}

// Na installatie én na elke browserstart: menu en wekker terugzetten.
chrome.runtime.onInstalled.addListener(function () { rebuildMenuFromStorage(); rescheduleAlarm(); });
// Venster-breed zijpaneel aan (zie side-panel.js).
resetPanelOptions();
chrome.runtime.onStartup.addListener(function () { rebuildMenuFromStorage(); rescheduleAlarm(); });
