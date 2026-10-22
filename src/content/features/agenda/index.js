// Agendahulp op de agendapagina (/invitees): start de onderdelen hieronder.
// Aangeroepen vanuit content/index.js.

import { deactivateAgendaPage, syncAgendaPage } from './lifecycle.js';
import { schedulePaint } from './painting.js';
import {
  askSidePanelState,
  listenForSidePanelMessages,
  pushPanelState,
} from './side-panel-bridge.js';
import { agendaPage } from './state.js';
import { loadWorkHoursFromStorage, watchProfileChanges } from './profile.js';
import { setOnHelperConfigChanged } from '../../config/app-config.js';
import { safe } from '../../screen/status.js';
import { setAgendaHelperDeactivate } from '../../state.js';

// Opstarten: listeners, zijpaneel-koppeling en de eerste synchronisatie met
// de URL. Wordt één keer aangeroepen vanuit content/index.js.
export function startDayColoring() {
  watchProfileChanges();
  // Ook buiten de agendapagina: de planhulp in het zijpaneel rekent ermee.
  loadWorkHoursFromStorage();
  // Ververs de inkleuring wanneer de config verandert (config.json/beleid).
  setOnHelperConfigChanged(function () { try { syncAgendaPage(); if (agendaPage.active) schedulePaint(); safe(function () { pushPanelState(true); }); } catch (e) {} });
  listenForSidePanelMessages();
  askSidePanelState();
  // Stel de parent-hook in zodat activate(mode) van de hoofdhelper ons kan sluiten.
  setAgendaHelperDeactivate(deactivateAgendaPage);
  window.addEventListener('locationchange', syncAgendaPage);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAgendaPage);
  } else {
    syncAgendaPage();
  }
}
