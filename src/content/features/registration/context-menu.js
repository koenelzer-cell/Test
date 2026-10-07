// Rechtermuismenu 'Registreren als…': vorm expliciet kiezen.

import { ONS } from '../../ons/selectors.js';
import { REGISTRATION_CHOICES } from '../../config/app-config.js';
import { clean } from '../../ons/dom.js';
import { safe, setStatus } from '../../screen/status.js';
import { MSG } from '../../../shared/messages.js';

/* ===== Rechtermuismenu: registratievorm kiezen =====
   Normaal leidt de hulp de registratievorm af uit het ONS-afspraaklabel. Met
   het rechtermuismenu kies je hem expliciet — handig als een afspraak geen
   label heeft, of als het label deze keer niet klopt.

   Het menu zelf wordt door de service worker gebouwd (alleen die mag dat), uit
   de vormen die dit script doorgeeft. De keuze komt hier terug als bericht.
   ========================================================================== */
const CTX_MAX_AGE_MS = 30 * 1000;   // ouder dan dit: niet meer "de aangeklikte afspraak"
let _ctxOccurrence = null, _ctxOccurrenceTs = 0;
// Onthoud waar de rechtermuisklik viel. Het menu-item weet dat niet: de worker
// krijgt van de browser geen element mee, alleen de tab.
// Opstarten: onthoud op welke afspraak met rechts geklikt is.
export function installContextMenuTracking() {
  document.addEventListener('contextmenu', function (e) {
    let occ = null;
    try { occ = e.target && e.target.closest && e.target.closest(ONS.occurrenceBase); } catch (err) { occ = null; }
    _ctxOccurrence = occ || null;
    _ctxOccurrenceTs = occ ? Date.now() : 0;
  }, true);
}
function ctxOccurrence() {
  if (!_ctxOccurrence) return null;
  if ((Date.now() - _ctxOccurrenceTs) > CTX_MAX_AGE_MS) return null;
  if (!_ctxOccurrence.isConnected) return null;   // agenda opnieuw getekend
  return _ctxOccurrence;
}
// Expliciet gekozen vorm, korte houdbaarheid. capturePendingRegistrationLabel
// leest dit zodat een klik op Registreren de keuze niet overschrijft met het
// label van de afspraak.
let _ctxForcedVorm = null, _ctxForcedTs = 0;
export function ctxForcedVorm() {
  if (!_ctxForcedVorm) return null;
  if ((Date.now() - _ctxForcedTs) > CTX_MAX_AGE_MS) return null;
  return _ctxForcedVorm;
}
// Wacht tot de detailpopup er staat (die bouwt ONS asynchroon op).
function wachtOpPopup(pogingen, done) {
  const pop = document.querySelector(ONS.popoverRoot);
  if (pop) { done(pop); return; }
  if (pogingen <= 0) { done(null); return; }
  setTimeout(function () { wachtOpPopup(pogingen - 1, done); }, 100);
}
// Start een registratie met een expliciet gekozen vorm.
// Route: popup openen (als die nog dicht is) -> vorm vastleggen -> op de
// Registreren-knop van ONS klikken. Zo loopt het verder door de bestaande
// flow; we bouwen geen tweede weg naar het registratiescherm.
export function startRegistrationWithForm(vorm) {
  const gekozen = REGISTRATION_CHOICES.find((x) => clean(x.label) === clean(vorm));
  if (!gekozen) return;
  _ctxForcedVorm = gekozen.label;
  _ctxForcedTs = Date.now();

  const klikRegistreren = function (scope) {
    const root = scope || document;
    let knop = null;
    try { knop = root.querySelector('[data-qa="occurrence-popover-primary"], [data-qa="declare_button"], #declare-option-link'); } catch (e) {}
    if (!knop) { setStatus('Geen Registreren-knop gevonden op deze afspraak', false); return; }
    knop.click();
  };

  const bestaandePopup = document.querySelector(ONS.popoverRoot);
  if (bestaandePopup) { klikRegistreren(bestaandePopup); return; }

  const occ = ctxOccurrence();
  if (!occ) { setStatus('Klik met rechts op een afspraak om die te registreren', false); return; }
  occ.click();                       // popup openen
  wachtOpPopup(15, function (pop) { klikRegistreren(pop); });
}
// Berichten van de service worker (menukeuze).
// Opstarten: menukeuze van de service worker afhandelen.
export function listenForContextMenuChoice() {
  try {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (!msg || msg.type !== MSG.CTX_REGISTER) return;
      safe(function () { startRegistrationWithForm(msg.vorm); });
    });
  } catch (e) {}
}
// De worker kent de registratievormen niet; die staan in de beheerbare config.
// Doorgeven zodra we ze hebben, en opnieuw als de config wijzigt.
export function pushRegistrationForms() {
  try {
    const namen = (REGISTRATION_CHOICES || []).map((c) => c && c.label).filter(Boolean);
    if (namen.length) chrome.runtime.sendMessage({ type: MSG.FORMS, forms: namen });
  } catch (e) {}
}
