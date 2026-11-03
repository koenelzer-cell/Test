// Het vernieuwde registratieformulier van ONS (impegno-backup-staging) is geen
// pagina meer maar een venster op de agenda: een uc-modal met de Vue-component
// DeclareAsRegistrationForm. In de DOM herkenbaar aan de tijdverdeling
// (data-qa="time-distribution-fields") of de formuliervelden declaration[…].

import { deepQueryAll } from './dom.js';

// Indienen zoals de medewerker: de knop Indienen van ONS in het venster.
export function klikIndienenInVenster() {
  const v = vindRegistratieVenster();
  const knop = v ? deepQueryAll('uc-button[data-qa="submit-button"]', v)[0] : null;
  if (!knop) return false;
  try { knop.click(); return true; } catch (e) { return false; }
}
const VENSTER_VELD = '[data-qa="time-distribution-fields"], [name^="declaration["]';
// Snel: alleen de gewone DOM van de pagina (daar zet ONS het venster).
export function vindRegistratieVensterSnel() {
  try {
    const veld = document.querySelector('uc-modal [data-qa="time-distribution-fields"], uc-modal [name^="declaration["]');
    return veld ? veld.closest('uc-modal') : null;
  } catch (e) { return null; }
}
export function vindRegistratieVenster(root) {
  if (!root) { const snel = vindRegistratieVensterSnel(); if (snel) return snel; }
  return deepQueryAll('uc-modal', root || document).find(function (m) {
    try { return !!m.querySelector(VENSTER_VELD); } catch (e) { return false; }
  }) || null;
}
// Waar het hulppaneel in hangt: het dialoogvenster binnen het registratie-
// venster (een modaal venster maakt alles daarbuiten onklikbaar), anders het
// venster zelf.
export function vensterHouder(venster) {
  const v = venster || vindRegistratieVenster();
  if (!v) return null;
  try {
    const d = v.shadowRoot && v.shadowRoot.querySelector('dialog[open], [role="dialog"], [aria-modal="true"]');
    if (d) return d;
  } catch (e) {}
  return v;
}
