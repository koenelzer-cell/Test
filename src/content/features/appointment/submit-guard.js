// Opslaan blokkeren zolang er geen uursoort is.

import { overrideEl } from '../../ons/selector-overrides.js';
import { isOwnPopup, visible } from '../../ons/dom.js';
import { findRecurrenceField, findRecurrenceHeader } from '../../ons/appointment-form.js';
import { appointmentLabelRequiredButMissing } from './fields.js';
import { hasUursoortSelected, shouldRequireUursoortForSubmit } from './uursoort-field.js';
import { doorplannenBlocksSave } from './recurrence.js';
import { appointmentFlow, helperPanel } from '../../state.js';
import { setStatus } from '../../screen/status.js';
import { highlightField } from '../quality.js';
import { nonClientFreeTitleComplete, nonClientUursoortSet } from './non-client.js';
import { deepQueryAll } from '../../ons/dom.js';

export function submitButtons() {
  const ov = overrideEl('afsOpslaan'); if (ov) return [ov];
  return deepQueryAll('button[type="submit"], uc-button[type="submit"]')
    .filter((btn) => visible(btn) && !isOwnPopup(btn));
}
export function setSubmitBlocked(blocked) {
  for (const btn of submitButtons()) {
    const target = btn.shadowRoot ? (btn.shadowRoot.querySelector('button[type="submit"], button') || btn) : btn;
    try { btn.setAttribute('aria-disabled', blocked ? 'true' : 'false'); } catch (e) {}
    try { target.setAttribute('aria-disabled', blocked ? 'true' : 'false'); } catch (e) {}
    if (target instanceof HTMLButtonElement) target.disabled = blocked;
    if (btn instanceof HTMLButtonElement) btn.disabled = blocked;
    // Visueel 'geblokkeerd' + een 'niet toegestaan'-cursor (rood cirkeltje met
    // schuine streep) bij hover. Belangrijk: GEEN pointer-events:none meer,
    // want dan valt de hover weg en zie je die cursor nooit. Het daadwerkelijk
    // tegenhouden van opslaan gebeurt via de disabled-knop + de submit-guard.
    for (const el of [target, btn]) {
      if (el && el.style) {
        el.style.opacity = blocked ? '0.45' : '';
        el.style.cursor = blocked ? 'not-allowed' : '';
        el.style.pointerEvents = blocked ? 'auto' : '';
      }
    }
  }
}
export function updateSubmitGuard() {
  if (appointmentFlow.appointmentFreeDay) { setSubmitBlocked(false); return; }
  if (appointmentFlow.activeNonClientOption && appointmentFlow.activeNonClientOption.freeTitle) {
    setSubmitBlocked(!nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption) || doorplannenBlocksSave());
    return;
  }
  const missing = appointmentFlow.activeNonClientOption ? !nonClientUursoortSet() : !hasUursoortSelected();
  setSubmitBlocked((shouldRequireUursoortForSubmit() && missing) || appointmentLabelRequiredButMissing() || doorplannenBlocksSave());
}
function isSubmitButtonNode(el) {
  let n = el;
  for (let i = 0; n && i < 8; i++) {
    if (n.nodeType === 1 && n.matches && n.matches('button[type="submit"], uc-button[type="submit"]')) return true;
    if (n.parentElement) n = n.parentElement;
    else {
      const root = n.getRootNode && n.getRootNode();
      n = root && root.host ? root.host : null;
    }
  }
  return false;
}
export function blockSubmitIfNoUursoort(e) {
  if (!helperPanel.helperEnabled) return;
  if (appointmentFlow.appointmentFreeDay) return; // vrije/grijze dag: niet blokkeren
  if (isOwnPopup(e.target)) return;
  if (e.type === 'click' && !isSubmitButtonNode(e.target)) return;
  const doorplannenBlock = doorplannenBlocksSave();
  if (appointmentFlow.activeNonClientOption && appointmentFlow.activeNonClientOption.freeTitle) {
    if (nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption) && !doorplannenBlock) { updateSubmitGuard(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    updateSubmitGuard();
    if (!nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption)) setStatus('Vul eerst de titel aan.', false);
    else { setStatus('Stel de herhaling in of zet doorplannen uit', false); try { highlightField(findRecurrenceField() || findRecurrenceHeader(), 5000); } catch (e2) {} }
    return;
  }
  const uursoortOk = !shouldRequireUursoortForSubmit() || (appointmentFlow.activeNonClientOption ? nonClientUursoortSet() : hasUursoortSelected());
  const labelMissing = appointmentLabelRequiredButMissing();
  if (uursoortOk && !labelMissing && !doorplannenBlock) { updateSubmitGuard(); return; }
  e.preventDefault();
  e.stopPropagation();
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  updateSubmitGuard();
  // Volgorde van meldingen: eerst label, dan uursoort, dan doorplannen.
  if (labelMissing) setStatus('Voeg eerst een label aan de afspraak toe.', false);
  else if (!uursoortOk) setStatus(appointmentFlow.activeNonClientOption ? 'Voeg nog een uursoort toe.' : 'Voeg eerst bij elke client een uursoort toe.', false);
  else { setStatus('Stel de herhaling in of zet doorplannen uit', false); try { highlightField(findRecurrenceField() || findRecurrenceHeader(), 5000); } catch (e2) {} }
}
