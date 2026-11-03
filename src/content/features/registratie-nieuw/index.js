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
// (ons/registratie-venster.js). Nu herkent de module alleen waar hij is. Wat
// hij op het formulier doet, komt erbij zodra de opbouw van dat venster
// bekend is (tools/console/registratie-opbouw.js geeft die, zonder cliënt-
// of medewerkergegevens). Alleen het testpakket draait op deze host
// (manifest: *.onsagenda.nl).

import { isRegistrationEditOrNew } from '../../ons/agenda-location.js';
import { vindRegistratieVenster } from '../../ons/registratie-venster.js';

// Hosts met het nieuwe registratieformulier.
export const NIEUW_FORMULIER_HOSTS = ['impegno-backup-staging.onsagenda.nl'];

export function opNieuwFormulierHost(host) {
  const h = String(host == null ? location.hostname : host).toLowerCase();
  return NIEUW_FORMULIER_HOSTS.indexOf(h) >= 0;
}

// Staat het nieuwe registratieformulier open? Het venster op de agenda, of
// (voor het geval ONS het ook als pagina toont) /registrations/{id}/edit of
// /registrations/new.
export function opNieuwRegistratieFormulier() {
  return opNieuwFormulierHost() && (!!vindRegistratieVenster() || isRegistrationEditOrNew());
}
export function nieuweRegistratiehulpActief() { return opNieuwRegistratieFormulier(); }
// Bij elke adreswijziging (helper/routing.js). Nog zonder eigen scherm.
export function syncNieuweRegistratiehulp() { return opNieuwRegistratieFormulier(); }
