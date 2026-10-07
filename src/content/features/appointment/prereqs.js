// Voorwaarden voor de afspraakhulp (cliënt, datum, tijd) en het scherm dat
// erom vraagt.

import { CONFIG, nonClientCategoriesActive } from '../../config/app-config.js';
import { clean } from '../../ons/dom.js';
import {
  appointmentReadyToSave,
  appointmentSaveStageStillValid,
  hasAppointmentDate,
  hasAppointmentPrereqs,
  hasAppointmentStartTime,
} from './fields.js';
import { updateSubmitGuard } from './submit-guard.js';
import { refreshFreeDayFromBackgroundCalendar, showFreeDayInactive } from './free-day.js';
import { ensureClientExpanded, hasClientInAppointment } from './clients.js';
import {
  appointmentNeedsAvailabilityConfirmation,
  showAvailabilityWarning,
} from './availability.js';
import { appointmentInSaveStage, showAppointmentReadyToSave } from './save.js';
import { clickAddClientButton } from './invitee-guard.js';
import { appointmentFlow, helperPanel } from '../../state.js';
import { $body, safe, setStatus, showLoadingState } from '../../screen/status.js';
import { ONSAH_TOKENS } from '../../ui/theme.js';
import { isScreen, markScreen } from '../../screen/screen-state.js';
import { renderScreen } from '../../ui/react-bridge.js';
import { showChoices } from './choices.js';
import {
  clearNonClientSettings,
  handleNonClientOption,
  nonClientFreeTitleComplete,
  nonClientUursoortSet,
  showNonClientCategory,
} from './non-client.js';
import { showManualUursoortInstruction } from './uursoort-screens.js';

export function resumeAppointmentHelperAfterEnable() {
  helperPanel._infoPanelRestore = null;
  helperPanel._disabledRestore = null;
  appointmentFlow.appointmentAwaitingManualUursoort = false;
  updateSubmitGuard();
  if (!hasAppointmentPrereqs()) {
    if (hasClientInAppointment()) ensureClientExpanded(() => {});
    showAppointmentNeedsPrereqs();
    updateSubmitGuard();
    return;
  }
  ensureClientExpanded((expanded) => {
    appointmentFlow.appointmentForceChoiceOnce = true;
    showChoices();
    updateSubmitGuard();
    setStatus(expanded ? 'Clientkaarten open' : 'Clientkaarten openen...', expanded);
  });
}
export function showAppointmentNeedsPrereqs() {
  const body = $body(); if (!body) return;
  appointmentFlow.nonClientFreeTitleScreenActive = false;
  markScreen('appointmentNeedsPrereqs');
  // Bewust GEEN resetBody hier: dit scherm wordt door de wachtlus herhaald
  // getekend. Leegmaken vóór een (asynchrone) React-render geeft elke tik een
  // lege flits; React hertekent dezelfde root gewoon in place.
  const dateTimeReady = hasAppointmentDate() && hasAppointmentStartTime();
  if (!dateTimeReady) {
    renderScreen(body, 'infoScreen', {
      title: 'Vul begintijd en datum in.',
      titleStyle: { lineHeight: 1.35, padding: '4px 0 8px' },
      body: '',
    });
    setStatus('Wacht op begintijd en datum');
    return;
  }
  // Knop om een cliënt toe te voegen (klikt de echte ONS-knop).
  if (hasClientInAppointment()) {
    showChoices();
    return;
  }
  // Beheerde categorieën uit config.nonClientCategories hebben voorrang (incl.
  // informatielabel/duur per type); leeg = ingebouwde lijst.
  const _cats = nonClientCategoriesActive();
  renderScreen(body, 'needsPrereqs', {
    categories: _cats.map(function (cat) { return { label: cat.label }; }),
    tokens: ONSAH_TOKENS,
    onAddClient: function () { safe(clickAddClientButton); },
    onPickCategory: function (i) {
      safe(function () {
        const cat = _cats[i];
        if (cat.directOption) handleNonClientOption(cat.directOption);
        else showNonClientCategory(cat);
      });
    },
    onReset: function () { safe(clearNonClientSettings); },
  });
  setStatus('Kies een categorie of voeg een cliënt toe');
}
export function refreshAppointmentPrereqScreen() {
  const body = $body(); if (!body) return;
  if (Date.now() < helperPanel.suppressAutoUntil) return; // net op Terug geklikt: scherm met rust laten
  refreshFreeDayFromBackgroundCalendar();
  if (appointmentFlow.appointmentFreeDay) { showFreeDayInactive(); return; } // vrije/grijze dag: niet optreden
  if (helperPanel._infoPanelRestore) return; // infopaneel open: niet overschrijven
  if (appointmentFlow.appointmentFlowBusy) return; // clientgebonden duur/reistijd/instellen: niet terugschieten naar keuze
  if (appointmentFlow.uursoortQueueActive) return; // per-cliënt uursoortlijst open: niet terugschieten naar keuze
  if (appointmentFlow.nonClientBusy) return; // bezig met niet-client uursoort zetten: niet ingrijpen
  if (appointmentFlow.appointmentClearingSettings) { showLoadingState('Instellingen verwijderen...'); return; }
  // 'Overig' vrije-titel-flow: bewaar het titelscherm of de opslaanpagina.
  if (appointmentFlow.activeNonClientOption && appointmentFlow.activeNonClientOption.freeTitle) {
    if (hasClientInAppointment() && hasAppointmentPrereqs()) { appointmentFlow.nonClientFreeTitleScreenActive = false; appointmentFlow.activeNonClientOption = null; showChoices(); return; }
    if (nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption)) {
      // Titel is compleet: zorg dat we op de opslaanpagina staan/blijven.
      if (appointmentFlow.nonClientFreeTitleScreenActive || !text.includes('als de instellingen kloppen')) {
        appointmentFlow.nonClientFreeTitleScreenActive = false;
        showAppointmentReadyToSave();
      }
      return;
    }
    // Titel nog niet compleet: titelscherm bewaren.
    if (appointmentFlow.nonClientFreeTitleScreenActive) return;
  }
  // 'Geen uursoorten gevonden'-foutpagina niet overschrijven (tenzij er alsnog
  // handmatig een uursoort is gekozen).
  if (appointmentFlow.nonClientNoUursoortActive && appointmentFlow.activeNonClientOption && !appointmentFlow.activeNonClientOption.freeTitle) {
    if (nonClientUursoortSet()) { appointmentFlow.nonClientNoUursoortActive = false; showAppointmentReadyToSave(); }
    return;
  }
  const text = clean(body.textContent || '');
  if (appointmentNeedsAvailabilityConfirmation() && !text.includes('al een afspraak') && !appointmentInSaveStage()) {
    showAvailabilityWarning();
    return;
  }
  const choiceScreen = CONFIG.choices.every((choice) => text.includes(clean(choice.label)));
  if (appointmentFlow.appointmentAwaitingManualUursoort && hasAppointmentPrereqs()) {
    // Het uursoort-wachtscherm werkt zichzelf bij via zijn eigen poll-lus;
    // hier alleen herstellen als dat scherm (door een refresh) verdwenen is.
    // Dat weten we nu uit de schermtoestand i.p.v. uit het bestaan van een timer.
    if (!isScreen('manualUursoortInstruction')) showManualUursoortInstruction();
    return;
  }
  if (appointmentFlow.appointmentSaveScreenActive) {
    // Opslaanpagina met rust laten zolang de opslaanfase geldig is (cliënt- én
    // niet-cliëntgebonden). De medewerker mag de eindtijd bewerken zonder dat de
    // hulp terugspringt; en een niet-cliëntafspraak wordt niet meer afgebroken.
    if (!choiceScreen && appointmentSaveStageStillValid()) return;
    appointmentFlow.appointmentSaveScreenActive = false; // opslaanfase echt weg (bv. cliënt/label/tijd verwijderd): refresh weer vrijgeven
  }
  if (appointmentReadyToSave() && !choiceScreen) {
    showAppointmentReadyToSave();
    return;
  }
  const prereqScreen = text.includes('vul client, begintijd en datum in') || text.includes('voeg een client toe voor clientgerelateerde afspraken') || text.includes('voeg evt. een client toe aan de afspraak');
  // Niet-clientgerelateerde sub-/duurschermen niet overschrijven bij een refresh.
  const nonClientSubScreen = text.includes('niet clientgerelateerde afspraken') ||
    text.includes(' duur:') ||
    nonClientCategoriesActive().some(function (c) { return text.includes(clean(c.label)) && text.includes('terug'); });
  // Cliëntgebonden duur-/reistijdscherm niet overschrijven bij een refresh
  // (bv. de mutatie van het uitklappen van de clientkaart). Anders wipet de
  // refresh het duurscherm en moet de gebruiker 2x klikken.
  const clientDurationScreen = !!appointmentFlow.pendingChoice && (text.includes(' duur:') || text.includes('totale reistijd'));
  // Zodra er een cliënt is toegevoegd (prereqs compleet), door naar het
  // cliëntgebonden keuzescherm, ook als we nog op het niet-cliëntmenu staan.
  if (hasClientInAppointment() && hasAppointmentPrereqs() && !choiceScreen && !clientDurationScreen) {
    appointmentFlow.activeNonClientOption = null;
    showChoices();
    return;
  }
  if (prereqScreen && hasAppointmentPrereqs()) showChoices();
  else if (!hasAppointmentPrereqs() && nonClientSubScreen) return; // gebruiker bladert door categorieën
  else if (!hasAppointmentPrereqs() && !prereqScreen) showAppointmentNeedsPrereqs();
}
