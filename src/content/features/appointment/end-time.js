// Eindtijd: berekenen, zetten en bewaken tegen overschrijven.
//
// Zetten gaat eerst via het afspraakmodel van ONS (onChange(tijd, 'end_time')
// in de main-world), nagekeken in het veld; lukt dat niet, dan typen.

import { addMinutesText } from '../../core/datetime.js';
import { wachtTot } from '../../core/wacht.js';
import { inputTextValue, setInputTextComposed } from '../../ons/form-controls.js';
import { getEndTimeInput } from '../../ons/appointment-form.js';
import { eerstViaFormulier, zetVeldViaFormulier } from '../../ons/form-model.js';
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
// Welke eindtijd de hulp nu aan het zetten is (via het model loopt dat even).
// Zolang staat er nog de oude tijd in het veld; dat is geen eigen wijziging.
let eindtijdBezig = '';

function eindtijdTypen(tekst) {
  const fresh = getEndTimeInput();
  if (!fresh) return false;
  const ok = setAppointmentEndInputText(fresh, tekst);
  [80, 220, 420].forEach((delay) => setTimeout(() => {
    const nu = getEndTimeInput();
    if (nu && inputTextValue(nu) !== tekst) setAppointmentEndInputText(nu, tekst);
  }, delay));
  return ok;
}
// -> Promise<boolean>: true als de eindtijd in het veld staat.
export function zetEindtijdAsync(tekst) {
  const tijd = String(tekst || '');
  const toont = () => { const inp = getEndTimeInput(); return !!inp && inputTextValue(inp) === tijd; };
  appointmentFlow.helperEndText = tijd;
  eindtijdBezig = tijd;
  const klaar = (ok) => { if (eindtijdBezig === tijd) eindtijdBezig = ''; return ok; };
  return eerstViaFormulier(
    () => zetVeldViaFormulier('end_time', tijd).then((ok) => ok && wachtTot(toont, { max: 600 }).then(Boolean)),
    () => eindtijdTypen(tijd)
  ).then(klaar, () => klaar(false));
}
// Begintijd + minuten. Geeft meteen terug of het kan (begintijd en eindveld
// er); het zetten zelf loopt via zetEindtijdAsync.
export function setAppointmentEndTimePlusMinutes(minutes) {
  const startText = String(appointmentCurrentStartTimeText() || appointmentFlow.activeAppointmentStartTimeText || '').trim();
  if (!/^(\d{1,2}):(\d{2})$/.test(startText)) return false;
  appointmentFlow.activeAppointmentStartTimeText = startText;
  restoreAppointmentStartTime();
  const next = addMinutesText(startText, minutes);
  if (!next || !getEndTimeInput()) return false;
  zetEindtijdAsync(next);
  return true;
}
export function enforceAppointmentEndTime(minutes) {
  if (!minutes) return false;
  if (appointmentFlow.appointmentEndTimeUserOwned) return false; // medewerker bezit de eindtijd: niet terugzetten
  if (eindtijdBezig) return true;
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
  if (current !== wanted) zetEindtijdAsync(wanted); // onthoudt helperEndText
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
