// Welke interne functies de jsdom-tests kunnen aanroepen (via
// core/test-api.js).

import { DEFAULT_APP_CONFIG } from './config/defaults.js';
import {
  allKnownLabels,
  APP_CONFIG,
  applyHelperConfig,
  choiceLabels,
  effectiveChoices,
  effectiveRegistrationForms,
  helperNeedsTeamChoice,
  nonClientCategoriesActive,
  REGISTRATION_CHOICES,
  setActiveProfileForTest,
} from './config/app-config.js';
import {
  currentAgendaDate,
  isRegistrationEditOrNew,
  isRegistrationOverviewPage,
  parseInviteeIdFromPath,
  resolveInviteeId,
  setInviteeIdOverride,
} from './ons/agenda-location.js';
import { _agFmtMin, agendaWeekNumber, agendaYmd } from './core/datetime.js';
import {
  _tijdvakCache,
  _tijdvakkenOverlappen,
  overlapMelding,
  overlappendTijdvak,
} from './features/overlap.js';
import {
  agendaEntryType,
  computeDirectIndirect,
  entryToVorm,
  labelToAfspraaktype,
  mapAgendaEntry,
  mapAgendaWeekResponse,
  parseStartVerdeling,
  summarizeAgendaWeek,
} from './domain/agenda-entries.js';
import { fetchInviteeWeek } from './services/ons-api/calendar.js';
import {
  clearLaatsteDetails,
  detailsLabelNames,
  laatsteDetailsLabels,
  noteDetailsResponse,
  occurrenceIdFromPopover,
} from './services/ons-api/event-details.js';
import { declarabiliteitBase, declarabiliteitPct } from './domain/declarabiliteit.js';
import {
  normalizeRegistrationLine,
  parseRegistrationDetails,
  parseWeekRegistrationOccurrences,
  summarizeRegistrations,
  summarizeWeekRegistrations,
} from './domain/registrations.js';
import { _isClientUursoortName } from './domain/hour-types.js';
import { _apiUrl } from './services/ons-api/endpoints.js';
import { agendaRegistrationsSectionEl } from './features/agenda-overview/registrations-overview.js';
import { managedRichHtml, mkText, resolveText } from './ui/managed-text.js';
import { __exposeForTest } from './core/test-api.js';
import { firstByDataQa, inputBelongsToTrigger } from './ons/form-controls.js';
import { collectClientUursoortOptionTexts } from './ons/uursoort-options.js';
import {
  entryUursoortIsSet,
  entryUursoortText,
  findClientEntries,
  findRecurrenceField,
  findRecurrenceHeader,
  getEndTimeInput,
  getEtiketTrigger,
  getStartTimeInput,
  invalidateClientEntries,
  labelChips,
} from './ons/appointment-form.js';
import {
  appointmentCoreApplied,
  appointmentReadyToSave,
  appointmentSaveStageStillValid,
  hasAppointmentDate,
  hasAppointmentStartTime,
} from './features/appointment/fields.js';
import {
  removeLabelChipsByText,
  selectedAllLabelChipTexts,
  selectedKnownLabels,
  setLabelsExclusive,
} from './features/appointment/labels.js';
import { enforceAppointmentEndTime } from './features/appointment/end-time.js';
import {
  clearAppointmentSnapshot,
  clearSettings,
  hasAppointmentSnapshot,
  takeAppointmentSnapshot,
} from './features/appointment/undo.js';
import { fetchProductList, parseProductList } from './services/ons-api/products.js';
import {
  clientsMissingUursoortEntries,
  uursoortContexts,
} from './features/appointment/uursoort-queue.js';
import {
  doorplannenBlocksSave,
  doorplannenWarnText,
  recurrenceHeaderExpanded,
  recurrenceIsSet,
  recurrenceValue,
} from './features/appointment/recurrence.js';
import { appointmentFlow, registrationFlow } from './state.js';
import {
  durationChipLabel,
  durationLabelStyle,
  mkDurationPicker,
  PICKER_CHIP_LIMIT,
} from './ui/duration-picker.js';
import { clearScreenMark, currentScreen, markScreen } from './screen/screen-state.js';
import { renderScreen } from './ui/react-bridge.js';
import { closeOnsModal } from './ons/modal.js';
import {
  OnsAdapter,
  onsGemisteVelden,
  onsVergeetGemist,
} from './features/appointment/ons-adapter.js';
import { appointmentMissingHooks, helperQualityIssues } from './features/quality.js';
import { applyAppointmentDuration } from './features/appointment/duration.js';
import {
  _regCareFlags,
  _regToMin,
  activeRegistrationClientForms,
  registrationClientFormIsRemoved,
  registrationCompletenessIssues,
} from './features/registration/completeness.js';
import {
  registrationPageSettled,
  registrationRestoreHolding,
} from './features/registration/prereqs.js';
import {
  _prefixScheiding,
  choicePrefix,
  registrationChoicePrefixRegex,
  registrationPrefixRegex,
} from './features/registration/report.js';
import { getRegistrationClientNumber } from './features/registration/prompts.js';
import {
  capturePendingRegistrationLabel,
  clearPendingRegistration,
  loadPendingRegistrationLabel,
  matchRegistrationChoiceByLabel,
  PENDING_REG_KEY,
  persistRegistrationTimes,
  popoverLabelFromDom,
  restoreRegistrationExtras,
  setRegistrationIdOverride,
} from './features/registration/pending.js';
import {
  ctxForcedVorm,
  pushRegistrationForms,
  startRegistrationWithForm,
} from './features/registration/context-menu.js';
import { pickClientIdFromSearch } from './services/ons-api/clients.js';
import { getEmployeeIdAsync } from './services/ons-api/employee.js';
import { getJson, postJson } from './services/ons-api/http.js';
import { buildUnavailability, describeUnavailability } from './domain/leave.js';
import { leaveRequestEnabled, openInNewTab, openLeaveDialog, requestLeave } from './features/leave/leave-request.js';
import { UI_OVERRIDES } from './ons/selector-overrides.js';
import {
  classifyAgendaEntry,
  isoLocalWithOffset,
  parseDetectOverlap,
  parseOpenCount,
  summarizeOpenRange,
  weekStartsBetween,
} from './domain/open-registrations.js';
import { _setOnsOverlapForTest, fetchEntriesForRange } from './services/ons-api/open-registrations.js';
import { quickRegister, quickRegisterUrl } from './features/agenda/quick-register.js';

// Test-hook: buitenste-scope-logica blootstellen (alleen onder testvlag).
// Opstarten: interne functies blootstellen aan de jsdom-tests (alleen onder testvlag).
export function exposeTestApi() {
  __exposeForTest({
    registrationCompletenessIssues,
    activeRegistrationClientForms,
    registrationClientFormIsRemoved,
    getRegistrationClientNumber,
    helperQualityIssues,
    appointmentMissingHooks,
    closeOnsModal,
    _regToMin,
    _regCareFlags,
    allKnownLabels,
    choiceLabels,
    setLabelsExclusive,
    entryUursoortIsSet,
    // Cliëntdetectie + schermtoestand: nodig voor de jsdom-tests rond de
    // meerdere-cliënten-flow en de schermherkenning.
    findClientEntries,
    uursoortContexts,
    clientsMissingUursoortEntries,
    invalidateClientEntries,
    inputBelongsToTrigger,
    markScreen,
    // Duurkeuze: nodig om te borgen dat de ingestelde stijl écht wordt gebruikt.
    mkDurationPicker,
    durationChipLabel,
    durationLabelStyle,
    renderScreen,
    // Overlapcontrole vóór opslaan.
    _tijdvakkenOverlappen,
    overlappendTijdvak,
    overlapMelding,
    __setTijdvakken: function (laag, ymd, rows) { try { _tijdvakCache[laag + '|' + resolveInviteeId() + '|' + ymd] = { ts: Date.now(), rows: rows || [] }; } catch (e) {} },
    // ONS-adapter: de gedocumenteerde naad naar ONS.
    OnsAdapter,
    onsGemisteVelden,
    onsVergeetGemist,
    // Ongedaan maken.
    takeAppointmentSnapshot,
    hasAppointmentSnapshot,
    clearAppointmentSnapshot,
    entryUursoortText,
    // Rapportageprefix: één regel vs. sjabloon met regeleindes.
    _prefixScheiding,
    registrationPrefixRegex,
    registrationChoicePrefixRegex,
    choicePrefix,
    PICKER_CHIP_LIMIT,
    clearScreenMark,
    __getCurrentScreen: function () { try { return currentScreen ? { name: currentScreen.name, args: currentScreen.args } : null; } catch (e) { return null; } },
    matchRegistrationChoiceByLabel,
    // Rechtermuismenu + momentopname.
    startRegistrationWithForm,
    ctxForcedVorm,
    pushRegistrationForms,
    // Labelherkenning uit de detailpopup: API-bron + opmaak-vangnet.
    detailsLabelNames,
    noteDetailsResponse,
    laatsteDetailsLabels,
    occurrenceIdFromPopover,
    popoverLabelFromDom,
    capturePendingRegistrationLabel,
    __clearLaatsteDetails: clearLaatsteDetails,
    loadPendingRegistrationLabel,
    __setPendingRegistration: function (o) { try { if (o == null) sessionStorage.removeItem(PENDING_REG_KEY); else sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify(o)); } catch (e) {} },
    __setCurrentRegistrationId: setRegistrationIdOverride,
    clearPendingRegistration,
    getRegistrationRestoreState: function () { try { return { fromAppointment: registrationFlow.registrationFromAppointment, autoApplied: registrationFlow.registrationAutoApplied, restoredToReport: registrationFlow.registrationRestoredToReport, activeChoiceLabel: (registrationFlow.activeRegistrationChoice && registrationFlow.activeRegistrationChoice.label) || null, autoChoiceLabel: (registrationFlow.registrationAutoChoice && registrationFlow.registrationAutoChoice.label) || null, pending: (function () { try { return sessionStorage.getItem(PENDING_REG_KEY); } catch (e) { return null; } })() }; } catch (e) { return null; } },
    persistRegistrationTimes,
    restoreRegistrationExtras,
    registrationRestoreHolding,
    registrationPageSettled,
    __setRegistrationHoldStart: function (t) { try { registrationFlow.registrationRestoreHoldStart = t; } catch (e) {} },
    helperNeedsTeamChoice,
    __setActiveProfile: setActiveProfileForTest,
    applyHelperConfig,
    effectiveChoices,
    effectiveRegistrationForms,
    nonClientCategoriesActive,
    mapAgendaWeekResponse,
    mapAgendaEntry,
    parseInviteeIdFromPath,
    agendaYmd,
    resolveInviteeId,
    fetchInviteeWeek,
    summarizeAgendaWeek,
    agendaEntryType,
    labelToAfspraaktype,
    _agFmtMin,
    parseStartVerdeling,
    entryToVorm,
    computeDirectIndirect,
    currentAgendaDate,
    agendaWeekNumber,
    normalizeRegistrationLine,
    summarizeRegistrations,
    parseWeekRegistrationOccurrences,
    parseRegistrationDetails,
    summarizeWeekRegistrations,
    declarabiliteitPct,
    declarabiliteitBase,
    _apiUrl,
    _isClientUursoortName,
    isRegistrationEditOrNew,
    isRegistrationOverviewPage,
    agendaRegistrationsSectionEl,
    __setInviteeIdOverride: setInviteeIdOverride,
    getUiOverride: function (k) { try { return UI_OVERRIDES[k]; } catch (e) { return undefined; } },
    getEndTimeInput,
    getStartTimeInput,
    enforceAppointmentEndTime,
    applyAppointmentDuration,
    appointmentReadyToSave,
    appointmentCoreApplied,
    appointmentSaveStageStillValid,
    collectClientUursoortOptionTexts,
    parseProductList,
    fetchProductList,
    getEmployeeIdAsync,
    getJson,
    postJson,
    buildUnavailability,
    describeUnavailability,
    requestLeave,
    openInNewTab,
    leaveRequestEnabled,
    openLeaveDialog,
    pickClientIdFromSearch,
    clearSettings,
    getUursoortQueueState: function () { try { return { active: appointmentFlow.uursoortQueueActive, gen: appointmentFlow.uursoortQueueGen, flowBusy: appointmentFlow.appointmentFlowBusy }; } catch (e) { return null; } },
    __setUursoortQueueActive: function (v) { try { appointmentFlow.uursoortQueueActive = !!v; } catch (e) {} },
    __setActiveNonClientOption: function (o) { try { appointmentFlow.activeNonClientOption = o || null; } catch (e) {} },
    appointmentEndGuardState: function () { try { return { helperEndText: appointmentFlow.helperEndText, userOwned: appointmentFlow.appointmentEndTimeUserOwned }; } catch (e) { return null; } },
    resetAppointmentEndGuard: function () { try { appointmentFlow.helperEndText = ''; appointmentFlow.appointmentEndTimeUserOwned = false; } catch (e) {} },
    getAppConfig: function () { try { return APP_CONFIG; } catch (e) { return null; } },
    getDefaultConfig: function () { try { return DEFAULT_APP_CONFIG; } catch (e) { return null; } },
    getRegistrationChoices: function () { try { return REGISTRATION_CHOICES; } catch (e) { return null; } },
    resolveText,
    mkText,
    managedRichHtml,
    // #2: DOM-detectiefuncties blootstellen zodat de regressietests op de ECHTE
    // ONS-DOM (button.label-tag, uc-time-input, data-qa) kunnen controleren.
    labelChips,
    selectedAllLabelChipTexts,
    removeLabelChipsByText,
    selectedKnownLabels,
    getEtiketTrigger,
    firstByDataQa,
    hasAppointmentStartTime,
    hasAppointmentDate,
    // Doorplannen (herhaling): DOM-detectie blootstellen zodat de regressietests
    // op de ECHTE ONS-DOM (Herhaling-kop + recurrence-type) kunnen controleren.
    findRecurrenceHeader,
    findRecurrenceField,
    recurrenceHeaderExpanded,
    recurrenceValue,
    recurrenceIsSet,
    doorplannenWarnText,
    doorplannenBlocksSave,
    // Open registraties: teller, periodecontrole, snel registreren.
    classifyAgendaEntry,
    summarizeOpenRange,
    weekStartsBetween,
    parseOpenCount,
    parseDetectOverlap,
    isoLocalWithOffset,
    fetchEntriesForRange,
    quickRegister,
    quickRegisterUrl,
    __setOnsOverlap: _setOnsOverlapForTest,
    __setDoorplannen: function (v) { try { appointmentFlow.appointmentDoorplannen = !!v; } catch (e) {} },
  });
}
