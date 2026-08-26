
(function () {
  'use strict';

  // Eén bron van waarheid: versie komt uit manifest.json (met fallback).
  const SCRIPT_VERSION = (function () {
    try { return chrome.runtime.getManifest().version; } catch (e) { return '1.3.89'; }
  })();

  // ===== Centrale ONS-selectors/markers =====
  // Alle plekken waar de UI van ONS wordt herkend, staan hier bij elkaar, zodat
  // een wijziging in de ONS-markup op één plaats te fixen is.
  const ONS = {
    dayColumn: '.day.js_day',
    dayColumnCell: 'td.calendar_day',
    occurrenceBase: '.js_calendar_occurrence.calendar_occurrence_base',
    occurrenceTitle: '.calendar_occurrence--has-title',
    appointmentTitle: '.appointment-title',
    labelWithTitle: '.labels .label[title]',
    unavailability: '.js_calendar_occurrence.unavailable, [data-type="unavailability"]',
    ucTagDeletable: 'uc-tag[deletable]',
    omnisearchTrigger: 'button[data-testid="omnisearch-trigger"]',
    freeDayTextRe: /vaste vrije dag/i,
    weekendClassRe: /\b(saturday|sunday)\b/,
    declaredRe: /\sdeclared\s/,
    notDeclaredRe: /\snot-declared\s/,
  };

  // ===== Beheerbare configuratie (één bron) =====
  // Alle voorheen hardcoded lijsten staan hier bij elkaar. Dit is het formaat dat
  // het (aparte) beheerscherm produceert. Een override kan via chrome.storage
  // (managed door IT, of local voor test) onder de sleutel 'helperConfig' worden
  // gezet; die vervangt per sectie de standaard hieronder. Zo is aanpassen
  // mogelijk zonder in de code te graven.
  const DEFAULT_APP_CONFIG = {
    // Tabel 1: keuze in de helper -> ONS-label + gedrag.
    choices: [
      { label: 'Huisbezoek',      etiket: 'JG Huisbezoek',              clientPresent: true,  pickUursoort: true, addTravelTime: true },
      { label: 'Digitaal',        etiket: 'ALL Beeldbellen',            clientPresent: true,  pickUursoort: true, addTravelTime: false },
      { label: 'MDO',             etiket: 'JG MDO',                     clientPresent: false, pickUursoort: true, addTravelTime: false },
      { label: 'Face 2 face',     etiket: 'JG Face to face kantoor',    clientPresent: true,  pickUursoort: true, addTravelTime: false },
      { label: 'Verslaglegging',  etiket: 'JG Verslaglegging',          clientPresent: false, pickUursoort: true, addTravelTime: false },
      { label: 'Zorgcoördinatie', etiket: 'JG Zorgcoördinatie',         clientPresent: false, pickUursoort: true, addTravelTime: false },
    ],
    // Extra bekende labels (naast de etiketten uit choices) die de opschoning kent.
    extraKnownLabels: [],
    // Tabel 2: registratievorm -> startverdeling + extra vragen/acties + de
    // afspraaklabels die deze vorm automatisch kiezen (`labels`, uit de
    // labellijst). De aparte labelToForm-tabel is hierin opgegaan.
    // `relevantForTeams` (leeg = alle teams) bepaalt voor welke teams de vorm geldt.
    registrationForms: [
      { vorm: 'No show',             startVerdeling: '100% direct',   uursoort: 'No show#', eindtijdBeginPlusMin: 1, rapportagePrefix: 'No show', vraagTegenTijd: false, labels: [], relevantForTeams: [] },
      { vorm: 'Verslaglegging',      startVerdeling: '100% indirect', vraagDirecteTijd: true, stapMin: 5, labels: ['JG Verslaglegging'], relevantForTeams: [] },
      { vorm: 'MDO',                 startVerdeling: '100% indirect', vraagTegenTijd: false, labels: ['JG MDO'], relevantForTeams: [] },
      { vorm: 'Zorgcoördinatie',     startVerdeling: '100% indirect', vraagDirecteTijd: true, labels: ['JG Zorgcoördinatie'], relevantForTeams: [] },
      { vorm: 'Huisbezoek',          startVerdeling: '100% direct',   vraagIndirecteTijd: true, vraagReistijd: true, labels: ['JG Huisbezoek'], relevantForTeams: [] },
      { vorm: 'Face 2 face kantoor', startVerdeling: '100% direct',   vraagIndirecteTijd: true, labels: ['JG Face to face kantoor'], relevantForTeams: [] },
    ],
    // Het palet: de toegestane kleuren voor de dag-indeling. Elke zone kiest één
    // van deze namen. 'fill' = achtergrond in de agenda, 'legend' = legenda-stip.
    palette: {
      rood:  { naam: 'Rood',  fill: 'rgba(220,70,70,0.15)',  legend: 'rgba(220,70,70,0.45)' },
      geel:  { naam: 'Geel',  fill: 'rgba(235,205,70,0.20)', legend: 'rgba(235,205,70,0.65)' },
      blauw: { naam: 'Blauw', fill: 'rgba(70,130,210,0.16)', legend: 'rgba(70,130,210,0.45)' },
      groen: { naam: 'Groen', fill: 'rgba(60,170,90,0.18)',  legend: 'rgba(60,170,90,0.50)' },
    },
    profileSectors: { 'JGGZ': 'Jeugd & Gezin', 'J&O/JBG': 'Jeugd & Gezin', 'Begeleiding': 'Begeleiding' },
    // 6.2/6.3: kleur-dagindeling per profiel (tijd -> zone -> kleur uit palet).
    zoneProfiles: {
      'JGGZ': [
        { start: '08:00', end: '08:30', zone: 'Dagstart',        color: 'rood' },
        { start: '08:30', end: '11:30', zone: 'Cliëntafspraken', color: 'geel' },
        { start: '11:30', end: '12:00', zone: 'Administratie',   color: 'rood' },
        { start: '12:00', end: '12:30', zone: 'Pauze',           color: 'blauw' },
        { start: '12:30', end: '14:00', zone: 'Cliëntafspraken', color: 'geel' },
        { start: '14:00', end: '14:45', zone: 'Administratie',   color: 'rood' },
        { start: '14:45', end: '16:15', zone: 'Cliëntafspraken', color: 'geel' },
        { start: '16:15', end: '17:00', zone: 'Vergadering',     color: 'groen' },
      ],
      'J&O/JBG': [
        { start: '08:00', end: '08:30', zone: 'Administratie (indirect)', color: 'geel' },
        { start: '08:30', end: '12:00', zone: 'Huisbezoek (direct)',      color: 'rood' },
        { start: '12:00', end: '12:30', zone: 'Pauze',                    color: 'blauw' },
        { start: '12:30', end: '14:00', zone: 'Huisbezoek (direct)',      color: 'rood' },
        { start: '14:00', end: '14:45', zone: 'Administratie (indirect)', color: 'geel' },
        { start: '14:45', end: '16:15', zone: 'Huisbezoek (direct)',      color: 'rood' },
        { start: '16:15', end: '17:00', zone: 'Vergadering',              color: 'groen' },
      ],
      // Begeleiding: startprofiel (huisbezoek-gedreven). Pas dit aan in het beheerscherm.
      'Begeleiding': [
        { start: '08:00', end: '08:30', zone: 'Administratie (indirect)', color: 'geel' },
        { start: '08:30', end: '12:00', zone: 'Cliëntbegeleiding',        color: 'rood' },
        { start: '12:00', end: '12:30', zone: 'Pauze',                    color: 'blauw' },
        { start: '12:30', end: '14:00', zone: 'Cliëntbegeleiding',        color: 'rood' },
        { start: '14:00', end: '14:45', zone: 'Administratie (indirect)', color: 'geel' },
        { start: '14:45', end: '16:15', zone: 'Cliëntbegeleiding',        color: 'rood' },
        { start: '16:15', end: '17:00', zone: 'Vergadering',              color: 'groen' },
      ],
    },
    // Aanpasbare schermteksten (per key) met opmaak. Elke key wordt in de
    // extensie op een vaste plek getoond; hier kun je tekst + kleur/dikte/
    // cursief/grootte instellen. sizePx = tekstgrootte in pixels.
    texts: {
      afspraak_klaar_regel1:        { text: 'Voeg eventueel nog een locatie en notitie toe.',         color: '#333333', bold: false, italic: false, sizePx: 13 },
      afspraak_klaar_regel2:        { text: 'Als de instellingen kloppen, kun je de afspraak opslaan', color: '#333333', bold: false, italic: false, sizePx: 13 },
      afspraak_uursoort_sub:        { text: 'Daarna gaat de afspraak vanzelf verder.',                color: '#666666', bold: false, italic: false, sizePx: 12 },
      registratie_rapportage_titel: { text: 'Schrijf nu je rapportage, volgens Richtlijn rapporteren', color: '#222222', bold: true,  italic: false, sizePx: 14 },
      registratie_prereq_regel1:    { text: 'Voor cliëntgebonden registraties: vul cliënt, datum en begintijd in.',      color: '#c0006a', bold: true, italic: false, sizePx: 13 },
      registratie_prereq_regel2:    { text: 'Voor niet cliëntgebonden registraties: vul datum, begintijd en eindtijd in.', color: '#c0006a', bold: true, italic: false, sizePx: 13 },
      probleem_hulp_werkt_niet:     { text: "Let op: de afspraakhulp herkent een veld niet en werkt mogelijk niet volledig. Controleer de afspraak zelf en meld dit via 'Meld probleem' in de extensie.", color: '#b3261e', bold: true,  italic: false, sizePx: 13 },
      probleem_uursoort_zelf:       { text: 'Kies zelf de uursoort in het gemarkeerde veld hieronder.',                color: '#704b00', bold: false, italic: false, sizePx: 13 },
      probleem_label_zelf:          { text: 'Controleer het label bovenaan de afspraak en pas het zo nodig zelf aan.', color: '#704b00', bold: false, italic: false, sizePx: 13 },
      doorplannen_vraag:            { text: 'Afspraak doorplannen?',                                                 color: '#cc087d', bold: false, italic: false, sizePx: 13 },
      doorplannen_waarschuwing:     { text: "Je gaf aan de afspraak te willen doorplannen, maar de herhaling staat nog op 'Niet'. Stel de herhaling in, of zet 'Afspraak doorplannen?' uit en sla op.", color: '#b3261e', bold: true, italic: false, sizePx: 13 },
    },
    compatibility: { schemaVersion: 7, minimumExtensionVersion: '1.6.114' },
    features: { appointmentAssistant: true, registrationAssistant: true, dayColoring: true, managedTexts: true, surveyRequired: true, surveyAudit: true, reportGuidelineLink: true, doorplannenToggle: true },
    nonClientCategories: [],
    generalSettings: { travelStepMin: 5, travelMaxMin: 60, portionStepMin: 5, lateThresholdHours: 24, durationStepMin: 15, appointmentMaxMin: 480, registrationMaxMin: 180, pauseFixedMin: 30, nonClientMarker: '*', countWeekends: false, nonClientUursoorten: [], excludedRegistrationStatuses: ['do_not_declare'], excludedCalendarTypes: ['unavailability', 'presence'] },
    // API-endpoint-sjablonen (agenda-analyse) — instelbaar; alleen relatieve same-origin paden.
    apiEndpoints: {},
    // Declarabiliteit-grondslag per profiel (regels 'match -> direct|client').
    declarabiliteitRules: [],
    // Support: instelbaar meldkanaal (TOPdesk) voor de 'Meld probleem'-knop en de infolink.
    support: { topdeskUrl: 'https://impegno.topdesk.net/' },
    // Activatie: welke URL-delen de afspraak-/registratiehulp aanzetten.
    // Instelbaar zodat een ONS-URL-wijziging niet meer een code-update vereist.
    activation: { appointmentNeedle: '/events/new', registrationNeedle: '/registrations', domains: [] },
    // Gefaseerde uitrol: modules met een testGroup draaien alleen voor de
    // gebruikers in die groep zolang 'enabled' aan staat. Uit = voor iedereen.
    rollout: { enabled: false, groups: {} },
    // Centraal (beheerscherm) herstelde UI-selectors — geëxporteerd door de
    // UI-inspector en gepubliceerd in config.json, zodat correcties voor ALLE
    // gebruikers gelden i.p.v. alleen op één testapparaat.
    uiSelectors: {},
  };
  // Actieve config (begint als de standaard; wordt door een override vervangen).
  function _cloneConfig(c) { try { return JSON.parse(JSON.stringify(c)); } catch (e) { return c; } }
  const APP_CONFIG = _cloneConfig(DEFAULT_APP_CONFIG);
  let ACTIVE_SECTOR = null;
  let ACTIVE_PROFILE = null; // het gekozen team (kleurprofiel)
  function anyTeamsDefined() { try { return !!(APP_CONFIG.profileSectors && Object.keys(APP_CONFIG.profileSectors).length); } catch (e) { return false; } }
  // De hulp vereist een gekozen team: zonder team (terwijl er wél teams bestaan)
  // blokkeert de UI (showNeedsTeamChoice) — dan zie je geen afspraaktypes/
  // registraties. De onderstaande filtering geldt zodra er wél een team is:
  // 'relevantForTeams' leeg = alle teams, anders alleen het gekozen team. Zonder
  // team filteren we intern niet (labelherkenning e.d. blijft werken; de UI is
  // toch geblokkeerd).
  function relevantForActiveTeam(item) {
    if (!ACTIVE_PROFILE) return true;
    const teams = item && item.relevantForTeams;
    if (!Array.isArray(teams) || teams.length === 0) return true;
    return teams.indexOf(ACTIVE_PROFILE) >= 0;
  }
  function helperNeedsTeamChoice() { return !ACTIVE_PROFILE && anyTeamsDefined(); }
  // Stabiele sortering op 'volgorde' (0..oneindig; ingesteld in het beheerscherm).
  // Ontbrekend/leeg -> achteraan, met behoud van de bestaande volgorde.
  function sortByVolgorde(arr) {
    return (arr || []).map(function (x, i) { return [x, i]; }).sort(function (a, b) {
      var av = (a[0] && a[0].volgorde != null && a[0].volgorde !== '') ? +a[0].volgorde : Infinity;
      var bv = (b[0] && b[0].volgorde != null && b[0].volgorde !== '') ? +b[0].volgorde : Infinity;
      if (!isFinite(av)) av = Infinity; if (!isFinite(bv)) bv = Infinity;
      return av === bv ? a[1] - b[1] : av - bv;
    }).map(function (p) { return p[0]; });
  }
  function effectiveChoices() {
    return sortByVolgorde((APP_CONFIG.choices || []).filter(relevantForActiveTeam));
  }
  function effectiveRegistrationForms() {
    return sortByVolgorde((APP_CONFIG.registrationForms || []).filter(relevantForActiveTeam));
  }

  // ===== Ons Agenda-API (route B: same-origin, sessiecookie) =====
  // Haalt de weekafspraken van één invitee op via /calendar/invitee/{id}/entries/week.
  // Die endpoint levert de herhalingen al uitgerold per dag (elk item is één concreet
  // voorval), dus we hoeven client-side geen herhalingen uit te rollen.
  var _inviteeIdOverride = null; // testhaak / handmatige override
  function _agInt(v) { var n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }
  // Leest de invitee-id uit een pad/URL zoals /calendar/invitee/45267/entries/week.
  function parseInviteeIdFromPath(path) {
    var m = String(path == null ? '' : path).match(/\/calendar\/invitee\/(\d+)\b/);
    return m ? _agInt(m[1]) : null;
  }
  function resolveInviteeId() {
    if (_inviteeIdOverride != null) return _inviteeIdOverride;
    // 1) De agenda staat op .../calendar/invitee/{id}/... -> uit de huidige URL.
    var fromUrl = parseInviteeIdFromPath((location && (location.pathname + location.search + location.hash)) || '');
    if (fromUrl != null) return fromUrl;
    // 2) Fallback: een detail-/agenda-link in de DOM (meta.detailsUrl-vorm).
    try {
      var a = deepQueryAll('a').find(function (el) { return /\/calendar\/invitee\/\d+\//.test((el.getAttribute && el.getAttribute('href')) || ''); });
      if (a) { var id = parseInviteeIdFromPath(a.getAttribute('href')); if (id != null) return id; }
    } catch (e) {}
    return null;
  }
  // Datum -> 'YYYY-MM-DD' (lokale kalenderdag; de endpoint verwacht een dag in de week).
  function agendaYmd(d) {
    var dt = (d instanceof Date) ? d : (d != null && d !== '' ? new Date(d) : new Date());
    if (isNaN(dt.getTime())) return null;
    var mm = ('0' + (dt.getMonth() + 1)).slice(-2), dd = ('0' + dt.getDate()).slice(-2);
    return dt.getFullYear() + '-' + mm + '-' + dd;
  }
  // Normaliseer één ruwe entry uit 'entries/week' naar een schoon, stabiel model.
  function mapAgendaEntry(e) {
    if (!e || typeof e !== 'object') return null;
    var ts = e.time_slot || {};
    var start = e.start_time || ts.start_time || ts.start_date_time || null;
    var end = e.end_time || ts.end_time || ts.end_date_time || null;
    var loc = e.location || {};
    return {
      id: (e.id != null ? String(e.id) : null),
      occurrenceId: e.occurrence_id || null,
      date: e.date || (start ? String(start).slice(0, 10) : null),
      start: start,
      end: end,
      startMs: start ? Date.parse(start) : null,
      endMs: end ? Date.parse(end) : null,
      allDay: !!ts.all_day,
      durationSec: (typeof ts.duration === 'number') ? ts.duration : null,
      travelBefore: (ts.travel_time_before != null ? ts.travel_time_before : null),
      travelAfter: (ts.travel_time_after != null ? ts.travel_time_after : null),
      type: e.type || null,
      // Alleen de echte uursoort; NIET e.title als fallback — die bevat bij
      // registraties de cliëntnaam (PII).
      hourType: e.hour_type || '',
      recurring: !!e.recurring,
      editable: !!e.is_editable,
      classes: e.classes || '',
      // PRIVACY: cliëntgegevens (naam/bsn/geboortedatum), de vrije titel (e.name) en de
      // opmerking worden bewust NIET overgenomen. Alleen een telling + wel/niet-gekoppeld.
      clientCount: (Array.isArray(e.clients) ? e.clients.length : 0),
      // Medewerkers zonder naam (alleen id's/rol) — geen persoonsnamen in het model.
      employees: (Array.isArray(e.employees) ? e.employees : []).map(function (m) {
        return { id: (m && m.id != null ? m.id : null), externalId: (m && m.external_id != null ? m.external_id : null), authorized: !!(m && m.authorized), inviteeType: (m && m.invitee_type_name) || '' };
      }),
      teams: Array.isArray(e.teams) ? e.teams : [],
      groups: Array.isArray(e.groups) ? e.groups : [],
      labels: Array.isArray(e.labels) ? e.labels : [], // afspraaklabels (voor type/vorm), geen cliëntdata
      detailsUrl: (e.meta && e.meta.detailsUrl) || null,
      // "Cliëntafspraak" = er is een cliënt GEKOPPELD (clients niet leeg), bewust NIET
      // het 'cliënten aanwezig'-vinkje uit de API.
      clientPresent: (Array.isArray(e.clients) && e.clients.length > 0)
    };
  }
  // Zet de volledige respons ({ data: [...] }) om naar een op starttijd gesorteerde lijst.
  function mapAgendaWeekResponse(json) {
    var rows = json && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
    return rows.map(mapAgendaEntry).filter(Boolean)
      .sort(function (a, b) { return (a.startMs || 0) - (b.startMs || 0); });
  }
  // Fetch de weekafspraken. Relatieve URL => same-origin => de sessiecookie gaat mee.
  function fetchInviteeWeek(inviteeId, date) {
    var id = (inviteeId != null) ? inviteeId : resolveInviteeId();
    if (id == null) return Promise.reject(new Error('geen invitee-id gevonden'));
    var d = agendaYmd(date) || agendaYmd(new Date());
    var url = _apiUrl('weekEvents', { inviteeId: id, date: d });
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { return mapAgendaWeekResponse(j); });
  }
  // Duur van een entry in minuten (uit duration in sec, anders uit start/eind).
  function _entryMinutes(e) {
    if (e && typeof e.durationSec === 'number' && e.durationSec > 0) return e.durationSec / 60;
    if (e && e.startMs != null && e.endMs != null && e.endMs > e.startMs) return (e.endMs - e.startMs) / 60000;
    return 0;
  }
  // ONS-labels van een entry als schone tekstlijst.
  function _agEntryLabels(e) {
    return (e && Array.isArray(e.labels) ? e.labels : []).map(function (l) {
      return String((l && (l.name || l.label || l.title) != null) ? (l.name || l.label || l.title) : (l == null ? '' : l)).trim();
    }).filter(Boolean);
  }
  // Vertaal één ONS-label naar het ingestelde afspraaktype (choice.label uit het
  // beheerscherm, via etiket/etiketten). Geen match -> null.
  function labelToAfspraaktype(labelText, choices) {
    var key = _agNorm(labelText); if (!key) return null;
    choices = choices || ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.choices) || []);
    for (var i = 0; i < choices.length; i++) {
      var c = choices[i]; var ets = [];
      if (Array.isArray(c.etiketten)) ets = ets.concat(c.etiketten);
      if (c.etiket) ets.push(c.etiket);
      if (ets.map(_agNorm).indexOf(key) !== -1) return c.label || null;
    }
    return null;
  }
  // Het "type" is het afspraaktype uit het beheerscherm (label -> type). Geen label of
  // geen match -> "Niet-gedefinieerd". Bewust NOOIT de vrije titel/uursoort/cliëntnaam.
  function agendaEntryType(e, choices) {
    var labels = _agEntryLabels(e);
    for (var i = 0; i < labels.length; i++) {
      var t = labelToAfspraaktype(labels[i], choices);
      if (t) return t;
    }
    return 'Niet-gedefinieerd';
  }
  // Startverdeling "N% direct/indirect" -> percentage directe tijd (0..100), of null.
  function parseStartVerdeling(sv) {
    var m = /(\d+)\s*%\s*(direct|indirect)/i.exec(String(sv == null ? '' : sv));
    if (!m) return null;
    var pct = Math.max(0, Math.min(100, parseInt(m[1], 10) || 0));
    return /indirect/i.test(m[2]) ? (100 - pct) : pct;
  }
  function _agNorm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  // Koppel een agenda-entry aan een registratievorm. Volgorde:
  //   1) het Labels-veld van de vorm bevat het afspraaklabel,
  //   2) de uursoort van de vorm is gelijk aan die van de afspraak,
  //   3) laatste redmiddel: de vorm-NAAM is gelijk aan het afspraaklabel.
  function entryToVorm(entry, forms) {
    forms = forms || [];
    if (!entry) return null;
    var labels = _agEntryLabels(entry).map(_agNorm).filter(Boolean);
    for (var i = 0; i < forms.length; i++) {
      var fl = (Array.isArray(forms[i].labels) ? forms[i].labels : []).map(_agNorm);
      if (fl.some(function (x) { return x && labels.indexOf(x) !== -1; })) return forms[i];
    }
    var ht = _agNorm(entry.hourType);
    if (ht) { for (var j = 0; j < forms.length; j++) { if (_agNorm(forms[j].uursoort) === ht) return forms[j]; } }
    for (var k = 0; k < forms.length; k++) {
      var vn = _agNorm(forms[k].vorm);
      if (vn && labels.indexOf(vn) !== -1) return forms[k];
    }
    return null;
  }
  // Reistijd staat in time_slot.travel_time_* ; aanname: seconden (net als 'duration').
  // Klopt de schaal niet, zet deze deler op 1 (dan worden het minuten).
  var AGENDA_TRAVEL_DIVISOR = 60;
  // Splits de duur van één entry in directe/indirecte minuten + reistijd. Kan het
  // label niet naar een registratievorm gemapt worden, dan telt de tijd als
  // "onbekend" (niet gokken op basis van cliënt-aanwezig).
  function computeDirectIndirect(entry, forms) {
    var min = _entryMinutes(entry);
    var travelRaw = ((entry && entry.travelBefore) || 0) + ((entry && entry.travelAfter) || 0);
    var travel = travelRaw / AGENDA_TRAVEL_DIVISOR;
    var vorm = entryToVorm(entry, forms);
    var directPct = vorm ? parseStartVerdeling(vorm.startVerdeling) : null;
    if (directPct == null) return { directMin: 0, indirectMin: 0, unknownMin: min, travelMin: travel };
    var directMin = min * directPct / 100;
    return { directMin: directMin, indirectMin: min - directMin, unknownMin: 0, travelMin: travel };
  }
  // Tel een lijst genormaliseerde entries op: totaal, cliënt/niet-cliënt, directe/
  // indirecte tijd + reistijd (uit de startverdeling van de registratievormen),
  // percentage directe tijd t.o.v. 80%, en uitsplitsing per type en per dag.
  function summarizeAgendaWeek(entries, forms, choices) {
    forms = forms || ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.registrationForms) || []);
    choices = choices || ((typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.choices) || []);
    var list = Array.isArray(entries) ? entries : [];
    var totalMin = 0, clientMin = 0, nonClientMin = 0, directMin = 0, indirectMin = 0, unknownMin = 0, travelMin = 0, typeMap = {}, dateMap = {};
    list.forEach(function (e) {
      var min = _entryMinutes(e);
      totalMin += min;
      if (e && e.clientPresent) clientMin += min; else nonClientMin += min;
      var di = computeDirectIndirect(e, forms);
      directMin += di.directMin; indirectMin += di.indirectMin; unknownMin += di.unknownMin; travelMin += di.travelMin;
      var t = agendaEntryType(e, choices);
      if (!typeMap[t]) typeMap[t] = { type: t, minutes: 0, count: 0 };
      typeMap[t].minutes += min; typeMap[t].count += 1;
      var d = (e && e.date) || 'onbekend';
      if (!dateMap[d]) dateMap[d] = { date: d, minutes: 0, direct: 0, indirect: 0, unknown: 0, travel: 0, count: 0 };
      dateMap[d].minutes += min; dateMap[d].direct += di.directMin; dateMap[d].indirect += di.indirectMin; dateMap[d].unknown += di.unknownMin; dateMap[d].travel += di.travelMin; dateMap[d].count += 1;
    });
    var round = function (m) { return Math.round(m); };
    var byType = Object.keys(typeMap).map(function (k) { return { type: typeMap[k].type, minutes: round(typeMap[k].minutes), count: typeMap[k].count }; })
      .sort(function (a, b) { return b.minutes - a.minutes; });
    var byDate = Object.keys(dateMap).map(function (k) { var r = dateMap[k]; return { date: r.date, minutes: round(r.minutes), direct: round(r.direct), indirect: round(r.indirect), unknown: round(r.unknown), travel: round(r.travel), count: r.count }; })
      .sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
    var base = directMin + indirectMin;
    var directPct = base > 0 ? (directMin / base * 100) : 0;
    return {
      count: list.length,
      totalMinutes: round(totalMin), clientMinutes: round(clientMin), nonClientMinutes: round(nonClientMin),
      directMinutes: round(directMin), indirectMinutes: round(indirectMin), unknownMinutes: round(unknownMin), travelMinutes: round(travelMin),
      directPct: Math.round(directPct * 10) / 10, directTargetPct: 80,
      byType: byType, byDate: byDate
    };
  }

  // Welke tijd is declarabel voor dit bedrijfsonderdeel/profiel?
  //  - J&O/JBG: alleen DIRECTE tijd.
  //  - JGGZ (en overige): alle CLIËNTGEBONDEN tijd.
  function declarabiliteitBase(profile) {
    var p = String(profile || '');
    // Instelbaar in het beheerscherm: regels 'profiel bevat X -> direct|client'. Eerste
    // match wint; geen match -> cliëntgebonden.
    try {
      var rules = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && Array.isArray(APP_CONFIG.declarabiliteitRules)) ? APP_CONFIG.declarabiliteitRules : null;
      if (rules && rules.length) {
        var pl = p.toLowerCase();
        for (var i = 0; i < rules.length; i++) {
          var r = rules[i]; if (!r || !r.match) continue;
          if (pl.indexOf(String(r.match).toLowerCase()) !== -1) return (r.base === 'direct') ? 'direct' : 'client';
        }
        return 'client';
      }
    } catch (e) {}
    // Standaard (geen config): J&O/JBG -> alleen direct, anders cliëntgebonden.
    var up = p.toUpperCase();
    if (up.indexOf('J&O') !== -1 || up.indexOf('JBG') !== -1) return 'direct';
    return 'client';
  }
  // Declarabiliteit uit een summary (van planned óf registered): % declarabele tijd
  // van de totale tijd, plus het aantal minuten en de gebruikte grondslag.
  function declarabiliteitPct(summary, profile) {
    var base = declarabiliteitBase(profile);
    // J&O/JBG: alleen directe tijd. JGGZ: alle cliëntgebonden tijd (= cliënttijd, inclusief
    // reistijd, want reistijd valt onder cliënttijd).
    var declarabel = base === 'direct' ? ((summary && summary.directMinutes) || 0) : ((summary && summary.clientMinutes) || 0);
    var total = (summary && summary.totalMinutes) || 0;
    return {
      base: base,
      baseLabel: base === 'direct' ? 'directe tijd' : 'cliëntgebonden tijd',
      declarabelMinutes: declarabel,
      totalMinutes: total,
      pct: total > 0 ? Math.round(declarabel / total * 1000) / 10 : 0,
      targetPct: 80
    };
  }

  // ===== Afgeronde registraties (widget-endpoint van de sessie-gebruiker, per dag) =====
  // Anders dan de events/registrations-feed heeft dit endpoint per regel een 'type'
  // (direct/indirect/reistijd) + 'duration' in minuten -> de ECHTE directe/indirecte tijd.
  function _regUnwrap(json) {
    if (Array.isArray(json)) return json;
    if (json && typeof json === 'object') {
      var keys = ['data', 'registrations', 'items', 'results', 'content', 'rows'];
      for (var i = 0; i < keys.length; i++) if (Array.isArray(json[keys[i]])) return json[keys[i]];
      if (json.presenceLogs || json.type || json.duration != null || json.startTime) return [json]; // enkel object
    }
    return [];
  }
  // Platt de respons uit naar losse presence-log-regels. De endpoint geeft REGISTRATIES
  // met geneste 'presenceLogs' (duration in MINUTEN, type direct/indirect/travel); soms
  // zijn de items al losse regels. Het registratie-niveau (duration in seconden,
  // type 'registration') NEGEREN we bewust — dat gaf de 240u-fout.
  function _regFlattenLogs(json) {
    var items = _regUnwrap(json), logs = [];
    items.forEach(function (it) {
      if (it && Array.isArray(it.presenceLogs)) { it.presenceLogs.forEach(function (l) { if (l) logs.push(l); }); }
      else if (it && (it.type != null || it.duration != null) && it.type !== 'registration') { logs.push(it); }
    });
    return logs;
  }
  function _regType(t) {
    var s = String(t == null ? '' : t).toLowerCase();
    if (/indirect/.test(s)) return 'indirect';
    if (/direct/.test(s)) return 'direct';
    if (/travel|reis/.test(s)) return 'travel';
    return 'overig';
  }
  // Normaliseer één registratieregel — PRIVACY: geen cliëntnaam/bsn, alleen wel/niet cliënt.
  function normalizeRegistrationLine(r) {
    if (!r || typeof r !== 'object') return null;
    var start = r.startTime || r.start_time || null, end = r.endTime || r.end_time || null;
    var dur = (typeof r.duration === 'number') ? r.duration
      : (start && end ? Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60000)) : 0);
    return {
      type: _regType(r.type), minutes: dur,
      date: start ? String(start).slice(0, 10) : null,
      removed: !!r.isRemoved, status: r.status || null,
      clientPresent: !!(r.client && (r.client.id != null || r.client.externalId != null))
    };
  }
  function summarizeRegistrations(json) {
    var lines = _regFlattenLogs(json).map(normalizeRegistrationLine).filter(function (x) { return x && !x.removed; });
    var total = 0, direct = 0, indirect = 0, travel = 0, other = 0, clientMin = 0, nonClientMin = 0;
    lines.forEach(function (l) {
      total += l.minutes;
      if (l.type === 'direct') direct += l.minutes;
      else if (l.type === 'indirect') indirect += l.minutes;
      else if (l.type === 'travel') travel += l.minutes;
      else other += l.minutes;
      if (l.clientPresent) clientMin += l.minutes; else nonClientMin += l.minutes;
    });
    var base = direct + indirect;
    return {
      count: lines.length, totalMinutes: total,
      directMinutes: direct, indirectMinutes: indirect, travelMinutes: travel, otherMinutes: other,
      clientMinutes: clientMin, nonClientMinutes: nonClientMin,
      directPct: base > 0 ? Math.round(direct / base * 1000) / 10 : 0, directTargetPct: 80
    };
  }
  // Fetch de afgeronde registraties (sessie-gebruiker) voor één dag; gepagineerd.
  function fetchEmployeeRegistrations(date, opts) {
    opts = opts || {};
    var d = agendaYmd(date) || agendaYmd(new Date());
    var limit = opts.limit || 50, maxPages = opts.maxPages || 8, all = [];
    function page(offset, n) {
      var url = '/gateway/api/v0/agenda/user/widgets/employee_registrations_overview/registrations'
        + '?date=' + encodeURIComponent(d) + '&open=false&includeUnregistered=false&withoutClient=false'
        + '&offset=' + offset + '&limit=' + limit;
      return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) {
          var rows = _regUnwrap(j); all = all.concat(rows);
          if (rows.length >= limit && n + 1 < maxPages) return page(offset + limit, n + 1);
          return all;
        });
    }
    return page(0, 0).then(function (rows) { return summarizeRegistrations(rows); });
  }

  // ===== Declarabiliteit per WEEK via de calendar-registratie-endpoints =====
  // Werkt voor elke week die je in de agenda bekijkt, óók weken vóór deze.
  //  Stap 1: /calendar/invitee/{id}/entries/week?date=..&layer=registrations
  //          &sub_layers[]=registrations/created  -> registraties (occurrence_id) van die week.
  //  Stap 2: /calendar/invitee/{id}/registrations/{occurrence_id}/details
  //          -> direct_time/indirect_time/travel + hour_type. Gekoppeld op id.
  // PRIVACY: we lezen alleen occurrence_id, de tijden en de hour_type-naam (zorgsoort),
  // nooit cliëntnaam/bsn/geboortedatum (title/clients-namen worden genegeerd).
  // Zaterdag/zondag? Dan niet meetellen.
  function _isWeekendYmd(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (!m) return false;
    var wd = new Date(+m[1], +m[2] - 1, +m[3]).getDay();
    return wd === 0 || wd === 6;
  }
  // Instelbaar in het beheerscherm (generalSettings): weekenden meetellen ja/nee en
  // de markering waaraan een niet-cliënt uursoort te herkennen is (standaard '*').
  function _agGenSettings() { try { return (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.generalSettings) || {}; } catch (e) { return {}; } }
  function _countWeekends() { return !!_agGenSettings().countWeekends; }
  function _excludeWeekendYmd(ymd) { return _isWeekendYmd(ymd) && !_countWeekends(); }
  function _nonClientMarker() { var m = _agGenSettings().nonClientMarker; return (typeof m === 'string' && m) ? m : '*'; }
  // Extra (expliciete) lijst van niet-cliënt uursoorten uit het beheerscherm.
  function _agListSetting(key, dflt) { try { var v = _agGenSettings()[key]; if (Array.isArray(v)) return v; } catch (e) {} return dflt; }
  function _nonClientUursoortList() { return _agListSetting('nonClientUursoorten', []); }
  function _excludedStatuses() { return _agListSetting('excludedRegistrationStatuses', ['do_not_declare']); }
  function _excludedCalendarTypes() { return _agListSetting('excludedCalendarTypes', ['unavailability', 'presence']); }
  // Niet-cliënt-markeringen: standaard '*' én '#' (ONS gebruikt beide voor niet-cliënt/
  // speciale uursoorten), plus de in het beheerscherm ingestelde markering.
  function _nonClientMarkers() {
    var set = ['*', '#'];
    var mk = _nonClientMarker();
    if (mk && set.indexOf(mk) === -1) set.push(mk);
    return set;
  }
  // Cliëntgebonden uursoort = naam bevat GEEN niet-cliënt-markering en staat niet in de
  // expliciete niet-cliënt-lijst (beheerscherm).
  function _isClientUursoortName(name) {
    var s = String(name == null ? '' : name);
    var marks = _nonClientMarkers();
    for (var m = 0; m < marks.length; m++) { if (marks[m] && s.indexOf(marks[m]) !== -1) return false; }
    var low = s.toLowerCase();
    var list = _nonClientUursoortList();
    for (var i = 0; i < list.length; i++) { var n = String(list[i] || '').trim().toLowerCase(); if (n && low.indexOf(n) !== -1) return false; }
    return true;
  }
  // API-endpoint-sjablonen (instelbaar in het beheerscherm). ALLEEN relatieve, same-origin
  // paden zijn toegestaan (moeten met '/' beginnen) — zo blijft de garantie 'geen externe
  // calls' overeind. {var}-plaatshouders worden veilig ingevuld (encodeURIComponent).
  var _API_DEFAULTS = {
    weekEvents: '/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=events',
    weekRegistrations: '/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=registrations&sub_layers[]=registrations/created',
    registrationDetails: '/calendar/invitee/{inviteeId}/registrations/{occurrenceId}/details',
    searchClients: '/search_panel/clients?term={term}&usage=event&out_of_care={outOfCare}&page=1',
    productList: '/product_selection/product_list?date={date}&employee_ids[]={employeeId}&client_ids[]={clientId}'
  };
  function _apiTemplate(name) {
    try {
      var eps = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.apiEndpoints) || {};
      var t = eps[name];
      if (typeof t === 'string' && t.charAt(0) === '/') return t; // same-origin, relatief pad
    } catch (e) {}
    return _API_DEFAULTS[name];
  }
  function _apiUrl(name, vars) {
    vars = vars || {};
    return _apiTemplate(name).replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? encodeURIComponent(vars[k]) : m;
    });
  }
  function parseWeekRegistrationOccurrences(json) {
    var rows = _regUnwrap(json);
    if (!rows.length && json && Array.isArray(json.entries)) rows = json.entries;
    var out = [], seen = Object.create(null);
    var exTypes = _excludedCalendarTypes();
    rows.forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      // Uitgesloten calendar-items (beheerscherm; standaard afwezigheid + aanwezigheid).
      for (var x = 0; x < exTypes.length; x++) { if (r[exTypes[x]]) return; }
      if (r.type != null && String(r.type).toLowerCase() !== 'registration') return;
      var dymd = r.date || (r.start_time ? String(r.start_time).slice(0, 10) : '');
      if (_excludeWeekendYmd(dymd)) return; // geen weekenden (tenzij ingesteld)
      var occ = r.occurrence_id || r.occurrenceId || null;
      if (!occ || seen[occ]) return;
      seen[occ] = 1;
      out.push({ occurrenceId: String(occ), clientPresent: Array.isArray(r.clients) && r.clients.length > 0 });
    });
    return out;
  }
  // Detail-respons ({registration:{...}} of kaal) -> ALLEEN de niet-gevoelige velden.
  // PRIVACY (belangrijk): de detail-respons bevat óók cliënt-/medewerker-PII
  // (naam, bsn/identification_no, geboortedatum, adres, telefoon, e-mail, dossier-url,
  // declaration.on_date met een naam, enz.). Wij lezen daar BEWUST NIETS van: alleen
  // de tijden (getallen), de start/eind-timestamps en de hour_type-naam (zorgsoort,
  // geen persoonsgegeven). De rest van het JSON-object blijft onaangeroerd en wordt
  // meteen weggegooid (nergens opgeslagen, gelogd of verzonden).
  function parseRegistrationDetails(json) {
    if (!json || typeof json !== 'object') return null;
    // Andere calendar-items dan registraties uitsluiten (beheerscherm; standaard
    // afwezigheid 'unavailability' en aanwezigheid/locatie 'presence' zoals thuiswerken).
    // Die hebben een eigen wrapper en géén registratietijden -> nooit meetellen.
    if (!json.registration) { var exT = _excludedCalendarTypes(); for (var x = 0; x < exT.length; x++) { if (json[exT[x]]) return null; } }
    var r = json.registration ? json.registration : json;
    if (!r || typeof r !== 'object') return null;
    // Uitgesloten registratie-statussen (beheerscherm; standaard 'do_not_declare' = niet
    // declareren). We lezen alleen declaration.status (een enum, geen persoonsgegeven) —
    // nooit declaration.on_date (bevat een naam).
    if (r.declaration && typeof r.declaration === 'object' && r.declaration.status != null) {
      var st = String(r.declaration.status), exS = _excludedStatuses();
      for (var y = 0; y < exS.length; y++) { if (st === String(exS[y])) return null; }
    }
    // Weekenddatum defensief uitsluiten (naast de filter in de weeklijst).
    var dymd = r.date || (r.start_time ? String(r.start_time).slice(0, 10) : '');
    if (_excludeWeekendYmd(dymd)) return null;
    var num = function (v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; };
    var ht = (r.hour_type && typeof r.hour_type === 'object') ? r.hour_type : null;
    var htName = (ht && ht.name != null) ? String(ht.name) : '';
    var htId = (ht && ht.id != null) ? ht.id : null;
    // MULTI-CLIËNT: bij meerdere cliënten is het uursoort op registratie-niveau vaak null
    // en staat het PER CLIËNT onder clients[].hour_type. We lezen daar UITSLUITEND de
    // hour_type (zorgsoortnaam/id) — nooit naam/bsn/adres e.d. van de cliënt.
    if (!htName && Array.isArray(r.clients)) {
      for (var ci = 0; ci < r.clients.length; ci++) {
        var cht = r.clients[ci] && r.clients[ci].hour_type;
        if (cht && cht.name != null && String(cht.name).trim()) { htName = String(cht.name); if (htId == null && cht.id != null) htId = cht.id; break; }
      }
    }
    var direct = num(r.direct_time), indirect = num(r.indirect_time);
    var travel = num(r.travel_time_before) + num(r.travel_time_after);
    // Totale duur uit start/eind (of time_slot.duration in seconden). De niet-cliëntgebonden
    // tijd (pauze/overleg/overig/verplichte nevenactiviteiten) zit NIET in direct/indirect/
    // reis, maar is wél onderdeel van de duur -> anders telt die tijd niet mee.
    var durMin = 0;
    var st = r.start_time, et = r.end_time;
    if (st && et) { var ms = Date.parse(et) - Date.parse(st); if (isFinite(ms) && ms > 0) durMin = Math.round(ms / 60000); }
    if (!durMin && r.time_slot && typeof r.time_slot.duration === 'number') durMin = Math.round(r.time_slot.duration / 60);
    var accounted = direct + indirect + travel;
    var otherMin = Math.max(0, durMin - accounted); // niet-cliënt/overige tijd
    return {
      directMin: direct, indirectMin: indirect, travelMin: travel, otherMin: otherMin,
      durationMin: durMin || accounted,
      hourTypeName: htName,
      hourTypeId: htId
    };
  }
  // Aggregeer de detailregels tot een summary die declarabiliteitPct begrijpt.
  function summarizeWeekRegistrations(detailsList) {
    var direct = 0, indirect = 0, travel = 0, other = 0, count = 0, byType = Object.create(null);
    var n = function (v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; };
    (detailsList || []).forEach(function (d) {
      if (!d) return;
      var dir = n(d.directMin), ind = n(d.indirectMin), tra = n(d.travelMin), oth = n(d.otherMin);
      count++; direct += dir; indirect += ind; travel += tra; other += oth;
      var name = d.hourTypeName || 'Onbekend';
      // Per uursoort de opbouw bijhouden (direct/indirect/reistijd/overig).
      if (!byType[name]) byType[name] = { type: name, direct: 0, indirect: 0, travel: 0, other: 0 };
      byType[name].direct += dir; byType[name].indirect += ind; byType[name].travel += tra; byType[name].other += oth;
    });
    var clientMin = direct + indirect + travel;        // cliënttijd = direct + indirect + REISTIJD
    var nonClientMin = other;                          // niet-cliënt = pauze/overleg/overig (uursoorten met *)
    var total = direct + indirect + travel + other;    // totale geschreven tijd
    var byHourType = Object.keys(byType).map(function (k) {
      var r = byType[k]; r.minutes = r.direct + r.indirect + r.travel + r.other; return r;
    }).sort(function (a, b) { return b.minutes - a.minutes; });
    return {
      count: count, totalMinutes: total,
      directMinutes: direct, indirectMinutes: indirect, travelMinutes: travel, otherMinutes: other,
      unknownMinutes: other, // 4e verdeling-vak toont de niet-cliënt/overige tijd
      clientMinutes: clientMin, nonClientMinutes: nonClientMin,
      directPct: (direct + indirect) > 0 ? Math.round(direct / (direct + indirect) * 1000) / 10 : 0, directTargetPct: 80,
      byHourType: byHourType,
      byType: byHourType // per-uursoort opbouw; agendaWeekPanelEl toont .minutes
    };
  }
  // Ligt de bekeken week VOLLEDIG in de toekomst (maandag na vandaag)? Dan tonen we de
  // planning per afspraaktype. Anders (deze week of eerder) tonen we de echte registraties
  // per uursoort — zodat registraties die begin van de week al zijn gedaan óók verschijnen.
  function _agIsFutureWeek(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    var base = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(ymd || Date.now());
    if (isNaN(base.getTime())) return false;
    base.setHours(0, 0, 0, 0);
    var day = base.getDay() || 7;
    var monday = new Date(base); monday.setDate(base.getDate() - (day - 1)); monday.setHours(0, 0, 0, 0);
    var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    return monday.getTime() > todayStart.getTime();
  }
  // Is de bekeken week volledig vóór vandaag? Dan tonen we het verleden (echte registraties
  // per uursoort) i.p.v. de toekomstige planning per afspraaktype.
  function _agIsPastWeek(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    var base = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(ymd || Date.now());
    if (isNaN(base.getTime())) return false;
    base.setHours(0, 0, 0, 0);
    var day = base.getDay() || 7;                 // maandag = 1 ... zondag = 7
    var monday = new Date(base); monday.setDate(base.getDate() - (day - 1));
    var weekEndExclusive = new Date(monday); weekEndExclusive.setDate(monday.getDate() + 7);
    var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    return weekEndExclusive.getTime() <= todayStart.getTime();
  }
  // Kleine concurrency-pool: draait max 'limit' workers tegelijk (voorkomt tientallen
  // gelijktijdige detail-calls).
  function _mapPool(items, limit, worker) {
    return new Promise(function (resolve) {
      var results = new Array(items.length), i = 0, active = 0, done = 0;
      if (!items.length) { resolve(results); return; }
      function next() {
        while (active < limit && i < items.length) {
          var idx = i++; active++;
          Promise.resolve().then(function () { return worker(items[idx]); })
            .then(function (r) { results[idx] = r; }, function () { results[idx] = null; })
            .then(function () { active--; done++; if (done === items.length) resolve(results); else next(); });
        }
      }
      next();
    });
  }
  function fetchRegistrationDetails(inviteeId, occurrenceId) {
    var url = _apiUrl('registrationDetails', { inviteeId: inviteeId, occurrenceId: occurrenceId });
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(parseRegistrationDetails)
      .catch(function () { return null; });
  }
  var _weekRegCache = Object.create(null);
  function fetchWeekRegistrationDeclarabiliteit(inviteeId, date) {
    var d = agendaYmd(date) || agendaYmd(new Date());
    var cacheKey = inviteeId + '|' + d;
    var cached = _weekRegCache[cacheKey];
    if (cached && (Date.now() - cached.ts) < 120000) return Promise.resolve(cached.summary);
    var listUrl = _apiUrl('weekRegistrations', { inviteeId: inviteeId, date: d });
    return fetch(listUrl, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        var occs = parseWeekRegistrationOccurrences(j).slice(0, 200); // veiligheidsplafond
        return _mapPool(occs, 6, function (o) { return fetchRegistrationDetails(inviteeId, o.occurrenceId); });
      })
      .then(function (details) {
        var summary = summarizeWeekRegistrations(details.filter(Boolean));
        _weekRegCache[cacheKey] = { ts: Date.now(), summary: summary };
        return summary;
      });
  }
  // Kies de beste bron voor de declarabiliteit van de bekeken week: eerst de nauwkeurige
  // calendar-registratie-endpoints (per week, ook verleden), anders het widget-endpoint.
  function fetchDeclarabiliteitSummary(date) {
    return Promise.resolve().then(function () {
      var inviteeId = resolveInviteeId();
      if (inviteeId != null) return inviteeId;
      return getEmployeeIdAsync().catch(function () { return null; });
    }).then(function (inviteeId) {
      if (inviteeId != null) {
        return fetchWeekRegistrationDeclarabiliteit(inviteeId, date)
          .catch(function () { return fetchEmployeeRegistrations(date); });
      }
      return fetchEmployeeRegistrations(date);
    });
  }

  // ---- Weekoverzicht-paneel op de agenda (gebaseerd op de API-data) ----
  function _agFmtMin(min) {
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? (h + ' u' + (m ? ' ' + m + ' m' : '')) : (m + ' m');
  }
  var _AG_WKDAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  function _agDateLabel(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '')); if (!m) return String(ymd || '');
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return _AG_WKDAG[d.getDay()] + ' ' + (+m[3]) + '-' + (+m[2]);
  }
  // Datum ('YYYY-MM-DD') uit de huidige agenda-URL (?date=...), anders vandaag. Zo
  // ververst het overzicht mee met de week die de gebruiker bekijkt.
  function currentAgendaDate() {
    var m = /[?&]date=(\d{4}-\d{2}-\d{2})/.exec((location && (location.search || location.href)) || '');
    return m ? m[1] : agendaYmd(new Date());
  }
  // ISO-8601 weeknummer voor de titel ("week 36").
  function agendaWeekNumber(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    var d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(ymd || Date.now());
    if (isNaN(d.getTime())) return null;
    var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    var day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
  }
  // Kleine gekleurde chip (label + waarde).
  function _agChip(label, value, bg, fg) {
    var c = document.createElement('span');
    c.style.cssText = 'display:inline-flex;align-items:baseline;gap:4px;background:' + bg + ';color:' + fg + ';border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700;white-space:nowrap';
    c.innerHTML = '<span style="font-weight:600;opacity:.8">' + label + '</span> ' + value;
    return c;
  }
  // Klein statvak (voor de directe/indirecte/reistijd/onbekend-verdeling).
  function _agStat(label, value, fg) {
    var d = document.createElement('div');
    d.style.cssText = 'flex:1 1 46%;min-width:80px;background:#faf7f9;border:1px solid #f0e6ee;border-radius:8px;padding:5px 8px';
    d.innerHTML = '<div style="font-size:10px;color:#777;font-weight:600">' + label + '</div>' +
      '<div style="font-size:13px;font-weight:800;color:' + fg + '">' + value + '</div>';
    return d;
  }
  function _agSubTitle(text) {
    var h = document.createElement('div'); h.textContent = text;
    h.style.cssText = 'font-weight:700;font-size:11px;color:' + ONSAH_TOKENS.brand + ';text-transform:uppercase;letter-spacing:.03em;margin:10px 0 5px';
    return h;
  }
  // Groot statvak (voor de hoofd-splitsing cliënttijd vs niet-cliënttijd). Wit
  // met een gekleurde identiteitsrand links; `interactive` voegt een dunne
  // roze rand + chevron toe (klikbaar naar de opbouw-modal) en hover-lift.
  function _agBigStat(label, value, fg, interactive) {
    var T = ONSAH_TOKENS;
    var d = document.createElement('div');
    d.style.cssText = 'position:relative;flex:1 1 0;min-width:0;box-sizing:border-box;background:#fff;border:1px solid ' + (interactive ? T.brand : T.line) + ';border-radius:10px;padding:9px ' + (interactive ? '20px' : '11px') + ' 9px 14px;transition:transform .12s ease, box-shadow .12s ease';
    var edge = document.createElement('span');
    edge.style.cssText = 'position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:3px;background:' + fg;
    d.appendChild(edge);
    var l = document.createElement('div'); l.textContent = label;
    l.style.cssText = 'font-size:10px;font-weight:700;color:' + T.inkSoft + ';text-transform:uppercase;letter-spacing:.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    d.appendChild(l);
    var v = document.createElement('div'); v.textContent = value;
    v.style.cssText = 'font-size:16px;font-weight:800;color:' + fg + ';font-variant-numeric:tabular-nums;margin-top:1px';
    d.appendChild(v);
    if (interactive) {
      // Chevron als hoek-icoon i.p.v. inline naast de waarde: zo hoeft de
      // waarde (bv. "5 u 20 m") nooit samen met het icoon op één regel te
      // passen in een smalle tegel, en blijft de tegel compact.
      var chev = svgIcon('M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z');
      chev.setAttribute('width', '12'); chev.setAttribute('height', '12');
      chev.style.cssText = 'position:absolute;right:8px;top:10px;width:12px;height:12px;color:' + T.brand;
      d.appendChild(chev);
      d.addEventListener('mouseenter', function () { d.style.transform = 'translateY(-1px)'; d.style.boxShadow = '0 4px 12px -6px rgba(32,20,15,.25)'; });
      d.addEventListener('mouseleave', function () { d.style.transform = 'none'; d.style.boxShadow = 'none'; });
    }
    return d;
  }
  // Bouwt het overzicht-paneel (DOM) uit een summarizeAgendaWeek-resultaat.
  function agendaWeekPanelEl(summary, opts) {
    opts = opts || {};
    var s = summary || { count: 0, totalMinutes: 0, clientMinutes: 0, nonClientMinutes: 0, directMinutes: 0, indirectMinutes: 0, unknownMinutes: 0, travelMinutes: 0, directPct: 0, directTargetPct: 80, byType: [], byDate: [] };
    var box = document.createElement('div'); box.setAttribute('data-ons-week-panel', '1');
    box.style.cssText = 'font-size:12px;color:#222';
    var scopeLabel = (opts.scope === 'dag' ? 'Dagoverzicht' : 'Weekoverzicht');
    var titleText = scopeLabel + (opts.week ? ', week ' + opts.week : '');
    if (opts.embedded) {
      var t0 = document.createElement('div');
      t0.textContent = titleText + ' ';
      var hintEl = document.createElement('span');
      hintEl.textContent = '· ' + (opts.headerHint || 'indicatief');
      hintEl.style.cssText = 'font-weight:400;color:#999;font-size:10px';
      t0.appendChild(hintEl);
      t0.style.cssText = 'font-weight:700;font-size:13px;color:#cc087d;margin-bottom:8px';
      box.appendChild(t0);
    } else {
      var head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px';
      var title = document.createElement('div'); title.textContent = titleText;
      title.style.cssText = 'font-weight:700;font-size:14px;color:#cc087d';
      var close = document.createElement('button'); close.type = 'button'; close.textContent = '×';
      close.title = 'Sluiten'; close.style.cssText = 'border:0;background:transparent;font-size:18px;line-height:1;cursor:pointer;color:#666';
      close.addEventListener('click', function () { var p = document.getElementById('onsAgendaWeekPanel'); if (p) p.remove(); });
      head.append(title, close); box.appendChild(head);
    }

    // 1) Hoofd-splitsing: cliënttijd (KLIK = opbouw in een modal) vs niet-cliënttijd.
    // Zo blijft het paneel kort; de opbouw direct/indirect/reistijd/overig staat in de modal.
    var split = document.createElement('div');
    split.style.cssText = 'display:flex;gap:6px;margin-bottom:5px';
    var clientBox = _agBigStat('Cliënttijd', _agFmtMin(s.clientMinutes), '#166a37', true);
    clientBox.style.cursor = 'pointer';
    clientBox.title = 'Klik voor de opbouw (direct / indirect / reistijd / overig)';
    clientBox.addEventListener('click', function () { try { showAgendaBreakdownModal(s, opts); } catch (e) {} });
    split.append(clientBox, _agBigStat('Niet-cliënttijd', _agFmtMin(s.nonClientMinutes), '#6b6367'));
    box.appendChild(split);
    var tot = document.createElement('div');
    tot.style.cssText = 'font-size:11px;color:#6b6367;font-weight:600;margin:0 0 8px;font-variant-numeric:tabular-nums';
    tot.textContent = 'Totaal: ' + _agFmtMin(s.totalMinutes);
    box.appendChild(tot);

    // 2) Per afspraaktype (planning) of per uursoort (registraties). Cliëntgebonden uursoorten
    // tonen we; niet-cliënt (* of #) staan onder een inklapbare 'Overig'.
    box.appendChild(_agSubTitle(opts.perLabel || 'Per afspraaktype'));
    var allRows = s.byType || [];
    var clientRows = [], overigRows = [];
    allRows.forEach(function (r) { if (r && r.type && !_isClientUursoortName(r.type)) overigRows.push(r); else clientRows.push(r); });
    box.appendChild(_agBarList(clientRows));
    if (overigRows.length) box.appendChild(_agCollapsibleOverig(overigRows));

    // 5) Knop: "Hoe is dit berekend?" -> apart scherm met de daadwerkelijke cijfers.
    var calcBtn = document.createElement('button');
    calcBtn.type = 'button';
    calcBtn.textContent = 'Verhouding per uursoort';
    calcBtn.style.cssText = 'display:block;width:100%;margin-top:10px;padding:7px 10px;border:1px solid #cc087d;border-radius:8px;background:#fff;color:#cc087d;font-weight:700;font-size:12px;cursor:pointer';
    calcBtn.addEventListener('click', function () { try { showAgendaCalcModal(s, opts); } catch (e) {} });
    box.appendChild(calcBtn);

    // 6) Link naar de declarabiliteit-berekening (op de /registrations-pagina).
    if (opts.embedded) {
      var link = document.createElement('a');
      link.textContent = 'Bekijk declarabiliteit →';
      try { link.href = (location.origin || '') + '/registrations?date=' + encodeURIComponent(opts.date || currentAgendaDate()); } catch (e) { link.href = '/registrations'; }
      link.style.cssText = 'display:inline-block;margin-top:8px;color:#cc087d;text-decoration:underline;font-size:12px;font-weight:700';
      box.appendChild(link);
    }
    return box;
  }
  // Inklapbare 'Overig'-sectie met de niet-cliënt uursoorten (* of #). Standaard dicht.
  function _agCollapsibleOverig(rows) {
    var T = ONSAH_TOKENS;
    var wrap = document.createElement('div');
    var total = rows.reduce(function (a, r) { return a + (r.minutes || 0); }, 0);
    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:700;font-size:11px;color:' + T.brand + ';margin:10px 0 5px;padding:2px 0;user-select:none;transition:opacity .1s ease';
    var chev = svgIcon('M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z');
    chev.setAttribute('width', '12'); chev.setAttribute('height', '12');
    chev.style.cssText = 'width:12px;height:12px;flex:0 0 auto;transition:transform .15s ease';
    var lbl = document.createElement('span'); lbl.textContent = 'Overig (' + rows.length + ')'; lbl.style.flex = '1 1 auto'; lbl.style.textTransform = 'uppercase'; lbl.style.letterSpacing = '.03em';
    var tm = document.createElement('span'); tm.textContent = _agFmtMin(total); tm.style.cssText = 'font-weight:800;color:' + T.ink + ';font-variant-numeric:tabular-nums';
    head.append(chev, lbl, tm);
    var body = document.createElement('div'); body.style.display = 'none';
    body.appendChild(_agBarList(rows));
    var open = false;
    head.addEventListener('click', function () {
      open = !open;
      body.style.display = open ? 'block' : 'none';
      chev.style.transform = open ? 'rotate(90deg)' : 'none';
    });
    head.addEventListener('mouseenter', function () { head.style.opacity = '.7'; });
    head.addEventListener('mouseleave', function () { head.style.opacity = '1'; });
    wrap.append(head, body);
    return wrap;
  }
  // Eén gedeelde modal-schil (spine + kop + sluitknop + Esc/klik-buiten) voor
  // alle onderbrekende dialogen. Voorheen bouwden de twee modals hieronder
  // deze schil allebei apart, bijna letterlijk gelijk.
  function mkModalShell(id, titleText, opts) {
    opts = opts || {};
    var old = document.getElementById(id); if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(20,15,13,.5);display:flex;align-items:center;justify-content:center;padding:16px';
    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;color:#201d1f;max-width:' + (opts.maxWidth || '420px') + ';width:100%;max-height:calc(100vh - 40px);border-radius:20px;box-shadow:0 24px 64px rgba(20,15,13,.4);font:13px/1.45 system-ui,sans-serif;overflow:hidden;display:flex';
    var spine = document.createElement('div');
    spine.style.cssText = 'width:14px;flex:0 0 auto;background:' + (opts.spineColor || '#cc087d') + ';';
    var mainCol = document.createElement('div');
    mainCol.style.cssText = 'flex:1 1 auto;min-width:0;display:flex;flex-direction:column;overflow:auto';
    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid #f1ecea;position:sticky;top:0;background:#fff';
    var htitle = document.createElement('div'); htitle.textContent = titleText;
    htitle.style.cssText = 'font-weight:800;font-size:15px;color:#201d1f';
    var close = document.createElement('button'); close.type = 'button';
    close.setAttribute('aria-label', 'Sluiten');
    close.style.cssText = 'border:1px solid #ece7e5;background:#f6f2f0;color:#6b6367;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;flex:0 0 auto';
    close.appendChild(svgCloseIcon());
    onsahFocusRing(close);
    head.append(htitle, close); mainCol.appendChild(head);
    var body = document.createElement('div'); body.style.cssText = 'padding:14px 16px'; mainCol.appendChild(body);
    card.appendChild(spine); card.appendChild(mainCol);
    overlay.appendChild(card);
    var closeModal = function () { overlay.remove(); document.removeEventListener('keydown', onKey); };
    function onKey(e) { if (e.key === 'Escape') closeModal(); }
    document.addEventListener('keydown', onKey);
    close.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    (document.body || document.documentElement).appendChild(overlay);
    return { overlay: overlay, body: body, close: closeModal };
  }
  // Modal met de tijd-OPBOUW (geopend door op de Cliënttijd-kaart te klikken).
  function showAgendaBreakdownModal(s, opts) {
    opts = opts || {}; s = s || {};
    var fmt = _agFmtMin;
    var shell = mkModalShell('onsAgendaBreakdownModal', 'Waar de tijd uit bestaat' + (opts.week ? ', week ' + opts.week : ''));
    var body = shell.body;
    function row(label, val, opt) {
      opt = opt || {};
      var r = document.createElement('div');
      r.style.cssText = 'display:flex;justify-content:space-between;gap:10px;padding:4px 0' + (opt.top ? '' : ';border-bottom:1px dotted #eee') + (opt.strong ? ';font-weight:800' : '') + (opt.indent ? ';padding-left:12px' : '');
      var a = document.createElement('span'); a.textContent = label; a.style.color = opt.strong ? '#166a37' : '#333';
      var b = document.createElement('span'); b.textContent = val; b.style.cssText = 'font-variant-numeric:tabular-nums;white-space:nowrap';
      r.append(a, b); return r;
    }
    body.appendChild(row('Cliënttijd', fmt(s.clientMinutes), { strong: true }));
    body.appendChild(row('Direct', fmt(s.directMinutes), { indent: true }));
    body.appendChild(row('Indirect', fmt(s.indirectMinutes), { indent: true }));
    body.appendChild(row('Reistijd', fmt(s.travelMinutes), { indent: true }));
    var oth = (s.unknownMinutes != null ? s.unknownMinutes : (s.otherMinutes || 0));
    body.appendChild(row('Niet-cliënttijd (' + (opts.unknownLabel || 'overig').toLowerCase() + ')', fmt(oth), { strong: true }));
    body.appendChild(row('Totaal', fmt(s.totalMinutes), { strong: true }));
  }
  // Apart scherm (overlay) dat laat zien HOE de cijfers zijn opgebouwd — met de
  // daadwerkelijke minuten. Puur getallen/labels uit de summary; geen cliënt-PII.
  function showAgendaCalcModal(s, opts) {
    opts = opts || {}; s = s || {};
    var registered = (opts.headerHint === 'geregistreerd');
    var fmt = _agFmtMin;
    var shell = mkModalShell('onsAgendaCalcModal', 'Verhouding per uursoort' + (opts.week ? ', week ' + opts.week : ''), { maxWidth: '460px' });
    var body = shell.body;

    function note(t) { var e = document.createElement('div'); e.textContent = t; e.style.cssText = 'color:#777;font-size:11px;margin:3px 0 0'; return e; }
    body.appendChild(note('Verhouding direct / indirect / reistijd per cliëntgebonden uursoort. Niet-cliënturen (met "' + _nonClientMarker() + '") tellen hier niet mee.'));

    // Alleen cliëntgebonden uursoorten: uursoorten met de niet-cliënt-markering (beheerscherm,
    // standaard '*') eruit filteren.
    var rows = (s.byType || []).filter(function (r) { return r && r.type && _isClientUursoortName(r.type); });
    // Alleen tonen als we de opbouw (direct/indirect/reistijd) per uursoort hebben.
    var hasSplit = rows.some(function (r) { return (r.direct != null) || (r.indirect != null) || (r.travel != null); });

    if (!rows.length) {
      body.appendChild(note('Geen cliëntgebonden uursoorten in deze week.'));
    } else if (!hasSplit) {
      // Terugval (bv. planning): alleen minuten per uursoort.
      rows.forEach(function (r) {
        var line = document.createElement('div');
        line.style.cssText = 'display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px dotted #eee';
        var a = document.createElement('span'); a.textContent = r.type; a.style.cssText = 'color:#333';
        var b = document.createElement('span'); b.textContent = fmt(r.minutes); b.style.cssText = 'font-weight:700;font-variant-numeric:tabular-nums';
        line.append(a, b); body.appendChild(line);
      });
    } else {
      // ONS Agenda-kleuren (pastel): groen=direct, geel=indirect, blauw=reistijd.
      var C = { direct: '#B5F4BB', indirect: '#FFE1B5', travel: '#CAE9FC' };
      rows.forEach(function (r) {
        var d = r.direct || 0, i = r.indirect || 0, t = r.travel || 0;
        var sum = d + i + t; if (sum <= 0) return;
        var block = document.createElement('div'); block.style.cssText = 'margin:12px 0 6px';
        // Kop: naam + totaal cliënttijd.
        var top = document.createElement('div'); top.style.cssText = 'display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:4px';
        var nm = document.createElement('span'); nm.textContent = r.type; nm.style.cssText = 'font-weight:700;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        var tot = document.createElement('span'); tot.textContent = fmt(sum); tot.style.cssText = 'font-weight:700;white-space:nowrap;color:#222';
        top.append(nm, tot); block.appendChild(top);
        // Dikke, gestapelde verhoudingsbalk (100% breed = de interne verhouding),
        // met het percentage IN de kleur.
        // Donkere balk-achtergrond geeft hoog contrast met de pastel-segmenten.
        var bar = document.createElement('div'); bar.style.cssText = 'display:flex;height:26px;border-radius:6px;overflow:hidden;background:#1f2937';
        [['direct', d], ['indirect', i], ['travel', t]].forEach(function (seg) {
          if (seg[1] <= 0) return;
          var pct = Math.round(seg[1] / sum * 100);
          var sd = document.createElement('div');
          // Donkere tekst op de lichte pastel-segmenten (hoog contrast, leesbaar).
          sd.style.cssText = 'height:100%;width:' + (seg[1] / sum * 100) + '%;background:' + C[seg[0]]
            + ';display:flex;align-items:center;justify-content:center;color:#14202b;font-weight:800;font-size:12px;overflow:hidden';
          if (pct >= 8) sd.textContent = pct + '%'; // te smal segment: geen tekst
          bar.appendChild(sd);
        });
        block.appendChild(bar);
        // Legenda met de cijfers (u:m) onder de balk.
        var leg = document.createElement('div'); leg.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:#555;margin-top:4px';
        function chip(label, val, col) {
          var sp = document.createElement('span'); sp.style.cssText = 'display:inline-flex;align-items:center;gap:5px';
          var dot = document.createElement('span'); dot.style.cssText = 'width:10px;height:10px;border-radius:3px;border:1px solid rgba(0,0,0,.18);background:' + col;
          var tx = document.createElement('span'); tx.textContent = label + ' ' + fmt(val); tx.style.fontWeight = '600';
          sp.append(dot, tx); return sp;
        }
        leg.append(chip('Direct', d, C.direct), chip('Indirect', i, C.indirect), chip('Reistijd', t, C.travel));
        block.appendChild(leg);
        body.appendChild(block);
      });
    }
  }
  // Lijst met mini-balken, gesorteerd (langste bovenaan) — schaalt op het grootste item.
  function _agBarList(rows) {
    var T = ONSAH_TOKENS;
    var wrap = document.createElement('div');
    if (!rows.length) { wrap.textContent = 'Geen gegevens'; wrap.style.cssText = 'color:' + T.inkSoft + ';font-size:12px'; return wrap; }
    var max = rows.reduce(function (m, r) { return Math.max(m, r.minutes || 0); }, 0) || 1;
    rows.forEach(function (r) {
      var row = document.createElement('div'); row.style.cssText = 'margin:0 0 6px';
      var top = document.createElement('div'); top.style.cssText = 'display:flex;justify-content:space-between;gap:8px;font-size:12px';
      var a = document.createElement('span'); a.textContent = r.type; a.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + (r.type === 'Niet-gedefinieerd' ? T.inkSoft : T.ink);
      var b = document.createElement('span'); b.textContent = _agFmtMin(r.minutes); b.style.cssText = 'font-weight:700;white-space:nowrap;color:' + T.ink + ';font-variant-numeric:tabular-nums';
      top.append(a, b); row.appendChild(top);
      var track = document.createElement('div'); track.style.cssText = 'height:5px;border-radius:3px;background:' + T.line + ';overflow:hidden;margin-top:2px';
      var fl = document.createElement('div'); fl.style.cssText = 'height:100%;width:' + Math.max(3, Math.round((r.minutes || 0) / max * 100)) + '%;background:' + (r.type === 'Niet-gedefinieerd' ? '#c7bfbc' : T.brand);
      track.appendChild(fl); row.appendChild(track);
      wrap.appendChild(row);
    });
    return wrap;
  }
  // Sectie 'Afgerond (geregistreerd)' — de ECHTE directe/indirecte/reistijd uit de
  // registratie-widget (sessie-gebruiker, per dag).
  function agendaRegistrationsSectionEl(rs, dateLabel, profile) {
    var wrap = document.createElement('div'); wrap.style.cssText = 'margin-top:10px;border-top:2px solid #f0e0ea;padding-top:8px';
    var h = document.createElement('div');
    h.innerHTML = 'Afgerond · geregistreerd' + (dateLabel ? ' <span style="font-weight:400;color:#999;font-size:10px">· ' + dateLabel + '</span>' : '');
    h.style.cssText = 'font-weight:700;font-size:11px;color:#8a4a70;text-transform:uppercase;letter-spacing:.03em;margin-bottom:5px';
    wrap.appendChild(h);
    if (!rs || !rs.count) {
      var none = document.createElement('div'); none.textContent = 'Nog niets geregistreerd in deze week.';
      none.style.cssText = 'color:#888;font-size:12px'; wrap.appendChild(none); return wrap;
    }
    // Declarabiliteit uit de ECHTE geregistreerde tijd (profielafhankelijk), in u:m.
    var dec = declarabiliteitPct(rs, profile);
    var hero = document.createElement('div');
    hero.innerHTML = '<span style="font-size:18px;font-weight:800;color:#166a37">' + _agFmtMin(dec.declarabelMinutes) + ' <span style="font-size:11px;font-weight:700;color:#777">declarabel</span></span>' +
      ' <span style="font-size:10px;color:#999">· ' + dec.baseLabel + '</span>';
    hero.style.cssText = 'margin-bottom:5px'; wrap.appendChild(hero);
    var chips = document.createElement('div'); chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
    chips.append(
      _agChip('Totaal', _agFmtMin(rs.totalMinutes), '#fbe4f1', '#a1005f'),
      _agChip('Direct', _agFmtMin(rs.directMinutes), '#e6f4ea', '#166a37'),
      _agChip('Indirect', _agFmtMin(rs.indirectMinutes), '#fff2df', '#8a5a00'),
      _agChip('Reistijd', _agFmtMin(rs.travelMinutes), '#e7edf7', '#3457a5')
    );
    wrap.appendChild(chips);
    return wrap;
  }
  // (Het weekoverzicht wordt getoond ín de agendahulp-panel; zie de agenda-module
  // hieronder — geen los paneel en geen popup-knop meer.)

  function effectiveTextConfig(key) {
    return ((APP_CONFIG.texts || {})[key]) || {};
  }
  function refreshEffectiveConfig() {
    try { CONFIG.choices = effectiveChoices(); } catch (e) {}
    try { REGISTRATION_CHOICES = buildRegistrationChoices(); } catch (e) {}
  }
  // Pas een 'helperConfig'-override toe (per sectie volledige vervanging).
  function applyHelperConfig(hc) {
    if (!hc || typeof hc !== 'object') return;
    if (Array.isArray(hc.choices)) APP_CONFIG.choices = hc.choices;
    if (Array.isArray(hc.extraKnownLabels)) APP_CONFIG.extraKnownLabels = hc.extraKnownLabels;
    if (Array.isArray(hc.registrationForms)) APP_CONFIG.registrationForms = hc.registrationForms;
    if (hc.zoneProfiles && typeof hc.zoneProfiles === 'object') APP_CONFIG.zoneProfiles = hc.zoneProfiles;
    if (hc.profileSectors && typeof hc.profileSectors === 'object') APP_CONFIG.profileSectors = hc.profileSectors;
    if (hc.palette && typeof hc.palette === 'object') APP_CONFIG.palette = hc.palette;
    if (hc.texts && typeof hc.texts === 'object') APP_CONFIG.texts = Object.assign({}, APP_CONFIG.texts, hc.texts);
    if (hc.compatibility && typeof hc.compatibility === 'object') APP_CONFIG.compatibility = hc.compatibility;
    if (hc.features && typeof hc.features === 'object') APP_CONFIG.features = Object.assign({}, APP_CONFIG.features, hc.features);
    if (Array.isArray(hc.nonClientCategories)) APP_CONFIG.nonClientCategories = hc.nonClientCategories;
    if (hc.generalSettings && typeof hc.generalSettings === 'object') APP_CONFIG.generalSettings = Object.assign({}, APP_CONFIG.generalSettings, hc.generalSettings);
    if (hc.apiEndpoints && typeof hc.apiEndpoints === 'object') APP_CONFIG.apiEndpoints = Object.assign({}, APP_CONFIG.apiEndpoints, hc.apiEndpoints);
    if (Array.isArray(hc.declarabiliteitRules)) APP_CONFIG.declarabiliteitRules = hc.declarabiliteitRules;
    if (hc.support && typeof hc.support === 'object') APP_CONFIG.support = Object.assign({}, APP_CONFIG.support, hc.support);
    if (hc.activation && typeof hc.activation === 'object') {
      APP_CONFIG.activation = Object.assign({}, APP_CONFIG.activation, hc.activation);
      if (APP_CONFIG.activation.appointmentNeedle) CONFIG.urlNeedle = APP_CONFIG.activation.appointmentNeedle;
      if (APP_CONFIG.activation.registrationNeedle) CONFIG.registrationNeedle = APP_CONFIG.activation.registrationNeedle;
    }
    if (hc.rollout && typeof hc.rollout === 'object') {
      APP_CONFIG.rollout = Object.assign({}, APP_CONFIG.rollout, hc.rollout);
      try { if (window.OnsAgendahulp && window.OnsAgendahulp.setRollout) window.OnsAgendahulp.setRollout(APP_CONFIG.rollout); } catch (e) {}
    }
    if (hc.uiSelectors && typeof hc.uiSelectors === 'object') { APP_CONFIG.uiSelectors = Object.assign({}, APP_CONFIG.uiSelectors, hc.uiSelectors); try { seedUiOverridesFromConfig(); } catch (e) {} }
    // Afgeleide lijst (tabel 3) opnieuw opbouwen.
    refreshEffectiveConfig();
    try { if (typeof syncWithUrl === 'function') syncWithUrl(); } catch (e) {}
    try { if (typeof onHelperConfigChanged === 'function') onHelperConfigChanged(); } catch (e) {}
  }
  // Omgeving (tenant/test/prod) uit de hostname — voor diagnose en
  // om te bepalen of we op een ONS-omgeving draaien, zonder hardcoded domein.
  function onsEnvironment() {
    try { return String(location.hostname.split('.')[0] || ''); } catch (e) { return ''; }
  }
  // Context zoals gedetecteerd door de main-world brug (modules.js): { environment, userId, url }.
  function onsContext() {
    try { return window.__onsHelperContext || { environment: onsEnvironment(), userId: '', url: location.href }; } catch (e) { return { environment: onsEnvironment(), userId: '', url: '' }; }
  }
  // Instelbaar meldkanaal (TOPdesk) uit de config; met veilige fallback.
  function supportTopdeskUrl() {
    try {
      const u = APP_CONFIG.support && APP_CONFIG.support.topdeskUrl;
      if (u && /^https?:\/\//i.test(u)) return u;
    } catch (e) {}
    return 'https://impegno.topdesk.net/';
  }
  // Haak die de agenda-inkleuring laat verversen na een config-wijziging.
  let onHelperConfigChanged = null;
  // Bouw een gestileerd tekst-element uit de beheerbare 'texts'-config. `key`
  // bepaalt welke instelling geldt; fallbackText/defaultStyle zijn de code-standaard.
  function managedRichHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const allowed = new Set(['B','STRONG','I','EM','U','S','STRIKE','A','MARK','FONT','BR','P','DIV','SPAN','H2','H3','H4','BLOCKQUOTE','PRE','CODE','UL','OL','LI']);
    template.content.querySelectorAll('script,style,iframe,object,embed,img,svg,form,input,button,link,meta,base,template,noscript,math,frame,frameset,marquee,title').forEach((el) => el.remove());
    template.content.querySelectorAll('*').forEach((el) => {
      if (!allowed.has(el.tagName)) { el.replaceWith(...el.childNodes); return; }
      const originalHref = el.tagName === 'A' ? String(el.getAttribute('href') || '') : '';
      const originalColor = el.tagName === 'FONT' ? String(el.getAttribute('color') || '') : '';
      const originalStyle = {
        color: el.style.color || originalColor,
        backgroundColor: el.style.backgroundColor,
        fontWeight: el.style.fontWeight,
        fontStyle: el.style.fontStyle,
        textDecoration: el.style.textDecoration
      };
      [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
      if (el.tagName === 'A' && /^(?:https?:\/\/|mailto:|#)/i.test(originalHref)) {
        el.setAttribute('href', originalHref);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
      const styleProbe = document.createElement('span').style;
      ['color','backgroundColor','fontWeight','fontStyle','textDecoration'].forEach((prop) => {
        const value = String(originalStyle[prop] || '').trim();
        if (!value) return;
        styleProbe[prop] = '';
        styleProbe[prop] = value;
        if (styleProbe[prop]) el.style[prop] = styleProbe[prop];
      });
      if (el.tagName === 'A') {
        if (!el.style.color) el.style.color = '#cc087d';
        if (!el.style.textDecoration) el.style.textDecoration = 'underline';
      }
    });
    return template.content;
  }
  function managedTagClientName() {
    try { if (typeof findClientNameText === 'function') { const found=findClientNameText();if(found)return found; } } catch (e) {}
    try { if (typeof findClientEntries === 'function') { const entries=findClientEntries();if(entries&&entries[0]&&entries[0].name)return entries[0].name; } } catch (e) {}
    const selectors='[data-invitee-name],[data-client-name],[data-testid="client-details-name"],[data-testid="client-name"],.client-name';
    const nodes=typeof deepQueryAll==='function'?deepQueryAll(selectors):Array.from(document.querySelectorAll(selectors));
    for(const node of nodes){const raw=(node.getAttribute&&((node.getAttribute('data-invitee-name')||node.getAttribute('data-client-name'))))||node.textContent||'';const name=String(raw).replace(/\s+/g,' ').trim();if(name&&name.length<=100)return name;}
    return '';
  }
  function managedTagClientAge() {
    const selectors='[data-testid="client-details-birthdate"],[data-date-of-birth],[data-birthdate],[class*="birthdate" i],[class*="geboorte" i]';
    const nodes=typeof deepQueryAll==='function'?deepQueryAll(selectors):Array.from(document.querySelectorAll(selectors));
    for(const node of nodes){const raw=[node.textContent,node.getAttribute&&node.getAttribute('data-date-of-birth'),node.getAttribute&&node.getAttribute('data-birthdate'),node.getAttribute&&node.getAttribute('aria-label'),node.getAttribute&&node.getAttribute('title')].filter(Boolean).join(' ');const direct=raw.match(/\((\d{1,3})\s*jaar\)|\bleeftijd\s*[:\-]?\s*(\d{1,3})\b/i);if(direct){const age=parseInt(direct[1]||direct[2],10);if(age>=0&&age<=125)return age;}const dob=raw.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);if(dob){const born=new Date(+dob[3],+dob[2]-1,+dob[1]),now=new Date();let age=now.getFullYear()-born.getFullYear();if(now.getMonth()<born.getMonth()||(now.getMonth()===born.getMonth()&&now.getDate()<born.getDate()))age--;if(age>=0&&age<=125)return age;}}
    return null;
  }
  function managedTagValues() { return { clientNaam:managedTagClientName(), clientLeeftijd:managedTagClientAge() }; }
  function replaceManagedTagsIn(root) {
    const values=managedTagValues();
    const replace=(text)=>String(text||'').replace(/\{clientNaam\}/gi,values.clientNaam||'{clientNaam}').replace(/\{clientLeeftijd\}/gi,values.clientLeeftijd==null?'{clientLeeftijd}':String(values.clientLeeftijd));
    const walk=(node)=>{if(node.nodeType===3){node.nodeValue=replace(node.nodeValue);return;}Array.from(node.childNodes||[]).forEach(walk);};walk(root);return root;
  }
  function mkText(key, fallbackText, defaultStyle) {
    const el = document.createElement('div');
    const c = APP_CONFIG.features && APP_CONFIG.features.managedTexts === false ? {} : effectiveTextConfig(key);
    if (c.html) el.appendChild(managedRichHtml(c.html).cloneNode(true));
    else el.textContent = (c.text != null && c.text !== '') ? c.text : fallbackText;
    replaceManagedTagsIn(el);
    el.style.whiteSpace = 'pre-wrap';
    if (defaultStyle) Object.assign(el.style, defaultStyle);
    if (c.color) el.style.color = c.color;
    if (c.bold === true) el.style.fontWeight = '700'; else if (c.bold === false) el.style.fontWeight = '400';
    if (c.italic === true) el.style.fontStyle = 'italic'; else if (c.italic === false) el.style.fontStyle = 'normal';
    if (c.sizePx) el.style.fontSize = (parseInt(c.sizePx, 10) || 13) + 'px';
    return el;
  }
  function resolveText(key) { return APP_CONFIG.features && APP_CONFIG.features.managedTexts === false ? null : effectiveTextConfig(key); }
  // (B) Gebundelde config.json uit de extensiemap inlezen — HET bestand dat je
  // vervangt om de configuratie aan te passen. Volgorde: standaard < config.json
  // < storage/beleid.
  function loadBundledConfig() {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) return Promise.resolve();
      const url = chrome.runtime.getURL('config.json');
      return fetch(url).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (obj) {
        if (obj) {
          const cfg = obj.helperConfig ? obj.helperConfig : obj; applyHelperConfig(cfg);
          const features = cfg.features || {};
          if (typeof features.appointmentAssistant === 'boolean') RUNTIME_CONFIG.appointmentHelperEnabled = features.appointmentAssistant;
          if (typeof features.registrationAssistant === 'boolean') RUNTIME_CONFIG.registrationHelperEnabled = features.registrationAssistant;
        }
      }).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }

  // Build-scope: bepaalt welke hulp deze bouw activeert.
  //   'all'           -> afspraak- én registratiehulp (volledige extensie)
  //   'events'        -> alleen afspraakhulp
  //   'registrations' -> alleen registratiehulp
  // Wordt per pakket via de build vervangen (zoals de versie in manifest.json).
  const HELPER_SCOPE = 'all';

  // (#2 uitrol) Centrale kill-switch/config die IT via beleid kan zetten
  // (chrome.storage.managed, schema in managed_schema.json). Fail-open: alles
  // staat aan tenzij het beleid een vlag expliciet op false zet. Een lokale
  // override (chrome.storage.local.onsHelperConfig) is handig voor tests.
  //   enabled                    -> hoofdschakelaar (afspraak+registratie)
  //   appointmentHelperEnabled   -> afspraakhulp
  //   registrationHelperEnabled  -> registratiehulp
  const RUNTIME_CONFIG = { enabled: true, appointmentHelperEnabled: true, registrationHelperEnabled: true };
  // Test-hook: alleen actief als window.__ONS_EXPOSE_FOR_TEST vooraf is gezet.
  // Stelt geselecteerde interne functies bloot op window.__onsHelperTestApi voor
  // de jsdom-tests. Nul effect in productie (vlag staat daar niet).
  function __exposeForTest(map) {
    try {
      if (typeof window === 'undefined' || !window.__ONS_EXPOSE_FOR_TEST) return;
      window.__onsHelperTestApi = window.__onsHelperTestApi || {};
      for (const k in map) if (Object.prototype.hasOwnProperty.call(map, k)) window.__onsHelperTestApi[k] = map[k];
    } catch (e) {}
  }
  // Test-override voor de aanwezigheidsdeadline (#5). Zet via
  // chrome.storage.local: { onsHelperConfig: { presenceDeadlineOverride: "YYYY-MM-DD HH:MM" } }
  // om de waarschuwing te kunnen zien zonder op een echte deadline te wachten.
  let _presenceDeadlineOverride = null;
  function applyRuntimeConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') return;
    if (typeof cfg.enabled === 'boolean') RUNTIME_CONFIG.enabled = cfg.enabled;
    if (typeof cfg.appointmentHelperEnabled === 'boolean') RUNTIME_CONFIG.appointmentHelperEnabled = cfg.appointmentHelperEnabled;
    if (typeof cfg.registrationHelperEnabled === 'boolean') RUNTIME_CONFIG.registrationHelperEnabled = cfg.registrationHelperEnabled;
    if (typeof cfg.presenceDeadlineOverride === 'string') _presenceDeadlineOverride = cfg.presenceDeadlineOverride || null;
    if (cfg.helperConfig && typeof cfg.helperConfig === 'object') { try { applyHelperConfig(cfg.helperConfig); } catch (e) {} }
    else { try { applyHelperConfig(cfg); } catch (e) {} }
    const features = (cfg.helperConfig && cfg.helperConfig.features) || cfg.features || {};
    if (typeof features.appointmentAssistant === 'boolean') RUNTIME_CONFIG.appointmentHelperEnabled = features.appointmentAssistant;
    if (typeof features.registrationAssistant === 'boolean') RUNTIME_CONFIG.registrationHelperEnabled = features.registrationAssistant;
    try { if (typeof syncWithUrl === 'function') syncWithUrl(); } catch (e) {}
  }
  function loadManagedConfig() {
    function readStorage(area, keys) {
      return new Promise(function (resolve) {
        try {
          if (!area || typeof area.get !== 'function') { resolve(null); return; }
          area.get(keys, function (result) {
            try {
              if (chrome.runtime && chrome.runtime.lastError) { resolve(null); return; }
            } catch (e) {}
            resolve(result || null);
          });
        } catch (e) { resolve(null); }
      });
    }
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) return Promise.resolve();
      // Vaste prioriteit: standaard < config.json < sector/profiel < lokale testoverride < beleid.
      return readStorage(chrome.storage.sync || chrome.storage.local, ['sector','colorProfile']).then(function (profile) {
        const previousSelection = ACTIVE_SECTOR + '\n' + ACTIVE_PROFILE;
        ACTIVE_PROFILE = profile && profile.colorProfile || null;
        ACTIVE_SECTOR = profile && (profile.sector || ((APP_CONFIG.profileSectors || {})[profile.colorProfile])) || null;
        refreshEffectiveConfig();
        if (previousSelection !== ACTIVE_SECTOR + '\n' + ACTIVE_PROFILE) { try { if (typeof deactivate === 'function') deactivate(); } catch (e) {} }
        return readStorage(chrome.storage.local, ['onsHelperConfig']);
      }).then(function (res) {
        try { if (res && res.onsHelperConfig) applyRuntimeConfig(res.onsHelperConfig); } catch (e) {}
        return readStorage(chrome.storage.managed, null);
      }).then(function (cfg) {
        try { if (cfg) applyRuntimeConfig(cfg); } catch (e) {}
        try { if (typeof syncWithUrl === 'function') syncWithUrl(); } catch (e) {}
      });
    } catch (e) { return Promise.resolve(); }
  }
  try {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'managed' || area === 'local' || (area === 'sync' && (changes.sector || changes.colorProfile))) loadManagedConfig();
      });
    }
  } catch (e) {}
  // Activeer de hulp pas nadat alle configuratielagen zijn ingelezen. Anders
  // worden knoppen en teksten kort uit de code-standaard gebouwd en houden ze
  // verouderde waarden vast (bijv. MDO 100% indirect of roze tekst).
  let helperConfigReady = false;
  const HELPER_CONFIG_READY = loadBundledConfig()
    .then(function () { return loadManagedConfig(); })
    .catch(function () {})
    .then(function () { helperConfigReady = true; });

  const CONFIG = {
    urlNeedle: '/events/new',
    registrationNeedle: '/registrations',
    debug: false,
    clientPresentMatcher: (txt) => txt.includes('client') && txt.includes('aanwezig'),
    // Afspraaktypes komen uit de beheerbare config (APP_CONFIG.choices).
    choices: effectiveChoices(),
    uursoortIgnore: ['onlangs gebruikt', 'geadviseerd', 'toegestaan', 'geen resultaten', 'voer minstens', 'toont ', 'bekijk agenda', 'verwijder uit selectie', 'client', 'medewerker', 'toevoegen'],
    etiketFieldSelector: '',
    uursoortFieldSelector: '',
    modalPanelSelector: '',
  };
  // Alle door de UI-inspector aangewezen selector-overrides (per hook-sleutel).
  // Bron: centrale config (APP_CONFIG.uiSelectors) als basis; een lokaal
  // 'herstel' (storage.local, hieronder) overschrijft dit per sleutel.
  const UI_OVERRIDES = {};
  let CONFIG_UI_SELECTORS = {};   // uit config.json (APP_CONFIG.uiSelectors)
  let LOCAL_UI_SELECTORS = {};    // uit storage.local (UI-inspector 'herstel'); wint over config
  function _pickStringSelectors(u) { const out = {}; if (u && typeof u === 'object') for (const k of Object.keys(u)) if (typeof u[k] === 'string' && u[k]) out[k] = u[k]; return out; }
  // Eerste zichtbare element voor de override van deze hook-sleutel (of null).
  function overrideEl(key) {
    const sel = UI_OVERRIDES[key];
    if (!sel || typeof sel !== 'string') return null;
    try { return deepQueryAll(sel).find((el) => visible(el) && !isOwnPopup(el)) || null; } catch (e) { return null; }
  }
  // ALLE zichtbare elementen voor de override van deze hook-sleutel. Geeft null
  // (niet []) terug als er geen override is, zodat de aanroeper zijn eigen
  // heuristiek kan gebruiken. Nodig voor hooks die met meerdere elementen matchen
  // (bv. de labelchips), die de beheerder via de UI-inspector kan herstellen.
  function overrideAll(key) {
    const sel = UI_OVERRIDES[key];
    if (!sel || typeof sel !== 'string') return null;
    try { return deepQueryAll(sel).filter((el) => visible(el) && !isOwnPopup(el)); } catch (e) { return null; }
  }
  // De drie 'klassieke' velden houden hun eigen CONFIG-veld (backward compatible).
  function applyCentralUiSelectors() {
    CONFIG.etiketFieldSelector = UI_OVERRIDES.etiketFieldSelector || '';
    CONFIG.uursoortFieldSelector = UI_OVERRIDES.uursoortFieldSelector || '';
    CONFIG.modalPanelSelector = UI_OVERRIDES.modalPanelSelector || '';
  }
  // Agenda-selectors lopen centraal via het ONS-object; een override vervangt de
  // waarde daar rechtstreeks, zodat ALLE consumenten (dagkleuring, totalen) de
  // herstelde selector gebruiken zonder verdere codewijziging.
  function applyAgendaSelectorOverrides() {
    const map = { agDayColumn: 'dayColumn', agDayCell: 'dayColumnCell', agOccurrence: 'occurrenceBase', agOccurrenceTitle: 'occurrenceTitle', agApptTitle: 'appointmentTitle', agLabelTitle: 'labelWithTitle' };
    for (const key in map) if (UI_OVERRIDES[key]) ONS[map[key]] = UI_OVERRIDES[key];
  }
  // Herbouw UI_OVERRIDES: config.json (basis) + lokale inspector-overrides (winnen).
  function recomputeUiOverrides() {
    for (const k in UI_OVERRIDES) delete UI_OVERRIDES[k];
    Object.assign(UI_OVERRIDES, CONFIG_UI_SELECTORS, LOCAL_UI_SELECTORS);
    applyCentralUiSelectors(); applyAgendaSelectorOverrides();
  }
  // Neem de in config.json gepubliceerde uiSelectors over (ook ná de async
  // config-load — dat ging eerder mis: UI_OVERRIDES bleef leeg).
  function seedUiOverridesFromConfig() { CONFIG_UI_SELECTORS = _pickStringSelectors(APP_CONFIG.uiSelectors); recomputeUiOverrides(); }
  seedUiOverridesFromConfig();
  // Globale numerieke instelling uit generalSettings, met terugval op de
  // meegeleverde standaard (geen losse magische getallen meer in de flows).
  function gsNum(key, def) { const g = APP_CONFIG.generalSettings || {}; return (g[key] > 0) ? g[key] : def; }
  // Alle labels/etiketten van één afspraaktype. Backward-compatible: het enkele
  // 'etiket' blijft het primaire label, 'etiketten' (array) voegt extra labels toe.
  // Volgorde: primair etiket eerst, daarna de extra's; dubbelen worden ontdubbeld.
  function choiceLabels(c) {
    const out = [];
    const push = (v) => { v = (v == null ? '' : String(v)).trim(); if (v && out.indexOf(v) === -1) out.push(v); };
    if (c) { push(c.etiket); if (Array.isArray(c.etiketten)) c.etiketten.forEach(push); }
    return out;
  }
  function allKnownLabels() {
    const labels = [];
    CONFIG.choices.forEach(function (c) { choiceLabels(c).forEach(function (l) { if (labels.indexOf(l) === -1) labels.push(l); }); });
    for (const extra of (APP_CONFIG.extraKnownLabels || [])) if (labels.indexOf(extra) === -1) labels.push(extra);
    return labels;
  }
  // Niet-cliëntgerelateerde afspraken: categorieën met opties.
  // display = nette naam (titel + knoptekst); uursoort = exacte dropdown-naam (incl. sterretje/afkorting).
  const NONCLIENT_CATEGORIES = [
    { label: 'Werkzaamheden', options: [
      { display: 'Acquisitie', uursoort: 'Acquisitie*', info: '' },
      { display: 'Werktijdenregeling', uursoort: 'Werktijdenregeling*', info: '' },
      { display: 'Voorbereidende werkzaamheden', uursoort: 'Voorbereidende werkzaamheden*', info: '' },
      { display: 'Verplichte nevenactiviteiten', uursoort: 'verpl nevenact - Verplichte nevenactiviteiten*', info: '' },
      { display: 'Schoolcoaching', uursoort: 'Schoolcoaching', info: '' },
      { display: 'Schoolcoaching indirect', uursoort: 'Schoolcoaching indirect #', info: '' },
      { display: 'Reistijd', uursoort: 'Reistijd', info: '' },
    ]},
    { label: 'Overleg & medezeggenschap', options: [
      { display: 'Overleg', uursoort: 'Overleg*', info: '' },
      { display: 'OR', uursoort: 'OR (ondernemingsraad)*', info: '' },
      { display: 'OR-training', uursoort: 'OR-training*', info: '' },
      { display: 'OR-vergadering', uursoort: 'OR-vergadering*', info: '' },
      { display: 'OR-voorbereiding en uitwerking', uursoort: 'OR-voorbereiding en uitwerking*', info: '' },
    ]},
    { label: 'Ontwikkeling & begeleiding', options: [
      { display: 'J&G verzorgen training extern', uursoort: 'J&G verzorgen training extern', info: '' },
      { display: 'Detachering', uursoort: 'Detachering', info: '' },
      { display: 'Inwerken', uursoort: 'Inwerken*', info: '' },
      { display: 'Opleiding & ontwikkeling', uursoort: 'Opleiding & ontwikkeling*', info: '' },
      { display: 'Werkbegeleiding', uursoort: 'Werkbegeleiding*', info: '' },
    ]},
    { label: 'Verlof & ouderschap', options: [
      { display: 'Verlof', uursoort: 'Verlof*', durationStep: 60, info: '' },
      { display: 'Ouderschapverlof', uursoort: 'Ouderschapverlof*', durationStep: 60, info: '' },
      { display: 'Kolven', uursoort: 'Kolven*', info: '' },
    ]},
    { label: 'Pauze, verzuim & gezondheid', options: [
      { display: 'Pauze', uursoort: 'Pauze*', fixedHalfHour: true, info: '' },
      { display: 'Verzuim/ziekte', uursoort: 'Verzuim/ziekte*', info: '' },
    ]},
    { label: 'Projecten J&G', options: [
      { display: 'J&G DH Kracht Basis', uursoort: 'J&G DH Kracht Basis', info: '' },
      { display: 'J&G Den Haag Kracht', uursoort: 'J&G Den Haag Kracht', info: '' },
      { display: 'J&G Ind Proeftuin Toekomstscenario', uursoort: 'J&G Ind Proeftuin Toekomstscenario', info: '' },
      { display: 'J&G Kacht Transformatie', uursoort: 'J&G Kacht Transformatie', info: '' },
      { display: 'J&G Kracht Preventie', uursoort: 'J&G Kracht Preventie', info: '' },
      { display: 'J&G Project GGZ', uursoort: 'J&G Project GGZ#', info: '' },
      { display: 'JBW project', uursoort: 'JBW project', info: '' },
      { display: 'Medendo C4', uursoort: 'Medendo C4#', info: '' },
      { display: 'Medendo D4', uursoort: 'Medendo D4#', info: '' },
      { display: 'PAST Project Gouda', uursoort: 'PAST Project Gouda', info: '' },
    ]},
    // 'Overig' is een directe optie (geen submenu, geen uursoort): de gebruiker
    // moet zelf een titel "Overig - ..." invullen voordat opslaan vrijkomt.
    { label: 'Overig', directOption: { display: 'Overig', freeTitle: true, info: '' } },
  ];
  // Actieve niet-cliëntcategorieën: beheerlijst uit config heeft voorrang; leeg =
  // ingebouwde lijst. Zo komen o.a. het informatielabel en de duur uit de config.
  function nonClientCategoriesActive() {
    const c = APP_CONFIG.nonClientCategories;
    const base = (Array.isArray(c) && c.length) ? c : NONCLIENT_CATEGORIES;
    // Categorieën op volgorde; per categorie de types (opties) op hun eigen volgorde.
    return sortByVolgorde(base).map(function (cat) {
      if (cat && Array.isArray(cat.options) && cat.options.length) {
        return Object.assign({}, cat, { options: sortByVolgorde(cat.options) });
      }
      return cat;
    });
  }
  function allNonClientHourTypes() {
    const out = [];
    nonClientCategoriesActive().forEach(function (cat) {
      if (cat.directOption && cat.directOption.uursoort) out.push(cat.directOption.uursoort);
      (cat.options || []).forEach(function (opt) { if (opt.uursoort) out.push(opt.uursoort); });
    });
    return out;
  }

  // REGISTRATION_CHOICES wordt uit de beheerbare config gebouwd (tabel 3).
  function buildRegistrationChoices() {
    return effectiveRegistrationForms().map(function (f) {
      const o = { label: f.vorm };
      if (f.uursoort) o.hourType = f.uursoort;
      if (f.eindtijdBeginPlusMin) o.endPlusOneMinute = true;
      // Startverdeling "N% direct/indirect": bij 100% een volledige verdeling,
      // anders een percentage-split (bv. 75% indirect -> 25% direct).
      const sv = String(f.startVerdeling || '').match(/(\d+)\s*%\s*(direct|indirect)/i);
      if (sv) {
        const pct = Math.max(0, Math.min(100, parseInt(sv[1], 10) || 0));
        const directPct = /indirect/i.test(sv[2]) ? (100 - pct) : pct;
        if (directPct === 100) o.directFullDuration = true;
        else if (directPct === 0) o.indirectFullDuration = true;
        else o.startSplit = { directPct: directPct, indirectPct: 100 - directPct };
      }
      if (f.vraagDirecteTijd) o.askDirectPortion = true;
      if (f.vraagIndirecteTijd) o.askIndirectPortion = true;
      if (f.vraagReistijd) o.addTravelTime = true;
      if (f.rapportagePrefix) o.reportPrefix = f.rapportagePrefix;
      return o;
    });
  }
  let REGISTRATION_CHOICES = buildRegistrationChoices();
  // Diagnostics verwijderd: geen console-logging, geen stap-ringbuffer en geen
  // uitleesbare diagnose-hook meer. logStep/dbg blijven als no-op bestaan zodat de
  // bestaande aanroepen door de flows ongemoeid blijven, maar leggen niets vast.
  const dbg = () => {};
  function logStep() {}
  // UI-inspector selector-overrides (géén diagnostiek): lokale overrides winnen per
  // sleutel over de centrale config en worden LIVE toegepast (geen herladen nodig).
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const applyUiOverrides = (o) => { LOCAL_UI_SELECTORS = _pickStringSelectors(o); recomputeUiOverrides(); };
      chrome.storage.local.get(['onsHelper.uiOverrides'], (res) => { applyUiOverrides(res && res['onsHelper.uiOverrides']); });
      if (chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'local' && changes['onsHelper.uiOverrides']) applyUiOverrides(changes['onsHelper.uiOverrides'].newValue);
        });
      }
    }
  } catch (e) {}

  /*  busy-cursor: laadcirkel op de muis terwijl instellingen worden doorgevoerd  */
  let _busyDepth = 0, _busyStyleEl = null;
  function _ensureBusyStyle() {
    if (_busyStyleEl) return;
    _busyStyleEl = document.createElement('style');
    _busyStyleEl.id = 'ons-helper-busy-style';
    _busyStyleEl.textContent = 'html.ons-helper-busy, html.ons-helper-busy * { cursor: progress !important; }';
    (document.head || document.documentElement).appendChild(_busyStyleEl);
  }
  function setBusyCursor(on) {
    _ensureBusyStyle();
    if (on) {
      _busyDepth++;
      document.documentElement.classList.add('ons-helper-busy');
    } else {
      _busyDepth = Math.max(0, _busyDepth - 1);
      if (_busyDepth === 0) document.documentElement.classList.remove('ons-helper-busy');
    }
  }
  // Veiligheidsklep: nooit langer dan een paar seconden blijven hangen.
  function busyWhile(maxMs, run) {
    setBusyCursor(true);
    let done = false;
    const clear = () => { if (!done) { done = true; setBusyCursor(false); } };
    const guard = setTimeout(clear, maxMs || 6000);
    run(() => { clearTimeout(guard); clear(); });
  }

  /*  shadow-DOM-bewuste zoekers (met shadow-root cache)  */
  let _shadowRoots = null, _shadowScheduled = false;
  function _collectRoots() {
    const roots = [document];
    const stack = [document];
    while (stack.length) {
      const node = stack.pop();
      let all; try { all = node.querySelectorAll('*'); } catch (e) { continue; }
      for (const el of all) if (el.shadowRoot) { roots.push(el.shadowRoot); stack.push(el.shadowRoot); }
    }
    return roots;
  }
  function _roots() {
    if (_shadowRoots) return _shadowRoots;
    _shadowRoots = _collectRoots();
    if (!_shadowScheduled) {
      _shadowScheduled = true;
      queueMicrotask(() => { _shadowRoots = null; _shadowScheduled = false; });
    }
    return _shadowRoots;
  }
  // Korte cache voor document-brede zoekacties (het duurste pad: alle shadow-
  // roots). De cache wordt gewist zodra de DOM structureel wijzigt en vervalt
  // sowieso na 500 ms, zodat resultaten nooit lang verouderd zijn. We geven een
  // KOPIE terug, want sommige aanroepers sorteren de lijst in-place.
  const _dqCache = new Map();
  let _dqObserver = null;
  function _initDqCache() {
    if (_dqObserver || typeof MutationObserver === 'undefined') return;
    try { _dqObserver = new MutationObserver(() => { _dqCache.clear(); }); _dqObserver.observe(document.documentElement, { subtree: true, childList: true }); } catch (e) { _dqObserver = null; }
  }
  function deepQueryAll(selector, root) {
    if (root) {
      const out = [], seen = new Set();
      const walk = (n) => {
        if (!n || seen.has(n)) return; seen.add(n);
        try { out.push(...n.querySelectorAll(selector)); } catch (e) {}
        let all; try { all = n.querySelectorAll('*'); } catch (e) { return; }
        for (const el of all) if (el.shadowRoot) walk(el.shadowRoot);
      };
      walk(root);
      return out;
    }
    _initDqCache();
    const hit = _dqCache.get(selector);
    if (hit && (Date.now() - hit.t) < 500) return hit.out.slice();
    const out = [];
    for (const r of _roots()) {
      try { for (const el of r.querySelectorAll(selector)) out.push(el); } catch (e) {}
    }
    _dqCache.set(selector, { out: out, t: Date.now() });
    return out.slice();
  }
  function deepActive() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
  }
  // Poll `fn` until it returns a truthy value (then onDone(value)) or the
  // timeout elapses (then onDone(null)). Robuuster dan een vaste setTimeout:
  // wacht precies zo lang als nodig op langzaam ladende (shadow-DOM) UI.
  function pollFor(fn, onDone, { timeout = 6000, interval = 120 } = {}) {
    const start = Date.now();
    const tick = () => {
      let val = null; try { val = fn(); } catch (e) { val = null; }
      if (val) { onDone(val); return; }
      if (Date.now() - start >= timeout) { onDone(null); return; }
      setTimeout(tick, interval);
    };
    tick();
  }

  /*  helpers  */
  const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const deburr = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const clean = (s) => deburr(normalize(s));
  const visible = (el) => { try { return !!el && (el.offsetParent !== null || el.getClientRects().length > 0); } catch (e) { return false; } };
  const rect = (el) => el.getBoundingClientRect();
  const area = (el) => { const r = rect(el); return r.width * r.height; };
  const isOwnPopup = (el) => !!(popupEl && el && (el === popupEl || popupEl.contains(el)));
  const inActiveForm = (el) => {
    const m = findModal();
    return !m || !m.host || m.host.contains(el) || document.body.contains(el);
  };

  function labelTextFor(el) {
    if (el.labels && el.labels.length) return Array.from(el.labels).map((l) => l.textContent).join(' ');
    const al = el.getAttribute && el.getAttribute('aria-label');
    if (al) return al;
    const lab = el.closest && el.closest('label');
    if (lab) return lab.textContent;
    const row = el.closest && el.closest('label,.checkbox,.form-group,li,tr,div');
    if (row) return row.textContent;
    return '';
  }

  /*  Clint(en) aanwezig  */
  function findCheckbox(matcher) {
    for (const input of deepQueryAll('input[type="checkbox"]'))
      if (matcher(clean(labelTextFor(input)))) return { el: input, kind: 'input' };
    for (const node of deepQueryAll('[role="checkbox"], [aria-checked], uc-checkbox'))
      if (matcher(clean(labelTextFor(node) || node.textContent || node.getAttribute && (node.getAttribute('aria-label') || '')))) return { el: node, kind: 'aria' };
    return null;
  }
  function nativeCheckboxFor(ctrl) {
    if (!ctrl || !ctrl.el) return null;
    if (ctrl.el.matches && ctrl.el.matches('input[type="checkbox"]')) return ctrl.el;
    return (ctrl.el.querySelector && ctrl.el.querySelector('input[type="checkbox"]')) ||
      (ctrl.el.shadowRoot && ctrl.el.shadowRoot.querySelector('input[type="checkbox"]')) ||
      null;
  }
  function isChecked(ctrl) {
    if (!ctrl || !ctrl.el) return null;
    const native = nativeCheckboxFor(ctrl);
    if (native) return !!native.checked;
    const nodes = [ctrl.el, ctrl.el.shadowRoot && ctrl.el.shadowRoot.querySelector('[aria-checked]')].filter(Boolean);
    for (const node of nodes) {
      const aria = node.getAttribute && node.getAttribute('aria-checked');
      if (aria === 'true') return true;
      if (aria === 'false') return false;
      const checked = node.getAttribute && node.getAttribute('checked');
      if (checked === '' || checked === 'true') return true;
      const state = clean(node.getAttribute && (node.getAttribute('data-state') || node.getAttribute('class') || ''));
      if (/\bchecked\b|\bselected\b|\bactive\b/.test(state)) return true;
    }
    return null;
  }
  function setChecked(ctrl, desired) {
    if (!ctrl) return false;
    const current = isChecked(ctrl);
    if (current === desired) return true;
    if (current === null) return false;
    const native = nativeCheckboxFor(ctrl);
    const target = native || ctrl.el;
    clickOption(target);
    if (native && native.checked !== desired) {
      native.checked = desired;
      native.dispatchEvent(new Event('input', { bubbles: true }));
      native.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return isChecked(ctrl) === desired;
  }
  function applyClientPresent(desired, onResult, attempt = 0) {
    const ctrl = findCheckbox(CONFIG.clientPresentMatcher);
    if (ctrl) {
      const ok = setChecked(ctrl, desired);
      if (ok || attempt >= 5) { onResult(ok, ok); return; }
      setTimeout(() => applyClientPresent(desired, onResult, attempt + 1), 120);
      return;
    }
    if (attempt < 15) setTimeout(() => applyClientPresent(desired, onResult, attempt + 1), 200);
    else onResult(false, false);
  }

  /*  veld-opener vinden (placeholder-attribuut, weergavetekst, of kopje)  */
  function uiText(el) {
    if (!el) return '';
    const bits = [];
    if (el.getAttribute) bits.push(el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.getAttribute('label'), el.getAttribute('title'));
    if ('value' in el && typeof el.value === 'string') bits.push(el.value);
    bits.push(el.textContent);
    return bits.filter(Boolean).join(' ');
  }
  function isUsableBox(el) {
    if (!visible(el) || isOwnPopup(el)) return false;
    const r = rect(el);
    return r.width >= 90 && r.width <= 700 && r.height >= 24 && r.height <= 90;
  }
  function clickBoxFor(el) {
    const clickable = 'input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,[class*="select" i]';
    let n = el;
    while (n && n !== document.body && n.nodeType === 1) {
      if (!isOwnPopup(n) && visible(n)) {
        const r = rect(n);
        if ((n.matches && n.matches(clickable)) || (r.width >= 120 && r.height >= 28 && r.height <= 90)) return n;
      }
      n = n.parentElement;
    }
    return el;
  }
  function findByVisibleText(texts) {
    const wanted = texts.map(clean);
    let best = null, bestScore = Infinity;
    for (const el of deepQueryAll('input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,div,span,p,label')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const t = clean(uiText(el));
      if (!t) continue;
      const exact = wanted.includes(t);
      const compact = wanted.some((w) => t.startsWith(w) && t.length <= w.length + 8);
      if (!exact && !compact) continue;
      const box = clickBoxFor(el);
      if (!isUsableBox(box)) continue;
      const r = rect(box);
      const score = area(box) + (exact ? 0 : 100000) + r.top;
      if (score < bestScore) { best = box; bestScore = score; }
    }
    return best;
  }
  function findBelowLabel(labelTexts, displayTexts) {
    const labels = [];
    const wantedLabels = labelTexts.map(clean);
    for (const el of deepQueryAll('label,div,span,p')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const t = clean(el.textContent || '');
      if (wantedLabels.includes(t)) labels.push(el);
    }
    const wantedDisplay = displayTexts.map(clean);
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const el of deepQueryAll('input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,[class*="select" i],div,span')) {
        if (!visible(el) || isOwnPopup(el)) continue;
        const box = clickBoxFor(el);
        if (!isUsableBox(box)) continue;
        const r = rect(box);
        if (r.top < lr.bottom - 4 || r.top - lr.bottom > 100) continue;
        const aligned = Math.abs(r.left - lr.left) < 80 || (r.left <= lr.left + 20 && r.right >= lr.left + 80);
        if (!aligned) continue;
        const text = clean(uiText(box));
        const textBonus = wantedDisplay.some((w) => text.includes(w)) ? -1000 : 0;
        const score = (r.top - lr.bottom) * 20 + Math.abs(r.left - lr.left) + area(box) / 1000 + textBonus;
        if (score < bestScore) { best = box; bestScore = score; }
      }
    }
    return best;
  }
  function findOpener({ placeholderRe, displayTexts = [], labelTexts = [] }) {
    const byText = displayTexts.length ? findByVisibleText(displayTexts) : null;
    if (byText) return byText;

    const byLabel = labelTexts.length ? findBelowLabel(labelTexts, displayTexts) : null;
    if (byLabel) return byLabel;

    for (const el of deepQueryAll('input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      if (placeholderRe.test(uiText(el))) return clickBoxFor(el);
    }
    return null;
  }

  /*  generiek: open  typ  kies  */
  function optionSearchRoots(trigger) {
    const scored = [];
    for (const el of deepQueryAll('[role="listbox"],[role="menu"],ul,uc-select-list,[class*="dropdown" i],[class*="menu" i],[class*="popover" i],[class*="options" i]')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const r = rect(el);
      if (r.width < 160 || r.height < 30) continue;
      let score = 0;
      if (trigger) {
        const tr = rect(trigger);
        const xOverlap = Math.max(0, Math.min(r.right, tr.right + 240) - Math.max(r.left, tr.left - 240));
        const below = r.top >= tr.bottom - 12 && r.top <= tr.bottom + 120;
        const coversTriggerX = xOverlap >= Math.min(tr.width, r.width) * 0.45;
        if (below && coversTriggerX) {
          score = Math.abs(r.top - tr.bottom) + Math.abs(r.left - tr.left) / 5 - xOverlap / 100;
        } else {
          const dx = Math.abs((r.left + r.right) / 2 - (tr.left + tr.right) / 2);
          const dy = Math.min(Math.abs(r.top - tr.bottom), Math.abs(r.bottom - tr.top));
          if (dx > 430 || dy > 520) continue;
          score = 10000 + dy + dx / 5;
        }
      }
      scored.push({ el, score });
    }
    if (trigger) {
      const tr = rect(trigger);
      for (const inp of deepQueryAll('input,textarea')) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        const ir = rect(inp);
        const below = ir.top >= tr.bottom - 12 && ir.top <= tr.bottom + 140;
        const overlaps = ir.right >= tr.left - 80 && ir.left <= tr.right + 240;
        if (!below || !overlaps) continue;
        let n = inp.parentElement;
        while (n && n !== document.body) {
          const nr = rect(n);
          if (nr.width >= Math.max(220, tr.width * 0.8) && nr.height >= 70 && nr.top <= ir.top + 5) {
            scored.push({ el: n, score: -20 + Math.abs(nr.top - tr.bottom) / 10 });
            break;
          }
          n = n.parentElement;
        }
      }
    }
    return [...new Set(scored.sort((a, b) => a.score - b.score).map((x) => x.el))];
  }
  function optionText(el) {
    return ((el.getAttribute && (el.getAttribute('label') || el.getAttribute('aria-label'))) || el.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function hasNestedOptionNode(el, selector) {
    if (!el || !el.querySelectorAll) return false;
    try {
      return Array.from(el.querySelectorAll(selector)).some((child) => child !== el && visible(child) && !isOwnPopup(child));
    } catch (e) {
      return false;
    }
  }
  // Een échte uursoort-optie is één regel. Een container die eigen actie-elementen
  // met tekst omvat (links/knoppen) is géén optie maar een stuk UI — bijvoorbeeld een
  // collega-agendakaart achter de modal ("… Informatie niet delen / Toon alleen deze
  // agenda"). Generiek (geen vaste teksten) en vangt ook de fallback-race bij snel doorklikken.
  function containsSeparateActionText(el) {
    if (!el || !el.querySelectorAll) return false;
    try {
      return Array.from(el.querySelectorAll('a[href], button, [role="button"], [role="menuitem"], [role="link"]'))
        .some((child) => child !== el && visible(child) && !isOwnPopup(child) && clean(child.textContent || '').length >= 2);
    } catch (e) {
      return false;
    }
  }
  function splitUursoortCategoryText(text) {
    let raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return [];
    raw = raw
      .replace(/&nbsp;|\u00a0/gi, ' ')
      .replace(/(Onlangs gebruikt|Geadviseerd|Toegestaan)\s*/gi, '\n')
      .replace(/\*\s*(?=[A-ZÀ-ÖØ-Þ])/g, '*\n')
      .replace(/\)\s+(?=[A-ZÀ-ÖØ-Þ])/g, ')\n')
      .replace(/#\s*(?=[A-ZÀ-ÖØ-Þ])/g, '#\n');
    return raw.split(/\n+/)
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter((part) => !!part && !/^(?:#|\*|&?nbsp;?)$/i.test(part));
  }
  function pushUniqueText(out, seen, text, validator) {
    for (const part of splitUursoortCategoryText(text)) {
      if (validator && !validator(part)) continue;
      const key = clean(part);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(part);
    }
  }
  function invalidUursoortOption(text) {
    const c = clean(text);
    if (!c || c.length < 2) return true;
    if (/^(onlangs gebruikt|geadviseerd|toegestaan)$/.test(c)) return true;
    if (c === 'uursoort' || c === 'uursoorten' || c === 'toeslag' || c === 'titel' || c === 'labels' || c === 'locatie' || c === 'notities') return true;
    if (CONFIG.uursoortIgnore.some((ig) => c.includes(ig))) return true;
    if (/^(bekijk agenda|toon|toont|selecteer|zoek naar|geen resultaten)/i.test(c)) return true;
    if (/verwijder uit selectie|client|medewerker|toevoegen|niet beschikbaar|annuleren|opslaan/i.test(c)) return true;
    if (/jg\s*jeugd\s*&\s*gezin|jeugd\s*&\s*gezin|jeugd\s+en\s+gezin/.test(c)) return true;
    if (/j\s*&\s*g\s+(kracht|zoetermeer)|\bjg\s+(kracht|zoetermeer)\b/.test(c)) return true;
    return false;
  }
  function looksLikeUursoortOption(text) {
    const c = clean(text);
    if (invalidUursoortOption(text)) return false;
    if (allNonClientHourTypes().some((name) => {
      const wanted = clean(name);
      const loose = clean(String(name || '').replace(/\*+$/, ''));
      return c === wanted || (!!loose && c === loose);
    })) return true;
    if (/\b(ggz|ambulant|hbo|mbo|behandeling|diagnostiek|verslaglegging|zorgcoordinatie|no show|factuur|mdo|huisbezoek|digitaal|telefonisch|mail)\b/.test(c)) return true;
    if (/[#]/.test(text)) return true;
    return false;
  }
  function optionCandidates(root) {
    const selector = '[role="option"], li, button, [class*="option" i], [data-value], [data-id]';
    const raw = deepQueryAll(selector, root).filter((o) => visible(o) && !isOwnPopup(o));
    const fallback = deepQueryAll('div,span', root).filter((o) => visible(o) && !isOwnPopup(o));
    const pool = [...raw, ...fallback];
    const out = [];
    const seen = new Set();
    for (const o of pool) {
      if (/input|textarea|select/i.test(o.tagName || '')) continue;
      if (hasNestedOptionNode(o, selector)) continue;
      const t = optionText(o);
      const c = clean(t);
      if (!looksLikeUursoortOption(t) || seen.has(c)) continue;
      const r = rect(o);
      if (r.width < 80 || r.height < 18 || r.height > 90) continue;
      seen.add(c); out.push(o);
    }
    return out;
  }
  function collectUursoortOptionTexts(trigger) {
    const seen = new Set(); const out = [];
    for (const root of optionSearchRoots(trigger)) {
      for (const o of optionCandidates(root)) {
        pushUniqueText(out, seen, optionText(o).trim(), looksLikeUursoortOption);
      }
      for (const o of genericOptionCandidates(root)) {
        pushUniqueText(out, seen, optionText(o).trim(), looksLikeUursoortOption);
      }
      const rootText = optionText(root);
      pushUniqueText(out, seen, rootText, looksLikeUursoortOption);
    }
    return out.slice(0, 25);
  }
  function clientUursoortListbox(trigger) {
    if (!trigger) return null;
    const local = deepQueryAll('[role="listbox"], ul[part="list"]', trigger)
      .find((el) => visible(el) && !isOwnPopup(el));
    if (local) return local;
    for (const root of optionSearchRoots(trigger)) {
      if (root.matches && root.matches('[role="listbox"], ul[part="list"]') && visible(root)) return root;
      const nested = deepQueryAll('[role="listbox"], ul[part="list"]', root)
        .find((el) => visible(el) && !isOwnPopup(el));
      if (nested) return nested;
    }
    return null;
  }
  function collectClientUursoortOptionTexts(trigger) {
    const out = []; const seen = new Set();
    // Als er een echte open uursoort-lijst is (role="listbox"), ALLEEN daarbinnen
    // scannen. Zo komen agenda-/paneelelementen ACHTER de modal (bv. een collega-
    // agenda "… Informatie niet delen / Toon alleen deze agenda") niet als optie mee.
    // Alleen zonder herkende lijst vallen we terug op de bredere optionSearchRoots.
    const listbox = clientUursoortListbox(trigger);
    const roots = listbox ? [listbox] : optionSearchRoots(trigger);
    for (const root of roots) {
      const nodes = deepQueryAll('[role="option"], li, [data-value]', root)
        .filter((el) => visible(el) && !isOwnPopup(el));
      for (const node of nodes) {
        if (hasNestedOptionNode(node, '[role="option"], li, [data-value]')) continue;
        if (containsSeparateActionText(node)) continue; // geen agenda-/paneelkaart achter de modal
        const text = optionText(node).replace(/\s+/g, ' ').trim();
        const r = rect(node);
        if (r.width < 60 || r.height < 16 || r.height > 100) continue;
        for (const part of splitUursoortCategoryText(text)) {
          if (invalidUursoortOption(part)) continue;
          const key = clean(part);
          if (!key || seen.has(key)) continue;
          seen.add(key); out.push(part);
        }
      }
    }
    // Zodra echte losse opties gevonden zijn, mag de tekst van de bovenliggende
    // virtuele lijst niet nogmaals worden verwerkt: die bevat dezelfde opties
    // aaneengeregen en veroorzaakte de lange herhalingsknop.
    if (out.length) return out;
    // Alleen als er geen losse option-elementen bestaan: gebruik tekstsplitsing
    // als vangnet voor oudere/afwijkende ONS-varianten.
    collectUursoortOptionTexts(trigger).forEach((text) => {
      for (const part of splitUursoortCategoryText(text)) {
        const key = clean(part);
        if (key && !seen.has(key)) { seen.add(key); out.push(part); }
      }
    });
    return out;
  }
  // Uursoorten worden door ONS gevirtualiseerd: slechts enkele regels bestaan
  // tegelijk in de DOM. Scan daarom de hele lijst en verzamel elke gerenderde
  // optie, ook wanneer die pas na scrollen zichtbaar wordt.
  function scanClientUursoortOptions(trigger, onDone) {
    const found = []; const seen = new Set();
    const collect = () => {
      collectClientUursoortOptionTexts(trigger).forEach((text) => {
        const key = clean(text);
        if (key && !seen.has(key)) { seen.add(key); found.push(text); }
      });
    };
    collect();
    const listbox = clientUursoortListbox(trigger);
    if (!listbox) { onDone(found); return; }
    const max = Math.max(0, (listbox.scrollHeight || 0) - (listbox.clientHeight || 0));
    const step = Math.max(90, Math.round((listbox.clientHeight || 150) * 0.8));
    const positions = [];
    for (let y = 0; y < max; y += step) positions.push(y);
    positions.push(max);
    let index = 0;
    const next = () => {
      if (index >= positions.length) {
        try { listbox.scrollTop = 0; listbox.dispatchEvent(new Event('scroll', { bubbles: true, composed: true })); } catch (e) {}
        onDone(found.slice(0, 100));
        return;
      }
      try {
        listbox.scrollTop = positions[index++];
        listbox.dispatchEvent(new Event('scroll', { bubbles: true, composed: true }));
      } catch (e) { index++; }
      setTimeout(() => { collect(); next(); }, 75);
    };
    next();
  }
  function genericOptionCandidates(root) {
    const selector = '[role="option"], li, button, [class*="option" i], [data-value], [data-id], div, span';
    const out = [];
    const seen = new Set();
    for (const o of deepQueryAll(selector, root).filter((el) => visible(el) && !isOwnPopup(el))) {
      if (/input|textarea|select/i.test(o.tagName || '')) continue;
      const t = optionText(o);
      const c = clean(t);
      if (!c || seen.has(c) || /^zoek naar|toont |geen resultaten|voer minstens/.test(c)) continue;
      const r = rect(o);
      if (r.width < 60 || r.height < 18 || r.height > 90) continue;
      seen.add(c); out.push(o);
    }
    return out;
  }
  function clickOption(el) {
    try { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    el.click();
  }
  function clickUiButton(el) {
    if (!el) return false;
    const inner = el.shadowRoot && (el.shadowRoot.querySelector('button:not([disabled])') || el.shadowRoot.querySelector('button'));
    const target = inner || el;
    return clickElementCenter(target);
  }
  function clickElementCenter(el) {
    if (!el) return false;
    try { el.scrollIntoView && el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
    const r = rect(el);
    if (!r || r.width <= 0 || r.height <= 0) return false;
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    // Richt events op het gevonden element. Na scrollen/hertekenen kan
    // elementFromPoint inmiddels een buurknop aanwijzen.
    const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y };
    try { el.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerType: 'mouse' })); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', init)); } catch (e) {}
    try { el.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerType: 'mouse' })); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', init)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('click', init)); } catch (e) {}
    if (!isProtectedAppointmentStartInput(el)) {
      try { el.focus && el.focus(); } catch (e) {}
    }
    return true;
  }
  function openSelectCombobox(el) {
    if (!el) return null;
    const nestedSelect = el.querySelector && el.querySelector('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], uc-select[aria-label="Labels"], [role="combobox"][aria-label="Uursoort"], [role="combobox"][aria-label="Labels"]');
    if (nestedSelect && nestedSelect !== el) return openSelectCombobox(nestedSelect);
    const inner = el.shadowRoot && (
      el.shadowRoot.querySelector('[role="combobox"]:not([aria-disabled="true"])') ||
      el.shadowRoot.querySelector('button:not([disabled])') ||
      el.shadowRoot.querySelector('[tabindex],input,button,div')
    );
    const target = inner || el;
    try { target.scrollIntoView && target.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
    const r = rect(target);
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y };
    try { target.focus && target.focus(); } catch (e) {}
    try { target.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerType: 'mouse' })); } catch (e) {}
    try { target.dispatchEvent(new MouseEvent('mousedown', init)); } catch (e) {}
    try { target.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerType: 'mouse' })); } catch (e) {}
    try { target.dispatchEvent(new MouseEvent('mouseup', init)); } catch (e) {}
    try { target.dispatchEvent(new MouseEvent('click', init)); } catch (e) {}
    return target;
  }
  function pickOption(text, onResult, attempt = 0, trigger = null) {
    const opts = [];
    for (const root of optionSearchRoots(trigger)) {
      opts.push(...optionCandidates(root));
      if (opts.length) break;
    }
    const wanted = clean(text);
    const match = opts.find((o) => clean(optionText(o)) === wanted) || opts.find((o) => clean(optionText(o)).includes(wanted));
    if (match) { clickOption(match); onResult(true); return; }
    if (attempt < 16) setTimeout(() => pickOption(text, onResult, attempt + 1, trigger), 150);
    else onResult(false);
  }
  function setInputText(inp, text) {
    if (isProtectedAppointmentStartInput(inp)) return false;
    const proto = inp instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;
    if (setter) setter.call(inp, text); else inp.value = text;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function setInputTextComposed(inp, text) {
    if (!setInputText(inp, text)) return false;
    inp.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    return true;
  }
  function inputTextValue(inp) {
    return String((inp && 'value' in inp ? inp.value : '') || (inp && inp.getAttribute && inp.getAttribute('value')) || '').trim();
  }
  function setInputTextOns(inp, text) {
    if (!inp) return false;
    if (isProtectedAppointmentStartInput(inp)) return false;
    try { inp.scrollIntoView && inp.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
    try { inp.focus && inp.focus(); } catch (e) {}
    try { inp.select && inp.select(); } catch (e) {}
    setInputTextComposed(inp, text);
    try { inp.setAttribute && inp.setAttribute('value', text); } catch (e) {}
    try { inp.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: String(text) })); } catch (e) {}
    inp.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
    try { inp.blur && inp.blur(); } catch (e) {}
    return true;
  }
  function setInputTextQuiet(inp, text) {
    if (isProtectedAppointmentStartInput(inp)) return false;
    if (!inp || inputTextValue(inp) === String(text)) return !!inp;
    setInputTextComposed(inp, text);
    try { inp.setAttribute && inp.setAttribute('value', text); } catch (e) {}
    return true;
  }
  function setInputTextOnsVerified(inp, text, attempts = 4) {
    if (!inp) return false;
    const apply = (left) => {
      setInputTextOns(inp, text);
      if (left > 0) {
        setTimeout(() => {
          if (inputTextValue(inp) !== String(text)) apply(left - 1);
        }, left === attempts ? 120 : 220);
      }
    };
    apply(attempts);
    return true;
  }
  function typeIntoActive(text) {
    const a = deepActive();
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) { setInputText(a, text); return true; }
    const inp = deepQueryAll('input,textarea').find((i) => visible(i) && /^zoek/i.test(i.getAttribute('placeholder') || ''));
    if (inp) { inp.focus(); setInputText(inp, text); return true; }
    return false;
  }
  function searchInputForTrigger(trigger) {
    const tr = trigger ? rect(trigger) : null;
    const activeEl = deepActive();
    if (activeEl && /input|textarea/i.test(activeEl.tagName || '') && visible(activeEl) && !isOwnPopup(activeEl) && !isProtectedAppointmentStartInput(activeEl)) {
      const ph = clean((activeEl.getAttribute('placeholder') || '') + ' ' + (activeEl.getAttribute('aria-label') || ''));
      if (!ph.includes('afspraken') && !ph.includes('clienten') && (/zoeken|zoek/.test(ph) || ph === '')) return activeEl;
    }
    for (const root of optionSearchRoots(trigger)) {
      const input = deepQueryAll('input', root).find((inp) => {
        if (!visible(inp) || isOwnPopup(inp) || isProtectedAppointmentStartInput(inp)) return false;
        const ph = clean((inp.getAttribute('placeholder') || '') + ' ' + (inp.getAttribute('aria-label') || ''));
        if (ph.includes('afspraken') || ph.includes('clienten')) return false;
        return /zoeken|zoek/.test(ph) || ph === '';
      });
      if (input) return input;
    }
    if (!tr) return null;
    return deepQueryAll('input').find((inp) => {
      if (!visible(inp) || isOwnPopup(inp) || isProtectedAppointmentStartInput(inp)) return false;
      const ph = clean((inp.getAttribute('placeholder') || '') + ' ' + (inp.getAttribute('aria-label') || ''));
      if (ph.includes('afspraken') || ph.includes('clienten')) return false;
      const r = rect(inp);
      return r.top >= tr.bottom - 18 && r.top <= tr.bottom + 170 && r.left <= tr.right + 260 && r.right >= tr.left - 120;
    }) || null;
  }
  function openTypePick(getTrigger, text, onResult) {
    const trigger = getTrigger();
    if (!trigger) { onResult(false, 'veld niet gevonden'); return; }
    selectDropdownLikeLabel(trigger, text, (ok) => onResult(ok, ok ? '' : 'optie niet gevonden'));
  }

  function selectDropdownLikeLabel(trigger, text, onResult, attempt = 0) {
    if (!trigger) { onResult(false); return; }
    const openedBy = openSelectCombobox(trigger) || trigger;
    setTimeout(() => {
      const input = searchInputForTrigger(openedBy) || searchInputForTrigger(trigger);
      const searchText = String(text || '').replace(/[*#]+$/, '').trim();
      if (input) {
        try { input.focus(); } catch (e) {}
        typeIntoSearchField(input, searchText);
      } else if (trigger.tagName === 'INPUT' || trigger.tagName === 'TEXTAREA') {
        setInputText(trigger, searchText);
      }
      const wanted = [text, String(text || '').replace(/\*+$/, '').trim()].filter(Boolean);
      // Poll tot de optie echt gerenderd is (op productie duurt server-side
      // zoeken langer) i.p.v. één poging na een vaste vertraging.
      pollFor(
        () => findExactDropdownOption(openedBy, wanted) || findExactDropdownOption(trigger, wanted),
        (best) => {
          if (best) {
            clickOption(best);
            setTimeout(() => { clickEmptyModalSpot(); onResult(true); }, 90);
            return;
          }
          if (attempt < 3) {
            clickEmptyModalSpot();
            setTimeout(() => selectDropdownLikeLabel(trigger, text, onResult, attempt + 1), 200);
            return;
          }
          setTimeout(() => { clickEmptyModalSpot(); onResult(false); }, 90);
        },
        { timeout: 2600, interval: 130 }
      );
    }, 170);
  }

  // #1: pak het eerste zichtbare element met een stabiele ONS-testhaak (data-qa).
  // Deze veranderen niet mee met layout/opmaak en zijn dus betrouwbaarder dan
  // geometrie- of tekstdetectie.
  function firstByDataQa(qa) {
    for (const el of deepQueryAll('[data-qa="' + qa + '"]')) {
      if (visible(el) && !isOwnPopup(el)) return el;
    }
    return null;
  }
  function getEtiketTrigger() {
    if (CONFIG.etiketFieldSelector) { const f = document.querySelector(CONFIG.etiketFieldSelector); if (f) return f; logStep('labels-veld: override matcht niets', false, CONFIG.etiketFieldSelector); }
    // #1: eerst de stabiele ONS-haak data-qa="label_select"; tekst/geometrie als fallback.
    const byQa = firstByDataQa('label_select');
    if (byQa) return byQa;
    const t = findOpener({ placeholderRe: /label|etiket/i, displayTexts: ['zoek naar labels', 'zoek naar etiketten'], labelTexts: ['labels', 'label', 'etiket', 'etiketten'] });
    if (!t) logStep('labels-veld niet gevonden', false, 'geen match op tekst/placeholder');
    return t;
  }
  function findClientUursoortTrigger() {
    const clientLabels = deepQueryAll('div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'client');
    let best = null, bestScore = Infinity;
    for (const clientLabel of clientLabels) {
      const cr = rect(clientLabel);
      for (const label of deepQueryAll('label,div,span,p')) {
        if (!visible(label) || isOwnPopup(label) || clean(label.textContent) !== 'uursoort') continue;
        const lr = rect(label);
        if (lr.top < cr.bottom - 2 || lr.top > cr.bottom + 110) continue;
        if (Math.abs(lr.left - cr.left) > 80) continue;
        for (const el of deepQueryAll('input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,[class*="select" i],div,span')) {
          if (!visible(el) || isOwnPopup(el)) continue;
          const box = clickBoxFor(el);
          if (!isUsableBox(box)) continue;
          const br = rect(box);
          if (br.top < lr.bottom - 6 || br.top - lr.bottom > 70) continue;
          if (Math.abs(br.left - lr.left) > 80) continue;
          const score = (br.top - lr.bottom) * 20 + Math.abs(br.left - lr.left) + area(box) / 1000;
          if (score < bestScore) { best = box; bestScore = score; }
        }
      }
    }
    return best;
  }
  function getTitleInputSafe() {
    try { return getTitleInput(); } catch (e) { return null; }
  }
  function setAppointmentTitleText(text) {
    const input = getTitleInputSafe();
    if (!input) return false;
    setInputText(input, text);
    return true;
  }
  // Zet de uursoort op het afspraak-detailniveau (combobox "Zoek naar uursoorten")
  // door de exacte naam (incl. sterretje) te zoeken en aan te klikken.
  function setAppointmentUursoortByName(name, onDone) {
    const done = typeof onDone === 'function' ? onDone : function () {};
    // De afspraak-uursoort-dropdown werkt hetzelfde als de labels; gebruik
    // daarom hetzelfde pad (selectNonClientUursoort -> selectLabel-principe).
    selectNonClientUursoort(name, done);
  }
  function typeIntoSearchField(input, text) {
    if (!input) return false;
    try { input.focus(); } catch (e) {}
    try { input.click && input.click(); } catch (e) {}
    // leeg eerst
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;
    const setVal = (v) => { if (setter) setter.call(input, v); else input.value = v; };
    const fireInput = (value, inputType) => {
      try { input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, composed: true, inputType: inputType || 'insertText', data: value })); } catch (e) {}
      try { input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: inputType || 'insertText', data: value })); } catch (e) {
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }
    };
    setVal('');
    fireInput('', 'deleteContentBackward');
    // typ teken voor teken met echte toetsaanslagen (nodig voor "min. 2 karakters"-velden)
    let acc = '';
    for (const ch of String(text)) {
      acc += ch;
      try { input.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true, composed: true })); } catch (e) {}
      setVal(acc);
      fireInput(ch, 'insertText');
      try { input.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true, cancelable: true, composed: true })); } catch (e) {}
    }
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    setTimeout(() => {
      if (inputTextValue(input) !== String(text)) {
        setVal(String(text));
        fireInput(String(text), 'insertText');
        input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      }
    }, 60);
    return true;
  }
  function findOpenSearchBox(trigger) {
    // Pak nooit de globale agenda/client-zoekbalk. Eerst zoeken binnen de
    // geopende dropdown rond dit trigger-veld.
    const local = searchInputForTrigger(trigger);
    if (local) return local;
    return null;
  }
  function selectNonClientUursoort(text, onResult, attempt = 0) {
    // Zelfde patroon als selectLabel: clickElementCenter opent de dropdown,
    // zoekterm typen (zonder * en #), dan exacte optie klikken.
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    dbg('selectNonClientUursoort poging', attempt, 'gezocht:', text, '| trigger:', !!trigger,
      trigger ? ('tag=' + trigger.tagName + ' txt=' + JSON.stringify(clean(uiText(trigger) || trigger.textContent || '').slice(0, 30))) : '');
    if (!trigger) { onResult(false); return; }
    clickElementCenter(trigger);
    setTimeout(() => {
      const searchText = String(text || '').replace(/[*#]+$/, '').trim();
      const input = searchInputForTrigger(trigger);
      if (input) { input.focus(); setInputText(input, searchText); }
      const loose = searchText;
      setTimeout(() => {
        const ok = clickExactDropdownOption(trigger, [text, loose].filter(Boolean));
        dbg('  klik resultaat:', ok, '| poging', attempt);
        if (!ok && attempt < 5) {
          clickEmptyModalSpot();
          setTimeout(() => selectNonClientUursoort(text, onResult, attempt + 1), 120);
          return;
        }
        setTimeout(() => { clickEmptyModalSpot(); onResult(!!ok); }, 50);
      }, input ? 220 : 130);
    }, 90);
  }
  function getUursoortTrigger() {
    if (CONFIG.uursoortFieldSelector) { const f = document.querySelector(CONFIG.uursoortFieldSelector); if (f) return f; logStep('uursoort-veld: override matcht niets', false, CONFIG.uursoortFieldSelector); }
    const t = findClientUursoortTrigger() || findOpener({ placeholderRe: /uursoort|hour type/i, displayTexts: ['zoek naar uursoorten'], labelTexts: ['uursoort', 'uursoorten', 'hour type'] });
    if (!t) logStep('uursoort-veld niet gevonden', false, 'geen match op tekst/placeholder');
    return t;
  }
  function selectedUursoortSummaryForEntry(entry) {
    if (!entry || !entry.role) return '';
    const rr = rect(entry.role);
    const allEntries = findClientEntries();
    const idx = allEntries.findIndex((item) => item.name === entry.name);
    const nextTop = idx >= 0 && allEntries[idx + 1] ? rect(allEntries[idx + 1].nameEl).top : rr.bottom + 280;
    let uursoortLabelTop = nextTop;
    for (const label of deepQueryAll('label,div,span,p', entry.card || document)) {
      if (!visible(label) || isOwnPopup(label) || clean(label.textContent) !== 'uursoort') continue;
      const lr = rect(label);
      if (lr.top > rr.bottom - 4 && lr.top < uursoortLabelTop && Math.abs(lr.left - rr.left) < 160) uursoortLabelTop = lr.top;
    }
    const nameClean = clean(entry.name);
    let best = '', bestScore = Infinity;
    for (const el of deepQueryAll('div,span,p,button,[role="combobox"]', entry.card || document)) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const c = clean(txt);
      if (!txt || c === nameClean || c === clean(entry.firstName) || c === 'client') continue;
      if (/clienten zijn aanwezig|niet beschikbaar|verwijder uit selectie|toeslag|selecteer toeslag|zoek naar uursoorten|uursoort|medewerker|toevoegen/.test(c)) continue;
      const r = rect(el);
      if (r.top < rr.bottom - 6 || r.top >= Math.min(uursoortLabelTop, nextTop) - 2) continue;
      if (Math.abs(r.left - rr.left) > 150) continue;
      const triggerPenalty = entry.uursoortTrigger && entry.uursoortTrigger.contains && entry.uursoortTrigger.contains(el) ? 25 : 0;
      const score = Math.max(0, r.top - rr.bottom) + Math.abs(r.left - rr.left) / 4 + triggerPenalty;
      if (score < bestScore) { best = txt; bestScore = score; }
    }
    return best;
  }
  function isRealClientUursoortSummary(text) {
    const c = clean(text);
    if (!c || c.length < 2) return false;
    if (/^(client|medewerker|uursoort|toeslag|selecteer toeslag|zoek naar uursoorten|selecteer uursoort|geen resultaten|voer minstens|toont )/.test(c)) return false;
    if (/clienten zijn aanwezig|niet beschikbaar|verwijder uit selectie|toevoegen|annuleren|opslaan/.test(c)) return false;
    return true;
  }
  function hasUursoortSelected() {
    const hasTriggerValue = (trigger) => {
      if (!trigger) return false;
      const txt = clean(uiText(trigger) || trigger.textContent || trigger.value || trigger.getAttribute && (trigger.getAttribute('value') || trigger.getAttribute('title') || ''));
      return !!txt && !/zoek naar uursoorten|selecteer uursoort|uursoort|geen resultaten|voer minstens|toont /.test(txt);
    };
    // (Fase 4) De oude geometrie-helper hasVisibleUursoortComboboxValue is
    // verwijderd: die werd nergens meer aangeroepen sinds de cliënt-detectie op
    // stabiele signalen draait (computeAppointmentUursoortState / entryUursoortIsSet).
    const entries = findClientEntries();
    // Cliënt-pad: gereed = centrale toestand READY_TO_SAVE (alle cliënten gezet).
    if (entries.length) return computeAppointmentUursoortState() === 'READY_TO_SAVE';
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (hasTriggerValue(trigger)) return true;
    const clientLabels = deepQueryAll('div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'client');
    for (const label of clientLabels) {
      const lr = rect(label);
      for (const el of deepQueryAll('div,span,p')) {
        if (!visible(el) || isOwnPopup(el) || el === label) continue;
        const txt = clean(el.textContent || '');
        if (!txt || txt === 'client' || txt.includes('clienten') || txt.includes('medewerker') || txt.includes('niet beschikbaar')) continue;
        if (txt.includes('uursoort') || txt.includes('toeslag') || txt.includes('verwijder uit selectie')) continue;
        const r = rect(el);
        if (r.top < lr.bottom - 4 || r.top > lr.bottom + 55) continue;
        if (Math.abs(r.left - lr.left) > 100) continue;
        if (txt.includes('ggz') || txt.includes('#')) return true;
      }
    }
    return false;
  }
  function shouldRequireUursoortForSubmit() {
    return !!activeNonClientOption || findClientEntries().length > 0;
  }
  function submitButtons() {
    const ov = overrideEl('afsOpslaan'); if (ov) return [ov];
    return deepQueryAll('button[type="submit"], uc-button[type="submit"]')
      .filter((btn) => visible(btn) && !isOwnPopup(btn));
  }
  function setSubmitBlocked(blocked) {
    for (const btn of submitButtons()) {
      const target = btn.shadowRoot ? (btn.shadowRoot.querySelector('button[type="submit"], button') || btn) : btn;
      try { btn.setAttribute('aria-disabled', blocked ? 'true' : 'false'); } catch (e) {}
      try { target.setAttribute('aria-disabled', blocked ? 'true' : 'false'); } catch (e) {}
      if (target instanceof HTMLButtonElement) target.disabled = blocked;
      if (btn instanceof HTMLButtonElement) btn.disabled = blocked;
      // Visueel 'geblokkeerd' + een 'niet toegestaan'-cursor (rood cirkeltje met
      // schuine streep) bij hover. Belangrijk: GEEN pointer-events:none meer,
      // want dan valt de hover weg en zie je die cursor nooit. Het daadwerkelijk
      // tegenhouden van opslaan gebeurt via de disabled-knop + de submit-guard.
      for (const el of [target, btn]) {
        if (el && el.style) {
          el.style.opacity = blocked ? '0.45' : '';
          el.style.cursor = blocked ? 'not-allowed' : '';
          el.style.pointerEvents = blocked ? 'auto' : '';
        }
      }
    }
  }
  // ===== Vrije dag: detectie via de 'unavailability'-occurrence =====
  // Een dag geldt als vrij zodra er een onbeschikbaarheids-occurrence
  // (data-type="unavailability" / class "unavailable") voor die datum bestaat.
  function elementIsFreeDayUnavailability(el) {
    if (!el || isOwnPopup(el)) return false;
    const type = (el.getAttribute && el.getAttribute('data-type')) || '';
    const cls = (el.className || '') + '';
    // Aanwezigheid van een onbeschikbaarheids-occurrence is genoeg (ongeacht tekst).
    return type === 'unavailability' || /\bunavailable\b/.test(cls);
  }
  // Alleen een GROTE onbeschikbaarheid (> 4 uur, bv. een vrije dag) schakelt de
  // gekleurde indeling uit; een kleine onbeschikbaarheid niet.
  const FREE_DAY_MIN_MINUTES = 240;
  function unavailabilityMinutes(el, col) {
    let mins = parseInt(el.getAttribute('data-duration'), 10);
    if (mins > 0) return mins;
    // Fallback: schat uit de gerenderde hoogte t.o.v. de 24-uurs dag-kolom.
    const h = col && (col.clientHeight || (col.getBoundingClientRect && col.getBoundingClientRect().height)) || 0;
    if (h > 0 && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      if (r.height > 0) return (r.height / h) * 24 * 60;
    }
    return 0;
  }
  function columnUnavailabilityMinutes(col) {
    if (!col) return 0;
    let total = 0; const seen = new Set();
    const add = (el) => {
      if (!elementIsFreeDayUnavailability(el)) return;
      const id = el.getAttribute('data-id') || (el.getAttribute('data-time') + '|' + el.getAttribute('data-date'));
      if (seen.has(id)) return; seen.add(id);
      total += unavailabilityMinutes(el, col);
    };
    try { col.querySelectorAll(ONS.unavailability).forEach(add); } catch (e) {}
    const date = col.getAttribute('data-date');
    if (date) {
      try { document.querySelectorAll('[data-type="unavailability"][data-date="' + date + '"], .js_calendar_occurrence.unavailable[data-date="' + date + '"]').forEach(add); } catch (e) {}
    }
    return total;
  }
  function dateHasFreeDayUnavailability(date) {
    const col = document.querySelector(ONS.dayColumn + '[data-date="' + date + '"]');
    return columnUnavailabilityMinutes(col || { getAttribute: () => date }) > FREE_DAY_MIN_MINUTES;
  }
  function dayColumnLooksFree(col) {
    if (!col) return false;
    return columnUnavailabilityMinutes(col) > FREE_DAY_MIN_MINUTES;
  }
  // Onthoud bij een klik op de agenda of de betrokken dag-kolom grijs/vrij is.
  // Deze klik gaat vooraf aan het openen van het nieuwe-afspraak-scherm.
  function trackCalendarClickForFreeDay(e) {
    const t = e.target;
    if (!t || (t.closest && isOwnPopup(t))) return;
    const col = t.closest && t.closest(ONS.dayColumn);
    if (!col) return;
    appointmentFreeDay = dayColumnLooksFree(col);
    appointmentFreeDayDate = col.getAttribute('data-date') || null;
  }
  document.addEventListener('click', trackCalendarClickForFreeDay, true);
  // Vangnet: bepaal (opnieuw) of de actieve afspraakdatum een grijze kolom is,
  // door in de achtergrond-agenda de kolom met dezelfde datum te controleren.
  function refreshFreeDayFromBackgroundCalendar() {
    if (!appointmentFreeDayDate) return;
    // Alleen upgraden naar 'vrij'; het wissen gebeurt via een klik op een
    // gewone dag-kolom (trackCalendarClickForFreeDay). Zo overschrijft een
    // achter-de-modal niet-gerenderde kolom nooit een terechte detectie.
    const col = document.querySelector('.day.js_day[data-date="' + appointmentFreeDayDate + '"]');
    if (col && dayColumnLooksFree(col)) appointmentFreeDay = true;
    else if (dateHasFreeDayUnavailability(appointmentFreeDayDate)) appointmentFreeDay = true;
  }
  function showFreeDayInactive() {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    const msg = document.createElement('div');
    msg.textContent = 'Vrije dag';
    Object.assign(msg.style, { fontWeight: '700', fontSize: '14px', color: '#555', padding: '4px 0 2px' });
    body.appendChild(msg);
    const sub = document.createElement('div');
    sub.textContent = 'Deze dag is grijs gemarkeerd. De afspraakhulp is hier niet actief.';
    Object.assign(sub.style, { fontSize: '12px', color: '#666', lineHeight: '1.35' });
    body.appendChild(sub);
    setSubmitBlocked(false);
    setStatus('Vrije dag — hulp inactief', false);
  }
  function updateSubmitGuard() {
    if (appointmentFreeDay) { setSubmitBlocked(false); return; }
    if (activeNonClientOption && activeNonClientOption.freeTitle) {
      setSubmitBlocked(!nonClientFreeTitleComplete(activeNonClientOption) || doorplannenBlocksSave());
      return;
    }
    const missing = activeNonClientOption ? !nonClientUursoortSet() : !hasUursoortSelected();
    setSubmitBlocked((shouldRequireUursoortForSubmit() && missing) || appointmentLabelRequiredButMissing() || doorplannenBlocksSave());
  }
  function isSubmitButtonNode(el) {
    let n = el;
    for (let i = 0; n && i < 8; i++) {
      if (n.nodeType === 1 && n.matches && n.matches('button[type="submit"], uc-button[type="submit"]')) return true;
      if (n.parentElement) n = n.parentElement;
      else {
        const root = n.getRootNode && n.getRootNode();
        n = root && root.host ? root.host : null;
      }
    }
    return false;
  }
  function blockSubmitIfNoUursoort(e) {
    if (!helperEnabled) return;
    if (appointmentFreeDay) return; // vrije/grijze dag: niet blokkeren
    if (isOwnPopup(e.target)) return;
    if (e.type === 'click' && !isSubmitButtonNode(e.target)) return;
    const doorplannenBlock = doorplannenBlocksSave();
    if (activeNonClientOption && activeNonClientOption.freeTitle) {
      if (nonClientFreeTitleComplete(activeNonClientOption) && !doorplannenBlock) { updateSubmitGuard(); return; }
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      updateSubmitGuard();
      if (!nonClientFreeTitleComplete(activeNonClientOption)) setStatus('Vul eerst de titel aan.', false);
      else { setStatus('Stel de herhaling in of zet doorplannen uit', false); try { highlightField(findRecurrenceField() || findRecurrenceHeader(), 5000); } catch (e2) {} }
      return;
    }
    const uursoortOk = !shouldRequireUursoortForSubmit() || (activeNonClientOption ? nonClientUursoortSet() : hasUursoortSelected());
    const labelMissing = appointmentLabelRequiredButMissing();
    if (uursoortOk && !labelMissing && !doorplannenBlock) { updateSubmitGuard(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    updateSubmitGuard();
    // Volgorde van meldingen: eerst label, dan uursoort, dan doorplannen.
    if (labelMissing) setStatus('Voeg eerst een label aan de afspraak toe.', false);
    else if (!uursoortOk) setStatus(activeNonClientOption ? 'Voeg nog een uursoort toe.' : 'Voeg eerst bij elke client een uursoort toe.', false);
    else { setStatus('Stel de herhaling in of zet doorplannen uit', false); try { highlightField(findRecurrenceField() || findRecurrenceHeader(), 5000); } catch (e2) {} }
  }
  function getTitleInput() {
    const ov = overrideEl('afsTitel'); if (ov) return ov;
    const labels = deepQueryAll('label,div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'titel');
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of deepQueryAll('input,textarea')) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        const r = rect(inp);
        if (r.top < lr.bottom - 6 || r.top - lr.bottom > 90) continue;
        if (Math.abs(r.left - lr.left) > 120) continue;
        const score = (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
        if (score < bestScore) { best = inp; bestScore = score; }
      }
    }
    if (best) return best;
    const byAttr = deepQueryAll('input,textarea').find((inp) => {
      if (!visible(inp) || isOwnPopup(inp)) return false;
      const text = clean([
        inp.getAttribute('aria-label'),
        inp.getAttribute('placeholder'),
        inp.getAttribute('name'),
        inp.getAttribute('id'),
        inp.getAttribute('title'),
      ].filter(Boolean).join(' '));
      return /\btitel\b/.test(text);
    });
    if (byAttr) return byAttr;
    const details = deepQueryAll('h1,h2,h3,div,span,p')
      .find((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'afspraakdetails');
    if (details) {
      const dr = rect(details);
      return deepQueryAll('input,textarea')
        .filter((inp) => visible(inp) && !isOwnPopup(inp))
        .filter((inp) => {
          const r = rect(inp);
          return r.top > dr.bottom && r.top - dr.bottom < 160 && Math.abs(r.left - dr.left) < 180;
        })
        .sort((a, b) => rect(a).top - rect(b).top)[0] || null;
    }
    return best;
  }
  function dateTodayText() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  }
  function timeNowText() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function getDateInput() {
    const ov = overrideEl('afsDatum'); if (ov) return ov;
    const host = deepQueryAll('uc-date-input[aria-label="Datum*"], uc-date-input[aria-label="Datum"]')
      .find((el) => visible(el) && !isOwnPopup(el));
    if (host && host.shadowRoot) {
      const inp = deepQueryAll('input', host.shadowRoot).find((i) => visible(i) && !isOwnPopup(i));
      if (inp) return inp;
    }
    return deepQueryAll('input').find((inp) => {
      if (!visible(inp) || isOwnPopup(inp)) return false;
      const label = clean(inp.getAttribute('aria-label') || '');
      const placeholder = clean(inp.getAttribute('placeholder') || '');
      return label === 'datum*' || label === 'datum' || placeholder === 'dd-mm-jjjj';
    }) || null;
  }
  // Geeft de uc-time-input host terug als inp daarin zit (shadow DOM).
  function ucTimeInputHost(inp) {
    if (!inp) return null;
    const root = inp.getRootNode && inp.getRootNode();
    const host = root && root.host;
    return (host && /uc-time-input/i.test(host.tagName || '')) ? host : null;
  }
  // Zoek de input binnen een uc-time-input host op basis van aria-label.
  function ucTimeInputFor(labelPattern) {
    for (const host of deepQueryAll('uc-time-input')) {
      if (!visible(host) || isOwnPopup(host)) continue;
      if (!labelPattern.test(clean(host.getAttribute('aria-label') || ''))) continue;
      if (host.shadowRoot) {
        const inp = host.shadowRoot.querySelector('input[placeholder="uu:mm"]') || host.shadowRoot.querySelector('input');
        if (inp) return inp;
      }
    }
    return null;
  }
  function getStartTimeInput() {
    const ov = overrideEl('afsBegintijd'); if (ov) return ov;
    // Directe lookup via uc-time-input[aria-label^="Begintijd"]
    const direct = ucTimeInputFor(/^begintijd/);
    if (direct) return direct;
    // Fallback: visueel label
    const labels = deepQueryAll('label,div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && /^begintijd\*?$/.test(clean(el.textContent || '')));
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of deepQueryAll('input')) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        if (clean(inp.getAttribute('placeholder') || '') !== 'uu:mm') continue;
        const r = rect(inp);
        if (r.top < lr.bottom - 8 || r.top - lr.bottom > 90) continue;
        if (Math.abs(r.left - lr.left) > 120) continue;
        const score = (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
        if (score < bestScore) { best = inp; bestScore = score; }
      }
    }
    if (best) return best;
    return timeInputsInOrder()[0] || null;
  }
  function isProtectedAppointmentStartInput(inp) {
    if (!inp || activeMode === 'registrations') return false;
    if (!/^(input|textarea)$/i.test(inp.tagName || '')) return false;
    // Directe check via uc-time-input host aria-label
    const host = ucTimeInputHost(inp);
    if (host) return /^begintijd/.test(clean(host.getAttribute('aria-label') || ''));
    // Fallback
    const meta = clean(`${inp.getAttribute('placeholder') || ''} ${inp.getAttribute('aria-label') || ''} ${inp.getAttribute('name') || ''} ${inp.id || ''}`);
    if (!/uu:mm|begintijd|start/.test(meta)) return false;
    const ir = rect(inp);
    return deepQueryAll('label,div,span,p').some((label) => {
      if (!visible(label) || isOwnPopup(label) || !/^begintijd\*?$/.test(clean(label.textContent || ''))) return false;
      const lr = rect(label);
      return ir.top >= lr.bottom - 10 && ir.top - lr.bottom <= 100 && Math.abs(ir.left - lr.left) <= 150;
    });
  }
  function getEndTimeInput() {
    const ov = overrideEl('afsEindtijd'); if (ov) return ov;
    const startInput = getStartTimeInput();
    // Directe lookup via uc-time-input[aria-label^="Eindtijd"]
    const direct = ucTimeInputFor(/^eindtijd/);
    if (direct && direct !== startInput) return direct;
    // Fallback: visueel label
    const startRect = startInput ? rect(startInput) : null;
    const labels = deepQueryAll('label,div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && /^eindtijd\*?$/.test(clean(el.textContent || '')));
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of deepQueryAll('input')) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        if (startInput && inp === startInput) continue;
        const meta = clean(`${inp.getAttribute('placeholder') || ''} ${inp.getAttribute('aria-label') || ''} ${inp.getAttribute('inputmode') || ''}`);
        const value = inputTextValue(inp);
        if (!/uu:mm|time|tijd|numeric/.test(meta) && !/^(\d{1,2}):(\d{2})$/.test(value)) continue;
        const r = rect(inp);
        if (r.top < lr.bottom - 16 || r.top - lr.bottom > 110) continue;
        if (Math.abs(r.left - lr.left) > 220) continue;
        if (startRect && Math.abs(r.top - startRect.top) < 24 && Math.abs(r.left - startRect.left) < 24) continue;
        const score = (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
        if (score < bestScore) { best = inp; bestScore = score; }
      }
    }
    if (best) return best;
    const ordered = timeInputsInOrder().filter((inp) => !startInput || inp !== startInput);
    if (startRect) {
      const rightOfStart = ordered.find((inp) => {
        const r = rect(inp);
        return Math.abs(r.top - startRect.top) < 40 && r.left > startRect.left + 40;
      });
      if (rightOfStart) return rightOfStart;
    }
    return ordered[1] || null;
  }
  function setAppointmentEndInputText(inp, text) {
    if (!inp) return false;
    const startInput = getStartTimeInput();
    if (startInput && inp === startInput) return false;
    // Gebruik dezelfde keystroke-simulatie als typeIntoSearchField: de uc-time-input
    // component is een gecontroleerd web-component dat alleen reageert op echte
    // beforeinput/input-events met composed:true; simpel .value zetten werkt niet
    // omdat de component bij de volgende render terug naar leeg gaat.
    typeIntoSearchField(inp, text);
    // Blur zodat de component de waarde commit (veel ControlValueAccessor-implementaties
    // slaan de waarde pas op bij blur).
    inp.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
    try { inp.blur && inp.blur(); } catch (e) {}
    // Notificeer ook de uc-time-input host direct
    const host = ucTimeInputHost(inp);
    if (host) {
      try { host.value = text; } catch (e) {}
      try { host.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(text) })); } catch (e) {}
      host.dispatchEvent(new Event('change', { bubbles: true }));
    }
    helperEndText = String(text); // onthoud wat de hulp als laatste in de eindtijd schreef
    return true;
  }
  function timeInputsInOrder() {
    return deepQueryAll('input')
      .filter((inp) => visible(inp) && !isOwnPopup(inp) && clean(inp.getAttribute('placeholder') || '') === 'uu:mm')
      .sort((a, b) => {
        const ar = rect(a), br = rect(b);
        return Math.abs(ar.top - br.top) > 8 ? ar.top - br.top : ar.left - br.left;
      });
  }
  function addOneHourText(value) {
    const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    const d = new Date();
    if (m) {
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    } else {
      d.setSeconds(0, 0);
    }
    d.setHours(d.getHours() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function addMinutesText(value, minutes) {
    const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return '';
    const d = new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    d.setMinutes(d.getMinutes() + minutes);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function setHuisbezoekEndTime() {
    const startInput = getStartTimeInput();
    const endInput = getEndTimeInput();
    if (!endInput) return false;
    const startText = startInput && (startInput.value || '').trim() ? startInput.value : '';
    if (!startText) return false;
    setInputTextComposed(endInput, addOneHourText(startText));
    return true;
  }
  function triggerHuisbezoekEndTime() {
    ensureDateAndStartTime();
    setHuisbezoekEndTime();
    setTimeout(setHuisbezoekEndTime, 120);
    setTimeout(setHuisbezoekEndTime, 350);
  }
  function ensureDateAndStartTime() {
    return false;
  }
  function hasAppointmentDate() {
    const dateInput = getDateInput();
    if (dateInput && /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(String(dateInput.value || dateInput.getAttribute('value') || dateInput.textContent || '').trim())) return true;
    return deepQueryAll('input,span,div,uc-date-input').some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const meta = clean(`${el.id || ''} ${el.getAttribute && (el.getAttribute('name') || '')} ${el.getAttribute && (el.getAttribute('aria-label') || '')} ${el.getAttribute && (el.getAttribute('placeholder') || '')}`);
      const text = String(('value' in el ? el.value : '') || (el.getAttribute && el.getAttribute('value')) || el.textContent || '').trim();
      if (!/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(text)) return false;
      return /datum|date|dd-mm-jjjj/.test(meta) || rect(el).width < 260;
    });
  }
  function hasAppointmentStartTime() {
    const startInput = getStartTimeInput();
    if (startInput && /^(\d{1,2}):(\d{2})$/.test(String(startInput.value || startInput.getAttribute('value') || startInput.textContent || '').trim())) return true;
    return !!appointmentStartTimeTextFromUi();
  }
  function appointmentStartTimeTextFromUi() {
    const labels = deepQueryAll('label,div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && /^begintijd\*?$/.test(clean(el.textContent || '')));
    for (const label of labels) {
      const lr = rect(label);
      const found = deepQueryAll('input,span,div,uc-time-input').find((el) => {
        if (!visible(el) || isOwnPopup(el) || el === label) return false;
        const text = String(('value' in el ? el.value : '') || (el.getAttribute && el.getAttribute('value')) || el.textContent || '').trim();
        if (!/^(\d{1,2}):(\d{2})$/.test(text)) return false;
        const r = rect(el);
        return r.top >= lr.bottom - 12 && r.top <= lr.bottom + 95 && Math.abs(r.left - lr.left) <= 180;
      });
      if (found) return String(('value' in found ? found.value : '') || (found.getAttribute && found.getAttribute('value')) || found.textContent || '').trim();
    }
    return '';
  }
  function appointmentCurrentStartTimeText() {
    const startInput = getStartTimeInput();
    return String((startInput && (startInput.value || startInput.getAttribute('value'))) || appointmentStartTimeTextFromUi() || '').trim();
  }
  function restoreAppointmentStartTime() {
    // Begintijd is user-owned: only read it for eindtijd calculations, never write it.
    return false;
  }
  function hasAppointmentPrereqs() {
    return hasClientInAppointment() && hasAppointmentDate() && hasAppointmentStartTime();
  }
  function hasAppointmentEndTime() {
    const endInput = getEndTimeInput();
    const text = String((endInput && 'value' in endInput ? endInput.value : '') || '').trim();
    return /^(\d{1,2}):(\d{2})$/.test(text);
  }
  function appointmentHasKnownLabel() {
    const trigger = getEtiketTrigger();
    if (!trigger) return false;
    const selected = selectedKnownLabels(trigger, allKnownLabels());
    if (selected.length) return true;
    const txt = clean(uiText(trigger) || trigger.textContent || '');
    return allKnownLabels().some((lbl) => txt.includes(clean(lbl)));
  }
  function appointmentReadyToSave() {
    return hasAppointmentPrereqs() && hasAppointmentEndTime() && hasUursoortSelected() && appointmentHasKnownLabel();
  }
  // 'Kern' van een toegepaste cliëntafspraak: alles behalve de eindtijd. De eindtijd
  // is op de opslaanpagina een normaal bewerkbaar veld; terwijl de medewerker die
  // overschrijft is hij even leeg/ongeldig. Zolang de kern staat, mag de refresh de
  // opslaanpagina NIET afbreken (anders springt hij terug naar het keuzemenu).
  function appointmentCoreApplied() {
    return hasAppointmentPrereqs() && hasUursoortSelected() && appointmentHasKnownLabel();
  }
  // Mag de opslaanpagina blijven staan bij een refresh?
  //  - Cliëntgebonden: de afspraak is klaar, of de kern (cliënt/tijd + uursoort +
  //    label) staat nog (de eindtijd mag de medewerker bewerken).
  //  - Niet-cliëntgebonden: er is een actieve niet-cliëntoptie (geen cliënt), en de
  //    afspraak heeft nog datum + begintijd. Zulke afspraken hebben géén cliënt en
  //    géén label, dus zonder deze tak brak de refresh de opslaanpagina af en sprong
  //    hij terug naar het eerste scherm.
  function appointmentSaveStageStillValid() {
    if (appointmentReadyToSave() || appointmentCoreApplied()) return true;
    if (activeNonClientOption && !hasClientInAppointment() && hasAppointmentDate() && hasAppointmentStartTime()) return true;
    return false;
  }
  function appointmentDateStartEndPresent() {
    return hasAppointmentDate() && hasAppointmentStartTime() && hasAppointmentEndTime();
  }
  // Cliëntafspraak zonder (herkend) label: opslaan blokkeren. Bewust fail-open:
  // niet-cliënt-opties (Overig/Acquisitie) en het geval waarin het labelveld niet
  // gevonden wordt, blokkeren we niet — dan zou opslaan onmogelijk kunnen worden.
  function appointmentLabelRequiredButMissing() {
    if (activeNonClientOption) return false;
    if (findClientEntries().length === 0) return false;
    if (!getEtiketTrigger()) return false;
    return !appointmentHasKnownLabel();
  }
  function findClientNameText() {
    const inviteeNames = deepQueryAll(UI_OVERRIDES.afsClientName || 'span[class*="_invitee-name_"], ._invitee-name_sohx9_40')
      .filter((el) => visible(el) && !isOwnPopup(el));
    for (const nameEl of inviteeNames) {
      const txt = (nameEl.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt) continue;
      const nr = rect(nameEl);
      const role = deepQueryAll('div,span,p').find((el) => {
        if (!visible(el) || isOwnPopup(el) || clean(el.textContent) !== 'client') return false;
        const rr = rect(el);
        return rr.top >= nr.bottom - 8 && rr.top <= nr.bottom + 45 && Math.abs(rr.left - nr.left) <= 130;
      });
      if (role) return txt;
      let n = nameEl.parentElement;
      for (let depth = 0; n && depth < 5; depth++, n = n.parentElement) {
        const r = rect(n);
        const t = clean(n.textContent || '');
        if (r.height <= 180 && t.includes('client') && !t.includes('medewerker')) return txt;
      }
    }
    return '';
  }
  // Voornaam/aanhef uit een cliëntnaam. ONS toont namen als "Mw. E.I.A Aalbers"
  // of "Dhr. RWC Aalbers"; de aanhef (Mw./Dhr./Mevr./Hr.) is geen voornaam, dus
  // die slaan we over. Wat overblijft (bij veel cliënten vaak de voorletters) is
  // prima als aanduiding.
  function firstNameFromName(name) {
    const tokens = String(name || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const TITLE = /^(mw|mevr|mevrouw|dhr|hr|meneer|mr|dr)\.?$/i;
    let i = 0;
    while (i < tokens.length - 1 && TITLE.test(tokens[i])) i++;
    return tokens[i] || tokens[0] || '';
  }
  function findClientFirstName() {
    const directName = findClientNameText();
    if (directName) return firstNameFromName(directName);
    const labels = deepQueryAll('div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'client');
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const el of deepQueryAll('div,span,p,strong,b')) {
        if (!visible(el) || isOwnPopup(el)) continue;
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const c = clean(txt);
        if (!txt || c === 'client' || c.includes('clienten') || c.includes('medewerker') || c.includes('uursoort')) continue;
        if (txt.length > 60 || txt.split(/\s+/).length > 4) continue;
        const r = rect(el);
        if (r.bottom < lr.top - 55 || r.bottom > lr.top + 8) continue;
        if (Math.abs(r.left - lr.left) > 120) continue;
        const score = Math.abs(lr.top - r.bottom) + Math.abs(lr.left - r.left) / 4;
        if (score < bestScore) { best = txt; bestScore = score; }
      }
    }
    return best ? firstNameFromName(best) : '';
  }
  function findClientFirstNames() {
    const names = [];
    const seen = new Set();
    for (const entry of findClientEntries()) {
      const first = entry.firstName || firstNameFromName(entry.name);
      const key = clean(first);
      if (first && !seen.has(key)) { seen.add(key); names.push(first); }
    }
    if (!names.length) {
      const first = findClientFirstName();
      if (first) names.push(first);
    }
    return names;
  }
  function setTitleForChoice(choice, onResult) {
    const input = getTitleInput();
    if (!input) { onResult(false); return; }
    const firstNames = findClientFirstNames();
    const titleBase = choice.titleLabel || choice.label;
    const title = firstNames.length ? `${titleBase} - ${firstNames.join(' - ')}` : titleBase;
    setInputText(input, title);
    onResult(true);
  }
  // Haal de voornaam van een verwijderde cliënt uit de titel. De titel is
  // opgebouwd als "Basis - Voornaam1 - Voornaam2"; we houden het eerste segment
  // (de basis) altijd, en verwijderen segmenten die gelijk zijn aan de voornaam.
  function removeFirstNameFromTitle(first) {
    if (!first) return;
    const input = getTitleInput(); if (!input) return;
    const t = String(input.value || '');
    if (!t) return;
    const parts = t.split(' - ');
    if (parts.length < 2) return; // alleen basis, geen namen om te verwijderen
    const target = clean(first);
    const kept = parts.filter((p, i) => i === 0 || clean(p) !== target);
    if (kept.length !== parts.length) {
      const n = kept.join(' - ');
      if (n !== t) setInputText(input, n);
    }
  }
  function fireKey(el, key) {
    if (!el) return;
    if (isProtectedAppointmentStartInput(el)) return;
    for (const type of ['keydown', 'keyup']) {
      try { el.dispatchEvent(new KeyboardEvent(type, { key, code: key, bubbles: true, cancelable: true })); } catch (e) {}
    }
  }
  function clickAt(x, y) {
    const el = document.elementFromPoint(x, y) || document.body;
    // Een blinde synthetische klik mag nooit impliciet de genodigdenzoeker openen.
    if (typeof isAddInviteeControl === 'function' && isAddInviteeControl(el) &&
        !intentionalAddClientClick && Date.now() >= allowInviteeModalUntil) {
      dbg('coördinaatklik op + Toevoegen voorkomen');
      return false;
    }
    for (const type of ['mousedown', 'mouseup', 'click']) {
      try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y })); } catch (e) {}
    }
    return true;
  }
  // Ligt onder dit punt een klikbaar/interactief element? Dan is het GEEN veilige
  // 'lege plek' om een dropdown mee te sluiten — een blinde klik erop zou bv. de
  // "+ Toevoegen"-knop (Genodigden) indrukken en de zoek-genodigden-modal openen.
  function interactiveAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    if (isProtectedAppointmentStartInput(el)) return true;
    if (/^(input|textarea|select|button|a)$/i.test(el.tagName || '')) return true;
    return !!(el.closest && el.closest('button,a,[role="button"],[role="combobox"],uc-button,uc-icon,[data-qa*="add" i],[class*="button" i]'));
  }
  function clickEmptyModalSpot() {
    const m = findModal();
    const panel = (m && (m.panel || m.host)) || document.body;
    const heading = deepQueryAll('h1,h2,h3,div,span', panel)
      .find((el) => visible(el) && !isOwnPopup(el) && /afspraakdetails|afspraak toevoegen|genodigden/i.test(el.textContent || ''));
    if (heading) {
      const hr = rect(heading);
      const hx = Math.round(hr.left + Math.min(24, Math.max(8, hr.width / 2)));
      const hy = Math.round(hr.top + hr.height / 2);
      if (!interactiveAtPoint(hx, hy)) { clickAt(hx, hy); return; }
    }
    // Zoek een aantoonbaar lege plek in de linker-bovenhoek van het paneel; klik
    // nooit als er een interactief element onder ligt.
    const r = rect(panel);
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = Math.round(r.left + Math.max(24, Math.min(r.width - 40, r.width * (0.1 + Math.random() * 0.22))));
      const y = Math.round(r.top + Math.max(14, Math.min(r.height - 40, 20 + Math.random() * 26)));
      if (!interactiveAtPoint(x, y)) { clickAt(x, y); return; }
    }
    // Geen veilige plek gevonden: liever niets doen dan per ongeluk een knop
    // indrukken. De dropdown sluit dan bij de volgende interactie.
  }
  function dismissOpenDropdowns() {
    // Stuur nooit een globale Escape: als er geen dropdown openstaat sluit ONS
    // daarmee de hele afspraak en toont het "Niet-opgeslagen wijzigingen".
    clickEmptyModalSpot();
  }
  // Opgeruimd (#3): de oude SVG-/geometrie-gebaseerde chip-verwijderhelpers
  // (isLabelRemovePath, labelRemovePaths, hasLabelRemoveSvg, visibleClickTargetForPath,
  // clickLabelRemoveSvgNear, clickSelectionRemoversNearText) zijn verwijderd. Labels
  // worden nu betrouwbaar via labelChips()/data-qa afgehandeld.
  function clearSelectField(trigger, backspaces = 4) {
    if (!trigger) return false;
    trigger.click(); try { trigger.focus && trigger.focus(); } catch (e) {}
    const activeEl = deepActive() || trigger;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) setInputText(activeEl, '');
    for (let i = 0; i < backspaces; i++) fireKey(activeEl, 'Backspace');
    fireKey(activeEl, 'Delete');
    return true;
  }
  function rowForOptionText(el, root) {
    let n = el;
    for (let depth = 0; n && n !== document.body && depth < 6; depth++, n = n.parentElement) {
      if (root && root !== n && root.contains && !root.contains(n)) break;
      if (!visible(n) || isOwnPopup(n)) continue;
      if (deepQueryAll('input,textarea', n).some((inp) => visible(inp) && !isOwnPopup(inp))) continue;
      const r = rect(n);
      const c = clean(optionText(n));
      if (r.width >= 140 && r.height >= 24 && r.height <= 70 && c && !/^zoek naar/.test(c)) return n;
      if (n.getAttribute && n.getAttribute('role') === 'option') return n;
    }
    return el;
  }
  function clickVisibleLabelOption(trigger, known, currentText) {
    const tr = rect(trigger);
    let best = null, bestScore = Infinity;
    for (const root of optionSearchRoots(trigger)) {
      for (const el of deepQueryAll('[role="option"],li,div,span,button', root)) {
        if (!visible(el) || isOwnPopup(el) || /input|textarea|select/i.test(el.tagName || '')) continue;
        const option = clean(optionText(el));
        if (!option) continue;
        const matchesKnown = known.includes(option) || known.some((label) => option === label || option.includes(label));
        const matchesCurrent = currentText && known.some((label) => currentText.includes(label) && option.includes(label));
        if (!matchesKnown && !matchesCurrent) continue;
        const row = rowForOptionText(el, root);
        if (!visible(row) || isOwnPopup(row)) continue;
        const r = rect(row);
        if (r.top < tr.bottom - 6 || r.width < 140 || r.height < 22 || r.height > 72) continue;
        if (clean(optionText(row)).includes('toont ') || clean(optionText(row)).includes('zoekterm')) continue;
        const selectedScore = /true/i.test(row.getAttribute('aria-selected') || '') || /selected|active|checked/i.test(row.className || '') ? -1000 : 0;
        const score = selectedScore + Math.abs(r.top - tr.bottom) + Math.abs(r.left - tr.left) / 5 + (clean(optionText(row)) === option ? 0 : 25);
        if (score < bestScore) { best = row; bestScore = score; }
      }
    }
    if (!best) return false;
    clickOption(best);
    return true;
  }
  // ÉÉN bron voor de gekozen labels. In de huidige ONS-UI is elke chip een
  // <button class="label-tag" aria-label="Verwijder label <naam>"> binnen
  // <div class="label-tags" data-qa="label_tags">; de button ZELF is de
  // verwijderknop (één klik = label weg). Val terug op <uc-tag deletable> (oudere
  // UI). Geeft [{ el, name }] terug met name = schoongemaakte labelnaam.
  function labelChips(trigger) {
    const tr = trigger ? rect(trigger) : null;
    const inField = (el) => {
      if (!tr) return true;
      const r = rect(el);
      return !(r.bottom < tr.top - 40 || r.top > tr.bottom + 90 || r.left < tr.left - 90 || r.right > tr.right + 200);
    };
    const out = [];
    const seen = new Set();
    const add = (el, rawName) => {
      if (!el || seen.has(el)) return;
      const name = clean(rawName || '').replace(/^verwijder label\s+/, '');
      if (!name) return;
      seen.add(el);
      out.push({ el: el, name: name });
    };
    // Low-code herstel: heeft de beheerder de labelchips via de UI-inspector
    // opnieuw aangewezen (sleutel 'afsLabelChips'), gebruik dan die elementen
    // rechtstreeks — geen geometrie/naam-heuristiek nodig.
    const ov = overrideAll('afsLabelChips');
    const source = (ov && ov.length)
      ? ov
      : deepQueryAll('button[aria-label^="Verwijder label" i], .label-tags button, [data-qa="label_tags"] button');
    for (const btn of source) {
      if (!visible(btn) || isOwnPopup(btn)) continue;
      if (!(ov && ov.length) && !inField(btn)) continue; // bij heuristiek: dicht bij het labelveld
      const al = btn.getAttribute('aria-label') || '';
      const m = /verwijder label\s+(.+)$/i.exec(al);
      add(btn, m ? m[1] : (btn.textContent || ''));
    }
    // Fallback: oudere UI met <uc-tag deletable> (verwijderknop in de shadow-root).
    if (!out.length && !(ov && ov.length)) {
      for (const tag of deepQueryAll(ONS.ucTagDeletable)) {
        if (!visible(tag) || isOwnPopup(tag) || !inField(tag)) continue;
        const btn = tag.shadowRoot && (tag.shadowRoot.querySelector('button') || tag.shadowRoot.querySelector('[part="button"]'));
        add(btn || tag, tag.textContent || '');
      }
    }
    return out;
  }
  function selectedKnownLabels(trigger, labels) {
    const known = labels.map(clean).filter(Boolean);
    const found = new Set();
    const chips = labelChips(trigger);
    if (chips.length) {
      for (const chip of chips) {
        for (const label of known) if (chip.name === label || chip.name.indexOf(label) !== -1) found.add(label);
      }
      return [...found];
    }
    // Fallback als de chips (nog) niet leesbaar zijn: tekst van het labelveld.
    const triggerText = clean(uiText(trigger) || (trigger && trigger.textContent) || '');
    for (const label of known) if (triggerText.includes(label)) found.add(label);
    return [...found];
  }
  // Klik gericht de verwijderknop van chips. Zonder `labels` (of lege lijst) worden
  // ALLE chips verwijderd; met labels alleen de matchende. Werkt op de echte
  // label-tag-buttons - geen coördinaatgokken of dropdown meer.
  function clickLabelChipRemovers(trigger, labels) {
    const wanted = (labels || []).map(clean).filter(Boolean);
    const chips = labelChips(trigger);
    let clicked = false;
    for (const chip of chips) {
      if (wanted.length && !wanted.some((w) => chip.name === w || chip.name.indexOf(w) !== -1)) continue;
      clickOption(chip.el);
      clicked = true;
    }
    return clicked;
  }
  // Alleen zóeken (geen klik) naar de best passende optie. Zo kunnen we pollen
  // tot de optie echt gerenderd is (op productie laden lijsten trager) i.p.v.
  // met een vaste vertraging één keer te proberen en te falen.
  function findExactDropdownOption(trigger, texts) {
    const wanted = texts.map(clean).filter(Boolean);
    if (!wanted.length) return null;
    const tr = rect(trigger);
    let best = null, bestScore = Infinity;
    for (const root of optionSearchRoots(trigger)) {
      for (const el of genericOptionCandidates(root)) {
        if (!visible(el) || isOwnPopup(el) || /input|textarea|select/i.test(el.tagName || '')) continue;
        const row = rowForOptionText(el, root);
        if (!visible(row) || isOwnPopup(row)) continue;
        const txt = clean(optionText(row) || optionText(el));
        if (/toont |zoekterm|zoek naar|geen resultaten/.test(txt)) continue;
        const matches = wanted.some(function (w) {
          if (!w) return false;
          if (txt === w || txt.includes(w) || w.includes(txt)) return true;
          // token-overlap: deel de gewenste naam in woorden (zonder afkortingspunten)
          // en eis dat het eerste betekenisvolle woord in de optietekst voorkomt.
          const tokens = w.replace(/[.*]/g, ' ').split(/\s+/).filter(function (t) { return t.length >= 4; });
          return tokens.length > 0 && tokens.every(function (t) { return txt.indexOf(t) !== -1; });
        });
        if (!matches) continue;
        const r = rect(row);
        if (r.top < tr.top - 500 || r.top > tr.bottom + 600) continue; // te ver weg
        if (r.width < 120 || r.height < 20 || r.height > 80) continue;
        const selectedScore = /true/i.test(row.getAttribute('aria-selected') || '') || /selected|active|checked/i.test(row.className || '') ? -1000 : 0;
        const exactScore = wanted.includes(txt) ? -500 : 0;
        const distToTrigger = Math.min(Math.abs(r.top - tr.bottom), Math.abs(r.bottom - tr.top));
        const score = selectedScore + exactScore + distToTrigger + Math.abs(r.left - tr.left) / 4;
        if (score < bestScore) { best = row; bestScore = score; }
      }
    }
    return best;
  }
  function clickExactDropdownOption(trigger, texts) {
    const best = findExactDropdownOption(trigger, texts);
    if (!best) return false;
    clickOption(best);
    return true;
  }
  function clearKnownLabels(onDone, attempt = 0) {
    const trigger = getEtiketTrigger();
    if (!trigger) { if (onDone) onDone(false); return; }
    const chips = labelChips(trigger);
    if (!chips.length) { if (onDone) onDone(true); return; }
    // Klik elke chip-verwijderknop één keer. NOOIT via de dropdown wissen: een klik
    // op een dropdown-optie ZET het label juist - dat was de bug waarbij 'Verwijder
    // instellingen' (na handmatig verwijderen) het label terugplaatste.
    for (const chip of chips) clickOption(chip.el);
    setTimeout(() => {
      if (!labelChips(trigger).length) { clickEmptyModalSpot(); if (onDone) onDone(true); return; }
      if (attempt >= 4) { clickEmptyModalSpot(); if (onDone) onDone(false); return; }
      clearKnownLabels(onDone, attempt + 1);
    }, 150);
  }
  // Vind de daadwerkelijk geselecteerde optie(s) in de open dropdown, ONGEACHT
  // of de tekst als 'uursoort' herkend wordt. De oude aanpak zocht binnen
  // optionCandidates(), dat elke optie eerst door looksLikeUursoortOption haalt;
  // stond de geselecteerde uursoort daar niet in, dan werd hij nooit gevonden en
  // faalde het deselecteren keer op keer.
  function selectedUursoortOptionEls(openedBy, trigger) {
    const out = [];
    const seen = new Set();
    const consider = (o) => {
      if (!o || seen.has(o) || !visible(o) || isOwnPopup(o)) return;
      const isSel = /true/i.test(o.getAttribute('aria-selected') || '') || /(^|\s)(selected|active|checked)(\s|$)/i.test(o.className || '');
      if (!isSel) return;
      const t = clean(optionText(o));
      if (!t || /toont |zoekterm|zoek naar|geen resultaten/.test(t)) return;
      seen.add(o); out.push(o);
    };
    for (const root of optionSearchRoots(openedBy).concat(optionSearchRoots(trigger))) {
      for (const o of deepQueryAll('[role="option"], li[aria-selected], li.selected', root)) consider(o);
    }
    // Laatste redmiddel: virtualisatiecontainers vallen soms buiten
    // optionSearchRoots. Scan dan document-breed naar aria-selected opties
    // vlakbij de trigger.
    if (!out.length && trigger) {
      const tr = rect(trigger);
      for (const o of deepQueryAll('[role="option"][aria-selected="true"], li[aria-selected="true"]')) {
        const r = rect(o);
        if (r.top < tr.top - 40 || r.top > tr.bottom + 600) continue;
        consider(o);
      }
    }
    return out;
  }
  function clearUursoortSearchInput(openedBy, trigger) {
    for (const root of optionSearchRoots(openedBy).concat(optionSearchRoots(trigger))) {
      const inp = deepQueryAll('input,textarea', root).find((i) => visible(i) && !isOwnPopup(i));
      if (inp) { try { inp.focus(); } catch (e) {} setInputText(inp, ''); return true; }
    }
    return false;
  }
  function clearUursoort(onDone, triggerArg = null) {
    const trigger = triggerArg || getUursoortTrigger();
    if (!trigger) { if (onDone) onDone(); return; }
    const currentText = clean(uiText(trigger));
    const openedBy = openSelectCombobox(trigger) || trigger;
    setTimeout(() => {
      let clicked = false;
      // 1) Primair: klik de geselecteerde optie (aria-selected) om te
      //    deselecteren. Precies één klik -> het is een toggle.
      const selectedEls = selectedUursoortOptionEls(openedBy, trigger);
      dbg('clearUursoort: geselecteerde opties', selectedEls.length, 'huidig:', currentText);
      if (selectedEls.length) {
        clickOption(selectedEls[0]);
        clicked = true;
      }
      // 2) Fallback: tekst-match tegen de huidige veldwaarde.
      if (!clicked) {
        for (const root of optionSearchRoots(openedBy).concat(optionSearchRoots(trigger))) {
          const options = optionCandidates(root);
          const sameText = options.find((o) => currentText && clean(optionText(o)) && currentText.includes(clean(optionText(o))));
          if (sameText) { clickOption(sameText); clicked = true; break; }
        }
      }
      if (!clicked) { dbg('clearUursoort: geen optie gevonden, val terug op leegmaken veld'); clearSelectField(trigger, 5); }
      // 3) Zoekbalk in de dropdown leegmaken (na deselecteren), dan sluiten.
      setTimeout(() => {
        clearUursoortSearchInput(openedBy, trigger);
        setTimeout(() => { clickEmptyModalSpot(); if (onDone) onDone(); }, 80);
      }, 90);
    }, 120);
  }
  function clearTitle() {
    const input = getTitleInput();
    if (!input) return false;
    try { input.focus(); } catch (e) {}
    try { input.select && input.select(); } catch (e) {}
    setInputTextComposed(input, '');
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Delete', code: 'Delete' }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Delete', code: 'Delete' }));
    setTimeout(() => {
      if ((input.value || '') !== '') setInputTextComposed(input, '');
      try { input.blur && input.blur(); } catch (e) {}
    }, 60);
    return true;
  }
  function clearEndTime() {
    const input = getEndTimeInput();
    if (!input) return false;
    setInputTextComposed(input, '');
    return true;
  }
  function setAppointmentEndTimePlusMinutes(minutes) {
    const startText = String(appointmentCurrentStartTimeText() || activeAppointmentStartTimeText || '').trim();
    if (!/^(\d{1,2}):(\d{2})$/.test(startText)) return false;
    activeAppointmentStartTimeText = startText;
    restoreAppointmentStartTime();
    const next = addMinutesText(startText, minutes);
    if (!next) return false;
    const apply = () => {
      const fresh = getEndTimeInput();
      if (!fresh) return false;
      return setAppointmentEndInputText(fresh, next);
    };
    const ok = apply();
    [80, 220, 420].forEach((delay) => setTimeout(() => {
      const fresh = getEndTimeInput();
      if (fresh && inputTextValue(fresh) !== next) setAppointmentEndInputText(fresh, next);
    }, delay));
    return ok;
  }
  function enforceAppointmentEndTime(minutes) {
    if (!minutes) return false;
    if (appointmentEndTimeUserOwned) return false; // medewerker bezit de eindtijd: niet terugzetten
    // Ververs begintijd vanuit DOM bij elke poging (gebruiker vult start misschien pas later in).
    const fresh = appointmentCurrentStartTimeText();
    if (fresh) activeAppointmentStartTimeText = fresh;
    const startText = String(activeAppointmentStartTimeText || '').trim();
    if (!/^(\d{1,2}):(\d{2})$/.test(startText)) return false;
    restoreAppointmentStartTime();
    const wanted = addMinutesText(startText, minutes);
    const endInput = getEndTimeInput();
    if (!wanted || !endInput) return false;
    const current = inputTextValue(endInput);
    // Heeft de hulp de eindtijd al eens vastgelegd (helperEndText) én staat er nu
    // een andere geldige waarde? Dan heeft de medewerker hem zelf aangepast: overnemen
    // en niet meer terugzetten (voorkomt dat een herhaling de eindtijd reset).
    if (helperEndText && /^(\d{1,2}):(\d{2})$/.test(current) && current !== helperEndText) {
      appointmentEndTimeUserOwned = true;
      return false;
    }
    if (current !== wanted) setAppointmentEndInputText(endInput, wanted); // schrijft + onthoudt helperEndText
    else helperEndText = wanted; // al goed: leg dit vast als hulp-waarde
    return true;
  }
  function scheduleAppointmentEndTime(minutes) {
    activeAppointmentDurationMinutes = minutes || activeAppointmentDurationMinutes;
    if (!activeAppointmentDurationMinutes) return;
    appointmentTimeGuardTimers.forEach((timer) => clearTimeout(timer));
    appointmentTimeGuardTimers = [];
    [0, 140, 420].forEach((delay) => {
      const timer = setTimeout(() => safe(() => {
        restoreAppointmentStartTime();
        enforceAppointmentEndTime(activeAppointmentDurationMinutes);
      }), delay);
      appointmentTimeGuardTimers.push(timer);
    });
  }
  function appointmentTravelInput(kind) {
    const ov = overrideEl(kind === 'heen' ? 'afsTravelBefore' : 'afsTravelAfter'); if (ov) return ov;
    const wanted = kind === 'heen' ? 'reistijd heen' : 'reistijd terug';
    const labels = deepQueryAll('label,div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent || '') === wanted);
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of deepQueryAll('input')) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        const meta = clean(`${inp.getAttribute('placeholder') || ''} ${inp.getAttribute('inputmode') || ''} ${inp.getAttribute('aria-label') || ''} ${inp.getAttribute('role') || ''}`);
        if (!/min|decimal|spinbutton|reistijd/.test(meta)) continue;
        const r = rect(inp);
        if (r.top < lr.bottom - 18 || r.top > lr.bottom + 120 || Math.abs(r.left - lr.left) > 240) continue;
        const score = Math.abs(r.top - lr.bottom) * 4 + Math.abs(r.left - lr.left);
        if (score < bestScore) { best = inp; bestScore = score; }
      }
    }
    if (best) return best;
    const allDirect = deepQueryAll('input').filter((inp) => {
      if (isOwnPopup(inp)) return false;
      const label = clean(inp.getAttribute('aria-label') || '');
      const placeholder = clean(inp.getAttribute('placeholder') || '');
      return label === wanted && (!placeholder || placeholder === 'min');
    });
    const direct = allDirect.find((inp) => visible(inp) && (/decimal/i.test(inp.getAttribute('inputmode') || '') || /spinbutton/i.test(inp.getAttribute('role') || ''))) ||
      allDirect.find(visible) ||
      allDirect[0];
    if (direct) return direct;
    const host = deepQueryAll('[aria-label]').find((el) => !isOwnPopup(el) && clean(el.getAttribute('aria-label') || '') === wanted);
    if (host && host.shadowRoot) {
      const inner = deepQueryAll('input', host.shadowRoot).find((inp) => !isOwnPopup(inp));
      if (inner) return inner;
    }
    return null;
  }
  function appointmentTravelStepperButton(input, dir) {
    if (!input) return null;
    const ir = rect(input);
    const buttons = deepQueryAll('button,[role="button"],uc-button')
      .filter((btn) => visible(btn) && !isOwnPopup(btn))
      .map((btn) => ({ btn, r: rect(btn), text: clean(btn.textContent || btn.getAttribute('aria-label') || btn.getAttribute('title') || '') }))
      .filter(({ r }) => r.top < ir.bottom + 10 && r.bottom > ir.top - 10 && r.left >= ir.left - 4 && r.left <= ir.right + 130);
    const plus = buttons.filter((b) => /\+|plus|verhoog|increase|increment/.test(b.text)).sort((a, b) => a.r.left - b.r.left).pop();
    const minus = buttons.filter((b) => /\u2212|-|min|verlaag|decrease|decrement/.test(b.text)).sort((a, b) => a.r.left - b.r.left)[0];
    if (dir > 0) return (plus && plus.btn) || buttons.sort((a, b) => b.r.left - a.r.left)[0]?.btn || null;
    return (minus && minus.btn) || buttons.sort((a, b) => a.r.left - b.r.left)[0]?.btn || null;
  }
  function clickTravelStepperToValue(input, wanted) {
    if (!input) return false;
    const current = Number.parseInt(inputTextValue(input) || '0', 10);
    if (!Number.isFinite(current) || current === wanted) return current === wanted;
    const diff = wanted - current;
    const btn = appointmentTravelStepperButton(input, diff);
    if (!btn) return false;
    const count = Math.min(Math.abs(diff), 80);
    for (let i = 0; i < count; i++) clickOption(btn);
    return true;
  }
  function setAppointmentTravelTotalMinutes(totalMinutes) {
    const there = appointmentTravelInput('heen');
    const back = appointmentTravelInput('terug');
    if (!there || !back) return false;
    const thereText = String(Math.ceil(totalMinutes / 2));
    const backText = String(Math.floor(totalMinutes / 2));
    setInputTextOnsVerified(there, thereText);
    setInputTextOnsVerified(back, backText);
    setTimeout(() => {
      if (inputTextValue(there) !== thereText) clickTravelStepperToValue(there, Number(thereText));
      if (inputTextValue(back) !== backText) clickTravelStepperToValue(back, Number(backText));
    }, 180);
    setTimeout(() => {
      if (inputTextValue(there) !== thereText) clickTravelStepperToValue(there, Number(thereText));
      if (inputTextValue(back) !== backText) clickTravelStepperToValue(back, Number(backText));
    }, 460);
    return true;
  }
  function clearAppointmentTravelTimes() {
    const fields = [appointmentTravelInput('heen'), appointmentTravelInput('terug')].filter(Boolean);
    if (!fields.length) return true;
    for (const field of fields) setInputTextQuiet(field, '0');
    return true;
  }
  function clearSettings() {
    appointmentClearingSettings = true;
    appointmentAwaitingManualUursoort = false;
    // Breek een eventueel lopende uursoort-wachtrij af en geef de guard-flags vrij.
    // Anders blijft 'uursoortQueueActive' op true hangen en loopt de vólgende
    // afspraak vast op "Uursoorten uit cliëntkaart laden..." (pagina-refresh nodig).
    uursoortQueueGen++; uursoortQueueActive = false; uursoortQueueCooldownUntil = 0; appointmentFlowBusy = false;
    // Prefetch-dedup vrijgeven: na 'Verwijder instellingen' mogen de uursoorten opnieuw op
    // de achtergrond worden opgewarmd, zodat het opnieuw kiezen van een afspraaktype geen
    // zichtbaar "Uursoort laden" meer geeft (de product_list-cache zelf blijft geldig).
    _prefetchedNames = Object.create(null);
    // Keuze vergeten: anders vult handleClientListChanges bij een later
    // toegevoegde cliënt automatisch weer titel/label van de vorige keuze in.
    pendingChoice = null;
    appointmentTypeApplied = false;
    helperEndText = ''; appointmentEndTimeUserOwned = false; // eindtijd-guard opnieuw scherpstellen
    activeNonClientOption = null;
    showLoadingState('Instellingen verwijderen...');
    setStatus('Instellingen verwijderen...');
    activeAppointmentDurationMinutes = null;
    activeAppointmentStartTimeText = '';
    appointmentTimeGuardTimers.forEach((timer) => clearTimeout(timer));
    appointmentTimeGuardTimers = [];
    const afterOpen = () => {
      const titleOk = clearTitle();
      const endTimeOk = clearEndTime();
      const travelOk = clearAppointmentTravelTimes();
      clearKnownLabels((labelOk) => clearAllUursoorten(() => {
        appointmentClearingSettings = false;
        showChoices();
        const msg = ['Instellingen verwijderd'];
        if (!titleOk) msg.push('titel niet gevonden');
        if (!endTimeOk) msg.push('eindtijd niet gevonden');
        if (!travelOk) msg.push('reistijd niet gevonden');
        if (!labelOk) msg.push('label niet verwijderd');
        invalidateClientEntries();
        // Warm de uursoort-cache meteen weer op voor de huidige cliënten, zodat de picker
        // na het opnieuw kiezen direct gevuld is (achtergrond-call tijdens showChoices).
        try { maybePrefetchUursoorten(); } catch (e) {}
        if (anyUursoortPresent()) msg.push('verwijder zelf nog eventueel de uursoorten');
        setStatus(msg.join(' | '), titleOk && endTimeOk && travelOk && labelOk);
      }));
    };
    if (hasClientInAppointment() && uursoortContexts().length < findClientEntries().length) ensureClientExpanded(() => afterOpen());
    else afterOpen();
  }
  function clientCardFor(nameEl, role, nextTop) {
    const nr = rect(nameEl);
    const wantedName = clean(nameEl.textContent || '');
    // De kaart mag niet doorlopen tot in de volgende client; daarmee
    // voorkomen we dat de bovenste client een kaart krijgt die ook de
    // velden van de volgende client (en dus een verkeerde trigger) bevat.
    const bottomLimit = Number.isFinite(nextTop) ? nextTop - 2 : Infinity;
    let best = null, bestScore = Infinity;
    let n = nameEl.parentElement;
    for (let depth = 0; n && n !== document.body && depth < 14; depth++, n = n.parentElement) {
      if (!visible(n) || isOwnPopup(n)) continue;
      const r = rect(n);
      const t = clean(n.textContent || '');
      if (!t.includes(wantedName) || !t.includes('client')) continue;
      if (r.width < 260 || r.width > 900 || r.height < 42 || r.height > 620) continue;
      if (r.right < nr.left + 280 || r.top > nr.top + 4 || r.bottom < rect(role).bottom) continue;
      if (r.bottom > bottomLimit) continue; // reikt tot in de volgende client -> afwijzen
      const fieldBonus = t.includes('uursoort') ? -90000 : 0;
      const staffPenalty = t.includes('medewerker') ? 350000 : 0;
      const score = area(n) + depth * 1000 + staffPenalty + fieldBonus;
      if (score < bestScore) { best = n; bestScore = score; }
    }
    return best;
  }
  function findUursoortTriggerForClient(entry, nextTop) {
    const roleRect = rect(entry.role);
    const upper = Number.isFinite(nextTop) ? Math.max(roleRect.bottom + 40, nextTop - 10) : roleRect.bottom + 280;
    // Als er een geldige clientkaart is, ALLEEN daarbinnen zoeken. Het uursoort-veld
    // hoort altijd in de kaart van de client; terugvallen op document pakt anders
    // soms een veld van een andere client of iets achter de modal.
    const cardRect = entry.card ? rect(entry.card) : null;
    const insideCard = (r) => !cardRect ||
      (r.top >= cardRect.top - 4 && r.bottom <= cardRect.bottom + 4 &&
       r.left >= cardRect.left - 4 && r.right <= cardRect.right + 4);
    const roots = entry.card ? [entry.card] : [document];
    let best = null, bestScore = Infinity;
    for (const root of roots) {
      for (const label of deepQueryAll('label,div,span,p', root)) {
        if (!visible(label) || isOwnPopup(label) || clean(label.textContent) !== 'uursoort') continue;
        const lr = rect(label);
        if (lr.top < roleRect.bottom - 4 || lr.top > upper) continue;
        if (Math.abs(lr.left - roleRect.left) > 120) continue;
        if (!insideCard(lr)) continue;
        for (const el of deepQueryAll('input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,[class*="select" i],div,span', root)) {
          if (!visible(el) || isOwnPopup(el)) continue;
          const box = clickBoxFor(el);
          if (!isUsableBox(box)) continue;
          const br = rect(box);
          if (br.top < lr.bottom - 8 || br.top - lr.bottom > 95 || br.top > upper) continue;
          if (Math.abs(br.left - lr.left) > 110) continue;
          if (!insideCard(br)) continue;
          const text = clean(uiText(box));
          if (/toeslag|verwijder uit selectie|niet beschikbaar|clienten zijn aanwezig|toevoegen/.test(text)) continue;
          const score = (br.top - lr.bottom) * 25 + Math.abs(br.left - lr.left) + area(box) / 1000;
          if (score < bestScore) { best = box; bestScore = score; }
        }
      }
    }
    return best;
  }
  function isAddInviteeControl(el) {
    if (!el) return false;
    const t = clean(uiText(el) || el.textContent || '');
    const qa = clean((el.getAttribute && el.getAttribute('data-qa')) || '');
    // De uitklap-toggle heet "toggle-invitee-fields-button"; die is juist wel
    // gewenst. Alleen de daadwerkelijke toevoegknop weren.
    if (/toggle-invitee-fields/.test(qa)) return false;
    return /^\+?\s*toevoegen$|genodigde? toevoegen/.test(t) || /(^|[^a-z])add([^a-z]|$)|add-invitee|add_invitee/.test(qa);
  }
  function clickInviteeToggle(btn) {
    if (isAddInviteeControl(btn)) { dbg('clickInviteeToggle overslaan: is + Toevoegen'); return; }
    try { btn.focus && btn.focus(); } catch (e) {}
    const inner = btn.shadowRoot && btn.shadowRoot.querySelector('button');
    if (inner) clickOption(inner);
    else clickOption(btn);
  }
  function inviteeToggleExpanded(btn) {
    if (!btn) return null;
    const inner = btn.shadowRoot && btn.shadowRoot.querySelector('button');
    const nodes = [btn, inner].filter(Boolean);
    for (const node of nodes) {
      const expanded = node.getAttribute && node.getAttribute('aria-expanded');
      if (expanded === 'true') return true;
      if (expanded === 'false') return false;
      const label = clean((node.getAttribute && node.getAttribute('aria-label')) || '');
      if (label.includes('verbergen')) return true;
      if (label.includes('weergeven') || label.includes('tonen')) return false;
    }
    return null;
  }
  let _clientEntriesCache = null, _clientEntriesAt = 0;
  const CLIENT_ENTRIES_TTL = 250; // ms
  function invalidateClientEntries() { _clientEntriesCache = null; }
  function findClientEntries() {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (_clientEntriesCache && (now - _clientEntriesAt) < CLIENT_ENTRIES_TTL) return _clientEntriesCache;
    const res = _findClientEntriesUncached();
    _clientEntriesCache = res; _clientEntriesAt = now;
    return res;
  }
  // Eén centrale, benoemde toestand voor de cliënt-uursoort-flow. Dit is de
  // "waarheidsbron" die 1-op-1 overeenkomt met de los geteste agendaModel-reader
  // (agendaModel.js / agendaModel.test.js). De wachtrij en de gereed-checks
  // baseren zich hierop i.p.v. op losse ad-hoc checks.
  //   NEEDS_PREREQS  - nog geen cliënten in de modal
  //   CHOICE         - cliënten aanwezig, niemand heeft een uursoort -> keuze tonen
  //   MIXED          - sommige cliënten gezet, andere nog niet -> deel resteert
  //   READY_TO_SAVE  - cliënten aanwezig en allemaal een uursoort
  function computeAppointmentUursoortState() {
    invalidateClientEntries();
    const entries = findClientEntries();
    if (!entries.length) return 'NEEDS_PREREQS';
    const setCount = entries.filter(entryUursoortIsSet).length;
    if (setCount === 0) return 'CHOICE';
    if (setCount === entries.length) return 'READY_TO_SAVE';
    return 'MIXED';
  }
  // Nieuwe ONS-modal: iedere cliënt staat in een eigen li onder
  // ul._selected-clients_*. Gebruik deze structurele relatie als primaire route;
  // zo is Afspraakhulp niet afhankelijk van afstanden/afmetingen op het scherm.
  function findClientEntriesFromModalStructure() {
    // Low-code herstel: cliëntlijst-rijen via de UI-inspector (sleutel 'afsClientList').
    const ovRows = overrideAll('afsClientList');
    const rows = (ovRows && ovRows.length)
      ? ovRows
      : deepQueryAll('ul[class*="_selected-clients_"] > li, ul[data-qa="selected_clients"] > li')
        .filter((row) => visible(row) && !isOwnPopup(row));
    const entries = [];
    const seen = new Set();
    for (const row of rows) {
      const nameEl = deepQueryAll(UI_OVERRIDES.afsClientName || 'span[class*="_invitee-name_"], [class*="_invitee-name_"]', row)
        .find((el) => visible(el) && !isOwnPopup(el) && (el.textContent || '').trim());
      if (!nameEl) continue;
      const name = (nameEl.textContent || '').replace(/\s+/g, ' ').trim();
      const key = clean(name);
      if (!key || seen.has(key)) continue;
      const role = deepQueryAll('div,span,p', row)
        .find((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent || '') === 'client') || nameEl;
      const toggle = deepQueryAll(UI_OVERRIDES.afsInviteeToggle || '[data-qa="toggle-invitee-fields-button"]', row)
        .find((el) => visible(el) && !isOwnPopup(el)) || null;
      let uursoortTrigger = deepQueryAll('uc-select[data-qa="hour_type_select"], [data-qa="hour_type_select"]', row)
        .find((el) => visible(el) && !isOwnPopup(el)) || null;
      seen.add(key);
      const entry = {
        name,
        firstName: firstNameFromName(name),
        nameEl,
        role,
        toggle,
        card: row,
        clientId: row.getAttribute('data-invitee-id') || row.getAttribute('data-client-id') || row.getAttribute('data-patient-id') || null,
        uursoortTrigger,
      };
      // Fallback: een leeg uursoort-veld ("Zoek naar uursoorten") heeft niet altijd
      // data-qa="hour_type_select". Zonder deze fallback bleef de trigger van bv.
      // cliënt 3 leeg en werd die cliënt in de wachtrij overgeslagen.
      if (!entry.uursoortTrigger) entry.uursoortTrigger = findUursoortTriggerForClient(entry, Infinity);
      entries.push(entry);
    }
    return entries;
  }
  // Betrouwbare "heeft deze cliënt al een uursoort?"-check op STABIELE signalen
  // (geen geometrie meer). Bewezen uit de ONS-DOM:
  //  1) een gekozen uursoort verschijnt als light-DOM samenvatting in de kaart
  //     (div[slot="sub"] > [class*="_summary_"]); een leeg veld heeft die niet.
  //  2) backup: de uc-select-combobox houdt class "placeholder" zolang leeg.
  function entryUursoortIsSet(entry) {
    if (!entry) return false;
    if (entry.card) {
      const summary = deepQueryAll('[class*="_summary_"]', entry.card)
        .find((el) => !isOwnPopup(el) && clean(el.textContent || ''));
      if (summary) return true;
    }
    const trg = entry.uursoortTrigger;
    if (trg) {
      const combo = (trg.shadowRoot && trg.shadowRoot.querySelector('[role="combobox"]')) ||
        deepQueryAll('[role="combobox"]', trg).find((el) => !isOwnPopup(el));
      if (combo) {
        const isPlaceholder = combo.classList.contains('placeholder');
        // Signaal 3 (bevestigd uit snapshots, gelijk aan agendaModel-reader):
        // de geneste uc-select-list draagt value="" zolang leeg, value="713" e.d.
        // zodra gekozen. Defensieve OR: niet-placeholder + niet-lege value = gezet.
        const listEl = deepQueryAll('uc-select-list', trg).find((el) => !isOwnPopup(el)) ||
          (entry.card && deepQueryAll('uc-select-list', entry.card).find((el) => !isOwnPopup(el)));
        const val = listEl ? (listEl.getAttribute('value') || '') : '';
        if (!isPlaceholder && val) return true;
        return !isPlaceholder;
      }
    }
    return false;
  }
  function _findClientEntriesUncached() {
    const structural = findClientEntriesFromModalStructure();
    if (structural.length) return structural;
    const nameEls = deepQueryAll('span[class*="_invitee-name_"], ._invitee-name_sohx9_40')
      .filter((el) => visible(el) && !isOwnPopup(el));
    const toggles = deepQueryAll(UI_OVERRIDES.afsInviteeToggle || 'uc-button[data-qa="toggle-invitee-fields-button"], [data-qa="toggle-invitee-fields-button"]')
      .filter((btn) => visible(btn) && !isOwnPopup(btn));
    const basics = [];
    const seen = new Set();
    for (const nameEl of nameEls) {
      const name = (nameEl.textContent || '').replace(/\s+/g, ' ').trim();
      if (!name || seen.has(name)) continue;
      const nr = rect(nameEl);
      const role = deepQueryAll('div,span,p').find((el) => {
        if (!visible(el) || isOwnPopup(el) || clean(el.textContent) !== 'client') return false;
        const rr = rect(el);
        return rr.top >= nr.bottom - 8 && rr.top <= nr.bottom + 48 && Math.abs(rr.left - nr.left) <= 150;
      });
      if (!role) continue;
      const toggle = toggles.find((btn) => clean(btn.getAttribute('aria-label') || '').includes(clean(name))) ||
        toggles
          .map((btn) => ({ btn, r: rect(btn) }))
          .filter(({ r }) => r.left > nr.left + 240 && r.top >= nr.top - 90 && r.top <= nr.top + 90)
          .sort((a, b) => Math.abs((a.r.top + a.r.height / 2) - (nr.top + nr.height / 2)) - Math.abs((b.r.top + b.r.height / 2) - (nr.top + nr.height / 2)))[0]?.btn || null;
      seen.add(name);
      basics.push({ name, firstName: firstNameFromName(name), nameEl, role, toggle });
    }
    const sorted = basics.sort((a, b) => rect(a.nameEl).top - rect(b.nameEl).top || rect(a.nameEl).left - rect(b.nameEl).left);
    return sorted.map((entry, index) => {
      const next = sorted[index + 1];
      const nextTop = next ? rect(next.nameEl).top : Infinity;
      const card = clientCardFor(entry.nameEl, entry.role, nextTop);
      const clientId = (card && (card.getAttribute('data-invitee-id') || card.getAttribute('data-client-id') || card.getAttribute('data-patient-id'))) || null;
      const withCard = { ...entry, card, clientId };
      return { ...withCard, uursoortTrigger: findUursoortTriggerForClient(withCard, nextTop) };
    });
  }
  function findClientExpandButton() {
    const fullName = findClientNameText();
    const inviteeNames = deepQueryAll('span[class*="_invitee-name_"], ._invitee-name_sohx9_40')
      .filter((el) => visible(el) && !isOwnPopup(el) && (!fullName || (el.textContent || '').trim() === fullName));
    const exactButtons = deepQueryAll(UI_OVERRIDES.afsInviteeToggle || 'uc-button[data-qa="toggle-invitee-fields-button"], [data-qa="toggle-invitee-fields-button"]')
      .filter((btn) => visible(btn) && !isOwnPopup(btn));
    if (fullName) {
      const byLabel = exactButtons.find((btn) => clean(btn.getAttribute('aria-label') || '').includes(clean(fullName)));
      if (byLabel) return byLabel;
    }
    for (const nameEl of inviteeNames) {
      const nr = rect(nameEl);
      const rowButton = exactButtons
        .map((btn) => ({ btn, r: rect(btn) }))
        .filter(({ r }) => r.left > nr.left + 250 && r.top >= nr.top - 80 && r.top <= nr.top + 70)
        .sort((a, b) => Math.abs((a.r.top + a.r.height / 2) - (nr.top + nr.height / 2)) - Math.abs((b.r.top + b.r.height / 2) - (nr.top + nr.height / 2)))[0];
      if (rowButton) return rowButton.btn;
    }
    const clientLabels = deepQueryAll('div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'client');
    let best = null, bestScore = Infinity;
    for (const label of clientLabels) {
      const lr = rect(label);
      for (const btn of deepQueryAll('button,[role="button"],[tabindex]')) {
        if (!visible(btn) || isOwnPopup(btn)) continue;
        const t = clean(uiText(btn));
        if (/toevoegen|verwijder|agenda|beschikbaar|niet beschikbaar|clienten zijn aanwezig/.test(t)) continue;
        const br = rect(btn);
        if (br.width < 22 || br.width > 78 || br.height < 22 || br.height > 78) continue;
        if (br.left < lr.left + 250) continue;
        if (br.top < lr.top - 90 || br.top > lr.top + 70) continue;
        const centerY = br.top + br.height / 2;
        const score = -br.left * 5 + Math.abs(centerY - (lr.top - 12)) * 10 + (t ? 15 : 0);
        if (score < bestScore) { best = btn; bestScore = score; }
      }
    }
    return best;
  }
  function hasClientInAppointment() {
    if (findClientEntries().length > 0 || !!findClientNameText() || !!findClientFirstName() || !!findClientExpandButton()) return true;
    return deepQueryAll('span[class*="_invitee-info_"], span[class*="_invitee-name_"], ._invitee-info_sohx9_34, ._invitee-name_sohx9_40')
      .some(function (el) {
        if (!visible(el) || isOwnPopup(el)) return false;
        const txt = clean(el.textContent || '');
        if (!txt || txt.includes('medewerker')) return false;
        const r = rect(el);
        return deepQueryAll('div,span,p').some(function (role) {
          if (!visible(role) || isOwnPopup(role) || clean(role.textContent || '') !== 'client') return false;
          const rr = rect(role);
          return rr.top >= r.bottom - 12 && rr.top <= r.bottom + 70 && Math.abs(rr.left - r.left) <= 190;
        });
      });
  }
  function inviteeRoleForNameEl(nameEl) {
    const nr = rect(nameEl);
    return deepQueryAll('div,span,p').find((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const c = clean(el.textContent || '');
      if (c !== 'client' && c !== 'medewerker') return false;
      const rr = rect(el);
      return rr.top >= nr.bottom - 10 && rr.top <= nr.bottom + 55 && Math.abs(rr.left - nr.left) <= 170;
    }) || null;
  }
  function unavailableInvitees() {
    const out = [];
    const seen = new Set();
    // ONS zet voor elke onbeschikbare genodigde een verborgen span met de tekst
    // "X heeft al een afspraak". Dat is betrouwbaarder dan geometrie-gebaseerde
    // badge-detectie.
    for (const el of deepQueryAll('span, div')) {
      if (isOwnPopup(el)) continue;
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt.includes('heeft al een afspraak')) continue;
      // Naam staat vóór "heeft al een afspraak"
      const name = txt.replace(/\s*heeft al een afspraak.*$/i, '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, firstName: firstNameFromName(name), role: '' });
    }
    return out.sort((a, b) => a.firstName.localeCompare(b.firstName));
  }
  function availabilityPersonKey(entry) {
    // Eén sleutel per persoon (genormaliseerde naam). De rol-tekst kan tussen
    // renders licht verschillen; door alleen de naam te gebruiken verschijnt de
    // "heeft al een afspraak"-melding maximaal één keer per gekoppelde persoon.
    return clean(entry.name || entry.firstName || '').toLowerCase().replace(/\s+/g, ' ');
  }
  function appointmentNeedsAvailabilityConfirmation() {
    // Verwijderd op verzoek: de "heeft al een afspraak, alsnog doorgaan?"-melding
    // is uitgeschakeld. Hij liet het scherm heen en weer flippen en las soms
    // onzin-namen in. Afspraakhulp bemoeit zich niet meer met beschikbaarheid.
    return false;
  }
  // Is de afspraak in de opslaan-fase? Dan niet meer onderbreken met de
  // beschikbaarheidsmelding (die hoort bij het begin, niet bij het opslaan).
  function appointmentInSaveStage() {
    if (activeNonClientOption && activeNonClientOption.freeTitle) return nonClientFreeTitleComplete(activeNonClientOption);
    return appointmentReadyToSave();
  }
  function clickClientRowChevronFallback() {
    const clientLabels = deepQueryAll('div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'client');
    let best = null, bestY = null, bestScore = Infinity;
    for (const label of clientLabels) {
      const lr = rect(label);
      for (const section of deepQueryAll('div')) {
        if (!visible(section) || isOwnPopup(section)) continue;
        const sr = rect(section);
        if (sr.left > lr.left - 90 || sr.right < lr.left + 300) continue;
        if (sr.top > lr.top - 70 || sr.bottom < lr.bottom + 20) continue;
        if (sr.width < 260 || sr.width > 760 || sr.height < 60 || sr.height > 240) continue;
        const score = Math.abs(sr.top - (lr.top - 54)) + Math.abs(sr.left - (lr.left - 55));
        if (score < bestScore) { best = section; bestY = lr.top - 13; bestScore = score; }
      }
    }
    if (!best) return false;
    const r = rect(best);
    const x = Math.round(r.right - 28);
    const y = Math.round(bestY || (r.top + 42));
    // Blinde coördinaatklik: NOOIT op de "+ Toevoegen"-knop (Genodigden) landen,
    // anders opent de zoek-genodigden-modal i.p.v. het uitklappen van de kaart.
    if (isAddInviteeControlAtPoint(x, y)) { dbg('chevron-fallback overslaan: + Toevoegen onder punt'); return false; }
    clickAt(x, y);
    return true;
  }
  // Ligt onder dit punt de knop die genodigden/cliënten toevoegt? Zowel de
  // "+ Toevoegen"-knop als de zoek-genodigden-trigger tellen mee.
  function isAddInviteeControlAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    const host = el.closest && el.closest('button,a,[role="button"],uc-button,[data-qa*="add" i],[data-qa*="invitee" i]');
    if (!host) return false;
    const t = clean(uiText(host) || host.textContent || '');
    const qa = clean((host.getAttribute && host.getAttribute('data-qa')) || '');
    return /toevoegen|genodigd/.test(t) || /add|invitee|attendee/.test(qa);
  }
  function ensureClientExpanded(onResult, attempt = 0) {
    invalidateClientEntries();
    const entries = findClientEntries();
    // Klaar zodra elke clientkaart open staat (toggle uitgeklapt) OF er al een
    // uursoort-veld zichtbaar is. We wachten NIET tot het uursoort-veld gevuld is,
    // want dat wordt handmatig gedaan en zou de helper ~5s laten hangen.
    const allOpen = entries.length && entries.every((entry) =>
      !!entry.uursoortTrigger || inviteeToggleExpanded(entry.toggle) === true);
    if (allOpen) { onResult(true); return; }
    // Alleen klikken als de kaart ECHT dichtgeklapt is (aria-expanded="false").
    // Tijdens het kiezen van sommige uursoorten (bv. "Behandeling 18+") herbouwt
    // ONS de genodigde-rij: het uursoort-veld verdwijnt heel even én aria-expanded
    // is dan onbepaald (null). Met de oude test (`!== true`) telde die tussenstand
    // als "dicht" en klikte de helper de genodigdenkaart open/dicht. Bij uursoorten
    // die de rij niet herbouwen (bv. "GGZ No Show factuur") gebeurde dat niet -
    // vandaar het verschil per uursoort.
    const closed = entries.filter((entry) => !entry.uursoortTrigger && entry.toggle && inviteeToggleExpanded(entry.toggle) === false);
    if (attempt % 2 === 0) {
      if (closed.length) closed.forEach((entry) => clickInviteeToggle(entry.toggle));
      else if (!entries.length) {
        const btn = findClientExpandButton();
        if (btn) clickInviteeToggle(btn);
        else clickClientRowChevronFallback();
      }
    }
    if (attempt < 12) setTimeout(() => ensureClientExpanded(onResult, attempt + 1), 140);
    else {
      const finalEntries = findClientEntries();
      onResult(finalEntries.length
        ? finalEntries.every((entry) => !!entry.uursoortTrigger || inviteeToggleExpanded(entry.toggle) === true)
        : !!findClientUursoortTrigger());
    }
  }
  function setLabel(text, onResult) {
    if (!text) { onResult(true); return; }
    const trigger = getEtiketTrigger();
    const selected = trigger ? selectedKnownLabels(trigger, allKnownLabels()) : [];
    const wanted = clean(text);
    if (selected.length === 1 && selected[0] === wanted) {
      onResult(true);
      return;
    }
    clearKnownLabels(() => setTimeout(() => selectLabel(text, onResult), 60));
  }
  // Opgeruimd (#3): enforceChosenLabelOnly is vervangen door setLabelExclusive,
  // dat gefaseerd en gericht werkt via de echte label-chips.
  // Alle daadwerkelijk geselecteerde labelchips (ook labels die NIET in de config
  // staan, zoals het label dat ONS automatisch aan een uursoort koppelt). Leunt op
  // labelChips, dus op de echte button.label-tag-chips.
  function selectedAllLabelChipTexts(trigger) {
    return labelChips(trigger).map((c) => c.name);
  }
  // Verwijder GERICHT alleen de chips waarvan de naam matcht met `texts`, door hun
  // eigen verwijderknop één keer te klikken. Het gekozen label (`protect`) wordt
  // NOOIT verwijderd. Geen wegnokken-en-opnieuw-plakken, dus geen label-dans.
  function removeLabelChipsByText(trigger, texts, protect) {
    if (!trigger || !texts || !texts.length) return false;
    const want = texts.map(clean).filter((w) => w && w.length >= 2);
    const prot = clean(protect || '');
    let clicked = false;
    for (const chip of labelChips(trigger)) {
      const nm = chip.name;
      if (!nm) continue;
      if (prot && (nm === prot || nm.indexOf(prot) !== -1)) continue;
      if (!want.some((w) => nm === w || nm.indexOf(w) !== -1)) continue;
      clickOption(chip.el);
      clicked = true;
    }
    return clicked;
  }
  // Zoek in de open label-dropdown een optie die EXACT gelijk is aan `wanted`.
  // Bewust géén fuzzy/token-matching (zoals findExactDropdownOption): bij een nog
  // niet gefilterde lijst pakte dat een naburig/verkeerd label -> churn op "een
  // heel ander label". We klikken liever niets dan het verkeerde.
  function findExactLabelOption(trigger, wanted) {
    const w = clean(wanted);
    if (!w) return null;
    const tr = rect(trigger);
    for (const root of optionSearchRoots(trigger)) {
      for (const el of genericOptionCandidates(root)) {
        if (!visible(el) || isOwnPopup(el) || /input|textarea|select/i.test(el.tagName || '')) continue;
        const row = rowForOptionText(el, root);
        if (!visible(row) || isOwnPopup(row)) continue;
        const txt = clean(optionText(row) || optionText(el));
        if (txt !== w) continue; // EXACT
        const r = rect(row);
        if (r.top < tr.top - 500 || r.top > tr.bottom + 600) continue;
        if (r.width < 120 || r.height < 20 || r.height > 80) continue;
        return row;
      }
    }
    return null;
  }
  // Voeg exact één label toe door de dropdown te openen, de naam te typen en te
  // wachten tot de EXACT matchende optie verschijnt. Vindt die niet binnen de tijd,
  // dan klikken we niets (onResult(false)) i.p.v. een verkeerd label te kiezen.
  function addLabelExact(text, onResult) {
    const trigger = getEtiketTrigger();
    if (!trigger) { onResult(false); return; }
    const wanted = clean(text);
    clickElementCenter(trigger);
    setTimeout(() => {
      const input = searchInputForTrigger(trigger);
      if (input) { input.focus(); setInputText(input, text); }
      pollFor(
        () => findExactLabelOption(trigger, wanted),
        (opt) => {
          if (opt) { clickOption(opt); setTimeout(() => { clickEmptyModalSpot(); onResult(true); }, 90); }
          else { clickEmptyModalSpot(); onResult(false); }
        },
        { timeout: 2500, interval: 120 }
      );
    }, 140);
  }
  // Zet exact het gekozen label. STRIKT gefaseerd zodat er nooit tegelijk wordt
  // verwijderd en toegevoegd (dat veroorzaakte het geflikker):
  //   fase 1 - verwijder eerst alle niet-gekozen labels (gericht via hun ×);
  //   fase 2 - pas als er geen extra's meer zijn en het label ontbreekt: exact
  //            één keer toevoegen en KLAAR (niet opnieuw de lus in).
  // Wordt pas AAN HET EIND aangeroepen (nadat ONS zijn eigen uursoort-label heeft
  // gekoppeld).
  function setLabelExclusive(text, onDone, attempt = 0) {
    if (!text) { if (onDone) onDone(true); return; }
    const trigger = getEtiketTrigger();
    if (!trigger) { if (onDone) onDone(false); return; }
    const wanted = clean(text);
    // Doel-chip = exact het label of een chip die het label bevat (bv. met icoon
    // ervoor). Bewust NIET de omgekeerde substring, zodat korte labels niet per
    // ongeluk als 'doel' gelden.
    const isTarget = (l) => l === wanted || l.indexOf(wanted) !== -1;
    const chips = selectedAllLabelChipTexts(trigger);
    const extras = chips.filter((l) => !isTarget(l));
    const triggerTxt = clean(uiText(trigger) || trigger.textContent || '');
    const hasTarget = chips.some(isTarget) || (wanted && triggerTxt.indexOf(wanted) !== -1);
    if (!extras.length && hasTarget) { if (onDone) onDone(true); return; }
    if (attempt >= 6) {
      if (extras.length) setStatus('Let op: verwijder zelf nog het extra label "' + extras[0] + '"', false);
      if (onDone) onDone(!extras.length);
      return;
    }
    // Fase 1: eerst extra labels weg (target beschermd), daarna opnieuw evalueren.
    if (extras.length) {
      removeLabelChipsByText(trigger, extras, wanted);
      setTimeout(() => setLabelExclusive(text, onDone, attempt + 1), 160);
      return;
    }
    // Fase 2: geen extra's meer, label ontbreekt -> exact één keer toevoegen. KLAAR.
    addLabelExact(text, () => { if (onDone) onDone(true); });
  }
  // Zet exact de gekozen SET labels (meerdere etiketten per afspraaktype). Zelfde
  // strikte fasering als setLabelExclusive, maar dan voor een lijst:
  //   fase 1 - verwijder eerst elk label dat niet in de gewenste set zit;
  //   fase 2 - voeg ontbrekende labels één voor één toe (nooit tegelijk verwijderen
  //            en toevoegen), en evalueer daarna opnieuw tot de set klopt.
  function setLabelsExclusive(texts, onDone, attempt = 0) {
    const wanted = (Array.isArray(texts) ? texts : [texts]).map((t) => clean(t)).filter(Boolean);
    if (!wanted.length) { if (onDone) onDone(true); return; }
    if (wanted.length === 1) { setLabelExclusive(wanted[0], onDone, attempt); return; }
    const trigger = getEtiketTrigger();
    if (!trigger) { if (onDone) onDone(false); return; }
    // Een chip "hoort erbij" als hij één van de gewenste labels is of bevat.
    const isWantedChip = (l) => wanted.some((w) => l === w || l.indexOf(w) !== -1);
    const chips = selectedAllLabelChipTexts(trigger);
    const extras = chips.filter((l) => !isWantedChip(l));
    const triggerTxt = clean(uiText(trigger) || trigger.textContent || '');
    const present = (w) => chips.some((l) => l === w || l.indexOf(w) !== -1) || (w && triggerTxt.indexOf(w) !== -1);
    const missing = wanted.filter((w) => !present(w));
    if (!extras.length && !missing.length) { if (onDone) onDone(true); return; }
    if (attempt >= 10) {
      if (extras.length) setStatus('Let op: verwijder zelf nog het extra label "' + extras[0] + '"', false);
      else if (missing.length) setStatus('Let op: voeg zelf nog het label "' + missing[0] + '" toe', false);
      if (onDone) onDone(!extras.length && !missing.length);
      return;
    }
    // Fase 1: eerst alle niet-gewenste labels weg (gewenste chips blijven staan).
    if (extras.length) {
      removeLabelChipsByText(trigger, extras);
      setTimeout(() => setLabelsExclusive(texts, onDone, attempt + 1), 160);
      return;
    }
    // Fase 2: het eerste ontbrekende label toevoegen, daarna opnieuw evalueren.
    addLabelExact(missing[0], () => setTimeout(() => setLabelsExclusive(texts, onDone, attempt + 1), 150));
  }
  function selectLabel(text, onResult, attempt = 0) {
    const trigger = getEtiketTrigger();
    if (!trigger) { onResult(false); return; }
    clickElementCenter(trigger);
    setTimeout(() => {
      const input = searchInputForTrigger(trigger);
      if (input) { input.focus(); setInputText(input, text); }
      // Poll tot het label-optie gerenderd is (op productie laadt de lijst
      // trager) i.p.v. één poging na een vaste vertraging.
      pollFor(
        () => findExactDropdownOption(trigger, [text]),
        (best) => {
          if (best) {
            clickOption(best);
            setTimeout(() => { clickEmptyModalSpot(); onResult(true); }, 90);
            return;
          }
          if (attempt < 3) {
            setTimeout(() => selectLabel(text, onResult, attempt + 1), 180);
            return;
          }
          setTimeout(() => { clickEmptyModalSpot(); onResult(false); }, 90);
        },
        { timeout: 2600, interval: 130 }
      );
    }, 130);
  }
  function chooseUursoort(text, onResult, triggerArg = null) {
    openTypePick(() => triggerArg || getUursoortTrigger(), text, (ok) => {
      if (ok) setTimeout(clickEmptyModalSpot, 90);
      onResult(ok);
    });
  }

  // Haal de uursoorten voor één specifieke cliënt op via dezelfde authenticated
  // same-origin fetch-route als de andere ONS API-calls hierboven. De API is de
  // primaire bron; alleen bij een ECHTE API-fout valt deze functie terug op de
  // oude DOM-scraper. Een geldige response met een lege basic_list is dus GEEN
  // fout en triggert geen scraping.
// 1. Haal ID op via URL, DOM, een eigen API-call of script-injectie
// 1. Haal ID op via URL, DOM, een eigen API-call of script-injectie
// 1. Haal ID op via URL, DOM, een eigen API-call of script-injectie
// 1. Haal Employee ID op via URL, DOM, een eigen API-call of script-injectie
// 1. Haal Employee ID op via URL, DOM, een eigen API-call of script-injectie
// 1. Haal Employee ID op via URL, DOM, een eigen API-call of script-injectie
  function getEmployeeIdAsync() {
    return new Promise(async (resolve) => {
      const href = String(location.href || "");
      
      let m = href.match(/\/invitees\/(\d+)/i) || 
              href.match(/(?:employee_id|invitee_id)[s]?(?:%5B%5D|\[\])=(\d+)/i);
      if (m) return resolve(m[1]);

      const input = document.querySelector('input[name*="employee_id"], [data-employee-id], input[name="agenda_owner_id"], input[name*="invitee_id"]');
      if (input && (input.value || input.getAttribute('data-employee-id'))) {
        return resolve(input.value || input.getAttribute('data-employee-id'));
      }

      try {
        const today = new Date();
        const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        
        const r = await fetch('/calendar/calendar_variables?date=' + dateStr, {
          headers: { Accept: 'application/json' }
        });
        
        if (r.ok) {
          const json = await r.json();
          if (json && Array.isArray(json.invitees)) {
            const emp = json.invitees.find(i => i.type === 'employee' && i.id != null);
            if (emp) {
              return resolve(String(emp.id));
            }
          }
        }
      } catch (e) {}

      const eventId = "ons_data_" + Math.random().toString(36).substr(2, 9);
      const script = document.createElement('script');
      script.textContent = `
        try {
          let empId = null;
          if (typeof onsContext === "function") {
            let ctx = onsContext();
            if (ctx && ctx.userId) empId = ctx.userId;
          }
          window.dispatchEvent(new CustomEvent("${eventId}", { detail: { empId: empId } }));
        } catch(e) {
          window.dispatchEvent(new CustomEvent("${eventId}", { detail: {} }));
        }
      `;
      const listener = (e) => {
        window.removeEventListener(eventId, listener);
        script.remove();
        resolve(e.detail && e.detail.empId ? String(e.detail.empId) : null);
      };
      window.addEventListener(eventId, listener);
      document.documentElement.appendChild(script);
    });
  }

  // 2. Zoeken naar Client (External) ID inclusief fallback via de zoeklijst
  // Kies uit de search_panel-respons ({clients:[{id,external_id,display_name,...}]}) de
  // cliënt die op naam matcht en geef diens INTERNE id (bv. 11142). Geen exacte
  // naam-match -> eerste resultaat. NOOIT external_id (die is voor Ons Administratie).
  function pickClientIdFromSearch(json, name) {
    const clients = (json && Array.isArray(json.clients)) ? json.clients : (Array.isArray(json) ? json : []);
    if (!clients.length) return null;
    const norm = (x) => (typeof clean === "function") ? clean(x) : String(x == null ? "" : x).trim().toLowerCase();
    const namesOf = (c) => [c && c.display_name, c && c.name, c && c.sortable_name, c && c.full_name].filter(Boolean).map(norm);
    const idOf = (c) => (c && c.id != null) ? String(c.id) : null;
    const want = norm(name);
    if (want) {
      // 1. Exacte naam-match op een van de naamvelden.
      const exact = clients.find((c) => namesOf(c).some((n) => n === want));
      if (exact) return idOf(exact);
      // 2. Alle woorden uit de gezochte naam komen voor bij precies één cliënt (vangt
      //    "Achternaam, Voornaam" vs "Voornaam Achternaam" en extra tussenvoegsels af).
      const tokens = want.split(' ').filter(Boolean);
      if (tokens.length) {
        const tokMatch = clients.filter((c) => {
          const blob = namesOf(c).join(' ');
          return tokens.every((t) => blob.indexOf(t) !== -1);
        });
        if (tokMatch.length === 1) return idOf(tokMatch[0]);
      }
    }
    // 3. Precies één resultaat -> eenduidig, ook zonder naam.
    if (clients.length === 1) return idOf(clients[0]);
    // 4. Meerdere resultaten en geen zekere match -> NIET gokken (liever geen id dan de
    //    verkeerde cliënt en dus verkeerde uursoorten).
    return null;
  }
  // Haalt de zoekresultaten voor één term + zorg-scope op (array met cliënten).
  async function _fetchClientsForTerm(term, outOfCare) {
    try {
      const url = _apiUrl('searchClients', { term: term, outOfCare: outOfCare });
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      let json = null; try { json = await res.json(); } catch (e) { json = null; }
      return (json && Array.isArray(json.clients)) ? json.clients : (Array.isArray(json) ? json : []);
    } catch (e) { return []; }
  }
  // Zoekt de INTERNE client-id via de naam (search_panel). Gecached per naam.
  var _clientIdByName = Object.create(null);
  async function _searchClientIdByName(name) {
    const nm = String(name || "").trim();
    if (!nm) return null;
    if (_clientIdByName[nm]) return _clientIdByName[nm];
    // Zoek zowel IN ZORG (out_of_care=false) als UIT ZORG (out_of_care=true): een cliënt
    // kan in beide categorieën vallen. Eerst 'in zorg' (meest voorkomend); alleen bij géén
    // zekere match ook 'uit zorg' erbij, gecombineerd en ontdubbeld op id. Zo missen we een
    // cliënt niet (en slaan we die niet over) enkel omdat die 'uit zorg' is.
    let clients = await _fetchClientsForTerm(nm, "false");
    let id = pickClientIdFromSearch({ clients }, nm);
    if (!id) {
      const more = await _fetchClientsForTerm(nm, "true");
      const byId = new Map();
      clients.concat(more).forEach((c) => { if (c && c.id != null) byId.set(String(c.id), c); });
      id = pickClientIdFromSearch({ clients: Array.from(byId.values()) }, nm);
    }
    if (id) { _clientIdByName[nm] = id; return id; }
    return null;
  }
  function _clientScope(context, trigger) {
    if (context && context.card) return context.card;
    if (trigger && trigger.closest) {
      return trigger.closest('ul[class*="_selected-clients_"] > li')
        || trigger.closest('ul[data-qa="selected_clients"] > li')
        || trigger.closest('li') || null;
    }
    return null;
  }
  function _scopeClientName(scope, context) {
    if (scope) {
      const el = scope.querySelector('span[class*="invitee-name"], span[class*="_invitee-name_"]');
      const nm = el ? String(el.innerText || el.textContent || "").trim() : "";
      if (nm) return nm;
    }
    return (context && context.name) ? String(context.name).trim() : "";
  }
  function getClientIdsAsync(context, trigger) {
    return new Promise(async (resolve) => {
      const candidates = [];
      const add = (v) => {
        const s = String(v == null ? "" : v).trim();
        if (/^\d+$/.test(s) && !candidates.includes(s)) candidates.push(s);
      };

      const scope = _clientScope(context, trigger);
      // Naam van DEZE cliënt: eerst de bekende context.name (betrouwbaar per cliënt),
      // anders de naam uit de gescopede rij. BEWUST geen document-brede fallback -> die
      // pakt bij meerdere cliënten steeds de eerste naam (kruisbesmetting).
      const name = String((context && context.name) || _scopeClientName(scope, null) || "").trim();

      // PRIMAIR: de INTERNE id van DEZE cliënt via de VOLLEDIGE naam (search_panel). Belangrijk
      // is dat we de volledige weergavenaam gebruiken, niet een deelterm (bv. alleen "test"),
      // anders geeft de zoekopdracht meerdere cliënten en pakken we de verkeerde id.
      if (name) {
        const byName = await _searchClientIdByName(name);
        if (byName) return resolve([byName]);
      }

      // FALLBACK 1: gescopede DOM-bronnen (deze cliënt).
      if (context && context.clientId != null) add(context.clientId);
      if (scope) {
        scope.querySelectorAll('input[name="event[client_ids][]"], input[name="client_id"], input[type="hidden"][name*="client"]').forEach(el => add(el.value));
        scope.querySelectorAll('[data-client-id],[data-patient-id]').forEach(el => { add(el.getAttribute('data-client-id')); add(el.getAttribute('data-patient-id')); });
        if (candidates.length) return resolve(candidates.slice(0, 1));
      }

      // FALLBACK 2 (geen scope/naam): globale bronnen (single-client legacy).
      const href = String(location.href || "");
      let m = href.match(/client_id[s]?(?:%5B%5D|\[\])=(\d+)/g);
      if (m) m.forEach(match => { const id = match.match(/(\d+)/); if (id) add(id[1]); });
      else { let singleMatch = href.match(/\/clients\/(\d+)/i); if (singleMatch) add(singleMatch[1]); }
      document.querySelectorAll(`input[name="event[client_ids][]"], input[name="client_id"], input[type="hidden"][name*="client"]`).forEach(el => add(el.value));

      resolve(candidates);
    });
  }

 
  // Parse de product_selection/basic_list-respons naar een platte, ontdubbelde lijst
  // uursoortnamen uit 'Onlangs gebruikt', 'Geadviseerd' én 'Toegestaan'.
  function parseProductList(json) {
    if (!json || !Array.isArray(json.basic_list)) return [];
    const cats = ["Onlangs gebruikt", "Geadviseerd", "Toegestaan"];
    const out = [], seen = new Set();
    json.basic_list.forEach(function (group) {
      if (!Array.isArray(group) || cats.indexOf(group[0]) === -1) return;
      const items = Array.isArray(group[1]) ? group[1] : [];
      items.forEach(function (item) {
        const name = Array.isArray(item) ? String(item[0] == null ? "" : item[0]).trim() : "";
        if (!name) return;
        const key = typeof clean === "function" ? clean(name) : name.toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key); out.push(name);
      });
    });
    return out;
  }
// 3. De API-aanroep die de ID's ophaalt en de uursoorten filtert en ordent
  // Korte cache (per URL) zodat een prefetch bij cliënt-toevoegen de picker direct vult.
  var _prodListCache = Object.create(null);
  async function fetchClientUursoortOptionsApi(context, trigger) {
    const employeeId = await getEmployeeIdAsync();
    const clientIds = await getClientIdsAsync(context, trigger);

    if (!employeeId) throw new Error("geen employee-id gevonden");
    if (!clientIds || clientIds.length === 0) throw new Error("geen client-id gevonden");

    const today = new Date();
    const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    // Sjabloon met de eerste cliënt; extra cliënten worden erachter geplakt (multi-cliënt).
    let url = _apiUrl('productList', { date: dateStr, employeeId: employeeId, clientId: clientIds[0] });
    for (let k = 1; k < clientIds.length; k++) {
      url += "&client_ids%5B%5D=" + encodeURIComponent(clientIds[k]);
    }

    // Verse cache-hit -> direct terug (prefetch maakt de picker instant). Ruime TTL (5 min):
    // de uursoorten voor dezelfde medewerker+cliënt+datum wijzigen niet tijdens het maken van
    // één afspraak, dus de warme prefetch blijft geldig ook als je even bezig bent met
    // afspraaktype/eindtijd/reistijd. Anders verliep 'ie na 30s en zag je toch weer "laden".
    const cached = _prodListCache[url];
    if (cached && (Date.now() - cached.ts) < 300000 && cached.list && cached.list.length) {
      return cached.list.slice();
    }

    const r = await fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (!r.ok) throw new Error("HTTP " + r.status);
    const json = await r.json();

    if (!json || !Array.isArray(json.basic_list))
      throw new Error("ongeldige product_selection response");

    const list = parseProductList(json);
    if (list.length) _prodListCache[url] = { ts: Date.now(), list: list.slice() }; // alleen niet-lege lijsten cachen
    return list;
  }
  // Warmt de cache alvast op (bij cliënt-toevoegen), zodat de uursoort-picker sneller is.
  function prefetchClientUursoorten(context, trigger) {
    try { fetchClientUursoortOptionsApi(context || null, trigger || null).catch(function () {}); } catch (e) {}
  }
  // Prefetch de uursoorten ZO VROEG MOGELIJK: al zodra een cliënt(naam) in beeld komt —
  // we wachten NIET tot het uursoort-veld gerenderd is. De interne id komt uit de naam
  // (search_panel), dus de product_list-call kan al meteen na het toevoegen van de cliënt.
  // Per cliëntnaam maar één keer, zodat elke nieuwe cliënt direct zijn eigen prefetch krijgt.
  var _prefetchedNames = Object.create(null);
  function maybePrefetchUursoorten() {
    try {
      // Verse lezing: een net toegevoegde cliënt moet meteen meetellen (anders wacht de
      // prefetch op de volgende tik en verschijnt het laadscherm alsnog).
      if (typeof invalidateClientEntries === 'function') invalidateClientEntries();
      var entries = (typeof findClientEntries === 'function') ? findClientEntries() : [];
      entries.forEach(function (e) {
        var nm = (e && e.name) ? String(e.name).trim() : '';
        if (!nm) return;
        var key = (location.pathname || '') + '|' + ((typeof clean === 'function') ? clean(nm) : nm.toLowerCase());
        if (_prefetchedNames[key]) return;
        _prefetchedNames[key] = true;
        // Achtergrond-call: interne id op naam ophalen + product_list warmen. Het latere
        // openen van de picker (na eindtijd/reistijd) is dan een directe cache-hit.
        prefetchClientUursoorten({ name: nm, trigger: (e && e.uursoortTrigger) || null }, (e && e.uursoortTrigger) || null);
      });
    } catch (e) {}
  }

  // 4. De logica die de API of fallback scraper triggert
  function listUursoortOptions(
    cb,
    triggerArg = null,
    attempt = 0,
    primed = false,
    clientContext = null,
  ) {
    const trigger = triggerArg || getUursoortTrigger();
    if (!trigger) {
      cb(null);
      return;
    }

    if (primed) {
      const openedBy = openSelectCombobox(trigger) || trigger;
      setTimeout(() => {
        const input =
          searchInputForTrigger(openedBy) || searchInputForTrigger(trigger);
        if (input) {
          input.focus();
          setInputTextComposed(input, "");
        }
        setTimeout(
          () => {
            scanClientUursoortOptions(trigger, (out) => {
              if (!out.length && attempt < 2) {
                clickEmptyModalSpot();
                setTimeout(
                  () =>
                    listUursoortOptions(
                      cb,
                      triggerArg,
                      attempt + 1,
                      true,
                      clientContext,
                    ),
                  140,
                );
                return;
              }
              cb(out);
              setTimeout(clickEmptyModalSpot, 60);
            });
          },
          input ? 140 : 20,
        );
      }, 170);
      return;
    }

    fetchClientUursoortOptionsApi(clientContext, trigger)
      .then(function (out) {
        if (out && out.length > 0) {
          cb(out);
        } else {
          throw new Error("API leverde een lege lijst op");
        }
      })
      .catch(function (apiError) {
        dismissOpenDropdowns();
        setTimeout(
          () =>
            listUursoortOptions(cb, triggerArg, attempt, true, clientContext),
          70,
        );
      });
  }

  function uursoortContexts() {
    return findClientEntries()
      .filter((entry) => entry.uursoortTrigger)
      .map((entry) => ({
        firstName: entry.firstName,
        name: entry.name,
        trigger: entry.uursoortTrigger,
      }));
  }

  function freshUursoortContext(context) {
    if (!context) return context;
    const entry = findClientEntries().find(
      (item) => item.name === context.name,
    );
    return entry && entry.uursoortTrigger
      ? {
          firstName: entry.firstName,
          name: entry.name,
          trigger: entry.uursoortTrigger,
        }
      : context;
  }

  function freshUursoortTriggerForContext(context) {
    return (freshUursoortContext(context) || {}).trigger || null;
  }

  function clearUursoortContexts(contexts, onDone, index = 0) {
    if (!contexts.length || index >= contexts.length) {
      onDone();
      return;
    }
    invalidateClientEntries();
    const ctx = freshUursoortContext(contexts[index]);
    clearUursoort(
      () =>
        setTimeout(
          () => clearUursoortContexts(contexts, onDone, index + 1),
          120,
        ),
      ctx && ctx.trigger,
    );
  }

  function clearAllUursoorten(onDone, attempt = 0) {
    invalidateClientEntries();
    const contexts = uursoortContexts().filter((ctx) =>
      entryUursoortIsSet(
        findClientEntries().find((e) => e.name === ctx.name) || {},
      ),
    );
    if (!contexts.length || attempt >= 6) {
      onDone();
      return;
    }
    clearUursoortContexts(contexts, () => {
      setTimeout(() => clearAllUursoorten(onDone, attempt + 1), 200);
    });
  }

  function clientsMissingUursoortEntries(exclude) {
    invalidateClientEntries();
    return findClientEntries().filter(
      (e) =>
        !(
          exclude &&
          exclude.has(typeof clean === "function" ? clean(e.name) : e.name)
        ) && !entryUursoortIsSet(e),
    );
  }
  // contexts dient alleen als "welke cliënten horen bij deze flow"; de volgorde
  // en het overslaan bepalen we live. index blijft in de signatuur voor de
  // bestaande aanroepen, maar wordt niet meer gebruikt.
  function showUursoortQueue(contexts, index, afterAll) {
    if (uursoortQueueActive) return; // maar één wachtrij tegelijk (geen race tussen drivers)
    uursoortQueueActive = true;
    // Deze wachtrij hoort bij de huidige generatie. Wist de gebruiker de instellingen
    // (of remount), dan verandert de generatie en stopt deze driver bij de volgende tik.
    const myGen = uursoortQueueGen;
    const stale = () => myGen !== uursoortQueueGen;
    // We filteren NIET op de bij-de-start vastgelegde namen: bij 3+ cliënten kan
    // een kaart later uitklappen en anders buiten de lijst vallen. Cliënten die al
    // een uursoort hebben worden sowieso overgeslagen, dus "alle nog ontbrekende
    // uursoorten" is de juiste, robuuste verzameling.
    const handled = new Set(); // cliënten die de gebruiker in deze flow al koos
    const expandTries = new Map(); // per cliënt: pogingen om het veld te vinden
    const nullTries = new Map(); // per cliënt: pogingen waarbij het veld (nog) niet leesbaar was
    let guard = 0;
    const done = () => { if (stale()) return; uursoortQueueActive = false; uursoortQueueCooldownUntil = Date.now() + 300; setTimeout(afterAll, 60); };
    // Pas ECHT afronden (opslaanpagina) als een korte hercontrole bevestigt dat
    // niemand meer een uursoort mist. Zonder deze "settle" eindigde de wachtrij
    // tussen cliënt N-1 en N even (want de kaart/uursoort van N was nog niet
    // gedetecteerd) -> opslaanscherm flitste en het zelfherstel moest 'm heropenen.
    // We blijven tijdens de hercontrole actief, dus er verschijnt geen opslaanscherm.
    const settleThenDone = (n) => {
      if (stale()) return;
      const missing = clientsMissingUursoortEntries(handled);
      if (missing.length) { step(); return; }
      // Maximaal ÉÉN hercontrole (gebruikerswens): geen herhaald "Controleren..." per
      // cliënt meer. De remount-afhandeling zit al in de actieve retries (expandTries/
      // nullTries) tijdens het verwerken; deze settle is alleen nog een laatste sanity-check.
      // Bij meerdere cliënten die ene controle iets later, zodat een kaart die tijdens een
      // re-render even uit de DOM valt in dat venster alsnog wordt opgepakt.
      const needed = 1;
      if (n >= needed) { done(); return; }
      showLoadingState('Controleren...');
      const wait = (findClientEntries().length <= 1) ? 130 : 320;
      setTimeout(() => settleThenDone(n + 1), wait);
    };
    const step = () => {
      if (stale()) return; // instellingen gewist / nieuwe flow: deze wachtrij stopt
      if (++guard > 300) { done(); return; }
      const missing = clientsMissingUursoortEntries(handled);
      if (!missing.length) { settleThenDone(0); return; } // pas na hercontrole naar opslaanpagina
      // Liefst een cliënt met een zichtbaar uursoort-veld; anders de eerste die nog
      // mist en dan diens EIGEN kaart uitklappen. Zo werkt het voor 2, 3, 4 of meer:
      // we hangen niet aan een globale "alles open"-check die een late kaart mist.
      const entry = missing.find((e) => e.uursoortTrigger) || missing[0];
      if (!entry.uursoortTrigger) {
        const key = clean(entry.name);
        const n = (expandTries.get(key) || 0) + 1;
        expandTries.set(key, n);
        if (n > 25) {
          // Deze cliënt lukt echt niet automatisch (na ~5s uitklappen): overslaan zodat de
          // rest wél verwerkt wordt (opslaan blijft geblokkeerd tot de gebruiker die zelf
          // invult). Ruimere limiet dan voorheen, zodat een traag remountende kaart bij
          // meerdere cliënten niet af en toe onterecht wordt overgeslagen.
          handled.add(key);
          setTimeout(step, 60);
          return;
        }
        showLoadingState(`Kaart openen voor ${entry.firstName}...`);
        if (entry.toggle && inviteeToggleExpanded(entry.toggle) === false) clickInviteeToggle(entry.toggle);
        else ensureClientExpanded(() => {}); // toggle-status onbekend of geen toggle: robuuste uitklap
        setTimeout(step, 200);
        return;
      }
      const ctx = { firstName: entry.firstName, name: entry.name, trigger: entry.uursoortTrigger };
      // Unieke laadpagina i.p.v. de opslaanpagina met "laden..." erover.
      showLoadingState(`Uursoort laden voor ${ctx.firstName}...`);
      listUursoortOptions((opts) => {
        if (opts === null) {
          // Veld (nog) niet leesbaar. Dit is meestal tijdelijk (kaart/veld remount na de
          // vorige cliënt), dus NIET meteen overslaan: eerst een aantal keer opnieuw
          // proberen. Pas na herhaalde mislukkingen als afgehandeld markeren, zodat we niet
          // blijven hangen maar ook cliënt 2 niet af en toe onterecht overslaan.
          const nkey = clean(ctx.name);
          const nt = (nullTries.get(nkey) || 0) + 1;
          nullTries.set(nkey, nt);
          if (nt <= 8) { setTimeout(step, 200); return; }
          handled.add(nkey);
          setTimeout(step, 180);
          return;
        }
        showUursoort(opts, () => {
          // Deze cliënt is nu handmatig gezet: niet opnieuw tonen, en NIET de
          // opslaanpagina laten flitsen - gewoon door naar de volgende cliënt.
          handled.add(clean(ctx.name));
          setTimeout(step, 160);
        }, ctx);
      }, freshUursoortTriggerForContext(ctx) || ctx.trigger, 0, false, entry);
    };
    step();
  }
  function uursoortContextsForNames(names) {
    const wanted = new Set(names.map(clean));
    return findClientEntries()
      .filter((entry) => wanted.has(clean(entry.name)) && entry.uursoortTrigger)
      .map((entry) => ({ firstName: entry.firstName, name: entry.name, trigger: entry.uursoortTrigger }));
  }
  function startUursoortForNewClients(names, attempt = 0) {
    if (!pendingChoice || !pendingChoice.pickUursoort || autoSelectingNewClient) return;
    autoSelectingNewClient = true;
    ensureClientExpanded(() => {
      const contexts = uursoortContextsForNames(names);
      if (!contexts.length && attempt < 8) {
        autoSelectingNewClient = false;
        setTimeout(() => startUursoortForNewClients(names, attempt + 1), 220);
        return;
      }
      if (!contexts.length) {
        autoSelectingNewClient = false;
        setStatus('Nieuwe client gevonden | uursoortveld niet gevonden', false);
        return;
      }
      setStatus(`Uursoort kiezen voor ${contexts.map((ctx) => ctx.firstName).join(' - ')}...`);
      showUursoortQueue(contexts, 0, () => {
        autoSelectingNewClient = false;
        showChoices();
        setStatus('Uursoort voor nieuwe client gezet');
      });
    });
  }
  function handleClientListChanges() {
    const entries = findClientEntries();
    const currentNames = new Set(entries.map((e) => e.name));
    // Verwijderde cliënt(en): voornaam uit de titel halen.
    if (knownClientNames.size) {
      for (const name of knownClientNames) {
        if (!currentNames.has(name)) removeFirstNameFromTitle(firstNameFromName(name));
      }
    }
    if (!entries.length) { knownClientNames.clear(); return; }
    maybePrefetchUursoorten(); // cliënt aanwezig -> uursoorten alvast op de achtergrond laden
    const firstSeed = !knownClientNames.size;
    const added = entries.filter((entry) => !knownClientNames.has(entry.name));
    knownClientNames = new Set(currentNames);
    if (firstSeed || !added.length) return;
    // Alleen ingrijpen als de gebruiker AL een afspraaktype koos (pendingChoice).
    // Zonder keuze eerst gewoon het keuzemenu tonen - NIET automatisch uursoorten
    // uitlezen (dat las eerder cliëntgegevens abusievelijk als uursoort in en sloeg
    // het afspraaktype over).
    if (pendingChoice && pendingChoice.pickUursoort && !uursoortQueueActive && !appointmentFlowBusy) {
      setTitleForChoice(pendingChoice, () => {});
      // Belangrijk: een LATER toegevoegde cliënt werd overgeslagen omdat we alleen
      // een algemene instructie toonden zonder de nieuwe cliënt(en) expliciet te
      // verwerken. Stuur nu de concreet toegevoegde namen door naar de auto-wachtrij
      // (die de nieuwe uursoortvelden zelf uitklapt en invult). Val alleen terug op
      // de handmatige instructie als er geen concrete namen zijn.
      const addedNames = added.map((e) => e.name).filter(Boolean);
      const state = computeAppointmentUursoortState();
      if (addedNames.length && (state === 'MIXED' || state === 'CHOICE')) {
        startUursoortForNewClients(addedNames);
      } else {
        ensureClientExpanded(() => showManualUursoortInstruction());
      }
    }
  }

  /*  diagnose  */

  /*  popup  */
  let popupEl = null, observer = null, active = false, repositionTimer = null;
  let userPos = null, dragging = false, dragDX = 0, dragDY = 0;
  let manualUursoortAutoTimer = null;
  let pendingChoice = null, clientWaitTimer = null, activeAppointmentDurationMinutes = null, activeAppointmentStartTimeText = '', appointmentTimeGuardTimers = [];
  // Eindtijd-guard: `helperEndText` = de laatste eindtijd die de hulp zelf schreef.
  // Wijkt de eindtijd daar later van af, dan heeft de medewerker hem handmatig
  // aangepast (`appointmentEndTimeUserOwned`) en zet de hulp hem NIET meer terug
  // (bv. bij het toevoegen van een herhaling, dat de opslaanpagina herbouwt).
  let helperEndText = '';
  let appointmentEndTimeUserOwned = false;
  // True zodra een afspraaktype ECHT is toegepast (handleChoice draaide: titel/
  // label/uursoort gezet). Alleen dán de andere types blokkeren. Klik je Huisbezoek
  // en ga je meteen terug (geen duur gekozen), dan is dit nog false -> geen blokkade.
  let appointmentTypeApplied = false;
  let appointmentFlowBusy = false;
  // Actief zolang de per-cliënt uursoort-keuzelijst getoond wordt (kan bij
  // meerdere cliënten langer duren dan de appointmentFlowBusy-timeout). Zolang
  // dit aan staat mag de periodieke refresh het scherm niet terugzetten.
  let uursoortQueueActive = false;
  let uursoortQueueCooldownUntil = 0;
  // Generatie van de uursoort-wachtrij. clearSettings en (her)mount verhogen dit,
  // zodat een lopende wachtrij (die op eigen timers draait) zichzelf afbreekt.
  let uursoortQueueGen = 0;
  // Korte periode waarin de automatische refresh NIET van scherm mag wisselen,
  // zodat een handmatige klik (bv. Terug op de opslaanpagina) blijft staan i.p.v.
  // meteen weer overschreven te worden.
  let suppressAutoUntil = 0;
  // Expliciete schermstatus i.p.v. tekstherkenning: voorkomt dat de 250ms-refresh
  // de opslaanpagina (en zijn Terug-knop) onder de muis herbouwt.
  let appointmentSaveScreenActive = false;
  // 'Afspraak doorplannen?'-intentie op de opslaanpagina. De bijbehorende
  // waarschuwing loopt via het algemene meldingenkanaal (helperQualityIssues);
  // een lichte bewaking hertekent de opslaanpagina zodra de blokkade omslaat
  // (herhaling gekozen/weggehaald), zodat knop en status live meelopen.
  let appointmentDoorplannen = false, doorplannenSaveWatch = null, doorplannenLastBlocked = null, doorplannenSuppressAutoUntil = 0, doorplannenLastRecurrenceSet = false, doorplannenLastExpanded = false;
  function stopDoorplannenSaveWatch() { if (doorplannenSaveWatch) { clearInterval(doorplannenSaveWatch); doorplannenSaveWatch = null; } }
  let knownClientNames = new Set(), autoSelectingNewClient = false;
  let appointmentAvailabilityConfirmedPeople = new Set(), appointmentForceChoiceOnce = false;
  let activeMode = null, registrationTravelClicked = false;
  let registrationNoShowPromptOpen = false, registrationNoShowPromptSuppressed = false, registrationNoShowPromptAfterNo = null;
  let registrationEpisodesPromptOpen = false, registrationEpisodesPromptSuppressed = false;
  let registrationHourTypeBusy = false;   // voorkomt glitch: screen niet overschrijven terwijl uursoorten laden
  let registrationFlowBusy = false;       // voorkomt glitch: screen niet overschrijven terwijl flow navigeert (reistijd → uursoort e.d.)
  // Alleen true tijdens de bewuste "Cliënt toevoegen"-knop van de helper. Alle
  // andere synthetische kliks op de ONS "+ Toevoegen"-knop worden geweerd, zodat
  // een blinde klik (dropdown sluiten e.d.) niet per ongeluk de zoek-genodigden
  // modal opent.
  let intentionalAddClientClick = false;
  const STRAY_ADD_EVENTS = ['pointerdown', 'mousedown', 'click'];
  // Tijdstip tot wanneer het openen van de zoek-genodigden-modal is toegestaan:
  // gezet door een echte gebruikersklik op de ONS "+ Toevoegen"-knop of door de
  // bewuste helper-knop. Buiten dit venster geldt een geopende modal als een
  // ongewenst neveneffect en wordt hij automatisch gesloten.
  let allowInviteeModalUntil = 0;
  function storageGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  const STORE_HELPER_ENABLED = 'onsHelper.helperEnabled';
  let activeNonClientOption = null;
  let nonClientBusy = false;
  let nonClientFreeTitleScreenActive = false; // 'Overig': vrij-titel-scherm actief
  let nonClientNoUursoortActive = false; // niet-client uursoort niet gevonden: foutpagina actief
  let agendaHelperDeactivate = null; // wordt door dayGreyModule gezet
  // Vrije/grijze dag: als de afspraak vanuit een grijs gemarkeerde kolom is
  // geopend, mag de afspraakhulp niet optreden (geen keuzes, geen opslaanblokkade).
  let appointmentFreeDay = false, appointmentFreeDayDate = null;
  let popupCollapsed = false, helperEnabled = storageGet(STORE_HELPER_ENABLED, '1') !== '0', appointmentClearingSettings = false, appointmentAwaitingManualUursoort = false;
  let activeRegistrationChoice = null, reapplyRegistrationSplitTimer = null, activeRegistrationHourTypeIndex = null;
  let activeRegistrationPortionMinutes = null; // tegen-tijd (indirect/direct) in minuten, of null
  // Registratie gestart vanuit een afspraak: het afspraaklabel bepaalt de
  // registratievorm (en dus direct/indirect), zodat de vorm-keuze wordt
  // overgeslagen. Zonder afspraak blijven deze null/false en verandert er niets.
  let registrationAutoChoice = null;        // gekoppelde REGISTRATION_CHOICES-entry, of null
  let registrationFromAppointment = false;  // label van een afspraak is uitgelezen
  let registrationAutoApplied = false;      // vorm al één keer automatisch toegepast
  let registrationRestoredToReport = false; // na refresh hersteld: direct naar het rapportagescherm
  let registrationExtrasRestored = false;  // direct/indirect + reistijd al één keer teruggezet na refresh
  let lastDomMutationAt = 0;               // laatste NIET-eigen DOM-mutatie (voor "pagina rustig?")
  let registrationSettleTimer = null;      // her-check terwijl we wachten tot de pagina rustig is
  let registrationRestoreHoldStart = 0;    // start van het wachten-op-laden (veiligheidscap)

  const $body = () => popupEl && popupEl.querySelector('[data-body]');
  function setStatus(text, ok) {
    if (!popupEl) return;
    const s = popupEl.querySelector('[data-status]');
    if (!s) return;
    s.innerHTML = '';
    if (!text) return;
    const bad = ok === false;
    const chip = document.createElement('div');
    Object.assign(chip.style, {
      // inline-flex i.p.v. flex: anders vult een block-level div altijd de
      // volledige breedte van het paneel en oogt de melding als een grote balk
      // in plaats van een compact label.
      display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '7px',
      fontSize: '11px', fontWeight: '700', maxWidth: '100%', boxSizing: 'border-box',
      background: bad ? ONSAH_TOKENS.badWash : ONSAH_TOKENS.okWash, color: bad ? ONSAH_TOKENS.bad : ONSAH_TOKENS.ok,
    });
    const icon = bad ? svgSpinePause() : svgSpineCheck();
    icon.setAttribute('width', '10'); icon.setAttribute('height', '10');
    Object.assign(icon.style, { width: '10px', height: '10px', flex: '0 0 auto' });
    chip.appendChild(icon);
    const lbl = document.createElement('span');
    Object.assign(lbl.style, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    lbl.textContent = text;
    chip.appendChild(lbl);
    s.appendChild(chip);
  }
  function showLoadingState(text) {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', color: '#333', fontWeight: '700', fontSize: '13px' });
    const spinner = document.createElement('span');
    Object.assign(spinner.style, { width: '16px', height: '16px', border: '2px solid #f2b7dc', borderTopColor: '#cc087d', borderRadius: '50%', display: 'inline-block', animation: 'onsHelperSpin .75s linear infinite', flex: '0 0 auto' });
    if (!document.getElementById('ons-helper-spin-style')) {
      const style = document.createElement('style');
      style.id = 'ons-helper-spin-style';
      style.textContent = '@keyframes onsHelperSpin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }
    const label = document.createElement('span');
    label.textContent = text || 'Bezig...';
    wrap.appendChild(spinner);
    wrap.appendChild(label);
    body.appendChild(wrap);
    setStatus(text || 'Bezig...');
  }
  function showDisabledState() {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    const msg = document.createElement('div');
    msg.textContent = 'Uitgeschakeld';
    Object.assign(msg.style, { fontWeight: '700', fontSize: '14px', color: '#555', padding: '4px 0 2px' });
    body.appendChild(msg);
    const sub = document.createElement('div');
    sub.textContent = 'Zet de hulp weer aan om automatisch verder te gaan.';
    Object.assign(sub.style, { fontSize: '12px', color: '#666', lineHeight: '1.35' });
    body.appendChild(sub);
    setStatus('Uitgeschakeld', false);
  }
  function refreshMainScreen() {
    if (!helperEnabled) { showDisabledState(); return; }
    if (activeMode === 'registrations') showRegistrationChoices();
    else showChoices();
  }
  function resumeAppointmentHelperAfterEnable() {
    _infoPanelRestore = null;
    _disabledRestore = null;
    appointmentAwaitingManualUursoort = false;
    updateSubmitGuard();
    if (!hasAppointmentPrereqs()) {
      if (hasClientInAppointment()) ensureClientExpanded(() => {});
      showAppointmentNeedsPrereqs();
      updateSubmitGuard();
      return;
    }
    ensureClientExpanded((expanded) => {
      appointmentForceChoiceOnce = true;
      showChoices();
      updateSubmitGuard();
      setStatus(expanded ? 'Clientkaarten open' : 'Clientkaarten openen...', expanded);
    });
  }
  // Eén gedeeld, klein stijlblok (focus-states + tactiele hover/active-feedback)
  // voor alle knoppen/koppen van de extensie op deze pagina. Eenmalig
  // geïnjecteerd, net als de bestaande spinner-stijl hierboven.
  //
  // LET OP — bewust GEEN <style>-tag met classes voor de knop-/tegel-opmaak
  // (dat gaf in productie kale, ongestylede knoppen en enorme SVG-iconen: de
  // host-pagina's eigen CSS/CSP kan een geïnjecteerde stylesheet negeren of
  // overschrijven). Precies zoals de rest van dit bestand wordt alle styling
  // daarom via directe inline element.style-properties gezet; die winnen
  // altijd (hoogste specificiteit) en zijn nooit afhankelijk van een
  // <style>-element. Interactie-states (hover/active/focus) gaan via JS-
  // event-listeners i.p.v. CSS-pseudo-classes. Deze functie blijft bestaan
  // (no-op) zodat bestaande aanroepen elders niet hoeven te wijzigen.
  function ensureOnsAhBaseStyles() {}
  const ONSAH_TOKENS = {
    ink: '#201d1f', inkSoft: '#6b6367', line: '#ece7e5', lineSoft: '#f6f2f0',
    brand: '#cc087d', brandDeep: '#8c0a58', brandWash: '#fdf1f8',
    ok: '#1b7f3b', okWash: '#eaf6ee', bad: '#a3241f', badWash: '#fbeceb',
  };
  // Focus-ring via JS (i.p.v. CSS :focus-visible) — werkt identiek, maar kan
  // nooit door een externe stylesheet worden geblokkeerd of overschreven.
  function onsahFocusRing(el, color) {
    el.addEventListener('focus', () => { el.style.outline = '2px solid ' + (color || ONSAH_TOKENS.brand); el.style.outlineOffset = '2px'; });
    el.addEventListener('blur', () => { el.style.outline = 'none'; });
  }
  // Pil: primaire/bevestigende actie. Vlakke kleur (geen gradient - dat oogde
  // gedateerd) + JS-gedreven hover/active, zodat de vorm nooit van een
  // <style>-tag afhangt. `to` fungeert als iets donkerdere druk-tint.
  function applyOnsahPillStyle(el, opts) {
    opts = opts || {};
    const from = opts.from || ONSAH_TOKENS.brand;
    const to = opts.to || ONSAH_TOKENS.brandDeep;
    const shadowRgb = opts.shadowRgb || '204,8,125';
    Object.assign(el.style, {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
      border: '0', borderRadius: '999px', padding: '10px 18px',
      font: '700 13px/1 system-ui,-apple-system,sans-serif', color: '#fff',
      background: from, cursor: 'pointer',
      boxShadow: '0 4px 12px -6px rgba(' + shadowRgb + ',.55)',
      transition: 'transform .08s ease, box-shadow .12s ease, background .1s ease', boxSizing: 'border-box',
    });
    el.addEventListener('mouseenter', () => { if (!el.disabled) el.style.boxShadow = '0 6px 16px -5px rgba(' + shadowRgb + ',.6)'; });
    el.addEventListener('mouseleave', () => { el.style.boxShadow = '0 4px 12px -6px rgba(' + shadowRgb + ',.55)'; el.style.background = from; });
    el.addEventListener('mousedown', () => { if (!el.disabled) { el.style.transform = 'translateY(1px)'; el.style.background = to; } });
    el.addEventListener('mouseup', () => { el.style.transform = 'none'; el.style.background = from; });
    onsahFocusRing(el, to);
  }
  // Kant-en-klare pil-knop met klik-handler (bevestigende acties, bv. Indienen).
  function mkPillButton(label, onClick, opts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    applyOnsahPillStyle(b, opts);
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(e); });
    return b;
  }
  // Vier categoriekleuren, dezelfde familie als het dagindeling-palet
  // (rood/blauw/geel/groen), nu ook op de keuzetegels: warme helft (rood/blauw)
  // voor cliëntgebonden keuzes, koele helft (geel/groen) voor de rest. Zo rijmt
  // de kleur die je kiest met de kleur die de afspraak straks in de agenda krijgt.
  const ONSAH_CATEGORY_COLORS = { visit: '#c94a3f', rest: '#3572b0', admin: '#b8862a', meet: '#2f8f57' };
  function onsahCategoryColor(clientPresent, index) {
    const pair = clientPresent ? [ONSAH_CATEGORY_COLORS.visit, ONSAH_CATEGORY_COLORS.rest] : [ONSAH_CATEGORY_COLORS.admin, ONSAH_CATEGORY_COLORS.meet];
    return pair[(index || 0) % 2];
  }
  // Registratievormen hebben geen clientPresent-veld, maar wel een
  // direct/indirect-verdeling (zelfde onderliggende onderscheid).
  function onsahRegistrationIsDirect(choice) {
    if (!choice) return true;
    if (choice.directFullDuration) return true;
    if (choice.indirectFullDuration) return false;
    if (choice.startSplit) return choice.startSplit.directPct >= choice.startSplit.indirectPct;
    return true;
  }
  // Klein, consistent SVG-icoon (lijn + stip) i.p.v. een cursieve Georgia-"i" —
  // zelfde stijl als de andere iconen in de extensie (svgIcon hieronder).
  function svgInfoIcon() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '14'); svg.setAttribute('height', '14'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.6'); svg.setAttribute('stroke-linecap', 'round');
    const line = document.createElementNS(svgNS, 'line'); line.setAttribute('x1', '7'); line.setAttribute('y1', '6.2'); line.setAttribute('x2', '7'); line.setAttribute('y2', '10.4');
    const dot = document.createElementNS(svgNS, 'circle'); dot.setAttribute('cx', '7'); dot.setAttribute('cy', '3.6'); dot.setAttribute('r', '.9'); dot.setAttribute('fill', 'currentColor'); dot.setAttribute('stroke', 'none');
    svg.appendChild(line); svg.appendChild(dot);
    return svg;
  }
  // Consistent sluit-kruisje (twee lijnen) i.p.v. een los "×"-teken.
  function svgCloseIcon() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '13'); svg.setAttribute('height', '13'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round');
    const l1 = document.createElementNS(svgNS, 'line'); l1.setAttribute('x1', '3'); l1.setAttribute('y1', '3'); l1.setAttribute('x2', '11'); l1.setAttribute('y2', '11');
    const l2 = document.createElementNS(svgNS, 'line'); l2.setAttribute('x1', '11'); l2.setAttribute('y1', '3'); l2.setAttribute('x2', '3'); l2.setAttribute('y2', '11');
    svg.appendChild(l1); svg.appendChild(l2);
    return svg;
  }
  // Spine-statusicoon: vinkje (hulp aan) of pauzeteken (uitgeschakeld).
  function svgSpineCheck() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '11'); svg.setAttribute('height', '11'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS(svgNS, 'path'); path.setAttribute('d', 'M3 7.2l2.6 2.6L11 4');
    svg.appendChild(path);
    return svg;
  }
  function svgSpinePause() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '11'); svg.setAttribute('height', '11'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round');
    const l1 = document.createElementNS(svgNS, 'line'); l1.setAttribute('x1', '5'); l1.setAttribute('y1', '3.5'); l1.setAttribute('x2', '5'); l1.setAttribute('y2', '10.5');
    const l2 = document.createElementNS(svgNS, 'line'); l2.setAttribute('x1', '9'); l2.setAttribute('y1', '3.5'); l2.setAttribute('x2', '9'); l2.setAttribute('y2', '10.5');
    svg.appendChild(l1); svg.appendChild(l2);
    return svg;
  }
  // `opts.tick` (hex) zet een kleine categoriekleur-stip vooraan (voor
  // type-keuzes); zonder tick is de tegel neutraal (voor Ja/Nee/Terug e.d.).
  // `opts.chevron` (default aan) toont een navigatie-chevron rechts.
  // `opts.accent` (hex) kleurt rand/tekst/hover voor destructieve varianten.
  function mkButton(label, onClick, opts) {
    opts = opts || {};
    const T = ONSAH_TOKENS;
    const hoverBg = opts.accentWash || (opts.accent ? opts.accent + '14' : T.brandWash);
    const chevColorHover = opts.accent || T.brand;
    const b = document.createElement('button');
    b.type = 'button';
    Object.assign(b.style, {
      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
      padding: '10px 11px', borderRadius: '11px', border: '1px solid ' + T.brand,
      background: '#fff', color: opts.accent || T.ink,
      font: '600 13.5px/1.3 system-ui,-apple-system,sans-serif', textAlign: 'left', cursor: 'pointer',
      transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease',
      boxSizing: 'border-box',
    });
    if (opts.tick) {
      const tick = document.createElement('span');
      Object.assign(tick.style, { width: '7px', height: '7px', borderRadius: '50%', flex: '0 0 auto', background: opts.tick });
      b.appendChild(tick);
    }
    const lbl = document.createElement('span');
    Object.assign(lbl.style, { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    lbl.textContent = label;
    b.appendChild(lbl);
    let chev = null;
    if (opts.chevron !== false) {
      chev = svgIcon('M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z');
      // Expliciete afmetingen op het element zelf: een SVG zonder width/height
      // valt terug op zijn (grote) intrinsieke default als er geen stylesheet
      // is die de maat overneemt — vandaar hier nooit alleen op CSS leunen.
      chev.setAttribute('width', '14'); chev.setAttribute('height', '14');
      Object.assign(chev.style, { width: '14px', height: '14px', color: '#c7bfbc', flex: '0 0 auto', transition: 'color .12s ease' });
      b.appendChild(chev);
    }
    b.addEventListener('mouseenter', () => {
      if (b.disabled) return;
      b.style.transform = 'translateY(-1px)';
      b.style.boxShadow = '0 4px 14px -6px rgba(32,20,15,.28)';
      b.style.background = hoverBg;
      b.style.borderColor = 'transparent';
      if (chev) chev.style.color = chevColorHover;
    });
    b.addEventListener('mouseleave', () => {
      b.style.transform = 'none';
      b.style.boxShadow = 'none';
      b.style.background = '#fff';
      b.style.borderColor = T.brand;
      if (chev) chev.style.color = '#c7bfbc';
    });
    b.addEventListener('mousedown', () => { if (!b.disabled) b.style.transform = 'translateY(0)'; });
    b.addEventListener('mouseup', () => { if (!b.disabled) b.style.transform = 'translateY(-1px)'; });
    onsahFocusRing(b, opts.accent || T.brand);
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    });
    return b;
  }
  // Aan/uit-schakelaar (role=switch) in de eigen roze huisstijl. `onChange(bool)`
  // krijgt de nieuwe stand; `.setChecked(bool)` zet de stand van buitenaf.
  function mkSwitch(initial, onChange) {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.setAttribute('role', 'switch');
    let on = !!initial;
    Object.assign(sw.style, { position: 'relative', width: '40px', height: '22px', borderRadius: '999px', border: '1px solid #cc087d', background: on ? '#cc087d' : '#fff', cursor: 'pointer', flex: '0 0 auto', padding: '0', transition: 'background .15s' });
    const knob = document.createElement('span');
    Object.assign(knob.style, { position: 'absolute', top: '2px', left: on ? '20px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: on ? '#fff' : '#cc087d', transition: 'left .15s, background .15s' });
    sw.appendChild(knob);
    const render = () => {
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
      sw.style.background = on ? '#cc087d' : '#fff';
      knob.style.left = on ? '20px' : '2px';
      knob.style.background = on ? '#fff' : '#cc087d';
    };
    render();
    sw.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); on = !on; render(); try { onChange && onChange(on); } catch (err) {} });
    sw.setChecked = (v) => { on = !!v; render(); };
    onsahFocusRing(sw);
    return sw;
  }
  // Kader (zoals de opslaanknop) met een vraagtekst links en een aan/uit-knop
  // rechts. `labelKey` verwijst naar een beheerbare schermtekst.
  function mkToggleBox(labelKey, fallbackLabel, initial, onChange) {
    const box = document.createElement('div');
    Object.assign(box.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: '1px solid #cc087d', borderRadius: '8px', padding: '9px 10px', background: '#fff' });
    const lab = mkText(labelKey, fallbackLabel, { fontSize: '13px', color: '#cc087d', fontWeight: '600', lineHeight: '1.3' });
    lab.style.flex = '1';
    lab.style.fontWeight = '600'; // zelfde dikte als de Opslaan-knop (mkButton), ongeacht managed 'bold'
    const sw = mkSwitch(initial, onChange);
    box.appendChild(lab);
    box.appendChild(sw);
    box._switch = sw;
    return box;
  }
  function svgIcon(pathD) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  }
  function setChevronIcon(button, collapsed) {
    if (!button) return;
    button.textContent = '';
    button.appendChild(svgIcon(collapsed ? 'M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z' : 'M7.4 15.4 12 10.8l4.6 4.6L18 14l-6-6-6 6z'));
  }
  function mkBackButton(onClick, label) {
    // Elke Terug-klik geeft ~1,2s rust aan de auto-refresh, zodat de navigatie
    // niet meteen wordt teruggedraaid (bv. van opslaanpagina naar keuzemenu).
    const wrapped = (...args) => { suppressAutoUntil = Date.now() + 1200; return onClick && onClick(...args); };
    const b = mkButton(label || 'Terug', wrapped);
    b.textContent = '';
    b.appendChild(svgIcon('M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20z'));
    b.appendChild(document.createTextNode(label || 'Terug'));
    Object.assign(b.style, { display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', textAlign: 'left', width: '100%' });
    return b;
  }
  function mkNavButton(label, onClick) {
    const b = mkButton(label, onClick);
    b.textContent = '';
    const span = document.createElement('span');
    span.textContent = label;
    span.style.flex = '1';
    b.appendChild(span);
    b.appendChild(svgIcon('M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4L16.2 13H4z'));
    Object.assign(b.style, { display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', textAlign: 'left', width: '100%' });
    return b;
  }
  function createCurrentScreenRestore() {
    const body = $body();
    const currentText = clean((body && body.textContent) || '');
    const registrationChoice = activeRegistrationChoice;
    const appointmentChoice = pendingChoice;
    const registrationScreen = {
      noShowPrompt: currentText.includes('no show?'),
      needsClient: /vul client, begintijd en datum in/.test(currentText),
      duration: !!registrationChoice && / duur:/.test(currentText),
      portionQuestion: !!registrationChoice && /tijd aanwezig in deze registratie/.test(currentText),
      portionDuration: !!registrationChoice && /^duur .* tijd:/.test(currentText),
      travel: !!registrationChoice && /totale reistijd/.test(currentText),
      hourType: /^uursoort(?:selectie|\s)/.test(currentText),
      submit: !!registrationChoice && /richtlijn rapporteren|schrijf nu je rapportage|indienen/.test(currentText),
    };
    const nonClientOpt = activeNonClientOption;
    const appointmentScreen = {
      needsPrereqs: /vul client, begintijd en datum in|voeg evt\. een client toe aan de afspraak/.test(currentText),
      nonClientMenu: /niet clientgerelateerde afspraken/.test(currentText),
      nonClientDuration: !!nonClientOpt && / duur:/.test(currentText),
      nonClientFreeTitle: !!nonClientOpt && !!nonClientOpt.freeTitle && /vul de titel aan na/.test(currentText),
      unavailable: /onbeschikbaar|al een afspraak|alsnog doorgaan/.test(currentText),
      duration: !!appointmentChoice && / duur:/.test(currentText),
      travel: !!appointmentChoice && /totale reistijd/.test(currentText),
      manualUursoort: appointmentAwaitingManualUursoort || currentText.includes('voeg de juiste uursoort toe aan de client'),
      readyToSave: /als de instellingen kloppen|voeg eventueel nog een locatie/.test(currentText),
    };
    return () => {
      if (activeMode === 'registrations') {
        if (registrationScreen.noShowPrompt) { showRegistrationNoShowPrompt(); return; }
        if (registrationScreen.needsClient) { showRegistrationNeedsClient(); return; }
        if (registrationScreen.duration && registrationChoice) { showRegistrationDurationAsk(registrationChoice); return; }
        if (registrationScreen.portionQuestion && registrationChoice) { showRegistrationPortionQuestion(registrationChoice); return; }
        if (registrationScreen.portionDuration && registrationChoice) { showRegistrationPortionDuration(registrationChoice); return; }
        if (registrationScreen.travel && registrationChoice) { showRegistrationTravelSelection(registrationChoice); return; }
        if (registrationScreen.hourType) { showRegistrationHourTypeSelection(activeRegistrationHourTypeIndex || 0); return; }
        if (registrationScreen.submit && registrationChoice) { showRegistrationReportPrompt(registrationChoice); return; }
        showRegistrationChoices();
        return;
      }
      if (appointmentScreen.nonClientFreeTitle && nonClientOpt) { showNonClientFreeTitlePrompt(nonClientOpt); return; }
      if (appointmentScreen.nonClientDuration && nonClientOpt) { showNonClientDurationSelection(nonClientOpt); return; }
      if (appointmentScreen.nonClientMenu) { showAppointmentNeedsPrereqs(); return; }
      if (appointmentScreen.readyToSave && nonClientOpt) { showAppointmentReadyToSave(); return; }
      if (appointmentScreen.needsPrereqs) { showAppointmentNeedsPrereqs(); return; }
      // (verwijderd) beschikbaarheidsmelding "heeft al een afspraak" -> geen routing meer
      if (appointmentScreen.duration && appointmentChoice) { showAppointmentDurationSelection(appointmentChoice); return; }
      if (appointmentScreen.travel && appointmentChoice) { showAppointmentTravelSelection(appointmentChoice); return; }
      if (appointmentScreen.manualUursoort) { showManualUursoortInstruction(); return; }
      if (appointmentScreen.readyToSave) { showAppointmentReadyToSave(); return; }
      showChoices();
    };
  }
  let _infoPanelRestore = null, _disabledRestore = null, _availabilityRestore = null;
  function closeInfoPanel() {
    if (!_infoPanelRestore) return;
    const restore = _infoPanelRestore;
    _infoPanelRestore = null;
    restore();
  }
  function toggleInfoPanel() {
    // tweede klik op de i-knop werkt als terug
    if (_infoPanelRestore) { closeInfoPanel(); return; }
    showInfoPanel();
  }
  function showInfoPanel() {
    const body = $body(); if (!body) return;
    if (_infoPanelRestore) return; // al open: niet opnieuw opbouwen
    _infoPanelRestore = helperEnabled ? createCurrentScreenRestore() : () => showDisabledState();
    const statusEl = popupEl && popupEl.querySelector('[data-status]');
    body.innerHTML = '';
    body.appendChild(mkBackButton(() => safe(closeInfoPanel), 'Terug'));

    const title = document.createElement('div');
    title.textContent = (activeMode === 'registrations' ? 'Registratiehulp' : 'Afspraakhulp');
    Object.assign(title.style, { fontWeight: '700', fontSize: '14px', margin: '6px 0 2px' });
    body.appendChild(title);

    const ver = document.createElement('div');
    ver.textContent = `Versie ${SCRIPT_VERSION}`;
    Object.assign(ver.style, { fontSize: '13px', color: '#333', margin: '0 0 8px' });
    body.appendChild(ver);

    const help = document.createElement('div');
    Object.assign(help.style, { fontSize: '13px', color: '#333', lineHeight: '1.4' });
    help.appendChild(document.createTextNode('Vragen of verbetersuggesties kunnen worden gesteld via '));
    const link = document.createElement('a');
    link.textContent = 'Topdesk';
    link.href = supportTopdeskUrl();
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    Object.assign(link.style, { color: '#cc087d', textDecoration: 'underline' });
    help.appendChild(link);
    help.appendChild(document.createTextNode('.'));
    body.appendChild(help);

    if (statusEl) { statusEl.textContent = ''; }
  }
  function addResetButton(body) {
    const reset = mkButton('Verwijder instellingen', () => safe(clearSettings), { tick: false, chevron: false, accent: '#a3241f', accentWash: '#fbeceb' });
    body.appendChild(reset);
  }
  function showAvailabilityWarning() {
    const body = $body(); if (!body) return;
    const entries = unavailableInvitees().filter((entry) => !appointmentAvailabilityConfirmedPeople.has(availabilityPersonKey(entry)));
    if (!entries.length) { showChoices(); return; }
    if (!_availabilityRestore) _availabilityRestore = createCurrentScreenRestore();
    body.innerHTML = '';
    const names = entries.map((entry) => entry.firstName).filter(Boolean);
    const nameText = names.length <= 1 ? (names[0] || 'Deze genodigde') : `${names.slice(0, -1).join(', ')} en ${names[names.length - 1]}`;
    const msg = document.createElement('div');
    msg.textContent = `${nameText} ${names.length === 1 ? 'heeft' : 'hebben'} al een afspraak, alsnog doorgaan?`;
    Object.assign(msg.style, { fontWeight: '700', fontSize: '14px', margin: '2px 0 4px', lineHeight: '1.35' });
    body.appendChild(msg);
    body.appendChild(mkButton('Ja', () => safe(() => {
      entries.forEach((entry) => appointmentAvailabilityConfirmedPeople.add(availabilityPersonKey(entry)));
      _availabilityRestore = null;
      // Door naar de juiste vervolgpagina: bij een ingevulde 'Overig'-titel of een
      // verder complete afspraak rechtstreeks naar de opslaanpagina, anders het keuzescherm.
      if (appointmentInSaveStage()) {
        if (activeNonClientOption && activeNonClientOption.freeTitle) nonClientFreeTitleScreenActive = false;
        showAppointmentReadyToSave();
      } else {
        appointmentForceChoiceOnce = true;
        showChoices();
      }
      setStatus('');
    })));
    body.appendChild(mkButton('Nee', () => safe(() => {
      _availabilityRestore = null;
      body.innerHTML = '';
      const msg = document.createElement('div');
      msg.textContent = 'Plan een andere datum/tijdstip in of sluit het scherm af.';
      Object.assign(msg.style, { fontSize: '13px', color: '#333', lineHeight: '1.45', padding: '4px 0 8px' });
      body.appendChild(msg);
      body.appendChild(mkButton('Afsluiten', () => safe(closeOnsModal)));
      body.appendChild(mkButton('Terug', () => safe(showChoices)));
      setStatus('Niet doorgaan gekozen', false);
    })));
    setStatus('Let op: al een afspraak', false);
  }
  // Sluit het ONS-afspraakmodal via de secundaire (Annuleren) knop. De knop is
  // een uc-button (web component): de echte <button> zit in de shadow root en
  // reageert alleen op een 'composed' klik-sequentie (clickUiButton), niet op een
  // gewone .click() die de shadow-grens niet oversteekt.
  function ucButtonIsSecondary(host) {
    const inner = host && host.shadowRoot && host.shadowRoot.querySelector('button[part="button"], button');
    return !!(inner && /\bsecondary\b/.test(inner.className || ''));
  }
  function closeOnsModal() {
    const hosts = deepQueryAll('uc-button').filter((h) => visible(h) && !isOwnPopup(h));
    // 1. uc-button met light-DOM-tekst "annuleren" (meest specifiek).
    for (const host of hosts) {
      if (clean(host.textContent || '') === 'annuleren' && clickUiButton(host)) return;
    }
    // 2. uc-button met secondary-styling (Annuleren is de secundaire knop).
    for (const host of hosts) {
      if (ucButtonIsSecondary(host) && clickUiButton(host)) return;
    }
    // 3. Fallback: een gewone knop/link met tekst "annuleren" of part+secondary.
    for (const el of deepQueryAll('button,a,[role="button"]')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const part = el.getAttribute('part') || '';
      const cls = el.className || '';
      const txt = clean(el.textContent || '');
      if (txt === 'annuleren' || (part === 'button' && /\bsecondary\b/.test(cls))) {
        if (clickElementCenter(el)) return;
        try { el.click(); return; } catch (e) {}
      }
    }
  }
  function anyUursoortPresent() {
    const entries = findClientEntries();
    if (entries.length) return entries.some(entryUursoortIsSet);
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger) return false;
    const txt = clean(uiText(trigger) || trigger.textContent || ('value' in trigger ? trigger.value : '') || '');
    return !!txt && !/zoek naar uursoorten|selecteer uursoort|uursoort|geen resultaten|voer minstens|toont /.test(txt);
  }
  // #2 - Zelftest: welke kern-hooks herkent de hulp NIET op het afspraakscherm?
  // Label/datum/begintijd horen altijd in de afspraakdetails te staan zodra het
  // keuzescherm verschijnt. Uursoort blijft buiten de check: dat veld zit soms in
  // een ingeklapte cliëntkaart en wordt bewust later door de gebruiker gekozen.
  function appointmentMissingHooks() {
    const missing = [];
    if (!getEtiketTrigger()) missing.push('label');
    if (!getDateInput()) missing.push('datum');
    if (!getStartTimeInput()) missing.push('begintijd');
    return missing;
  }
  // Bundelt de kwaliteitssignalen (onvolledige registratie) en zelfdiagnose
  // (kern-hook niet herkend) voor het altijd-zichtbare meldingenkanaal, zodat de
  // gebruiker ze ziet zonder het hulppaneel te openen. Levert [{sev,msg}].
  function helperQualityIssues() {
    const out = [];
    try {
      if (activeMode === 'events' && hasClientInAppointment()) {
        const miss = appointmentMissingHooks();
        if (miss.length) out.push({ sev: 'error', msg: 'Afspraakhulp herkent niet: ' + miss.join(', ') + '.' });
      }
      // Doorplannen aangevinkt maar herhaling nog op 'Niet': aandachtspunt in het
      // algemene meldingenkanaal (verdwijnt zodra een herhaling is gekozen).
      if (activeMode === 'events' && appointmentDoorplannen && appointmentSaveScreenActive
          && !(APP_CONFIG.features && APP_CONFIG.features.doorplannenToggle === false)
          && !recurrenceIsSet()) {
        out.push({ sev: 'warn', msg: doorplannenWarnText() });
      }
      if (activeMode === 'registrations') {
        registrationCompletenessIssues().forEach((it) => out.push(it));
      }
    } catch (e) {}
    return out;
  }
  // Platte tekst van de doorplannen-waarschuwing (beheerbaar, met terugval).
  function doorplannenWarnText() {
    const c = resolveText('doorplannen_waarschuwing');
    return (c && c.text) || "Je gaf aan de afspraak te willen doorplannen, maar de herhaling staat nog op 'Niet'. Stel de herhaling in, of zet 'Afspraak doorplannen?' uit en sla op.";
  }
  // #3 - Markeer een veld visueel zodat de gebruiker weet waar te handelen.
  function highlightField(el, ms) {
    try {
      if (!el || el.nodeType !== 1) return;
      const prevOutline = el.style.outline, prevOffset = el.style.outlineOffset;
      el.style.outline = '2px solid #cc087d';
      el.style.outlineOffset = '2px';
      try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
      setTimeout(() => { try { el.style.outline = prevOutline; el.style.outlineOffset = prevOffset; } catch (e) {} }, ms || 6000);
    } catch (e) {}
  }
  // #2 - Waarschuwingsbanner met instelbare tekst + doorklik naar het meldkanaal.
  function mkProblemBanner(missing) {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { border: '1px solid #b3261e', background: '#fdecea', borderRadius: '8px', padding: '8px 10px', margin: '0 0 8px' });
    wrap.appendChild(mkText('probleem_hulp_werkt_niet',
      'Let op: de afspraakhulp herkent een veld niet en werkt mogelijk niet volledig. Controleer de afspraak zelf en meld dit via \'Meld probleem\' in de extensie.',
      { color: '#b3261e', fontWeight: '700', fontSize: '13px', lineHeight: '1.35' }));
    const sub = document.createElement('div');
    Object.assign(sub.style, { marginTop: '4px', fontSize: '12px', color: '#b3261e' });
    if (missing && missing.length) sub.appendChild(document.createTextNode('Niet herkend: ' + missing.join(', ') + '. '));
    const a = document.createElement('a');
    a.textContent = 'Meld probleem';
    a.href = supportTopdeskUrl(); a.target = '_blank'; a.rel = 'noopener noreferrer';
    Object.assign(a.style, { color: '#b3261e', textDecoration: 'underline', fontWeight: '700' });
    sub.appendChild(a);
    wrap.appendChild(sub);
    return wrap;
  }
  // De hulp vereist een gekozen team: toon een duidelijke melding i.p.v. een lege
  // keuzelijst. Het team kies je in de extensie-popup (kleurprofiel).
  function showNeedsTeamChoice() {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    const t = document.createElement('div');
    Object.assign(t.style, { fontSize: '13px', color: '#333', lineHeight: '1.4', padding: '6px 0' });
    t.textContent = 'Kies eerst je team om de hulp te gebruiken.';
    const sub = document.createElement('div');
    Object.assign(sub.style, { fontSize: '12px', color: '#666', lineHeight: '1.4' });
    sub.textContent = 'Open de extensie (het pictogram naast de adresbalk) en kies je team/kleurprofiel. Daarna verschijnen de afspraaktypes en registraties hier.';
    body.appendChild(t); body.appendChild(sub);
    setStatus('Kies eerst je team', false);
  }
  function showChoices() {
    const body = $body(); if (!body) return;
    if (typeof stopManualUursoortAutoCheck === 'function') stopManualUursoortAutoCheck();
    stopDoorplannenSaveWatch();
    appointmentDoorplannen = false; // nieuwe afspraakflow: doorplannen-intentie reset
    if (appointmentClearingSettings) { showLoadingState('Instellingen verwijderen...'); return; }
    if (helperNeedsTeamChoice()) { showNeedsTeamChoice(); return; }
    nonClientFreeTitleScreenActive = false;
    appointmentAwaitingManualUursoort = false;
    activeNonClientOption = null; // terug naar clientflow
    body.innerHTML = '';
    const forceChoice = appointmentForceChoiceOnce;
    appointmentForceChoiceOnce = false;
    if (!hasAppointmentPrereqs()) {
      showAppointmentNeedsPrereqs();
      return;
    }
    if (appointmentNeedsAvailabilityConfirmation()) {
      showAvailabilityWarning();
      return;
    }
    if (!forceChoice && appointmentReadyToSave()) {
      showAppointmentReadyToSave();
      return;
    }
    if (clientWaitTimer) { clearTimeout(clientWaitTimer); clientWaitTimer = null; }
    // Is er al een afspraaktype ECHT toegepast? Dan de andere types BLOKKEREN
    // i.p.v. proberen te overschrijven - dat was onbetrouwbaar. De gebruiker
    // verwijdert eerst de instellingen. De type-labels blijven zichtbaar
    // (uitgeschakeld), zodat de refresh niet terugspringt naar de opslaanpagina.
    if (appointmentTypeApplied) {
      renderChoicesBlocked(body);
      return;
    }
    ensureClientExpanded((expanded) => {
      if (!expanded) setStatus('Clientkaart openen...', false);
    });
    // #2 - Zelftest: waarschuw proactief als een kern-hook niet herkend wordt
    // (bv. na een ONS-wijziging), zodat een stille detectiefout meteen opvalt.
    const _missingHooks = appointmentMissingHooks();
    if (_missingHooks.length) {
      body.appendChild(mkProblemBanner(_missingHooks));
      logStep('zelftest: hooks niet herkend', false, _missingHooks.join(', '));
    }
    CONFIG.choices.forEach((choice, i) => body.appendChild(mkButton(choice.label, () => safe(() => {
      pendingChoice = choice;
      prepareClientAndHandleChoice(choice);
    }), { tick: onsahCategoryColor(choice.clientPresent, i) })));
    addResetButton(body);
    setStatus('');
  }
  function renderChoicesBlocked(body) {
    const note = document.createElement('div');
    note.textContent = 'Er zijn al instellingen toegepast. Verwijder eerst de instellingen om een ander afspraaktype te kiezen.';
    Object.assign(note.style, { fontSize: '13px', color: '#b3261e', lineHeight: '1.35', padding: '4px 0 8px' });
    body.appendChild(note);
    CONFIG.choices.forEach((choice, i) => {
      const b = mkButton(choice.label, () => {}, { tick: onsahCategoryColor(choice.clientPresent, i) });
      try { b.disabled = true; } catch (e) {}
      b.setAttribute('aria-disabled', 'true');
      Object.assign(b.style, { opacity: '0.45', cursor: 'not-allowed' });
      body.appendChild(b);
    });
    addResetButton(body);
    // "Naar opslaan" alleen tonen als er ook écht opgeslagen kan worden.
    if (appointmentReadyToSave()) {
      body.appendChild(mkNavButton('Naar opslaan', () => safe(() => {
        appointmentForceChoiceOnce = false;
        showAppointmentReadyToSave();
      })));
    }
    setStatus('Verwijder eerst de instellingen', false);
  }
  // Goedkope route: de "+ Toevoegen"-knop staat als light-DOM <uc-button> in de
  // header van #teleport (de Genodigden-kaart). Een gerichte querySelector daar
  // is vele malen lichter dan een deepQueryAll over alle shadow-roots — cruciaal
  // omdat dit bij elke mount draait.
  function findAddInviteeButtonFast() {
    const tp = document.getElementById('teleport');
    if (!tp) return null;
    const header = tp.querySelector('div[slot="header"], [class*="_header_"]') || tp;
    let candidates;
    try { candidates = header.querySelectorAll('uc-button, button'); } catch (e) { return null; }
    for (const btn of candidates) {
      if (!visible(btn) || isOwnPopup(btn)) continue;
      const txt = clean(uiText(btn) || btn.textContent || '');
      const hasAdd = (btn.shadowRoot && (btn.shadowRoot.querySelector('uc-icon[icon="add"]') || btn.shadowRoot.querySelector('[icon="add"]'))) ||
        (btn.querySelector && btn.querySelector('uc-icon[icon="add"]'));
      if (/(^|[^a-z])toevoegen([^a-z]|$)/.test(txt) || hasAdd) return btn;
    }
    return null;
  }
  function findAddClientButton() {
    // Eerst de goedkope, gerichte route; alleen bij afwezigheid van #teleport
    // (andere layout) terugvallen op de bredere scan.
    const fast = findAddInviteeButtonFast();
    if (fast) return fast;
    // Knop "Toevoegen" binnen de Genodigden-kaart. Zoek document-breed,
    // want de ONS-modal bestaat soms uit meerdere sibling-containers.
    const scope = document;
    const headings = deepQueryAll('h1,h2,h3,div,span,p', scope).filter(function (el) {
      const txt = clean(el.textContent || '');
      return visible(el) && !isOwnPopup(el) && (txt === 'genodigden' || (txt.startsWith('genodigden') && txt.length < 80));
    }).sort(function (a, b) { return rect(a).top - rect(b).top || rect(a).left - rect(b).left; });
    const hasAddIcon = function (b) {
      return !!(b && (
        (b.querySelector && (b.querySelector('uc-icon[icon="add"]') || b.querySelector('[icon="add"]'))) ||
        (b.shadowRoot && (b.shadowRoot.querySelector('uc-icon[icon="add"]') || b.shadowRoot.querySelector('[icon="add"]')))
      ));
    };
    const buttonText = function (b) {
      return clean(uiText(b) || b.textContent || (b.shadowRoot && b.shadowRoot.textContent) || '');
    };
    const candidates = deepQueryAll('uc-button,button,[role="button"]', scope)
      .filter(function (b) {
        if (isOwnPopup(b)) return false;
        const r = rect(b);
        if (r.width <= 0 || r.height <= 0) return false;
        return /toevoegen/.test(buttonText(b)) || hasAddIcon(b);
      })
      .map(function (b) {
        const r = rect(b);
        const nearestHeading = headings.reduce(function (best, h) {
          const hr = rect(h);
          if (r.top < hr.top - 55 || r.top > hr.top + 160) return best;
          if (r.left < hr.left + 120 || r.left > hr.left + 900) return best;
          const dy = Math.abs((r.top + r.height / 2) - (hr.top + hr.height / 2));
          const sameHeaderBand = r.top >= hr.top - 36 && r.top <= hr.top + 110;
          const rightOfHeading = r.left > hr.left + 120;
          const score = dy + Math.abs(r.left - hr.left) / 6 + (sameHeaderBand ? -600 : 0) + (rightOfHeading ? -250 : 0);
          return Math.min(best, score);
        }, headings.length ? 99999 : 0);
        const txt = buttonText(b);
        const textBonus = /toevoegen/.test(txt) ? -700 : 0;
        const iconBonus = hasAddIcon(b) ? -150 : 0;
        const agendaPenalty = nearestHeading >= 99999 ? 100000 : 0;
        return { button: b, score: nearestHeading + textBonus + iconBonus + agendaPenalty };
      })
      .sort(function (a, b) { return a.score - b.score; });
    return candidates.length && candidates[0].score < 50000 ? candidates[0].button : null;
  }
  function clickAddClientButton() {
    const btn = findAddClientButton();
    if (!btn) { setStatus('Knop "Cli\u00ebnt toevoegen" niet gevonden', false); return false; }
    // Bewuste opening: sta de modal 6 s toe zodat de auto-sluit-net hem niet dicht.
    intentionalAddClientClick = true;
    allowInviteeModalUntil = Date.now() + 6000;
    try { clickUiButton(btn); } finally {
      setTimeout(() => { intentionalAddClientClick = false; }, 400);
    }
    setStatus('Cli\u00ebnt toevoegen geopend');
    return true;
  }
  // Herken de ONS "Zoek naar genodigden"-modal (los van de afspraak-modal).
  function findInviteeSearchModal() {
    for (const m of deepQueryAll('uc-modal,[role="dialog"],dialog')) {
      if (!visible(m) || isOwnPopup(m)) continue;
      const al = clean((m.getAttribute && (m.getAttribute('aria-label') || '')) || '');
      if (al === 'afspraak toevoegen' || al === 'afspraakdetails') continue;
      if (/zoek naar genodigden|genodigde toevoegen|genodigde zoeken/.test(al)) return m;
      const txt = clean((m.textContent || '').slice(0, 500));
      if (/zoek naar (clienten|genodigden)/.test(txt) && /medewerker/.test(txt) && /(groep|team|locatie)/.test(txt)) return m;
    }
    return null;
  }
  function closeInviteeSearchModal(modal) {
    const closeBtn = deepQueryAll(UI_OVERRIDES.afsCloseButton || 'uc-button[aria-label*="sluit" i], button[aria-label*="sluit" i]', modal)
      .find((b) => visible(b) && !isOwnPopup(b));
    if (closeBtn) { clickUiButton(closeBtn); return true; }
    const dlg = deepQueryAll('dialog,[role="dialog"]', modal)[0] || modal;
    try { dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, composed: true, cancelable: true })); } catch (e) {}
    return false;
  }
  // Sluit de zoek-genodigden-modal als die niet door de gebruiker (of de bewuste
  // helper-knop) is geopend. Vangt het neveneffect ongeacht welke interne klik
  // hem opende \u2014 betrouwbaarder dan het onderscheppen door de shadow-DOM heen.
  function maybeDismissStrayInviteeModal(attempt = 0) {
    if (!helperEnabled || activeMode === 'registrations') return;
    if (intentionalAddClientClick || Date.now() < allowInviteeModalUntil) return;
    const modal = findInviteeSearchModal();
    if (!modal) {
      // De inhoud van de modal kan nog renderen; kort opnieuw proberen.
      if (attempt < 6) setTimeout(() => maybeDismissStrayInviteeModal(attempt + 1), 70);
      return;
    }
    if (intentionalAddClientClick || Date.now() < allowInviteeModalUntil) return;
    dbg('onverwachte zoek-genodigden modal automatisch gesloten (poging ' + attempt + ')');
    closeInviteeSearchModal(modal);
    // Nogmaals controleren: sommige flows heropenen hem direct.
    if (attempt < 6) setTimeout(() => maybeDismissStrayInviteeModal(attempt + 1), 90);
  }
  // Handler die DIRECT op de "+ Toevoegen"-knop wordt gehangen. Zo vangen we de
  // activatie ongeacht de shadow-DOM/composed-grens (een document-listener mist
  // niet-composed synthetische events die binnen de shadow-root worden afgevuurd).
  function inviteeAddButtonGuard(e) {
    if (intentionalAddClientClick || Date.now() < allowInviteeModalUntil) return;
    if (e.isTrusted) {
      // Echte gebruikersklik: toestaan én een venster openen zodat de modal
      // en eventuele vervolgevents (mousedown→click) niet worden geblokkeerd.
      allowInviteeModalUntil = Date.now() + 6000;
      return;
    }
    // Synthetische activatie zonder toestemming: tegenhouden vóór ONS reageert.
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    dbg('synthetische activatie van "+ Toevoegen" geblokkeerd op de knop zelf (' + e.type + ')');
  }
  // Hang de guard op de actuele "+ Toevoegen"-knop (en zijn inner shadow-button).
  // Wordt bij elke mount opnieuw aangeroepen omdat ONS de knop kan hertekenen.
  function guardInviteeAddButton() {
    if (activeMode === 'registrations') return;
    // Bewust de goedkope finder: dit draait bij elke mount, dus geen dure
    // document-brede shadow-scan.
    const btn = findAddInviteeButtonFast();
    if (!btn) return;
    const targets = [btn];
    const inner = btn.shadowRoot && btn.shadowRoot.querySelector('button');
    if (inner) targets.push(inner);
    for (const el of targets) {
      if (el.__onsInviteeGuarded) continue;
      el.__onsInviteeGuarded = true;
      for (const type of STRAY_ADD_EVENTS) el.addEventListener(type, inviteeAddButtonGuard, true);
    }
  }
  function mkAddClientButton() {
    const b = document.createElement('button');
    b.type = 'button';
    applyOnsahPillStyle(b);
    Object.assign(b.style, { width: '100%', marginBottom: '8px' });
    // add-icoon (zelfde pad als ONS)
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('fill', 'currentColor');
    p.setAttribute('d', 'M18 13h-5v5c0 .55-.45 1-1 1s-1-.45-1-1v-5H6c-.55 0-1-.45-1-1s.45-1 1-1h5V6c0-.55.45-1 1-1s1 .45 1 1v5h5c.55 0 1 .45 1 1s-.45 1-1 1');
    svg.appendChild(p);
    b.appendChild(svg);
    b.appendChild(document.createTextNode('Cli\u00ebnt toevoegen'));
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); safe(clickAddClientButton); });
    return b;
  }
  function showAppointmentNeedsPrereqs() {
    const body = $body(); if (!body) return;
    nonClientFreeTitleScreenActive = false;
    body.innerHTML = '';
    const dateTimeReady = hasAppointmentDate() && hasAppointmentStartTime();
    if (!dateTimeReady) {
      const msg = document.createElement('div');
      msg.textContent = 'Vul begintijd en datum in.';
      Object.assign(msg.style, { fontSize: '13px', color: '#333', lineHeight: '1.35', padding: '4px 0 8px' });
      body.appendChild(msg);
      setStatus('Wacht op begintijd en datum');
      return;
    }
    // Knop om een cliënt toe te voegen (klikt de echte ONS-knop).
    if (hasClientInAppointment()) {
      showChoices();
      return;
    }
    body.appendChild(mkAddClientButton());
    // Niet-clientgerelateerde categorieën staan altijd open.
    const head = document.createElement('div');
    head.textContent = 'Niet cliëntgerelateerde afspraken';
    Object.assign(head.style, { fontWeight: '700', fontSize: '13px', color: '#333', margin: '2px 0 6px' });
    body.appendChild(head);
    // Beheerde categorieën uit config.nonClientCategories hebben voorrang (incl.
    // informatielabel/duur per type); leeg = ingebouwde lijst.
    (nonClientCategoriesActive()).forEach(function (cat) {
      body.appendChild(mkNavButton(cat.label, function () { return safe(function () {
        if (cat.directOption) handleNonClientOption(cat.directOption);
        else showNonClientCategory(cat);
      }); }));
    });
    addNonClientResetButton(body);
    setStatus('Kies een categorie of voeg een cliënt toe');
  }
  function addNonClientResetButton(body) {
    const reset = mkButton('Verwijder instellingen', function () { return safe(clearNonClientSettings); }, { chevron: false, accent: '#a3241f', accentWash: '#fbeceb' });
    reset.style.marginTop = '6px';
    body.appendChild(reset);
  }
  function findNonClientUursoortTrigger() {
    // Het uursoort-veld op afspraakniveau, via het label "Uursoort" in Afspraakdetails.
    // Gebruik hier nooit de cliëntkaart: dezelfde discipline als de cliëntgebonden
    // flow, maar dan met een eigen afspraakniveau-context.
    const modal = findModal() || document;
    const modalBox = modal && modal.getBoundingClientRect ? rect(modal) : { left: 0, width: window.innerWidth || document.documentElement.clientWidth || 1200 };
    const detailsHead = deepQueryAll('h1,h2,h3,div,span,p', modal).find(function (el) {
      return visible(el) && !isOwnPopup(el) && clean(el.textContent || '') === 'afspraakdetails';
    });
    const detailsLeft = detailsHead ? rect(detailsHead).left : (modalBox.left + modalBox.width * 0.45);
    const rightSide = function (el) {
      const r = rect(el);
      if (r.width <= 0 || r.height <= 0) return false;
      if (r.left < detailsLeft - 100) return false;
      let n = el.parentElement;
      for (let depth = 0; n && depth < 7; depth++, n = n.parentElement) {
        const txt = clean(n.textContent || '');
        if (txt.includes('genodigden') || txt.includes('clienten zijn aanwezig') || txt.includes('verwijder uit selectie')) return false;
        if (txt.includes('afspraakdetails')) return true;
      }
      return true;
    };
    const direct = deepQueryAll('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"]', modal)
      .filter(function (el) { return visible(el) && !isOwnPopup(el) && rightSide(el); })
      .sort(function (a, b) { return rect(a).top - rect(b).top; })[0];
    if (direct) {
      return direct;
    }
    const labels = deepQueryAll('label,div,span,p', modal).filter(function (el) {
      return visible(el) && !isOwnPopup(el) && clean(el.textContent || '') === 'uursoort';
    }).filter(function (label) {
      const lr = rect(label);
      if (lr.left < detailsLeft - 80) return false;
      let n = label.parentElement;
      for (let depth = 0; n && depth < 7; depth++, n = n.parentElement) {
        const txt = clean(n.textContent || '');
        if (txt.includes('genodigden') || txt.includes('clienten zijn aanwezig') || txt.includes('verwijder uit selectie')) return false;
        if (txt.includes('afspraakdetails')) return true;
      }
      return true;
    });
    for (const label of labels) {
      const lr = rect(label);
      const candidates = deepQueryAll('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], [data-qa="hour_type_select"], [role="combobox"],select,button,div,span,input', modal);
      let best = null, bestScore = Infinity;
      for (const el of candidates) {
        if (!visible(el) || isOwnPopup(el) || el === label) continue;
        const meta = clean((uiText(el) || '') + ' ' + ((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('data-qa') || '')) || ''));
        if (/reistijd|locatie|labels|notities|titel|begintijd|eindtijd/.test(meta)) continue;
        const r = rect(el);
        if (r.width < 150 || r.height < 22 || r.height > 90) continue;
        if (r.top < lr.bottom - 8 || r.top > lr.bottom + 100) continue;
        if (Math.abs(r.left - lr.left) > 280) continue;
        const textBonus = /zoek naar uursoorten|uursoort/.test(meta) ? -500 : 0;
        const hostBonus = /^UC-SELECT$/i.test(el.tagName || '') ? -700 : 0;
        const score = textBonus + hostBonus + (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
        if (score < bestScore) { best = el; bestScore = score; }
      }
      if (best) {
        const nested = best.querySelector && best.querySelector('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], [data-qa="hour_type_select"], [aria-label="Uursoort"]');
        return nested || best;
      }
    }
    return null;
  }
  function clearNonClientUursoort(onDone) {
    // Één poging: chip-verwijdering of dropdown-deselect. Bij mislukking
    // accepteren — de uursoort wordt bij de volgende keuze toch overschreven.
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger || !nonClientUursoortValueText()) { if (onDone) onDone(); return; }
    const clicked = clickLabelChipRemovers(trigger, []);
    if (clicked) { setTimeout(function () { if (onDone) onDone(); }, 220); return; }
    clearUursoort(function () { if (onDone) onDone(); }, trigger);
  }
  function clearNonClientSettings() {
    appointmentClearingSettings = true;
    setStatus('Instellingen verwijderen...');
    let finished = false;
    const finish = function (ok, text) {
      if (finished) return;
      finished = true;
      clearTimeout(guard);
      activeNonClientOption = null;
      appointmentClearingSettings = false;
      showAppointmentNeedsPrereqs();
      setStatus(text || 'Instellingen verwijderd', ok !== false);
    };
    const guard = setTimeout(function () {
      finish(false, 'Instellingen grotendeels verwijderd');
    }, 5500);
    try {
      // Stop alle geplande eindtijd-timers zodat ze de schone staat niet overschrijven.
      appointmentTimeGuardTimers.forEach(function (t) { clearTimeout(t); });
      appointmentTimeGuardTimers = [];
      activeAppointmentDurationMinutes = null;
      clearTitle();
      clearEndTime();
      clearAppointmentTravelTimes();
      clearKnownLabels(function () {
        try {
          clearNonClientUursoort(function () { finish(true, 'Instellingen verwijderd'); });
        } catch (e) {
          dbg('clearNonClientUursoort fout', e);
          finish(false, 'Instellingen deels verwijderd');
        }
      });
    } catch (e) {
      dbg('clearNonClientSettings fout', e);
      finish(false, 'Instellingen deels verwijderd');
    }
  }
  let nonClientInfoOverlay = null;
  function closeNonClientOptionInfo() {
    if (nonClientInfoOverlay && nonClientInfoOverlay.parentNode) nonClientInfoOverlay.parentNode.removeChild(nonClientInfoOverlay);
    nonClientInfoOverlay = null;
  }
  function showNonClientOptionInfo(opt) {
    closeNonClientOptionInfo();
    // Boven de afspraakhulp-popup tonen. De ONS-modal zit in de top-layer, dus een
    // overlay op document.body valt erachter. Daarom hangen we de info-popup in
    // dezelfde host als popupEl en positioneren we hem over de popup heen.
    const host = (popupEl && popupEl.parentNode) || document.body;
    const r = popupEl ? rect(popupEl) : { left: 24, top: 74, width: 280, height: 200 };
    const box = document.createElement('div');
    nonClientInfoOverlay = box;
    Object.assign(box.style, {
      position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px',
      zIndex: '2147483647', boxSizing: 'border-box',
      background: '#fff', border: '2px solid #e91e8c', borderRadius: '12px',
      padding: '14px 16px', fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
    });
    const headRow = document.createElement('div');
    Object.assign(headRow.style, { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' });
    const title = document.createElement('div');
    title.textContent = opt.display;
    Object.assign(title.style, { fontWeight: '700', fontSize: '14px', color: '#e91e8c', flex: '1' });
    const closeX = document.createElement('button');
    closeX.textContent = '✕';
    Object.assign(closeX.style, {
      flexShrink: '0', width: '24px', height: '24px', padding: '0', lineHeight: '1',
      border: 'none', background: 'transparent', color: '#e91e8c', fontSize: '16px', cursor: 'pointer',
    });
    closeX.title = 'Sluiten';
    closeX.addEventListener('click', function (e) { e.stopPropagation(); closeNonClientOptionInfo(); });
    headRow.appendChild(title);
    headRow.appendChild(closeX);
    box.appendChild(headRow);
    const text = document.createElement('div');
    text.textContent = opt.info || '';
    Object.assign(text.style, { fontSize: '13px', color: '#333', lineHeight: '1.5' });
    box.appendChild(text);
    try { host.appendChild(box); } catch (e) { document.body.appendChild(box); }
  }
  function showNonClientCategory(cat) {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    body.appendChild(mkBackButton(function () { return safe(showAppointmentNeedsPrereqs); }, 'Terug'));
    const head = document.createElement('div');
    head.textContent = cat.label;
    Object.assign(head.style, { fontWeight: '700', fontSize: '13px', color: '#333', margin: '2px 0 6px' });
    body.appendChild(head);
    (cat.options || []).forEach(function (opt) {
      if (opt.info) {
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', gap: '4px', marginBottom: '4px' });
        const mainBtn = mkButton(opt.display, function () { return safe(function () { handleNonClientOption(opt); }); });
        mainBtn.style.flex = '1';
        mainBtn.style.margin = '0';
        const infoBtn = document.createElement('button');
        infoBtn.textContent = 'ℹ';
        Object.assign(infoBtn.style, {
          flexShrink: '0', width: '28px', height: '28px', padding: '0',
          border: '1px solid #e91e8c', borderRadius: '6px', background: '#fff',
          color: '#e91e8c', fontSize: '14px', cursor: 'pointer', lineHeight: '1',
        });
        infoBtn.title = 'Meer info over ' + opt.display;
        infoBtn.addEventListener('click', function (e) { e.stopPropagation(); safe(function () { showNonClientOptionInfo(opt); }); });
        row.appendChild(mainBtn);
        row.appendChild(infoBtn);
        body.appendChild(row);
      } else {
        body.appendChild(mkButton(opt.display, function () { return safe(function () { handleNonClientOption(opt); }); }));
      }
    });
    setStatus('Kies een optie');
  }
  function applyNonClientEndTime(minutes) {
    activeAppointmentStartTimeText = appointmentCurrentStartTimeText();
    clearAppointmentTravelTimes();
    const ok = setAppointmentEndTimePlusMinutes(minutes);
    scheduleAppointmentEndTime(minutes);
    return ok;
  }
  function finishNonClientOption(opt) {
    // Label JG Overig zetten en daarna naar de opslaanpagina zodra de tijden kloppen.
    // Het label-veld zit in hetzelfde Afspraakdetails-paneel als de eindtijd, dus de
    // label-selectie kan de eindtijd wissen -> na elke stap opnieuw afdwingen,
    // precies zoals handleChoice dat in de cliëntflow doet.
    // enforceAppointmentEndTime/scheduleAppointmentEndTime doen niets als
    // activeAppointmentDurationMinutes null is (eindtijd was al ingevuld).
    setLabel('JG Overig', function () {
      setAppointmentTitleText(opt.display);
      scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
      setStatus(opt.display + ' gezet');
      const tryShow = function () {
        if (activeNonClientOption !== opt) return false;
        // Eindtijd opnieuw afdwingen vóór de check; een paneel-rerender kan hem
        // ondertussen hebben gewist.
        enforceAppointmentEndTime(activeAppointmentDurationMinutes);
        // Naar opslaanpagina zodra datum + begin- + eindtijd kloppen (uursoort
        // mag handmatig; de opslaanpagina toont anders een uursoort-melding).
        if (hasAppointmentDate() && hasAppointmentStartTime() && hasAppointmentEndTime()) {
          showAppointmentReadyToSave();
          return true;
        }
        return false;
      };
      [120, 350, 700, 1200].forEach(function (d) { setTimeout(function () { safe(tryShow); }, d); });
    });
  }
  function nonClientHourTypeMatches(text, wanted) {
    const c = clean(text);
    const w = clean(wanted);
    const loose = clean(String(wanted || '').replace(/[*#]+$/, ''));
    return !!c && (c === w || (!!loose && c === loose) || c.includes(w) || (!!loose && c.includes(loose)));
  }
  // Geeft de geselecteerde uursoort-chips naast het trigger-veld terug,
  // op dezelfde manier als selectedKnownLabels dat voor etiketten doet.
  function nonClientUursoortChips(trigger) {
    if (!trigger) return [];
    const tr = rect(trigger);
    const found = [];
    const seen = new Set();
    for (const el of deepQueryAll('div,span,button,[role="button"]')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const r = rect(el);
      if (r.bottom < tr.top - 24 || r.top > tr.bottom + 24 || r.left < tr.left - 60 || r.right > tr.right + 120) continue;
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const c = clean(txt);
      if (!c || /^zoek naar|selecteer uursoort/.test(c) || invalidUursoortOption(txt)) continue;
      if (!seen.has(c)) { seen.add(c); found.push(txt); }
    }
    return found;
  }
  function nonClientUursoortValueText() {
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger) return '';
    const chips = nonClientUursoortChips(trigger);
    if (chips.length) return chips[0];
    // Fallback: trigger-tekst (voor dropdowns die de waarde erin tonen)
    const txt = clean(uiText(trigger) || trigger.textContent || ('value' in trigger ? trigger.value : '') ||
      (trigger.getAttribute && (trigger.getAttribute('title') || trigger.getAttribute('value'))) || '');
    if (!txt || /^(zoek naar uursoorten|selecteer uursoort|uursoort|zoek naar uursoort)$/.test(txt)) return '';
    return txt;
  }
  function nonClientUursoortSet() {
    if (!activeNonClientOption) return false;
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger) return false;
    const wanted = activeNonClientOption.uursoort;
    // 1) Chips zoals bij labels. Een spurious chip mag NIET kortsluiten: als er
    //    chips zijn maar geen ervan matcht, alsnog de trigger-tekst controleren.
    const chips = nonClientUursoortChips(trigger);
    if (chips.some((chip) => nonClientHourTypeMatches(chip, wanted))) return true;
    // 2) Trigger-tekst: een uc-select toont de gekozen waarde in het veld zelf
    //    (geen losse verwijderbare chip).
    const txt = clean(uiText(trigger) || trigger.textContent || ('value' in trigger ? trigger.value : '') ||
      (trigger.getAttribute && (trigger.getAttribute('title') || trigger.getAttribute('value'))) || '');
    if (!txt || /^(zoek naar uursoorten|selecteer uursoort|uursoort|zoek naar uursoort)$/.test(txt)) return false;
    return nonClientHourTypeMatches(txt, wanted);
  }
  function nonClientReadyToSave() {
    return hasAppointmentDate() && hasAppointmentStartTime() && hasAppointmentEndTime() && nonClientUursoortSet();
  }
  // 'Overig'-flow: geen uursoort, maar een verplichte vrije titel "Overig - ...".
  function nonClientFreeTitlePrefix(opt) { return (opt && opt.display ? opt.display : 'Overig') + ' - '; }
  function nonClientFreeTitleComplete(opt) {
    const inp = getTitleInputSafe();
    const val = inp ? inputTextValue(inp) : '';
    const trimmed = String(val || '').trim();
    if (!trimmed) return false;
    // Er moet iets staan ná "Overig -"; de prefix alleen telt niet als titel.
    const prefixRe = new RegExp('^' + (opt && opt.display ? opt.display : 'Overig').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*-\\s*', 'i');
    if (!prefixRe.test(trimmed)) return false;
    const rest = trimmed.replace(prefixRe, '');
    return !!rest.trim();
  }
  function ensureNonClientFreeTitlePrefix(opt) {
    const prefix = nonClientFreeTitlePrefix(opt);
    const inp = getTitleInputSafe();
    if (!inp) return;
    const prefixRe = new RegExp('^' + (opt && opt.display ? opt.display : 'Overig').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*-\\s*', 'i');
    const current = String(inputTextValue(inp) || '').trim();
    const rest = current.replace(prefixRe, '');
    setAppointmentTitleText(prefix + rest);
    setTimeout(function () {
      const i = getTitleInputSafe();
      if (i && i.focus) { try { i.focus(); } catch (e) {} }
      updateSubmitGuard();
    }, 0);
  }
  function handleNonClientOption(opt) {
    setStatus('Bezig...');
    activeNonClientOption = opt;
    nonClientFreeTitleScreenActive = false;
    nonClientNoUursoortActive = false;
    nonClientBusy = true; // voorkom dat de refresh-cyclus opnieuw triggert
    setAppointmentTitleText(opt.display);
    // Optioneel ONS-label uit de beheerlijst (alleen als ingesteld).
    if (opt.etiket) { try { selectLabel(opt.etiket, function () {}); } catch (e) {} }
    if (opt.freeTitle) {
      // 'Overig': raak de uursoort niet aan. Eerst (zonodig) de duur vragen,
      // daarna het vrije-titel-scherm dat blokkeert tot er een titel staat.
      nonClientBusy = false;
      if (!hasAppointmentEndTime()) { showNonClientDurationSelection(opt); return; }
      activeAppointmentDurationMinutes = null;
      appointmentTimeGuardTimers.forEach(function (t) { clearTimeout(t); });
      appointmentTimeGuardTimers = [];
      showNonClientFreeTitlePrompt(opt);
      return;
    }
    if (opt.fixedHalfHour) {
      // Pauze: vaste duur (instelbaar via generalSettings.pauseFixedMin, standaard
      // 30 min), geen duur vragen. Eerst eindtijd, dan na 80ms de uursoort/label-
      // stappen (die elk de eindtijd opnieuw afdwingen).
      const endOk = applyNonClientEndTime(gsNum('pauseFixedMin', 30));
      setStatus(endOk ? (opt.display + ' 30 min') : 'Eindtijd niet gezet', endOk);
      setTimeout(function () { safe(function () {
        setNonClientUursoortThenFinish(opt);
        scheduleAppointmentEndTime(30);
        [120, 350, 650].forEach(function (d) { setTimeout(function () { safe(function () { enforceAppointmentEndTime(30); }); }, d); });
      }); }, 80);
      return;
    }
    if (opt.defaultDuration > 0 && !hasAppointmentEndTime()) {
      // Standaardduur uit de beheerlijst: sla de duurvraag over en zet direct de eindtijd.
      const dd = opt.defaultDuration;
      const endOk = applyNonClientEndTime(dd);
      setStatus(endOk ? (opt.display + ' ' + dd + ' min') : 'Eindtijd niet gezet', endOk);
      setTimeout(function () { safe(function () {
        setNonClientUursoortThenFinish(opt);
        scheduleAppointmentEndTime(dd);
        [120, 350, 650].forEach(function (d) { setTimeout(function () { safe(function () { enforceAppointmentEndTime(dd); }); }, d); });
      }); }, 80);
      return;
    }
    if (!hasAppointmentEndTime()) {
      // Eindtijd leeg: eerst de duur vragen; uursoort wordt daarna gezet.
      nonClientBusy = false;
      showNonClientDurationSelection(opt);
      return;
    }
    // Eindtijd is al ingevuld: niet aanraken. Stop geplande forcering.
    activeAppointmentDurationMinutes = null;
    appointmentTimeGuardTimers.forEach(function (t) { clearTimeout(t); });
    appointmentTimeGuardTimers = [];
    setNonClientUursoortThenFinish(opt);
  }
  // Zet de uursoort EENMALIG (met nette retries binnen selectNonClientUursoort)
  // en ga daarna door naar afronden. Skip als de uursoort al correct is ingesteld
  // (anders reset de dropdown-interactie de eindtijd).
  function setNonClientUursoortThenFinish(opt) {
    if (nonClientUursoortSet()) {
      nonClientBusy = false;
      nonClientNoUursoortActive = false;
      finishNonClientOption(opt);
      return;
    }
    setStatus('Uursoort instellen...');
    setAppointmentUursoortByName(opt.uursoort, function (uursoortOk) {
      nonClientBusy = false;
      // De uursoort-dropdown zit in hetzelfde Afspraakdetails-paneel als de eindtijd;
      // de selectie kan de eindtijd hebben gewist -> opnieuw afdwingen (no-op als
      // er geen actieve duur is, dus een al ingevulde eindtijd blijft staan).
      scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
      if (!uursoortOk && !nonClientUursoortSet()) {
        // Geen (passende) uursoort beschikbaar: aparte foutpagina i.p.v. de
        // gewone opslaanpagina met "Let op"-melding.
        showNonClientNoUursoort(opt);
        return;
      }
      nonClientNoUursoortActive = false;
      finishNonClientOption(opt);
    });
  }
  function showNonClientNoUursoort(opt) {
    const body = $body(); if (!body) return;
    nonClientBusy = false;
    nonClientNoUursoortActive = true;
    body.innerHTML = '';
    body.appendChild(mkBackButton(function () { return safe(function () {
      nonClientNoUursoortActive = false;
      showAppointmentNeedsPrereqs();
    }); }, 'Terug'));
    const msg = document.createElement('div');
    msg.textContent = 'Geen uursoorten gevonden!';
    Object.assign(msg.style, { fontWeight: '700', fontSize: '14px', margin: '4px 0 4px', color: '#b3261e' });
    body.appendChild(msg);
    const sub = document.createElement('div');
    sub.textContent = 'Controleer zelf of er uursoorten in de lijst staan en neem contact op met EPD.';
    Object.assign(sub.style, { fontSize: '13px', color: '#333', lineHeight: '1.4', margin: '0 0 8px' });
    body.appendChild(sub);
    body.appendChild(mkButton('Afsluiten', function () { return safe(closeOnsModal); }));
    setStatus('Geen uursoorten gevonden', false);
  }
  function showNonClientDurationSelection(opt) {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    body.appendChild(mkBackButton(function () { return safe(showAppointmentNeedsPrereqs); }, 'Terug'));
    const title = document.createElement('div');
    title.textContent = opt.display + ' duur:';
    Object.assign(title.style, { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px' });
    body.appendChild(title);
    const durStep = opt.durationStep > 0 ? opt.durationStep : gsNum('durationStepMin', 15);
    const durMax = opt.maxDuration > 0 ? opt.maxDuration : gsNum('appointmentMaxMin', 480);
    for (let minutes = durStep; minutes <= durMax; minutes += durStep) {
      body.appendChild(mkButton(opt.display + ' - ' + registrationDurationLabel(minutes), (function (m) {
        return function () { return safe(function () {
          // Zelfde opzet als de cliëntflow: eerst eindtijd zetten + plannen, dan
          // na 80ms de uursoort/label-stappen (die elk de eindtijd opnieuw afdwingen).
          const endOk = applyNonClientEndTime(m);
          setAppointmentTitleText(opt.display);
          setStatus(endOk ? (opt.display + ' ' + registrationDurationLabel(m)) : 'Eindtijd niet gezet', endOk);
          setTimeout(function () { safe(function () {
            if (opt.freeTitle) showNonClientFreeTitlePrompt(opt);
            else setNonClientUursoortThenFinish(opt);
            scheduleAppointmentEndTime(m);
            [100, 300].forEach(function (d) { setTimeout(function () { safe(function () { enforceAppointmentEndTime(m); }); }, d); });
          }); }, 50);
        }); };
      })(minutes)));
    }
    setStatus('Kies de duur');
  }
  // 'Overig': geen uursoort. Eis dat de gebruiker de titel "Overig - ..." aanvult;
  // blokkeer opslaan tot dat gebeurd is (zoals het rapportageveld bij registraties).
  function showNonClientFreeTitlePrompt(opt) {
    const body = $body(); if (!body) return;
    nonClientBusy = false;
    nonClientFreeTitleScreenActive = true;
    const prefix = nonClientFreeTitlePrefix(opt);
    // Label JG Overig zetten en de titel voorzien van de prefix (alleen als de
    // gebruiker nog niets eigens heeft ingevuld).
    setLabel('JG Overig', function () {
      const inp = getTitleInputSafe();
      const cur = inp ? clean(inputTextValue(inp)) : '';
      if (!cur || cur === clean(opt.display) || cur === clean(prefix)) setAppointmentTitleText(prefix);
      scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
    });
    body.innerHTML = '';
    body.appendChild(mkBackButton(function () { return safe(function () { nonClientFreeTitleScreenActive = false; showAppointmentNeedsPrereqs(); }); }, 'Terug'));
    const msg = document.createElement('div');
    msg.textContent = 'Vul de titel aan na "' + prefix + '".';
    Object.assign(msg.style, { fontWeight: '700', fontSize: '13px', margin: '4px 0 2px', color: '#333' });
    body.appendChild(msg);
    const sub = document.createElement('div');
    sub.textContent = 'Zodra je een titel hebt ingevuld, kun je opslaan.';
    Object.assign(sub.style, { fontSize: '12px', color: '#666', lineHeight: '1.35', margin: '0 0 8px' });
    body.appendChild(sub);
    const setTitelBtn = mkButton('Zet titel', function () { return safe(function () {
      ensureNonClientFreeTitlePrefix(opt);
    }); }, { chevron: false, accent: '#1a7f37', accentWash: '#eaf6ee' });
    body.appendChild(setTitelBtn);
    updateSubmitGuard();
    // Geen Opslaan-knop hier: zodra er inhoud na de prefix staat, leidt
    // refreshAppointmentPrereqScreen automatisch door naar de generieke opslaanpagina.
    if (nonClientFreeTitleComplete(opt)) { nonClientFreeTitleScreenActive = false; showAppointmentReadyToSave(); return; }
    setStatus('Vul de titel aan', false);
  }
  function refreshAppointmentPrereqScreen() {
    const body = $body(); if (!body) return;
    if (Date.now() < suppressAutoUntil) return; // net op Terug geklikt: scherm met rust laten
    refreshFreeDayFromBackgroundCalendar();
    if (appointmentFreeDay) { showFreeDayInactive(); return; } // vrije/grijze dag: niet optreden
    if (_infoPanelRestore) return; // infopaneel open: niet overschrijven
    if (appointmentFlowBusy) return; // clientgebonden duur/reistijd/instellen: niet terugschieten naar keuze
    if (uursoortQueueActive) return; // per-cliënt uursoortlijst open: niet terugschieten naar keuze
    if (nonClientBusy) return; // bezig met niet-client uursoort zetten: niet ingrijpen
    if (appointmentClearingSettings) { showLoadingState('Instellingen verwijderen...'); return; }
    // 'Overig' vrije-titel-flow: bewaar het titelscherm of de opslaanpagina.
    if (activeNonClientOption && activeNonClientOption.freeTitle) {
      if (hasClientInAppointment() && hasAppointmentPrereqs()) { nonClientFreeTitleScreenActive = false; activeNonClientOption = null; showChoices(); return; }
      if (nonClientFreeTitleComplete(activeNonClientOption)) {
        // Titel is compleet: zorg dat we op de opslaanpagina staan/blijven.
        if (nonClientFreeTitleScreenActive || !text.includes('als de instellingen kloppen')) {
          nonClientFreeTitleScreenActive = false;
          showAppointmentReadyToSave();
        }
        return;
      }
      // Titel nog niet compleet: titelscherm bewaren.
      if (nonClientFreeTitleScreenActive) return;
    }
    // 'Geen uursoorten gevonden'-foutpagina niet overschrijven (tenzij er alsnog
    // handmatig een uursoort is gekozen).
    if (nonClientNoUursoortActive && activeNonClientOption && !activeNonClientOption.freeTitle) {
      if (nonClientUursoortSet()) { nonClientNoUursoortActive = false; showAppointmentReadyToSave(); }
      return;
    }
    const text = clean(body.textContent || '');
    if (appointmentNeedsAvailabilityConfirmation() && !text.includes('al een afspraak') && !appointmentInSaveStage()) {
      showAvailabilityWarning();
      return;
    }
    const choiceScreen = CONFIG.choices.every((choice) => text.includes(clean(choice.label)));
    if (appointmentAwaitingManualUursoort && hasAppointmentPrereqs()) {
      // Het uursoort-wachtscherm werkt zichzelf bij via zijn eigen poll-lus;
      // hier alleen herstellen als dat scherm (door een refresh) verdwenen is.
      if (!manualUursoortAutoTimer) showManualUursoortInstruction();
      return;
    }
    if (appointmentSaveScreenActive) {
      // Opslaanpagina met rust laten zolang de opslaanfase geldig is (cliënt- én
      // niet-cliëntgebonden). De medewerker mag de eindtijd bewerken zonder dat de
      // hulp terugspringt; en een niet-cliëntafspraak wordt niet meer afgebroken.
      if (!choiceScreen && appointmentSaveStageStillValid()) return;
      appointmentSaveScreenActive = false; // opslaanfase echt weg (bv. cliënt/label/tijd verwijderd): refresh weer vrijgeven
      stopDoorplannenSaveWatch();
    }
    if (appointmentReadyToSave() && !choiceScreen) {
      showAppointmentReadyToSave();
      return;
    }
    const prereqScreen = text.includes('vul client, begintijd en datum in') || text.includes('voeg een client toe voor clientgerelateerde afspraken') || text.includes('voeg evt. een client toe aan de afspraak');
    // Niet-clientgerelateerde sub-/duurschermen niet overschrijven bij een refresh.
    const nonClientSubScreen = text.includes('niet clientgerelateerde afspraken') ||
      text.includes(' duur:') ||
      nonClientCategoriesActive().some(function (c) { return text.includes(clean(c.label)) && text.includes('terug'); });
    // Cliëntgebonden duur-/reistijdscherm niet overschrijven bij een refresh
    // (bv. de mutatie van het uitklappen van de clientkaart). Anders wipet de
    // refresh het duurscherm en moet de gebruiker 2x klikken.
    const clientDurationScreen = !!pendingChoice && (text.includes(' duur:') || text.includes('totale reistijd'));
    // Zodra er een cliënt is toegevoegd (prereqs compleet), door naar het
    // cliëntgebonden keuzescherm, ook als we nog op het niet-cliëntmenu staan.
    if (hasClientInAppointment() && hasAppointmentPrereqs() && !choiceScreen && !clientDurationScreen) {
      activeNonClientOption = null;
      showChoices();
      return;
    }
    if (prereqScreen && hasAppointmentPrereqs()) showChoices();
    else if (!hasAppointmentPrereqs() && nonClientSubScreen) return; // gebruiker bladert door categorieën
    else if (!hasAppointmentPrereqs() && !prereqScreen) showAppointmentNeedsPrereqs();
  }
  function waitForClientBeforeChoices(attempt) {
    if (hasClientInAppointment()) {
      setStatus('Client gevonden | kaart openen...');
      ensureClientExpanded((expanded) => {
        showChoices();
        setStatus(expanded ? 'Clientkaart open' : 'Clientkaart openen...', expanded);
      });
      return;
    }
    if (attempt >= 180) { setStatus('Client niet gevonden | voeg client toe', false); return; }
    clientWaitTimer = setTimeout(() => waitForClientBeforeChoices(attempt + 1), 500);
  }
  function prepareClientAndHandleChoice(choice) {
    setStatus(''); // wis o.a. de 'verwijder zelf nog de uursoorten' melding
    if (!hasAppointmentPrereqs()) { showAppointmentNeedsPrereqs(); return; }
    appointmentFlowBusy = true;
    if (!choice.addTravelTime) clearAppointmentTravelTimes();
    busyWhile(6000, (done) => {
      ensureClientExpanded((expanded) => {
        done();
        if (!expanded) setStatus('Clientkaart openen...', false);
        // Standaardduur uit de beheerlijst: duurvraag overslaan (net als bij de
        // niet-cliëntcategorieën). Bij addTravelTime volgt nog wél de reistijdvraag.
        if (choice.defaultDuration > 0) applyAppointmentDuration(choice, choice.defaultDuration);
        else showAppointmentDurationSelection(choice);
      });
    });
  }
  // Past een gekozen (of standaard) afspraakduur toe: eindtijd zetten en doorgaan
  // naar reistijd (bij addTravelTime) of direct naar handleChoice. Wordt aangeroepen
  // vanuit de duurknoppen én bij het overslaan van de duurvraag (defaultDuration).
  function applyAppointmentDuration(choice, minutes) {
    appointmentFlowBusy = true;
    activeAppointmentDurationMinutes = minutes;
    activeAppointmentStartTimeText = appointmentCurrentStartTimeText();
    if (choice.addTravelTime) {
      const endOk = setAppointmentEndTimePlusMinutes(minutes);
      scheduleAppointmentEndTime(minutes);
      setStatus(endOk ? `${choice.label} ${registrationDurationLabel(minutes)}` : 'Eindtijd niet gezet', endOk);
      setTimeout(() => showAppointmentTravelSelection(choice), 80);
    } else {
      // Zelfde volgorde als Huisbezoek: eerst reistijd wissen, DAARNA eindtijd
      // zetten en plannen, zodat de eindtijd niet door clear/handleChoice
      // wordt teruggedraaid (eerder werkte alleen Huisbezoek).
      clearAppointmentTravelTimes();
      const endOk = setAppointmentEndTimePlusMinutes(minutes);
      scheduleAppointmentEndTime(minutes);
      setStatus(endOk ? `${choice.label} ${registrationDurationLabel(minutes)}` : 'Eindtijd niet gezet', endOk);
      setTimeout(() => {
        handleChoice(choice);
        // forceer de eindtijd nogmaals nadat handleChoice de velden heeft aangeraakt
        scheduleAppointmentEndTime(minutes);
        [120, 350, 650].forEach((d) => setTimeout(() => safe(() => enforceAppointmentEndTime(minutes)), d));
      }, 80);
    }
  }
  function showAppointmentDurationSelection(choice) {
    const body = $body(); if (!body) return;
    if (!hasAppointmentPrereqs()) { showAppointmentNeedsPrereqs(); return; }
    appointmentFlowBusy = false;
    body.innerHTML = '';
    body.appendChild(mkBackButton(() => safe(showChoices), 'Terug'));
    const title = document.createElement('div');
    title.textContent = `${choice.label} duur:`;
    Object.assign(title.style, { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px' });
    body.appendChild(title);
    for (let _st=(choice.durationStep>0?choice.durationStep:gsNum('durationStepMin',15)),_mx=(choice.maxDuration>0?choice.maxDuration:gsNum('registrationMaxMin',180)),minutes=_st; minutes <= _mx; minutes += _st) {
      body.appendChild(mkButton(`${choice.label} - ${registrationDurationLabel(minutes)}`, () => safe(() => applyAppointmentDuration(choice, minutes))));
    }
  }
  function showAppointmentTravelSelection(choice) {
    const body = $body(); if (!body) return;
    appointmentFlowBusy = false;
    body.innerHTML = '';
    body.appendChild(mkBackButton(() => safe(showChoices), 'Terug'));
    const title = document.createElement('div');
    title.textContent = 'Totale reistijd (heen en terug):';
    Object.assign(title.style, { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px' });
    body.appendChild(title);
    for (let _ts=(APP_CONFIG.generalSettings&&APP_CONFIG.generalSettings.travelStepMin>0?APP_CONFIG.generalSettings.travelStepMin:5),_tm=(APP_CONFIG.generalSettings&&APP_CONFIG.generalSettings.travelMaxMin>0?APP_CONFIG.generalSettings.travelMaxMin:60),minutes=0; minutes <= _tm; minutes += _ts) {
      body.appendChild(mkButton(registrationDurationLabel(minutes), () => safe(() => {
        appointmentFlowBusy = true;
        const ok = setAppointmentTravelTotalMinutes(minutes);
        setStatus(ok ? `Reistijd gezet: ${registrationDurationLabel(minutes)} totaal` : 'Reistijdvelden niet gevonden', ok);
        setTimeout(() => handleChoice(choice), 70);
      })));
    }
  }
  function submitAppointmentFromHelper() {
    updateSubmitGuard();
    if (activeNonClientOption && activeNonClientOption.freeTitle) {
      if (!nonClientFreeTitleComplete(activeNonClientOption)) {
        setStatus('Vul eerst de titel aan.', false);
        const inp = getTitleInputSafe();
        if (inp && inp.focus) { try { inp.focus(); } catch (e) {} }
        return;
      }
      const btn = submitButtons()[0];
      if (!btn) { setStatus('Opslaan-knop niet gevonden', false); return; }
      const target = btn.shadowRoot ? (btn.shadowRoot.querySelector('button[type="submit"], button') || btn) : btn;
      try { target.click(); } catch (e) { clickOption(btn); }
      return;
    }
    const missing = activeNonClientOption ? !nonClientUursoortSet() : !hasUursoortSelected();
    if (shouldRequireUursoortForSubmit() && missing) {
      setStatus(activeNonClientOption ? 'Voeg nog een uursoort toe.' : 'Voeg eerst bij elke client een uursoort toe.', false);
      return;
    }
    const btn = submitButtons()[0];
    if (!btn) { setStatus('Opslaan-knop niet gevonden', false); return; }
    const target = btn.shadowRoot ? (btn.shadowRoot.querySelector('button[type="submit"], button') || btn) : btn;
    try { target.click(); } catch (e) { clickOption(btn); }
  }
  // ---- Herhaling / doorplannen ------------------------------------------------
  // De 'Herhaling'-accordeonkop in de ONS-afspraakmodal. De hashed klassen
  // (_header_186fh_22) zijn buildafhankelijk, dus we matchen op de zichtbare
  // titeltekst "Herhaling" van een uitklapknop (met UI-inspector-override).
  function findRecurrenceHeader() {
    const ov = overrideEl('recurrenceHeader'); if (ov) return ov;
    const btns = deepQueryAll('button[aria-expanded]').filter((b) => visible(b) && !isOwnPopup(b));
    for (const b of btns) {
      let spans; try { spans = b.querySelectorAll('span'); } catch (e) { continue; }
      for (const s of spans) if (clean(s.textContent) === 'herhaling') return b;
    }
    return null;
  }
  // Het recurrence-type keuzeveld (<uc-form-field data-qa="recurrence-type">) dat
  // na het uitklappen van 'Herhaling' verschijnt. Dit is het veld dat we roze
  // markeren en waaruit we de gekozen waarde lezen (met UI-inspector-override).
  function findRecurrenceField() {
    const ovSel = UI_OVERRIDES.recurrenceType;
    return (ovSel ? deepQueryAll(ovSel) : deepQueryAll('[data-qa="recurrence-type"]')).find((el) => visible(el) && !isOwnPopup(el)) || null;
  }
  // Huidige herhaling-waarde: uitgeklapt uit het keuzeveld, anders uit de
  // subtitel onder de kop. 'niet'/'' betekent: nog niet ingesteld.
  function recurrenceValue() {
    const sel = findRecurrenceField();
    if (sel) {
      const combo = deepQueryAll('[role="combobox"]', sel)[0];
      if (combo) {
        const v = clean(combo.getAttribute('aria-description') || combo.textContent || '');
        if (v) return v;
      }
      const t = clean(sel.textContent || '');
      if (t) return t;
    }
    const head = findRecurrenceHeader();
    if (head) {
      let spans; try { spans = head.querySelectorAll('span'); } catch (e) { spans = []; }
      if (spans.length >= 2) return clean(spans[spans.length - 1].textContent || '');
    }
    return '';
  }
  function recurrenceIsSet() { const v = recurrenceValue(); return !!v && v !== 'niet'; }
  function recurrenceHeaderExpanded() { const h = findRecurrenceHeader(); return !!(h && h.getAttribute('aria-expanded') === 'true'); }
  function clickRecurrenceHeader(head) {
    if (!head) return false;
    return clickUiButton(head) || clickElementCenter(head) || (clickOption(head), true);
  }
  // Klap de 'Herhaling'-sectie open (klik de kop) zodat de gebruiker een
  // herhaling kan kiezen, en zet de roze omlijning op het recurrence-type
  // KEUZEVELD dat daarna verschijnt (niet op de kop).
  function expandRecurrence() {
    const head = findRecurrenceHeader();
    if (head && head.getAttribute('aria-expanded') !== 'true') clickRecurrenceHeader(head);
    pollFor(() => findRecurrenceField(), (field) => { if (field) { try { highlightField(field, 5000); } catch (e) {} } }, { timeout: 2000, interval: 50 });
    return !!head;
  }
  // De combobox binnen het recurrence-type keuzeveld (opent de keuzelijst).
  function recurrenceCombo() {
    const field = findRecurrenceField();
    return field ? (deepQueryAll('[role="combobox"]', field)[0] || null) : null;
  }
  // Zet de herhaling terug op 'Niet' (open de keuzelijst en klik de optie 'Niet').
  function setRecurrenceToNiet(done) {
    if (!recurrenceIsSet()) { if (done) done(true); return; }
    const combo = recurrenceCombo();
    if (!combo) { if (done) done(false); return; }
    clickElementCenter(combo); // open de keuzelijst
    pollFor(() => {
      const opts = deepQueryAll('[role="option"], uc-select-list li, [role="listbox"] li').filter((o) => visible(o) && !isOwnPopup(o));
      return opts.find((o) => clean(o.textContent) === 'niet') || null;
    }, (opt) => {
      if (opt) clickElementCenter(opt);
      else { try { combo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (e) {} }
      if (done) done(!!opt);
    }, { timeout: 2000, interval: 50 });
  }
  // Toggle 'uit': eerst de herhaling terug op 'Niet' zetten en dán de sectie
  // inklappen (ook als er bv. 'Dagelijks' stond), zodat de afspraak niet stiekem
  // toch blijft doorplannen.
  function collapseRecurrence() {
    const finish = () => { const head = findRecurrenceHeader(); if (head && head.getAttribute('aria-expanded') === 'true') clickRecurrenceHeader(head); };
    if (!recurrenceIsSet()) { finish(); return true; }
    setRecurrenceToNiet(() => { setTimeout(finish, 60); });
    return true;
  }
  // Blokkeert opslaan zolang 'Afspraak doorplannen?' aan staat maar de herhaling
  // nog op 'Niet': óf een herhaling kiezen, óf de toggle uitzetten.
  function doorplannenBlocksSave() {
    return !(APP_CONFIG.features && APP_CONFIG.features.doorplannenToggle === false)
      && appointmentDoorplannen && !recurrenceIsSet();
  }
  function showAppointmentReadyToSave() {
    const body = $body(); if (!body) return;
    appointmentFlowBusy = false;
    if (typeof stopManualUursoortAutoCheck === 'function') stopManualUursoortAutoCheck();
    appointmentAwaitingManualUursoort = false;
    scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
    const nonClient = !hasClientInAppointment() && !!activeNonClientOption;
    body.innerHTML = '';
    body.appendChild(mkBackButton(() => safe(() => {
      appointmentSaveScreenActive = false; // bewust weg van de opslaanpagina
      stopDoorplannenSaveWatch();
      if (nonClient) { showAppointmentNeedsPrereqs(); return; }
      appointmentForceChoiceOnce = true; showChoices();
    }), 'Terug'));
    const msg = mkText('afspraak_klaar_regel1', 'Voeg eventueel nog een locatie en notitie toe.', { fontSize: '13px', color: '#333', lineHeight: '1.35', padding: '4px 0 2px' });
    body.appendChild(msg);
    const msg2 = mkText('afspraak_klaar_regel2', 'Als de instellingen kloppen, kun je de afspraak opslaan', { fontSize: '13px', color: '#333', lineHeight: '1.35', padding: '0 0 8px' });
    body.appendChild(msg2);
    // 'Afspraak doorplannen?'-kader boven de opslaanknop. Aan = klik de
    // 'Herhaling'-kop open en markeer het recurrence-type keuzeveld roze. Blijft
    // de herhaling op 'Niet', dan verschijnt een aandachtspunt in het algemene
    // meldingenkanaal én blokkeert opslaan tot je een herhaling kiest of de
    // toggle weer uitzet.
    if (!(APP_CONFIG.features && APP_CONFIG.features.doorplannenToggle === false)) {
      const dpBox = mkToggleBox('doorplannen_vraag', 'Afspraak doorplannen?', appointmentDoorplannen, (on) => safe(() => {
        appointmentDoorplannen = on;
        // Even geen auto-detectie terwijl de programmatische klik (uit/inklappen)
        // nog moet 'settelen', anders slaat de spiegel meteen weer om.
        doorplannenSuppressAutoUntil = Date.now() + (on ? 1500 : 2000);
        if (on) expandRecurrence(); else collapseRecurrence();
        showAppointmentReadyToSave(); // herteken: opslaanknop/status volgen de nieuwe stand
      }));
      body.appendChild(dpBox);
    }
    const saveBtn = mkButton('Opslaan', () => safe(() => {
      if (doorplannenBlocksSave()) {
        try { highlightField(findRecurrenceField() || findRecurrenceHeader(), 5000); } catch (e) {}
        setStatus('Stel de herhaling in of zet doorplannen uit', false);
        return; // niet opslaan zolang doorplannen aan staat en herhaling op 'Niet'
      }
      submitAppointmentFromHelper();
    }));
    if (doorplannenBlocksSave()) { saveBtn.style.opacity = '0.55'; saveBtn.style.cursor = 'not-allowed'; saveBtn.setAttribute('aria-disabled', 'true'); }
    body.appendChild(saveBtn);
    const freeTitle = nonClient && !!activeNonClientOption.freeTitle;
    if (nonClient && !freeTitle && !nonClientUursoortSet()) {
      const usNote = document.createElement('div');
      usNote.textContent = 'Let op: voeg nog een uursoort toe.';
      Object.assign(usNote.style, { fontSize: '12px', color: '#b3261e', margin: '6px 0 0', fontWeight: '700' });
      body.appendChild(usNote);
    }
    const ready = freeTitle ? nonClientFreeTitleComplete(activeNonClientOption) : (nonClient ? nonClientUursoortSet() : hasUursoortSelected());
    if (doorplannenBlocksSave()) setStatus('Stel de herhaling in of zet doorplannen uit', false);
    else setStatus(ready ? 'Klaar om op te slaan' : (freeTitle ? 'Vul de titel aan' : (nonClient ? 'Voeg nog een uursoort toe' : 'Voeg eerst bij elke client een uursoort toe')), ready);
    updateSubmitGuard(); // ONS-eigen opslaanknop mee-blokkeren bij doorplannen+Niet
    appointmentSaveScreenActive = true; // opslaanpagina staat; refresh laat 'm met rust
    // Lichte bewaking op de opslaanpagina (snel, 250ms):
    //  1) zet de toggle AAN zodra de medewerker de herhaling-kaart zelf opent of
    //     een herhaling kiest;
    //  2) herteken zodra de doorplannen-blokkade omslaat, zodat knop/status/ONS-
    //     knop live meelopen.
    stopDoorplannenSaveWatch();
    if (!(APP_CONFIG.features && APP_CONFIG.features.doorplannenToggle === false)) {
      doorplannenLastBlocked = doorplannenBlocksSave();
      doorplannenLastRecurrenceSet = recurrenceIsSet();
      doorplannenLastExpanded = recurrenceHeaderExpanded();
      doorplannenSaveWatch = setInterval(() => safe(() => {
        if (!helperEnabled || !appointmentSaveScreenActive) { stopDoorplannenSaveWatch(); return; }
        const suppressed = Date.now() < doorplannenSuppressAutoUntil;
        const nowSet = recurrenceIsSet();
        const expanded = recurrenceHeaderExpanded();
        // Flankdetectie: reageer op de OMSLAG, niet op het niveau. Zo blijft
        // 'medewerker zet op Niet' (dalende flank) uit staan, ook als de kaart
        // open blijft (dat is geen nieuwe stijgende flank).
        const roseSet = nowSet && !doorplannenLastRecurrenceSet;
        const roseExpanded = expanded && !doorplannenLastExpanded;
        const fellSet = !nowSet && doorplannenLastRecurrenceSet;
        const fellExpanded = !expanded && doorplannenLastExpanded;
        if (!suppressed) {
          // Auto-AAN: medewerker opent de herhaling-kaart zelf of kiest een herhaling.
          if (!appointmentDoorplannen && (roseSet || roseExpanded)) {
            appointmentDoorplannen = true;
            doorplannenLastRecurrenceSet = nowSet; doorplannenLastExpanded = expanded;
            stopDoorplannenSaveWatch(); showAppointmentReadyToSave(); return;
          }
          // Auto-UIT: medewerker zet de herhaling zelf terug op 'Niet' of klapt de kaart in.
          if (appointmentDoorplannen && (fellSet || fellExpanded)) {
            appointmentDoorplannen = false; doorplannenSuppressAutoUntil = Date.now() + 800;
            doorplannenLastRecurrenceSet = nowSet; doorplannenLastExpanded = expanded;
            stopDoorplannenSaveWatch(); showAppointmentReadyToSave(); return;
          }
        }
        doorplannenLastRecurrenceSet = nowSet;
        doorplannenLastExpanded = expanded;
        // Herteken zodra de blokkade omslaat, zodat knop/status/ONS-knop meelopen.
        if (appointmentDoorplannen && doorplannenBlocksSave() !== doorplannenLastBlocked) {
          stopDoorplannenSaveWatch(); showAppointmentReadyToSave();
        }
      }), 250);
    }
  }
  function stopManualUursoortAutoCheck() {
    if (manualUursoortAutoTimer) { clearInterval(manualUursoortAutoTimer); manualUursoortAutoTimer = null; }
  }
  function clientsMissingUursoort() {
    return findClientEntries()
      .filter((entry) => !entryUursoortIsSet(entry))
      .map((entry) => entry.firstName || firstNameFromName(entry.name))
      .filter(Boolean);
  }
  function missingUursoortText(names) {
    if (!names.length) return 'Alle uursoorten zijn ingevuld.';
    if (names.length === 1) return `Voeg de uursoort toe voor ${names[0]}.`;
    const last = names[names.length - 1];
    return `Voeg de uursoort toe voor ${names.slice(0, -1).join(', ')} en ${last}.`;
  }
  function showManualUursoortInstruction() {
    const body = $body(); if (!body) return;
    appointmentFlowBusy = false;
    appointmentAwaitingManualUursoort = true;
    scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
    body.innerHTML = '';
    body.appendChild(mkBackButton(() => safe(() => { stopManualUursoortAutoCheck(); appointmentAwaitingManualUursoort = false; appointmentForceChoiceOnce = true; showChoices(); }), 'Terug'));
    const msg = document.createElement('div');
    Object.assign(msg.style, { fontSize: '13px', color: '#333', lineHeight: '1.35', padding: '4px 0 2px', fontWeight: '700' });
    body.appendChild(msg);
    const sub = mkText('afspraak_uursoort_sub', 'Daarna gaat de afspraak vanzelf verder.', { fontSize: '12px', color: '#666', lineHeight: '1.35', padding: '0 0 8px' });
    body.appendChild(sub);
    // #3 - Vriendelijke, instelbare instructie + markeer het uursoortveld.
    body.appendChild(mkText('probleem_uursoort_zelf', 'Kies zelf de uursoort in het gemarkeerde veld hieronder.', { fontSize: '12px', color: '#704b00', lineHeight: '1.35', padding: '0 0 8px' }));
    try { highlightField(getUursoortTrigger() || (typeof findClientUursoortTrigger === 'function' ? findClientUursoortTrigger() : null)); } catch (e) {}
    const renderMissing = () => {
      const names = clientsMissingUursoort();
      msg.textContent = missingUursoortText(names);
      return names;
    };
    const checkNow = () => {
      invalidateClientEntries();
      const names = renderMissing();
      if (!names.length && hasUursoortSelected()) { stopManualUursoortAutoCheck(); showAppointmentReadyToSave(); return true; }
      setStatus(names.length ? `Wacht op uursoort: ${names.join(', ')}` : 'Uursoort gevonden', !names.length);
      return false;
    };
    // Live bijwerken + automatisch doorschakelen zodra elke client een uursoort heeft.
    stopManualUursoortAutoCheck();
    manualUursoortAutoTimer = setInterval(() => safe(() => {
      if (!helperEnabled || activeMode === 'registrations' || _infoPanelRestore) return;
      checkNow();
    }), 600);
    checkNow();
  }
  function showUursoort(options, afterPick, clientContext = null) {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    body.appendChild(mkBackButton(() => { autoSelectingNewClient = false; showChoices(); }, 'Terug'));
    const title = document.createElement('div');
    title.textContent = clientContext ? `Uursoort ${clientContext.firstName}` : 'Kies uursoort';
    Object.assign(title.style, { fontWeight: '600', fontSize: '13px', margin: '2px 0 4px' });
    body.appendChild(title);
    if (!options || !options.length) {
      const msg = document.createElement('div');
      msg.textContent = 'Geen uursoorten gevonden - open het veld handmatig.';
      Object.assign(msg.style, { fontSize: '12px', color: '#b3261e' });
      body.appendChild(msg);
    } else {
      options.forEach((o) => body.appendChild(mkButton(o, () => safe(() => {
        setStatus('Bezig...');
        const freshTrigger = clientContext ? freshUursoortTriggerForContext(clientContext) : null;
        if (clientContext && !freshTrigger) {
          setStatus(`uursoort-veld voor ${clientContext.firstName} niet gevonden`, false);
          return;
        }
        chooseUursoort(o, (ok) => {
          const done = () => {
            showAppointmentReadyToSave();
            setStatus(ok ? `uursoort "${o}" gezet` : `uursoort "${o}" niet gezet`, ok);
          };
          // Altijd via de wachtrij verder (ook als de verificatie ok=false gaf):
          // anders sprong de hulp naar de opslaanpagina en werd cliënt 2+
          // overgeslagen. De wachtrij herbekijkt zelf wie nog een uursoort mist.
          if (afterPick) afterPick(done);
          else done();
        }, freshTrigger || null);
      }))));
    }
  }
  function handleChoice(choice) {
    appointmentTypeApplied = true; // vanaf hier worden titel/label/uursoort gezet
    setBusyCursor(true);
    let _choiceDone = false;
    const _finishBusy = () => { if (!_choiceDone) { _choiceDone = true; setBusyCursor(false); } };
    const _busyGuard = setTimeout(_finishBusy, 8000);
    const _endBusy = () => { clearTimeout(_busyGuard); _finishBusy(); };
    scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
    if (!choice.addTravelTime) clearAppointmentTravelTimes();
    setStatus('Bezig...');
    const desiredClientPresent = choice.clientPresent;
    setTitleForChoice(choice, (titleOk) => {
      scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
      // BELANGRIJK: het label wordt NIET meer vooraf gezet. ONS koppelt tijdens het
      // kiezen van de uursoort zelf een (soms verkeerd) label; vooraf zetten leidde
      // tot de zichtbare label-dans (twee labels erin, eruit, opnieuw erin). We
      // zetten het gekozen label pas ÉÉN keer aan het eind via setLabelExclusive.
      applyClientPresent(desiredClientPresent, (clOk) => {
        scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
        const msg = [];
        msg.push(titleOk ? 'titel gezet' : 'titel niet gevonden');
        msg.push(clOk ? `aanwezig ${desiredClientPresent ? 'aan' : 'uit'}` : 'aanwezig niet gevonden');
        const base = msg.join(' | ');
        setStatus(base, titleOk && clOk);
        if (choice.pickUursoort) {
          invalidateClientEntries();
          if (!hasClientInAppointment()) {
            // Geen cliënt (meer): eerst het label zetten (geen uursoort-coupling te
            // verwachten), daarna de handmatige instructie tonen.
            scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
            const afterLabel = () => ensureClientExpanded(() => { showManualUursoortInstruction(); _endBusy(); });
            setLabelsExclusive(choiceLabels(choice), afterLabel);
            setStatus(base + ' | voeg uursoort handmatig toe', titleOk && clOk);
          } else {
            // Direct de zelf-sturende wachtrij starten. Die klapt elke cliëntkaart
            // zélf uit en handelt 2, 3, 4 of meer cliënten af - dus NIET meer
            // vooraf ensureClientExpanded afwachten (dat verliep bij 4+ cliënten
            // in een time-out en viel dan onterecht terug op "handmatig").
            setStatus('Uursoorten uit cliëntkaart laden...');
            showUursoortQueue([], 0, () => {
              scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
              const finishSave = () => { _endBusy(); showAppointmentReadyToSave(); };
              // Pas NU, nadat ONS al zijn eigen labels heeft gekoppeld, in één
              // gerichte pas: verwijder elk niet-gekozen label (via zijn eigen ×) en
              // zet het gekozen afspraaktype-label. Geen dubbel-zetten meer.
              setLabelsExclusive(choiceLabels(choice), finishSave);
            });
          }
        } else {
          const afterLabel = () => clearUursoort(() => { setStatus(base + ' | uursoort leeg', titleOk && clOk); _endBusy(); });
          setLabelsExclusive(choiceLabels(choice), afterLabel);
        }
      });
    });
  }
  function clickRegistrationTravelTimeButton() {
    const btn = overrideEl('regTravelAdd') || document.querySelector('#js_add_travel_time') ||
      deepQueryAll('button').find((el) => visible(el) && /reistijd toevoegen/i.test(el.textContent || ''));
    if (!btn || registrationTravelClicked) return false;
    clickOption(btn);
    registrationTravelClicked = true;
    return true;
  }
  function registrationInputValue(inp) {
    return String((inp && ('value' in inp ? inp.value : '')) || (inp && inp.getAttribute && inp.getAttribute('value')) || (inp && inp.textContent) || '').trim();
  }
  function registrationInputMeta(inp) {
    return clean(`${inp.id || ''} ${inp.name || ''} ${inp.className || ''} ${inp.type || ''} ${inp.getAttribute('placeholder') || ''} ${inp.getAttribute('aria-label') || ''}`);
  }
  function registrationTimeLikeInput(inp) {
    if (!inp || !visible(inp) || isOwnPopup(inp)) return false;
    const meta = registrationInputMeta(inp);
    if (/direct|indirect|travel|absence|hour_type|client_information_\d+__hour_type_id/.test(meta)) return false;
    const value = registrationInputValue(inp);
    return /time|tijd|uu:mm|__:__|js-time/.test(meta) || /^\d{1,2}:\d{2}$/.test(value);
  }
  function registrationDateLikeInput(inp) {
    if (!inp || !visible(inp) || isOwnPopup(inp)) return false;
    const meta = registrationInputMeta(inp);
    if (/time|tijd|direct|indirect|travel|hour_type/.test(meta)) return false;
    const value = registrationInputValue(inp);
    return /date|datum|dd-mm-jjjj/.test(meta) || /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(value);
  }
  function registrationInputsNearLabel(labelRe, predicate) {
    const inputs = deepQueryAll('input').filter(predicate);
    const labels = deepQueryAll('label,span,div,p,td,th')
      .filter((el) => {
        if (!visible(el) || isOwnPopup(el)) return false;
        const text = clean(el.textContent || '');
        return text && text.length <= 60 && labelRe.test(text);
      });
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of inputs) {
        const ir = rect(inp);
        const sameRow = Math.abs((ir.top + ir.height / 2) - (lr.top + lr.height / 2)) <= 28 && ir.left >= lr.left - 10;
        const below = ir.top >= lr.top - 8 && ir.top <= lr.bottom + 70 && Math.abs(ir.left - lr.left) <= 240;
        if (!sameRow && !below) continue;
        const score = Math.abs(ir.top - lr.top) * 3 + Math.max(0, ir.left - lr.right) + (below ? 80 : 0);
        if (score < bestScore) { best = inp; bestScore = score; }
      }
    }
    return best;
  }
  function registrationInputsInVisualOrder(predicate) {
    return deepQueryAll('input').filter(predicate).sort((a, b) => {
      const ar = rect(a), br = rect(b);
      return Math.abs(ar.top - br.top) > 8 ? ar.top - br.top : ar.left - br.left;
    });
  }
  function registrationTimeInput(id) {
    if (/start/i.test(id)) { const ov = overrideEl('regStart'); if (ov) return ov; }
    else if (/end/i.test(id)) { const ov = overrideEl('regEnd'); if (ov) return ov; }
    const exact = document.getElementById(id) || deepQueryAll('input.time.js-time').find((inp) => inp.id === id);
    if (exact && (visible(exact) || registrationInputValue(exact))) return exact;
    if (/start/i.test(id)) return registrationInputsNearLabel(/^begintijd\b/, registrationTimeLikeInput) || registrationInputsInVisualOrder(registrationTimeLikeInput)[0] || null;
    if (/end/i.test(id)) return registrationInputsNearLabel(/^eindtijd\b/, registrationTimeLikeInput) || registrationInputsInVisualOrder(registrationTimeLikeInput)[1] || null;
    return null;
  }
  function registrationDateInput() {
    const ov = overrideEl('regDate'); if (ov) return ov;
    const exact = document.getElementById('declaration_date');
    if (exact && (visible(exact) || registrationInputValue(exact))) return exact;
    return (
      deepQueryAll('input').find((inp) => registrationDateLikeInput(inp) && /date|datum|dd-mm-jjjj/.test(registrationInputMeta(inp))) ||
      registrationInputsNearLabel(/^datum\b/, registrationDateLikeInput) ||
      registrationInputsInVisualOrder(registrationDateLikeInput)[0] ||
      null
    );
  }
  function hasRegistrationStartTime() {
    const start = registrationTimeInput('declaration_start_time_display');
    return !!(start && timeTextToMinutes(registrationLiveTimeValue(start)) !== null);
  }
  function hasRegistrationDate() {
    const date = registrationDateInput();
    if (date && String(date.value || date.getAttribute('value') || date.textContent || '').trim()) return true;
    return deepQueryAll('input,span,div').some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const meta = clean(`${el.id || ''} ${el.getAttribute && (el.getAttribute('name') || '')} ${el.getAttribute && (el.getAttribute('aria-label') || '')}`);
      const text = String(('value' in el ? el.value : '') || el.getAttribute && el.getAttribute('value') || el.textContent || '').trim();
      if (!text || !/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(text)) return false;
      return /date|datum|declaration/.test(meta) || rect(el).width < 260;
    });
  }
  function setRegistrationEndTimePlusOneMinute() {
    const start = registrationTimeInput('declaration_start_time_display');
    const end = registrationTimeInput('declaration_end_time_display');
    if (!start || !end) return false;
    const startText = registrationLiveTimeValue(start);
    if (timeTextToMinutes(startText) === null) return false;
    const next = addMinutesText(startText, 1);
    if (!next) return false;
    setInputTextComposed(end, next);
    return true;
  }
  function setRegistrationEndTimePlusOneHour() {
    const start = registrationTimeInput('declaration_start_time_display');
    const end = registrationTimeInput('declaration_end_time_display');
    if (!start || !end) return false;
    const startText = registrationLiveTimeValue(start);
    if (timeTextToMinutes(startText) === null) return false;
    const next = addOneHourText(startText);
    if (!next) return false;
    setInputTextComposed(end, next);
    return true;
  }
  function setRegistrationEndTimePlusMinutes(minutes) {
    const start = registrationTimeInput('declaration_start_time_display');
    const end = registrationTimeInput('declaration_end_time_display');
    if (!start || !end) return false;
    const startText = registrationLiveTimeValue(start);
    if (timeTextToMinutes(startText) === null) return false;
    const next = addMinutesText(startText, minutes);
    if (!next) return false;
    setInputTextComposed(end, next);
    return true;
  }
  function timeTextToMinutes(value) {
    const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }
  function minutesToDurationText(minutes) {
    if (!Number.isFinite(minutes) || minutes < 0) return '';
    return String(Math.round(minutes));
  }
  function registrationLiveTimeValue(inp) {
    // ONS laat een verouderd value-ATTRIBUUT staan terwijl de echte (lege) waarde
    // in de .value-PROPERTY zit. Voor "is er een tijd ingevuld" tellen we alleen
    // de live property, niet het attribuut.
    if (!inp) return '';
    return ('value' in inp && typeof inp.value === 'string') ? inp.value.trim() : '';
  }
  function registrationDurationMinutes() {
    const start = registrationTimeInput('declaration_start_time_display');
    const end = registrationTimeInput('declaration_end_time_display');
    const s = timeTextToMinutes(registrationLiveTimeValue(start));
    const e = timeTextToMinutes(registrationLiveTimeValue(end));
    if (s === null || e === null) return null;
    return e >= s ? e - s : (e + 24 * 60) - s;
  }
  function registrationDirectTimeInput() {
    return overrideEl('regDirect') || document.getElementById('declaration_direct_time') ||
      deepQueryAll('input').find((inp) => inp.id === 'declaration_direct_time' || /(?:^|[\[_])direct_time(?:\]|$)/.test(inp.name || '')) || null;
  }
  function registrationIndirectTimeInput() {
    return overrideEl('regIndirect') || document.getElementById('declaration_indirect_time') ||
      deepQueryAll('input').find((inp) => inp.id === 'declaration_indirect_time' || /indirect_time/.test(inp.name || ''));
  }
  function setRegistrationTimeSplit({ directMinutes = null, indirectMinutes = null }) {
    let ok = true;
    const direct = registrationDirectTimeInput();
    const indirect = registrationIndirectTimeInput();
    if (directMinutes !== null) {
      if (direct) {
        const text = minutesToDurationText(directMinutes);
        if (String(direct.value || direct.getAttribute('value') || '') !== text) setInputTextComposed(direct, text);
      }
      else ok = false;
    }
    if (indirectMinutes !== null) {
      if (indirect) {
        const text = minutesToDurationText(indirectMinutes);
        if (String(indirect.value || indirect.getAttribute('value') || '') !== text) setInputTextComposed(indirect, text);
      }
      else ok = false;
    }
    return ok;
  }
  function setRegistrationIndirectFullDuration() {
    const minutes = registrationDurationMinutes();
    if (minutes === null) return false;
    return setRegistrationTimeSplit({ directMinutes: 0, indirectMinutes: minutes });
  }
  function setRegistrationDirectFullDuration() {
    const minutes = registrationDurationMinutes();
    if (minutes === null) return false;
    return setRegistrationTimeSplit({ directMinutes: minutes, indirectMinutes: 0 });
  }
  // Percentage-verdeling: bv. 75% indirect -> 25% direct, op basis van de duur.
  function setRegistrationStartSplit(choice) {
    if (!choice || !choice.startSplit) return false;
    const minutes = registrationDurationMinutes();
    if (minutes === null) return false;
    const dPct = Math.max(0, Math.min(100, choice.startSplit.directPct || 0));
    const directMin = Math.round(minutes * dPct / 100);
    const indirectMin = minutes - directMin;
    return setRegistrationTimeSplit({ directMinutes: directMin, indirectMinutes: indirectMin });
  }
  function applyRegistrationSplitForChoice(choice) {
    if (!choice) return false;
    if (choice.startSplit) return setRegistrationStartSplit(choice);
    if (choice.indirectFullDuration) return setRegistrationIndirectFullDuration();
    if (choice.directFullDuration) return setRegistrationDirectFullDuration();
    return true;
  }
  function scheduleReapplyRegistrationSplit() {
    clearTimeout(reapplyRegistrationSplitTimer);
    if (!activeRegistrationChoice) return;
    const reapply = () => safe(() => {
      if (activeRegistrationPortionMinutes !== null && registrationPortionApplies(activeRegistrationChoice)) {
        applyRegistrationPortion(activeRegistrationChoice, activeRegistrationPortionMinutes);
      } else {
        applyRegistrationSplitForChoice(activeRegistrationChoice);
      }
    });
    reapplyRegistrationSplitTimer = setTimeout(reapply, 80);
    setTimeout(reapply, 260);
    setTimeout(reapply, 700);
  }
  function registrationDurationLabel(minutes) {
    if (minutes < 60) return `${minutes} min.`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours} uur${rest ? ` ${rest} min.` : ''}`;
  }
  function registrationTravelInput(kind) {
    const there = kind === 'heen';
    const ov = overrideEl(there ? 'regTravelBefore' : 'regTravelAfter'); if (ov) return ov;
    const directId = document.getElementById(there ? 'declaration_travel_time_before' : 'declaration_travel_time_after');
    if (directId && (visible(directId) || registrationInputValue(directId))) return directId;
    const idNeedles = there
      ? /(travel.*(before|to|heen|there|out|naar)|reistijd.*(heen|naar))/
      : /(travel.*(after|back|return|from|terug)|reistijd.*terug)/;
    const exact = deepQueryAll('input').find((inp) => {
      if (!visible(inp) || isOwnPopup(inp)) return false;
      const meta = registrationInputMeta(inp);
      return idNeedles.test(meta);
    });
    if (exact) return exact;
    const labelRe = there ? /^(reistijd\s*)?(heen|naar|heenreis)\b|^reistijd heen\b/ : /^(reistijd\s*)?(terug|retour|terugreis)\b|^reistijd terug\b/;
    const byLabel = registrationInputsNearLabel(labelRe, (inp) => {
      if (!inp || !visible(inp) || isOwnPopup(inp)) return false;
      const meta = registrationInputMeta(inp);
      if (/direct|indirect|hour_type|client|date|datum/.test(meta)) return false;
      return /travel|reistijd|time|tijd|number|text|__:__|uu:mm/.test(meta) || registrationInputValue(inp) !== '';
    });
    if (byLabel) return byLabel;
    const travelInputs = deepQueryAll('input')
      .filter((inp) => visible(inp) && !isOwnPopup(inp) && /travel|reistijd/.test(registrationInputMeta(inp)))
      .sort((a, b) => {
        const ar = rect(a), br = rect(b);
        return Math.abs(ar.top - br.top) > 8 ? ar.top - br.top : ar.left - br.left;
      });
    return travelInputs[there ? 0 : 1] || null;
  }
  function formatRegistrationTravelMinutes(minutes, input) {
    if (Number.isInteger(minutes)) return String(minutes);
    return input && input.type === 'number' ? String(minutes) : String(minutes).replace('.', ',');
  }
  function setRegistrationTravelTotalMinutes(totalMinutes) {
    clickRegistrationTravelTimeButton();
    const there = registrationTravelInput('heen');
    const back = registrationTravelInput('terug');
    if (!there || !back) return false;
    const thereMinutes = Math.ceil(totalMinutes / 2);
    const backMinutes = Math.floor(totalMinutes / 2);
    setInputTextComposed(there, formatRegistrationTravelMinutes(thereMinutes, there));
    setInputTextComposed(back, formatRegistrationTravelMinutes(backMinutes, back));
    return true;
  }
  function clearRegistrationTravelTimes() {
    const fields = [
      overrideEl('regTravelBefore') || document.getElementById('declaration_travel_time_before') || registrationTravelInput('heen'),
      overrideEl('regTravelAfter') || document.getElementById('declaration_travel_time_after') || registrationTravelInput('terug'),
    ].filter(Boolean);
    const unique = Array.from(new Set(fields));
    if (!unique.length) return true;
    for (const field of unique) setInputTextComposed(field, '0');
    return true;
  }
  function scheduleClearRegistrationTravelTimes() {
    clearRegistrationTravelTimes();
    setTimeout(() => safe(clearRegistrationTravelTimes), 120);
    setTimeout(() => safe(clearRegistrationTravelTimes), 420);
  }
  function showRegistrationReportPrompt(choice) {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    const backTo = () => {
      registrationRestoredToReport = false; // bewust weg van het (herstelde) rapportagescherm
      if (choice && choice.label !== 'No show') {
        const contexts = registrationHourTypeContexts();
        showRegistrationHourTypeSelection(Math.max(0, contexts.length - 1));
      } else { activeRegistrationChoice = null; showRegistrationChoices(); }
    };
    body.appendChild(mkBackButton(() => safe(backTo), 'Terug'));
    const msg = mkText('registratie_rapportage_titel', 'Schrijf nu je rapportage, volgens ', { fontWeight: '700', fontSize: '14px', margin: '8px 0 6px' });
    const guidelineEnabled = !APP_CONFIG.features || APP_CONFIG.features.reportGuidelineLink !== false;
    if (!guidelineEnabled) msg.querySelectorAll('a').forEach((anchor) => anchor.replaceWith(document.createTextNode(anchor.textContent || '')));
    if (guidelineEnabled && !msg.querySelector('a[href]')) {
      const link = document.createElement('a');
      link.textContent = 'Richtlijn rapporteren';
      link.href = 'https://impegno.sharepoint.com/sites/kennisbank/Documents_Public/Forms/AllItems.aspx?id=%2Fsites%2Fkennisbank%2FDocuments%5FPublic%2FRichtlijn%20rapporteren%2Epdf&parent=%2Fsites%2Fkennisbank%2FDocuments%5FPublic';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      Object.assign(link.style, { color: '#cc087d', textDecoration: 'underline' });
      msg.appendChild(link);
    }
    body.appendChild(msg);
    const groupNote = document.createElement('div');
    Object.assign(groupNote.style, { fontSize: '12px', color: '#555', margin: '0 0 8px' });
    groupNote.appendChild(document.createTextNode('Let in het geval van groepsregistraties ook op de '));
    const generalReport = document.createElement('span');
    generalReport.textContent = 'algemene rapportage';
    generalReport.style.color = '#cc087d';
    generalReport.style.fontWeight = '700';
    groupNote.appendChild(generalReport);
    groupNote.appendChild(document.createTextNode(' en de '));
    const individualReport = document.createElement('span');
    individualReport.textContent = 'individuele rapportage';
    individualReport.style.color = '#cc087d';
    individualReport.style.fontWeight = '700';
    groupNote.appendChild(individualReport);
    groupNote.appendChild(document.createTextNode('.'));
    body.appendChild(groupNote);
    body.appendChild(document.createElement('br'));
    appendRegistrationCompleteness(body);
    const submit = mkPillButton('Indienen', () => safe(submitRegistrationFromHelper));
    submit.style.width = '100%';
    submit.setAttribute('data-registration-helper-submit', '');
    body.appendChild(submit);
    updateRegistrationReportSubmitButton();
    const usMissing = !hasRegistrationHourTypeSelected();
    setStatus(usMissing ? 'Voeg nog een uursoort toe' : (choice ? `${choice.label} duur afgerond` : ''), !usMissing);
  }
  // Geen cliënt gekoppeld maar wel een uursoort ingevuld: dan is er geen rapportage
  // nodig. Toon enkel de Indienen-knop, zonder rapportage-richtlijn/groepsnotitie.
  function registrationManualSubmitReady() {
    return !hasRegistrationClient() && hasRegistrationDate() && hasRegistrationStartTime() &&
      hasRegistrationEndTime() && hasRegistrationHourTypeSelected();
  }
  function showRegistrationSubmitOnly() {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    appendRegistrationCompleteness(body);
    const submit = mkPillButton('Indienen', () => safe(submitRegistrationFromHelper));
    submit.style.width = '100%';
    submit.setAttribute('data-registration-helper-submit', '');
    body.appendChild(submit);
    updateRegistrationReportSubmitButton();
    setStatus('Klaar om in te dienen', true);
  }
  // (B) Registratie-compleetheid vóór indienen — zelfde controles als de geteste
  // registrationModel-reader, op bevestigde ankers uit REG-B (geen geometrie).
  function _regCareFlags() {
    let text = '';
    let scripts; try { scripts = document.querySelectorAll('script'); } catch (e) { return {}; }
    for (const s of scripts) { const t = s.textContent || ''; if (t.indexOf('initialStoreState') !== -1 && t.indexOf('careProvider') !== -1) { text = t; break; } }
    const bool = (k) => { const m = text.match(new RegExp('"' + k + '"\\s*:\\s*(true|false)')); return m ? m[1] === 'true' : false; };
    return { requireReport: bool('require_report_per_client'), timeDistribution: bool('time_distribution_enabled') };
  }
  function _regToMin(raw) { const s = (raw == null ? '' : String(raw)).trim(); if (!s) return null; const hm = s.match(/^(\d{1,2}):(\d{2})$/); if (hm) return +hm[1] * 60 + +hm[2]; if (/^\d{1,4}$/.test(s)) return +s; return null; }
  function _regFieldVal(sel) { const el = document.querySelector(sel); if (!el) return ''; return (el.value != null && el.value !== '' ? el.value : el.getAttribute('value')) || ''; }
  // Een uit de registratie verwijderde cliënt: ONS zet de klasse 'removed' op de
  // client_form (en/of data-state removed/destroy; de velden staan disabled). De
  // hulp moet zo'n cliënt volledig negeren — geen uursoort-/rapportagemelding,
  // geen episodes-doorschakeling, enz.
  function registrationClientFormIsRemoved(row) {
    if (!row) return true;
    try {
      if (row.classList && row.classList.contains('removed')) return true;
      const st = (row.getAttribute('data-state') || '').toLowerCase();
      if (st === 'removed' || st === 'destroy') return true;
    } catch (e) {}
    return false;
  }
  function activeRegistrationClientForms() {
    return Array.prototype.slice.call(document.querySelectorAll('div.client_form[data-invitee-id]'))
      .filter((r) => !registrationClientFormIsRemoved(r));
  }
  function registrationCompletenessIssues() {
    const issues = [];
    const rows = activeRegistrationClientForms();
    const flags = _regCareFlags();
    for (const row of rows) {
      const id = row.getAttribute('data-invitee-id') || '';
      const name = (row.getAttribute('data-invitee-name') || '').trim() || 'cliënt';
      const cont = document.getElementById('select2-declaration_client_information_' + id + '__hour_type_id-container');
      let uSet = false;
      if (cont) {
        const ph = cont.querySelector('.select2-selection__placeholder');
        const title = cont.getAttribute('title') || '';
        const txt = (cont.textContent || '').trim();
        uSet = !ph && !!txt && !/zoek naar uursoorten|selecteer uursoort/i.test(title || txt);
      }
      if (!uSet) { const sel = document.getElementById('declaration_client_information_' + id + '__hour_type_id'); if (sel && sel.value && sel.value.trim()) uSet = true; }
      if (!uSet) issues.push({ sev: 'error', msg: 'Uursoort ontbreekt voor ' + name });
      const cb = document.getElementById('declaration_client_information_' + id + '__no_show');
      const noShow = !!(cb && cb.checked);
      const ta = document.getElementById('declaration_client_information_' + id + '__dossier_report_comment');
      const report = ta ? String(ta.value || ta.textContent || '').trim() : '';
      if (flags.requireReport && !noShow && !report) issues.push({ sev: 'error', msg: 'Rapportage ontbreekt voor ' + name });
      if (noShow && report) issues.push({ sev: 'warn', msg: 'No-show maar wel rapportage voor ' + name });
    }
    const startMin = _regToMin(_regFieldVal('#declaration_start_time') || _regFieldVal('#declaration_start_time_display'));
    const endMin = _regToMin(_regFieldVal('#declaration_end_time') || _regFieldVal('#declaration_end_time_display'));
    const dur = (startMin != null && endMin != null) ? endMin - startMin : null;
    if (dur != null && dur <= 0) issues.push({ sev: 'error', msg: 'Eindtijd ligt niet na begintijd' });
    if (flags.timeDistribution && dur != null && dur > 0) {
      const di = _regToMin(_regFieldVal('#declaration_direct_time')) || 0;
      const ind = _regToMin(_regFieldVal('#declaration_indirect_time')) || 0;
      if ((di + ind) > 0 && (di + ind) !== dur) issues.push({ sev: 'warn', msg: 'Direct + indirect (' + (di + ind) + ' min) komt niet overeen met de duur (' + dur + ' min)' });
    }
    return issues;
  }
  function appendRegistrationCompleteness(body) {
    let issues = [];
    try { issues = registrationCompletenessIssues(); } catch (e) { return; }
    if (!issues.length) return;
    const box = document.createElement('div');
    Object.assign(box.style, { margin: '0 0 8px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #f0c0c0', background: '#fdecec' });
    const h = document.createElement('div');
    h.textContent = 'Controleer voor indienen:';
    Object.assign(h.style, { fontSize: '12px', fontWeight: '700', color: '#9b1c1c', marginBottom: '4px' });
    box.appendChild(h);
    const ul = document.createElement('ul');
    Object.assign(ul.style, { margin: '0', padding: '0 0 0 16px' });
    for (const it of issues) {
      const li = document.createElement('li');
      li.textContent = it.msg;
      Object.assign(li.style, { fontSize: '12px', lineHeight: '1.35', color: it.sev === 'error' ? '#9b1c1c' : '#7a5200' });
      ul.appendChild(li);
    }
    box.appendChild(ul);
    body.appendChild(box);
  }
  function showRegistrationDurationAsk(choice) {
    const body = $body(); if (!body) return;
    if (!hasRegistrationStartTime()) {
      setStatus('Vul eerst de begintijd in.', false);
      // wacht tot begintijd er is, probeer dan opnieuw
      setTimeout(() => safe(() => { if (activeRegistrationChoice === choice) showRegistrationDurationAsk(choice); }), 500);
      return;
    }
    body.innerHTML = '';
    body.appendChild(mkBackButton(() => safe(showRegistrationChoices), 'Terug'));
    const title = document.createElement('div');
    title.textContent = `${choice.label} duur:`;
    Object.assign(title.style, { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px' });
    body.appendChild(title);
    for (let _st=(choice.durationStep>0?choice.durationStep:gsNum("durationStepMin",15)),_mx=(choice.maxDuration>0?choice.maxDuration:gsNum("registrationMaxMin",180)),minutes=_st; minutes <= _mx; minutes += _st) {
      body.appendChild(mkButton(`${choice.label} - ${registrationDurationLabel(minutes)}`, () => safe(() => {
        const endOk = setRegistrationEndTimePlusMinutes(minutes);
        // verdeling opnieuw toepassen op de nieuwe (nu bekende) duur
        applyRegistrationSplitForChoice(choice);
        scheduleReapplyRegistrationSplit();
        setStatus(endOk ? `${choice.label} ${registrationDurationLabel(minutes)}` : 'Eindtijd niet gezet', endOk);
        setTimeout(() => routeAfterRegistrationDuration(choice), 200);
      })));
    }
    setStatus('Kies de duur');
  }
  function routeAfterRegistrationDuration(choice) {
    if (registrationPortionApplies(choice)) showRegistrationPortionQuestion(choice);
    else if (choice.addTravelTime) showRegistrationTravelSelection(choice);
    else proceedToReportOrHourType(choice);
  }
  function registrationNeedsDurationAsk() {
    if (!hasRegistrationEndTime()) return true;
    const dur = registrationDurationMinutes();
    return dur !== null && dur <= 1; // 1 min = No show-restant -> nieuwe duur vragen
  }
  function registrationPortionApplies(choice) {
    return !!(choice && (choice.askIndirectPortion || choice.askDirectPortion));
  }
  // Zet de tegen-tijd (indirect bij directFull, direct bij indirectFull) op
  // `portionMinutes` en trekt dat van de hoofdtijd af. Totaal = registratieduur.
  function applyRegistrationPortion(choice, portionMinutes) {
    const total = registrationDurationMinutes();
    if (total === null) return false;
    const p = Math.max(0, Math.min(portionMinutes, total));
    if (choice.askIndirectPortion) {
      // hoofdtijd = direct; tegen-tijd = indirect
      return setRegistrationTimeSplit({ directMinutes: total - p, indirectMinutes: p });
    }
    if (choice.askDirectPortion) {
      // hoofdtijd = indirect; tegen-tijd = direct
      return setRegistrationTimeSplit({ directMinutes: p, indirectMinutes: total - p });
    }
    return true;
  }
  function registrationPortionWord(choice) {
    return choice.askIndirectPortion ? 'indirecte' : 'directe';
  }
  function proceedToReportOrHourType(choice) {
    // Uursoort wordt uit de ONS-dropdown gekozen; ontbreekt die nog, toon de
    // uursoort-keuze als laatste stap vóór de rapportage.
    if (choice && !choice.hourType && registrationHasNoShowHourTypeSelected()) {
      clearRegistrationNoShowHourTypes(() => {
        clickEmptyModalSpot();
        updateRegistrationSubmitGuard();
        showRegistrationHourTypeSelection();
        setStatus('No show-uursoort verwijderd | kies uursoort', false);
      });
      return;
    }
    if (!hasRegistrationHourTypeSelected()) { showRegistrationHourTypeSelection(); return; }
    showRegistrationReportPrompt(choice);
  }
  function continueAfterRegistrationChoice(choice) {
    registrationFlowBusy = true;
    if (choice.addTravelTime) setTimeout(() => { registrationFlowBusy = false; safe(() => showRegistrationTravelSelection(choice)); }, 200);
    else setTimeout(() => { registrationFlowBusy = false; safe(() => proceedToReportOrHourType(choice)); }, 200);
  }
  function showRegistrationPortionQuestion(choice) {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    body.appendChild(mkBackButton(() => safe(() => showRegistrationDurationAsk(choice)), 'Terug'));
    const woord = registrationPortionWord(choice);
    const q = document.createElement('div');
    q.textContent = `${woord.charAt(0).toUpperCase() + woord.slice(1)} tijd aanwezig in deze registratie?`;
    Object.assign(q.style, { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px', lineHeight: '1.35' });
    body.appendChild(q);
    const hint = document.createElement('div');
    const woordBijw = choice.askIndirectPortion ? 'indirect' : 'direct';
    const startTxt = registrationLiveTimeValue(registrationTimeInput('declaration_start_time_display')) || 'begintijd';
    const endTxt = registrationLiveTimeValue(registrationTimeInput('declaration_end_time_display')) || 'eindtijd';
    const pink = (txt) => {
      const s = document.createElement('span');
      s.textContent = txt;
      Object.assign(s.style, { color: '#cc087d', fontWeight: '700' });
      return s;
    };
    Object.assign(hint.style, { fontWeight: '400', fontSize: '12px', color: '#555', lineHeight: '1.4', margin: '0 0 8px' });
    hint.appendChild(document.createTextNode(`Gebruik dit alleen wanneer er tussen `));
    hint.appendChild(pink(startTxt));
    hint.appendChild(document.createTextNode(' en '));
    hint.appendChild(pink(endTxt));
    hint.appendChild(document.createTextNode(` ook een ${woordBijw} zorgmoment heeft plaatsgevonden. Is dit op een ander moment, maak dan een aparte afspraak aan.`));
    body.appendChild(hint);
    body.appendChild(mkButton('Ja', () => safe(() => showRegistrationPortionDuration(choice))));
    body.appendChild(mkButton('Nee', () => safe(() => {
      // door zoals nu: volledige hoofdtijd, geen tegen-tijd
      activeRegistrationPortionMinutes = null;
      applyRegistrationSplitForChoice(choice);
      scheduleReapplyRegistrationSplit();
      setStatus(`${choice.label} gezet`);
      continueAfterRegistrationChoice(choice);
    })));
    // Uit een afspraak: 'No show' blijft onder 'Nee' bereikbaar (de vorm-keuze
    // is immers overgeslagen). Bij een losse registratie zonder afspraak staat
    // No show al in de keuzelijst, dus dan tonen we deze knop niet.
    if (registrationFromAppointment) {
      const ns = REGISTRATION_CHOICES.find((x) => x.label === 'No show');
      if (ns) {
        const nsBtn = mkButton('No show', () => safe(() => applyRegistrationChoice(ns)), { chevron: false, accent: '#a3241f', accentWash: '#fbeceb' });
        body.appendChild(nsBtn);
      }
    }
    setStatus(`${woord} tijd?`);
  }
  function showRegistrationPortionDuration(choice) {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    body.appendChild(mkBackButton(() => safe(() => showRegistrationPortionQuestion(choice)), 'Terug'));
    const woord = registrationPortionWord(choice);
    const total = registrationDurationMinutes();
    const title = document.createElement('div');
    title.textContent = `Duur ${woord} tijd:`;
    Object.assign(title.style, { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px' });
    body.appendChild(title);
    if (total === null || total < 5) {
      const msg = document.createElement('div');
      msg.textContent = 'Registratieduur onbekend of te kort.';
      Object.assign(msg.style, { fontSize: '12px', color: '#b3261e' });
      body.appendChild(msg);
      return;
    }
    // Stapgrootte uit config (standaard 5 min), maximaal de registratieduur.
    const _ps = (APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.portionStepMin > 0) ? APP_CONFIG.generalSettings.portionStepMin : 5;
    const max = Math.floor(total / _ps) * _ps;
    for (let minutes = _ps; minutes <= max; minutes += _ps) {
      body.appendChild(mkButton(registrationDurationLabel(minutes), () => safe(() => {
        activeRegistrationPortionMinutes = minutes;
        const ok = applyRegistrationPortion(choice, minutes);
        scheduleReapplyRegistrationSplit();
        setStatus(ok ? `${choice.label} | ${woord} tijd ${registrationDurationLabel(minutes)}` : 'Verdeling niet gezet', ok);
        continueAfterRegistrationChoice(choice);
      })));
    }
  }
  function showRegistrationTravelSelection(choice) {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = 'Totale reistijd (heen en terug):';
    Object.assign(title.style, { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px' });
    body.appendChild(title);
    body.appendChild(mkBackButton(() => safe(showRegistrationChoices), 'Terug'));
    for (let _ts=(APP_CONFIG.generalSettings&&APP_CONFIG.generalSettings.travelStepMin>0?APP_CONFIG.generalSettings.travelStepMin:5),_tm=(APP_CONFIG.generalSettings&&APP_CONFIG.generalSettings.travelMaxMin>0?APP_CONFIG.generalSettings.travelMaxMin:60),minutes=0; minutes <= _tm; minutes += _ts) {
      body.appendChild(mkButton(registrationDurationLabel(minutes), () => safe(() => {
        registrationFlowBusy = true;
        const ok = setRegistrationTravelTotalMinutes(minutes);
        setStatus(ok ? `Reistijd gezet: ${registrationDurationLabel(minutes)} totaal` : 'Reistijdvelden niet gevonden', ok);
        setTimeout(() => { registrationFlowBusy = false; safe(() => proceedToReportOrHourType(activeRegistrationChoice)); }, 250);
      })));
    }
  }
  function showRegistrationDurationSelection(choice) {
    const body = $body(); if (!body) return;
    if (!hasRegistrationPrereqs()) { showRegistrationNeedsClient(); return; }
    body.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = `${choice.label} duur:`;
    Object.assign(title.style, { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px' });
    body.appendChild(title);
    body.appendChild(mkBackButton(() => safe(showRegistrationChoices), 'Terug'));
    for (let _st=(choice.durationStep>0?choice.durationStep:gsNum("durationStepMin",15)),_mx=(choice.maxDuration>0?choice.maxDuration:gsNum("registrationMaxMin",180)),minutes=_st; minutes <= _mx; minutes += _st) {
      const label = `${choice.label} - ${registrationDurationLabel(minutes)}`;
      body.appendChild(mkButton(label, () => safe(() => {
        activeRegistrationChoice = choice;
        const endOk = setRegistrationEndTimePlusMinutes(minutes);
        const splitOk = applyRegistrationSplitForChoice(choice);
        scheduleReapplyRegistrationSplit();
        setStatus(`${choice.label} ${registrationDurationLabel(minutes)}${endOk && splitOk ? '' : ' | tijd/verdeling deels gezet'}`, endOk && splitOk);
        registrationFlowBusy = true;
        setTimeout(() => { registrationFlowBusy = false; safe(() => choice.addTravelTime ? showRegistrationTravelSelection(choice) : showRegistrationHourTypeSelection()); }, 320);
      })));
    }
  }
  function selectHourTypeInNativeSelects(text) {
    const selects = deepQueryAll('select')
      .filter((sel) => /hour_type_id/.test(sel.id || sel.name || '') && (sel.options || []).length);
    if (!selects.length) return false;
    let okCount = 0;
    const wanted = clean(text);
    for (const sel of selects) {
      const option = Array.from(sel.options || []).find((opt) => clean(opt.textContent || opt.label || '') === wanted) ||
        Array.from(sel.options || []).find((opt) => clean(opt.textContent || opt.label || '').includes(wanted));
      if (!option) continue;
      sel.value = option.value;
      option.selected = true;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      try { if (window.jQuery) window.jQuery(sel).trigger('change'); } catch (e) {}
      okCount++;
    }
    return okCount === selects.length;
  }
  function visibleSelect2HourTypeContainers() {
    return deepQueryAll('[id^="select2-"][id$="hour_type_id-container"], .select2-selection__rendered')
      .filter((el) => visible(el) && !isOwnPopup(el) && /hour_type_id/.test(el.id || ''));
  }
  function registrationHourTypeSelectedInContainer(container) {
    if (!container) return false;
    const text = clean(container.textContent || container.getAttribute('title') || '');
    return !!text && !/zoek naar uursoorten|selecteer uursoort|uursoort/.test(text);
  }
  function registrationHourTypeTextInContainer(container) {
    if (!registrationHourTypeSelectedInContainer(container)) return '';
    return (container.textContent || container.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
  }
  function registrationHourTypeLooksNoShow(text) {
    return /\bno\s*show\b|\bnoshow\b/i.test(text || '');
  }
  function registrationHasNoShowHourTypeSelected() {
    if (visibleSelect2HourTypeContainers().some((container) => registrationHourTypeLooksNoShow(registrationHourTypeTextInContainer(container)))) return true;
    return deepQueryAll('select')
      .filter((sel) => /hour_type_id/.test(sel.id || sel.name || '') && (sel.options || []).length)
      .some((sel) => {
        const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
        return registrationHourTypeLooksNoShow((opt && (opt.textContent || opt.label)) || sel.value || '');
      });
  }
  function registrationHourTypeSelectForContainer(container) {
    const id = container && container.id && container.id.replace(/^select2-/, '').replace(/-container$/, '');
    return id ? document.getElementById(id) : null;
  }
  function registrationClientNameForHourType(container, index) {
    const select = registrationHourTypeSelectForContainer(container);
    // Betrouwbaarste route (bevestigd uit REG-B): de cliënt staat in een
    // div.client_form met data-invitee-name (en data-invitee-id). Geen geometrie
    // meer nodig - dit was de bron van verkeerd-gekoppelde/gescrapte namen.
    const clientForm = (select && select.closest && select.closest('.client_form[data-invitee-name]')) ||
      (container && container.closest && container.closest('.client_form[data-invitee-name]'));
    if (clientForm) {
      const nm = (clientForm.getAttribute('data-invitee-name') || '').replace(/\s+/g, ' ').trim();
      if (nm) return { name: nm, firstName: firstNameFromName(nm) || `client ${index + 1}` };
    }
    const roots = [select && select.closest('tr,.client_information,.nested-fields,[class*="client" i]')].filter(Boolean);
    const banned = /^(uursoort|rapportage|geboren op|zichtbaar voor|zoek naar uursoorten|selecteer uursoort|onlangs gebruikt|geadviseerd|toegestaan)$/;
    for (const root of roots) {
      const cr = rect(container);
      const names = deepQueryAll('strong,b,span,div,label', root)
        .filter((el) => {
          if (!visible(el) || isOwnPopup(el)) return false;
          if (el.closest && el.closest('.select2-container,.select2-dropdown,.select2-results')) return false;
          const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
          const c = clean(txt);
          if (!txt || txt.length > 70 || banned.test(c)) return false;
          if (/uursoort|rapportage|geboren op|zoek naar|ggz|hbo|mbo|factuur|declarabel|speciaal|ambulant|behandeling|diagnostiek|no show|consult/.test(c)) return false;
          if (!/\s/.test(txt)) return false;
          const r = rect(el);
          return r.top <= cr.top + 8 && r.bottom >= cr.top - 220 && r.left <= cr.left + 60;
        })
        .sort((a, b) => rect(b).bottom - rect(a).bottom);
      if (names.length) {
        const txt = names[0].textContent.replace(/\s+/g, ' ').trim();
        return { name: txt, firstName: firstNameFromName(txt) || `client ${index + 1}` };
      }
    }
    const cr = rect(container);
    const fallback = deepQueryAll('strong,b,span,div,label')
      .filter((el) => {
        if (!visible(el) || isOwnPopup(el)) return false;
        if (el.closest && el.closest('.select2-container,.select2-dropdown,.select2-results')) return false;
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const c = clean(txt);
        if (!txt || txt.length > 70 || banned.test(c) || !/\s/.test(txt)) return false;
        if (/uursoort|rapportage|geboren op|zoek naar|ggz|hbo|mbo|factuur|declarabel|speciaal|ambulant|behandeling|diagnostiek|no show|consult/.test(c)) return false;
        const r = rect(el);
        return r.top <= cr.top + 8 && r.bottom >= cr.top - 180 && r.left < cr.left - 10;
      })
      .sort((a, b) => rect(b).bottom - rect(a).bottom)[0];
    if (fallback) {
      const txt = fallback.textContent.replace(/\s+/g, ' ').trim();
      return { name: txt, firstName: firstNameFromName(txt) || `client ${index + 1}` };
    }
    return { name: `Client ${index + 1}`, firstName: `client ${index + 1}` };
  }
  function registrationHourTypeContexts() {
    return visibleSelect2HourTypeContainers()
      .sort((a, b) => rect(a).top - rect(b).top || rect(a).left - rect(b).left)
      .map((container, index) => {
        const target = container.closest('.select2-selection') || container.parentElement || container;
        const person = registrationClientNameForHourType(container, index);
        return { container, target, index, name: person.name, firstName: person.firstName };
      });
  }
  function clickSelect2OptionText(text) {
    const wanted = clean(text);
    const options = deepQueryAll('.select2-results__option,[role="option"],li')
      .filter((el) => visible(el) && !isOwnPopup(el));
    const match = options.find((el) => clean(el.textContent || '') === wanted) ||
      options.find((el) => clean(el.textContent || '').includes(wanted));
    if (!match) return false;
    clickOption(match);
    return true;
  }
  function clickSelect2OptionTextInRoot(text, root) {
    const wanted = clean(text);
    const options = deepQueryAll('.select2-results__option,[role="option"],li', root || document)
      .filter((el) => visible(el) && !isOwnPopup(el) && !/true/i.test(el.getAttribute('aria-disabled') || ''));
    const match = options.find((el) => clean(el.textContent || '') === wanted) ||
      options.find((el) => clean(el.textContent || '').includes(wanted));
    if (!match) return false;
    clickOption(match);
    return true;
  }
  function validRegistrationHourTypeOptionText(text) {
    const c = clean(text);
    if (!c || c.length < 2) return false;
    if (/^(onlangs gebruikt|geadviseerd|toegestaan)$/.test(c)) return false;
    return true;
  }
  function splitRegistrationHourTypeOptionText(text) {
    return splitUursoortCategoryText(text).filter(validRegistrationHourTypeOptionText);
  }
  function pushRegistrationHourTypeOption(out, seen, text) {
    for (const part of splitRegistrationHourTypeOptionText(text)) {
      const key = clean(part);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(part);
    }
  }
  function nativeRegistrationHourTypeOptions() {
    const out = [];
    const seen = new Set();
    for (const sel of deepQueryAll('select').filter((s) => /hour_type_id/.test(s.id || s.name || ''))) {
      for (const opt of Array.from(sel.options || [])) {
        const text = (opt.textContent || opt.label || '').replace(/\s+/g, ' ').trim();
        pushRegistrationHourTypeOption(out, seen, text);
      }
    }
    return out;
  }
  function select2ResultsElementForSelection(selection, rendered) {
    const owns = selection && selection.getAttribute && selection.getAttribute('aria-owns');
    if (owns) {
      const byOwns = document.getElementById(owns);
      if (byOwns) return byOwns;
    }
    const renderedId = rendered && rendered.id;
    if (renderedId && /-container$/.test(renderedId)) {
      const byRendered = document.getElementById(renderedId.replace(/-container$/, '-results'));
      if (byRendered) return byRendered;
    }
    return null;
  }
  function select2SearchInputForHourType(resultsRoot) {
    if (!resultsRoot || !/hour_type_id-results/.test(resultsRoot.id || '')) return null;
    const open = resultsRoot.closest('.select2-container--open') || document;
    return deepQueryAll('input.select2-search__field', open)
      .find((inp) => visible(inp) && !isOwnPopup(inp)) || null;
  }
  function visibleSelect2Options(resultsRoot) {
    const out = [];
    const seen = new Set();
    if (!resultsRoot) return out;
    const selector = '.select2-results__option,[role="option"],li';
    for (const opt of deepQueryAll(selector, resultsRoot).filter((el) => visible(el) && !isOwnPopup(el))) {
      if (/true/i.test(opt.getAttribute('aria-disabled') || '')) continue;
      if (/group/i.test(opt.getAttribute('role') || '') || /select2-results__option--group/.test(opt.className || '')) continue;
      if (opt.id && !/hour_type_id-result/.test(opt.id)) continue;
      if (hasNestedOptionNode(opt, selector)) continue;
      const text = (opt.textContent || '').replace(/\s+/g, ' ').trim();
      pushRegistrationHourTypeOption(out, seen, text);
    }
    return out;
  }
  function clearRegistrationPrefixFromHourTypeSearch(resultsRoot) {
    const search = select2SearchInputForHourType(resultsRoot);
    if (!search) return false;
    const value = String(search.value || '').trim();
    if (!value) return false;
    const c = clean(value);
    const prefixRe = registrationPrefixRegex();
    const looksLikeRegistrationPrefix = prefixRe.test(value) ||
      REGISTRATION_CHOICES.some((choice) => {
        const label = clean(choice.label);
        return c === label || (c.length >= 2 && label.startsWith(c.replace(/\s*-\s*$/, '')));
      });
    if (!looksLikeRegistrationPrefix) return false;
    setInputText(search, '');
    return true;
  }
  function listRegistrationHourTypeOptions(onDone, context = null) {
    const containers = context ? [context.container] : visibleSelect2HourTypeContainers();
    const nativeOptions = nativeRegistrationHourTypeOptions();
    if (!containers.length) { onDone(nativeOptions); return; }
    const container = containers[0];
    const target = container.closest('.select2-selection') || container.parentElement || container;
    registrationHourTypeBusy = true;
    clickElementCenter(target);
    // Wacht (met polling) tot het select2-resultatenpaneel daadwerkelijk
    // opties bevat i.p.v. na een vaste 280ms te lezen — dat leverde soms
    // "Geen uursoorten gevonden" op als het paneel nog niet gerenderd was.
    pollFor(() => {
      const resultsRoot = select2ResultsElementForSelection(target, container);
      if (!resultsRoot) return null;
      const options = visibleSelect2Options(resultsRoot);
      return options.length ? { resultsRoot, options } : null;
    }, (found) => {
      const resultsRoot = (found && found.resultsRoot) || select2ResultsElementForSelection(target, container);
      const cleared = clearRegistrationPrefixFromHourTypeSearch(resultsRoot);
      setTimeout(() => {
        const options = visibleSelect2Options(resultsRoot);
        registrationHourTypeBusy = false;
        onDone(context ? options : (options.length ? options : nativeOptions));
      }, cleared ? 120 : 0);
    }, { timeout: 2500, interval: 90 });
  }
  function clearRegistrationHourTypeForContext(context, onDone) {
    if (!context || !context.container) { if (onDone) onDone(false); return; }
    let touched = false;
    const select = registrationHourTypeSelectForContainer(context.container);
    if (select) {
      const emptyOption = Array.from(select.options || []).find((opt) => !opt.value);
      if (emptyOption) select.value = emptyOption.value;
      else select.selectedIndex = -1;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      try { if (window.jQuery) window.jQuery(select).trigger('change'); } catch (e) {}
      touched = true;
    }
    const selection = context.target || context.container.closest('.select2-selection') || context.container.parentElement || context.container;
    const clear = (context.container.querySelector && context.container.querySelector('.select2-selection__clear')) ||
      (selection.querySelector && selection.querySelector('.select2-selection__clear'));
    if (clear && visible(clear)) {
      clickOption(clear);
      touched = true;
      setTimeout(() => onDone && onDone(touched), 80);
      return;
    }
    if (onDone) onDone(touched);
  }
  function clearRegistrationNoShowHourTypes(onDone) {
    let touched = false;
    for (const sel of deepQueryAll('select').filter((s) => /hour_type_id/.test(s.id || s.name || '') && (s.options || []).length)) {
      const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      if (!registrationHourTypeLooksNoShow((opt && (opt.textContent || opt.label)) || sel.value || '')) continue;
      const emptyOption = Array.from(sel.options || []).find((o) => !o.value);
      if (emptyOption) sel.value = emptyOption.value;
      else sel.selectedIndex = -1;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      try { if (window.jQuery) window.jQuery(sel).trigger('change'); } catch (e) {}
      touched = true;
    }
    const contexts = registrationHourTypeContexts().filter((ctx) => registrationHourTypeLooksNoShow(registrationHourTypeTextInContainer(ctx.container)));
    let index = 0;
    const next = () => {
      const ctx = contexts[index++];
      if (!ctx) { if (onDone) onDone(touched); return; }
      clearRegistrationHourTypeForContext(ctx, (ok) => { touched = touched || ok; next(); });
    };
    next();
  }
  function backFromRegistrationHourTypeSelection(index = 0) {
    const contexts = registrationHourTypeContexts();
    const context = contexts[index] || null;
    setStatus('Uursoort verwijderen...');
    const afterClear = () => {
      clickEmptyModalSpot();
      updateRegistrationSubmitGuard();
      if (index > 0) showRegistrationHourTypeSelection(index - 1);
      else showRegistrationChoices();
      setStatus('Uursoort verwijderd');
    };
    if (context) clearRegistrationHourTypeForContext(context, afterClear);
    else clearRegistrationHourTypes(afterClear);
  }
  function showRegistrationHourTypeSelection(index = null) {
    const body = $body(); if (!body) return;
    const contexts = registrationHourTypeContexts();
    const selectedIndex = index === null
      ? Math.max(0, contexts.findIndex((ctx) => !registrationHourTypeSelectedInContainer(ctx.container)))
      : index;
    const context = contexts[selectedIndex] || null;
    if (contexts.length && !context) { showRegistrationReportPrompt(activeRegistrationChoice); return; }
    if (contexts.length && contexts.every((ctx) => registrationHourTypeSelectedInContainer(ctx.container)) && index === null) {
      showRegistrationReportPrompt(activeRegistrationChoice);
      return;
    }
    activeRegistrationHourTypeIndex = selectedIndex;
    body.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = context ? `Uursoort ${context.firstName}` : 'Uursoortselectie';
    Object.assign(title.style, { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px' });
    body.appendChild(title);
    body.appendChild(mkBackButton(() => safe(() => backFromRegistrationHourTypeSelection(selectedIndex)), 'Terug'));
    setStatus('Uursoorten laden...');
    listRegistrationHourTypeOptions((options) => {
      body.innerHTML = '';
      body.appendChild(title);
      body.appendChild(mkBackButton(() => safe(() => backFromRegistrationHourTypeSelection(selectedIndex)), 'Terug'));
      if (!options.length) {
        const msg = document.createElement('div');
        msg.textContent = 'Geen uursoorten gevonden';
        Object.assign(msg.style, { color: '#c62828', fontSize: '12px' });
        body.appendChild(msg);
      } else {
        for (const opt of options) {
          body.appendChild(mkButton(opt, () => safe(() => {
            setRegistrationHourTypeForContext(opt, context, (ok) => {
              if (ok && registrationTextHasNoShowCue(opt)) {
                registrationNoShowPromptSuppressed = false;
                registrationNoShowPromptAfterNo = () => {
                  if (context && selectedIndex + 1 < contexts.length) showRegistrationHourTypeSelection(selectedIndex + 1);
                  else if (hasRegistrationHourTypeSelected()) showRegistrationReportPrompt(activeRegistrationChoice);
                  else showRegistrationHourTypeSelection();
                };
                showRegistrationNoShowPrompt();
                setStatus(`No show-uursoort gekozen voor ${context ? context.firstName : 'client'}`, false);
                return;
              }
              if (ok && context && selectedIndex + 1 < contexts.length) {
                showRegistrationHourTypeSelection(selectedIndex + 1);
              } else if (ok && hasRegistrationHourTypeSelected()) {
                showRegistrationReportPrompt(activeRegistrationChoice);
              }
              setStatus(ok ? `Uursoort gezet voor ${context ? context.firstName : 'client'}: ${opt}` : `Uursoort niet gevonden voor ${context ? context.firstName : 'client'}: ${opt}`, ok);
            });
          })));
        }
      }
      setStatus(options.length ? 'Kies uursoort' : 'Uursoorten niet gevonden', !!options.length);
    }, context);
  }
  function setNoShowViaSelect2(attempt, onDone) {
    const containers = visibleSelect2HourTypeContainers();
    if (!containers.length) { onDone(false); return; }
    let index = 0, anyOk = false;
    const next = () => {
      const container = containers[index++];
      if (!container) { onDone(anyOk); return; }
      const target = container.closest('.select2-selection') || container.parentElement || container;
      clickElementCenter(target);
      setTimeout(() => {
        const resultsRoot = select2ResultsElementForSelection(target, container);
        const search = select2SearchInputForHourType(resultsRoot);
        if (search) setInputText(search, 'No show#');
        setTimeout(() => {
          const ok = clickSelect2OptionTextInRoot('No show#', resultsRoot);
          anyOk = anyOk || ok;
          setTimeout(next, 120);
        }, 180);
      }, 120);
    };
    next();
  }
  function setHourTypeViaSelect2(text, onDone) {
    const containers = visibleSelect2HourTypeContainers();
    if (!containers.length) { onDone(false); return; }
    let index = 0, okCount = 0;
    const next = () => {
      const container = containers[index++];
      if (!container) { onDone(okCount === containers.length); return; }
      const target = container.closest('.select2-selection') || container.parentElement || container;
      clickElementCenter(target);
      setTimeout(() => {
        const resultsRoot = select2ResultsElementForSelection(target, container);
        const search = select2SearchInputForHourType(resultsRoot);
        if (search) setInputText(search, text);
        setTimeout(() => {
          const ok = clickSelect2OptionTextInRoot(text, resultsRoot);
          setTimeout(() => {
            const selected = clean(container.textContent || container.getAttribute('title') || '');
            if (ok && selected && !/zoek naar uursoorten|selecteer uursoort|uursoort/.test(selected)) okCount++;
            else if (ok) okCount++;
            setTimeout(next, 80);
          }, 90);
        }, 180);
      }, 120);
    };
    next();
  }
  function setRegistrationHourTypeForContext(text, context, onDone) {
    if (!context) { setRegistrationHourType(text, onDone); return; }
    const target = context.target || context.container.closest('.select2-selection') || context.container.parentElement || context.container;
    clickElementCenter(target);
    setTimeout(() => {
      const resultsRoot = select2ResultsElementForSelection(target, context.container);
      setTimeout(() => {
        const ok = clickSelect2OptionTextInRoot(text, resultsRoot);
        setTimeout(() => onDone(!!ok && registrationHourTypeSelectedInContainer(context.container)), 120);
      }, 80);
    }, 120);
  }
  function setRegistrationHourType(text, onDone) {
    const nativeOk = selectHourTypeInNativeSelects(text);
    if (nativeOk) { onDone(true); return; }
    setHourTypeViaSelect2(text, onDone);
  }
  function clearRegistrationHourTypes(onDone) {
    let touched = false;
    const selects = deepQueryAll('select').filter((sel) => /hour_type_id/.test(sel.id || sel.name || ''));
    for (const sel of selects) {
      if (!sel.value && sel.selectedIndex <= 0) continue;
      const emptyOption = Array.from(sel.options || []).find((opt) => !opt.value);
      if (emptyOption) sel.value = emptyOption.value;
      else sel.selectedIndex = -1;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      try { if (window.jQuery) window.jQuery(sel).trigger('change'); } catch (e) {}
      touched = true;
    }
    const containers = visibleSelect2HourTypeContainers();
    let index = 0;
    const next = () => {
      const container = containers[index++];
      if (!container) { onDone(touched); return; }
      const selection = container.closest('.select2-selection') || container.parentElement || container;
      const clear = (container.querySelector && container.querySelector('.select2-selection__clear')) ||
        (selection.querySelector && selection.querySelector('.select2-selection__clear'));
      if (clear && visible(clear)) {
        clickOption(clear);
        touched = true;
        setTimeout(next, 100);
      } else {
        setTimeout(next, 0);
      }
    };
    next();
  }
  function setRegistrationNoShow(onDone) { setRegistrationHourType('No show#', onDone); }
  function applyRegistrationNoShow() {
    applyRegistrationChoice(REGISTRATION_CHOICES[0]);
  }
  function hasRegistrationEndTime() {
    const end = registrationTimeInput('declaration_end_time_display');
    return !!(end && timeTextToMinutes(registrationLiveTimeValue(end)) !== null);
  }
  function hasRegistrationHourTypeSelected() {
    const containers = visibleSelect2HourTypeContainers();
    if (containers.length) {
      return containers.every((el) => {
        const text = clean(el.textContent || el.getAttribute('title') || '');
        return !!text && !/zoek naar uursoorten|selecteer uursoort|uursoort/.test(text);
      });
    }
    const selects = deepQueryAll('select').filter((sel) => /hour_type_id/.test(sel.id || sel.name || '') && (sel.options || []).length);
    if (selects.length) return selects.every((sel) => {
      const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      const text = clean((opt && (opt.textContent || opt.label)) || '');
      return !!String(sel.value || '').trim() && validRegistrationHourTypeOptionText(text || sel.value);
    });
    return false;
  }
  function registrationReadyToSubmitPage() {
    return hasRegistrationPrereqs() && hasRegistrationEndTime() && hasRegistrationHourTypeSelected() && !registrationReportNeedsContent();
  }
  function hasRegistrationClient() {
    const valuedClientInput = deepQueryAll('input,select').some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const idName = `${el.id || ''} ${el.name || ''}`;
      if (/hour_type|time|date|direct|indirect|travel|declaration_client_information_\d+__(id|hour_type_id)/i.test(idName)) return false;
      return /(client|invitee|patient).*(^|_|-)id|(^|[_\[])(client|invitee|patient)(_id|id|\])/.test(idName) && !!String(el.value || '').trim();
    });
    if (valuedClientInput) return true;
    const select2Client = deepQueryAll('.select2-selection__rendered,[id^="select2-"][id$="-container"]').some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const id = el.id || '';
      if (!/(client|invitee|patient)/i.test(id) || /hour_type|time|date/i.test(id)) return false;
      const text = clean(el.textContent || '');
      return !!text && !/zoek|selecteer|client|cliënt|patient/.test(text);
    });
    if (select2Client) return true;
    if (!visibleSelect2HourTypeContainers().length) return false;
    return deepQueryAll('div,span,p,td,li,strong').some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const text = clean(el.textContent || '');
      if (!text || text.length > 240) return false;
      if (/rapportage|registratie maken|reistijd toevoegen|afwezigheid toevoegen/.test(text)) return false;
      return /geboren op\b|\(\d{3,}\)|\b\d{1,2}\s*jaar\b/.test(text);
    });
  }
  function hasRegistrationPrereqs() {
    return hasRegistrationClient() && hasRegistrationDate() && hasRegistrationStartTime();
  }
  function showRegistrationNeedsClient() {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    const line1 = mkText('registratie_prereq_regel1', 'Voor cliëntgebonden registraties: vul cliënt, datum en begintijd in.', { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px', color: '#c0006a' });
    body.appendChild(line1);
    const line2 = mkText('registratie_prereq_regel2', 'Voor niet cliëntgebonden registraties: vul datum, begintijd en eindtijd in.', { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px', color: '#c0006a' });
    body.appendChild(line2);
    setStatus('Wacht op cliënt, begintijd en datum');
  }
  // "Is de registratiepagina uitgerenderd/rustig?" -> document geladen én ~0,5s geen
  // NIET-eigen DOM-mutaties meer. Zo tonen we het herstelde scherm pas als de pagina
  // klaar is, i.p.v. te flikkeren tussen 'schrijf rapportage' en 'indienen' tijdens het laden.
  function registrationPageSettled() {
    try {
      if (document.readyState !== 'complete') return false;
      return (Date.now() - lastDomMutationAt) > 500;
    } catch (e) { return true; }
  }
  function registrationRestoreHolding() {
    if (!registrationRestoredToReport) return false;
    if (registrationPageSettled()) return false;
    if (registrationRestoreHoldStart && (Date.now() - registrationRestoreHoldStart) > 4000) return false; // veiligheidscap
    return true;
  }
  function armRegistrationSettleCheck() {
    if (registrationSettleTimer) return;
    registrationSettleTimer = setTimeout(() => { registrationSettleTimer = null; safe(refreshRegistrationPrereqScreen); }, 300);
  }
  function refreshRegistrationPrereqScreen() {
    const body = $body(); if (!body || registrationNoShowPromptOpen || registrationEpisodesPromptOpen) return;
    maybePrefetchUursoorten(); // achtergrond-prefetch van de uursoorten zodra cliënt aanwezig is
    // Na een refresh: wacht met renderen tot de pagina rustig is (geen flikker).
    if (registrationRestoreHolding()) { showLoadingState('Registratie laden...'); armRegistrationSettleCheck(); return; }
    if (_infoPanelRestore) return; // infopaneel open: niet overschrijven
    if (registrationHourTypeBusy) return;  // uursoorten worden geladen: niet overschrijven
    if (registrationFlowBusy) return;      // flow navigeert actief: niet overschrijven
    const text = body.textContent || '';
    // Na een refresh hersteld: de vorm is bekend -> rapportagescherm, ook zonder inhoud.
    if (registrationRestoredToReport && activeRegistrationChoice && !/richtlijn rapporteren|indienen/i.test(text)) {
      restoreRegistrationExtras(); // directe/indirecte tijd + reistijd terugzetten
      showRegistrationReportPrompt(activeRegistrationChoice);
      return;
    }
    if (activeRegistrationChoice && registrationReadyToSubmitPage() && !/richtlijn rapporteren|indienen/i.test(text)) {
      showRegistrationReportPrompt(activeRegistrationChoice);
      return;
    }
    // Geen cliënt, maar wel uursoort + tijden -> alleen Indienen tonen.
    if (!activeRegistrationChoice && registrationManualSubmitReady()) {
      if (!(popupEl && popupEl.querySelector('[data-registration-helper-submit]'))) showRegistrationSubmitOnly();
      return;
    }
    if (/vul client, begintijd en datum in|vul cliënt, begintijd en datum in|voor clientgebonden registraties|voor cliëntgebonden registraties/i.test(text) && hasRegistrationPrereqs()) showRegistrationChoices();
    else if (!hasRegistrationPrereqs() && !/vul client, begintijd en datum in|vul cliënt, begintijd en datum in|voor clientgebonden registraties|voor cliëntgebonden registraties/i.test(text)) showRegistrationNeedsClient();
  }
  function applyRegistrationChoice(choice) {
    if (!hasRegistrationPrereqs()) { showRegistrationNeedsClient(); return; }
    persistRegistrationForm(choice); // vorm onthouden zodat een refresh 'm herstelt
    registrationRestoredToReport = false; // verse keuze: geen restore-override
    activeRegistrationChoice = null;
    activeRegistrationPortionMinutes = null;
    activeRegistrationHourTypeIndex = null;
    registrationNoShowPromptOpen = false;
    registrationNoShowPromptSuppressed = true;
    registrationEpisodesPromptOpen = false;
    registrationEpisodesPromptSuppressed = false;
    setStatus(`${choice.label} instellen...`);
    let travelOk = true, endOk = true, splitOk = true, reportOk = true;
    reportOk = prefixRegistrationReport(choicePrefix(choice));
    if (choice.addTravelTime) travelOk = clickRegistrationTravelTimeButton();
    else scheduleClearRegistrationTravelTimes();
    if (choice.endPlusOneMinute) endOk = setRegistrationEndTimePlusOneMinute();
    if (choice.endPlusOneHour) endOk = setRegistrationEndTimePlusOneHour();
    if (choice.startSplit) splitOk = setRegistrationStartSplit(choice);
    if (choice.indirectFullDuration) splitOk = setRegistrationIndirectFullDuration();
    if (choice.directFullDuration) splitOk = setRegistrationDirectFullDuration();
    const finish = (hourOk) => {
      if (choice.endPlusOneMinute) endOk = setRegistrationEndTimePlusOneMinute() || endOk;
      if (choice.endPlusOneHour) endOk = setRegistrationEndTimePlusOneHour() || endOk;
      if (choice.startSplit) splitOk = setRegistrationStartSplit(choice) || splitOk;
      if (choice.indirectFullDuration) splitOk = setRegistrationIndirectFullDuration() || splitOk;
      if (choice.directFullDuration) splitOk = setRegistrationDirectFullDuration() || splitOk;
      const problems = [];
      const notes = [];
      if (choice.hourType && !hourOk) problems.push('uursoort niet gevonden');
      if (choice.addTravelTime && !travelOk) notes.push('Reistijdknop al aanwezig');
      if (choice.endPlusOneMinute && !endOk) problems.push('eindtijd niet gezet');
      if (choice.endPlusOneHour && !endOk) problems.push('eindtijd niet gezet');
      if ((choice.indirectFullDuration || choice.directFullDuration || choice.startSplit) && !splitOk) problems.push('directe/indirecte tijd niet gezet');
      if (!reportOk) notes.push('rapportage niet gevonden');
      const suffix = [...problems, ...notes].join(' | ');
      setStatus(problems.length ? `${choice.label} deels gezet | ${suffix}` : `${choice.label} gezet${suffix ? ` | ${suffix}` : ''}`, problems.length === 0);
      activeRegistrationChoice = choice;
      scheduleReapplyRegistrationSplit();
      if (choice.hourType) {
        // No show: zet zelf de eindtijd (begintijd + 1 min), ook als die nog
        // moest verschijnen; geen duur-uitvraag. Blijf het kort herproberen.
        if (choice.endPlusOneMinute) {
          [120, 350, 700, 1200].forEach((d) => setTimeout(() => safe(() => {
            if (!hasRegistrationEndTime()) setRegistrationEndTimePlusOneMinute();
          }), d));
        }
        // No show heeft ook een Indienen-pagina nodig.
        setTimeout(() => showRegistrationReportPrompt(choice), 400);
        return;
      }
      // Duur uitvragen als er geen eindtijd is OF als de huidige duur 1 min is
      // (restant van een eerdere No show die nu overschreven wordt).
      if (registrationNeedsDurationAsk()) {
        setTimeout(() => showRegistrationDurationAsk(choice), 250);
        return;
      }
      // Eindtijd is al ingevuld (omgezette afspraak): geen duur vragen.
      if (registrationPortionApplies(choice)) {
        setTimeout(() => showRegistrationPortionQuestion(choice), 300);
      } else if (choice.addTravelTime) {
        setTimeout(() => showRegistrationTravelSelection(choice), 300);
      } else {
        setTimeout(() => proceedToReportOrHourType(choice), 300);
      }
    };
    // No show overschrijft de uursoort met 'No show#'; alle andere vormen
    // laten de bestaande (uit de afspraak overgenomen) uursoort staan.
    if (choice.hourType) setRegistrationHourType(choice.hourType, finish);
    else finish(true);
  }
  function registrationTextHasNoShowCue(text) {
    return /\b(afwezig|voicemail|geen gehoor|niet bereikbaar|onbereikbaar|neemt niet op|nam niet op|niet opgenomen|niet verschenen|niet gekomen|komt niet|kwam niet|no show|noshow|zonder bericht|geen reactie|reageert niet|niet thuis|deur niet open|op voicemail|ingesproken)\b/i.test(text || '');
  }
  function registrationReportTextFields() {
    return deepQueryAll('textarea,input,[contenteditable="true"],[role="textbox"]')
      .filter((el) => {
        if (!visible(el) || isOwnPopup(el)) return false;
        if (el.closest && el.closest('.select2-container,.select2-dropdown,.select2-results,[role="listbox"]')) return false;
        const tag = (el.tagName || '').toLowerCase();
        const meta = clean([el.id, el.name, el.className, el.type, el.getAttribute && el.getAttribute('placeholder'), el.getAttribute && el.getAttribute('aria-label')].filter(Boolean).join(' '));
        if (/select2|search__field|zoek naar uursoorten|zoek naar labels|zichtbaar voor|visible for|hour_type|uursoort|client_information_\d+__hour_type_id|absence|afwezigheid/.test(meta)) return false;
        if (tag === 'input') {
          const type = clean(el.getAttribute('type') || 'text');
          if (!/^(text|search|textarea)?$/.test(type)) return false;
          if ((el.className || '').includes('time') || /time|date|declaration_(start|end)_time/.test(el.id || el.name || '')) return false;
          if (!/rapport|report|verslag|notit|note|description|omschrijving|content|body|text/.test(meta)) return false;
        }
        return true;
      });
  }
  function registrationReportTextValue(el) {
    if (!el) return '';
    if ('value' in el && typeof el.value === 'string') return el.value;
    return el.textContent || '';
  }
  function setRegistrationReportTextValue(el, text) {
    if (!el) return false;
    if ('value' in el && typeof el.value === 'string') setInputTextComposed(el, text);
    else {
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
    return true;
  }
  function focusRegistrationReportAtEnd(field) {
    if (!field) return false;
    try { field.focus(); } catch (e) {}
    if ('value' in field && typeof field.value === 'string') {
      const end = field.value.length;
      try { field.setSelectionRange(end, end); } catch (e) {}
      return true;
    }
    if (field.getAttribute && field.getAttribute('contenteditable') === 'true') {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(field);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      } catch (e) {}
    }
    return false;
  }
  function registrationPrimaryReportField() {
    const ov = overrideEl('regReport'); if (ov) return ov;
    const fields = registrationReportTextFields();
    if (!fields.length) return null;
    const preferred = fields.find((el) => {
      const tag = (el.tagName || '').toLowerCase();
      const meta = clean([el.id, el.name, el.className, el.getAttribute && el.getAttribute('aria-label')].filter(Boolean).join(' '));
      return tag === 'textarea' && /rapport|report|verslag|notit|note|description|omschrijving|content|body|text/.test(meta);
    });
    if (preferred) return preferred;
    return fields
      .filter((el) => (el.tagName || '').toLowerCase() === 'textarea' || el.getAttribute('contenteditable') === 'true')
      .sort((a, b) => area(b) - area(a))[0] || fields.sort((a, b) => area(b) - area(a))[0] || null;
  }
  // De rapportage-prefix van een vorm: het ingestelde 'reportPrefix' (uit de
  // beheerbare config) wint; anders de vorm-naam. Zo krijgt élke vorm een prefix
  // en is die per vorm aan te passen.
  function choicePrefix(c) {
    return (c && c.reportPrefix && String(c.reportPrefix).trim()) ? String(c.reportPrefix).trim() : (c ? c.label : '');
  }
  function registrationPrefixRegex() {
    const parts = REGISTRATION_CHOICES.map((c) => choicePrefix(c)).filter(Boolean)
      .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`^\\s*(?:${parts.join('|')})\\s*-\\s*`, 'i');
  }
  function registrationChoicePrefixRegex(choice) {
    const p = choicePrefix(choice);
    if (!p) return null;
    return new RegExp(`^\\s*${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-\\s*`, 'i');
  }
  function registrationReportNeedsContent() {
    const field = registrationPrimaryReportField();
    if (!field) return false;
    const text = registrationReportTextValue(field);
    if (activeRegistrationChoice) {
      const expectedPrefixRe = registrationChoicePrefixRegex(activeRegistrationChoice);
      if (!String(text || '').trim()) return true;
      if (expectedPrefixRe && !expectedPrefixRe.test(text)) return true;
      return !text.replace(expectedPrefixRe, '').trim();
    }
    const prefixRe = registrationPrefixRegex();
    if (!prefixRe.test(text)) return false;
    return !text.replace(prefixRe, '').trim();
  }
  function prefixRegistrationReport(label) {
    const field = registrationPrimaryReportField();
    if (!field) return false;
    const prefixRe = registrationPrefixRegex();
    const current = registrationReportTextValue(field);
    const rest = current.replace(prefixRe, '');
    const ok = setRegistrationReportTextValue(field, `${label} - ${rest}`);
    setTimeout(updateRegistrationSubmitGuard, 0);
    return ok;
  }
  function ensureActiveRegistrationReportPrefix(field = null) {
    if (!activeRegistrationChoice || activeRegistrationChoice.label === 'No show') return false;
    const primary = registrationPrimaryReportField();
    const target = field || primary;
    if (!target) return false;
    // Het type-prefix hoort alleen in het algemene rapportageveld.
    if (target !== primary) return false;
    const expectedRe = registrationChoicePrefixRegex(activeRegistrationChoice);
    const current = registrationReportTextValue(target);
    if (expectedRe && expectedRe.test(current)) return false;
    const trimmed = String(current || '').trim();
    const cleaned = clean(trimmed);
    const pfx = choicePrefix(activeRegistrationChoice);
    const labelClean = clean(pfx);
    const otherPrefixRe = registrationPrefixRegex();
    const looksEmptyOrBrokenPrefix =
      !trimmed ||
      (cleaned.length >= 2 && labelClean.startsWith(cleaned)) ||
      cleaned === labelClean ||
      otherPrefixRe.test(current);
    if (!looksEmptyOrBrokenPrefix) return false;
    const rest = otherPrefixRe.test(current) ? current.replace(otherPrefixRe, '') : '';
    const ok = setRegistrationReportTextValue(target, `${pfx} - ${rest}`);
    setTimeout(updateRegistrationSubmitGuard, 0);
    return ok;
  }
  function registrationSubmitButton() {
    return document.getElementById('submitRegistrationBtn') ||
      deepQueryAll('input[type="submit"],button[type="submit"]').find((el) => !isOwnPopup(el) && /indienen/i.test(el.value || el.textContent || '')) ||
      null;
  }
  function setRegistrationSubmitBlocked(blocked) {
    const btn = registrationSubmitButton();
    if (!btn) return;
    if ('disabled' in btn) btn.disabled = blocked;
    try { btn.setAttribute('aria-disabled', blocked ? 'true' : 'false'); } catch (e) {}
    const inner = btn.shadowRoot ? (btn.shadowRoot.querySelector('button[type="submit"], button') || btn) : btn;
    if (inner instanceof HTMLButtonElement) inner.disabled = blocked;
    // GEEN pointer-events:none: dan valt de hover weg en zie je de
    // 'niet toegestaan'-cursor (rood cirkeltje met schuine streep) nooit. Het
    // tegenhouden gebeurt via de disabled-knop + de submit-guard.
    for (const el of [inner, btn]) {
      if (el && el.style) {
        el.style.opacity = blocked ? '0.45' : '';
        el.style.cursor = blocked ? 'not-allowed' : '';
        el.style.pointerEvents = blocked ? 'auto' : '';
      }
    }
  }
  function updateRegistrationReportSubmitButton() {
    const btn = popupEl && popupEl.querySelector('[data-registration-helper-submit]');
    if (!btn) return;
    const blocked = registrationReportNeedsContent();
    btn.textContent = blocked ? 'Rapportage' : 'Indienen';
    btn.title = blocked ? 'Schrijf de rapportage' : 'Registratie indienen';
    btn.style.background = blocked ? '#a3241f' : '#1b7f3b';
    btn.style.boxShadow = blocked ? '0 6px 16px -7px rgba(163,36,31,.55)' : '0 6px 16px -7px rgba(27,127,59,.55)';
    btn.style.opacity = blocked ? '0.85' : '1';
    btn.style.cursor = blocked ? 'not-allowed' : 'pointer';
  }
  function submitRegistrationFromHelper() {
    ensureActiveRegistrationReportPrefix();
    updateRegistrationSubmitGuard();
    updateRegistrationReportSubmitButton();
    if (registrationReportNeedsContent()) {
      setStatus('Schrijf de rapportage', false);
      const field = registrationPrimaryReportField();
      focusRegistrationReportAtEnd(field);
      // Sommige ONS-componenten herstellen de selectie nog na focus; zet de
      // cursor daarom ook na de huidige event-cyclus opnieuw achteraan.
      setTimeout(() => focusRegistrationReportAtEnd(field), 0);
      return;
    }
    const btn = registrationSubmitButton();
    if (!btn) { setStatus('Indienen-knop niet gevonden', false); return; }
    clearPendingRegistration(); // ingediend -> onthouden vorm vergeten
    btn.click();
  }
  function updateRegistrationSubmitGuard() {
    setRegistrationSubmitBlocked(registrationReportNeedsContent());
    updateRegistrationReportSubmitButton();
  }
  function isRegistrationSubmitNode(el) {
    let n = el;
    for (let i = 0; n && i < 7; i++) {
      if (n.nodeType === 1 && n.matches && (n.matches('#submitRegistrationBtn') || (n.matches('input[type="submit"],button[type="submit"]') && /indienen/i.test(n.value || n.textContent || '')))) return true;
      n = n.parentElement;
    }
    return false;
  }
  function blockRegistrationSubmitIfReportEmpty(e) {
    if (!helperEnabled) return;
    if (activeMode !== 'registrations' || isOwnPopup(e.target)) return;
    if (e.type === 'click' && !isRegistrationSubmitNode(e.target)) return;
    ensureActiveRegistrationReportPrefix();
    if (!registrationReportNeedsContent()) { clearPendingRegistration(); updateRegistrationSubmitGuard(); return; } // echte indien-klik -> vergeten
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    updateRegistrationSubmitGuard();
    setStatus('Schrijf de rapportage', false);
  }
  function showRegistrationNoShowPrompt() {
    const body = $body(); if (!body || registrationNoShowPromptOpen) return;
    registrationNoShowPromptOpen = true;
    body.innerHTML = '';
    const q = document.createElement('div');
    q.textContent = 'No show?';
    Object.assign(q.style, { fontWeight: '700', fontSize: '14px', margin: '2px 0 4px' });
    body.appendChild(q);
    body.appendChild(mkButton('Ja', () => safe(() => {
      registrationNoShowPromptOpen = false;
      registrationNoShowPromptSuppressed = true;
      applyRegistrationNoShow();
      setTimeout(showRegistrationChoices, 350);
    })));
    body.appendChild(mkButton('Nee', () => safe(() => {
      registrationNoShowPromptOpen = false;
      registrationNoShowPromptSuppressed = true;
      const afterNo = registrationNoShowPromptAfterNo;
      registrationNoShowPromptAfterNo = null;
      if (afterNo) afterNo();
      else if (activeRegistrationChoice && registrationReadyToSubmitPage()) showRegistrationReportPrompt(activeRegistrationChoice);
      else showRegistrationChoices();
      setStatus('No show overgeslagen | ga verder');
    })));
    setStatus('Triggerwoord gevonden');
  }
  function checkRegistrationNoShowText(sourceEl) {
    if (!helperEnabled) return;
    if (activeMode !== 'registrations') return;
    if (!hasRegistrationPrereqs()) return;
    const fields = sourceEl ? [sourceEl] : registrationReportTextFields();
    const hasCue = fields.some((el) => !isOwnPopup(el) && registrationTextHasNoShowCue(registrationReportTextValue(el)));
    if (!hasCue) {
      const wasOpen = registrationNoShowPromptOpen;
      registrationNoShowPromptSuppressed = false;
      registrationNoShowPromptOpen = false;
      registrationNoShowPromptAfterNo = null;
      if (wasOpen) showRegistrationChoices();
      return;
    }
    if (!registrationNoShowPromptSuppressed) showRegistrationNoShowPrompt();
  }
  function registrationTextHasEpisodesTrigger(text) {
    return /\b(moeder|vader)\b/i.test(text || '');
  }
  function getRegistrationClientNumber() {
    // Alleen actieve (niet-verwijderde) clientforms tellen mee; een verwijderde
    // cliënt toont zijn naam/nummer nog wel, maar mag niet worden doorgeschakeld.
    const forms = activeRegistrationClientForms();
    const scopes = forms.length ? forms : [document];
    for (const scope of scopes) {
      let spans; try { spans = scope.querySelectorAll('.client_form_invitee_text span, [class*="invitee_text"] span, [class*="invitee-text"] span'); } catch (e) { spans = []; }
      for (const el of spans) {
        if (isOwnPopup(el)) continue;
        const m = (el.textContent || '').match(/\((\d+)\)/);
        if (m) return m[1];
      }
    }
    return null;
  }
  function extractEpisodesUrlFromJumpHref(href) {
    if (!href) return null;
    try {
      const toParam = href.split('to=')[1];
      if (!toParam) return null;
      const decoded = decodeURIComponent(toParam);
      const m = decoded.match(/\/clients\/(\d+)\//);
      if (!m) return null;
      const objectId = m[1];
      const url = new URL(decoded);
      return url.origin + '/clients/' + objectId + '/episodes';
    } catch (e) { return null; }
  }
  function findEpisodesUrlInDom() {
    for (const el of deepQueryAll('uc-link, a')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const href = el.getAttribute('href') || '';
      if (!href.includes('clients')) continue;
      const url = extractEpisodesUrlFromJumpHref(href);
      if (url) return url;
    }
    return null;
  }
  function findOmnisearchInput() {
    return deepQueryAll('input').find((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const ph = (el.getAttribute('placeholder') || '').toLowerCase();
      return ph.includes('liënt') || ph.includes('lient') || ph.includes('oeken');
    }) || null;
  }
  function doEpisodesSearch(clientNumber, onFound) {
    const btn = deepQueryAll(ONS.omnisearchTrigger).find((el) => visible(el) && !isOwnPopup(el));
    if (!btn) { onFound(null); return; }
    clickOption(btn);
    // Wacht (met polling) tot het zoekveld verschijnt i.p.v. een vaste vertraging.
    pollFor(findOmnisearchInput, (inp) => {
      if (!inp) { onFound(null); return; }
      setInputText(inp, clientNumber);
      // Wacht tot de dossierlink in de resultaten verschijnt.
      pollFor(findEpisodesUrlInDom, (url) => {
        try { inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (e) {}
        onFound(url || null);
      }, { timeout: 7000, interval: 150 });
    }, { timeout: 5000, interval: 120 });
  }
  function showRegistrationEpisodesPrompt() {
    const body = $body(); if (!body || registrationEpisodesPromptOpen) return;
    registrationEpisodesPromptOpen = true;
    body.innerHTML = '';
    const q = document.createElement('div');
    q.textContent = 'Afschermen via Episodes?';
    Object.assign(q.style, { fontWeight: '700', fontSize: '14px', margin: '2px 0 4px' });
    body.appendChild(q);
    const hint = document.createElement('div');
    hint.textContent = 'Kopieer en plak de af te schermen zin(nen) onder de juiste episode.';
    Object.assign(hint.style, { fontSize: '12px', margin: '0 0 8px', color: '#555' });
    body.appendChild(hint);
    body.appendChild(mkButton('Ja', () => safe(() => {
      registrationEpisodesPromptOpen = false;
      registrationEpisodesPromptSuppressed = true;
      const clientNumber = getRegistrationClientNumber();
      if (!clientNumber) { setStatus('Cliëntnummer niet gevonden', false); showRegistrationChoices(); return; }
      setStatus('Dossier zoeken...');
      doEpisodesSearch(clientNumber, (url) => {
        if (url) {
          window.open(url, '_blank');
          setStatus('Episodes geopend');
        } else {
          setStatus('Dossierlink niet gevonden', false);
        }
        showRegistrationChoices();
      });
    })));
    body.appendChild(mkButton('Nee', () => safe(() => {
      registrationEpisodesPromptOpen = false;
      registrationEpisodesPromptSuppressed = true;
      if (activeRegistrationChoice && registrationReadyToSubmitPage()) showRegistrationReportPrompt(activeRegistrationChoice);
      else showRegistrationChoices();
      setStatus('Episodes overgeslagen');
    })));
    setStatus('Triggerwoord gevonden: Moeder/Vader');
  }
  function checkRegistrationEpisodesText() {
    if (!helperEnabled || activeMode !== 'registrations') return;
    if (!hasRegistrationPrereqs()) return;
    const fields = registrationReportTextFields();
    const hasCue = fields.some((el) => !isOwnPopup(el) && registrationTextHasEpisodesTrigger(registrationReportTextValue(el)));
    if (!hasCue) {
      if (registrationEpisodesPromptOpen) { registrationEpisodesPromptOpen = false; registrationEpisodesPromptSuppressed = false; showRegistrationChoices(); }
      return;
    }
    if (!registrationEpisodesPromptSuppressed) showRegistrationEpisodesPrompt();
  }
  function onRegistrationReportInput(e) {
    if (!helperEnabled) return;
    if (activeMode !== 'registrations' || isOwnPopup(e.target)) return;
    const el = e.target;
    refreshRegistrationPrereqScreen();
    const idName = `${el && el.id || ''} ${el && el.name || ''}`;
    if (/declaration_(start|end)_time|declaration_(in)?direct_time|declaration_travel_time/.test(idName) || (el && (el.className || '').includes('js-time'))) {
      scheduleReapplyRegistrationSplit();
      persistRegistrationTimes(); // onthoud direct/indirect + reistijd voor na een refresh
      updateRegistrationSubmitGuard();
      return;
    }
    const fields = registrationReportTextFields();
    const field = fields.includes(el) ? el : fields.find((candidate) => candidate.contains && candidate.contains(el));
    if (!field) return;
    updateRegistrationSubmitGuard();
    checkRegistrationNoShowText();
    checkRegistrationEpisodesText();
  }
  // Extra vangnet voor de directe/indirecte verdeling: bij een begintijd-interactie
  // zet ONS de directe tijd soms terug zónder een input-event dat we opvangen. Een
  // focusout op een tijdveld triggert daarom (idempotent) een her-verdeling volgens
  // de actieve registratievorm.
  function onRegistrationTimeInteract(e) {
    if (!helperEnabled || activeMode !== 'registrations' || !e || isOwnPopup(e.target)) return;
    const el = e.target;
    const idName = `${(el && el.id) || ''} ${(el && el.name) || ''}`;
    if (/declaration_(start|end)_time|declaration_(in)?direct_time/.test(idName) || (el && (el.className || '').includes('js-time'))) {
      scheduleReapplyRegistrationSplit();
    }
  }
  function onRegistrationReportFocus(e) {
    if (!helperEnabled) return;
    if (activeMode !== 'registrations' || isOwnPopup(e.target)) return;
    const fields = registrationReportTextFields();
    const field = fields.includes(e.target) ? e.target : fields.find((candidate) => candidate.contains && candidate.contains(e.target));
    if (!field) return;
    // Alleen het ALGEMENE (grote) rapportageveld krijgt het type-prefix,
    // nooit de per-client rapportagevelden.
    if (field === registrationPrimaryReportField()) ensureActiveRegistrationReportPrefix(field);
    updateRegistrationSubmitGuard();
  }
  function onAppointmentInput(e) {
    if (!helperEnabled) return;
    if (activeMode === 'registrations' || isOwnPopup(e.target)) return;
    refreshAppointmentPrereqScreen();
    updateSubmitGuard();
  }
  function clearRegistrationSettings() {
    // Wis eindtijd, rapportage, direct/indirect, reistijd en uursoort.
    activeRegistrationChoice = null;
    activeRegistrationPortionMinutes = null;
    activeRegistrationHourTypeIndex = null;
    // Bewust resetten: na 'Instellingen verwijderen' de gewone keuzelijst tonen
    // (niet opnieuw automatisch de afspraakvorm toepassen).
    registrationAutoChoice = null;
    registrationAutoApplied = true;
    registrationFromAppointment = false;
    registrationRestoredToReport = false;
    try { sessionStorage.removeItem(PENDING_REG_KEY); } catch (e) {} // onthouden vorm vergeten
    clearTimeout(reapplyRegistrationSplitTimer);
    setStatus('Instellingen verwijderen...');
    // eindtijd
    const end = registrationTimeInput('declaration_end_time_display');
    if (end) setInputTextComposed(end, '');
    // direct/indirect
    const direct = registrationDirectTimeInput();
    const indirect = registrationIndirectTimeInput();
    if (direct) setInputTextComposed(direct, '');
    if (indirect) setInputTextComposed(indirect, '');
    // reistijd
    clearRegistrationTravelTimes();
    // rapportage (alleen het door de helper toegevoegde "Label - " prefix + tekst leegmaken
    // is te riskant; we maken het primaire rapportageveld leeg)
    const field = registrationPrimaryReportField();
    if (field) setRegistrationReportTextValue(field, '');
    // uursoort
    clearRegistrationHourTypes(() => {
      updateRegistrationSubmitGuard();
      showRegistrationChoices();
      setStatus('Instellingen verwijderd');
    });
  }
  // ===== Afspraaklabel -> registratievorm =====
  const PENDING_REG_KEY = 'onsHelper.pendingReg';
  // Id (occurrence) van de HUIDIGE registratie uit de URL — robuust voor beide vormen:
  // /registrations/{id}/edit én /calendar/invitee/{x}/registrations/{id}/...
  let _regIdOverride = null; // testhaak
  function currentRegistrationId() {
    if (_regIdOverride != null) return _regIdOverride;
    const m = (location.pathname || '').match(/\/registrations\/([^/?#]+)/);
    return m ? m[1] : null;
  }
  // Vergeet de onthouden registratievorm/tijden (bij indienen of terug naar de agenda).
  function clearPendingRegistration() { try { sessionStorage.removeItem(PENDING_REG_KEY); } catch (e) {} }
  // Koppelt een ONS-afspraaklabel (bv. "JG Huisbezoek") aan een registratievorm
  // uit REGISTRATION_CHOICES. Onbekende labels (bv. Telefonisch/Digitaal, dat
  // geen eigen registratievorm heeft) geven null -> geen automatische route.
  function matchRegistrationChoiceByLabel(label) {
    const c = clean(label);
    if (!c) return null;
    // Koppeling zit nu in de registratievorm zelf (APP_CONFIG.registrationForms[].labels).
    // Een vorm matcht als het afspraaklabel één van zijn gekoppelde labels bevat.
    for (const form of (APP_CONFIG.registrationForms || [])) {
      const labels = Array.isArray(form.labels) ? form.labels : [];
      const hit = labels.some((w) => { const cw = clean(w); return !!cw && c.indexOf(cw) !== -1; });
      if (hit) return REGISTRATION_CHOICES.find((x) => clean(x.label) === clean(form.vorm)) || null;
    }
    return null;
  }
  // Vangt het label + registratie-id van een geopende afspraak-detailpopup zodra
  // 'Registreren' wordt geklikt en bewaart dit (sessionStorage) tot de
  // registratiepagina laadt. Werkt in de oude (.label[title]) en nieuwe
  // (.labels uc-tag) opmaak.
  function capturePendingRegistrationLabel(fromEl) {
    try {
      const scope = (fromEl && fromEl.closest && fromEl.closest('.popup_content, .popup, [role="dialog"]')) || document;
      let label = '';
      const withTitle = scope.querySelector('.labels .label[title]');
      if (withTitle) label = withTitle.getAttribute('title') || '';
      if (!label) { const tag = scope.querySelector('.labels uc-tag'); if (tag) label = (tag.textContent || '').trim(); }
      if (!label) { const desc = scope.querySelector('.description'); if (desc) label = (desc.textContent || '').split(' - ')[0].trim(); }
      if (!label) return;
      let id = null;
      const declare = scope.querySelector('[data-qa="declare_button"][data-qa-url], [data-qa-url*="/registrations/"]');
      const urlAttr = declare && declare.getAttribute('data-qa-url');
      const mm = urlAttr && urlAttr.match(/\/registrations\/([^/]+)\/edit/);
      if (mm) id = mm[1];
      sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify({ id: id, label: label, ts: Date.now() }));
    } catch (e) {}
  }
  // Laadt (en verbruikt) het bewaarde afspraaklabel voor de huidige registratie.
  // Zet registrationAutoChoice/-FromAppointment als het label bij deze
  // registratie hoort en matcht met een registratievorm.
  function loadPendingRegistrationLabel() {
    registrationAutoChoice = null;
    registrationFromAppointment = false;
    registrationAutoApplied = false;
    registrationRestoredToReport = false;
    registrationExtrasRestored = false;
    let raw = null; try { raw = sessionStorage.getItem(PENDING_REG_KEY); } catch (e) { return; }
    if (!raw) return;
    let data = null; try { data = JSON.parse(raw); } catch (e) { data = null; }
    if (!data || (!data.label && !data.vorm)) return;
    const curId = currentRegistrationId();
    // Andere registratie dan waarvoor we iets onthielden -> vergeten. Zo herstelt een
    // net afgeronde/vorige registratie NIET op een nieuwe, lege registratie.
    if (data.id && curId) { if (data.id !== curId) { clearPendingRegistration(); return; } }
    else if (!data.ts || (Date.now() - data.ts) > 10 * 60 * 1000) { return; }
    // De koppeling wordt NIET meer weggegooid, zodat de gekozen vorm een pagina-
    // refresh overleeft (anders "zijn de instellingen voor de vorm weg").
    if (data.vorm) {
      // Al eerder toegepast: licht herstellen zodat de hulp de vorm weer kent en de
      // directe/indirecte verdeling opnieuw (idempotent) toepast — ZONDER de volledige
      // flow opnieuw te draaien (geen dubbele reistijd/rapportage-prefix).
      const restored = REGISTRATION_CHOICES.find((x) => clean(x.label) === clean(data.vorm));
      if (restored) {
        activeRegistrationChoice = restored;
        registrationFromAppointment = true;
        registrationAutoApplied = true;
        registrationRestoredToReport = true; // hulp herkent de vorm -> rapportagescherm i.p.v. keuzemenu
        registrationRestoreHoldStart = Date.now(); // start "wachten tot de pagina rustig is"
        scheduleReapplyRegistrationSplit();
        // Rapportage-prefix meteen (opnieuw) zetten; het veld is bij mount niet altijd
        // direct klaar, dus kort herproberen (idempotent: dubbelt de prefix niet).
        [0, 200, 500, 1000].forEach((d) => setTimeout(() => safe(() => ensureActiveRegistrationReportPrefix()), d));
      }
      return;
    }
    // Eerste keer vanuit de afspraak: label -> vorm, daarna éénmalige volledige auto-apply.
    const choice = matchRegistrationChoiceByLabel(data.label);
    if (choice) { registrationAutoChoice = choice; registrationFromAppointment = true; }
  }
  // Onthoud de gekozen registratievorm (per registratie-id) zodat een refresh 'm
  // kan herstellen. Overschrijft de eerste label-koppeling zodra een vorm is toegepast.
  function persistRegistrationForm(choice) {
    if (!choice) return;
    try {
      const rid = currentRegistrationId();
      // Verse keuze: de vorm bewaren en de tijd-extra's (direct/indirect/reistijd) resetten;
      // de flow vult ze zo weer via persistRegistrationTimes().
      sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify({ id: rid, vorm: choice.label, ts: Date.now() }));
    } catch (e) {}
  }
  // Merge een deel in het bewaarde registratierecord (alleen als er al een vorm/label bij hoort).
  function updatePendingReg(patch) {
    try {
      let cur = null; const raw = sessionStorage.getItem(PENDING_REG_KEY);
      if (raw) { try { cur = JSON.parse(raw); } catch (e) { cur = null; } }
      if (!cur || (!cur.vorm && !cur.label)) return;
      sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify(Object.assign(cur, patch, { ts: Date.now() })));
    } catch (e) {}
  }
  // Onthoud de HUIDIGE directe/indirecte tijd + totale reistijd. Dit zijn deels
  // handmatige keuzes die ONS bij een refresh leegt; zo kunnen we ze terugzetten.
  function persistRegistrationTimes() {
    try {
      const d = _regToMin(inputTextValue(registrationDirectTimeInput()));
      const i = _regToMin(inputTextValue(registrationIndirectTimeInput()));
      const th = _regToMin(inputTextValue(registrationTravelInput('heen')));
      const tt = _regToMin(inputTextValue(registrationTravelInput('terug')));
      updatePendingReg({ direct: (d == null ? null : d), indirect: (i == null ? null : i), travel: (th || 0) + (tt || 0) });
    } catch (e) {}
  }
  // Zet de bewaarde directe/indirecte verdeling + reistijd terug na een refresh,
  // één keer, met retries (de velden zijn net na 'settle' nog niet altijd klaar).
  function restoreRegistrationExtras() {
    if (registrationExtrasRestored) return;
    registrationExtrasRestored = true;
    let data = null;
    try { data = JSON.parse(sessionStorage.getItem(PENDING_REG_KEY) || 'null'); } catch (e) { data = null; }
    if (!data) return;
    const dMin = (typeof data.direct === 'number') ? data.direct : null;
    const iMin = (typeof data.indirect === 'number') ? data.indirect : null;
    if (dMin != null || iMin != null) {
      [0, 250, 700].forEach((ms) => setTimeout(() => safe(() => setRegistrationTimeSplit({ directMinutes: dMin, indirectMinutes: iMin })), ms));
    }
    if (typeof data.travel === 'number' && data.travel > 0) {
      const applyTravel = () => {
        // Reistijdrij toevoegen als die na de refresh weg is, daarna de totale reistijd zetten.
        if (!registrationTravelInput('heen') && !registrationTravelInput('terug')) clickRegistrationTravelTimeButton();
        setRegistrationTravelTotalMinutes(data.travel);
      };
      [0, 300, 800, 1400].forEach((ms) => setTimeout(() => safe(applyTravel), ms));
    }
  }
  function showRegistrationChoices() {
    const body = $body(); if (!body) return;
    body.innerHTML = '';
    if (helperNeedsTeamChoice()) { showNeedsTeamChoice(); return; }
    if (!hasRegistrationPrereqs()) { showRegistrationNeedsClient(); return; }
    // Na een refresh hersteld: de vorm is al toegepast -> direct het rapportagescherm
    // tonen i.p.v. het keuzemenu (ook als de rapportage nog leeg is). Maar pas als de
    // pagina rustig/geladen is, anders flikkert het tijdens het laden.
    if (registrationRestoredToReport && activeRegistrationChoice) {
      if (registrationRestoreHolding()) { showLoadingState('Registratie laden...'); armRegistrationSettleCheck(); return; }
      restoreRegistrationExtras(); // directe/indirecte tijd + reistijd terugzetten
      showRegistrationReportPrompt(activeRegistrationChoice);
      return;
    }
    // Uit een afspraak? Sla de vorm-keuze over en pas éénmalig automatisch de bij
    // het afspraaklabel horende registratievorm toe (direct/indirect volgt daaruit).
    if (registrationAutoChoice && !registrationAutoApplied && !(activeRegistrationChoice && registrationReadyToSubmitPage())) {
      registrationAutoApplied = true;
      const auto = registrationAutoChoice;
      setStatus('Uit afspraak: ' + auto.label);
      applyRegistrationChoice(auto);
      return;
    }
    // Altijd eerst de registratievorm laten kiezen; pas NA een keuze
    // (activeRegistrationChoice gezet) door naar de rapportage/indienen.
    if (activeRegistrationChoice && registrationReadyToSubmitPage()) {
      showRegistrationReportPrompt(activeRegistrationChoice);
      return;
    }
    REGISTRATION_CHOICES.forEach((choice, i) => {
      body.appendChild(mkButton(choice.label, () => safe(() => applyRegistrationChoice(choice)), { tick: onsahCategoryColor(onsahRegistrationIsDirect(choice), i) }));
    });
    const reset = mkButton('Instellingen verwijderen', () => safe(clearRegistrationSettings), { chevron: false, accent: '#a3241f', accentWash: '#fbeceb' });
    body.appendChild(reset);
    setStatus('');
  }
  function safe(fn) { try { fn(); } catch (e) { setStatus('Er ging iets mis', false); } }

  function setPopupCollapsed(collapsed) {
    popupCollapsed = collapsed;
    if (!popupEl) return;
    const body = popupEl.querySelector('[data-body]');
    const status = popupEl.querySelector('[data-status]');
    const toggle = popupEl.querySelector('[data-collapse-toggle]');
    if (body) body.style.display = collapsed ? 'none' : 'flex';
    if (status) status.style.display = collapsed ? 'none' : '';
    if (toggle) {
      setChevronIcon(toggle, collapsed);
      toggle.setAttribute('aria-label', collapsed ? 'Hulp uitklappen' : 'Hulp inklappen');
    }
  }
  function clampPos(left, top) {
    const w = (popupEl && popupEl.offsetWidth) || 280;
    const h = (popupEl && popupEl.offsetHeight) || 200;
    const maxLeft = Math.max(8, window.innerWidth - w - 8);
    const maxTop = Math.max(8, window.innerHeight - h - 8);
    return {
      left: Math.min(Math.max(8, left), maxLeft),
      top: Math.min(Math.max(8, top), maxTop),
    };
  }
  function onsHeaderBottom() {
    const selectors = [
      'uw-hub',
      '.hub-container',
      'header',
      '[role="banner"]',
      '[class*="topbar" i]',
      '[class*="navbar" i]',
      '[class*="header" i]'
    ];
    let best = 0;
    for (const el of deepQueryAll(selectors.join(','))) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const r = rect(el);
      if (r.width < Math.min(320, window.innerWidth * 0.5)) continue;
      if (r.height < 28 || r.height > 140) continue;
      if (r.top > 24 || r.bottom < 32) continue;
      best = Math.max(best, r.bottom);
    }
    return best || 64;
  }
  function defaultPopupTop() {
    return Math.round(onsHeaderBottom() + 10);
  }
  function defaultPopupLeft() {
    const w = (popupEl && popupEl.offsetWidth) || 280;
    const m = findModal();
    if (m && m.panel && rect(m.panel).width > 0) {
      const r = rect(m.panel);
      return r.right - w - 24;
    }
    return window.innerWidth - w - 20;
  }
  // Herpositioneer na een layout-/inhoudswijziging, met verse hoogtemeting.
  function reclampToViewport() {
    if (!popupEl) return;
    if (!userPos) { reposition(); return; }
    const r = rect(popupEl);
    const h = popupEl.offsetHeight || r.height || 200;
    let top = r.top;
    const maxTop = Math.max(8, window.innerHeight - h - 8);
    if (top > maxTop) top = maxTop;
    const p = clampPos(r.left, top);
    popupEl.style.left = p.left + 'px';
    popupEl.style.top = p.top + 'px';
    popupEl.style.right = 'auto';
    popupEl.style.bottom = 'auto';
    if (userPos) userPos = p;
  }
  function buildPopup() {
    ensureOnsAhBaseStyles();
    popupEl = document.createElement('div');
    Object.assign(popupEl.style, { position: 'fixed', zIndex: '2147483647', width: '296px', top: '74px', right: '24px', background: '#fff', color: '#201d1f', pointerEvents: 'auto', border: '1px solid #ece7e5', borderRadius: '16px', boxShadow: '0 14px 40px rgba(32,20,15,.24)', font: '14px/1.4 system-ui, sans-serif', overflow: 'hidden', display: 'flex', flexDirection: 'row', alignItems: 'stretch' });
    // De spine: gekleurde balk die de assistent herkenbaar maakt, de aan/uit-
    // status draagt (roze werkend, grijs uitgeschakeld) en samen met de
    // kopregel het sleepgebied vormt.
    const spine = document.createElement('div');
    spine.setAttribute('data-popup-spine', '');
    Object.assign(spine.style, { width: '16px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', cursor: 'move', userSelect: 'none' });
    const spineChip = document.createElement('span');
    Object.assign(spineChip.style, { width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: '0 0 auto' });
    spine.appendChild(spineChip);
    const onSpineMousedown = (e) => {
      if (e.target.closest && e.target.closest('[data-popup-control]')) return;
      dragging = true; const r = rect(popupEl); dragDX = e.clientX - r.left; dragDY = e.clientY - r.top; e.preventDefault();
    };
    spine.addEventListener('mousedown', onSpineMousedown);
    const mainCol = document.createElement('div');
    Object.assign(mainCol.style, { flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column' });
    const header = document.createElement('div');
    Object.assign(header.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', color: '#201d1f', padding: '11px 12px', fontWeight: '700', cursor: 'move', userSelect: 'none', borderBottom: '1px solid #f1ecea' });
    const title = document.createElement('span');
    title.textContent = activeMode === 'registrations' ? 'Registratiehulp' : 'Afspraakhulp';
    Object.assign(title.style, { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    header.appendChild(title);
    const enabledToggle = document.createElement('button');
    enabledToggle.setAttribute('data-enabled-toggle', '');
    enabledToggle.setAttribute('data-popup-control', '');
    Object.assign(enabledToggle.style, { position: 'relative', background: 'transparent', border: '0', borderRadius: '999px', color: '#fff', cursor: 'pointer', lineHeight: '1', padding: '0', width: '58px', height: '24px', fontWeight: '700', overflow: 'hidden', flex: '0 0 auto', fontFamily: 'inherit' });
    const switchTrack = document.createElement('span');
    Object.assign(switchTrack.style, { position: 'absolute', inset: '0', borderRadius: '999px', border: '1px solid rgba(255,255,255,.45)', transition: 'background .16s ease, box-shadow .16s ease, opacity .16s ease' });
    const switchText = document.createElement('span');
    Object.assign(switchText.style, { position: 'absolute', top: '0', bottom: '0', display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: '700', letterSpacing: '0', color: '#fff', opacity: '.95', transition: 'left .16s ease, right .16s ease', pointerEvents: 'none' });
    const switchKnob = document.createElement('span');
    Object.assign(switchKnob.style, { position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.22)', transition: 'left .16s ease' });
    enabledToggle.appendChild(switchTrack);
    enabledToggle.appendChild(switchText);
    enabledToggle.appendChild(switchKnob);
    onsahFocusRing(enabledToggle);
    const updateEnabledToggle = () => {
      switchText.textContent = helperEnabled ? 'Aan' : 'Uit';
      switchTrack.style.background = helperEnabled ? '#1b7f3b' : '#a3241f';
      switchTrack.style.boxShadow = helperEnabled ? 'inset 0 0 0 1px rgba(255,255,255,.12)' : 'inset 0 0 0 1px rgba(255,255,255,.10)';
      switchTrack.style.opacity = helperEnabled ? '1' : '.82';
      switchKnob.style.left = helperEnabled ? '37px' : '3px';
      switchText.style.left = helperEnabled ? '9px' : '27px';
      switchText.style.right = helperEnabled ? '25px' : '7px';
      enabledToggle.setAttribute('aria-label', helperEnabled ? 'Hulp uitschakelen' : 'Hulp inschakelen');
      enabledToggle.setAttribute('aria-pressed', helperEnabled ? 'true' : 'false');
      enabledToggle.title = helperEnabled ? 'Aan' : 'Uit';
      spine.style.background = helperEnabled ? '#cc087d' : '#9a9296';
      spineChip.innerHTML = '';
      spineChip.appendChild(helperEnabled ? svgSpineCheck() : svgSpinePause());
    };
    updateEnabledToggle();
    enabledToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      helperEnabled = !helperEnabled;
      storageSet(STORE_HELPER_ENABLED, helperEnabled ? '1' : '0');
      updateEnabledToggle();
      if (helperEnabled) {
        // Herstel meteen de opslaanblokkade die bij uitschakelen is opgeheven,
        // passend bij de actieve modus (afspraak vs. registratie).
        const reapplyGuard = () => {
          if (activeMode === 'registrations') updateRegistrationSubmitGuard();
          else updateSubmitGuard();
        };
        const restore = _disabledRestore;
        _disabledRestore = null;
        if (restore) {
          // Terug naar het laatst geopende scherm (afspraak én registratie).
          if (activeMode !== 'registrations' && hasClientInAppointment()) {
            ensureClientExpanded(() => { restore(); reapplyGuard(); });
          } else {
            restore();
            reapplyGuard();
          }
        } else if (activeMode !== 'registrations') {
          resumeAppointmentHelperAfterEnable();
        } else {
          refreshMainScreen();
        }
        // Vangnet: forceer de blokkade nogmaals nadat het scherm is opgebouwd,
        // ook als een van de bovenstaande takken de guard niet raakte.
        reapplyGuard();
      } else {
        _disabledRestore = _infoPanelRestore || createCurrentScreenRestore();
        _infoPanelRestore = null;
        setSubmitBlocked(false);
        setRegistrationSubmitBlocked(false);
        showDisabledState();
      }
    });
    const infoBtn = document.createElement('button');
    infoBtn.setAttribute('data-info-toggle', '');
    infoBtn.setAttribute('data-popup-control', '');
    infoBtn.setAttribute('aria-label', `Info en versie ${SCRIPT_VERSION}`);
    infoBtn.title = `Info en versie ${SCRIPT_VERSION}`;
    infoBtn.appendChild(svgInfoIcon());
    Object.assign(infoBtn.style, { background: '#f6f2f0', border: '1px solid #ece7e5', borderRadius: '8px', color: '#6b6367', cursor: 'pointer', lineHeight: '1', padding: '5px 7px', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });
    infoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (popupCollapsed) setPopupCollapsed(false);
      safe(toggleInfoPanel);
    });
    onsahFocusRing(infoBtn);
    const close = document.createElement('button');
    close.setAttribute('data-collapse-toggle', '');
    close.setAttribute('data-popup-control', '');
    close.setAttribute('aria-label', popupCollapsed ? 'Hulp uitklappen' : 'Hulp inklappen');
    Object.assign(close.style, { background: '#f6f2f0', border: '1px solid #ece7e5', borderRadius: '8px', color: '#6b6367', cursor: 'pointer', lineHeight: '1', padding: '3px', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });
    setChevronIcon(close, popupCollapsed);
    close.addEventListener('click', () => setPopupCollapsed(!popupCollapsed));
    onsahFocusRing(close);
    const controls = document.createElement('div');
    controls.setAttribute('data-popup-control', '');
    Object.assign(controls.style, { display: 'inline-flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', marginLeft: '8px' });
    controls.appendChild(enabledToggle);
    controls.appendChild(infoBtn);
    controls.appendChild(close);
    header.appendChild(controls);
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest && e.target.closest('[data-popup-control]')) return;
      dragging = true; const r = rect(popupEl); dragDX = e.clientX - r.left; dragDY = e.clientY - r.top; e.preventDefault();
    });
    mainCol.appendChild(header);
    const body = document.createElement('div');
    body.setAttribute('data-body', '');
    Object.assign(body.style, { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' });
    mainCol.appendChild(body);
    const status = document.createElement('div');
    status.setAttribute('data-status', '');
    Object.assign(status.style, { padding: '0 12px 12px' });
    mainCol.appendChild(status);
    popupEl.appendChild(spine);
    popupEl.appendChild(mainCol);
    refreshMainScreen();
    setPopupCollapsed(popupCollapsed);
    // Houd de popup volledig in beeld zodra de inhoud (en dus de hoogte) verandert.
    try {
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => { safe(reclampToViewport); });
        ro.observe(popupEl);
        popupEl.__onsResizeObserver = ro;
      }
    } catch (e) {}
  }
  let _reclampRaf = 0;

  // sleep-listeners (een keer)
  window.addEventListener('mousemove', (e) => {
    if (!dragging || !popupEl) return;
    const p = clampPos(e.clientX - dragDX, e.clientY - dragDY);
    userPos = p;
    popupEl.style.left = p.left + 'px'; popupEl.style.top = p.top + 'px';
    popupEl.style.right = 'auto'; popupEl.style.bottom = 'auto';
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  function findModal() {
    if (CONFIG.modalPanelSelector) { const p = document.querySelector(CONFIG.modalPanelSelector); if (p) return { host: p, panel: p }; }
    let cands = deepQueryAll('dialog[open],[role="dialog"],[aria-modal="true"]').filter(visible);
    if (!cands.length) cands = deepQueryAll('[class*="modal" i],[class*="dialog" i]').filter(visible);
    if (!cands.length) return null;
    const withForm = cands.filter((c) => /afspraakdetails|opslaan|afspraak toevoegen/i.test(c.textContent || ''));
    const pool = withForm.length ? withForm : cands;
    const host = [...pool].sort((a, b) => area(b) - area(a))[0];
    const panel = [...pool].sort((a, b) => area(a) - area(b)).find((c) => rect(c).width > 480 && rect(c).width < window.innerWidth * 0.96) || pool[0];
    return { host, panel };
  }
  function reposition() {
    if (!popupEl) return;
    if (userPos) { const p = clampPos(userPos.left, userPos.top); popupEl.style.left = p.left + 'px'; popupEl.style.top = p.top + 'px'; popupEl.style.right = 'auto'; popupEl.style.bottom = 'auto'; return; }
    const left = defaultPopupLeft();
    const top = defaultPopupTop();
    const p = clampPos(left, top);
    popupEl.style.left = p.left + 'px'; popupEl.style.top = p.top + 'px';
    popupEl.style.right = 'auto'; popupEl.style.bottom = 'auto';
  }
  function ensureMounted() {
    if (!active) return;
    if (!popupEl) buildPopup();
    const m = findModal();
    const host = (m && m.host) || document.body;
    if (popupEl.parentNode !== host) { try { host.appendChild(popupEl); } catch (e) { document.body.appendChild(popupEl); } }
    if (!helperEnabled) {
      showDisabledState();
      reposition();
      return;
    }
    if (appointmentClearingSettings) {
      showLoadingState('Instellingen verwijderen...');
      reposition();
      return;
    }
    if (activeMode === 'registrations') {
      refreshRegistrationPrereqScreen();
      checkRegistrationNoShowText();
      checkRegistrationEpisodesText();
      updateRegistrationSubmitGuard();
      reposition();
      return;
    }
    safe(guardInviteeAddButton);
    // Elke render verse cliëntgegevens lezen: de MutationObserver vuurt tijdens
    // het toevoegen van een cliënt, en anders zou een <250ms oude (nog lege)
    // cache blijven hangen tot een volgende, ongerelateerde mutatie.
    invalidateClientEntries();
    refreshFreeDayFromBackgroundCalendar();
    if (appointmentFreeDay) { showFreeDayInactive(); reposition(); return; }
    refreshAppointmentPrereqScreen();
    if (hasClientInAppointment()) ensureClientExpanded(() => {});
    handleClientListChanges();
    updateSubmitGuard();
    reposition();
  }
  function removePopup() { if (popupEl) { popupEl.remove(); popupEl = null; } }

  /*  activeren per route  */
  let _mountRaf = 0;
  const scheduleMount = () => {
    if (_mountRaf) return;
    _mountRaf = requestAnimationFrame(() => { _mountRaf = 0; safe(ensureMounted); });
  };
  function activate(mode) {
    if (active && activeMode === mode) return;
    if (active && activeMode !== mode) deactivate();
    // Agendahulp sluiten zodra afspraak-/registratiehulp actief wordt.
    if (typeof agendaHelperDeactivate === 'function') { try { agendaHelperDeactivate(); } catch (e) {} }
    active = true; activeMode = mode; userPos = null;
    registrationTravelClicked = false; registrationFlowBusy = false; registrationHourTypeBusy = false;
    // Afspraaklabel inlezen vóór de eerste render, zodat de registratiehulp de
    // vorm-keuze meteen kan overslaan als de registratie uit een afspraak komt.
    if (mode === 'registrations') safe(loadPendingRegistrationLabel);
    safe(ensureMounted);
    observer = new MutationObserver((muts) => {
      let modalAdded = false;
      const own = muts.every((mm) => {
        if (!modalAdded && mm.addedNodes && mm.addedNodes.length) {
          for (const n of mm.addedNodes) {
            if (n.nodeType !== 1) continue;
            if ((n.matches && n.matches('uc-modal,[role="dialog"],dialog')) ||
                (n.querySelector && n.querySelector('uc-modal,[role="dialog"],dialog'))) { modalAdded = true; break; }
          }
        }
        return popupEl && (popupEl.contains(mm.target) || mm.target === popupEl);
      });
      if (!own) {
        lastDomMutationAt = Date.now(); // pagina muteert nog -> nog niet "rustig/geladen"
        if (modalAdded) safe(maybeDismissStrayInviteeModal);
        scheduleMount();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    if (activeMode !== 'registrations') {
      // De "+ Toevoegen"-guard hangt direct op de knop (guardInviteeAddButton);
      // geen dure document-brede pointer-listeners meer nodig.
      document.addEventListener('click', blockSubmitIfNoUursoort, true);
      document.addEventListener('submit', blockSubmitIfNoUursoort, true);
      document.addEventListener('input', onAppointmentInput, true);
      document.addEventListener('change', onAppointmentInput, true);
    } else {
      document.addEventListener('input', onRegistrationReportInput, true);
      document.addEventListener('change', onRegistrationReportInput, true);
      document.addEventListener('focusout', onRegistrationTimeInteract, true);
      document.addEventListener('focusin', onRegistrationReportFocus, true);
      document.addEventListener('click', blockRegistrationSubmitIfReportEmpty, true);
      document.addEventListener('submit', blockRegistrationSubmitIfReportEmpty, true);
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    repositionTimer = setInterval(() => safe(() => {
      if (!document.hasFocus()) return; // niets doen als het tabblad niet actief is
      if (!helperEnabled) { reposition(); return; }
      // De guard draait al bij elke input/change; in de achtergrond met verse
      // client-cache, zodat het interval niet de hele DOM herbouwt.
      invalidateClientEntries();
      if (activeMode !== 'registrations') {
        // Vangnet: mocht de MutationObserver/input een cliënt- of datum/tijd-
        // wijziging missen, dan herkent dit interval die alsnog snel.
        refreshAppointmentPrereqScreen();
        updateSubmitGuard();
      } else {
        updateRegistrationSubmitGuard();
      }
      reposition();
    }), 250);
  }
  function deactivate() {
    if (!active) return;
    active = false;
    if (observer) { observer.disconnect(); observer = null; }
    document.removeEventListener('click', blockSubmitIfNoUursoort, true);
    document.removeEventListener('submit', blockSubmitIfNoUursoort, true);
    document.removeEventListener('input', onAppointmentInput, true);
    document.removeEventListener('change', onAppointmentInput, true);
    document.removeEventListener('input', onRegistrationReportInput, true);
    document.removeEventListener('change', onRegistrationReportInput, true);
    document.removeEventListener('focusout', onRegistrationTimeInteract, true);
    document.removeEventListener('focusin', onRegistrationReportFocus, true);
    document.removeEventListener('click', blockRegistrationSubmitIfReportEmpty, true);
    document.removeEventListener('submit', blockRegistrationSubmitIfReportEmpty, true);
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition);
    clearInterval(repositionTimer);
    knownClientNames.clear();
    autoSelectingNewClient = false;
    uursoortQueueGen++; uursoortQueueActive = false; appointmentFlowBusy = false; // lopende uursoort-wachtrij afbreken
    clearTimeout(registrationSettleTimer); registrationSettleTimer = null;
    pendingChoice = null;
    appointmentTypeApplied = false;
    helperEndText = ''; appointmentEndTimeUserOwned = false; // eindtijd-guard reset bij (her)mount
    appointmentAwaitingManualUursoort = false;
    registrationTravelClicked = false; registrationFlowBusy = false; registrationHourTypeBusy = false;
    registrationNoShowPromptOpen = false;
    registrationNoShowPromptSuppressed = false;
    registrationEpisodesPromptOpen = false;
    registrationEpisodesPromptSuppressed = false;
    activeRegistrationChoice = null;
    activeRegistrationHourTypeIndex = null;
    registrationAutoChoice = null;
    registrationFromAppointment = false;
    registrationAutoApplied = false;
    if (manualUursoortAutoTimer) { clearInterval(manualUursoortAutoTimer); manualUursoortAutoTimer = null; }
    activeMode = null;
    removePopup();
  }
  // Optionele domein-allowlist uit de config. Leeg = actief op elk domein dat
  // het manifest toelaat. Gevuld = alleen actief op deze domeinen (kan de
  // manifest-scope wel beperken, niet uitbreiden).
  function activationDomainsOk() {
    try {
      const d = (APP_CONFIG.activation && APP_CONFIG.activation.domains) || [];
      if (!Array.isArray(d) || !d.length) return true;
      const host = (location.hostname || '').toLowerCase();
      return d.some((dom) => { dom = String(dom || '').trim().toLowerCase(); return dom && host.indexOf(dom) !== -1; });
    } catch (e) { return true; }
  }
  // De registratie-INVUL/edit-flow: /registrations/{id}/edit of .../registrations/new.
  function isRegistrationEditOrNew(path) {
    return /\/registrations\/([^/]+\/edit|new)(?:$|[/?#])/.test(path != null ? path : (location.pathname || ''));
  }
  // De registratie-OVERZICHTSPAGINA: kale /registrations (evt. ?date=), zonder id/new.
  function isRegistrationOverviewPage(path) {
    return /\/registrations\/?$/.test(path != null ? path : (location.pathname || ''));
  }
  // ---- Declarabiliteit-paneel op de /registrations-overzichtspagina ----
  let _regOvPanel = null, _regOvKey = null;
  function removeRegistrationsOverviewPanel() { if (_regOvPanel) { try { _regOvPanel.remove(); } catch (e) {} _regOvPanel = null; } _regOvKey = null; }
  function buildRegistrationsOverviewPanel() {
    if (_regOvPanel) return _regOvPanel;
    ensureOnsAhBaseStyles();
    const p = document.createElement('div'); _regOvPanel = p; p.setAttribute('data-ons-reg-overview', '1');
    p.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;width:308px;max-height:75vh;background:#fff;color:#201d1f;border:1px solid #ece7e5;border-radius:16px;box-shadow:0 14px 40px rgba(32,20,15,.24);font:13px/1.4 system-ui,sans-serif;overflow:hidden;display:flex;flex-direction:row;align-items:stretch';
    const spine = document.createElement('div');
    spine.style.cssText = 'width:14px;flex:0 0 auto;background:#cc087d';
    const mainCol = document.createElement('div');
    mainCol.style.cssText = 'flex:1 1 auto;min-width:0;display:flex;flex-direction:column;overflow:auto';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:#fff;color:#201d1f;padding:10px 12px;font-weight:700;border-bottom:1px solid #f1ecea';
    const t = document.createElement('span'); t.textContent = 'Declarabiliteit';
    const x = document.createElement('button'); x.type = 'button'; x.setAttribute('data-popup-control', '');
    x.title = 'Sluiten'; x.setAttribute('aria-label', 'Sluiten'); x.style.cssText = 'border:1px solid #ece7e5;background:#f6f2f0;color:#6b6367;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px';
    x.appendChild(svgCloseIcon());
    x.addEventListener('click', function () { removeRegistrationsOverviewPanel(); });
    onsahFocusRing(x);
    header.append(t, x); mainCol.appendChild(header);
    const body = document.createElement('div'); body.setAttribute('data-reg-ov-body', ''); body.style.cssText = 'padding:10px 12px';
    mainCol.appendChild(body);
    p.appendChild(spine); p.appendChild(mainCol);
    (document.body || document.documentElement).appendChild(p);
    return p;
  }
  function updateRegistrationsOverviewPanel() {
    try {
      if (!RUNTIME_CONFIG.enabled || !isRegistrationOverviewPage()) { removeRegistrationsOverviewPanel(); return; }
      const date = currentAgendaDate();
      const prof = (typeof ACTIVE_PROFILE !== 'undefined') ? ACTIVE_PROFILE : null;
      const key = date + '|' + prof;
      const panel = buildRegistrationsOverviewPanel();
      if (key === _regOvKey) return; // niets veranderd
      _regOvKey = key;
      const body = panel.querySelector('[data-reg-ov-body]');
      body.textContent = 'Declarabiliteit laden…';
      var wkNr = agendaWeekNumber(date);
      var wkLabel = wkNr ? ('week ' + wkNr) : _agDateLabel(date);
      fetchDeclarabiliteitSummary(date).then(function (rs) {
        if (_regOvKey !== key || !_regOvPanel) return;
        body.innerHTML = '';
        body.appendChild(agendaRegistrationsSectionEl(rs, wkLabel, prof));
      }, function (e) {
        if (_regOvKey !== key || !_regOvPanel) return;
        body.textContent = 'Kon declarabiliteit niet laden: ' + ((e && e.message) || 'fout');
      });
    } catch (e) {}
  }
  function syncWithUrl() {
    if (!helperConfigReady) return;
    // (#2 uitrol) Centrale kill-switch heeft voorrang op de build-scope.
    if (!RUNTIME_CONFIG.enabled) { deactivate(); removeRegistrationsOverviewPanel(); return; }
    if (!activationDomainsOk()) { deactivate(); removeRegistrationsOverviewPanel(); return; }
    const wantEvents = (HELPER_SCOPE === 'all' || HELPER_SCOPE === 'events') && RUNTIME_CONFIG.appointmentHelperEnabled;
    const wantRegistrations = (HELPER_SCOPE === 'all' || HELPER_SCOPE === 'registrations') && RUNTIME_CONFIG.registrationHelperEnabled;
    // De registratiehulp draait alleen op de invul-/edit-/new-pagina, NIET op het
    // kale /registrations-overzicht (daar tonen we het declarabiliteit-paneel).
    if (wantEvents && location.href.includes(CONFIG.urlNeedle)) activate('events');
    else if (wantRegistrations && location.href.includes(CONFIG.registrationNeedle) && isRegistrationEditOrNew()) activate('registrations');
    else deactivate();
    updateRegistrationsOverviewPanel();
  }

  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    history[m] = function () { const r = orig.apply(this, arguments); window.dispatchEvent(new Event('locationchange')); return r; };
  }
  window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
  window.addEventListener('locationchange', syncWithUrl);

  // In een extensie-content-script (geïsoleerde wereld) onderschept het patchen
  // van history.pushState de navigaties van de pagina zelf niet. Daarom pollen
  // we de URL en vuren locationchange bij elke wijziging.
  let _lastHref = location.href;
  setInterval(() => {
    if (location.href !== _lastHref) { _lastHref = location.href; window.dispatchEvent(new Event('locationchange')); }
  }, 250);

  HELPER_CONFIG_READY.then(syncWithUrl);

  // Vang het afspraaklabel zodra vanaf de agenda op 'Registreren' wordt geklikt
  // (detailpopup van een afspraak). Globaal, want dit gebeurt op de agenda waar
  // de afspraak-/registratiehulp nog niet actief is.
  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || !t.closest) return;
    const btn = t.closest('[data-qa="declare_button"], #declare-option-link');
    if (btn) capturePendingRegistrationLabel(btn);
  }, true);

  /* ===== Agenda: tijd buiten 08:00-17:00 grijs maken op /invitees ===== */
  (function dayGreyModule() {
    const START_HOUR = 8;   // vanaf hier wit
    const END_HOUR = 17;    // tot hier wit
    const NEEDLE = '/invitees';
    const CLASS = 'ons-helper-offhours';
    const VERSION = SCRIPT_VERSION;
    // Vaste gekleurde achtergrondzones (uren als decimale waarde). Puur achtergrond.
    const COLOR_ROOD  = 'rgba(220,70,70,0.15)';
    const COLOR_GEEL  = 'rgba(235,205,70,0.20)';
    const COLOR_BLAUW = 'rgba(70,130,210,0.16)';
    const COLOR_GROEN = 'rgba(60,170,90,0.18)';
    const NORM_DIRECT_PCT = 80; // streefpercentage directe tijd
    // ===== Profielen: elk profiel heeft eigen zones + legenda =====
    // JGGZ = de bestaande indeling.
    const ZONES_JGGZ = [
      { from: 8.0,   to: 8.5,   color: COLOR_ROOD,  label: 'Dagstart' },
      { from: 8.5,   to: 11.5,  color: COLOR_GEEL,  label: 'Cliëntafspraken' },
      { from: 11.5,  to: 12.0,  color: COLOR_ROOD,  label: 'Administratie' },
      { from: 12.0,  to: 12.5,  color: COLOR_BLAUW, label: 'Pauze' },
      { from: 12.5,  to: 14.0,  color: COLOR_GEEL,  label: 'Cliëntafspraken' },
      { from: 14.0,  to: 14.75, color: COLOR_ROOD,  label: 'Administratie' },
      { from: 14.75, to: 16.25, color: COLOR_GEEL,  label: 'Cliëntafspraken' },
      { from: 16.25, to: 17.0,  color: COLOR_GROEN, label: 'Vergadering' },
    ];
    const LEGEND_JGGZ = [
      { color: 'rgba(220,70,70,0.45)',   text: 'Dagstart / administratie' },
      { color: 'rgba(235,205,70,0.65)',  text: 'Cliëntafspraken' },
      { color: 'rgba(70,130,210,0.45)',  text: 'Pauze' },
      { color: 'rgba(60,170,90,0.50)',   text: 'Vergadering' },
    ];
    // J&O/JBG = voorlopig een kopie (tijden nog te corrigeren); rode zones = Huisbezoek.
    // J&O/JBG = huisbezoek-gedreven dag.
    const ZONES_JO = [
      { from: 8.0,   to: 8.5,   color: COLOR_GEEL,  label: 'Administratie (indirect)' },
      { from: 8.5,   to: 12.0,  color: COLOR_ROOD,  label: 'Huisbezoek (direct)' },
      { from: 12.0,  to: 12.5,  color: COLOR_BLAUW, label: 'Pauze' },
      { from: 12.5,  to: 14.0,  color: COLOR_ROOD,  label: 'Huisbezoek (direct)' },
      { from: 14.0,  to: 14.75, color: COLOR_GEEL,  label: 'Administratie (indirect)' },
      { from: 14.75, to: 16.25, color: COLOR_ROOD,  label: 'Huisbezoek (direct)' },
      { from: 16.25, to: 17.0,  color: COLOR_GROEN, label: 'Vergadering' },
    ];
    const LEGEND_JO = [
      { color: 'rgba(220,70,70,0.45)',   text: 'Huisbezoek (direct)' },
      { color: 'rgba(235,205,70,0.65)',  text: 'Administratie (indirect)' },
      { color: 'rgba(70,130,210,0.45)',  text: 'Pauze' },
      { color: 'rgba(60,170,90,0.50)',   text: 'Vergadering' },
    ];
    const PROFILES = {
      'JGGZ':    { label: 'JGGZ',    zones: ZONES_JGGZ, legend: LEGEND_JGGZ },
      'J&O/JBG': { label: 'J&O/JBG', zones: ZONES_JO,   legend: LEGEND_JO },
    };
    let observer = null, rafPending = false, active = false, pollTimer = null, totalsTimer = null;
    const STORE_GREY_ENABLED = 'onsHelper.greyEnabled';
    let greyEnabled = storageGet(STORE_GREY_ENABLED, '1') !== '0'; // gekleurde achtergrond aan/uit
    // Het gekozen profiel komt uit de extensie-popup (chrome.storage.sync, zodat
    // de keuze meereist naar andere apparaten). Async geladen, live bijgewerkt.
    let currentProfile = null;
    function applyProfileValue(p) {
      currentProfile = (p && (profileExists(p) || PROFILES[p])) ? p : null;
      if (active) schedule();
      if (agPopup) agRenderMain();
    }
    function loadProfileFromStorage() {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage) return;
        const area = chrome.storage.sync || chrome.storage.local;
        area.get(['colorProfile'], function (res) {
          if (res && res.colorProfile) { applyProfileValue(res.colorProfile); return; }
          // Migratie: eenmalig een oude keuze uit local naar sync overzetten.
          if (chrome.storage.sync && chrome.storage.local) {
            chrome.storage.local.get(['colorProfile'], function (loc) {
              if (loc && loc.colorProfile) { chrome.storage.sync.set({ colorProfile: loc.colorProfile }); applyProfileValue(loc.colorProfile); }
              else applyProfileValue(null);
            });
          } else applyProfileValue(null);
        });
      } catch (e) {}
    }
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(function (changes, area) {
          if ((area === 'sync' || area === 'local') && changes.colorProfile) applyProfileValue(changes.colorProfile.newValue);
        });
      }
    } catch (e) {}
    // Zones/legenda komen uit de beheerbare config (APP_CONFIG.zoneProfiles + palette).
    function _hmToDec(s) { const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/); return m ? (+m[1] + (+m[2]) / 60) : null; }
    function _paletteFill(name) { const p = (APP_CONFIG.palette || {})[name]; return (p && p.fill) ? p.fill : COLOR_ROOD; }
    function _paletteLegend(name) { const p = (APP_CONFIG.palette || {})[name]; return (p && p.legend) ? p.legend : 'rgba(120,120,120,0.4)'; }
    function configProfileZones(key) {
      const prof = (APP_CONFIG.zoneProfiles || {})[key];
      if (!Array.isArray(prof)) return null;
      const out = prof.map((z) => ({ from: _hmToDec(z.start), to: _hmToDec(z.end), color: _paletteFill(z.color), label: z.zone }))
        .filter((z) => z.from != null && z.to != null);
      return out.length ? out : null;
    }
    function configProfileLegend(key) {
      const prof = (APP_CONFIG.zoneProfiles || {})[key];
      if (!Array.isArray(prof)) return null;
      const seen = new Map();
      for (const z of prof) { if (!seen.has(z.color)) seen.set(z.color, new Set()); seen.get(z.color).add(z.zone); }
      return [...seen.entries()].map(([c, names]) => ({ color: _paletteLegend(c), text: [...names].join(' / ') }));
    }
    function profileExists(key) { return !!(key && APP_CONFIG.zoneProfiles && APP_CONFIG.zoneProfiles[key]); }
    function activeZones() { return (currentProfile && configProfileZones(currentProfile)) || configProfileZones('JGGZ') || ZONES_JGGZ; }
    function activeLegend() { return (currentProfile && configProfileLegend(currentProfile)) || configProfileLegend('JGGZ') || LEGEND_JGGZ; }
    // Werkdag-venster voor de legenda: vroegste start t/m laatste eind uit de actieve zones.
    function workdayWindowLabel() {
      const z = activeZones(); if (!z || !z.length) return '08:00–17:00';
      const hm = (d) => { const h = Math.floor(d), m = Math.round((d - h) * 60); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };
      return hm(Math.min.apply(null, z.map((x) => x.from))) + '–' + hm(Math.max.apply(null, z.map((x) => x.to)));
    }
    // Ververs de inkleuring wanneer de config verandert (config.json/beleid).
    onHelperConfigChanged = function () { try { sync(); if (active) schedule(); if (agPopup) agRenderMain(); } catch (e) {} };
    let agPopup = null, agCollapsed = false, agInfoOpen = false;
    let agDragging = false, agDX = 0, agDY = 0, agUserPos = null;
    // Handtekening van de laatst getekende totalen; voorkomt onnodig herbouwen
    // (en dus geflikker/verspringende hover) als er niets veranderde.
    let _totalsSig = null;

    // ===== Classificatie: cliënttijd vs overig =====
    // Een echte CLIËNTAFSPRAKEN heeft in de agenda-tegel zowel een '.name'
    // (cliëntnaam, bv. "Co Test") als een '.title' (uursoort, bv. "Huisbezoek -
    // Co"). Niet-cliëntgebonden afspraken (Acquisitie, Overig, verlof, pauze…)
    // hebben alleen een '.name' en géén '.title'. Zo hangt de classificatie NIET
    // af van de (soms afwijkende) titeltekst.
    const SKIP_RE = /vaste vrije dag|vrije dag/;
    // Cliënt-uursoorten (labels) — extra vangnet.
    const CLIENT_LABEL_RE = /huisbezoek|telefonisch|face ?(to|2) ?face|\bmdo\b|verslaglegging|zorgco|no ?show|behandel|consult|gesprek/i;
    function _hasText(el) { return !!(el && (el.textContent || '').trim()); }
    function isClientAppointment(occ) {
      // De titel-occurrence bevat de content (.name + .title).
      const main = occ.querySelector(ONS.occurrenceTitle) || occ;
      // 1) primair: zowel cliëntnaam (.name) als uursoort (.title) aanwezig.
      if (_hasText(main.querySelector('.name')) && _hasText(main.querySelector('.title'))) return true;
      // 2) oude UI: aparte appointment-title (bv. "Huisbezoek - Tinus").
      const at = occ.querySelector(ONS.appointmentTitle);
      if (_hasText(at)) return true;
      // 3) vangnet: een label met een cliënt-uursoort (bv. "JG Huisbezoek"),
      //    maar niet "JG Overig".
      let labels; try { labels = occ.querySelectorAll(ONS.labelWithTitle); } catch (e) { labels = []; }
      for (const l of labels) {
        const t = l.getAttribute('title') || '';
        if (/\boverig\b/i.test(t)) continue;
        if (CLIENT_LABEL_RE.test(t)) return true;
      }
      return false;
    }
    // Nette naam van een afspraak (voor de 'nog te registreren'-lijst).
    function occurrenceName(occ) {
      const at = occ.querySelector(ONS.appointmentTitle);
      if (_hasText(at)) return at.textContent.trim();
      const tt = occ.querySelector('.title');
      if (_hasText(tt)) return tt.textContent.trim();
      const nm = occ.querySelector('.name');
      if (_hasText(nm)) return nm.textContent.trim();
      return '(zonder titel)';
    }
    // Retourneert 'client' | 'overig' | 'skip'.
    function classifyOccurrence(occ) {
      const tt = occ.querySelector('.title');
      const txt = ((tt && tt.textContent) || '').toLowerCase();
      if (SKIP_RE.test(txt)) return 'skip';
      return isClientAppointment(occ) ? 'client' : 'overig';
    }
    // Een afspraak is geregistreerd als de titel-occurrence de klasse 'declared'
    // heeft (en niet 'not-declared'). De reistijd-subblokjes dragen altijd
    // 'not-declared' en zijn dus geen betrouwbaar signaal — kijk naar de titel.
    function isDeclared(occ) {
      const main = occ.querySelector(ONS.occurrenceTitle) || occ;
      const cl = ' ' + (main.className || '') + ' ';
      if (ONS.notDeclaredRe.test(cl)) return false;
      return ONS.declaredRe.test(cl);
    }
    // Ongeregistreerde tijd per dag: som van de duur van nog niet geregistreerde
    // afspraken (pauze/vrije dag tellen niet mee). Onbekende types apart.
    // Ligt de afspraak (volledig) in het verleden t.o.v. NU? Op basis van datum
    // + begintijd + duur; telt zodra de afspraak is afgelopen.
    function occurrenceIsPast(occ, date) {
      const time = occ.getAttribute('data-time') || '00:00';
      const dur = parseInt(occ.getAttribute('data-duration'), 10) || 0;
      const start = new Date(date + 'T' + (/^\d{2}:\d{2}$/.test(time) ? time : '00:00') + ':00');
      if (isNaN(start)) return false;
      return (start.getTime() + dur * 60000) <= Date.now();
    }
    // Afgelopen én meer dan N uur geleden -> "te laat geregistreerd" (N uit config).
    function occurrenceOverdue24h(occ, date) {
      const time = occ.getAttribute('data-time') || '00:00';
      const dur = parseInt(occ.getAttribute('data-duration'), 10) || 0;
      const start = new Date(date + 'T' + (/^\d{2}:\d{2}$/.test(time) ? time : '00:00') + ':00');
      if (isNaN(start)) return false;
      const lateH = (APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.lateThresholdHours > 0) ? APP_CONFIG.generalSettings.lateThresholdHours : 24;
      return (start.getTime() + dur * 60000) <= (Date.now() - lateH * 60 * 60 * 1000);
    }
    function isoWeek(dateStr) {
      const date = new Date(dateStr + 'T00:00:00');
      if (isNaN(date)) return null;
      const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNr = (target.getUTCDay() + 6) % 7;
      target.setUTCDate(target.getUTCDate() - dayNr + 3);
      const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
      const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
      firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
      return 1 + Math.round((target - firstThursday) / (7 * 86400000));
    }
    // Splitst de zichtbare week op 'nu': verleden (ongeregistreerd, per dag) en
    // toekomst (aankomende afspraken, totaal). Elk met direct/indirect/overig.
    function isWontDeclare(occ) {
      return !!(occ.querySelector('.wont-declare') || (occ.className || '').indexOf('wont-declare') !== -1);
    }
    function computeTotals() {
      const past = {};
      const future = { client: 0, overig: 0 };
      let futureDate = null;
      let occs;
      try { occs = document.querySelectorAll(ONS.occurrenceBase); }
      catch (e) { return { past: past, future: future, futureWeek: null }; }
      const seen = new Set();
      occs.forEach((occ) => {
        if (occ.getAttribute('data-type') !== 'event') return;
        const date = occ.getAttribute('data-date'); if (!date) return;
        const id = occ.getAttribute('data-id'); // dubbele weergaven (grid/lijst) niet dubbel tellen
        if (id) { if (seen.has(id)) return; seen.add(id); }
        if (isWontDeclare(occ)) return; // hoeft nooit geregistreerd
        const cls = classifyOccurrence(occ);
        if (cls === 'skip') return; // vrije dag
        const dur = parseInt(occ.getAttribute('data-duration'), 10) || 0;
        if (occurrenceIsPast(occ, date)) {
          if (isDeclared(occ)) return; // verleden: alleen ongeregistreerd
          if (!past[date]) past[date] = { client: 0, overig: 0, lateMin: 0, lateCount: 0 };
          past[date][cls] += dur;
          // Te laat: meer dan 24 uur na afloop nog niet geregistreerd.
          if (occurrenceOverdue24h(occ, date)) { past[date].lateMin += dur; past[date].lateCount++; }
        } else {
          future[cls] += dur; // toekomst: alle aankomende afspraken
          if (!futureDate || date < futureDate) futureDate = date;
        }
      });
      return { past: past, future: future, futureWeek: futureDate ? isoWeek(futureDate) : null };
    }
    // 'declared' vs 'not-declared' uit het classes-veld van de API-afspraak.
    function _isDeclaredClasses(classes) {
      var c = ' ' + String(classes || '') + ' ';
      if (/not-declared/.test(c)) return false;
      return /declared/.test(c);
    }
    // API-variant van computeTotals: gebruikt de opgehaalde week-afspraken (_agLastEntries)
    // i.p.v. een DOM-scan. Regel: een afspraak in het VERLEDEN (afgelopen) die nog NIET
    // 'declared' is en waaraan een cliënt en/of uursoort hangt, is ongeregistreerde tijd
    // (planning = realisatie -> we gebruiken de geplande duur). Geen weekenden.
    function computeTotalsApi() {
      var past = {}, future = { client: 0, overig: 0 }, futureDate = null;
      var now = Date.now();
      var entries = _agLastEntries || [];
      var lateH = (APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.lateThresholdHours > 0) ? APP_CONFIG.generalSettings.lateThresholdHours : 24;
      entries.forEach(function (e) {
        if (!e || e.type !== 'event' || e.allDay) return;
        var date = e.date; if (!date) return;
        if (_excludeWeekendYmd(date)) return; // geen weekenden (tenzij ingesteld)
        var hasClient = !!e.clientPresent;
        var hasUursoort = !!(e.hourType && String(e.hourType).trim());
        if (!hasClient && !hasUursoort) return; // geen cliënt én geen uursoort -> pauze/vrije dag e.d.
        var dur = _entryMinutes(e); if (!(dur > 0)) return;
        var startMs = (e.startMs != null) ? e.startMs : Date.parse(date + 'T00:00:00');
        var endMs = (e.endMs != null) ? e.endMs : (startMs + dur * 60000);
        var cls = hasClient ? 'client' : 'overig';
        if (endMs <= now) {
          if (_isDeclaredClasses(e.classes)) return; // al geregistreerd
          if (!past[date]) past[date] = { client: 0, overig: 0, lateMin: 0, lateCount: 0 };
          past[date][cls] += dur;
          if (endMs <= now - lateH * 3600000) { past[date].lateMin += dur; past[date].lateCount++; }
        } else {
          future[cls] += dur;
          if (!futureDate || date < futureDate) futureDate = date;
        }
      });
      return { past: past, future: future, futureWeek: futureDate ? isoWeek(futureDate) : null };
    }
    // Nog niet afgeronde (niet-declared) registraties in de huidige weergave.
    function listUnfinished() {
      const out = [];
      let occs;
      try { occs = document.querySelectorAll(ONS.occurrenceBase); }
      catch (e) { return out; }
      const seen = new Set();
      occs.forEach((occ) => {
        if (occ.getAttribute('data-type') !== 'event') return;
        const date = occ.getAttribute('data-date'); if (!date) return;
        const id = occ.getAttribute('data-id');
        if (id) { if (seen.has(id)) return; seen.add(id); }
        if (isWontDeclare(occ)) return;
        if (classifyOccurrence(occ) === 'skip') return;
        if (isDeclared(occ)) return; // al afgerond
        // Cliënt-check: eerst de API (is er een cliënt gekoppeld?), anders het label.
        var apiClient = apiClientPresentById(id);
        var isClient = (apiClient != null) ? apiClient : isClientAppointment(occ);
        out.push({ name: occurrenceName(occ), time: occ.getAttribute('data-time') || '', client: isClient, el: occ });
      });
      out.sort((a, b) => a.time.localeCompare(b.time));
      return out;
    }
    // Opent de afspraak (klik op de occurrence → ONS opent het detail/registratie).
    function openOccurrence(occ) {
      if (!occ) return;
      try { occ.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) {}
      const target = occ.querySelector(ONS.occurrenceTitle) || occ;
      try { target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
      try { target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
      try { target.click(); } catch (e) {}
    }
    const _WD = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
    const _MON = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    function fmtHM(min) { const h = Math.floor(min / 60), m = min % 60; return h + ':' + (m < 10 ? '0' : '') + m; }
    function dayLabel(date) { const d = new Date(date + 'T00:00:00'); if (isNaN(d)) return date; return _WD[d.getDay()] + ' ' + d.getDate() + ' ' + _MON[d.getMonth()]; }

    // (#5) Aanpasvenster: ONS geeft "presence_log_deadline_date":"YYYY-MM-DD HH:MM"
    // mee = de OUDSTE datum die je nog mag aanpassen (60 dagen terug, vanaf 17:00).
    // Dit is dus geen naderende deadline maar de ONDERGRENS van het venster: alles
    // vóór deze datum is vergrendeld, alles er net na verloopt binnenkort.
    function editableWindowStart() {
      let raw = _presenceDeadlineOverride || '';
      if (!raw) {
        let scripts;
        try { scripts = document.querySelectorAll('script'); } catch (e) { return null; }
        for (const s of scripts) {
          const t = s.textContent || '';
          if (t.indexOf('presence_log_deadline_date') === -1) continue;
          const m = t.match(/"presence_log_deadline_date"\s*:\s*"([^"]+)"/);
          if (m && m[1]) { raw = m[1]; break; }
        }
      }
      const dm = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!dm) return null;
      // Alleen de datum telt voor "vergrendeld/verloopt" (tijd is 17:00-detail).
      return new Date(+dm[1], +dm[2] - 1, +dm[3]);
    }
    // Status van een (ongeregistreerde) dag t.o.v. het aanpasvenster.
    //   'locked' -> vóór de ondergrens: kan niet meer aangepast/geregistreerd
    //   'soon'   -> binnen 7 dagen ná de ondergrens: verloopt binnenkort
    //   null     -> ruim binnen het venster
    function windowStatusForDate(dateStr, windowStart) {
      if (!windowStart) return null;
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d)) return null;
      const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diff = Math.round((dd.getTime() - windowStart.getTime()) / 86400000);
      if (diff < 0) return 'locked';
      if (diff <= 7) return 'soon';
      return null;
    }

    function ensureStyle() {
      if (document.getElementById('ons-helper-offhours-style')) return;
      const st = document.createElement('style');
      st.id = 'ons-helper-offhours-style';
      st.textContent =
        '.' + CLASS + '{position:absolute;left:0;right:0;background:rgba(120,120,120,0.14);' +
        'pointer-events:none;z-index:0;}';
      (document.head || document.documentElement).appendChild(st);
    }

    function dayColumns() {
      // shadow-DOM-bewust niet nodig hier; gewone querySelectorAll volstaat op /invitees
      return Array.from(document.querySelectorAll(ONS.dayColumn));
    }

    function ensureSeg(col, seg) {
      let el = col.querySelector(':scope > .' + CLASS + '[data-seg="' + seg + '"]');
      if (!el) {
        el = document.createElement('div');
        el.className = CLASS; el.setAttribute('data-seg', seg);
        col.appendChild(el);
      }
      return el;
    }
    function clearColumn(col) {
      try { col.querySelectorAll(':scope > .' + CLASS).forEach((el) => el.remove()); } catch (e) {}
    }
    // De grijstint van de buiten-werktijd-banden (subtiel/semi-transparant zodat
    // de gridlijnen doorschijnen en het niet vlak/blokkerig oogt).
    const OFFHOURS_COLOR = 'rgba(120,120,120,0.10)';
    function isWeekendColumn(col) {
      // za/zo: nooit inkleuren. Herken via de td-klasse of de datum.
      const td = col.closest && col.closest(ONS.dayColumnCell);
      if (td && ONS.weekendClassRe.test(td.className)) return true;
      const date = col.getAttribute('data-date');
      if (date) {
        const d = new Date(date + 'T00:00:00');
        if (!isNaN(d)) { const wd = d.getDay(); if (wd === 0 || wd === 6) return true; }
      }
      return false;
    }
    function paintColumn(col) {
      // Vrije/grijze dag of weekend (za/zo): geen kleuren tonen.
      if (dayColumnLooksFree(col) || isWeekendColumn(col)) { clearColumn(col); return; }
      const h = col.clientHeight || col.getBoundingClientRect().height;
      if (!h || h < 100) return; // nog niet gerenderd
      const pxPerHour = h / 24;  // de dag-kolom beslaat 24 uur

      const pos = getComputedStyle(col).position;
      if (pos === 'static') col.style.position = 'relative';

      // Geen grijs buiten werktijd: verwijder eventuele oude grijs-banden.
      col.querySelectorAll(':scope > .' + CLASS + '[data-seg="top"], :scope > .' + CLASS + '[data-seg="bottom"]').forEach((el) => el.remove());

      // Gekleurde zones binnen werktijd
      const zones = activeZones();
      zones.forEach(function (z, i) {
        const el = ensureSeg(col, 'zone' + i);
        el.style.background = z.color;
        el.style.top = Math.round(z.from * pxPerHour) + 'px';
        el.style.height = Math.max(0, Math.round((z.to - z.from) * pxPerHour)) + 'px';
      });
      // Oude zones van een vorig profiel (met meer blokken) opruimen.
      col.querySelectorAll(':scope > .' + CLASS + '[data-seg^="zone"]').forEach(function (el) {
        const idx = parseInt((el.getAttribute('data-seg') || '').replace('zone', ''), 10);
        if (!isNaN(idx) && idx >= zones.length) el.remove();
      });
    }

    function paintAll() {
      rafPending = false;
      if (!active) return;
      if (!greyEnabled) { removeAll(); return; }
      if (!currentProfile) { removeAll(); return; } // eerst een profiel kiezen
      ensureStyle();
      const cols = dayColumns();
      for (const col of cols) {
        try { paintColumn(col); } catch (e) {}
      }
    }

    function schedule() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(paintAll);
    }

    function removeAll() {
      document.querySelectorAll('.' + CLASS).forEach((el) => el.remove());
    }

    function agSvgIcon(d) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '18'); svg.setAttribute('height', '18'); svg.setAttribute('aria-hidden', 'true');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('fill', 'currentColor'); p.setAttribute('d', d); svg.appendChild(p); return svg;
    }
    function agSetChevron(btn) {
      btn.textContent = '';
      btn.appendChild(agSvgIcon(agCollapsed ? 'M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z' : 'M7.4 15.4 12 10.8l4.6 4.6L18 14l-6-6-6 6z'));
    }
    function agBody() { return agPopup && agPopup.querySelector('[data-ag-body]'); }
    function agSetCollapsed(c) {
      agCollapsed = c;
      const body = agBody();
      const totals = agPopup && agPopup.querySelector('[data-ag-totals]');
      const week = agPopup && agPopup.querySelector('[data-ag-week]');
      const chev = agPopup && agPopup.querySelector('[data-ag-collapse]');
      if (body) body.style.display = c ? 'none' : 'block';
      // Inklappen verbergt de HELE inhoud: tekst, per-dag-totalen én het weekoverzicht.
      if (totals) totals.style.display = c ? 'none' : 'block';
      if (week) week.style.display = c ? 'none' : 'block';
      if (chev) { agSetChevron(chev); chev.setAttribute('aria-label', c ? 'Agendahulp uitklappen' : 'Agendahulp inklappen'); }
      // Bij uitklappen alles geforceerd opnieuw tekenen (stond tijdens inklappen stil).
      if (!c) { _totalsSig = null; updateTotals(); safe(refreshAgendaWeekApi); }
    }
    function agBodyEl() { return agBody(); }
    function agRenderMain() {
      const body = agBody(); if (!body) return;
      body.innerHTML = '';
      const T = ONSAH_TOKENS;
      let text, tone;
      if (!greyEnabled) { text = 'Gekleurde dagindeling staat uit.'; tone = 'off'; }
      else if (!currentProfile) { text = 'Kies eerst een indeling via het extensie-icoontje in de browser.'; tone = 'warn'; }
      else { text = 'Gekleurde dagindeling staat aan (' + ((PROFILES[currentProfile] && PROFILES[currentProfile].label) || currentProfile) + ').'; tone = 'ok'; }
      const card = document.createElement('div');
      const bg = tone === 'ok' ? T.okWash : (tone === 'warn' ? '#fff4d6' : T.lineSoft);
      const fg = tone === 'ok' ? T.ok : (tone === 'warn' ? '#8a5a00' : T.inkSoft);
      Object.assign(card.style, { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '9px 10px', borderRadius: '10px', background: bg, color: fg, fontSize: '12.5px', lineHeight: '1.4', fontWeight: '600' });
      const icon = tone === 'ok' ? svgSpineCheck() : svgInfoIcon();
      icon.setAttribute('width', '13'); icon.setAttribute('height', '13');
      Object.assign(icon.style, { width: '13px', height: '13px', flex: '0 0 auto', marginTop: '1px' });
      card.appendChild(icon);
      const lbl = document.createElement('span'); lbl.textContent = text;
      card.appendChild(lbl);
      body.appendChild(card);
    }
    function agRenderInfo() {
      const body = agBody(); if (!body) return;
      body.innerHTML = '';
      const T = ONSAH_TOKENS;
      const back = document.createElement('button');
      back.type = 'button';
      Object.assign(back.style, { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', border: '1px solid ' + T.brand, background: '#fff', color: T.brand, fontWeight: '600', fontSize: '13px', width: '100%', marginBottom: '10px', boxSizing: 'border-box', transition: 'transform .12s ease, box-shadow .12s ease' });
      back.appendChild(agSvgIcon('M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20z'));
      back.appendChild(document.createTextNode('Terug'));
      back.addEventListener('mouseenter', function () { back.style.transform = 'translateY(-1px)'; back.style.boxShadow = '0 4px 12px -6px rgba(32,20,15,.25)'; });
      back.addEventListener('mouseleave', function () { back.style.transform = 'none'; back.style.boxShadow = 'none'; });
      back.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); agInfoOpen = false; agRenderMain(); });
      onsahFocusRing(back);
      body.appendChild(back);
      const txt = document.createElement('div');
      txt.textContent = 'Gebruik de Agendahulp voor een duidelijk agenda-overzicht.';
      Object.assign(txt.style, { fontSize: '12.5px', color: T.inkSoft, lineHeight: '1.4', margin: '2px 0 10px' });
      body.appendChild(txt);
      // Legenda — venster volgt automatisch de zone-profielen (vroegste start t/m laatste eind).
      const legTitle = document.createElement('div');
      legTitle.textContent = 'Legenda (' + workdayWindowLabel() + ')';
      Object.assign(legTitle.style, { fontSize: '11px', fontWeight: '700', color: T.brand, textTransform: 'uppercase', letterSpacing: '.03em', margin: '0 0 6px' });
      body.appendChild(legTitle);
      const legendWrap = document.createElement('div');
      Object.assign(legendWrap.style, { display: 'flex', flexDirection: 'column', gap: '5px' });
      activeLegend().forEach(function (item) {
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px' });
        const sw = document.createElement('span');
        Object.assign(sw.style, { width: '12px', height: '12px', borderRadius: '4px', background: item.color, border: '1px solid rgba(0,0,0,.12)', flex: '0 0 auto' });
        const swLbl = document.createElement('span');
        swLbl.textContent = item.text;
        Object.assign(swLbl.style, { fontSize: '12px', color: T.ink, lineHeight: '1.3' });
        row.appendChild(sw); row.appendChild(swLbl);
        legendWrap.appendChild(row);
      });
      body.appendChild(legendWrap);
      const ver = document.createElement('div');
      ver.textContent = 'Versie ' + VERSION;
      Object.assign(ver.style, { fontSize: '11px', color: T.inkSoft, marginTop: '10px', paddingTop: '8px', borderTop: '1px solid ' + T.line });
      body.appendChild(ver);
    }
    // Huidige invitee-id uit de URL (of uit een dag-kolom).
    function currentInviteeId(date) {
      const m = location.href.match(/\/invitees\/(\d+)\/calendar/);
      if (m) return m[1];
      const col = document.querySelector(ONS.dayColumn + (date ? '[data-date="' + date + '"]' : ''));
      return col ? col.getAttribute('data-invitee-id') : null;
    }
    function calendarUrl(view, date, inviteeId) {
      return location.origin + '/invitees/' + inviteeId + '/calendar/' + view + '?date=' + date;
    }
    function currentCalendarView() {
      const m = location.href.match(/\/calendar\/(\w+)/);
      return m ? m[1] : '';
    }
    // Navigeert via een echte <a>-klik zodat ONS' eigen SPA-router het kan
    // afvangen (client-side, snel) i.p.v. een volledige paginaherlaad.
    function spaNavigate(url) {
      try {
        const a = document.createElement('a');
        a.href = url;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) { location.href = url; }
    }
    // Navigeert naar de dag-weergave van die datum voor de huidige invitee.
    function jumpToDay(date) {
      if (currentCalendarView() === 'day') return; // al in dagweergave: niets doen
      const id = currentInviteeId(date);
      if (!id) return;
      spaNavigate(calendarUrl('day', date, id));
    }
    // Navigeert naar de werkweek-weergave (van de eerste zichtbare dag, of vandaag).
    function jumpToWeek() {
      const firstCol = document.querySelector(ONS.dayColumn + '[data-date]');
      const date = (firstCol && firstCol.getAttribute('data-date')) || new Date().toISOString().slice(0, 10);
      const id = currentInviteeId(date);
      if (!id) return;
      spaNavigate(calendarUrl('workweek', date, id));
    }
    // Badge op het extensie-icoon: aantal openstaande verleden-dagen.
    let _lastBadge = -1;
    function pushBadge(count) {
      if (count === _lastBadge) return;
      _lastBadge = count;
      try { chrome.runtime.sendMessage({ type: 'badge', count: count }); } catch (e) {}
    }
    function sectionTitle(text) {
      const el = document.createElement('div');
      el.textContent = text;
      Object.assign(el.style, { fontSize: '11px', fontWeight: '700', color: ONSAH_TOKENS.brand, textTransform: 'uppercase', letterSpacing: '.03em', margin: '0 0 6px', borderTop: '1px solid ' + ONSAH_TOKENS.line, paddingTop: '9px' });
      return el;
    }
    // Kleine gekleurde 'pill' met label + waarde.
    function pill(label, value, bg, fg) {
      const s = document.createElement('span');
      Object.assign(s.style, { display: 'inline-block', background: bg, color: fg, borderRadius: '10px', padding: '1px 8px', margin: '0 4px 4px 0', fontSize: '11px', fontWeight: '600', fontVariantNumeric: 'tabular-nums' });
      s.textContent = label + ' ' + value;
      return s;
    }
    function statLine(client, overig) {
      const T = ONSAH_TOKENS;
      const wrap = document.createElement('div');
      Object.assign(wrap.style, { margin: '2px 0 2px' });
      wrap.appendChild(pill('Cliënt', fmtHM(client), T.okWash, T.ok));
      wrap.appendChild(pill('Overig', fmtHM(overig), T.lineSoft, T.inkSoft));
      wrap.appendChild(pill('Totaal', fmtHM(client + overig), T.brandWash, T.brand));
      return wrap;
    }
    function updateTotals(res) {
      if (!agPopup || agCollapsed) return;
      const cont = agPopup.querySelector('[data-ag-totals]');
      if (!cont) return;
      // Voorkeur: de API-afspraken (planning = realisatie). Zolang die nog niet geladen
      // zijn, tijdelijk de DOM-scan als terugval, zodat er geen leeg gat valt.
      res = res || ((_agLastEntries && _agLastEntries.length) ? computeTotalsApi() : computeTotals());
      const past = res.past;
      const pastDates = Object.keys(past).filter(function (d) { return (past[d].client + past[d].overig) > 0; }).sort();
      pushBadge(pastDates.length);

      const view = currentCalendarView();
      const inDayView = view === 'day';

      // Alleen opnieuw tekenen als de inhoud daadwerkelijk veranderde. Zo blijft
      // de hover-highlight staan en oogt het paneel rustig (voorheen werd alles
      // ~3×/sec via innerHTML gesloopt en herbouwd).
      const unfinishedSig = inDayView
        ? listUnfinished().map(function (i) { return i.time + '|' + i.name + '|' + (i.client ? 'c' : 'o'); }).join(',')
        : '';
      const windowStart = editableWindowStart();
      const wsKey = windowStart ? windowStart.getTime() : 0;
      const sig = JSON.stringify({ v: view, past: past, future: res.future, week: res.futureWeek, u: unfinishedSig, ws: wsKey });
      if (sig === _totalsSig) return;
      _totalsSig = sig;
      cont.innerHTML = '';

      // Compacte tag (te laat / venster) — neemt weinig ruimte in.
      function miniTag(text, fg, bg, bd) {
        const s = document.createElement('span');
        s.textContent = text;
        Object.assign(s.style, { display: 'inline-block', fontSize: '10px', fontWeight: '700', color: fg, background: bg, border: '1px solid ' + bd, borderRadius: '8px', padding: '0 6px', marginLeft: '6px', verticalAlign: 'middle' });
        return s;
      }

      const T = ONSAH_TOKENS;
      // Herbruikbare lift-hover (zelfde taal als de tegels elders): optillen +
      // zachte schaduw i.p.v. alleen een kleurwissel.
      function liftOnHover(card) {
        card.addEventListener('mouseenter', function () { card.style.transform = 'translateY(-1px)'; card.style.boxShadow = '0 4px 12px -6px rgba(32,20,15,.22)'; });
        card.addEventListener('mouseleave', function () { card.style.transform = 'none'; card.style.boxShadow = 'none'; });
      }

      // Knop naar de weekweergave — alleen buiten de (werk)week-weergave.
      if (view !== 'workweek' && view !== 'week') {
        const weekBtn = document.createElement('button');
        weekBtn.type = 'button';
        weekBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;width:100%;box-sizing:border-box;margin:4px 0 10px;padding:8px 10px;border-radius:10px;cursor:pointer;border:1px solid ' + T.brand + ';background:#fff;color:' + T.brand + ';font-weight:700;font-size:12px;transition:transform .12s ease, box-shadow .12s ease';
        weekBtn.textContent = 'Naar weekweergave';
        liftOnHover(weekBtn);
        weekBtn.addEventListener('click', function () { jumpToWeek(); });
        onsahFocusRing(weekBtn);
        cont.appendChild(weekBtn);
      }

      // ===== Sectie 1: verleden (ongeregistreerd) — APART inklapbaar, standaard ingeklapt. =====
      if (pastDates.length) {
        var UNREG_KEY = 'onsHelper.unregCollapsed';
        // Standaard ingeklapt: alleen 'open' als de gebruiker dat eerder koos.
        var unregCollapsed = storageGet(UNREG_KEY, '1') !== '0';
        var secHead = document.createElement('div');
        Object.assign(secHead.style, { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: T.brand, textTransform: 'uppercase', letterSpacing: '.03em', margin: '0 0 6px', borderTop: '1px solid ' + T.line, paddingTop: '9px', userSelect: 'none' });
        var chev = svgIcon('M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z');
        chev.setAttribute('width', '11'); chev.setAttribute('height', '11');
        chev.style.cssText = 'width:11px;height:11px;flex:0 0 auto;transition:transform .15s ease;transform:' + (unregCollapsed ? 'none' : 'rotate(90deg)');
        var secLbl = document.createElement('span'); secLbl.textContent = 'Ongeregistreerde tijd per dag';
        secLbl.style.flex = '1 1 auto';
        secHead.append(chev, secLbl);
        var secBody = document.createElement('div');
        secBody.style.display = unregCollapsed ? 'none' : 'flex';
        secBody.style.flexDirection = 'column';
        secBody.style.gap = '6px';
        secHead.addEventListener('click', function () {
          unregCollapsed = !unregCollapsed;
          secBody.style.display = unregCollapsed ? 'none' : 'flex';
          chev.style.transform = unregCollapsed ? 'none' : 'rotate(90deg)';
          storageSet(UNREG_KEY, unregCollapsed ? '1' : '0');
        });
        cont.appendChild(secHead);
        cont.appendChild(secBody);
        pastDates.forEach(function (date) {
          const t = past[date];
          const card = document.createElement('div');
          card.style.cssText = 'padding:7px 9px;border-radius:10px;background:#fff;border:1px solid ' + (inDayView ? T.line : T.brand) + ';cursor:' + (inDayView ? 'default' : 'pointer') + ';box-sizing:border-box;transition:transform .12s ease, box-shadow .12s ease';
          if (!inDayView) {
            card.title = 'Klik om naar deze dag te gaan';
            liftOnHover(card);
            card.addEventListener('click', function () { jumpToDay(date); });
          }
          const d = document.createElement('div');
          d.textContent = dayLabel(date);
          Object.assign(d.style, { fontSize: '12px', fontWeight: '700', color: T.ink, marginBottom: '3px' });
          // Compacte markeringen: te laat (>24u) en aanpasvenster-status.
          if (t.lateCount > 0) d.appendChild(miniTag('te laat: ' + t.lateCount, T.bad, T.badWash, '#f0b0b0'));
          const ws = windowStatusForDate(date, windowStart);
          if (ws === 'locked') d.appendChild(miniTag('vergrendeld', T.bad, T.badWash, '#f0b0b0'));
          else if (ws === 'soon') d.appendChild(miniTag('verloopt binnenkort', '#8a5a00', '#fff6e0', '#f0d08a'));
          card.appendChild(d);
          card.appendChild(statLine(t.client, t.overig));
          secBody.appendChild(card);
        });
      }

      // ===== Sectie 2: het weekoverzicht komt uit de API (aparte [data-ag-week]-
      // container, gevuld door refreshAgendaWeekApi) — niet meer uit de DOM-scan,
      // zodat de cijfers consistent zijn. =====

      // ===== Sectie 3: in dagweergave — nog te registreren (klikbaar). =====
      if (inDayView) {
        const items = listUnfinished();
        cont.appendChild(sectionTitle('Nog te registreren' + (items.length ? ' (' + items.length + ')' : '')));
        if (!items.length) {
          const none = document.createElement('div');
          none.style.cssText = 'display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:10px;background:' + T.okWash + ';color:' + T.ok + ';font-size:12.5px;font-weight:700';
          const okIcon = svgSpineCheck();
          okIcon.setAttribute('width', '13'); okIcon.setAttribute('height', '13');
          okIcon.style.cssText = 'width:13px;height:13px;flex:0 0 auto';
          none.append(okIcon, document.createTextNode('Alles geregistreerd'));
          cont.appendChild(none);
        } else {
          const list = document.createElement('div');
          list.style.cssText = 'display:flex;flex-direction:column;gap:6px';
          items.forEach(function (it) {
            const card = document.createElement('div');
            card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:10px;background:#fff;border:1px solid ' + (it.client ? T.brand : T.line) + ';cursor:pointer;box-sizing:border-box;transition:transform .12s ease, box-shadow .12s ease';
            card.title = 'Klik om de afspraak te openen';
            liftOnHover(card);
            card.addEventListener('click', function () { openOccurrence(it.el); });
            const time = document.createElement('span');
            time.textContent = it.time || '--:--';
            Object.assign(time.style, { fontSize: '12px', fontWeight: '800', color: T.brand, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' });
            card.appendChild(time);
            const name = document.createElement('span');
            name.textContent = it.name;
            Object.assign(name.style, { fontSize: '12px', color: T.ink, flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
            card.appendChild(name);
            const tag = document.createElement('span');
            tag.textContent = it.client ? 'cliënt' : 'overig';
            Object.assign(tag.style, { fontSize: '10px', fontWeight: '700', color: it.client ? T.ok : T.inkSoft, background: it.client ? T.okWash : T.lineSoft, borderRadius: '8px', padding: '1px 7px', flex: '0 0 auto' });
            card.appendChild(tag);
            list.appendChild(card);
          });
          cont.appendChild(list);
        }
      }
    }
    // Vult de [data-ag-week]-container met het API-weekoverzicht. Dedupliceert op
    // (invitee, datum, weergave): haalt alleen opnieuw op bij een echte wijziging, dus
    // veilig om elke tik aan te roepen. In dagweergave beperkt tot de huidige dag.
    var _agWeekKey = null, _agWeekBusy = false, _agWeekLoaded = false;
    var _agLastEntries = []; // laatst opgehaalde week-entries (voor cliënt-check "nog te registreren")
    // Zoekt in de laatst opgehaalde API-entries of bij een DOM-afspraak (data-id) een
    // cliënt gekoppeld is. Geeft true/false, of null als de afspraak niet gevonden is.
    function apiClientPresentById(id) {
      if (id == null || !_agLastEntries.length) return null;
      var key = String(id);
      for (var i = 0; i < _agLastEntries.length; i++) {
        if (String(_agLastEntries[i].id) === key) return !!_agLastEntries[i].clientPresent;
      }
      return null;
    }
    function refreshAgendaWeekApi() {
      if (!agPopup || agCollapsed) return;
      const cont = agPopup.querySelector('[data-ag-week]');
      if (!cont) return;
      const id = currentInviteeId();
      const view = currentCalendarView();
      const date = currentAgendaDate();
      if (!id) { cont.innerHTML = ''; _agWeekKey = null; _agWeekLoaded = false; return; }
      const key = id + '|' + date + '|' + view;
      if (key === _agWeekKey && _agWeekLoaded) return;   // niets veranderd
      if (_agWeekBusy && key === _agWeekKey) return;      // al bezig met deze
      _agWeekBusy = true; _agWeekKey = key;
      if (cont.getAttribute('data-key') !== key) cont.textContent = 'Overzicht laden…';
      var prof = (typeof ACTIVE_PROFILE !== 'undefined') ? ACTIVE_PROFILE : null;
      var renderPanel = function (summary, extraOpts) {
        cont.innerHTML = '';
        var o = { week: agendaWeekNumber(date), embedded: true, scope: (view === 'day' ? 'dag' : 'week'), profile: prof, date: date };
        if (extraOpts) { for (var k in extraOpts) if (Object.prototype.hasOwnProperty.call(extraOpts, k)) o[k] = extraOpts[k]; }
        cont.appendChild(agendaWeekPanelEl(summary, o));
        cont.setAttribute('data-key', key);
        _agWeekLoaded = true;
      };
      var errHandler = function (e) {
        if (_agWeekKey !== key) return;
        cont.innerHTML = '';
        const err = document.createElement('div');
        err.style.cssText = 'color:#b3261e;font-weight:600;font-size:12px';
        err.textContent = 'Overzicht kon niet laden: ' + ((e && e.message) || 'fout');
        cont.appendChild(err);
        _agWeekLoaded = false;
      };
      if (!_agIsFutureWeek(date)) {
        // DEZE WEEK of VERLEDEN: toon de ECHT geschreven tijd per uursoort (direct/indirect/
        // reistijd) uit de registratie-details — inclusief registraties die begin van de week
        // al zijn gedaan. De afspraken halen we óók op, zodat 'Ongeregistreerde tijd per dag'
        // blijft werken. (Alleen volledig toekomstige weken tonen de planning per afspraaktype.)
        fetchInviteeWeek(id, date).then(function (entries) { if (_agWeekKey === key) _agLastEntries = (entries || []).slice(); }, function () {}).then(function () { if (_agWeekKey === key) safe(updateTotals); });
        fetchWeekRegistrationDeclarabiliteit(id, date).then(function (summary) {
          if (_agWeekKey !== key) return;
          renderPanel(summary, { perLabel: 'Per uursoort', headerHint: 'geregistreerd', scope: 'week', unknownLabel: 'Overig' });
        }).catch(errHandler).then(function () { _agWeekBusy = false; });
      } else {
        // HUIDIGE/TOEKOMSTIGE week: planning per afspraaktype, alleen aankomende afspraken.
        fetchInviteeWeek(id, date).then(function (entries) {
          if (_agWeekKey !== key) return; // ondertussen genavigeerd
          _agLastEntries = entries.slice(); // hele week bewaren voor de cliënt-check
          if (view === 'day') entries = entries.filter(function (e) { return e.date === date; });
          var now = Date.now();
          entries = entries.filter(function (e) { return e.startMs == null || e.startMs >= now; });
          renderPanel(summarizeAgendaWeek(entries));
        }).catch(errHandler).then(function () { _agWeekBusy = false; });
      }
    }
    function buildAgPopup() {
      if (agPopup) return;
      ensureOnsAhBaseStyles();
      agPopup = document.createElement('div');
      Object.assign(agPopup.style, { position: 'fixed', zIndex: '2147483646', width: '272px', right: '24px', bottom: '24px', top: 'auto', left: 'auto', maxHeight: 'calc(100vh - 48px)', background: '#fff', color: '#201d1f', border: '1px solid #ece7e5', borderRadius: '16px', boxShadow: '0 14px 40px rgba(32,20,15,.24)', font: '14px/1.4 system-ui, sans-serif', overflow: 'hidden', display: 'flex', flexDirection: 'row', alignItems: 'stretch' });
      const agSpine = document.createElement('div');
      Object.assign(agSpine.style, { width: '16px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', cursor: 'move', userSelect: 'none' });
      const agSpineChip = document.createElement('span');
      Object.assign(agSpineChip.style, { width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: '0 0 auto' });
      agSpine.appendChild(agSpineChip);
      agSpine.addEventListener('mousedown', function (e) {
        if (e.target.closest && e.target.closest('[data-popup-control]')) return;
        agDragging = true; const r = agPopup.getBoundingClientRect(); agDX = e.clientX - r.left; agDY = e.clientY - r.top; e.preventDefault();
      });
      const agMainCol = document.createElement('div');
      Object.assign(agMainCol.style, { flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' });
      const header = document.createElement('div');
      Object.assign(header.style, { display: 'flex', alignItems: 'center', background: '#fff', color: '#201d1f', padding: '11px 12px', fontWeight: '700', userSelect: 'none', cursor: 'move', borderBottom: '1px solid #f1ecea' });
      const title = document.createElement('span');
      title.textContent = 'Agendahulp';
      Object.assign(title.style, { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
      header.appendChild(title);
      const controls = document.createElement('div');
      Object.assign(controls.style, { display: 'inline-flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', marginLeft: '8px' });
      const onoff = document.createElement('button');
      onoff.type = 'button';
      onoff.setAttribute('data-popup-control', '');
      Object.assign(onoff.style, { position: 'relative', background: 'transparent', border: '0', borderRadius: '999px', color: '#fff', cursor: 'pointer', lineHeight: '1', padding: '0', width: '58px', height: '24px', fontWeight: '700', overflow: 'hidden', flex: '0 0 auto', fontFamily: 'inherit' });
      const swTrack = document.createElement('span');
      Object.assign(swTrack.style, { position: 'absolute', inset: '0', borderRadius: '999px', border: '1px solid rgba(255,255,255,.45)', transition: 'background .16s ease, box-shadow .16s ease, opacity .16s ease' });
      const swText = document.createElement('span');
      Object.assign(swText.style, { position: 'absolute', top: '0', bottom: '0', display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: '700', color: '#fff', opacity: '.95', transition: 'left .16s ease, right .16s ease', pointerEvents: 'none' });
      const swKnob = document.createElement('span');
      Object.assign(swKnob.style, { position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.22)', transition: 'left .16s ease' });
      onoff.appendChild(swTrack); onoff.appendChild(swText); onoff.appendChild(swKnob);
      const updOnoff = function () {
        swText.textContent = greyEnabled ? 'Aan' : 'Uit';
        swTrack.style.background = greyEnabled ? '#1b7f3b' : '#a3241f';
        swTrack.style.boxShadow = greyEnabled ? 'inset 0 0 0 1px rgba(255,255,255,.12)' : 'inset 0 0 0 1px rgba(255,255,255,.10)';
        swTrack.style.opacity = greyEnabled ? '1' : '.82';
        swKnob.style.left = greyEnabled ? '37px' : '3px';
        swText.style.left = greyEnabled ? '9px' : '27px';
        swText.style.right = greyEnabled ? '25px' : '7px';
        onoff.setAttribute('aria-label', greyEnabled ? 'Agendahulp uitschakelen' : 'Agendahulp inschakelen');
        onoff.setAttribute('aria-pressed', greyEnabled ? 'true' : 'false');
        onoff.title = greyEnabled ? 'Aan' : 'Uit';
        agSpine.style.background = greyEnabled ? '#cc087d' : '#9a9296';
        agSpineChip.innerHTML = '';
        agSpineChip.appendChild(greyEnabled ? svgSpineCheck() : svgSpinePause());
      };
      updOnoff();
      onoff.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); greyEnabled = !greyEnabled; storageSet(STORE_GREY_ENABLED, greyEnabled ? '1' : '0'); updOnoff(); schedule(); if (!agInfoOpen) agRenderMain(); });
      onsahFocusRing(onoff);
      const info = document.createElement('button');
      info.type = 'button';
      info.setAttribute('data-popup-control', '');
      info.appendChild(svgInfoIcon());
      Object.assign(info.style, { background: '#f6f2f0', border: '1px solid #ece7e5', borderRadius: '8px', color: '#6b6367', cursor: 'pointer', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });
      info.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (agCollapsed) agSetCollapsed(false); agInfoOpen = !agInfoOpen; if (agInfoOpen) agRenderInfo(); else agRenderMain(); });
      onsahFocusRing(info);
      const chev = document.createElement('button');
      chev.type = 'button';
      chev.setAttribute('data-ag-collapse', '');
      chev.setAttribute('data-popup-control', '');
      Object.assign(chev.style, { background: '#f6f2f0', border: '1px solid #ece7e5', borderRadius: '8px', color: '#6b6367', cursor: 'pointer', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });
      agSetChevron(chev);
      chev.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); agSetCollapsed(!agCollapsed); });
      onsahFocusRing(chev);
      controls.appendChild(onoff); controls.appendChild(info); controls.appendChild(chev);
      header.appendChild(controls);
      header.addEventListener('mousedown', function (e) {
        if (e.target.closest && e.target.closest('[data-popup-control]')) return;
        agDragging = true; const r = agPopup.getBoundingClientRect(); agDX = e.clientX - r.left; agDY = e.clientY - r.top; e.preventDefault();
      });
      agMainCol.appendChild(header);
      const body = document.createElement('div');
      body.setAttribute('data-ag-body', '');
      Object.assign(body.style, { padding: '12px' });
      agMainCol.appendChild(body);
      // Aparte container voor de per-dag tijdstotalen (wordt niet gewist door agRenderMain).
      const totals = document.createElement('div');
      totals.setAttribute('data-ag-totals', '');
      Object.assign(totals.style, { padding: '0 12px 12px' });
      agMainCol.appendChild(totals);
      // Weekoverzicht uit de API (cliënttijd, directe/indirecte/reistijd, per type, 80%).
      const weekBox = document.createElement('div');
      weekBox.setAttribute('data-ag-week', '');
      Object.assign(weekBox.style, { padding: '0 12px 12px' });
      agMainCol.appendChild(weekBox);
      agPopup.appendChild(agSpine);
      agPopup.appendChild(agMainCol);
      document.body.appendChild(agPopup);
      // Standaard rechtsonder in beeld (via CSS right/bottom); alleen als de
      // gebruiker het paneel zelf heeft versleept, gebruiken we die positie.
      if (agUserPos) { const p = agClamp(agUserPos.left, agUserPos.top); agPopup.style.left = p.left + 'px'; agPopup.style.top = p.top + 'px'; agPopup.style.right = 'auto'; agPopup.style.bottom = 'auto'; }
      agRenderMain();
      agSetCollapsed(agCollapsed);
      safe(refreshAgendaWeekApi); // meteen het weekoverzicht laden
    }
    function removeAgPopup() { if (agPopup) { agPopup.remove(); agPopup = null; } _totalsSig = null; }
    function agClamp(left, top) {
      const w = (agPopup && agPopup.offsetWidth) || 260;
      const h = (agPopup && agPopup.offsetHeight) || 120;
      const maxLeft = Math.max(8, window.innerWidth - w - 8);
      const maxTop = Math.max(8, window.innerHeight - h - 8);
      return { left: Math.min(Math.max(8, left), maxLeft), top: Math.min(Math.max(8, top), maxTop) };
    }
    window.addEventListener('mousemove', function (e) {
      if (!agDragging || !agPopup) return;
      const p = agClamp(e.clientX - agDX, e.clientY - agDY);
      agUserPos = p;
      agPopup.style.left = p.left + 'px'; agPopup.style.top = p.top + 'px';
      agPopup.style.right = 'auto'; agPopup.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', function () { agDragging = false; });

    function activate() {

      if (active) return;
      active = true;
      // Terug op de agenda: een onthouden (afgeronde/vorige) registratievorm vergeten,
      // zodat een volgende nieuwe registratie schoon begint.
      try { clearPendingRegistration(); } catch (e) {}
      buildAgPopup();
      loadProfileFromStorage();
      schedule();
      observer = new MutationObserver((muts) => {
        // negeer onze eigen overlay-mutaties
        const own = muts.every((m) => {
          const t = m.target;
          return t && t.classList && t.classList.contains(CLASS);
        });
        if (!own) schedule();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      window.addEventListener('resize', schedule);
      // De MutationObserver hierboven vangt vrijwel alle wijzigingen op; een
      // rustige 250ms-fallback dekt gevallen die geen DOM-mutatie geven
      // (bijv. layout-only). 20×/sec verven is niet nodig.
      if (!pollTimer) pollTimer = setInterval(function () { if (document.hasFocus()) schedule(); }, 250);
      // Elke 300 ms de ongeregistreerde tijd per dag herberekenen (+ badge,
      // ook als de popup is ingeklapt).
      if (!totalsTimer) totalsTimer = setInterval(function () {
        if (!document.hasFocus()) return; // niets doen als het tabblad niet actief is
        try {
          // Eén berekening per tik (voorheen werd computeTotals dubbel gedraaid:
          // hier én binnen updateTotals). Badge + totalen delen nu dezelfde uitkomst.
          const res = computeTotals();
          const cnt = Object.keys(res.past).filter((d) => (res.past[d].client + res.past[d].overig) > 0).length;
          pushBadge(cnt);
          updateTotals(res);
          refreshAgendaWeekApi(); // API-weekoverzicht (dedupe: haalt alleen bij wijziging)
        } catch (e) {}
      }, 300);
    }

    function deactivate() {
      if (!active) return;
      active = false;
      if (observer) { observer.disconnect(); observer = null; }
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (totalsTimer) { clearInterval(totalsTimer); totalsTimer = null; }
      pushBadge(0); // badge wissen zodra we de agenda verlaten
      window.removeEventListener('resize', schedule);
      removeAll();
      removeAgPopup();
    }

    function helperScreenActive() {
      // Afspraak-/registratiehulp draait op deze routes.
      return location.href.includes(CONFIG.urlNeedle) || location.href.includes(CONFIG.registrationNeedle);
    }
    function sync() {
      if (APP_CONFIG.features && APP_CONFIG.features.dayColoring === false) deactivate();
      else if (location.href.includes(NEEDLE) && !helperScreenActive()) activate();
      else deactivate();
    }
    // Stel de parent-hook in zodat activate(mode) van de hoofdhelper ons kan sluiten.
    agendaHelperDeactivate = deactivate;

    window.addEventListener('locationchange', sync);
    window.addEventListener('popstate', sync);
    // history is hierboven al gepatcht voor locationchange; sync direct
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', sync);
    } else {
      sync();
    }
    // Test-hook: agenda-logica blootstellen (alleen onder testvlag).
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
  })();

  // Kwaliteits- en zelfdiagnosemeldingen naar het altijd-zichtbare
  // meldingenkanaal tillen. Draait als kleine module op het framework; wist de
  // melding zodra er niets te melden is of de hulp uit staat.
  try {
    if (window.OnsAgendahulp && window.OnsAgendahulp.register && window.OnsAgendahulp.ModuleBase) {
      window.OnsAgendahulp.register(window.OnsAgendahulp.ModuleBase.create(
        { id: 'kwaliteit', urls: ['https://*.onsagenda.nl/*', 'https://*.ons-dossier.nl/*'] },
        { run: function (ctx, main, api) {
            if (!api) return;
            let issues = [];
            try { if (helperEnabled) issues = helperQualityIssues(); } catch (e) { issues = []; }
            if (!issues.length) { api.clearMessage(); return; }
            const errs = issues.filter((i) => i.sev === 'error').length;
            // Gestructureerde melding (tekst, geen HTML): het meldingenkanaal
            // rendert dit veilig met textContent.
            api.setMessage({
              title: errs ? 'Controleer voor opslaan' : 'Aandachtspunt',
              items: issues.map((i) => ({ text: i.msg, sev: i.sev })),
            });
          } }
      ));
    }
  } catch (e) {}

  // Test-hook: buitenste-scope-logica blootstellen (alleen onder testvlag).
  __exposeForTest({
    registrationCompletenessIssues: (typeof registrationCompletenessIssues === 'function') ? registrationCompletenessIssues : undefined,
    activeRegistrationClientForms: (typeof activeRegistrationClientForms === 'function') ? activeRegistrationClientForms : undefined,
    registrationClientFormIsRemoved: (typeof registrationClientFormIsRemoved === 'function') ? registrationClientFormIsRemoved : undefined,
    getRegistrationClientNumber: (typeof getRegistrationClientNumber === 'function') ? getRegistrationClientNumber : undefined,
    helperQualityIssues: (typeof helperQualityIssues === 'function') ? helperQualityIssues : undefined,
    appointmentMissingHooks: (typeof appointmentMissingHooks === 'function') ? appointmentMissingHooks : undefined,
    closeOnsModal: (typeof closeOnsModal === 'function') ? closeOnsModal : undefined,
    _regToMin: (typeof _regToMin === 'function') ? _regToMin : undefined,
    _regCareFlags: (typeof _regCareFlags === 'function') ? _regCareFlags : undefined,
    allKnownLabels: (typeof allKnownLabels === 'function') ? allKnownLabels : undefined,
    choiceLabels: (typeof choiceLabels === 'function') ? choiceLabels : undefined,
    setLabelsExclusive: (typeof setLabelsExclusive === 'function') ? setLabelsExclusive : undefined,
    entryUursoortIsSet: (typeof entryUursoortIsSet === 'function') ? entryUursoortIsSet : undefined,
    matchRegistrationChoiceByLabel: (typeof matchRegistrationChoiceByLabel === 'function') ? matchRegistrationChoiceByLabel : undefined,
    loadPendingRegistrationLabel: (typeof loadPendingRegistrationLabel === 'function') ? loadPendingRegistrationLabel : undefined,
    __setPendingRegistration: function (o) { try { if (o == null) sessionStorage.removeItem(PENDING_REG_KEY); else sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify(o)); } catch (e) {} },
    __setCurrentRegistrationId: function (v) { try { _regIdOverride = (v == null ? null : String(v)); } catch (e) {} },
    clearPendingRegistration: (typeof clearPendingRegistration === 'function') ? clearPendingRegistration : undefined,
    getRegistrationRestoreState: function () { try { return { fromAppointment: registrationFromAppointment, autoApplied: registrationAutoApplied, restoredToReport: registrationRestoredToReport, activeChoiceLabel: (activeRegistrationChoice && activeRegistrationChoice.label) || null, autoChoiceLabel: (registrationAutoChoice && registrationAutoChoice.label) || null, pending: (function () { try { return sessionStorage.getItem(PENDING_REG_KEY); } catch (e) { return null; } })() }; } catch (e) { return null; } },
    persistRegistrationTimes: (typeof persistRegistrationTimes === 'function') ? persistRegistrationTimes : undefined,
    restoreRegistrationExtras: (typeof restoreRegistrationExtras === 'function') ? restoreRegistrationExtras : undefined,
    registrationRestoreHolding: (typeof registrationRestoreHolding === 'function') ? registrationRestoreHolding : undefined,
    registrationPageSettled: (typeof registrationPageSettled === 'function') ? registrationPageSettled : undefined,
    __setRegistrationHoldStart: function (t) { try { registrationRestoreHoldStart = t; } catch (e) {} },
    helperNeedsTeamChoice: (typeof helperNeedsTeamChoice === 'function') ? helperNeedsTeamChoice : undefined,
    __setActiveProfile: function (p) { try { ACTIVE_PROFILE = p || null; } catch (e) {} },
    applyHelperConfig: (typeof applyHelperConfig === 'function') ? applyHelperConfig : undefined,
    effectiveChoices: (typeof effectiveChoices === 'function') ? effectiveChoices : undefined,
    effectiveRegistrationForms: (typeof effectiveRegistrationForms === 'function') ? effectiveRegistrationForms : undefined,
    nonClientCategoriesActive: (typeof nonClientCategoriesActive === 'function') ? nonClientCategoriesActive : undefined,
    mapAgendaWeekResponse: (typeof mapAgendaWeekResponse === 'function') ? mapAgendaWeekResponse : undefined,
    mapAgendaEntry: (typeof mapAgendaEntry === 'function') ? mapAgendaEntry : undefined,
    parseInviteeIdFromPath: (typeof parseInviteeIdFromPath === 'function') ? parseInviteeIdFromPath : undefined,
    agendaYmd: (typeof agendaYmd === 'function') ? agendaYmd : undefined,
    resolveInviteeId: (typeof resolveInviteeId === 'function') ? resolveInviteeId : undefined,
    fetchInviteeWeek: (typeof fetchInviteeWeek === 'function') ? fetchInviteeWeek : undefined,
    summarizeAgendaWeek: (typeof summarizeAgendaWeek === 'function') ? summarizeAgendaWeek : undefined,
    agendaEntryType: (typeof agendaEntryType === 'function') ? agendaEntryType : undefined,
    labelToAfspraaktype: (typeof labelToAfspraaktype === 'function') ? labelToAfspraaktype : undefined,
    agendaWeekPanelEl: (typeof agendaWeekPanelEl === 'function') ? agendaWeekPanelEl : undefined,
    _agFmtMin: (typeof _agFmtMin === 'function') ? _agFmtMin : undefined,
    parseStartVerdeling: (typeof parseStartVerdeling === 'function') ? parseStartVerdeling : undefined,
    entryToVorm: (typeof entryToVorm === 'function') ? entryToVorm : undefined,
    computeDirectIndirect: (typeof computeDirectIndirect === 'function') ? computeDirectIndirect : undefined,
    currentAgendaDate: (typeof currentAgendaDate === 'function') ? currentAgendaDate : undefined,
    agendaWeekNumber: (typeof agendaWeekNumber === 'function') ? agendaWeekNumber : undefined,
    normalizeRegistrationLine: (typeof normalizeRegistrationLine === 'function') ? normalizeRegistrationLine : undefined,
    summarizeRegistrations: (typeof summarizeRegistrations === 'function') ? summarizeRegistrations : undefined,
    parseWeekRegistrationOccurrences: (typeof parseWeekRegistrationOccurrences === 'function') ? parseWeekRegistrationOccurrences : undefined,
    parseRegistrationDetails: (typeof parseRegistrationDetails === 'function') ? parseRegistrationDetails : undefined,
    summarizeWeekRegistrations: (typeof summarizeWeekRegistrations === 'function') ? summarizeWeekRegistrations : undefined,
    _agIsPastWeek: (typeof _agIsPastWeek === 'function') ? _agIsPastWeek : undefined,
    declarabiliteitPct: (typeof declarabiliteitPct === 'function') ? declarabiliteitPct : undefined,
    declarabiliteitBase: (typeof declarabiliteitBase === 'function') ? declarabiliteitBase : undefined,
    _apiUrl: (typeof _apiUrl === 'function') ? _apiUrl : undefined,
    _isClientUursoortName: (typeof _isClientUursoortName === 'function') ? _isClientUursoortName : undefined,
    isRegistrationEditOrNew: (typeof isRegistrationEditOrNew === 'function') ? isRegistrationEditOrNew : undefined,
    isRegistrationOverviewPage: (typeof isRegistrationOverviewPage === 'function') ? isRegistrationOverviewPage : undefined,
    agendaRegistrationsSectionEl: (typeof agendaRegistrationsSectionEl === 'function') ? agendaRegistrationsSectionEl : undefined,
    __setInviteeIdOverride: function (v) { try { _inviteeIdOverride = (v == null ? null : v); } catch (e) {} },
    getUiOverride: function (k) { try { return UI_OVERRIDES[k]; } catch (e) { return undefined; } },
    getEndTimeInput: (typeof getEndTimeInput === 'function') ? getEndTimeInput : undefined,
    getStartTimeInput: (typeof getStartTimeInput === 'function') ? getStartTimeInput : undefined,
    enforceAppointmentEndTime: (typeof enforceAppointmentEndTime === 'function') ? enforceAppointmentEndTime : undefined,
    applyAppointmentDuration: (typeof applyAppointmentDuration === 'function') ? applyAppointmentDuration : undefined,
    appointmentReadyToSave: (typeof appointmentReadyToSave === 'function') ? appointmentReadyToSave : undefined,
    appointmentCoreApplied: (typeof appointmentCoreApplied === 'function') ? appointmentCoreApplied : undefined,
    appointmentSaveStageStillValid: (typeof appointmentSaveStageStillValid === 'function') ? appointmentSaveStageStillValid : undefined,
    collectClientUursoortOptionTexts: (typeof collectClientUursoortOptionTexts === 'function') ? collectClientUursoortOptionTexts : undefined,
    parseProductList: (typeof parseProductList === 'function') ? parseProductList : undefined,
    pickClientIdFromSearch: (typeof pickClientIdFromSearch === 'function') ? pickClientIdFromSearch : undefined,
    clearSettings: (typeof clearSettings === 'function') ? clearSettings : undefined,
    getUursoortQueueState: function () { try { return { active: uursoortQueueActive, gen: uursoortQueueGen, flowBusy: appointmentFlowBusy }; } catch (e) { return null; } },
    __setUursoortQueueActive: function (v) { try { uursoortQueueActive = !!v; } catch (e) {} },
    __setActiveNonClientOption: function (o) { try { activeNonClientOption = o || null; } catch (e) {} },
    appointmentEndGuardState: function () { try { return { helperEndText: helperEndText, userOwned: appointmentEndTimeUserOwned }; } catch (e) { return null; } },
    resetAppointmentEndGuard: function () { try { helperEndText = ''; appointmentEndTimeUserOwned = false; } catch (e) {} },
    getAppConfig: function () { try { return APP_CONFIG; } catch (e) { return null; } },
    getDefaultConfig: function () { try { return DEFAULT_APP_CONFIG; } catch (e) { return null; } },
    getRegistrationChoices: function () { try { return REGISTRATION_CHOICES; } catch (e) { return null; } },
    resolveText: (typeof resolveText === 'function') ? resolveText : undefined,
    mkText: (typeof mkText === 'function') ? mkText : undefined,
    managedRichHtml: (typeof managedRichHtml === 'function') ? managedRichHtml : undefined,
    choicePrefix: (typeof choicePrefix === 'function') ? choicePrefix : undefined,
    // #2: DOM-detectiefuncties blootstellen zodat de regressietests op de ECHTE
    // ONS-DOM (button.label-tag, uc-time-input, data-qa) kunnen controleren.
    labelChips: (typeof labelChips === 'function') ? labelChips : undefined,
    selectedAllLabelChipTexts: (typeof selectedAllLabelChipTexts === 'function') ? selectedAllLabelChipTexts : undefined,
    removeLabelChipsByText: (typeof removeLabelChipsByText === 'function') ? removeLabelChipsByText : undefined,
    selectedKnownLabels: (typeof selectedKnownLabels === 'function') ? selectedKnownLabels : undefined,
    getEtiketTrigger: (typeof getEtiketTrigger === 'function') ? getEtiketTrigger : undefined,
    firstByDataQa: (typeof firstByDataQa === 'function') ? firstByDataQa : undefined,
    hasAppointmentStartTime: (typeof hasAppointmentStartTime === 'function') ? hasAppointmentStartTime : undefined,
    hasAppointmentDate: (typeof hasAppointmentDate === 'function') ? hasAppointmentDate : undefined,
    // Doorplannen (herhaling): DOM-detectie blootstellen zodat de regressietests
    // op de ECHTE ONS-DOM (Herhaling-kop + recurrence-type) kunnen controleren.
    findRecurrenceHeader: (typeof findRecurrenceHeader === 'function') ? findRecurrenceHeader : undefined,
    findRecurrenceField: (typeof findRecurrenceField === 'function') ? findRecurrenceField : undefined,
    recurrenceHeaderExpanded: (typeof recurrenceHeaderExpanded === 'function') ? recurrenceHeaderExpanded : undefined,
    recurrenceValue: (typeof recurrenceValue === 'function') ? recurrenceValue : undefined,
    recurrenceIsSet: (typeof recurrenceIsSet === 'function') ? recurrenceIsSet : undefined,
    doorplannenWarnText: (typeof doorplannenWarnText === 'function') ? doorplannenWarnText : undefined,
    doorplannenBlocksSave: (typeof doorplannenBlocksSave === 'function') ? doorplannenBlocksSave : undefined,
    __setDoorplannen: function (v) { try { appointmentDoorplannen = !!v; } catch (e) {} },
  });

})();
/* ============================================================================
   UI-inspector — toon ALLE DOM-hooks die de hulp nodig heeft (groen=gevonden,
   rood=ontbrekend) en wijs overschrijfbare hooks visueel opnieuw aan ("herstel").
   - Rendert in de TOP LAYER (Popover-API) zodat hij vóór ONS-modals staat.
   - Wordt ALLEEN geopend vanuit de extensiepopup (chrome.storage-vlag), niet
     als vaste knop op de pagina.
   - Wijzigt de rest van de extensie niet, behalve via de opgeslagen
     selector-overrides die de hoofdcode uitleest (onsHelper.uiOverrides).
   ========================================================================== */
(function onsUiInspector() {
  'use strict';
  try { if (window.top !== window.self) return; } catch (e) {}
  if (window.__onsUiInspectorLoaded) return;
  window.__onsUiInspectorLoaded = true;

  const OVERRIDE_KEY = 'onsHelper.uiOverrides';
  const OPEN_KEY = 'onsHelper.openInspector';
  const PERSIST_KEY = 'onsHelper.inspectorOpen'; // blijft open bij paginawissel tot 'Sluiten'
  function setPersist(v) { try { chrome.storage.local.set({ [PERSIST_KEY]: v }); } catch (e) {} }
  let overrides = {};
  try { if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.get([OVERRIDE_KEY], (r) => { overrides = (r && r[OVERRIDE_KEY]) || {}; }); } catch (e) {}

  function deepQueryAll(selector) {
    const out = [], seen = new Set();
    const walk = (root) => {
      if (!root || seen.has(root)) return; seen.add(root);
      try { out.push.apply(out, root.querySelectorAll(selector)); } catch (e) { return; }
      let all; try { all = root.querySelectorAll('*'); } catch (e) { return; }
      for (const el of all) if (el.shadowRoot) walk(el.shadowRoot);
    };
    walk(document);
    try { for (const fr of document.querySelectorAll('iframe,frame')) { try { if (fr.contentDocument) walk(fr.contentDocument); } catch (e) {} } } catch (e) {}
    return out;
  }

  // ---- heuristische matchers (spiegelen de zoeklogica van de extensie zelf,
  //      zodat óók velden zonder vast selector-attribuut worden gehighlight) ----
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function vis(el) { try { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; } catch (e) { return false; } }
  function inOwnUi(el) { return !!(root && root.contains(el)); }
  // Bedieningselement dat vlak ONDER een tekstlabel met exact deze tekst staat.
  function controlsUnderLabel(labelTexts, controlSel) {
    const want = (Array.isArray(labelTexts) ? labelTexts : [labelTexts]).map(norm);
    const out = [], seen = new Set();
    deepQueryAll('label,div,span,p').forEach((lb) => {
      if (inOwnUi(lb) || !vis(lb) || want.indexOf(norm(lb.textContent)) < 0) return;
      let lr; try { lr = lb.getBoundingClientRect(); } catch (e) { return; }
      deepQueryAll(controlSel).forEach((c) => {
        if (inOwnUi(c) || seen.has(c) || !vis(c)) return;
        let cr; try { cr = c.getBoundingClientRect(); } catch (e) { return; }
        if (cr.top >= lr.bottom - 14 && cr.top <= lr.bottom + 100 && Math.abs(cr.left - lr.left) <= 140) { seen.add(c); out.push(c); }
      });
    });
    return out;
  }
  // Element met een placeholder/aria-label/tekst die op een patroon matcht.
  function controlsByHint(re, sel) {
    return deepQueryAll(sel).filter((el) => {
      if (inOwnUi(el) || !vis(el)) return false;
      const hay = [el.getAttribute && el.getAttribute('placeholder'), el.getAttribute && el.getAttribute('aria-label'), el.getAttribute && el.getAttribute('title'), el.textContent].map(norm).join(' ');
      return re.test(hay);
    });
  }
  const CTRL = 'uc-select,uc-multi-select,ue-activity-select,[role="combobox"],input,select,[class*="select" i]';
  // Het LOCATIE-veld lijkt op labels/uursoort maar mag die nooit voorstellen.
  function isLocationCtrl(el) {
    try {
      const dq = el.getAttribute && el.getAttribute('data-qa'); if (dq && /location|locatie/i.test(dq)) return true;
      const al = (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('aria-description'))) || '';
      if (/locatie|location/i.test(al)) return true;
      if (/zoek naar locaties/.test(norm(el.textContent))) return true;
    } catch (e) {}
    return false;
  }
  // Bediening met een exacte zichtbare placeholder-/displaytekst — zó vindt de
  // extensie zelf het labels-/uursoortveld (findByVisibleText), niet op afstand.
  function controlsByText(texts, sel, exclude) {
    const want = texts.map(norm);
    return deepQueryAll(sel).filter((el) => !inOwnUi(el) && vis(el) && !(exclude && exclude(el)) && want.some((w) => norm(el.textContent).indexOf(w) >= 0));
  }
  // Alleen het DICHTSTBIJZIJNDE bedieningselement onder het label (niet alles
  // binnen 100px — dat pakte ten onrechte het eronder liggende veld erbij).
  function nearestUnderLabel(labelTexts, sel, exclude) {
    const all = controlsUnderLabel(labelTexts, sel).filter((el) => !(exclude && exclude(el)));
    all.sort((a, b) => { try { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; } catch (e) { return 0; } });
    return all.length ? [all[0]] : [];
  }
  const labelsMatcher = () => {
    const exact = controlsByText(['zoek naar labels', 'zoek naar etiketten'], CTRL, isLocationCtrl);
    if (exact.length) return exact;
    const near = nearestUnderLabel(['labels', 'label', 'etiket', 'etiketten'], CTRL, isLocationCtrl);
    if (near.length) return near;
    return controlsByHint(/label|etiket/, CTRL).filter((el) => !isLocationCtrl(el));
  };
  const uursoortMatcher = () => {
    const fixed = deepQueryAll('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], [data-qa="hour_type_select"], [role="combobox"][aria-label="Uursoort"]').filter((el) => vis(el) && !inOwnUi(el) && !isLocationCtrl(el));
    if (fixed.length) return fixed;
    const exact = controlsByText(['zoek naar uursoorten'], CTRL, isLocationCtrl);
    if (exact.length) return exact;
    const near = nearestUnderLabel(['uursoort', 'uursoorten', 'hour type'], CTRL, isLocationCtrl);
    return near.length ? near : controlsByHint(/uursoort|hour type/, CTRL).filter((el) => !isLocationCtrl(el));
  };
  // Cliëntnaam: alleen namen binnen de cliëntlijst — NIET medewerkers
  // (selected_employees). Zo strookt het met wat de extensie als cliënt behandelt.
  const clientNameMatcher = () => deepQueryAll('ul[data-qa="selected_clients"] [class*="_invitee-name_"], ul[class*="_selected-clients_"] [class*="_invitee-name_"]').filter((el) => vis(el) && !inOwnUi(el));
  // Toevoegen-KNOP: de <uc-button> met een add-icoon én tekst "Toevoegen" —
  // precies de knop die de extensie aanklikt (findAddClientButton), niet het
  // losse icoon. Als de modal open is alleen knoppen BINNEN de modal (niet de
  // agenda-plus erachter).
  const addButtonMatcher = () => {
    const cands = deepQueryAll('uc-button, button').filter((el) => {
      if (inOwnUi(el) || !vis(el)) return false;
      const hasAdd = (el.querySelector && el.querySelector('uc-icon[icon="add"], [icon="add"]')) ||
        (el.shadowRoot && el.shadowRoot.querySelector && el.shadowRoot.querySelector('uc-icon[icon="add"], [icon="add"]'));
      return /(^|[^a-z])toevoegen([^a-z]|$)/.test(norm(el.textContent)) || !!hasAdd;
    });
    // Voorkeur voor de knop met tekst "Toevoegen" (de echte genodigden-knop);
    // dat filtert ook het geneste shadow-<button> zonder eigen tekst weg.
    const withText = cands.filter((el) => /(^|[^a-z])toevoegen([^a-z]|$)/.test(norm(el.textContent)));
    let base = withText.length ? withText : cands;
    if (modalIsOpen()) {
      const modals = deepQueryAll('dialog[open], uc-modal, [role="dialog"]').filter((m) => vis(m) && !inOwnUi(m));
      base = base.filter((el) => modals.some((m) => { try { return m.contains(el); } catch (e) { return false; } }));
    }
    return base;
  };

  // Invoerveld direct onder een tekstlabel (spiegelt getStartTimeInput /
  // appointmentTravelInput in de extensie): voor begin-/eind-/reistijdvelden.
  function inputsUnderLabelText(labelTexts, sel) {
    const want = (Array.isArray(labelTexts) ? labelTexts : [labelTexts]).map(norm);
    const out = [], seen = new Set();
    deepQueryAll('label,div,span,p').forEach((lb) => {
      if (inOwnUi(lb) || !vis(lb) || want.indexOf(norm(lb.textContent)) < 0) return;
      let lr; try { lr = lb.getBoundingClientRect(); } catch (e) { return; }
      deepQueryAll(sel).forEach((c) => {
        if (inOwnUi(c) || seen.has(c) || !vis(c)) return;
        let cr; try { cr = c.getBoundingClientRect(); } catch (e) { return; }
        if (cr.top >= lr.bottom - 18 && cr.top <= lr.bottom + 120 && Math.abs(cr.left - lr.left) <= 240) { seen.add(c); out.push(c); }
      });
    });
    return out;
  }
  const beginTimeMatcher = () => { const h = deepQueryAll('uc-time-input[aria-label^="Begintijd" i]').filter((el) => vis(el) && !inOwnUi(el)); return h.length ? h : inputsUnderLabelText(['begintijd', 'begintijd*'], 'input[placeholder="uu:mm"]'); };
  const eindTimeMatcher = () => { const h = deepQueryAll('uc-time-input[aria-label^="Eindtijd" i]').filter((el) => vis(el) && !inOwnUi(el)); return h.length ? h : inputsUnderLabelText(['eindtijd', 'eindtijd*'], 'input[placeholder="uu:mm"]'); };
  const travelHeenMatcher = () => { const d = deepQueryAll('input[aria-label="Reistijd heen" i]').filter((el) => vis(el) && !inOwnUi(el)); return d.length ? d : inputsUnderLabelText(['reistijd heen'], 'input'); };
  const travelTerugMatcher = () => { const d = deepQueryAll('input[aria-label="Reistijd terug" i]').filter((el) => vis(el) && !inOwnUi(el)); return d.length ? d : inputsUnderLabelText(['reistijd terug'], 'input'); };
  // 'Herhaling'-accordeonkop (doorplannen): een uitklapknop met een titel-span
  // met de tekst "Herhaling" (hashed klassen zijn buildafhankelijk).
  const recurrenceHeaderMatcher = () => deepQueryAll('button[aria-expanded]').filter((b) => {
    if (inOwnUi(b) || !vis(b)) return false;
    let spans; try { spans = b.querySelectorAll('span'); } catch (e) { return false; }
    for (const s of spans) if (norm(s.textContent) === 'herhaling') return true;
    return false;
  });

  // [groep, label, selector|functie, (override-sleutel indien herstelbaar)]
  const HOOKS = [
    ['Agenda', 'Dagkolom', '.day.js_day', 'agDayColumn', 'rel'],
    ['Agenda', 'Dagkolom-cel', 'td.calendar_day', 'agDayCell', 'rel'],
    ['Agenda', 'Afspraak-blok', '.js_calendar_occurrence.calendar_occurrence_base', 'agOccurrence', 'rel'],
    ['Agenda', 'Afspraak met titel', '.calendar_occurrence--has-title', 'agOccurrenceTitle', 'rel'],
    ['Agenda', 'Afspraak-titel', '.appointment-title', 'agApptTitle', 'rel'],
    ['Agenda', 'Label met title-attr', '.labels .label[title]', 'agLabelTitle', 'rel'],
    ['Agenda', 'Status-vlag', '[data-status]'],
    ['Afspraak (modal)', 'Modal / dialog', 'uc-modal,[role="dialog"],dialog', 'modalPanelSelector'],
    ['Afspraak (modal)', 'Uursoort-veld', uursoortMatcher, 'uursoortFieldSelector'],
    ['Afspraak (modal)', 'Labels-veld', labelsMatcher, 'etiketFieldSelector'],
    ['Afspraak (modal)', 'Labels-chips (verwijderknoppen)', 'button[aria-label^="Verwijder label" i], [data-qa="label_tags"] button', 'afsLabelChips', 'rel'],
    ['Afspraak (modal)', 'Toevoegen-knop', addButtonMatcher],
    ['Afspraak (modal)', 'Cliëntlijst', 'ul[class*="_selected-clients_"] > li, ul[data-qa="selected_clients"] > li, [data-qa="selected_clients"]', 'afsClientList', 'rel'],
    ['Afspraak (modal)', 'Cliëntnaam', clientNameMatcher, 'afsClientName', 'rel'],
    ['Afspraak (modal)', 'Uitklap-cliëntvelden', '[data-qa="toggle-invitee-fields-button"]', 'afsInviteeToggle', 'rel'],
    ['Afspraak (modal)', 'Datumveld', 'uc-date-input[aria-label="Datum*"], uc-date-input[aria-label="Datum"]', 'afsDatum'],
    ['Afspraak (modal)', 'Begintijd', beginTimeMatcher, 'afsBegintijd'],
    ['Afspraak (modal)', 'Eindtijd', eindTimeMatcher, 'afsEindtijd'],
    ['Afspraak (modal)', 'Reistijd heen', travelHeenMatcher, 'afsTravelBefore'],
    ['Afspraak (modal)', 'Reistijd terug', travelTerugMatcher, 'afsTravelAfter'],
    ['Afspraak (modal)', 'Titelveld', 'input[aria-label*="Titel" i], input[name*="title" i]', 'afsTitel'],
    ['Afspraak (modal)', 'Sluitknop', 'uc-button[aria-label*="sluit" i], button[aria-label*="sluit" i]', 'afsCloseButton'],
    ['Afspraak (modal)', 'Opslaan/submit', 'button[type="submit"], uc-button[type="submit"]', 'afsOpslaan'],
    ['Afspraak (modal)', 'Herhaling-kop (doorplannen)', recurrenceHeaderMatcher, 'recurrenceHeader'],
    ['Afspraak (modal)', 'Herhaling-keuze (type)', '[data-qa="recurrence-type"]', 'recurrenceType'],
    ['Registratie', 'Cliënt-formulier', 'div.client_form[data-invitee-id]'],
    ['Registratie', 'Uursoort-veld', 'select[id*="hour_type"], [data-qa="hour_type_select"]'],
    ['Registratie', 'Verplichte rij', 'tr.required'],
    ['Registratie', 'Begintijd', '#declaration_start_time_display, input[name*="start_time" i]', 'regStart'],
    ['Registratie', 'Eindtijd', '#declaration_end_time_display, input[name*="end_time" i]', 'regEnd'],
    ['Registratie', 'Directe tijd', '#declaration_direct_time, input[name*="direct_time" i]:not([name*="indirect" i])', 'regDirect'],
    ['Registratie', 'Indirecte tijd', '#declaration_indirect_time, input[name*="indirect_time" i]', 'regIndirect'],
    ['Registratie', 'Reistijd heen', '#declaration_travel_time_before, input[name*="travel_time_before" i]', 'regTravelBefore'],
    ['Registratie', 'Reistijd terug', '#declaration_travel_time_after, input[name*="travel_time_after" i]', 'regTravelAfter'],
    ['Registratie', 'Reistijd toevoegen', '#js_add_travel_time', 'regTravelAdd'],
    ['Registratie', 'Rapportageveld', '[id$="__dossier_report_comment"], textarea[id*="report_comment" i], textarea[name*="report" i]', 'regReport'],
    ['Registratie', 'select2 wisknop', '.select2-selection__clear'],
    ['Vragenlijst', 'Survey-titel', '[data-survey-title], [data-react-component="SurveyResultHeader"][data-props]', 'surveyTitleSelector'],
    ['Vragenlijst', 'Vraag', '.survey_question, tr.required', 'surveyQuestionSelector', 'rel'],
    ['Vragenlijst', 'Leeftijd (cliënt) → {clientLeeftijd}', '[data-testid*="birthdate" i], [class*="birthdate" i], [datetime], [aria-label*="geboorte" i]', 'surveyAgeSelector'],
    ['Vragenlijst', 'Vraagtekst (alle vragen) → {vraag}', '.question-text', 'surveyQuestionTextSelector', 'rel'],
    ['Vragenlijst', 'Naam (cliënt) → {clientNaam}', '.base-card__name-tags, [data-testid="client-details-name"], [data-testid="client-name"], .client-name', 'surveyClientNameSelector'],
    ['Vragenlijst', 'Volgende status', 'button[title="Volgende status"], button[aria-label="Volgende status"]', 'surveyNextStatusSelector'],
  ];
  const C = { ok: '#1e8449', miss: '#c0392b', pick: '#cc087d' };
  let highlightsOn = true, onlyMissing = false, pickHook = null, root = null, panel = null, ov = null, refreshTimer = null, rowUpdaters = [];
  let moObserver = null, domDirty = true, lastFull = 0; // #7: performance-gating

  function css(el, s) { Object.assign(el.style, s); return el; }
  function overrideSel(h) { return (h[3] && overrides[h[3]]) ? overrides[h[3]] : null; }
  function matches(h) {
    const o = overrideSel(h);
    try {
      if (o) return deepQueryAll(o);
      if (typeof h[2] === 'function') return h[2]() || [];
      return deepQueryAll(h[2]);
    } catch (e) { return []; }
  }
  // Alleen echt zichtbare pagina-elementen tellen mee — zo komt het ✓/✗ in de
  // lijst overeen met wat daadwerkelijk op het scherm wordt gehighlight.
  function visEls(h) { return matches(h).filter((el) => !inOwnUi(el) && vis(el)); }
  // Treffers van de STANDAARD-selector (override genegeerd) — om te bepalen of
  // een override 'kapot' is (element bestaat wél, maar de override mist het).
  function defaultEls(h) {
    try {
      const r = (typeof h[2] === 'function') ? (h[2]() || []) : deepQueryAll(h[2]);
      return r.filter((el) => !inOwnUi(el) && vis(el));
    } catch (e) { return []; }
  }

  // ---- docked side panel: de HELE pagina wordt smaller gemaakt en de
  //      inspector staat ERNAAST (net als het vragenlijstpaneel), i.p.v.
  //      als overlay bovenop de modal. De transform op <html> zorgt dat óók
  //      de position:fixed ONS-modal binnen de versmalde breedte valt. ----
  const PW = 380;
  function setDock(on) {
    const de = document.documentElement;
    try {
      if (on) {
        de.style.setProperty('width', 'calc(100vw - ' + PW + 'px)', 'important');
        de.style.setProperty('min-width', '0', 'important');
        de.style.setProperty('max-width', 'calc(100vw - ' + PW + 'px)', 'important');
        de.style.setProperty('overflow-x', 'hidden', 'important');
        de.style.setProperty('transform', 'translateZ(0)', 'important');
        de.style.setProperty('transform-origin', 'top left', 'important');
      } else {
        ['width', 'min-width', 'max-width', 'overflow-x', 'transform', 'transform-origin'].forEach((p) => de.style.removeProperty(p));
      }
    } catch (e) {}
  }
  // Een échte modal (<dialog> geopend met showModal) maakt de rest van het
  // document 'inert' → dan zijn onze knoppen niet klikbaar/scrollbaar. Daarom
  // hangen we de inspector IN die dialog: binnen de dialog-subtree is niets
  // inert. Zonder modal hangt hij gewoon aan <body>.
  function hostFor() {
    try { const d = deepQueryAll('dialog[open]').filter((x) => vis(x)); if (d.length) return d[d.length - 1]; } catch (e) {}
    return document.body;
  }
  function modalIsOpen() {
    try { return deepQueryAll('dialog[open], uc-modal, [role="dialog"]').some((x) => vis(x) && !inOwnUi(x)); } catch (e) { return false; }
  }
  // Zorg dat root in de juiste host hangt (verplaatst mee als er een modal
  // opent/sluit) en klikbaar blijft.
  function reattachIfNeeded() {
    if (!root) return;
    const host = hostFor();
    if (root.parentNode !== host) {
      try { root.hidePopover(); } catch (e) {}
      host.appendChild(root);
      try { root.showPopover(); } catch (e) {}
    } else if (!root.isConnected) {
      document.body.appendChild(root);
      try { root.showPopover(); } catch (e) {}
    }
  }
  function ensureRoot() {
    if (root && root.isConnected) { setDock(true); reattachIfNeeded(); return; }
    setDock(true);
    root = document.createElement('div'); root.id = '__ons-ins-root';
    // Popover = top layer: staat gegarandeerd vóór de ONS-modal (die zelf een
    // <dialog>/top-layer element is). De strippositie klopt omdat panel en
    // highlights met vw/viewport-coördinaten worden geplaatst, niet relatief
    // aan de versmalde <html>. De versmalling (setDock) duwt tegelijk de
    // normale schermen (registratie/agenda) netjes naast het paneel.
    try { root.setAttribute('popover', 'manual'); } catch (e) {}
    css(root, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none', margin: '0', padding: '0', border: '0', background: 'transparent', overflow: 'visible', pointerEvents: 'none', zIndex: '2147483646' });
    ov = document.createElement('div'); ov.style.pointerEvents = 'none'; root.appendChild(ov);
    hostFor().appendChild(root);
    try { root.showPopover(); } catch (e) {} // top layer; anders z-index-terugval
  }
  function removeRoot() { setDock(false); if (root) { try { root.hidePopover(); } catch (e) {} root.remove(); root = null; ov = null; panel = null; } }

  function drawHighlights() {
    if (!ov) return; ov.innerHTML = '';
    if (!highlightsOn) return;
    const mOpen = modalIsOpen();
    HOOKS.forEach((h) => {
      // Als de afspraakmodal open is, de agenda-hooks (die eronder liggen) niet
      // meer highlighten — die horen bij het agendascherm, niet bij de modal.
      if (mOpen && h[0] === 'Agenda') return;
      const els = visEls(h).slice(0, 40);
      const over = !!overrideSel(h);
      els.forEach((el, idx) => {
        let r; try { r = el.getBoundingClientRect(); } catch (e) { return; }
        if (!r || (r.width === 0 && r.height === 0)) return;
        // #1: het EERSTE zichtbare element is wat de extensie gebruikt ("actief").
        // Overige treffers dimmen en met stippellijn, zodat duidelijk is dat die
        // niet de gekozen zijn.
        const primary = idx === 0;
        const col = over ? C.pick : C.ok;
        const b = document.createElement('div');
        css(b, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', border: (primary ? '2px solid ' : '2px dashed ') + col, borderRadius: '3px', background: primary ? 'rgba(30,132,73,.10)' : 'transparent', opacity: primary ? '1' : '.5', pointerEvents: 'none', boxSizing: 'border-box' });
        const t = document.createElement('div'); t.textContent = h[1] + (primary && els.length > 1 ? ' ★' : '');
        css(t, { position: 'absolute', top: '-15px', left: '0', font: '10px/1 system-ui', color: '#fff', background: col, padding: '1px 4px', borderRadius: '3px', whiteSpace: 'nowrap', opacity: primary ? '1' : '.7' });
        b.appendChild(t); ov.appendChild(b);
      });
    });
  }
  function flash(h) {
    const el = visEls(h)[0]; if (!el) { setStatus('Niet op dit scherm.'); return; }
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    setTimeout(() => { let r; try { r = el.getBoundingClientRect(); } catch (e) { return; }
      const f = document.createElement('div'); css(f, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', border: '3px solid ' + C.pick, borderRadius: '4px', pointerEvents: 'none', transition: 'opacity .8s', opacity: '1' });
      ov.appendChild(f); setTimeout(() => { f.style.opacity = '0'; }, 500); setTimeout(() => f.remove(), 1400); drawHighlights(); }, 260);
  }

  // Het werkelijke, diepste element onder de cursor — ook binnen shadow-roots.
  // Een listener op document krijgt e.target gehertarget naar de buitenste
  // shadow-host; composedPath()[0] piercet die grenzen wél.
  function pickTarget(e) {
    try { const p = e.composedPath && e.composedPath(); if (p && p.length && p[0] && p[0].nodeType === 1) return p[0]; } catch (ex) {}
    return e.target;
  }
  function buildSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return '#' + el.id;
    const tag = el.tagName.toLowerCase();
    // Unieke tag (bv. custom element als uc-person-name) → schone, shadow-
    // vindbare selector zonder broos descendant-pad.
    try { if (/-/.test(tag) && deepQueryAll(tag).length === 1) return tag; } catch (ex) {}
    for (const a of ['data-qa', 'aria-label', 'name', 'placeholder', 'icon', 'title']) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) { const s = tag + '[' + a + '="' + String(v).replace(/"/g, '\\"') + '"]'; if (deepQueryAll(s).length === 1) return s; }
    }
    const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/).filter((c) => /^[A-Za-z][\w-]*$/.test(c)) : [];
    if (cls.length) { const s = tag + '.' + cls.slice(0, 3).join('.'); if (deepQueryAll(s).length === 1) return s; }
    let node = el, parts = [];
    while (node && node.nodeType === 1 && parts.length < 4) {
      let s = node.tagName.toLowerCase(); const p = node.parentElement;
      if (p) { const sib = [...p.children].filter((c) => c.tagName === node.tagName); if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(node) + 1) + ')'; }
      parts.unshift(s); node = p;
    }
    return parts.join(' > ');
  }
  // Generaliseerbare (class-/attribuut-)selector die BEWUST op meerdere elementen
  // mag matchen — voor "toepassen op alle" (bv. de vraagtekst in elke vraag).
  function buildClassSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/).filter((c) => /^[A-Za-z][\w-]*$/.test(c)) : [];
    if (cls.length) return '.' + cls.slice(0, 3).join('.');
    for (const a of ['data-qa', 'data-testid', 'aria-label']) { const v = el.getAttribute && el.getAttribute(a); if (v) return el.tagName.toLowerCase() + '[' + a + '="' + String(v).replace(/"/g, '\\"') + '"]'; }
    return el.tagName.toLowerCase();
  }
  // Zit dit element in een shadow-root? Een override met een descendant-pad
  // (a > b) piercet géén shadow-grens en werkt dan vaak niet.
  function inShadow(el) { try { const rn = el.getRootNode && el.getRootNode(); return !!(rn && rn.nodeType === 11 && rn.host); } catch (e) { return false; } }
  // Klik je op een icoon (svg/path/…), dan is dat zelden het nuttige doel — dat
  // levert een brede 'svg'-selector die ALLES pakt. Los daarom op naar het
  // dichtstbijzijnde betekenisvolle element (met data-qa/aria-label/id, of een
  // knop/custom-element), zodat je een SPECIFIEK element te pakken krijgt.
  function isIconLeaf(el) {
    const tag = el && el.tagName ? el.tagName.toLowerCase() : '';
    return /^(svg|path|use|g|polygon|polyline|circle|ellipse|rect|line)$/.test(tag);
  }
  // Klim via shadow-host(s) naar het dichtstbijzijnde custom element (uc-*/ue-*).
  // Zo krijg je het aanspreekbare host-element (bv. <uc-button>Annuleren</uc-button>)
  // i.p.v. een shadow-interne <button part="button"> die je niet kunt selecteren.
  function customHostAncestor(el) {
    let n = el;
    for (let i = 0; n && i < 8; i++) {
      const rn = n.getRootNode && n.getRootNode();
      if (rn && rn.nodeType === 11 && rn.host) { n = rn.host; const tag = (n.tagName || '').toLowerCase(); if (/-/.test(tag)) return n; continue; }
      break;
    }
    return null;
  }
  function _elemIdentity(n) { return n && n.getAttribute && (n.getAttribute('data-qa') || n.getAttribute('data-testid') || n.getAttribute('aria-label') || (n.id && /^[A-Za-z][\w-]*$/.test(n.id))); }
  function resolveMeaningfulTarget(el) {
    if (!el || el.nodeType !== 1) return el;
    // 1) Element BINNEN een shadow-root zonder eigen identiteit (bv. de interne
    //    <button> van een uc-button): wijs het host-custom-element aan.
    if (!_elemIdentity(el) && inShadow(el)) { const host = customHostAncestor(el); if (host) return host; }
    // 2) Icoon (svg/path) → betekenisvol element eromheen.
    if (!isIconLeaf(el)) return el;
    let n = el;
    for (let i = 0; n && n.nodeType === 1 && i < 6; i++) {
      const tag = n.tagName.toLowerCase();
      if (_elemIdentity(n)) return n;
      if (/^(button|a)$/.test(tag) || (n.getAttribute && n.getAttribute('role') === 'button')) return n;
      if (/-/.test(tag) && !isIconLeaf(n)) return n; // custom element (uc-*, ue-*) maar niet <svg>
      const parent = n.parentElement || (n.getRootNode && n.getRootNode().host);
      if (!parent) break;
      n = parent;
    }
    return el.parentElement || el;
  }
  // Kwaliteit/validatie van een (evt. handmatig aangepaste) selector.
  function selectorInfo(sel, el) {
    if (!sel) return { count: 0, brittle: false, shadow: false, invalid: false, empty: true };
    let list; try { list = deepQueryAll(sel).filter((x) => vis(x) && !inOwnUi(x)); } catch (e) { return { count: -1, brittle: true, shadow: false, invalid: true }; }
    const brittle = /nth-of-type/.test(sel) || / > /.test(sel);
    // Shadow is alleen een probleem als de selector niets (meer) vindt; een
    // werkende (deep-query) selector op een shadow-element is prima.
    const shadow = el ? (inShadow(el) && list.length === 0) : false;
    return { count: list.length, brittle: brittle, shadow: shadow, invalid: false };
  }
  function saveOverride(k, s) { overrides[k] = s; try { chrome.storage.local.set({ [OVERRIDE_KEY]: overrides }); } catch (e) {} }
  function clearOverride(k) { delete overrides[k]; try { chrome.storage.local.set({ [OVERRIDE_KEY]: overrides }); } catch (e) {} }
  // Exporteert de herstelde selectors als klein JSON-bestand. Dit bestand
  // ({ "uiSelectors": {...} }) laad je in het beheerscherm; dat publiceert het
  // in config.json zodat ALLE gebruikers dezelfde correcties centraal krijgen.
  function exportOverrides() {
    const payload = { uiSelectors: overrides || {} };
    const json = JSON.stringify(payload, null, 2);
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'ui-selectors.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatus('ui-selectors.json geëxporteerd. Laad dit in het beheerscherm.');
    } catch (e) {
      try { navigator.clipboard.writeText(json); setStatus('Kon niet downloaden; JSON naar klembord gekopieerd.'); }
      catch (e2) { setStatus('Export mislukt.'); }
    }
  }

  // ---- pick-mode ----
  let pickBox = null, pickBanner = null;
  function enterPick(h) {
    pickHook = h; if (panel) panel.style.display = 'none';
    pickBanner = document.createElement('div');
    css(pickBanner, { position: 'fixed', top: '0', left: '0', right: '0', padding: '12px', background: C.pick, color: '#fff', font: '700 14px system-ui', textAlign: 'center', pointerEvents: 'none' });
    pickBanner.textContent = 'Klik het juiste element aan voor: ' + h[1] + '   (Esc = annuleren)';
    ov.appendChild(pickBanner);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
  }
  function exitPick() {
    pickHook = null; if (pickBox) { pickBox.remove(); pickBox = null; } if (pickBanner) { pickBanner.remove(); pickBanner = null; }
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    if (panel) panel.style.display = '';
    renderPanel(); drawHighlights();
  }
  function inUi(el) { return (panel && panel.contains(el)) || (root && root.contains(el)); }
  function onMove(e) {
    const el = pickTarget(e); if (!el || inUi(el)) return; let r; try { r = el.getBoundingClientRect(); } catch (ex) { return; }
    if (!pickBox) { pickBox = document.createElement('div'); ov.appendChild(pickBox); }
    css(pickBox, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', border: '2px dashed ' + C.pick, background: 'rgba(204,8,125,.10)', pointerEvents: 'none', boxSizing: 'border-box' });
  }
  function onClick(e) {
    const raw = pickTarget(e);
    if (inUi(raw)) return; e.preventDefault(); e.stopPropagation();
    const hook = pickHook;
    // Icoon/svg → betekenisvol bovenliggend element, zodat je niet "alle svg's" pakt.
    const tgt = resolveMeaningfulTarget(raw);
    // 'rel'-hooks (bv. labelchips): standaard een selector die op ELKE match past;
    // in de bevestigstap kun je alsnog wisselen naar "Alleen dit".
    const s = (hook && hook[4] === 'rel') ? buildClassSelector(tgt) : buildSelector(tgt);
    exitPick();
    // #2: niet meteen opslaan — eerst valideren/bevestigen (uniek? broos? shadow?).
    if (s && hook && hook[3]) { pendingPick = { hook: hook, selector: s, el: tgt }; renderPanel(); }
    else { setStatus('Kon geen bruikbare selector maken.'); }
  }
  function onKey(e) { if (e.key === 'Escape') { setStatusLater('Aanwijzen geannuleerd.'); exitPick(); } }
  let _pending = ''; function setStatusLater(t) { _pending = t; }
  let pendingPick = null;

  // ---- paneel ----
  function setStatus(t) { const s = panel && panel.querySelector('.__st'); if (s) s.textContent = t; }
  function mini(txt, fn, primary) { const b = document.createElement('button'); b.textContent = txt; css(b, { border: '1px solid ' + (primary ? C.pick : '#ccc'), background: primary ? C.pick : '#fafafa', color: primary ? '#fff' : '#333', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', font: '600 11px system-ui' }); b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; }

  // Live samenvatting én per-regel ✓/✗ bijwerken zonder het hele paneel te
  // herbouwen (behoudt scrollpositie en knopstatus tijdens de 0,5s-refresh).
  function updateSummary() {
    if (!panel) return;
    let found = 0, total = 0;
    rowUpdaters.forEach((fn) => { total++; if (fn()) found++; });
    const sum = panel.querySelector('.__sum');
    if (sum) sum.innerHTML = '<span style="color:' + (found === total ? C.ok : '#b9770e') + '">' + found + ' van ' + total + '</span> hooks gevonden op dit scherm.';
  }

  function openPanel() {
    ensureRoot();
    // #c: bij (her)openen altijd de actuele opgeslagen overrides opnieuw inlezen,
    // zodat een eerder aangewezen element ook echt als 'in gebruik' verschijnt.
    try { if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.get([OVERRIDE_KEY], (r) => { overrides = (r && r[OVERRIDE_KEY]) || {}; if (root && panel) { drawHighlights(); renderPanel(); } }); } catch (e) {}
    panel = document.createElement('div');
    css(panel, { position: 'fixed', top: '0', bottom: '0', left: 'calc(100vw - ' + PW + 'px)', width: PW + 'px', overflow: 'auto', background: '#fff', color: '#222', borderLeft: '1px solid #ccc', boxShadow: '-6px 0 24px rgba(0,0,0,.15)', font: '13px/1.45 system-ui', pointerEvents: 'auto' });
    root.appendChild(panel); renderPanel();
    window.addEventListener('scroll', drawHighlights, true); window.addEventListener('resize', drawHighlights, true);
    drawHighlights();
    // #7: alleen een volledige (zware) herscan doen wanneer de DOM structureel
    // veranderde — niet elke 0,5 s blind alle 36 selectors door alle shadow-
    // roots jagen. Een MutationObserver zet de 'dirty'-vlag; een veiligheids-
    // herscan draait hooguit elke 2 s. Scroll/resize hertekenen apart (goedkoop).
    domDirty = true; lastFull = 0;
    try {
      moObserver = new MutationObserver(() => { domDirty = true; });
      moObserver.observe(document.documentElement, { subtree: true, childList: true });
    } catch (e) { moObserver = null; }
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (!root || pickHook) return;
      reattachIfNeeded(); // goedkoop en moet prompt blijven (modal openen/sluiten)
      const now = Date.now();
      if (!domDirty && (now - lastFull) < 2000) return; // zware herscan gaten
      domDirty = false; lastFull = now;
      drawHighlights(); updateSummary();
    }, 500);
    if (_pending) { setStatus(_pending); _pending = ''; }
    setPersist(true); // onthoud dat hij open is → blijft open na paginawissel
  }
  function closePanel() { if (pickHook) exitPick(); if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } if (moObserver) { try { moObserver.disconnect(); } catch (e) {} moObserver = null; } window.removeEventListener('scroll', drawHighlights, true); window.removeEventListener('resize', drawHighlights, true); removeRoot(); setPersist(false); }
  function toggle() { if (root && panel) closePanel(); else openPanel(); }

  function renderPanel() {
    if (!panel) return; panel.innerHTML = ''; rowUpdaters = [];
    let found = 0, total = 0; HOOKS.forEach((h) => { total++; if (visEls(h).length) found++; });
    // header
    const head = css(document.createElement('div'), { position: 'sticky', top: '0', zIndex: '1', background: '#262229', color: '#fff', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: '8px' });
    const title = document.createElement('div'); title.innerHTML = '<b>UI-inspector</b>'; title.style.flex = '1';
    const x = mini('Sluiten', closePanel); css(x, { border: '1px solid #fff6', background: 'transparent', color: '#fff' });
    head.append(title, x); panel.appendChild(head);
    // body
    const body = css(document.createElement('div'), { padding: '11px 13px' });
    const sum = css(document.createElement('div'), { fontSize: '13px', fontWeight: '700', margin: '0 0 4px' }); sum.className = '__sum';
    sum.innerHTML = '<span style="color:' + (found === total ? C.ok : '#b9770e') + '">' + found + ' van ' + total + '</span> hooks gevonden op dit scherm.';
    body.appendChild(sum);
    const live = css(document.createElement('div'), { fontSize: '10px', color: '#999', margin: '0 0 6px' }); live.textContent = '↻ ververst automatisch elke 0,5 s'; body.appendChild(live);
    const st = css(document.createElement('div'), { fontSize: '11px', color: '#666', minHeight: '14px', margin: '0 0 8px' }); st.className = '__st';
    st.textContent = 'Klik een regel om het element te laten oplichten. "Herstel" = wijs het juiste element aan.'; body.appendChild(st);

    // #2: validatie-/bevestigingsblok na 'Herstel' aanwijzen.
    if (pendingPick) {
      const h = pendingPick.hook;
      const pk = css(document.createElement('div'), { border: '2px solid ' + C.pick, background: '#fff0f8', borderRadius: '8px', padding: '9px', margin: '0 0 10px' });
      const hd = document.createElement('div'); hd.innerHTML = '<b>Herstel bevestigen: ' + h[1] + '</b>'; hd.style.margin = '0 0 6px'; pk.appendChild(hd);
      const inp = document.createElement('input'); inp.value = pendingPick.selector;
      css(inp, { width: '100%', boxSizing: 'border-box', font: '11px Consolas, monospace', padding: '5px 6px', border: '1px solid #ccc', borderRadius: '5px', margin: '0 0 6px' });
      pk.appendChild(inp);
      // Keuze: een SPECIFIEK element (alleen dit) of ALLE vergelijkbare. Zo pak je
      // niet ongewild "alle svg's": klik "Alleen dit" voor één uniek element.
      const nMatch = (sel) => { try { return deepQueryAll(sel).filter((x) => vis(x) && !inOwnUi(x)).length; } catch (e) { return 0; } };
      const specificSel = buildSelector(pendingPick.el);
      const broadSel = buildClassSelector(pendingPick.el);
      const quick = css(document.createElement('div'), { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '0 0 7px' });
      const fill = (sel) => { inp.value = sel; inp.dispatchEvent(new Event('input')); };
      quick.append(
        mini('Alleen dit (' + nMatch(specificSel) + ')', () => fill(specificSel)),
        mini('Alle vergelijkbare (' + nMatch(broadSel) + ')', () => fill(broadSel))
      );
      pk.appendChild(quick);
      const fb = css(document.createElement('div'), { fontSize: '11px', minHeight: '16px', margin: '0 0 7px' }); pk.appendChild(fb);
      const save = mini('Opslaan & toepassen', () => { const v = inp.value.trim(); if (!v) return; if (!window.confirm('Weet je het zeker? Dit is niet terug te draaien. Maak daarom altijd een kopie van de vorige selectors.')) return; saveOverride(h[3], v); pendingPick = null; drawHighlights(); renderPanel(); setStatus('✓ Hersteld en direct toegepast: ' + h[1]); }, true);
      const cancel = mini('Annuleer', () => { pendingPick = null; renderPanel(); });
      const btns = css(document.createElement('div'), { display: 'flex', gap: '6px' }); btns.append(save, cancel); pk.appendChild(btns);
      const isRel = h[4] === 'rel'; // mag bewust op meerdere elementen matchen
      const refresh = () => {
        const info = selectorInfo(inp.value.trim(), pendingPick && pendingPick.el);
        let msg = '', col = '#666', ok = true;
        if (info.empty) { msg = 'Voer een selector in.'; col = C.miss; ok = false; }
        else if (info.invalid) { msg = '⚠ Ongeldige selector.'; col = C.miss; ok = false; }
        else if (isRel) { msg = info.count === 0 ? '⚠ Matcht niets op dit scherm.' : ('✓ Wordt toegepast op alle vergelijkbare elementen (' + info.count + ' gevonden).'); col = info.count === 0 ? '#d98a0b' : C.ok; }
        else if (info.count === 0) { msg = '⚠ Matcht niets op dit scherm.'; col = '#d98a0b'; }
        else if (info.count === 1) { msg = '✓ Matcht precies 1 element.'; col = C.ok; }
        else { msg = '⚠ Matcht ' + info.count + ' elementen — mogelijk niet uniek.'; col = '#d98a0b'; }
        if (!info.empty && !info.invalid && !isRel) {
          if (info.brittle) msg += ' · broze positie-selector (kan breken bij ONS-updates).';
          if (info.shadow && / > /.test(inp.value)) msg += ' · shadow-DOM: een descendant-pad piercet de shadow-grens mogelijk niet.';
        }
        fb.textContent = msg; fb.style.color = col; save.disabled = !ok; save.style.opacity = ok ? '1' : '.5'; save.style.cursor = ok ? 'pointer' : 'not-allowed';
      };
      inp.oninput = refresh; refresh();
      body.appendChild(pk);
    }

    // toggles
    const bar = css(document.createElement('div'), { display: 'flex', gap: '6px', margin: '0 0 8px', flexWrap: 'wrap' });
    bar.append(
      mini(highlightsOn ? 'Highlights uit' : 'Highlights aan', () => { highlightsOn = !highlightsOn; drawHighlights(); renderPanel(); }),
      mini(onlyMissing ? 'Toon alle' : 'Alleen ontbrekend', () => { onlyMissing = !onlyMissing; renderPanel(); }),
      mini('Herscan', () => { drawHighlights(); renderPanel(); }),
      mini('Exporteer selectors', exportOverrides)
    );
    body.appendChild(bar);

    // ---- actieve herstellingen (overrides) beheren ----
    const ovKeys = Object.keys(overrides || {}).filter((k) => overrides[k]);
    if (ovKeys.length) {
      const box = css(document.createElement('div'), { border: '1px solid #e7c9dd', background: '#faf3f8', borderRadius: '8px', padding: '8px 9px', margin: '0 0 10px' });
      const bh = css(document.createElement('div'), { display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 6px' });
      const bt = document.createElement('div'); bt.innerHTML = '<b>Actieve herstellingen (' + ovKeys.length + ')</b>'; bt.style.flex = '1'; bt.style.fontSize = '12px';
      bh.append(bt, mini('Alles wissen', () => { ovKeys.forEach((k) => clearOverride(k)); drawHighlights(); renderPanel(); }));
      box.appendChild(bh);
      ovKeys.forEach((k) => {
        const hook = HOOKS.find((h) => h[3] === k);
        const name = hook ? hook[1] : k;
        const r = css(document.createElement('div'), { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0' });
        const lab = document.createElement('span'); lab.style.flex = '1'; lab.style.fontSize = '11px';
        // #3: markeer een herstelling die het verkeerde element aanwijst
        // (override vindt niets terwijl de standaard hier wél iets vindt).
        const broken = !!(hook && selectorInfo(overrides[k], null).count === 0 && defaultEls(hook).length > 0);
        const flag = broken ? ' <span style="color:#d98a0b;font-weight:700">⚠ werkt niet meer</span>' : '';
        const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        lab.innerHTML = '<b>' + esc(name) + '</b>' + flag + '<br><span style="color:#8a5a76;word-break:break-all">' + esc(overrides[k]) + '</span>';
        r.append(lab, mini('Verwijder', () => { clearOverride(k); drawHighlights(); renderPanel(); }));
        box.appendChild(r);
      });
      body.appendChild(box);
    }

    let grp = '';
    HOOKS.forEach((h) => {
      if (h[0] !== grp) { grp = h[0]; const g = css(document.createElement('div'), { fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', color: '#888', margin: '10px 0 2px' }); g.textContent = grp; body.appendChild(g); }
      const o = overrideSel(h);
      const row = css(document.createElement('div'), { display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 4px', borderBottom: '1px solid #f2f2f2', borderRadius: '6px' });
      const dot = css(document.createElement('span'), { minWidth: '26px', textAlign: 'center', fontWeight: '800' });
      const lbl = document.createElement('span'); lbl.style.flex = '1'; lbl.textContent = h[1] + (o ? ' •' : ''); lbl.title = o || (typeof h[2] === 'function' ? '(heuristisch)' : h[2]);
      row.append(dot, lbl);
      if (h[3]) { row.append(mini(o ? 'Opnieuw' : 'Herstel', () => enterPick(h), true)); if (o) row.append(mini('Reset', () => { clearOverride(h[3]); drawHighlights(); renderPanel(); })); }
      row.onmouseenter = () => { if (row.dataset.on === '1') row.style.background = '#f7eef4'; };
      row.onmouseleave = () => { row.style.background = ''; };
      row.onclick = () => { if (row.dataset.on === '1') flash(h); };
      body.appendChild(row);
      // Live-updater: elke tick n opnieuw bepalen en de regel bijwerken.
      const update = () => {
        // Agenda-hooks zijn niet relevant zolang de modal open is → grijs/n.v.t.
        const na = (h[0] === 'Agenda') && modalIsOpen();
        if (na) {
          row.dataset.on = '0'; row.style.cursor = 'default';
          row.style.display = onlyMissing ? 'none' : 'flex'; row.style.opacity = '.45';
          dot.textContent = '–'; dot.style.color = '#999';
          return true; // telt niet als 'ontbrekend' mee in de samenvatting
        }
        row.style.opacity = '';
        const n = visEls(h).length; const on = n > 0;
        row.dataset.on = on ? '1' : '0';
        row.style.cursor = on ? 'pointer' : 'default';
        row.style.display = (onlyMissing && on) ? 'none' : 'flex';
        // #3: override matcht niets, maar de standaard-selector wél → de
        // herstelling wijst het verkeerde/verdwenen element aan.
        if (overrideSel(h) && !on && defaultEls(h).length > 0) {
          dot.textContent = '⚠'; dot.style.color = '#d98a0b';
          row.style.display = 'flex'; lbl.title = 'Herstelling werkt niet meer (standaard vindt hier wél iets): ' + overrideSel(h);
        } else {
          dot.textContent = on ? '✓' + n : '✗'; dot.style.color = on ? C.ok : C.miss;
        }
        return on;
      };
      update(); rowUpdaters.push(update);
    });
    const note = css(document.createElement('div'), { fontSize: '10px', color: '#999', marginTop: '10px' });
    note.textContent = '★ = het element dat de extensie gebruikt (bij meerdere treffers). ⚠ = herstelling wijst niets meer aan. Herstellingen worden direct toegepast (geen herladen nodig). Herstelbaar zijn de meeste velden (modal, uursoort, labels, datum, begin-/eindtijd, reistijd, titel, opslaan en de registratie-tijden). Structurele/heuristische hooks (cliëntlijst, cliëntnaam, toevoegen-knop, agenda-elementen) zijn alleen diagnose.';
    body.appendChild(note); panel.appendChild(body);
  }

  // ---- trigger 1: vanuit het beheerscherm — dat opent ONS met #ons-ui-inspector
  //      in de URL. Zodra de pagina die vlag draagt, opent de inspector. ----
  const HASH_RE = /ons-?ui-?inspector/i;
  function hashWantsInspector() {
    try { return HASH_RE.test(location.hash || '') || /[?&]onsInspector=1/i.test(location.search || ''); } catch (e) { return false; }
  }
  function openFromHashIfWanted() {
    if (!hashWantsInspector()) return;
    if (!(root && panel)) openPanel();
    // Vlag uit de URL halen zodat een refresh hem niet ongewild heropent.
    try { const clean = location.href.replace(/#.*$/, '').replace(/([?&])onsInspector=1/i, '$1').replace(/[?&]$/, ''); history.replaceState(null, '', clean); } catch (e) {}
  }
  try {
    window.addEventListener('hashchange', openFromHashIfWanted);
    // De ONS-app is een SPA; de vlag kan pas na routing verschijnen. Een paar
    // keer nakijken vangt dat op zonder te blijven pollen.
    let tries = 0; const iv = setInterval(() => { tries++; openFromHashIfWanted(); if ((root && panel) || tries > 20) clearInterval(iv); }, 500);
    openFromHashIfWanted();
  } catch (e) {}

  // ---- persistentie: bij een volledige paginawissel (nieuwe load) heropenen
  //      als hij vóór de navigatie open stond. Sluiten zet de vlag weer uit. ----
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([PERSIST_KEY], (r) => { if (r && r[PERSIST_KEY] && !(root && panel)) openPanel(); });
    }
  } catch (e) {}

  // ---- trigger 2 (terugval): storage-vlag vanuit de extensiepopup ----
  try {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes[OVERRIDE_KEY]) { overrides = changes[OVERRIDE_KEY].newValue || {}; if (root) { drawHighlights(); renderPanel(); } }
        if (changes[OPEN_KEY]) toggle();
      });
    }
  } catch (e) {}
  window.__onsUiInspector = { open: openPanel, close: closePanel, toggle: toggle };
  // Test-hook: de picker-kern blootstellen zodat de regressietests de
  // selector-bouw en de icoon→element-oplossing kunnen controleren.
  try {
    if (window.__ONS_EXPOSE_FOR_TEST) {
      window.__onsInspectorTestApi = {
        buildSelector: buildSelector,
        buildClassSelector: buildClassSelector,
        resolveMeaningfulTarget: resolveMeaningfulTarget,
        isIconLeaf: isIconLeaf,
        selectorInfo: selectorInfo,
      };
    }
  } catch (e) {}
})();
