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
  AGENDA_REGISTER_ITEM: 'ag-register-item', // { id, date } -> { ok, error? }  open registraties: afspraak openen en Registreren klikken
  AGENDA_OPEN_LEAVE: 'ag-open-leave',   //                 verlofdialoog openen in de pagina
  AGENDA_CHECK_RANGE: 'ag-check-range', // { from, to } -> { ok, result | error }  open registraties in een periode
  AGENDA_QUICK_REGISTER: 'ag-quick-register', // { date, time, minutes, force } -> { ok, overlap?, error? }
  AGENDA_NEW_EVENT: 'ag-new-event',     // { date, time, minutes, extra?: [{ date, time }] } -> { ok, error? }  afspraakformulier openen (extra: kopieën na opslaan)
  AGENDA_FORM_TITLE: 'ag-form-title', // content -> zijpaneel: { date, time } -> { title }  titel uit Afspraak maken voor het ONS-formulier dat net openging (alleen in het geheugen van het zijpaneel)
  AGENDA_DUPLICATES_DONE: 'ag-duplicates-done', // content -> zijpaneel: { made, failed, reason }  kopieën van een afspraak
  AGENDA_DAY_ROUTE: 'ag-day-route',     // { date, origin } -> { ok, result: { persons: [{ stops, missing, urls }] } | error }  route van de dag
  AGENDA_SLOT_CHECK: 'ag-slot-check',   // { date, startMin, minutes } -> { ok, status, overlap }  ONS' overlapcontrole
  AGENDA_EVENT_OPTIONS: 'ag-event-options', // { clientIds } -> { ok, labels: [{ id, name }], hourTypes: { clientId: [{ id, name, recent }] }, metaKnown }
  AGENDA_CREATE_EVENTS: 'ag-create-events', // { events: [{ date, startMin, minutes, clients: [{ id, hourTypeId }], labelId, name, travelBefore, travelAfter }] } -> { ok, results: [{ ok, error? }] }
  AGENDA_RELOAD: 'ag-reload',           //                 agenda verversen (na afspraken maken)
  AGENDA_CLIENT_SEARCH: 'ag-client-search', // { term, outOfCare } -> { ok, clients: [{ id, name, pc, number, birth }] }  planhulp: meerdere afspraken
  AGENDA_FREE_SLOTS: 'ag-free-slots',   // { minutes, weeks, to?, from?, days? ([1..5]: alleen die weekdagen), limit? (aantal blokken) } -> { ok, result: { gaps, ... } | error }  planhulp (to: zoek tot en met die datum; from: vanaf die datum, weekraster)
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
// Opdrachten van het content-script aan de main-world (dir TO_MAIN) en het
// antwoord (dir FROM_MAIN, met hetzelfde id).
export const PAGE_COMMAND = {
  SET_LABELS: 'zetLabels',      // { id, labels: ['JG Huisbezoek', …], toevoegen? } of { id, labels: [], wis: true }  labels van het open afspraakformulier zetten (vervangen of toevoegen) of wissen
  LABELS_SET: 'labelsGezet',    // { id, ok, reden? }
  SET_HOUR_TYPE: 'zetUursoort', // { id, doel | clientId, hourTypeId, beschrijving } of { id, doel, wis: true }  uursoort van het veld met data-onsah-doel=doel, of van die cliënt
  HOUR_TYPE_SET: 'uursoortGezet', // { id, ok, reden? }
  SET_FIELD: 'zetVeld',         // { id, veld, waarde }  één veld van het afspraakmodel via ONS' onChange (vaste lijst velden)
  FIELD_SET: 'veldGezet',       // { id, ok, reden? }
  READ_FORM: 'leesFormulier',   // { id }  wat het open afspraakformulier bevat
  FORM_READ: 'formulierGelezen', // { id, ok, clients: [{ id, voornaam }], uursoorten: { clientId: hourTypeId|null }, labelIds }
};
