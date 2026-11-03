// Het vernieuwde registratieformulier van ONS.
//
// Op de ONS-omgeving impegno-backup-staging.onsagenda.nl heeft ONS het
// registratieformulier vernieuwd. De bestaande registratiehulp
// (features/registration/) is gebouwd op het oude formulier en zou daar
// klikken in velden die er anders uitzien; daarom draait die hulp op deze
// hosts niet, en neemt deze module het registratieformulier over.
//
// Nu herkent de module alleen waar hij is. Wat hij op het formulier doet,
// komt erbij zodra de opbouw van het nieuwe formulier bekend is
// (tools/console/registratie-opbouw.js geeft die, zonder cliëntgegevens).
// Alleen het testpakket draait op deze host (manifest: *.onsagenda.nl).

import { isRegistrationEditOrNew } from '../../ons/agenda-location.js';

// Hosts met het nieuwe registratieformulier.
export const NIEUW_FORMULIER_HOSTS = ['impegno-backup-staging.onsagenda.nl'];

export function opNieuwFormulierHost(host) {
  const h = String(host == null ? location.hostname : host).toLowerCase();
  return NIEUW_FORMULIER_HOSTS.indexOf(h) >= 0;
}

// Staat het nieuwe registratieformulier open? Voorlopig dezelfde adressen als
// het oude formulier (/registrations/{id}/edit of /registrations/new); als
// ONS die ook veranderde, passen we het hier aan.
export function opNieuwRegistratieFormulier() {
  return opNieuwFormulierHost() && isRegistrationEditOrNew();
}

let actief = false;
export function nieuweRegistratiehulpActief() { return actief; }
// Aan op het nieuwe formulier, uit daarbuiten. Nog zonder eigen scherm.
export function syncNieuweRegistratiehulp() {
  actief = opNieuwRegistratieFormulier();
  return actief;
}
