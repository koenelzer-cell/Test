// Doorplannen (herhaling) op de opslaanpagina.

import { APP_CONFIG } from '../../config/app-config.js';
import { resolveText } from '../../ui/managed-text.js';
import { clean, deepQueryAll, isOwnPopup, pollFor, visible } from '../../ons/dom.js';
import { clickElementCenter, clickOption, clickUiButton } from '../../ons/form-controls.js';
import { findRecurrenceField, findRecurrenceHeader } from '../../ons/appointment-form.js';
import { eerstViaFormulier, zetHerhalingNietViaFormulier } from '../../ons/form-model.js';
import { appointmentFlow } from '../../state.js';
import { highlightField } from '../../ui/highlight.js';

// Platte tekst van de doorplannen-waarschuwing (beheerbaar, met terugval).
export function doorplannenWarnText() {
  const c = resolveText('doorplannen_waarschuwing');
  return (c && c.text) || "Je gaf aan de afspraak te willen doorplannen, maar de herhaling staat nog op 'Niet'. Stel de herhaling in, of zet 'Afspraak doorplannen?' uit en sla op.";
}
// Huidige herhaling-waarde: uitgeklapt uit het keuzeveld, anders uit de
// subtitel onder de kop. 'niet'/'' betekent: nog niet ingesteld.
export function recurrenceValue() {
  const sel = findRecurrenceField();
  if (sel) {
    const combo = deepQueryAll('[role="combobox"]', sel)[0];
    if (combo) {
      const v = clean(combo.getAttribute('aria-description') || combo.textContent || '');
      if (v) return v;
    }
    const t = clean(sel.textContent || '');
    if (t) return t;
  }
  const head = findRecurrenceHeader();
  if (head) {
    let spans; try { spans = head.querySelectorAll('span'); } catch (e) { spans = []; }
    if (spans.length >= 2) return clean(spans[spans.length - 1].textContent || '');
  }
  return '';
}
export function recurrenceIsSet() { const v = recurrenceValue(); return !!v && v !== 'niet'; }
export function recurrenceHeaderExpanded() { const h = findRecurrenceHeader(); return !!(h && h.getAttribute('aria-expanded') === 'true'); }
function clickRecurrenceHeader(head) {
  if (!head) return false;
  return clickUiButton(head) || clickElementCenter(head) || (clickOption(head), true);
}
// Klap de 'Herhaling'-sectie open (klik de kop) zodat de gebruiker een
// herhaling kan kiezen, en zet de roze omlijning op het recurrence-type
// KEUZEVELD dat daarna verschijnt (niet op de kop).
export function expandRecurrence() {
  const head = findRecurrenceHeader();
  if (head && head.getAttribute('aria-expanded') !== 'true') clickRecurrenceHeader(head);
  pollFor(() => findRecurrenceField(), (field) => { if (field) { try { highlightField(field, 5000); } catch (e) {} } }, { timeout: 2000, interval: 50 });
  return !!head;
}
// De combobox binnen het recurrence-type keuzeveld (opent de keuzelijst).
function recurrenceCombo() {
  const field = findRecurrenceField();
  return field ? (deepQueryAll('[role="combobox"]', field)[0] || null) : null;
}
// Via het scherm: de keuzelijst openen en de optie 'Niet' aanklikken.
function herhalingNietViaScherm() {
  return new Promise((klaar) => {
    const combo = recurrenceCombo();
    if (!combo) { klaar(false); return; }
    clickElementCenter(combo); // open de keuzelijst
    pollFor(() => {
      const opts = deepQueryAll('[role="option"], uc-select-list li, [role="listbox"] li').filter((o) => visible(o) && !isOwnPopup(o));
      return opts.find((o) => clean(o.textContent) === 'niet') || null;
    }, (opt) => {
      if (opt) clickElementCenter(opt);
      else { try { combo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (e) {} }
      klaar(!!opt);
    }, { timeout: 2000, interval: 50 });
  });
}
// Zet de herhaling terug op 'Niet': eerst via het formulier (Vue, zonder de
// keuzelijst te openen), anders via het scherm.
export function setRecurrenceToNiet(done) {
  if (!recurrenceIsSet()) { if (done) done(true); return; }
  eerstViaFormulier(() => zetHerhalingNietViaFormulier(), herhalingNietViaScherm)
    .then((ok) => { if (done) done(!!ok); }, () => { if (done) done(false); });
}
// Toggle 'uit': eerst de herhaling terug op 'Niet' zetten en dán de sectie
// inklappen (ook als er bv. 'Dagelijks' stond), zodat de afspraak niet stiekem
// toch blijft doorplannen.
export function collapseRecurrence() {
  const finish = () => { const head = findRecurrenceHeader(); if (head && head.getAttribute('aria-expanded') === 'true') clickRecurrenceHeader(head); };
  if (!recurrenceIsSet()) { finish(); return true; }
  setRecurrenceToNiet(() => { setTimeout(finish, 60); });
  return true;
}
// Blokkeert opslaan zolang 'Afspraak doorplannen?' aan staat maar de herhaling
// nog op 'Niet': óf een herhaling kiezen, óf de toggle uitzetten.
export function doorplannenBlocksSave() {
  return !(APP_CONFIG.features && APP_CONFIG.features.doorplannenToggle === false)
    && appointmentFlow.appointmentDoorplannen && !recurrenceIsSet();
}
