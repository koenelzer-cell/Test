// Reistijd heen/terug op het afspraakformulier.

import { clean, isOwnPopup, rect, visible } from '../../ons/dom.js';
import {
  clickOption,
  inputTextValue,
  setInputTextOnsVerified,
  setInputTextQuiet,
} from '../../ons/form-controls.js';
import { appointmentTravelInput } from '../../ons/appointment-form.js';
import { deepQueryAll } from '../../ons/dom.js';

function appointmentTravelStepperButton(input, dir) {
  if (!input) return null;
  const ir = rect(input);
  const buttons = deepQueryAll('button,[role="button"],uc-button')
    .filter((btn) => visible(btn) && !isOwnPopup(btn))
    .map((btn) => ({ btn, r: rect(btn), text: clean(btn.textContent || btn.getAttribute('aria-label') || btn.getAttribute('title') || '') }))
    .filter(({ r }) => r.top < ir.bottom + 10 && r.bottom > ir.top - 10 && r.left >= ir.left - 4 && r.left <= ir.right + 130);
  const plus = buttons.filter((b) => /\+|plus|verhoog|increase|increment/.test(b.text)).sort((a, b) => a.r.left - b.r.left).pop();
  const minus = buttons.filter((b) => /\u2212|-|min|verlaag|decrease|decrement/.test(b.text)).sort((a, b) => a.r.left - b.r.left)[0];
  if (dir > 0) return (plus && plus.btn) || buttons.sort((a, b) => b.r.left - a.r.left)[0]?.btn || null;
  return (minus && minus.btn) || buttons.sort((a, b) => a.r.left - b.r.left)[0]?.btn || null;
}
function clickTravelStepperToValue(input, wanted) {
  if (!input) return false;
  const current = Number.parseInt(inputTextValue(input) || '0', 10);
  if (!Number.isFinite(current) || current === wanted) return current === wanted;
  const diff = wanted - current;
  const btn = appointmentTravelStepperButton(input, diff);
  if (!btn) return false;
  const count = Math.min(Math.abs(diff), 80);
  for (let i = 0; i < count; i++) clickOption(btn);
  return true;
}
export function setAppointmentTravelTotalMinutes(totalMinutes) {
  const there = appointmentTravelInput('heen');
  const back = appointmentTravelInput('terug');
  if (!there || !back) return false;
  const thereText = String(Math.ceil(totalMinutes / 2));
  const backText = String(Math.floor(totalMinutes / 2));
  setInputTextOnsVerified(there, thereText);
  setInputTextOnsVerified(back, backText);
  setTimeout(() => {
    if (inputTextValue(there) !== thereText) clickTravelStepperToValue(there, Number(thereText));
    if (inputTextValue(back) !== backText) clickTravelStepperToValue(back, Number(backText));
  }, 180);
  setTimeout(() => {
    if (inputTextValue(there) !== thereText) clickTravelStepperToValue(there, Number(thereText));
    if (inputTextValue(back) !== backText) clickTravelStepperToValue(back, Number(backText));
  }, 460);
  return true;
}
export function clearAppointmentTravelTimes() {
  const fields = [appointmentTravelInput('heen'), appointmentTravelInput('terug')].filter(Boolean);
  if (!fields.length) return true;
  for (const field of fields) setInputTextQuiet(field, '0');
  return true;
}
// De ingevulde reistijd (heen + terug) in minuten, of null als de velden er
// niet zijn. Leest wat er staat, ongeacht wie het heeft ingevuld.
export function appointmentTravelTotalMinutes() {
  const there = appointmentTravelInput('heen');
  const back = appointmentTravelInput('terug');
  if (!there || !back) return null;
  const a = parseInt(inputTextValue(there), 10);
  const b = parseInt(inputTextValue(back), 10);
  const total = (isFinite(a) ? a : 0) + (isFinite(b) ? b : 0);
  return total > 0 ? total : null;
}
