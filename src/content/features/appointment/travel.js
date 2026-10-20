// Reistijd heen/terug op het afspraakformulier.
//
// Zetten (en op 0 zetten) gaat eerst via het afspraakmodel van ONS
// (onChange(minuten, 'travel_time_before' / 'travel_time_after') in de
// main-world), nagekeken in de velden; lukt dat niet, dan typen.

import { wachtTot } from '../../core/wacht.js';
import { eerstViaFormulier, zetVeldViaFormulier } from '../../ons/form-model.js';
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
function reistijdTypen(heen, terug) {
  const there = appointmentTravelInput('heen');
  const back = appointmentTravelInput('terug');
  if (!there || !back) return false;
  const thereText = String(heen);
  const backText = String(terug);
  setInputTextOnsVerified(there, thereText);
  setInputTextOnsVerified(back, backText);
  [180, 460].forEach((delay) => setTimeout(() => {
    if (inputTextValue(there) !== thereText) clickTravelStepperToValue(there, heen);
    if (inputTextValue(back) !== backText) clickTravelStepperToValue(back, terug);
  }, delay));
  return true;
}
// heen en terug in minuten. -> Promise<boolean>: true als de velden het tonen.
export function zetReistijdenAsync(heen, terug) {
  const toont = () => {
    const a = appointmentTravelInput('heen'), b = appointmentTravelInput('terug');
    return !!a && !!b && (parseInt(inputTextValue(a), 10) || 0) === heen && (parseInt(inputTextValue(b), 10) || 0) === terug;
  };
  return eerstViaFormulier(
    () => zetVeldViaFormulier('travel_time_before', heen)
      .then((ok) => ok && zetVeldViaFormulier('travel_time_after', terug))
      .then((ok) => ok && wachtTot(toont, { max: 600 }).then(Boolean)),
    () => reistijdTypen(heen, terug)
  );
}
// Totaal over heen en terug verdeeld. Geeft meteen terug of de velden er
// zijn; het zetten zelf loopt via zetReistijdenAsync.
export function setAppointmentTravelTotalMinutes(totalMinutes) {
  if (!appointmentTravelInput('heen') || !appointmentTravelInput('terug')) return false;
  zetReistijdenAsync(Math.ceil(totalMinutes / 2), Math.floor(totalMinutes / 2));
  return true;
}
export function clearAppointmentTravelTimes() {
  const velden = () => [appointmentTravelInput('heen'), appointmentTravelInput('terug')].filter(Boolean);
  const fields = velden();
  if (fields.every((f) => inputTextValue(f) === '0')) return true;
  eerstViaFormulier(
    () => zetVeldViaFormulier('travel_time_before', 0)
      .then((ok) => ok && zetVeldViaFormulier('travel_time_after', 0))
      .then((ok) => ok && wachtTot(() => velden().every((f) => !(parseInt(inputTextValue(f), 10) > 0)), { max: 600 }).then(Boolean)),
    () => { for (const field of velden()) setInputTextQuiet(field, '0'); return true; }
  );
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
