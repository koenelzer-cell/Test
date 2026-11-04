// Schermen rond de uursoortkeuze.

import { mkText } from '../../ui/managed-text.js';
import { entryUursoortIsSet, findClientEntries, findClientUursoortTrigger, findNonClientUursoortTrigger, firstNameFromName, getUursoortTrigger, invalidateClientEntries } from '../../ons/appointment-form.js';
import { opNieuwFormulierHost } from '../../ons/nieuwe-formulieren.js';
import { chooseUursoort, hasUursoortSelected } from './uursoort-field.js';
import { scheduleAppointmentEndTime } from './end-time.js';
import { freshUursoortTriggerForContext } from './uursoort-queue.js';
import { appointmentFlow, helperPanel, registratieModus } from '../../state.js';
import { $body, safe, setStatus } from '../../screen/status.js';
import { ONSAH_TOKENS } from '../../ui/theme.js';
import { clearScreenMark, markScreen } from '../../screen/screen-state.js';
import { renderScreen } from '../../ui/react-bridge.js';
import { schermen } from '../../screen/schermen.js';
import { highlightField } from '../../ui/highlight.js';

function clientsMissingUursoort() {
  // Backup staging: één uursoortveld voor alle cliënten.
  const nieuw = opNieuwFormulierHost();
  if (nieuw && hasUursoortSelected()) return [];
  return findClientEntries()
    .filter((entry) => nieuw || !entryUursoortIsSet(entry))
    .map((entry) => entry.firstName || firstNameFromName(entry.name))
    .filter(Boolean);
}
function missingUursoortText(names) {
  if (!names.length) return 'Alle uursoorten zijn ingevuld.';
  if (names.length === 1) return `Voeg de uursoort toe voor ${names[0]}.`;
  const last = names[names.length - 1];
  return `Voeg de uursoort toe voor ${names.slice(0, -1).join(', ')} en ${last}.`;
}
export function showManualUursoortInstruction() {
  const body = $body(); if (!body) return;
  markScreen('manualUursoortInstruction');
  appointmentFlow.appointmentFlowBusy = false;
  appointmentFlow.appointmentAwaitingManualUursoort = true;
  scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
  // Beheerbare teksten blijven mkText-knopen; ze worden één keer gebouwd en
  // bij elke hertekening hergebruikt.
  const _subNode = mkText('afspraak_uursoort_sub', 'Daarna gaat de afspraak vanzelf verder.', { fontSize: '12px', color: '#666', lineHeight: '1.35', padding: '0 0 8px' });
  // Vriendelijke, instelbare instructie + markeer het uursoortveld.
  const _instrNode = mkText('probleem_uursoort_zelf', 'Kies zelf de uursoort in het gemarkeerde veld hieronder.', { fontSize: '12px', color: '#704b00', lineHeight: '1.35', padding: '0 0 8px' });
  try { highlightField(getUursoortTrigger() || (typeof findClientUursoortTrigger === 'function' ? findClientUursoortTrigger() : null)); } catch (e) {}
  // De lijst ontbrekende cliënten ververst elke 600ms: elke tik opnieuw kijken
  // wie nog een uursoort mist en het scherm daarmee hertekenen (als prop). De
  // lus draait in het React-scherm (useInterval) en stopt vanzelf zodra we hier
  // weg navigeren.
  const onWatchTick = () => safe(() => {
    if (!helperPanel.helperEnabled || registratieModus() || helperPanel._infoPanelRestore) return;
    checkNow();
  });
  const renderMissing = () => {
    const names = clientsMissingUursoort();
    renderScreen(body, 'manualUursoort', {
      missingText: missingUursoortText(names),
      subNode: _subNode,
      instructionNode: _instrNode,
      tokens: ONSAH_TOKENS,
      onBack: function () {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(() => { appointmentFlow.appointmentAwaitingManualUursoort = false; appointmentFlow.appointmentForceChoiceOnce = true; schermen.showChoices(); });
      },
      onWatchTick: onWatchTick,
      watchIntervalMs: 600,
    });
    return names;
  };
  const checkNow = () => {
    invalidateClientEntries();
    const names = renderMissing();
    if (!names.length && hasUursoortSelected()) { schermen.showAppointmentReadyToSave(); return true; }
    setStatus(names.length ? `Wacht op uursoort: ${names.join(', ')}` : 'Uursoort gevonden', !names.length);
    return false;
  };
  checkNow();
}
// Backup staging: 'Kies uursoort' voor de hele afspraak (één uursoortveld,
// HourTypeSelect, met alle cliënten). opties: [{ id, naam, groep }] uit de lijst
// van dat veld zelf; kiezen zet hem via de koppeling van het veld
// (onUpdate:modelValue(id, naam)), met de keuzelijst als terugval.
// afterPick(ok) na het kiezen.
export function showAfspraakUursoort(opties, afterPick, onBack) {
  const body = $body(); if (!body) return;
  markScreen('afspraakUursoort');
  renderScreen(body, 'pickList', {
    title: 'Kies uursoort',
    titleWeight: 600,
    loading: false,
    options: opties.map((o) => o.naam),
    emptyMessage: 'Geen uursoorten gevonden, kies hem in het veld Uursoort.',
    emptyColor: '#b3261e',
    tokens: ONSAH_TOKENS,
    onBack: function () { helperPanel.suppressAutoUntil = Date.now() + 1200; if (onBack) onBack(); schermen.showChoices(); },
    onPick: function (naam) {
      safe(function () {
        const o = opties.filter((x) => x.naam === naam)[0];
        if (!o) return;
        setStatus('Bezig...');
        chooseUursoort(o.naam, (ok) => {
          setStatus(ok ? `uursoort "${o.naam}" gezet` : `uursoort "${o.naam}" niet gezet, kies hem in het veld Uursoort`, ok);
          afterPick(ok);
        }, findNonClientUursoortTrigger() || getUursoortTrigger(), { hourTypeId: o.id });
      }, 'afspraak uursoort kiezen');
    },
  });
  setStatus('Kies de uursoort');
}
export function showUursoort(options, afterPick, clientContext = null) {
  const body = $body(); if (!body) return;
  clearScreenMark();
  renderScreen(body, 'pickList', {
    title: clientContext ? `Uursoort ${clientContext.firstName}` : 'Kies uursoort',
    titleWeight: 600,
    loading: false,
    options: options,
    emptyMessage: 'Geen uursoorten gevonden - open het veld handmatig.',
    emptyColor: '#b3261e',
    tokens: ONSAH_TOKENS,
    onBack: function () { helperPanel.suppressAutoUntil = Date.now() + 1200; appointmentFlow.autoSelectingNewClient = false; schermen.showChoices(); },
    onPick: function (o) {
      safe(function () {
        setStatus('Bezig...');
        const freshTrigger = clientContext ? freshUursoortTriggerForContext(clientContext) : null;
        if (clientContext && !freshTrigger) {
          setStatus(`uursoort-veld voor ${clientContext.firstName} niet gevonden`, false);
          return;
        }
        chooseUursoort(o, (ok) => {
          const done = () => {
            schermen.showAppointmentReadyToSave();
            setStatus(ok ? `uursoort "${o}" gezet` : `uursoort "${o}" niet gezet`, ok);
          };
          // Altijd via de wachtrij verder (ook als de verificatie ok=false gaf):
          // anders springt de hulp naar de opslaanpagina en slaat cliënt 2+
          // over. De wachtrij herbekijkt zelf wie nog een uursoort mist.
          if (afterPick) afterPick(done);
          else done();
        }, freshTrigger || null, clientContext || null);
      });
    },
  });
}
