// Instellingen van de registratiehulp wissen.

import { setInputTextComposed } from '../../ons/form-controls.js';
import { registrationFlow } from '../../state.js';
import { setStatus } from '../../screen/status.js';
import { clearRegistrationTravelTimes, registrationDirectTimeInput, registrationIndirectTimeInput, registrationTimeInput } from './fields.js';
import { clearRegistrationHourTypes } from './hour-type.js';
import { registrationPrimaryReportField, setRegistrationReportTextValue, updateRegistrationSubmitGuard } from './report.js';
import { schermen } from '../../screen/schermen.js';
import { PENDING_REG_KEY } from './pending-store.js';

export function clearRegistrationSettings() {
  // Wis eindtijd, rapportage, direct/indirect, reistijd en uursoort.
  registrationFlow.activeRegistrationChoice = null;
  registrationFlow.activeRegistrationPortionMinutes = null;
  registrationFlow.activeRegistrationHourTypeIndex = null;
  // Bewust resetten: na 'Instellingen verwijderen' de gewone keuzelijst tonen
  // (niet opnieuw automatisch de afspraakvorm toepassen).
  registrationFlow.registrationAutoChoice = null;
  registrationFlow.registrationAutoApplied = true;
  registrationFlow.registrationFromAppointment = false;
  registrationFlow.registrationRestoredToReport = false;
  try { sessionStorage.removeItem(PENDING_REG_KEY); } catch (e) {} // onthouden vorm vergeten
  clearTimeout(registrationFlow.reapplyRegistrationSplitTimer);
  setStatus('Instellingen verwijderen...');
  // eindtijd
  const end = registrationTimeInput('declaration_end_time_display');
  if (end) setInputTextComposed(end, '');
  // direct/indirect
  const direct = registrationDirectTimeInput();
  const indirect = registrationIndirectTimeInput();
  if (direct) setInputTextComposed(direct, '');
  if (indirect) setInputTextComposed(indirect, '');
  // reistijd
  clearRegistrationTravelTimes();
  // rapportage (alleen het door de helper toegevoegde "Label - " prefix + tekst leegmaken
  // is te riskant; we maken het primaire rapportageveld leeg)
  const field = registrationPrimaryReportField();
  if (field) setRegistrationReportTextValue(field, '');
  // uursoort
  clearRegistrationHourTypes(() => {
    updateRegistrationSubmitGuard();
    schermen.showRegistrationChoices();
    setStatus('Instellingen verwijderd');
  });
}
