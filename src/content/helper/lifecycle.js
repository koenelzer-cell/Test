// De hulp aan- en uitzetten op een pagina (activate/deactivate): listeners,
// observers en timers.

import { invalidateClientEntries } from '../ons/appointment-form.js';
import { onAppointmentInput } from '../features/appointment/fields.js';
import {
  blockSubmitIfNoUursoort,
  updateSubmitGuard,
} from '../features/appointment/submit-guard.js';
import { maybeDismissStrayInviteeModal } from '../features/appointment/invitee-guard.js';
import {
  agendaHelperDeactivate,
  appointmentFlow,
  helperPanel,
  registrationFlow,
} from '../state.js';
import { safe } from '../screen/status.js';
import { refreshAppointmentPrereqScreen } from '../features/appointment/prereqs.js';
import { clearScreenMark } from '../screen/screen-state.js';
import {
  blockRegistrationSubmitIfReportEmpty,
  updateRegistrationSubmitGuard,
} from '../features/registration/report.js';
import {
  onRegistrationReportFocus,
  onRegistrationReportInput,
  onRegistrationTimeInteract,
} from '../features/registration/input-handlers.js';
import { loadPendingRegistrationLabel } from '../features/registration/pending.js';
import { ensureMounted, removePopup, reposition, scheduleMount } from './panel.js';

export function activate(mode) {
  if (helperPanel.active && helperPanel.activeMode === mode) return;
  if (helperPanel.active && helperPanel.activeMode !== mode) deactivate();
  // Agendahulp sluiten zodra afspraak-/registratiehulp actief wordt.
  if (typeof agendaHelperDeactivate === 'function') { try { agendaHelperDeactivate(); } catch (e) {} }
  helperPanel.active = true; helperPanel.activeMode = mode; helperPanel.userPos = null;
  registrationFlow.registrationTravelClicked = false; registrationFlow.registrationFlowBusy = false; registrationFlow.registrationHourTypeBusy = false;
  // Afspraaklabel inlezen vóór de eerste render, zodat de registratiehulp de
  // vorm-keuze meteen kan overslaan als de registratie uit een afspraak komt.
  if (mode === 'registrations') safe(loadPendingRegistrationLabel);
  safe(ensureMounted);
  helperPanel.observer = new MutationObserver((muts) => {
    let modalAdded = false;
    const own = muts.every((mm) => {
      if (!modalAdded && mm.addedNodes && mm.addedNodes.length) {
        for (const n of mm.addedNodes) {
          if (n.nodeType !== 1) continue;
          if ((n.matches && n.matches('uc-modal,[role="dialog"],dialog')) ||
              (n.querySelector && n.querySelector('uc-modal,[role="dialog"],dialog'))) { modalAdded = true; break; }
        }
      }
      return helperPanel.popupEl && (helperPanel.popupEl.contains(mm.target) || mm.target === helperPanel.popupEl);
    });
    if (!own) {
      helperPanel.lastDomMutationAt = Date.now(); // pagina muteert nog -> nog niet "rustig/geladen"
      if (modalAdded) safe(maybeDismissStrayInviteeModal);
      scheduleMount();
    }
  });
  helperPanel.observer.observe(document.documentElement, { childList: true, subtree: true });
  if (helperPanel.activeMode !== 'registrations') {
    // De "+ Toevoegen"-guard hangt direct op de knop (guardInviteeAddButton);
    // geen dure document-brede pointer-listeners meer nodig.
    document.addEventListener('click', blockSubmitIfNoUursoort, true);
    document.addEventListener('submit', blockSubmitIfNoUursoort, true);
    document.addEventListener('input', onAppointmentInput, true);
    document.addEventListener('change', onAppointmentInput, true);
  } else {
    document.addEventListener('input', onRegistrationReportInput, true);
    document.addEventListener('change', onRegistrationReportInput, true);
    document.addEventListener('focusout', onRegistrationTimeInteract, true);
    document.addEventListener('focusin', onRegistrationReportFocus, true);
    document.addEventListener('click', blockRegistrationSubmitIfReportEmpty, true);
    document.addEventListener('submit', blockRegistrationSubmitIfReportEmpty, true);
  }
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  helperPanel.repositionTimer = setInterval(() => safe(() => {
    if (!document.hasFocus()) return; // niets doen als het tabblad niet actief is
    if (!helperPanel.helperEnabled) { reposition(); return; }
    // De guard draait al bij elke input/change; in de achtergrond met verse
    // client-cache, zodat het interval niet de hele DOM herbouwt.
    invalidateClientEntries();
    if (helperPanel.activeMode !== 'registrations') {
      // Vangnet: mocht de MutationObserver/input een cliënt- of datum/tijd-
      // wijziging missen, dan herkent dit interval die alsnog snel.
      refreshAppointmentPrereqScreen();
      updateSubmitGuard();
    } else {
      updateRegistrationSubmitGuard();
    }
    reposition();
  }), 250);
}
export function deactivate() {
  if (!helperPanel.active) return;
  helperPanel.active = false;
  if (helperPanel.observer) { helperPanel.observer.disconnect(); helperPanel.observer = null; }
  document.removeEventListener('click', blockSubmitIfNoUursoort, true);
  document.removeEventListener('submit', blockSubmitIfNoUursoort, true);
  document.removeEventListener('input', onAppointmentInput, true);
  document.removeEventListener('change', onAppointmentInput, true);
  document.removeEventListener('input', onRegistrationReportInput, true);
  document.removeEventListener('change', onRegistrationReportInput, true);
  document.removeEventListener('focusout', onRegistrationTimeInteract, true);
  document.removeEventListener('focusin', onRegistrationReportFocus, true);
  document.removeEventListener('click', blockRegistrationSubmitIfReportEmpty, true);
  document.removeEventListener('submit', blockRegistrationSubmitIfReportEmpty, true);
  window.removeEventListener('scroll', reposition, true);
  window.removeEventListener('resize', reposition);
  clearInterval(helperPanel.repositionTimer);
  appointmentFlow.knownClientNames.clear();
  appointmentFlow.autoSelectingNewClient = false;
  appointmentFlow.uursoortQueueGen++; appointmentFlow.uursoortQueueActive = false; appointmentFlow.appointmentFlowBusy = false; // lopende uursoort-wachtrij afbreken
  clearTimeout(registrationFlow.registrationSettleTimer); registrationFlow.registrationSettleTimer = null;
  appointmentFlow.pendingChoice = null;
  appointmentFlow.appointmentTypeApplied = false;
  appointmentFlow.helperEndText = ''; appointmentFlow.appointmentEndTimeUserOwned = false; // eindtijd-guard reset bij (her)mount
  appointmentFlow.appointmentAwaitingManualUursoort = false;
  registrationFlow.registrationTravelClicked = false; registrationFlow.registrationFlowBusy = false; registrationFlow.registrationHourTypeBusy = false;
  registrationFlow.registrationNoShowPromptOpen = false;
  registrationFlow.registrationNoShowPromptSuppressed = false;
  registrationFlow.registrationEpisodesPromptOpen = false;
  registrationFlow.registrationEpisodesPromptSuppressed = false;
  registrationFlow.activeRegistrationChoice = null;
  registrationFlow.activeRegistrationHourTypeIndex = null;
  registrationFlow.registrationAutoChoice = null;
  registrationFlow.registrationFromAppointment = false;
  registrationFlow.registrationAutoApplied = false;
  clearScreenMark();
  helperPanel.activeMode = null;
  removePopup(); // ruimt ook de React-root op, incl. de controle-lussen

}
