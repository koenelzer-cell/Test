// Rechtermuismenu op ONS-pagina's:
//   - "Registreren als… > <vorm>": de keuze gaat naar het content-script, dat
//     de registratie met die vorm start;
//   - "Agendahulp in zijpaneel".
//
// De vormen komen uit de beheerbare config (het content-script stuurt ze), niet
// uit een vaste lijst — anders klopt het menu niet meer zodra een beheerder een
// registratievorm toevoegt of hernoemt.

import { MSG } from '../shared/messages.js';
import { LOCAL } from '../shared/storage-keys.js';
import { ONS_URL_PATTERNS } from '../shared/ons-hosts.js';
import { readLocal, writeLocal } from '../shared/chrome-storage.js';
import { ensurePanelForTab } from './side-panel.js';

const MENU_ROOT = 'onsHelper.register';
const MENU_PANEL = 'onsHelper.panel';
const MAX_FORMS = 25;

function buildMenu(forms) {
  return new Promise(function (resolve) {
    try {
      chrome.contextMenus.removeAll(function () {
        const list = Array.isArray(forms) ? forms.filter(function (f) { return typeof f === 'string' && f.trim(); }) : [];
        if (list.length) {
          chrome.contextMenus.create({
            id: MENU_ROOT, title: 'Registreren als…', contexts: ['all'],
            documentUrlPatterns: ONS_URL_PATTERNS,
          });
          list.slice(0, MAX_FORMS).forEach(function (vorm, i) {
            chrome.contextMenus.create({
              id: MENU_ROOT + '.' + i, parentId: MENU_ROOT, title: vorm,
              contexts: ['all'], documentUrlPatterns: ONS_URL_PATTERNS,
            });
          });
        }
        chrome.contextMenus.create({
          id: MENU_PANEL, title: 'Agendahulp in zijpaneel', contexts: ['all'],
          documentUrlPatterns: ONS_URL_PATTERNS,
        });
        resolve();
      });
    } catch (e) { resolve(); }
  });
}

export function rebuildMenuFromStorage() {
  return readLocal([LOCAL.FORMS]).then(function (v) { return buildMenu(v[LOCAL.FORMS]); });
}

// Nieuwe lijst registratievormen van het content-script. Alleen bij een echte
// wijziging opslaan en het menu opnieuw bouwen.
export function updateForms(rawForms) {
  const forms = Array.isArray(rawForms) ? rawForms.slice(0, MAX_FORMS) : [];
  return readLocal([LOCAL.FORMS]).then(function (v) {
    const was = JSON.stringify(v[LOCAL.FORMS] || []);
    if (was === JSON.stringify(forms)) return;   // niets veranderd: menu laten staan
    return writeLocal({ [LOCAL.FORMS]: forms }).then(function () { return buildMenu(forms); });
  });
}

export function onMenuClicked(info, tab) {
  if (!tab || tab.id == null) return;
  if (info.menuItemId === MENU_PANEL) {
    // open() moet in dezelfde tik als het gebaar; daarom niet achter een await.
    ensurePanelForTab(tab.id);
    try { chrome.sidePanel.open({ tabId: tab.id }); } catch (e) {}
    return;
  }
  const m = /^onsHelper\.register\.(\d+)$/.exec(String(info.menuItemId || ''));
  if (!m) return;
  readLocal([LOCAL.FORMS]).then(function (v) {
    const forms = Array.isArray(v[LOCAL.FORMS]) ? v[LOCAL.FORMS] : [];
    const vorm = forms[parseInt(m[1], 10)];
    if (!vorm) return;
    try { chrome.tabs.sendMessage(tab.id, { type: MSG.CTX_REGISTER, vorm: vorm }); } catch (e) {}
  });
}
