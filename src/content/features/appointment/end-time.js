// Eindtijd: berekenen, zetten en bewaken tegen overschrijven.

import { addMinutesText } from '../../core/datetime.js';
import { inputTextValue, setInputTextComposed } from '../../ons/form-controls.js';
import { getEndTimeInput } from '../../ons/appointment-form.js';
import {
  appointmentCurrentStartTimeText,
  restoreAppointmentStartTime,
  setAppointmentEndInputText,
} from './fields.js';
import { appointmentFlow } from '../../state.js';
import { safe } from '../../screen/status.js';

export function clearEndTime() {
  const input = getEndTimeInput();
  if (!input) return false;
  setInputTextComposed(input, '');
  return true;
}
export function setAppointmentEndTimePlusMinutes(minutes) {
  const startText = String(appointmentCurrentStartTimeText() || appointmentFlow.activeAppointmentStartTimeText || '').trim();
  if (!/^(\d{1,2}):(\d{2})$/.test(startText)) return false;
  appointmentFlow.activeAppointmentStartTimeText = startText;
  restoreAppointmentStartTime();
  const next = addMinutesText(startText, minutes);
  if (!next) return false;
  const apply = () => {
    const fresh = getEndTimeInput();
    if (!fresh) return false;
    return setAppointmentEndInputText(fresh, next);
  };
  const ok = apply();
  [80, 220, 420].forEach((delay) => setTimeout(() => {
    const fresh = getEndTimeInput();
    if (fresh && inputTextValue(fresh) !== next) setAppointmentEndInputText(fresh, next);
  }, delay));
  return ok;
}
export function enforceAppointmentEndTime(minutes) {
  if (!minutes) return false;
  if (appointmentFlow.appointmentEndTimeUserOwned) return false; // medewerker bezit de eindtijd: niet terugzetten
  // Ververs begintijd vanuit DOM bij elke poging (gebruiker vult start misschien pas later in).
  const fresh = appointmentCurrentStartTimeText();
  if (fresh) appointmentFlow.activeAppointmentStartTimeText = fresh;
  const startText = String(appointmentFlow.activeAppointmentStartTimeText || '').trim();
  if (!/^(\d{1,2}):(\d{2})$/.test(startText)) return false;
  restoreAppointmentStartTime();
  const wanted = addMinutesText(startText, minutes);
  const endInput = getEndTimeInput();
  if (!wanted || !endInput) return false;
  const current = inputTextValue(endInput);
  // Heeft de hulp de eindtijd al eens vastgelegd (helperEndText) én staat er nu
  // een andere geldige waarde? Dan heeft de medewerker hem zelf aangepast: overnemen
  // en niet meer terugzetten (voorkomt dat een herhaling de eindtijd reset).
  if (appointmentFlow.helperEndText && /^(\d{1,2}):(\d{2})$/.test(current) && current !== appointmentFlow.helperEndText) {
    appointmentFlow.appointmentEndTimeUserOwned = true;
    return false;
  }
  if (current !== wanted) setAppointmentEndInputText(endInput, wanted); // schrijft + onthoudt helperEndText
  else appointmentFlow.helperEndText = wanted; // al goed: leg dit vast als hulp-waarde
  return true;
}
export function scheduleAppointmentEndTime(minutes) {
  appointmentFlow.activeAppointmentDurationMinutes = minutes || appointmentFlow.activeAppointmentDurationMinutes;
  if (!appointmentFlow.activeAppointmentDurationMinutes) return;
  appointmentFlow.appointmentTimeGuardTimers.forEach((timer) => clearTimeout(timer));
  appointmentFlow.appointmentTimeGuardTimers = [];
  [0, 140, 420].forEach((delay) => {
    const timer = setTimeout(() => safe(() => {
      restoreAppointmentStartTime();
      enforceAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
    }), delay);
    appointmentFlow.appointmentTimeGuardTimers.push(timer);
  });
}
