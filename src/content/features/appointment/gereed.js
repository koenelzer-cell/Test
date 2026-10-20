// Is de afspraak klaar? Voorwaarden (cliënt, datum, begintijd), klaar om op
// te slaan, en of de opslaanfase nog geldt. Leest het formulier via
// fields.js, uursoort-field.js en clients.js.

import { hasClientInAppointment } from './clients.js';
import { appointmentHasKnownLabel, hasAppointmentDate, hasAppointmentEndTime, hasAppointmentStartTime } from './fields.js';
import { hasUursoortSelected } from './uursoort-field.js';
import { appointmentFlow, helperPanel } from '../../state.js';
import { isOwnPopup } from '../../ons/dom.js';
import { schermen } from '../../screen/schermen.js';
import { updateSubmitGuard } from './submit-guard.js';

export function hasAppointmentPrereqs() {
  return hasClientInAppointment() && hasAppointmentDate() && hasAppointmentStartTime();
}
export function appointmentReadyToSave() {
  return hasAppointmentPrereqs() && hasAppointmentEndTime() && hasUursoortSelected() && appointmentHasKnownLabel();
}
// 'Kern' van een toegepaste cliëntafspraak: alles behalve de eindtijd. De eindtijd
// is op de opslaanpagina een normaal bewerkbaar veld; terwijl de medewerker die
// overschrijft is hij even leeg/ongeldig. Zolang de kern staat, mag de refresh de
// opslaanpagina NIET afbreken (anders springt hij terug naar het keuzemenu).
export function appointmentCoreApplied() {
  return hasAppointmentPrereqs() && hasUursoortSelected() && appointmentHasKnownLabel();
}
// Mag de opslaanpagina blijven staan bij een refresh?
//  - Cliëntgebonden: de afspraak is klaar, of de kern (cliënt/tijd + uursoort +
//    label) staat nog (de eindtijd mag de medewerker bewerken).
//  - Niet-cliëntgebonden: er is een actieve niet-cliëntoptie (geen cliënt), en de
//    afspraak heeft nog datum + begintijd. Zulke afspraken hebben géén cliënt en
//    géén label, dus zonder deze tak brak de refresh de opslaanpagina af en sprong
//    hij terug naar het eerste scherm.
export function appointmentSaveStageStillValid() {
  if (appointmentReadyToSave() || appointmentCoreApplied()) return true;
  if (appointmentFlow.activeNonClientOption && !hasClientInAppointment() && hasAppointmentDate() && hasAppointmentStartTime()) return true;
  return false;
}
export function onAppointmentInput(e) {
  if (!helperPanel.helperEnabled) return;
  if (helperPanel.activeMode === 'registrations' || isOwnPopup(e.target)) return;
  schermen.refreshAppointmentPrereqScreen();
  updateSubmitGuard();
}
