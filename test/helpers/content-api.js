// Testbundel van het content-script (test/build/content.js): dezelfde ingang
// als dist/content.js, en daarna de interne functies die de jsdom-tests
// aanroepen op window.__onsHelperTestApi. De extensie laadt dit nooit.

import '../../src/content/index.js';
import { DEFAULT_APP_CONFIG } from '../../src/content/config/defaults.js';
import { allKnownLabels, APP_CONFIG, applyHelperConfig, choiceLabels, CONFIG, effectiveChoices, effectiveRegistrationForms, helperNeedsTeamChoice, nonClientCategoriesActive, REGISTRATION_CHOICES, setActiveProfileForTest } from '../../src/content/config/app-config.js';
import { currentAgendaDate, isRegistrationEditOrNew, isRegistrationOverviewPage, parseInviteeIdFromPath, resolveInviteeId, setInviteeIdOverride } from '../../src/content/ons/agenda-location.js';
import { _agFmtMin, agendaWeekNumber, agendaYmd } from '../../src/content/core/datetime.js';
import { _tijdvakCache, _tijdvakkenOverlappen, overlapMelding, overlappendTijdvak } from '../../src/content/features/overlap.js';
import { agendaEntryType, computeDirectIndirect, entryToVorm, labelToAfspraaktype, mapAgendaEntry, mapAgendaWeekResponse, parseStartVerdeling, summarizeAgendaWeek } from '../../src/content/domain/agenda-entries.js';
import { createLimiter, fetchInviteeWeek, fetchWeekRegistrationDeclarabiliteit } from '../../src/content/services/ons-api/calendar.js';
import { clearLaatsteDetails, detailsLabelNames, laatsteDetailsLabels, noteDetailsResponse, occurrenceIdFromPopover } from '../../src/content/services/ons-api/event-details.js';
import { declarabiliteitBase, declarabiliteitPct } from '../../src/content/domain/declarabiliteit.js';
import { normalizeRegistrationLine, parseRegistrationDetails, parseWeekRegistrationOccurrences, summarizeRegistrations, summarizeWeekRegistrations } from '../../src/content/domain/registrations.js';
import { _isClientUursoortName } from '../../src/content/domain/hour-types.js';
import { _apiUrl } from '../../src/content/services/ons-api/endpoints.js';
import { agendaRegistrationsSectionEl } from '../../src/content/features/agenda-overview/registrations-overview.js';
import { managedRichHtml, mkText, resolveText } from '../../src/content/ui/managed-text.js';
import { firstByDataQa, inputBelongsToTrigger } from '../../src/content/ons/form-controls.js';
import { collectClientUursoortOptionTexts } from '../../src/content/ons/uursoort-options.js';
import { entryUursoortIsSet, entryUursoortText, findClientEntries, findRecurrenceField, findRecurrenceHeader, getEndTimeInput, getEtiketTrigger, getStartTimeInput, invalidateClientEntries, labelChips } from '../../src/content/ons/appointment-form.js';
import { hasAppointmentDate, hasAppointmentStartTime } from '../../src/content/features/appointment/fields.js';
import { removeLabelChipsByText, selectedAllLabelChipTexts, selectedKnownLabels, setLabelsExclusive } from '../../src/content/features/appointment/labels.js';
import { enforceAppointmentEndTime, setAppointmentEndTimePlusMinutes, zetEindtijdAsync } from '../../src/content/features/appointment/end-time.js';
import { clearAppointmentTravelTimes, setAppointmentTravelTotalMinutes, zetReistijdenAsync } from '../../src/content/features/appointment/travel.js';
import { eerstViaFormulier, zetLabelsViaFormulier, zetUursoortViaFormulier } from '../../src/content/ons/form-model.js';
import { wachtTot } from '../../src/content/core/wacht.js';
import { pollFor } from '../../src/content/ons/dom.js';
import { nietClientUursoortMetId } from '../../src/content/features/appointment/uursoort-source.js';
import { keuzeVoorLabel, nietClientOptieVoorUursoort } from '../../src/content/helper/planner-form.js';
import { clientVoornamenAsync, findClientFirstNames } from '../../src/content/features/appointment/client-name.js';
import { clearAppointmentSnapshot, clearSettings, hasAppointmentSnapshot, takeAppointmentSnapshot } from '../../src/content/features/appointment/undo.js';
import { fetchProductList, parseProductList } from '../../src/content/services/ons-api/products.js';
import { clientsMissingUursoortEntries, uursoortContexts } from '../../src/content/features/appointment/uursoort-queue.js';
import { doorplannenBlocksSave, doorplannenWarnText, recurrenceHeaderExpanded, recurrenceIsSet, recurrenceValue } from '../../src/content/features/appointment/recurrence.js';
import { appointmentFlow, registrationFlow } from '../../src/content/state.js';
import { durationChipLabel, durationLabelStyle, mkDurationPicker, PICKER_CHIP_LIMIT } from '../../src/content/ui/duration-picker.js';
import { clearScreenMark, currentScreen, markScreen } from '../../src/content/screen/screen-state.js';
import { renderScreen } from '../../src/content/ui/react-bridge.js';
import { closeOnsModal } from '../../src/content/ons/modal.js';
import { OnsAdapter, onsGemisteVelden, onsVergeetGemist } from '../../src/content/features/appointment/ons-adapter.js';
import { appointmentMissingHooks, helperQualityIssues } from '../../src/content/features/quality.js';
import { applyAppointmentDuration } from '../../src/content/features/appointment/duration.js';
import { _regCareFlags, activeRegistrationClientForms, registrationClientFormIsRemoved, registrationCompletenessIssues } from '../../src/content/features/registration/completeness.js';
import { registrationPageSettled, registrationRestoreHolding } from '../../src/content/features/registration/prereqs.js';
import { _prefixScheiding, choicePrefix, registrationChoicePrefixRegex, registrationPrefixRegex } from '../../src/content/features/registration/report.js';
import { getRegistrationClientNumber } from '../../src/content/features/registration/prompts.js';
import { capturePendingRegistrationLabel, loadPendingRegistrationLabel, matchRegistrationChoiceByLabel, persistRegistrationTimes, popoverLabelFromDom, restoreRegistrationExtras, setRegistrationIdOverride } from '../../src/content/features/registration/pending.js';
import { ctxForcedVorm, pushRegistrationForms, startRegistrationWithForm } from '../../src/content/features/registration/context-menu.js';
import { pickClientIdFromSearch } from '../../src/content/services/ons-api/clients.js';
import { getEmployeeIdAsync } from '../../src/content/services/ons-api/employee.js';
import { getJson, postJson } from '../../src/content/services/ons-api/http.js';
import { buildUnavailability, describeUnavailability } from '../../src/content/domain/leave.js';
import { leaveRequestEnabled, openInNewTab, openLeaveDialog, requestLeave } from '../../src/content/features/leave/leave-request.js';
import { UI_OVERRIDES } from '../../src/content/ons/selector-overrides.js';
import { classifyAgendaEntry, isoLocalWithOffset, parseDetectOverlap, summarizeOpenRange, weekStartsBetween } from '../../src/content/domain/open-registrations.js';
import { _setOnsOverlapForTest, fetchEntriesForRange } from '../../src/content/services/ons-api/open-registrations.js';
import { openNewEvent, quickRegister, quickRegisterUrl } from '../../src/content/features/agenda/quick-register.js';
import { createEvents, eventOptions } from '../../src/content/features/agenda/event-create.js';
import { controleerOns } from '../../src/content/services/ons-api/formaat.js';
import { searchClientsForPlan } from '../../src/content/features/agenda/client-lookup.js';
import { currentInviteeIds, jumpToDay as _jumpToDayVoorTest, newEventUrl } from '../../src/content/features/agenda/navigation.js';
import { onsDateText } from '../../src/content/features/appointment/prefill.js';
import { findFreeGaps, reservationBlocks, reservationsOverlapping } from '../../src/content/domain/free-slots.js';
import { _forgetHolidays, findFreeSlots } from '../../src/content/features/agenda/free-slots.js';
import { parseHolidays } from '../../src/content/domain/holidays.js';
import { declareUrlUitDetails, registerOpenItem } from '../../src/content/features/agenda/register-item.js';
import { mergeOpenRangePerPersoon } from '../../src/content/features/agenda/open-range.js';
import { _clearPreloadCache, cachedFreeSlots, cachedOpenRange, forgetFreeSlots, isCached, openAantal } from '../../src/content/features/agenda/preload.js';
import { plannedProductionRow, productionWeekRow } from '../../src/content/features/agenda/production.js';
import { plannedRatioRows } from '../../src/content/features/agenda/week-ratio.js';
import { _regToMin } from '../../src/content/features/registration/fields.js';
import { clearPendingRegistration, PENDING_REG_KEY } from '../../src/content/features/registration/pending-store.js';
import { appointmentCoreApplied, appointmentReadyToSave, appointmentSaveStageStillValid } from '../../src/content/features/appointment/gereed.js';

import { classifyOccurrence, isDeclared, occurrenceIsPast, occurrenceOverdue24h } from '../../src/content/features/agenda/occurrences.js';
import { computeTotals, listUnfinished } from '../../src/content/features/agenda/unregistered-time.js';
import { editableWindowStart, windowStatusForDate } from '../../src/content/features/agenda/edit-window.js';
import { configProfileLegend, configProfileZones } from '../../src/content/features/agenda/zones.js';

window.__onsHelperTestApi = {
  // Agenda: openstaande tijd, bewerkvenster, zones.
  computeTotals, isDeclared, classifyOccurrence, occurrenceIsPast, occurrenceOverdue24h,
  editableWindowStart, windowStatusForDate, listUnfinished, configProfileZones, configProfileLegend,
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
  zetLabelsViaFormulier,
  zetUursoortViaFormulier,
  eerstViaFormulier,
  wachtTot,
  pollFor,
  nietClientUursoortMetId,
  keuzeVoorLabel,
  findClientFirstNames,
  clientVoornamenAsync,
  CONFIG,
  nietClientOptieVoorUursoort,
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
  fetchWeekRegistrationDeclarabiliteit,
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
  setAppointmentEndTimePlusMinutes,
  zetEindtijdAsync,
  setAppointmentTravelTotalMinutes,
  clearAppointmentTravelTimes,
  zetReistijdenAsync,
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
  // DOM-detectiefuncties blootstellen zodat de regressietests op de ECHTE
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
  // Open registraties: periodecontrole, snel registreren.
  classifyAgendaEntry,
  summarizeOpenRange,
  weekStartsBetween,
  parseDetectOverlap,
  isoLocalWithOffset,
  fetchEntriesForRange,
  quickRegister,
  quickRegisterUrl,
  newEventUrl,
  openNewEvent,
  createEvents,
  eventOptions,
  controleerOns,
  searchClientsForPlan,
  onsDateText,
  findFreeGaps, reservationBlocks, reservationsOverlapping,
  findFreeSlots,
  _forgetHolidays,
  parseHolidays,
  registerOpenItem,
  declareUrlUitDetails,
  mergeOpenRangePerPersoon,
  cachedOpenRange,
  openAantal,
  isCached,
  cachedFreeSlots,
  forgetFreeSlots,
  _clearPreloadCache,
  currentInviteeIds,
  jumpToDayVoorTest: _jumpToDayVoorTest,
  productionWeekRow,
  plannedProductionRow,
  plannedRatioRows,
  createLimiter,
  __setOnsOverlap: _setOnsOverlapForTest,
  __setDoorplannen: function (v) { try { appointmentFlow.appointmentDoorplannen = !!v; } catch (e) {} },
  getPlanhulpVerder: () => appointmentFlow.planhulpVerder,
  __setPlanhulpVerder: (fn) => { appointmentFlow.planhulpVerder = fn; },
};
