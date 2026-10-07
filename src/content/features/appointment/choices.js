// Keuze van het afspraaktype en het toepassen ervan.

import { choiceLabels, CONFIG, helperNeedsTeamChoice } from '../../config/app-config.js';
import { busyWhile, setBusyCursor } from '../../ons/busy-cursor.js';
import { applyClientPresent } from '../../ons/form-controls.js';
import { invalidateClientEntries } from '../../ons/appointment-form.js';
import { appointmentReadyToSave, hasAppointmentPrereqs } from './fields.js';
import { clearUursoort } from './uursoort-field.js';
import { setTitleForChoice } from './client-name.js';
import { setLabelsExclusive } from './labels.js';
import { scheduleAppointmentEndTime } from './end-time.js';
import { clearAppointmentTravelTimes } from './travel.js';
import { addResetButton, clearSettings, takeAppointmentSnapshot } from './undo.js';
import { ensureClientExpanded, hasClientInAppointment } from './clients.js';
import {
  appointmentNeedsAvailabilityConfirmation,
  showAvailabilityWarning,
} from './availability.js';
import { showAppointmentReadyToSave } from './save.js';
import { showUursoortQueue } from './uursoort-queue.js';
import { appointmentFlow } from '../../state.js';
import { $body, safe, setStatus, showLoadingState } from '../../screen/status.js';
import { showAppointmentNeedsPrereqs } from './prereqs.js';
import { ONSAH_TOKENS } from '../../ui/theme.js';
import { mkButton } from '../../ui/controls.js';
import { onsahChoiceDirectIndirectLabel, onsahChoiceDotColor } from '../../ui/choice-style.js';
import { clearScreenMark, markScreen, resetBody } from '../../screen/screen-state.js';
import { renderScreen } from '../../ui/react-bridge.js';
import { appointmentMissingHooks, mkProblemBanner } from '../quality.js';
import { applyAppointmentDuration, showAppointmentDurationSelection } from './duration.js';
import { showManualUursoortInstruction } from './uursoort-screens.js';

// De hulp vereist een gekozen team: toon een duidelijke melding i.p.v. een lege
// keuzelijst. Het team kies je in de extensie-popup (kleurprofiel).
export function showNeedsTeamChoice() {
  const body = $body(); if (!body) return;
  clearScreenMark();
  renderScreen(body, 'infoScreen', {
    title: 'Kies eerst je team om de hulp te gebruiken.',
    titleStyle: { padding: '6px 0' },
    body: 'Open de extensie (het pictogram naast de adresbalk) en kies je team/kleurprofiel. Daarna verschijnen de afspraaktypes en registraties hier.',
  });
  setStatus('Kies eerst je team', false);
}
export function showChoices() {
  const body = $body(); if (!body) return;
  appointmentFlow.appointmentDoorplannen = false; // nieuwe afspraakflow: doorplannen-intentie reset
  if (appointmentFlow.appointmentClearingSettings) { showLoadingState('Instellingen verwijderen...'); return; }
  if (helperNeedsTeamChoice()) { showNeedsTeamChoice(); return; }
  appointmentFlow.nonClientFreeTitleScreenActive = false;
  appointmentFlow.appointmentAwaitingManualUursoort = false;
  appointmentFlow.activeNonClientOption = null; // terug naar clientflow
  // Geen resetBody hier: ook dit scherm wordt door de refresh-lus herhaald
  // getekend, en leegmaken vóór de asynchrone React-render geeft een lege
  // flits. De vanilla-banner-route hieronder maakt de body zelf leeg.
  const forceChoice = appointmentFlow.appointmentForceChoiceOnce;
  appointmentFlow.appointmentForceChoiceOnce = false;
  if (!hasAppointmentPrereqs()) {
    showAppointmentNeedsPrereqs();
    return;
  }
  if (appointmentNeedsAvailabilityConfirmation()) {
    showAvailabilityWarning();
    return;
  }
  if (!forceChoice && appointmentReadyToSave()) {
    showAppointmentReadyToSave();
    return;
  }
  markScreen('choices');
  if (appointmentFlow.clientWaitTimer) { clearTimeout(appointmentFlow.clientWaitTimer); appointmentFlow.clientWaitTimer = null; }
  // Is er al een afspraaktype ECHT toegepast? Dan de andere types BLOKKEREN
  // i.p.v. proberen te overschrijven - dat was onbetrouwbaar. De gebruiker
  // verwijdert eerst de instellingen. De type-labels blijven zichtbaar
  // (uitgeschakeld), zodat de refresh niet terugspringt naar de opslaanpagina.
  if (appointmentFlow.appointmentTypeApplied) {
    renderChoicesBlocked(body);
    return;
  }
  ensureClientExpanded((expanded) => {
    if (!expanded) setStatus('Clientkaart openen...', false);
  });
  // #2 - Zelftest: waarschuw proactief als een kern-hook niet herkend wordt
  // (bv. na een ONS-wijziging), zodat een stille detectiefout meteen opvalt.
  // Deze banner gebruikt beheerbare tekst (mkText); die zeldzame foutsituatie
  // houdt daarom de oude, volledig vanilla opbouw aan.
  const _missingHooks = appointmentMissingHooks();
  if (_missingHooks.length) {
    resetBody(body); // vanilla-route: hier wél eerst leegmaken
    body.appendChild(mkProblemBanner(_missingHooks));
    CONFIG.choices.forEach((choice, i) => body.appendChild(mkButton(choice.label, () => safe(() => {
      appointmentFlow.pendingChoice = choice;
      prepareClientAndHandleChoice(choice);
    }), { tick: onsahChoiceDotColor(choice, i), meta: onsahChoiceDirectIndirectLabel(choice) })));
    addResetButton(body);
    setStatus('');
    return;
  }
  renderChoicesReact(body, false);
  setStatus('');
}
// Gedeelde React-render voor het keuzemenu, in beide standen: gewoon (klikbaar)
// en geblokkeerd (types uitgeschakeld omdat er al instellingen zijn toegepast).
function renderChoicesReact(body, blocked) {
  const choices = CONFIG.choices.map((choice, i) => ({
    label: choice.label,
    tick: onsahChoiceDotColor(choice, i),
    meta: onsahChoiceDirectIndirectLabel(choice),
  }));
  renderScreen(body, 'choices', {
    choices: choices,
    blocked: !!blocked,
    blockedNote: 'Er zijn al instellingen toegepast. Verwijder eerst de instellingen om een ander afspraaktype te kiezen.',
    tokens: ONSAH_TOKENS,
    onPick: function (i) {
      safe(function () {
        const choice = CONFIG.choices[i];
        appointmentFlow.pendingChoice = choice;
        prepareClientAndHandleChoice(choice);
      });
    },
    onReset: function () { safe(clearSettings); },
    showSaveNav: !!blocked && appointmentReadyToSave(),
    onSaveNav: function () {
      safe(function () {
        appointmentFlow.appointmentForceChoiceOnce = false;
        showAppointmentReadyToSave();
      });
    },
  });
}
// "Naar opslaan" verschijnt binnen het component alleen als er ook écht
// opgeslagen kan worden (showSaveNav in renderChoicesReact).
function renderChoicesBlocked(body) {
  renderChoicesReact(body, true);
  setStatus('Verwijder eerst de instellingen', false);
}
function prepareClientAndHandleChoice(choice) {
  setStatus(''); // wis o.a. de 'verwijder zelf nog de uursoorten' melding
  if (!hasAppointmentPrereqs()) { showAppointmentNeedsPrereqs(); return; }
  // Vastleggen wat er stond, vóórdat de hulp velden gaat invullen.
  takeAppointmentSnapshot();
  appointmentFlow.appointmentFlowBusy = true;
  if (!choice.addTravelTime) clearAppointmentTravelTimes();
  busyWhile(6000, (done) => {
    ensureClientExpanded((expanded) => {
      done();
      if (!expanded) setStatus('Clientkaart openen...', false);
      // Standaardduur uit de beheerlijst: duurvraag overslaan (net als bij de
      // niet-cliëntcategorieën). Bij addTravelTime volgt nog wél de reistijdvraag.
      if (choice.defaultDuration > 0) applyAppointmentDuration(choice, choice.defaultDuration);
      else showAppointmentDurationSelection(choice);
    });
  });
}
export function handleChoice(choice) {
  appointmentFlow.appointmentTypeApplied = true; // vanaf hier worden titel/label/uursoort gezet
  setBusyCursor(true);
  let _choiceDone = false;
  const _finishBusy = () => { if (!_choiceDone) { _choiceDone = true; setBusyCursor(false); } };
  const _busyGuard = setTimeout(_finishBusy, 8000);
  const _endBusy = () => { clearTimeout(_busyGuard); _finishBusy(); };
  scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
  if (!choice.addTravelTime) clearAppointmentTravelTimes();
  setStatus('Bezig...');
  const desiredClientPresent = choice.clientPresent;
  setTitleForChoice(choice, (titleOk) => {
    scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
    // BELANGRIJK: het label wordt NIET meer vooraf gezet. ONS koppelt tijdens het
    // kiezen van de uursoort zelf een (soms verkeerd) label; vooraf zetten leidde
    // tot de zichtbare label-dans (twee labels erin, eruit, opnieuw erin). We
    // zetten het gekozen label pas ÉÉN keer aan het eind via setLabelExclusive.
    applyClientPresent(desiredClientPresent, (clOk) => {
      scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
      const msg = [];
      msg.push(titleOk ? 'titel gezet' : 'titel niet gevonden');
      msg.push(clOk ? `aanwezig ${desiredClientPresent ? 'aan' : 'uit'}` : 'aanwezig niet gevonden');
      const base = msg.join(' | ');
      setStatus(base, titleOk && clOk);
      if (choice.pickUursoort) {
        invalidateClientEntries();
        if (!hasClientInAppointment()) {
          // Geen cliënt (meer): eerst het label zetten (geen uursoort-coupling te
          // verwachten), daarna de handmatige instructie tonen.
          scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
          const afterLabel = () => ensureClientExpanded(() => { showManualUursoortInstruction(); _endBusy(); });
          setLabelsExclusive(choiceLabels(choice), afterLabel);
          setStatus(base + ' | voeg uursoort handmatig toe', titleOk && clOk);
        } else {
          // Direct de zelf-sturende wachtrij starten. Die klapt elke cliëntkaart
          // zélf uit en handelt 2, 3, 4 of meer cliënten af - dus NIET meer
          // vooraf ensureClientExpanded afwachten (dat verliep bij 4+ cliënten
          // in een time-out en viel dan onterecht terug op "handmatig").
          setStatus('Uursoorten uit cliëntkaart laden...');
          showUursoortQueue([], 0, () => {
            scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
            const finishSave = () => { _endBusy(); showAppointmentReadyToSave(); };
            // Pas NU, nadat ONS al zijn eigen labels heeft gekoppeld, in één
            // gerichte pas: verwijder elk niet-gekozen label (via zijn eigen ×) en
            // zet het gekozen afspraaktype-label. Geen dubbel-zetten meer.
            setLabelsExclusive(choiceLabels(choice), finishSave);
          });
        }
      } else {
        const afterLabel = () => clearUursoort(() => { setStatus(base + ' | uursoort leeg', titleOk && clOk); _endBusy(); });
        setLabelsExclusive(choiceLabels(choice), afterLabel);
      }
    });
  });
}
