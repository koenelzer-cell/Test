// Ongedaan maken: momentopname van het formulier en alle hulp-instellingen
// wissen.

import { inputTextValue, setInputTextOns } from '../../ons/form-controls.js';
import { findClientEntries, invalidateClientEntries } from '../../ons/appointment-form.js';
import { clearTitle } from './fields.js';
import { anyUursoortPresent } from './uursoort-field.js';
import { clearKnownLabels } from './labels.js';
import { clearEndTime } from './end-time.js';
import { clearAppointmentTravelTimes } from './travel.js';
import { ensureClientExpanded, hasClientInAppointment } from './clients.js';
import { clearAllUursoorten, uursoortContexts } from './uursoort-queue.js';
import { appointmentFlow } from '../../state.js';
import { safe, setStatus, showLoadingState } from '../../screen/status.js';
import { mkButton } from '../../ui/controls.js';
import { OnsAdapter } from './ons-adapter.js';
import { showChoices } from './choices.js';
import { maybePrefetchUursoorten, resetPrefetchedUursoorten } from './uursoort-source.js';

// ===== Ongedaan maken =====
// Vóór de hulp velden gaat invullen, leggen we vast wat er stond. "Verwijder
// instellingen" maakt alles leeg; dit zet terug wat de medewerker zelf al had
// ingevuld — een titel die je zelf typte hoort niet te verdwijnen omdat je het
// verkeerde afspraaktype aanklikte.
let _appointmentSnapshot = null;
export function takeAppointmentSnapshot() {
  try {
    const lees = (el) => (el ? String(inputTextValue(el) || '') : null);
    _appointmentSnapshot = {
      titel: lees(OnsAdapter.afspraak.titelVeld()),
      eind: lees(OnsAdapter.afspraak.eindtijdVeld()),
      heen: lees(OnsAdapter.afspraak.reistijdVeld('heen')),
      terug: lees(OnsAdapter.afspraak.reistijdVeld('terug')),
      labels: OnsAdapter.afspraak.labels(),
    };
  } catch (e) { _appointmentSnapshot = null; }
  return _appointmentSnapshot;
}
export function hasAppointmentSnapshot() { return !!_appointmentSnapshot; }
export function clearAppointmentSnapshot() { _appointmentSnapshot = null; }
// Zet de vastgelegde waarden terug. De uursoorten worden geleegd en niet
// opnieuw gezet: die kiezen verloopt via de combobox van ONS en is precies de
// route die onbetrouwbaar is — liever leeg laten dan een verkeerde waarde
// terugzetten.
export function restoreAppointmentSnapshot(onDone) {
  const snap = _appointmentSnapshot;
  if (!snap) { if (onDone) onDone(false); return; }
  const zet = (el, waarde) => { if (el && waarde != null) setInputTextOns(el, waarde); };
  try {
    zet(OnsAdapter.afspraak.titelVeld(), snap.titel);
    zet(OnsAdapter.afspraak.eindtijdVeld(), snap.eind);
    zet(OnsAdapter.afspraak.reistijdVeld('heen'), snap.heen);
    zet(OnsAdapter.afspraak.reistijdVeld('terug'), snap.terug);
  } catch (e) {}
  // Labels: eerst de door de hulp gezette labels eraf, dan terug wat er stond.
  OnsAdapter.afspraak.wisLabels(function () {
    const terug = (snap.labels || []).slice();
    const volgende = function () {
      if (!terug.length) {
        OnsAdapter.clienten.wisUursoorten(function () {
          clearAppointmentSnapshot();
          if (onDone) onDone(true);
        });
        return;
      }
      OnsAdapter.afspraak.zetLabel(terug.shift(), volgende);
    };
    volgende();
  });
}
export function clearSettings() {
  appointmentFlow.appointmentClearingSettings = true;
  appointmentFlow.planhulpVerder = null; // na wissen kies je zelf weer een type
  appointmentFlow.appointmentAwaitingManualUursoort = false;
  // Breek een eventueel lopende uursoort-wachtrij af en geef de guard-flags vrij.
  // Anders blijft 'uursoortQueueActive' op true hangen en loopt de vólgende
  // afspraak vast op "Uursoorten uit cliëntkaart laden..." (pagina-refresh nodig).
  appointmentFlow.uursoortQueueGen++; appointmentFlow.uursoortQueueActive = false; appointmentFlow.appointmentFlowBusy = false;
  // Prefetch-dedup vrijgeven: na 'Verwijder instellingen' mogen de uursoorten opnieuw op
  // de achtergrond worden opgewarmd, zodat het opnieuw kiezen van een afspraaktype geen
  // zichtbaar "Uursoort laden" meer geeft (de product_list-cache zelf blijft geldig).
  resetPrefetchedUursoorten();
  // Keuze vergeten: anders vult handleClientListChanges bij een later
  // toegevoegde cliënt automatisch weer titel/label van de vorige keuze in.
  appointmentFlow.pendingChoice = null;
  appointmentFlow.appointmentTypeApplied = false;
  appointmentFlow.helperEndText = ''; appointmentFlow.appointmentEndTimeUserOwned = false; // eindtijd-guard opnieuw scherpstellen
  appointmentFlow.activeNonClientOption = null;
  showLoadingState('Instellingen verwijderen...');
  setStatus('Instellingen verwijderen...');
  appointmentFlow.activeAppointmentDurationMinutes = null;
  appointmentFlow.activeAppointmentStartTimeText = '';
  appointmentFlow.appointmentTimeGuardTimers.forEach((timer) => clearTimeout(timer));
  appointmentFlow.appointmentTimeGuardTimers = [];
  const afterOpen = () => {
    const titleOk = clearTitle();
    const endTimeOk = clearEndTime();
    const travelOk = clearAppointmentTravelTimes();
    clearKnownLabels((labelOk) => clearAllUursoorten(() => {
      appointmentFlow.appointmentClearingSettings = false;
      showChoices();
      const msg = ['Instellingen verwijderd'];
      if (!titleOk) msg.push('titel niet gevonden');
      if (!endTimeOk) msg.push('eindtijd niet gevonden');
      if (!travelOk) msg.push('reistijd niet gevonden');
      if (!labelOk) msg.push('label niet verwijderd');
      invalidateClientEntries();
      // Warm de uursoort-cache meteen weer op voor de huidige cliënten, zodat de picker
      // na het opnieuw kiezen direct gevuld is (achtergrond-call tijdens showChoices).
      try { maybePrefetchUursoorten(); } catch (e) {}
      if (anyUursoortPresent()) msg.push('verwijder zelf nog eventueel de uursoorten');
      setStatus(msg.join(' | '), titleOk && endTimeOk && travelOk && labelOk);
    }));
  };
  if (hasClientInAppointment() && uursoortContexts().length < findClientEntries().length) ensureClientExpanded(() => afterOpen());
  else afterOpen();
}
export function addResetButton(body) {
  const reset = mkButton('Verwijder instellingen', () => safe(clearSettings), { tick: false, chevron: false, accent: '#a3241f', accentWash: '#fbeceb' });
  body.appendChild(reset);
}
