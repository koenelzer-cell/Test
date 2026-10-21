// Alle opslagsleutels van de extensie, met WAAR ze staan.
//
// BELANGRIJK: deze namen en plekken zijn in gebruik bij medewerkers. Een
// naam of plek wijzigen betekent dat iemand zijn voorkeur kwijtraakt, tenzij
// er een migratie bij komt. De waarden hieronder zijn ongewijzigd overgenomen.

// chrome.storage.sync — reist mee naar andere apparaten van de medewerker
// (valt terug op chrome.storage.local als sync ontbreekt).
export const SYNC = {
  SECTOR: 'sector',               // gekozen bedrijfsonderdeel (popup)
  COLOR_PROFILE: 'colorProfile',  // gekozen team / dagindeling (popup)
};

// chrome.storage.local — alleen dit apparaat.
export const LOCAL = {
  TEST_CONFIG: 'onsHelperConfig',          // lokale testconfiguratie (beheer); wint van config.json
  UI_OVERRIDES: 'onsHelper.uiOverrides',   // door de UI-inspector herstelde selectors
  INSPECTOR_OPEN: 'onsHelper.inspectorOpen', // UI-inspector blijft open bij paginawissel
  SNAPSHOT: 'onsHelper.snapshot',          // laatste weekstand (service worker; alleen getallen)
  REMINDER_SETTINGS: 'onsHelper.reminders', // instellingen wekelijkse herinnering
  REMINDER_HANDLED: 'onsHelper.reminderHandled', // tijdstip (ms) van de laatst afgehandelde herinnering
  FORMS: 'onsHelper.forms',                // registratievormen voor het rechtermuismenu
};

// localStorage van de ONS-pagina (origin van ONS, niet van de extensie).
// Historisch zo gegroeid; aan/uit-schakelaars van de medewerker.
export const PAGE_LOCAL = {
  HELPER_ENABLED: 'onsHelper.helperEnabled',  // afspraak-/registratiehulp aan/uit ('1'/'0')
  GREY_ENABLED: 'onsHelper.greyEnabled',      // gekleurde dagindeling aan/uit ('1'/'0')
  SURVEY_PANEL_WIDTH: 'onsHelper.surveyPanelWidth', // breedte vragenlijstpaneel (px)
  EVENT_META_TEMPLATE: 'onsHelper.eventMetaTemplate',      // instellingen van het afspraakformulier (alleen ja/nee en getallen)
  EVENT_OVERLAP_TEMPLATE: 'onsHelper.eventOverlapTemplate', // geleerde vorm van ONS' overlapcontrole (rollen, geen tijden of id's)
};

// sessionStorage van de ONS-pagina — alleen voor dit tabblad, weg bij sluiten.
export const PAGE_SESSION = {
  PENDING_REGISTRATION: 'onsHelper.pendingReg',          // registratie vanuit een afspraak (label, vorm, tijden)
  PENDING_APPOINTMENT: 'onsHelper.pendingAppointment',   // afspraak vanuit de planhulp (datum, begintijd, duur; model: velden voor het lege ONS-afspraakmodel; uursoorten: { clientId, hourTypeId, name } per cliënt)
  PENDING_DUPLICATES: 'onsHelper.pendingDuplicates',     // planhulp: momenten voor kopieën van de volgende nieuwe afspraak (datum, begintijd)
  PENDING_SURVEY_QUESTION: 'onsHelper.pendingSurveyQuestion',
  SURVEY_CHECKLIST: 'onsHelper.surveyChecklist',
  SURVEY_CATEGORY_URLS: 'onsHelper.surveyCategoryUrls.', // + resultaat-id
  SURVEY_AUDIT_CACHE: 'onsHelper.surveyCategoryAuditCache',
  SURVEY_AUDIT_RESUME: 'onsHelper.surveyAuditResume',
  SURVEY_MANUAL_AGE: 'onsHelper.surveyManualAge',
};
