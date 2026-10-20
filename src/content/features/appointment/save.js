// Opslaanscherm van de afspraakhulp.

import { APP_CONFIG } from '../../config/app-config.js';
import { fetchWeekTijdvakken, geladenTijdvakken, huidigAfspraakTijdvak, overlapMelding, overlappendTijdvak } from '../overlap.js';
import { mkText } from '../../ui/managed-text.js';
import { clickOption } from '../../ons/form-controls.js';
import { findRecurrenceField, findRecurrenceHeader, getTitleInputSafe } from '../../ons/appointment-form.js';
import { nonClientFreeTitleComplete } from './fields.js';
import { hasUursoortSelected, nonClientUursoortSet, shouldRequireUursoortForSubmit } from './uursoort-field.js';
import { submitButtons, updateSubmitGuard } from './submit-guard.js';
import { scheduleAppointmentEndTime } from './end-time.js';
import { hasAppointmentSnapshot, restoreAppointmentSnapshot } from './undo.js';
import { hasClientInAppointment } from './clients.js';
import { collapseRecurrence, doorplannenBlocksSave, expandRecurrence, recurrenceHeaderExpanded, recurrenceIsSet } from './recurrence.js';
import { appointmentFlow, helperPanel } from '../../state.js';
import { $body, safe, setStatus, showLoadingState } from '../../screen/status.js';
import { ONSAH_TOKENS } from '../../ui/theme.js';
import { mkToggleBox } from '../../ui/controls.js';
import { markScreen } from '../../screen/screen-state.js';
import { renderScreen } from '../../ui/react-bridge.js';
import { schermen } from '../../screen/schermen.js';
import { appointmentReadyToSave } from './gereed.js';
import { highlightField } from '../../ui/highlight.js';

// Is de afspraak in de opslaan-fase? Dan niet meer onderbreken met de
// beschikbaarheidsmelding (die hoort bij het begin, niet bij het opslaan).
export function appointmentInSaveStage() {
  if (appointmentFlow.activeNonClientOption && appointmentFlow.activeNonClientOption.freeTitle) return nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption);
  return appointmentReadyToSave();
}
function submitAppointmentFromHelper() {
  updateSubmitGuard();
  if (appointmentFlow.activeNonClientOption && appointmentFlow.activeNonClientOption.freeTitle) {
    if (!nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption)) {
      setStatus('Vul eerst de titel aan.', false);
      const inp = getTitleInputSafe();
      if (inp && inp.focus) { try { inp.focus(); } catch (e) {} }
      return;
    }
    const btn = submitButtons()[0];
    if (!btn) { setStatus('Opslaan-knop niet gevonden', false); return; }
    const target = btn.shadowRoot ? (btn.shadowRoot.querySelector('button[type="submit"], button') || btn) : btn;
    try { target.click(); } catch (e) { clickOption(btn); }
    return;
  }
  const missing = appointmentFlow.activeNonClientOption ? !nonClientUursoortSet() : !hasUursoortSelected();
  if (shouldRequireUursoortForSubmit() && missing) {
    setStatus(appointmentFlow.activeNonClientOption ? 'Voeg nog een uursoort toe.' : 'Voeg eerst bij elke client een uursoort toe.', false);
    return;
  }
  const btn = submitButtons()[0];
  if (!btn) { setStatus('Opslaan-knop niet gevonden', false); return; }
  const target = btn.shadowRoot ? (btn.shadowRoot.querySelector('button[type="submit"], button') || btn) : btn;
  try { target.click(); } catch (e) { clickOption(btn); }
}
export function showAppointmentReadyToSave() {
  const body = $body(); if (!body) return;
  markScreen('appointmentReadyToSave');
  appointmentFlow.appointmentFlowBusy = false;
  appointmentFlow.appointmentAwaitingManualUursoort = false;
  scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
  const nonClient = !hasClientInAppointment() && !!appointmentFlow.activeNonClientOption;
  // 'Afspraak doorplannen?'-kader boven de opslaanknop. Aan = klik de
  // 'Herhaling'-kop open en markeer het recurrence-type keuzeveld roze. Blijft
  // de herhaling op 'Niet', dan verschijnt een aandachtspunt in het algemene
  // meldingenkanaal én blokkeert opslaan tot je een herhaling kiest of de
  // toggle weer uitzet.
  let _dpBox = null;
  if (!(APP_CONFIG.features && APP_CONFIG.features.doorplannenToggle === false)) {
    _dpBox = mkToggleBox('doorplannen_vraag', 'Afspraak doorplannen?', appointmentFlow.appointmentDoorplannen, (on) => safe(() => {
      appointmentFlow.appointmentDoorplannen = on;
      // Even geen auto-detectie terwijl de programmatische klik (uit/inklappen)
      // nog moet 'settelen', anders slaat de spiegel meteen weer om.
      appointmentFlow.doorplannenSuppressAutoUntil = Date.now() + (on ? 1500 : 2000);
      if (on) expandRecurrence(); else collapseRecurrence();
      showAppointmentReadyToSave(); // herteken: opslaanknop/status volgen de nieuwe stand
    }));
  }
  const freeTitle = nonClient && !!appointmentFlow.activeNonClientOption.freeTitle;
  // Overlap met een bestaande afspraak. ONS controleert dit bij afspraken
  // helemaal niet, dus dit is hier de enige waarschuwing die je krijgt.
  const _tv = huidigAfspraakTijdvak();
  let _overlapTekst = '';
  if (_tv.ymd && _tv.startMin != null && _tv.eindMin != null) {
    const _al = geladenTijdvakken('afspraken', _tv.ymd);
    if (_al === null) {
      // Nog niet geladen: ophalen en dit scherm daarna opnieuw tekenen.
      fetchWeekTijdvakken('afspraken', _tv.ymd).then(function (rijen) {
        if (rijen && rijen.length && appointmentFlow.appointmentSaveScreenActive) safe(showAppointmentReadyToSave);
      });
    } else {
      _overlapTekst = overlapMelding(
        overlappendTijdvak('afspraken', _tv.ymd, _tv.startMin, _tv.eindMin, null),
        'een afspraak'
      );
    }
  }
  // Lichte bewaking op de opslaanpagina (snel, 250ms):
  //  1) zet de toggle AAN zodra de medewerker de herhaling-kaart zelf opent of
  //     een herhaling kiest;
  //  2) herteken zodra de doorplannen-blokkade omslaat, zodat knop/status/ONS-
  //     knop live meelopen.
  // De lus draait in het React-scherm en stopt vanzelf bij weg navigeren.
  const _doorplannenActief = !(APP_CONFIG.features && APP_CONFIG.features.doorplannenToggle === false);
  if (_doorplannenActief) {
    appointmentFlow.doorplannenLastBlocked = doorplannenBlocksSave();
    appointmentFlow.doorplannenLastRecurrenceSet = recurrenceIsSet();
    appointmentFlow.doorplannenLastExpanded = recurrenceHeaderExpanded();
  }
  const onWatchTick = () => safe(() => {
    if (!helperPanel.helperEnabled || !appointmentFlow.appointmentSaveScreenActive) return;
    const suppressed = Date.now() < appointmentFlow.doorplannenSuppressAutoUntil;
    const nowSet = recurrenceIsSet();
    const expanded = recurrenceHeaderExpanded();
    // Flankdetectie: reageer op de OMSLAG, niet op het niveau. Zo blijft
    // 'medewerker zet op Niet' (dalende flank) uit staan, ook als de kaart
    // open blijft (dat is geen nieuwe stijgende flank).
    const roseSet = nowSet && !appointmentFlow.doorplannenLastRecurrenceSet;
    const roseExpanded = expanded && !appointmentFlow.doorplannenLastExpanded;
    const fellSet = !nowSet && appointmentFlow.doorplannenLastRecurrenceSet;
    const fellExpanded = !expanded && appointmentFlow.doorplannenLastExpanded;
    if (!suppressed) {
      // Auto-AAN: medewerker opent de herhaling-kaart zelf of kiest een herhaling.
      if (!appointmentFlow.appointmentDoorplannen && (roseSet || roseExpanded)) {
        appointmentFlow.appointmentDoorplannen = true;
        appointmentFlow.doorplannenLastRecurrenceSet = nowSet; appointmentFlow.doorplannenLastExpanded = expanded;
        showAppointmentReadyToSave(); return;
      }
      // Auto-UIT: medewerker zet de herhaling zelf terug op 'Niet' of klapt de kaart in.
      if (appointmentFlow.appointmentDoorplannen && (fellSet || fellExpanded)) {
        appointmentFlow.appointmentDoorplannen = false; appointmentFlow.doorplannenSuppressAutoUntil = Date.now() + 800;
        appointmentFlow.doorplannenLastRecurrenceSet = nowSet; appointmentFlow.doorplannenLastExpanded = expanded;
        showAppointmentReadyToSave(); return;
      }
    }
    appointmentFlow.doorplannenLastRecurrenceSet = nowSet;
    appointmentFlow.doorplannenLastExpanded = expanded;
    // Herteken zodra de blokkade omslaat, zodat knop/status/ONS-knop meelopen.
    if (appointmentFlow.appointmentDoorplannen && doorplannenBlocksSave() !== appointmentFlow.doorplannenLastBlocked) {
      showAppointmentReadyToSave();
    }
  });
  renderScreen(body, 'readyToSave', {
    // Alleen aanbieden als er iets is om naar terug te keren.
    onUndo: hasAppointmentSnapshot() ? function () {
      helperPanel.suppressAutoUntil = Date.now() + 1200;
      safe(function () {
        appointmentFlow.appointmentSaveScreenActive = false;
        showLoadingState('Terugdraaien...');
        restoreAppointmentSnapshot(function (ok) {
          setStatus(ok ? 'Instellingen teruggedraaid' : 'Terugdraaien niet gelukt', ok);
          appointmentFlow.appointmentForceChoiceOnce = true;
          appointmentFlow.pendingChoice = null;
          appointmentFlow.appointmentTypeApplied = false;
          appointmentFlow.activeAppointmentDurationMinutes = null;
          schermen.showChoices();
        });
      });
    } : null,
    onWatchTick: onWatchTick,
    watchIntervalMs: _doorplannenActief ? 250 : 0,
    textNodes: [
      mkText('afspraak_klaar_regel1', 'Voeg eventueel nog een locatie en notitie toe.', { fontSize: '13px', color: '#333', lineHeight: '1.35', padding: '4px 0 2px' }),
      mkText('afspraak_klaar_regel2', 'Als de instellingen kloppen, kun je de afspraak opslaan', { fontSize: '13px', color: '#333', lineHeight: '1.35', padding: '0 0 8px' }),
    ],
    toggleNode: _dpBox,
    tokens: ONSAH_TOKENS,
    onBack: function () {
      helperPanel.suppressAutoUntil = Date.now() + 1200;
      safe(function () {
        appointmentFlow.appointmentSaveScreenActive = false; // bewust weg van de opslaanpagina
        if (nonClient) { schermen.showAppointmentNeedsPrereqs(); return; }
        appointmentFlow.appointmentForceChoiceOnce = true; schermen.showChoices();
      });
    },
    saveDisabled: doorplannenBlocksSave(),
    onSave: () => safe(() => {
      if (doorplannenBlocksSave()) {
        try { highlightField(findRecurrenceField() || findRecurrenceHeader(), 5000); } catch (e) {}
        setStatus('Stel de herhaling in of zet doorplannen uit', false);
        return; // niet opslaan zolang doorplannen aan staat en herhaling op 'Niet'
      }
      submitAppointmentFromHelper();
    }),
    showUursoortNote: nonClient && !freeTitle && !nonClientUursoortSet(),
    overlapNote: _overlapTekst,
  });
  const ready = freeTitle ? nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption) : (nonClient ? nonClientUursoortSet() : hasUursoortSelected());
  if (doorplannenBlocksSave()) setStatus('Stel de herhaling in of zet doorplannen uit', false);
  else setStatus(ready ? 'Klaar om op te slaan' : (freeTitle ? 'Vul de titel aan' : (nonClient ? 'Voeg nog een uursoort toe' : 'Voeg eerst bij elke client een uursoort toe')), ready);
  updateSubmitGuard(); // ONS-eigen opslaanknop mee-blokkeren bij doorplannen+Niet
  appointmentFlow.appointmentSaveScreenActive = true; // opslaanpagina staat; refresh laat 'm met rust
}
