// Ingang van het content-script op de ONS-pagina's. Importeert de onderdelen
// en start ze in vaste volgorde. Alles wat bij het laden gebeurt, staat hier.

import { listenForMainWorldDetails } from './services/ons-api/event-details.js';
import { listenForOnsOverlapCalls } from './services/ons-api/event-overlap.js';
import { listenForCreatedEvents } from './features/appointment/duplicate.js';
import { listenForEventMeta } from './features/agenda/event-create.js';
import { startConfigLoading, watchConfigChanges } from './config/loader.js';
import { seedUiOverridesFromConfig, watchLocalUiOverrides } from './ons/selector-overrides.js';
import { installFreeDayTracking, showFreeDayInactive } from './features/appointment/free-day.js';
import { safe } from './screen/status.js';
import { registerQualityModule } from './features/quality.js';
import { installDeclareClickCapture } from './features/registration/pending.js';
import { installPanelDragListeners } from './helper/panel.js';
import { installUrlWatch, syncWithUrl } from './helper/routing.js';
import { installContextMenuTracking, listenForContextMenuChoice, pushRegistrationForms } from './features/registration/context-menu.js';
import { startDayColoring } from './features/agenda/index.js';
import { startUiInspector } from './features/ui-inspector.js';
import { setRollout, startModuleHost } from './platform/module-host.js';
import { connectConfigHooks } from './config/hooks.js';
import { deactivate } from './helper/lifecycle.js';
import { koppelSchermen } from './screen/schermen.js';
import { createCurrentScreenRestore, refreshMainScreen } from './helper/screen-restore.js';
import { handleChoice, showChoices, showNeedsTeamChoice } from './features/appointment/choices.js';
import { refreshAppointmentPrereqScreen, showAppointmentNeedsPrereqs } from './features/appointment/prereqs.js';
import { refreshRegistrationPrereqScreen, showRegistrationNeedsClient } from './features/registration/prereqs.js';
import { showAppointmentDurationSelection, showAppointmentTravelSelection } from './features/appointment/duration.js';
import { showAppointmentReadyToSave } from './features/appointment/save.js';
import { showAvailabilityWarning } from './features/appointment/availability.js';
import { showManualUursoortInstruction, showUursoort } from './features/appointment/uursoort-screens.js';
import { showNonClientCategory, showNonClientDurationSelection, showNonClientFreeTitlePrompt } from './features/appointment/non-client.js';
import { showRegistrationChoices, showRegistrationDurationAsk, showRegistrationPortionDuration, showRegistrationPortionQuestion, showRegistrationReportPrompt, showRegistrationSubmitOnly, showRegistrationTravelSelection } from './features/registration/screens.js';
import { showRegistrationHourTypeSelection } from './features/registration/hour-type.js';
import { showRegistrationNoShowPrompt } from './features/registration/prompts.js';
import { showUursoortQueue } from './features/appointment/uursoort-queue.js';

/* ===== Opstarten =====
   Alles hierboven zijn declaraties. Hier, en alleen hier, start het script:
   listeners, timers, config laden. */
// Eerst vastleggen wie er reageert als de configuratie verandert; die kan al
// tijdens het inlezen (startConfigLoading) wijzigen.
connectConfigHooks({
  formsChanged: pushRegistrationForms,
  selectorsChanged: seedUiOverridesFromConfig,
  rolloutChanged: setRollout,
  configApplied: syncWithUrl,
  teamChanged: deactivate,
});
// De schermen openen elkaar via schermen.showX() (screen/schermen.js).
koppelSchermen({
  createCurrentScreenRestore, handleChoice, refreshAppointmentPrereqScreen,
  refreshMainScreen, refreshRegistrationPrereqScreen, showAppointmentDurationSelection,
  showAppointmentNeedsPrereqs, showAppointmentReadyToSave, showAppointmentTravelSelection,
  showAvailabilityWarning, showChoices, showFreeDayInactive,
  showManualUursoortInstruction, showNeedsTeamChoice, showNonClientCategory,
  showNonClientDurationSelection, showNonClientFreeTitlePrompt, showRegistrationChoices,
  showRegistrationDurationAsk, showRegistrationHourTypeSelection, showRegistrationNeedsClient,
  showRegistrationNoShowPrompt, showRegistrationPortionDuration, showRegistrationPortionQuestion,
  showRegistrationReportPrompt, showRegistrationSubmitOnly, showRegistrationTravelSelection,
  showUursoort, showUursoortQueue,
});
// Het moduleplatform eerst: de modules melden zich daar aan.
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

// De UI-inspector (beheerdershulpmiddel) staat los van de hulp; hij opent
// alleen op verzoek (#ons-ui-inspector of een vlag in chrome.storage.local).
startUiInspector();
