// Alle berichten tussen de onderdelen van de extensie, op één plek.
//
// De waarden zijn de letterlijke strings die al in gebruik waren; verander ze
// niet zonder alle kanten tegelijk aan te passen (er draaien geen oude en
// nieuwe versies naast elkaar, maar een zijpaneel en een tabblad van vóór en na
// een update kunnen kort tegelijk open staan).
//
// Richting:  CS = content-script op de ONS-pagina, SW = service worker,
//            SP = zijpaneel, PU = extensiepopup.

export const MSG = {
  // CS -> SW
  BADGE: 'badge',                       // { count }       aantal openstaande dagen op het icoon
  SUMMARY: 'summary',                   // { openDays, … } momentopname (alleen getallen en datums)
  FORMS: 'forms',                       // { forms: [] }   registratievormen voor het rechtermuismenu
  OPEN_SIDE_PANEL: 'open-side-panel',   //                 randlipje vraagt het zijpaneel te openen
  SIDEPANEL_QUERY: 'sidepanel-query',   //  -> { open }    staat het zijpaneel open voor dit tabblad?
  OPEN_TAB: 'open-tab',                 // { url } -> { ok } https-pagina in een nieuw tabblad (AFAS na verlof)

  // SW -> CS
  CTX_REGISTER: 'ctx-register',         // { vorm }        keuze uit het rechtermuismenu
  SIDEPANEL_STATE: 'sidepanel-state',   // { open }        (ook SP -> CS)

  // PU -> SW
  REMINDER_GET: 'reminder-get',         //  -> { settings, snapshot }
  REMINDER_SETTINGS: 'reminder-settings', // { enabled, weekday, hour, minute } -> { ok, settings }
  REMINDER_TEST: 'reminder-test',       //  -> { ok }      melding nu tonen (handmatig testen)

  // CS -> SP (uitgezonden; de service worker negeert ze)
  AGENDA_STATE: 'ag-state',             // { state }       toestand van de Agendahulp
  AGENDA_GONE: 'ag-gone',               //                 agenda verlaten
  SURVEY_STATE: 'survey-state',         // { state }       toestand van de vragenlijst-checklist
  SURVEY_GONE: 'survey-gone',           //                 vragenlijst verlaten

  // SP -> CS (naar het gevolgde tabblad)
  AGENDA_GET_STATE: 'ag-get-state',     //  -> { state }
  AGENDA_TOGGLE_ENABLED: 'ag-toggle-enabled', // { value }
  AGENDA_JUMP_DAY: 'ag-jump-day',       // { date }
  AGENDA_JUMP_WEEK: 'ag-jump-week',
  AGENDA_OPEN_OCCURRENCE: 'ag-open-occurrence', // { id }
  AGENDA_OPEN_LEAVE: 'ag-open-leave',   //                 verlofdialoog openen in de pagina
  AGENDA_CHECK_RANGE: 'ag-check-range', // { from, to } -> { ok, result | error }  open registraties in een periode
  AGENDA_QUICK_REGISTER: 'ag-quick-register', // { date, time, minutes, force } -> { ok, overlap?, error? }
  AGENDA_NEW_EVENT: 'ag-new-event',     // { date, time, minutes } -> { ok, error? }  afspraakformulier openen
  AGENDA_SLOT_CHECK: 'ag-slot-check',   // { date, startMin, minutes } -> { ok, status, overlap }  ONS' overlapcontrole
  AGENDA_FREE_SLOTS: 'ag-free-slots',   // { minutes, weeks } -> { ok, result: { gaps, ... } | error }  planhulp
  AGENDA_WEEK_RATIO: 'ag-week-ratio',   // { date } -> { ok, result: { weekStart, week, mode, rows } | error }
  AGENDA_PRODUCTION: 'ag-production',   // { from, to } -> { ok, result | error }  cliënttijd per week

  // CS -> SP (uitgezonden)
  AGENDA_RANGE_PROGRESS: 'ag-range-progress', // { kind: 'open'|'productie', done, total } voortgang
  SURVEY_GET_STATE: 'survey-get-state', //  -> { state }
  SURVEY_OPEN_ITEM: 'survey-open-item', // { index }
};

// Het zijpaneel houdt deze poort open zolang het zichtbaar is; zo weet de
// service worker of het open staat.
export const SIDEPANEL_PORT = 'agendahulp-sidepanel';

// Berichten tussen de geïsoleerde content-scripts en mainworld.js (de
// pagina-context) gaan via window.postMessage met deze markering.
export const PAGE_BRIDGE = {
  MARKER: '__onsah',
  TO_MAIN: 'to-main',
  FROM_MAIN: 'from-main',
};
