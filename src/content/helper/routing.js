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
// Opstarten: elke URL-wijziging (ONS is een single-page app) wordt een
// 'locationchange'-event op window, waar syncWithUrl en de dagkleuring op
// reageren.
let _lastHref = location.href;
export function installUrlWatch() {
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    history[m] = function () { const r = orig.apply(this, arguments); window.dispatchEvent(new Event('locationchange')); return r; };
  }
  window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
  window.addEventListener('locationchange', syncWithUrl);

  // In een extensie-content-script (geïsoleerde wereld) onderschept het patchen
  // van history.pushState de navigaties van de pagina zelf niet. Daarom pollen
  // we de URL en vuren locationchange bij elke wijziging.
  _lastHref = location.href;
  setInterval(() => {
    if (location.href !== _lastHref) { _lastHref = location.href; window.dispatchEvent(new Event('locationchange')); }
  }, 250);
}
