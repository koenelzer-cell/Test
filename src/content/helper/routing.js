// Welke hulp hoort bij de huidige URL? Volgt navigatie in de single-page app
// van ONS.

import { startVanuitPlanhulp } from './planner-form.js';
import { forgetStaleDuplicates } from '../features/appointment/duplicate.js';
import { APP_CONFIG, CONFIG } from '../config/app-config.js';
import { isRegistrationEditOrNew } from '../ons/agenda-location.js';
import {
  removeRegistrationsOverviewPanel,
  updateRegistrationsOverviewPanel,
} from '../features/agenda-overview/registrations-overview.js';
import { HELPER_SCOPE, helperConfigReady, RUNTIME_CONFIG } from '../config/loader.js';
import { activate, deactivate } from './lifecycle.js';

// Optionele domein-allowlist uit de config. Leeg = actief op elk domein dat
// het manifest toelaat. Gevuld = alleen actief op deze domeinen (kan de
// manifest-scope wel beperken, niet uitbreiden).
function activationDomainsOk() {
  try {
    const d = (APP_CONFIG.activation && APP_CONFIG.activation.domains) || [];
    if (!Array.isArray(d) || !d.length) return true;
    const host = (location.hostname || '').toLowerCase();
    return d.some((dom) => { dom = String(dom || '').trim().toLowerCase(); return dom && host.indexOf(dom) !== -1; });
  } catch (e) { return true; }
}
// Het afspraakformulier waarvoor de planhulp-voortzetting al gestart is. Een
// configwijziging of een tweede locationchange op hetzelfde formulier start
// hem niet opnieuw: dat zou een voortzetting die op een cliënt wacht wissen.
let planhulpVoorHref = null;

export function syncWithUrl() {
  forgetStaleDuplicates();
  if (!helperConfigReady) return;
  // (#2 uitrol) Centrale kill-switch heeft voorrang op de build-scope.
  if (!RUNTIME_CONFIG.enabled || !activationDomainsOk()) {
    planhulpVoorHref = null;
    deactivate(); removeRegistrationsOverviewPanel(); return;
  }
  const wantEvents = (HELPER_SCOPE === 'all' || HELPER_SCOPE === 'events') && RUNTIME_CONFIG.appointmentHelperEnabled;
  const wantRegistrations = (HELPER_SCOPE === 'all' || HELPER_SCOPE === 'registrations') && RUNTIME_CONFIG.registrationHelperEnabled;
  const opFormulier = wantEvents && location.href.includes(CONFIG.urlNeedle);
  if (!opFormulier) planhulpVoorHref = null;
  // De registratiehulp draait alleen op de invul-/edit-/new-pagina, NIET op het
  // kale /registrations-overzicht (daar tonen we het declarabiliteit-paneel).
  if (opFormulier) {
    activate('events');
    if (planhulpVoorHref !== location.href) { planhulpVoorHref = location.href; startVanuitPlanhulp(); }
  } else if (wantRegistrations && location.href.includes(CONFIG.registrationNeedle) && isRegistrationEditOrNew()) activate('registrations');
  else deactivate();
  updateRegistrationsOverviewPanel();
}
// Opstarten: elke URL-wijziging (ONS is een single-page app) wordt één
// 'locationchange'-event op window, waar syncWithUrl en de dagkleuring op
// reageren.
let _lastHref = location.href;
let _urlTimer = null;
function meldUrlWijziging() {
  if (location.href === _lastHref) return;
  _lastHref = location.href;
  window.dispatchEvent(new Event('locationchange'));
}
export function installUrlWatch() {
  // Het patchen van history ziet alleen de navigaties van de extensie zelf (de
  // pagina heeft in de geïsoleerde wereld een eigen history-object); die van
  // ONS vangt het nakijken elke 250 ms.
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    history[m] = function () { const r = orig.apply(this, arguments); meldUrlWijziging(); return r; };
  }
  window.addEventListener('popstate', meldUrlWijziging);
  window.addEventListener('locationchange', syncWithUrl);
  _urlTimer = setInterval(meldUrlWijziging, 250);
}
export function stopUrlWatch() {
  clearInterval(_urlTimer);
  window.removeEventListener('locationchange', syncWithUrl);
}
