// Ingang van het content-script op de ONS-pagina's. Importeert de onderdelen
// en start ze in vaste volgorde. Alles wat bij het laden gebeurt, staat hier.

import { listenForMainWorldDetails } from './services/ons-api/event-details.js';
import { listenForOnsOverlapCalls } from './services/ons-api/event-overlap.js';
import { listenForCreatedEvents } from './features/appointment/duplicate.js';
import { listenForEventMeta } from './features/agenda/event-create.js';
import { startConfigLoading, watchConfigChanges } from './config/loader.js';
import { seedUiOverridesFromConfig, watchLocalUiOverrides } from './ons/selector-overrides.js';
import { installFreeDayTracking } from './features/appointment/free-day.js';
import { safe } from './screen/status.js';
import { registerQualityModule } from './features/quality.js';
import { installDeclareClickCapture } from './features/registration/pending.js';
import { installPanelDragListeners } from './helper/panel.js';
import { installUrlWatch, syncWithUrl } from './helper/routing.js';
import {
  installContextMenuTracking,
  listenForContextMenuChoice,
  pushRegistrationForms,
} from './features/registration/context-menu.js';
import { startDayColoring } from './features/agenda/index.js';
import { startUiInspector } from './features/ui-inspector.js';
import { exposeTestApi } from './test-hooks.js';
import { setRollout, startModuleHost } from './platform/module-host.js';
import { connectConfigHooks } from './config/hooks.js';
import { deactivate } from './helper/lifecycle.js';

/* ===== Opstarten =====
   Alles hierboven zijn declaraties. Hier, en alleen hier, start het script:
   listeners, timers, config laden. De volgorde is die van vóór de
   herstructurering (toen stonden deze regels verspreid door het bestand). */
// Eerst vastleggen wie er reageert als de configuratie verandert; die kan al
// tijdens het inlezen (startConfigLoading) wijzigen.
connectConfigHooks({
  formsChanged: pushRegistrationForms,
  selectorsChanged: seedUiOverridesFromConfig,
  rolloutChanged: setRollout,
  configApplied: syncWithUrl,
  teamChanged: deactivate,
});
// Het moduleplatform eerst: vóór 1.6.202 was dit een apart content-script
// (modules.js) dat vóór de rest werd geladen.
startModuleHost();
listenForMainWorldDetails();
listenForOnsOverlapCalls();
listenForCreatedEvents();
listenForEventMeta();
watchConfigChanges();
const HELPER_CONFIG_READY = startConfigLoading();
seedUiOverridesFromConfig();
watchLocalUiOverrides();
installFreeDayTracking();
installPanelDragListeners();
installUrlWatch();
HELPER_CONFIG_READY.then(syncWithUrl);
HELPER_CONFIG_READY.then(function () { safe(pushRegistrationForms); });
installContextMenuTracking();
listenForContextMenuChoice();
installDeclareClickCapture();
startDayColoring();
registerQualityModule();
exposeTestApi();

// De UI-inspector (beheerdershulpmiddel) staat los van de hulp; hij opent
// alleen op verzoek (#ons-ui-inspector of een vlag in chrome.storage.local).
startUiInspector();
