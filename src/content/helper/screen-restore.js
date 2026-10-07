// Het gemarkeerde scherm opnieuw tekenen (na herbouw of uit/aan) en het
// hoofdscherm per modus kiezen.

import { clean } from '../ons/dom.js';
import { showAppointmentReadyToSave } from '../features/appointment/save.js';
import { appointmentFlow, helperPanel, registrationFlow } from '../state.js';
import { $body, showDisabledState } from '../screen/status.js';
import { showAppointmentNeedsPrereqs } from '../features/appointment/prereqs.js';
import { currentScreen } from '../screen/screen-state.js';
import { showChoices } from '../features/appointment/choices.js';
import {
  showNonClientDurationSelection,
  showNonClientFreeTitlePrompt,
} from '../features/appointment/non-client.js';
import {
  showAppointmentDurationSelection,
  showAppointmentTravelSelection,
} from '../features/appointment/duration.js';
import { showManualUursoortInstruction } from '../features/appointment/uursoort-screens.js';
import {
  showRegistrationChoices,
  showRegistrationDurationAsk,
  showRegistrationPortionDuration,
  showRegistrationPortionQuestion,
  showRegistrationReportPrompt,
  showRegistrationTravelSelection,
} from '../features/registration/screens.js';
import { showRegistrationHourTypeSelection } from '../features/registration/hour-type.js';
import { showRegistrationNeedsClient } from '../features/registration/prereqs.js';
import { showRegistrationNoShowPrompt } from '../features/registration/prompts.js';

export function refreshMainScreen() {
  if (!helperPanel.helperEnabled) { showDisabledState(); return; }
  if (helperPanel.activeMode === 'registrations') showRegistrationChoices();
  else showChoices();
}
// Tekent een eerder gemarkeerd scherm opnieuw. Geeft false bij een onbekende
// naam, zodat de aanroeper op de oude tekstherkenning kan terugvallen.
function renderMarkedScreen(screen) {
  if (!screen || !screen.name) return false;
  const a = screen.args || {};
  switch (screen.name) {
    case 'registrationNoShowPrompt': showRegistrationNoShowPrompt(); return true;
    case 'registrationNeedsClient': showRegistrationNeedsClient(); return true;
    case 'registrationDurationAsk': showRegistrationDurationAsk(a.choice); return true;
    case 'registrationPortionQuestion': showRegistrationPortionQuestion(a.choice); return true;
    case 'registrationPortionDuration': showRegistrationPortionDuration(a.choice); return true;
    case 'registrationTravelSelection': showRegistrationTravelSelection(a.choice); return true;
    case 'registrationHourTypeSelection': showRegistrationHourTypeSelection(a.index != null ? a.index : (registrationFlow.activeRegistrationHourTypeIndex || 0)); return true;
    case 'registrationReportPrompt': showRegistrationReportPrompt(a.choice); return true;
    case 'registrationChoices': showRegistrationChoices(); return true;
    case 'nonClientFreeTitlePrompt': showNonClientFreeTitlePrompt(a.opt); return true;
    case 'nonClientDurationSelection': showNonClientDurationSelection(a.opt); return true;
    case 'appointmentNeedsPrereqs': showAppointmentNeedsPrereqs(); return true;
    case 'appointmentReadyToSave': showAppointmentReadyToSave(); return true;
    case 'appointmentDurationSelection': showAppointmentDurationSelection(a.choice); return true;
    case 'appointmentTravelSelection': showAppointmentTravelSelection(a.choice); return true;
    case 'manualUursoortInstruction': showManualUursoortInstruction(); return true;
    case 'choices': showChoices(); return true;
    default: return false;
  }
}
export function createCurrentScreenRestore() {
  // Het gemarkeerde scherm is leidend. De tekstherkenning hieronder blijft
  // alleen nog als vangnet staan voor een scherm dat (nog) niets meldt.
  const marked = currentScreen ? { name: currentScreen.name, args: currentScreen.args } : null;
  const body = $body();
  const currentText = clean((body && body.textContent) || '');
  const registrationChoice = registrationFlow.activeRegistrationChoice;
  const appointmentChoice = appointmentFlow.pendingChoice;
  const registrationScreen = {
    noShowPrompt: currentText.includes('no show?'),
    needsClient: /vul client, begintijd en datum in/.test(currentText),
    duration: !!registrationChoice && / duur:/.test(currentText),
    portionQuestion: !!registrationChoice && /tijd aanwezig in deze registratie/.test(currentText),
    portionDuration: !!registrationChoice && /^duur .* tijd:/.test(currentText),
    travel: !!registrationChoice && /totale reistijd/.test(currentText),
    hourType: /^uursoort(?:selectie|\s)/.test(currentText),
    submit: !!registrationChoice && /richtlijn rapporteren|schrijf nu je rapportage|indienen/.test(currentText),
  };
  const nonClientOpt = appointmentFlow.activeNonClientOption;
  const appointmentScreen = {
    needsPrereqs: /vul client, begintijd en datum in|voeg evt\. een client toe aan de afspraak/.test(currentText),
    nonClientMenu: /niet clientgerelateerde afspraken/.test(currentText),
    nonClientDuration: !!nonClientOpt && / duur:/.test(currentText),
    nonClientFreeTitle: !!nonClientOpt && !!nonClientOpt.freeTitle && /vul de titel aan na/.test(currentText),
    unavailable: /onbeschikbaar|al een afspraak|alsnog doorgaan/.test(currentText),
    duration: !!appointmentChoice && / duur:/.test(currentText),
    travel: !!appointmentChoice && /totale reistijd/.test(currentText),
    manualUursoort: appointmentFlow.appointmentAwaitingManualUursoort || currentText.includes('voeg de juiste uursoort toe aan de client'),
    readyToSave: /als de instellingen kloppen|voeg eventueel nog een locatie/.test(currentText),
  };
  return () => {
    if (renderMarkedScreen(marked)) return; // scherm meldde zich zelf aan: geen giswerk nodig
    if (helperPanel.activeMode === 'registrations') {
      if (registrationScreen.noShowPrompt) { showRegistrationNoShowPrompt(); return; }
      if (registrationScreen.needsClient) { showRegistrationNeedsClient(); return; }
      if (registrationScreen.duration && registrationChoice) { showRegistrationDurationAsk(registrationChoice); return; }
      if (registrationScreen.portionQuestion && registrationChoice) { showRegistrationPortionQuestion(registrationChoice); return; }
      if (registrationScreen.portionDuration && registrationChoice) { showRegistrationPortionDuration(registrationChoice); return; }
      if (registrationScreen.travel && registrationChoice) { showRegistrationTravelSelection(registrationChoice); return; }
      if (registrationScreen.hourType) { showRegistrationHourTypeSelection(registrationFlow.activeRegistrationHourTypeIndex || 0); return; }
      if (registrationScreen.submit && registrationChoice) { showRegistrationReportPrompt(registrationChoice); return; }
      showRegistrationChoices();
      return;
    }
    if (appointmentScreen.nonClientFreeTitle && nonClientOpt) { showNonClientFreeTitlePrompt(nonClientOpt); return; }
    if (appointmentScreen.nonClientDuration && nonClientOpt) { showNonClientDurationSelection(nonClientOpt); return; }
    if (appointmentScreen.nonClientMenu) { showAppointmentNeedsPrereqs(); return; }
    if (appointmentScreen.readyToSave && nonClientOpt) { showAppointmentReadyToSave(); return; }
    if (appointmentScreen.needsPrereqs) { showAppointmentNeedsPrereqs(); return; }
    // (verwijderd) beschikbaarheidsmelding "heeft al een afspraak" -> geen routing meer
    if (appointmentScreen.duration && appointmentChoice) { showAppointmentDurationSelection(appointmentChoice); return; }
    if (appointmentScreen.travel && appointmentChoice) { showAppointmentTravelSelection(appointmentChoice); return; }
    if (appointmentScreen.manualUursoort) { showManualUursoortInstruction(); return; }
    if (appointmentScreen.readyToSave) { showAppointmentReadyToSave(); return; }
    showChoices();
  };
}
