// Het vernieuwde registratieformulier van ONS (impegno-backup-staging) is geen
// pagina meer maar een venster op de agenda: een uc-modal met de Vue-component
// DeclareAsRegistrationForm. In de DOM herkenbaar aan de tijdverdeling
// (data-qa="time-distribution-fields") of de formuliervelden declaration[…].

import { clean, deepQueryAll, visible } from './dom.js';
import { clickUiButton } from './form-controls.js';
import { wachtTot } from '../core/wacht.js';

// Indienen zoals de medewerker: de knop Indienen van ONS in het venster. Een
// uc-button reageert op de klikreeks op zijn eigen knop (clickUiButton), niet
// altijd op een kale .click() op het element zelf.
export function klikIndienenInVenster() {
  const v = vindRegistratieVenster();
  const knop = v ? deepQueryAll('uc-button[data-qa="submit-button"]', v)[0] : null;
  return knop ? clickUiButton(knop) : false;
}

// De rapportage schrijven: de cursor achteraan in het rapportageveld van het
// venster (het tekstvak in de uc-textarea), zoals de bestaande hulp bij
// Indienen zonder rapportage. -> true als het veld er was.
export function focusRapportageInVenster() {
  const v = vindRegistratieVenster();
  const veld = v ? deepQueryAll('[data-qa="new-report-field"] uc-textarea, [data-qa="group-report-fields"] uc-textarea', v)[0] : null;
  if (!veld) return false;
  const tekstvak = (veld.shadowRoot && veld.shadowRoot.querySelector('textarea')) || veld;
  try { tekstvak.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
  try { tekstvak.focus(); } catch (e) {}
  try { const n = String(tekstvak.value || '').length; if (tekstvak.setSelectionRange) tekstvak.setSelectionRange(n, n); } catch (e) {}
  return true;
}
// Cliënt toevoegen zoals de medewerker: de knop '+ Toevoegen' bij Cliënten in
// het venster (de enige knop met die tekst daar; ONS opent dan zijn eigen
// zoekvenster). -> true als geklikt.
export function klikClientToevoegenInVenster() {
  const v = vindRegistratieVenster();
  const knop = v ? deepQueryAll('uc-button', v).find(function (b) { return /^\+?\s*toevoegen$/.test(clean(b.textContent || '')) && visible(b); }) : null;
  return knop ? clickUiButton(knop) : false;
}
// Hoeveel cliënten het venster toont (goedkoop, voor het startscherm).
export function aantalClientsInVenster() {
  const v = vindRegistratieVensterSnel() || vindRegistratieVenster();
  return v ? v.querySelectorAll('[data-qa^="client-declaration-"]').length : 0;
}

// Het uursoortveld (ue-activity-select) en de keuzelijst daarin: dezelfde
// uc-select als het uursoortveld van het afspraakformulier, in de shadow-DOM
// van het veld. null als die er niet is.
export function uursoortVeldInVenster() {
  const v = vindRegistratieVenster();
  return v ? deepQueryAll('ue-activity-select', v)[0] || null : null;
}
export function uursoortKeuzelijstInVenster() {
  const veld = uursoortVeldInVenster();
  return veld && veld.shadowRoot ? deepQueryAll('uc-select', veld.shadowRoot)[0] || null : null;
}

// De reistijdvelden staan achter de knop '+ Reistijd' van ONS: ook als de
// reistijd in het model staat, toont het venster ze pas na die klik. De hulp
// klikt hem vóór het zetten (dan kan de klik de gezette waarden niet meer
// terugzetten), en alleen als er nog geen reistijdveld te zien is, zodat een
// tweede keer de velden niet weer verbergt. -> Promise<boolean>: true als de
// velden te zien zijn (of er niets te klikken viel).
const REISTIJD_VELD = '[data-qa="travel-before"], [data-qa="travel-after"]';
export function toonReistijdInVenster(venster) {
  const v = venster || vindRegistratieVenster();
  if (!v) return Promise.resolve(false);
  const veldZichtbaar = () => deepQueryAll(REISTIJD_VELD, v).some(visible);
  if (veldZichtbaar()) return Promise.resolve(true);
  const knop = deepQueryAll('uc-button[data-qa="add-travel-times"]', v).filter(visible)[0];
  if (!knop) return Promise.resolve(true);
  clickUiButton(knop);
  return wachtTot(() => veldZichtbaar() || !knop.isConnected || !visible(knop), { max: 1500 }).then(Boolean);
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
