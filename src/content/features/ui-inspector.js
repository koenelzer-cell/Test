// De UI-inspector (src/ui-inspector/) laden en openen. Hij is een aparte
// bundel die alleen laadt als hij gevraagd wordt: via #ons-ui-inspector in het
// adres (de knop in het beheerscherm), of omdat hij openstond toen de pagina
// herlaadde. features.uiInspector: false (beheerscherm of beleid) zet hem uit.

import { LOCAL } from '../../shared/storage-keys.js';
import { APP_CONFIG } from '../config/app-config.js';
import { wachtTot } from '../core/wacht.js';

function gevraagdInAdres() {
  return /ons-?ui-?inspector/i.test(location.hash) || /[?&]onsInspector=1/i.test(location.search);
}

// De vlag uit het adres halen, zodat herladen hem niet opnieuw opent; open
// blijven na herladen regelt de inspector zelf.
function haalVlagWeg() {
  history.replaceState(null, '', location.href.replace(/#.*$/, '').replace(/([?&])onsInspector=1/i, '$1').replace(/[?&]$/, ''));
}

function open() {
  import(chrome.runtime.getURL('dist/ui-inspector.js'))
    .then((inspector) => inspector.openInspector())
    .catch((e) => console.warn('ONS Agendahulp: de UI-inspector laadt niet.', e));
}

export function startUiInspector() {
  if (window.top !== window.self) return;
  if (APP_CONFIG.features && APP_CONFIG.features.uiInspector === false) return;
  const uitAdres = () => {
    if (!gevraagdInAdres()) return;
    haalVlagWeg();
    open();
  };
  window.addEventListener('hashchange', uitAdres);
  // ONS is een SPA: de vlag kan pas na de eerste routering in het adres staan.
  wachtTot(gevraagdInAdres, { max: 10000 }).then(uitAdres);
  chrome.storage.local.get([LOCAL.INSPECTOR_OPEN], (r) => { if (r && r[LOCAL.INSPECTOR_OPEN]) open(); });
}
