// Duur- en reistijdkeuze voor een afspraak.

import { APP_CONFIG, gsNum } from '../../config/app-config.js';
import { registrationDurationLabel } from '../../core/datetime.js';
import { appointmentCurrentStartTimeText, hasAppointmentPrereqs } from './fields.js';
import {
  enforceAppointmentEndTime,
  scheduleAppointmentEndTime,
  setAppointmentEndTimePlusMinutes,
} from './end-time.js';
import { clearAppointmentTravelTimes, setAppointmentTravelTotalMinutes } from './travel.js';
import { appointmentFlow, helperPanel } from '../../state.js';
import { $body, safe, setStatus } from '../../screen/status.js';
import { showAppointmentNeedsPrereqs } from './prereqs.js';
import { ONSAH_TOKENS } from '../../ui/theme.js';
import { durationLabelStyle, mkDurationPicker, mkValuePicker } from '../../ui/duration-picker.js';
import { markScreen } from '../../screen/screen-state.js';
import { renderScreen } from '../../ui/react-bridge.js';
import { handleChoice, showChoices } from './choices.js';

// Past een gekozen (of standaard) afspraakduur toe: eindtijd zetten en doorgaan
// naar reistijd (bij addTravelTime) of direct naar handleChoice. Wordt aangeroepen
// vanuit de duurknoppen én bij het overslaan van de duurvraag (defaultDuration).
export function applyAppointmentDuration(choice, minutes) {
  appointmentFlow.appointmentFlowBusy = true;
  appointmentFlow.activeAppointmentDurationMinutes = minutes;
  appointmentFlow.activeAppointmentStartTimeText = appointmentCurrentStartTimeText();
  if (choice.addTravelTime) {
    const endOk = setAppointmentEndTimePlusMinutes(minutes);
    scheduleAppointmentEndTime(minutes);
    setStatus(endOk ? `${choice.label} ${registrationDurationLabel(minutes)}` : 'Eindtijd niet gezet', endOk);
    setTimeout(() => showAppointmentTravelSelection(choice), 80);
  } else {
    // Zelfde volgorde als Huisbezoek: eerst reistijd wissen, DAARNA eindtijd
    // zetten en plannen, zodat de eindtijd niet door clear/handleChoice
    // wordt teruggedraaid (eerder werkte alleen Huisbezoek).
    clearAppointmentTravelTimes();
    const endOk = setAppointmentEndTimePlusMinutes(minutes);
    scheduleAppointmentEndTime(minutes);
    setStatus(endOk ? `${choice.label} ${registrationDurationLabel(minutes)}` : 'Eindtijd niet gezet', endOk);
    setTimeout(() => {
      handleChoice(choice);
      // forceer de eindtijd nogmaals nadat handleChoice de velden heeft aangeraakt
      scheduleAppointmentEndTime(minutes);
      [120, 350, 650].forEach((d) => setTimeout(() => safe(() => enforceAppointmentEndTime(minutes)), d));
    }, 80);
  }
}
export function showAppointmentDurationSelection(choice) {
  const body = $body(); if (!body) return;
  if (!hasAppointmentPrereqs()) { showAppointmentNeedsPrereqs(); return; }
  markScreen('appointmentDurationSelection', { choice: choice });
  appointmentFlow.appointmentFlowBusy = false;
  const _st = (choice.durationStep>0?choice.durationStep:gsNum('durationStepMin',15));
  const _mx = (choice.maxDuration>0?choice.maxDuration:gsNum('registrationMaxMin',180));
  const _durValues = []; for (let m=_st; m<=_mx; m+=_st) _durValues.push(m);
  renderScreen(body, 'duration', {
    title: `${choice.label} duur:`,
    tokens: ONSAH_TOKENS,
    onBack: function () { helperPanel.suppressAutoUntil = Date.now() + 1200; safe(showChoices); },
    pickerNode: mkDurationPicker(_durValues, (minutes) => safe(() => applyAppointmentDuration(choice, minutes)), choice.pickerStyle, undefined, durationLabelStyle('duur')),
  });
}
export function showAppointmentTravelSelection(choice) {
  const body = $body(); if (!body) return;
  markScreen('appointmentTravelSelection', { choice: choice });
  appointmentFlow.appointmentFlowBusy = false;
  const _ts = (APP_CONFIG.generalSettings&&APP_CONFIG.generalSettings.travelStepMin>0?APP_CONFIG.generalSettings.travelStepMin:5);
  const _tm = (APP_CONFIG.generalSettings&&APP_CONFIG.generalSettings.travelMaxMin>0?APP_CONFIG.generalSettings.travelMaxMin:60);
  const _travelValues = []; for (let m=0; m<=_tm; m+=_ts) _travelValues.push(m);
  renderScreen(body, 'duration', {
    title: 'Totale reistijd (heen en terug):',
    tokens: ONSAH_TOKENS,
    onBack: function () { helperPanel.suppressAutoUntil = Date.now() + 1200; safe(showChoices); },
    pickerNode: mkValuePicker(_travelValues, 0, (minutes) => safe(() => {
      appointmentFlow.appointmentFlowBusy = true;
      const ok = setAppointmentTravelTotalMinutes(minutes);
      setStatus(ok ? `Reistijd gezet: ${registrationDurationLabel(minutes)} totaal` : 'Reistijdvelden niet gevonden', ok);
      setTimeout(() => handleChoice(choice), 70);
    }), choice.pickerStyle, undefined, durationLabelStyle('duur')),
  });
}
