// Het aantal open registraties volgens ONS zelf (het teller-endpoint dat ONS
// ook voor de eigen melding gebruikt). Hooguit eens per vijf minuten
// opgehaald; het randlipje en het zijpaneel tonen het getal.

import { agendaPage } from './state.js';
import { pushPanelState } from './side-panel-bridge.js';
import { fetchOpenRegistrationsCount } from '../../services/ons-api/open-registrations.js';
import { OPEN_COUNT_EVENT } from '../../../shared/messages.js';

const INTERVAL_MS = 5 * 60 * 1000;
let _busy = false;

function announce(count) {
  try { document.dispatchEvent(new CustomEvent(OPEN_COUNT_EVENT, { detail: { count: count } })); } catch (e) {}
}

// Aanroepen vanuit de tik van de agendapagina; doet alleen iets als het tijd is.
// force: meteen ophalen (na een eigen actie, of bij het openen van de agenda).
export function refreshOnsOpenCount(force) {
  if (_busy) return;
  if (!force && (Date.now() - agendaPage._onsOpenCountTs) < INTERVAL_MS) return;
  _busy = true;
  agendaPage._onsOpenCountTs = Date.now();
  fetchOpenRegistrationsCount().then(function (n) {
    _busy = false;
    // Een mislukte of onherkenbare telling laat het vorige getal niet staan:
    // liever geen getal dan een verouderd getal.
    agendaPage.onsOpenCount = (n == null) ? null : n;
    announce(agendaPage.onsOpenCount);
    pushPanelState();
  });
}

// Agenda verlaten: het lipje toont dan geen getal meer.
export function clearOnsOpenCount() {
  agendaPage.onsOpenCount = null;
  agendaPage._onsOpenCountTs = 0;
  announce(null);
}
