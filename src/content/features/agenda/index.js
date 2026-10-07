// Agendahulp op de agendapagina (/invitees): start de onderdelen hieronder.
// Aangeroepen vanuit content/index.js.

import { deactivateAgendaPage, syncAgendaPage } from './lifecycle.js';
import { schedulePaint } from './painting.js';
import {
  askSidePanelState,
  listenForSidePanelMessages,
  pushPanelState,
} from './side-panel-bridge.js';
import { configProfileLegend, configProfileZones } from './zones.js';
import { agendaPage } from './state.js';
import { watchProfileChanges } from './profile.js';
import {
  classifyOccurrence,
  isDeclared,
  occurrenceIsPast,
  occurrenceOverdue24h,
} from './occurrences.js';
import { computeTotals, listUnfinished } from './unregistered-time.js';
import { editableWindowStart, windowStatusForDate } from './edit-window.js';
import { __exposeForTest } from '../../core/test-api.js';
import { setOnHelperConfigChanged } from '../../config/app-config.js';
import { safe } from '../../screen/status.js';
import { setAgendaHelperDeactivate } from '../../state.js';

// Testhaak: agenda-logica blootstellen (alleen onder testvlag).
function exposeAgendaTestApi() {
  __exposeForTest({
    computeTotals: computeTotals,
    isDeclared: isDeclared,
    classifyOccurrence: classifyOccurrence,
    occurrenceIsPast: occurrenceIsPast,
    occurrenceOverdue24h: occurrenceOverdue24h,
    editableWindowStart: editableWindowStart,
    windowStatusForDate: windowStatusForDate,
    listUnfinished: listUnfinished,
    configProfileZones: configProfileZones,
    configProfileLegend: configProfileLegend,
  });
}
// Opstarten: listeners, zijpaneel-koppeling en de eerste synchronisatie met
// de URL. Wordt één keer aangeroepen vanuit content/index.js.
export function startDayColoring() {
  watchProfileChanges();
  // Ververs de inkleuring wanneer de config verandert (config.json/beleid).
  setOnHelperConfigChanged(function () { try { syncAgendaPage(); if (agendaPage.active) schedulePaint(); safe(function () { pushPanelState(true); }); } catch (e) {} });
  listenForSidePanelMessages();
  askSidePanelState();
  // Stel de parent-hook in zodat activate(mode) van de hoofdhelper ons kan sluiten.
  setAgendaHelperDeactivate(deactivateAgendaPage);
  window.addEventListener('locationchange', syncAgendaPage);
  window.addEventListener('popstate', syncAgendaPage);
  // history is hierboven al gepatcht voor locationchange; sync direct
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAgendaPage);
  } else {
    syncAgendaPage();
  }
  // Test-hook: agenda-logica blootstellen (alleen onder testvlag).
  exposeAgendaTestApi();
}
