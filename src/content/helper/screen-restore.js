// Het gemarkeerde scherm opnieuw tekenen (na herbouw of uit/aan) en het
// hoofdscherm per modus kiezen.

import { clean } from '../ons/dom.js';
import { appointmentFlow, helperPanel, registrationFlow } from '../state.js';
import { $body, showDisabledState } from '../screen/status.js';
import { currentScreen } from '../screen/screen-state.js';
import { schermen } from '../screen/schermen.js';

export function refreshMainScreen() {
  if (!helperPanel.helperEnabled) { showDisabledState(); return; }
  if (helperPanel.activeMode === 'registrations') schermen.showRegistrationChoices();
  else schermen.showChoices();
}
// Tekent een eerder gemarkeerd scherm opnieuw. Geeft false bij een onbekende
// naam, zodat de aanroeper op de oude tekstherkenning kan terugvallen.
function renderMarkedScreen(screen) {
  if (!screen || !screen.name) return false;
  const a = screen.args || {};
  switch (screen.name) {
    case 'registrationNoShowPrompt': schermen.showRegistrationNoShowPrompt(); return true;
    case 'registrationNeedsClient': schermen.showRegistrationNeedsClient(); return true;
    case 'registrationDurationAsk': schermen.showRegistrationDurationAsk(a.choice); return true;
    case 'registrationPortionQuestion': schermen.showRegistrationPortionQuestion(a.choice); return true;
    case 'registrationPortionDuration': schermen.showRegistrationPortionDuration(a.choice); return true;
    case 'registrationTravelSelection': schermen.showRegistrationTravelSelection(a.choice); return true;
    case 'registrationHourTypeSelection': schermen.showRegistrationHourTypeSelection(a.index != null ? a.index : (registrationFlow.activeRegistrationHourTypeIndex || 0)); return true;
    case 'registrationReportPrompt': schermen.showRegistrationReportPrompt(a.choice); return true;
    case 'registrationChoices': schermen.showRegistrationChoices(); return true;
    case 'nonClientFreeTitlePrompt': schermen.showNonClientFreeTitlePrompt(a.opt); return true;
    case 'nonClientDurationSelection': schermen.showNonClientDurationSelection(a.opt); return true;
    case 'appointmentNeedsPrereqs': schermen.showAppointmentNeedsPrereqs(); return true;
    case 'appointmentReadyToSave': schermen.showAppointmentReadyToSave(); return true;
    case 'appointmentDurationSelection': schermen.showAppointmentDurationSelection(a.choice); return true;
    case 'appointmentTravelSelection': schermen.showAppointmentTravelSelection(a.choice); return true;
    case 'manualUursoortInstruction': schermen.showManualUursoortInstruction(); return true;
    case 'choices': schermen.showChoices(); return true;
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
      if (registrationScreen.noShowPrompt) { schermen.showRegistrationNoShowPrompt(); return; }
      if (registrationScreen.needsClient) { schermen.showRegistrationNeedsClient(); return; }
      if (registrationScreen.duration && registrationChoice) { schermen.showRegistrationDurationAsk(registrationChoice); return; }
      if (registrationScreen.portionQuestion && registrationChoice) { schermen.showRegistrationPortionQuestion(registrationChoice); return; }
      if (registrationScreen.portionDuration && registrationChoice) { schermen.showRegistrationPortionDuration(registrationChoice); return; }
      if (registrationScreen.travel && registrationChoice) { schermen.showRegistrationTravelSelection(registrationChoice); return; }
      if (registrationScreen.hourType) { schermen.showRegistrationHourTypeSelection(registrationFlow.activeRegistrationHourTypeIndex || 0); return; }
      if (registrationScreen.submit && registrationChoice) { schermen.showRegistrationReportPrompt(registrationChoice); return; }
      schermen.showRegistrationChoices();
      return;
    }
    if (appointmentScreen.nonClientFreeTitle && nonClientOpt) { schermen.showNonClientFreeTitlePrompt(nonClientOpt); return; }
    if (appointmentScreen.nonClientDuration && nonClientOpt) { schermen.showNonClientDurationSelection(nonClientOpt); return; }
    if (appointmentScreen.nonClientMenu) { schermen.showAppointmentNeedsPrereqs(); return; }
    if (appointmentScreen.readyToSave && nonClientOpt) { schermen.showAppointmentReadyToSave(); return; }
    if (appointmentScreen.needsPrereqs) { schermen.showAppointmentNeedsPrereqs(); return; }
    // (verwijderd) beschikbaarheidsmelding "heeft al een afspraak" -> geen routing meer
    if (appointmentScreen.duration && appointmentChoice) { schermen.showAppointmentDurationSelection(appointmentChoice); return; }
    if (appointmentScreen.travel && appointmentChoice) { schermen.showAppointmentTravelSelection(appointmentChoice); return; }
    if (appointmentScreen.manualUursoort) { schermen.showManualUursoortInstruction(); return; }
    if (appointmentScreen.readyToSave) { schermen.showAppointmentReadyToSave(); return; }
    schermen.showChoices();
  };
}
