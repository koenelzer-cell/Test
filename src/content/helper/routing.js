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
import { opNieuwFormulierHost, syncNieuweRegistratiehulp } from '../features/registratie-nieuw/index.js';
import { onPageEvent } from '../core/page-bridge.js';
import { PAGE_EVENT } from '../../shared/messages.js';

// Optionele domein-allowlist uit de config. Leeg = actief op elk domein dat
// het manifest toelaat. Gevuld = alleen actief op deze domeinen (kan de
// manifest-scope wel beperken, niet uitbreiden).
// Past de host bij een domein uit activation.domains? Precies die host, of
// een subdomein ervan ('onsagenda.nl' past bij 'impegno.onsagenda.nl'), nooit
// een stukje ('onsagenda' of 'onsagenda.nl.ander.nl' past niet).
export function domeinPast(host, dom) {
  host = String(host || '').toLowerCase().replace(/\.$/, '');
  dom = String(dom || '').trim().toLowerCase().replace(/^\*?\./, '').replace(/\.$/, '');
  return !!dom && (host === dom || host.endsWith('.' + dom));
}
function activationDomainsOk() {
  try {
    const d = (APP_CONFIG.activation && APP_CONFIG.activation.domains) || [];
    if (!Array.isArray(d) || !d.length) return true;
    return d.some((dom) => domeinPast(location.hostname, dom));
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
  // Op een host met het vernieuwde registratieformulier neemt
  // features/registratie-nieuw/ het formulier over; de oude hulp blijft weg.
  const nieuwFormulier = opNieuwFormulierHost();
  syncNieuweRegistratiehulp();
  const wantRegistrations = !nieuwFormulier && (HELPER_SCOPE === 'all' || HELPER_SCOPE === 'registrations') && RUNTIME_CONFIG.registrationHelperEnabled;
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
let _stopUrlSein = null;
export function installUrlWatch() {
  // Het patchen van history hier ziet alleen de navigaties van de extensie
  // zelf (de geïsoleerde wereld heeft een eigen history-object). Die van ONS
  // meldt de main-world (PAGE_EVENT.URL_CHANGED); terug en vooruit geven
  // popstate. Elke seconde nakijken is alleen nog een vangnet.
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    history[m] = function () { const r = orig.apply(this, arguments); meldUrlWijziging(); return r; };
  }
  window.addEventListener('popstate', meldUrlWijziging);
  window.addEventListener('hashchange', meldUrlWijziging);
  window.addEventListener('locationchange', syncWithUrl);
  if (!_stopUrlSein) _stopUrlSein = onPageEvent(PAGE_EVENT.URL_CHANGED, meldUrlWijziging);
  _urlTimer = setInterval(meldUrlWijziging, 1000);
}
export function stopUrlWatch() {
  clearInterval(_urlTimer);
  if (_stopUrlSein) { _stopUrlSein(); _stopUrlSein = null; }
  window.removeEventListener('locationchange', syncWithUrl);
}
