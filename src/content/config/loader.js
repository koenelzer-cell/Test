// Inlezen van de configuratielagen: standaard < config.json < lokale
// testoverride (alleen het testpakket) < beleid (chrome.storage.managed),
// plus het gekozen team. Bij elke wijziging wordt alles opnieuw opgebouwd.

import {
  ACTIVE_PROFILE,
  ACTIVE_SECTOR,
  bouwConfig,
  setActiveTeam,
  zetConfig,
} from './app-config.js';
import { isTestpakket } from '../../shared/version.js';
import { LOCAL, SYNC } from '../../shared/storage-keys.js';
import { runConfigHook } from './hooks.js';

// De lagen zoals ze het laatst zijn gelezen. Bij elke wijziging bouwt de
// hulp de configuratie hieruit opnieuw op vanaf de standaard (herbouw).
const LAGEN = { bundled: null, test: null, managed: null, team: null };
// Uit de lokale testconfig nooit: waar verzoeken heen gaan (routes-server,
// ONS-adressen) en op welke domeinen de hulp draait. Die komen alleen uit
// config.json (in het pakket) of het beleid.
const NIET_UIT_TEST = ['routesProxy', 'apiEndpoints', 'activation'];
function helperDeel(cfg) {
  if (!cfg || typeof cfg !== 'object') return null;
  return cfg.helperConfig && typeof cfg.helperConfig === 'object' ? cfg.helperConfig : cfg;
}
export function testLaag(cfg) {
  const h = helperDeel(cfg);
  if (!h) return null;
  const uit = Object.assign({}, h);
  NIET_UIT_TEST.forEach(function (k) { delete uit[k]; });
  return uit;
}
// De schakelaars die niet in APP_CONFIG staan, ook opnieuw vanaf de standaard:
// enabled en de twee hulpen (ook via features.appointmentAssistant /
// registrationAssistant) en de testdatum voor de aanwezigheidsdeadline.
export function bouwRuntime(bundled, test, managed) {
  const r = { enabled: true, appointmentHelperEnabled: true, registrationHelperEnabled: true };
  let deadline = null;
  [[bundled, false], [test, true], [managed, true]].forEach(function (paar) {
    const cfg = paar[0];
    if (!cfg || typeof cfg !== 'object') return;
    if (paar[1]) {
      if (typeof cfg.enabled === 'boolean') r.enabled = cfg.enabled;
      if (typeof cfg.appointmentHelperEnabled === 'boolean') r.appointmentHelperEnabled = cfg.appointmentHelperEnabled;
      if (typeof cfg.registrationHelperEnabled === 'boolean') r.registrationHelperEnabled = cfg.registrationHelperEnabled;
      if (typeof cfg.presenceDeadlineOverride === 'string') deadline = cfg.presenceDeadlineOverride || null;
    }
    const f = (helperDeel(cfg) || {}).features || {};
    if (typeof f.appointmentAssistant === 'boolean') r.appointmentHelperEnabled = f.appointmentAssistant;
    if (typeof f.registrationAssistant === 'boolean') r.registrationHelperEnabled = f.registrationAssistant;
  });
  return { runtime: r, deadline: deadline };
}
// Alles opnieuw: standaard < config.json < testconfig (alleen het
// testpakket) < beleid. Daarna het team en de haken, elk één keer.
function herbouw() {
  const test = isTestpakket() ? LAGEN.test : null;
  const nieuw = bouwConfig([helperDeel(LAGEN.bundled), testLaag(test), helperDeel(LAGEN.managed)].filter(Boolean));
  const rt = bouwRuntime(LAGEN.bundled, test, LAGEN.managed);
  Object.assign(RUNTIME_CONFIG, rt.runtime);
  _presenceDeadlineOverride = rt.deadline;
  const profiel = LAGEN.team;
  const vorige = ACTIVE_SECTOR + '\n' + ACTIVE_PROFILE;
  setActiveTeam(profiel && profiel.colorProfile || null,
    profiel && (profiel.sector || ((nieuw.profileSectors || {})[profiel.colorProfile])) || null);
  if (vorige !== ACTIVE_SECTOR + '\n' + ACTIVE_PROFILE) { try { runConfigHook('teamChanged'); } catch (e) {} }
  zetConfig(nieuw);
}
// (B) Gebundelde config.json uit de extensiemap inlezen: HET bestand dat je
// vervangt om de configuratie aan te passen.
function loadBundledConfig() {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) return Promise.resolve();
    const url = chrome.runtime.getURL('config.json');
    return fetch(url).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (obj) {
      if (obj && typeof obj === 'object') LAGEN.bundled = obj;
    }).catch(function () {});
  } catch (e) { return Promise.resolve(); }
}
// Build-scope: bepaalt welke hulp deze bouw activeert.
//   'all'           -> afspraak- én registratiehulp (volledige extensie)
//   'events'        -> alleen afspraakhulp
//   'registrations' -> alleen registratiehulp
// Wordt per pakket via de build vervangen (zoals de versie in manifest.json).
export const HELPER_SCOPE = 'all';
// (#2 uitrol) Centrale kill-switch/config die IT via beleid kan zetten
// (chrome.storage.managed, schema in managed_schema.json). Fail-open: alles
// staat aan tenzij het beleid een vlag expliciet op false zet. Een lokale
// override (chrome.storage.local.onsHelperConfig) is handig voor tests.
//   enabled                    -> hoofdschakelaar (afspraak+registratie)
//   appointmentHelperEnabled   -> afspraakhulp
//   registrationHelperEnabled  -> registratiehulp
export const RUNTIME_CONFIG = { enabled: true, appointmentHelperEnabled: true, registrationHelperEnabled: true };
// Test-override voor de aanwezigheidsdeadline: in de testconfig of het beleid
// { presenceDeadlineOverride: "YYYY-MM-DD HH:MM" }, om de waarschuwing te
// zien zonder op een echte deadline te wachten.
export let _presenceDeadlineOverride = null;
function readStorage(area, keys) {
  return new Promise(function (resolve) {
    try {
      if (!area || typeof area.get !== 'function') { resolve(null); return; }
      area.get(keys, function (result) {
        try { if (chrome.runtime && chrome.runtime.lastError) { resolve(null); return; } } catch (e) {}
        resolve(result || null);
      });
    } catch (e) { resolve(null); }
  });
}
// Team, testconfig en beleid lezen en de configuratie opnieuw opbouwen.
function loadManagedConfig() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) { herbouw(); return Promise.resolve(); }
    return readStorage(chrome.storage.sync || chrome.storage.local, [SYNC.SECTOR, SYNC.COLOR_PROFILE]).then(function (profile) {
      LAGEN.team = profile || null;
      return isTestpakket() ? readStorage(chrome.storage.local, [LOCAL.TEST_CONFIG]) : null;
    }).then(function (res) {
      LAGEN.test = (res && res[LOCAL.TEST_CONFIG]) || null;
      return readStorage(chrome.storage.managed, null);
    }).then(function (cfg) {
      LAGEN.managed = cfg && Object.keys(cfg).length ? cfg : null;
      herbouw();
    });
  } catch (e) { return Promise.resolve(); }
}
// Opstarten: config opnieuw inlezen als beleid, lokale override of teamkeuze
// wijzigt. Alleen dan: in chrome.storage.local schrijven ook de service worker
// (momentopname, vormen), en elke herlaadbeurt brengt de
// pagina opnieuw in lijn met de configuratie.
export function watchConfigChanges() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'managed'
      || (area === 'local' && changes[LOCAL.TEST_CONFIG] && isTestpakket())
      || (area === 'sync' && (changes[SYNC.SECTOR] || changes[SYNC.COLOR_PROFILE]))) loadManagedConfig();
  });
}
// Activeer de hulp pas nadat alle configuratielagen zijn ingelezen. Anders
// worden knoppen en teksten kort uit de code-standaard gebouwd en houden ze
// verouderde waarden vast (bijv. MDO 100% indirect of roze tekst).
export let helperConfigReady = false;
// Start het inlezen van alle configuratielagen; de belofte is vervuld zodra
// ze er allemaal zijn (helperConfigReady = true). Aangeroepen bij het opstarten.
export function startConfigLoading() {
  return loadBundledConfig()
    .then(function () { return loadManagedConfig(); })
    .catch(function () {})
    .then(function () { helperConfigReady = true; });
}
