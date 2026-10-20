// Afspraakformulier: titel, label-veld, datum en tijden lezen/schrijven.

import { allKnownLabels } from '../../config/app-config.js';
import { clean, deepQueryAll, isOwnPopup, rect, visible } from '../../ons/dom.js';
import { inputTextValue, setInputText, setInputTextComposed, typeIntoSearchField, uiText } from '../../ons/form-controls.js';
import { findClientEntries, getDateInput, getEndTimeInput, getEtiketTrigger, getStartTimeInput, getTitleInput, getTitleInputSafe } from '../../ons/appointment-form.js';
import { selectedKnownLabels } from './labels.js';
import { appointmentFlow } from '../../state.js';
import { ucTimeInputHost } from '../../ons/time-input.js';

export function setAppointmentTitleText(text) {
  const input = getTitleInputSafe();
  if (!input) return false;
  setInputText(input, text);
  return true;
}
export function setAppointmentEndInputText(inp, text) {
  if (!inp) return false;
  const startInput = getStartTimeInput();
  if (startInput && inp === startInput) return false;
  // Gebruik dezelfde keystroke-simulatie als typeIntoSearchField: de uc-time-input
  // component is een gecontroleerd web-component dat alleen reageert op echte
  // beforeinput/input-events met composed:true; simpel .value zetten werkt niet
  // omdat de component bij de volgende render terug naar leeg gaat.
  typeIntoSearchField(inp, text);
  // Blur zodat de component de waarde commit (veel ControlValueAccessor-implementaties
  // slaan de waarde pas op bij blur).
  inp.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
  try { inp.blur && inp.blur(); } catch (e) {}
  // Notificeer ook de uc-time-input host direct
  const host = ucTimeInputHost(inp);
  if (host) {
    try { host.value = text; } catch (e) {}
    try { host.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(text) })); } catch (e) {}
    host.dispatchEvent(new Event('change', { bubbles: true }));
  }
  appointmentFlow.helperEndText = String(text); // onthoud wat de hulp als laatste in de eindtijd schreef
  return true;
}
export function hasAppointmentDate() {
  const dateInput = getDateInput();
  if (dateInput && /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(String(dateInput.value || dateInput.getAttribute('value') || dateInput.textContent || '').trim())) return true;
  return deepQueryAll('input,span,div,uc-date-input').some((el) => {
    if (!visible(el) || isOwnPopup(el)) return false;
    const meta = clean(`${el.id || ''} ${el.getAttribute && (el.getAttribute('name') || '')} ${el.getAttribute && (el.getAttribute('aria-label') || '')} ${el.getAttribute && (el.getAttribute('placeholder') || '')}`);
    const text = String(('value' in el ? el.value : '') || (el.getAttribute && el.getAttribute('value')) || el.textContent || '').trim();
    if (!/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(text)) return false;
    return /datum|date|dd-mm-jjjj/.test(meta) || rect(el).width < 260;
  });
}
export function hasAppointmentStartTime() {
  const startInput = getStartTimeInput();
  if (startInput && /^(\d{1,2}):(\d{2})$/.test(String(startInput.value || startInput.getAttribute('value') || startInput.textContent || '').trim())) return true;
  return !!appointmentStartTimeTextFromUi();
}
function appointmentStartTimeTextFromUi() {
  const labels = deepQueryAll('label,div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && /^begintijd\*?$/.test(clean(el.textContent || '')));
  for (const label of labels) {
    const lr = rect(label);
    const found = deepQueryAll('input,span,div,uc-time-input').find((el) => {
      if (!visible(el) || isOwnPopup(el) || el === label) return false;
      const text = String(('value' in el ? el.value : '') || (el.getAttribute && el.getAttribute('value')) || el.textContent || '').trim();
      if (!/^(\d{1,2}):(\d{2})$/.test(text)) return false;
      const r = rect(el);
      return r.top >= lr.bottom - 12 && r.top <= lr.bottom + 95 && Math.abs(r.left - lr.left) <= 180;
    });
    if (found) return String(('value' in found ? found.value : '') || (found.getAttribute && found.getAttribute('value')) || found.textContent || '').trim();
  }
  return '';
}
export function appointmentCurrentStartTimeText() {
  const startInput = getStartTimeInput();
  return String((startInput && (startInput.value || startInput.getAttribute('value'))) || appointmentStartTimeTextFromUi() || '').trim();
}
export function restoreAppointmentStartTime() {
  // Begintijd is user-owned: only read it for eindtijd calculations, never write it.
  return false;
}
export function hasAppointmentEndTime() {
  const endInput = getEndTimeInput();
  const text = String((endInput && 'value' in endInput ? endInput.value : '') || '').trim();
  return /^(\d{1,2}):(\d{2})$/.test(text);
}
export function appointmentHasKnownLabel() {
  const trigger = getEtiketTrigger();
  if (!trigger) return false;
  const selected = selectedKnownLabels(trigger, allKnownLabels());
  if (selected.length) return true;
  const txt = clean(uiText(trigger) || trigger.textContent || '');
  return allKnownLabels().some((lbl) => txt.includes(clean(lbl)));
}
// Cliëntafspraak zonder (herkend) label: opslaan blokkeren. Bewust fail-open:
// niet-cliënt-opties (Overig/Acquisitie) en het geval waarin het labelveld niet
// gevonden wordt, blokkeren we niet — dan zou opslaan onmogelijk kunnen worden.
export function appointmentLabelRequiredButMissing() {
  if (appointmentFlow.activeNonClientOption) return false;
  if (findClientEntries().length === 0) return false;
  if (!getEtiketTrigger()) return false;
  return !appointmentHasKnownLabel();
}
export function clearTitle() {
  const input = getTitleInput();
  if (!input) return false;
  try { input.focus(); } catch (e) {}
  try { input.select && input.select(); } catch (e) {}
  setInputTextComposed(input, '');
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Delete', code: 'Delete' }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Delete', code: 'Delete' }));
  setTimeout(() => {
    if ((input.value || '') !== '') setInputTextComposed(input, '');
    try { input.blur && input.blur(); } catch (e) {}
  }, 60);
  return true;
}
export function nonClientFreeTitleComplete(opt) {
  const inp = getTitleInputSafe();
  const val = inp ? inputTextValue(inp) : '';
  const trimmed = String(val || '').trim();
  if (!trimmed) return false;
  // Er moet iets staan ná "Overig -"; de prefix alleen telt niet als titel.
  const prefixRe = new RegExp('^' + (opt && opt.display ? opt.display : 'Overig').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*-\\s*', 'i');
  if (!prefixRe.test(trimmed)) return false;
  const rest = trimmed.replace(prefixRe, '');
  return !!rest.trim();
}
