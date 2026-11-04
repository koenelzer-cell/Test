// Het vernieuwde registratieformulier van ONS.
//
// Op de ONS-omgeving impegno-backup-staging.onsagenda.nl heeft ONS het
// registratieformulier vernieuwd. De bestaande registratiehulp
// (features/registration/) is gebouwd op het oude formulier en zou daar
// klikken in velden die er anders uitzien; daarom draait die hulp op deze
// hosts niet, en neemt deze module het registratieformulier over.
//
// Het nieuwe formulier is een venster op de agenda (uc-modal met de
// Vue-component DeclareAsRegistrationForm), geen aparte pagina meer
// (ons/registratie-venster.js). Gaat het venster open, dan start
// helper/routing.js de registratiehulp in dat venster (schermen.js, modus
// VENSTER_MODUS); de agenda en het zijpaneel blijven daarbij aan. Alleen het
// testpakket draait op deze host (manifest: *.onsagenda.nl).

import { isRegistrationEditOrNew } from '../../ons/agenda-location.js';
import { vindRegistratieVenster, vindRegistratieVensterSnel } from '../../ons/registratie-venster.js';
import { NIEUW_FORMULIER_HOSTS, opNieuwFormulierHost } from '../../ons/nieuwe-formulieren.js';

// Hosts met het nieuwe formulier: ons/nieuwe-formulieren.js.
export { NIEUW_FORMULIER_HOSTS, opNieuwFormulierHost };

// Staat het nieuwe registratieformulier open? Het venster op de agenda, of
// (voor het geval ONS het ook als pagina toont) /registrations/{id}/edit of
// /registrations/new.
export function opNieuwRegistratieFormulier() {
  return opNieuwFormulierHost() && (!!vindRegistratieVenster() || isRegistrationEditOrNew());
}
export function nieuweRegistratiehulpActief() { return opNieuwRegistratieFormulier(); }
// Bij elke adreswijziging (helper/routing.js).
export function syncNieuweRegistratiehulp() { return opNieuwRegistratieFormulier(); }

// Het venster opent en sluit zonder adreswijziging. Op een host met het nieuwe
// formulier kijkt een MutationObserver of het venster open of dicht ging en
// meldt alleen die overgang (gebundeld, niet bij elke tik in een veld). De
// agenda verandert vaak: eerst de goedkope blik in de gewone DOM, de diepe
// zoektocht door shadow-roots hooguit eens per DIEP_MS.
const DIEP_MS = 2000;
let _bewaker = null;
export function bewaakRegistratieVenster(opWijziging) {
  if (_bewaker || !opNieuwFormulierHost() || typeof MutationObserver !== 'function') return;
  let open = !!vindRegistratieVenster();
  let timer = null, laatsteDiep = 0;
  const kijk = function () {
    timer = null;
    let nu = !!vindRegistratieVensterSnel();
    if (!nu) {
      const wacht = DIEP_MS - (Date.now() - laatsteDiep);
      if (wacht > 0) { timer = setTimeout(kijk, wacht); return; }
      laatsteDiep = Date.now();
      nu = !!vindRegistratieVenster();
    }
    if (nu === open) return;
    open = nu;
    opWijziging();
  };
  _bewaker = new MutationObserver(function () { if (!timer) timer = setTimeout(kijk, 150); });
  _bewaker.observe(document.documentElement, { childList: true, subtree: true });
}
export function stopBewakingRegistratieVenster() { if (_bewaker) { _bewaker.disconnect(); _bewaker = null; } }
