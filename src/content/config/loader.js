// Inlezen van de configuratielagen: config.json < sector/team < lokale
// testoverride < beleid (chrome.storage.managed).

import {
  ACTIVE_PROFILE,
  ACTIVE_SECTOR,
  APP_CONFIG,
  applyHelperConfig,
  refreshEffectiveConfig,
  setActiveTeam,
} from './app-config.js';
import { LOCAL, SYNC } from '../../shared/storage-keys.js';
import { runConfigHook } from './hooks.js';

// (B) Gebundelde config.json uit de extensiemap inlezen — HET bestand dat je
// vervangt om de configuratie aan te passen. Volgorde: standaard < config.json
// < storage/beleid.
function loadBundledConfig() {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) return Promise.resolve();
    const url = chrome.runtime.getURL('config.json');
    return fetch(url).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (obj) {
      if (obj) {
        const cfg = obj.helperConfig ? obj.helperConfig : obj; applyHelperConfig(cfg);
        const features = cfg.features || {};
        if (typeof features.appointmentAssistant === 'boolean') RUNTIME_CONFIG.appointmentHelperEnabled = features.appointmentAssistant;
        if (typeof features.registrationAssistant === 'boolean') RUNTIME_CONFIG.registrationHelperEnabled = features.registrationAssistant;
      }
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
// Test-override voor de aanwezigheidsdeadline (#5). Zet via
// chrome.storage.local: { onsHelperConfig: { presenceDeadlineOverride: "YYYY-MM-DD HH:MM" } }
// om de waarschuwing te kunnen zien zonder op een echte deadline te wachten.
export let _presenceDeadlineOverride = null;
function applyRuntimeConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return;
  if (typeof cfg.enabled === 'boolean') RUNTIME_CONFIG.enabled = cfg.enabled;
  if (typeof cfg.appointmentHelperEnabled === 'boolean') RUNTIME_CONFIG.appointmentHelperEnabled = cfg.appointmentHelperEnabled;
  if (typeof cfg.registrationHelperEnabled === 'boolean') RUNTIME_CONFIG.registrationHelperEnabled = cfg.registrationHelperEnabled;
  if (typeof cfg.presenceDeadlineOverride === 'string') _presenceDeadlineOverride = cfg.presenceDeadlineOverride || null;
  if (cfg.helperConfig && typeof cfg.helperConfig === 'object') { try { applyHelperConfig(cfg.helperConfig); } catch (e) {} }
  else { try { applyHelperConfig(cfg); } catch (e) {} }
  const features = (cfg.helperConfig && cfg.helperConfig.features) || cfg.features || {};
  if (typeof features.appointmentAssistant === 'boolean') RUNTIME_CONFIG.appointmentHelperEnabled = features.appointmentAssistant;
  if (typeof features.registrationAssistant === 'boolean') RUNTIME_CONFIG.registrationHelperEnabled = features.registrationAssistant;
  runConfigHook('configApplied');
}
function loadManagedConfig() {
  function readStorage(area, keys) {
    return new Promise(function (resolve) {
      try {
        if (!area || typeof area.get !== 'function') { resolve(null); return; }
        area.get(keys, function (result) {
          try {
            if (chrome.runtime && chrome.runtime.lastError) { resolve(null); return; }
          } catch (e) {}
          resolve(result || null);
        });
      } catch (e) { resolve(null); }
    });
  }
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return Promise.resolve();
    // Vaste prioriteit: standaard < config.json < sector/profiel < lokale testoverride < beleid.
    return readStorage(chrome.storage.sync || chrome.storage.local, [SYNC.SECTOR, SYNC.COLOR_PROFILE]).then(function (profile) {
      const previousSelection = ACTIVE_SECTOR + '\n' + ACTIVE_PROFILE;
      setActiveTeam(profile && profile.colorProfile || null,
        profile && (profile.sector || ((APP_CONFIG.profileSectors || {})[profile.colorProfile])) || null);
      refreshEffectiveConfig();
      if (previousSelection !== ACTIVE_SECTOR + '\n' + ACTIVE_PROFILE) { try { runConfigHook('teamChanged'); } catch (e) {} }
      return readStorage(chrome.storage.local, [LOCAL.TEST_CONFIG]);
    }).then(function (res) {
      try { if (res && res[LOCAL.TEST_CONFIG]) applyRuntimeConfig(res[LOCAL.TEST_CONFIG]); } catch (e) {}
      return readStorage(chrome.storage.managed, null);
    }).then(function (cfg) {
      try { if (cfg) applyRuntimeConfig(cfg); } catch (e) {}
      runConfigHook('configApplied');
    });
  } catch (e) { return Promise.resolve(); }
}
// Opstarten: config opnieuw inlezen als beleid, lokale override of teamkeuze wijzigt.
export function watchConfigChanges() {
  try {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'managed' || area === 'local' || (area === 'sync' && (changes[SYNC.SECTOR] || changes[SYNC.COLOR_PROFILE]))) loadManagedConfig();
      });
    }
  } catch (e) {}
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
