(() => {
  // src/content/core/datetime.js
  function agendaYmd(d) {
    var dt = d instanceof Date ? d : d != null && d !== "" ? new Date(d) : /* @__PURE__ */ new Date();
    if (isNaN(dt.getTime())) return null;
    var mm = ("0" + (dt.getMonth() + 1)).slice(-2), dd = ("0" + dt.getDate()).slice(-2);
    return dt.getFullYear() + "-" + mm + "-" + dd;
  }
  function _agIsFutureWeek(ymd2) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd2 || ""));
    var base = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(ymd2 || Date.now());
    if (isNaN(base.getTime())) return false;
    base.setHours(0, 0, 0, 0);
    var day = base.getDay() || 7;
    var monday = new Date(base);
    monday.setDate(base.getDate() - (day - 1));
    monday.setHours(0, 0, 0, 0);
    var todayStart = /* @__PURE__ */ new Date();
    todayStart.setHours(0, 0, 0, 0);
    return monday.getTime() > todayStart.getTime();
  }
  function _agFmtMin(min) {
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + " u" + (m ? " " + m + " m" : "") : m + " m";
  }
  var _AG_WKDAG = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  function _agDateLabel(ymd2) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd2 || ""));
    if (!m) return String(ymd2 || "");
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return _AG_WKDAG[d.getDay()] + " " + +m[3] + "-" + +m[2];
  }
  function agendaWeekNumber(ymd2) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd2 || ""));
    var d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(ymd2 || Date.now());
    if (isNaN(d.getTime())) return null;
    var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - yearStart) / 864e5 + 1) / 7);
  }
  function addOneHourText(value) {
    const m = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    const d = /* @__PURE__ */ new Date();
    if (m) {
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    } else {
      d.setSeconds(0, 0);
    }
    d.setHours(d.getHours() + 1);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function addMinutesText(value, minutes) {
    const m = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return "";
    const d = /* @__PURE__ */ new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    d.setMinutes(d.getMinutes() + minutes);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function timeTextToMinutes(value) {
    const m = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }
  function minutesToDurationText(minutes) {
    if (!Number.isFinite(minutes) || minutes < 0) return "";
    return String(Math.round(minutes));
  }
  function registrationDurationLabel(minutes) {
    if (minutes < 60) return `${minutes} min.`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours} uur${rest ? ` ${rest} min.` : ""}`;
  }

  // src/shared/storage-keys.js
  var SYNC = {
    SECTOR: "sector",
    // gekozen bedrijfsonderdeel (popup)
    COLOR_PROFILE: "colorProfile"
    // gekozen team / dagindeling (popup)
  };
  var LOCAL = {
    TEST_CONFIG: "onsHelperConfig",
    // lokale testconfiguratie (beheer); wint van config.json
    UI_OVERRIDES: "onsHelper.uiOverrides",
    // door de UI-inspector herstelde selectors
    INSPECTOR_OPEN: "onsHelper.inspectorOpen",
    // UI-inspector blijft open bij paginawissel
    OPEN_INSPECTOR: "onsHelper.openInspector",
    // verzoek om de UI-inspector te openen
    SNAPSHOT: "onsHelper.snapshot",
    // laatste weekstand (service worker; alleen getallen)
    REMINDER_SETTINGS: "onsHelper.reminders",
    // instellingen wekelijkse herinnering
    FORMS: "onsHelper.forms"
    // registratievormen voor het rechtermuismenu
  };
  var PAGE_LOCAL = {
    HELPER_ENABLED: "onsHelper.helperEnabled",
    // afspraak-/registratiehulp aan/uit ('1'/'0')
    GREY_ENABLED: "onsHelper.greyEnabled",
    // gekleurde dagindeling aan/uit ('1'/'0')
    SURVEY_PANEL_WIDTH: "onsHelper.surveyPanelWidth",
    // breedte vragenlijstpaneel (px)
    EVENT_META_TEMPLATE: "onsHelper.eventMetaTemplate",
    // instellingen van het afspraakformulier (alleen ja/nee en getallen)
    EVENT_OVERLAP_TEMPLATE: "onsHelper.eventOverlapTemplate"
    // geleerde vorm van ONS' overlapcontrole (rollen, geen tijden of id's)
  };
  var PAGE_SESSION = {
    PENDING_REGISTRATION: "onsHelper.pendingReg",
    // registratie vanuit een afspraak (label, vorm, tijden)
    PENDING_APPOINTMENT: "onsHelper.pendingAppointment",
    // afspraak vanuit de planhulp (datum, begintijd)
    PENDING_DUPLICATES: "onsHelper.pendingDuplicates",
    // planhulp: momenten voor kopieën van de volgende nieuwe afspraak (datum, begintijd)
    PENDING_SURVEY_QUESTION: "onsHelper.pendingSurveyQuestion",
    SURVEY_CHECKLIST: "onsHelper.surveyChecklist",
    SURVEY_CATEGORY_URLS: "onsHelper.surveyCategoryUrls.",
    // + resultaat-id
    SURVEY_AUDIT_CACHE: "onsHelper.surveyCategoryAuditCache",
    SURVEY_AUDIT_RESUME: "onsHelper.surveyAuditResume",
    SURVEY_MANUAL_AGE: "onsHelper.surveyManualAge"
  };

  // src/content/storage/page-prefs.js
  function storageGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
    }
  }
  var STORE_HELPER_ENABLED = PAGE_LOCAL.HELPER_ENABLED;

  // src/content/state.js
  var agendaHelperDeactivate = null;
  function setAgendaHelperDeactivate(fn) {
    agendaHelperDeactivate = fn;
  }
  var helperPanel = {
    popupEl: null,
    // het paneel-element, of null als het niet staat
    observer: null,
    // MutationObserver die het paneel herstelt (zie activate)
    active: false,
    // hulp actief op deze pagina
    activeMode: null,
    // 'events' | 'registrations' | null
    repositionTimer: null,
    // Slepen + positie
    userPos: null,
    dragging: false,
    dragDX: 0,
    dragDY: 0,
    popupDragMoved: false,
    // Stabiliteit van de standaard rechterpositie: zie defaultPopupRight().
    _lastRightPanel: null,
    _lastRightValue: null,
    popupCollapsed: false,
    helperEnabled: storageGet(STORE_HELPER_ENABLED, "1") !== "0",
    // aan/uit-schakelaar van de medewerker
    // Korte periode waarin de automatische refresh NIET van scherm mag wisselen,
    // zodat een handmatige klik (bv. Terug op de opslaanpagina) blijft staan i.p.v.
    // meteen weer overschreven te worden.
    suppressAutoUntil: 0,
    lastDomMutationAt: 0,
    // laatste NIET-eigen DOM-mutatie (voor "pagina rustig?")
    // Scherm om naar terug te keren na het info-/uitgeschakeld-/beschikbaarheidsscherm.
    _infoPanelRestore: null,
    _disabledRestore: null,
    _availabilityRestore: null
  };
  var appointmentFlow = {
    pendingChoice: null,
    // gekozen afspraaktype (choice) in behandeling
    clientWaitTimer: null,
    activeAppointmentDurationMinutes: null,
    activeAppointmentStartTimeText: "",
    appointmentTimeGuardTimers: [],
    // Eindtijd-guard: `helperEndText` = de laatste eindtijd die de hulp zelf schreef.
    // Wijkt de eindtijd daar later van af, dan heeft de medewerker hem handmatig
    // aangepast (`appointmentEndTimeUserOwned`) en zet de hulp hem NIET meer terug
    // (bv. bij het toevoegen van een herhaling, dat de opslaanpagina herbouwt).
    helperEndText: "",
    appointmentEndTimeUserOwned: false,
    // True zodra een afspraaktype ECHT is toegepast (handleChoice draaide: titel/
    // label/uursoort gezet). Alleen dán de andere types blokkeren. Klik je Huisbezoek
    // en ga je meteen terug (geen duur gekozen), dan is dit nog false -> geen blokkade.
    appointmentTypeApplied: false,
    appointmentFlowBusy: false,
    // Actief zolang de per-cliënt uursoort-keuzelijst getoond wordt (kan bij
    // meerdere cliënten langer duren dan de appointmentFlowBusy-timeout). Zolang
    // dit aan staat mag de periodieke refresh het scherm niet terugzetten.
    uursoortQueueActive: false,
    // Generatie van de uursoort-wachtrij. clearSettings en (her)mount verhogen dit,
    // zodat een lopende wachtrij (die op eigen timers draait) zichzelf afbreekt.
    uursoortQueueGen: 0,
    // Expliciete schermstatus i.p.v. tekstherkenning: voorkomt dat de 250ms-refresh
    // de opslaanpagina (en zijn Terug-knop) onder de muis herbouwt.
    appointmentSaveScreenActive: false,
    // 'Afspraak doorplannen?'-intentie op de opslaanpagina. De bijbehorende
    // waarschuwing loopt via het algemene meldingenkanaal (helperQualityIssues);
    // een lichte bewaking hertekent de opslaanpagina zodra de blokkade omslaat
    // (herhaling gekozen/weggehaald), zodat knop en status live meelopen.
    appointmentDoorplannen: false,
    doorplannenLastBlocked: null,
    doorplannenSuppressAutoUntil: 0,
    doorplannenLastRecurrenceSet: false,
    doorplannenLastExpanded: false,
    knownClientNames: /* @__PURE__ */ new Set(),
    autoSelectingNewClient: false,
    appointmentAvailabilityConfirmedPeople: /* @__PURE__ */ new Set(),
    appointmentForceChoiceOnce: false,
    // Alleen true tijdens de bewuste "Cliënt toevoegen"-knop van de helper. Alle
    // andere synthetische kliks op de ONS "+ Toevoegen"-knop worden geweerd, zodat
    // een blinde klik (dropdown sluiten e.d.) niet per ongeluk de zoek-genodigden
    // modal opent.
    intentionalAddClientClick: false,
    // Tijdstip tot wanneer het openen van de zoek-genodigden-modal is toegestaan:
    // gezet door een echte gebruikersklik op de ONS "+ Toevoegen"-knop of door de
    // bewuste helper-knop. Buiten dit venster geldt een geopende modal als een
    // ongewenst neveneffect en wordt hij automatisch gesloten.
    allowInviteeModalUntil: 0,
    // Vrije/grijze dag: als de afspraak vanuit een grijs gemarkeerde kolom is
    // geopend, mag de afspraakhulp niet optreden (geen keuzes, geen opslaanblokkade).
    appointmentFreeDay: false,
    appointmentFreeDayDate: null,
    appointmentClearingSettings: false,
    appointmentAwaitingManualUursoort: false,
    // Niet-cliëntgebonden afspraken
    activeNonClientOption: null,
    nonClientBusy: false,
    nonClientFreeTitleScreenActive: false,
    // 'Overig': vrij-titel-scherm actief
    nonClientNoUursoortActive: false
    // niet-client uursoort niet gevonden: foutpagina actief
  };
  var registrationFlow = {
    registrationTravelClicked: false,
    registrationNoShowPromptOpen: false,
    registrationNoShowPromptSuppressed: false,
    registrationNoShowPromptAfterNo: null,
    registrationEpisodesPromptOpen: false,
    registrationEpisodesPromptSuppressed: false,
    registrationHourTypeBusy: false,
    // voorkomt glitch: screen niet overschrijven terwijl uursoorten laden
    registrationFlowBusy: false,
    // voorkomt glitch: screen niet overschrijven terwijl flow navigeert (reistijd → uursoort e.d.)
    activeRegistrationChoice: null,
    reapplyRegistrationSplitTimer: null,
    activeRegistrationHourTypeIndex: null,
    activeRegistrationPortionMinutes: null,
    // tegen-tijd (indirect/direct) in minuten, of null
    // Registratie gestart vanuit een afspraak: het afspraaklabel bepaalt de
    // registratievorm (en dus direct/indirect), zodat de vorm-keuze wordt
    // overgeslagen. Zonder afspraak blijven deze null/false en verandert er niets.
    registrationAutoChoice: null,
    // gekoppelde REGISTRATION_CHOICES-entry, of null
    registrationFromAppointment: false,
    // label van een afspraak is uitgelezen
    registrationAutoApplied: false,
    // vorm al één keer automatisch toegepast
    registrationRestoredToReport: false,
    // na refresh hersteld: direct naar het rapportagescherm
    registrationExtrasRestored: false,
    // direct/indirect + reistijd al één keer teruggezet na refresh
    registrationSettleTimer: null,
    // her-check terwijl we wachten tot de pagina rustig is
    registrationRestoreHoldStart: 0
    // start van het wachten-op-laden (veiligheidscap)
  };

  // src/content/ons/dom.js
  var _shadowRoots = null;
  var _shadowScheduled = false;
  function _collectRoots() {
    const roots = [document];
    const stack = [document];
    while (stack.length) {
      const node = stack.pop();
      let all;
      try {
        all = node.querySelectorAll("*");
      } catch (e) {
        continue;
      }
      for (const el of all) if (el.shadowRoot) {
        roots.push(el.shadowRoot);
        stack.push(el.shadowRoot);
      }
    }
    return roots;
  }
  function _roots() {
    if (_shadowRoots) return _shadowRoots;
    _shadowRoots = _collectRoots();
    if (!_shadowScheduled) {
      _shadowScheduled = true;
      queueMicrotask(() => {
        _shadowRoots = null;
        _shadowScheduled = false;
      });
    }
    return _shadowRoots;
  }
  var _dqCache = /* @__PURE__ */ new Map();
  var _dqObserver = null;
  function _initDqCache() {
    if (_dqObserver || typeof MutationObserver === "undefined") return;
    try {
      _dqObserver = new MutationObserver(() => {
        _dqCache.clear();
      });
      _dqObserver.observe(document.documentElement, { subtree: true, childList: true });
    } catch (e) {
      _dqObserver = null;
    }
  }
  function deepQueryAll(selector, root) {
    if (root) {
      const out2 = [], seen = /* @__PURE__ */ new Set();
      const walk = (n) => {
        if (!n || seen.has(n)) return;
        seen.add(n);
        try {
          out2.push(...n.querySelectorAll(selector));
        } catch (e) {
        }
        let all;
        try {
          all = n.querySelectorAll("*");
        } catch (e) {
          return;
        }
        for (const el of all) if (el.shadowRoot) walk(el.shadowRoot);
      };
      walk(root);
      return out2;
    }
    _initDqCache();
    const hit = _dqCache.get(selector);
    if (hit && Date.now() - hit.t < 500) return hit.out.slice();
    const out = [];
    for (const r of _roots()) {
      try {
        for (const el of r.querySelectorAll(selector)) out.push(el);
      } catch (e) {
      }
    }
    _dqCache.set(selector, { out, t: Date.now() });
    return out.slice();
  }
  function deepActive() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
  }
  function pollFor(fn, onDone, { timeout = 6e3, interval = 120 } = {}) {
    const start = Date.now();
    const tick = () => {
      let val = null;
      try {
        val = fn();
      } catch (e) {
        val = null;
      }
      if (val) {
        onDone(val);
        return;
      }
      if (Date.now() - start >= timeout) {
        onDone(null);
        return;
      }
      setTimeout(tick, interval);
    };
    tick();
  }
  var normalize = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  var deburr = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  var clean = (s) => deburr(normalize(s));
  var visible = (el) => {
    try {
      return !!el && (el.offsetParent !== null || el.getClientRects().length > 0);
    } catch (e) {
      return false;
    }
  };
  var rect = (el) => el.getBoundingClientRect();
  var area = (el) => {
    const r = rect(el);
    return r.width * r.height;
  };
  var isOwnPopup = (el) => !!(helperPanel.popupEl && el && (el === helperPanel.popupEl || helperPanel.popupEl.contains(el)));
  function labelTextFor(el) {
    if (el.labels && el.labels.length) return Array.from(el.labels).map((l) => l.textContent).join(" ");
    const al = el.getAttribute && el.getAttribute("aria-label");
    if (al) return al;
    const lab = el.closest && el.closest("label");
    if (lab) return lab.textContent;
    const row = el.closest && el.closest("label,.checkbox,.form-group,li,tr,div");
    if (row) return row.textContent;
    return "";
  }

  // src/content/ons/agenda-location.js
  var _inviteeIdOverride = null;
  function setInviteeIdOverride(v) {
    _inviteeIdOverride = v == null ? null : v;
  }
  function _agInt(v) {
    var n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  function parseInviteeIdFromPath(path) {
    var m = String(path == null ? "" : path).match(/\/calendar\/invitee\/(\d+)\b/);
    return m ? _agInt(m[1]) : null;
  }
  function resolveInviteeId() {
    if (_inviteeIdOverride != null) return _inviteeIdOverride;
    var fromUrl = parseInviteeIdFromPath(location && location.pathname + location.search + location.hash || "");
    if (fromUrl != null) return fromUrl;
    try {
      var a = deepQueryAll("a").find(function(el) {
        return /\/calendar\/invitee\/\d+\//.test(el.getAttribute && el.getAttribute("href") || "");
      });
      if (a) {
        var id = parseInviteeIdFromPath(a.getAttribute("href"));
        if (id != null) return id;
      }
    } catch (e) {
    }
    return null;
  }
  function currentAgendaDate() {
    var m = /[?&]date=(\d{4}-\d{2}-\d{2})/.exec(location && (location.search || location.href) || "");
    return m ? m[1] : agendaYmd(/* @__PURE__ */ new Date());
  }
  function isRegistrationEditOrNew(path) {
    return /\/registrations\/([^/]+\/edit|new)(?:$|[/?#])/.test(path != null ? path : location.pathname || "");
  }
  function isRegistrationOverviewPage(path) {
    return /\/registrations\/?$/.test(path != null ? path : location.pathname || "");
  }

  // src/content/config/defaults.js
  var DEFAULT_APP_CONFIG = {
    // Tabel 1: keuze in de helper -> ONS-label + gedrag.
    choices: [
      { label: "Huisbezoek", etiket: "JG Huisbezoek", clientPresent: true, pickUursoort: true, addTravelTime: true, kleur: "rood" },
      { label: "Digitaal", etiket: "ALL Beeldbellen", clientPresent: true, pickUursoort: true, addTravelTime: false, kleur: "blauw" },
      { label: "MDO", etiket: "JG MDO", clientPresent: false, pickUursoort: true, addTravelTime: false, kleur: "geel" },
      { label: "Face 2 face", etiket: "JG Face to face kantoor", clientPresent: true, pickUursoort: true, addTravelTime: false, kleur: "blauw" },
      { label: "Verslaglegging", etiket: "JG Verslaglegging", clientPresent: false, pickUursoort: true, addTravelTime: false, kleur: "geel" },
      { label: "Zorgcoördinatie", etiket: "JG Zorgcoördinatie", clientPresent: false, pickUursoort: true, addTravelTime: false, kleur: "groen" }
    ],
    // Extra bekende labels (naast de etiketten uit choices) die de opschoning kent.
    extraKnownLabels: [],
    // Tabel 2: registratievorm -> startverdeling + extra vragen/acties + de
    // afspraaklabels die deze vorm automatisch kiezen (`labels`, uit de
    // labellijst). De aparte labelToForm-tabel is hierin opgegaan.
    // `relevantForTeams` (leeg = alle teams) bepaalt voor welke teams de vorm geldt.
    registrationForms: [
      { vorm: "No show", startVerdeling: "100% direct", uursoort: "No show#", eindtijdBeginPlusMin: 1, rapportagePrefix: "No show", vraagTegenTijd: false, labels: [], relevantForTeams: [] },
      { vorm: "Verslaglegging", startVerdeling: "100% indirect", vraagDirecteTijd: true, stapMin: 5, labels: ["JG Verslaglegging"], relevantForTeams: [] },
      { vorm: "MDO", startVerdeling: "100% indirect", vraagTegenTijd: false, labels: ["JG MDO"], relevantForTeams: [] },
      { vorm: "Zorgcoördinatie", startVerdeling: "100% indirect", vraagDirecteTijd: true, labels: ["JG Zorgcoördinatie"], relevantForTeams: [] },
      { vorm: "Huisbezoek", startVerdeling: "100% direct", vraagIndirecteTijd: true, vraagReistijd: true, labels: ["JG Huisbezoek"], relevantForTeams: [] },
      { vorm: "Face 2 face kantoor", startVerdeling: "100% direct", vraagIndirecteTijd: true, labels: ["JG Face to face kantoor"], relevantForTeams: [] }
    ],
    // Het palet: de toegestane kleuren voor de dag-indeling. Elke zone kiest één
    // van deze namen. 'fill' = achtergrond in de agenda, 'legend' = legenda-stip.
    palette: {
      rood: { naam: "Rood", fill: "rgba(220,70,70,0.15)", legend: "rgba(220,70,70,0.45)" },
      geel: { naam: "Geel", fill: "rgba(235,205,70,0.20)", legend: "rgba(235,205,70,0.65)" },
      blauw: { naam: "Blauw", fill: "rgba(70,130,210,0.16)", legend: "rgba(70,130,210,0.45)" },
      groen: { naam: "Groen", fill: "rgba(60,170,90,0.18)", legend: "rgba(60,170,90,0.50)" }
    },
    profileSectors: { "JGGZ": "Jeugd & Gezin", "J&O/JBG": "Jeugd & Gezin", "Begeleiding": "Begeleiding" },
    // 6.2/6.3: kleur-dagindeling per profiel (tijd -> zone -> kleur uit palet).
    zoneProfiles: {
      "JGGZ": [
        { start: "08:00", end: "08:30", zone: "Dagstart", color: "rood" },
        { start: "08:30", end: "11:30", zone: "Cliëntafspraken", color: "geel" },
        { start: "11:30", end: "12:00", zone: "Administratie", color: "rood" },
        { start: "12:00", end: "12:30", zone: "Pauze", color: "blauw" },
        { start: "12:30", end: "14:00", zone: "Cliëntafspraken", color: "geel" },
        { start: "14:00", end: "14:45", zone: "Administratie", color: "rood" },
        { start: "14:45", end: "16:15", zone: "Cliëntafspraken", color: "geel" },
        { start: "16:15", end: "17:00", zone: "Vergadering", color: "groen" }
      ],
      "J&O/JBG": [
        { start: "08:00", end: "08:30", zone: "Administratie (indirect)", color: "geel" },
        { start: "08:30", end: "12:00", zone: "Huisbezoek (direct)", color: "rood" },
        { start: "12:00", end: "12:30", zone: "Pauze", color: "blauw" },
        { start: "12:30", end: "14:00", zone: "Huisbezoek (direct)", color: "rood" },
        { start: "14:00", end: "14:45", zone: "Administratie (indirect)", color: "geel" },
        { start: "14:45", end: "16:15", zone: "Huisbezoek (direct)", color: "rood" },
        { start: "16:15", end: "17:00", zone: "Vergadering", color: "groen" }
      ],
      // Begeleiding: startprofiel (huisbezoek-gedreven). Pas dit aan in het beheerscherm.
      "Begeleiding": [
        { start: "08:00", end: "08:30", zone: "Administratie (indirect)", color: "geel" },
        { start: "08:30", end: "12:00", zone: "Cliëntbegeleiding", color: "rood" },
        { start: "12:00", end: "12:30", zone: "Pauze", color: "blauw" },
        { start: "12:30", end: "14:00", zone: "Cliëntbegeleiding", color: "rood" },
        { start: "14:00", end: "14:45", zone: "Administratie (indirect)", color: "geel" },
        { start: "14:45", end: "16:15", zone: "Cliëntbegeleiding", color: "rood" },
        { start: "16:15", end: "17:00", zone: "Vergadering", color: "groen" }
      ]
    },
    // Aanpasbare schermteksten (per key) met opmaak. Elke key wordt in de
    // extensie op een vaste plek getoond; hier kun je tekst + kleur/dikte/
    // cursief/grootte instellen. sizePx = tekstgrootte in pixels.
    texts: {
      afspraak_klaar_regel1: { text: "Voeg eventueel nog een locatie en notitie toe.", color: "#333333", bold: false, italic: false, sizePx: 13 },
      afspraak_klaar_regel2: { text: "Als de instellingen kloppen, kun je de afspraak opslaan", color: "#333333", bold: false, italic: false, sizePx: 13 },
      afspraak_uursoort_sub: { text: "Daarna gaat de afspraak vanzelf verder.", color: "#666666", bold: false, italic: false, sizePx: 12 },
      registratie_rapportage_titel: { text: "Schrijf nu je rapportage, volgens Richtlijn rapporteren", color: "#222222", bold: true, italic: false, sizePx: 14 },
      registratie_prereq_regel1: { text: "Voor cliëntgebonden registraties: vul cliënt, datum en begintijd in.", color: "#c0006a", bold: true, italic: false, sizePx: 13 },
      registratie_prereq_regel2: { text: "Voor niet cliëntgebonden registraties: vul datum, begintijd en eindtijd in.", color: "#c0006a", bold: true, italic: false, sizePx: 13 },
      probleem_hulp_werkt_niet: { text: "Let op: de afspraakhulp herkent een veld niet en werkt mogelijk niet volledig. Controleer de afspraak zelf en meld dit via 'Meld probleem' in de extensie.", color: "#b3261e", bold: true, italic: false, sizePx: 13 },
      probleem_uursoort_zelf: { text: "Kies zelf de uursoort in het gemarkeerde veld hieronder.", color: "#704b00", bold: false, italic: false, sizePx: 13 },
      probleem_label_zelf: { text: "Controleer het label bovenaan de afspraak en pas het zo nodig zelf aan.", color: "#704b00", bold: false, italic: false, sizePx: 13 },
      doorplannen_vraag: { text: "Afspraak doorplannen?", color: "#cc087d", bold: false, italic: false, sizePx: 13 },
      doorplannen_waarschuwing: { text: "Je gaf aan de afspraak te willen doorplannen, maar de herhaling staat nog op 'Niet'. Stel de herhaling in, of zet 'Afspraak doorplannen?' uit en sla op.", color: "#b3261e", bold: true, italic: false, sizePx: 13 }
    },
    compatibility: { schemaVersion: 7, minimumExtensionVersion: "1.6.114" },
    features: { appointmentAssistant: true, registrationAssistant: true, dayColoring: true, managedTexts: true, surveyRequired: true, surveyAudit: true, reportGuidelineLink: true, doorplannenToggle: true, leaveRequest: true, routeLink: true, weekRatio: true, production: true, openRegistrations: true, quickRegister: true, planner: true, plannerCopies: true, plannerDistance: true, plannerMulti: true, plannerDirect: true, preload: true },
    nonClientCategories: [],
    // Eigen server voor rijtijden over de weg (Google Routes API; zie
    // server/routes-proxy). Leeg = hemelsbrede schatting via PDOK.
    // embedKey: aparte sleutel met ALLEEN de Maps Embed API (gratis) voor de kaart.
    // routesKey: sleutel met ALLEEN de Routes API, als er geen server (url) is;
    // de extensie roept Google dan zelf aan (alleen postcodes). Zet in Google
    // Cloud een dagmaximum: deze sleutel is zichtbaar in de extensie.
    routesProxy: { url: "", token: "", embedKey: "", routesKey: "" },
    // Kantoorlocaties voor de afstand in de planhulp. Een afspraak met een
    // ONS-locatie (bijv. 'J&G Oosterhout') telt als 'op kantoor'; de locatienaam
    // wordt herkend aan een van de woorden in 'match'. sector: 'jg' (Jeugd en
    // Gezin, locatienamen met J&G/Jeugd) of 'bv' (Begeleiding).
    offices: [
      // Jeugd en Gezin (ONS-locaties 'J&G …')
      { sector: "jg", name: "Breda", postcode: "4822NH", match: ["breda", "oosterhout", "geertruidenberg", "altena", "west brabant oost", "west-brabant oost", "west-brabant west", "west brabant west"] },
      { sector: "jg", name: "Bergen op Zoom", postcode: "4624DE", match: ["bergen op zoom"] },
      { sector: "jg", name: "Loosduinen (Kracht)", postcode: "2552AE", match: ["kracht", "loosduinen", "den haag"] },
      { sector: "jg", name: "Tilburg", postcode: "5026RM", match: ["tilburg", "hart van brabant"] },
      { sector: "jg", name: "Dongen", postcode: "5102AE", match: ["dongen"] },
      { sector: "jg", name: "Eindhoven", postcode: "5612EK", match: ["eindhoven", "zuidoost brabant", "zuidoost-brabant"] },
      { sector: "jg", name: "Helmond", postcode: "5701MJ", match: ["helmond"] },
      { sector: "jg", name: "Gouda", postcode: "2803PB", match: ["gouda", "midden-holland", "midden holland"] },
      { sector: "jg", name: "Nieuwegein", postcode: "3432ET", match: ["nieuwegein", "lekstroom", "utrecht"] },
      { sector: "jg", name: "Oss", postcode: "5344AT", match: ["oss", "nob", "noordoost-brabant", "noordoost brabant"] },
      { sector: "jg", name: "Rijswijk", postcode: "2285VL", match: ["rijswijk", "delft"] },
      { sector: "jg", name: "Waalwijk", postcode: "5141PA", match: ["waalwijk", "loon op zand"] },
      { sector: "jg", name: "Zoetermeer", postcode: "2713JA", match: ["zoetermeer"] },
      // Begeleiding (ONS-locaties 'BG …'). Niet gekoppeld (onbekend):
      // BG DH2, BG HWDN, BG ADGG, BG De6, BG Overig.
      { sector: "bv", name: "Bergen op Zoom", postcode: "4624DE", match: ["bergen op zoom", "brabantse wal"] },
      { sector: "bv", name: "Breda", postcode: "4822NH", match: ["breda", "oosterhout"] },
      { sector: "bv", name: "Delft", postcode: "2613RR", match: ["delft"] },
      { sector: "bv", name: "Den Haag Noord-Oost", postcode: "2521DB", match: ["den haag noord-oost", "den haag noordoost", "noord-oost"] },
      { sector: "bv", name: "Den Haag Zuid-West", postcode: "2552AE", match: ["den haag zuid-west", "den haag zuidwest", "zuid-west"] },
      { sector: "bv", name: "Dongen", postcode: "5102AE", match: ["dongen"] },
      { sector: "bv", name: "Ede", postcode: "6716AE", match: ["ede", "veluwe", "gelderland"] },
      { sector: "bv", name: "Eindhoven", postcode: "5612EK", match: ["eindhoven", "kempen"] },
      { sector: "bv", name: "Gouda", postcode: "2803PB", match: ["gouda", "midden holland", "midden-holland"] },
      { sector: "bv", name: "Helmond", postcode: "5701MJ", match: ["helmond"] },
      { sector: "bv", name: "Leiden", postcode: "2312TH", match: ["leiden", "holland rijnland"] },
      { sector: "bv", name: "Naaldwijk", postcode: "2671ZP", match: ["naaldwijk", "westland"] },
      { sector: "bv", name: "Nieuwegein", postcode: "3432ET", match: ["nieuwegein", "utrecht"] },
      { sector: "bv", name: "Oss", postcode: "5344AT", match: ["oss", "nob", "noordoost-brabant"] },
      { sector: "bv", name: "Rijswijk", postcode: "2285VL", match: ["rijswijk"] },
      { sector: "bv", name: "Rotterdam", postcode: "3083CW", match: ["rotterdam"] },
      { sector: "bv", name: "'s-Hertogenbosch", postcode: "5232BC", match: ["hertogenbosch", "den bosch", "meierij"] },
      { sector: "bv", name: "Tilburg", postcode: "5026RM", match: ["tilburg"] },
      { sector: "bv", name: "Waalwijk", postcode: "5141PA", match: ["waalwijk"] },
      { sector: "bv", name: "Zoetermeer", postcode: "2713JA", match: ["zoetermeer"] }
    ],
    generalSettings: { travelStepMin: 5, travelMaxMin: 60, portionStepMin: 5, lateThresholdHours: 24, durationStepMin: 15, appointmentMaxMin: 480, registrationMaxMin: 180, pauseFixedMin: 30, nonClientMarker: "*", countWeekends: false, nonClientUursoorten: [], excludedRegistrationStatuses: ["do_not_declare"], excludedCalendarTypes: ["unavailability", "presence"] },
    // API-endpoint-sjablonen (agenda-analyse) — instelbaar; alleen relatieve same-origin paden.
    apiEndpoints: {},
    // Declarabiliteit-grondslag per profiel (regels 'match -> direct|client').
    declarabiliteitRules: [],
    // Support: instelbaar meldkanaal (TOPdesk) voor de 'Meld probleem'-knop en de infolink.
    support: { topdeskUrl: "https://impegno.topdesk.net/" },
    // Verlof aanvragen (knop in het zijpaneel): legt de onbeschikbaarheid
    // vast in ONS en opent daarna AFAS in een nieuw tabblad om het verlof daar
    // aan te vragen. maxDays: hoe lang een herhaling hooguit mag lopen.
    // recurrenceTypes: de waarden van recurrence_type in ONS (mocht ONS die wijzigen).
    leaveRequest: { description: "Verlof", redirectUrl: "https://login.afasonline.com/83031/Apps", maxDays: 366, recurrenceTypes: { daily: "daily", weekly: "weekly" } },
    // Activatie: welke URL-delen de afspraak-/registratiehulp aanzetten.
    // Instelbaar zodat een ONS-URL-wijziging niet meer een code-update vereist.
    activation: { appointmentNeedle: "/events/new", registrationNeedle: "/registrations", domains: [] },
    // Gefaseerde uitrol: modules met een testGroup draaien alleen voor de
    // gebruikers in die groep zolang 'enabled' aan staat. Uit = voor iedereen.
    rollout: { enabled: false, groups: {} },
    // Centraal (beheerscherm) herstelde UI-selectors — geëxporteerd door de
    // UI-inspector en gepubliceerd in config.json, zodat correcties voor ALLE
    // gebruikers gelden i.p.v. alleen op één testapparaat.
    uiSelectors: {}
  };
  var NONCLIENT_CATEGORIES = [
    { label: "Werkzaamheden", options: [
      { display: "Acquisitie", uursoort: "Acquisitie*", info: "" },
      { display: "Werktijdenregeling", uursoort: "Werktijdenregeling*", info: "" },
      { display: "Voorbereidende werkzaamheden", uursoort: "Voorbereidende werkzaamheden*", info: "" },
      { display: "Verplichte nevenactiviteiten", uursoort: "verpl nevenact - Verplichte nevenactiviteiten*", info: "" },
      { display: "Schoolcoaching", uursoort: "Schoolcoaching", info: "" },
      { display: "Schoolcoaching indirect", uursoort: "Schoolcoaching indirect #", info: "" },
      { display: "Reistijd", uursoort: "Reistijd", info: "" }
    ] },
    { label: "Overleg & medezeggenschap", options: [
      { display: "Overleg", uursoort: "Overleg*", info: "" },
      { display: "OR", uursoort: "OR (ondernemingsraad)*", info: "" },
      { display: "OR-training", uursoort: "OR-training*", info: "" },
      { display: "OR-vergadering", uursoort: "OR-vergadering*", info: "" },
      { display: "OR-voorbereiding en uitwerking", uursoort: "OR-voorbereiding en uitwerking*", info: "" }
    ] },
    { label: "Ontwikkeling & begeleiding", options: [
      { display: "J&G verzorgen training extern", uursoort: "J&G verzorgen training extern", info: "" },
      { display: "Detachering", uursoort: "Detachering", info: "" },
      { display: "Inwerken", uursoort: "Inwerken*", info: "" },
      { display: "Opleiding & ontwikkeling", uursoort: "Opleiding & ontwikkeling*", info: "" },
      { display: "Werkbegeleiding", uursoort: "Werkbegeleiding*", info: "" }
    ] },
    { label: "Verlof & ouderschap", options: [
      { display: "Verlof", uursoort: "Verlof*", durationStep: 60, info: "" },
      { display: "Ouderschapverlof", uursoort: "Ouderschapverlof*", durationStep: 60, info: "" },
      { display: "Kolven", uursoort: "Kolven*", info: "" }
    ] },
    { label: "Pauze, verzuim & gezondheid", options: [
      { display: "Pauze", uursoort: "Pauze*", fixedHalfHour: true, info: "" },
      { display: "Verzuim/ziekte", uursoort: "Verzuim/ziekte*", info: "" }
    ] },
    { label: "Projecten J&G", options: [
      { display: "J&G DH Kracht Basis", uursoort: "J&G DH Kracht Basis", info: "" },
      { display: "J&G Den Haag Kracht", uursoort: "J&G Den Haag Kracht", info: "" },
      { display: "J&G Ind Proeftuin Toekomstscenario", uursoort: "J&G Ind Proeftuin Toekomstscenario", info: "" },
      { display: "J&G Kacht Transformatie", uursoort: "J&G Kacht Transformatie", info: "" },
      { display: "J&G Kracht Preventie", uursoort: "J&G Kracht Preventie", info: "" },
      { display: "J&G Project GGZ", uursoort: "J&G Project GGZ#", info: "" },
      { display: "JBW project", uursoort: "JBW project", info: "" },
      { display: "Medendo C4", uursoort: "Medendo C4#", info: "" },
      { display: "Medendo D4", uursoort: "Medendo D4#", info: "" },
      { display: "PAST Project Gouda", uursoort: "PAST Project Gouda", info: "" }
    ] },
    // 'Overig' is een directe optie (geen submenu, geen uursoort): de gebruiker
    // moet zelf een titel "Overig - ..." invullen voordat opslaan vrijkomt.
    { label: "Overig", directOption: { display: "Overig", freeTitle: true, info: "" } }
  ];

  // src/content/config/hooks.js
  var hooks = {
    formsChanged: null,
    // registratievormen gewijzigd -> rechtermuismenu bijwerken
    selectorsChanged: null,
    // config.uiSelectors gewijzigd -> selector-overrides herberekenen
    rolloutChanged: null,
    // config.rollout gewijzigd -> moduleplatform (gefaseerde uitrol)
    configApplied: null,
    // configuratie toegepast -> opnieuw bepalen welke hulp bij de URL hoort
    teamChanged: null
    // ander team gekozen -> de hulp opnieuw starten
  };
  function connectConfigHooks(handlers) {
    for (const k of Object.keys(handlers)) {
      if (!(k in hooks)) throw new Error("onbekende config-haak: " + k);
      hooks[k] = handlers[k];
    }
  }
  function runConfigHook(name, ...args) {
    try {
      if (typeof hooks[name] === "function") hooks[name](...args);
    } catch (e) {
    }
  }

  // src/content/config/app-config.js
  function _cloneConfig(c) {
    try {
      return JSON.parse(JSON.stringify(c));
    } catch (e) {
      return c;
    }
  }
  var APP_CONFIG = _cloneConfig(DEFAULT_APP_CONFIG);
  var ACTIVE_SECTOR = null;
  var ACTIVE_PROFILE = null;
  function setActiveTeam(profile, sector) {
    ACTIVE_PROFILE = profile;
    ACTIVE_SECTOR = sector;
  }
  function setActiveProfileForTest(p) {
    ACTIVE_PROFILE = p || null;
  }
  function anyTeamsDefined() {
    try {
      return !!(APP_CONFIG.profileSectors && Object.keys(APP_CONFIG.profileSectors).length);
    } catch (e) {
      return false;
    }
  }
  function relevantForActiveTeam(item) {
    if (!ACTIVE_PROFILE) return true;
    const teams = item && item.relevantForTeams;
    if (!Array.isArray(teams) || teams.length === 0) return true;
    return teams.indexOf(ACTIVE_PROFILE) >= 0;
  }
  function helperNeedsTeamChoice() {
    return !ACTIVE_PROFILE && anyTeamsDefined();
  }
  function sortByVolgorde(arr) {
    return (arr || []).map(function(x, i) {
      return [x, i];
    }).sort(function(a, b) {
      var av = a[0] && a[0].volgorde != null && a[0].volgorde !== "" ? +a[0].volgorde : Infinity;
      var bv = b[0] && b[0].volgorde != null && b[0].volgorde !== "" ? +b[0].volgorde : Infinity;
      if (!isFinite(av)) av = Infinity;
      if (!isFinite(bv)) bv = Infinity;
      return av === bv ? a[1] - b[1] : av - bv;
    }).map(function(p) {
      return p[0];
    });
  }
  function effectiveChoices() {
    return sortByVolgorde((APP_CONFIG.choices || []).filter(relevantForActiveTeam));
  }
  function effectiveRegistrationForms() {
    return sortByVolgorde((APP_CONFIG.registrationForms || []).filter(relevantForActiveTeam));
  }
  function refreshEffectiveConfig() {
    try {
      CONFIG.choices = effectiveChoices();
    } catch (e) {
    }
    try {
      REGISTRATION_CHOICES = buildRegistrationChoices();
    } catch (e) {
    }
    runConfigHook("formsChanged");
  }
  function applyHelperConfig(hc) {
    if (!hc || typeof hc !== "object") return;
    if (Array.isArray(hc.choices)) APP_CONFIG.choices = hc.choices;
    if (Array.isArray(hc.extraKnownLabels)) APP_CONFIG.extraKnownLabels = hc.extraKnownLabels;
    if (Array.isArray(hc.registrationForms)) APP_CONFIG.registrationForms = hc.registrationForms;
    if (hc.zoneProfiles && typeof hc.zoneProfiles === "object") APP_CONFIG.zoneProfiles = hc.zoneProfiles;
    if (hc.profileSectors && typeof hc.profileSectors === "object") APP_CONFIG.profileSectors = hc.profileSectors;
    if (hc.palette && typeof hc.palette === "object") APP_CONFIG.palette = hc.palette;
    if (hc.texts && typeof hc.texts === "object") APP_CONFIG.texts = Object.assign({}, APP_CONFIG.texts, hc.texts);
    if (hc.compatibility && typeof hc.compatibility === "object") APP_CONFIG.compatibility = hc.compatibility;
    if (hc.features && typeof hc.features === "object") APP_CONFIG.features = Object.assign({}, APP_CONFIG.features, hc.features);
    if (Array.isArray(hc.nonClientCategories)) APP_CONFIG.nonClientCategories = hc.nonClientCategories;
    if (Array.isArray(hc.offices) && hc.offices.length) APP_CONFIG.offices = hc.offices;
    if (hc.routesProxy && typeof hc.routesProxy === "object") APP_CONFIG.routesProxy = Object.assign({}, APP_CONFIG.routesProxy, hc.routesProxy);
    if (hc.generalSettings && typeof hc.generalSettings === "object") APP_CONFIG.generalSettings = Object.assign({}, APP_CONFIG.generalSettings, hc.generalSettings);
    if (hc.apiEndpoints && typeof hc.apiEndpoints === "object") APP_CONFIG.apiEndpoints = Object.assign({}, APP_CONFIG.apiEndpoints, hc.apiEndpoints);
    if (Array.isArray(hc.declarabiliteitRules)) APP_CONFIG.declarabiliteitRules = hc.declarabiliteitRules;
    if (hc.support && typeof hc.support === "object") APP_CONFIG.support = Object.assign({}, APP_CONFIG.support, hc.support);
    if (hc.leaveRequest && typeof hc.leaveRequest === "object") APP_CONFIG.leaveRequest = Object.assign({}, APP_CONFIG.leaveRequest, hc.leaveRequest);
    if (hc.activation && typeof hc.activation === "object") {
      APP_CONFIG.activation = Object.assign({}, APP_CONFIG.activation, hc.activation);
      if (APP_CONFIG.activation.appointmentNeedle) CONFIG.urlNeedle = APP_CONFIG.activation.appointmentNeedle;
      if (APP_CONFIG.activation.registrationNeedle) CONFIG.registrationNeedle = APP_CONFIG.activation.registrationNeedle;
    }
    if (hc.rollout && typeof hc.rollout === "object") {
      APP_CONFIG.rollout = Object.assign({}, APP_CONFIG.rollout, hc.rollout);
      runConfigHook("rolloutChanged", APP_CONFIG.rollout);
    }
    if (hc.uiSelectors && typeof hc.uiSelectors === "object") {
      APP_CONFIG.uiSelectors = Object.assign({}, APP_CONFIG.uiSelectors, hc.uiSelectors);
      runConfigHook("selectorsChanged");
    }
    refreshEffectiveConfig();
    runConfigHook("configApplied");
    try {
      if (typeof onHelperConfigChanged === "function") onHelperConfigChanged();
    } catch (e) {
    }
  }
  function supportTopdeskUrl() {
    try {
      const u = APP_CONFIG.support && APP_CONFIG.support.topdeskUrl;
      if (u && /^https?:\/\//i.test(u)) return u;
    } catch (e) {
    }
    return "https://impegno.topdesk.net/";
  }
  var onHelperConfigChanged = null;
  function setOnHelperConfigChanged(fn) {
    onHelperConfigChanged = fn;
  }
  var CONFIG = {
    urlNeedle: "/events/new",
    registrationNeedle: "/registrations",
    debug: false,
    clientPresentMatcher: (txt) => txt.includes("client") && txt.includes("aanwezig"),
    // Afspraaktypes komen uit de beheerbare config (APP_CONFIG.choices).
    choices: effectiveChoices(),
    uursoortIgnore: ["onlangs gebruikt", "geadviseerd", "toegestaan", "geen resultaten", "voer minstens", "toont ", "bekijk agenda", "verwijder uit selectie", "client", "medewerker", "toevoegen"],
    etiketFieldSelector: "",
    uursoortFieldSelector: "",
    modalPanelSelector: ""
  };
  function gsNum(key, def) {
    const g = APP_CONFIG.generalSettings || {};
    return g[key] > 0 ? g[key] : def;
  }
  function choiceLabels(c) {
    const out = [];
    const push = (v) => {
      v = (v == null ? "" : String(v)).trim();
      if (v && out.indexOf(v) === -1) out.push(v);
    };
    if (c) {
      push(c.etiket);
      if (Array.isArray(c.etiketten)) c.etiketten.forEach(push);
    }
    return out;
  }
  function allKnownLabels() {
    const labels = [];
    CONFIG.choices.forEach(function(c) {
      choiceLabels(c).forEach(function(l) {
        if (labels.indexOf(l) === -1) labels.push(l);
      });
    });
    for (const extra of APP_CONFIG.extraKnownLabels || []) if (labels.indexOf(extra) === -1) labels.push(extra);
    return labels;
  }
  function nonClientCategoriesActive() {
    const c = APP_CONFIG.nonClientCategories;
    const base = Array.isArray(c) && c.length ? c : NONCLIENT_CATEGORIES;
    return sortByVolgorde(base).map(function(cat) {
      if (cat && Array.isArray(cat.options) && cat.options.length) {
        return Object.assign({}, cat, { options: sortByVolgorde(cat.options) });
      }
      return cat;
    });
  }
  function allNonClientHourTypes() {
    const out = [];
    nonClientCategoriesActive().forEach(function(cat) {
      if (cat.directOption && cat.directOption.uursoort) out.push(cat.directOption.uursoort);
      (cat.options || []).forEach(function(opt) {
        if (opt.uursoort) out.push(opt.uursoort);
      });
    });
    return out;
  }
  function directIndirectLabel(sv) {
    const m = String(sv == null ? "" : sv).match(/(\d+)\s*%\s*(direct|indirect)/i);
    if (!m) return "";
    const pct = Math.max(0, Math.min(100, parseInt(m[1], 10) || 0));
    const word = m[2].toLowerCase();
    return pct >= 100 ? word : word === "direct" ? "direct/indirect" : "indirect/direct";
  }
  function buildRegistrationChoices() {
    return effectiveRegistrationForms().map(function(f) {
      const o = { label: f.vorm };
      if (f.uursoort) o.hourType = f.uursoort;
      if (f.eindtijdBeginPlusMin) o.endPlusOneMinute = true;
      const sv = String(f.startVerdeling || "").match(/(\d+)\s*%\s*(direct|indirect)/i);
      if (sv) {
        const pct = Math.max(0, Math.min(100, parseInt(sv[1], 10) || 0));
        const word = sv[2].toLowerCase();
        const directPct = word === "indirect" ? 100 - pct : pct;
        if (directPct === 100) o.directFullDuration = true;
        else if (directPct === 0) o.indirectFullDuration = true;
        else o.startSplit = { directPct, indirectPct: 100 - directPct };
        o.directIndirectLabel = directIndirectLabel(f.startVerdeling);
      }
      if (f.vraagDirecteTijd) o.askDirectPortion = true;
      if (f.vraagIndirecteTijd) o.askIndirectPortion = true;
      if (f.vraagReistijd) o.addTravelTime = true;
      if (f.rapportagePrefix) o.reportPrefix = f.rapportagePrefix;
      return o;
    });
  }
  var REGISTRATION_CHOICES = buildRegistrationChoices();

  // src/content/domain/agenda-entries.js
  function mapAgendaEntry(e) {
    if (!e || typeof e !== "object") return null;
    var ts = e.time_slot || {};
    var start = e.start_time || ts.start_time || ts.start_date_time || null;
    var end = e.end_time || ts.end_time || ts.end_date_time || null;
    var loc = e.location || {};
    return {
      id: e.id != null ? String(e.id) : null,
      occurrenceId: e.occurrence_id || null,
      date: e.date || (start ? String(start).slice(0, 10) : null),
      start,
      end,
      startMs: start ? Date.parse(start) : null,
      endMs: end ? Date.parse(end) : null,
      allDay: !!ts.all_day,
      durationSec: typeof ts.duration === "number" ? ts.duration : null,
      // Reistijd in MINUTEN (let op: 'duration' is wél in seconden). Gecontroleerd
      // op een echte afspraak: 09:00-10:15, duration 4500, travel_time_before/after 30.
      travelBefore: ts.travel_time_before != null ? ts.travel_time_before : null,
      travelAfter: ts.travel_time_after != null ? ts.travel_time_after : null,
      type: e.type || null,
      // Outlook: hoe de afspraak de agenda bezet (busy/oof/tentative/free/
      // workingElsewhere). Geen persoonsgegeven; de planhulp gebruikt het.
      showAs: e.show_as != null ? String(e.show_as) : null,
      // Alleen de echte uursoort; NIET e.title als fallback — die bevat bij
      // registraties de cliëntnaam (PII).
      hourType: e.hour_type || "",
      recurring: !!e.recurring,
      editable: !!e.is_editable,
      classes: e.classes || "",
      // PRIVACY: cliëntgegevens (naam/bsn/geboortedatum), de vrije titel (e.name) en de
      // opmerking worden bewust NIET overgenomen. Alleen een telling + wel/niet-gekoppeld.
      clientCount: Array.isArray(e.clients) ? e.clients.length : 0,
      // Medewerkers zonder naam (alleen id's/rol) — geen persoonsnamen in het model.
      employees: (Array.isArray(e.employees) ? e.employees : []).map(function(m) {
        return { id: m && m.id != null ? m.id : null, externalId: m && m.external_id != null ? m.external_id : null, authorized: !!(m && m.authorized), inviteeType: m && m.invitee_type_name || "" };
      }),
      teams: Array.isArray(e.teams) ? e.teams : [],
      groups: Array.isArray(e.groups) ? e.groups : [],
      labels: Array.isArray(e.labels) ? e.labels : [],
      // afspraaklabels (voor type/vorm), geen cliëntdata
      // ONS-locatie (kantoor, bijv. 'J&G Oosterhout'): geen persoonsgegeven.
      locationName: loc && loc.name != null ? String(loc.name) : "",
      detailsUrl: e.meta && e.meta.detailsUrl || null,
      // "Cliëntafspraak" = er is een cliënt GEKOPPELD (clients niet leeg), bewust NIET
      // het 'cliënten aanwezig'-vinkje uit de API.
      clientPresent: Array.isArray(e.clients) && e.clients.length > 0
    };
  }
  function mapAgendaWeekResponse(json) {
    var rows = json && Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
    return rows.map(mapAgendaEntry).filter(Boolean).sort(function(a, b) {
      return (a.startMs || 0) - (b.startMs || 0);
    });
  }
  function _entryMinutes(e) {
    if (e && typeof e.durationSec === "number" && e.durationSec > 0) return e.durationSec / 60;
    if (e && e.startMs != null && e.endMs != null && e.endMs > e.startMs) return (e.endMs - e.startMs) / 6e4;
    return 0;
  }
  function _agEntryLabels(e) {
    return (e && Array.isArray(e.labels) ? e.labels : []).map(function(l) {
      return String(l && (l.name || l.label || l.title) != null ? l.name || l.label || l.title : l == null ? "" : l).trim();
    }).filter(Boolean);
  }
  function labelToAfspraaktype(labelText, choices) {
    var key = _agNorm(labelText);
    if (!key) return null;
    choices = choices || (typeof APP_CONFIG !== "undefined" && APP_CONFIG && APP_CONFIG.choices || []);
    for (var i = 0; i < choices.length; i++) {
      var c = choices[i];
      var ets = [];
      if (Array.isArray(c.etiketten)) ets = ets.concat(c.etiketten);
      if (c.etiket) ets.push(c.etiket);
      if (ets.map(_agNorm).indexOf(key) !== -1) return c.label || null;
    }
    return null;
  }
  function agendaEntryType(e, choices) {
    var labels = _agEntryLabels(e);
    for (var i = 0; i < labels.length; i++) {
      var t = labelToAfspraaktype(labels[i], choices);
      if (t) return t;
    }
    return "Niet-gedefinieerd";
  }
  function parseStartVerdeling(sv) {
    var m = /(\d+)\s*%\s*(direct|indirect)/i.exec(String(sv == null ? "" : sv));
    if (!m) return null;
    var pct = Math.max(0, Math.min(100, parseInt(m[1], 10) || 0));
    return /indirect/i.test(m[2]) ? 100 - pct : pct;
  }
  function _agNorm(s) {
    return String(s == null ? "" : s).trim().toLowerCase();
  }
  function entryToVorm(entry, forms) {
    forms = forms || [];
    if (!entry) return null;
    var labels = _agEntryLabels(entry).map(_agNorm).filter(Boolean);
    for (var i = 0; i < forms.length; i++) {
      var fl = (Array.isArray(forms[i].labels) ? forms[i].labels : []).map(_agNorm);
      if (fl.some(function(x) {
        return x && labels.indexOf(x) !== -1;
      })) return forms[i];
    }
    var ht = _agNorm(entry.hourType);
    if (ht) {
      for (var j = 0; j < forms.length; j++) {
        if (_agNorm(forms[j].uursoort) === ht) return forms[j];
      }
    }
    for (var k = 0; k < forms.length; k++) {
      var vn = _agNorm(forms[k].vorm);
      if (vn && labels.indexOf(vn) !== -1) return forms[k];
    }
    return null;
  }
  var AGENDA_TRAVEL_DIVISOR = 1;
  function computeDirectIndirect(entry, forms) {
    var min = _entryMinutes(entry);
    var travelRaw = (entry && entry.travelBefore || 0) + (entry && entry.travelAfter || 0);
    var travel = travelRaw / AGENDA_TRAVEL_DIVISOR;
    var vorm = entryToVorm(entry, forms);
    var directPct = vorm ? parseStartVerdeling(vorm.startVerdeling) : null;
    if (directPct == null) {
      var labels = _agEntryLabels(entry).map(_agNorm);
      if (labels.some(function(l) {
        return /\bindirect\b/.test(l);
      })) directPct = 0;
      else if (labels.some(function(l) {
        return /\bdirect\b/.test(l);
      })) directPct = 100;
      else if (!labels.length && entry && entry.clientPresent) directPct = 100;
    }
    if (directPct == null) return { directMin: 0, indirectMin: 0, unknownMin: min, travelMin: travel };
    var directMin = min * directPct / 100;
    return { directMin, indirectMin: min - directMin, unknownMin: 0, travelMin: travel };
  }
  function summarizeAgendaWeek(entries, forms, choices) {
    forms = forms || (typeof APP_CONFIG !== "undefined" && APP_CONFIG && APP_CONFIG.registrationForms || []);
    choices = choices || (typeof APP_CONFIG !== "undefined" && APP_CONFIG && APP_CONFIG.choices || []);
    var list = Array.isArray(entries) ? entries : [];
    var totalMin = 0, clientMin = 0, nonClientMin = 0, directMin = 0, indirectMin = 0, unknownMin = 0, travelMin = 0, typeMap = {}, dateMap = {};
    list.forEach(function(e) {
      var min = _entryMinutes(e);
      totalMin += min;
      if (e && e.clientPresent) clientMin += min;
      else nonClientMin += min;
      var di = computeDirectIndirect(e, forms);
      directMin += di.directMin;
      indirectMin += di.indirectMin;
      unknownMin += di.unknownMin;
      travelMin += di.travelMin;
      var t = agendaEntryType(e, choices);
      if (!typeMap[t]) typeMap[t] = { type: t, minutes: 0, count: 0 };
      typeMap[t].minutes += min;
      typeMap[t].count += 1;
      var d = e && e.date || "onbekend";
      if (!dateMap[d]) dateMap[d] = { date: d, minutes: 0, direct: 0, indirect: 0, unknown: 0, travel: 0, count: 0 };
      dateMap[d].minutes += min;
      dateMap[d].direct += di.directMin;
      dateMap[d].indirect += di.indirectMin;
      dateMap[d].unknown += di.unknownMin;
      dateMap[d].travel += di.travelMin;
      dateMap[d].count += 1;
    });
    var round2 = function(m) {
      return Math.round(m);
    };
    var byType = Object.keys(typeMap).map(function(k) {
      return { type: typeMap[k].type, minutes: round2(typeMap[k].minutes), count: typeMap[k].count };
    }).sort(function(a, b) {
      return b.minutes - a.minutes;
    });
    var byDate = Object.keys(dateMap).map(function(k) {
      var r = dateMap[k];
      return { date: r.date, minutes: round2(r.minutes), direct: round2(r.direct), indirect: round2(r.indirect), unknown: round2(r.unknown), travel: round2(r.travel), count: r.count };
    }).sort(function(a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
    var base = directMin + indirectMin;
    var directPct = base > 0 ? directMin / base * 100 : 0;
    return {
      count: list.length,
      totalMinutes: round2(totalMin),
      clientMinutes: round2(clientMin),
      nonClientMinutes: round2(nonClientMin),
      directMinutes: round2(directMin),
      indirectMinutes: round2(indirectMin),
      unknownMinutes: round2(unknownMin),
      travelMinutes: round2(travelMin),
      directPct: Math.round(directPct * 10) / 10,
      directTargetPct: 80,
      byType,
      byDate
    };
  }

  // src/content/services/ons-api/endpoints.js
  var _API_DEFAULTS = {
    weekEvents: "/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=events",
    weekUnavailabilities: "/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=unavailabilities",
    weekOutlook: "/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=outlook_appointments",
    weekPlannedVisits: "/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=planned_visits",
    weekReservations: "/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=reservations",
    weekRegistrations: "/calendar/invitee/{inviteeId}/entries/week?date={date}&layer=registrations&sub_layers[]=registrations/created",
    registrationDetails: "/calendar/invitee/{inviteeId}/registrations/{occurrenceId}/details",
    eventDetails: "/calendar/invitee/{inviteeId}/events/{occurrenceId}/details",
    searchClients: "/search_panel/clients?term={term}&usage=event&out_of_care={outOfCare}&page=1",
    availableLabels: "/calendar/events/available_labels",
    createEvent: "/calendar/events",
    productOptions: "/product_selection/product_list?employee_ids%5B%5D={employeeId}&client_ids%5B%5D={clientId}",
    productList: "/product_selection/product_list?date={date}&employee_ids[]={employeeId}&client_ids[]={clientId}",
    calendarVariables: "/calendar/calendar_variables?date={date}",
    unavailabilities: "/calendar/unavailabilities",
    employeeRegistrations: "/gateway/api/v0/agenda/user/widgets/employee_registrations_overview/registrations?date={date}&open=false&includeUnregistered=false&withoutClient=false&offset={offset}&limit={limit}",
    detectOverlap: "/worksheet/registrations/detect_overlap?date={date}&start_time={startTime}&end_time={endTime}&hour_type_id={hourTypeId}",
    // duration in SECONDEN (900 = 15 minuten), start_time als HH:MM.
    // Nieuw afspraakformulier, zoals ONS het zelf opent. Datum en begintijd
    // vult de hulp daarna in het formulier in (features/appointment/prefill.js).
    // Meer invitees: {inviteeId} wordt herhaald (zie newEventUrl).
    newEvent: "/events/new?invitee_ids%5B%5D={inviteeId}&redirect_to_calendar=true",
    newRegistration: "/invitees/{inviteeId}/registrations/new?declaration%5Bstart_date%5D={date}&declaration%5Bstart_time%5D={startTime}&declaration%5Bduration%5D={durationSec}&redirect_to_calendar=true"
  };
  function _apiTemplate(name) {
    try {
      var eps = typeof APP_CONFIG !== "undefined" && APP_CONFIG && APP_CONFIG.apiEndpoints || {};
      var t = eps[name];
      if (typeof t === "string" && t.charAt(0) === "/") return t;
    } catch (e) {
    }
    return _API_DEFAULTS[name];
  }
  function _apiUrl(name, vars) {
    vars = vars || {};
    return _apiTemplate(name).replace(/\{(\w+)\}/g, function(m, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? encodeURIComponent(vars[k]) : m;
    });
  }

  // src/content/services/ons-api/http.js
  async function getJson(url) {
    const response = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }
  async function postJson(url, body) {
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest"
    };
    const token = csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers,
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response;
  }
  function csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta && meta.getAttribute("content") || "";
  }

  // src/shared/messages.js
  var MSG = {
    // CS -> SW
    BADGE: "badge",
    // { count }       aantal openstaande dagen op het icoon
    SUMMARY: "summary",
    // { openDays, … } momentopname (alleen getallen en datums)
    FORMS: "forms",
    // { forms: [] }   registratievormen voor het rechtermuismenu
    OPEN_SIDE_PANEL: "open-side-panel",
    //                 randlipje vraagt het zijpaneel te openen
    SIDEPANEL_QUERY: "sidepanel-query",
    //  -> { open }    staat het zijpaneel open voor dit tabblad?
    OPEN_TAB: "open-tab",
    // { url } -> { ok } https-pagina in een nieuw tabblad (AFAS na verlof)
    // SW -> CS
    CTX_REGISTER: "ctx-register",
    // { vorm }        keuze uit het rechtermuismenu
    SIDEPANEL_STATE: "sidepanel-state",
    // { open }        (ook SP -> CS)
    // PU -> SW
    REMINDER_GET: "reminder-get",
    //  -> { settings, snapshot }
    REMINDER_SETTINGS: "reminder-settings",
    // { enabled, weekday, hour, minute } -> { ok, settings }
    REMINDER_TEST: "reminder-test",
    //  -> { ok }      melding nu tonen (handmatig testen)
    // CS -> SP (uitgezonden; de service worker negeert ze)
    AGENDA_STATE: "ag-state",
    // { state }       toestand van de Agendahulp
    AGENDA_GONE: "ag-gone",
    //                 agenda verlaten
    SURVEY_STATE: "survey-state",
    // { state }       toestand van de vragenlijst-checklist
    SURVEY_GONE: "survey-gone",
    //                 vragenlijst verlaten
    // SP -> CS (naar het gevolgde tabblad)
    AGENDA_GET_STATE: "ag-get-state",
    //  -> { state }
    AGENDA_TOGGLE_ENABLED: "ag-toggle-enabled",
    // { value }
    AGENDA_JUMP_DAY: "ag-jump-day",
    // { date }
    AGENDA_JUMP_WEEK: "ag-jump-week",
    AGENDA_OPEN_OCCURRENCE: "ag-open-occurrence",
    // { id }
    AGENDA_OPEN_LEAVE: "ag-open-leave",
    //                 verlofdialoog openen in de pagina
    AGENDA_CHECK_RANGE: "ag-check-range",
    // { from, to } -> { ok, result | error }  open registraties in een periode
    AGENDA_QUICK_REGISTER: "ag-quick-register",
    // { date, time, minutes, force } -> { ok, overlap?, error? }
    AGENDA_NEW_EVENT: "ag-new-event",
    // { date, time, minutes, extra?: [{ date, time }] } -> { ok, error? }  afspraakformulier openen (extra: kopieën na opslaan)
    AGENDA_DUPLICATES_DONE: "ag-duplicates-done",
    // content -> zijpaneel: { made, failed, reason }  kopieën van een afspraak
    AGENDA_DAY_ROUTE: "ag-day-route",
    // { date, origin } -> { ok, result: { persons: [{ stops, missing, urls }] } | error }  route van de dag
    AGENDA_SLOT_CHECK: "ag-slot-check",
    // { date, startMin, minutes } -> { ok, status, overlap }  ONS' overlapcontrole
    AGENDA_EVENT_OPTIONS: "ag-event-options",
    // { clientIds } -> { ok, labels: [{ id, name }], hourTypes: { clientId: [{ id, name, recent }] }, metaKnown }
    AGENDA_CREATE_EVENTS: "ag-create-events",
    // { events: [{ date, startMin, minutes, clientId, hourTypeId, labelId, name, travelBefore, travelAfter }] } -> { ok, results: [{ ok, error? }] }
    AGENDA_RELOAD: "ag-reload",
    //                 agenda verversen (na afspraken maken)
    AGENDA_CLIENT_SEARCH: "ag-client-search",
    // { term } -> { ok, clients: [{ id, name, pc, number, birth }] }  planhulp: meerdere afspraken
    AGENDA_FREE_SLOTS: "ag-free-slots",
    // { minutes, weeks, to? } -> { ok, result: { gaps, ... } | error }  planhulp (to: zoek tot en met die datum)
    AGENDA_WEEK_RATIO: "ag-week-ratio",
    // { date } -> { ok, result: { weekStart, week, mode, rows } | error }
    AGENDA_PRODUCTION: "ag-production",
    // { from, to } -> { ok, result | error }  cliënttijd per week
    // CS -> SP (uitgezonden)
    AGENDA_RANGE_PROGRESS: "ag-range-progress",
    // { kind: 'open'|'productie', done, total } voortgang
    SURVEY_GET_STATE: "survey-get-state",
    //  -> { state }
    SURVEY_OPEN_ITEM: "survey-open-item"
    // { index }
  };
  var PAGE_BRIDGE = {
    MARKER: "__onsah",
    TO_MAIN: "to-main",
    FROM_MAIN: "from-main"
  };

  // src/content/services/ons-api/event-details.js
  function _detailsBody(json) {
    if (!json || typeof json !== "object") return null;
    var keys = ["data", "event", "occurrence", "registration", "entry"];
    for (var i = 0; i < keys.length; i++) {
      var v = json[keys[i]];
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    }
    return json;
  }
  function detailsLabelNames(json) {
    var body = _detailsBody(json);
    if (!body) return [];
    return _agEntryLabels(body);
  }
  var _laatsteDetails = null;
  var DETAILS_MAX_AGE_MS = 5 * 60 * 1e3;
  function _occurrenceIdFromDetailsUrl(url) {
    var m = /\/(?:events|registrations)\/([^/?#]+)\/details/.exec(String(url == null ? "" : url));
    return m ? m[1] : null;
  }
  function noteDetailsResponse(url, json) {
    var labels = detailsLabelNames(json);
    if (!labels.length) return [];
    _laatsteDetails = {
      occurrenceId: _occurrenceIdFromDetailsUrl(url),
      url: String(url == null ? "" : url),
      labels,
      ts: Date.now()
    };
    return labels;
  }
  function clearLaatsteDetails() {
    _laatsteDetails = null;
  }
  function laatsteDetailsLabels() {
    if (!_laatsteDetails) return [];
    if (Date.now() - _laatsteDetails.ts > DETAILS_MAX_AGE_MS) return [];
    return _laatsteDetails.labels.slice();
  }
  function fetchEventDetailsLabels(occurrenceId, inviteeId) {
    var id = inviteeId != null ? inviteeId : resolveInviteeId();
    if (id == null || !occurrenceId) return Promise.resolve([]);
    var url = _apiUrl("eventDetails", { inviteeId: id, occurrenceId });
    return getJson(url).then(function(j) {
      return noteDetailsResponse(url, j);
    }).catch(function() {
      return [];
    });
  }
  function occurrenceIdFromPopover(scope) {
    var root = scope || document;
    var nodes;
    try {
      nodes = root.querySelectorAll("a[href], [data-qa-url]");
    } catch (e) {
      return null;
    }
    for (var i = 0; i < nodes.length; i++) {
      var v = nodes[i].getAttribute("data-qa-url") || nodes[i].getAttribute("href") || "";
      var m = /\/(?:events|registrations)\/([^/?#]+)\/(?:details|edit)/.exec(v);
      if (m) return m[1];
    }
    return null;
  }
  function warmPopoverDetails(scope) {
    if (laatsteDetailsLabels().length) return Promise.resolve([]);
    var occ = occurrenceIdFromPopover(scope);
    if (!occ) return Promise.resolve([]);
    return fetchEventDetailsLabels(occ);
  }
  function listenForMainWorldDetails() {
    try {
      window.addEventListener("message", function(ev) {
        if (!ev || ev.origin !== location.origin) return;
        if (ev.source && ev.source !== window) return;
        var d = ev.data;
        if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.FROM_MAIN || d.type !== "details") return;
        if (!Array.isArray(d.labels) || !d.labels.length) return;
        _laatsteDetails = {
          occurrenceId: _occurrenceIdFromDetailsUrl(d.url) || null,
          url: String(d.url == null ? "" : d.url),
          labels: d.labels.map(function(l) {
            return String(l == null ? "" : l).trim();
          }).filter(Boolean),
          ts: Date.now()
        };
      }, false);
    } catch (e) {
    }
  }

  // src/content/domain/registrations.js
  function _regUnwrap(json) {
    if (Array.isArray(json)) return json;
    if (json && typeof json === "object") {
      var keys = ["data", "registrations", "items", "results", "content", "rows"];
      for (var i = 0; i < keys.length; i++) if (Array.isArray(json[keys[i]])) return json[keys[i]];
      if (json.presenceLogs || json.type || json.duration != null || json.startTime) return [json];
    }
    return [];
  }
  function _regFlattenLogs(json) {
    var items = _regUnwrap(json), logs = [];
    items.forEach(function(it) {
      if (it && Array.isArray(it.presenceLogs)) {
        it.presenceLogs.forEach(function(l) {
          if (l) logs.push(l);
        });
      } else if (it && (it.type != null || it.duration != null) && it.type !== "registration") {
        logs.push(it);
      }
    });
    return logs;
  }
  function _regType(t) {
    var s = String(t == null ? "" : t).toLowerCase();
    if (/indirect/.test(s)) return "indirect";
    if (/direct/.test(s)) return "direct";
    if (/travel|reis/.test(s)) return "travel";
    return "overig";
  }
  function normalizeRegistrationLine(r) {
    if (!r || typeof r !== "object") return null;
    var start = r.startTime || r.start_time || null, end = r.endTime || r.end_time || null;
    var dur = typeof r.duration === "number" ? r.duration : start && end ? Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 6e4)) : 0;
    return {
      type: _regType(r.type),
      minutes: dur,
      date: start ? String(start).slice(0, 10) : null,
      removed: !!r.isRemoved,
      status: r.status || null,
      clientPresent: !!(r.client && (r.client.id != null || r.client.externalId != null))
    };
  }
  function summarizeRegistrations(json) {
    var lines = _regFlattenLogs(json).map(normalizeRegistrationLine).filter(function(x) {
      return x && !x.removed;
    });
    var total = 0, direct = 0, indirect = 0, travel = 0, other = 0, clientMin = 0, nonClientMin = 0;
    lines.forEach(function(l) {
      total += l.minutes;
      if (l.type === "direct") direct += l.minutes;
      else if (l.type === "indirect") indirect += l.minutes;
      else if (l.type === "travel") travel += l.minutes;
      else other += l.minutes;
      if (l.clientPresent) clientMin += l.minutes;
      else nonClientMin += l.minutes;
    });
    var base = direct + indirect;
    return {
      count: lines.length,
      totalMinutes: total,
      directMinutes: direct,
      indirectMinutes: indirect,
      travelMinutes: travel,
      otherMinutes: other,
      clientMinutes: clientMin,
      nonClientMinutes: nonClientMin,
      directPct: base > 0 ? Math.round(direct / base * 1e3) / 10 : 0,
      directTargetPct: 80
    };
  }
  function _isWeekendYmd(ymd2) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd2 || ""));
    if (!m) return false;
    var wd = new Date(+m[1], +m[2] - 1, +m[3]).getDay();
    return wd === 0 || wd === 6;
  }
  function _agGenSettings() {
    try {
      return typeof APP_CONFIG !== "undefined" && APP_CONFIG && APP_CONFIG.generalSettings || {};
    } catch (e) {
      return {};
    }
  }
  function _countWeekends() {
    return !!_agGenSettings().countWeekends;
  }
  function _excludeWeekendYmd(ymd2) {
    return _isWeekendYmd(ymd2) && !_countWeekends();
  }
  function _nonClientMarker() {
    var m = _agGenSettings().nonClientMarker;
    return typeof m === "string" && m ? m : "*";
  }
  function _agListSetting(key, dflt) {
    try {
      var v = _agGenSettings()[key];
      if (Array.isArray(v)) return v;
    } catch (e) {
    }
    return dflt;
  }
  function _nonClientUursoortList() {
    return _agListSetting("nonClientUursoorten", []);
  }
  function _excludedStatuses() {
    return _agListSetting("excludedRegistrationStatuses", ["do_not_declare"]);
  }
  function _excludedCalendarTypes() {
    return _agListSetting("excludedCalendarTypes", ["unavailability", "presence"]);
  }
  function parseWeekRegistrationOccurrences(json) {
    var rows = _regUnwrap(json);
    if (!rows.length && json && Array.isArray(json.entries)) rows = json.entries;
    var out = [], seen = /* @__PURE__ */ Object.create(null);
    var exTypes = _excludedCalendarTypes();
    rows.forEach(function(r) {
      if (!r || typeof r !== "object") return;
      for (var x = 0; x < exTypes.length; x++) {
        if (r[exTypes[x]]) return;
      }
      if (r.type != null && String(r.type).toLowerCase() !== "registration") return;
      var dymd = r.date || (r.start_time ? String(r.start_time).slice(0, 10) : "");
      if (_excludeWeekendYmd(dymd)) return;
      var occ = r.occurrence_id || r.occurrenceId || null;
      if (!occ || seen[occ]) return;
      seen[occ] = 1;
      out.push({ occurrenceId: String(occ), clientPresent: Array.isArray(r.clients) && r.clients.length > 0 });
    });
    return out;
  }
  function parseRegistrationDetails(json) {
    if (!json || typeof json !== "object") return null;
    if (!json.registration) {
      var exT = _excludedCalendarTypes();
      for (var x = 0; x < exT.length; x++) {
        if (json[exT[x]]) return null;
      }
    }
    var r = json.registration ? json.registration : json;
    if (!r || typeof r !== "object") return null;
    if (r.declaration && typeof r.declaration === "object" && r.declaration.status != null) {
      var st = String(r.declaration.status), exS = _excludedStatuses();
      for (var y = 0; y < exS.length; y++) {
        if (st === String(exS[y])) return null;
      }
    }
    var dymd = r.date || (r.start_time ? String(r.start_time).slice(0, 10) : "");
    if (_excludeWeekendYmd(dymd)) return null;
    var num = function(v) {
      return typeof v === "number" && isFinite(v) ? v : 0;
    };
    var ht = r.hour_type && typeof r.hour_type === "object" ? r.hour_type : null;
    var htName = ht && ht.name != null ? String(ht.name) : "";
    var htId = ht && ht.id != null ? ht.id : null;
    if (!htName && Array.isArray(r.clients)) {
      for (var ci = 0; ci < r.clients.length; ci++) {
        var cht = r.clients[ci] && r.clients[ci].hour_type;
        if (cht && cht.name != null && String(cht.name).trim()) {
          htName = String(cht.name);
          if (htId == null && cht.id != null) htId = cht.id;
          break;
        }
      }
    }
    var direct = num(r.direct_time), indirect = num(r.indirect_time);
    var travel = num(r.travel_time_before) + num(r.travel_time_after);
    var durMin = 0;
    var st = r.start_time, et = r.end_time;
    if (st && et) {
      var ms = Date.parse(et) - Date.parse(st);
      if (isFinite(ms) && ms > 0) durMin = Math.round(ms / 6e4);
    }
    if (!durMin && r.time_slot && typeof r.time_slot.duration === "number") durMin = Math.round(r.time_slot.duration / 60);
    var accounted = direct + indirect + travel;
    var otherMin = Math.max(0, durMin - accounted);
    return {
      directMin: direct,
      indirectMin: indirect,
      travelMin: travel,
      otherMin,
      durationMin: durMin || accounted,
      hourTypeName: htName,
      hourTypeId: htId
    };
  }
  function summarizeWeekRegistrations(detailsList) {
    var direct = 0, indirect = 0, travel = 0, other = 0, count = 0, byType = /* @__PURE__ */ Object.create(null);
    var n = function(v) {
      return typeof v === "number" && isFinite(v) ? v : 0;
    };
    (detailsList || []).forEach(function(d) {
      if (!d) return;
      var dir = n(d.directMin), ind = n(d.indirectMin), tra = n(d.travelMin), oth = n(d.otherMin);
      count++;
      direct += dir;
      indirect += ind;
      travel += tra;
      other += oth;
      var name = d.hourTypeName || "Onbekend";
      if (!byType[name]) byType[name] = { type: name, direct: 0, indirect: 0, travel: 0, other: 0 };
      byType[name].direct += dir;
      byType[name].indirect += ind;
      byType[name].travel += tra;
      byType[name].other += oth;
    });
    var clientMin = direct + indirect + travel;
    var nonClientMin = other;
    var total = direct + indirect + travel + other;
    var byHourType = Object.keys(byType).map(function(k) {
      var r = byType[k];
      r.minutes = r.direct + r.indirect + r.travel + r.other;
      return r;
    }).sort(function(a, b) {
      return b.minutes - a.minutes;
    });
    return {
      count,
      totalMinutes: total,
      directMinutes: direct,
      indirectMinutes: indirect,
      travelMinutes: travel,
      otherMinutes: other,
      unknownMinutes: other,
      // 4e verdeling-vak toont de niet-cliënt/overige tijd
      clientMinutes: clientMin,
      nonClientMinutes: nonClientMin,
      directPct: direct + indirect > 0 ? Math.round(direct / (direct + indirect) * 1e3) / 10 : 0,
      directTargetPct: 80,
      byHourType,
      byType: byHourType
      // per-uursoort opbouw; agendaWeekPanelEl toont .minutes
    };
  }

  // src/content/domain/open-registrations.js
  function isDeclaredClasses(classes) {
    var c = " " + String(classes || "") + " ";
    if (/not-declared/.test(c)) return false;
    return /declared/.test(c);
  }
  function isWontDeclareClasses(classes) {
    return /(^|\s)wont-declare(\s|$)/.test(String(classes || ""));
  }
  function classifyAgendaEntry(e, now, lateMs) {
    if (!e || e.type !== "event" || e.allDay) return null;
    var date = e.date;
    if (!date) return null;
    if (_excludeWeekendYmd(date)) return null;
    var hasClient = !!e.clientPresent;
    var hasUursoort = !!(e.hourType && String(e.hourType).trim());
    if (!hasClient && !hasUursoort) return null;
    var dur = _entryMinutes(e);
    if (!(dur > 0)) return null;
    var startMs = e.startMs != null ? e.startMs : Date.parse(date + "T00:00:00");
    var endMs = e.endMs != null ? e.endMs : startMs + dur * 6e4;
    var past = endMs <= now;
    return {
      date,
      cls: hasClient ? "client" : "overig",
      minutes: dur,
      startMs,
      endMs,
      past,
      // 'Niet registreren' (wont-declare) telt als afgehandeld, net als geregistreerd.
      declared: isDeclaredClasses(e.classes) || isWontDeclareClasses(e.classes),
      late: past && endMs <= now - lateMs
    };
  }
  function parseYmd(ymd2) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd2 || ""));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtYmd(d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function weekStartsBetween(fromYmd, toYmd) {
    var a = parseYmd(fromYmd), b = parseYmd(toYmd);
    if (!a || !b || a > b) return [];
    var mon = new Date(a.getFullYear(), a.getMonth(), a.getDate() - (a.getDay() + 6) % 7);
    var out = [];
    while (mon <= b) {
      out.push(fmtYmd(mon));
      mon = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
    }
    return out;
  }
  function summarizeOpenRange(entries, opts) {
    opts = opts || {};
    var now = opts.now != null ? opts.now : Date.now();
    var lateMs = (opts.lateHours > 0 ? opts.lateHours : 24) * 36e5;
    var from = opts.from || "0000-00-00", to = opts.to || "9999-99-99";
    var byDay = /* @__PURE__ */ Object.create(null), seen = /* @__PURE__ */ Object.create(null);
    (entries || []).forEach(function(e) {
      if (!e) return;
      if (e.id != null) {
        var k = String(e.id) + "|" + (e.date || "");
        if (seen[k]) return;
        seen[k] = 1;
      }
      var c = classifyAgendaEntry(e, now, lateMs);
      if (!c || !c.past || c.declared) return;
      if (c.date < from || c.date > to) return;
      var day = byDay[c.date] || (byDay[c.date] = { date: c.date, client: 0, overig: 0, count: 0, lateCount: 0, items: [] });
      day[c.cls] += c.minutes;
      day.count++;
      if (c.late) day.lateCount++;
      day.items.push({
        // Sleutel om bij een nieuwe controle te zien of deze afspraak is afgewerkt.
        key: (e.id != null ? String(e.id) : "x") + "|" + c.date + "|" + c.startMs,
        start: c.startMs,
        minutes: c.minutes,
        client: c.cls === "client",
        late: c.late,
        uursoort: e.hourType && String(e.hourType).trim() || ""
      });
    });
    var days = Object.keys(byDay).sort().map(function(d) {
      byDay[d].items.sort(function(x, y) {
        return x.start - y.start;
      });
      return byDay[d];
    });
    return {
      days,
      totalMinutes: days.reduce(function(t, d) {
        return t + d.client + d.overig;
      }, 0),
      totalCount: days.reduce(function(t, d) {
        return t + d.count;
      }, 0),
      lateCount: days.reduce(function(t, d) {
        return t + d.lateCount;
      }, 0)
    };
  }
  function parseDetectOverlap(json) {
    if (typeof json === "boolean") return json;
    if (Array.isArray(json)) return json.length > 0;
    if (!json || typeof json !== "object") return null;
    var boolKeys = ["overlap", "overlaps", "has_overlap", "hasOverlap", "overlapping", "is_overlapping", "isOverlapping"];
    for (var i = 0; i < boolKeys.length; i++) {
      var v = json[boolKeys[i]];
      if (typeof v === "boolean") return v;
      if (Array.isArray(v)) return v.length > 0;
    }
    var listKeys = ["registrations", "overlapping_registrations", "conflicts", "items", "data"];
    for (var j = 0; j < listKeys.length; j++) {
      if (Array.isArray(json[listKeys[j]])) return json[listKeys[j]].length > 0;
    }
    return null;
  }
  function isoLocalWithOffset(ymd2, minutes) {
    var d = parseYmd(ymd2);
    if (!d || typeof minutes !== "number" || !(minutes >= 0) || minutes >= 24 * 60) return null;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutes / 60), minutes % 60);
    var off = -d.getTimezoneOffset();
    var sign = off >= 0 ? "+" : "-";
    var abs = Math.abs(off);
    var pad = function(n) {
      return ("0" + n).slice(-2);
    };
    return fmtYmd(d) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":00" + sign + pad(Math.floor(abs / 60)) + ":" + pad(abs % 60);
  }

  // src/content/domain/event-overlap.js
  var OVERLAP_PATH = "/event_planner/overlap_detection";
  var WEG = /client|cli%c3%abnt|cliënt|patient|title|titel|descr|omschr|note|remark|opmerk|comment|name|naam|subject|onderwerp|address|adres|email|phone|telefoon|bsn/i;
  var EIGEN_AFSPRAAK = /event_id|eventid|occurrence|exclude|except|ignore/i;
  var EIND = /end|eind|until|till|stop|(^|[_\[])to(\]|$)/i;
  var BEGIN = /start|begin|from|(^|[_\[])van(\]|$)/i;
  function paren(query) {
    var uit = [];
    String(query || "").replace(/^\?/, "").split("&").forEach(function(p) {
      if (!p) return;
      var i = p.indexOf("=");
      var k = i < 0 ? p : p.slice(0, i), v = i < 0 ? "" : p.slice(i + 1);
      try {
        k = decodeURIComponent(k.replace(/\+/g, " "));
        v = decodeURIComponent(v.replace(/\+/g, " "));
      } catch (e) {
        return;
      }
      uit.push([k, v]);
    });
    return uit;
  }
  function soortWaarde(v) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return "iso";
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return "date";
    if (/^\d{2}-\d{2}-\d{4}$/.test(v)) return "dateNl";
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(v)) return "time";
    return "";
  }
  function isoVorm(v) {
    if (/Z$/i.test(v)) return "utc";
    if (/[+-]\d{2}:?\d{2}$/.test(v)) return "offset";
    return /T\d{2}:\d{2}:\d{2}/.test(v) ? "naiefSec" : "naief";
  }
  function minutenUit(soort, v) {
    if (soort === "time") {
      var t = v.split(":");
      return +t[0] * 60 + +t[1];
    }
    if (soort === "iso") {
      var m = /T(\d{2}):(\d{2})/.exec(v);
      return m ? +m[1] * 60 + +m[2] : null;
    }
    return null;
  }
  function learnOverlapTemplate(url) {
    var s = String(url || "");
    var q = s.indexOf("?");
    var pad = (q < 0 ? s : s.slice(0, q)).replace(/^https?:\/\/[^/]+/i, "");
    if (pad !== OVERLAP_PATH) return null;
    var params = [], gezien = /* @__PURE__ */ Object.create(null);
    var tijden = { start: null, end: null }, duurIdx = -1, kapot = false;
    paren(q < 0 ? "" : s.slice(q + 1)).forEach(function(kv) {
      var k = kv[0], v = kv[1], lk = k.toLowerCase();
      if (WEG.test(lk) || EIGEN_AFSPRAAK.test(lk)) return;
      if (/invitee|employee|medewerker|participant|user_id/.test(lk) && /^\d+(,\d+)*$/.test(v)) {
        if (gezien[k]) {
          gezien[k].herhaald = true;
          return;
        }
        var p = { key: k, role: "invitee", sep: v.indexOf(",") >= 0 ? "," : "" };
        gezien[k] = p;
        params.push(p);
        return;
      }
      var soort = soortWaarde(v);
      if (soort) {
        var eind = EIND.test(lk) && !BEGIN.test(lk);
        var kant = eind ? "end" : BEGIN.test(lk) ? "start" : null;
        var basis = soort === "iso" ? "Iso" : soort === "time" ? "Time" : "Date";
        if (!kant) kant = params.some(function(x) {
          return x.role === "start" + basis;
        }) ? "end" : "start";
        var rol = kant + basis;
        if (params.some(function(x) {
          return x.role === rol;
        })) {
          kapot = true;
          return;
        }
        var item = { key: k, role: rol };
        if (soort === "iso") item.form = isoVorm(v);
        if (soort === "dateNl") item.form = "nl";
        if (soort === "time") item.form = /:\d{2}:\d{2}$/.test(v) ? "hms" : "hm";
        var min = minutenUit(soort, v);
        if (min != null) tijden[kant] = min;
        params.push(item);
        return;
      }
      if (/duration|duur|length|lengte/.test(lk) && /^\d+$/.test(v)) {
        duurIdx = params.length;
        params.push({ key: k, role: "duration", raw: +v });
        return;
      }
      if (/^[\w.\-:+]{0,40}$/.test(v)) params.push({ key: k, role: "literal", value: v });
    });
    if (kapot) return null;
    if (duurIdx >= 0) {
      var d = params[duurIdx], raw = d.raw;
      delete d.raw;
      var verschil = tijden.start != null && tijden.end != null ? tijden.end - tijden.start : null;
      if (verschil > 0) d.unit = raw === verschil * 60 ? "sec" : "min";
      else d.unit = raw >= 600 && raw % 60 === 0 ? "sec" : "min";
    }
    var heeft = function(r) {
      return params.some(function(x) {
        return x.role === r;
      });
    };
    var begin = heeft("startIso") || heeft("startDate") && heeft("startTime");
    var eindOk = heeft("endIso") || heeft("endTime") || heeft("duration");
    if (!heeft("invitee") || !begin || !eindOk) return null;
    params.forEach(function(x) {
      if (gezien[x.key] === x) x.repeat = !!x.herhaald || /\[\]$/.test(x.key);
      delete x.herhaald;
    });
    return { path: OVERLAP_PATH, params };
  }
  function twee(n) {
    return ("0" + n).slice(-2);
  }
  function ymdNl(ymd2) {
    var p = ymd2.split("-");
    return p[2] + "-" + p[1] + "-" + p[0];
  }
  function isoIn(ymd2, min, vorm) {
    var off = isoLocalWithOffset(ymd2, min);
    if (!off) return null;
    if (vorm === "offset") return off;
    if (vorm === "utc") return new Date(off).toISOString().replace(/\.\d{3}Z$/, "Z");
    var naief = off.slice(0, 19);
    return vorm === "naief" ? naief.slice(0, 16) : naief;
  }
  function buildOverlapUrl(tpl, req) {
    if (!tpl || !Array.isArray(tpl.params) || !req) return null;
    var ids = (req.ids || []).map(String).filter(function(x) {
      return /^\d+$/.test(x);
    });
    var ymd2 = String(req.date || ""), s = req.startMin, e = req.endMin;
    if (!ids.length || !/^\d{4}-\d{2}-\d{2}$/.test(ymd2) || !(s >= 0) || !(e > s) || e > 24 * 60) return null;
    var delen = [], fout = false;
    var zet = function(k, v) {
      delen.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
    };
    tpl.params.forEach(function(p) {
      switch (p.role) {
        case "invitee":
          if (p.sep) zet(p.key, ids.join(p.sep));
          else if (p.repeat) ids.forEach(function(id) {
            zet(p.key, id);
          });
          else zet(p.key, ids[0]);
          break;
        case "literal":
          zet(p.key, p.value == null ? "" : p.value);
          break;
        case "startIso":
        case "endIso": {
          var iso = isoIn(ymd2, p.role === "startIso" ? s : e, p.form);
          if (!iso) fout = true;
          else zet(p.key, iso);
          break;
        }
        case "startDate":
        case "endDate":
          zet(p.key, p.form === "nl" ? ymdNl(ymd2) : ymd2);
          break;
        case "startTime":
        case "endTime": {
          var m = p.role === "startTime" ? s : e;
          zet(p.key, twee(Math.floor(m / 60)) + ":" + twee(m % 60) + (p.form === "hms" ? ":00" : ""));
          break;
        }
        case "duration":
          zet(p.key, String(p.unit === "sec" ? (e - s) * 60 : e - s));
          break;
        default:
          fout = true;
      }
    });
    if (fout) return null;
    return tpl.path + "?" + delen.join("&");
  }
  function parseEventOverlap(json) {
    var bekend = parseDetectOverlap(json);
    if (bekend !== null) return bekend;
    if (!json || typeof json !== "object") return null;
    var keys = Object.keys(json);
    for (var i = 0; i < keys.length; i++) {
      if (!/overlap|conflict/i.test(keys[i])) continue;
      var v = json[keys[i]];
      if (typeof v === "boolean") return v;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "number") return v > 0;
    }
    var lijsten = keys.filter(function(k) {
      return Array.isArray(json[k]);
    });
    if (keys.length && lijsten.length === keys.length) return lijsten.some(function(k) {
      return json[k].length > 0;
    });
    return null;
  }

  // src/content/services/ons-api/event-overlap.js
  var KEY = PAGE_LOCAL.EVENT_OVERLAP_TEMPLATE;
  function loadOverlapTemplate() {
    try {
      const t = JSON.parse(localStorage.getItem(KEY) || "null");
      return t && Array.isArray(t.params) ? t : null;
    } catch (e) {
      return null;
    }
  }
  function saveOverlapTemplate(t) {
    try {
      localStorage.setItem(KEY, JSON.stringify(t));
    } catch (e) {
    }
  }
  function overlapCheckStatus() {
    const t = loadOverlapTemplate();
    if (!t) return "unknown";
    return t.readable ? "ready" : "unreadable";
  }
  function learnFromOnsCall(url, body) {
    const tpl = learnOverlapTemplate(url);
    if (!tpl) return false;
    let json = null;
    try {
      json = JSON.parse(String(body || ""));
    } catch (e) {
    }
    tpl.readable = parseEventOverlap(json) !== null;
    tpl.learnedAt = Date.now();
    saveOverlapTemplate(tpl);
    return true;
  }
  function listenForOnsOverlapCalls() {
    try {
      window.addEventListener("message", function(ev) {
        if (!ev || ev.origin !== location.origin) return;
        if (ev.source && ev.source !== window) return;
        const d = ev.data;
        if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.FROM_MAIN || d.type !== "eventOverlap") return;
        learnFromOnsCall(d.url, d.body);
      }, false);
    } catch (e) {
    }
  }
  function fetchEventOverlap(req) {
    const t = loadOverlapTemplate();
    if (!t || !t.readable) return Promise.resolve(null);
    const url = buildOverlapUrl(t, req);
    if (!url) return Promise.resolve(null);
    return getJson(url).then(parseEventOverlap, function() {
      return null;
    });
  }

  // src/content/domain/event-duplicate.js
  var HERHALING = /recurr|repeat|rrule|frequen|interval|valid_until|herhal/i;
  function heeftWaarde(v) {
    if (v == null || v === false || v === "" || v === 0) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).some(function(k) {
      return heeftWaarde(v[k]);
    });
    return true;
  }
  function lokaleDagEnMinuut(iso) {
    var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(String(iso || ""));
    return m ? { date: m[1], min: +m[2] * 60 + +m[3] } : null;
  }
  function inspectEventPayload(payload) {
    var ev = payload && payload.event;
    if (!ev || typeof ev !== "object") return { ok: false, reason: "geen afspraak" };
    var s = Date.parse(ev.start_time), e = Date.parse(ev.end_time);
    if (!(e > s)) return { ok: false, reason: "geen begin- en eindtijd" };
    var herhaald = Object.keys(ev).some(function(k) {
      return HERHALING.test(k) && heeftWaarde(ev[k]);
    });
    if (herhaald) return { ok: false, reason: "herhalende afspraak" };
    var b = lokaleDagEnMinuut(ev.start_time);
    if (!b) return { ok: false, reason: "onbekende tijdnotatie" };
    return { ok: true, date: b.date, startMin: b.min, minutes: Math.round((e - s) / 6e4) };
  }
  function duplicateEventPayload(payload, moment) {
    var info = inspectEventPayload(payload);
    if (!info.ok || !moment || !/^\d{4}-\d{2}-\d{2}$/.test(String(moment.date || ""))) return null;
    var start = moment.startMin, eind = start + info.minutes;
    if (!(start >= 0) || eind > 24 * 60) return null;
    var van = isoLocalWithOffset(moment.date, start);
    var tot = eind === 24 * 60 ? null : isoLocalWithOffset(moment.date, eind);
    if (!van || !tot) return null;
    var kopie = JSON.parse(JSON.stringify(payload));
    var ev = kopie.event;
    delete ev.id;
    delete ev.occurrence_id;
    ev.start_time = van;
    ev.end_time = tot;
    ev.valid_from = moment.date;
    return kopie;
  }
  function remainingMoments(payload, moments) {
    var info = inspectEventPayload(payload);
    var gezien = /* @__PURE__ */ Object.create(null);
    if (info.ok) gezien[info.date + "|" + info.startMin] = true;
    return (moments || []).filter(function(m) {
      if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(String(m.date || "")) || !(m.startMin >= 0)) return false;
      var k = m.date + "|" + m.startMin;
      if (gezien[k]) return false;
      gezien[k] = true;
      return true;
    }).sort(function(a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin;
    });
  }

  // src/content/ons/selectors.js
  var ONS = {
    dayColumn: ".day.js_day",
    dayColumnCell: "td.calendar_day",
    occurrenceBase: ".js_calendar_occurrence.calendar_occurrence_base",
    occurrenceTitle: ".calendar_occurrence--has-title",
    appointmentTitle: ".appointment-title",
    labelWithTitle: ".labels .label[title]",
    unavailability: '.js_calendar_occurrence.unavailable, [data-type="unavailability"]',
    ucTagDeletable: "uc-tag[deletable]",
    // Detailpopup van een afspraak. ONS heeft deze herbouwd: de wrapper heet nu
    // [data-qa="occurrence-popover"] (met role="dialog"), de labelchips staan in
    // de sectie [data-qa="occurrence-popover-details"] als <uc-tag>, en de
    // Registreren-knop is [data-qa="occurrence-popover-primary"]. De oude
    // selectors blijven ernaast staan zodat beide opmaken blijven werken.
    popoverRoot: '[data-qa="occurrence-popover"], .popup_content, .popup, [role="dialog"]',
    popoverDetails: '[data-qa="occurrence-popover-details"]',
    popoverLabelTag: '.labels uc-tag, [data-qa="occurrence-popover-details"] uc-tag',
    // Alles wat een registratie start vanuit de detailpopup: de nieuwe
    // split-knop + zijn menu-items, en de oude declare-knop.
    declareTrigger: '[data-qa="occurrence-popover-primary"], [data-qa="occurrence-popover-primary-menu"], [data-qa^="occurrence-popover-action-"], [data-qa="declare_button"], #declare-option-link',
    omnisearchTrigger: 'button[data-testid="omnisearch-trigger"]',
    freeDayTextRe: /vaste vrije dag/i,
    weekendClassRe: /\b(saturday|sunday)\b/,
    declaredRe: /\sdeclared\s/,
    notDeclaredRe: /\snot-declared\s/
  };

  // src/content/features/agenda/navigation.js
  function currentInviteeIds() {
    const m = location.href.match(/\/invitees\/(\d+(?:,\d+)*)\/calendar/);
    return m ? m[1].split(",") : [];
  }
  function inviteeName(id) {
    try {
      const kand = document.querySelectorAll('[data-invitee-id="' + id + '"]');
      for (const el of kand) {
        const n = el.getAttribute("data-invitee-name") || el.getAttribute("aria-label") || el.getAttribute("title") || "";
        const t = String(n).replace(/\s+/g, " ").trim();
        if (t && t.length <= 60) return t;
      }
      const naam = document.querySelector('[data-invitee-name][data-invitee-id="' + id + '"], [data-employee-id="' + id + '"][data-employee-name]');
      if (naam) return (naam.getAttribute("data-invitee-name") || naam.getAttribute("data-employee-name") || "").trim() || "Medewerker " + id;
    } catch (e) {
    }
    return "Medewerker " + id;
  }
  function currentInviteeId(date) {
    const ids = currentInviteeIds();
    if (ids.length) return ids[0];
    const col = document.querySelector(ONS.dayColumn + (date ? '[data-date="' + date + '"]' : ""));
    return col ? col.getAttribute("data-invitee-id") : null;
  }
  function viewedInviteeIds(fallback) {
    const ids = currentInviteeIds();
    if (ids.length) return ids;
    const een = currentInviteeId(null) || fallback;
    return een != null ? [String(een)] : [];
  }
  function calendarUrl(view, date, inviteeId) {
    const ids = currentInviteeIds();
    const deel = ids.length > 1 ? ids.join(",") : inviteeId;
    return location.origin + "/invitees/" + deel + "/calendar/" + view + "?date=" + date;
  }
  function currentCalendarView() {
    const m = location.href.match(/\/calendar\/(\w+)/);
    return m ? m[1] : "";
  }
  function spaNavigate(url) {
    try {
      const a = document.createElement("a");
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      location.href = url;
    }
  }
  function jumpToDay(date, always) {
    if (!always && currentCalendarView() === "day") return;
    const id = currentInviteeId(date);
    if (!id) return;
    spaNavigate(calendarUrl("day", date, id));
  }
  function jumpToWeek() {
    const firstCol = document.querySelector(ONS.dayColumn + "[data-date]");
    const date = firstCol && firstCol.getAttribute("data-date") || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const id = currentInviteeId(date);
    if (!id) return;
    spaNavigate(calendarUrl("workweek", date, id));
  }
  function newEventUrl(inviteeId, clientIds, date) {
    var ids = (Array.isArray(inviteeId) ? inviteeId : [inviteeId]).map(String);
    (clientIds || []).forEach(function(c) {
      c = String(c);
      if (/^\d+$/.test(c) && ids.indexOf(c) < 0) ids.push(c);
    });
    var url = _apiUrl("newEvent", { inviteeId: ids[0] });
    var rest = ids.slice(1).map(function(id) {
      return "&invitee_ids%5B%5D=" + encodeURIComponent(id);
    }).join("");
    url = url.replace(/(invitee_ids%5B%5D=[^&]*)/, function(m) {
      return m + rest;
    });
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) url += "&event%5Bstart_date%5D=" + date;
    return url;
  }

  // src/content/ons/selector-overrides.js
  var UI_OVERRIDES = {};
  var CONFIG_UI_SELECTORS = {};
  var LOCAL_UI_SELECTORS = {};
  function _pickStringSelectors(u) {
    const out = {};
    if (u && typeof u === "object") {
      for (const k of Object.keys(u)) if (typeof u[k] === "string" && u[k]) out[k] = u[k];
    }
    return out;
  }
  function overrideEl(key) {
    const sel = UI_OVERRIDES[key];
    if (!sel || typeof sel !== "string") return null;
    try {
      return deepQueryAll(sel).find((el) => visible(el) && !isOwnPopup(el)) || null;
    } catch (e) {
      return null;
    }
  }
  function overrideAll(key) {
    const sel = UI_OVERRIDES[key];
    if (!sel || typeof sel !== "string") return null;
    try {
      return deepQueryAll(sel).filter((el) => visible(el) && !isOwnPopup(el));
    } catch (e) {
      return null;
    }
  }
  function applyCentralUiSelectors() {
    CONFIG.etiketFieldSelector = UI_OVERRIDES.etiketFieldSelector || "";
    CONFIG.uursoortFieldSelector = UI_OVERRIDES.uursoortFieldSelector || "";
    CONFIG.modalPanelSelector = UI_OVERRIDES.modalPanelSelector || "";
  }
  function applyAgendaSelectorOverrides() {
    const map = { agDayColumn: "dayColumn", agDayCell: "dayColumnCell", agOccurrence: "occurrenceBase", agOccurrenceTitle: "occurrenceTitle", agApptTitle: "appointmentTitle", agLabelTitle: "labelWithTitle", agPopover: "popoverRoot", agPopoverLabel: "popoverLabelTag", agDeclare: "declareTrigger" };
    for (const key in map) if (UI_OVERRIDES[key]) ONS[map[key]] = UI_OVERRIDES[key];
  }
  function recomputeUiOverrides() {
    for (const k in UI_OVERRIDES) delete UI_OVERRIDES[k];
    Object.assign(UI_OVERRIDES, CONFIG_UI_SELECTORS, LOCAL_UI_SELECTORS);
    applyCentralUiSelectors();
    applyAgendaSelectorOverrides();
  }
  function seedUiOverridesFromConfig() {
    CONFIG_UI_SELECTORS = _pickStringSelectors(APP_CONFIG.uiSelectors);
    recomputeUiOverrides();
  }
  function watchLocalUiOverrides() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const applyUiOverrides = (o) => {
          LOCAL_UI_SELECTORS = _pickStringSelectors(o);
          recomputeUiOverrides();
        };
        chrome.storage.local.get([LOCAL.UI_OVERRIDES], (res) => {
          applyUiOverrides(res && res[LOCAL.UI_OVERRIDES]);
        });
        if (chrome.storage.onChanged) {
          chrome.storage.onChanged.addListener((changes, area2) => {
            if (area2 === "local" && changes[LOCAL.UI_OVERRIDES]) applyUiOverrides(changes[LOCAL.UI_OVERRIDES].newValue);
          });
        }
      }
    } catch (e) {
    }
  }

  // src/content/ons/modal.js
  function ucButtonIsSecondary(host) {
    const inner = host && host.shadowRoot && host.shadowRoot.querySelector('button[part="button"], button');
    return !!(inner && /\bsecondary\b/.test(inner.className || ""));
  }
  function closeOnsModal() {
    const hosts = deepQueryAll("uc-button").filter((h) => visible(h) && !isOwnPopup(h));
    for (const host of hosts) {
      if (clean(host.textContent || "") === "annuleren" && clickUiButton(host)) return;
    }
    for (const host of hosts) {
      if (ucButtonIsSecondary(host) && clickUiButton(host)) return;
    }
    for (const el of deepQueryAll('button,a,[role="button"]')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const part = el.getAttribute("part") || "";
      const cls = el.className || "";
      const txt = clean(el.textContent || "");
      if (txt === "annuleren" || part === "button" && /\bsecondary\b/.test(cls)) {
        if (clickElementCenter(el)) return;
        try {
          el.click();
          return;
        } catch (e) {
        }
      }
    }
  }
  function findModal() {
    if (CONFIG.modalPanelSelector) {
      const p = document.querySelector(CONFIG.modalPanelSelector);
      if (p) return { host: p, panel: p };
    }
    let cands = deepQueryAll('dialog[open],[role="dialog"],[aria-modal="true"]').filter(visible);
    if (!cands.length) cands = deepQueryAll('[class*="modal" i],[class*="dialog" i]').filter(visible);
    if (!cands.length) return null;
    const withForm = cands.filter((c) => /afspraakdetails|opslaan|afspraak toevoegen/i.test(c.textContent || ""));
    const pool = withForm.length ? withForm : cands;
    const host = [...pool].sort((a, b) => area(b) - area(a))[0];
    const panel = [...pool].sort((a, b) => area(a) - area(b)).find((c) => rect(c).width > 480 && rect(c).width < window.innerWidth * 0.96) || pool[0];
    return { host, panel };
  }

  // src/content/ons/interaction.js
  function fireKey(el, key) {
    if (!el) return;
    if (isProtectedAppointmentStartInput(el)) return;
    for (const type of ["keydown", "keyup"]) {
      try {
        el.dispatchEvent(new KeyboardEvent(type, { key, code: key, bubbles: true, cancelable: true }));
      } catch (e) {
      }
    }
  }
  function clickAt(x, y) {
    const el = document.elementFromPoint(x, y) || document.body;
    if (typeof isAddInviteeControl === "function" && isAddInviteeControl(el) && !appointmentFlow.intentionalAddClientClick && Date.now() >= appointmentFlow.allowInviteeModalUntil) {
      return false;
    }
    for (const type of ["mousedown", "mouseup", "click"]) {
      try {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y }));
      } catch (e) {
      }
    }
    return true;
  }
  function interactiveAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    if (isProtectedAppointmentStartInput(el)) return true;
    if (/^(input|textarea|select|button|a)$/i.test(el.tagName || "")) return true;
    return !!(el.closest && el.closest('button,a,[role="button"],[role="combobox"],uc-button,uc-icon,[data-qa*="add" i],[class*="button" i]'));
  }
  function clickEmptyModalSpot() {
    const m = findModal();
    const panel = m && (m.panel || m.host) || document.body;
    const heading = deepQueryAll("h1,h2,h3,div,span", panel).find((el) => visible(el) && !isOwnPopup(el) && /afspraakdetails|afspraak toevoegen|genodigden/i.test(el.textContent || ""));
    if (heading) {
      const hr = rect(heading);
      const hx = Math.round(hr.left + Math.min(24, Math.max(8, hr.width / 2)));
      const hy = Math.round(hr.top + hr.height / 2);
      if (!interactiveAtPoint(hx, hy)) {
        clickAt(hx, hy);
        return;
      }
    }
    const r = rect(panel);
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = Math.round(r.left + Math.max(24, Math.min(r.width - 40, r.width * (0.1 + Math.random() * 0.22))));
      const y = Math.round(r.top + Math.max(14, Math.min(r.height - 40, 20 + Math.random() * 26)));
      if (!interactiveAtPoint(x, y)) {
        clickAt(x, y);
        return;
      }
    }
  }
  function dismissOpenDropdowns() {
    clickEmptyModalSpot();
  }
  function clearSelectField(trigger, backspaces = 4) {
    if (!trigger) return false;
    trigger.click();
    try {
      trigger.focus && trigger.focus();
    } catch (e) {
    }
    const activeEl = deepActive() || trigger;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) setInputText(activeEl, "");
    for (let i = 0; i < backspaces; i++) fireKey(activeEl, "Backspace");
    fireKey(activeEl, "Delete");
    return true;
  }
  function rowForOptionText(el, root) {
    let n = el;
    for (let depth = 0; n && n !== document.body && depth < 6; depth++, n = n.parentElement) {
      if (root && root !== n && root.contains && !root.contains(n)) break;
      if (!visible(n) || isOwnPopup(n)) continue;
      if (deepQueryAll("input,textarea", n).some((inp) => visible(inp) && !isOwnPopup(inp))) continue;
      const r = rect(n);
      const c = clean(optionText(n));
      if (r.width >= 140 && r.height >= 24 && r.height <= 70 && c && !/^zoek naar/.test(c)) return n;
      if (n.getAttribute && n.getAttribute("role") === "option") return n;
    }
    return el;
  }

  // src/content/ons/form-controls.js
  function findCheckbox(matcher) {
    for (const input2 of deepQueryAll('input[type="checkbox"]'))
      if (matcher(clean(labelTextFor(input2)))) return { el: input2, kind: "input" };
    for (const node of deepQueryAll('[role="checkbox"], [aria-checked], uc-checkbox'))
      if (matcher(clean(labelTextFor(node) || node.textContent || node.getAttribute && (node.getAttribute("aria-label") || "")))) return { el: node, kind: "aria" };
    return null;
  }
  function nativeCheckboxFor(ctrl) {
    if (!ctrl || !ctrl.el) return null;
    if (ctrl.el.matches && ctrl.el.matches('input[type="checkbox"]')) return ctrl.el;
    return ctrl.el.querySelector && ctrl.el.querySelector('input[type="checkbox"]') || ctrl.el.shadowRoot && ctrl.el.shadowRoot.querySelector('input[type="checkbox"]') || null;
  }
  function isChecked(ctrl) {
    if (!ctrl || !ctrl.el) return null;
    const native = nativeCheckboxFor(ctrl);
    if (native) return !!native.checked;
    const nodes = [ctrl.el, ctrl.el.shadowRoot && ctrl.el.shadowRoot.querySelector("[aria-checked]")].filter(Boolean);
    for (const node of nodes) {
      const aria = node.getAttribute && node.getAttribute("aria-checked");
      if (aria === "true") return true;
      if (aria === "false") return false;
      const checked = node.getAttribute && node.getAttribute("checked");
      if (checked === "" || checked === "true") return true;
      const state = clean(node.getAttribute && (node.getAttribute("data-state") || node.getAttribute("class") || ""));
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
      native.dispatchEvent(new Event("input", { bubbles: true }));
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return isChecked(ctrl) === desired;
  }
  function applyClientPresent(desired, onResult, attempt = 0) {
    const ctrl = findCheckbox(CONFIG.clientPresentMatcher);
    if (ctrl) {
      const ok = setChecked(ctrl, desired);
      if (ok || attempt >= 5) {
        onResult(ok, ok);
        return;
      }
      setTimeout(() => applyClientPresent(desired, onResult, attempt + 1), 120);
      return;
    }
    if (attempt < 15) setTimeout(() => applyClientPresent(desired, onResult, attempt + 1), 200);
    else onResult(false, false);
  }
  function uiText(el) {
    if (!el) return "";
    const bits = [];
    if (el.getAttribute) bits.push(el.getAttribute("placeholder"), el.getAttribute("aria-label"), el.getAttribute("label"), el.getAttribute("title"));
    if ("value" in el && typeof el.value === "string") bits.push(el.value);
    bits.push(el.textContent);
    return bits.filter(Boolean).join(" ");
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
        if (n.matches && n.matches(clickable) || r.width >= 120 && r.height >= 28 && r.height <= 90) return n;
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
      const score = area(box) + (exact ? 0 : 1e5) + r.top;
      if (score < bestScore) {
        best = box;
        bestScore = score;
      }
    }
    return best;
  }
  function findBelowLabel(labelTexts, displayTexts) {
    const labels = [];
    const wantedLabels = labelTexts.map(clean);
    for (const el of deepQueryAll("label,div,span,p")) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const t = clean(el.textContent || "");
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
        const aligned = Math.abs(r.left - lr.left) < 80 || r.left <= lr.left + 20 && r.right >= lr.left + 80;
        if (!aligned) continue;
        const text = clean(uiText(box));
        const textBonus = wantedDisplay.some((w) => text.includes(w)) ? -1e3 : 0;
        const score = (r.top - lr.bottom) * 20 + Math.abs(r.left - lr.left) + area(box) / 1e3 + textBonus;
        if (score < bestScore) {
          best = box;
          bestScore = score;
        }
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
          score = 1e4 + dy + dx / 5;
        }
      }
      scored.push({ el, score });
    }
    if (trigger) {
      const tr = rect(trigger);
      for (const inp of deepQueryAll("input,textarea")) {
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
    return (el.getAttribute && (el.getAttribute("label") || el.getAttribute("aria-label")) || el.textContent || "").replace(/\s+/g, " ").trim();
  }
  function hasNestedOptionNode(el, selector) {
    if (!el || !el.querySelectorAll) return false;
    try {
      return Array.from(el.querySelectorAll(selector)).some((child) => child !== el && visible(child) && !isOwnPopup(child));
    } catch (e) {
      return false;
    }
  }
  function containsSeparateActionText(el) {
    if (!el || !el.querySelectorAll) return false;
    try {
      return Array.from(el.querySelectorAll('a[href], button, [role="button"], [role="menuitem"], [role="link"]')).some((child) => child !== el && visible(child) && !isOwnPopup(child) && clean(child.textContent || "").length >= 2);
    } catch (e) {
      return false;
    }
  }
  function genericOptionCandidates(root) {
    const selector = '[role="option"], li, button, [class*="option" i], [data-value], [data-id], div, span';
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const o of deepQueryAll(selector, root).filter((el) => visible(el) && !isOwnPopup(el))) {
      if (/input|textarea|select/i.test(o.tagName || "")) continue;
      const t = optionText(o);
      const c = clean(t);
      if (!c || seen.has(c) || /^zoek naar|toont |geen resultaten|voer minstens/.test(c)) continue;
      const r = rect(o);
      if (r.width < 60 || r.height < 18 || r.height > 90) continue;
      seen.add(c);
      out.push(o);
    }
    return out;
  }
  function clickOption(el) {
    try {
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    } catch (e) {
    }
    try {
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    } catch (e) {
    }
    el.click();
  }
  function clickUiButton(el) {
    if (!el) return false;
    const inner = el.shadowRoot && (el.shadowRoot.querySelector("button:not([disabled])") || el.shadowRoot.querySelector("button"));
    const target = inner || el;
    return clickElementCenter(target);
  }
  function clickElementCenter(el) {
    if (!el) return false;
    try {
      el.scrollIntoView && el.scrollIntoView({ block: "center", inline: "nearest" });
    } catch (e) {
    }
    const r = rect(el);
    if (!r || r.width <= 0 || r.height <= 0) return false;
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y };
    try {
      el.dispatchEvent(new PointerEvent("pointerdown", { ...init, pointerType: "mouse" }));
    } catch (e) {
    }
    try {
      el.dispatchEvent(new MouseEvent("mousedown", init));
    } catch (e) {
    }
    try {
      el.dispatchEvent(new PointerEvent("pointerup", { ...init, pointerType: "mouse" }));
    } catch (e) {
    }
    try {
      el.dispatchEvent(new MouseEvent("mouseup", init));
    } catch (e) {
    }
    try {
      el.dispatchEvent(new MouseEvent("click", init));
    } catch (e) {
    }
    if (!isProtectedAppointmentStartInput(el)) {
      try {
        el.focus && el.focus();
      } catch (e) {
      }
    }
    return true;
  }
  function openSelectCombobox(el) {
    if (!el) return null;
    const nestedSelect = el.querySelector && el.querySelector('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], uc-select[aria-label="Labels"], [role="combobox"][aria-label="Uursoort"], [role="combobox"][aria-label="Labels"]');
    if (nestedSelect && nestedSelect !== el) return openSelectCombobox(nestedSelect);
    const inner = el.shadowRoot && (el.shadowRoot.querySelector('[role="combobox"]:not([aria-disabled="true"])') || el.shadowRoot.querySelector("button:not([disabled])") || el.shadowRoot.querySelector("[tabindex],input,button,div"));
    const target = inner || el;
    try {
      target.scrollIntoView && target.scrollIntoView({ block: "center", inline: "nearest" });
    } catch (e) {
    }
    const r = rect(target);
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y };
    try {
      target.focus && target.focus();
    } catch (e) {
    }
    try {
      target.dispatchEvent(new PointerEvent("pointerdown", { ...init, pointerType: "mouse" }));
    } catch (e) {
    }
    try {
      target.dispatchEvent(new MouseEvent("mousedown", init));
    } catch (e) {
    }
    try {
      target.dispatchEvent(new PointerEvent("pointerup", { ...init, pointerType: "mouse" }));
    } catch (e) {
    }
    try {
      target.dispatchEvent(new MouseEvent("mouseup", init));
    } catch (e) {
    }
    try {
      target.dispatchEvent(new MouseEvent("click", init));
    } catch (e) {
    }
    return target;
  }
  function setInputText(inp, text) {
    if (isProtectedAppointmentStartInput(inp)) return false;
    const proto = inp instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value") && Object.getOwnPropertyDescriptor(proto, "value").set;
    if (setter) setter.call(inp, text);
    else inp.value = text;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function setInputTextComposed(inp, text) {
    if (!setInputText(inp, text)) return false;
    inp.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    return true;
  }
  function inputTextValue(inp) {
    return String((inp && "value" in inp ? inp.value : "") || inp && inp.getAttribute && inp.getAttribute("value") || "").trim();
  }
  function setInputTextOns(inp, text) {
    if (!inp) return false;
    if (isProtectedAppointmentStartInput(inp)) return false;
    try {
      inp.scrollIntoView && inp.scrollIntoView({ block: "center", inline: "nearest" });
    } catch (e) {
    }
    try {
      inp.focus && inp.focus();
    } catch (e) {
    }
    try {
      inp.select && inp.select();
    } catch (e) {
    }
    setInputTextComposed(inp, text);
    try {
      inp.setAttribute && inp.setAttribute("value", text);
    } catch (e) {
    }
    try {
      inp.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: String(text) }));
    } catch (e) {
    }
    inp.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    try {
      inp.blur && inp.blur();
    } catch (e) {
    }
    return true;
  }
  function setInputTextQuiet(inp, text) {
    if (isProtectedAppointmentStartInput(inp)) return false;
    if (!inp || inputTextValue(inp) === String(text)) return !!inp;
    setInputTextComposed(inp, text);
    try {
      inp.setAttribute && inp.setAttribute("value", text);
    } catch (e) {
    }
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
  function deepContains(host, el) {
    if (!host || !el) return false;
    let n = el;
    for (let i = 0; i < 200 && n; i++) {
      if (n === host) return true;
      n = n.parentElement || n.getRootNode && n.getRootNode().host || null;
    }
    return false;
  }
  function inputBelongsToTrigger(inp, tr, triggerEl) {
    if (!inp) return false;
    if (triggerEl && deepContains(triggerEl, inp)) return true;
    if (!tr) return false;
    const r = rect(inp);
    const horizontallyNear = r.left <= tr.right + 260 && r.right >= tr.left - 120;
    return horizontallyNear && r.top >= tr.top - 8 && r.top <= tr.bottom + 170;
  }
  function searchInputForTrigger(trigger) {
    const tr = trigger ? rect(trigger) : null;
    const activeEl = deepActive();
    if (activeEl && /input|textarea/i.test(activeEl.tagName || "") && visible(activeEl) && !isOwnPopup(activeEl) && !isProtectedAppointmentStartInput(activeEl)) {
      const ph = clean((activeEl.getAttribute("placeholder") || "") + " " + (activeEl.getAttribute("aria-label") || ""));
      const focusUsable = !tr || inputBelongsToTrigger(activeEl, tr, trigger);
      if (focusUsable && !ph.includes("afspraken") && !ph.includes("clienten") && (/zoeken|zoek/.test(ph) || ph === "")) return activeEl;
    }
    for (const root of optionSearchRoots(trigger)) {
      const input2 = deepQueryAll("input", root).find((inp) => {
        if (!visible(inp) || isOwnPopup(inp) || isProtectedAppointmentStartInput(inp)) return false;
        const ph = clean((inp.getAttribute("placeholder") || "") + " " + (inp.getAttribute("aria-label") || ""));
        if (ph.includes("afspraken") || ph.includes("clienten")) return false;
        return /zoeken|zoek/.test(ph) || ph === "";
      });
      if (input2) return input2;
    }
    if (!tr) return null;
    return deepQueryAll("input").find((inp) => {
      if (!visible(inp) || isOwnPopup(inp) || isProtectedAppointmentStartInput(inp)) return false;
      const ph = clean((inp.getAttribute("placeholder") || "") + " " + (inp.getAttribute("aria-label") || ""));
      if (ph.includes("afspraken") || ph.includes("clienten")) return false;
      return inputBelongsToTrigger(inp, tr, trigger);
    }) || null;
  }
  function openTypePick(getTrigger, text, onResult) {
    const trigger = getTrigger();
    if (!trigger) {
      onResult(false, "veld niet gevonden");
      return;
    }
    selectDropdownLikeLabel(trigger, text, (ok) => onResult(ok, ok ? "" : "optie niet gevonden"));
  }
  function selectDropdownLikeLabel(trigger, text, onResult, attempt = 0) {
    if (!trigger) {
      onResult(false);
      return;
    }
    const openedBy = openSelectCombobox(trigger) || trigger;
    setTimeout(() => {
      const input2 = searchInputForTrigger(openedBy) || searchInputForTrigger(trigger);
      const searchText = String(text || "").replace(/[*#]+$/, "").trim();
      if (input2) {
        try {
          input2.focus();
        } catch (e) {
        }
        typeIntoSearchField(input2, searchText);
      } else if (trigger.tagName === "INPUT" || trigger.tagName === "TEXTAREA") {
        setInputText(trigger, searchText);
      }
      const wanted = [text, String(text || "").replace(/\*+$/, "").trim()].filter(Boolean);
      pollFor(
        () => findExactDropdownOption(openedBy, wanted) || findExactDropdownOption(trigger, wanted),
        (best) => {
          if (best) {
            clickOption(best);
            setTimeout(() => {
              clickEmptyModalSpot();
              onResult(true);
            }, 90);
            return;
          }
          if (attempt < 3) {
            clickEmptyModalSpot();
            setTimeout(() => selectDropdownLikeLabel(trigger, text, onResult, attempt + 1), 200);
            return;
          }
          setTimeout(() => {
            clickEmptyModalSpot();
            onResult(false);
          }, 90);
        },
        { timeout: 2600, interval: 130 }
      );
    }, 170);
  }
  function firstByDataQa(qa) {
    for (const el of deepQueryAll('[data-qa="' + qa + '"]')) {
      if (visible(el) && !isOwnPopup(el)) return el;
    }
    return null;
  }
  function typeIntoSearchField(input2, text) {
    if (!input2) return false;
    try {
      input2.focus();
    } catch (e) {
    }
    try {
      input2.click && input2.click();
    } catch (e) {
    }
    const proto = input2 instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value") && Object.getOwnPropertyDescriptor(proto, "value").set;
    const setVal = (v) => {
      if (setter) setter.call(input2, v);
      else input2.value = v;
    };
    const fireInput = (value, inputType) => {
      try {
        input2.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, composed: true, inputType: inputType || "insertText", data: value }));
      } catch (e) {
      }
      try {
        input2.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: inputType || "insertText", data: value }));
      } catch (e) {
        input2.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      }
    };
    setVal("");
    fireInput("", "deleteContentBackward");
    let acc = "";
    for (const ch of String(text)) {
      acc += ch;
      try {
        input2.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true, cancelable: true, composed: true }));
      } catch (e) {
      }
      setVal(acc);
      fireInput(ch, "insertText");
      try {
        input2.dispatchEvent(new KeyboardEvent("keyup", { key: ch, bubbles: true, cancelable: true, composed: true }));
      } catch (e) {
      }
    }
    input2.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    setTimeout(() => {
      if (inputTextValue(input2) !== String(text)) {
        setVal(String(text));
        fireInput(String(text), "insertText");
        input2.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      }
    }, 60);
    return true;
  }
  function findExactDropdownOption(trigger, texts) {
    const wanted = texts.map(clean).filter(Boolean);
    if (!wanted.length) return null;
    const tr = rect(trigger);
    let best = null, bestScore = Infinity;
    for (const root of optionSearchRoots(trigger)) {
      for (const el of genericOptionCandidates(root)) {
        if (!visible(el) || isOwnPopup(el) || /input|textarea|select/i.test(el.tagName || "")) continue;
        const row = rowForOptionText(el, root);
        if (!visible(row) || isOwnPopup(row)) continue;
        const txt = clean(optionText(row) || optionText(el));
        if (/toont |zoekterm|zoek naar|geen resultaten/.test(txt)) continue;
        const matches = wanted.some(function(w) {
          if (!w) return false;
          if (txt === w || txt.includes(w) || w.includes(txt)) return true;
          const tokens = w.replace(/[.*]/g, " ").split(/\s+/).filter(function(t) {
            return t.length >= 4;
          });
          return tokens.length > 0 && tokens.every(function(t) {
            return txt.indexOf(t) !== -1;
          });
        });
        if (!matches) continue;
        const r = rect(row);
        if (r.top < tr.top - 500 || r.top > tr.bottom + 600) continue;
        if (r.width < 120 || r.height < 20 || r.height > 80) continue;
        const selectedScore = /true/i.test(row.getAttribute("aria-selected") || "") || /selected|active|checked/i.test(row.className || "") ? -1e3 : 0;
        const exactScore = wanted.includes(txt) ? -500 : 0;
        const distToTrigger = Math.min(Math.abs(r.top - tr.bottom), Math.abs(r.bottom - tr.top));
        const score = selectedScore + exactScore + distToTrigger + Math.abs(r.left - tr.left) / 4;
        if (score < bestScore) {
          best = row;
          bestScore = score;
        }
      }
    }
    return best;
  }

  // src/content/ons/appointment-form.js
  function getEtiketTrigger() {
    if (CONFIG.etiketFieldSelector) {
      const f = document.querySelector(CONFIG.etiketFieldSelector);
      if (f) return f;
    }
    const byQa = firstByDataQa("label_select");
    if (byQa) return byQa;
    const t = findOpener({ placeholderRe: /label|etiket/i, displayTexts: ["zoek naar labels", "zoek naar etiketten"], labelTexts: ["labels", "label", "etiket", "etiketten"] });
    return t;
  }
  function findClientUursoortTrigger() {
    const clientLabels = deepQueryAll("div,span,p").filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === "client");
    let best = null, bestScore = Infinity;
    for (const clientLabel of clientLabels) {
      const cr = rect(clientLabel);
      for (const label of deepQueryAll("label,div,span,p")) {
        if (!visible(label) || isOwnPopup(label) || clean(label.textContent) !== "uursoort") continue;
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
          const score = (br.top - lr.bottom) * 20 + Math.abs(br.left - lr.left) + area(box) / 1e3;
          if (score < bestScore) {
            best = box;
            bestScore = score;
          }
        }
      }
    }
    return best;
  }
  function getTitleInputSafe() {
    try {
      return getTitleInput();
    } catch (e) {
      return null;
    }
  }
  function getUursoortTrigger() {
    if (CONFIG.uursoortFieldSelector) {
      const f = document.querySelector(CONFIG.uursoortFieldSelector);
      if (f) return f;
    }
    const t = findClientUursoortTrigger() || findOpener({ placeholderRe: /uursoort|hour type/i, displayTexts: ["zoek naar uursoorten"], labelTexts: ["uursoort", "uursoorten", "hour type"] });
    return t;
  }
  function getTitleInput() {
    const ov = overrideEl("afsTitel");
    if (ov) return ov;
    const labels = deepQueryAll("label,div,span,p").filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === "titel");
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of deepQueryAll("input,textarea")) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        const r = rect(inp);
        if (r.top < lr.bottom - 6 || r.top - lr.bottom > 90) continue;
        if (Math.abs(r.left - lr.left) > 120) continue;
        const score = (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
        if (score < bestScore) {
          best = inp;
          bestScore = score;
        }
      }
    }
    if (best) return best;
    const byAttr = deepQueryAll("input,textarea").find((inp) => {
      if (!visible(inp) || isOwnPopup(inp)) return false;
      const text = clean([
        inp.getAttribute("aria-label"),
        inp.getAttribute("placeholder"),
        inp.getAttribute("name"),
        inp.getAttribute("id"),
        inp.getAttribute("title")
      ].filter(Boolean).join(" "));
      return /\btitel\b/.test(text);
    });
    if (byAttr) return byAttr;
    const details = deepQueryAll("h1,h2,h3,div,span,p").find((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === "afspraakdetails");
    if (details) {
      const dr = rect(details);
      return deepQueryAll("input,textarea").filter((inp) => visible(inp) && !isOwnPopup(inp)).filter((inp) => {
        const r = rect(inp);
        return r.top > dr.bottom && r.top - dr.bottom < 160 && Math.abs(r.left - dr.left) < 180;
      }).sort((a, b) => rect(a).top - rect(b).top)[0] || null;
    }
    return best;
  }
  function getDateInput() {
    const ov = overrideEl("afsDatum");
    if (ov) return ov;
    const host = deepQueryAll('uc-date-input[aria-label="Datum*"], uc-date-input[aria-label="Datum"]').find((el) => visible(el) && !isOwnPopup(el));
    if (host && host.shadowRoot) {
      const inp = deepQueryAll("input", host.shadowRoot).find((i) => visible(i) && !isOwnPopup(i));
      if (inp) return inp;
    }
    return deepQueryAll("input").find((inp) => {
      if (!visible(inp) || isOwnPopup(inp)) return false;
      const label = clean(inp.getAttribute("aria-label") || "");
      const placeholder = clean(inp.getAttribute("placeholder") || "");
      return label === "datum*" || label === "datum" || placeholder === "dd-mm-jjjj";
    }) || null;
  }
  function ucTimeInputHost(inp) {
    if (!inp) return null;
    const root = inp.getRootNode && inp.getRootNode();
    const host = root && root.host;
    return host && /uc-time-input/i.test(host.tagName || "") ? host : null;
  }
  function ucTimeInputFor(labelPattern) {
    for (const host of deepQueryAll("uc-time-input")) {
      if (!visible(host) || isOwnPopup(host)) continue;
      if (!labelPattern.test(clean(host.getAttribute("aria-label") || ""))) continue;
      if (host.shadowRoot) {
        const inp = host.shadowRoot.querySelector('input[placeholder="uu:mm"]') || host.shadowRoot.querySelector("input");
        if (inp) return inp;
      }
    }
    return null;
  }
  function getStartTimeInput() {
    const ov = overrideEl("afsBegintijd");
    if (ov) return ov;
    const direct = ucTimeInputFor(/^begintijd/);
    if (direct) return direct;
    const labels = deepQueryAll("label,div,span,p").filter((el) => visible(el) && !isOwnPopup(el) && /^begintijd\*?$/.test(clean(el.textContent || "")));
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of deepQueryAll("input")) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        if (clean(inp.getAttribute("placeholder") || "") !== "uu:mm") continue;
        const r = rect(inp);
        if (r.top < lr.bottom - 8 || r.top - lr.bottom > 90) continue;
        if (Math.abs(r.left - lr.left) > 120) continue;
        const score = (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
        if (score < bestScore) {
          best = inp;
          bestScore = score;
        }
      }
    }
    if (best) return best;
    return timeInputsInOrder()[0] || null;
  }
  function isProtectedAppointmentStartInput(inp) {
    if (!inp || helperPanel.activeMode === "registrations") return false;
    if (!/^(input|textarea)$/i.test(inp.tagName || "")) return false;
    const host = ucTimeInputHost(inp);
    if (host) return /^begintijd/.test(clean(host.getAttribute("aria-label") || ""));
    const meta = clean(`${inp.getAttribute("placeholder") || ""} ${inp.getAttribute("aria-label") || ""} ${inp.getAttribute("name") || ""} ${inp.id || ""}`);
    if (!/uu:mm|begintijd|start/.test(meta)) return false;
    const ir = rect(inp);
    return deepQueryAll("label,div,span,p").some((label) => {
      if (!visible(label) || isOwnPopup(label) || !/^begintijd\*?$/.test(clean(label.textContent || ""))) return false;
      const lr = rect(label);
      return ir.top >= lr.bottom - 10 && ir.top - lr.bottom <= 100 && Math.abs(ir.left - lr.left) <= 150;
    });
  }
  function getEndTimeInput() {
    const ov = overrideEl("afsEindtijd");
    if (ov) return ov;
    const startInput = getStartTimeInput();
    const direct = ucTimeInputFor(/^eindtijd/);
    if (direct && direct !== startInput) return direct;
    const startRect = startInput ? rect(startInput) : null;
    const labels = deepQueryAll("label,div,span,p").filter((el) => visible(el) && !isOwnPopup(el) && /^eindtijd\*?$/.test(clean(el.textContent || "")));
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of deepQueryAll("input")) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        if (startInput && inp === startInput) continue;
        const meta = clean(`${inp.getAttribute("placeholder") || ""} ${inp.getAttribute("aria-label") || ""} ${inp.getAttribute("inputmode") || ""}`);
        const value = inputTextValue(inp);
        if (!/uu:mm|time|tijd|numeric/.test(meta) && !/^(\d{1,2}):(\d{2})$/.test(value)) continue;
        const r = rect(inp);
        if (r.top < lr.bottom - 16 || r.top - lr.bottom > 110) continue;
        if (Math.abs(r.left - lr.left) > 220) continue;
        if (startRect && Math.abs(r.top - startRect.top) < 24 && Math.abs(r.left - startRect.left) < 24) continue;
        const score = (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
        if (score < bestScore) {
          best = inp;
          bestScore = score;
        }
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
  function timeInputsInOrder() {
    return deepQueryAll("input").filter((inp) => visible(inp) && !isOwnPopup(inp) && clean(inp.getAttribute("placeholder") || "") === "uu:mm").sort((a, b) => {
      const ar = rect(a), br = rect(b);
      return Math.abs(ar.top - br.top) > 8 ? ar.top - br.top : ar.left - br.left;
    });
  }
  function findClientNameText() {
    const inviteeNames = deepQueryAll(UI_OVERRIDES.afsClientName || 'span[class*="_invitee-name_"], ._invitee-name_sohx9_40').filter((el) => visible(el) && !isOwnPopup(el));
    for (const nameEl of inviteeNames) {
      const txt = (nameEl.textContent || "").replace(/\s+/g, " ").trim();
      if (!txt) continue;
      const nr = rect(nameEl);
      const role = deepQueryAll("div,span,p").find((el) => {
        if (!visible(el) || isOwnPopup(el) || clean(el.textContent) !== "client") return false;
        const rr = rect(el);
        return rr.top >= nr.bottom - 8 && rr.top <= nr.bottom + 45 && Math.abs(rr.left - nr.left) <= 130;
      });
      if (role) return txt;
      let n = nameEl.parentElement;
      for (let depth = 0; n && depth < 5; depth++, n = n.parentElement) {
        const r = rect(n);
        const t = clean(n.textContent || "");
        if (r.height <= 180 && t.includes("client") && !t.includes("medewerker")) return txt;
      }
    }
    return "";
  }
  function firstNameFromName(name) {
    const tokens = String(name || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const TITLE = /^(mw|mevr|mevrouw|dhr|hr|meneer|mr|dr)\.?$/i;
    let i = 0;
    while (i < tokens.length - 1 && TITLE.test(tokens[i])) i++;
    return tokens[i] || tokens[0] || "";
  }
  function labelChips(trigger) {
    const tr = trigger ? rect(trigger) : null;
    const inField = (el) => {
      if (!tr) return true;
      const r = rect(el);
      return !(r.bottom < tr.top - 40 || r.top > tr.bottom + 90 || r.left < tr.left - 90 || r.right > tr.right + 200);
    };
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (el, rawName) => {
      if (!el || seen.has(el)) return;
      const name = clean(rawName || "").replace(/^verwijder label\s+/, "");
      if (!name) return;
      seen.add(el);
      out.push({ el, name });
    };
    const ov = overrideAll("afsLabelChips");
    const source = ov && ov.length ? ov : deepQueryAll('button[aria-label^="Verwijder label" i], .label-tags button, [data-qa="label_tags"] button');
    for (const btn of source) {
      if (!visible(btn) || isOwnPopup(btn)) continue;
      if (!(ov && ov.length) && !inField(btn)) continue;
      const al = btn.getAttribute("aria-label") || "";
      const m = /verwijder label\s+(.+)$/i.exec(al);
      add(btn, m ? m[1] : btn.textContent || "");
    }
    if (!out.length && !(ov && ov.length)) {
      for (const tag of deepQueryAll(ONS.ucTagDeletable)) {
        if (!visible(tag) || isOwnPopup(tag) || !inField(tag)) continue;
        const btn = tag.shadowRoot && (tag.shadowRoot.querySelector("button") || tag.shadowRoot.querySelector('[part="button"]'));
        add(btn || tag, tag.textContent || "");
      }
    }
    return out;
  }
  function appointmentTravelInput(kind) {
    const ov = overrideEl(kind === "heen" ? "afsTravelBefore" : "afsTravelAfter");
    if (ov) return ov;
    const wanted = kind === "heen" ? "reistijd heen" : "reistijd terug";
    const labels = deepQueryAll("label,div,span,p").filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent || "") === wanted);
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of deepQueryAll("input")) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        const meta = clean(`${inp.getAttribute("placeholder") || ""} ${inp.getAttribute("inputmode") || ""} ${inp.getAttribute("aria-label") || ""} ${inp.getAttribute("role") || ""}`);
        if (!/min|decimal|spinbutton|reistijd/.test(meta)) continue;
        const r = rect(inp);
        if (r.top < lr.bottom - 18 || r.top > lr.bottom + 120 || Math.abs(r.left - lr.left) > 240) continue;
        const score = Math.abs(r.top - lr.bottom) * 4 + Math.abs(r.left - lr.left);
        if (score < bestScore) {
          best = inp;
          bestScore = score;
        }
      }
    }
    if (best) return best;
    const allDirect = deepQueryAll("input").filter((inp) => {
      if (isOwnPopup(inp)) return false;
      const label = clean(inp.getAttribute("aria-label") || "");
      const placeholder = clean(inp.getAttribute("placeholder") || "");
      return label === wanted && (!placeholder || placeholder === "min");
    });
    const direct = allDirect.find((inp) => visible(inp) && (/decimal/i.test(inp.getAttribute("inputmode") || "") || /spinbutton/i.test(inp.getAttribute("role") || ""))) || allDirect.find(visible) || allDirect[0];
    if (direct) return direct;
    const host = deepQueryAll("[aria-label]").find((el) => !isOwnPopup(el) && clean(el.getAttribute("aria-label") || "") === wanted);
    if (host && host.shadowRoot) {
      const inner = deepQueryAll("input", host.shadowRoot).find((inp) => !isOwnPopup(inp));
      if (inner) return inner;
    }
    return null;
  }
  function clientCardFor(nameEl, role, nextTop) {
    const nr = rect(nameEl);
    const wantedName = clean(nameEl.textContent || "");
    const bottomLimit = Number.isFinite(nextTop) ? nextTop - 2 : Infinity;
    let best = null, bestScore = Infinity;
    let n = nameEl.parentElement;
    for (let depth = 0; n && n !== document.body && depth < 14; depth++, n = n.parentElement) {
      if (!visible(n) || isOwnPopup(n)) continue;
      const r = rect(n);
      const t = clean(n.textContent || "");
      if (!t.includes(wantedName) || !t.includes("client")) continue;
      if (r.width < 260 || r.width > 900 || r.height < 42 || r.height > 620) continue;
      if (r.right < nr.left + 280 || r.top > nr.top + 4 || r.bottom < rect(role).bottom) continue;
      if (r.bottom > bottomLimit) continue;
      const fieldBonus = t.includes("uursoort") ? -9e4 : 0;
      const staffPenalty = t.includes("medewerker") ? 35e4 : 0;
      const score = area(n) + depth * 1e3 + staffPenalty + fieldBonus;
      if (score < bestScore) {
        best = n;
        bestScore = score;
      }
    }
    return best;
  }
  function findUursoortTriggerForClient(entry, nextTop) {
    const roleRect = rect(entry.role);
    const upper = Number.isFinite(nextTop) ? Math.max(roleRect.bottom + 40, nextTop - 10) : roleRect.bottom + 280;
    const cardRect = entry.card ? rect(entry.card) : null;
    const insideCard = (r) => !cardRect || r.top >= cardRect.top - 4 && r.bottom <= cardRect.bottom + 4 && r.left >= cardRect.left - 4 && r.right <= cardRect.right + 4;
    const roots = entry.card ? [entry.card] : [document];
    let best = null, bestScore = Infinity;
    for (const root of roots) {
      for (const label of deepQueryAll("label,div,span,p", root)) {
        if (!visible(label) || isOwnPopup(label) || clean(label.textContent) !== "uursoort") continue;
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
          const score = (br.top - lr.bottom) * 25 + Math.abs(br.left - lr.left) + area(box) / 1e3;
          if (score < bestScore) {
            best = box;
            bestScore = score;
          }
        }
      }
    }
    return best;
  }
  function isAddInviteeControl(el) {
    if (!el) return false;
    const t = clean(uiText(el) || el.textContent || "");
    const qa = clean(el.getAttribute && el.getAttribute("data-qa") || "");
    if (/toggle-invitee-fields/.test(qa)) return false;
    return /^\+?\s*toevoegen$|genodigde? toevoegen/.test(t) || /(^|[^a-z])add([^a-z]|$)|add-invitee|add_invitee/.test(qa);
  }
  var _clientEntriesCache = null;
  var _clientEntriesAt = 0;
  var CLIENT_ENTRIES_TTL = 250;
  function invalidateClientEntries() {
    _clientEntriesCache = null;
  }
  function findClientEntries() {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (_clientEntriesCache && now - _clientEntriesAt < CLIENT_ENTRIES_TTL) return _clientEntriesCache;
    const res = _findClientEntriesUncached();
    _clientEntriesCache = res;
    _clientEntriesAt = now;
    return res;
  }
  function findClientEntriesFromModalStructure() {
    const ovRows = overrideAll("afsClientList");
    const rows = ovRows && ovRows.length ? ovRows : deepQueryAll('ul[class*="_selected-clients_"] > li, ul[data-qa="selected_clients"] > li').filter((row) => visible(row) && !isOwnPopup(row));
    const entries = [];
    const seen = /* @__PURE__ */ new Set();
    for (const row of rows) {
      const nameEl = deepQueryAll(UI_OVERRIDES.afsClientName || 'span[class*="_invitee-name_"], [class*="_invitee-name_"]', row).find((el) => visible(el) && !isOwnPopup(el) && (el.textContent || "").trim());
      if (!nameEl) continue;
      const name = (nameEl.textContent || "").replace(/\s+/g, " ").trim();
      const key = clean(name);
      if (!key || seen.has(key)) continue;
      const role = deepQueryAll("div,span,p", row).find((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent || "") === "client") || nameEl;
      const toggle = deepQueryAll(UI_OVERRIDES.afsInviteeToggle || '[data-qa="toggle-invitee-fields-button"]', row).find((el) => visible(el) && !isOwnPopup(el)) || null;
      let uursoortTrigger = deepQueryAll('uc-select[data-qa="hour_type_select"], [data-qa="hour_type_select"]', row).find((el) => visible(el) && !isOwnPopup(el)) || null;
      seen.add(key);
      const entry = {
        name,
        firstName: firstNameFromName(name),
        nameEl,
        role,
        toggle,
        card: row,
        clientId: row.getAttribute("data-invitee-id") || row.getAttribute("data-client-id") || row.getAttribute("data-patient-id") || null,
        uursoortTrigger
      };
      if (!entry.uursoortTrigger) entry.uursoortTrigger = findUursoortTriggerForClient(entry, Infinity);
      entries.push(entry);
    }
    return entries;
  }
  function entryUursoortText(entry) {
    if (!entry || !entry.card) return "";
    const summary = deepQueryAll('[class*="_summary_"]', entry.card).find((el) => !isOwnPopup(el) && clean(el.textContent || ""));
    return summary ? (summary.textContent || "").replace(/\s+/g, " ").trim() : "";
  }
  function entryUursoortIsSet(entry) {
    if (!entry) return false;
    if (entry.card) {
      const summary = deepQueryAll('[class*="_summary_"]', entry.card).find((el) => !isOwnPopup(el) && clean(el.textContent || ""));
      if (summary) return true;
    }
    const trg = entry.uursoortTrigger;
    if (trg) {
      const combo = trg.shadowRoot && trg.shadowRoot.querySelector('[role="combobox"]') || deepQueryAll('[role="combobox"]', trg).find((el) => !isOwnPopup(el));
      if (combo) {
        const isPlaceholder = combo.classList.contains("placeholder");
        const listEl = deepQueryAll("uc-select-list", trg).find((el) => !isOwnPopup(el)) || entry.card && deepQueryAll("uc-select-list", entry.card).find((el) => !isOwnPopup(el));
        const val = listEl ? listEl.getAttribute("value") || "" : "";
        if (!isPlaceholder && val) return true;
        return !isPlaceholder;
      }
    }
    return false;
  }
  function _findClientEntriesUncached() {
    const structural = findClientEntriesFromModalStructure();
    if (structural.length) return structural;
    const nameEls = deepQueryAll('span[class*="_invitee-name_"], ._invitee-name_sohx9_40').filter((el) => visible(el) && !isOwnPopup(el));
    const toggles = deepQueryAll(UI_OVERRIDES.afsInviteeToggle || 'uc-button[data-qa="toggle-invitee-fields-button"], [data-qa="toggle-invitee-fields-button"]').filter((btn) => visible(btn) && !isOwnPopup(btn));
    const basics = [];
    const seen = /* @__PURE__ */ new Set();
    for (const nameEl of nameEls) {
      const name = (nameEl.textContent || "").replace(/\s+/g, " ").trim();
      if (!name || seen.has(name)) continue;
      const nr = rect(nameEl);
      const role = deepQueryAll("div,span,p").find((el) => {
        if (!visible(el) || isOwnPopup(el) || clean(el.textContent) !== "client") return false;
        const rr = rect(el);
        return rr.top >= nr.bottom - 8 && rr.top <= nr.bottom + 48 && Math.abs(rr.left - nr.left) <= 150;
      });
      if (!role) continue;
      const toggle = toggles.find((btn) => clean(btn.getAttribute("aria-label") || "").includes(clean(name))) || toggles.map((btn) => ({ btn, r: rect(btn) })).filter(({ r }) => r.left > nr.left + 240 && r.top >= nr.top - 90 && r.top <= nr.top + 90).sort((a, b) => Math.abs(a.r.top + a.r.height / 2 - (nr.top + nr.height / 2)) - Math.abs(b.r.top + b.r.height / 2 - (nr.top + nr.height / 2)))[0]?.btn || null;
      seen.add(name);
      basics.push({ name, firstName: firstNameFromName(name), nameEl, role, toggle });
    }
    const sorted = basics.sort((a, b) => rect(a.nameEl).top - rect(b.nameEl).top || rect(a.nameEl).left - rect(b.nameEl).left);
    return sorted.map((entry, index) => {
      const next = sorted[index + 1];
      const nextTop = next ? rect(next.nameEl).top : Infinity;
      const card = clientCardFor(entry.nameEl, entry.role, nextTop);
      const clientId = card && (card.getAttribute("data-invitee-id") || card.getAttribute("data-client-id") || card.getAttribute("data-patient-id")) || null;
      const withCard = { ...entry, card, clientId };
      return { ...withCard, uursoortTrigger: findUursoortTriggerForClient(withCard, nextTop) };
    });
  }
  function findRecurrenceHeader() {
    const ov = overrideEl("recurrenceHeader");
    if (ov) return ov;
    const btns = deepQueryAll("button[aria-expanded]").filter((b) => visible(b) && !isOwnPopup(b));
    for (const b of btns) {
      let spans;
      try {
        spans = b.querySelectorAll("span");
      } catch (e) {
        continue;
      }
      for (const s of spans) if (clean(s.textContent) === "herhaling") return b;
    }
    return null;
  }
  function findRecurrenceField() {
    const ovSel = UI_OVERRIDES.recurrenceType;
    return (ovSel ? deepQueryAll(ovSel) : deepQueryAll('[data-qa="recurrence-type"]')).find((el) => visible(el) && !isOwnPopup(el)) || null;
  }

  // src/content/ons/uursoort-options.js
  function splitUursoortCategoryText(text) {
    let raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return [];
    raw = raw.replace(/&nbsp;|\u00a0/gi, " ").replace(/(Onlangs gebruikt|Geadviseerd|Toegestaan)\s*/gi, "\n").replace(/\*\s*(?=[A-ZÀ-ÖØ-Þ])/g, "*\n").replace(/\)\s+(?=[A-ZÀ-ÖØ-Þ])/g, ")\n").replace(/#\s*(?=[A-ZÀ-ÖØ-Þ])/g, "#\n");
    return raw.split(/\n+/).map((part) => part.replace(/\s+/g, " ").trim()).filter((part) => !!part && !/^(?:#|\*|&?nbsp;?)$/i.test(part));
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
    if (c === "uursoort" || c === "uursoorten" || c === "toeslag" || c === "titel" || c === "labels" || c === "locatie" || c === "notities") return true;
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
      const loose = clean(String(name || "").replace(/\*+$/, ""));
      return c === wanted || !!loose && c === loose;
    })) return true;
    if (/\b(ggz|ambulant|hbo|mbo|behandeling|diagnostiek|verslaglegging|zorgcoordinatie|no show|factuur|mdo|huisbezoek|digitaal|telefonisch|mail)\b/.test(c)) return true;
    if (/[#]/.test(text)) return true;
    return false;
  }
  function optionCandidates(root) {
    const selector = '[role="option"], li, button, [class*="option" i], [data-value], [data-id]';
    const raw = deepQueryAll(selector, root).filter((o) => visible(o) && !isOwnPopup(o));
    const fallback = deepQueryAll("div,span", root).filter((o) => visible(o) && !isOwnPopup(o));
    const pool = [...raw, ...fallback];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const o of pool) {
      if (/input|textarea|select/i.test(o.tagName || "")) continue;
      if (hasNestedOptionNode(o, selector)) continue;
      const t = optionText(o);
      const c = clean(t);
      if (!looksLikeUursoortOption(t) || seen.has(c)) continue;
      const r = rect(o);
      if (r.width < 80 || r.height < 18 || r.height > 90) continue;
      seen.add(c);
      out.push(o);
    }
    return out;
  }
  function collectUursoortOptionTexts(trigger) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
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
    const local = deepQueryAll('[role="listbox"], ul[part="list"]', trigger).find((el) => visible(el) && !isOwnPopup(el));
    if (local) return local;
    for (const root of optionSearchRoots(trigger)) {
      if (root.matches && root.matches('[role="listbox"], ul[part="list"]') && visible(root)) return root;
      const nested = deepQueryAll('[role="listbox"], ul[part="list"]', root).find((el) => visible(el) && !isOwnPopup(el));
      if (nested) return nested;
    }
    return null;
  }
  function collectClientUursoortOptionTexts(trigger) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const listbox = clientUursoortListbox(trigger);
    const roots = listbox ? [listbox] : optionSearchRoots(trigger);
    for (const root of roots) {
      const nodes = deepQueryAll('[role="option"], li, [data-value]', root).filter((el) => visible(el) && !isOwnPopup(el));
      for (const node of nodes) {
        if (hasNestedOptionNode(node, '[role="option"], li, [data-value]')) continue;
        if (containsSeparateActionText(node)) continue;
        const text = optionText(node).replace(/\s+/g, " ").trim();
        const r = rect(node);
        if (r.width < 60 || r.height < 16 || r.height > 100) continue;
        for (const part of splitUursoortCategoryText(text)) {
          if (invalidUursoortOption(part)) continue;
          const key = clean(part);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          out.push(part);
        }
      }
    }
    if (out.length) return out;
    collectUursoortOptionTexts(trigger).forEach((text) => {
      for (const part of splitUursoortCategoryText(text)) {
        const key = clean(part);
        if (key && !seen.has(key)) {
          seen.add(key);
          out.push(part);
        }
      }
    });
    return out;
  }
  function scanClientUursoortOptions(trigger, onDone) {
    const found = [];
    const seen = /* @__PURE__ */ new Set();
    const collect = () => {
      collectClientUursoortOptionTexts(trigger).forEach((text) => {
        const key = clean(text);
        if (key && !seen.has(key)) {
          seen.add(key);
          found.push(text);
        }
      });
    };
    collect();
    const listbox = clientUursoortListbox(trigger);
    if (!listbox) {
      onDone(found);
      return;
    }
    const max = Math.max(0, (listbox.scrollHeight || 0) - (listbox.clientHeight || 0));
    const step = Math.max(90, Math.round((listbox.clientHeight || 150) * 0.8));
    const positions = [];
    for (let y = 0; y < max; y += step) positions.push(y);
    positions.push(max);
    let index = 0;
    const next = () => {
      if (index >= positions.length) {
        try {
          listbox.scrollTop = 0;
          listbox.dispatchEvent(new Event("scroll", { bubbles: true, composed: true }));
        } catch (e) {
        }
        onDone(found.slice(0, 100));
        return;
      }
      try {
        listbox.scrollTop = positions[index++];
        listbox.dispatchEvent(new Event("scroll", { bubbles: true, composed: true }));
      } catch (e) {
        index++;
      }
      setTimeout(() => {
        collect();
        next();
      }, 75);
    };
    next();
  }

  // src/content/ui/theme.js
  var ONSAH_TOKENS = {
    ink: "#201d1f",
    inkSoft: "#6b6367",
    line: "#ece7e5",
    lineSoft: "#f6f2f0",
    brand: "#cc087d",
    brandDeep: "#8c0a58",
    brandWash: "#fdf1f8",
    ok: "#1b7f3b",
    okWash: "#eaf6ee",
    bad: "#a3241f",
    badWash: "#fbeceb"
  };
  function onsahFocusRing(el, color) {
    el.addEventListener("focus", () => {
      el.style.outline = "2px solid " + (color || ONSAH_TOKENS.brand);
      el.style.outlineOffset = "2px";
    });
    el.addEventListener("blur", () => {
      el.style.outline = "none";
    });
  }

  // src/content/ui/icons.js
  function svgInfoIcon() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", "7");
    line.setAttribute("y1", "6.2");
    line.setAttribute("x2", "7");
    line.setAttribute("y2", "10.4");
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", "7");
    dot.setAttribute("cy", "3.6");
    dot.setAttribute("r", ".9");
    dot.setAttribute("fill", "currentColor");
    dot.setAttribute("stroke", "none");
    svg.appendChild(line);
    svg.appendChild(dot);
    return svg;
  }
  function svgCloseIcon() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "13");
    svg.setAttribute("height", "13");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    const l1 = document.createElementNS(svgNS, "line");
    l1.setAttribute("x1", "3");
    l1.setAttribute("y1", "3");
    l1.setAttribute("x2", "11");
    l1.setAttribute("y2", "11");
    const l2 = document.createElementNS(svgNS, "line");
    l2.setAttribute("x1", "11");
    l2.setAttribute("y1", "3");
    l2.setAttribute("x2", "3");
    l2.setAttribute("y2", "11");
    svg.appendChild(l1);
    svg.appendChild(l2);
    return svg;
  }
  function svgSpineCheck() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M3 7.2l2.6 2.6L11 4");
    svg.appendChild(path);
    return svg;
  }
  function svgSpinePause() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    const l1 = document.createElementNS(svgNS, "line");
    l1.setAttribute("x1", "5");
    l1.setAttribute("y1", "3.5");
    l1.setAttribute("x2", "5");
    l1.setAttribute("y2", "10.5");
    const l2 = document.createElementNS(svgNS, "line");
    l2.setAttribute("x1", "9");
    l2.setAttribute("y1", "3.5");
    l2.setAttribute("x2", "9");
    l2.setAttribute("y2", "10.5");
    svg.appendChild(l1);
    svg.appendChild(l2);
    return svg;
  }
  function svgEmptyIcon() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.4");
    const rect2 = document.createElementNS(svgNS, "rect");
    rect2.setAttribute("x", "3");
    rect2.setAttribute("y", "5");
    rect2.setAttribute("width", "18");
    rect2.setAttribute("height", "15");
    rect2.setAttribute("rx", "2");
    const p = document.createElementNS(svgNS, "path");
    p.setAttribute("d", "M3 10h18M8 3v4M16 3v4");
    svg.appendChild(rect2);
    svg.appendChild(p);
    return svg;
  }
  function svgIcon(pathD) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", pathD);
    svg.appendChild(path);
    return svg;
  }
  function setChevronIcon(button, collapsed) {
    if (!button) return;
    button.textContent = "";
    button.appendChild(svgIcon(collapsed ? "M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z" : "M15 5.4 8.4 12 15 18.6 16.4 17.2 11.2 12 16.4 6.8z"));
  }

  // src/content/screen/screen-state.js
  var currentScreen = null;
  function markScreen(name, args) {
    currentScreen = { name, args: args || {} };
  }
  function clearScreenMark() {
    currentScreen = null;
  }
  function isScreen(name) {
    return !!currentScreen && currentScreen.name === name;
  }
  function resetBody(body) {
    if (!body) return;
    try {
      if (window.__onsahReact) window.__onsahReact.unmount(body);
    } catch (e) {
    }
    body.innerHTML = "";
  }

  // src/content/screen/status.js
  var $body = () => helperPanel.popupEl && helperPanel.popupEl.querySelector("[data-body]");
  function updateSpineProgress() {
    if (!helperPanel.popupEl) return;
    const dotsWrap = helperPanel.popupEl.querySelector("[data-spine-dots]");
    if (!dotsWrap) return;
    const dots = dotsWrap.querySelectorAll("i");
    if (!dots.length) return;
    if (!helperPanel.helperEnabled) {
      dots.forEach((dot) => {
        dot.style.background = "rgba(255,255,255,.35)";
      });
      return;
    }
    const body = $body();
    const text = clean(body && body.textContent || "");
    let phase = 1;
    if (/als de instellingen kloppen|voeg eventueel nog een locatie|klaar om (in te dienen|op te slaan)|schrijf nu je rapportage|richtlijn rapporteren|^indienen$|indienen /.test(text)) phase = 3;
    else if (appointmentFlow.pendingChoice || registrationFlow.activeRegistrationChoice || / duur[: ]|totale reistijd|tijd aanwezig in deze registratie/.test(text)) phase = 2;
    dots.forEach((dot, i) => {
      dot.style.background = i < phase ? "#fff" : "rgba(255,255,255,.35)";
    });
  }
  function setStatus(text, ok) {
    if (!helperPanel.popupEl) return;
    safe(updateSpineProgress);
    const s = helperPanel.popupEl.querySelector("[data-status]");
    if (!s) return;
    s.innerHTML = "";
    if (!text) return;
    const bad = ok === false;
    const chip = document.createElement("div");
    Object.assign(chip.style, {
      // inline-flex i.p.v. flex: anders vult een block-level div altijd de
      // volledige breedte van het paneel en oogt de melding als een grote balk
      // in plaats van een compact label.
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "4px 8px",
      borderRadius: "7px",
      fontSize: "11px",
      fontWeight: "700",
      maxWidth: "100%",
      boxSizing: "border-box",
      background: bad ? ONSAH_TOKENS.badWash : ONSAH_TOKENS.okWash,
      color: bad ? ONSAH_TOKENS.bad : ONSAH_TOKENS.ok
    });
    const icon = bad ? svgSpinePause() : svgSpineCheck();
    icon.setAttribute("width", "10");
    icon.setAttribute("height", "10");
    Object.assign(icon.style, { width: "10px", height: "10px", flex: "0 0 auto" });
    chip.appendChild(icon);
    const lbl = document.createElement("span");
    Object.assign(lbl.style, { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
    lbl.textContent = text;
    chip.appendChild(lbl);
    s.appendChild(chip);
  }
  function showLoadingState(text) {
    const body = $body();
    if (!body) return;
    resetBody(body);
    const T2 = ONSAH_TOKENS;
    const wrap = document.createElement("div");
    Object.assign(wrap.style, { display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", color: T2.ink, fontWeight: "700", fontSize: "13px" });
    const dotsWrap = document.createElement("span");
    Object.assign(dotsWrap.style, { display: "flex", gap: "4px", flex: "0 0 auto" });
    const dots = [];
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      Object.assign(dot.style, { width: "6px", height: "6px", borderRadius: "50%", background: T2.brand, opacity: ".3", transition: "opacity .2s ease, transform .2s ease" });
      dotsWrap.appendChild(dot);
      dots.push(dot);
    }
    let step = 0;
    const timer = setInterval(() => {
      dots.forEach((dot, i) => {
        const active = i === step % 3;
        dot.style.opacity = active ? "1" : ".3";
        dot.style.transform = active ? "scale(1.2)" : "scale(1)";
      });
      step++;
    }, 260);
    const stopTimer = () => clearInterval(timer);
    const stopObserver = new MutationObserver(() => {
      if (!wrap.isConnected) {
        stopTimer();
        stopObserver.disconnect();
      }
    });
    try {
      stopObserver.observe(body, { childList: true });
    } catch (e) {
    }
    setTimeout(() => {
      stopTimer();
      try {
        stopObserver.disconnect();
      } catch (e) {
      }
    }, 3e4);
    const label = document.createElement("span");
    label.textContent = text || "Bezig...";
    wrap.appendChild(dotsWrap);
    wrap.appendChild(label);
    body.appendChild(wrap);
    setStatus(text || "Bezig...");
  }
  function showDisabledState() {
    const body = $body();
    if (!body) return;
    resetBody(body);
    const msg = document.createElement("div");
    msg.textContent = "Uitgeschakeld";
    Object.assign(msg.style, { fontWeight: "700", fontSize: "14px", color: "#555", padding: "4px 0 2px" });
    body.appendChild(msg);
    const sub = document.createElement("div");
    sub.textContent = "Zet de hulp weer aan om automatisch verder te gaan.";
    Object.assign(sub.style, { fontSize: "12px", color: "#666", lineHeight: "1.35" });
    body.appendChild(sub);
    setStatus("Uitgeschakeld", false);
  }
  function safe(fn) {
    try {
      fn();
    } catch (e) {
      setStatus("Er ging iets mis", false);
    }
  }

  // src/content/features/appointment/labels.js
  function selectedKnownLabels(trigger, labels) {
    const known = labels.map(clean).filter(Boolean);
    const found = /* @__PURE__ */ new Set();
    const chips = labelChips(trigger);
    if (chips.length) {
      for (const chip of chips) {
        for (const label of known) if (chip.name === label || chip.name.indexOf(label) !== -1) found.add(label);
      }
      return [...found];
    }
    const triggerText = clean(uiText(trigger) || trigger && trigger.textContent || "");
    for (const label of known) if (triggerText.includes(label)) found.add(label);
    return [...found];
  }
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
  function clickExactDropdownOption(trigger, texts) {
    const best = findExactDropdownOption(trigger, texts);
    if (!best) return false;
    clickOption(best);
    return true;
  }
  function clearKnownLabels(onDone, attempt = 0) {
    const trigger = getEtiketTrigger();
    if (!trigger) {
      if (onDone) onDone(false);
      return;
    }
    const chips = labelChips(trigger);
    if (!chips.length) {
      if (onDone) onDone(true);
      return;
    }
    for (const chip of chips) clickOption(chip.el);
    setTimeout(() => {
      if (!labelChips(trigger).length) {
        clickEmptyModalSpot();
        if (onDone) onDone(true);
        return;
      }
      if (attempt >= 4) {
        clickEmptyModalSpot();
        if (onDone) onDone(false);
        return;
      }
      clearKnownLabels(onDone, attempt + 1);
    }, 150);
  }
  function setLabel(text, onResult) {
    if (!text) {
      onResult(true);
      return;
    }
    const trigger = getEtiketTrigger();
    const selected = trigger ? selectedKnownLabels(trigger, allKnownLabels()) : [];
    const wanted = clean(text);
    if (selected.length === 1 && selected[0] === wanted) {
      onResult(true);
      return;
    }
    clearKnownLabels(() => setTimeout(() => selectLabel(text, onResult), 60));
  }
  function selectedAllLabelChipTexts(trigger) {
    return labelChips(trigger).map((c) => c.name);
  }
  function removeLabelChipsByText(trigger, texts, protect) {
    if (!trigger || !texts || !texts.length) return false;
    const want = texts.map(clean).filter((w) => w && w.length >= 2);
    const prot = clean(protect || "");
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
  function findExactLabelOption(trigger, wanted) {
    const w = clean(wanted);
    if (!w) return null;
    const tr = rect(trigger);
    for (const root of optionSearchRoots(trigger)) {
      for (const el of genericOptionCandidates(root)) {
        if (!visible(el) || isOwnPopup(el) || /input|textarea|select/i.test(el.tagName || "")) continue;
        const row = rowForOptionText(el, root);
        if (!visible(row) || isOwnPopup(row)) continue;
        const txt = clean(optionText(row) || optionText(el));
        if (txt !== w) continue;
        const r = rect(row);
        if (r.top < tr.top - 500 || r.top > tr.bottom + 600) continue;
        if (r.width < 120 || r.height < 20 || r.height > 80) continue;
        return row;
      }
    }
    return null;
  }
  function addLabelExact(text, onResult) {
    const trigger = getEtiketTrigger();
    if (!trigger) {
      onResult(false);
      return;
    }
    const wanted = clean(text);
    clickElementCenter(trigger);
    setTimeout(() => {
      const input2 = searchInputForTrigger(trigger);
      if (input2) {
        input2.focus();
        setInputText(input2, text);
      }
      pollFor(
        () => findExactLabelOption(trigger, wanted),
        (opt) => {
          if (opt) {
            clickOption(opt);
            setTimeout(() => {
              clickEmptyModalSpot();
              onResult(true);
            }, 90);
          } else {
            clickEmptyModalSpot();
            onResult(false);
          }
        },
        { timeout: 2500, interval: 120 }
      );
    }, 140);
  }
  function setLabelExclusive(text, onDone, attempt = 0) {
    if (!text) {
      if (onDone) onDone(true);
      return;
    }
    const trigger = getEtiketTrigger();
    if (!trigger) {
      if (onDone) onDone(false);
      return;
    }
    const wanted = clean(text);
    const isTarget = (l) => l === wanted || l.indexOf(wanted) !== -1;
    const chips = selectedAllLabelChipTexts(trigger);
    const extras = chips.filter((l) => !isTarget(l));
    const triggerTxt = clean(uiText(trigger) || trigger.textContent || "");
    const hasTarget = chips.some(isTarget) || wanted && triggerTxt.indexOf(wanted) !== -1;
    if (!extras.length && hasTarget) {
      if (onDone) onDone(true);
      return;
    }
    if (attempt >= 6) {
      if (extras.length) setStatus('Let op: verwijder zelf nog het extra label "' + extras[0] + '"', false);
      if (onDone) onDone(!extras.length);
      return;
    }
    if (extras.length) {
      removeLabelChipsByText(trigger, extras, wanted);
      setTimeout(() => setLabelExclusive(text, onDone, attempt + 1), 160);
      return;
    }
    addLabelExact(text, () => {
      if (onDone) onDone(true);
    });
  }
  function setLabelsExclusive(texts, onDone, attempt = 0) {
    const wanted = (Array.isArray(texts) ? texts : [texts]).map((t) => clean(t)).filter(Boolean);
    if (!wanted.length) {
      if (onDone) onDone(true);
      return;
    }
    if (wanted.length === 1) {
      setLabelExclusive(wanted[0], onDone, attempt);
      return;
    }
    const trigger = getEtiketTrigger();
    if (!trigger) {
      if (onDone) onDone(false);
      return;
    }
    const isWantedChip = (l) => wanted.some((w) => l === w || l.indexOf(w) !== -1);
    const chips = selectedAllLabelChipTexts(trigger);
    const extras = chips.filter((l) => !isWantedChip(l));
    const triggerTxt = clean(uiText(trigger) || trigger.textContent || "");
    const present = (w) => chips.some((l) => l === w || l.indexOf(w) !== -1) || w && triggerTxt.indexOf(w) !== -1;
    const missing = wanted.filter((w) => !present(w));
    if (!extras.length && !missing.length) {
      if (onDone) onDone(true);
      return;
    }
    if (attempt >= 10) {
      if (extras.length) setStatus('Let op: verwijder zelf nog het extra label "' + extras[0] + '"', false);
      else if (missing.length) setStatus('Let op: voeg zelf nog het label "' + missing[0] + '" toe', false);
      if (onDone) onDone(!extras.length && !missing.length);
      return;
    }
    if (extras.length) {
      removeLabelChipsByText(trigger, extras);
      setTimeout(() => setLabelsExclusive(texts, onDone, attempt + 1), 160);
      return;
    }
    addLabelExact(missing[0], () => setTimeout(() => setLabelsExclusive(texts, onDone, attempt + 1), 150));
  }
  function selectLabel(text, onResult, attempt = 0) {
    const trigger = getEtiketTrigger();
    if (!trigger) {
      onResult(false);
      return;
    }
    clickElementCenter(trigger);
    setTimeout(() => {
      const input2 = searchInputForTrigger(trigger);
      if (input2) {
        input2.focus();
        setInputText(input2, text);
      }
      pollFor(
        () => findExactDropdownOption(trigger, [text]),
        (best) => {
          if (best) {
            clickOption(best);
            setTimeout(() => {
              clickEmptyModalSpot();
              onResult(true);
            }, 90);
            return;
          }
          if (attempt < 3) {
            setTimeout(() => selectLabel(text, onResult, attempt + 1), 180);
            return;
          }
          setTimeout(() => {
            clickEmptyModalSpot();
            onResult(false);
          }, 90);
        },
        { timeout: 2600, interval: 130 }
      );
    }, 130);
  }

  // src/content/features/appointment/client-name.js
  function findClientFirstName() {
    const directName = findClientNameText();
    if (directName) return firstNameFromName(directName);
    const labels = deepQueryAll("div,span,p").filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === "client");
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const el of deepQueryAll("div,span,p,strong,b")) {
        if (!visible(el) || isOwnPopup(el)) continue;
        const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
        const c = clean(txt);
        if (!txt || c === "client" || c.includes("clienten") || c.includes("medewerker") || c.includes("uursoort")) continue;
        if (txt.length > 60 || txt.split(/\s+/).length > 4) continue;
        const r = rect(el);
        if (r.bottom < lr.top - 55 || r.bottom > lr.top + 8) continue;
        if (Math.abs(r.left - lr.left) > 120) continue;
        const score = Math.abs(lr.top - r.bottom) + Math.abs(lr.left - r.left) / 4;
        if (score < bestScore) {
          best = txt;
          bestScore = score;
        }
      }
    }
    return best ? firstNameFromName(best) : "";
  }
  function findClientFirstNames() {
    const names = [];
    const seen = /* @__PURE__ */ new Set();
    for (const entry of findClientEntries()) {
      const first = entry.firstName || firstNameFromName(entry.name);
      const key = clean(first);
      if (first && !seen.has(key)) {
        seen.add(key);
        names.push(first);
      }
    }
    if (!names.length) {
      const first = findClientFirstName();
      if (first) names.push(first);
    }
    return names;
  }
  function setTitleForChoice(choice, onResult) {
    const input2 = getTitleInput();
    if (!input2) {
      onResult(false);
      return;
    }
    const firstNames = findClientFirstNames();
    const titleBase = choice.titleLabel || choice.label;
    const title = firstNames.length ? `${titleBase} - ${firstNames.join(" - ")}` : titleBase;
    setInputText(input2, title);
    onResult(true);
  }
  function removeFirstNameFromTitle(first) {
    if (!first) return;
    const input2 = getTitleInput();
    if (!input2) return;
    const t = String(input2.value || "");
    if (!t) return;
    const parts = t.split(" - ");
    if (parts.length < 2) return;
    const target = clean(first);
    const kept = parts.filter((p, i) => i === 0 || clean(p) !== target);
    if (kept.length !== parts.length) {
      const n = kept.join(" - ");
      if (n !== t) setInputText(input2, n);
    }
  }

  // src/content/features/appointment/clients.js
  function clickInviteeToggle(btn) {
    if (isAddInviteeControl(btn)) {
      return;
    }
    try {
      btn.focus && btn.focus();
    } catch (e) {
    }
    const inner = btn.shadowRoot && btn.shadowRoot.querySelector("button");
    if (inner) clickOption(inner);
    else clickOption(btn);
  }
  function inviteeToggleExpanded(btn) {
    if (!btn) return null;
    const inner = btn.shadowRoot && btn.shadowRoot.querySelector("button");
    const nodes = [btn, inner].filter(Boolean);
    for (const node of nodes) {
      const expanded = node.getAttribute && node.getAttribute("aria-expanded");
      if (expanded === "true") return true;
      if (expanded === "false") return false;
      const label = clean(node.getAttribute && node.getAttribute("aria-label") || "");
      if (label.includes("verbergen")) return true;
      if (label.includes("weergeven") || label.includes("tonen")) return false;
    }
    return null;
  }
  function computeAppointmentUursoortState() {
    invalidateClientEntries();
    const entries = findClientEntries();
    if (!entries.length) return "NEEDS_PREREQS";
    const setCount = entries.filter(entryUursoortIsSet).length;
    if (setCount === 0) return "CHOICE";
    if (setCount === entries.length) return "READY_TO_SAVE";
    return "MIXED";
  }
  function findClientExpandButton() {
    const fullName = findClientNameText();
    const inviteeNames = deepQueryAll('span[class*="_invitee-name_"], ._invitee-name_sohx9_40').filter((el) => visible(el) && !isOwnPopup(el) && (!fullName || (el.textContent || "").trim() === fullName));
    const exactButtons = deepQueryAll(UI_OVERRIDES.afsInviteeToggle || 'uc-button[data-qa="toggle-invitee-fields-button"], [data-qa="toggle-invitee-fields-button"]').filter((btn) => visible(btn) && !isOwnPopup(btn));
    if (fullName) {
      const byLabel = exactButtons.find((btn) => clean(btn.getAttribute("aria-label") || "").includes(clean(fullName)));
      if (byLabel) return byLabel;
    }
    for (const nameEl of inviteeNames) {
      const nr = rect(nameEl);
      const rowButton = exactButtons.map((btn) => ({ btn, r: rect(btn) })).filter(({ r }) => r.left > nr.left + 250 && r.top >= nr.top - 80 && r.top <= nr.top + 70).sort((a, b) => Math.abs(a.r.top + a.r.height / 2 - (nr.top + nr.height / 2)) - Math.abs(b.r.top + b.r.height / 2 - (nr.top + nr.height / 2)))[0];
      if (rowButton) return rowButton.btn;
    }
    const clientLabels = deepQueryAll("div,span,p").filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === "client");
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
        if (score < bestScore) {
          best = btn;
          bestScore = score;
        }
      }
    }
    return best;
  }
  function hasClientInAppointment() {
    if (findClientEntries().length > 0 || !!findClientNameText() || !!findClientFirstName() || !!findClientExpandButton()) return true;
    return deepQueryAll('span[class*="_invitee-info_"], span[class*="_invitee-name_"], ._invitee-info_sohx9_34, ._invitee-name_sohx9_40').some(function(el) {
      if (!visible(el) || isOwnPopup(el)) return false;
      const txt = clean(el.textContent || "");
      if (!txt || txt.includes("medewerker")) return false;
      const r = rect(el);
      return deepQueryAll("div,span,p").some(function(role) {
        if (!visible(role) || isOwnPopup(role) || clean(role.textContent || "") !== "client") return false;
        const rr = rect(role);
        return rr.top >= r.bottom - 12 && rr.top <= r.bottom + 70 && Math.abs(rr.left - r.left) <= 190;
      });
    });
  }
  function clickClientRowChevronFallback() {
    const clientLabels = deepQueryAll("div,span,p").filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === "client");
    let best = null, bestY = null, bestScore = Infinity;
    for (const label of clientLabels) {
      const lr = rect(label);
      for (const section of deepQueryAll("div")) {
        if (!visible(section) || isOwnPopup(section)) continue;
        const sr = rect(section);
        if (sr.left > lr.left - 90 || sr.right < lr.left + 300) continue;
        if (sr.top > lr.top - 70 || sr.bottom < lr.bottom + 20) continue;
        if (sr.width < 260 || sr.width > 760 || sr.height < 60 || sr.height > 240) continue;
        const score = Math.abs(sr.top - (lr.top - 54)) + Math.abs(sr.left - (lr.left - 55));
        if (score < bestScore) {
          best = section;
          bestY = lr.top - 13;
          bestScore = score;
        }
      }
    }
    if (!best) return false;
    const r = rect(best);
    const x = Math.round(r.right - 28);
    const y = Math.round(bestY || r.top + 42);
    if (isAddInviteeControlAtPoint(x, y)) {
      return false;
    }
    clickAt(x, y);
    return true;
  }
  function isAddInviteeControlAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    const host = el.closest && el.closest('button,a,[role="button"],uc-button,[data-qa*="add" i],[data-qa*="invitee" i]');
    if (!host) return false;
    const t = clean(uiText(host) || host.textContent || "");
    const qa = clean(host.getAttribute && host.getAttribute("data-qa") || "");
    return /toevoegen|genodigd/.test(t) || /add|invitee|attendee/.test(qa);
  }
  function ensureClientExpanded(onResult, attempt = 0) {
    invalidateClientEntries();
    const entries = findClientEntries();
    const allOpen = entries.length && entries.every((entry) => !!entry.uursoortTrigger || inviteeToggleExpanded(entry.toggle) === true);
    if (allOpen) {
      onResult(true);
      return;
    }
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
      onResult(finalEntries.length ? finalEntries.every((entry) => !!entry.uursoortTrigger || inviteeToggleExpanded(entry.toggle) === true) : !!findClientUursoortTrigger());
    }
  }

  // src/content/ui/managed-text.js
  function effectiveTextConfig(key) {
    return (APP_CONFIG.texts || {})[key] || {};
  }
  function managedRichHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    const allowed = /* @__PURE__ */ new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "A", "MARK", "FONT", "BR", "P", "DIV", "SPAN", "H2", "H3", "H4", "BLOCKQUOTE", "PRE", "CODE", "UL", "OL", "LI"]);
    template.content.querySelectorAll("script,style,iframe,object,embed,img,svg,form,input,button,link,meta,base,template,noscript,math,frame,frameset,marquee,title").forEach((el) => el.remove());
    template.content.querySelectorAll("*").forEach((el) => {
      if (!allowed.has(el.tagName)) {
        el.replaceWith(...el.childNodes);
        return;
      }
      const originalHref = el.tagName === "A" ? String(el.getAttribute("href") || "") : "";
      const originalColor = el.tagName === "FONT" ? String(el.getAttribute("color") || "") : "";
      const originalStyle = {
        color: el.style.color || originalColor,
        backgroundColor: el.style.backgroundColor,
        fontWeight: el.style.fontWeight,
        fontStyle: el.style.fontStyle,
        textDecoration: el.style.textDecoration
      };
      [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
      if (el.tagName === "A" && /^(?:https?:\/\/|mailto:|#)/i.test(originalHref)) {
        el.setAttribute("href", originalHref);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
      const styleProbe = document.createElement("span").style;
      ["color", "backgroundColor", "fontWeight", "fontStyle", "textDecoration"].forEach((prop) => {
        const value = String(originalStyle[prop] || "").trim();
        if (!value) return;
        styleProbe[prop] = "";
        styleProbe[prop] = value;
        if (styleProbe[prop]) el.style[prop] = styleProbe[prop];
      });
      if (el.tagName === "A") {
        if (!el.style.color) el.style.color = "#cc087d";
        if (!el.style.textDecoration) el.style.textDecoration = "underline";
      }
    });
    return template.content;
  }
  function managedTagClientName() {
    try {
      if (typeof findClientNameText === "function") {
        const found = findClientNameText();
        if (found) return found;
      }
    } catch (e) {
    }
    try {
      if (typeof findClientEntries === "function") {
        const entries = findClientEntries();
        if (entries && entries[0] && entries[0].name) return entries[0].name;
      }
    } catch (e) {
    }
    const selectors = '[data-invitee-name],[data-client-name],[data-testid="client-details-name"],[data-testid="client-name"],.client-name';
    const nodes = typeof deepQueryAll === "function" ? deepQueryAll(selectors) : Array.from(document.querySelectorAll(selectors));
    for (const node of nodes) {
      const raw = node.getAttribute && (node.getAttribute("data-invitee-name") || node.getAttribute("data-client-name")) || node.textContent || "";
      const name = String(raw).replace(/\s+/g, " ").trim();
      if (name && name.length <= 100) return name;
    }
    return "";
  }
  function managedTagClientAge() {
    const selectors = '[data-testid="client-details-birthdate"],[data-date-of-birth],[data-birthdate],[class*="birthdate" i],[class*="geboorte" i]';
    const nodes = typeof deepQueryAll === "function" ? deepQueryAll(selectors) : Array.from(document.querySelectorAll(selectors));
    for (const node of nodes) {
      const raw = [node.textContent, node.getAttribute && node.getAttribute("data-date-of-birth"), node.getAttribute && node.getAttribute("data-birthdate"), node.getAttribute && node.getAttribute("aria-label"), node.getAttribute && node.getAttribute("title")].filter(Boolean).join(" ");
      const direct = raw.match(/\((\d{1,3})\s*jaar\)|\bleeftijd\s*[:\-]?\s*(\d{1,3})\b/i);
      if (direct) {
        const age = parseInt(direct[1] || direct[2], 10);
        if (age >= 0 && age <= 125) return age;
      }
      const dob = raw.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
      if (dob) {
        const born = new Date(+dob[3], +dob[2] - 1, +dob[1]), now = /* @__PURE__ */ new Date();
        let age = now.getFullYear() - born.getFullYear();
        if (now.getMonth() < born.getMonth() || now.getMonth() === born.getMonth() && now.getDate() < born.getDate()) age--;
        if (age >= 0 && age <= 125) return age;
      }
    }
    return null;
  }
  function managedTagValues() {
    return { clientNaam: managedTagClientName(), clientLeeftijd: managedTagClientAge() };
  }
  function replaceManagedTagsIn(root) {
    const values = managedTagValues();
    const replace = (text) => String(text || "").replace(/\{clientNaam\}/gi, values.clientNaam || "{clientNaam}").replace(/\{clientLeeftijd\}/gi, values.clientLeeftijd == null ? "{clientLeeftijd}" : String(values.clientLeeftijd));
    const walk = (node) => {
      if (node.nodeType === 3) {
        node.nodeValue = replace(node.nodeValue);
        return;
      }
      Array.from(node.childNodes || []).forEach(walk);
    };
    walk(root);
    return root;
  }
  function mkText(key, fallbackText, defaultStyle) {
    const el = document.createElement("div");
    const c = APP_CONFIG.features && APP_CONFIG.features.managedTexts === false ? {} : effectiveTextConfig(key);
    if (c.html) el.appendChild(managedRichHtml(c.html).cloneNode(true));
    else el.textContent = c.text != null && c.text !== "" ? c.text : fallbackText;
    replaceManagedTagsIn(el);
    el.style.whiteSpace = "pre-wrap";
    if (defaultStyle) Object.assign(el.style, defaultStyle);
    if (c.color) el.style.color = c.color;
    if (c.bold === true) el.style.fontWeight = "700";
    else if (c.bold === false) el.style.fontWeight = "400";
    if (c.italic === true) el.style.fontStyle = "italic";
    else if (c.italic === false) el.style.fontStyle = "normal";
    if (c.sizePx) el.style.fontSize = (parseInt(c.sizePx, 10) || 13) + "px";
    return el;
  }
  function resolveText(key) {
    return APP_CONFIG.features && APP_CONFIG.features.managedTexts === false ? null : effectiveTextConfig(key);
  }

  // src/content/features/appointment/travel.js
  function appointmentTravelStepperButton(input2, dir) {
    if (!input2) return null;
    const ir = rect(input2);
    const buttons = deepQueryAll('button,[role="button"],uc-button').filter((btn) => visible(btn) && !isOwnPopup(btn)).map((btn) => ({ btn, r: rect(btn), text: clean(btn.textContent || btn.getAttribute("aria-label") || btn.getAttribute("title") || "") })).filter(({ r }) => r.top < ir.bottom + 10 && r.bottom > ir.top - 10 && r.left >= ir.left - 4 && r.left <= ir.right + 130);
    const plus = buttons.filter((b) => /\+|plus|verhoog|increase|increment/.test(b.text)).sort((a, b) => a.r.left - b.r.left).pop();
    const minus = buttons.filter((b) => /\u2212|-|min|verlaag|decrease|decrement/.test(b.text)).sort((a, b) => a.r.left - b.r.left)[0];
    if (dir > 0) return plus && plus.btn || buttons.sort((a, b) => b.r.left - a.r.left)[0]?.btn || null;
    return minus && minus.btn || buttons.sort((a, b) => a.r.left - b.r.left)[0]?.btn || null;
  }
  function clickTravelStepperToValue(input2, wanted) {
    if (!input2) return false;
    const current = Number.parseInt(inputTextValue(input2) || "0", 10);
    if (!Number.isFinite(current) || current === wanted) return current === wanted;
    const diff = wanted - current;
    const btn = appointmentTravelStepperButton(input2, diff);
    if (!btn) return false;
    const count = Math.min(Math.abs(diff), 80);
    for (let i = 0; i < count; i++) clickOption(btn);
    return true;
  }
  function setAppointmentTravelTotalMinutes(totalMinutes) {
    const there = appointmentTravelInput("heen");
    const back = appointmentTravelInput("terug");
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
    const fields = [appointmentTravelInput("heen"), appointmentTravelInput("terug")].filter(Boolean);
    if (!fields.length) return true;
    for (const field2 of fields) setInputTextQuiet(field2, "0");
    return true;
  }
  function appointmentTravelTotalMinutes() {
    const there = appointmentTravelInput("heen");
    const back = appointmentTravelInput("terug");
    if (!there || !back) return null;
    const a = parseInt(inputTextValue(there), 10);
    const b = parseInt(inputTextValue(back), 10);
    const total = (isFinite(a) ? a : 0) + (isFinite(b) ? b : 0);
    return total > 0 ? total : null;
  }

  // src/content/ons/busy-cursor.js
  var _busyDepth = 0;
  var _busyStyleEl = null;
  function _ensureBusyStyle() {
    if (_busyStyleEl) return;
    _busyStyleEl = document.createElement("style");
    _busyStyleEl.id = "ons-helper-busy-style";
    _busyStyleEl.textContent = "html.ons-helper-busy, html.ons-helper-busy * { cursor: progress !important; }";
    (document.head || document.documentElement).appendChild(_busyStyleEl);
  }
  function setBusyCursor(on) {
    _ensureBusyStyle();
    if (on) {
      _busyDepth++;
      document.documentElement.classList.add("ons-helper-busy");
    } else {
      _busyDepth = Math.max(0, _busyDepth - 1);
      if (_busyDepth === 0) document.documentElement.classList.remove("ons-helper-busy");
    }
  }
  function busyWhile(maxMs, run) {
    setBusyCursor(true);
    let done = false;
    const clear = () => {
      if (!done) {
        done = true;
        setBusyCursor(false);
      }
    };
    const guard = setTimeout(clear, maxMs || 6e3);
    run(() => {
      clearTimeout(guard);
      clear();
    });
  }

  // src/content/ui/controls.js
  function applyOnsahPillStyle(el, opts) {
    opts = opts || {};
    const from = opts.from || ONSAH_TOKENS.brand;
    const to = opts.to || ONSAH_TOKENS.brandDeep;
    const shadowRgb = opts.shadowRgb || "204,8,125";
    Object.assign(el.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "7px",
      border: "0",
      borderRadius: "999px",
      padding: "10px 18px",
      font: '700 13px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      color: "#fff",
      background: from,
      cursor: "pointer",
      boxShadow: "0 4px 12px -6px rgba(" + shadowRgb + ",.55)",
      transition: "transform .08s ease, box-shadow .12s ease, background .1s ease",
      boxSizing: "border-box"
    });
    el.addEventListener("mouseenter", () => {
      if (!el.disabled) el.style.boxShadow = "0 6px 16px -5px rgba(" + shadowRgb + ",.6)";
    });
    el.addEventListener("mouseleave", () => {
      el.style.boxShadow = "0 4px 12px -6px rgba(" + shadowRgb + ",.55)";
      el.style.background = from;
    });
    el.addEventListener("mousedown", () => {
      if (!el.disabled) {
        el.style.transform = "translateY(1px)";
        el.style.background = to;
      }
    });
    el.addEventListener("mouseup", () => {
      el.style.transform = "none";
      el.style.background = from;
    });
    onsahFocusRing(el, to);
  }
  function mkPillButton(label, onClick, opts) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    applyOnsahPillStyle(b, opts);
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    });
    return b;
  }
  function onsahEmptyState(text) {
    const T2 = ONSAH_TOKENS;
    const wrap = document.createElement("div");
    Object.assign(wrap.style, { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px", padding: "10px 2px", color: T2.inkSoft, fontSize: "12.5px" });
    const icon = svgEmptyIcon();
    icon.style.width = "22px";
    icon.style.height = "22px";
    icon.style.color = T2.line;
    const lbl = document.createElement("span");
    lbl.textContent = text;
    wrap.append(icon, lbl);
    return wrap;
  }
  function mkButton(label, onClick, opts) {
    opts = opts || {};
    const T2 = ONSAH_TOKENS;
    const hoverBg = opts.accentWash || (opts.accent ? opts.accent + "14" : T2.brandWash);
    const chevColorHover = opts.accent || T2.brand;
    const b = document.createElement("button");
    b.type = "button";
    Object.assign(b.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      width: "100%",
      padding: "10px 11px",
      borderRadius: "11px",
      border: "1px solid " + T2.brand,
      background: "#fff",
      color: opts.accent || T2.ink,
      font: '600 13.5px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      textAlign: "left",
      cursor: "pointer",
      transition: "transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease",
      boxSizing: "border-box"
    });
    if (opts.tick) {
      const tick = document.createElement("span");
      Object.assign(tick.style, { width: "7px", height: "7px", borderRadius: "50%", flex: "0 0 auto", background: opts.tick });
      b.appendChild(tick);
    }
    const lbl = document.createElement("span");
    Object.assign(lbl.style, { flex: "1", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
    lbl.textContent = label;
    b.appendChild(lbl);
    if (opts.meta) {
      const meta = document.createElement("span");
      Object.assign(meta.style, { flex: "0 0 auto", fontSize: "10.5px", color: T2.inkSoft, fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' });
      meta.textContent = opts.meta;
      b.appendChild(meta);
    }
    let chev = null;
    if (opts.chevron !== false) {
      chev = svgIcon("M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z");
      chev.setAttribute("width", "14");
      chev.setAttribute("height", "14");
      Object.assign(chev.style, { width: "14px", height: "14px", color: "#c7bfbc", flex: "0 0 auto", transition: "color .12s ease" });
      b.appendChild(chev);
    }
    b.addEventListener("mouseenter", () => {
      if (b.disabled) return;
      b.style.transform = "translateY(-1px)";
      b.style.boxShadow = "0 4px 14px -6px rgba(32,20,15,.28)";
      b.style.background = hoverBg;
      b.style.borderColor = "transparent";
      if (chev) chev.style.color = chevColorHover;
    });
    b.addEventListener("mouseleave", () => {
      b.style.transform = "none";
      b.style.boxShadow = "none";
      b.style.background = "#fff";
      b.style.borderColor = T2.brand;
      if (chev) chev.style.color = "#c7bfbc";
    });
    b.addEventListener("mousedown", () => {
      if (!b.disabled) b.style.transform = "translateY(0)";
    });
    b.addEventListener("mouseup", () => {
      if (!b.disabled) b.style.transform = "translateY(-1px)";
    });
    onsahFocusRing(b, opts.accent || T2.brand);
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    });
    return b;
  }
  function mkSwitch(initial, onChange) {
    const T2 = ONSAH_TOKENS;
    const sw = document.createElement("button");
    sw.type = "button";
    sw.setAttribute("role", "switch");
    let on = !!initial;
    Object.assign(sw.style, { position: "relative", width: "38px", height: "22px", borderRadius: "999px", border: "0", background: on ? T2.brand : "#c7bfbc", cursor: "pointer", flex: "0 0 auto", padding: "0", transition: "background .15s ease" });
    const knob = document.createElement("span");
    Object.assign(knob.style, { position: "absolute", top: "2px", left: on ? "18px" : "2px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left .15s ease" });
    sw.appendChild(knob);
    const render = () => {
      sw.setAttribute("aria-checked", on ? "true" : "false");
      sw.style.background = on ? T2.brand : "#c7bfbc";
      knob.style.left = on ? "18px" : "2px";
    };
    render();
    sw.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      on = !on;
      render();
      try {
        onChange && onChange(on);
      } catch (err) {
      }
    });
    sw.setChecked = (v) => {
      on = !!v;
      render();
    };
    onsahFocusRing(sw);
    return sw;
  }
  function mkToggleBox(labelKey, fallbackLabel, initial, onChange) {
    const T2 = ONSAH_TOKENS;
    const box = document.createElement("div");
    Object.assign(box.style, { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", border: "1px solid " + T2.brand, borderRadius: "11px", padding: "10px 11px", background: "#fff" });
    const lab = mkText(labelKey, fallbackLabel, { fontSize: "13.5px", color: T2.ink, fontWeight: "600", lineHeight: "1.3" });
    lab.style.flex = "1";
    lab.style.fontWeight = "600";
    lab.style.fontSize = "13.5px";
    lab.style.color = T2.ink;
    const sw = mkSwitch(initial, onChange);
    box.appendChild(lab);
    box.appendChild(sw);
    box._switch = sw;
    return box;
  }
  function mkBackButton(onClick, label) {
    const wrapped = (...args) => {
      helperPanel.suppressAutoUntil = Date.now() + 1200;
      return onClick && onClick(...args);
    };
    const b = mkButton(label || "Terug", wrapped);
    b.textContent = "";
    b.appendChild(svgIcon("M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20z"));
    b.appendChild(document.createTextNode(label || "Terug"));
    Object.assign(b.style, { display: "inline-flex", alignItems: "center", justifyContent: "flex-start", gap: "6px", textAlign: "left", width: "100%" });
    return b;
  }

  // src/content/services/ons-api/clients.js
  function pickClientIdFromSearch(json, name) {
    const clients = json && Array.isArray(json.clients) ? json.clients : Array.isArray(json) ? json : [];
    if (!clients.length) return null;
    const namesOf = (c) => [c && c.display_name, c && c.name, c && c.sortable_name, c && c.full_name].filter(Boolean).map(clean);
    const idOf = (c) => c && c.id != null ? String(c.id) : null;
    const want = clean(name);
    if (want) {
      const exact = clients.find((c) => namesOf(c).some((n) => n === want));
      if (exact) return idOf(exact);
      const tokens = want.split(" ").filter(Boolean);
      if (tokens.length) {
        const tokMatch = clients.filter((c) => {
          const blob = namesOf(c).join(" ");
          return tokens.every((t) => blob.indexOf(t) !== -1);
        });
        if (tokMatch.length === 1) return idOf(tokMatch[0]);
      }
    }
    if (clients.length === 1) return idOf(clients[0]);
    return null;
  }
  async function searchClients(term, outOfCare) {
    try {
      const json = await getJson(_apiUrl("searchClients", { term, outOfCare }));
      return json && Array.isArray(json.clients) ? json.clients : Array.isArray(json) ? json : [];
    } catch (e) {
      return [];
    }
  }
  var clientIdByName = /* @__PURE__ */ Object.create(null);
  async function findClientIdByName(name) {
    const nm = String(name || "").trim();
    if (!nm) return null;
    if (clientIdByName[nm]) return clientIdByName[nm];
    const clients = await searchClients(nm, "false");
    let id = pickClientIdFromSearch({ clients }, nm);
    if (!id) {
      const more = await searchClients(nm, "true");
      const byId = /* @__PURE__ */ new Map();
      clients.concat(more).forEach((c) => {
        if (c && c.id != null) byId.set(String(c.id), c);
      });
      id = pickClientIdFromSearch({ clients: Array.from(byId.values()) }, nm);
    }
    if (id) {
      clientIdByName[nm] = id;
      return id;
    }
    return null;
  }

  // src/content/services/ons-api/employee.js
  async function getEmployeeIdAsync() {
    return employeeIdFromUrl() || employeeIdFromDom() || await employeeIdFromCalendarVariables() || await employeeIdFromPageScript();
  }
  function employeeIdFromUrl() {
    const href = String(location.href || "");
    const m = href.match(/\/invitees\/(\d+)/i) || href.match(/(?:employee_id|invitee_id)[s]?(?:%5B%5D|\[\])=(\d+)/i);
    return m ? m[1] : null;
  }
  function employeeIdFromDom() {
    const input2 = document.querySelector('input[name*="employee_id"], [data-employee-id], input[name="agenda_owner_id"], input[name*="invitee_id"]');
    return input2 && (input2.value || input2.getAttribute("data-employee-id")) || null;
  }
  async function employeeIdFromCalendarVariables() {
    try {
      const json = await getJson(_apiUrl("calendarVariables", { date: agendaYmd(/* @__PURE__ */ new Date()) }));
      const employee = json && Array.isArray(json.invitees) ? json.invitees.find((i) => i.type === "employee" && i.id != null) : null;
      return employee ? String(employee.id) : null;
    } catch (e) {
      return null;
    }
  }
  var PAGE_SCRIPT_TIMEOUT_MS = 1500;
  function employeeIdFromPageScript() {
    return new Promise((resolve) => {
      const eventId = "ons_data_" + Math.random().toString(36).slice(2, 11);
      const script = document.createElement("script");
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
      let settled = false;
      const finish = (id) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        window.removeEventListener(eventId, listener);
        script.remove();
        resolve(id);
      };
      const listener = (e) => finish(e.detail && e.detail.empId ? String(e.detail.empId) : null);
      const timer = setTimeout(() => finish(null), PAGE_SCRIPT_TIMEOUT_MS);
      window.addEventListener(eventId, listener);
      document.documentElement.appendChild(script);
    });
  }

  // src/content/services/ons-api/products.js
  function parseProductList(json) {
    if (!json || !Array.isArray(json.basic_list)) return [];
    const cats = ["Onlangs gebruikt", "Geadviseerd", "Toegestaan"];
    const out = [], seen = /* @__PURE__ */ new Set();
    json.basic_list.forEach(function(group) {
      if (!Array.isArray(group) || cats.indexOf(group[0]) === -1) return;
      const items = Array.isArray(group[1]) ? group[1] : [];
      items.forEach(function(item) {
        const name = Array.isArray(item) ? String(item[0] == null ? "" : item[0]).trim() : "";
        if (!name) return;
        const key = clean(name);
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(name);
      });
    });
    return out;
  }
  var PRODUCT_LIST_TTL_MS = 5 * 60 * 1e3;
  var productListCache = /* @__PURE__ */ Object.create(null);
  async function fetchProductList({ date, employeeId, clientIds }) {
    let url = _apiUrl("productList", { date, employeeId, clientId: clientIds[0] });
    for (let k = 1; k < clientIds.length; k++) {
      url += "&client_ids%5B%5D=" + encodeURIComponent(clientIds[k]);
    }
    const cached = productListCache[url];
    if (cached && Date.now() - cached.ts < PRODUCT_LIST_TTL_MS && cached.list && cached.list.length) {
      return cached.list.slice();
    }
    const json = await getJson(url);
    if (!json || !Array.isArray(json.basic_list)) throw new Error("ongeldige product_selection response");
    const list = parseProductList(json);
    if (list.length) productListCache[url] = { ts: Date.now(), list: list.slice() };
    return list;
  }

  // src/content/features/appointment/uursoort-source.js
  function clientScope(context2, trigger) {
    if (context2 && context2.card) return context2.card;
    if (trigger && trigger.closest) {
      return trigger.closest('ul[class*="_selected-clients_"] > li') || trigger.closest('ul[data-qa="selected_clients"] > li') || trigger.closest("li") || null;
    }
    return null;
  }
  function scopeClientName(scope, context2) {
    if (scope) {
      const el = scope.querySelector('span[class*="invitee-name"], span[class*="_invitee-name_"]');
      const nm = el ? String(el.innerText || el.textContent || "").trim() : "";
      if (nm) return nm;
    }
    return context2 && context2.name ? String(context2.name).trim() : "";
  }
  async function getClientIdsAsync(context2, trigger) {
    const candidates = [];
    const add = (v) => {
      const s = String(v == null ? "" : v).trim();
      if (/^\d+$/.test(s) && !candidates.includes(s)) candidates.push(s);
    };
    const scope = clientScope(context2, trigger);
    const name = String(context2 && context2.name || scopeClientName(scope, null) || "").trim();
    if (name) {
      const byName = await findClientIdByName(name);
      if (byName) return [byName];
    }
    if (context2 && context2.clientId != null) add(context2.clientId);
    if (scope) {
      scope.querySelectorAll('input[name="event[client_ids][]"], input[name="client_id"], input[type="hidden"][name*="client"]').forEach((el) => add(el.value));
      scope.querySelectorAll("[data-client-id],[data-patient-id]").forEach((el) => {
        add(el.getAttribute("data-client-id"));
        add(el.getAttribute("data-patient-id"));
      });
      if (candidates.length) return candidates.slice(0, 1);
    }
    const href = String(location.href || "");
    const m = href.match(/client_id[s]?(?:%5B%5D|\[\])=(\d+)/g);
    if (m) m.forEach((match) => {
      const id = match.match(/(\d+)/);
      if (id) add(id[1]);
    });
    else {
      const singleMatch = href.match(/\/clients\/(\d+)/i);
      if (singleMatch) add(singleMatch[1]);
    }
    document.querySelectorAll('input[name="event[client_ids][]"], input[name="client_id"], input[type="hidden"][name*="client"]').forEach((el) => add(el.value));
    return candidates;
  }
  async function fetchClientUursoortOptionsApi(context2, trigger) {
    const employeeId = await getEmployeeIdAsync();
    const clientIds = await getClientIdsAsync(context2, trigger);
    if (!employeeId) throw new Error("geen employee-id gevonden");
    if (!clientIds || clientIds.length === 0) throw new Error("geen client-id gevonden");
    return fetchProductList({ date: agendaYmd(/* @__PURE__ */ new Date()), employeeId, clientIds });
  }
  function prefetchClientUursoorten(context2, trigger) {
    try {
      fetchClientUursoortOptionsApi(context2 || null, trigger || null).catch(function() {
      });
    } catch (e) {
    }
  }
  var prefetchedNames = /* @__PURE__ */ Object.create(null);
  function resetPrefetchedUursoorten() {
    prefetchedNames = /* @__PURE__ */ Object.create(null);
  }
  function maybePrefetchUursoorten() {
    try {
      invalidateClientEntries();
      findClientEntries().forEach(function(e) {
        const nm = e && e.name ? String(e.name).trim() : "";
        if (!nm) return;
        const key = (location.pathname || "") + "|" + clean(nm);
        if (prefetchedNames[key]) return;
        prefetchedNames[key] = true;
        prefetchClientUursoorten({ name: nm, trigger: e && e.uursoortTrigger || null }, e && e.uursoortTrigger || null);
      });
    } catch (e) {
    }
  }
  function listUursoortOptions(cb, triggerArg = null, attempt = 0, scrape = false, clientContext = null) {
    const trigger = triggerArg || getUursoortTrigger();
    if (!trigger) {
      cb(null);
      return;
    }
    if (scrape) {
      scrapeUursoortOptions(cb, trigger, triggerArg, attempt, clientContext);
      return;
    }
    fetchClientUursoortOptionsApi(clientContext, trigger).then(function(out) {
      if (out && out.length > 0) cb(out);
      else throw new Error("API leverde een lege lijst op");
    }).catch(function() {
      dismissOpenDropdowns();
      setTimeout(() => listUursoortOptions(cb, triggerArg, attempt, true, clientContext), 70);
    });
  }
  function scrapeUursoortOptions(cb, trigger, triggerArg, attempt, clientContext) {
    const openedBy = openSelectCombobox(trigger) || trigger;
    setTimeout(() => {
      const input2 = searchInputForTrigger(openedBy) || searchInputForTrigger(trigger);
      if (input2) {
        input2.focus();
        setInputTextComposed(input2, "");
      }
      setTimeout(() => {
        scanClientUursoortOptions(trigger, (out) => {
          if (!out.length && attempt < 2) {
            clickEmptyModalSpot();
            setTimeout(() => listUursoortOptions(cb, triggerArg, attempt + 1, true, clientContext), 140);
            return;
          }
          cb(out);
          setTimeout(clickEmptyModalSpot, 60);
        });
      }, input2 ? 140 : 20);
    }, 170);
  }

  // src/content/features/appointment/undo.js
  var _appointmentSnapshot = null;
  function takeAppointmentSnapshot() {
    try {
      const lees = (el) => el ? String(inputTextValue(el) || "") : null;
      _appointmentSnapshot = {
        titel: lees(OnsAdapter.afspraak.titelVeld()),
        eind: lees(OnsAdapter.afspraak.eindtijdVeld()),
        heen: lees(OnsAdapter.afspraak.reistijdVeld("heen")),
        terug: lees(OnsAdapter.afspraak.reistijdVeld("terug")),
        labels: OnsAdapter.afspraak.labels()
      };
    } catch (e) {
      _appointmentSnapshot = null;
    }
    return _appointmentSnapshot;
  }
  function hasAppointmentSnapshot() {
    return !!_appointmentSnapshot;
  }
  function clearAppointmentSnapshot() {
    _appointmentSnapshot = null;
  }
  function restoreAppointmentSnapshot(onDone) {
    const snap = _appointmentSnapshot;
    if (!snap) {
      if (onDone) onDone(false);
      return;
    }
    const zet = (el, waarde) => {
      if (el && waarde != null) setInputTextOns(el, waarde);
    };
    try {
      zet(OnsAdapter.afspraak.titelVeld(), snap.titel);
      zet(OnsAdapter.afspraak.eindtijdVeld(), snap.eind);
      zet(OnsAdapter.afspraak.reistijdVeld("heen"), snap.heen);
      zet(OnsAdapter.afspraak.reistijdVeld("terug"), snap.terug);
    } catch (e) {
    }
    OnsAdapter.afspraak.wisLabels(function() {
      const terug = (snap.labels || []).slice();
      const volgende = function() {
        if (!terug.length) {
          OnsAdapter.clienten.wisUursoorten(function() {
            clearAppointmentSnapshot();
            if (onDone) onDone(true);
          });
          return;
        }
        OnsAdapter.afspraak.zetLabel(terug.shift(), volgende);
      };
      volgende();
    });
  }
  function clearSettings() {
    appointmentFlow.appointmentClearingSettings = true;
    appointmentFlow.appointmentAwaitingManualUursoort = false;
    appointmentFlow.uursoortQueueGen++;
    appointmentFlow.uursoortQueueActive = false;
    appointmentFlow.appointmentFlowBusy = false;
    resetPrefetchedUursoorten();
    appointmentFlow.pendingChoice = null;
    appointmentFlow.appointmentTypeApplied = false;
    appointmentFlow.helperEndText = "";
    appointmentFlow.appointmentEndTimeUserOwned = false;
    appointmentFlow.activeNonClientOption = null;
    showLoadingState("Instellingen verwijderen...");
    setStatus("Instellingen verwijderen...");
    appointmentFlow.activeAppointmentDurationMinutes = null;
    appointmentFlow.activeAppointmentStartTimeText = "";
    appointmentFlow.appointmentTimeGuardTimers.forEach((timer) => clearTimeout(timer));
    appointmentFlow.appointmentTimeGuardTimers = [];
    const afterOpen = () => {
      const titleOk = clearTitle();
      const endTimeOk = clearEndTime();
      const travelOk = clearAppointmentTravelTimes();
      clearKnownLabels((labelOk) => clearAllUursoorten(() => {
        appointmentFlow.appointmentClearingSettings = false;
        showChoices();
        const msg = ["Instellingen verwijderd"];
        if (!titleOk) msg.push("titel niet gevonden");
        if (!endTimeOk) msg.push("eindtijd niet gevonden");
        if (!travelOk) msg.push("reistijd niet gevonden");
        if (!labelOk) msg.push("label niet verwijderd");
        invalidateClientEntries();
        try {
          maybePrefetchUursoorten();
        } catch (e) {
        }
        if (anyUursoortPresent()) msg.push("verwijder zelf nog eventueel de uursoorten");
        setStatus(msg.join(" | "), titleOk && endTimeOk && travelOk && labelOk);
      }));
    };
    if (hasClientInAppointment() && uursoortContexts().length < findClientEntries().length) ensureClientExpanded(() => afterOpen());
    else afterOpen();
  }
  function addResetButton(body) {
    const reset = mkButton("Verwijder instellingen", () => safe(clearSettings), { tick: false, chevron: false, accent: "#a3241f", accentWash: "#fbeceb" });
    body.appendChild(reset);
  }

  // src/content/ui/modal-shell.js
  function mkModalShell(id, titleText, opts) {
    opts = opts || {};
    var old = document.getElementById(id);
    if (old) old.remove();
    var overlay = document.createElement("div");
    overlay.id = id;
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(20,15,13,.5);display:flex;align-items:center;justify-content:center;padding:16px";
    var card = document.createElement("div");
    card.style.cssText = "background:#fff;color:#201d1f;max-width:" + (opts.maxWidth || "420px") + ';width:100%;max-height:calc(100vh - 40px);border-radius:20px;box-shadow:0 24px 64px rgba(20,15,13,.4);font:13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;overflow:hidden;display:flex';
    var spine = document.createElement("div");
    spine.style.cssText = "width:14px;flex:0 0 auto;background:" + (opts.spineColor || "#cc087d") + ";";
    var mainCol = document.createElement("div");
    mainCol.style.cssText = "flex:1 1 auto;min-width:0;display:flex;flex-direction:column;overflow:auto";
    var head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid #f1ecea;position:sticky;top:0;background:#fff";
    var htitle = document.createElement("div");
    htitle.textContent = titleText;
    htitle.style.cssText = "font-weight:800;font-size:15px;color:#201d1f";
    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Sluiten");
    close.style.cssText = "border:1px solid #ece7e5;background:#f6f2f0;color:#6b6367;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;flex:0 0 auto";
    close.appendChild(svgCloseIcon());
    onsahFocusRing(close);
    head.append(htitle, close);
    mainCol.appendChild(head);
    var body = document.createElement("div");
    body.style.cssText = "padding:14px 16px";
    mainCol.appendChild(body);
    card.appendChild(spine);
    card.appendChild(mainCol);
    overlay.appendChild(card);
    var closeModal = function() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    };
    function onKey(e) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    close.addEventListener("click", closeModal);
    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) closeModal();
    });
    (document.body || document.documentElement).appendChild(overlay);
    return { overlay, body, close: closeModal };
  }

  // src/content/ui/choice-style.js
  function onsahPaletteSolidColor(key) {
    const def = APP_CONFIG.palette && APP_CONFIG.palette[key];
    const raw = String(def && (def.legend || def.fill) || "").trim();
    const m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    return m ? "rgb(" + m[1] + "," + m[2] + "," + m[3] + ")" : "#999";
  }
  function onsahCategoryColor(clientPresent, index) {
    const pair = clientPresent ? ["rood", "blauw"] : ["geel", "groen"];
    return onsahPaletteSolidColor(pair[(index || 0) % 2]);
  }
  function onsahChoiceDotColor(choice, index) {
    const key = choice && choice.kleur;
    if (key && APP_CONFIG.palette && APP_CONFIG.palette[key]) return onsahPaletteSolidColor(key);
    return onsahCategoryColor(choice && choice.clientPresent, index);
  }
  function onsahChoiceDirectIndirectLabel(choice) {
    const forms = APP_CONFIG && APP_CONFIG.registrationForms || [];
    const labels = choice && choice.etiketten && choice.etiketten.length ? choice.etiketten : choice && choice.etiket ? [choice.etiket] : [];
    if (!labels.length) return "";
    for (let i = 0; i < forms.length; i++) {
      const f = forms[i];
      if (f.labels && f.labels.some((l) => labels.indexOf(l) !== -1)) return directIndirectLabel(f.startVerdeling);
    }
    return "";
  }
  function onsahRegistrationIsDirect(choice) {
    if (!choice) return true;
    if (choice.directFullDuration) return true;
    if (choice.indirectFullDuration) return false;
    if (choice.startSplit) return choice.startSplit.directPct >= choice.startSplit.indirectPct;
    return true;
  }

  // src/content/ui/duration-picker.js
  var PICKER_CHIP_LIMIT = 16;
  function styleChipButton(chip) {
    const T2 = ONSAH_TOKENS;
    Object.assign(chip.style, {
      padding: "9px 6px",
      borderRadius: "10px",
      border: "1px solid " + T2.line,
      background: "#fff",
      font: '600 13px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      color: T2.ink,
      cursor: "pointer",
      fontVariantNumeric: "tabular-nums",
      textAlign: "center",
      boxSizing: "border-box",
      transition: "transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease"
    });
    chip.addEventListener("mouseenter", () => {
      chip.style.transform = "translateY(-1px)";
      chip.style.boxShadow = "0 4px 12px -6px rgba(32,20,15,.28)";
      chip.style.background = T2.brandWash;
      chip.style.borderColor = "transparent";
    });
    chip.addEventListener("mouseleave", () => {
      chip.style.transform = "none";
      chip.style.boxShadow = "none";
      chip.style.background = "#fff";
      chip.style.borderColor = T2.line;
    });
    onsahFocusRing(chip);
  }
  function durationChipLabel(minutes, stijl) {
    return stijl === "minuten" ? minutes + " min." : registrationDurationLabel(minutes);
  }
  function durationLabelStyle(soort) {
    const g = _agGenSettings();
    const key = soort === "reistijd" ? "travelLabelStyle" : "durationLabelStyle";
    const v = g[key];
    if (v === "minuten" || v === "urenMinuten") return v;
    return soort === "reistijd" ? "minuten" : "urenMinuten";
  }
  function mkChipGrid(values, onPick, labelStijl) {
    const grid2 = document.createElement("div");
    Object.assign(grid2.style, { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: "7px" });
    values.forEach((m) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.textContent = durationChipLabel(m, labelStijl);
      styleChipButton(chip);
      chip.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onPick(m);
      });
      grid2.appendChild(chip);
    });
    return grid2;
  }
  function mkHourMinutePicker(values, onPick, labelStijl) {
    const byHour = /* @__PURE__ */ new Map();
    values.forEach((v) => {
      const h = Math.floor(v / 60);
      if (!byHour.has(h)) byHour.set(h, []);
      byHour.get(h).push(v % 60);
    });
    const hours = [...byHour.keys()].sort((a, b) => a - b);
    const wrap = document.createElement("div");
    const cap = document.createElement("div");
    Object.assign(cap.style, { fontSize: "12px", fontWeight: "700", color: ONSAH_TOKENS.inkSoft, margin: "0 0 7px" });
    const stage = document.createElement("div");
    wrap.append(cap, stage);
    function mkGrid() {
      const grid2 = document.createElement("div");
      Object.assign(grid2.style, { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))", gap: "7px" });
      return grid2;
    }
    function renderAlleMinuten() {
      cap.textContent = "Kies de duur:";
      stage.innerHTML = "";
      const grid2 = mkGrid();
      values.slice().sort((a, b) => a - b).forEach((v) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = durationChipLabel(v, labelStijl);
        styleChipButton(btn);
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onPick(v);
        });
        grid2.appendChild(btn);
      });
      stage.appendChild(grid2);
    }
    function renderHours() {
      cap.textContent = "Aantal uren:";
      stage.innerHTML = "";
      const grid2 = mkGrid();
      hours.forEach((h) => {
        const mins = byHour.get(h);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = h === 0 ? "< 1 uur" : h + " uur";
        styleChipButton(btn);
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (mins.length === 1) onPick(h * 60 + mins[0]);
          else renderMinutes(h, mins);
        });
        grid2.appendChild(btn);
      });
      stage.appendChild(grid2);
    }
    function renderMinutes(h, mins) {
      cap.textContent = h + " uur — aantal minuten:";
      stage.innerHTML = "";
      const back = document.createElement("button");
      back.type = "button";
      back.textContent = "‹ Ander aantal uren";
      Object.assign(back.style, { border: "0", background: "none", color: ONSAH_TOKENS.inkSoft, font: '600 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', cursor: "pointer", padding: "0 0 8px", display: "block" });
      back.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        renderHours();
      });
      const grid2 = mkGrid();
      mins.slice().sort((a, b) => a - b).forEach((m) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = m + " min.";
        styleChipButton(btn);
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onPick(h * 60 + m);
        });
        grid2.appendChild(btn);
      });
      stage.append(back, grid2);
    }
    const PICKER_UUR_DREMPEL = 30;
    if (hours.length <= 1 || values.length <= PICKER_UUR_DREMPEL) renderAlleMinuten();
    else renderHours();
    return wrap;
  }
  function mkTimePicker(values, initial, onPick) {
    const T2 = ONSAH_TOKENS;
    const min = values[0], max = values[values.length - 1];
    const step = values.length > 1 ? values[1] - values[0] : 1;
    let cur = values.includes(initial) ? initial : values[0];
    const wrap = document.createElement("div");
    Object.assign(wrap.style, { display: "flex", flexDirection: "column", gap: "14px", padding: "4px 0 2px" });
    const readout = document.createElement("div");
    Object.assign(readout.style, { textAlign: "center", font: '800 22px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: T2.ink, fontVariantNumeric: "tabular-nums" });
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(cur);
    Object.assign(slider.style, { width: "100%", height: "6px", borderRadius: "999px", accentColor: T2.brand, outline: "none", margin: "2px 0", boxSizing: "border-box" });
    const steps = document.createElement("div");
    Object.assign(steps.style, { display: "flex", alignItems: "center", justifyContent: "center", gap: "14px" });
    function mkStepBtn(symbol, delta, label) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = symbol;
      b.setAttribute("aria-label", label);
      Object.assign(b.style, { width: "34px", height: "34px", borderRadius: "50%", border: "1px solid " + T2.line, background: "#fff", color: T2.ink, font: '700 17px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .12s ease, border-color .12s ease, transform .12s ease" });
      b.addEventListener("mouseenter", () => {
        b.style.background = T2.brandWash;
        b.style.borderColor = "transparent";
      });
      b.addEventListener("mouseleave", () => {
        b.style.background = "#fff";
        b.style.borderColor = T2.line;
      });
      onsahFocusRing(b);
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        cur = Math.max(min, Math.min(max, cur + delta));
        render();
      });
      return b;
    }
    const minus = mkStepBtn("−", -step, registrationDurationLabel(step) + " minder");
    const plus = mkStepBtn("+", step, registrationDurationLabel(step) + " meer");
    const hint = document.createElement("div");
    Object.assign(hint.style, { fontSize: "11px", color: T2.inkSoft, minWidth: "120px", textAlign: "center" });
    hint.textContent = "stap " + registrationDurationLabel(step) + " · max " + registrationDurationLabel(max);
    steps.append(minus, hint, plus);
    const confirmBtn = mkPillButton("Kies deze duur", () => onPick(cur), { shadowRgb: "204,8,125" });
    Object.assign(confirmBtn.style, { width: "100%", boxSizing: "border-box" });
    function render() {
      readout.textContent = registrationDurationLabel(cur);
      slider.value = String(cur);
    }
    slider.addEventListener("input", () => {
      cur = +slider.value;
      render();
    });
    wrap.append(readout, slider, steps, confirmBtn);
    render();
    return wrap;
  }
  function mkValuePicker(values, initial, onPick, style) {
    return mkDurationPicker(values, onPick, style, initial, durationLabelStyle("reistijd"));
  }
  function mkTwoColumnDurationPicker(values, onPick) {
    const T2 = ONSAH_TOKENS;
    const set = new Set(values);
    const hours = [...new Set(values.map((v) => Math.floor(v / 60)))].sort((a, b) => a - b);
    const mins = [...new Set(values.map((v) => v % 60))].sort((a, b) => a - b);
    let selHour = null, selMin = null;
    function comboValid(h, m) {
      return h != null && m != null && set.has(h * 60 + m);
    }
    function mkItemBtn(label, onClick) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.dataset.sel = "0";
      Object.assign(b.style, {
        padding: "7px 6px",
        borderRadius: "9px",
        border: "1px solid " + T2.line,
        background: "#fff",
        font: '600 13px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: T2.ink,
        cursor: "pointer",
        fontVariantNumeric: "tabular-nums",
        textAlign: "center",
        boxSizing: "border-box",
        transition: "background .12s ease, border-color .12s ease, opacity .12s ease, color .12s ease"
      });
      b.addEventListener("mouseenter", () => {
        if (!b.disabled && b.dataset.sel !== "1") {
          b.style.background = T2.brandWash;
          b.style.borderColor = "transparent";
        }
      });
      b.addEventListener("mouseleave", () => {
        if (b.dataset.sel !== "1") {
          b.style.background = "#fff";
          b.style.borderColor = T2.line;
        }
      });
      onsahFocusRing(b);
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!b.disabled) onClick();
      });
      return b;
    }
    function mkColumn(title) {
      const col = document.createElement("div");
      Object.assign(col.style, { flex: "1 1 0", minWidth: "0", display: "flex", flexDirection: "column", gap: "5px" });
      const h = document.createElement("div");
      h.textContent = title;
      Object.assign(h.style, { fontSize: "10.5px", fontWeight: "700", color: T2.inkSoft, textAlign: "center", marginBottom: "2px" });
      col.appendChild(h);
      return col;
    }
    const hourCol = mkColumn("Uren");
    const minCol = mkColumn("Minuten");
    const hourBtns = /* @__PURE__ */ new Map(), minBtns = /* @__PURE__ */ new Map();
    hours.forEach((h) => {
      const b = mkItemBtn(h + " uur", () => {
        selHour = h;
        renderState();
        tryApply();
      });
      hourBtns.set(h, b);
      hourCol.appendChild(b);
    });
    mins.forEach((m) => {
      const b = mkItemBtn(m + " min.", () => {
        selMin = m;
        renderState();
        tryApply();
      });
      minBtns.set(m, b);
      minCol.appendChild(b);
    });
    function paint(b, isSel, invalid) {
      b.dataset.sel = isSel ? "1" : "0";
      b.disabled = invalid;
      b.style.cursor = invalid ? "not-allowed" : "pointer";
      b.style.opacity = invalid ? ".35" : "1";
      b.style.background = isSel ? T2.brand : "#fff";
      b.style.color = isSel ? "#fff" : T2.ink;
      b.style.borderColor = isSel ? T2.brand : T2.line;
    }
    function renderState() {
      hourBtns.forEach((b, h) => paint(b, selHour === h, selMin != null && !comboValid(h, selMin)));
      minBtns.forEach((b, m) => paint(b, selMin === m, selHour != null && !comboValid(selHour, m)));
    }
    function tryApply() {
      if (comboValid(selHour, selMin)) onPick(selHour * 60 + selMin);
    }
    const wrap = document.createElement("div");
    const cap = document.createElement("div");
    cap.textContent = "Kies uren én minuten:";
    Object.assign(cap.style, { fontSize: "12px", fontWeight: "700", color: T2.inkSoft, margin: "0 0 8px" });
    const cols = document.createElement("div");
    Object.assign(cols.style, { display: "flex", gap: "10px" });
    cols.append(hourCol, minCol);
    wrap.append(cap, cols);
    renderState();
    return wrap;
  }
  function mkDurationPicker(values, onPick, style, initial, labelStijl) {
    const start = initial != null ? initial : values[0];
    if (style === "minutenRooster") return mkChipGrid(values, onPick, labelStijl);
    if (style === "slider") return mkTimePicker(values, start, onPick);
    if (style === "columns") return mkTwoColumnDurationPicker(values, onPick);
    if (style === "hourMinute") return mkHourMinutePicker(values, onPick, labelStijl);
    if (values.length <= PICKER_CHIP_LIMIT) return mkChipGrid(values, onPick, labelStijl);
    return mkHourMinutePicker(values, onPick, labelStijl);
  }

  // src/content/ui/react-bridge.js
  function onsahReact() {
    var b = typeof window !== "undefined" ? window.__onsahReact : null;
    return b && typeof b.renderWizardScreen === "function" ? b : null;
  }
  function renderBundleMissing(container) {
    if (!container) return;
    try {
      container.innerHTML = "";
      var box = document.createElement("div");
      box.style.cssText = "font-size:13px;color:#b3261e;font-weight:700;line-height:1.4;padding:6px 0";
      box.textContent = "De schermen van de hulp konden niet worden geladen.";
      var sub = document.createElement("div");
      sub.style.cssText = "font-size:12px;color:#6b6367;font-weight:400;margin-top:4px";
      sub.textContent = "De extensie is waarschijnlijk niet volledig geïnstalleerd. Meld dit via ‘Meld probleem’.";
      box.appendChild(sub);
      container.appendChild(box);
    } catch (e) {
    }
  }
  function renderScreen(container, name, props) {
    var b = onsahReact();
    if (!b) {
      renderBundleMissing(container);
      return false;
    }
    var p = props || {};
    if (p.keyboardEnabled === void 0) {
      p = Object.assign({}, p, { keyboardEnabled: !helperPanel.popupCollapsed && helperPanel.helperEnabled !== false && !helperPanel._infoPanelRestore });
    }
    b.renderWizardScreen(container, name, p);
    return true;
  }

  // src/content/services/ons-api/open-registrations.js
  var OVERLAP_TTL_MS = 6e4;
  var _overlapCache = /* @__PURE__ */ Object.create(null);
  function overlapKey(ymd2, startMin, endMin, hourTypeId) {
    return ymd2 + "|" + startMin + "|" + endMin + "|" + (hourTypeId || "");
  }
  function fetchOnsOverlap(ymd2, startMin, endMin, hourTypeId) {
    const startTime = isoLocalWithOffset(ymd2, startMin);
    const endTime = isoLocalWithOffset(ymd2, endMin);
    if (!startTime || !endTime || !(endMin > startMin)) return Promise.resolve(null);
    const key = overlapKey(ymd2, startMin, endMin, hourTypeId);
    const c = _overlapCache[key];
    if (c && Date.now() - c.ts < OVERLAP_TTL_MS) return c.promise;
    const promise = getJson(_apiUrl("detectOverlap", { date: ymd2, startTime, endTime, hourTypeId: hourTypeId || "" })).then(parseDetectOverlap).catch(function() {
      return null;
    }).then(function(v) {
      _overlapCache[key].value = v;
      return v;
    });
    _overlapCache[key] = { ts: Date.now(), promise, value: void 0 };
    return promise;
  }
  function knownOnsOverlap(ymd2, startMin, endMin, hourTypeId) {
    const c = _overlapCache[overlapKey(ymd2, startMin, endMin, hourTypeId)];
    if (!c || Date.now() - c.ts >= OVERLAP_TTL_MS) return void 0;
    return c.value;
  }
  function _setOnsOverlapForTest(ymd2, startMin, endMin, value) {
    _overlapCache[overlapKey(ymd2, startMin, endMin, "")] = { ts: Date.now(), promise: Promise.resolve(value), value };
  }
  var MAX_RANGE_WEEKS = 26;
  function fetchEntriesForRange(inviteeId, fromYmd, toYmd, onProgress) {
    const weeks = weekStartsBetween(fromYmd, toYmd);
    if (!weeks.length) return Promise.reject(new Error("ongeldige periode"));
    if (weeks.length > MAX_RANGE_WEEKS) return Promise.reject(new Error("periode te lang (max " + MAX_RANGE_WEEKS + " weken)"));
    const results = new Array(weeks.length);
    let next = 0, done = 0;
    return new Promise(function(resolve, reject) {
      let failed = false;
      function worker() {
        if (failed) return;
        if (next >= weeks.length) return;
        const idx = next++;
        getJson(_apiUrl("weekEvents", { inviteeId, date: weeks[idx] })).then(function(j) {
          results[idx] = mapAgendaWeekResponse(j);
          done++;
          if (onProgress) {
            try {
              onProgress(done, weeks.length);
            } catch (e) {
            }
          }
          if (done === weeks.length) resolve([].concat.apply([], results));
          else worker();
        }, function(e) {
          if (failed) return;
          failed = true;
          reject(new Error("week van " + weeks[idx] + " kon niet worden opgehaald (" + (e && e.message || "fout") + ")"));
        });
      }
      for (let i = 0; i < Math.min(3, weeks.length); i++) worker();
    });
  }

  // src/content/features/registration/context-menu.js
  var CTX_MAX_AGE_MS = 30 * 1e3;
  var _ctxOccurrence = null;
  var _ctxOccurrenceTs = 0;
  function installContextMenuTracking() {
    document.addEventListener("contextmenu", function(e) {
      let occ = null;
      try {
        occ = e.target && e.target.closest && e.target.closest(ONS.occurrenceBase);
      } catch (err) {
        occ = null;
      }
      _ctxOccurrence = occ || null;
      _ctxOccurrenceTs = occ ? Date.now() : 0;
    }, true);
  }
  function ctxOccurrence() {
    if (!_ctxOccurrence) return null;
    if (Date.now() - _ctxOccurrenceTs > CTX_MAX_AGE_MS) return null;
    if (!_ctxOccurrence.isConnected) return null;
    return _ctxOccurrence;
  }
  var _ctxForcedVorm = null;
  var _ctxForcedTs = 0;
  function ctxForcedVorm() {
    if (!_ctxForcedVorm) return null;
    if (Date.now() - _ctxForcedTs > CTX_MAX_AGE_MS) return null;
    return _ctxForcedVorm;
  }
  function wachtOpPopup(pogingen, done) {
    const pop = document.querySelector(ONS.popoverRoot);
    if (pop) {
      done(pop);
      return;
    }
    if (pogingen <= 0) {
      done(null);
      return;
    }
    setTimeout(function() {
      wachtOpPopup(pogingen - 1, done);
    }, 100);
  }
  function startRegistrationWithForm(vorm) {
    const gekozen = REGISTRATION_CHOICES.find((x) => clean(x.label) === clean(vorm));
    if (!gekozen) return;
    _ctxForcedVorm = gekozen.label;
    _ctxForcedTs = Date.now();
    const klikRegistreren = function(scope) {
      const root = scope || document;
      let knop = null;
      try {
        knop = root.querySelector('[data-qa="occurrence-popover-primary"], [data-qa="declare_button"], #declare-option-link');
      } catch (e) {
      }
      if (!knop) {
        setStatus("Geen Registreren-knop gevonden op deze afspraak", false);
        return;
      }
      knop.click();
    };
    const bestaandePopup = document.querySelector(ONS.popoverRoot);
    if (bestaandePopup) {
      klikRegistreren(bestaandePopup);
      return;
    }
    const occ = ctxOccurrence();
    if (!occ) {
      setStatus("Klik met rechts op een afspraak om die te registreren", false);
      return;
    }
    occ.click();
    wachtOpPopup(15, function(pop) {
      klikRegistreren(pop);
    });
  }
  function listenForContextMenuChoice() {
    try {
      chrome.runtime.onMessage.addListener(function(msg) {
        if (!msg || msg.type !== MSG.CTX_REGISTER) return;
        safe(function() {
          startRegistrationWithForm(msg.vorm);
        });
      });
    } catch (e) {
    }
  }
  function pushRegistrationForms() {
    try {
      const namen = (REGISTRATION_CHOICES || []).map((c) => c && c.label).filter(Boolean);
      if (namen.length) chrome.runtime.sendMessage({ type: MSG.FORMS, forms: namen });
    } catch (e) {
    }
  }

  // src/content/features/registration/pending.js
  var PENDING_REG_KEY = PAGE_SESSION.PENDING_REGISTRATION;
  var _regIdOverride = null;
  function setRegistrationIdOverride(v) {
    _regIdOverride = v == null ? null : String(v);
  }
  function currentRegistrationId() {
    if (_regIdOverride != null) return _regIdOverride;
    const m = (location.pathname || "").match(/\/registrations\/([^/?#]+)/);
    return m ? m[1] : null;
  }
  function clearPendingRegistration() {
    try {
      sessionStorage.removeItem(PENDING_REG_KEY);
    } catch (e) {
    }
  }
  function matchRegistrationChoiceByLabel(label) {
    const c = clean(label);
    if (!c) return null;
    for (const form of APP_CONFIG.registrationForms || []) {
      const labels = Array.isArray(form.labels) ? form.labels : [];
      const hit = labels.some((w) => {
        const cw = clean(w);
        return !!cw && c.indexOf(cw) !== -1;
      });
      if (hit) return REGISTRATION_CHOICES.find((x) => clean(x.label) === clean(form.vorm)) || null;
    }
    return null;
  }
  function popoverLabelFromDom(scope) {
    const root = scope || document;
    const trim = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    const withTitle = root.querySelector(ONS.labelWithTitle);
    if (withTitle) {
      const t = trim(withTitle.getAttribute("title"));
      if (t) return t;
    }
    for (const tag of root.querySelectorAll(ONS.popoverLabelTag)) {
      let txt = "";
      for (const node of tag.childNodes) {
        if (node.nodeType === 3) txt += node.textContent;
        else if (node.nodeType === 1 && !/^agenda-icon-/.test(node.className || "")) txt += node.textContent;
      }
      const c = trim(txt);
      if (c) return c;
    }
    const desc = root.querySelector(".description");
    if (desc) return trim((desc.textContent || "").split(" - ")[0]);
    return "";
  }
  function capturePendingRegistrationLabel(fromEl) {
    try {
      const scope = fromEl && fromEl.closest && fromEl.closest(ONS.popoverRoot) || document;
      const apiLabels = laatsteDetailsLabels();
      let label = apiLabels.find((l) => !!matchRegistrationChoiceByLabel(l)) || apiLabels[0] || "";
      const domLabel = popoverLabelFromDom(scope);
      if (!label) label = domLabel;
      else if (domLabel) {
        const a = matchRegistrationChoiceByLabel(label), b = matchRegistrationChoiceByLabel(domLabel);
        if (b && (!a || a.label !== b.label)) label = domLabel;
      }
      const forcedVooraf = ctxForcedVorm();
      if (!label && !forcedVooraf) return;
      let id = null;
      const declare = scope.querySelector('[data-qa="declare_button"][data-qa-url], [data-qa-url*="/registrations/"]');
      const urlAttr = declare && declare.getAttribute("data-qa-url");
      const mm = urlAttr && urlAttr.match(/\/registrations\/([^/]+)\/edit/);
      if (mm) id = mm[1];
      const bewaard = { id, label, ts: Date.now() };
      if (forcedVooraf) bewaard.forcedVorm = forcedVooraf;
      sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify(bewaard));
    } catch (e) {
    }
  }
  function loadPendingRegistrationLabel() {
    registrationFlow.registrationAutoChoice = null;
    registrationFlow.registrationFromAppointment = false;
    registrationFlow.registrationAutoApplied = false;
    registrationFlow.registrationRestoredToReport = false;
    registrationFlow.registrationExtrasRestored = false;
    let raw = null;
    try {
      raw = sessionStorage.getItem(PENDING_REG_KEY);
    } catch (e) {
      return;
    }
    if (!raw) return;
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      data = null;
    }
    if (!data || !data.label && !data.vorm && !data.forcedVorm) return;
    const curId = currentRegistrationId();
    if (data.id && curId) {
      if (data.id !== curId) {
        clearPendingRegistration();
        return;
      }
    } else if (!data.ts || Date.now() - data.ts > 10 * 60 * 1e3) {
      return;
    }
    if (data.forcedVorm) {
      const gekozen = REGISTRATION_CHOICES.find((x) => clean(x.label) === clean(data.forcedVorm));
      if (gekozen) {
        registrationFlow.registrationAutoChoice = gekozen;
        registrationFlow.registrationFromAppointment = true;
        return;
      }
    }
    if (data.vorm) {
      const restored = REGISTRATION_CHOICES.find((x) => clean(x.label) === clean(data.vorm));
      if (restored) {
        registrationFlow.activeRegistrationChoice = restored;
        registrationFlow.registrationFromAppointment = true;
        registrationFlow.registrationAutoApplied = true;
        registrationFlow.registrationRestoredToReport = true;
        registrationFlow.registrationRestoreHoldStart = Date.now();
        scheduleReapplyRegistrationSplit();
        [0, 200, 500, 1e3].forEach((d) => setTimeout(() => safe(() => ensureActiveRegistrationReportPrefix()), d));
      }
      return;
    }
    const choice = matchRegistrationChoiceByLabel(data.label);
    if (choice) {
      registrationFlow.registrationAutoChoice = choice;
      registrationFlow.registrationFromAppointment = true;
    }
  }
  function persistRegistrationForm(choice) {
    if (!choice) return;
    try {
      const rid = currentRegistrationId();
      sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify({ id: rid, vorm: choice.label, ts: Date.now() }));
    } catch (e) {
    }
  }
  function updatePendingReg(patch) {
    try {
      let cur = null;
      const raw = sessionStorage.getItem(PENDING_REG_KEY);
      if (raw) {
        try {
          cur = JSON.parse(raw);
        } catch (e) {
          cur = null;
        }
      }
      if (!cur || !cur.vorm && !cur.label) return;
      sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify(Object.assign(cur, patch, { ts: Date.now() })));
    } catch (e) {
    }
  }
  function persistRegistrationTimes() {
    try {
      const d = _regToMin(inputTextValue(registrationDirectTimeInput()));
      const i = _regToMin(inputTextValue(registrationIndirectTimeInput()));
      const th = _regToMin(inputTextValue(registrationTravelInput("heen")));
      const tt = _regToMin(inputTextValue(registrationTravelInput("terug")));
      updatePendingReg({ direct: d == null ? null : d, indirect: i == null ? null : i, travel: (th || 0) + (tt || 0) });
    } catch (e) {
    }
  }
  function restoreRegistrationExtras() {
    if (registrationFlow.registrationExtrasRestored) return;
    registrationFlow.registrationExtrasRestored = true;
    let data = null;
    try {
      data = JSON.parse(sessionStorage.getItem(PENDING_REG_KEY) || "null");
    } catch (e) {
      data = null;
    }
    if (!data) return;
    const dMin = typeof data.direct === "number" ? data.direct : null;
    const iMin = typeof data.indirect === "number" ? data.indirect : null;
    if (dMin != null || iMin != null) {
      [0, 250, 700].forEach((ms) => setTimeout(() => safe(() => setRegistrationTimeSplit({ directMinutes: dMin, indirectMinutes: iMin })), ms));
    }
    if (typeof data.travel === "number" && data.travel > 0) {
      const applyTravel = () => {
        if (!registrationTravelInput("heen") && !registrationTravelInput("terug")) clickRegistrationTravelTimeButton();
        setRegistrationTravelTotalMinutes(data.travel);
      };
      [0, 300, 800, 1400].forEach((ms) => setTimeout(() => safe(applyTravel), ms));
    }
  }
  function installDeclareClickCapture() {
    document.addEventListener("click", function(e) {
      const t = e.target;
      if (!t || !t.closest) return;
      const btn = t.closest(ONS.declareTrigger);
      if (btn) {
        capturePendingRegistrationLabel(btn);
        return;
      }
      if (t.closest(ONS.occurrenceBase)) {
        [120, 500].forEach((d) => setTimeout(() => safe(() => {
          const pop = document.querySelector(ONS.popoverRoot);
          if (pop) warmPopoverDetails(pop);
        }), d));
      }
    }, true);
  }

  // src/content/features/registration/report.js
  function registrationTextHasNoShowCue(text) {
    return /\b(afwezig|voicemail|geen gehoor|niet bereikbaar|onbereikbaar|neemt niet op|nam niet op|niet opgenomen|niet verschenen|niet gekomen|komt niet|kwam niet|no show|noshow|zonder bericht|geen reactie|reageert niet|niet thuis|deur niet open|op voicemail|ingesproken)\b/i.test(text || "");
  }
  function registrationReportTextFields() {
    return deepQueryAll('textarea,input,[contenteditable="true"],[role="textbox"]').filter((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      if (el.closest && el.closest('.select2-container,.select2-dropdown,.select2-results,[role="listbox"]')) return false;
      const tag = (el.tagName || "").toLowerCase();
      const meta = clean([el.id, el.name, el.className, el.type, el.getAttribute && el.getAttribute("placeholder"), el.getAttribute && el.getAttribute("aria-label")].filter(Boolean).join(" "));
      if (/select2|search__field|zoek naar uursoorten|zoek naar labels|zichtbaar voor|visible for|hour_type|uursoort|client_information_\d+__hour_type_id|absence|afwezigheid/.test(meta)) return false;
      if (tag === "input") {
        const type = clean(el.getAttribute("type") || "text");
        if (!/^(text|search|textarea)?$/.test(type)) return false;
        if ((el.className || "").includes("time") || /time|date|declaration_(start|end)_time/.test(el.id || el.name || "")) return false;
        if (!/rapport|report|verslag|notit|note|description|omschrijving|content|body|text/.test(meta)) return false;
      }
      return true;
    });
  }
  function registrationReportTextValue(el) {
    if (!el) return "";
    if ("value" in el && typeof el.value === "string") return el.value;
    return el.textContent || "";
  }
  function setRegistrationReportTextValue(el, text) {
    if (!el) return false;
    if ("value" in el && typeof el.value === "string") setInputTextComposed(el, text);
    else {
      el.textContent = text;
      el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }
    return true;
  }
  function focusRegistrationReportAtEnd(field2) {
    if (!field2) return false;
    try {
      field2.focus();
    } catch (e) {
    }
    if ("value" in field2 && typeof field2.value === "string") {
      const end = field2.value.length;
      try {
        field2.setSelectionRange(end, end);
      } catch (e) {
      }
      return true;
    }
    if (field2.getAttribute && field2.getAttribute("contenteditable") === "true") {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(field2);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      } catch (e) {
      }
    }
    return false;
  }
  function registrationPrimaryReportField() {
    const ov = overrideEl("regReport");
    if (ov) return ov;
    const fields = registrationReportTextFields();
    if (!fields.length) return null;
    const preferred = fields.find((el) => {
      const tag = (el.tagName || "").toLowerCase();
      const meta = clean([el.id, el.name, el.className, el.getAttribute && el.getAttribute("aria-label")].filter(Boolean).join(" "));
      return tag === "textarea" && /rapport|report|verslag|notit|note|description|omschrijving|content|body|text/.test(meta);
    });
    if (preferred) return preferred;
    return fields.filter((el) => (el.tagName || "").toLowerCase() === "textarea" || el.getAttribute("contenteditable") === "true").sort((a, b) => area(b) - area(a))[0] || fields.sort((a, b) => area(b) - area(a))[0] || null;
  }
  function choicePrefix(c) {
    return c && c.reportPrefix && String(c.reportPrefix).trim() ? String(c.reportPrefix).trim() : c ? c.label : "";
  }
  function _prefixIsSjabloon(p) {
    return /\n/.test(String(p || ""));
  }
  function _prefixScheiding(p) {
    return _prefixIsSjabloon(p) ? "\n" : " - ";
  }
  function _escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function _prefixStaartRe(p) {
    return _prefixIsSjabloon(p) ? "\\s*" : "\\s*-\\s*";
  }
  function registrationPrefixRegex() {
    const parts = REGISTRATION_CHOICES.map((c) => choicePrefix(c)).filter(Boolean).slice().sort((a, b) => b.length - a.length).map((p) => _escapeRe(p) + _prefixStaartRe(p));
    return new RegExp(`^\\s*(?:${parts.join("|")})`, "i");
  }
  function registrationChoicePrefixRegex(choice) {
    const p = choicePrefix(choice);
    if (!p) return null;
    return new RegExp(`^\\s*${_escapeRe(p)}${_prefixStaartRe(p)}`, "i");
  }
  function registrationReportNeedsContent() {
    const field2 = registrationPrimaryReportField();
    if (!field2) return false;
    const text = registrationReportTextValue(field2);
    if (registrationFlow.activeRegistrationChoice) {
      const expectedPrefixRe = registrationChoicePrefixRegex(registrationFlow.activeRegistrationChoice);
      if (!String(text || "").trim()) return true;
      if (expectedPrefixRe && !expectedPrefixRe.test(text)) return true;
      return !text.replace(expectedPrefixRe, "").trim();
    }
    const prefixRe = registrationPrefixRegex();
    if (!prefixRe.test(text)) return false;
    return !text.replace(prefixRe, "").trim();
  }
  function prefixRegistrationReport(label) {
    const field2 = registrationPrimaryReportField();
    if (!field2) return false;
    const prefixRe = registrationPrefixRegex();
    const current = registrationReportTextValue(field2);
    const rest = current.replace(prefixRe, "");
    const ok = setRegistrationReportTextValue(field2, `${label}${_prefixScheiding(label)}${rest}`);
    setTimeout(updateRegistrationSubmitGuard, 0);
    return ok;
  }
  function ensureActiveRegistrationReportPrefix(field2 = null) {
    if (!registrationFlow.activeRegistrationChoice || registrationFlow.activeRegistrationChoice.label === "No show") return false;
    const primary = registrationPrimaryReportField();
    const target = field2 || primary;
    if (!target) return false;
    if (target !== primary) return false;
    const expectedRe = registrationChoicePrefixRegex(registrationFlow.activeRegistrationChoice);
    const current = registrationReportTextValue(target);
    if (expectedRe && expectedRe.test(current)) return false;
    const trimmed = String(current || "").trim();
    const cleaned = clean(trimmed);
    const pfx = choicePrefix(registrationFlow.activeRegistrationChoice);
    const labelClean = clean(pfx);
    const otherPrefixRe = registrationPrefixRegex();
    const looksEmptyOrBrokenPrefix = !trimmed || cleaned.length >= 2 && labelClean.startsWith(cleaned) || cleaned === labelClean || otherPrefixRe.test(current);
    if (!looksEmptyOrBrokenPrefix) return false;
    const rest = otherPrefixRe.test(current) ? current.replace(otherPrefixRe, "") : "";
    const ok = setRegistrationReportTextValue(target, `${pfx}${_prefixScheiding(pfx)}${rest}`);
    setTimeout(updateRegistrationSubmitGuard, 0);
    return ok;
  }
  function registrationSubmitButton() {
    return document.getElementById("submitRegistrationBtn") || deepQueryAll('input[type="submit"],button[type="submit"]').find((el) => !isOwnPopup(el) && /indienen/i.test(el.value || el.textContent || "")) || null;
  }
  function setRegistrationSubmitBlocked(blocked) {
    const btn = registrationSubmitButton();
    if (!btn) return;
    if ("disabled" in btn) btn.disabled = blocked;
    try {
      btn.setAttribute("aria-disabled", blocked ? "true" : "false");
    } catch (e) {
    }
    const inner = btn.shadowRoot ? btn.shadowRoot.querySelector('button[type="submit"], button') || btn : btn;
    if (inner instanceof HTMLButtonElement) inner.disabled = blocked;
    for (const el of [inner, btn]) {
      if (el && el.style) {
        el.style.opacity = blocked ? "0.45" : "";
        el.style.cursor = blocked ? "not-allowed" : "";
        el.style.pointerEvents = blocked ? "auto" : "";
      }
    }
  }
  function updateRegistrationReportSubmitButton() {
    const btn = helperPanel.popupEl && helperPanel.popupEl.querySelector("[data-registration-helper-submit]");
    if (!btn) return;
    const blocked = registrationReportNeedsContent();
    btn.textContent = blocked ? "Rapportage" : "Indienen";
    btn.title = blocked ? "Schrijf de rapportage" : "Registratie indienen";
    btn.style.background = blocked ? "#a3241f" : "#1b7f3b";
    btn.style.boxShadow = blocked ? "0 6px 16px -7px rgba(163,36,31,.55)" : "0 6px 16px -7px rgba(27,127,59,.55)";
    btn.style.opacity = blocked ? "0.85" : "1";
    btn.style.cursor = blocked ? "not-allowed" : "pointer";
  }
  function submitRegistrationFromHelper() {
    ensureActiveRegistrationReportPrefix();
    updateRegistrationSubmitGuard();
    updateRegistrationReportSubmitButton();
    if (registrationReportNeedsContent()) {
      setStatus("Schrijf de rapportage", false);
      const field2 = registrationPrimaryReportField();
      focusRegistrationReportAtEnd(field2);
      setTimeout(() => focusRegistrationReportAtEnd(field2), 0);
      return;
    }
    const btn = registrationSubmitButton();
    if (!btn) {
      setStatus("Indienen-knop niet gevonden", false);
      return;
    }
    clearPendingRegistration();
    btn.click();
  }
  function updateRegistrationSubmitGuard() {
    setRegistrationSubmitBlocked(registrationReportNeedsContent());
    updateRegistrationReportSubmitButton();
  }
  function isRegistrationSubmitNode(el) {
    let n = el;
    for (let i = 0; n && i < 7; i++) {
      if (n.nodeType === 1 && n.matches && (n.matches("#submitRegistrationBtn") || n.matches('input[type="submit"],button[type="submit"]') && /indienen/i.test(n.value || n.textContent || ""))) return true;
      n = n.parentElement;
    }
    return false;
  }
  function blockRegistrationSubmitIfReportEmpty(e) {
    if (!helperPanel.helperEnabled) return;
    if (helperPanel.activeMode !== "registrations" || isOwnPopup(e.target)) return;
    if (e.type === "click" && !isRegistrationSubmitNode(e.target)) return;
    ensureActiveRegistrationReportPrefix();
    if (!registrationReportNeedsContent()) {
      clearPendingRegistration();
      updateRegistrationSubmitGuard();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    updateRegistrationSubmitGuard();
    setStatus("Schrijf de rapportage", false);
  }

  // src/content/features/registration/completeness.js
  function _regCareFlags() {
    let text = "";
    let scripts;
    try {
      scripts = document.querySelectorAll("script");
    } catch (e) {
      return {};
    }
    for (const s of scripts) {
      const t = s.textContent || "";
      if (t.indexOf("initialStoreState") !== -1 && t.indexOf("careProvider") !== -1) {
        text = t;
        break;
      }
    }
    const bool = (k) => {
      const m = text.match(new RegExp('"' + k + '"\\s*:\\s*(true|false)'));
      return m ? m[1] === "true" : false;
    };
    return { requireReport: bool("require_report_per_client"), timeDistribution: bool("time_distribution_enabled") };
  }
  function _regToMin(raw) {
    const s = (raw == null ? "" : String(raw)).trim();
    if (!s) return null;
    const hm2 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (hm2) return +hm2[1] * 60 + +hm2[2];
    if (/^\d{1,4}$/.test(s)) return +s;
    return null;
  }
  function _regFieldVal(sel) {
    const el = document.querySelector(sel);
    if (!el) return "";
    return (el.value != null && el.value !== "" ? el.value : el.getAttribute("value")) || "";
  }
  function registrationClientFormIsRemoved(row) {
    if (!row) return true;
    try {
      if (row.classList && row.classList.contains("removed")) return true;
      const st = (row.getAttribute("data-state") || "").toLowerCase();
      if (st === "removed" || st === "destroy") return true;
    } catch (e) {
    }
    return false;
  }
  function activeRegistrationClientForms() {
    return Array.prototype.slice.call(document.querySelectorAll("div.client_form[data-invitee-id]")).filter((r) => !registrationClientFormIsRemoved(r));
  }
  function registrationCompletenessIssues() {
    const issues = [];
    const rows = activeRegistrationClientForms();
    const flags = _regCareFlags();
    for (const row of rows) {
      const id = row.getAttribute("data-invitee-id") || "";
      const name = (row.getAttribute("data-invitee-name") || "").trim() || "cliënt";
      const cont = document.getElementById("select2-declaration_client_information_" + id + "__hour_type_id-container");
      let uSet = false;
      if (cont) {
        const ph = cont.querySelector(".select2-selection__placeholder");
        const title = cont.getAttribute("title") || "";
        const txt = (cont.textContent || "").trim();
        uSet = !ph && !!txt && !/zoek naar uursoorten|selecteer uursoort/i.test(title || txt);
      }
      if (!uSet) {
        const sel = document.getElementById("declaration_client_information_" + id + "__hour_type_id");
        if (sel && sel.value && sel.value.trim()) uSet = true;
      }
      if (!uSet) issues.push({ sev: "error", msg: "Uursoort ontbreekt voor " + name });
      const cb = document.getElementById("declaration_client_information_" + id + "__no_show");
      const noShow = !!(cb && cb.checked);
      const ta = document.getElementById("declaration_client_information_" + id + "__dossier_report_comment");
      const report = ta ? String(ta.value || ta.textContent || "").trim() : "";
      if (flags.requireReport && !noShow && !report) issues.push({ sev: "error", msg: "Rapportage ontbreekt voor " + name });
      if (noShow && report) issues.push({ sev: "warn", msg: "No-show maar wel rapportage voor " + name });
    }
    const startMin = _regToMin(_regFieldVal("#declaration_start_time") || _regFieldVal("#declaration_start_time_display"));
    const endMin = _regToMin(_regFieldVal("#declaration_end_time") || _regFieldVal("#declaration_end_time_display"));
    const dur = startMin != null && endMin != null ? endMin - startMin : null;
    if (dur != null && dur <= 0) issues.push({ sev: "error", msg: "Eindtijd ligt niet na begintijd" });
    if (flags.timeDistribution && dur != null && dur > 0) {
      const di = _regToMin(_regFieldVal("#declaration_direct_time")) || 0;
      const ind = _regToMin(_regFieldVal("#declaration_indirect_time")) || 0;
      if (di + ind > 0 && di + ind !== dur) issues.push({ sev: "warn", msg: "Direct + indirect (" + (di + ind) + " min) komt niet overeen met de duur (" + dur + " min)" });
    }
    try {
      const tv = huidigRegistratieTijdvak();
      if (tv.ymd && tv.startMin != null && tv.eindMin != null) {
        fetchWeekTijdvakken("registraties", tv.ymd);
        const regId = currentRegistrationId();
        const hit = overlappendTijdvak("registraties", tv.ymd, tv.startMin, tv.eindMin, regId);
        let ons;
        if (!regId) {
          fetchOnsOverlap(tv.ymd, tv.startMin, tv.eindMin, "");
          ons = knownOnsOverlap(tv.ymd, tv.startMin, tv.eindMin, "");
        }
        if (hit) issues.push({ sev: "warn", msg: overlapMelding(hit, "een registratie") });
        else if (ons === true) issues.push({ sev: "warn", msg: "Let op: ONS meldt dat dit tijdvak overlapt met een bestaande registratie." });
      }
    } catch (e) {
    }
    return issues;
  }
  function mkRegistrationSubmitNode() {
    const submit = mkPillButton("Indienen", () => safe(submitRegistrationFromHelper));
    submit.style.width = "100%";
    submit.setAttribute("data-registration-helper-submit", "");
    return submit;
  }
  function mkRegistrationCompletenessNode() {
    const holder = document.createElement("div");
    appendRegistrationCompleteness(holder);
    return holder.firstChild ? holder.firstChild : null;
  }
  function appendRegistrationCompleteness(body) {
    let issues = [];
    try {
      issues = registrationCompletenessIssues();
    } catch (e) {
      return;
    }
    if (!issues.length) return;
    const box = document.createElement("div");
    Object.assign(box.style, { margin: "0 0 8px", padding: "8px 10px", borderRadius: "8px", border: "1px solid #f0c0c0", background: "#fdecec" });
    const h = document.createElement("div");
    h.textContent = "Controleer voor indienen:";
    Object.assign(h.style, { fontSize: "12px", fontWeight: "700", color: "#9b1c1c", marginBottom: "4px" });
    box.appendChild(h);
    const ul = document.createElement("ul");
    Object.assign(ul.style, { margin: "0", padding: "0 0 0 16px" });
    for (const it of issues) {
      const li = document.createElement("li");
      li.textContent = it.msg;
      Object.assign(li.style, { fontSize: "12px", lineHeight: "1.35", color: it.sev === "error" ? "#9b1c1c" : "#7a5200" });
      ul.appendChild(li);
    }
    box.appendChild(ul);
    body.appendChild(box);
  }

  // src/content/features/registration/prereqs.js
  function hasRegistrationClient() {
    const valuedClientInput = deepQueryAll("input,select").some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const idName = `${el.id || ""} ${el.name || ""}`;
      if (/hour_type|time|date|direct|indirect|travel|declaration_client_information_\d+__(id|hour_type_id)/i.test(idName)) return false;
      return /(client|invitee|patient).*(^|_|-)id|(^|[_\[])(client|invitee|patient)(_id|id|\])/.test(idName) && !!String(el.value || "").trim();
    });
    if (valuedClientInput) return true;
    const select2Client = deepQueryAll('.select2-selection__rendered,[id^="select2-"][id$="-container"]').some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const id = el.id || "";
      if (!/(client|invitee|patient)/i.test(id) || /hour_type|time|date/i.test(id)) return false;
      const text = clean(el.textContent || "");
      return !!text && !/zoek|selecteer|client|cliënt|patient/.test(text);
    });
    if (select2Client) return true;
    if (!visibleSelect2HourTypeContainers().length) return false;
    return deepQueryAll("div,span,p,td,li,strong").some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const text = clean(el.textContent || "");
      if (!text || text.length > 240) return false;
      if (/rapportage|registratie maken|reistijd toevoegen|afwezigheid toevoegen/.test(text)) return false;
      return /geboren op\b|\(\d{3,}\)|\b\d{1,2}\s*jaar\b/.test(text);
    });
  }
  function hasRegistrationPrereqs() {
    return hasRegistrationClient() && hasRegistrationDate() && hasRegistrationStartTime();
  }
  function showRegistrationNeedsClient() {
    const body = $body();
    if (!body) return;
    markScreen("registrationNeedsClient");
    renderScreen(body, "needsClient", {
      nodes: [
        mkText("registratie_prereq_regel1", "Voor cliëntgebonden registraties: vul cliënt, datum en begintijd in.", { fontWeight: "700", fontSize: "13px", margin: "2px 0 4px", color: "#c0006a" }),
        mkText("registratie_prereq_regel2", "Voor niet cliëntgebonden registraties: vul datum, begintijd en eindtijd in.", { fontWeight: "700", fontSize: "13px", margin: "2px 0 4px", color: "#c0006a" })
      ]
    });
    setStatus("Wacht op cliënt, begintijd en datum");
  }
  function registrationPageSettled() {
    try {
      if (document.readyState !== "complete") return false;
      return Date.now() - helperPanel.lastDomMutationAt > 500;
    } catch (e) {
      return true;
    }
  }
  function registrationRestoreHolding() {
    if (!registrationFlow.registrationRestoredToReport) return false;
    if (registrationPageSettled()) return false;
    if (registrationFlow.registrationRestoreHoldStart && Date.now() - registrationFlow.registrationRestoreHoldStart > 4e3) return false;
    return true;
  }
  function armRegistrationSettleCheck() {
    if (registrationFlow.registrationSettleTimer) return;
    registrationFlow.registrationSettleTimer = setTimeout(() => {
      registrationFlow.registrationSettleTimer = null;
      safe(refreshRegistrationPrereqScreen);
    }, 300);
  }
  function refreshRegistrationPrereqScreen() {
    const body = $body();
    if (!body || registrationFlow.registrationNoShowPromptOpen || registrationFlow.registrationEpisodesPromptOpen) return;
    maybePrefetchUursoorten();
    if (registrationRestoreHolding()) {
      showLoadingState("Registratie laden...");
      armRegistrationSettleCheck();
      return;
    }
    if (helperPanel._infoPanelRestore) return;
    if (registrationFlow.registrationHourTypeBusy) return;
    if (registrationFlow.registrationFlowBusy) return;
    const text = body.textContent || "";
    if (registrationFlow.registrationRestoredToReport && registrationFlow.activeRegistrationChoice && !/richtlijn rapporteren|indienen/i.test(text)) {
      restoreRegistrationExtras();
      showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
      return;
    }
    if (registrationFlow.activeRegistrationChoice && registrationReadyToSubmitPage() && !/richtlijn rapporteren|indienen/i.test(text)) {
      showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
      return;
    }
    if (!registrationFlow.activeRegistrationChoice && registrationManualSubmitReady()) {
      if (!(helperPanel.popupEl && helperPanel.popupEl.querySelector("[data-registration-helper-submit]"))) showRegistrationSubmitOnly();
      return;
    }
    if (/vul client, begintijd en datum in|vul cliënt, begintijd en datum in|voor clientgebonden registraties|voor cliëntgebonden registraties/i.test(text) && hasRegistrationPrereqs()) showRegistrationChoices();
    else if (!hasRegistrationPrereqs() && !/vul client, begintijd en datum in|vul cliënt, begintijd en datum in|voor clientgebonden registraties|voor cliëntgebonden registraties/i.test(text)) showRegistrationNeedsClient();
  }

  // src/content/features/registration/prompts.js
  function showRegistrationNoShowPrompt() {
    const body = $body();
    if (!body || registrationFlow.registrationNoShowPromptOpen) return;
    registrationFlow.registrationNoShowPromptOpen = true;
    markScreen("registrationNoShowPrompt");
    renderScreen(body, "prompt", {
      question: "No show?",
      tokens: ONSAH_TOKENS,
      onYes: function() {
        safe(function() {
          registrationFlow.registrationNoShowPromptOpen = false;
          registrationFlow.registrationNoShowPromptSuppressed = true;
          applyRegistrationNoShow();
          setTimeout(showRegistrationChoices, 350);
        });
      },
      onNo: function() {
        safe(function() {
          registrationFlow.registrationNoShowPromptOpen = false;
          registrationFlow.registrationNoShowPromptSuppressed = true;
          const afterNo = registrationFlow.registrationNoShowPromptAfterNo;
          registrationFlow.registrationNoShowPromptAfterNo = null;
          if (afterNo) afterNo();
          else if (registrationFlow.activeRegistrationChoice && registrationReadyToSubmitPage()) showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
          else showRegistrationChoices();
          setStatus("No show overgeslagen | ga verder");
        });
      }
    });
    setStatus("Triggerwoord gevonden");
  }
  function checkRegistrationNoShowText(sourceEl) {
    if (!helperPanel.helperEnabled) return;
    if (helperPanel.activeMode !== "registrations") return;
    if (!hasRegistrationPrereqs()) return;
    const fields = sourceEl ? [sourceEl] : registrationReportTextFields();
    const hasCue = fields.some((el) => !isOwnPopup(el) && registrationTextHasNoShowCue(registrationReportTextValue(el)));
    if (!hasCue) {
      const wasOpen = registrationFlow.registrationNoShowPromptOpen;
      registrationFlow.registrationNoShowPromptSuppressed = false;
      registrationFlow.registrationNoShowPromptOpen = false;
      registrationFlow.registrationNoShowPromptAfterNo = null;
      if (wasOpen) showRegistrationChoices();
      return;
    }
    if (!registrationFlow.registrationNoShowPromptSuppressed) showRegistrationNoShowPrompt();
  }
  function registrationTextHasEpisodesTrigger(text) {
    return /\b(moeder|vader)\b/i.test(text || "");
  }
  function getRegistrationClientNumber() {
    const forms = activeRegistrationClientForms();
    const scopes = forms.length ? forms : [document];
    for (const scope of scopes) {
      let spans;
      try {
        spans = scope.querySelectorAll('.client_form_invitee_text span, [class*="invitee_text"] span, [class*="invitee-text"] span');
      } catch (e) {
        spans = [];
      }
      for (const el of spans) {
        if (isOwnPopup(el)) continue;
        const m = (el.textContent || "").match(/\((\d+)\)/);
        if (m) return m[1];
      }
    }
    return null;
  }
  function extractEpisodesUrlFromJumpHref(href) {
    if (!href) return null;
    try {
      const toParam = href.split("to=")[1];
      if (!toParam) return null;
      const decoded = decodeURIComponent(toParam);
      const m = decoded.match(/\/clients\/(\d+)\//);
      if (!m) return null;
      const objectId = m[1];
      const url = new URL(decoded);
      return url.origin + "/clients/" + objectId + "/episodes";
    } catch (e) {
      return null;
    }
  }
  function findEpisodesUrlInDom() {
    for (const el of deepQueryAll("uc-link, a")) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const href = el.getAttribute("href") || "";
      if (!href.includes("clients")) continue;
      const url = extractEpisodesUrlFromJumpHref(href);
      if (url) return url;
    }
    return null;
  }
  function findOmnisearchInput() {
    return deepQueryAll("input").find((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const ph = (el.getAttribute("placeholder") || "").toLowerCase();
      return ph.includes("liënt") || ph.includes("lient") || ph.includes("oeken");
    }) || null;
  }
  function doEpisodesSearch(clientNumber, onFound) {
    const btn = deepQueryAll(ONS.omnisearchTrigger).find((el) => visible(el) && !isOwnPopup(el));
    if (!btn) {
      onFound(null);
      return;
    }
    clickOption(btn);
    pollFor(findOmnisearchInput, (inp) => {
      if (!inp) {
        onFound(null);
        return;
      }
      setInputText(inp, clientNumber);
      pollFor(findEpisodesUrlInDom, (url) => {
        try {
          inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        } catch (e) {
        }
        onFound(url || null);
      }, { timeout: 7e3, interval: 150 });
    }, { timeout: 5e3, interval: 120 });
  }
  function showRegistrationEpisodesPrompt() {
    const body = $body();
    if (!body || registrationFlow.registrationEpisodesPromptOpen) return;
    registrationFlow.registrationEpisodesPromptOpen = true;
    clearScreenMark();
    renderScreen(body, "prompt", {
      question: "Afschermen via Episodes?",
      hint: "Kopieer en plak de af te schermen zin(nen) onder de juiste episode.",
      tokens: ONSAH_TOKENS,
      onYes: function() {
        safe(function() {
          registrationFlow.registrationEpisodesPromptOpen = false;
          registrationFlow.registrationEpisodesPromptSuppressed = true;
          const clientNumber = getRegistrationClientNumber();
          if (!clientNumber) {
            setStatus("Cliëntnummer niet gevonden", false);
            showRegistrationChoices();
            return;
          }
          setStatus("Dossier zoeken...");
          doEpisodesSearch(clientNumber, (url) => {
            if (url) {
              window.open(url, "_blank");
              setStatus("Episodes geopend");
            } else {
              setStatus("Dossierlink niet gevonden", false);
            }
            showRegistrationChoices();
          });
        });
      },
      onNo: function() {
        safe(function() {
          registrationFlow.registrationEpisodesPromptOpen = false;
          registrationFlow.registrationEpisodesPromptSuppressed = true;
          if (registrationFlow.activeRegistrationChoice && registrationReadyToSubmitPage()) showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
          else showRegistrationChoices();
          setStatus("Episodes overgeslagen");
        });
      }
    });
    setStatus("Triggerwoord gevonden: Moeder/Vader");
  }
  function checkRegistrationEpisodesText() {
    if (!helperPanel.helperEnabled || helperPanel.activeMode !== "registrations") return;
    if (!hasRegistrationPrereqs()) return;
    const fields = registrationReportTextFields();
    const hasCue = fields.some((el) => !isOwnPopup(el) && registrationTextHasEpisodesTrigger(registrationReportTextValue(el)));
    if (!hasCue) {
      if (registrationFlow.registrationEpisodesPromptOpen) {
        registrationFlow.registrationEpisodesPromptOpen = false;
        registrationFlow.registrationEpisodesPromptSuppressed = false;
        showRegistrationChoices();
      }
      return;
    }
    if (!registrationFlow.registrationEpisodesPromptSuppressed) showRegistrationEpisodesPrompt();
  }

  // src/content/features/registration/hour-type.js
  function selectHourTypeInNativeSelects(text) {
    const selects = deepQueryAll("select").filter((sel) => /hour_type_id/.test(sel.id || sel.name || "") && (sel.options || []).length);
    if (!selects.length) return false;
    let okCount = 0;
    const wanted = clean(text);
    for (const sel of selects) {
      const option = Array.from(sel.options || []).find((opt) => clean(opt.textContent || opt.label || "") === wanted) || Array.from(sel.options || []).find((opt) => clean(opt.textContent || opt.label || "").includes(wanted));
      if (!option) continue;
      sel.value = option.value;
      option.selected = true;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        if (window.jQuery) window.jQuery(sel).trigger("change");
      } catch (e) {
      }
      okCount++;
    }
    return okCount === selects.length;
  }
  function visibleSelect2HourTypeContainers() {
    return deepQueryAll('[id^="select2-"][id$="hour_type_id-container"], .select2-selection__rendered').filter((el) => visible(el) && !isOwnPopup(el) && /hour_type_id/.test(el.id || ""));
  }
  function registrationHourTypeSelectedInContainer(container) {
    if (!container) return false;
    const text = clean(container.textContent || container.getAttribute("title") || "");
    return !!text && !/zoek naar uursoorten|selecteer uursoort|uursoort/.test(text);
  }
  function registrationHourTypeTextInContainer(container) {
    if (!registrationHourTypeSelectedInContainer(container)) return "";
    return (container.textContent || container.getAttribute("title") || "").replace(/\s+/g, " ").trim();
  }
  function registrationHourTypeLooksNoShow(text) {
    return /\bno\s*show\b|\bnoshow\b/i.test(text || "");
  }
  function registrationHasNoShowHourTypeSelected() {
    if (visibleSelect2HourTypeContainers().some((container) => registrationHourTypeLooksNoShow(registrationHourTypeTextInContainer(container)))) return true;
    return deepQueryAll("select").filter((sel) => /hour_type_id/.test(sel.id || sel.name || "") && (sel.options || []).length).some((sel) => {
      const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      return registrationHourTypeLooksNoShow(opt && (opt.textContent || opt.label) || sel.value || "");
    });
  }
  function registrationHourTypeSelectForContainer(container) {
    const id = container && container.id && container.id.replace(/^select2-/, "").replace(/-container$/, "");
    return id ? document.getElementById(id) : null;
  }
  function registrationClientNameForHourType(container, index) {
    const select2 = registrationHourTypeSelectForContainer(container);
    const clientForm = select2 && select2.closest && select2.closest(".client_form[data-invitee-name]") || container && container.closest && container.closest(".client_form[data-invitee-name]");
    if (clientForm) {
      const nm = (clientForm.getAttribute("data-invitee-name") || "").replace(/\s+/g, " ").trim();
      if (nm) return { name: nm, firstName: firstNameFromName(nm) || `client ${index + 1}` };
    }
    const roots = [select2 && select2.closest('tr,.client_information,.nested-fields,[class*="client" i]')].filter(Boolean);
    const banned = /^(uursoort|rapportage|geboren op|zichtbaar voor|zoek naar uursoorten|selecteer uursoort|onlangs gebruikt|geadviseerd|toegestaan)$/;
    for (const root of roots) {
      const cr2 = rect(container);
      const names = deepQueryAll("strong,b,span,div,label", root).filter((el) => {
        if (!visible(el) || isOwnPopup(el)) return false;
        if (el.closest && el.closest(".select2-container,.select2-dropdown,.select2-results")) return false;
        const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
        const c = clean(txt);
        if (!txt || txt.length > 70 || banned.test(c)) return false;
        if (/uursoort|rapportage|geboren op|zoek naar|ggz|hbo|mbo|factuur|declarabel|speciaal|ambulant|behandeling|diagnostiek|no show|consult/.test(c)) return false;
        if (!/\s/.test(txt)) return false;
        const r = rect(el);
        return r.top <= cr2.top + 8 && r.bottom >= cr2.top - 220 && r.left <= cr2.left + 60;
      }).sort((a, b) => rect(b).bottom - rect(a).bottom);
      if (names.length) {
        const txt = names[0].textContent.replace(/\s+/g, " ").trim();
        return { name: txt, firstName: firstNameFromName(txt) || `client ${index + 1}` };
      }
    }
    const cr = rect(container);
    const fallback = deepQueryAll("strong,b,span,div,label").filter((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      if (el.closest && el.closest(".select2-container,.select2-dropdown,.select2-results")) return false;
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      const c = clean(txt);
      if (!txt || txt.length > 70 || banned.test(c) || !/\s/.test(txt)) return false;
      if (/uursoort|rapportage|geboren op|zoek naar|ggz|hbo|mbo|factuur|declarabel|speciaal|ambulant|behandeling|diagnostiek|no show|consult/.test(c)) return false;
      const r = rect(el);
      return r.top <= cr.top + 8 && r.bottom >= cr.top - 180 && r.left < cr.left - 10;
    }).sort((a, b) => rect(b).bottom - rect(a).bottom)[0];
    if (fallback) {
      const txt = fallback.textContent.replace(/\s+/g, " ").trim();
      return { name: txt, firstName: firstNameFromName(txt) || `client ${index + 1}` };
    }
    return { name: `Client ${index + 1}`, firstName: `client ${index + 1}` };
  }
  function registrationHourTypeContexts() {
    return visibleSelect2HourTypeContainers().sort((a, b) => rect(a).top - rect(b).top || rect(a).left - rect(b).left).map((container, index) => {
      const target = container.closest(".select2-selection") || container.parentElement || container;
      const person = registrationClientNameForHourType(container, index);
      return { container, target, index, name: person.name, firstName: person.firstName };
    });
  }
  function clickSelect2OptionTextInRoot(text, root) {
    const wanted = clean(text);
    const options = deepQueryAll('.select2-results__option,[role="option"],li', root || document).filter((el) => visible(el) && !isOwnPopup(el) && !/true/i.test(el.getAttribute("aria-disabled") || ""));
    const match = options.find((el) => clean(el.textContent || "") === wanted) || options.find((el) => clean(el.textContent || "").includes(wanted));
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
    const seen = /* @__PURE__ */ new Set();
    for (const sel of deepQueryAll("select").filter((s) => /hour_type_id/.test(s.id || s.name || ""))) {
      for (const opt of Array.from(sel.options || [])) {
        const text = (opt.textContent || opt.label || "").replace(/\s+/g, " ").trim();
        pushRegistrationHourTypeOption(out, seen, text);
      }
    }
    return out;
  }
  function select2ResultsElementForSelection(selection, rendered) {
    const owns = selection && selection.getAttribute && selection.getAttribute("aria-owns");
    if (owns) {
      const byOwns = document.getElementById(owns);
      if (byOwns) return byOwns;
    }
    const renderedId = rendered && rendered.id;
    if (renderedId && /-container$/.test(renderedId)) {
      const byRendered = document.getElementById(renderedId.replace(/-container$/, "-results"));
      if (byRendered) return byRendered;
    }
    return null;
  }
  function select2SearchInputForHourType(resultsRoot) {
    if (!resultsRoot || !/hour_type_id-results/.test(resultsRoot.id || "")) return null;
    const open = resultsRoot.closest(".select2-container--open") || document;
    return deepQueryAll("input.select2-search__field", open).find((inp) => visible(inp) && !isOwnPopup(inp)) || null;
  }
  function visibleSelect2Options(resultsRoot) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    if (!resultsRoot) return out;
    const selector = '.select2-results__option,[role="option"],li';
    for (const opt of deepQueryAll(selector, resultsRoot).filter((el) => visible(el) && !isOwnPopup(el))) {
      if (/true/i.test(opt.getAttribute("aria-disabled") || "")) continue;
      if (/group/i.test(opt.getAttribute("role") || "") || /select2-results__option--group/.test(opt.className || "")) continue;
      if (opt.id && !/hour_type_id-result/.test(opt.id)) continue;
      if (hasNestedOptionNode(opt, selector)) continue;
      const text = (opt.textContent || "").replace(/\s+/g, " ").trim();
      pushRegistrationHourTypeOption(out, seen, text);
    }
    return out;
  }
  function clearRegistrationPrefixFromHourTypeSearch(resultsRoot) {
    const search = select2SearchInputForHourType(resultsRoot);
    if (!search) return false;
    const value = String(search.value || "").trim();
    if (!value) return false;
    const c = clean(value);
    const prefixRe = registrationPrefixRegex();
    const looksLikeRegistrationPrefix = prefixRe.test(value) || REGISTRATION_CHOICES.some((choice) => {
      const label = clean(choice.label);
      return c === label || c.length >= 2 && label.startsWith(c.replace(/\s*-\s*$/, ""));
    });
    if (!looksLikeRegistrationPrefix) return false;
    setInputText(search, "");
    return true;
  }
  function listRegistrationHourTypeOptions(onDone, context2 = null) {
    const containers = context2 ? [context2.container] : visibleSelect2HourTypeContainers();
    const nativeOptions = nativeRegistrationHourTypeOptions();
    if (!containers.length) {
      onDone(nativeOptions);
      return;
    }
    const container = containers[0];
    const target = container.closest(".select2-selection") || container.parentElement || container;
    registrationFlow.registrationHourTypeBusy = true;
    clickElementCenter(target);
    pollFor(() => {
      const resultsRoot = select2ResultsElementForSelection(target, container);
      if (!resultsRoot) return null;
      const options = visibleSelect2Options(resultsRoot);
      return options.length ? { resultsRoot, options } : null;
    }, (found) => {
      const resultsRoot = found && found.resultsRoot || select2ResultsElementForSelection(target, container);
      const cleared = clearRegistrationPrefixFromHourTypeSearch(resultsRoot);
      setTimeout(() => {
        const options = visibleSelect2Options(resultsRoot);
        registrationFlow.registrationHourTypeBusy = false;
        onDone(context2 ? options : options.length ? options : nativeOptions);
      }, cleared ? 120 : 0);
    }, { timeout: 2500, interval: 90 });
  }
  function clearRegistrationHourTypeForContext(context2, onDone) {
    if (!context2 || !context2.container) {
      if (onDone) onDone(false);
      return;
    }
    let touched = false;
    const select2 = registrationHourTypeSelectForContainer(context2.container);
    if (select2) {
      const emptyOption = Array.from(select2.options || []).find((opt) => !opt.value);
      if (emptyOption) select2.value = emptyOption.value;
      else select2.selectedIndex = -1;
      select2.dispatchEvent(new Event("input", { bubbles: true }));
      select2.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        if (window.jQuery) window.jQuery(select2).trigger("change");
      } catch (e) {
      }
      touched = true;
    }
    const selection = context2.target || context2.container.closest(".select2-selection") || context2.container.parentElement || context2.container;
    const clear = context2.container.querySelector && context2.container.querySelector(".select2-selection__clear") || selection.querySelector && selection.querySelector(".select2-selection__clear");
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
    for (const sel of deepQueryAll("select").filter((s) => /hour_type_id/.test(s.id || s.name || "") && (s.options || []).length)) {
      const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      if (!registrationHourTypeLooksNoShow(opt && (opt.textContent || opt.label) || sel.value || "")) continue;
      const emptyOption = Array.from(sel.options || []).find((o) => !o.value);
      if (emptyOption) sel.value = emptyOption.value;
      else sel.selectedIndex = -1;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        if (window.jQuery) window.jQuery(sel).trigger("change");
      } catch (e) {
      }
      touched = true;
    }
    const contexts = registrationHourTypeContexts().filter((ctx) => registrationHourTypeLooksNoShow(registrationHourTypeTextInContainer(ctx.container)));
    let index = 0;
    const next = () => {
      const ctx = contexts[index++];
      if (!ctx) {
        if (onDone) onDone(touched);
        return;
      }
      clearRegistrationHourTypeForContext(ctx, (ok) => {
        touched = touched || ok;
        next();
      });
    };
    next();
  }
  function backFromRegistrationHourTypeSelection(index = 0) {
    const contexts = registrationHourTypeContexts();
    const context2 = contexts[index] || null;
    setStatus("Uursoort verwijderen...");
    const afterClear = () => {
      clickEmptyModalSpot();
      updateRegistrationSubmitGuard();
      if (index > 0) showRegistrationHourTypeSelection(index - 1);
      else showRegistrationChoices();
      setStatus("Uursoort verwijderd");
    };
    if (context2) clearRegistrationHourTypeForContext(context2, afterClear);
    else clearRegistrationHourTypes(afterClear);
  }
  function showRegistrationHourTypeSelection(index = null) {
    const body = $body();
    if (!body) return;
    const contexts = registrationHourTypeContexts();
    const selectedIndex = index === null ? Math.max(0, contexts.findIndex((ctx) => !registrationHourTypeSelectedInContainer(ctx.container))) : index;
    const context2 = contexts[selectedIndex] || null;
    if (contexts.length && !context2) {
      showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
      return;
    }
    if (contexts.length && contexts.every((ctx) => registrationHourTypeSelectedInContainer(ctx.container)) && index === null) {
      showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
      return;
    }
    registrationFlow.activeRegistrationHourTypeIndex = selectedIndex;
    markScreen("registrationHourTypeSelection", { index: selectedIndex });
    const title = context2 ? `Uursoort ${context2.firstName}` : "Uursoortselectie";
    const onBack = () => {
      helperPanel.suppressAutoUntil = Date.now() + 1200;
      safe(() => backFromRegistrationHourTypeSelection(selectedIndex));
    };
    renderScreen(body, "pickList", {
      title,
      loading: true,
      options: null,
      tokens: ONSAH_TOKENS,
      onBack,
      emptyMessage: "Geen uursoorten gevonden"
    });
    setStatus("Uursoorten laden...");
    listRegistrationHourTypeOptions((options) => {
      const onPickOption = (opt) => safe(() => {
        setRegistrationHourTypeForContext(opt, context2, (ok) => {
          if (ok && registrationTextHasNoShowCue(opt)) {
            registrationFlow.registrationNoShowPromptSuppressed = false;
            registrationFlow.registrationNoShowPromptAfterNo = () => {
              if (context2 && selectedIndex + 1 < contexts.length) showRegistrationHourTypeSelection(selectedIndex + 1);
              else if (hasRegistrationHourTypeSelected()) showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
              else showRegistrationHourTypeSelection();
            };
            showRegistrationNoShowPrompt();
            setStatus(`No show-uursoort gekozen voor ${context2 ? context2.firstName : "client"}`, false);
            return;
          }
          if (ok && context2 && selectedIndex + 1 < contexts.length) {
            showRegistrationHourTypeSelection(selectedIndex + 1);
          } else if (ok && hasRegistrationHourTypeSelected()) {
            showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
          }
          setStatus(ok ? `Uursoort gezet voor ${context2 ? context2.firstName : "client"}: ${opt}` : `Uursoort niet gevonden voor ${context2 ? context2.firstName : "client"}: ${opt}`, ok);
        });
      });
      renderScreen(body, "pickList", {
        title,
        loading: false,
        options,
        tokens: ONSAH_TOKENS,
        onBack,
        onPick: onPickOption,
        emptyMessage: "Geen uursoorten gevonden"
      });
      setStatus(options.length ? "Kies uursoort" : "Uursoorten niet gevonden", !!options.length);
    }, context2);
  }
  function setHourTypeViaSelect2(text, onDone) {
    const containers = visibleSelect2HourTypeContainers();
    if (!containers.length) {
      onDone(false);
      return;
    }
    let index = 0, okCount = 0;
    const next = () => {
      const container = containers[index++];
      if (!container) {
        onDone(okCount === containers.length);
        return;
      }
      const target = container.closest(".select2-selection") || container.parentElement || container;
      clickElementCenter(target);
      setTimeout(() => {
        const resultsRoot = select2ResultsElementForSelection(target, container);
        const search = select2SearchInputForHourType(resultsRoot);
        if (search) setInputText(search, text);
        setTimeout(() => {
          const ok = clickSelect2OptionTextInRoot(text, resultsRoot);
          setTimeout(() => {
            const selected = clean(container.textContent || container.getAttribute("title") || "");
            if (ok && selected && !/zoek naar uursoorten|selecteer uursoort|uursoort/.test(selected)) okCount++;
            else if (ok) okCount++;
            setTimeout(next, 80);
          }, 90);
        }, 180);
      }, 120);
    };
    next();
  }
  function setRegistrationHourTypeForContext(text, context2, onDone) {
    if (!context2) {
      setRegistrationHourType(text, onDone);
      return;
    }
    const target = context2.target || context2.container.closest(".select2-selection") || context2.container.parentElement || context2.container;
    clickElementCenter(target);
    setTimeout(() => {
      const resultsRoot = select2ResultsElementForSelection(target, context2.container);
      setTimeout(() => {
        const ok = clickSelect2OptionTextInRoot(text, resultsRoot);
        setTimeout(() => onDone(!!ok && registrationHourTypeSelectedInContainer(context2.container)), 120);
      }, 80);
    }, 120);
  }
  function setRegistrationHourType(text, onDone) {
    const nativeOk = selectHourTypeInNativeSelects(text);
    if (nativeOk) {
      onDone(true);
      return;
    }
    setHourTypeViaSelect2(text, onDone);
  }
  function clearRegistrationHourTypes(onDone) {
    let touched = false;
    const selects = deepQueryAll("select").filter((sel) => /hour_type_id/.test(sel.id || sel.name || ""));
    for (const sel of selects) {
      if (!sel.value && sel.selectedIndex <= 0) continue;
      const emptyOption = Array.from(sel.options || []).find((opt) => !opt.value);
      if (emptyOption) sel.value = emptyOption.value;
      else sel.selectedIndex = -1;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        if (window.jQuery) window.jQuery(sel).trigger("change");
      } catch (e) {
      }
      touched = true;
    }
    const containers = visibleSelect2HourTypeContainers();
    let index = 0;
    const next = () => {
      const container = containers[index++];
      if (!container) {
        onDone(touched);
        return;
      }
      const selection = container.closest(".select2-selection") || container.parentElement || container;
      const clear = container.querySelector && container.querySelector(".select2-selection__clear") || selection.querySelector && selection.querySelector(".select2-selection__clear");
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
  function applyRegistrationNoShow() {
    applyRegistrationChoice(REGISTRATION_CHOICES[0]);
  }
  function hasRegistrationEndTime() {
    const end = registrationTimeInput("declaration_end_time_display");
    return !!(end && timeTextToMinutes(registrationLiveTimeValue(end)) !== null);
  }
  function hasRegistrationHourTypeSelected() {
    const containers = visibleSelect2HourTypeContainers();
    if (containers.length) {
      return containers.every((el) => {
        const text = clean(el.textContent || el.getAttribute("title") || "");
        return !!text && !/zoek naar uursoorten|selecteer uursoort|uursoort/.test(text);
      });
    }
    const selects = deepQueryAll("select").filter((sel) => /hour_type_id/.test(sel.id || sel.name || "") && (sel.options || []).length);
    if (selects.length) return selects.every((sel) => {
      const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      const text = clean(opt && (opt.textContent || opt.label) || "");
      return !!String(sel.value || "").trim() && validRegistrationHourTypeOptionText(text || sel.value);
    });
    return false;
  }
  function registrationReadyToSubmitPage() {
    return hasRegistrationPrereqs() && hasRegistrationEndTime() && hasRegistrationHourTypeSelected() && !registrationReportNeedsContent();
  }

  // src/content/features/registration/reset.js
  function clearRegistrationSettings() {
    registrationFlow.activeRegistrationChoice = null;
    registrationFlow.activeRegistrationPortionMinutes = null;
    registrationFlow.activeRegistrationHourTypeIndex = null;
    registrationFlow.registrationAutoChoice = null;
    registrationFlow.registrationAutoApplied = true;
    registrationFlow.registrationFromAppointment = false;
    registrationFlow.registrationRestoredToReport = false;
    try {
      sessionStorage.removeItem(PENDING_REG_KEY);
    } catch (e) {
    }
    clearTimeout(registrationFlow.reapplyRegistrationSplitTimer);
    setStatus("Instellingen verwijderen...");
    const end = registrationTimeInput("declaration_end_time_display");
    if (end) setInputTextComposed(end, "");
    const direct = registrationDirectTimeInput();
    const indirect = registrationIndirectTimeInput();
    if (direct) setInputTextComposed(direct, "");
    if (indirect) setInputTextComposed(indirect, "");
    clearRegistrationTravelTimes();
    const field2 = registrationPrimaryReportField();
    if (field2) setRegistrationReportTextValue(field2, "");
    clearRegistrationHourTypes(() => {
      updateRegistrationSubmitGuard();
      showRegistrationChoices();
      setStatus("Instellingen verwijderd");
    });
  }

  // src/content/features/registration/screens.js
  function showRegistrationReportPrompt(choice) {
    const body = $body();
    if (!body) return;
    markScreen("registrationReportPrompt", { choice });
    const backTo = () => {
      registrationFlow.registrationRestoredToReport = false;
      if (choice && choice.label !== "No show") {
        const contexts = registrationHourTypeContexts();
        showRegistrationHourTypeSelection(Math.max(0, contexts.length - 1));
      } else {
        registrationFlow.activeRegistrationChoice = null;
        showRegistrationChoices();
      }
    };
    const msg = mkText("registratie_rapportage_titel", "Schrijf nu je rapportage, volgens ", { fontWeight: "700", fontSize: "14px", margin: "8px 0 6px" });
    const guidelineEnabled = !APP_CONFIG.features || APP_CONFIG.features.reportGuidelineLink !== false;
    if (!guidelineEnabled) msg.querySelectorAll("a").forEach((anchor) => anchor.replaceWith(document.createTextNode(anchor.textContent || "")));
    if (guidelineEnabled && !msg.querySelector("a[href]")) {
      const link = document.createElement("a");
      link.textContent = "Richtlijn rapporteren";
      link.href = "https://impegno.sharepoint.com/sites/kennisbank/Documents_Public/Forms/AllItems.aspx?id=%2Fsites%2Fkennisbank%2FDocuments%5FPublic%2FRichtlijn%20rapporteren%2Epdf&parent=%2Fsites%2Fkennisbank%2FDocuments%5FPublic";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      Object.assign(link.style, { color: "#cc087d", textDecoration: "underline" });
      msg.appendChild(link);
    }
    renderScreen(body, "reportPrompt", {
      msgNode: msg,
      completenessNode: mkRegistrationCompletenessNode(),
      submitNode: mkRegistrationSubmitNode(),
      tokens: ONSAH_TOKENS,
      onBack: function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(backTo);
      }
    });
    updateRegistrationReportSubmitButton();
    const usMissing = !hasRegistrationHourTypeSelected();
    setStatus(usMissing ? "Voeg nog een uursoort toe" : choice ? `${choice.label} duur afgerond` : "", !usMissing);
  }
  function registrationManualSubmitReady() {
    return !hasRegistrationClient() && hasRegistrationDate() && hasRegistrationStartTime() && hasRegistrationEndTime() && hasRegistrationHourTypeSelected();
  }
  function showRegistrationSubmitOnly() {
    const body = $body();
    if (!body) return;
    clearScreenMark();
    renderScreen(body, "submitOnly", {
      completenessNode: mkRegistrationCompletenessNode(),
      submitNode: mkRegistrationSubmitNode()
    });
    updateRegistrationReportSubmitButton();
    setStatus("Klaar om in te dienen", true);
  }
  function showRegistrationDurationAsk(choice) {
    const body = $body();
    if (!body) return;
    if (!hasRegistrationStartTime()) {
      setStatus("Vul eerst de begintijd in.", false);
      setTimeout(() => safe(() => {
        if (registrationFlow.activeRegistrationChoice === choice) showRegistrationDurationAsk(choice);
      }), 500);
      return;
    }
    markScreen("registrationDurationAsk", { choice });
    const _st = choice.durationStep > 0 ? choice.durationStep : gsNum("durationStepMin", 15);
    const _mx = choice.maxDuration > 0 ? choice.maxDuration : gsNum("registrationMaxMin", 180);
    const _durValues = [];
    for (let m = _st; m <= _mx; m += _st) _durValues.push(m);
    renderScreen(body, "duration", {
      title: `${choice.label} duur:`,
      tokens: ONSAH_TOKENS,
      onBack: function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(showRegistrationChoices);
      },
      pickerNode: mkDurationPicker(_durValues, (minutes) => safe(() => {
        const endOk = setRegistrationEndTimePlusMinutes(minutes);
        applyRegistrationSplitForChoice(choice);
        scheduleReapplyRegistrationSplit();
        setStatus(endOk ? `${choice.label} ${registrationDurationLabel(minutes)}` : "Eindtijd niet gezet", endOk);
        setTimeout(() => routeAfterRegistrationDuration(choice), 200);
      }), choice.pickerStyle, void 0, durationLabelStyle("duur"))
    });
    setStatus("Kies de duur");
  }
  function routeAfterRegistrationDuration(choice) {
    if (registrationPortionApplies(choice)) showRegistrationPortionQuestion(choice);
    else if (choice.addTravelTime) showRegistrationTravelSelection(choice);
    else proceedToReportOrHourType(choice);
  }
  function registrationNeedsDurationAsk() {
    if (!hasRegistrationEndTime()) return true;
    const dur = registrationDurationMinutes();
    return dur !== null && dur <= 1;
  }
  function registrationPortionApplies(choice) {
    return !!(choice && (choice.askIndirectPortion || choice.askDirectPortion));
  }
  function applyRegistrationPortion(choice, portionMinutes) {
    const total = registrationDurationMinutes();
    if (total === null) return false;
    const p = Math.max(0, Math.min(portionMinutes, total));
    if (choice.askIndirectPortion) {
      return setRegistrationTimeSplit({ directMinutes: total - p, indirectMinutes: p });
    }
    if (choice.askDirectPortion) {
      return setRegistrationTimeSplit({ directMinutes: p, indirectMinutes: total - p });
    }
    return true;
  }
  function registrationPortionWord(choice) {
    return choice.askIndirectPortion ? "indirecte" : "directe";
  }
  function proceedToReportOrHourType(choice) {
    if (choice && !choice.hourType && registrationHasNoShowHourTypeSelected()) {
      clearRegistrationNoShowHourTypes(() => {
        clickEmptyModalSpot();
        updateRegistrationSubmitGuard();
        showRegistrationHourTypeSelection();
        setStatus("No show-uursoort verwijderd | kies uursoort", false);
      });
      return;
    }
    if (!hasRegistrationHourTypeSelected()) {
      showRegistrationHourTypeSelection();
      return;
    }
    showRegistrationReportPrompt(choice);
  }
  function continueAfterRegistrationChoice(choice) {
    registrationFlow.registrationFlowBusy = true;
    if (choice.addTravelTime) setTimeout(() => {
      registrationFlow.registrationFlowBusy = false;
      safe(() => showRegistrationTravelSelection(choice));
    }, 200);
    else setTimeout(() => {
      registrationFlow.registrationFlowBusy = false;
      safe(() => proceedToReportOrHourType(choice));
    }, 200);
  }
  function showRegistrationPortionQuestion(choice) {
    const body = $body();
    if (!body) return;
    markScreen("registrationPortionQuestion", { choice });
    const woord = registrationPortionWord(choice);
    const _ns = registrationFlow.registrationFromAppointment ? REGISTRATION_CHOICES.find((x) => x.label === "No show") : null;
    renderScreen(body, "portionQuestion", {
      question: `${woord.charAt(0).toUpperCase() + woord.slice(1)} tijd aanwezig in deze registratie?`,
      woordBijw: choice.askIndirectPortion ? "indirect" : "direct",
      startText: registrationLiveTimeValue(registrationTimeInput("declaration_start_time_display")) || "begintijd",
      endText: registrationLiveTimeValue(registrationTimeInput("declaration_end_time_display")) || "eindtijd",
      tokens: ONSAH_TOKENS,
      onBack: function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(() => showRegistrationDurationAsk(choice));
      },
      onYes: function() {
        safe(() => showRegistrationPortionDuration(choice));
      },
      onNo: function() {
        safe(function() {
          registrationFlow.activeRegistrationPortionMinutes = null;
          applyRegistrationSplitForChoice(choice);
          scheduleReapplyRegistrationSplit();
          setStatus(`${choice.label} gezet`);
          continueAfterRegistrationChoice(choice);
        });
      },
      onNoShow: _ns ? function() {
        safe(() => applyRegistrationChoice(_ns));
      } : null
    });
    setStatus(`${woord} tijd?`);
  }
  function showRegistrationPortionDuration(choice) {
    const body = $body();
    if (!body) return;
    markScreen("registrationPortionDuration", { choice });
    const woord = registrationPortionWord(choice);
    const total = registrationDurationMinutes();
    const onBack = function() {
      helperPanel.suppressAutoUntil = Date.now() + 1200;
      safe(() => showRegistrationPortionQuestion(choice));
    };
    if (total === null || total < 5) {
      renderScreen(body, "duration", {
        title: `Duur ${woord} tijd:`,
        tokens: ONSAH_TOKENS,
        onBack,
        errorMessage: "Registratieduur onbekend of te kort."
      });
      return;
    }
    const _ps = APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.portionStepMin > 0 ? APP_CONFIG.generalSettings.portionStepMin : 5;
    const max = Math.floor(total / _ps) * _ps;
    const _vals = [];
    for (let minutes = _ps; minutes <= max; minutes += _ps) _vals.push(minutes);
    renderScreen(body, "duration", {
      title: `Duur ${woord} tijd:`,
      tokens: ONSAH_TOKENS,
      onBack,
      pickerNode: mkDurationPicker(_vals, function(minutes) {
        safe(function() {
          registrationFlow.activeRegistrationPortionMinutes = minutes;
          const ok = applyRegistrationPortion(choice, minutes);
          scheduleReapplyRegistrationSplit();
          setStatus(ok ? `${choice.label} | ${woord} tijd ${registrationDurationLabel(minutes)}` : "Verdeling niet gezet", ok);
          continueAfterRegistrationChoice(choice);
        });
      }, "minutenRooster", void 0, durationLabelStyle("duur"))
    });
  }
  function showRegistrationTravelSelection(choice) {
    const body = $body();
    if (!body) return;
    markScreen("registrationTravelSelection", { choice });
    const _ts = APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.travelStepMin > 0 ? APP_CONFIG.generalSettings.travelStepMin : 5;
    const _tm = APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.travelMaxMin > 0 ? APP_CONFIG.generalSettings.travelMaxMin : 60;
    const _travelValues = [];
    for (let m = 0; m <= _tm; m += _ts) _travelValues.push(m);
    renderScreen(body, "duration", {
      title: "Totale reistijd (heen en terug):",
      backFirst: false,
      // dit scherm zette de titel altijd al bóven de terugknop
      tokens: ONSAH_TOKENS,
      onBack: function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(showRegistrationChoices);
      },
      pickerNode: mkValuePicker(_travelValues, 0, (minutes) => safe(() => {
        registrationFlow.registrationFlowBusy = true;
        const ok = setRegistrationTravelTotalMinutes(minutes);
        setStatus(ok ? `Reistijd gezet: ${registrationDurationLabel(minutes)} totaal` : "Reistijdvelden niet gevonden", ok);
        setTimeout(() => {
          registrationFlow.registrationFlowBusy = false;
          safe(() => proceedToReportOrHourType(registrationFlow.activeRegistrationChoice));
        }, 250);
      }), choice.pickerStyle, void 0, durationLabelStyle("duur"))
    });
  }
  function applyRegistrationChoice(choice) {
    if (!hasRegistrationPrereqs()) {
      showRegistrationNeedsClient();
      return;
    }
    persistRegistrationForm(choice);
    registrationFlow.registrationRestoredToReport = false;
    registrationFlow.activeRegistrationChoice = null;
    registrationFlow.activeRegistrationPortionMinutes = null;
    registrationFlow.activeRegistrationHourTypeIndex = null;
    registrationFlow.registrationNoShowPromptOpen = false;
    registrationFlow.registrationNoShowPromptSuppressed = true;
    registrationFlow.registrationEpisodesPromptOpen = false;
    registrationFlow.registrationEpisodesPromptSuppressed = false;
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
      if (choice.hourType && !hourOk) problems.push("uursoort niet gevonden");
      if (choice.addTravelTime && !travelOk) notes.push("Reistijdknop al aanwezig");
      if (choice.endPlusOneMinute && !endOk) problems.push("eindtijd niet gezet");
      if (choice.endPlusOneHour && !endOk) problems.push("eindtijd niet gezet");
      if ((choice.indirectFullDuration || choice.directFullDuration || choice.startSplit) && !splitOk) problems.push("directe/indirecte tijd niet gezet");
      if (!reportOk) notes.push("rapportage niet gevonden");
      const suffix = [...problems, ...notes].join(" | ");
      setStatus(problems.length ? `${choice.label} deels gezet | ${suffix}` : `${choice.label} gezet${suffix ? ` | ${suffix}` : ""}`, problems.length === 0);
      registrationFlow.activeRegistrationChoice = choice;
      scheduleReapplyRegistrationSplit();
      if (choice.hourType) {
        if (choice.endPlusOneMinute) {
          [120, 350, 700, 1200].forEach((d) => setTimeout(() => safe(() => {
            if (!hasRegistrationEndTime()) setRegistrationEndTimePlusOneMinute();
          }), d));
        }
        setTimeout(() => showRegistrationReportPrompt(choice), 400);
        return;
      }
      if (registrationNeedsDurationAsk()) {
        setTimeout(() => showRegistrationDurationAsk(choice), 250);
        return;
      }
      if (registrationPortionApplies(choice)) {
        setTimeout(() => showRegistrationPortionQuestion(choice), 300);
      } else if (choice.addTravelTime) {
        setTimeout(() => showRegistrationTravelSelection(choice), 300);
      } else {
        setTimeout(() => proceedToReportOrHourType(choice), 300);
      }
    };
    if (choice.hourType) setRegistrationHourType(choice.hourType, finish);
    else finish(true);
  }
  function showRegistrationChoices() {
    const body = $body();
    if (!body) return;
    if (helperNeedsTeamChoice()) {
      showNeedsTeamChoice();
      return;
    }
    markScreen("registrationChoices");
    if (!hasRegistrationPrereqs()) {
      showRegistrationNeedsClient();
      return;
    }
    if (registrationFlow.registrationRestoredToReport && registrationFlow.activeRegistrationChoice) {
      if (registrationRestoreHolding()) {
        showLoadingState("Registratie laden...");
        armRegistrationSettleCheck();
        return;
      }
      restoreRegistrationExtras();
      showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
      return;
    }
    if (registrationFlow.registrationAutoChoice && !registrationFlow.registrationAutoApplied && !(registrationFlow.activeRegistrationChoice && registrationReadyToSubmitPage())) {
      registrationFlow.registrationAutoApplied = true;
      const auto = registrationFlow.registrationAutoChoice;
      setStatus("Uit afspraak: " + auto.label);
      applyRegistrationChoice(auto);
      return;
    }
    if (registrationFlow.activeRegistrationChoice && registrationReadyToSubmitPage()) {
      showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
      return;
    }
    renderScreen(body, "choices", {
      choices: REGISTRATION_CHOICES.map((choice, i) => ({
        label: choice.label,
        tick: onsahCategoryColor(onsahRegistrationIsDirect(choice), i),
        meta: choice.directIndirectLabel
      })),
      blocked: false,
      tokens: ONSAH_TOKENS,
      resetLabel: "Instellingen verwijderen",
      onPick: function(i) {
        safe(function() {
          applyRegistrationChoice(REGISTRATION_CHOICES[i]);
        });
      },
      onReset: function() {
        safe(clearRegistrationSettings);
      }
    });
    setStatus("");
  }

  // src/content/features/registration/fields.js
  function clickRegistrationTravelTimeButton() {
    const btn = overrideEl("regTravelAdd") || document.querySelector("#js_add_travel_time") || deepQueryAll("button").find((el) => visible(el) && /reistijd toevoegen/i.test(el.textContent || ""));
    if (!btn || registrationFlow.registrationTravelClicked) return false;
    clickOption(btn);
    registrationFlow.registrationTravelClicked = true;
    return true;
  }
  function registrationInputValue(inp) {
    return String(inp && ("value" in inp ? inp.value : "") || inp && inp.getAttribute && inp.getAttribute("value") || inp && inp.textContent || "").trim();
  }
  function registrationInputMeta(inp) {
    return clean(`${inp.id || ""} ${inp.name || ""} ${inp.className || ""} ${inp.type || ""} ${inp.getAttribute("placeholder") || ""} ${inp.getAttribute("aria-label") || ""}`);
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
    const inputs = deepQueryAll("input").filter(predicate);
    const labels = deepQueryAll("label,span,div,p,td,th").filter((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const text = clean(el.textContent || "");
      return text && text.length <= 60 && labelRe.test(text);
    });
    let best = null, bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of inputs) {
        const ir = rect(inp);
        const sameRow = Math.abs(ir.top + ir.height / 2 - (lr.top + lr.height / 2)) <= 28 && ir.left >= lr.left - 10;
        const below = ir.top >= lr.top - 8 && ir.top <= lr.bottom + 70 && Math.abs(ir.left - lr.left) <= 240;
        if (!sameRow && !below) continue;
        const score = Math.abs(ir.top - lr.top) * 3 + Math.max(0, ir.left - lr.right) + (below ? 80 : 0);
        if (score < bestScore) {
          best = inp;
          bestScore = score;
        }
      }
    }
    return best;
  }
  function registrationInputsInVisualOrder(predicate) {
    return deepQueryAll("input").filter(predicate).sort((a, b) => {
      const ar = rect(a), br = rect(b);
      return Math.abs(ar.top - br.top) > 8 ? ar.top - br.top : ar.left - br.left;
    });
  }
  function registrationTimeInput(id) {
    if (/start/i.test(id)) {
      const ov = overrideEl("regStart");
      if (ov) return ov;
    } else if (/end/i.test(id)) {
      const ov = overrideEl("regEnd");
      if (ov) return ov;
    }
    const exact = document.getElementById(id) || deepQueryAll("input.time.js-time").find((inp) => inp.id === id);
    if (exact && (visible(exact) || registrationInputValue(exact))) return exact;
    if (/start/i.test(id)) return registrationInputsNearLabel(/^begintijd\b/, registrationTimeLikeInput) || registrationInputsInVisualOrder(registrationTimeLikeInput)[0] || null;
    if (/end/i.test(id)) return registrationInputsNearLabel(/^eindtijd\b/, registrationTimeLikeInput) || registrationInputsInVisualOrder(registrationTimeLikeInput)[1] || null;
    return null;
  }
  function registrationDateInput() {
    const ov = overrideEl("regDate");
    if (ov) return ov;
    const exact = document.getElementById("declaration_date");
    if (exact && (visible(exact) || registrationInputValue(exact))) return exact;
    return deepQueryAll("input").find((inp) => registrationDateLikeInput(inp) && /date|datum|dd-mm-jjjj/.test(registrationInputMeta(inp))) || registrationInputsNearLabel(/^datum\b/, registrationDateLikeInput) || registrationInputsInVisualOrder(registrationDateLikeInput)[0] || null;
  }
  function hasRegistrationStartTime() {
    const start = registrationTimeInput("declaration_start_time_display");
    return !!(start && timeTextToMinutes(registrationLiveTimeValue(start)) !== null);
  }
  function hasRegistrationDate() {
    const date = registrationDateInput();
    if (date && String(date.value || date.getAttribute("value") || date.textContent || "").trim()) return true;
    return deepQueryAll("input,span,div").some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const meta = clean(`${el.id || ""} ${el.getAttribute && (el.getAttribute("name") || "")} ${el.getAttribute && (el.getAttribute("aria-label") || "")}`);
      const text = String(("value" in el ? el.value : "") || el.getAttribute && el.getAttribute("value") || el.textContent || "").trim();
      if (!text || !/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(text)) return false;
      return /date|datum|declaration/.test(meta) || rect(el).width < 260;
    });
  }
  function setRegistrationEndTimePlusOneMinute() {
    const start = registrationTimeInput("declaration_start_time_display");
    const end = registrationTimeInput("declaration_end_time_display");
    if (!start || !end) return false;
    const startText = registrationLiveTimeValue(start);
    if (timeTextToMinutes(startText) === null) return false;
    const next = addMinutesText(startText, 1);
    if (!next) return false;
    setInputTextComposed(end, next);
    return true;
  }
  function setRegistrationEndTimePlusOneHour() {
    const start = registrationTimeInput("declaration_start_time_display");
    const end = registrationTimeInput("declaration_end_time_display");
    if (!start || !end) return false;
    const startText = registrationLiveTimeValue(start);
    if (timeTextToMinutes(startText) === null) return false;
    const next = addOneHourText(startText);
    if (!next) return false;
    setInputTextComposed(end, next);
    return true;
  }
  function setRegistrationEndTimePlusMinutes(minutes) {
    const start = registrationTimeInput("declaration_start_time_display");
    const end = registrationTimeInput("declaration_end_time_display");
    if (!start || !end) return false;
    const startText = registrationLiveTimeValue(start);
    if (timeTextToMinutes(startText) === null) return false;
    const next = addMinutesText(startText, minutes);
    if (!next) return false;
    setInputTextComposed(end, next);
    return true;
  }
  function registrationLiveTimeValue(inp) {
    if (!inp) return "";
    return "value" in inp && typeof inp.value === "string" ? inp.value.trim() : "";
  }
  function registrationDurationMinutes() {
    const start = registrationTimeInput("declaration_start_time_display");
    const end = registrationTimeInput("declaration_end_time_display");
    const s = timeTextToMinutes(registrationLiveTimeValue(start));
    const e = timeTextToMinutes(registrationLiveTimeValue(end));
    if (s === null || e === null) return null;
    return e >= s ? e - s : e + 24 * 60 - s;
  }
  function registrationDirectTimeInput() {
    return overrideEl("regDirect") || document.getElementById("declaration_direct_time") || deepQueryAll("input").find((inp) => inp.id === "declaration_direct_time" || /(?:^|[\[_])direct_time(?:\]|$)/.test(inp.name || "")) || null;
  }
  function registrationIndirectTimeInput() {
    return overrideEl("regIndirect") || document.getElementById("declaration_indirect_time") || deepQueryAll("input").find((inp) => inp.id === "declaration_indirect_time" || /indirect_time/.test(inp.name || ""));
  }
  function setRegistrationTimeSplit({ directMinutes = null, indirectMinutes = null }) {
    let ok = true;
    const direct = registrationDirectTimeInput();
    const indirect = registrationIndirectTimeInput();
    if (directMinutes !== null) {
      if (direct) {
        const text = minutesToDurationText(directMinutes);
        if (String(direct.value || direct.getAttribute("value") || "") !== text) setInputTextComposed(direct, text);
      } else ok = false;
    }
    if (indirectMinutes !== null) {
      if (indirect) {
        const text = minutesToDurationText(indirectMinutes);
        if (String(indirect.value || indirect.getAttribute("value") || "") !== text) setInputTextComposed(indirect, text);
      } else ok = false;
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
    clearTimeout(registrationFlow.reapplyRegistrationSplitTimer);
    if (!registrationFlow.activeRegistrationChoice) return;
    const reapply = () => safe(() => {
      if (registrationFlow.activeRegistrationPortionMinutes !== null && registrationPortionApplies(registrationFlow.activeRegistrationChoice)) {
        applyRegistrationPortion(registrationFlow.activeRegistrationChoice, registrationFlow.activeRegistrationPortionMinutes);
      } else {
        applyRegistrationSplitForChoice(registrationFlow.activeRegistrationChoice);
      }
    });
    registrationFlow.reapplyRegistrationSplitTimer = setTimeout(reapply, 80);
    setTimeout(reapply, 260);
    setTimeout(reapply, 700);
  }
  function registrationTravelInput(kind) {
    const there = kind === "heen";
    const ov = overrideEl(there ? "regTravelBefore" : "regTravelAfter");
    if (ov) return ov;
    const directId = document.getElementById(there ? "declaration_travel_time_before" : "declaration_travel_time_after");
    if (directId && (visible(directId) || registrationInputValue(directId))) return directId;
    const idNeedles = there ? /(travel.*(before|to|heen|there|out|naar)|reistijd.*(heen|naar))/ : /(travel.*(after|back|return|from|terug)|reistijd.*terug)/;
    const exact = deepQueryAll("input").find((inp) => {
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
      return /travel|reistijd|time|tijd|number|text|__:__|uu:mm/.test(meta) || registrationInputValue(inp) !== "";
    });
    if (byLabel) return byLabel;
    const travelInputs = deepQueryAll("input").filter((inp) => visible(inp) && !isOwnPopup(inp) && /travel|reistijd/.test(registrationInputMeta(inp))).sort((a, b) => {
      const ar = rect(a), br = rect(b);
      return Math.abs(ar.top - br.top) > 8 ? ar.top - br.top : ar.left - br.left;
    });
    return travelInputs[there ? 0 : 1] || null;
  }
  function formatRegistrationTravelMinutes(minutes, input2) {
    if (Number.isInteger(minutes)) return String(minutes);
    return input2 && input2.type === "number" ? String(minutes) : String(minutes).replace(".", ",");
  }
  function setRegistrationTravelTotalMinutes(totalMinutes) {
    clickRegistrationTravelTimeButton();
    const there = registrationTravelInput("heen");
    const back = registrationTravelInput("terug");
    if (!there || !back) return false;
    const thereMinutes = Math.ceil(totalMinutes / 2);
    const backMinutes = Math.floor(totalMinutes / 2);
    setInputTextComposed(there, formatRegistrationTravelMinutes(thereMinutes, there));
    setInputTextComposed(back, formatRegistrationTravelMinutes(backMinutes, back));
    return true;
  }
  function clearRegistrationTravelTimes() {
    const fields = [
      overrideEl("regTravelBefore") || document.getElementById("declaration_travel_time_before") || registrationTravelInput("heen"),
      overrideEl("regTravelAfter") || document.getElementById("declaration_travel_time_after") || registrationTravelInput("terug")
    ].filter(Boolean);
    const unique = Array.from(new Set(fields));
    if (!unique.length) return true;
    for (const field2 of unique) setInputTextComposed(field2, "0");
    return true;
  }
  function scheduleClearRegistrationTravelTimes() {
    clearRegistrationTravelTimes();
    setTimeout(() => safe(clearRegistrationTravelTimes), 120);
    setTimeout(() => safe(clearRegistrationTravelTimes), 420);
  }

  // src/content/features/overlap.js
  function huidigAfspraakTijdvak() {
    var d = getDateInput();
    var ruw = d ? String(inputTextValue(d) || "") : "";
    var m = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(ruw);
    var ymd2 = m ? m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2) : null;
    var start = timeTextToMinutes(appointmentCurrentStartTimeText() || "");
    var e = getEndTimeInput();
    var eind = timeTextToMinutes(e ? String(inputTextValue(e) || "").trim() : "");
    return { ymd: ymd2, startMin: start, eindMin: eind };
  }
  function huidigRegistratieTijdvak() {
    var d = registrationDateInput();
    var ruw = d ? String(inputTextValue(d) || "") : "";
    var m = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(ruw);
    var ymd2 = m ? m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2) : null;
    var start = timeTextToMinutes(registrationLiveTimeValue(registrationTimeInput("declaration_start_time_display")));
    var eind = timeTextToMinutes(registrationLiveTimeValue(registrationTimeInput("declaration_end_time_display")));
    return { ymd: ymd2, startMin: start, eindMin: eind };
  }
  var _tijdvakCache = /* @__PURE__ */ Object.create(null);
  function _klokMinuten(v) {
    if (!v) return null;
    var m = /T(\d{2}):(\d{2})/.exec(String(v));
    if (m) return +m[1] * 60 + +m[2];
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d.getHours() * 60 + d.getMinutes();
  }
  function _tijdvakkenOverlappen(aStart, aEind, bStart, bEind) {
    if (aStart == null || aEind == null || bStart == null || bEind == null) return false;
    if (aEind <= aStart || bEind <= bStart) return false;
    return aStart < bEind && bStart < aEind;
  }
  function fetchWeekTijdvakken(laag, ymd2) {
    var id = resolveInviteeId();
    if (id == null || !ymd2) return Promise.resolve([]);
    var key = laag + "|" + id + "|" + ymd2;
    var c = _tijdvakCache[key];
    if (c && Date.now() - c.ts < 6e4) return Promise.resolve(c.rows);
    var url = _apiUrl(laag === "registraties" ? "weekRegistrations" : "weekEvents", { inviteeId: id, date: ymd2 });
    return getJson(url).then(function(j) {
      var rows = (mapAgendaWeekResponse(j) || []).map(function(e) {
        if (!e) return null;
        var st = _klokMinuten(e.start), et = _klokMinuten(e.end);
        if (e.allDay || st == null || et == null) return null;
        return { id: e.id != null ? String(e.id) : null, ymd: e.date, startMin: st, endMin: et, uursoort: e.hourType || "" };
      }).filter(Boolean);
      _tijdvakCache[key] = { ts: Date.now(), rows };
      return rows;
    }).catch(function() {
      return [];
    });
  }
  function geladenTijdvakken(laag, ymd2) {
    var id = resolveInviteeId();
    if (id == null || !ymd2) return null;
    var c = _tijdvakCache[laag + "|" + id + "|" + ymd2];
    return c ? c.rows : null;
  }
  function overlappendTijdvak(laag, ymd2, startMin, eindMin, negeerId) {
    var rijen = geladenTijdvakken(laag, ymd2);
    if (!rijen || !rijen.length || startMin == null || eindMin == null) return null;
    for (var i = 0; i < rijen.length; i++) {
      var r = rijen[i];
      if (r.ymd !== ymd2) continue;
      if (negeerId && String(r.id) === String(negeerId)) continue;
      if (_tijdvakkenOverlappen(startMin, eindMin, r.startMin, r.endMin)) return r;
    }
    return null;
  }
  function _klokTekst(m) {
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }
  function overlapMelding(hit, watStaatEr) {
    if (!hit) return "";
    return "Let op: op deze dag staat al " + watStaatEr + " van " + _klokTekst(hit.startMin) + " tot " + _klokTekst(hit.endMin) + (hit.uursoort ? " (" + hit.uursoort + ")" : "") + ".";
  }

  // src/content/features/appointment/free-day.js
  function elementIsFreeDayUnavailability(el) {
    if (!el || isOwnPopup(el)) return false;
    const type = el.getAttribute && el.getAttribute("data-type") || "";
    const cls = (el.className || "") + "";
    return type === "unavailability" || /\bunavailable\b/.test(cls);
  }
  var FREE_DAY_MIN_MINUTES = 240;
  function unavailabilityMinutes(el, col) {
    let mins = parseInt(el.getAttribute("data-duration"), 10);
    if (mins > 0) return mins;
    const h = col && (col.clientHeight || col.getBoundingClientRect && col.getBoundingClientRect().height) || 0;
    if (h > 0 && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      if (r.height > 0) return r.height / h * 24 * 60;
    }
    return 0;
  }
  function columnUnavailabilityMinutes(col) {
    if (!col) return 0;
    let total = 0;
    const seen = /* @__PURE__ */ new Set();
    const add = (el) => {
      if (!elementIsFreeDayUnavailability(el)) return;
      const id = el.getAttribute("data-id") || el.getAttribute("data-time") + "|" + el.getAttribute("data-date");
      if (seen.has(id)) return;
      seen.add(id);
      total += unavailabilityMinutes(el, col);
    };
    try {
      col.querySelectorAll(ONS.unavailability).forEach(add);
    } catch (e) {
    }
    const date = col.getAttribute("data-date");
    if (date) {
      try {
        document.querySelectorAll('[data-type="unavailability"][data-date="' + date + '"], .js_calendar_occurrence.unavailable[data-date="' + date + '"]').forEach(add);
      } catch (e) {
      }
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
  function trackCalendarClickForFreeDay(e) {
    const t = e.target;
    if (!t || t.closest && isOwnPopup(t)) return;
    const col = t.closest && t.closest(ONS.dayColumn);
    if (!col) return;
    appointmentFlow.appointmentFreeDay = dayColumnLooksFree(col);
    appointmentFlow.appointmentFreeDayDate = col.getAttribute("data-date") || null;
  }
  function installFreeDayTracking() {
    document.addEventListener("click", trackCalendarClickForFreeDay, true);
  }
  function refreshFreeDayFromBackgroundCalendar() {
    if (!appointmentFlow.appointmentFreeDayDate) return;
    const col = document.querySelector('.day.js_day[data-date="' + appointmentFlow.appointmentFreeDayDate + '"]');
    if (col && dayColumnLooksFree(col)) appointmentFlow.appointmentFreeDay = true;
    else if (dateHasFreeDayUnavailability(appointmentFlow.appointmentFreeDayDate)) appointmentFlow.appointmentFreeDay = true;
  }
  function showFreeDayInactive() {
    const body = $body();
    if (!body) return;
    clearScreenMark();
    renderScreen(body, "infoScreen", {
      title: "Vrije dag",
      titleStyle: { fontWeight: 700, fontSize: 14, color: "#555", padding: "4px 0 2px" },
      body: "Deze dag is grijs gemarkeerd. De afspraakhulp is hier niet actief.",
      bodyStyle: { lineHeight: 1.35 }
    });
    setSubmitBlocked(false);
    setStatus("Vrije dag — hulp inactief", false);
  }

  // src/content/features/appointment/invitee-guard.js
  var STRAY_ADD_EVENTS = ["pointerdown", "mousedown", "click"];
  function findAddInviteeButtonFast() {
    const tp = document.getElementById("teleport");
    if (!tp) return null;
    const header = tp.querySelector('div[slot="header"], [class*="_header_"]') || tp;
    let candidates;
    try {
      candidates = header.querySelectorAll("uc-button, button");
    } catch (e) {
      return null;
    }
    for (const btn of candidates) {
      if (!visible(btn) || isOwnPopup(btn)) continue;
      const txt = clean(uiText(btn) || btn.textContent || "");
      const hasAdd = btn.shadowRoot && (btn.shadowRoot.querySelector('uc-icon[icon="add"]') || btn.shadowRoot.querySelector('[icon="add"]')) || btn.querySelector && btn.querySelector('uc-icon[icon="add"]');
      if (/(^|[^a-z])toevoegen([^a-z]|$)/.test(txt) || hasAdd) return btn;
    }
    return null;
  }
  function findAddClientButton() {
    const fast = findAddInviteeButtonFast();
    if (fast) return fast;
    const scope = document;
    const headings = deepQueryAll("h1,h2,h3,div,span,p", scope).filter(function(el) {
      const txt = clean(el.textContent || "");
      return visible(el) && !isOwnPopup(el) && (txt === "genodigden" || txt.startsWith("genodigden") && txt.length < 80);
    }).sort(function(a, b) {
      return rect(a).top - rect(b).top || rect(a).left - rect(b).left;
    });
    const hasAddIcon = function(b) {
      return !!(b && (b.querySelector && (b.querySelector('uc-icon[icon="add"]') || b.querySelector('[icon="add"]')) || b.shadowRoot && (b.shadowRoot.querySelector('uc-icon[icon="add"]') || b.shadowRoot.querySelector('[icon="add"]'))));
    };
    const buttonText = function(b) {
      return clean(uiText(b) || b.textContent || b.shadowRoot && b.shadowRoot.textContent || "");
    };
    const candidates = deepQueryAll('uc-button,button,[role="button"]', scope).filter(function(b) {
      if (isOwnPopup(b)) return false;
      const r = rect(b);
      if (r.width <= 0 || r.height <= 0) return false;
      return /toevoegen/.test(buttonText(b)) || hasAddIcon(b);
    }).map(function(b) {
      const r = rect(b);
      const nearestHeading = headings.reduce(function(best, h) {
        const hr = rect(h);
        if (r.top < hr.top - 55 || r.top > hr.top + 160) return best;
        if (r.left < hr.left + 120 || r.left > hr.left + 900) return best;
        const dy = Math.abs(r.top + r.height / 2 - (hr.top + hr.height / 2));
        const sameHeaderBand = r.top >= hr.top - 36 && r.top <= hr.top + 110;
        const rightOfHeading = r.left > hr.left + 120;
        const score = dy + Math.abs(r.left - hr.left) / 6 + (sameHeaderBand ? -600 : 0) + (rightOfHeading ? -250 : 0);
        return Math.min(best, score);
      }, headings.length ? 99999 : 0);
      const txt = buttonText(b);
      const textBonus = /toevoegen/.test(txt) ? -700 : 0;
      const iconBonus = hasAddIcon(b) ? -150 : 0;
      const agendaPenalty = nearestHeading >= 99999 ? 1e5 : 0;
      return { button: b, score: nearestHeading + textBonus + iconBonus + agendaPenalty };
    }).sort(function(a, b) {
      return a.score - b.score;
    });
    return candidates.length && candidates[0].score < 5e4 ? candidates[0].button : null;
  }
  function clickAddClientButton() {
    const btn = findAddClientButton();
    if (!btn) {
      setStatus('Knop "Cliënt toevoegen" niet gevonden', false);
      return false;
    }
    appointmentFlow.intentionalAddClientClick = true;
    appointmentFlow.allowInviteeModalUntil = Date.now() + 6e3;
    try {
      clickUiButton(btn);
    } finally {
      setTimeout(() => {
        appointmentFlow.intentionalAddClientClick = false;
      }, 400);
    }
    setStatus("Cliënt toevoegen geopend");
    return true;
  }
  function findInviteeSearchModal() {
    for (const m of deepQueryAll('uc-modal,[role="dialog"],dialog')) {
      if (!visible(m) || isOwnPopup(m)) continue;
      const al = clean(m.getAttribute && (m.getAttribute("aria-label") || "") || "");
      if (al === "afspraak toevoegen" || al === "afspraakdetails") continue;
      if (/zoek naar genodigden|genodigde toevoegen|genodigde zoeken/.test(al)) return m;
      const txt = clean((m.textContent || "").slice(0, 500));
      if (/zoek naar (clienten|genodigden)/.test(txt) && /medewerker/.test(txt) && /(groep|team|locatie)/.test(txt)) return m;
    }
    return null;
  }
  function closeInviteeSearchModal(modal) {
    const closeBtn = deepQueryAll(UI_OVERRIDES.afsCloseButton || 'uc-button[aria-label*="sluit" i], button[aria-label*="sluit" i]', modal).find((b) => visible(b) && !isOwnPopup(b));
    if (closeBtn) {
      clickUiButton(closeBtn);
      return true;
    }
    const dlg = deepQueryAll('dialog,[role="dialog"]', modal)[0] || modal;
    try {
      dlg.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, composed: true, cancelable: true }));
    } catch (e) {
    }
    return false;
  }
  function maybeDismissStrayInviteeModal(attempt = 0) {
    if (!helperPanel.helperEnabled || helperPanel.activeMode === "registrations") return;
    if (appointmentFlow.intentionalAddClientClick || Date.now() < appointmentFlow.allowInviteeModalUntil) return;
    const modal = findInviteeSearchModal();
    if (!modal) {
      if (attempt < 6) setTimeout(() => maybeDismissStrayInviteeModal(attempt + 1), 70);
      return;
    }
    if (appointmentFlow.intentionalAddClientClick || Date.now() < appointmentFlow.allowInviteeModalUntil) return;
    closeInviteeSearchModal(modal);
    if (attempt < 6) setTimeout(() => maybeDismissStrayInviteeModal(attempt + 1), 90);
  }
  function inviteeAddButtonGuard(e) {
    if (appointmentFlow.intentionalAddClientClick || Date.now() < appointmentFlow.allowInviteeModalUntil) return;
    if (e.isTrusted) {
      appointmentFlow.allowInviteeModalUntil = Date.now() + 6e3;
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }
  function guardInviteeAddButton() {
    if (helperPanel.activeMode === "registrations") return;
    const btn = findAddInviteeButtonFast();
    if (!btn) return;
    const targets = [btn];
    const inner = btn.shadowRoot && btn.shadowRoot.querySelector("button");
    if (inner) targets.push(inner);
    for (const el of targets) {
      if (el.__onsInviteeGuarded) continue;
      el.__onsInviteeGuarded = true;
      for (const type of STRAY_ADD_EVENTS) el.addEventListener(type, inviteeAddButtonGuard, true);
    }
  }

  // src/content/features/appointment/uursoort-screens.js
  function clientsMissingUursoort() {
    return findClientEntries().filter((entry) => !entryUursoortIsSet(entry)).map((entry) => entry.firstName || firstNameFromName(entry.name)).filter(Boolean);
  }
  function missingUursoortText(names) {
    if (!names.length) return "Alle uursoorten zijn ingevuld.";
    if (names.length === 1) return `Voeg de uursoort toe voor ${names[0]}.`;
    const last = names[names.length - 1];
    return `Voeg de uursoort toe voor ${names.slice(0, -1).join(", ")} en ${last}.`;
  }
  function showManualUursoortInstruction() {
    const body = $body();
    if (!body) return;
    markScreen("manualUursoortInstruction");
    appointmentFlow.appointmentFlowBusy = false;
    appointmentFlow.appointmentAwaitingManualUursoort = true;
    scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
    const _subNode = mkText("afspraak_uursoort_sub", "Daarna gaat de afspraak vanzelf verder.", { fontSize: "12px", color: "#666", lineHeight: "1.35", padding: "0 0 8px" });
    const _instrNode = mkText("probleem_uursoort_zelf", "Kies zelf de uursoort in het gemarkeerde veld hieronder.", { fontSize: "12px", color: "#704b00", lineHeight: "1.35", padding: "0 0 8px" });
    try {
      highlightField(getUursoortTrigger() || (typeof findClientUursoortTrigger === "function" ? findClientUursoortTrigger() : null));
    } catch (e) {
    }
    const onWatchTick = () => safe(() => {
      if (!helperPanel.helperEnabled || helperPanel.activeMode === "registrations" || helperPanel._infoPanelRestore) return;
      checkNow();
    });
    const renderMissing = () => {
      const names = clientsMissingUursoort();
      renderScreen(body, "manualUursoort", {
        missingText: missingUursoortText(names),
        subNode: _subNode,
        instructionNode: _instrNode,
        tokens: ONSAH_TOKENS,
        onBack: function() {
          helperPanel.suppressAutoUntil = Date.now() + 1200;
          safe(() => {
            appointmentFlow.appointmentAwaitingManualUursoort = false;
            appointmentFlow.appointmentForceChoiceOnce = true;
            showChoices();
          });
        },
        onWatchTick,
        watchIntervalMs: 600
      });
      return names;
    };
    const checkNow = () => {
      invalidateClientEntries();
      const names = renderMissing();
      if (!names.length && hasUursoortSelected()) {
        showAppointmentReadyToSave();
        return true;
      }
      setStatus(names.length ? `Wacht op uursoort: ${names.join(", ")}` : "Uursoort gevonden", !names.length);
      return false;
    };
    checkNow();
  }
  function showUursoort(options, afterPick, clientContext = null) {
    const body = $body();
    if (!body) return;
    clearScreenMark();
    renderScreen(body, "pickList", {
      title: clientContext ? `Uursoort ${clientContext.firstName}` : "Kies uursoort",
      titleWeight: 600,
      loading: false,
      options,
      emptyMessage: "Geen uursoorten gevonden - open het veld handmatig.",
      emptyColor: "#b3261e",
      tokens: ONSAH_TOKENS,
      onBack: function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        appointmentFlow.autoSelectingNewClient = false;
        showChoices();
      },
      onPick: function(o) {
        safe(function() {
          setStatus("Bezig...");
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
            if (afterPick) afterPick(done);
            else done();
          }, freshTrigger || null);
        });
      }
    });
  }

  // src/content/features/appointment/prereqs.js
  function resumeAppointmentHelperAfterEnable() {
    helperPanel._infoPanelRestore = null;
    helperPanel._disabledRestore = null;
    appointmentFlow.appointmentAwaitingManualUursoort = false;
    updateSubmitGuard();
    if (!hasAppointmentPrereqs()) {
      if (hasClientInAppointment()) ensureClientExpanded(() => {
      });
      showAppointmentNeedsPrereqs();
      updateSubmitGuard();
      return;
    }
    ensureClientExpanded((expanded) => {
      appointmentFlow.appointmentForceChoiceOnce = true;
      showChoices();
      updateSubmitGuard();
      setStatus(expanded ? "Clientkaarten open" : "Clientkaarten openen...", expanded);
    });
  }
  function showAppointmentNeedsPrereqs() {
    const body = $body();
    if (!body) return;
    appointmentFlow.nonClientFreeTitleScreenActive = false;
    markScreen("appointmentNeedsPrereqs");
    const dateTimeReady = hasAppointmentDate() && hasAppointmentStartTime();
    if (!dateTimeReady) {
      renderScreen(body, "infoScreen", {
        title: "Vul begintijd en datum in.",
        titleStyle: { lineHeight: 1.35, padding: "4px 0 8px" },
        body: ""
      });
      setStatus("Wacht op begintijd en datum");
      return;
    }
    if (hasClientInAppointment()) {
      showChoices();
      return;
    }
    const _cats = nonClientCategoriesActive();
    renderScreen(body, "needsPrereqs", {
      categories: _cats.map(function(cat) {
        return { label: cat.label };
      }),
      tokens: ONSAH_TOKENS,
      onAddClient: function() {
        safe(clickAddClientButton);
      },
      onPickCategory: function(i) {
        safe(function() {
          const cat = _cats[i];
          if (cat.directOption) handleNonClientOption(cat.directOption);
          else showNonClientCategory(cat);
        });
      },
      onReset: function() {
        safe(clearNonClientSettings);
      }
    });
    setStatus("Kies een categorie of voeg een cliënt toe");
  }
  function refreshAppointmentPrereqScreen() {
    const body = $body();
    if (!body) return;
    if (Date.now() < helperPanel.suppressAutoUntil) return;
    refreshFreeDayFromBackgroundCalendar();
    if (appointmentFlow.appointmentFreeDay) {
      showFreeDayInactive();
      return;
    }
    if (helperPanel._infoPanelRestore) return;
    if (appointmentFlow.appointmentFlowBusy) return;
    if (appointmentFlow.uursoortQueueActive) return;
    if (appointmentFlow.nonClientBusy) return;
    if (appointmentFlow.appointmentClearingSettings) {
      showLoadingState("Instellingen verwijderen...");
      return;
    }
    if (appointmentFlow.activeNonClientOption && appointmentFlow.activeNonClientOption.freeTitle) {
      if (hasClientInAppointment() && hasAppointmentPrereqs()) {
        appointmentFlow.nonClientFreeTitleScreenActive = false;
        appointmentFlow.activeNonClientOption = null;
        showChoices();
        return;
      }
      if (nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption)) {
        if (appointmentFlow.nonClientFreeTitleScreenActive || !text.includes("als de instellingen kloppen")) {
          appointmentFlow.nonClientFreeTitleScreenActive = false;
          showAppointmentReadyToSave();
        }
        return;
      }
      if (appointmentFlow.nonClientFreeTitleScreenActive) return;
    }
    if (appointmentFlow.nonClientNoUursoortActive && appointmentFlow.activeNonClientOption && !appointmentFlow.activeNonClientOption.freeTitle) {
      if (nonClientUursoortSet()) {
        appointmentFlow.nonClientNoUursoortActive = false;
        showAppointmentReadyToSave();
      }
      return;
    }
    const text = clean(body.textContent || "");
    if (appointmentNeedsAvailabilityConfirmation() && !text.includes("al een afspraak") && !appointmentInSaveStage()) {
      showAvailabilityWarning();
      return;
    }
    const choiceScreen = CONFIG.choices.every((choice) => text.includes(clean(choice.label)));
    if (appointmentFlow.appointmentAwaitingManualUursoort && hasAppointmentPrereqs()) {
      if (!isScreen("manualUursoortInstruction")) showManualUursoortInstruction();
      return;
    }
    if (appointmentFlow.appointmentSaveScreenActive) {
      if (!choiceScreen && appointmentSaveStageStillValid()) return;
      appointmentFlow.appointmentSaveScreenActive = false;
    }
    if (appointmentReadyToSave() && !choiceScreen) {
      showAppointmentReadyToSave();
      return;
    }
    const prereqScreen = text.includes("vul client, begintijd en datum in") || text.includes("voeg een client toe voor clientgerelateerde afspraken") || text.includes("voeg evt. een client toe aan de afspraak");
    const nonClientSubScreen = text.includes("niet clientgerelateerde afspraken") || text.includes(" duur:") || nonClientCategoriesActive().some(function(c) {
      return text.includes(clean(c.label)) && text.includes("terug");
    });
    const clientDurationScreen = !!appointmentFlow.pendingChoice && (text.includes(" duur:") || text.includes("totale reistijd"));
    if (hasClientInAppointment() && hasAppointmentPrereqs() && !choiceScreen && !clientDurationScreen) {
      appointmentFlow.activeNonClientOption = null;
      showChoices();
      return;
    }
    if (prereqScreen && hasAppointmentPrereqs()) showChoices();
    else if (!hasAppointmentPrereqs() && nonClientSubScreen) return;
    else if (!hasAppointmentPrereqs() && !prereqScreen) showAppointmentNeedsPrereqs();
  }

  // src/content/features/appointment/save.js
  function appointmentInSaveStage() {
    if (appointmentFlow.activeNonClientOption && appointmentFlow.activeNonClientOption.freeTitle) return nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption);
    return appointmentReadyToSave();
  }
  function submitAppointmentFromHelper() {
    updateSubmitGuard();
    if (appointmentFlow.activeNonClientOption && appointmentFlow.activeNonClientOption.freeTitle) {
      if (!nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption)) {
        setStatus("Vul eerst de titel aan.", false);
        const inp = getTitleInputSafe();
        if (inp && inp.focus) {
          try {
            inp.focus();
          } catch (e) {
          }
        }
        return;
      }
      const btn2 = submitButtons()[0];
      if (!btn2) {
        setStatus("Opslaan-knop niet gevonden", false);
        return;
      }
      const target2 = btn2.shadowRoot ? btn2.shadowRoot.querySelector('button[type="submit"], button') || btn2 : btn2;
      try {
        target2.click();
      } catch (e) {
        clickOption(btn2);
      }
      return;
    }
    const missing = appointmentFlow.activeNonClientOption ? !nonClientUursoortSet() : !hasUursoortSelected();
    if (shouldRequireUursoortForSubmit() && missing) {
      setStatus(appointmentFlow.activeNonClientOption ? "Voeg nog een uursoort toe." : "Voeg eerst bij elke client een uursoort toe.", false);
      return;
    }
    const btn = submitButtons()[0];
    if (!btn) {
      setStatus("Opslaan-knop niet gevonden", false);
      return;
    }
    const target = btn.shadowRoot ? btn.shadowRoot.querySelector('button[type="submit"], button') || btn : btn;
    try {
      target.click();
    } catch (e) {
      clickOption(btn);
    }
  }
  function showAppointmentReadyToSave() {
    const body = $body();
    if (!body) return;
    markScreen("appointmentReadyToSave");
    appointmentFlow.appointmentFlowBusy = false;
    appointmentFlow.appointmentAwaitingManualUursoort = false;
    scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
    const nonClient = !hasClientInAppointment() && !!appointmentFlow.activeNonClientOption;
    let _dpBox = null;
    if (!(APP_CONFIG.features && APP_CONFIG.features.doorplannenToggle === false)) {
      _dpBox = mkToggleBox("doorplannen_vraag", "Afspraak doorplannen?", appointmentFlow.appointmentDoorplannen, (on) => safe(() => {
        appointmentFlow.appointmentDoorplannen = on;
        appointmentFlow.doorplannenSuppressAutoUntil = Date.now() + (on ? 1500 : 2e3);
        if (on) expandRecurrence();
        else collapseRecurrence();
        showAppointmentReadyToSave();
      }));
    }
    const freeTitle = nonClient && !!appointmentFlow.activeNonClientOption.freeTitle;
    const _tv = huidigAfspraakTijdvak();
    let _overlapTekst = "";
    if (_tv.ymd && _tv.startMin != null && _tv.eindMin != null) {
      const _al = geladenTijdvakken("afspraken", _tv.ymd);
      if (_al === null) {
        fetchWeekTijdvakken("afspraken", _tv.ymd).then(function(rijen) {
          if (rijen && rijen.length && appointmentFlow.appointmentSaveScreenActive) safe(showAppointmentReadyToSave);
        });
      } else {
        _overlapTekst = overlapMelding(
          overlappendTijdvak("afspraken", _tv.ymd, _tv.startMin, _tv.eindMin, null),
          "een afspraak"
        );
      }
    }
    const _doorplannenActief = !(APP_CONFIG.features && APP_CONFIG.features.doorplannenToggle === false);
    if (_doorplannenActief) {
      appointmentFlow.doorplannenLastBlocked = doorplannenBlocksSave();
      appointmentFlow.doorplannenLastRecurrenceSet = recurrenceIsSet();
      appointmentFlow.doorplannenLastExpanded = recurrenceHeaderExpanded();
    }
    const onWatchTick = () => safe(() => {
      if (!helperPanel.helperEnabled || !appointmentFlow.appointmentSaveScreenActive) return;
      const suppressed = Date.now() < appointmentFlow.doorplannenSuppressAutoUntil;
      const nowSet = recurrenceIsSet();
      const expanded = recurrenceHeaderExpanded();
      const roseSet = nowSet && !appointmentFlow.doorplannenLastRecurrenceSet;
      const roseExpanded = expanded && !appointmentFlow.doorplannenLastExpanded;
      const fellSet = !nowSet && appointmentFlow.doorplannenLastRecurrenceSet;
      const fellExpanded = !expanded && appointmentFlow.doorplannenLastExpanded;
      if (!suppressed) {
        if (!appointmentFlow.appointmentDoorplannen && (roseSet || roseExpanded)) {
          appointmentFlow.appointmentDoorplannen = true;
          appointmentFlow.doorplannenLastRecurrenceSet = nowSet;
          appointmentFlow.doorplannenLastExpanded = expanded;
          showAppointmentReadyToSave();
          return;
        }
        if (appointmentFlow.appointmentDoorplannen && (fellSet || fellExpanded)) {
          appointmentFlow.appointmentDoorplannen = false;
          appointmentFlow.doorplannenSuppressAutoUntil = Date.now() + 800;
          appointmentFlow.doorplannenLastRecurrenceSet = nowSet;
          appointmentFlow.doorplannenLastExpanded = expanded;
          showAppointmentReadyToSave();
          return;
        }
      }
      appointmentFlow.doorplannenLastRecurrenceSet = nowSet;
      appointmentFlow.doorplannenLastExpanded = expanded;
      if (appointmentFlow.appointmentDoorplannen && doorplannenBlocksSave() !== appointmentFlow.doorplannenLastBlocked) {
        showAppointmentReadyToSave();
      }
    });
    renderScreen(body, "readyToSave", {
      // Alleen aanbieden als er iets is om naar terug te keren.
      onUndo: hasAppointmentSnapshot() ? function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(function() {
          appointmentFlow.appointmentSaveScreenActive = false;
          showLoadingState("Terugdraaien...");
          restoreAppointmentSnapshot(function(ok) {
            setStatus(ok ? "Instellingen teruggedraaid" : "Terugdraaien niet gelukt", ok);
            appointmentFlow.appointmentForceChoiceOnce = true;
            appointmentFlow.pendingChoice = null;
            appointmentFlow.appointmentTypeApplied = false;
            appointmentFlow.activeAppointmentDurationMinutes = null;
            showChoices();
          });
        });
      } : null,
      onWatchTick,
      watchIntervalMs: _doorplannenActief ? 250 : 0,
      textNodes: [
        mkText("afspraak_klaar_regel1", "Voeg eventueel nog een locatie en notitie toe.", { fontSize: "13px", color: "#333", lineHeight: "1.35", padding: "4px 0 2px" }),
        mkText("afspraak_klaar_regel2", "Als de instellingen kloppen, kun je de afspraak opslaan", { fontSize: "13px", color: "#333", lineHeight: "1.35", padding: "0 0 8px" })
      ],
      toggleNode: _dpBox,
      tokens: ONSAH_TOKENS,
      onBack: function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(function() {
          appointmentFlow.appointmentSaveScreenActive = false;
          if (nonClient) {
            showAppointmentNeedsPrereqs();
            return;
          }
          appointmentFlow.appointmentForceChoiceOnce = true;
          showChoices();
        });
      },
      saveDisabled: doorplannenBlocksSave(),
      onSave: () => safe(() => {
        if (doorplannenBlocksSave()) {
          try {
            highlightField(findRecurrenceField() || findRecurrenceHeader(), 5e3);
          } catch (e) {
          }
          setStatus("Stel de herhaling in of zet doorplannen uit", false);
          return;
        }
        submitAppointmentFromHelper();
      }),
      showUursoortNote: nonClient && !freeTitle && !nonClientUursoortSet(),
      overlapNote: _overlapTekst
    });
    const ready = freeTitle ? nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption) : nonClient ? nonClientUursoortSet() : hasUursoortSelected();
    if (doorplannenBlocksSave()) setStatus("Stel de herhaling in of zet doorplannen uit", false);
    else setStatus(ready ? "Klaar om op te slaan" : freeTitle ? "Vul de titel aan" : nonClient ? "Voeg nog een uursoort toe" : "Voeg eerst bij elke client een uursoort toe", ready);
    updateSubmitGuard();
    appointmentFlow.appointmentSaveScreenActive = true;
  }

  // src/content/features/appointment/duration.js
  function applyAppointmentDuration(choice, minutes) {
    appointmentFlow.appointmentFlowBusy = true;
    appointmentFlow.activeAppointmentDurationMinutes = minutes;
    appointmentFlow.activeAppointmentStartTimeText = appointmentCurrentStartTimeText();
    if (choice.addTravelTime) {
      const endOk = setAppointmentEndTimePlusMinutes(minutes);
      scheduleAppointmentEndTime(minutes);
      setStatus(endOk ? `${choice.label} ${registrationDurationLabel(minutes)}` : "Eindtijd niet gezet", endOk);
      setTimeout(() => showAppointmentTravelSelection(choice), 80);
    } else {
      clearAppointmentTravelTimes();
      const endOk = setAppointmentEndTimePlusMinutes(minutes);
      scheduleAppointmentEndTime(minutes);
      setStatus(endOk ? `${choice.label} ${registrationDurationLabel(minutes)}` : "Eindtijd niet gezet", endOk);
      setTimeout(() => {
        handleChoice(choice);
        scheduleAppointmentEndTime(minutes);
        [120, 350, 650].forEach((d) => setTimeout(() => safe(() => enforceAppointmentEndTime(minutes)), d));
      }, 80);
    }
  }
  function showAppointmentDurationSelection(choice) {
    const body = $body();
    if (!body) return;
    if (!hasAppointmentPrereqs()) {
      showAppointmentNeedsPrereqs();
      return;
    }
    markScreen("appointmentDurationSelection", { choice });
    appointmentFlow.appointmentFlowBusy = false;
    const _st = choice.durationStep > 0 ? choice.durationStep : gsNum("durationStepMin", 15);
    const _mx = choice.maxDuration > 0 ? choice.maxDuration : gsNum("registrationMaxMin", 180);
    const _durValues = [];
    for (let m = _st; m <= _mx; m += _st) _durValues.push(m);
    renderScreen(body, "duration", {
      title: `${choice.label} duur:`,
      tokens: ONSAH_TOKENS,
      onBack: function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(showChoices);
      },
      pickerNode: mkDurationPicker(_durValues, (minutes) => safe(() => applyAppointmentDuration(choice, minutes)), choice.pickerStyle, void 0, durationLabelStyle("duur"))
    });
  }
  function showAppointmentTravelSelection(choice) {
    const body = $body();
    if (!body) return;
    markScreen("appointmentTravelSelection", { choice });
    appointmentFlow.appointmentFlowBusy = false;
    const _ts = APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.travelStepMin > 0 ? APP_CONFIG.generalSettings.travelStepMin : 5;
    const _tm = APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.travelMaxMin > 0 ? APP_CONFIG.generalSettings.travelMaxMin : 60;
    const _travelValues = [];
    for (let m = 0; m <= _tm; m += _ts) _travelValues.push(m);
    renderScreen(body, "duration", {
      title: "Totale reistijd (heen en terug):",
      tokens: ONSAH_TOKENS,
      onBack: function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(showChoices);
      },
      pickerNode: mkValuePicker(_travelValues, 0, (minutes) => safe(() => {
        appointmentFlow.appointmentFlowBusy = true;
        const ok = setAppointmentTravelTotalMinutes(minutes);
        setStatus(ok ? `Reistijd gezet: ${registrationDurationLabel(minutes)} totaal` : "Reistijdvelden niet gevonden", ok);
        setTimeout(() => handleChoice(choice), 70);
      }), choice.pickerStyle, void 0, durationLabelStyle("duur"))
    });
  }

  // src/content/helper/screen-restore.js
  function refreshMainScreen() {
    if (!helperPanel.helperEnabled) {
      showDisabledState();
      return;
    }
    if (helperPanel.activeMode === "registrations") showRegistrationChoices();
    else showChoices();
  }
  function renderMarkedScreen(screen) {
    if (!screen || !screen.name) return false;
    const a = screen.args || {};
    switch (screen.name) {
      case "registrationNoShowPrompt":
        showRegistrationNoShowPrompt();
        return true;
      case "registrationNeedsClient":
        showRegistrationNeedsClient();
        return true;
      case "registrationDurationAsk":
        showRegistrationDurationAsk(a.choice);
        return true;
      case "registrationPortionQuestion":
        showRegistrationPortionQuestion(a.choice);
        return true;
      case "registrationPortionDuration":
        showRegistrationPortionDuration(a.choice);
        return true;
      case "registrationTravelSelection":
        showRegistrationTravelSelection(a.choice);
        return true;
      case "registrationHourTypeSelection":
        showRegistrationHourTypeSelection(a.index != null ? a.index : registrationFlow.activeRegistrationHourTypeIndex || 0);
        return true;
      case "registrationReportPrompt":
        showRegistrationReportPrompt(a.choice);
        return true;
      case "registrationChoices":
        showRegistrationChoices();
        return true;
      case "nonClientFreeTitlePrompt":
        showNonClientFreeTitlePrompt(a.opt);
        return true;
      case "nonClientDurationSelection":
        showNonClientDurationSelection(a.opt);
        return true;
      case "appointmentNeedsPrereqs":
        showAppointmentNeedsPrereqs();
        return true;
      case "appointmentReadyToSave":
        showAppointmentReadyToSave();
        return true;
      case "appointmentDurationSelection":
        showAppointmentDurationSelection(a.choice);
        return true;
      case "appointmentTravelSelection":
        showAppointmentTravelSelection(a.choice);
        return true;
      case "manualUursoortInstruction":
        showManualUursoortInstruction();
        return true;
      case "choices":
        showChoices();
        return true;
      default:
        return false;
    }
  }
  function createCurrentScreenRestore() {
    const marked = currentScreen ? { name: currentScreen.name, args: currentScreen.args } : null;
    const body = $body();
    const currentText = clean(body && body.textContent || "");
    const registrationChoice = registrationFlow.activeRegistrationChoice;
    const appointmentChoice = appointmentFlow.pendingChoice;
    const registrationScreen = {
      noShowPrompt: currentText.includes("no show?"),
      needsClient: /vul client, begintijd en datum in/.test(currentText),
      duration: !!registrationChoice && / duur:/.test(currentText),
      portionQuestion: !!registrationChoice && /tijd aanwezig in deze registratie/.test(currentText),
      portionDuration: !!registrationChoice && /^duur .* tijd:/.test(currentText),
      travel: !!registrationChoice && /totale reistijd/.test(currentText),
      hourType: /^uursoort(?:selectie|\s)/.test(currentText),
      submit: !!registrationChoice && /richtlijn rapporteren|schrijf nu je rapportage|indienen/.test(currentText)
    };
    const nonClientOpt = appointmentFlow.activeNonClientOption;
    const appointmentScreen = {
      needsPrereqs: /vul client, begintijd en datum in|voeg evt\. een client toe aan de afspraak/.test(currentText),
      nonClientMenu: /niet clientgerelateerde afspraken/.test(currentText),
      nonClientDuration: !!nonClientOpt && / duur:/.test(currentText),
      nonClientFreeTitle: !!nonClientOpt && !!nonClientOpt.freeTitle && /vul de titel aan na/.test(currentText),
      unavailable: /onbeschikbaar|al een afspraak|alsnog doorgaan/.test(currentText),
      duration: !!appointmentChoice && / duur:/.test(currentText),
      travel: !!appointmentChoice && /totale reistijd/.test(currentText),
      manualUursoort: appointmentFlow.appointmentAwaitingManualUursoort || currentText.includes("voeg de juiste uursoort toe aan de client"),
      readyToSave: /als de instellingen kloppen|voeg eventueel nog een locatie/.test(currentText)
    };
    return () => {
      if (renderMarkedScreen(marked)) return;
      if (helperPanel.activeMode === "registrations") {
        if (registrationScreen.noShowPrompt) {
          showRegistrationNoShowPrompt();
          return;
        }
        if (registrationScreen.needsClient) {
          showRegistrationNeedsClient();
          return;
        }
        if (registrationScreen.duration && registrationChoice) {
          showRegistrationDurationAsk(registrationChoice);
          return;
        }
        if (registrationScreen.portionQuestion && registrationChoice) {
          showRegistrationPortionQuestion(registrationChoice);
          return;
        }
        if (registrationScreen.portionDuration && registrationChoice) {
          showRegistrationPortionDuration(registrationChoice);
          return;
        }
        if (registrationScreen.travel && registrationChoice) {
          showRegistrationTravelSelection(registrationChoice);
          return;
        }
        if (registrationScreen.hourType) {
          showRegistrationHourTypeSelection(registrationFlow.activeRegistrationHourTypeIndex || 0);
          return;
        }
        if (registrationScreen.submit && registrationChoice) {
          showRegistrationReportPrompt(registrationChoice);
          return;
        }
        showRegistrationChoices();
        return;
      }
      if (appointmentScreen.nonClientFreeTitle && nonClientOpt) {
        showNonClientFreeTitlePrompt(nonClientOpt);
        return;
      }
      if (appointmentScreen.nonClientDuration && nonClientOpt) {
        showNonClientDurationSelection(nonClientOpt);
        return;
      }
      if (appointmentScreen.nonClientMenu) {
        showAppointmentNeedsPrereqs();
        return;
      }
      if (appointmentScreen.readyToSave && nonClientOpt) {
        showAppointmentReadyToSave();
        return;
      }
      if (appointmentScreen.needsPrereqs) {
        showAppointmentNeedsPrereqs();
        return;
      }
      if (appointmentScreen.duration && appointmentChoice) {
        showAppointmentDurationSelection(appointmentChoice);
        return;
      }
      if (appointmentScreen.travel && appointmentChoice) {
        showAppointmentTravelSelection(appointmentChoice);
        return;
      }
      if (appointmentScreen.manualUursoort) {
        showManualUursoortInstruction();
        return;
      }
      if (appointmentScreen.readyToSave) {
        showAppointmentReadyToSave();
        return;
      }
      showChoices();
    };
  }

  // src/content/features/appointment/availability.js
  function unavailableInvitees() {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const el of deepQueryAll("span, div")) {
      if (isOwnPopup(el)) continue;
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!txt.includes("heeft al een afspraak")) continue;
      const name = txt.replace(/\s*heeft al een afspraak.*$/i, "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, firstName: firstNameFromName(name), role: "" });
    }
    return out.sort((a, b) => a.firstName.localeCompare(b.firstName));
  }
  function availabilityPersonKey(entry) {
    return clean(entry.name || entry.firstName || "").toLowerCase().replace(/\s+/g, " ");
  }
  function appointmentNeedsAvailabilityConfirmation() {
    return false;
  }
  function showAvailabilityWarning() {
    const body = $body();
    if (!body) return;
    const entries = unavailableInvitees().filter((entry) => !appointmentFlow.appointmentAvailabilityConfirmedPeople.has(availabilityPersonKey(entry)));
    if (!entries.length) {
      showChoices();
      return;
    }
    if (!helperPanel._availabilityRestore) helperPanel._availabilityRestore = createCurrentScreenRestore();
    const names = entries.map((entry) => entry.firstName).filter(Boolean);
    const nameText = names.length <= 1 ? names[0] || "Deze genodigde" : `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`;
    setStatus("Let op: al een afspraak", false);
    const shell = mkModalShell("onsAvailabilityWarningModal", "Toch doorgaan?", { spineColor: "#b45309", maxWidth: "360px" });
    const msg = document.createElement("div");
    msg.textContent = `${nameText} ${names.length === 1 ? "heeft" : "hebben"} op dit moment al een afspraak.`;
    Object.assign(msg.style, { fontSize: "13.5px", color: "#4a4448", lineHeight: "1.45", margin: "0 0 16px" });
    shell.body.appendChild(msg);
    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", justifyContent: "flex-end", gap: "8px" });
    const noBtn = document.createElement("button");
    noBtn.type = "button";
    noBtn.textContent = "Nee";
    Object.assign(noBtn.style, { appearance: "none", border: "1px solid #ece7e5", background: "transparent", color: "#6b6367", borderRadius: "999px", padding: "9px 16px", font: '600 12.5px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', cursor: "pointer" });
    onsahFocusRing(noBtn);
    noBtn.addEventListener("click", () => safe(() => {
      shell.close();
      helperPanel._availabilityRestore = null;
      resetBody(body);
      const msg2 = document.createElement("div");
      msg2.textContent = "Plan een andere datum/tijdstip in of sluit het scherm af.";
      Object.assign(msg2.style, { fontSize: "13px", color: "#333", lineHeight: "1.45", padding: "4px 0 8px" });
      body.appendChild(msg2);
      body.appendChild(mkButton("Afsluiten", () => safe(closeOnsModal)));
      body.appendChild(mkButton("Terug", () => safe(showChoices)));
      setStatus("Niet doorgaan gekozen", false);
    }));
    const yesBtn = mkPillButton("Ja, doorgaan", () => safe(() => {
      shell.close();
      entries.forEach((entry) => appointmentFlow.appointmentAvailabilityConfirmedPeople.add(availabilityPersonKey(entry)));
      helperPanel._availabilityRestore = null;
      if (appointmentInSaveStage()) {
        if (appointmentFlow.activeNonClientOption && appointmentFlow.activeNonClientOption.freeTitle) appointmentFlow.nonClientFreeTitleScreenActive = false;
        showAppointmentReadyToSave();
      } else {
        appointmentFlow.appointmentForceChoiceOnce = true;
        showChoices();
      }
      setStatus("");
    }), { from: "#b45309", to: "#8a3d05", shadowRgb: "180,83,9" });
    actions.append(noBtn, yesBtn);
    shell.body.appendChild(actions);
  }

  // src/content/features/appointment/choices.js
  function showNeedsTeamChoice() {
    const body = $body();
    if (!body) return;
    clearScreenMark();
    renderScreen(body, "infoScreen", {
      title: "Kies eerst je team om de hulp te gebruiken.",
      titleStyle: { padding: "6px 0" },
      body: "Open de extensie (het pictogram naast de adresbalk) en kies je team/kleurprofiel. Daarna verschijnen de afspraaktypes en registraties hier."
    });
    setStatus("Kies eerst je team", false);
  }
  function showChoices() {
    const body = $body();
    if (!body) return;
    appointmentFlow.appointmentDoorplannen = false;
    if (appointmentFlow.appointmentClearingSettings) {
      showLoadingState("Instellingen verwijderen...");
      return;
    }
    if (helperNeedsTeamChoice()) {
      showNeedsTeamChoice();
      return;
    }
    appointmentFlow.nonClientFreeTitleScreenActive = false;
    appointmentFlow.appointmentAwaitingManualUursoort = false;
    appointmentFlow.activeNonClientOption = null;
    const forceChoice = appointmentFlow.appointmentForceChoiceOnce;
    appointmentFlow.appointmentForceChoiceOnce = false;
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
    markScreen("choices");
    if (appointmentFlow.clientWaitTimer) {
      clearTimeout(appointmentFlow.clientWaitTimer);
      appointmentFlow.clientWaitTimer = null;
    }
    if (appointmentFlow.appointmentTypeApplied) {
      renderChoicesBlocked(body);
      return;
    }
    ensureClientExpanded((expanded) => {
      if (!expanded) setStatus("Clientkaart openen...", false);
    });
    const _missingHooks = appointmentMissingHooks();
    if (_missingHooks.length) {
      resetBody(body);
      body.appendChild(mkProblemBanner(_missingHooks));
      CONFIG.choices.forEach((choice, i) => body.appendChild(mkButton(choice.label, () => safe(() => {
        appointmentFlow.pendingChoice = choice;
        prepareClientAndHandleChoice(choice);
      }), { tick: onsahChoiceDotColor(choice, i), meta: onsahChoiceDirectIndirectLabel(choice) })));
      addResetButton(body);
      setStatus("");
      return;
    }
    renderChoicesReact(body, false);
    setStatus("");
  }
  function renderChoicesReact(body, blocked) {
    const choices = CONFIG.choices.map((choice, i) => ({
      label: choice.label,
      tick: onsahChoiceDotColor(choice, i),
      meta: onsahChoiceDirectIndirectLabel(choice)
    }));
    renderScreen(body, "choices", {
      choices,
      blocked: !!blocked,
      blockedNote: "Er zijn al instellingen toegepast. Verwijder eerst de instellingen om een ander afspraaktype te kiezen.",
      tokens: ONSAH_TOKENS,
      onPick: function(i) {
        safe(function() {
          const choice = CONFIG.choices[i];
          appointmentFlow.pendingChoice = choice;
          prepareClientAndHandleChoice(choice);
        });
      },
      onReset: function() {
        safe(clearSettings);
      },
      showSaveNav: !!blocked && appointmentReadyToSave(),
      onSaveNav: function() {
        safe(function() {
          appointmentFlow.appointmentForceChoiceOnce = false;
          showAppointmentReadyToSave();
        });
      }
    });
  }
  function renderChoicesBlocked(body) {
    renderChoicesReact(body, true);
    setStatus("Verwijder eerst de instellingen", false);
  }
  function prepareClientAndHandleChoice(choice) {
    setStatus("");
    if (!hasAppointmentPrereqs()) {
      showAppointmentNeedsPrereqs();
      return;
    }
    takeAppointmentSnapshot();
    appointmentFlow.appointmentFlowBusy = true;
    if (!choice.addTravelTime) clearAppointmentTravelTimes();
    busyWhile(6e3, (done) => {
      ensureClientExpanded((expanded) => {
        done();
        if (!expanded) setStatus("Clientkaart openen...", false);
        const gepland = plannedAppointmentMinutes();
        if (gepland) applyAppointmentDuration(choice, gepland);
        else if (choice.defaultDuration > 0) applyAppointmentDuration(choice, choice.defaultDuration);
        else showAppointmentDurationSelection(choice);
      });
    });
  }
  function handleChoice(choice) {
    appointmentFlow.appointmentTypeApplied = true;
    setBusyCursor(true);
    let _choiceDone = false;
    const _finishBusy = () => {
      if (!_choiceDone) {
        _choiceDone = true;
        setBusyCursor(false);
      }
    };
    const _busyGuard = setTimeout(_finishBusy, 8e3);
    const _endBusy = () => {
      clearTimeout(_busyGuard);
      _finishBusy();
    };
    scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
    if (!choice.addTravelTime) clearAppointmentTravelTimes();
    setStatus("Bezig...");
    const desiredClientPresent = choice.clientPresent;
    setTitleForChoice(choice, (titleOk) => {
      scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
      applyClientPresent(desiredClientPresent, (clOk) => {
        scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
        const msg = [];
        msg.push(titleOk ? "titel gezet" : "titel niet gevonden");
        msg.push(clOk ? `aanwezig ${desiredClientPresent ? "aan" : "uit"}` : "aanwezig niet gevonden");
        const base = msg.join(" | ");
        setStatus(base, titleOk && clOk);
        if (choice.pickUursoort) {
          invalidateClientEntries();
          if (!hasClientInAppointment()) {
            scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
            const afterLabel = () => ensureClientExpanded(() => {
              showManualUursoortInstruction();
              _endBusy();
            });
            setLabelsExclusive(choiceLabels(choice), afterLabel);
            setStatus(base + " | voeg uursoort handmatig toe", titleOk && clOk);
          } else {
            setStatus("Uursoorten uit cliëntkaart laden...");
            showUursoortQueue([], 0, () => {
              scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
              const finishSave = () => {
                _endBusy();
                showAppointmentReadyToSave();
              };
              setLabelsExclusive(choiceLabels(choice), finishSave);
            });
          }
        } else {
          const afterLabel = () => clearUursoort(() => {
            setStatus(base + " | uursoort leeg", titleOk && clOk);
            _endBusy();
          });
          setLabelsExclusive(choiceLabels(choice), afterLabel);
        }
      });
    });
  }

  // src/content/features/appointment/uursoort-queue.js
  function uursoortContexts() {
    return findClientEntries().filter((entry) => entry.uursoortTrigger).map((entry) => ({
      firstName: entry.firstName,
      name: entry.name,
      trigger: entry.uursoortTrigger
    }));
  }
  function freshUursoortContext(context2) {
    if (!context2) return context2;
    const entry = findClientEntries().find(
      (item) => item.name === context2.name
    );
    return entry && entry.uursoortTrigger ? {
      firstName: entry.firstName,
      name: entry.name,
      trigger: entry.uursoortTrigger
    } : context2;
  }
  function freshUursoortTriggerForContext(context2) {
    return (freshUursoortContext(context2) || {}).trigger || null;
  }
  function clearUursoortContexts(contexts, onDone, index = 0) {
    if (!contexts.length || index >= contexts.length) {
      onDone();
      return;
    }
    invalidateClientEntries();
    const ctx = freshUursoortContext(contexts[index]);
    clearUursoort(
      () => setTimeout(
        () => clearUursoortContexts(contexts, onDone, index + 1),
        120
      ),
      ctx && ctx.trigger
    );
  }
  function clearAllUursoorten(onDone, attempt = 0) {
    invalidateClientEntries();
    const contexts = uursoortContexts().filter(
      (ctx) => entryUursoortIsSet(
        findClientEntries().find((e) => e.name === ctx.name) || {}
      )
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
      (e) => !(exclude && exclude.has(typeof clean === "function" ? clean(e.name) : e.name)) && !entryUursoortIsSet(e)
    );
  }
  function showUursoortQueue(contexts, index, afterAll) {
    if (appointmentFlow.uursoortQueueActive) return;
    appointmentFlow.uursoortQueueActive = true;
    const myGen = appointmentFlow.uursoortQueueGen;
    const stale = () => myGen !== appointmentFlow.uursoortQueueGen;
    const handled = /* @__PURE__ */ new Set();
    const expandTries = /* @__PURE__ */ new Map();
    const nullTries = /* @__PURE__ */ new Map();
    let guard = 0;
    const done = () => {
      if (stale()) return;
      appointmentFlow.uursoortQueueActive = false;
      setTimeout(afterAll, 60);
    };
    const settleThenDone = (n) => {
      if (stale()) return;
      const missing = clientsMissingUursoortEntries(handled);
      if (missing.length) {
        step();
        return;
      }
      const needed = 1;
      if (n >= needed) {
        done();
        return;
      }
      showLoadingState("Controleren...");
      const wait = findClientEntries().length <= 1 ? 130 : 320;
      setTimeout(() => settleThenDone(n + 1), wait);
    };
    const step = () => {
      if (stale()) return;
      if (++guard > 300) {
        done();
        return;
      }
      const missing = clientsMissingUursoortEntries(handled);
      if (!missing.length) {
        settleThenDone(0);
        return;
      }
      const entry = missing.find((e) => e.uursoortTrigger) || missing[0];
      if (!entry.uursoortTrigger) {
        const key = clean(entry.name);
        const n = (expandTries.get(key) || 0) + 1;
        expandTries.set(key, n);
        if (n > 25) {
          handled.add(key);
          setTimeout(step, 60);
          return;
        }
        showLoadingState(`Kaart openen voor ${entry.firstName}...`);
        if (entry.toggle && inviteeToggleExpanded(entry.toggle) === false) clickInviteeToggle(entry.toggle);
        else ensureClientExpanded(() => {
        });
        setTimeout(step, 200);
        return;
      }
      const ctx = { firstName: entry.firstName, name: entry.name, trigger: entry.uursoortTrigger };
      showLoadingState(`Uursoort laden voor ${ctx.firstName}...`);
      listUursoortOptions((opts) => {
        if (opts === null) {
          const nkey = clean(ctx.name);
          const nt = (nullTries.get(nkey) || 0) + 1;
          nullTries.set(nkey, nt);
          if (nt <= 8) {
            setTimeout(step, 200);
            return;
          }
          handled.add(nkey);
          setTimeout(step, 180);
          return;
        }
        showUursoort(opts, () => {
          handled.add(clean(ctx.name));
          setTimeout(step, 160);
        }, ctx);
      }, freshUursoortTriggerForContext(ctx) || ctx.trigger, 0, false, entry);
    };
    step();
  }
  function uursoortContextsForNames(names) {
    const wanted = new Set(names.map(clean));
    return findClientEntries().filter((entry) => wanted.has(clean(entry.name)) && entry.uursoortTrigger).map((entry) => ({ firstName: entry.firstName, name: entry.name, trigger: entry.uursoortTrigger }));
  }
  function startUursoortForNewClients(names, attempt = 0) {
    if (!appointmentFlow.pendingChoice || !appointmentFlow.pendingChoice.pickUursoort || appointmentFlow.autoSelectingNewClient) return;
    appointmentFlow.autoSelectingNewClient = true;
    ensureClientExpanded(() => {
      const contexts = uursoortContextsForNames(names);
      if (!contexts.length && attempt < 8) {
        appointmentFlow.autoSelectingNewClient = false;
        setTimeout(() => startUursoortForNewClients(names, attempt + 1), 220);
        return;
      }
      if (!contexts.length) {
        appointmentFlow.autoSelectingNewClient = false;
        setStatus("Nieuwe client gevonden | uursoortveld niet gevonden", false);
        return;
      }
      setStatus(`Uursoort kiezen voor ${contexts.map((ctx) => ctx.firstName).join(" - ")}...`);
      showUursoortQueue(contexts, 0, () => {
        appointmentFlow.autoSelectingNewClient = false;
        showChoices();
        setStatus("Uursoort voor nieuwe client gezet");
      });
    });
  }
  function handleClientListChanges() {
    const entries = findClientEntries();
    const currentNames = new Set(entries.map((e) => e.name));
    if (appointmentFlow.knownClientNames.size) {
      for (const name of appointmentFlow.knownClientNames) {
        if (!currentNames.has(name)) removeFirstNameFromTitle(firstNameFromName(name));
      }
    }
    if (!entries.length) {
      appointmentFlow.knownClientNames.clear();
      return;
    }
    maybePrefetchUursoorten();
    const firstSeed = !appointmentFlow.knownClientNames.size;
    const added = entries.filter((entry) => !appointmentFlow.knownClientNames.has(entry.name));
    appointmentFlow.knownClientNames = new Set(currentNames);
    if (firstSeed || !added.length) return;
    if (appointmentFlow.pendingChoice && appointmentFlow.pendingChoice.pickUursoort && !appointmentFlow.uursoortQueueActive && !appointmentFlow.appointmentFlowBusy) {
      setTitleForChoice(appointmentFlow.pendingChoice, () => {
      });
      const addedNames = added.map((e) => e.name).filter(Boolean);
      const state = computeAppointmentUursoortState();
      if (addedNames.length && (state === "MIXED" || state === "CHOICE")) {
        startUursoortForNewClients(addedNames);
      } else {
        ensureClientExpanded(() => showManualUursoortInstruction());
      }
    }
  }

  // src/content/features/appointment/ons-adapter.js
  var _onsGemist = /* @__PURE__ */ new Set();
  function _onsLees(naam, fn) {
    let waarde = null;
    try {
      waarde = fn();
    } catch (e) {
      waarde = null;
    }
    const leeg = waarde == null || waarde === "" || waarde === false || Array.isArray(waarde) && waarde.length === 0;
    if (leeg) _onsGemist.add(naam);
    else _onsGemist.delete(naam);
    return waarde;
  }
  function onsGemisteVelden() {
    return Array.from(_onsGemist);
  }
  function onsVergeetGemist() {
    _onsGemist.clear();
  }
  var OnsAdapter = {
    // Waar zijn we, en in welk scherm?
    context: {
      modal: () => _onsLees("afspraakvenster", findModal),
      heeftClient: () => hasClientInAppointment()
    },
    // De afspraak zelf.
    afspraak: {
      titelVeld: () => _onsLees("titel", getTitleInput),
      datumVeld: () => _onsLees("datum", getDateInput),
      begintijdVeld: () => _onsLees("begintijd", getStartTimeInput),
      eindtijdVeld: () => _onsLees("eindtijd", getEndTimeInput),
      labelVeld: () => _onsLees("label", getEtiketTrigger),
      herhalingVeld: () => _onsLees("herhaling", findRecurrenceField),
      reistijdVeld: (richting) => _onsLees("reistijd " + richting, () => appointmentTravelInput(richting)),
      titel() {
        const el = this.titelVeld();
        return el ? String(inputTextValue(el) || "").trim() : "";
      },
      eindtijd() {
        const el = this.eindtijdVeld();
        return el ? String(inputTextValue(el) || "").trim() : "";
      },
      labels() {
        try {
          return (labelChips(getEtiketTrigger()) || []).map((c) => String(c.name || "").trim()).filter(Boolean);
        } catch (e) {
          return [];
        }
      },
      reistijdTotaal: () => appointmentTravelTotalMinutes(),
      zetTitel: (tekst) => setAppointmentTitleText(tekst),
      zetLabel: (naam, klaar) => setLabel(naam, klaar),
      wisLabels: (klaar) => clearKnownLabels(klaar),
      zetReistijd: (minuten) => setAppointmentTravelTotalMinutes(minuten),
      wisReistijd: () => clearAppointmentTravelTimes(),
      wisTitel: () => clearTitle(),
      wisEindtijd: () => clearEndTime()
    },
    // De cliënten in de afspraak en hun uursoort — het veld waar het in de
    // praktijk het vaakst misgaat.
    clienten: {
      lijst: () => _onsLees("cliëntkaarten", findClientEntries),
      ververs: () => invalidateClientEntries(),
      klapUit: (klaar) => ensureClientExpanded(klaar),
      uursoort: (entry) => entryUursoortText(entry),
      heeftUursoort: (entry) => entryUursoortIsSet(entry),
      uursoortVeld: (entry) => entry ? entry.uursoortTrigger : null,
      zetUursoort: (tekst, klaar, trigger) => chooseUursoort(tekst, klaar, trigger),
      wisUursoorten: (klaar) => clearAllUursoorten(klaar)
    }
  };

  // src/content/platform/module-host.js
  function onsEnvironment() {
    try {
      return String(location.hostname.split(".")[0] || "");
    } catch (e) {
      return "";
    }
  }
  var context = { environment: onsEnvironment(), userId: "", url: location.href, ready: false };
  function trustedMessage(ev) {
    if (!ev) return false;
    if (ev.origin !== location.origin) return false;
    if (ev.source && ev.source !== window) return false;
    return true;
  }
  function listenForContext() {
    window.addEventListener("message", function(ev) {
      if (!trustedMessage(ev)) return;
      const d = ev && ev.data;
      if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.FROM_MAIN || d.type !== "context") return;
      context.environment = d.environment || context.environment;
      if (d.userId) context.userId = String(d.userId);
      context.url = d.url || location.href;
      context.ready = true;
    }, false);
  }
  function urlMatches(patterns, url) {
    if (!patterns || !patterns.length) return true;
    for (let i = 0; i < patterns.length; i++) {
      const rx = "^" + String(patterns[i]).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
      try {
        if (new RegExp(rx).test(url)) return true;
      } catch (e) {
      }
    }
    return false;
  }
  var CLIENT_HEADER_SELECTORS = [
    '[data-qa="client_header"]',
    '[data-qa="client-header"]',
    "uc-client-header",
    ".client-header",
    '[class*="client-header"]',
    '[class*="_client-header_"]'
  ];
  function isVisible(el) {
    if (!el) return false;
    try {
      const view = el.ownerDocument && el.ownerDocument.defaultView || window;
      const s = view.getComputedStyle(el);
      if (s && (s.display === "none" || s.visibility === "hidden" || s.opacity === "0")) return false;
    } catch (e) {
    }
    return true;
  }
  function clientHeaderVisible() {
    for (let i = 0; i < CLIENT_HEADER_SELECTORS.length; i++) {
      try {
        const el = document.querySelector(CLIENT_HEADER_SELECTORS[i]);
        if (el && isVisible(el)) return true;
      } catch (e) {
      }
    }
    return false;
  }
  var ROLLOUT = { enabled: false, groups: {} };
  function setRollout(cfg) {
    if (!cfg || typeof cfg !== "object") {
      ROLLOUT = { enabled: false, groups: {} };
      return;
    }
    ROLLOUT = { enabled: !!cfg.enabled, groups: cfg.groups && typeof cfg.groups === "object" ? cfg.groups : {} };
  }
  function userInGroup(userId, groupName) {
    const members = ROLLOUT.groups[groupName];
    if (!Array.isArray(members)) return false;
    const id = String(userId || "").trim().toLowerCase();
    if (!id) return false;
    return members.some(function(m) {
      return String(m || "").trim().toLowerCase() === id;
    });
  }
  function isAllowedUser(meta) {
    const tg = meta && meta.testGroup;
    if (!tg || !ROLLOUT.enabled) return true;
    const groups = Array.isArray(tg) ? tg : [tg];
    return groups.some(function(g) {
      return userInGroup(context.userId, g);
    });
  }
  var MESSAGES = {};
  var barEl = null;
  function messageIsEmpty(v) {
    if (v == null) return true;
    if (typeof v === "string") return v === "";
    if (typeof v === "object") return !(v.title && String(v.title).length) && !(Array.isArray(v.items) && v.items.length);
    return true;
  }
  function setMessage(id, value) {
    if (messageIsEmpty(value)) delete MESSAGES[id];
    else MESSAGES[id] = value;
  }
  function currentMessages() {
    return Object.keys(MESSAGES).map(function(k) {
      return { id: k, value: MESSAGES[k] };
    });
  }
  function messageApiFor(id) {
    return {
      setMessage: function(value) {
        setMessage(id, value);
      },
      clearMessage: function() {
        setMessage(id, "");
      }
    };
  }
  function buildBar() {
    const bar = document.createElement("div");
    bar.className = "onsah-meldingen";
    bar.setAttribute("data-ons-agendahulp", "meldingen");
    try {
      bar.setAttribute("popover", "manual");
    } catch (e) {
    }
    bar.style.cssText = 'position:fixed;top:auto;right:auto;bottom:16px;left:16px;margin:0;border:0;padding:0;background:transparent;z-index:2147483647;max-width:340px;max-height:none;overflow:visible;width:auto;display:flex;flex-direction:column;gap:8px;font:13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;pointer-events:none;';
    return bar;
  }
  function ensureBarOnTop() {
    if (!barEl) return;
    try {
      if (typeof barEl.showPopover === "function" && !barEl.matches(":popover-open")) barEl.showPopover();
    } catch (e) {
    }
  }
  function fillCard(card, value) {
    if (typeof value === "string") {
      card.appendChild(document.createTextNode(value));
      return;
    }
    if (value && typeof value === "object") {
      if (value.title) {
        const h = document.createElement("div");
        h.textContent = String(value.title);
        h.style.cssText = "font-weight:700;color:#9b1c1c;margin-bottom:3px;";
        card.appendChild(h);
      }
      if (Array.isArray(value.items) && value.items.length) {
        const ul = document.createElement("ul");
        ul.style.cssText = "margin:0;padding:0 0 0 16px;";
        value.items.forEach(function(it) {
          const li = document.createElement("li");
          li.textContent = String(it && it.text != null ? it.text : it);
          li.style.color = it && it.sev === "error" ? "#9b1c1c" : it && it.sev === "warn" ? "#7a5200" : "#222";
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }
    }
  }
  function renderMessages() {
    const items = currentMessages();
    if (!items.length) {
      if (barEl) {
        try {
          barEl.remove();
        } catch (e) {
        }
        barEl = null;
      }
      return;
    }
    const host = document.body || document.documentElement;
    if (!host) return;
    if (!barEl || !barEl.isConnected) {
      barEl = buildBar();
      host.appendChild(barEl);
    }
    ensureBarOnTop();
    barEl.textContent = "";
    items.forEach(function(item) {
      const card = document.createElement("div");
      card.className = "onsah-melding";
      card.setAttribute("data-melding", item.id);
      card.style.cssText = "pointer-events:auto;background:#fff;border:1px solid #cc087d;border-left:4px solid #cc087d;border-radius:10px;padding:9px 11px;color:#222;box-shadow:0 4px 16px rgba(0,0,0,.16);";
      fillCard(card, item.value);
      barEl.appendChild(card);
    });
  }
  var ModuleBase = {
    create: function(metadata, impl) {
      const meta = metadata || {};
      const id = meta.id || "module";
      return {
        id,
        meta,
        isActive: function() {
          if (meta.environments && meta.environments.length && meta.environments.indexOf(onsEnvironment()) === -1) return false;
          if (!urlMatches(meta.urls || meta.match, location.href)) return false;
          if (meta.requiresClientHeader && !clientHeaderVisible()) return false;
          if (!isAllowedUser(meta)) return false;
          return true;
        },
        run: function() {
          try {
            if (impl && impl.run) impl.run(context, messageApiFor(id));
          } catch (e) {
          }
        }
      };
    }
  };
  var REGISTRY = [];
  function register(mod) {
    REGISTRY.push(mod);
  }
  var ENGINE_INTERVAL_MS = 1e3;
  var started = false;
  function startModuleHost() {
    if (started || window.__onsAgendahulpModules) return;
    started = true;
    window.__onsAgendahulpModules = true;
    listenForContext();
    setInterval(function() {
      if (!document.hasFocus()) return;
      for (let i = 0; i < REGISTRY.length; i++) {
        const m = REGISTRY[i];
        try {
          if (m.isActive()) m.run();
          else setMessage(m.id, "");
        } catch (e) {
        }
      }
      try {
        renderMessages();
      } catch (e) {
      }
    }, ENGINE_INTERVAL_MS);
  }

  // src/content/features/quality.js
  function appointmentMissingHooks() {
    onsVergeetGemist();
    OnsAdapter.afspraak.labelVeld();
    OnsAdapter.afspraak.datumVeld();
    OnsAdapter.afspraak.begintijdVeld();
    return onsGemisteVelden();
  }
  function helperQualityIssues() {
    const out = [];
    try {
      if (helperPanel.activeMode === "events" && hasClientInAppointment()) {
        const miss = appointmentMissingHooks();
        if (miss.length) out.push({ sev: "error", msg: "Afspraakhulp herkent niet: " + miss.join(", ") + "." });
      }
      if (helperPanel.activeMode === "events" && appointmentFlow.appointmentDoorplannen && appointmentFlow.appointmentSaveScreenActive && !(APP_CONFIG.features && APP_CONFIG.features.doorplannenToggle === false) && !recurrenceIsSet()) {
        out.push({ sev: "warn", msg: doorplannenWarnText() });
      }
      if (helperPanel.activeMode === "registrations") {
        registrationCompletenessIssues().forEach((it) => out.push(it));
      }
    } catch (e) {
    }
    return out;
  }
  function highlightField(el, ms) {
    try {
      if (!el || el.nodeType !== 1) return;
      const prevOutline = el.style.outline, prevOffset = el.style.outlineOffset;
      el.style.outline = "2px solid #cc087d";
      el.style.outlineOffset = "2px";
      try {
        el.scrollIntoView({ block: "center", inline: "nearest" });
      } catch (e) {
      }
      setTimeout(() => {
        try {
          el.style.outline = prevOutline;
          el.style.outlineOffset = prevOffset;
        } catch (e) {
        }
      }, ms || 6e3);
    } catch (e) {
    }
  }
  function mkProblemBanner(missing) {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, { border: "1px solid #b3261e", background: "#fdecea", borderRadius: "8px", padding: "8px 10px", margin: "0 0 8px" });
    wrap.appendChild(mkText(
      "probleem_hulp_werkt_niet",
      "Let op: de afspraakhulp herkent een veld niet en werkt mogelijk niet volledig. Controleer de afspraak zelf en meld dit via 'Meld probleem' in de extensie.",
      { color: "#b3261e", fontWeight: "700", fontSize: "13px", lineHeight: "1.35" }
    ));
    const sub = document.createElement("div");
    Object.assign(sub.style, { marginTop: "4px", fontSize: "12px", color: "#b3261e" });
    if (missing && missing.length) sub.appendChild(document.createTextNode("Niet herkend: " + missing.join(", ") + ". "));
    const a = document.createElement("a");
    a.textContent = "Meld probleem";
    a.href = supportTopdeskUrl();
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    Object.assign(a.style, { color: "#b3261e", textDecoration: "underline", fontWeight: "700" });
    sub.appendChild(a);
    wrap.appendChild(sub);
    return wrap;
  }
  function registerQualityModule() {
    register(ModuleBase.create(
      { id: "kwaliteit", urls: ["https://*.onsagenda.nl/*", "https://*.ons-dossier.nl/*"] },
      { run: function(ctx, api) {
        let issues = [];
        try {
          if (helperPanel.helperEnabled) issues = helperQualityIssues();
        } catch (e) {
          issues = [];
        }
        if (!issues.length) {
          api.clearMessage();
          return;
        }
        const errs = issues.filter((i) => i.sev === "error").length;
        api.setMessage({
          title: errs ? "Controleer voor opslaan" : "Aandachtspunt",
          items: issues.map((i) => ({ text: i.msg, sev: i.sev }))
        });
      } }
    ));
  }

  // src/content/features/appointment/recurrence.js
  function doorplannenWarnText() {
    const c = resolveText("doorplannen_waarschuwing");
    return c && c.text || "Je gaf aan de afspraak te willen doorplannen, maar de herhaling staat nog op 'Niet'. Stel de herhaling in, of zet 'Afspraak doorplannen?' uit en sla op.";
  }
  function recurrenceValue() {
    const sel = findRecurrenceField();
    if (sel) {
      const combo = deepQueryAll('[role="combobox"]', sel)[0];
      if (combo) {
        const v = clean(combo.getAttribute("aria-description") || combo.textContent || "");
        if (v) return v;
      }
      const t = clean(sel.textContent || "");
      if (t) return t;
    }
    const head = findRecurrenceHeader();
    if (head) {
      let spans;
      try {
        spans = head.querySelectorAll("span");
      } catch (e) {
        spans = [];
      }
      if (spans.length >= 2) return clean(spans[spans.length - 1].textContent || "");
    }
    return "";
  }
  function recurrenceIsSet() {
    const v = recurrenceValue();
    return !!v && v !== "niet";
  }
  function recurrenceHeaderExpanded() {
    const h = findRecurrenceHeader();
    return !!(h && h.getAttribute("aria-expanded") === "true");
  }
  function clickRecurrenceHeader(head) {
    if (!head) return false;
    return clickUiButton(head) || clickElementCenter(head) || (clickOption(head), true);
  }
  function expandRecurrence() {
    const head = findRecurrenceHeader();
    if (head && head.getAttribute("aria-expanded") !== "true") clickRecurrenceHeader(head);
    pollFor(() => findRecurrenceField(), (field2) => {
      if (field2) {
        try {
          highlightField(field2, 5e3);
        } catch (e) {
        }
      }
    }, { timeout: 2e3, interval: 50 });
    return !!head;
  }
  function recurrenceCombo() {
    const field2 = findRecurrenceField();
    return field2 ? deepQueryAll('[role="combobox"]', field2)[0] || null : null;
  }
  function setRecurrenceToNiet(done) {
    if (!recurrenceIsSet()) {
      if (done) done(true);
      return;
    }
    const combo = recurrenceCombo();
    if (!combo) {
      if (done) done(false);
      return;
    }
    clickElementCenter(combo);
    pollFor(() => {
      const opts = deepQueryAll('[role="option"], uc-select-list li, [role="listbox"] li').filter((o) => visible(o) && !isOwnPopup(o));
      return opts.find((o) => clean(o.textContent) === "niet") || null;
    }, (opt) => {
      if (opt) clickElementCenter(opt);
      else {
        try {
          combo.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        } catch (e) {
        }
      }
      if (done) done(!!opt);
    }, { timeout: 2e3, interval: 50 });
  }
  function collapseRecurrence() {
    const finish = () => {
      const head = findRecurrenceHeader();
      if (head && head.getAttribute("aria-expanded") === "true") clickRecurrenceHeader(head);
    };
    if (!recurrenceIsSet()) {
      finish();
      return true;
    }
    setRecurrenceToNiet(() => {
      setTimeout(finish, 60);
    });
    return true;
  }
  function doorplannenBlocksSave() {
    return !(APP_CONFIG.features && APP_CONFIG.features.doorplannenToggle === false) && appointmentFlow.appointmentDoorplannen && !recurrenceIsSet();
  }

  // src/content/features/appointment/submit-guard.js
  function submitButtons() {
    const ov = overrideEl("afsOpslaan");
    if (ov) return [ov];
    return deepQueryAll('button[type="submit"], uc-button[type="submit"]').filter((btn) => visible(btn) && !isOwnPopup(btn));
  }
  function setSubmitBlocked(blocked) {
    for (const btn of submitButtons()) {
      const target = btn.shadowRoot ? btn.shadowRoot.querySelector('button[type="submit"], button') || btn : btn;
      try {
        btn.setAttribute("aria-disabled", blocked ? "true" : "false");
      } catch (e) {
      }
      try {
        target.setAttribute("aria-disabled", blocked ? "true" : "false");
      } catch (e) {
      }
      if (target instanceof HTMLButtonElement) target.disabled = blocked;
      if (btn instanceof HTMLButtonElement) btn.disabled = blocked;
      for (const el of [target, btn]) {
        if (el && el.style) {
          el.style.opacity = blocked ? "0.45" : "";
          el.style.cursor = blocked ? "not-allowed" : "";
          el.style.pointerEvents = blocked ? "auto" : "";
        }
      }
    }
  }
  function updateSubmitGuard() {
    if (appointmentFlow.appointmentFreeDay) {
      setSubmitBlocked(false);
      return;
    }
    if (appointmentFlow.activeNonClientOption && appointmentFlow.activeNonClientOption.freeTitle) {
      setSubmitBlocked(!nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption) || doorplannenBlocksSave());
      return;
    }
    const missing = appointmentFlow.activeNonClientOption ? !nonClientUursoortSet() : !hasUursoortSelected();
    setSubmitBlocked(shouldRequireUursoortForSubmit() && missing || appointmentLabelRequiredButMissing() || doorplannenBlocksSave());
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
    if (!helperPanel.helperEnabled) return;
    if (appointmentFlow.appointmentFreeDay) return;
    if (isOwnPopup(e.target)) return;
    if (e.type === "click" && !isSubmitButtonNode(e.target)) return;
    const doorplannenBlock = doorplannenBlocksSave();
    if (appointmentFlow.activeNonClientOption && appointmentFlow.activeNonClientOption.freeTitle) {
      if (nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption) && !doorplannenBlock) {
        updateSubmitGuard();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      updateSubmitGuard();
      if (!nonClientFreeTitleComplete(appointmentFlow.activeNonClientOption)) setStatus("Vul eerst de titel aan.", false);
      else {
        setStatus("Stel de herhaling in of zet doorplannen uit", false);
        try {
          highlightField(findRecurrenceField() || findRecurrenceHeader(), 5e3);
        } catch (e2) {
        }
      }
      return;
    }
    const uursoortOk = !shouldRequireUursoortForSubmit() || (appointmentFlow.activeNonClientOption ? nonClientUursoortSet() : hasUursoortSelected());
    const labelMissing = appointmentLabelRequiredButMissing();
    if (uursoortOk && !labelMissing && !doorplannenBlock) {
      updateSubmitGuard();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    updateSubmitGuard();
    if (labelMissing) setStatus("Voeg eerst een label aan de afspraak toe.", false);
    else if (!uursoortOk) setStatus(appointmentFlow.activeNonClientOption ? "Voeg nog een uursoort toe." : "Voeg eerst bij elke client een uursoort toe.", false);
    else {
      setStatus("Stel de herhaling in of zet doorplannen uit", false);
      try {
        highlightField(findRecurrenceField() || findRecurrenceHeader(), 5e3);
      } catch (e2) {
      }
    }
  }

  // src/content/features/appointment/non-client.js
  function findNonClientUursoortTrigger() {
    const modal = findModal() || document;
    const modalBox = modal && modal.getBoundingClientRect ? rect(modal) : { left: 0, width: window.innerWidth || document.documentElement.clientWidth || 1200 };
    const detailsHead = deepQueryAll("h1,h2,h3,div,span,p", modal).find(function(el) {
      return visible(el) && !isOwnPopup(el) && clean(el.textContent || "") === "afspraakdetails";
    });
    const detailsLeft = detailsHead ? rect(detailsHead).left : modalBox.left + modalBox.width * 0.45;
    const rightSide = function(el) {
      const r = rect(el);
      if (r.width <= 0 || r.height <= 0) return false;
      if (r.left < detailsLeft - 100) return false;
      let n = el.parentElement;
      for (let depth = 0; n && depth < 7; depth++, n = n.parentElement) {
        const txt = clean(n.textContent || "");
        if (txt.includes("genodigden") || txt.includes("clienten zijn aanwezig") || txt.includes("verwijder uit selectie")) return false;
        if (txt.includes("afspraakdetails")) return true;
      }
      return true;
    };
    const direct = deepQueryAll('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"]', modal).filter(function(el) {
      return visible(el) && !isOwnPopup(el) && rightSide(el);
    }).sort(function(a, b) {
      return rect(a).top - rect(b).top;
    })[0];
    if (direct) {
      return direct;
    }
    const labels = deepQueryAll("label,div,span,p", modal).filter(function(el) {
      return visible(el) && !isOwnPopup(el) && clean(el.textContent || "") === "uursoort";
    }).filter(function(label) {
      const lr = rect(label);
      if (lr.left < detailsLeft - 80) return false;
      let n = label.parentElement;
      for (let depth = 0; n && depth < 7; depth++, n = n.parentElement) {
        const txt = clean(n.textContent || "");
        if (txt.includes("genodigden") || txt.includes("clienten zijn aanwezig") || txt.includes("verwijder uit selectie")) return false;
        if (txt.includes("afspraakdetails")) return true;
      }
      return true;
    });
    for (const label of labels) {
      const lr = rect(label);
      const candidates = deepQueryAll('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], [data-qa="hour_type_select"], [role="combobox"],select,button,div,span,input', modal);
      let best = null, bestScore = Infinity;
      for (const el of candidates) {
        if (!visible(el) || isOwnPopup(el) || el === label) continue;
        const meta = clean((uiText(el) || "") + " " + (el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("data-qa") || "") || ""));
        if (/reistijd|locatie|labels|notities|titel|begintijd|eindtijd/.test(meta)) continue;
        const r = rect(el);
        if (r.width < 150 || r.height < 22 || r.height > 90) continue;
        if (r.top < lr.bottom - 8 || r.top > lr.bottom + 100) continue;
        if (Math.abs(r.left - lr.left) > 280) continue;
        const textBonus = /zoek naar uursoorten|uursoort/.test(meta) ? -500 : 0;
        const hostBonus = /^UC-SELECT$/i.test(el.tagName || "") ? -700 : 0;
        const score = textBonus + hostBonus + (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
        if (score < bestScore) {
          best = el;
          bestScore = score;
        }
      }
      if (best) {
        const nested = best.querySelector && best.querySelector('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], [data-qa="hour_type_select"], [aria-label="Uursoort"]');
        return nested || best;
      }
    }
    return null;
  }
  function clearNonClientUursoort(onDone) {
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger || !nonClientUursoortValueText()) {
      if (onDone) onDone();
      return;
    }
    const clicked = clickLabelChipRemovers(trigger, []);
    if (clicked) {
      setTimeout(function() {
        if (onDone) onDone();
      }, 220);
      return;
    }
    clearUursoort(function() {
      if (onDone) onDone();
    }, trigger);
  }
  function clearNonClientSettings() {
    appointmentFlow.appointmentClearingSettings = true;
    setStatus("Instellingen verwijderen...");
    let finished = false;
    const finish = function(ok, text) {
      if (finished) return;
      finished = true;
      clearTimeout(guard);
      appointmentFlow.activeNonClientOption = null;
      appointmentFlow.appointmentClearingSettings = false;
      showAppointmentNeedsPrereqs();
      setStatus(text || "Instellingen verwijderd", ok !== false);
    };
    const guard = setTimeout(function() {
      finish(false, "Instellingen grotendeels verwijderd");
    }, 5500);
    try {
      appointmentFlow.appointmentTimeGuardTimers.forEach(function(t) {
        clearTimeout(t);
      });
      appointmentFlow.appointmentTimeGuardTimers = [];
      appointmentFlow.activeAppointmentDurationMinutes = null;
      clearTitle();
      clearEndTime();
      clearAppointmentTravelTimes();
      clearKnownLabels(function() {
        try {
          clearNonClientUursoort(function() {
            finish(true, "Instellingen verwijderd");
          });
        } catch (e) {
          finish(false, "Instellingen deels verwijderd");
        }
      });
    } catch (e) {
      finish(false, "Instellingen deels verwijderd");
    }
  }
  var nonClientInfoOverlay = null;
  function closeNonClientOptionInfo() {
    if (nonClientInfoOverlay && nonClientInfoOverlay.parentNode) nonClientInfoOverlay.parentNode.removeChild(nonClientInfoOverlay);
    nonClientInfoOverlay = null;
  }
  function showNonClientOptionInfo(opt) {
    closeNonClientOptionInfo();
    const host = helperPanel.popupEl && helperPanel.popupEl.parentNode || document.body;
    const r = helperPanel.popupEl ? rect(helperPanel.popupEl) : { left: 24, top: 74, width: 280, height: 200 };
    const box = document.createElement("div");
    nonClientInfoOverlay = box;
    Object.assign(box.style, {
      position: "fixed",
      left: r.left + "px",
      top: r.top + "px",
      width: r.width + "px",
      zIndex: "2147483647",
      boxSizing: "border-box",
      background: "#fff",
      border: "2px solid #e91e8c",
      borderRadius: "12px",
      padding: "14px 16px",
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      boxShadow: "0 8px 28px rgba(0,0,0,0.35)"
    });
    const headRow = document.createElement("div");
    Object.assign(headRow.style, { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" });
    const title = document.createElement("div");
    title.textContent = opt.display;
    Object.assign(title.style, { fontWeight: "700", fontSize: "14px", color: "#e91e8c", flex: "1" });
    const closeX = document.createElement("button");
    closeX.textContent = "✕";
    Object.assign(closeX.style, {
      flexShrink: "0",
      width: "24px",
      height: "24px",
      padding: "0",
      lineHeight: "1",
      border: "none",
      background: "transparent",
      color: "#e91e8c",
      fontSize: "16px",
      cursor: "pointer"
    });
    closeX.title = "Sluiten";
    closeX.addEventListener("click", function(e) {
      e.stopPropagation();
      closeNonClientOptionInfo();
    });
    headRow.appendChild(title);
    headRow.appendChild(closeX);
    box.appendChild(headRow);
    const text = document.createElement("div");
    text.textContent = opt.info || "";
    Object.assign(text.style, { fontSize: "13px", color: "#333", lineHeight: "1.5" });
    box.appendChild(text);
    try {
      host.appendChild(box);
    } catch (e) {
      document.body.appendChild(box);
    }
  }
  function showNonClientCategory(cat) {
    const body = $body();
    if (!body) return;
    clearScreenMark();
    const _opts = cat.options || [];
    renderScreen(body, "category", {
      heading: cat.label,
      options: _opts.map(function(opt) {
        return { display: opt.display, info: !!opt.info };
      }),
      tokens: ONSAH_TOKENS,
      onBack: function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(showAppointmentNeedsPrereqs);
      },
      onPick: function(i) {
        safe(function() {
          handleNonClientOption(_opts[i]);
        });
      },
      onInfo: function(i) {
        safe(function() {
          showNonClientOptionInfo(_opts[i]);
        });
      }
    });
    setStatus("Kies een optie");
  }
  function applyNonClientEndTime(minutes) {
    appointmentFlow.activeAppointmentStartTimeText = appointmentCurrentStartTimeText();
    clearAppointmentTravelTimes();
    const ok = setAppointmentEndTimePlusMinutes(minutes);
    scheduleAppointmentEndTime(minutes);
    return ok;
  }
  function finishNonClientOption(opt) {
    setLabel("JG Overig", function() {
      setAppointmentTitleText(opt.display);
      scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
      setStatus(opt.display + " gezet");
      const tryShow = function() {
        if (appointmentFlow.activeNonClientOption !== opt) return false;
        enforceAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
        if (hasAppointmentDate() && hasAppointmentStartTime() && hasAppointmentEndTime()) {
          showAppointmentReadyToSave();
          return true;
        }
        return false;
      };
      [120, 350, 700, 1200].forEach(function(d) {
        setTimeout(function() {
          safe(tryShow);
        }, d);
      });
    });
  }
  function nonClientHourTypeMatches(text, wanted) {
    const c = clean(text);
    const w = clean(wanted);
    const loose = clean(String(wanted || "").replace(/[*#]+$/, ""));
    return !!c && (c === w || !!loose && c === loose || c.includes(w) || !!loose && c.includes(loose));
  }
  function nonClientUursoortChips(trigger) {
    if (!trigger) return [];
    const tr = rect(trigger);
    const found = [];
    const seen = /* @__PURE__ */ new Set();
    for (const el of deepQueryAll('div,span,button,[role="button"]')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const r = rect(el);
      if (r.bottom < tr.top - 24 || r.top > tr.bottom + 24 || r.left < tr.left - 60 || r.right > tr.right + 120) continue;
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      const c = clean(txt);
      if (!c || /^zoek naar|selecteer uursoort/.test(c) || invalidUursoortOption(txt)) continue;
      if (!seen.has(c)) {
        seen.add(c);
        found.push(txt);
      }
    }
    return found;
  }
  function nonClientUursoortValueText() {
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger) return "";
    const chips = nonClientUursoortChips(trigger);
    if (chips.length) return chips[0];
    const txt = clean(uiText(trigger) || trigger.textContent || ("value" in trigger ? trigger.value : "") || trigger.getAttribute && (trigger.getAttribute("title") || trigger.getAttribute("value")) || "");
    if (!txt || /^(zoek naar uursoorten|selecteer uursoort|uursoort|zoek naar uursoort)$/.test(txt)) return "";
    return txt;
  }
  function nonClientUursoortSet() {
    if (!appointmentFlow.activeNonClientOption) return false;
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger) return false;
    const wanted = appointmentFlow.activeNonClientOption.uursoort;
    const chips = nonClientUursoortChips(trigger);
    if (chips.some((chip) => nonClientHourTypeMatches(chip, wanted))) return true;
    const txt = clean(uiText(trigger) || trigger.textContent || ("value" in trigger ? trigger.value : "") || trigger.getAttribute && (trigger.getAttribute("title") || trigger.getAttribute("value")) || "");
    if (!txt || /^(zoek naar uursoorten|selecteer uursoort|uursoort|zoek naar uursoort)$/.test(txt)) return false;
    return nonClientHourTypeMatches(txt, wanted);
  }
  function nonClientFreeTitlePrefix(opt) {
    return (opt && opt.display ? opt.display : "Overig") + " - ";
  }
  function nonClientFreeTitleComplete(opt) {
    const inp = getTitleInputSafe();
    const val = inp ? inputTextValue(inp) : "";
    const trimmed = String(val || "").trim();
    if (!trimmed) return false;
    const prefixRe = new RegExp("^" + (opt && opt.display ? opt.display : "Overig").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*-\\s*", "i");
    if (!prefixRe.test(trimmed)) return false;
    const rest = trimmed.replace(prefixRe, "");
    return !!rest.trim();
  }
  function ensureNonClientFreeTitlePrefix(opt) {
    const prefix = nonClientFreeTitlePrefix(opt);
    const inp = getTitleInputSafe();
    if (!inp) return;
    const prefixRe = new RegExp("^" + (opt && opt.display ? opt.display : "Overig").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*-\\s*", "i");
    const current = String(inputTextValue(inp) || "").trim();
    const rest = current.replace(prefixRe, "");
    setAppointmentTitleText(prefix + rest);
    setTimeout(function() {
      const i = getTitleInputSafe();
      if (i && i.focus) {
        try {
          i.focus();
        } catch (e) {
        }
      }
      updateSubmitGuard();
    }, 0);
  }
  function handleNonClientOption(opt) {
    setStatus("Bezig...");
    appointmentFlow.activeNonClientOption = opt;
    appointmentFlow.nonClientFreeTitleScreenActive = false;
    appointmentFlow.nonClientNoUursoortActive = false;
    appointmentFlow.nonClientBusy = true;
    setAppointmentTitleText(opt.display);
    if (opt.etiket) {
      try {
        selectLabel(opt.etiket, function() {
        });
      } catch (e) {
      }
    }
    if (opt.freeTitle) {
      appointmentFlow.nonClientBusy = false;
      if (!hasAppointmentEndTime()) {
        showNonClientDurationSelection(opt);
        return;
      }
      appointmentFlow.activeAppointmentDurationMinutes = null;
      appointmentFlow.appointmentTimeGuardTimers.forEach(function(t) {
        clearTimeout(t);
      });
      appointmentFlow.appointmentTimeGuardTimers = [];
      showNonClientFreeTitlePrompt(opt);
      return;
    }
    if (opt.fixedHalfHour) {
      const endOk = applyNonClientEndTime(gsNum("pauseFixedMin", 30));
      setStatus(endOk ? opt.display + " 30 min" : "Eindtijd niet gezet", endOk);
      setTimeout(function() {
        safe(function() {
          setNonClientUursoortThenFinish(opt);
          scheduleAppointmentEndTime(30);
          [120, 350, 650].forEach(function(d) {
            setTimeout(function() {
              safe(function() {
                enforceAppointmentEndTime(30);
              });
            }, d);
          });
        });
      }, 80);
      return;
    }
    if (opt.defaultDuration > 0 && !hasAppointmentEndTime()) {
      const dd = opt.defaultDuration;
      const endOk = applyNonClientEndTime(dd);
      setStatus(endOk ? opt.display + " " + dd + " min" : "Eindtijd niet gezet", endOk);
      setTimeout(function() {
        safe(function() {
          setNonClientUursoortThenFinish(opt);
          scheduleAppointmentEndTime(dd);
          [120, 350, 650].forEach(function(d) {
            setTimeout(function() {
              safe(function() {
                enforceAppointmentEndTime(dd);
              });
            }, d);
          });
        });
      }, 80);
      return;
    }
    if (!hasAppointmentEndTime()) {
      appointmentFlow.nonClientBusy = false;
      showNonClientDurationSelection(opt);
      return;
    }
    appointmentFlow.activeAppointmentDurationMinutes = null;
    appointmentFlow.appointmentTimeGuardTimers.forEach(function(t) {
      clearTimeout(t);
    });
    appointmentFlow.appointmentTimeGuardTimers = [];
    setNonClientUursoortThenFinish(opt);
  }
  function setNonClientUursoortThenFinish(opt) {
    if (nonClientUursoortSet()) {
      appointmentFlow.nonClientBusy = false;
      appointmentFlow.nonClientNoUursoortActive = false;
      finishNonClientOption(opt);
      return;
    }
    setStatus("Uursoort instellen...");
    setAppointmentUursoortByName(opt.uursoort, function(uursoortOk) {
      appointmentFlow.nonClientBusy = false;
      scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
      if (!uursoortOk && !nonClientUursoortSet()) {
        showNonClientNoUursoort(opt);
        return;
      }
      appointmentFlow.nonClientNoUursoortActive = false;
      finishNonClientOption(opt);
    });
  }
  function showNonClientNoUursoort(opt) {
    const body = $body();
    if (!body) return;
    clearScreenMark();
    appointmentFlow.nonClientBusy = false;
    appointmentFlow.nonClientNoUursoortActive = true;
    renderScreen(body, "messageScreen", {
      title: "Geen uursoorten gevonden!",
      titleStyle: { color: "#b3261e" },
      body: "Controleer zelf of er uursoorten in de lijst staan en neem contact op met EPD.",
      actionLabel: "Afsluiten",
      tokens: ONSAH_TOKENS,
      onBack: function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(function() {
          appointmentFlow.nonClientNoUursoortActive = false;
          showAppointmentNeedsPrereqs();
        });
      },
      onAction: function() {
        safe(closeOnsModal);
      }
    });
    setStatus("Geen uursoorten gevonden", false);
  }
  function showNonClientDurationSelection(opt) {
    const body = $body();
    if (!body) return;
    markScreen("nonClientDurationSelection", { opt });
    const durStep = opt.durationStep > 0 ? opt.durationStep : gsNum("durationStepMin", 15);
    const durMax = opt.maxDuration > 0 ? opt.maxDuration : gsNum("appointmentMaxMin", 480);
    const durValues = [];
    for (let m = durStep; m <= durMax; m += durStep) durValues.push(m);
    renderScreen(body, "duration", {
      title: opt.display + " duur:",
      tokens: ONSAH_TOKENS,
      onBack: function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(showAppointmentNeedsPrereqs);
      },
      pickerNode: mkDurationPicker(durValues, function(m) {
        return safe(function() {
          const endOk = applyNonClientEndTime(m);
          setAppointmentTitleText(opt.display);
          setStatus(endOk ? opt.display + " " + registrationDurationLabel(m) : "Eindtijd niet gezet", endOk);
          setTimeout(function() {
            safe(function() {
              if (opt.freeTitle) showNonClientFreeTitlePrompt(opt);
              else setNonClientUursoortThenFinish(opt);
              scheduleAppointmentEndTime(m);
              [100, 300].forEach(function(d) {
                setTimeout(function() {
                  safe(function() {
                    enforceAppointmentEndTime(m);
                  });
                }, d);
              });
            });
          }, 50);
        });
      }, opt.pickerStyle, void 0, durationLabelStyle("duur"))
    });
    setStatus("Kies de duur");
  }
  function showNonClientFreeTitlePrompt(opt) {
    const body = $body();
    if (!body) return;
    appointmentFlow.nonClientBusy = false;
    appointmentFlow.nonClientFreeTitleScreenActive = true;
    markScreen("nonClientFreeTitlePrompt", { opt });
    const prefix = nonClientFreeTitlePrefix(opt);
    setLabel("JG Overig", function() {
      const inp = getTitleInputSafe();
      const cur = inp ? clean(inputTextValue(inp)) : "";
      if (!cur || cur === clean(opt.display) || cur === clean(prefix)) setAppointmentTitleText(prefix);
      scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
    });
    renderScreen(body, "messageScreen", {
      title: 'Vul de titel aan na "' + prefix + '".',
      titleStyle: { fontSize: 13, margin: "4px 0 2px", color: "#333" },
      body: "Zodra je een titel hebt ingevuld, kun je opslaan.",
      bodyStyle: { fontSize: 12, color: "#666", lineHeight: 1.35, margin: "0 0 8px" },
      actionLabel: "Zet titel",
      actionAccent: "#1a7f37",
      actionAccentWash: "#eaf6ee",
      actionChevron: false,
      tokens: ONSAH_TOKENS,
      onBack: function() {
        helperPanel.suppressAutoUntil = Date.now() + 1200;
        safe(function() {
          appointmentFlow.nonClientFreeTitleScreenActive = false;
          showAppointmentNeedsPrereqs();
        });
      },
      onAction: function() {
        safe(function() {
          ensureNonClientFreeTitlePrefix(opt);
        });
      }
    });
    updateSubmitGuard();
    if (nonClientFreeTitleComplete(opt)) {
      appointmentFlow.nonClientFreeTitleScreenActive = false;
      showAppointmentReadyToSave();
      return;
    }
    setStatus("Vul de titel aan", false);
  }

  // src/content/features/appointment/uursoort-field.js
  function setAppointmentUursoortByName(name, onDone) {
    const done = typeof onDone === "function" ? onDone : function() {
    };
    selectNonClientUursoort(name, done);
  }
  function selectNonClientUursoort(text, onResult, attempt = 0) {
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger) {
      onResult(false);
      return;
    }
    clickElementCenter(trigger);
    setTimeout(() => {
      const searchText = String(text || "").replace(/[*#]+$/, "").trim();
      const input2 = searchInputForTrigger(trigger);
      if (input2) {
        input2.focus();
        setInputText(input2, searchText);
      }
      const loose = searchText;
      setTimeout(() => {
        const ok = clickExactDropdownOption(trigger, [text, loose].filter(Boolean));
        if (!ok && attempt < 5) {
          clickEmptyModalSpot();
          setTimeout(() => selectNonClientUursoort(text, onResult, attempt + 1), 120);
          return;
        }
        setTimeout(() => {
          clickEmptyModalSpot();
          onResult(!!ok);
        }, 50);
      }, input2 ? 220 : 130);
    }, 90);
  }
  function hasUursoortSelected() {
    const hasTriggerValue = (trigger2) => {
      if (!trigger2) return false;
      const txt = clean(uiText(trigger2) || trigger2.textContent || trigger2.value || trigger2.getAttribute && (trigger2.getAttribute("value") || trigger2.getAttribute("title") || ""));
      return !!txt && !/zoek naar uursoorten|selecteer uursoort|uursoort|geen resultaten|voer minstens|toont /.test(txt);
    };
    const entries = findClientEntries();
    if (entries.length) return computeAppointmentUursoortState() === "READY_TO_SAVE";
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (hasTriggerValue(trigger)) return true;
    const clientLabels = deepQueryAll("div,span,p").filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === "client");
    for (const label of clientLabels) {
      const lr = rect(label);
      for (const el of deepQueryAll("div,span,p")) {
        if (!visible(el) || isOwnPopup(el) || el === label) continue;
        const txt = clean(el.textContent || "");
        if (!txt || txt === "client" || txt.includes("clienten") || txt.includes("medewerker") || txt.includes("niet beschikbaar")) continue;
        if (txt.includes("uursoort") || txt.includes("toeslag") || txt.includes("verwijder uit selectie")) continue;
        const r = rect(el);
        if (r.top < lr.bottom - 4 || r.top > lr.bottom + 55) continue;
        if (Math.abs(r.left - lr.left) > 100) continue;
        if (txt.includes("ggz") || txt.includes("#")) return true;
      }
    }
    return false;
  }
  function shouldRequireUursoortForSubmit() {
    return !!appointmentFlow.activeNonClientOption || findClientEntries().length > 0;
  }
  function selectedUursoortOptionEls(openedBy, trigger) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const consider = (o) => {
      if (!o || seen.has(o) || !visible(o) || isOwnPopup(o)) return;
      const isSel = /true/i.test(o.getAttribute("aria-selected") || "") || /(^|\s)(selected|active|checked)(\s|$)/i.test(o.className || "");
      if (!isSel) return;
      const t = clean(optionText(o));
      if (!t || /toont |zoekterm|zoek naar|geen resultaten/.test(t)) return;
      seen.add(o);
      out.push(o);
    };
    for (const root of optionSearchRoots(openedBy).concat(optionSearchRoots(trigger))) {
      for (const o of deepQueryAll('[role="option"], li[aria-selected], li.selected', root)) consider(o);
    }
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
      const inp = deepQueryAll("input,textarea", root).find((i) => visible(i) && !isOwnPopup(i));
      if (inp) {
        try {
          inp.focus();
        } catch (e) {
        }
        setInputText(inp, "");
        return true;
      }
    }
    return false;
  }
  function clearUursoort(onDone, triggerArg = null) {
    const trigger = triggerArg || getUursoortTrigger();
    if (!trigger) {
      if (onDone) onDone();
      return;
    }
    const currentText = clean(uiText(trigger));
    const openedBy = openSelectCombobox(trigger) || trigger;
    setTimeout(() => {
      let clicked = false;
      const selectedEls = selectedUursoortOptionEls(openedBy, trigger);
      if (selectedEls.length) {
        clickOption(selectedEls[0]);
        clicked = true;
      }
      if (!clicked) {
        for (const root of optionSearchRoots(openedBy).concat(optionSearchRoots(trigger))) {
          const options = optionCandidates(root);
          const sameText = options.find((o) => currentText && clean(optionText(o)) && currentText.includes(clean(optionText(o))));
          if (sameText) {
            clickOption(sameText);
            clicked = true;
            break;
          }
        }
      }
      if (!clicked) {
        clearSelectField(trigger, 5);
      }
      setTimeout(() => {
        clearUursoortSearchInput(openedBy, trigger);
        setTimeout(() => {
          clickEmptyModalSpot();
          if (onDone) onDone();
        }, 80);
      }, 90);
    }, 120);
  }
  function chooseUursoort(text, onResult, triggerArg = null) {
    openTypePick(() => triggerArg || getUursoortTrigger(), text, (ok) => {
      if (ok) setTimeout(clickEmptyModalSpot, 90);
      onResult(ok);
    });
  }
  function anyUursoortPresent() {
    const entries = findClientEntries();
    if (entries.length) return entries.some(entryUursoortIsSet);
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger) return false;
    const txt = clean(uiText(trigger) || trigger.textContent || ("value" in trigger ? trigger.value : "") || "");
    return !!txt && !/zoek naar uursoorten|selecteer uursoort|uursoort|geen resultaten|voer minstens|toont /.test(txt);
  }

  // src/content/features/appointment/fields.js
  function setAppointmentTitleText(text) {
    const input2 = getTitleInputSafe();
    if (!input2) return false;
    setInputText(input2, text);
    return true;
  }
  function setAppointmentEndInputText(inp, text) {
    if (!inp) return false;
    const startInput = getStartTimeInput();
    if (startInput && inp === startInput) return false;
    typeIntoSearchField(inp, text);
    inp.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    try {
      inp.blur && inp.blur();
    } catch (e) {
    }
    const host = ucTimeInputHost(inp);
    if (host) {
      try {
        host.value = text;
      } catch (e) {
      }
      try {
        host.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(text) }));
      } catch (e) {
      }
      host.dispatchEvent(new Event("change", { bubbles: true }));
    }
    appointmentFlow.helperEndText = String(text);
    return true;
  }
  function hasAppointmentDate() {
    const dateInput = getDateInput();
    if (dateInput && /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(String(dateInput.value || dateInput.getAttribute("value") || dateInput.textContent || "").trim())) return true;
    return deepQueryAll("input,span,div,uc-date-input").some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const meta = clean(`${el.id || ""} ${el.getAttribute && (el.getAttribute("name") || "")} ${el.getAttribute && (el.getAttribute("aria-label") || "")} ${el.getAttribute && (el.getAttribute("placeholder") || "")}`);
      const text = String(("value" in el ? el.value : "") || el.getAttribute && el.getAttribute("value") || el.textContent || "").trim();
      if (!/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(text)) return false;
      return /datum|date|dd-mm-jjjj/.test(meta) || rect(el).width < 260;
    });
  }
  function hasAppointmentStartTime() {
    const startInput = getStartTimeInput();
    if (startInput && /^(\d{1,2}):(\d{2})$/.test(String(startInput.value || startInput.getAttribute("value") || startInput.textContent || "").trim())) return true;
    return !!appointmentStartTimeTextFromUi();
  }
  function appointmentStartTimeTextFromUi() {
    const labels = deepQueryAll("label,div,span,p").filter((el) => visible(el) && !isOwnPopup(el) && /^begintijd\*?$/.test(clean(el.textContent || "")));
    for (const label of labels) {
      const lr = rect(label);
      const found = deepQueryAll("input,span,div,uc-time-input").find((el) => {
        if (!visible(el) || isOwnPopup(el) || el === label) return false;
        const text = String(("value" in el ? el.value : "") || el.getAttribute && el.getAttribute("value") || el.textContent || "").trim();
        if (!/^(\d{1,2}):(\d{2})$/.test(text)) return false;
        const r = rect(el);
        return r.top >= lr.bottom - 12 && r.top <= lr.bottom + 95 && Math.abs(r.left - lr.left) <= 180;
      });
      if (found) return String(("value" in found ? found.value : "") || found.getAttribute && found.getAttribute("value") || found.textContent || "").trim();
    }
    return "";
  }
  function appointmentCurrentStartTimeText() {
    const startInput = getStartTimeInput();
    return String(startInput && (startInput.value || startInput.getAttribute("value")) || appointmentStartTimeTextFromUi() || "").trim();
  }
  function restoreAppointmentStartTime() {
    return false;
  }
  function hasAppointmentPrereqs() {
    return hasClientInAppointment() && hasAppointmentDate() && hasAppointmentStartTime();
  }
  function hasAppointmentEndTime() {
    const endInput = getEndTimeInput();
    const text = String((endInput && "value" in endInput ? endInput.value : "") || "").trim();
    return /^(\d{1,2}):(\d{2})$/.test(text);
  }
  function appointmentHasKnownLabel() {
    const trigger = getEtiketTrigger();
    if (!trigger) return false;
    const selected = selectedKnownLabels(trigger, allKnownLabels());
    if (selected.length) return true;
    const txt = clean(uiText(trigger) || trigger.textContent || "");
    return allKnownLabels().some((lbl) => txt.includes(clean(lbl)));
  }
  function appointmentReadyToSave() {
    return hasAppointmentPrereqs() && hasAppointmentEndTime() && hasUursoortSelected() && appointmentHasKnownLabel();
  }
  function appointmentCoreApplied() {
    return hasAppointmentPrereqs() && hasUursoortSelected() && appointmentHasKnownLabel();
  }
  function appointmentSaveStageStillValid() {
    if (appointmentReadyToSave() || appointmentCoreApplied()) return true;
    if (appointmentFlow.activeNonClientOption && !hasClientInAppointment() && hasAppointmentDate() && hasAppointmentStartTime()) return true;
    return false;
  }
  function appointmentLabelRequiredButMissing() {
    if (appointmentFlow.activeNonClientOption) return false;
    if (findClientEntries().length === 0) return false;
    if (!getEtiketTrigger()) return false;
    return !appointmentHasKnownLabel();
  }
  function clearTitle() {
    const input2 = getTitleInput();
    if (!input2) return false;
    try {
      input2.focus();
    } catch (e) {
    }
    try {
      input2.select && input2.select();
    } catch (e) {
    }
    setInputTextComposed(input2, "");
    input2.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Delete", code: "Delete" }));
    input2.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: "Delete", code: "Delete" }));
    setTimeout(() => {
      if ((input2.value || "") !== "") setInputTextComposed(input2, "");
      try {
        input2.blur && input2.blur();
      } catch (e) {
      }
    }, 60);
    return true;
  }
  function onAppointmentInput(e) {
    if (!helperPanel.helperEnabled) return;
    if (helperPanel.activeMode === "registrations" || isOwnPopup(e.target)) return;
    refreshAppointmentPrereqScreen();
    updateSubmitGuard();
  }

  // src/content/features/appointment/end-time.js
  function clearEndTime() {
    const input2 = getEndTimeInput();
    if (!input2) return false;
    setInputTextComposed(input2, "");
    return true;
  }
  function setAppointmentEndTimePlusMinutes(minutes) {
    const startText = String(appointmentCurrentStartTimeText() || appointmentFlow.activeAppointmentStartTimeText || "").trim();
    if (!/^(\d{1,2}):(\d{2})$/.test(startText)) return false;
    appointmentFlow.activeAppointmentStartTimeText = startText;
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
    if (appointmentFlow.appointmentEndTimeUserOwned) return false;
    const fresh = appointmentCurrentStartTimeText();
    if (fresh) appointmentFlow.activeAppointmentStartTimeText = fresh;
    const startText = String(appointmentFlow.activeAppointmentStartTimeText || "").trim();
    if (!/^(\d{1,2}):(\d{2})$/.test(startText)) return false;
    restoreAppointmentStartTime();
    const wanted = addMinutesText(startText, minutes);
    const endInput = getEndTimeInput();
    if (!wanted || !endInput) return false;
    const current = inputTextValue(endInput);
    if (appointmentFlow.helperEndText && /^(\d{1,2}):(\d{2})$/.test(current) && current !== appointmentFlow.helperEndText) {
      appointmentFlow.appointmentEndTimeUserOwned = true;
      return false;
    }
    if (current !== wanted) setAppointmentEndInputText(endInput, wanted);
    else appointmentFlow.helperEndText = wanted;
    return true;
  }
  function scheduleAppointmentEndTime(minutes) {
    appointmentFlow.activeAppointmentDurationMinutes = minutes || appointmentFlow.activeAppointmentDurationMinutes;
    if (!appointmentFlow.activeAppointmentDurationMinutes) return;
    appointmentFlow.appointmentTimeGuardTimers.forEach((timer) => clearTimeout(timer));
    appointmentFlow.appointmentTimeGuardTimers = [];
    [0, 140, 420].forEach((delay) => {
      const timer = setTimeout(() => safe(() => {
        restoreAppointmentStartTime();
        enforceAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
      }), delay);
      appointmentFlow.appointmentTimeGuardTimers.push(timer);
    });
  }

  // src/content/features/appointment/prefill.js
  var KEY2 = PAGE_SESSION.PENDING_APPOINTMENT;
  var GELDIG_MS = 2 * 60 * 1e3;
  function storePendingAppointment(req) {
    const minutes = parseInt(req.minutes, 10);
    try {
      sessionStorage.setItem(KEY2, JSON.stringify({ date: req.date, time: req.time, minutes: minutes > 0 ? minutes : null, ts: Date.now() }));
    } catch (e) {
    }
  }
  var _geplandeDuur = null;
  function plannedAppointmentMinutes() {
    if (!_geplandeDuur) return null;
    if (!/\/events\/new(?:[/?#]|$)/.test(location.pathname + location.search)) {
      _geplandeDuur = null;
      return null;
    }
    return _geplandeDuur;
  }
  function readPending() {
    try {
      const p = JSON.parse(sessionStorage.getItem(KEY2) || "null");
      if (!p || !p.date || !p.time || Date.now() - p.ts > GELDIG_MS) return null;
      return p;
    } catch (e) {
      return null;
    }
  }
  function clearPending() {
    try {
      sessionStorage.removeItem(KEY2);
    } catch (e) {
    }
  }
  function onsDateText(ymd2) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd2 || ""));
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "";
  }
  function schrijf(inp, text) {
    typeIntoSearchField(inp, text);
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    inp.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    try {
      inp.blur && inp.blur();
    } catch (e) {
    }
    const root = inp.getRootNode && inp.getRootNode();
    const host = root && root.host;
    if (host) {
      try {
        host.value = text;
      } catch (e) {
      }
      try {
        host.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e) {
      }
    }
  }
  var _bezig = false;
  function applyPendingAppointment() {
    if (_bezig) return;
    const p = readPending();
    if (!p) return;
    _bezig = true;
    _geplandeDuur = p.minutes > 0 ? p.minutes : null;
    const datum = onsDateText(p.date);
    let pogingen = 0;
    const tik = () => {
      pogingen++;
      const d = getDateInput(), s = getStartTimeInput();
      if (d && s) {
        if (datum && inputTextValue(d) !== datum) schrijf(d, datum);
        setTimeout(() => {
          const s2 = getStartTimeInput();
          if (s2 && inputTextValue(s2) !== p.time) schrijf(s2, p.time);
          clearPending();
          _bezig = false;
          if (p.minutes > 0) setTimeout(() => {
            try {
              setAppointmentEndTimePlusMinutes(p.minutes);
            } catch (e) {
            }
          }, 250);
        }, 250);
        return;
      }
      if (pogingen < 48) setTimeout(tik, 250);
      else {
        clearPending();
        _bezig = false;
      }
    };
    setTimeout(tik, 300);
  }

  // src/content/features/appointment/duplicate.js
  var KEY3 = PAGE_SESSION.PENDING_DUPLICATES;
  var GELDIG_MS2 = 30 * 60 * 1e3;
  var CREATE_URL = "/calendar/events";
  function storePendingDuplicates(moments, eigen) {
    try {
      moments = moments || [];
      eigen = eigen || [];
      if (!moments.length && !eigen.length) {
        sessionStorage.removeItem(KEY3);
        return;
      }
      sessionStorage.setItem(KEY3, JSON.stringify({ moments, eigen, ts: Date.now() }));
    } catch (e) {
    }
  }
  function takePending(pendingText) {
    try {
      const p = JSON.parse(pendingText || "null");
      sessionStorage.removeItem(KEY3);
      if (!p || !Array.isArray(p.moments) || Date.now() - p.ts > GELDIG_MS2) return null;
      return { moments: p.moments, eigen: Array.isArray(p.eigen) ? p.eigen : [] };
    } catch (e) {
      return null;
    }
  }
  function forgetStaleDuplicates() {
    try {
      if (/\/events\/new(?:[/?#]|$)/.test(location.pathname + location.search)) return;
      const p = JSON.parse(sessionStorage.getItem(KEY3) || "null");
      if (p && Date.now() - p.ts > 1e4) sessionStorage.removeItem(KEY3);
    } catch (e) {
    }
  }
  var DAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  var MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  function momentLabel(m) {
    const p = String(m.date).split("-");
    const d = new Date(+p[0], +p[1] - 1, +p[2]);
    const hm2 = ("0" + Math.floor(m.startMin / 60)).slice(-2) + ":" + ("0" + m.startMin % 60).slice(-2);
    return DAGEN[d.getDay()] + " " + d.getDate() + " " + MAANDEN[d.getMonth()] + " " + hm2;
  }
  function toonMelding(tekst, goed, metVerversen) {
    try {
      const oud = document.getElementById("onsah-kopie-melding");
      if (oud) oud.remove();
      const box = document.createElement("div");
      box.id = "onsah-kopie-melding";
      box.setAttribute("role", "status");
      Object.assign(box.style, {
        position: "fixed",
        left: "16px",
        bottom: "16px",
        zIndex: "2147483000",
        maxWidth: "360px",
        padding: "12px 14px",
        borderRadius: "12px",
        background: "#fff",
        color: "#201d1f",
        border: "1px solid " + (goed ? "#cfe9dc" : "#f3d6b8"),
        boxShadow: "0 10px 28px -14px rgba(32,20,15,.45)",
        font: '13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
      });
      const t = document.createElement("div");
      t.textContent = tekst;
      box.appendChild(t);
      const rij = document.createElement("div");
      Object.assign(rij.style, { display: "flex", gap: "8px", marginTop: "8px" });
      const knop = (label, primair, fn) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        Object.assign(b.style, {
          height: "30px",
          padding: "0 12px",
          borderRadius: "8px",
          cursor: "pointer",
          font: "inherit",
          fontWeight: "600",
          border: primair ? "0" : "1px solid #ece7e5",
          background: primair ? "#cc087d" : "#fff",
          color: primair ? "#fff" : "#201d1f"
        });
        b.addEventListener("click", fn);
        rij.appendChild(b);
      };
      if (metVerversen) knop("Agenda verversen", true, () => location.reload());
      knop("Sluiten", false, () => box.remove());
      box.appendChild(rij);
      document.body.appendChild(box);
      setTimeout(() => {
        try {
          box.remove();
        } catch (e) {
        }
      }, 2e4);
    } catch (e) {
    }
  }
  function meldPaneel(info) {
    try {
      chrome.runtime.sendMessage(Object.assign({ type: MSG.AGENDA_DUPLICATES_DONE }, info));
    } catch (e) {
    }
  }
  async function makeDuplicates(bodyText, moments, post) {
    post = post || postJson;
    let payload = null;
    try {
      payload = JSON.parse(String(bodyText || ""));
    } catch (e) {
    }
    const info = inspectEventPayload(payload);
    if (!info.ok) return { made: [], failed: [], skipped: moments || [], reason: info.reason };
    const rest = remainingMoments(payload, moments);
    const made = [], failed = [];
    for (const m of rest) {
      const kopie = duplicateEventPayload(payload, m);
      if (!kopie) {
        failed.push(m);
        continue;
      }
      try {
        await post(CREATE_URL, kopie);
        made.push(m);
      } catch (e) {
        failed.push(m);
      }
    }
    payload = null;
    return { made, failed, skipped: [], reason: "" };
  }
  var _bezig2 = false;
  function volgendeEigen(eigen, bodyText) {
    const volgende = eigen[0];
    storePendingDuplicates([], eigen.slice(1));
    var klaar = { date: volgende.date, time: ("0" + Math.floor(volgende.startMin / 60)).slice(-2) + ":" + ("0" + volgende.startMin % 60).slice(-2) };
    if (volgende.minutes > 0) klaar.minutes = volgende.minutes;
    storePendingAppointment(klaar);
    let ids = [];
    try {
      const ev = JSON.parse(String(bodyText || "")).event;
      ids = (ev && ev.employee_ids || []).map(String);
    } catch (e) {
    }
    if (!ids.length) ids = currentInviteeIds();
    if (!ids.length) return false;
    setTimeout(function() {
      spaNavigate(location.origin + newEventUrl(ids, volgende.clientIds, volgende.date));
    }, 1200);
    return true;
  }
  async function bijOpgeslagen(bodyText, pendingText) {
    if (_bezig2) return;
    const p = takePending(pendingText);
    if (!p || !p.moments.length && !p.eigen.length) return;
    _bezig2 = true;
    try {
      const verder = p.eigen.length ? " Volgende afspraak met eigen instellingen: " + momentLabel(p.eigen[0]) + " (" + p.eigen.length + (p.eigen.length === 1 ? " te gaan)." : " te gaan).") : "";
      if (!p.moments.length) {
        volgendeEigen(p.eigen, bodyText);
        toonMelding("Afspraak opgeslagen." + verder, true, false);
        meldPaneel({ made: [], failed: [], reason: "", next: p.eigen[0], left: p.eigen.length });
        return;
      }
      const r = await makeDuplicates(bodyText, p.moments);
      if (p.eigen.length) volgendeEigen(p.eigen, bodyText);
      const totaal = r.made.length + r.failed.length;
      if (r.reason) {
        const uitleg = r.reason === "herhalende afspraak" ? "Dit is een herhalende afspraak; daar maakt de planhulp geen kopieën van." : "Kon deze afspraak niet lezen.";
        toonMelding("Geen kopieën gemaakt. " + uitleg, false, false);
      } else if (!totaal) {
        toonMelding("Afspraak opgeslagen; er waren geen andere momenten meer om te kopiëren.", true, false);
      } else if (!r.failed.length) {
        toonMelding("Afspraak ook gemaakt op " + r.made.length + (r.made.length === 1 ? " ander moment: " : " andere momenten: ") + r.made.map(momentLabel).join(", ") + "." + verder, true, !p.eigen.length);
      } else {
        toonMelding(r.made.length + " van " + totaal + " kopieën gemaakt. Niet gelukt: " + r.failed.map(momentLabel).join(", ") + ". Maak die zelf aan in ONS." + verder, false, r.made.length > 0 && !p.eigen.length);
      }
      meldPaneel({ made: r.made, failed: r.failed, reason: r.reason, next: p.eigen[0] || null, left: p.eigen.length });
    } finally {
      _bezig2 = false;
    }
  }
  function listenForCreatedEvents() {
    try {
      window.addEventListener("message", function(ev) {
        if (!ev || ev.origin !== location.origin) return;
        if (ev.source && ev.source !== window) return;
        const d = ev.data;
        if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.FROM_MAIN || d.type !== "eventCreated") return;
        bijOpgeslagen(d.body, d.pending);
      }, false);
    } catch (e) {
    }
  }

  // src/content/domain/event-create.js
  function parseProductOptions(json) {
    var groepen = json && Array.isArray(json.basic_list) ? json.basic_list : [];
    var uit = [], gezien = /* @__PURE__ */ Object.create(null);
    ["Onlangs gebruikt", "Geadviseerd", "Toegestaan"].forEach(function(cat) {
      groepen.forEach(function(g) {
        if (!Array.isArray(g) || g[0] !== cat || !Array.isArray(g[1])) return;
        g[1].forEach(function(item) {
          if (!Array.isArray(item)) return;
          var naam = String(item[0] == null ? "" : item[0]).trim(), id = item[1];
          if (!naam || !(typeof id === "number" || /^\d+$/.test(String(id)))) return;
          id = Number(id);
          if (gezien[id]) return;
          gezien[id] = true;
          uit.push({ id, name: naam, recent: cat === "Onlangs gebruikt" });
        });
      });
    });
    return uit;
  }
  function parseLabels(json) {
    return (Array.isArray(json) ? json : []).filter(function(l) {
      return l && l.id != null && l.name;
    }).map(function(l) {
      return { id: Number(l.id), name: String(l.name) };
    });
  }
  function learnEventMeta(meta) {
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
    var uit = {}, n = 0;
    Object.keys(meta).forEach(function(k) {
      var v = meta[k];
      if (!/^[a-z_]{1,60}$/.test(k)) return;
      if (typeof v === "boolean" || v === null || typeof v === "number" && isFinite(v)) {
        uit[k] = v;
        n++;
      }
    });
    return n ? uit : null;
  }
  function reistijd(v) {
    var n = Math.round(Number(v));
    return n > 0 ? Math.min(n, 240) : 0;
  }
  function buildEventPayload(spec, meta) {
    spec = spec || {};
    var start = spec.startMin, eind = start + spec.minutes;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(spec.date || "")) || !(start >= 0) || !(spec.minutes > 0) || eind >= 24 * 60) return null;
    var emp = (spec.employeeIds || []).map(Number).filter(function(x) {
      return x > 0;
    });
    var cl = (spec.clients || []).filter(function(c) {
      return c && Number(c.id) > 0 && Number(c.hourTypeId) > 0;
    });
    if (!emp.length || !cl.length || cl.length !== (spec.clients || []).length) return null;
    var info = {};
    cl.forEach(function(c) {
      info[Number(c.id)] = { hour_type_id: Number(c.hourTypeId), care_order_external_id: null, activity_ids: [] };
    });
    var ev = {
      valid_from: spec.date,
      start_time: isoLocalWithOffset(spec.date, start),
      end_time: isoLocalWithOffset(spec.date, eind),
      client_ids: cl.map(function(c) {
        return Number(c.id);
      }),
      client_information: info,
      client_present: true,
      clients: [],
      comment: String(spec.comment || ""),
      custom_location: null,
      employee_ids: emp,
      employees: [],
      group: null,
      groups: [],
      hour_type_id: null,
      label_ids: Number(spec.labelId) > 0 ? [Number(spec.labelId)] : [],
      labels: [],
      location: null,
      location_id: null,
      name: String(spec.name || "Afspraak").slice(0, 200),
      team_ids: [],
      teams: [],
      // Reistijd in MINUTEN, zoals ONS hem in de agenda teruggeeft.
      travel_time_after: reistijd(spec.travelAfter),
      travel_time_before: reistijd(spec.travelBefore)
    };
    var m = learnEventMeta(meta);
    if (m) ev.meta = m;
    return { event: ev };
  }

  // src/content/features/agenda/event-create.js
  var META_KEY = PAGE_LOCAL.EVENT_META_TEMPLATE;
  function directCreateEnabled() {
    var f = APP_CONFIG.features || {};
    return f.planner !== false && f.plannerDirect !== false;
  }
  function medewerkers() {
    var ids = currentInviteeIds();
    if (!ids.length) {
      var een = currentInviteeId(null) || resolveInviteeId();
      if (een != null) ids = [String(een)];
    }
    return ids;
  }
  function leesMeta() {
    try {
      return learnEventMeta(JSON.parse(localStorage.getItem(META_KEY) || "null"));
    } catch (e) {
      return null;
    }
  }
  function eventOptions(clientIds) {
    if (!directCreateEnabled()) return Promise.reject(new Error("Afspraken maken vanuit de planhulp staat uit (beheer)."));
    var ids = medewerkers();
    if (!ids.length) return Promise.reject(new Error("Open eerst je agenda in ONS."));
    var uniek = (clientIds || []).map(String).filter(function(c, i, a) {
      return /^\d+$/.test(c) && a.indexOf(c) === i;
    }).slice(0, 10);
    var types = {};
    return Promise.all([
      getJson(_apiUrl("availableLabels")).then(parseLabels, function() {
        return [];
      }),
      Promise.all(uniek.map(function(c) {
        return getJson(_apiUrl("productOptions", { employeeId: ids[0], clientId: c })).then(function(j) {
          types[c] = parseProductOptions(j);
        }, function() {
          types[c] = [];
        });
      }))
    ]).then(function(r) {
      return { labels: r[0], hourTypes: types, metaKnown: !!leesMeta() };
    });
  }
  async function createEvents(events, post) {
    if (!directCreateEnabled()) throw new Error("Afspraken maken vanuit de planhulp staat uit (beheer).");
    post = post || postJson;
    var ids = medewerkers();
    if (!ids.length) throw new Error("Open eerst je agenda in ONS.");
    var meta = leesMeta(), results = [];
    for (const e of (events || []).slice(0, 20)) {
      var payload = buildEventPayload({
        date: e.date,
        startMin: e.startMin,
        minutes: e.minutes,
        employeeIds: ids,
        clients: [{ id: e.clientId, hourTypeId: e.hourTypeId }],
        labelId: e.labelId,
        name: e.name,
        travelBefore: e.travelBefore,
        travelAfter: e.travelAfter
      }, meta);
      if (!payload) {
        results.push({ ok: false, error: "Onvolledig (cliënt, uursoort of tijd)." });
        continue;
      }
      try {
        await post(_apiUrl("createEvent"), payload);
        results.push({ ok: true });
      } catch (err) {
        results.push({ ok: false, error: err && err.message || "Mislukt." });
      }
    }
    return results;
  }
  function listenForEventMeta() {
    try {
      window.addEventListener("message", function(ev) {
        if (!ev || ev.origin !== location.origin) return;
        if (ev.source && ev.source !== window) return;
        var d = ev.data;
        if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.FROM_MAIN || d.type !== "eventMeta") return;
        var m = learnEventMeta(d.meta);
        if (m) {
          try {
            localStorage.setItem(META_KEY, JSON.stringify(m));
          } catch (e) {
          }
        }
      }, false);
    } catch (e) {
    }
  }

  // src/content/config/loader.js
  function loadBundledConfig() {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.getURL) return Promise.resolve();
      const url = chrome.runtime.getURL("config.json");
      return fetch(url).then(function(r) {
        return r && r.ok ? r.json() : null;
      }).then(function(obj) {
        if (obj) {
          const cfg = obj.helperConfig ? obj.helperConfig : obj;
          applyHelperConfig(cfg);
          const features = cfg.features || {};
          if (typeof features.appointmentAssistant === "boolean") RUNTIME_CONFIG.appointmentHelperEnabled = features.appointmentAssistant;
          if (typeof features.registrationAssistant === "boolean") RUNTIME_CONFIG.registrationHelperEnabled = features.registrationAssistant;
        }
      }).catch(function() {
      });
    } catch (e) {
      return Promise.resolve();
    }
  }
  var HELPER_SCOPE = "all";
  var RUNTIME_CONFIG = { enabled: true, appointmentHelperEnabled: true, registrationHelperEnabled: true };
  var _presenceDeadlineOverride = null;
  function applyRuntimeConfig(cfg) {
    if (!cfg || typeof cfg !== "object") return;
    if (typeof cfg.enabled === "boolean") RUNTIME_CONFIG.enabled = cfg.enabled;
    if (typeof cfg.appointmentHelperEnabled === "boolean") RUNTIME_CONFIG.appointmentHelperEnabled = cfg.appointmentHelperEnabled;
    if (typeof cfg.registrationHelperEnabled === "boolean") RUNTIME_CONFIG.registrationHelperEnabled = cfg.registrationHelperEnabled;
    if (typeof cfg.presenceDeadlineOverride === "string") _presenceDeadlineOverride = cfg.presenceDeadlineOverride || null;
    if (cfg.helperConfig && typeof cfg.helperConfig === "object") {
      try {
        applyHelperConfig(cfg.helperConfig);
      } catch (e) {
      }
    } else {
      try {
        applyHelperConfig(cfg);
      } catch (e) {
      }
    }
    const features = cfg.helperConfig && cfg.helperConfig.features || cfg.features || {};
    if (typeof features.appointmentAssistant === "boolean") RUNTIME_CONFIG.appointmentHelperEnabled = features.appointmentAssistant;
    if (typeof features.registrationAssistant === "boolean") RUNTIME_CONFIG.registrationHelperEnabled = features.registrationAssistant;
    runConfigHook("configApplied");
  }
  function loadManagedConfig() {
    function readStorage(area2, keys) {
      return new Promise(function(resolve) {
        try {
          if (!area2 || typeof area2.get !== "function") {
            resolve(null);
            return;
          }
          area2.get(keys, function(result) {
            try {
              if (chrome.runtime && chrome.runtime.lastError) {
                resolve(null);
                return;
              }
            } catch (e) {
            }
            resolve(result || null);
          });
        } catch (e) {
          resolve(null);
        }
      });
    }
    try {
      if (typeof chrome === "undefined" || !chrome.storage) return Promise.resolve();
      return readStorage(chrome.storage.sync || chrome.storage.local, [SYNC.SECTOR, SYNC.COLOR_PROFILE]).then(function(profile) {
        const previousSelection = ACTIVE_SECTOR + "\n" + ACTIVE_PROFILE;
        setActiveTeam(
          profile && profile.colorProfile || null,
          profile && (profile.sector || (APP_CONFIG.profileSectors || {})[profile.colorProfile]) || null
        );
        refreshEffectiveConfig();
        if (previousSelection !== ACTIVE_SECTOR + "\n" + ACTIVE_PROFILE) {
          try {
            runConfigHook("teamChanged");
          } catch (e) {
          }
        }
        return readStorage(chrome.storage.local, [LOCAL.TEST_CONFIG]);
      }).then(function(res) {
        try {
          if (res && res[LOCAL.TEST_CONFIG]) applyRuntimeConfig(res[LOCAL.TEST_CONFIG]);
        } catch (e) {
        }
        return readStorage(chrome.storage.managed, null);
      }).then(function(cfg) {
        try {
          if (cfg) applyRuntimeConfig(cfg);
        } catch (e) {
        }
        runConfigHook("configApplied");
      });
    } catch (e) {
      return Promise.resolve();
    }
  }
  function watchConfigChanges() {
    try {
      if (chrome && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area2) => {
          if (area2 === "managed" || area2 === "local" || area2 === "sync" && (changes[SYNC.SECTOR] || changes[SYNC.COLOR_PROFILE])) loadManagedConfig();
        });
      }
    } catch (e) {
    }
  }
  var helperConfigReady = false;
  function startConfigLoading() {
    return loadBundledConfig().then(function() {
      return loadManagedConfig();
    }).catch(function() {
    }).then(function() {
      helperConfigReady = true;
    });
  }

  // src/shared/version.js
  var SCRIPT_VERSION = function() {
    try {
      return chrome.runtime.getManifest().version;
    } catch (e) {
      return "1.6.239";
    }
  }();

  // src/content/helper/info-panel.js
  function closeInfoPanel() {
    if (!helperPanel._infoPanelRestore) return;
    const restore = helperPanel._infoPanelRestore;
    helperPanel._infoPanelRestore = null;
    restore();
  }
  function toggleInfoPanel() {
    if (helperPanel._infoPanelRestore) {
      closeInfoPanel();
      return;
    }
    showInfoPanel();
  }
  function showInfoPanel() {
    const body = $body();
    if (!body) return;
    if (helperPanel._infoPanelRestore) return;
    helperPanel._infoPanelRestore = helperPanel.helperEnabled ? createCurrentScreenRestore() : () => showDisabledState();
    const statusEl = helperPanel.popupEl && helperPanel.popupEl.querySelector("[data-status]");
    resetBody(body);
    body.appendChild(mkBackButton(() => safe(closeInfoPanel), "Terug"));
    const title = document.createElement("div");
    title.textContent = helperPanel.activeMode === "registrations" ? "Registratiehulp" : "Afspraakhulp";
    Object.assign(title.style, { fontWeight: "700", fontSize: "14px", margin: "6px 0 2px" });
    body.appendChild(title);
    const ver = document.createElement("div");
    ver.textContent = `Versie ${SCRIPT_VERSION}`;
    Object.assign(ver.style, { fontSize: "13px", color: "#333", margin: "0 0 8px" });
    body.appendChild(ver);
    const help = document.createElement("div");
    Object.assign(help.style, { fontSize: "13px", color: "#333", lineHeight: "1.4" });
    help.appendChild(document.createTextNode("Vragen of verbetersuggesties kunnen worden gesteld via "));
    const link = document.createElement("a");
    link.textContent = "Topdesk";
    link.href = supportTopdeskUrl();
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    Object.assign(link.style, { color: "#cc087d", textDecoration: "underline" });
    help.appendChild(link);
    help.appendChild(document.createTextNode("."));
    body.appendChild(help);
    if (statusEl) {
      statusEl.textContent = "";
    }
  }

  // src/content/helper/panel.js
  function setPopupCollapsed(collapsed) {
    helperPanel.popupCollapsed = collapsed;
    if (!helperPanel.popupEl) return;
    const mainCol = helperPanel.popupEl.querySelector("[data-popup-maincol]");
    const toggle = helperPanel.popupEl.querySelector("[data-collapse-toggle]");
    const spine = helperPanel.popupEl.querySelector("[data-popup-spine]");
    if (mainCol) {
      mainCol.style.width = collapsed ? "0" : "280px";
      mainCol.style.minWidth = collapsed ? "0" : "280px";
      mainCol.style.opacity = collapsed ? "0" : "1";
      mainCol.style.pointerEvents = collapsed ? "none" : "auto";
    }
    if (toggle) {
      setChevronIcon(toggle, collapsed);
      toggle.setAttribute("aria-label", collapsed ? "Hulp uitklappen" : "Hulp inklappen");
    }
    if (spine) spine.setAttribute("aria-expanded", collapsed ? "false" : "true");
    requestAnimationFrame(() => safe(reclampToViewport));
  }
  function clampPos(left, top) {
    const w = helperPanel.popupEl && helperPanel.popupEl.offsetWidth || 280;
    const h = helperPanel.popupEl && helperPanel.popupEl.offsetHeight || 200;
    const maxLeft = Math.max(8, window.innerWidth - w - 8);
    const maxTop = Math.max(8, window.innerHeight - h - 8);
    return {
      left: Math.min(Math.max(8, left), maxLeft),
      top: Math.min(Math.max(8, top), maxTop)
    };
  }
  function defaultPopupTop() {
    return Math.round(window.innerHeight * 0.1);
  }
  function popupMaxHeight() {
    return Math.max(160, Math.round(window.innerHeight * 0.9) - defaultPopupTop());
  }
  function defaultPopupRight() {
    let panel = helperPanel._lastRightPanel;
    if (!panel || !panel.isConnected || !visible(panel)) {
      const m = findModal();
      panel = m && m.panel || null;
      helperPanel._lastRightPanel = panel;
    }
    let raw = 24;
    if (panel) {
      const r = rect(panel);
      if (r.width > 0) raw = Math.round(window.innerWidth - r.right + 24);
    }
    const clamped = Math.max(8, Math.min(raw, window.innerWidth - 40));
    if (helperPanel._lastRightValue != null && Math.abs(clamped - helperPanel._lastRightValue) < 4) return helperPanel._lastRightValue;
    helperPanel._lastRightValue = clamped;
    return clamped;
  }
  function reclampToViewport() {
    if (!helperPanel.popupEl) return;
    if (!helperPanel.userPos) {
      reposition();
      return;
    }
    const r = rect(helperPanel.popupEl);
    const h = helperPanel.popupEl.offsetHeight || r.height || 200;
    let top = r.top;
    const maxTop = Math.max(8, window.innerHeight - h - 8);
    if (top > maxTop) top = maxTop;
    const p = clampPos(r.left, top);
    helperPanel.popupEl.style.left = p.left + "px";
    helperPanel.popupEl.style.top = p.top + "px";
    helperPanel.popupEl.style.right = "auto";
    helperPanel.popupEl.style.bottom = "auto";
    helperPanel.popupEl.style.maxHeight = popupMaxHeight() + "px";
    if (helperPanel.userPos) helperPanel.userPos = p;
  }
  function buildPopup() {
    helperPanel.popupEl = document.createElement("div");
    Object.assign(helperPanel.popupEl.style, { position: "fixed", zIndex: "2147483647", top: defaultPopupTop() + "px", right: "24px", bottom: "auto", maxHeight: popupMaxHeight() + "px", transition: "right .18s cubic-bezier(.2,.8,.2,1)", background: "#fff", color: "#201d1f", pointerEvents: "auto", border: "1px solid #ece7e5", borderRadius: "16px", boxShadow: "0 14px 40px rgba(32,20,15,.24)", font: '14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', overflow: "hidden", display: "flex", flexDirection: "row", alignItems: "stretch" });
    const spine = document.createElement("div");
    spine.setAttribute("data-popup-spine", "");
    spine.setAttribute("role", "button");
    spine.setAttribute("tabindex", "0");
    spine.title = "Klik om in/uit te klappen";
    Object.assign(spine.style, { width: "16px", flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", cursor: "pointer", userSelect: "none" });
    const spineChip = document.createElement("span");
    Object.assign(spineChip.style, { width: "20px", height: "20px", borderRadius: "50%", background: "rgba(255,255,255,.24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flex: "0 0 auto" });
    spine.appendChild(spineChip);
    const spineDots = document.createElement("span");
    spineDots.setAttribute("data-spine-dots", "");
    Object.assign(spineDots.style, { display: "flex", flexDirection: "column", gap: "5px", marginTop: "10px" });
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("i");
      Object.assign(dot.style, { display: "block", width: "4px", height: "4px", borderRadius: "50%", background: "rgba(255,255,255,.35)" });
      spineDots.appendChild(dot);
    }
    spine.appendChild(spineDots);
    const onSpineMousedown = (e) => {
      if (e.target.closest && e.target.closest("[data-popup-control]")) return;
      helperPanel.popupDragMoved = false;
      helperPanel.dragging = true;
      const r = rect(helperPanel.popupEl);
      helperPanel.dragDX = e.clientX - r.left;
      helperPanel.dragDY = e.clientY - r.top;
      e.preventDefault();
    };
    spine.addEventListener("mousedown", onSpineMousedown);
    spine.addEventListener("click", (e) => {
      if (helperPanel.popupDragMoved) {
        helperPanel.popupDragMoved = false;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setPopupCollapsed(!helperPanel.popupCollapsed);
    });
    spine.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setPopupCollapsed(!helperPanel.popupCollapsed);
      }
    });
    const mainCol = document.createElement("div");
    mainCol.setAttribute("data-popup-maincol", "");
    Object.assign(mainCol.style, { width: "280px", minWidth: "280px", display: "flex", flexDirection: "column", overflow: "hidden", opacity: "1", transition: "width .22s cubic-bezier(.2,.8,.2,1), opacity .15s ease" });
    const header = document.createElement("div");
    Object.assign(header.style, { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", color: "#201d1f", padding: "11px 12px", fontWeight: "700", cursor: "move", userSelect: "none", borderBottom: "1px solid #f1ecea" });
    const title = document.createElement("span");
    title.textContent = helperPanel.activeMode === "registrations" ? "Registratiehulp" : "Afspraakhulp";
    Object.assign(title.style, { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
    header.appendChild(title);
    const enabledToggle = document.createElement("button");
    enabledToggle.setAttribute("data-enabled-toggle", "");
    enabledToggle.setAttribute("data-popup-control", "");
    Object.assign(enabledToggle.style, { position: "relative", background: "transparent", border: "0", borderRadius: "999px", color: "#fff", cursor: "pointer", lineHeight: "1", padding: "0", width: "58px", height: "24px", fontWeight: "700", overflow: "hidden", flex: "0 0 auto", fontFamily: "inherit" });
    const switchTrack = document.createElement("span");
    Object.assign(switchTrack.style, { position: "absolute", inset: "0", borderRadius: "999px", border: "1px solid rgba(255,255,255,.45)", transition: "background .16s ease, box-shadow .16s ease, opacity .16s ease" });
    const switchText = document.createElement("span");
    Object.assign(switchText.style, { position: "absolute", top: "0", bottom: "0", display: "flex", alignItems: "center", fontSize: "11px", fontWeight: "700", letterSpacing: "0", color: "#fff", opacity: ".95", transition: "left .16s ease, right .16s ease", pointerEvents: "none" });
    const switchKnob = document.createElement("span");
    Object.assign(switchKnob.style, { position: "absolute", top: "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.22)", transition: "left .16s ease" });
    enabledToggle.appendChild(switchTrack);
    enabledToggle.appendChild(switchText);
    enabledToggle.appendChild(switchKnob);
    onsahFocusRing(enabledToggle);
    const updateEnabledToggle = () => {
      switchText.textContent = helperPanel.helperEnabled ? "Aan" : "Uit";
      switchTrack.style.background = helperPanel.helperEnabled ? "#1b7f3b" : "#a3241f";
      switchTrack.style.boxShadow = helperPanel.helperEnabled ? "inset 0 0 0 1px rgba(255,255,255,.12)" : "inset 0 0 0 1px rgba(255,255,255,.10)";
      switchTrack.style.opacity = helperPanel.helperEnabled ? "1" : ".82";
      switchKnob.style.left = helperPanel.helperEnabled ? "37px" : "3px";
      switchText.style.left = helperPanel.helperEnabled ? "9px" : "27px";
      switchText.style.right = helperPanel.helperEnabled ? "25px" : "7px";
      enabledToggle.setAttribute("aria-label", helperPanel.helperEnabled ? "Hulp uitschakelen" : "Hulp inschakelen");
      enabledToggle.setAttribute("aria-pressed", helperPanel.helperEnabled ? "true" : "false");
      enabledToggle.title = helperPanel.helperEnabled ? "Aan" : "Uit";
      spine.style.background = helperPanel.helperEnabled ? "#cc087d" : "#9a9296";
      spineChip.innerHTML = "";
      spineChip.appendChild(helperPanel.helperEnabled ? svgSpineCheck() : svgSpinePause());
    };
    updateEnabledToggle();
    enabledToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      helperPanel.helperEnabled = !helperPanel.helperEnabled;
      storageSet(STORE_HELPER_ENABLED, helperPanel.helperEnabled ? "1" : "0");
      updateEnabledToggle();
      if (helperPanel.helperEnabled) {
        const reapplyGuard = () => {
          if (helperPanel.activeMode === "registrations") updateRegistrationSubmitGuard();
          else updateSubmitGuard();
        };
        const restore = helperPanel._disabledRestore;
        helperPanel._disabledRestore = null;
        if (restore) {
          if (helperPanel.activeMode !== "registrations" && hasClientInAppointment()) {
            ensureClientExpanded(() => {
              restore();
              reapplyGuard();
            });
          } else {
            restore();
            reapplyGuard();
          }
        } else if (helperPanel.activeMode !== "registrations") {
          resumeAppointmentHelperAfterEnable();
        } else {
          refreshMainScreen();
        }
        reapplyGuard();
      } else {
        helperPanel._disabledRestore = helperPanel._infoPanelRestore || createCurrentScreenRestore();
        helperPanel._infoPanelRestore = null;
        setSubmitBlocked(false);
        setRegistrationSubmitBlocked(false);
        showDisabledState();
      }
    });
    const infoBtn = document.createElement("button");
    infoBtn.setAttribute("data-info-toggle", "");
    infoBtn.setAttribute("data-popup-control", "");
    infoBtn.setAttribute("aria-label", `Info en versie ${SCRIPT_VERSION}`);
    infoBtn.title = `Info en versie ${SCRIPT_VERSION}`;
    infoBtn.appendChild(svgInfoIcon());
    Object.assign(infoBtn.style, { background: "#f6f2f0", border: "1px solid #ece7e5", borderRadius: "8px", color: "#6b6367", cursor: "pointer", lineHeight: "1", padding: "5px 7px", width: "28px", height: "28px", display: "inline-flex", alignItems: "center", justifyContent: "center" });
    infoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (helperPanel.popupCollapsed) setPopupCollapsed(false);
      safe(toggleInfoPanel);
    });
    onsahFocusRing(infoBtn);
    const close = document.createElement("button");
    close.setAttribute("data-collapse-toggle", "");
    close.setAttribute("data-popup-control", "");
    close.setAttribute("aria-label", helperPanel.popupCollapsed ? "Hulp uitklappen" : "Hulp inklappen");
    Object.assign(close.style, { background: "#f6f2f0", border: "1px solid #ece7e5", borderRadius: "8px", color: "#6b6367", cursor: "pointer", lineHeight: "1", padding: "3px", width: "28px", height: "28px", display: "inline-flex", alignItems: "center", justifyContent: "center" });
    setChevronIcon(close, helperPanel.popupCollapsed);
    close.addEventListener("click", () => setPopupCollapsed(!helperPanel.popupCollapsed));
    onsahFocusRing(close);
    const controls = document.createElement("div");
    controls.setAttribute("data-popup-control", "");
    Object.assign(controls.style, { display: "inline-flex", alignItems: "center", gap: "8px", flex: "0 0 auto", marginLeft: "8px" });
    controls.appendChild(enabledToggle);
    controls.appendChild(infoBtn);
    controls.appendChild(close);
    header.appendChild(controls);
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest && e.target.closest("[data-popup-control]")) return;
      helperPanel.popupDragMoved = false;
      helperPanel.dragging = true;
      const r = rect(helperPanel.popupEl);
      helperPanel.dragDX = e.clientX - r.left;
      helperPanel.dragDY = e.clientY - r.top;
      e.preventDefault();
    });
    mainCol.appendChild(header);
    const body = document.createElement("div");
    body.setAttribute("data-body", "");
    Object.assign(body.style, { padding: "12px", display: "flex", flexDirection: "column", gap: "8px", flex: "1 1 auto", minHeight: "0", overflowY: "auto" });
    mainCol.appendChild(body);
    const status = document.createElement("div");
    status.setAttribute("data-status", "");
    Object.assign(status.style, { padding: "0 12px 12px" });
    mainCol.appendChild(status);
    helperPanel.popupEl.appendChild(spine);
    helperPanel.popupEl.appendChild(mainCol);
    refreshMainScreen();
    setPopupCollapsed(helperPanel.popupCollapsed);
    try {
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          safe(reclampToViewport);
        });
        ro.observe(helperPanel.popupEl);
        helperPanel.popupEl.__onsResizeObserver = ro;
      }
    } catch (e) {
    }
  }
  function installPanelDragListeners() {
    window.addEventListener("mousemove", (e) => {
      if (!helperPanel.dragging || !helperPanel.popupEl) return;
      helperPanel.popupDragMoved = true;
      const p = clampPos(e.clientX - helperPanel.dragDX, e.clientY - helperPanel.dragDY);
      helperPanel.userPos = p;
      helperPanel.popupEl.style.left = p.left + "px";
      helperPanel.popupEl.style.top = p.top + "px";
      helperPanel.popupEl.style.right = "auto";
      helperPanel.popupEl.style.bottom = "auto";
    });
    window.addEventListener("mouseup", () => {
      helperPanel.dragging = false;
    });
  }
  function reposition() {
    if (!helperPanel.popupEl) return;
    helperPanel.popupEl.style.maxHeight = popupMaxHeight() + "px";
    if (helperPanel.userPos) {
      const p = clampPos(helperPanel.userPos.left, helperPanel.userPos.top);
      helperPanel.popupEl.style.left = p.left + "px";
      helperPanel.popupEl.style.top = p.top + "px";
      helperPanel.popupEl.style.right = "auto";
      helperPanel.popupEl.style.bottom = "auto";
      return;
    }
    helperPanel.popupEl.style.right = defaultPopupRight() + "px";
    helperPanel.popupEl.style.left = "auto";
    helperPanel.popupEl.style.top = defaultPopupTop() + "px";
    helperPanel.popupEl.style.bottom = "auto";
  }
  function ensureMounted() {
    if (!helperPanel.active) return;
    if (!helperPanel.popupEl) buildPopup();
    const m = findModal();
    const host = m && m.host || document.body;
    if (helperPanel.popupEl.parentNode !== host) {
      try {
        host.appendChild(helperPanel.popupEl);
      } catch (e) {
        document.body.appendChild(helperPanel.popupEl);
      }
    }
    if (!helperPanel.helperEnabled) {
      showDisabledState();
      reposition();
      return;
    }
    if (appointmentFlow.appointmentClearingSettings) {
      showLoadingState("Instellingen verwijderen...");
      reposition();
      return;
    }
    if (helperPanel.activeMode === "registrations") {
      refreshRegistrationPrereqScreen();
      checkRegistrationNoShowText();
      checkRegistrationEpisodesText();
      updateRegistrationSubmitGuard();
      reposition();
      return;
    }
    safe(guardInviteeAddButton);
    invalidateClientEntries();
    refreshFreeDayFromBackgroundCalendar();
    if (appointmentFlow.appointmentFreeDay) {
      showFreeDayInactive();
      reposition();
      return;
    }
    refreshAppointmentPrereqScreen();
    if (hasClientInAppointment()) ensureClientExpanded(() => {
    });
    handleClientListChanges();
    updateSubmitGuard();
    reposition();
  }
  function removePopup() {
    if (!helperPanel.popupEl) return;
    try {
      const body = helperPanel.popupEl.querySelector("[data-body]");
      if (body && window.__onsahReact) window.__onsahReact.unmount(body);
    } catch (e) {
    }
    try {
      if (helperPanel.popupEl.__onsResizeObserver) {
        helperPanel.popupEl.__onsResizeObserver.disconnect();
        helperPanel.popupEl.__onsResizeObserver = null;
      }
    } catch (e) {
    }
    helperPanel.popupEl.remove();
    helperPanel.popupEl = null;
  }
  var _mountRaf = 0;
  var scheduleMount = () => {
    if (_mountRaf) return;
    _mountRaf = requestAnimationFrame(() => {
      _mountRaf = 0;
      safe(ensureMounted);
    });
  };

  // src/content/services/ons-api/calendar.js
  function fetchInviteeWeek(inviteeId, date) {
    var id = inviteeId != null ? inviteeId : resolveInviteeId();
    if (id == null) return Promise.reject(new Error("geen invitee-id gevonden"));
    var d = agendaYmd(date) || agendaYmd(/* @__PURE__ */ new Date());
    return getJson(_apiUrl("weekEvents", { inviteeId: id, date: d })).then(function(j) {
      return mapAgendaWeekResponse(j);
    });
  }
  function fetchEmployeeRegistrations(date, opts) {
    opts = opts || {};
    var d = agendaYmd(date) || agendaYmd(/* @__PURE__ */ new Date());
    var limit = opts.limit || 50, maxPages = opts.maxPages || 8, all = [];
    function page(offset, n) {
      return getJson(_apiUrl("employeeRegistrations", { date: d, offset, limit })).then(function(j) {
        var rows = _regUnwrap(j);
        all = all.concat(rows);
        if (rows.length >= limit && n + 1 < maxPages) return page(offset + limit, n + 1);
        return all;
      });
    }
    return page(0, 0).then(function(rows) {
      return summarizeRegistrations(rows);
    });
  }
  function _mapPool(items, limit, worker) {
    return new Promise(function(resolve) {
      var results = new Array(items.length), i = 0, active = 0, done = 0;
      if (!items.length) {
        resolve(results);
        return;
      }
      function next() {
        while (active < limit && i < items.length) {
          var idx = i++;
          active++;
          Promise.resolve().then(function() {
            return worker(items[idx]);
          }).then(function(r) {
            results[idx] = r;
          }, function() {
            results[idx] = null;
          }).then(function() {
            active--;
            done++;
            if (done === items.length) resolve(results);
            else next();
          });
        }
      }
      next();
    });
  }
  function fetchRegistrationDetails(inviteeId, occurrenceId) {
    return getJson(_apiUrl("registrationDetails", { inviteeId, occurrenceId })).then(parseRegistrationDetails).catch(function() {
      return null;
    });
  }
  function createLimiter(n) {
    var active = 0, queue = [];
    function next() {
      if (active >= n || !queue.length) return;
      var job = queue.shift();
      active++;
      Promise.resolve().then(job.fn).then(job.resolve, job.reject).then(function() {
        active--;
        next();
      });
    }
    return function(fn) {
      return new Promise(function(resolve, reject) {
        queue.push({ fn, resolve, reject });
        next();
      });
    };
  }
  var _weekRegCache = /* @__PURE__ */ Object.create(null);
  function fetchWeekRegistrationDeclarabiliteit(inviteeId, date, opts) {
    opts = opts || {};
    var d = agendaYmd(date) || agendaYmd(/* @__PURE__ */ new Date());
    var cacheKey = inviteeId + "|" + d;
    var cached = _weekRegCache[cacheKey];
    var ttl = opts.ttlMs || 12e4;
    if (cached && Date.now() - cached.ts < ttl) return Promise.resolve(cached.summary);
    var limit = opts.limiter || null;
    var lijst = function() {
      return getJson(_apiUrl("weekRegistrations", { inviteeId, date: d }));
    };
    return (limit ? limit(lijst) : lijst()).then(function(j) {
      var occs = parseWeekRegistrationOccurrences(j).slice(0, 200);
      if (limit) return Promise.all(occs.map(function(o) {
        return limit(function() {
          return fetchRegistrationDetails(inviteeId, o.occurrenceId);
        });
      }));
      return _mapPool(occs, 6, function(o) {
        return fetchRegistrationDetails(inviteeId, o.occurrenceId);
      });
    }).then(function(details) {
      var summary = summarizeWeekRegistrations(details.filter(Boolean));
      _weekRegCache[cacheKey] = { ts: Date.now(), summary };
      return summary;
    });
  }
  function fetchDeclarabiliteitSummary(date) {
    return Promise.resolve().then(function() {
      var inviteeId = resolveInviteeId();
      if (inviteeId != null) return inviteeId;
      return getEmployeeIdAsync().catch(function() {
        return null;
      });
    }).then(function(inviteeId) {
      if (inviteeId != null) {
        return fetchWeekRegistrationDeclarabiliteit(inviteeId, date).catch(function() {
          return fetchEmployeeRegistrations(date);
        });
      }
      return fetchEmployeeRegistrations(date);
    });
  }

  // src/content/domain/declarabiliteit.js
  function declarabiliteitBase(profile) {
    var p = String(profile || "");
    try {
      var rules = typeof APP_CONFIG !== "undefined" && APP_CONFIG && Array.isArray(APP_CONFIG.declarabiliteitRules) ? APP_CONFIG.declarabiliteitRules : null;
      if (rules && rules.length) {
        var pl = p.toLowerCase();
        for (var i = 0; i < rules.length; i++) {
          var r = rules[i];
          if (!r || !r.match) continue;
          if (pl.indexOf(String(r.match).toLowerCase()) !== -1) return r.base === "direct" ? "direct" : "client";
        }
        return "client";
      }
    } catch (e) {
    }
    var up = p.toUpperCase();
    if (up.indexOf("J&O") !== -1 || up.indexOf("JBG") !== -1) return "direct";
    return "client";
  }
  function declarabiliteitPct(summary, profile) {
    var base = declarabiliteitBase(profile);
    var declarabel = base === "direct" ? summary && summary.directMinutes || 0 : summary && summary.clientMinutes || 0;
    var total = summary && summary.totalMinutes || 0;
    return {
      base,
      baseLabel: base === "direct" ? "directe tijd" : "cliëntgebonden tijd",
      declarabelMinutes: declarabel,
      totalMinutes: total,
      pct: total > 0 ? Math.round(declarabel / total * 1e3) / 10 : 0,
      targetPct: 80
    };
  }

  // src/content/features/agenda-overview/registrations-overview.js
  function _agChip(label, value, bg, fg) {
    var c = document.createElement("span");
    c.style.cssText = "display:inline-flex;align-items:baseline;gap:4px;background:" + bg + ";color:" + fg + ";border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700;white-space:nowrap";
    c.innerHTML = '<span style="font-weight:600;opacity:.8">' + label + "</span> " + value;
    return c;
  }
  function agendaRegistrationsSectionEl(rs, dateLabel, profile) {
    var wrap = document.createElement("div");
    wrap.style.cssText = "margin-top:10px;border-top:2px solid #f0e0ea;padding-top:8px";
    var h = document.createElement("div");
    h.innerHTML = "Afgerond · geregistreerd" + (dateLabel ? ' <span style="font-weight:400;color:#999;font-size:10px">· ' + dateLabel + "</span>" : "");
    h.style.cssText = "font-weight:700;font-size:11px;color:" + ONSAH_TOKENS.brand + ";margin-bottom:5px";
    wrap.appendChild(h);
    if (!rs || !rs.count) {
      wrap.appendChild(onsahEmptyState("Nog niets geregistreerd in deze week."));
      return wrap;
    }
    var dec = declarabiliteitPct(rs, profile);
    var hero = document.createElement("div");
    hero.innerHTML = '<span style="font-size:18px;font-weight:800;color:#166a37">' + _agFmtMin(dec.declarabelMinutes) + ' <span style="font-size:11px;font-weight:700;color:#777">declarabel</span></span> <span style="font-size:10px;color:#999">· ' + dec.baseLabel + "</span>";
    hero.style.cssText = "margin-bottom:5px";
    wrap.appendChild(hero);
    var chips = document.createElement("div");
    chips.style.cssText = "display:flex;flex-wrap:wrap;gap:5px";
    chips.append(
      _agChip("Totaal", _agFmtMin(rs.totalMinutes), "#fbe4f1", "#a1005f"),
      _agChip("Direct", _agFmtMin(rs.directMinutes), "#e6f4ea", "#166a37"),
      _agChip("Indirect", _agFmtMin(rs.indirectMinutes), "#fff2df", "#8a5a00"),
      _agChip("Reistijd", _agFmtMin(rs.travelMinutes), "#e7edf7", "#3457a5")
    );
    wrap.appendChild(chips);
    return wrap;
  }
  var _regOvPanel = null;
  var _regOvKey = null;
  function removeRegistrationsOverviewPanel() {
    if (_regOvPanel) {
      try {
        _regOvPanel.remove();
      } catch (e) {
      }
      _regOvPanel = null;
    }
    _regOvKey = null;
  }
  function buildRegistrationsOverviewPanel() {
    if (_regOvPanel) return _regOvPanel;
    const p = document.createElement("div");
    _regOvPanel = p;
    p.setAttribute("data-ons-reg-overview", "1");
    p.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;width:308px;max-height:75vh;background:#fff;color:#201d1f;border:1px solid #ece7e5;border-radius:16px;box-shadow:0 14px 40px rgba(32,20,15,.24);font:13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;overflow:hidden;display:flex;flex-direction:row;align-items:stretch';
    const spine = document.createElement("div");
    spine.style.cssText = "width:14px;flex:0 0 auto;background:#cc087d";
    const mainCol = document.createElement("div");
    mainCol.style.cssText = "flex:1 1 auto;min-width:0;display:flex;flex-direction:column;overflow:auto";
    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:#fff;color:#201d1f;padding:10px 12px;font-weight:700;border-bottom:1px solid #f1ecea";
    const t = document.createElement("span");
    t.textContent = "Declarabiliteit";
    const x = document.createElement("button");
    x.type = "button";
    x.setAttribute("data-popup-control", "");
    x.title = "Sluiten";
    x.setAttribute("aria-label", "Sluiten");
    x.style.cssText = "border:1px solid #ece7e5;background:#f6f2f0;color:#6b6367;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px";
    x.appendChild(svgCloseIcon());
    x.addEventListener("click", function() {
      removeRegistrationsOverviewPanel();
    });
    onsahFocusRing(x);
    header.append(t, x);
    mainCol.appendChild(header);
    const body = document.createElement("div");
    body.setAttribute("data-reg-ov-body", "");
    body.style.cssText = "padding:10px 12px";
    mainCol.appendChild(body);
    p.appendChild(spine);
    p.appendChild(mainCol);
    (document.body || document.documentElement).appendChild(p);
    return p;
  }
  function updateRegistrationsOverviewPanel() {
    try {
      if (!RUNTIME_CONFIG.enabled || !isRegistrationOverviewPage()) {
        removeRegistrationsOverviewPanel();
        return;
      }
      const date = currentAgendaDate();
      const prof = typeof ACTIVE_PROFILE !== "undefined" ? ACTIVE_PROFILE : null;
      const key = date + "|" + prof;
      const panel = buildRegistrationsOverviewPanel();
      if (key === _regOvKey) return;
      _regOvKey = key;
      const body = panel.querySelector("[data-reg-ov-body]");
      body.textContent = "Declarabiliteit laden…";
      var wkNr = agendaWeekNumber(date);
      var wkLabel = wkNr ? "week " + wkNr : _agDateLabel(date);
      fetchDeclarabiliteitSummary(date).then(function(rs) {
        if (_regOvKey !== key || !_regOvPanel) return;
        body.innerHTML = "";
        body.appendChild(agendaRegistrationsSectionEl(rs, wkLabel, prof));
      }, function(e) {
        if (_regOvKey !== key || !_regOvPanel) return;
        body.textContent = "Kon declarabiliteit niet laden: " + (e && e.message || "fout");
      });
    } catch (e) {
    }
  }

  // src/content/features/registration/input-handlers.js
  function onRegistrationReportInput(e) {
    if (!helperPanel.helperEnabled) return;
    if (helperPanel.activeMode !== "registrations" || isOwnPopup(e.target)) return;
    const el = e.target;
    refreshRegistrationPrereqScreen();
    const idName = `${el && el.id || ""} ${el && el.name || ""}`;
    if (/declaration_(start|end)_time|declaration_(in)?direct_time|declaration_travel_time/.test(idName) || el && (el.className || "").includes("js-time")) {
      scheduleReapplyRegistrationSplit();
      persistRegistrationTimes();
      updateRegistrationSubmitGuard();
      return;
    }
    const fields = registrationReportTextFields();
    const field2 = fields.includes(el) ? el : fields.find((candidate) => candidate.contains && candidate.contains(el));
    if (!field2) return;
    updateRegistrationSubmitGuard();
    checkRegistrationNoShowText();
    checkRegistrationEpisodesText();
  }
  function onRegistrationTimeInteract(e) {
    if (!helperPanel.helperEnabled || helperPanel.activeMode !== "registrations" || !e || isOwnPopup(e.target)) return;
    const el = e.target;
    const idName = `${el && el.id || ""} ${el && el.name || ""}`;
    if (/declaration_(start|end)_time|declaration_(in)?direct_time/.test(idName) || el && (el.className || "").includes("js-time")) {
      scheduleReapplyRegistrationSplit();
    }
  }
  function onRegistrationReportFocus(e) {
    if (!helperPanel.helperEnabled) return;
    if (helperPanel.activeMode !== "registrations" || isOwnPopup(e.target)) return;
    const fields = registrationReportTextFields();
    const field2 = fields.includes(e.target) ? e.target : fields.find((candidate) => candidate.contains && candidate.contains(e.target));
    if (!field2) return;
    if (field2 === registrationPrimaryReportField()) ensureActiveRegistrationReportPrefix(field2);
    updateRegistrationSubmitGuard();
  }

  // src/content/helper/lifecycle.js
  function activate(mode) {
    if (helperPanel.active && helperPanel.activeMode === mode) return;
    if (helperPanel.active && helperPanel.activeMode !== mode) deactivate();
    if (typeof agendaHelperDeactivate === "function") {
      try {
        agendaHelperDeactivate();
      } catch (e) {
      }
    }
    helperPanel.active = true;
    helperPanel.activeMode = mode;
    helperPanel.userPos = null;
    registrationFlow.registrationTravelClicked = false;
    registrationFlow.registrationFlowBusy = false;
    registrationFlow.registrationHourTypeBusy = false;
    if (mode === "registrations") safe(loadPendingRegistrationLabel);
    safe(ensureMounted);
    helperPanel.observer = new MutationObserver((muts) => {
      let modalAdded = false;
      const own = muts.every((mm) => {
        if (!modalAdded && mm.addedNodes && mm.addedNodes.length) {
          for (const n of mm.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (n.matches && n.matches('uc-modal,[role="dialog"],dialog') || n.querySelector && n.querySelector('uc-modal,[role="dialog"],dialog')) {
              modalAdded = true;
              break;
            }
          }
        }
        return helperPanel.popupEl && (helperPanel.popupEl.contains(mm.target) || mm.target === helperPanel.popupEl);
      });
      if (!own) {
        helperPanel.lastDomMutationAt = Date.now();
        if (modalAdded) safe(maybeDismissStrayInviteeModal);
        scheduleMount();
      }
    });
    helperPanel.observer.observe(document.documentElement, { childList: true, subtree: true });
    if (helperPanel.activeMode !== "registrations") {
      document.addEventListener("click", blockSubmitIfNoUursoort, true);
      document.addEventListener("submit", blockSubmitIfNoUursoort, true);
      document.addEventListener("input", onAppointmentInput, true);
      document.addEventListener("change", onAppointmentInput, true);
    } else {
      document.addEventListener("input", onRegistrationReportInput, true);
      document.addEventListener("change", onRegistrationReportInput, true);
      document.addEventListener("focusout", onRegistrationTimeInteract, true);
      document.addEventListener("focusin", onRegistrationReportFocus, true);
      document.addEventListener("click", blockRegistrationSubmitIfReportEmpty, true);
      document.addEventListener("submit", blockRegistrationSubmitIfReportEmpty, true);
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    helperPanel.repositionTimer = setInterval(() => safe(() => {
      if (!document.hasFocus()) return;
      if (!helperPanel.helperEnabled) {
        reposition();
        return;
      }
      invalidateClientEntries();
      if (helperPanel.activeMode !== "registrations") {
        refreshAppointmentPrereqScreen();
        updateSubmitGuard();
      } else {
        updateRegistrationSubmitGuard();
      }
      reposition();
    }), 250);
  }
  function deactivate() {
    if (!helperPanel.active) return;
    helperPanel.active = false;
    if (helperPanel.observer) {
      helperPanel.observer.disconnect();
      helperPanel.observer = null;
    }
    document.removeEventListener("click", blockSubmitIfNoUursoort, true);
    document.removeEventListener("submit", blockSubmitIfNoUursoort, true);
    document.removeEventListener("input", onAppointmentInput, true);
    document.removeEventListener("change", onAppointmentInput, true);
    document.removeEventListener("input", onRegistrationReportInput, true);
    document.removeEventListener("change", onRegistrationReportInput, true);
    document.removeEventListener("focusout", onRegistrationTimeInteract, true);
    document.removeEventListener("focusin", onRegistrationReportFocus, true);
    document.removeEventListener("click", blockRegistrationSubmitIfReportEmpty, true);
    document.removeEventListener("submit", blockRegistrationSubmitIfReportEmpty, true);
    window.removeEventListener("scroll", reposition, true);
    window.removeEventListener("resize", reposition);
    clearInterval(helperPanel.repositionTimer);
    appointmentFlow.knownClientNames.clear();
    appointmentFlow.autoSelectingNewClient = false;
    appointmentFlow.uursoortQueueGen++;
    appointmentFlow.uursoortQueueActive = false;
    appointmentFlow.appointmentFlowBusy = false;
    clearTimeout(registrationFlow.registrationSettleTimer);
    registrationFlow.registrationSettleTimer = null;
    appointmentFlow.pendingChoice = null;
    appointmentFlow.appointmentTypeApplied = false;
    appointmentFlow.helperEndText = "";
    appointmentFlow.appointmentEndTimeUserOwned = false;
    appointmentFlow.appointmentAwaitingManualUursoort = false;
    registrationFlow.registrationTravelClicked = false;
    registrationFlow.registrationFlowBusy = false;
    registrationFlow.registrationHourTypeBusy = false;
    registrationFlow.registrationNoShowPromptOpen = false;
    registrationFlow.registrationNoShowPromptSuppressed = false;
    registrationFlow.registrationEpisodesPromptOpen = false;
    registrationFlow.registrationEpisodesPromptSuppressed = false;
    registrationFlow.activeRegistrationChoice = null;
    registrationFlow.activeRegistrationHourTypeIndex = null;
    registrationFlow.registrationAutoChoice = null;
    registrationFlow.registrationFromAppointment = false;
    registrationFlow.registrationAutoApplied = false;
    clearScreenMark();
    helperPanel.activeMode = null;
    removePopup();
  }

  // src/content/helper/routing.js
  function activationDomainsOk() {
    try {
      const d = APP_CONFIG.activation && APP_CONFIG.activation.domains || [];
      if (!Array.isArray(d) || !d.length) return true;
      const host = (location.hostname || "").toLowerCase();
      return d.some((dom) => {
        dom = String(dom || "").trim().toLowerCase();
        return dom && host.indexOf(dom) !== -1;
      });
    } catch (e) {
      return true;
    }
  }
  function syncWithUrl() {
    forgetStaleDuplicates();
    if (!helperConfigReady) return;
    if (!RUNTIME_CONFIG.enabled) {
      deactivate();
      removeRegistrationsOverviewPanel();
      return;
    }
    if (!activationDomainsOk()) {
      deactivate();
      removeRegistrationsOverviewPanel();
      return;
    }
    const wantEvents = (HELPER_SCOPE === "all" || HELPER_SCOPE === "events") && RUNTIME_CONFIG.appointmentHelperEnabled;
    const wantRegistrations = (HELPER_SCOPE === "all" || HELPER_SCOPE === "registrations") && RUNTIME_CONFIG.registrationHelperEnabled;
    if (wantEvents && location.href.includes(CONFIG.urlNeedle)) {
      activate("events");
      applyPendingAppointment();
    } else if (wantRegistrations && location.href.includes(CONFIG.registrationNeedle) && isRegistrationEditOrNew()) activate("registrations");
    else deactivate();
    updateRegistrationsOverviewPanel();
  }
  var _lastHref = location.href;
  function installUrlWatch() {
    for (const m of ["pushState", "replaceState"]) {
      const orig = history[m];
      history[m] = function() {
        const r = orig.apply(this, arguments);
        window.dispatchEvent(new Event("locationchange"));
        return r;
      };
    }
    window.addEventListener("popstate", () => window.dispatchEvent(new Event("locationchange")));
    window.addEventListener("locationchange", syncWithUrl);
    _lastHref = location.href;
    setInterval(() => {
      if (location.href !== _lastHref) {
        _lastHref = location.href;
        window.dispatchEvent(new Event("locationchange"));
      }
    }, 250);
  }

  // src/content/features/agenda/state.js
  var STORE_GREY_ENABLED = PAGE_LOCAL.GREY_ENABLED;
  var agendaPage = {
    active: false,
    // draait de agendahulp op deze pagina?
    observer: null,
    // MutationObserver die de inkleuring bijwerkt
    pollTimer: null,
    // rustige terugval-tik voor de inkleuring
    totalsTimer: null,
    // 300 ms-tik: ongeregistreerde tijd, badge, zijpaneel
    greyEnabled: storageGet(STORE_GREY_ENABLED, "1") !== "0",
    // gekleurde dagindeling aan/uit
    // Het gekozen profiel komt uit de extensie-popup (chrome.storage.sync, zodat
    // de keuze meereist naar andere apparaten). Async geladen, live bijgewerkt.
    currentProfile: null,
    // Weekoverzicht (API) voor het zijpaneel
    _agLastWeek: null,
    // laatst opgehaalde weekoverzicht
    _agWeekError: "",
    // laatste ophaalfout, zodat het zijpaneel hem kan tonen
    _agWeekKey: null,
    _agWeekBusy: false,
    _agWeekLoaded: false,
    _agLastInviteeId: null,
    // laatst bekende invitee-id (terugval tijdens een weergavewissel)
    _agLastEntries: [],
    // laatst opgehaalde week-entries (voor cliënt-check "nog te registreren")
    // Laatst berekende declarabiliteit (gezet zodra het weekoverzicht er is), zodat
    // de momentopname hem kan meenemen.
    _agLastDeclarabiliteit: null,
    sidePanelOpen: false,
    _agStateSig: ""
    // laatst uitgezonden toestand (alleen bij wijziging zenden)
  };

  // src/content/features/agenda/zones.js
  var COLOR_ROOD = "rgba(220,70,70,0.15)";
  var COLOR_GEEL = "rgba(235,205,70,0.20)";
  var COLOR_BLAUW = "rgba(70,130,210,0.16)";
  var COLOR_GROEN = "rgba(60,170,90,0.18)";
  var ZONES_JGGZ = [
    { from: 8, to: 8.5, color: COLOR_ROOD, label: "Dagstart" },
    { from: 8.5, to: 11.5, color: COLOR_GEEL, label: "Cliëntafspraken" },
    { from: 11.5, to: 12, color: COLOR_ROOD, label: "Administratie" },
    { from: 12, to: 12.5, color: COLOR_BLAUW, label: "Pauze" },
    { from: 12.5, to: 14, color: COLOR_GEEL, label: "Cliëntafspraken" },
    { from: 14, to: 14.75, color: COLOR_ROOD, label: "Administratie" },
    { from: 14.75, to: 16.25, color: COLOR_GEEL, label: "Cliëntafspraken" },
    { from: 16.25, to: 17, color: COLOR_GROEN, label: "Vergadering" }
  ];
  var LEGEND_JGGZ = [
    { color: "rgba(220,70,70,0.45)", text: "Dagstart / administratie" },
    { color: "rgba(235,205,70,0.65)", text: "Cliëntafspraken" },
    { color: "rgba(70,130,210,0.45)", text: "Pauze" },
    { color: "rgba(60,170,90,0.50)", text: "Vergadering" }
  ];
  var ZONES_JO = [
    { from: 8, to: 8.5, color: COLOR_GEEL, label: "Administratie (indirect)" },
    { from: 8.5, to: 12, color: COLOR_ROOD, label: "Huisbezoek (direct)" },
    { from: 12, to: 12.5, color: COLOR_BLAUW, label: "Pauze" },
    { from: 12.5, to: 14, color: COLOR_ROOD, label: "Huisbezoek (direct)" },
    { from: 14, to: 14.75, color: COLOR_GEEL, label: "Administratie (indirect)" },
    { from: 14.75, to: 16.25, color: COLOR_ROOD, label: "Huisbezoek (direct)" },
    { from: 16.25, to: 17, color: COLOR_GROEN, label: "Vergadering" }
  ];
  var LEGEND_JO = [
    { color: "rgba(220,70,70,0.45)", text: "Huisbezoek (direct)" },
    { color: "rgba(235,205,70,0.65)", text: "Administratie (indirect)" },
    { color: "rgba(70,130,210,0.45)", text: "Pauze" },
    { color: "rgba(60,170,90,0.50)", text: "Vergadering" }
  ];
  var PROFILES = {
    "JGGZ": { label: "JGGZ", zones: ZONES_JGGZ, legend: LEGEND_JGGZ },
    "J&O/JBG": { label: "J&O/JBG", zones: ZONES_JO, legend: LEGEND_JO }
  };
  function _hmToDec(s) {
    const m = String(s || "").match(/^(\d{1,2}):(\d{2})$/);
    return m ? +m[1] + +m[2] / 60 : null;
  }
  function _paletteFill(name) {
    const p = (APP_CONFIG.palette || {})[name];
    return p && p.fill ? p.fill : COLOR_ROOD;
  }
  function _paletteLegend(name) {
    const p = (APP_CONFIG.palette || {})[name];
    return p && p.legend ? p.legend : "rgba(120,120,120,0.4)";
  }
  function configProfileZones(key) {
    const prof = (APP_CONFIG.zoneProfiles || {})[key];
    if (!Array.isArray(prof)) return null;
    const out = prof.map((z) => ({ from: _hmToDec(z.start), to: _hmToDec(z.end), color: _paletteFill(z.color), label: z.zone })).filter((z) => z.from != null && z.to != null);
    return out.length ? out : null;
  }
  function configProfileLegend(key) {
    const prof = (APP_CONFIG.zoneProfiles || {})[key];
    if (!Array.isArray(prof)) return null;
    const seen = /* @__PURE__ */ new Map();
    for (const z of prof) {
      if (!seen.has(z.color)) seen.set(z.color, /* @__PURE__ */ new Set());
      seen.get(z.color).add(z.zone);
    }
    return [...seen.entries()].map(([c, names]) => ({ color: _paletteLegend(c), text: [...names].join(" / ") }));
  }
  function profileExists(key) {
    return !!(key && APP_CONFIG.zoneProfiles && APP_CONFIG.zoneProfiles[key]);
  }
  function activeZones() {
    return agendaPage.currentProfile && configProfileZones(agendaPage.currentProfile) || configProfileZones("JGGZ") || ZONES_JGGZ;
  }
  function activeLegend() {
    return agendaPage.currentProfile && configProfileLegend(agendaPage.currentProfile) || configProfileLegend("JGGZ") || LEGEND_JGGZ;
  }
  function workdayWindowLabel() {
    const z = activeZones();
    if (!z || !z.length) return "08:00–17:00";
    const hm2 = (d) => {
      const h = Math.floor(d), m = Math.round((d - h) * 60);
      return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    };
    return hm2(Math.min.apply(null, z.map((x) => x.from))) + "–" + hm2(Math.max.apply(null, z.map((x) => x.to)));
  }

  // src/content/features/agenda/painting.js
  var CLASS = "ons-helper-offhours";
  var rafPending = false;
  function ensureStyle() {
    if (document.getElementById("ons-helper-offhours-style")) return;
    const st = document.createElement("style");
    st.id = "ons-helper-offhours-style";
    st.textContent = "." + CLASS + "{position:absolute;left:0;right:0;background:rgba(120,120,120,0.14);pointer-events:none;z-index:0;}";
    (document.head || document.documentElement).appendChild(st);
  }
  function dayColumns() {
    return Array.from(document.querySelectorAll(ONS.dayColumn));
  }
  function ensureSeg(col, seg) {
    let el = col.querySelector(":scope > ." + CLASS + '[data-seg="' + seg + '"]');
    if (!el) {
      el = document.createElement("div");
      el.className = CLASS;
      el.setAttribute("data-seg", seg);
      col.appendChild(el);
    }
    return el;
  }
  function clearColumn(col) {
    try {
      col.querySelectorAll(":scope > ." + CLASS).forEach((el) => el.remove());
    } catch (e) {
    }
  }
  function isWeekendColumn(col) {
    const td = col.closest && col.closest(ONS.dayColumnCell);
    if (td && ONS.weekendClassRe.test(td.className)) return true;
    const date = col.getAttribute("data-date");
    if (date) {
      const d = /* @__PURE__ */ new Date(date + "T00:00:00");
      if (!isNaN(d)) {
        const wd = d.getDay();
        if (wd === 0 || wd === 6) return true;
      }
    }
    return false;
  }
  function paintColumn(col) {
    if (dayColumnLooksFree(col) || isWeekendColumn(col)) {
      clearColumn(col);
      return;
    }
    const h = col.clientHeight || col.getBoundingClientRect().height;
    if (!h || h < 100) return;
    const pxPerHour = h / 24;
    const pos = getComputedStyle(col).position;
    if (pos === "static") col.style.position = "relative";
    col.querySelectorAll(":scope > ." + CLASS + '[data-seg="top"], :scope > .' + CLASS + '[data-seg="bottom"]').forEach((el) => el.remove());
    const zones = activeZones();
    zones.forEach(function(z, i) {
      const el = ensureSeg(col, "zone" + i);
      el.style.background = z.color;
      el.style.top = Math.round(z.from * pxPerHour) + "px";
      el.style.height = Math.max(0, Math.round((z.to - z.from) * pxPerHour)) + "px";
    });
    col.querySelectorAll(":scope > ." + CLASS + '[data-seg^="zone"]').forEach(function(el) {
      const idx = parseInt((el.getAttribute("data-seg") || "").replace("zone", ""), 10);
      if (!isNaN(idx) && idx >= zones.length) el.remove();
    });
  }
  function paintAll() {
    rafPending = false;
    if (!agendaPage.active) return;
    if (!agendaPage.greyEnabled) {
      removeAll();
      return;
    }
    if (!agendaPage.currentProfile) {
      removeAll();
      return;
    }
    ensureStyle();
    const cols = dayColumns();
    for (const col of cols) {
      try {
        paintColumn(col);
      } catch (e) {
      }
    }
  }
  function schedulePaint() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(paintAll);
  }
  function removeAll() {
    document.querySelectorAll("." + CLASS).forEach((el) => el.remove());
  }

  // src/content/features/agenda/occurrences.js
  var SKIP_RE = /vaste vrije dag|vrije dag/;
  var CLIENT_LABEL_RE = /huisbezoek|telefonisch|face ?(to|2) ?face|\bmdo\b|verslaglegging|zorgco|no ?show|behandel|consult|gesprek/i;
  function _hasText(el) {
    return !!(el && (el.textContent || "").trim());
  }
  function isClientAppointment(occ) {
    const main = occ.querySelector(ONS.occurrenceTitle) || occ;
    if (_hasText(main.querySelector(".name")) && _hasText(main.querySelector(".title"))) return true;
    const at = occ.querySelector(ONS.appointmentTitle);
    if (_hasText(at)) return true;
    let labels;
    try {
      labels = occ.querySelectorAll(ONS.labelWithTitle);
    } catch (e) {
      labels = [];
    }
    for (const l of labels) {
      const t = l.getAttribute("title") || "";
      if (/\boverig\b/i.test(t)) continue;
      if (CLIENT_LABEL_RE.test(t)) return true;
    }
    return false;
  }
  function occurrenceName(occ) {
    const at = occ.querySelector(ONS.appointmentTitle);
    if (_hasText(at)) return at.textContent.trim();
    const tt = occ.querySelector(".title");
    if (_hasText(tt)) return tt.textContent.trim();
    const nm = occ.querySelector(".name");
    if (_hasText(nm)) return nm.textContent.trim();
    return "(zonder titel)";
  }
  function classifyOccurrence(occ) {
    const tt = occ.querySelector(".title");
    const txt = (tt && tt.textContent || "").toLowerCase();
    if (SKIP_RE.test(txt)) return "skip";
    return isClientAppointment(occ) ? "client" : "overig";
  }
  function isDeclared(occ) {
    const main = occ.querySelector(ONS.occurrenceTitle) || occ;
    const cl = " " + (main.className || "") + " ";
    if (ONS.notDeclaredRe.test(cl)) return false;
    return ONS.declaredRe.test(cl);
  }
  function occurrenceIsPast(occ, date) {
    const time = occ.getAttribute("data-time") || "00:00";
    const dur = parseInt(occ.getAttribute("data-duration"), 10) || 0;
    const start = /* @__PURE__ */ new Date(date + "T" + (/^\d{2}:\d{2}$/.test(time) ? time : "00:00") + ":00");
    if (isNaN(start)) return false;
    return start.getTime() + dur * 6e4 <= Date.now();
  }
  function occurrenceOverdue24h(occ, date) {
    const time = occ.getAttribute("data-time") || "00:00";
    const dur = parseInt(occ.getAttribute("data-duration"), 10) || 0;
    const start = /* @__PURE__ */ new Date(date + "T" + (/^\d{2}:\d{2}$/.test(time) ? time : "00:00") + ":00");
    if (isNaN(start)) return false;
    const lateH = APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.lateThresholdHours > 0 ? APP_CONFIG.generalSettings.lateThresholdHours : 24;
    return start.getTime() + dur * 6e4 <= Date.now() - lateH * 60 * 60 * 1e3;
  }
  function isWontDeclare(occ) {
    return !!(occ.querySelector(".wont-declare") || (occ.className || "").indexOf("wont-declare") !== -1);
  }
  function openOccurrence(occ) {
    if (!occ) return;
    try {
      occ.scrollIntoView({ block: "center", inline: "center" });
    } catch (e) {
    }
    const target = occ.querySelector(ONS.occurrenceTitle) || occ;
    try {
      target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    } catch (e) {
    }
    try {
      target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    } catch (e) {
    }
    try {
      target.click();
    } catch (e) {
    }
  }

  // src/content/features/agenda/extension-sync.js
  var _lastBadge = -1;
  function pushBadge(count) {
    if (count === _lastBadge) return;
    _lastBadge = count;
    try {
      chrome.runtime.sendMessage({ type: MSG.BADGE, count });
    } catch (e) {
    }
  }
  var _lastSummaryKey = "";
  function pushSummary(res) {
    try {
      const past = res && res.past || {};
      const days = Object.keys(past).map(function(d) {
        return { date: d, client: past[d].client | 0, overig: past[d].overig | 0, late: past[d].lateMin | 0 };
      }).filter(function(d) {
        return d.client + d.overig > 0;
      });
      const openMinutes = days.reduce(function(t, d) {
        return t + d.client + d.overig;
      }, 0);
      const lateMinutes = days.reduce(function(t, d) {
        return t + d.late;
      }, 0);
      const fut = res && res.future || { client: 0, overig: 0 };
      const dec = agendaPage._agLastDeclarabiliteit;
      const msg = {
        type: MSG.SUMMARY,
        openDays: days.length,
        openMinutes,
        lateMinutes,
        futureMinutes: (fut.client | 0) + (fut.overig | 0),
        directPct: dec ? dec.pct : null,
        normPct: dec ? dec.targetPct : null,
        week: agendaWeekNumber(currentAgendaDate()) || null,
        days
      };
      const key = JSON.stringify(msg);
      if (key === _lastSummaryKey) return;
      _lastSummaryKey = key;
      chrome.runtime.sendMessage(msg);
    } catch (e) {
    }
  }
  function updateTotals(res) {
    res = res || (agendaPage._agLastEntries && agendaPage._agLastEntries.length ? computeTotalsApi() : computeTotals());
    var past = res.past || {};
    var dagen = Object.keys(past).filter(function(d) {
      return past[d].client + past[d].overig > 0;
    });
    pushBadge(dagen.length);
    pushSummary(res);
    pushPanelState();
  }

  // src/content/domain/hour-types.js
  function _nonClientMarkers() {
    var set = ["*"];
    var mk = _nonClientMarker();
    if (mk && set.indexOf(mk) === -1) set.push(mk);
    return set;
  }
  function _nonClientCategoryUursoorten() {
    var out = [];
    try {
      var cats = typeof APP_CONFIG !== "undefined" && APP_CONFIG && APP_CONFIG.nonClientCategories || [];
      cats.forEach(function(cat) {
        if (!cat) return;
        (cat.options || []).forEach(function(o) {
          if (o && o.uursoort) out.push(String(o.uursoort));
        });
        if (cat.directOption && cat.directOption.uursoort) out.push(String(cat.directOption.uursoort));
      });
    } catch (e) {
    }
    return out;
  }
  function _isClientUursoortName(name) {
    var s = String(name == null ? "" : name);
    var low = s.trim().toLowerCase();
    if (!low) return true;
    var cats = _nonClientCategoryUursoorten();
    for (var c = 0; c < cats.length; c++) {
      if (String(cats[c] || "").trim().toLowerCase() === low) return false;
    }
    var marks = _nonClientMarkers();
    for (var m = 0; m < marks.length; m++) {
      if (marks[m] && s.indexOf(marks[m]) !== -1) return false;
    }
    var list = _nonClientUursoortList();
    for (var i = 0; i < list.length; i++) {
      var n = String(list[i] || "").trim().toLowerCase();
      if (n && low.indexOf(n) !== -1) return false;
    }
    return true;
  }

  // src/content/features/agenda/week-overview.js
  function apiClientPresentById(id) {
    if (id == null || !agendaPage._agLastEntries.length) return null;
    var key = String(id);
    for (var i = 0; i < agendaPage._agLastEntries.length; i++) {
      if (String(agendaPage._agLastEntries[i].id) === key) return !!agendaPage._agLastEntries[i].clientPresent;
    }
    return null;
  }
  function refreshAgendaWeekApi() {
    const id = currentInviteeId() || resolveInviteeId() || agendaPage._agLastInviteeId;
    if (id) agendaPage._agLastInviteeId = id;
    const ids = currentInviteeIds().length > 1 ? currentInviteeIds() : id ? [String(id)] : [];
    const view = currentCalendarView();
    const date = currentAgendaDate();
    if (!id) {
      agendaPage._agWeekKey = null;
      agendaPage._agWeekLoaded = false;
      agendaPage._agLastWeek = null;
      agendaPage._agWeekError = "";
      return;
    }
    const key = ids.join(",") + "|" + date + "|" + view;
    if (key === agendaPage._agWeekKey && agendaPage._agWeekLoaded) return;
    if (agendaPage._agWeekBusy && key === agendaPage._agWeekKey) return;
    const andereWeek = key !== agendaPage._agWeekKey;
    agendaPage._agWeekBusy = true;
    agendaPage._agWeekKey = key;
    if (andereWeek) {
      agendaPage._agLastWeek = null;
      agendaPage._agWeekError = "";
    }
    try {
      pushPanelState(true);
    } catch (e) {
    }
    var prof = typeof ACTIVE_PROFILE !== "undefined" ? ACTIVE_PROFILE : null;
    var toekomst = _agIsFutureWeek(date);
    var basisOpts = function() {
      return toekomst ? { week: agendaWeekNumber(date), embedded: true, scope: view === "day" ? "dag" : "week", profile: prof, date } : { week: agendaWeekNumber(date), embedded: true, scope: "week", profile: prof, date, perLabel: "Per uursoort", headerHint: "geregistreerd", unknownLabel: "Overig" };
    };
    var splits = function(summary) {
      var clientRows = [], overigRows = [];
      (summary.byType || []).forEach(function(r) {
        if (r && r.type && !_isClientUursoortName(r.type)) overigRows.push(r);
        else clientRows.push(r);
      });
      return { clientRows, overigRows };
    };
    var haal = function(inv, eerste) {
      if (!toekomst) {
        if (eerste) {
          fetchInviteeWeek(inv, date).then(function(entries) {
            if (agendaPage._agWeekKey === key) agendaPage._agLastEntries = (entries || []).slice();
          }, function() {
          }).then(function() {
            if (agendaPage._agWeekKey === key) safe(updateTotals);
          });
        }
        return fetchWeekRegistrationDeclarabiliteit(inv, date);
      }
      return fetchInviteeWeek(inv, date).then(function(entries) {
        if (eerste && agendaPage._agWeekKey === key) agendaPage._agLastEntries = entries.slice();
        if (view === "day") entries = entries.filter(function(e) {
          return e.date === date;
        });
        var now = Date.now();
        entries = entries.filter(function(e) {
          return e.startMs == null || e.startMs >= now;
        });
        return summarizeAgendaWeek(entries);
      });
    };
    var errHandler = function(e) {
      if (agendaPage._agWeekKey !== key) return;
      agendaPage._agWeekLoaded = false;
      agendaPage._agLastWeek = null;
      agendaPage._agWeekError = "Overzicht kon niet laden: " + (e && e.message || "fout");
    };
    var klaar = function() {
      agendaPage._agWeekBusy = false;
      try {
        pushPanelState(true);
      } catch (e) {
      }
    };
    Promise.all(ids.map(function(inv, i) {
      return haal(inv, i === 0);
    })).then(function(summaries) {
      if (agendaPage._agWeekKey !== key) return;
      var o = basisOpts();
      try {
        agendaPage._agLastDeclarabiliteit = declarabiliteitPct(summaries[0], prof);
      } catch (e) {
        agendaPage._agLastDeclarabiliteit = null;
      }
      var eerste = splits(summaries[0]);
      agendaPage._agLastWeek = {
        summary: summaries[0],
        opts: o,
        clientRows: eerste.clientRows,
        overigRows: eerste.overigRows,
        // Per collega (ook bij één medewerker, dan met één element).
        perInvitee: summaries.map(function(s, i) {
          return { id: ids[i], name: ids.length > 1 ? inviteeName(ids[i]) : "", summary: s };
        })
      };
      agendaPage._agWeekError = "";
      agendaPage._agWeekLoaded = true;
    }).catch(errHandler).then(klaar);
  }

  // src/content/features/agenda/unregistered-time.js
  function computeTotals() {
    const past = {};
    const future = { client: 0, overig: 0 };
    let occs;
    try {
      occs = document.querySelectorAll(ONS.occurrenceBase);
    } catch (e) {
      return { past, future };
    }
    const seen = /* @__PURE__ */ new Set();
    occs.forEach((occ) => {
      if (occ.getAttribute("data-type") !== "event") return;
      const date = occ.getAttribute("data-date");
      if (!date) return;
      const id = occ.getAttribute("data-id");
      if (id) {
        if (seen.has(id)) return;
        seen.add(id);
      }
      if (isWontDeclare(occ)) return;
      const cls = classifyOccurrence(occ);
      if (cls === "skip") return;
      const dur = parseInt(occ.getAttribute("data-duration"), 10) || 0;
      if (occurrenceIsPast(occ, date)) {
        if (isDeclared(occ)) return;
        if (!past[date]) past[date] = { client: 0, overig: 0, lateMin: 0, lateCount: 0 };
        past[date][cls] += dur;
        if (occurrenceOverdue24h(occ, date)) {
          past[date].lateMin += dur;
          past[date].lateCount++;
        }
      } else {
        future[cls] += dur;
      }
    });
    return { past, future };
  }
  function computeTotalsApi() {
    var past = {}, future = { client: 0, overig: 0 };
    var now = Date.now();
    var entries = agendaPage._agLastEntries || [];
    var lateH = APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.lateThresholdHours > 0 ? APP_CONFIG.generalSettings.lateThresholdHours : 24;
    entries.forEach(function(e) {
      var c = classifyAgendaEntry(e, now, lateH * 36e5);
      if (!c) return;
      if (c.past) {
        if (c.declared) return;
        if (!past[c.date]) past[c.date] = { client: 0, overig: 0, lateMin: 0, lateCount: 0 };
        past[c.date][c.cls] += c.minutes;
        if (c.late) {
          past[c.date].lateMin += c.minutes;
          past[c.date].lateCount++;
        }
      } else {
        future[c.cls] += c.minutes;
      }
    });
    return { past, future };
  }
  function listUnfinished() {
    const out = [];
    let occs;
    try {
      occs = document.querySelectorAll(ONS.occurrenceBase);
    } catch (e) {
      return out;
    }
    const seen = /* @__PURE__ */ new Set();
    occs.forEach((occ) => {
      if (occ.getAttribute("data-type") !== "event") return;
      const date = occ.getAttribute("data-date");
      if (!date) return;
      const id = occ.getAttribute("data-id");
      if (id) {
        if (seen.has(id)) return;
        seen.add(id);
      }
      if (isWontDeclare(occ)) return;
      if (classifyOccurrence(occ) === "skip") return;
      if (isDeclared(occ)) return;
      var apiClient = apiClientPresentById(id);
      var isClient = apiClient != null ? apiClient : isClientAppointment(occ);
      out.push({ id: id || "", name: occurrenceName(occ), time: occ.getAttribute("data-time") || "", client: isClient, el: occ });
    });
    out.sort((a, b) => a.time.localeCompare(b.time));
    return out;
  }

  // src/content/features/agenda/edit-window.js
  function editableWindowStart() {
    let raw = _presenceDeadlineOverride || "";
    if (!raw) {
      let scripts;
      try {
        scripts = document.querySelectorAll("script");
      } catch (e) {
        return null;
      }
      for (const s of scripts) {
        const t = s.textContent || "";
        if (t.indexOf("presence_log_deadline_date") === -1) continue;
        const m = t.match(/"presence_log_deadline_date"\s*:\s*"([^"]+)"/);
        if (m && m[1]) {
          raw = m[1];
          break;
        }
      }
    }
    const dm = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dm) return null;
    return new Date(+dm[1], +dm[2] - 1, +dm[3]);
  }
  function windowStatusForDate(dateStr, windowStart) {
    if (!windowStart) return null;
    const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
    if (isNaN(d)) return null;
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((dd.getTime() - windowStart.getTime()) / 864e5);
    if (diff < 0) return "locked";
    if (diff <= 7) return "soon";
    return null;
  }

  // src/content/domain/leave.js
  var WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  var WEEKDAY_LABELS = { monday: "ma", tuesday: "di", wednesday: "wo", thursday: "do", friday: "vr", saturday: "za", sunday: "zo" };
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  var DEFAULT_TYPES = { daily: "daily", weekly: "weekly" };
  function parseDate(s) {
    if (!DATE_RE.test(s || "")) return null;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
  }
  function weekdayOf(date) {
    const dt = parseDate(date);
    return dt ? WEEKDAYS[(dt.getUTCDay() + 6) % 7] : null;
  }
  function buildUnavailability(form, opts = {}) {
    const maxDays = opts.maxDays || 366;
    const types = Object.assign({}, DEFAULT_TYPES, opts.recurrenceTypes || {});
    const description = String(form.description || "").trim();
    if (!description) return { error: "Vul een omschrijving in." };
    const from = parseDate(form.date);
    if (!from) return { error: "Vul een geldige begindatum in." };
    let startTime = form.startTime;
    let endTime = form.endTime;
    if (form.allDay) {
      startTime = "00:00";
      endTime = "00:00";
    } else {
      if (!TIME_RE.test(startTime || "")) return { error: "Vul een geldige begintijd in." };
      if (!TIME_RE.test(endTime || "")) return { error: "Vul een geldige eindtijd in." };
      if (endTime <= startTime) return { error: "De eindtijd moet na de begintijd liggen." };
    }
    const u = { description, valid_from: form.date, start_time: startTime, end_time: endTime };
    const recurrence = form.recurrence || "none";
    if (recurrence === "none") return { unavailability: u };
    if (!types[recurrence]) return { error: "Onbekende herhaling." };
    const interval = Number(form.interval);
    if (!Number.isInteger(interval) || interval < 1 || interval > 99) return { error: 'Vul bij "Herhaal iedere" een getal van 1 tot 99 in.' };
    const until = parseDate(form.until);
    if (!until) return { error: "Vul in tot wanneer het herhaalt." };
    if (until < from) return { error: '"Herhaal tot" ligt vóór de begindatum.' };
    if ((until - from) / 864e5 + 1 > maxDays) return { error: "Een herhaling mag hooguit " + maxDays + " dagen beslaan." };
    let days;
    if (recurrence === "weekly") {
      days = WEEKDAYS.filter((d) => (form.weekdays || []).indexOf(d) >= 0);
      if (!days.length) return { error: "Kies minstens één weekdag." };
    } else {
      days = [weekdayOf(form.date)];
    }
    u.recurrence_type = types[recurrence];
    u.cycle_interval = String(interval);
    u.valid_to = form.until;
    days.forEach((d) => {
      u[d] = true;
    });
    return { unavailability: u };
  }
  function describeUnavailability(u, recurrence, dateLabel) {
    const label = dateLabel || ((d) => d);
    const tijd = u.start_time === "00:00" && u.end_time === "00:00" ? "hele dag" : u.start_time + "–" + u.end_time;
    if (!recurrence || recurrence === "none") return label(u.valid_from) + " · " + tijd;
    const n = Number(u.cycle_interval);
    const weekly = WEEKDAYS.filter((d) => u[d]);
    const elke = recurrence === "daily" ? n === 1 ? "Elke dag" : "Elke " + n + " dagen" : (n === 1 ? "Elke week" : "Elke " + n + " weken") + " op " + weekly.map((d) => WEEKDAY_LABELS[d]).join(", ");
    return elke + " · " + label(u.valid_from) + " t/m " + label(u.valid_to) + " · " + tijd;
  }

  // src/content/services/ons-api/unavailability.js
  async function createUnavailability(employeeId, unavailability) {
    await postJson(_apiUrl("unavailabilities"), {
      unavailability: Object.assign({ employee_id: Number(employeeId) }, unavailability)
    });
  }

  // src/content/features/leave/leave-request.js
  var MODAL_ID = "onsah-leave-modal";
  var RELOAD_DELAY_MS = 1500;
  function settings() {
    const s = APP_CONFIG && APP_CONFIG.leaveRequest || {};
    return {
      description: typeof s.description === "string" && s.description.trim() || "Verlof",
      // Alleen een https-adres; anders niet openen.
      redirectUrl: typeof s.redirectUrl === "string" && /^https:\/\//i.test(s.redirectUrl) ? s.redirectUrl : "",
      maxDays: Number(s.maxDays) > 0 ? Number(s.maxDays) : 366,
      recurrenceTypes: s.recurrenceTypes && typeof s.recurrenceTypes === "object" ? s.recurrenceTypes : void 0
    };
  }
  function leaveRequestEnabled() {
    return !(APP_CONFIG.features && APP_CONFIG.features.leaveRequest === false);
  }
  var T = ONSAH_TOKENS;
  var CONTROL_CSS = 'font:14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;padding:7px 8px;border:1px solid ' + T.line + ";border-radius:8px;color:" + T.ink + ";background:#fff;min-width:0;width:100%;box-sizing:border-box";
  function field(labelText, control) {
    const wrap = document.createElement("label");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:12px;color:" + T.inkSoft + ";min-width:0";
    wrap.append(labelText, control);
    return wrap;
  }
  function input(type, value) {
    const i = document.createElement("input");
    i.type = type;
    i.value = value;
    i.style.cssText = CONTROL_CSS;
    onsahFocusRing(i);
    return i;
  }
  function select(options, value) {
    const s = document.createElement("select");
    s.style.cssText = CONTROL_CSS;
    options.forEach(([v, text]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = text;
      s.appendChild(o);
    });
    s.value = value;
    onsahFocusRing(s);
    return s;
  }
  function checkbox(text, checked) {
    const wrap = document.createElement("label");
    wrap.style.cssText = "display:inline-flex;align-items:center;gap:6px;font-size:13px;color:" + T.ink + ";cursor:pointer;user-select:none";
    const c = document.createElement("input");
    c.type = "checkbox";
    c.checked = !!checked;
    c.style.cssText = "margin:0;width:15px;height:15px;accent-color:" + T.brand;
    wrap.append(c, text);
    return { wrap, box: c };
  }
  function dayChip(text, checked, onChange) {
    const c = checkbox(text, checked);
    const paint = () => {
      c.wrap.style.borderColor = c.box.checked ? T.brand : T.line;
      c.wrap.style.background = c.box.checked ? T.brandWash : "#fff";
    };
    c.wrap.style.cssText += ";border:1px solid " + T.line + ";border-radius:8px;padding:5px 9px";
    c.box.addEventListener("change", () => {
      paint();
      onChange();
    });
    return { wrap: c.wrap, box: c.box, paint };
  }
  function grid(columns, ...children) {
    const r = document.createElement("div");
    r.style.cssText = "display:grid;grid-template-columns:" + columns + ";gap:8px;margin-bottom:12px;align-items:end";
    r.append(...children);
    return r;
  }
  function openLeaveDialog() {
    const cfg = settings();
    const today = agendaYmd(/* @__PURE__ */ new Date());
    const modal = mkModalShell(MODAL_ID, "Verlof aanvragen", { maxWidth: "540px" });
    const body = modal.body;
    const description = input("text", cfg.description);
    const date = input("date", today);
    const startTime = input("time", "09:00");
    const endTime = input("time", "17:00");
    const allDay = checkbox("Hele dag", false);
    allDay.wrap.style.paddingBottom = "9px";
    const recurrence = select([["none", "Niet"], ["daily", "Dagelijks"], ["weekly", "Wekelijks"]], "none");
    const interval = input("number", "1");
    interval.min = "1";
    interval.max = "99";
    interval.step = "1";
    const unit = document.createElement("span");
    unit.style.cssText = "font-size:13px;color:" + T.inkSoft + ";white-space:nowrap";
    const intervalRow = document.createElement("div");
    intervalRow.style.cssText = "display:flex;align-items:center;gap:6px";
    intervalRow.append(interval, unit);
    const until = input("date", "");
    let userTouchedDays = false;
    const dayBoxes = {};
    const dayChips = [];
    const daysRow = document.createElement("div");
    daysRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px";
    WEEKDAYS.forEach((d) => {
      const c = dayChip(WEEKDAY_LABELS[d], d === weekdayOf(today), () => {
        userTouchedDays = true;
        update();
      });
      dayBoxes[d] = c.box;
      dayChips.push(c);
      c.paint();
      daysRow.appendChild(c.wrap);
    });
    const paintDays = () => dayChips.forEach((c) => c.paint());
    const repeatBlock = document.createElement("div");
    const repeatGrid = grid("1fr 150px", field("Herhaal iedere", intervalRow), field("Herhaal tot", until));
    const daysLabel = document.createElement("div");
    daysLabel.textContent = "Op";
    daysLabel.style.cssText = "font-weight:600;font-size:12px;color:" + T.inkSoft + ";margin-bottom:6px";
    repeatBlock.append(repeatGrid, daysLabel, daysRow);
    const summary = document.createElement("div");
    summary.style.cssText = "margin:0 0 12px;padding:8px 10px;border-radius:10px;background:" + T.lineSoft + ";font-size:12.5px;min-height:18px";
    const status = document.createElement("div");
    status.setAttribute("role", "status");
    status.style.cssText = "margin-bottom:10px;font-weight:600;font-size:12.5px";
    const submit = mkPillButton("Opslaan", () => submitLeave());
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;justify-content:flex-end";
    actions.appendChild(submit);
    const intro = document.createElement("p");
    intro.style.cssText = "margin:0 0 12px;color:" + T.inkSoft;
    intro.textContent = "Het verlof komt als onbeschikbaarheid in de agenda die je nu open hebt." + (cfg.redirectUrl ? " Daarna opent AFAS in een nieuw tabblad om het verlof aan te vragen." : "");
    body.append(
      intro,
      grid("1fr", field("Omschrijving", description)),
      grid("minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) auto", field("Begindatum", date), field("Begintijd", startTime), field("Eindtijd", endTime), allDay.wrap),
      grid("1fr", field("Herhaling", recurrence)),
      repeatBlock,
      summary,
      status,
      actions
    );
    let result = null;
    let busy = false;
    date.addEventListener("change", () => {
      if (!userTouchedDays && weekdayOf(date.value)) {
        WEEKDAYS.forEach((d) => {
          dayBoxes[d].checked = d === weekdayOf(date.value);
        });
        paintDays();
      }
      if (until.value && until.value < date.value) until.value = date.value;
      update();
    });
    [description, startTime, endTime, interval, until].forEach((i) => i.addEventListener("input", update));
    [allDay.box, recurrence, until].forEach((i) => i.addEventListener("change", update));
    function form() {
      return {
        description: description.value,
        date: date.value,
        startTime: startTime.value,
        endTime: endTime.value,
        allDay: allDay.box.checked,
        recurrence: recurrence.value,
        interval: interval.value,
        until: until.value,
        weekdays: WEEKDAYS.filter((d) => dayBoxes[d].checked)
      };
    }
    function update() {
      const f = form();
      startTime.disabled = endTime.disabled = f.allDay;
      startTime.style.opacity = endTime.style.opacity = f.allDay ? ".5" : "1";
      repeatBlock.style.display = f.recurrence === "none" ? "none" : "";
      daysLabel.style.display = daysRow.style.display = f.recurrence === "weekly" ? "" : "none";
      unit.textContent = f.recurrence === "weekly" ? "weken" : "dagen";
      result = buildUnavailability(f, { maxDays: cfg.maxDays, recurrenceTypes: cfg.recurrenceTypes });
      if (result.error) {
        summary.style.color = T.bad;
        summary.textContent = result.error;
      } else {
        summary.style.color = T.ink;
        summary.textContent = describeUnavailability(result.unavailability, f.recurrence, _agDateLabel);
      }
      submit.disabled = busy || !!result.error;
      submit.style.opacity = submit.disabled ? ".5" : "1";
    }
    update();
    setTimeout(() => {
      try {
        date.focus();
      } catch (e) {
      }
    }, 0);
    function setStatus2(text, color) {
      status.style.color = color;
      status.textContent = text;
    }
    async function submitLeave() {
      if (busy || !result || result.error) return;
      busy = true;
      update();
      setStatus2("Bezig met vastleggen…", T.inkSoft);
      const r = await requestLeave(result.unavailability);
      busy = false;
      if (!r.ok) {
        update();
        setStatus2(r.message, T.bad);
        return;
      }
      if (cfg.redirectUrl) {
        setStatus2("Verlof vastgelegd. AFAS opent in een nieuw tabblad…", T.ok);
        openInNewTab(cfg.redirectUrl);
      } else {
        setStatus2("Verlof vastgelegd.", T.ok);
      }
      setTimeout(() => {
        modal.close();
        try {
          location.reload();
        } catch (e) {
        }
      }, RELOAD_DELAY_MS);
    }
  }
  async function requestLeave(unavailability) {
    let employeeId = null;
    try {
      employeeId = await getEmployeeIdAsync();
    } catch (e) {
    }
    if (!employeeId || !/^\d+$/.test(String(employeeId))) {
      return { ok: false, message: "Kon niet bepalen voor wie het verlof is. Herlaad de agenda en probeer het opnieuw." };
    }
    try {
      await createUnavailability(employeeId, unavailability);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: "Vastleggen mislukt (" + e.message + "). Er is niets vastgelegd." };
    }
  }
  function openInNewTab(url) {
    try {
      chrome.runtime.sendMessage({ type: MSG.OPEN_TAB, url }, function(res) {
        void chrome.runtime.lastError;
        if (!(res && res.ok)) {
          try {
            window.open(url, "_blank", "noopener");
          } catch (e) {
          }
        }
      });
    } catch (e) {
      try {
        window.open(url, "_blank", "noopener");
      } catch (e2) {
      }
    }
  }

  // src/content/features/agenda/open-range.js
  function lateHours() {
    var g = APP_CONFIG.generalSettings;
    return g && g.lateThresholdHours > 0 ? g.lateThresholdHours : 24;
  }
  function defaultRangeFrom() {
    var w = editableWindowStart();
    if (w) return agendaYmd(w);
    var d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - 28);
    return agendaYmd(d);
  }
  function checkOpenRange(fromYmd, toYmd, onProgress) {
    var ids = viewedInviteeIds(resolveInviteeId());
    if (!ids.length) return Promise.reject(new Error("Open eerst je agenda in ONS."));
    if (!fromYmd || !toYmd) return Promise.reject(new Error("Kies een begin- en einddatum."));
    if (fromYmd > toYmd) return Promise.reject(new Error("De begindatum ligt na de einddatum."));
    var voortgang = ids.map(function() {
      return { done: 0, total: 0 };
    });
    var meld = function() {
      if (!onProgress) return;
      var d = 0, t = 0;
      voortgang.forEach(function(v) {
        d += v.done;
        t += v.total;
      });
      onProgress(d, t);
    };
    return Promise.all(ids.map(function(id, i) {
      return fetchEntriesForRange(id, fromYmd, toYmd, function(d, t) {
        voortgang[i] = { done: d, total: t };
        meld();
      }).then(function(entries) {
        return summarizeOpenRange(entries, { from: fromYmd, to: toYmd, lateHours: lateHours() });
      });
    })).then(function(lijst) {
      var r = mergeOpenRangePerPersoon(lijst, ids, ids.length > 1 ? ids.map(inviteeName) : null);
      r.from = fromYmd;
      r.to = toYmd;
      return r;
    });
  }
  function mergeOpenRangePerPersoon(lijst, ids, namen) {
    if (lijst.length === 1 && !namen) return lijst[0];
    var dagen = /* @__PURE__ */ Object.create(null);
    lijst.forEach(function(r, i) {
      (r.days || []).forEach(function(d) {
        var dag = dagen[d.date] || (dagen[d.date] = { date: d.date, client: 0, overig: 0, count: 0, lateCount: 0, items: [] });
        dag.client += d.client;
        dag.overig += d.overig;
        dag.count += d.count;
        dag.lateCount += d.lateCount;
        d.items.forEach(function(it) {
          dag.items.push(Object.assign({}, it, { key: ids[i] + ":" + it.key, persoon: namen ? namen[i] : "" }));
        });
      });
    });
    var days = Object.keys(dagen).sort().map(function(k) {
      dagen[k].items.sort(function(a, b) {
        return a.start - b.start;
      });
      return dagen[k];
    });
    return {
      days,
      totalMinutes: days.reduce(function(t, d) {
        return t + d.client + d.overig;
      }, 0),
      totalCount: days.reduce(function(t, d) {
        return t + d.count;
      }, 0),
      lateCount: days.reduce(function(t, d) {
        return t + d.lateCount;
      }, 0)
    };
  }

  // src/content/features/agenda/week-ratio.js
  function round(n) {
    return Math.round(n || 0);
  }
  function plannedRatioRows(entries, forms) {
    forms = forms || APP_CONFIG && APP_CONFIG.registrationForms || [];
    var map = /* @__PURE__ */ Object.create(null);
    (entries || []).forEach(function(e) {
      if (!e || e.type !== "event" || e.allDay) return;
      var naam = e.hourType && String(e.hourType).trim() || "";
      if (!naam && !e.clientPresent) return;
      if (naam && !_isClientUursoortName(naam)) return;
      if (!naam) naam = "Zonder uursoort";
      var di = computeDirectIndirect(e, forms);
      var r = map[naam] || (map[naam] = { type: naam, direct: 0, indirect: 0, travel: 0, other: 0, minutes: 0 });
      r.direct += di.directMin;
      r.indirect += di.indirectMin;
      r.travel += di.travelMin;
      r.other += di.unknownMin;
      r.minutes += _entryMinutes(e) + di.travelMin;
    });
    return Object.keys(map).map(function(k) {
      var r = map[k];
      return { type: r.type, direct: round(r.direct), indirect: round(r.indirect), travel: round(r.travel), other: round(r.other), minutes: round(r.minutes) };
    }).sort(function(a, b) {
      return b.minutes - a.minutes;
    });
  }
  function fetchWeekRatio(date) {
    var ids = viewedInviteeIds(resolveInviteeId());
    if (!ids.length) return Promise.reject(new Error("Open eerst je agenda in ONS."));
    var start = weekStartsBetween(date, date)[0];
    if (!start) return Promise.reject(new Error("Ongeldige datum."));
    return Promise.all(ids.map(function(id) {
      return ratioVoor(id, start);
    })).then(function(lijst) {
      var r = lijst[0];
      r.persons = lijst.map(function(x, i) {
        return { id: ids[i], name: ids.length > 1 ? inviteeName(ids[i]) : "", rows: x.rows };
      });
      return r;
    });
  }
  function ratioVoor(id, start) {
    var vandaag = agendaYmd(/* @__PURE__ */ new Date());
    var dezeWeek = weekStartsBetween(vandaag, vandaag)[0];
    var basis = { weekStart: start, week: agendaWeekNumber(start) };
    if (start > dezeWeek) {
      return fetchInviteeWeek(id, start).then(function(entries) {
        return Object.assign(basis, { mode: "gepland", rows: plannedRatioRows(entries) });
      });
    }
    return fetchWeekRegistrationDeclarabiliteit(id, start).then(function(s) {
      var rows = (s && s.byHourType || []).filter(function(r) {
        return r && r.type && _isClientUursoortName(r.type);
      }).map(function(r) {
        return { type: r.type, direct: r.direct || 0, indirect: r.indirect || 0, travel: r.travel || 0, other: r.other || 0, minutes: r.minutes || 0 };
      });
      return Object.assign(basis, { mode: "geregistreerd", rows });
    });
  }

  // src/content/features/agenda/production.js
  var GELIJKTIJDIG = 8;
  var WEEK_TTL_MS = 10 * 60 * 1e3;
  var MAX_PRODUCTION_WEEKS = 26;
  function defaultProductionFrom() {
    var d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - 7 * 7);
    return agendaYmd(d);
  }
  function productionWeekRow(weekStart, summary, profile) {
    var s = summary || {};
    var dec = declarabiliteitPct(s, profile);
    return {
      weekStart,
      week: agendaWeekNumber(weekStart),
      directMinutes: s.directMinutes || 0,
      indirectMinutes: s.indirectMinutes || 0,
      travelMinutes: s.travelMinutes || 0,
      clientMinutes: s.clientMinutes || 0,
      nonClientMinutes: s.nonClientMinutes || 0,
      totalMinutes: s.totalMinutes || 0,
      declarabelPct: dec.pct,
      count: s.count || 0
    };
  }
  function plannedProductionRow(weekStart, entries) {
    var rows = plannedRatioRows(entries);
    var som = function(k) {
      return rows.reduce(function(t, r) {
        return t + (r[k] || 0);
      }, 0);
    };
    return {
      weekStart,
      week: agendaWeekNumber(weekStart),
      planned: true,
      directMinutes: som("direct"),
      indirectMinutes: som("indirect"),
      travelMinutes: som("travel"),
      clientMinutes: som("minutes"),
      nonClientMinutes: 0,
      totalMinutes: som("minutes"),
      declarabelPct: null,
      count: 0
    };
  }
  function computeProduction(fromYmd, toYmd, onProgress) {
    var ids = viewedInviteeIds(resolveInviteeId());
    if (!ids.length) return Promise.reject(new Error("Open eerst je agenda in ONS."));
    if (!fromYmd || !toYmd) return Promise.reject(new Error("Kies een begin- en einddatum."));
    if (fromYmd > toYmd) return Promise.reject(new Error("De begindatum ligt na de einddatum."));
    var today = agendaYmd(/* @__PURE__ */ new Date());
    var dezeWeek = weekStartsBetween(today, today)[0];
    var weeks = weekStartsBetween(fromYmd, toYmd);
    if (!weeks.length) return Promise.reject(new Error("Ongeldige periode."));
    if (weeks.length > MAX_PRODUCTION_WEEKS) return Promise.reject(new Error("Periode te lang (hooguit " + MAX_PRODUCTION_WEEKS + " weken)."));
    var prof = typeof ACTIVE_PROFILE !== "undefined" ? ACTIVE_PROFILE : null;
    var limiter = createLimiter(GELIJKTIJDIG);
    var klaar = 0;
    var totaal = weeks.length * ids.length;
    var gedaan = function(row) {
      klaar++;
      if (onProgress) {
        try {
          onProgress(klaar, totaal);
        } catch (e) {
        }
      }
      return row;
    };
    var voor = function(id) {
      return Promise.all(weeks.map(function(start) {
        var p = start > dezeWeek ? limiter(function() {
          return fetchInviteeWeek(id, start);
        }).then(function(entries) {
          return plannedProductionRow(start, entries);
        }) : fetchWeekRegistrationDeclarabiliteit(id, start, { limiter, ttlMs: WEEK_TTL_MS }).then(function(summary) {
          return productionWeekRow(start, summary, prof);
        });
        return p.then(gedaan, function(e) {
          throw new Error("Week " + (agendaWeekNumber(start) || start) + " kon niet worden opgehaald (" + (e && e.message || "fout") + ").");
        });
      }));
    };
    return Promise.all(ids.map(voor)).then(function(perPersoon) {
      return {
        from: fromYmd,
        to: toYmd,
        weeks: perPersoon[0],
        persons: perPersoon.map(function(rows, i) {
          return { id: ids[i], name: ids.length > 1 ? inviteeName(ids[i]) : "", weeks: rows };
        })
      };
    });
  }

  // src/content/domain/free-slots.js
  function ymd(d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function minutenVanDag(ms, dagStartMs) {
    return Math.round((ms - dagStartMs) / 6e4);
  }
  function findFreeGaps(entries, opts) {
    opts = opts || {};
    var now = opts.now != null ? opts.now : Date.now();
    var stap = opts.stepMin || 15;
    var min = opts.minMinutes || 60;
    var wS = opts.windowStart != null ? opts.windowStart : 8 * 60;
    var wE = opts.windowEnd != null ? opts.windowEnd : 17 * 60;
    var blocked = opts.blocked || [];
    var max = opts.maxResults || 12;
    var dagen = opts.days || 14;
    var bezet = /* @__PURE__ */ Object.create(null), heleDag = /* @__PURE__ */ Object.create(null);
    (entries || []).forEach(function(e) {
      if (!e || !e.date) return;
      var toon = String(e.showAs || "").toLowerCase();
      if (toon === "free" || toon === "workingelsewhere") return;
      if (e.allDay || e.layer === "unavailabilities") {
        if (e.allDay || e.startMs == null || e.endMs == null) {
          heleDag[e.date] = true;
          return;
        }
      }
      if (e.startMs == null || e.endMs == null) return;
      var d0 = new Date(e.startMs);
      for (var k = 0; k < 62; k++) {
        var dag2 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + k);
        var dStart2 = dag2.getTime();
        if (dStart2 >= e.endMs) break;
        var key2 = ymd(dag2);
        var voor = e.travelBefore || 0, na = e.travelAfter || 0;
        var s = Math.max(0, minutenVanDag(e.startMs, dStart2) - voor);
        var en = Math.min(24 * 60, minutenVanDag(e.endMs, dStart2) + na);
        if (en > s) (bezet[key2] = bezet[key2] || []).push([s, en]);
      }
    });
    var uit = [];
    var start = new Date(now);
    start.setHours(0, 0, 0, 0);
    for (var i = 0; i < dagen && uit.length < max; i++) {
      var dag = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var key = ymd(dag);
      if (_excludeWeekendYmd(key) || heleDag[key]) continue;
      var dStart = dag.getTime();
      var vanaf = wS;
      if (i === 0) {
        var nu = minutenVanDag(now, dStart);
        vanaf = Math.max(wS, Math.ceil(nu / stap) * stap);
      }
      var bezig = (bezet[key] || []).concat(blocked.map(function(b) {
        return [b.from, b.to];
      })).filter(function(b) {
        return b[1] > vanaf && b[0] < wE;
      }).sort(function(a, b) {
        return a[0] - b[0];
      });
      var cur = vanaf;
      var leeg = function(tot) {
        var b = Math.ceil(cur / stap) * stap;
        if (tot - b >= min && uit.length < max) uit.push({ date: key, startMin: b, endMin: tot, minutes: tot - b });
      };
      for (var j = 0; j < bezig.length; j++) {
        if (bezig[j][0] > cur) leeg(Math.min(bezig[j][0], wE));
        cur = Math.max(cur, bezig[j][1]);
        if (cur >= wE) break;
      }
      if (cur < wE) leeg(wE);
    }
    return uit;
  }
  function reservationBlocks(entries) {
    var uit = [], gezien = /* @__PURE__ */ Object.create(null);
    (entries || []).forEach(function(e) {
      if (!e || e.startMs == null || e.endMs == null || !(e.endMs > e.startMs)) return;
      var d0 = new Date(e.startMs);
      var dStart = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime();
      var s = minutenVanDag(e.startMs, dStart), en = Math.min(24 * 60, minutenVanDag(e.endMs, dStart));
      var label = (Array.isArray(e.labels) ? e.labels : []).map(function(l) {
        return String(l && l.name != null ? l.name : typeof l === "string" ? l : "").trim();
      }).filter(Boolean)[0] || "";
      var key = ymd(d0) + "|" + s + "|" + en + "|" + label;
      if (gezien[key]) return;
      gezien[key] = 1;
      uit.push({ date: ymd(d0), startMin: s, endMin: en, label });
    });
    return uit.sort(function(a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin;
    });
  }
  function reservationsOverlapping(blocks, date, startMin, endMin) {
    return (blocks || []).filter(function(r) {
      return r.date === date && r.startMin < endMin && r.endMin > startMin;
    });
  }

  // src/content/domain/route.js
  function isAtClient(entry, opKantoor) {
    return !!(entry && entry.clientPresent && !opKantoor);
  }
  function addressFromMapsUrl(url) {
    var m = /\/maps\/place\/([^/?#"'<>\s]+)/.exec(String(url || ""));
    if (!m) return "";
    var t;
    try {
      t = decodeURIComponent(m[1].replace(/\+/g, " "));
    } catch (e) {
      return "";
    }
    return t.replace(/\s+/g, " ").replace(/[,\s]+$/, "").trim();
  }
  function schoon(v) {
    return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  }
  function adresUitVelden(o) {
    var pak = function(re) {
      for (var k in o) {
        if (re.test(k) && (typeof o[k] === "string" || typeof o[k] === "number")) return schoon(o[k]);
      }
      return "";
    };
    var straat = pak(/^(street|straat|street_name|streetname)$/i);
    var nr = pak(/^(house_?number|huisnummer|number|nr)$/i);
    var toev = pak(/^(house_?number_?(addition|suffix)|toevoeging|addition|suffix)$/i);
    var pc = pak(/^(zip_?code|postal_?code|postcode)$/i);
    var plaats = pak(/^(city|woonplaats|plaats|place|town)$/i);
    if (!straat || !plaats) return "";
    var eerste = straat + (nr ? " " + nr + (toev ? (/^[a-z0-9]/i.test(toev) ? "-" : "") + toev : "") : "");
    return [eerste, pc, plaats].filter(Boolean).join(", ");
  }
  function addressFromDetails(json) {
    var gevonden = { link: "", tekst: "", velden: "" };
    var gezien = 0;
    (function loop(v, sleutel, diepte) {
      if (gevonden.link || diepte > 8 || ++gezien > 5e3) return;
      if (typeof v === "string") {
        if (/maps\/place\//.test(v)) {
          var a = addressFromMapsUrl(v);
          if (a) gevonden.link = a;
          return;
        }
        if (!gevonden.tekst && /address|adres/i.test(sleutel || "") && !/mail|phone|telefoon|ip_?adres|ip_?address/i.test(sleutel || "")) {
          var s = schoon(v);
          if (s.length >= 6 && s.length <= 160 && /\d/.test(s) && /[a-z]/i.test(s) && /[\s,]/.test(s)) gevonden.tekst = s;
        }
        return;
      }
      if (!v || typeof v !== "object") return;
      if (Array.isArray(v)) {
        v.forEach(function(x) {
          loop(x, sleutel, diepte + 1);
        });
        return;
      }
      if (!gevonden.velden) {
        var f = adresUitVelden(v);
        if (f) gevonden.velden = f;
      }
      Object.keys(v).forEach(function(k) {
        if (/(^|_)(name|naam|first|last|initials|bsn)/i.test(k)) return;
        loop(v[k], /address|adres/i.test(sleutel || "") ? sleutel + "." + k : k, diepte + 1);
      });
    })(json, "", 0);
    return gevonden.link || gevonden.tekst || gevonden.velden || "";
  }
  var STOPS_PER_ROUTE = 10;
  function routeUrls(addresses, origin) {
    var stops = (addresses || []).map(schoon).filter(Boolean);
    if (!stops.length) return [];
    var uit = [], start = schoon(origin);
    for (var i = 0; i < stops.length; i += STOPS_PER_ROUTE) {
      var deel = stops.slice(i, i + STOPS_PER_ROUTE);
      var bestemming = deel[deel.length - 1];
      var tussen = deel.slice(0, -1);
      var q = ["api=1"];
      if (start) q.push("origin=" + encodeURIComponent(start));
      q.push("destination=" + encodeURIComponent(bestemming));
      if (tussen.length) q.push("waypoints=" + tussen.map(encodeURIComponent).join("%7C"));
      q.push("travelmode=driving");
      uit.push("https://www.google.com/maps/dir/?" + q.join("&"));
      start = bestemming;
    }
    return uit;
  }
  function postcodeFromAddress(adres) {
    var m = /\b([1-9]\d{3})\s?([A-Za-z]{2})\b/.exec(String(adres || ""));
    return m ? m[1] + m[2].toUpperCase() : "";
  }
  function postcodeFromClient(obj) {
    var gevonden = "", gezien = 0;
    (function loop(v, k, d) {
      if (gevonden || d > 6 || ++gezien > 2e3) return;
      if (typeof v === "string" || typeof v === "number") {
        if (/zip|postal|postcode/i.test(k || "")) {
          var m = /^\s*([1-9]\d{3})\s?([A-Za-z]{2})\s*$/.exec(String(v));
          if (m) gevonden = m[1] + m[2].toUpperCase();
        }
        return;
      }
      if (!v || typeof v !== "object") return;
      if (Array.isArray(v)) {
        v.forEach(function(x) {
          loop(x, k, d + 1);
        });
        return;
      }
      Object.keys(v).forEach(function(kk) {
        loop(v[kk], kk, d + 1);
      });
    })(obj, "", 0);
    return gevonden || postcodeFromAddress(addressFromDetails(obj));
  }

  // src/content/domain/offices.js
  function woordIn(naam, woord) {
    var w = String(woord).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|[^a-zà-ÿ])" + w + "($|[^a-zà-ÿ])", "i").test(naam);
  }
  function officeSector(locationName) {
    var naam = String(locationName || "").trim();
    if (/^bg(\s|$)/i.test(naam)) return "bv";
    if (/^j\s*&\s*g(\s|$)/i.test(naam)) return "jg";
    return "";
  }
  function officeForLocation(locationName, offices) {
    var naam = String(locationName || "").trim();
    var sector = officeSector(naam);
    if (!sector) return null;
    var rest = naam.replace(/^(bg|j\s*&\s*g)\s*/i, "").replace(/\([^)]*\)/g, " ");
    var lijst = Array.isArray(offices) ? offices : APP_CONFIG.offices || [];
    var kandidaten = [];
    lijst.forEach(function(o) {
      if (!o || (o.sector || "bv") !== sector) return;
      (o.match && o.match.length ? o.match : [o.name]).forEach(function(w) {
        if (w && woordIn(rest, w)) kandidaten.push({ o, len: String(w).length });
      });
    });
    if (!kandidaten.length) return null;
    kandidaten.sort(function(a, b) {
      return b.len - a.len;
    });
    return { name: kandidaten[0].o.name, postcode: String(kandidaten[0].o.postcode || "").replace(/\s+/g, "").toUpperCase() };
  }

  // src/content/features/agenda/free-slots.js
  function workWindow() {
    var z = activeZones() || [];
    if (!z.length) return { start: 8 * 60, end: 17 * 60 };
    var start = Math.round(Math.min.apply(null, z.map(function(x) {
      return x.from;
    })) * 60);
    var end = Math.round(Math.max.apply(null, z.map(function(x) {
      return x.to;
    })) * 60);
    return { start, end };
  }
  function agendaIds() {
    var ids = currentInviteeIds();
    if (!ids.length) {
      var een = currentInviteeId(null) || resolveInviteeId();
      if (een != null) ids = [String(een)];
    }
    return ids;
  }
  function checkSlotWithOns(req) {
    req = req || {};
    var status = overlapCheckStatus();
    var startMin = parseInt(req.startMin, 10), minutes = parseInt(req.minutes, 10);
    if (status !== "ready" || !(startMin >= 0) || !(minutes > 0)) return Promise.resolve({ status, overlap: null });
    return fetchEventOverlap({ ids: agendaIds(), date: req.date, startMin, endMin: startMin + minutes }).then(function(o) {
      return { status, overlap: o };
    });
  }
  var MAX_ZOEK_DAGEN = 182;
  function huisbezoekenPerDag(alles, datums) {
    var gezien = /* @__PURE__ */ Object.create(null);
    var opDag = alles.filter(function(e) {
      if (!(e.layer === "events" && datums[e.date] && !e.allDay && e.startMs != null && e.endMs != null)) return false;
      var k = (e.id != null ? e.id : "") + "|" + e.date + "|" + e.startMs;
      if (gezien[k]) return false;
      gezien[k] = true;
      return true;
    });
    var limiet = createLimiter(3), uit = {};
    var zet = function(e, extra) {
      var dag = new Date(e.startMs);
      dag.setHours(0, 0, 0, 0);
      (uit[e.date] = uit[e.date] || []).push(Object.assign({
        startMin: Math.round((e.startMs - dag.getTime()) / 6e4),
        endMin: Math.round((e.endMs - dag.getTime()) / 6e4)
      }, extra));
    };
    return Promise.all(opDag.map(function(e) {
      var k = officeForLocation(e.locationName);
      if (k && k.postcode) {
        zet(e, { pc: k.postcode, soort: "kantoor", kantoor: k.name });
        return null;
      }
      if (!isAtClient(e, false)) return null;
      var url = e.detailsUrl || (e.occurrenceId ? _apiUrl("eventDetails", { inviteeId: e.inviteeId, occurrenceId: e.occurrenceId }) : null);
      if (!url) return null;
      return limiet(function() {
        return getJson(url);
      }).then(function(d) {
        var pc = postcodeFromAddress(addressFromDetails(d));
        if (pc) zet(e, { pc, soort: "client" });
      }, function() {
      });
    })).then(function() {
      Object.keys(uit).forEach(function(d) {
        uit[d].sort(function(a, b) {
          return a.startMin - b.startMin;
        });
      });
      return uit;
    });
  }
  function findFreeSlots(minutes, weeks, tot, metBezoeken, veel) {
    var ids = agendaIds();
    if (!ids.length) return Promise.reject(new Error("Open eerst je agenda in ONS."));
    minutes = parseInt(minutes, 10);
    if (!(minutes >= 5)) return Promise.reject(new Error("Kies een duur."));
    weeks = Math.max(1, Math.min(8, parseInt(weeks, 10) || 2));
    var vandaag = /* @__PURE__ */ new Date();
    var dagen = weeks * 7;
    var totDatum = /^\d{4}-\d{2}-\d{2}$/.test(String(tot || "")) ? String(tot) : "";
    if (totDatum) {
      var p = totDatum.split("-");
      var eind = new Date(+p[0], +p[1] - 1, +p[2]);
      var begin = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
      dagen = Math.round((eind - begin) / 864e5) + 1;
      if (dagen < 1) return Promise.reject(new Error("Kies een datum vanaf vandaag."));
      if (dagen > MAX_ZOEK_DAGEN) return Promise.reject(new Error("Kies een datum binnen een half jaar."));
    }
    var laatste = new Date(vandaag);
    laatste.setDate(laatste.getDate() + dagen - 1);
    var weken = weekStartsBetween(agendaYmd(vandaag), agendaYmd(laatste));
    var limiet = createLimiter(4);
    var haal = function(sjabloon, laag, start, id) {
      return limiet(function() {
        return getJson(_apiUrl(sjabloon, { inviteeId: id, date: start }));
      }).then(function(j) {
        return mapAgendaWeekResponse(j).map(function(e) {
          e.layer = laag;
          e.inviteeId = id;
          return e;
        });
      });
    };
    var zonder = function() {
      return [];
    };
    var taken = [];
    ids.forEach(function(id) {
      weken.forEach(function(start) {
        taken.push(Promise.all([
          haal("weekEvents", "events", start, id),
          // De andere lagen: mislukt er een (laag niet beschikbaar), dan zonder.
          haal("weekUnavailabilities", "unavailabilities", start, id).catch(zonder),
          haal("weekOutlook", "outlook_appointments", start, id).catch(zonder),
          haal("weekPlannedVisits", "planned_visits", start, id).catch(zonder),
          haal("weekReservations", "reservations", start, id).catch(zonder)
        ]));
      });
    });
    return Promise.all(taken).then(function(perWeek) {
      var alles = [].concat.apply([], perWeek.map(function(w) {
        return [].concat.apply([], w);
      }));
      var isRes = function(e) {
        return e.layer === "reservations" || e.type === "reservation";
      };
      var reserveringen = reservationBlocks(alles.filter(isRes));
      alles = alles.filter(function(e) {
        return !isRes(e);
      });
      var win = workWindow();
      var gaps = findFreeGaps(alles, {
        now: Date.now(),
        days: dagen,
        minMinutes: minutes,
        stepMin: 15,
        windowStart: win.start,
        windowEnd: win.end,
        maxResults: veel ? 400 : totDatum ? 40 : 12
      });
      gaps.forEach(function(g) {
        g.reservations = reservationsOverlapping(reserveringen, g.date, g.startMin, g.endMin);
      });
      var res = { minutes, weeks, to: totDatum, lastDate: agendaYmd(laatste), windowStart: win.start, windowEnd: win.end, gaps, invitees: ids.length, onsCheck: overlapCheckStatus() };
      var datums = {};
      gaps.forEach(function(g) {
        datums[g.date] = true;
      });
      var bezoeken = metBezoeken ? huisbezoekenPerDag(alles, datums).then(function(v) {
        res.visits = v;
      }, function() {
        res.visits = {};
      }) : Promise.resolve();
      return bezoeken.then(function() {
        return onsNakijken(res);
      });
    });
    function onsNakijken(res) {
      if (res.onsCheck !== "ready" || veel) return res;
      var gaps = res.gaps;
      var nakijk = createLimiter(3);
      return Promise.all(gaps.map(function(g) {
        return nakijk(function() {
          return fetchEventOverlap({ ids, date: g.date, startMin: g.startMin, endMin: g.startMin + minutes });
        }).then(function(o) {
          g.ons = o;
        }, function() {
          g.ons = null;
        });
      })).then(function() {
        return res;
      });
    }
  }

  // src/content/features/agenda/preload.js
  function aan(k) {
    return !(APP_CONFIG.features && APP_CONFIG.features[k] === false);
  }
  var TTL = { ratio: 5 * 6e4, plan: 5 * 6e4, open: 10 * 6e4, productie: 30 * 6e4 };
  var VOORAF_INTERVAL = 5 * 6e4;
  var _cache = /* @__PURE__ */ Object.create(null);
  function idsSleutel() {
    return viewedInviteeIds(resolveInviteeId()).join(",");
  }
  function isCached(soort, sleutel) {
    const c = _cache[soort + "|" + idsSleutel() + "|" + sleutel];
    return !!(c && !c.bezig && Date.now() - c.ts < TTL[soort]);
  }
  function onthouden(soort, sleutel, werk, onProgress, vers) {
    const k = soort + "|" + idsSleutel() + "|" + sleutel;
    const c = _cache[k];
    const geldig = c && (c.bezig || Date.now() - c.ts < TTL[soort]);
    if (geldig && !vers) {
      if (onProgress) {
        if (c.bezig) {
          c.luisteraars.push(onProgress);
          if (c.laatst) onProgress(c.laatst[0], c.laatst[1]);
        }
      }
      return c.promise;
    }
    const nieuw = { ts: Date.now(), bezig: true, luisteraars: onProgress ? [onProgress] : [], laatst: null, promise: null };
    nieuw.promise = werk(function(d, t) {
      nieuw.laatst = [d, t];
      nieuw.luisteraars.forEach(function(fn) {
        try {
          fn(d, t);
        } catch (e) {
        }
      });
    }).then(
      function(r) {
        nieuw.bezig = false;
        nieuw.ts = Date.now();
        return r;
      },
      function(e) {
        delete _cache[k];
        throw e;
      }
    );
    _cache[k] = nieuw;
    return nieuw.promise;
  }
  function cachedOpenRange(from, to, onProgress, vers) {
    return onthouden("open", from + "|" + to, function(p) {
      return checkOpenRange(from, to, p);
    }, onProgress, vers);
  }
  function cachedProduction(from, to, onProgress) {
    return onthouden("productie", from + "|" + to, function(p) {
      return computeProduction(from, to, p);
    }, onProgress);
  }
  function cachedWeekRatio(date) {
    return onthouden("ratio", String(date), function() {
      return fetchWeekRatio(date);
    });
  }
  function cachedFreeSlots(minutes, weeks, tot, metBezoeken, veel) {
    return onthouden("plan", minutes + "|" + weeks + "|" + (tot || "") + "|" + (metBezoeken ? "b" : "") + (veel ? "v" : ""), function() {
      return findFreeSlots(minutes, weeks, tot, metBezoeken, veel);
    });
  }
  function defaultProductionTo() {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() + 28);
    return agendaYmd(d);
  }
  var _laatstVooraf = 0;
  var _voorafSleutel = "";
  var _bezig3 = false;
  function preloadPanelData(force) {
    if (_bezig3) return;
    if (!aan("preload")) return;
    if (document.visibilityState !== "visible") return;
    const sleutel = idsSleutel() + "|" + currentAgendaDate();
    if (!force && sleutel === _voorafSleutel && Date.now() - _laatstVooraf < VOORAF_INTERVAL) return;
    if (!idsSleutel()) return;
    _bezig3 = true;
    _voorafSleutel = sleutel;
    _laatstVooraf = Date.now();
    const vandaag = agendaYmd(/* @__PURE__ */ new Date());
    const stap = (fn) => () => new Promise((klaar) => setTimeout(klaar, 400)).then(fn).catch(() => {
    });
    Promise.resolve().then(stap(() => aan("weekRatio") && cachedWeekRatio(currentAgendaDate()))).then(stap(() => aan("planner") && cachedFreeSlots(60, 2))).then(stap(() => aan("openRegistrations") && cachedOpenRange(defaultRangeFrom(), vandaag))).then(stap(() => aan("production") && cachedProduction(defaultProductionFrom(), defaultProductionTo()))).then(() => {
      _bezig3 = false;
    }, () => {
      _bezig3 = false;
    });
  }
  function _clearPreloadCache() {
    Object.keys(_cache).forEach((k) => delete _cache[k]);
    _laatstVooraf = 0;
    _voorafSleutel = "";
    _bezig3 = false;
  }

  // src/content/features/agenda/quick-register.js
  function openNewEvent(req) {
    req = req || {};
    var ymd2 = String(req.date || ""), hhmm = String(req.time || ""), minutes = parseInt(req.minutes, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd2) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm) || !(minutes > 0)) return { ok: false, error: "Ongeldig tijdstip." };
    var ids = currentInviteeIds();
    if (!ids.length) {
      var id = currentInviteeId(ymd2) || resolveInviteeId();
      if (id != null) ids = [String(id)];
    }
    if (!ids.length) return { ok: false, error: "Open eerst je agenda in ONS." };
    storePendingAppointment({ date: ymd2, time: hhmm, minutes });
    var clientLijst = function(l) {
      return (Array.isArray(l) ? l : []).map(String).filter(function(c) {
        return /^\d+$/.test(c);
      }).slice(0, 10);
    };
    var lees = function(lijst) {
      return (Array.isArray(lijst) ? lijst : []).map(function(m) {
        var t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(m && m.time || ""));
        if (!(t && /^\d{4}-\d{2}-\d{2}$/.test(String(m.date || "")))) return null;
        var uit = { date: String(m.date), startMin: +t[1] * 60 + +t[2] };
        var mm = parseInt(m.minutes, 10);
        if (mm > 0 && mm <= 24 * 60) uit.minutes = mm;
        var cl = clientLijst(m.clientIds);
        if (cl.length) uit.clientIds = cl;
        return uit;
      }).filter(Boolean);
    };
    var f = APP_CONFIG.features || {};
    var kopieen = f.plannerCopies !== false;
    var eigenOk = req.multi ? f.plannerMulti !== false && f.plannerDistance !== false : kopieen;
    storePendingDuplicates(kopieen && !req.multi ? lees(req.extra) : [], eigenOk ? lees(req.eigen) : []);
    spaNavigate(location.origin + newEventUrl(ids, clientLijst(req.clientIds), ymd2));
    return { ok: true };
  }
  function quickRegisterUrl(inviteeId, ymd2, hhmm, minutes) {
    return _apiUrl("newRegistration", { inviteeId, date: ymd2, startTime: hhmm, durationSec: minutes * 60 });
  }
  function overlapCheck(ymd2, startMin, endMin) {
    return fetchOnsOverlap(ymd2, startMin, endMin, "").then(function(ons) {
      return fetchWeekTijdvakken("registraties", ymd2).then(function() {
        var hit = overlappendTijdvak("registraties", ymd2, startMin, endMin, null);
        if (hit) return overlapMelding(hit, "een registratie");
        if (ons === true) return "Let op: ONS meldt dat dit tijdvak overlapt met een bestaande registratie.";
        return null;
      });
    });
  }
  function quickRegister(req) {
    req = req || {};
    var ymd2 = String(req.date || "");
    var hhmm = String(req.time || "").trim();
    var minutes = parseInt(req.minutes, 10);
    var startMin = timeTextToMinutes(hhmm);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd2)) return Promise.resolve({ ok: false, error: "Kies een datum." });
    if (startMin == null || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(hhmm)) return Promise.resolve({ ok: false, error: "Vul een begintijd in (uu:mm)." });
    if (!(minutes > 0) || minutes > 24 * 60) return Promise.resolve({ ok: false, error: "Vul een duur in minuten in." });
    if (startMin + minutes > 24 * 60) return Promise.resolve({ ok: false, error: "De registratie loopt over middernacht." });
    var id = currentInviteeId(ymd2) || resolveInviteeId();
    if (id == null) return Promise.resolve({ ok: false, error: "Open eerst je agenda in ONS." });
    hhmm = ("0" + Math.floor(startMin / 60)).slice(-2) + ":" + ("0" + startMin % 60).slice(-2);
    var go = function() {
      spaNavigate(location.origin + quickRegisterUrl(id, ymd2, hhmm, minutes));
      return { ok: true };
    };
    if (req.force) return Promise.resolve(go());
    return overlapCheck(ymd2, startMin, startMin + minutes).then(function(msg) {
      return msg ? { ok: false, overlap: msg } : go();
    });
  }

  // src/content/features/agenda/client-lookup.js
  var MAX_TREFFERS = 8;
  function clientsForPlan(json) {
    var lijst = json && Array.isArray(json.clients) ? json.clients : Array.isArray(json) ? json : [];
    return lijst.filter(function(c) {
      return c && c.id != null;
    }).slice(0, MAX_TREFFERS).map(function(c) {
      var naam = c.display_name || c.name || c.full_name || c.sortable_name || "";
      var tekst = function(v) {
        return v == null ? "" : String(v).replace(/\s+/g, " ").trim().slice(0, 40);
      };
      return { id: String(c.id), name: tekst(naam).slice(0, 200) || String(naam), pc: postcodeFromClient(c), number: tekst(c.identification_no), birth: tekst(c.date_of_birth) };
    });
  }
  function searchClientsForPlan(term) {
    var t = String(term || "").trim();
    if (t.length < 2) return Promise.resolve([]);
    return getJson(_apiUrl("searchClients", { term: t, outOfCare: "false" })).then(clientsForPlan);
  }

  // src/content/features/agenda/route.js
  function routeEnabled() {
    return !(APP_CONFIG.features && APP_CONFIG.features.routeLink === false);
  }
  function hm(ms) {
    var d = new Date(ms);
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }
  function dayRoute(date, origin) {
    if (!routeEnabled()) return Promise.reject(new Error("De route staat uit (beheer)."));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return Promise.reject(new Error("Kies een dag."));
    var ids = viewedInviteeIds(resolveInviteeId());
    if (!ids.length) return Promise.reject(new Error("Open eerst je agenda in ONS."));
    var limiet = createLimiter(3);
    return Promise.all(ids.map(function(id) {
      return getJson(_apiUrl("weekEvents", { inviteeId: id, date })).then(function(json) {
        var bezoeken = mapAgendaWeekResponse(json).filter(function(e) {
          return e && e.date === date && !e.allDay && e.startMs != null && isAtClient(e, !!officeForLocation(e.locationName));
        }).sort(function(a, b) {
          return a.startMs - b.startMs;
        });
        return Promise.all(bezoeken.map(function(e) {
          var url = e.detailsUrl || (e.occurrenceId ? _apiUrl("eventDetails", { inviteeId: id, occurrenceId: e.occurrenceId }) : null);
          if (!url) return Promise.resolve({ start: hm(e.startMs), address: "" });
          return limiet(function() {
            return getJson(url);
          }).then(
            function(d) {
              return { start: hm(e.startMs), address: addressFromDetails(d) };
            },
            function() {
              return { start: hm(e.startMs), address: "" };
            }
          );
        }));
      }).then(function(stops) {
        var metAdres = stops.filter(function(s) {
          return s.address;
        });
        return {
          id,
          name: ids.length > 1 ? inviteeName(id) : "",
          stops,
          missing: stops.length - metAdres.length,
          urls: routeUrls(metAdres.map(function(s) {
            return s.address;
          }), origin)
        };
      });
    })).then(function(persons) {
      return { date, persons };
    });
  }

  // src/content/features/agenda/side-panel-bridge.js
  var PANEL_FEATURES = ["weekRatio", "production", "openRegistrations", "quickRegister", "planner", "plannerCopies", "plannerDistance", "plannerMulti", "plannerDirect", "routeLink"];
  function routesProxyVoorPaneel() {
    var p = APP_CONFIG.routesProxy || {};
    var url = String(p.url || "").trim().replace(/\/+$/, "");
    if (/^https:\/\/[^/]+/.test(url) && p.token) return { url, token: String(p.token) };
    var key = String(p.routesKey || "").trim();
    return /^[A-Za-z0-9_-]{20,60}$/.test(key) ? { key } : null;
  }
  function panelFeatures() {
    var f = APP_CONFIG.features || {}, uit = {};
    PANEL_FEATURES.forEach(function(k) {
      uit[k] = f[k] !== false;
    });
    return uit;
  }
  var VERSION = SCRIPT_VERSION;
  function agPanelState() {
    var res = agendaPage._agLastEntries && agendaPage._agLastEntries.length ? computeTotalsApi() : computeTotals();
    var view = currentCalendarView();
    var windowStart = editableWindowStart();
    var windowStatus = {};
    Object.keys(res.past || {}).forEach(function(d) {
      var st = windowStatusForDate(d, windowStart);
      if (st) windowStatus[d] = st;
    });
    var profLabel = null;
    if (agendaPage.currentProfile) profLabel = PROFILES[agendaPage.currentProfile] && PROFILES[agendaPage.currentProfile].label || agendaPage.currentProfile;
    return {
      enabled: !!agendaPage.greyEnabled,
      profileLabel: profLabel,
      view,
      past: res.past || {},
      future: res.future || { client: 0, overig: 0 },
      windowStatus,
      // Alleen in dagweergave getoond; buiten die weergave niet berekenen.
      unfinished: view === "day" ? listUnfinished().map(function(i) {
        return { id: i.id, time: i.time, name: i.name, client: !!i.client };
      }) : [],
      legend: (activeLegend() || []).map(function(l) {
        return { color: l.color, text: l.text };
      }),
      windowLabel: workdayWindowLabel(),
      version: VERSION,
      week: agendaPage._agLastWeek,
      weekError: agendaPage._agWeekError || "",
      // Zodat het zijpaneel kan laten zien dat er herrekend wordt; zonder dit
      // lijkt een weekwissel te blijven hangen op de vorige cijfers.
      weekLoading: !!agendaPage._agWeekBusy,
      // Toont het zijpaneel de knop 'Verlof aanvragen'? (uit te zetten door beheer)
      leaveRequest: leaveRequestEnabled(),
      // Welke agenda (invitee) er bekeken wordt: wisselt die, dan begint het
      // zijpaneel opnieuw (resultaten van de vorige medewerker horen er niet).
      inviteeId: agendaPage._agLastInviteeId != null ? String(agendaPage._agLastInviteeId) : null,
      // De bekeken datum: startpunt voor bladeren per week.
      viewDate: currentAgendaDate(),
      // Hoeveel agenda's er naast elkaar open staan (planhulp zoekt dan gezamenlijke tijd).
      inviteeCount: currentInviteeIds().length || 1,
      // Standaardperiode voor 'Open registraties controleren'.
      rangeDefaultFrom: defaultRangeFrom(),
      productionDefaultFrom: defaultProductionFrom(),
      productionDefaultTo: defaultProductionTo(),
      // Markering van niet-cliënturen, voor de uitleg op de pagina 'Verhouding per uursoort'.
      nonClientMarker: _nonClientMarker(),
      routeEnabled: routeEnabled(),
      // Schakelaars uit het beheerscherm voor de zijpaneelfuncties (true = aan).
      features: panelFeatures(),
      // Rijtijden-server (alleen https); leeg = niet ingesteld.
      routesProxy: routesProxyVoorPaneel(),
      // Sleutel voor de kaart (alleen Maps Embed API); leeg = geen kaart.
      mapsEmbedKey: String(APP_CONFIG.routesProxy && APP_CONFIG.routesProxy.embedKey || "").trim(),
      today: agendaYmd(/* @__PURE__ */ new Date())
    };
  }
  function pushPanelState(force) {
    if (!agendaPage.sidePanelOpen) return;
    try {
      var st = agPanelState();
      var sig = JSON.stringify(st);
      if (!force && sig === agendaPage._agStateSig) return;
      agendaPage._agStateSig = sig;
      chrome.runtime.sendMessage({ type: MSG.AGENDA_STATE, state: st });
    } catch (e) {
    }
  }
  function setSidePanelOpen(open) {
    if (agendaPage.sidePanelOpen === !!open) return;
    agendaPage.sidePanelOpen = !!open;
    if (agendaPage.sidePanelOpen) {
      agendaPage._agStateSig = "";
      safe(function() {
        pushPanelState(true);
      });
    }
  }
  function listenForSidePanelMessages() {
    try {
      chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
        if (!msg || typeof msg.type !== "string") return;
        switch (msg.type) {
          case MSG.SIDEPANEL_STATE:
            setSidePanelOpen(!!msg.open);
            return;
          case MSG.AGENDA_GET_STATE:
            agendaPage.sidePanelOpen = true;
            try {
              sendResponse({ state: agendaPage.active ? agPanelState() : null });
            } catch (e) {
            }
            return true;
          case MSG.AGENDA_TOGGLE_ENABLED:
            safe(function() {
              agendaPage.greyEnabled = !!msg.value;
              storageSet(STORE_GREY_ENABLED, agendaPage.greyEnabled ? "1" : "0");
              schedulePaint();
              pushPanelState(true);
            });
            return;
          case MSG.AGENDA_JUMP_DAY:
            safe(function() {
              jumpToDay(msg.date, !!msg.always);
            });
            return;
          case MSG.AGENDA_JUMP_WEEK:
            safe(function() {
              jumpToWeek();
            });
            return;
          case MSG.AGENDA_OPEN_OCCURRENCE:
            safe(function() {
              var item = listUnfinished().find(function(i) {
                return i.id && i.id === msg.id;
              });
              if (item) openOccurrence(item.el);
            });
            return;
          case MSG.AGENDA_OPEN_LEAVE:
            safe(function() {
              if (leaveRequestEnabled()) openLeaveDialog();
            });
            return;
          case MSG.AGENDA_CHECK_RANGE:
            var uitCache = !msg.vers && isCached("open", msg.from + "|" + msg.to);
            cachedOpenRange(msg.from, msg.to, function(done, total) {
              try {
                chrome.runtime.sendMessage({ type: MSG.AGENDA_RANGE_PROGRESS, kind: "open", done, total });
              } catch (e) {
              }
            }, !!msg.vers).then(function(result) {
              try {
                sendResponse({ ok: true, result, uitCache });
              } catch (e) {
              }
            }, function(e) {
              try {
                sendResponse({ ok: false, error: e && e.message || "Controleren mislukt." });
              } catch (e2) {
              }
            });
            return true;
          case MSG.AGENDA_NEW_EVENT:
            try {
              sendResponse(openNewEvent(msg));
            } catch (e) {
              try {
                sendResponse({ ok: false, error: "Openen mislukt." });
              } catch (e2) {
              }
            }
            return;
          case MSG.AGENDA_DAY_ROUTE:
            dayRoute(msg.date, msg.origin).then(function(result) {
              try {
                sendResponse({ ok: true, result });
              } catch (e) {
              }
            }, function(e) {
              try {
                sendResponse({ ok: false, error: e && e.message || "Route ophalen mislukt." });
              } catch (e2) {
              }
            });
            return true;
          case MSG.AGENDA_SLOT_CHECK:
            checkSlotWithOns(msg).then(function(r) {
              try {
                sendResponse({ ok: true, status: r.status, overlap: r.overlap });
              } catch (e) {
              }
            }, function() {
              try {
                sendResponse({ ok: true, status: "ready", overlap: null });
              } catch (e2) {
              }
            });
            return true;
          case MSG.AGENDA_EVENT_OPTIONS:
            eventOptions(msg.clientIds).then(function(r) {
              try {
                sendResponse(Object.assign({ ok: true }, r));
              } catch (e) {
              }
            }, function(e) {
              try {
                sendResponse({ ok: false, error: e && e.message || "Ophalen mislukt." });
              } catch (e2) {
              }
            });
            return true;
          case MSG.AGENDA_CREATE_EVENTS:
            createEvents(msg.events).then(function(results) {
              try {
                sendResponse({ ok: true, results });
              } catch (e) {
              }
            }, function(e) {
              try {
                sendResponse({ ok: false, error: e && e.message || "Maken mislukt." });
              } catch (e2) {
              }
            });
            return true;
          case MSG.AGENDA_RELOAD:
            try {
              sendResponse({ ok: true });
            } catch (e) {
            }
            setTimeout(function() {
              location.reload();
            }, 50);
            return false;
          case MSG.AGENDA_CLIENT_SEARCH:
            searchClientsForPlan(msg.term).then(function(clients) {
              try {
                sendResponse({ ok: true, clients });
              } catch (e) {
              }
            }, function() {
              try {
                sendResponse({ ok: false, error: "Zoeken in ONS mislukt." });
              } catch (e2) {
              }
            });
            return true;
          case MSG.AGENDA_FREE_SLOTS:
            cachedFreeSlots(msg.minutes, msg.weeks, msg.to, !!msg.visits, !!msg.many).then(function(result) {
              try {
                sendResponse({ ok: true, result });
              } catch (e) {
              }
            }, function(e) {
              try {
                sendResponse({ ok: false, error: e && e.message || "Zoeken mislukt." });
              } catch (e2) {
              }
            });
            return true;
          case MSG.AGENDA_WEEK_RATIO:
            cachedWeekRatio(msg.date).then(function(result) {
              try {
                sendResponse({ ok: true, result });
              } catch (e) {
              }
            }, function(e) {
              try {
                sendResponse({ ok: false, error: e && e.message || "Ophalen mislukt." });
              } catch (e2) {
              }
            });
            return true;
          case MSG.AGENDA_PRODUCTION:
            cachedProduction(msg.from, msg.to, function(done, total) {
              try {
                chrome.runtime.sendMessage({ type: MSG.AGENDA_RANGE_PROGRESS, kind: "productie", done, total });
              } catch (e) {
              }
            }).then(function(result) {
              try {
                sendResponse({ ok: true, result });
              } catch (e) {
              }
            }, function(e) {
              try {
                sendResponse({ ok: false, error: e && e.message || "Berekenen mislukt." });
              } catch (e2) {
              }
            });
            return true;
          case MSG.AGENDA_QUICK_REGISTER:
            quickRegister(msg).then(function(r) {
              try {
                sendResponse(r);
              } catch (e) {
              }
            }, function() {
              try {
                sendResponse({ ok: false, error: "Openen mislukt." });
              } catch (e) {
              }
            });
            return true;
          default:
            return;
        }
      });
    } catch (e) {
    }
  }
  function askSidePanelState() {
    try {
      chrome.runtime.sendMessage({ type: MSG.SIDEPANEL_QUERY }, function(r) {
        void chrome.runtime.lastError;
        if (r && r.open) setSidePanelOpen(true);
      });
      document.addEventListener("visibilitychange", function() {
        if (document.visibilityState !== "visible") return;
        try {
          chrome.runtime.sendMessage({ type: MSG.SIDEPANEL_QUERY }, function(r) {
            void chrome.runtime.lastError;
            if (r && typeof r.open === "boolean") setSidePanelOpen(r.open);
          });
        } catch (e) {
        }
      });
    } catch (e) {
    }
  }

  // src/content/features/agenda/profile.js
  function applyProfileValue(p) {
    agendaPage.currentProfile = p && (profileExists(p) || PROFILES[p]) ? p : null;
    if (agendaPage.active) schedulePaint();
    try {
      pushPanelState(true);
    } catch (e) {
    }
  }
  function loadProfileFromStorage() {
    try {
      if (typeof chrome === "undefined" || !chrome.storage) return;
      const area2 = chrome.storage.sync || chrome.storage.local;
      area2.get([SYNC.COLOR_PROFILE], function(res) {
        if (res && res[SYNC.COLOR_PROFILE]) {
          applyProfileValue(res[SYNC.COLOR_PROFILE]);
          return;
        }
        if (chrome.storage.sync && chrome.storage.local) {
          chrome.storage.local.get([SYNC.COLOR_PROFILE], function(loc) {
            if (loc && loc[SYNC.COLOR_PROFILE]) {
              chrome.storage.sync.set({ [SYNC.COLOR_PROFILE]: loc[SYNC.COLOR_PROFILE] });
              applyProfileValue(loc[SYNC.COLOR_PROFILE]);
            } else applyProfileValue(null);
          });
        } else applyProfileValue(null);
      });
    } catch (e) {
    }
  }
  function watchProfileChanges() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(function(changes, area2) {
          if ((area2 === "sync" || area2 === "local") && changes[SYNC.COLOR_PROFILE]) applyProfileValue(changes[SYNC.COLOR_PROFILE].newValue);
        });
      }
    } catch (e) {
    }
  }

  // src/content/features/agenda/lifecycle.js
  var NEEDLE = "/invitees";
  function paginaActief() {
    if (document.hasFocus()) return true;
    return !!agendaPage.sidePanelOpen && document.visibilityState === "visible";
  }
  function activateAgendaPage() {
    if (agendaPage.active) return;
    agendaPage.active = true;
    try {
      clearPendingRegistration();
    } catch (e) {
    }
    loadProfileFromStorage();
    schedulePaint();
    agendaPage.observer = new MutationObserver((muts) => {
      const own = muts.every((m) => {
        const t = m.target;
        return t && t.classList && t.classList.contains(CLASS);
      });
      if (!own) schedulePaint();
    });
    agendaPage.observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("resize", schedulePaint);
    if (!agendaPage.pollTimer) agendaPage.pollTimer = setInterval(function() {
      if (paginaActief()) schedulePaint();
    }, 250);
    if (!agendaPage.totalsTimer) agendaPage.totalsTimer = setInterval(function() {
      if (!paginaActief()) return;
      try {
        const res = computeTotals();
        const cnt = Object.keys(res.past).filter((d) => res.past[d].client + res.past[d].overig > 0).length;
        pushBadge(cnt);
        updateTotals(res);
        refreshAgendaWeekApi();
        if (agendaPage._agWeekLoaded && !agendaPage._agWeekBusy) preloadPanelData();
      } catch (e) {
      }
    }, 300);
  }
  function deactivateAgendaPage() {
    if (!agendaPage.active) return;
    agendaPage.active = false;
    if (agendaPage.observer) {
      agendaPage.observer.disconnect();
      agendaPage.observer = null;
    }
    if (agendaPage.pollTimer) {
      clearInterval(agendaPage.pollTimer);
      agendaPage.pollTimer = null;
    }
    if (agendaPage.totalsTimer) {
      clearInterval(agendaPage.totalsTimer);
      agendaPage.totalsTimer = null;
    }
    pushBadge(0);
    try {
      agendaPage._agStateSig = "";
      if (agendaPage.sidePanelOpen) chrome.runtime.sendMessage({ type: MSG.AGENDA_GONE });
    } catch (e) {
    }
    window.removeEventListener("resize", schedulePaint);
    removeAll();
  }
  function helperScreenActive() {
    return location.href.includes(CONFIG.urlNeedle) || location.href.includes(CONFIG.registrationNeedle);
  }
  function syncAgendaPage() {
    if (APP_CONFIG.features && APP_CONFIG.features.dayColoring === false) deactivateAgendaPage();
    else if (location.href.includes(NEEDLE) && !helperScreenActive()) activateAgendaPage();
    else deactivateAgendaPage();
  }

  // src/content/core/test-api.js
  function __exposeForTest(map) {
    try {
      if (typeof window === "undefined" || !window.__ONS_EXPOSE_FOR_TEST) return;
      window.__onsHelperTestApi = window.__onsHelperTestApi || {};
      for (const k in map) if (Object.prototype.hasOwnProperty.call(map, k)) window.__onsHelperTestApi[k] = map[k];
    } catch (e) {
    }
  }

  // src/content/features/agenda/index.js
  function exposeAgendaTestApi() {
    __exposeForTest({
      computeTotals,
      isDeclared,
      classifyOccurrence,
      occurrenceIsPast,
      occurrenceOverdue24h,
      editableWindowStart,
      windowStatusForDate,
      listUnfinished,
      configProfileZones,
      configProfileLegend
    });
  }
  function startDayColoring() {
    watchProfileChanges();
    setOnHelperConfigChanged(function() {
      try {
        syncAgendaPage();
        if (agendaPage.active) schedulePaint();
        safe(function() {
          pushPanelState(true);
        });
      } catch (e) {
      }
    });
    listenForSidePanelMessages();
    askSidePanelState();
    setAgendaHelperDeactivate(deactivateAgendaPage);
    window.addEventListener("locationchange", syncAgendaPage);
    window.addEventListener("popstate", syncAgendaPage);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", syncAgendaPage);
    } else {
      syncAgendaPage();
    }
    exposeAgendaTestApi();
  }

  // src/content/features/ui-inspector.js
  function startUiInspector() {
    "use strict";
    try {
      if (window.top !== window.self) return;
    } catch (e) {
    }
    if (window.__onsUiInspectorLoaded) return;
    window.__onsUiInspectorLoaded = true;
    const OVERRIDE_KEY = LOCAL.UI_OVERRIDES;
    const OPEN_KEY = LOCAL.OPEN_INSPECTOR;
    const PERSIST_KEY = LOCAL.INSPECTOR_OPEN;
    function setPersist(v) {
      try {
        chrome.storage.local.set({ [PERSIST_KEY]: v });
      } catch (e) {
      }
    }
    let overrides = {};
    try {
      if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.get([OVERRIDE_KEY], (r) => {
        overrides = r && r[OVERRIDE_KEY] || {};
      });
    } catch (e) {
    }
    function deepQueryAll2(selector) {
      const out = [], seen = /* @__PURE__ */ new Set();
      const walk = (root2) => {
        if (!root2 || seen.has(root2)) return;
        seen.add(root2);
        try {
          out.push.apply(out, root2.querySelectorAll(selector));
        } catch (e) {
          return;
        }
        let all;
        try {
          all = root2.querySelectorAll("*");
        } catch (e) {
          return;
        }
        for (const el of all) if (el.shadowRoot) walk(el.shadowRoot);
      };
      walk(document);
      try {
        for (const fr of document.querySelectorAll("iframe,frame")) {
          try {
            if (fr.contentDocument) walk(fr.contentDocument);
          } catch (e) {
          }
        }
      } catch (e) {
      }
      return out;
    }
    function norm(s) {
      return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase();
    }
    function vis(el) {
      try {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
      } catch (e) {
        return false;
      }
    }
    function inOwnUi(el) {
      return !!(root && root.contains(el));
    }
    function controlsUnderLabel(labelTexts, controlSel) {
      const want = (Array.isArray(labelTexts) ? labelTexts : [labelTexts]).map(norm);
      const out = [], seen = /* @__PURE__ */ new Set();
      deepQueryAll2("label,div,span,p").forEach((lb) => {
        if (inOwnUi(lb) || !vis(lb) || want.indexOf(norm(lb.textContent)) < 0) return;
        let lr;
        try {
          lr = lb.getBoundingClientRect();
        } catch (e) {
          return;
        }
        deepQueryAll2(controlSel).forEach((c) => {
          if (inOwnUi(c) || seen.has(c) || !vis(c)) return;
          let cr;
          try {
            cr = c.getBoundingClientRect();
          } catch (e) {
            return;
          }
          if (cr.top >= lr.bottom - 14 && cr.top <= lr.bottom + 100 && Math.abs(cr.left - lr.left) <= 140) {
            seen.add(c);
            out.push(c);
          }
        });
      });
      return out;
    }
    function controlsByHint(re, sel) {
      return deepQueryAll2(sel).filter((el) => {
        if (inOwnUi(el) || !vis(el)) return false;
        const hay = [el.getAttribute && el.getAttribute("placeholder"), el.getAttribute && el.getAttribute("aria-label"), el.getAttribute && el.getAttribute("title"), el.textContent].map(norm).join(" ");
        return re.test(hay);
      });
    }
    const CTRL = 'uc-select,uc-multi-select,ue-activity-select,[role="combobox"],input,select,[class*="select" i]';
    function isLocationCtrl(el) {
      try {
        const dq = el.getAttribute && el.getAttribute("data-qa");
        if (dq && /location|locatie/i.test(dq)) return true;
        const al = el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("aria-description")) || "";
        if (/locatie|location/i.test(al)) return true;
        if (/zoek naar locaties/.test(norm(el.textContent))) return true;
      } catch (e) {
      }
      return false;
    }
    function controlsByText(texts, sel, exclude) {
      const want = texts.map(norm);
      return deepQueryAll2(sel).filter((el) => !inOwnUi(el) && vis(el) && !(exclude && exclude(el)) && want.some((w) => norm(el.textContent).indexOf(w) >= 0));
    }
    function nearestUnderLabel(labelTexts, sel, exclude) {
      const all = controlsUnderLabel(labelTexts, sel).filter((el) => !(exclude && exclude(el)));
      all.sort((a, b) => {
        try {
          return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
        } catch (e) {
          return 0;
        }
      });
      return all.length ? [all[0]] : [];
    }
    const labelsMatcher = () => {
      const exact = controlsByText(["zoek naar labels", "zoek naar etiketten"], CTRL, isLocationCtrl);
      if (exact.length) return exact;
      const near = nearestUnderLabel(["labels", "label", "etiket", "etiketten"], CTRL, isLocationCtrl);
      if (near.length) return near;
      return controlsByHint(/label|etiket/, CTRL).filter((el) => !isLocationCtrl(el));
    };
    const uursoortMatcher = () => {
      const fixed = deepQueryAll2('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], [data-qa="hour_type_select"], [role="combobox"][aria-label="Uursoort"]').filter((el) => vis(el) && !inOwnUi(el) && !isLocationCtrl(el));
      if (fixed.length) return fixed;
      const exact = controlsByText(["zoek naar uursoorten"], CTRL, isLocationCtrl);
      if (exact.length) return exact;
      const near = nearestUnderLabel(["uursoort", "uursoorten", "hour type"], CTRL, isLocationCtrl);
      return near.length ? near : controlsByHint(/uursoort|hour type/, CTRL).filter((el) => !isLocationCtrl(el));
    };
    const clientNameMatcher = () => deepQueryAll2('ul[data-qa="selected_clients"] [class*="_invitee-name_"], ul[class*="_selected-clients_"] [class*="_invitee-name_"]').filter((el) => vis(el) && !inOwnUi(el));
    const addButtonMatcher = () => {
      const cands = deepQueryAll2("uc-button, button").filter((el) => {
        if (inOwnUi(el) || !vis(el)) return false;
        const hasAdd = el.querySelector && el.querySelector('uc-icon[icon="add"], [icon="add"]') || el.shadowRoot && el.shadowRoot.querySelector && el.shadowRoot.querySelector('uc-icon[icon="add"], [icon="add"]');
        return /(^|[^a-z])toevoegen([^a-z]|$)/.test(norm(el.textContent)) || !!hasAdd;
      });
      const withText = cands.filter((el) => /(^|[^a-z])toevoegen([^a-z]|$)/.test(norm(el.textContent)));
      let base = withText.length ? withText : cands;
      if (modalIsOpen()) {
        const modals = deepQueryAll2('dialog[open], uc-modal, [role="dialog"]').filter((m) => vis(m) && !inOwnUi(m));
        base = base.filter((el) => modals.some((m) => {
          try {
            return m.contains(el);
          } catch (e) {
            return false;
          }
        }));
      }
      return base;
    };
    function inputsUnderLabelText(labelTexts, sel) {
      const want = (Array.isArray(labelTexts) ? labelTexts : [labelTexts]).map(norm);
      const out = [], seen = /* @__PURE__ */ new Set();
      deepQueryAll2("label,div,span,p").forEach((lb) => {
        if (inOwnUi(lb) || !vis(lb) || want.indexOf(norm(lb.textContent)) < 0) return;
        let lr;
        try {
          lr = lb.getBoundingClientRect();
        } catch (e) {
          return;
        }
        deepQueryAll2(sel).forEach((c) => {
          if (inOwnUi(c) || seen.has(c) || !vis(c)) return;
          let cr;
          try {
            cr = c.getBoundingClientRect();
          } catch (e) {
            return;
          }
          if (cr.top >= lr.bottom - 18 && cr.top <= lr.bottom + 120 && Math.abs(cr.left - lr.left) <= 240) {
            seen.add(c);
            out.push(c);
          }
        });
      });
      return out;
    }
    const beginTimeMatcher = () => {
      const h = deepQueryAll2('uc-time-input[aria-label^="Begintijd" i]').filter((el) => vis(el) && !inOwnUi(el));
      return h.length ? h : inputsUnderLabelText(["begintijd", "begintijd*"], 'input[placeholder="uu:mm"]');
    };
    const eindTimeMatcher = () => {
      const h = deepQueryAll2('uc-time-input[aria-label^="Eindtijd" i]').filter((el) => vis(el) && !inOwnUi(el));
      return h.length ? h : inputsUnderLabelText(["eindtijd", "eindtijd*"], 'input[placeholder="uu:mm"]');
    };
    const travelHeenMatcher = () => {
      const d = deepQueryAll2('input[aria-label="Reistijd heen" i]').filter((el) => vis(el) && !inOwnUi(el));
      return d.length ? d : inputsUnderLabelText(["reistijd heen"], "input");
    };
    const travelTerugMatcher = () => {
      const d = deepQueryAll2('input[aria-label="Reistijd terug" i]').filter((el) => vis(el) && !inOwnUi(el));
      return d.length ? d : inputsUnderLabelText(["reistijd terug"], "input");
    };
    const recurrenceHeaderMatcher = () => deepQueryAll2("button[aria-expanded]").filter((b) => {
      if (inOwnUi(b) || !vis(b)) return false;
      let spans;
      try {
        spans = b.querySelectorAll("span");
      } catch (e) {
        return false;
      }
      for (const s of spans) if (norm(s.textContent) === "herhaling") return true;
      return false;
    });
    const HOOKS = [
      ["Agenda", "Dagkolom", ".day.js_day", "agDayColumn", "rel"],
      ["Agenda", "Dagkolom-cel", "td.calendar_day", "agDayCell", "rel"],
      ["Agenda", "Afspraak-blok", ".js_calendar_occurrence.calendar_occurrence_base", "agOccurrence", "rel"],
      ["Agenda", "Afspraak met titel", ".calendar_occurrence--has-title", "agOccurrenceTitle", "rel"],
      ["Agenda", "Afspraak-titel", ".appointment-title", "agApptTitle", "rel"],
      ["Agenda", "Label met title-attr", ".labels .label[title]", "agLabelTitle", "rel"],
      ["Agenda", "Detailpopup", '[data-qa="occurrence-popover"]', "agPopover", "rel"],
      ["Agenda", "Labelchip in detailpopup", ".labels uc-tag", "agPopoverLabel", "rel"],
      ["Agenda", "Registreren-knop in detailpopup", '[data-qa="occurrence-popover-primary"]', "agDeclare", "rel"],
      ["Agenda", "Status-vlag", "[data-status]"],
      ["Afspraak (modal)", "Modal / dialog", 'uc-modal,[role="dialog"],dialog', "modalPanelSelector"],
      ["Afspraak (modal)", "Uursoort-veld", uursoortMatcher, "uursoortFieldSelector"],
      ["Afspraak (modal)", "Labels-veld", labelsMatcher, "etiketFieldSelector"],
      ["Afspraak (modal)", "Labels-chips (verwijderknoppen)", 'button[aria-label^="Verwijder label" i], [data-qa="label_tags"] button', "afsLabelChips", "rel"],
      ["Afspraak (modal)", "Toevoegen-knop", addButtonMatcher],
      ["Afspraak (modal)", "Cliëntlijst", 'ul[class*="_selected-clients_"] > li, ul[data-qa="selected_clients"] > li, [data-qa="selected_clients"]', "afsClientList", "rel"],
      ["Afspraak (modal)", "Cliëntnaam", clientNameMatcher, "afsClientName", "rel"],
      ["Afspraak (modal)", "Uitklap-cliëntvelden", '[data-qa="toggle-invitee-fields-button"]', "afsInviteeToggle", "rel"],
      ["Afspraak (modal)", "Datumveld", 'uc-date-input[aria-label="Datum*"], uc-date-input[aria-label="Datum"]', "afsDatum"],
      ["Afspraak (modal)", "Begintijd", beginTimeMatcher, "afsBegintijd"],
      ["Afspraak (modal)", "Eindtijd", eindTimeMatcher, "afsEindtijd"],
      ["Afspraak (modal)", "Reistijd heen", travelHeenMatcher, "afsTravelBefore"],
      ["Afspraak (modal)", "Reistijd terug", travelTerugMatcher, "afsTravelAfter"],
      ["Afspraak (modal)", "Titelveld", 'input[aria-label*="Titel" i], input[name*="title" i]', "afsTitel"],
      ["Afspraak (modal)", "Sluitknop", 'uc-button[aria-label*="sluit" i], button[aria-label*="sluit" i]', "afsCloseButton"],
      ["Afspraak (modal)", "Opslaan/submit", 'button[type="submit"], uc-button[type="submit"]', "afsOpslaan"],
      ["Afspraak (modal)", "Herhaling-kop (doorplannen)", recurrenceHeaderMatcher, "recurrenceHeader"],
      ["Afspraak (modal)", "Herhaling-keuze (type)", '[data-qa="recurrence-type"]', "recurrenceType"],
      ["Registratie", "Cliënt-formulier", "div.client_form[data-invitee-id]"],
      ["Registratie", "Uursoort-veld", 'select[id*="hour_type"], [data-qa="hour_type_select"]'],
      ["Registratie", "Verplichte rij", "tr.required"],
      ["Registratie", "Begintijd", '#declaration_start_time_display, input[name*="start_time" i]', "regStart"],
      ["Registratie", "Eindtijd", '#declaration_end_time_display, input[name*="end_time" i]', "regEnd"],
      ["Registratie", "Directe tijd", '#declaration_direct_time, input[name*="direct_time" i]:not([name*="indirect" i])', "regDirect"],
      ["Registratie", "Indirecte tijd", '#declaration_indirect_time, input[name*="indirect_time" i]', "regIndirect"],
      ["Registratie", "Reistijd heen", '#declaration_travel_time_before, input[name*="travel_time_before" i]', "regTravelBefore"],
      ["Registratie", "Reistijd terug", '#declaration_travel_time_after, input[name*="travel_time_after" i]', "regTravelAfter"],
      ["Registratie", "Reistijd toevoegen", "#js_add_travel_time", "regTravelAdd"],
      ["Registratie", "Rapportageveld", '[id$="__dossier_report_comment"], textarea[id*="report_comment" i], textarea[name*="report" i]', "regReport"],
      ["Registratie", "select2 wisknop", ".select2-selection__clear"],
      ["Vragenlijst", "Survey-titel", '[data-survey-title], [data-react-component="SurveyResultHeader"][data-props]', "surveyTitleSelector"],
      ["Vragenlijst", "Vraag", ".survey_question, tr.required", "surveyQuestionSelector", "rel"],
      ["Vragenlijst", "Leeftijd (cliënt) → {clientLeeftijd}", '[data-testid*="birthdate" i], [class*="birthdate" i], [datetime], [aria-label*="geboorte" i]', "surveyAgeSelector"],
      ["Vragenlijst", "Vraagtekst (alle vragen) → {vraag}", ".question-text", "surveyQuestionTextSelector", "rel"],
      ["Vragenlijst", "Naam (cliënt) → {clientNaam}", '.base-card__name-tags, [data-testid="client-details-name"], [data-testid="client-name"], .client-name', "surveyClientNameSelector"],
      ["Vragenlijst", "Volgende status", 'button[title="Volgende status"], button[aria-label="Volgende status"]', "surveyNextStatusSelector"]
    ];
    const C = { ok: "#1e8449", miss: "#c0392b", pick: "#cc087d" };
    let highlightsOn = true, onlyMissing = false, pickHook = null, root = null, panel = null, ov = null, refreshTimer = null, rowUpdaters = [];
    let moObserver = null, domDirty = true, lastFull = 0;
    function css(el, s) {
      Object.assign(el.style, s);
      return el;
    }
    function overrideSel(h) {
      return h[3] && overrides[h[3]] ? overrides[h[3]] : null;
    }
    function matches(h) {
      const o = overrideSel(h);
      try {
        if (o) return deepQueryAll2(o);
        if (typeof h[2] === "function") return h[2]() || [];
        return deepQueryAll2(h[2]);
      } catch (e) {
        return [];
      }
    }
    function visEls(h) {
      return matches(h).filter((el) => !inOwnUi(el) && vis(el));
    }
    function defaultEls(h) {
      try {
        const r = typeof h[2] === "function" ? h[2]() || [] : deepQueryAll2(h[2]);
        return r.filter((el) => !inOwnUi(el) && vis(el));
      } catch (e) {
        return [];
      }
    }
    const PW = 380;
    function setDock(on) {
      const de = document.documentElement;
      try {
        if (on) {
          de.style.setProperty("width", "calc(100vw - " + PW + "px)", "important");
          de.style.setProperty("min-width", "0", "important");
          de.style.setProperty("max-width", "calc(100vw - " + PW + "px)", "important");
          de.style.setProperty("overflow-x", "hidden", "important");
          de.style.setProperty("transform", "translateZ(0)", "important");
          de.style.setProperty("transform-origin", "top left", "important");
        } else {
          ["width", "min-width", "max-width", "overflow-x", "transform", "transform-origin"].forEach((p) => de.style.removeProperty(p));
        }
      } catch (e) {
      }
    }
    function hostFor() {
      try {
        const d = deepQueryAll2("dialog[open]").filter((x) => vis(x));
        if (d.length) return d[d.length - 1];
      } catch (e) {
      }
      return document.body;
    }
    function modalIsOpen() {
      try {
        return deepQueryAll2('dialog[open], uc-modal, [role="dialog"]').some((x) => vis(x) && !inOwnUi(x));
      } catch (e) {
        return false;
      }
    }
    function reattachIfNeeded() {
      if (!root) return;
      const host = hostFor();
      if (root.parentNode !== host) {
        try {
          root.hidePopover();
        } catch (e) {
        }
        host.appendChild(root);
        try {
          root.showPopover();
        } catch (e) {
        }
      } else if (!root.isConnected) {
        document.body.appendChild(root);
        try {
          root.showPopover();
        } catch (e) {
        }
      }
    }
    function ensureRoot() {
      if (root && root.isConnected) {
        setDock(true);
        reattachIfNeeded();
        return;
      }
      setDock(true);
      root = document.createElement("div");
      root.id = "__ons-ins-root";
      try {
        root.setAttribute("popover", "manual");
      } catch (e) {
      }
      css(root, { position: "fixed", inset: "0", width: "100vw", height: "100vh", maxWidth: "none", maxHeight: "none", margin: "0", padding: "0", border: "0", background: "transparent", overflow: "visible", pointerEvents: "none", zIndex: "2147483646" });
      ov = document.createElement("div");
      ov.style.pointerEvents = "none";
      root.appendChild(ov);
      hostFor().appendChild(root);
      try {
        root.showPopover();
      } catch (e) {
      }
    }
    function removeRoot() {
      setDock(false);
      if (root) {
        try {
          root.hidePopover();
        } catch (e) {
        }
        root.remove();
        root = null;
        ov = null;
        panel = null;
      }
    }
    function drawHighlights() {
      if (!ov) return;
      ov.innerHTML = "";
      if (!highlightsOn) return;
      const mOpen = modalIsOpen();
      HOOKS.forEach((h) => {
        if (mOpen && h[0] === "Agenda") return;
        const els = visEls(h).slice(0, 40);
        const over = !!overrideSel(h);
        els.forEach((el, idx) => {
          let r;
          try {
            r = el.getBoundingClientRect();
          } catch (e) {
            return;
          }
          if (!r || r.width === 0 && r.height === 0) return;
          const primary = idx === 0;
          const col = over ? C.pick : C.ok;
          const b = document.createElement("div");
          css(b, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", border: (primary ? "2px solid " : "2px dashed ") + col, borderRadius: "3px", background: primary ? "rgba(30,132,73,.10)" : "transparent", opacity: primary ? "1" : ".5", pointerEvents: "none", boxSizing: "border-box" });
          const t = document.createElement("div");
          t.textContent = h[1] + (primary && els.length > 1 ? " ★" : "");
          css(t, { position: "absolute", top: "-15px", left: "0", font: '10px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "#fff", background: col, padding: "1px 4px", borderRadius: "3px", whiteSpace: "nowrap", opacity: primary ? "1" : ".7" });
          b.appendChild(t);
          ov.appendChild(b);
        });
      });
    }
    function flash(h) {
      const el = visEls(h)[0];
      if (!el) {
        setStatus2("Niet op dit scherm.");
        return;
      }
      try {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch (e) {
      }
      setTimeout(() => {
        let r;
        try {
          r = el.getBoundingClientRect();
        } catch (e) {
          return;
        }
        const f = document.createElement("div");
        css(f, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", border: "3px solid " + C.pick, borderRadius: "4px", pointerEvents: "none", transition: "opacity .8s", opacity: "1" });
        ov.appendChild(f);
        setTimeout(() => {
          f.style.opacity = "0";
        }, 500);
        setTimeout(() => f.remove(), 1400);
        drawHighlights();
      }, 260);
    }
    function pickTarget(e) {
      try {
        const p = e.composedPath && e.composedPath();
        if (p && p.length && p[0] && p[0].nodeType === 1) return p[0];
      } catch (ex) {
      }
      return e.target;
    }
    function buildSelector(el) {
      if (!el || el.nodeType !== 1) return "";
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return "#" + el.id;
      const tag = el.tagName.toLowerCase();
      try {
        if (/-/.test(tag) && deepQueryAll2(tag).length === 1) return tag;
      } catch (ex) {
      }
      for (const a of ["data-qa", "aria-label", "name", "placeholder", "icon", "title"]) {
        const v = el.getAttribute && el.getAttribute(a);
        if (v) {
          const s = tag + "[" + a + '="' + String(v).replace(/"/g, '\\"') + '"]';
          if (deepQueryAll2(s).length === 1) return s;
        }
      }
      const cls = el.className && typeof el.className === "string" ? el.className.trim().split(/\s+/).filter((c) => /^[A-Za-z][\w-]*$/.test(c)) : [];
      if (cls.length) {
        const s = tag + "." + cls.slice(0, 3).join(".");
        if (deepQueryAll2(s).length === 1) return s;
      }
      let node = el, parts = [];
      while (node && node.nodeType === 1 && parts.length < 4) {
        let s = node.tagName.toLowerCase();
        const p = node.parentElement;
        if (p) {
          const sib = [...p.children].filter((c) => c.tagName === node.tagName);
          if (sib.length > 1) s += ":nth-of-type(" + (sib.indexOf(node) + 1) + ")";
        }
        parts.unshift(s);
        node = p;
      }
      return parts.join(" > ");
    }
    function buildClassSelector(el) {
      if (!el || el.nodeType !== 1) return "";
      const cls = el.className && typeof el.className === "string" ? el.className.trim().split(/\s+/).filter((c) => /^[A-Za-z][\w-]*$/.test(c)) : [];
      if (cls.length) return "." + cls.slice(0, 3).join(".");
      for (const a of ["data-qa", "data-testid", "aria-label"]) {
        const v = el.getAttribute && el.getAttribute(a);
        if (v) return el.tagName.toLowerCase() + "[" + a + '="' + String(v).replace(/"/g, '\\"') + '"]';
      }
      return el.tagName.toLowerCase();
    }
    function inShadow(el) {
      try {
        const rn = el.getRootNode && el.getRootNode();
        return !!(rn && rn.nodeType === 11 && rn.host);
      } catch (e) {
        return false;
      }
    }
    function isIconLeaf(el) {
      const tag = el && el.tagName ? el.tagName.toLowerCase() : "";
      return /^(svg|path|use|g|polygon|polyline|circle|ellipse|rect|line)$/.test(tag);
    }
    function customHostAncestor(el) {
      let n = el;
      for (let i = 0; n && i < 8; i++) {
        const rn = n.getRootNode && n.getRootNode();
        if (rn && rn.nodeType === 11 && rn.host) {
          n = rn.host;
          const tag = (n.tagName || "").toLowerCase();
          if (/-/.test(tag)) return n;
          continue;
        }
        break;
      }
      return null;
    }
    function _elemIdentity(n) {
      return n && n.getAttribute && (n.getAttribute("data-qa") || n.getAttribute("data-testid") || n.getAttribute("aria-label") || n.id && /^[A-Za-z][\w-]*$/.test(n.id));
    }
    function resolveMeaningfulTarget(el) {
      if (!el || el.nodeType !== 1) return el;
      if (!_elemIdentity(el) && inShadow(el)) {
        const host = customHostAncestor(el);
        if (host) return host;
      }
      if (!isIconLeaf(el)) return el;
      let n = el;
      for (let i = 0; n && n.nodeType === 1 && i < 6; i++) {
        const tag = n.tagName.toLowerCase();
        if (_elemIdentity(n)) return n;
        if (/^(button|a)$/.test(tag) || n.getAttribute && n.getAttribute("role") === "button") return n;
        if (/-/.test(tag) && !isIconLeaf(n)) return n;
        const parent = n.parentElement || n.getRootNode && n.getRootNode().host;
        if (!parent) break;
        n = parent;
      }
      return el.parentElement || el;
    }
    function selectorInfo(sel, el) {
      if (!sel) return { count: 0, brittle: false, shadow: false, invalid: false, empty: true };
      let list;
      try {
        list = deepQueryAll2(sel).filter((x) => vis(x) && !inOwnUi(x));
      } catch (e) {
        return { count: -1, brittle: true, shadow: false, invalid: true };
      }
      const brittle = /nth-of-type/.test(sel) || / > /.test(sel);
      const shadow = el ? inShadow(el) && list.length === 0 : false;
      return { count: list.length, brittle, shadow, invalid: false };
    }
    function saveOverride(k, s) {
      overrides[k] = s;
      try {
        chrome.storage.local.set({ [OVERRIDE_KEY]: overrides });
      } catch (e) {
      }
    }
    function clearOverride(k) {
      delete overrides[k];
      try {
        chrome.storage.local.set({ [OVERRIDE_KEY]: overrides });
      } catch (e) {
      }
    }
    function exportOverrides() {
      const payload = { uiSelectors: overrides || {} };
      const json = JSON.stringify(payload, null, 2);
      try {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ui-selectors.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4e3);
        setStatus2("ui-selectors.json geëxporteerd. Laad dit in het beheerscherm.");
      } catch (e) {
        try {
          navigator.clipboard.writeText(json);
          setStatus2("Kon niet downloaden; JSON naar klembord gekopieerd.");
        } catch (e2) {
          setStatus2("Export mislukt.");
        }
      }
    }
    let pickBox = null, pickBanner = null;
    function enterPick(h) {
      pickHook = h;
      if (panel) panel.style.display = "none";
      pickBanner = document.createElement("div");
      css(pickBanner, { position: "fixed", top: "0", left: "0", right: "0", padding: "12px", background: C.pick, color: "#fff", font: '700 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', textAlign: "center", pointerEvents: "none" });
      pickBanner.textContent = "Klik het juiste element aan voor: " + h[1] + "   (Esc = annuleren)";
      ov.appendChild(pickBanner);
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKey, true);
    }
    function exitPick() {
      pickHook = null;
      if (pickBox) {
        pickBox.remove();
        pickBox = null;
      }
      if (pickBanner) {
        pickBanner.remove();
        pickBanner = null;
      }
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      if (panel) panel.style.display = "";
      renderPanel();
      drawHighlights();
    }
    function inUi(el) {
      return panel && panel.contains(el) || root && root.contains(el);
    }
    function onMove(e) {
      const el = pickTarget(e);
      if (!el || inUi(el)) return;
      let r;
      try {
        r = el.getBoundingClientRect();
      } catch (ex) {
        return;
      }
      if (!pickBox) {
        pickBox = document.createElement("div");
        ov.appendChild(pickBox);
      }
      css(pickBox, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", border: "2px dashed " + C.pick, background: "rgba(204,8,125,.10)", pointerEvents: "none", boxSizing: "border-box" });
    }
    function onClick(e) {
      const raw = pickTarget(e);
      if (inUi(raw)) return;
      e.preventDefault();
      e.stopPropagation();
      const hook = pickHook;
      const tgt = resolveMeaningfulTarget(raw);
      const s = hook && hook[4] === "rel" ? buildClassSelector(tgt) : buildSelector(tgt);
      exitPick();
      if (s && hook && hook[3]) {
        pendingPick = { hook, selector: s, el: tgt };
        renderPanel();
      } else {
        setStatus2("Kon geen bruikbare selector maken.");
      }
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setStatusLater("Aanwijzen geannuleerd.");
        exitPick();
      }
    }
    let _pending = "";
    function setStatusLater(t) {
      _pending = t;
    }
    let pendingPick = null;
    function setStatus2(t) {
      const s = panel && panel.querySelector(".__st");
      if (s) s.textContent = t;
    }
    function mini(txt, fn, primary) {
      const b = document.createElement("button");
      b.textContent = txt;
      css(b, { border: "1px solid " + (primary ? C.pick : "#ccc"), background: primary ? C.pick : "#fafafa", color: primary ? "#fff" : "#333", borderRadius: "6px", padding: "3px 8px", cursor: "pointer", font: '600 11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' });
      b.onclick = (e) => {
        e.stopPropagation();
        fn();
      };
      return b;
    }
    function updateSummary() {
      if (!panel) return;
      let found = 0, total = 0;
      rowUpdaters.forEach((fn) => {
        total++;
        if (fn()) found++;
      });
      const sum = panel.querySelector(".__sum");
      if (sum) sum.innerHTML = '<span style="color:' + (found === total ? C.ok : "#b9770e") + '">' + found + " van " + total + "</span> hooks gevonden op dit scherm.";
    }
    function openPanel() {
      ensureRoot();
      try {
        if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.get([OVERRIDE_KEY], (r) => {
          overrides = r && r[OVERRIDE_KEY] || {};
          if (root && panel) {
            drawHighlights();
            renderPanel();
          }
        });
      } catch (e) {
      }
      panel = document.createElement("div");
      css(panel, { position: "fixed", top: "0", bottom: "0", left: "calc(100vw - " + PW + "px)", width: PW + "px", overflow: "auto", background: "#fff", color: "#222", borderLeft: "1px solid #ccc", boxShadow: "-6px 0 24px rgba(0,0,0,.15)", font: '13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', pointerEvents: "auto" });
      root.appendChild(panel);
      renderPanel();
      window.addEventListener("scroll", drawHighlights, true);
      window.addEventListener("resize", drawHighlights, true);
      drawHighlights();
      domDirty = true;
      lastFull = 0;
      try {
        moObserver = new MutationObserver(() => {
          domDirty = true;
        });
        moObserver.observe(document.documentElement, { subtree: true, childList: true });
      } catch (e) {
        moObserver = null;
      }
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(() => {
        if (!root || pickHook) return;
        reattachIfNeeded();
        const now = Date.now();
        if (!domDirty && now - lastFull < 2e3) return;
        domDirty = false;
        lastFull = now;
        drawHighlights();
        updateSummary();
      }, 500);
      if (_pending) {
        setStatus2(_pending);
        _pending = "";
      }
      setPersist(true);
    }
    function closePanel() {
      if (pickHook) exitPick();
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
      if (moObserver) {
        try {
          moObserver.disconnect();
        } catch (e) {
        }
        moObserver = null;
      }
      window.removeEventListener("scroll", drawHighlights, true);
      window.removeEventListener("resize", drawHighlights, true);
      removeRoot();
      setPersist(false);
    }
    function toggle() {
      if (root && panel) closePanel();
      else openPanel();
    }
    function renderPanel() {
      if (!panel) return;
      panel.innerHTML = "";
      rowUpdaters = [];
      let found = 0, total = 0;
      HOOKS.forEach((h) => {
        total++;
        if (visEls(h).length) found++;
      });
      const head = css(document.createElement("div"), { position: "sticky", top: "0", zIndex: "1", background: "#262229", color: "#fff", padding: "11px 13px", display: "flex", alignItems: "center", gap: "8px" });
      const title = document.createElement("div");
      title.innerHTML = "<b>UI-inspector</b>";
      title.style.flex = "1";
      const x = mini("Sluiten", closePanel);
      css(x, { border: "1px solid #fff6", background: "transparent", color: "#fff" });
      head.append(title, x);
      panel.appendChild(head);
      const body = css(document.createElement("div"), { padding: "11px 13px" });
      const sum = css(document.createElement("div"), { fontSize: "13px", fontWeight: "700", margin: "0 0 4px" });
      sum.className = "__sum";
      sum.innerHTML = '<span style="color:' + (found === total ? C.ok : "#b9770e") + '">' + found + " van " + total + "</span> hooks gevonden op dit scherm.";
      body.appendChild(sum);
      const live = css(document.createElement("div"), { fontSize: "10px", color: "#999", margin: "0 0 6px" });
      live.textContent = "↻ ververst automatisch elke 0,5 s";
      body.appendChild(live);
      const st = css(document.createElement("div"), { fontSize: "11px", color: "#666", minHeight: "14px", margin: "0 0 8px" });
      st.className = "__st";
      st.textContent = 'Klik een regel om het element te laten oplichten. "Herstel" = wijs het juiste element aan.';
      body.appendChild(st);
      if (pendingPick) {
        const h = pendingPick.hook;
        const pk = css(document.createElement("div"), { border: "2px solid " + C.pick, background: "#fff0f8", borderRadius: "8px", padding: "9px", margin: "0 0 10px" });
        const hd = document.createElement("div");
        hd.innerHTML = "<b>Herstel bevestigen: " + h[1] + "</b>";
        hd.style.margin = "0 0 6px";
        pk.appendChild(hd);
        const inp = document.createElement("input");
        inp.value = pendingPick.selector;
        css(inp, { width: "100%", boxSizing: "border-box", font: "11px Consolas, monospace", padding: "5px 6px", border: "1px solid #ccc", borderRadius: "5px", margin: "0 0 6px" });
        pk.appendChild(inp);
        const nMatch = (sel) => {
          try {
            return deepQueryAll2(sel).filter((x2) => vis(x2) && !inOwnUi(x2)).length;
          } catch (e) {
            return 0;
          }
        };
        const specificSel = buildSelector(pendingPick.el);
        const broadSel = buildClassSelector(pendingPick.el);
        const quick = css(document.createElement("div"), { display: "flex", gap: "6px", flexWrap: "wrap", margin: "0 0 7px" });
        const fill = (sel) => {
          inp.value = sel;
          inp.dispatchEvent(new Event("input"));
        };
        quick.append(
          mini("Alleen dit (" + nMatch(specificSel) + ")", () => fill(specificSel)),
          mini("Alle vergelijkbare (" + nMatch(broadSel) + ")", () => fill(broadSel))
        );
        pk.appendChild(quick);
        const fb = css(document.createElement("div"), { fontSize: "11px", minHeight: "16px", margin: "0 0 7px" });
        pk.appendChild(fb);
        const save = mini("Opslaan & toepassen", () => {
          const v = inp.value.trim();
          if (!v) return;
          if (!window.confirm("Weet je het zeker? Dit is niet terug te draaien. Maak daarom altijd een kopie van de vorige selectors.")) return;
          saveOverride(h[3], v);
          pendingPick = null;
          drawHighlights();
          renderPanel();
          setStatus2("✓ Hersteld en direct toegepast: " + h[1]);
        }, true);
        const cancel = mini("Annuleer", () => {
          pendingPick = null;
          renderPanel();
        });
        const btns = css(document.createElement("div"), { display: "flex", gap: "6px" });
        btns.append(save, cancel);
        pk.appendChild(btns);
        const isRel = h[4] === "rel";
        const refresh = () => {
          const info = selectorInfo(inp.value.trim(), pendingPick && pendingPick.el);
          let msg = "", col = "#666", ok = true;
          if (info.empty) {
            msg = "Voer een selector in.";
            col = C.miss;
            ok = false;
          } else if (info.invalid) {
            msg = "⚠ Ongeldige selector.";
            col = C.miss;
            ok = false;
          } else if (isRel) {
            msg = info.count === 0 ? "⚠ Matcht niets op dit scherm." : "✓ Wordt toegepast op alle vergelijkbare elementen (" + info.count + " gevonden).";
            col = info.count === 0 ? "#d98a0b" : C.ok;
          } else if (info.count === 0) {
            msg = "⚠ Matcht niets op dit scherm.";
            col = "#d98a0b";
          } else if (info.count === 1) {
            msg = "✓ Matcht precies 1 element.";
            col = C.ok;
          } else {
            msg = "⚠ Matcht " + info.count + " elementen — mogelijk niet uniek.";
            col = "#d98a0b";
          }
          if (!info.empty && !info.invalid && !isRel) {
            if (info.brittle) msg += " · broze positie-selector (kan breken bij ONS-updates).";
            if (info.shadow && / > /.test(inp.value)) msg += " · shadow-DOM: een descendant-pad piercet de shadow-grens mogelijk niet.";
          }
          fb.textContent = msg;
          fb.style.color = col;
          save.disabled = !ok;
          save.style.opacity = ok ? "1" : ".5";
          save.style.cursor = ok ? "pointer" : "not-allowed";
        };
        inp.oninput = refresh;
        refresh();
        body.appendChild(pk);
      }
      const bar = css(document.createElement("div"), { display: "flex", gap: "6px", margin: "0 0 8px", flexWrap: "wrap" });
      bar.append(
        mini(highlightsOn ? "Highlights uit" : "Highlights aan", () => {
          highlightsOn = !highlightsOn;
          drawHighlights();
          renderPanel();
        }),
        mini(onlyMissing ? "Toon alle" : "Alleen ontbrekend", () => {
          onlyMissing = !onlyMissing;
          renderPanel();
        }),
        mini("Herscan", () => {
          drawHighlights();
          renderPanel();
        }),
        mini("Exporteer selectors", exportOverrides)
      );
      body.appendChild(bar);
      const ovKeys = Object.keys(overrides || {}).filter((k) => overrides[k]);
      if (ovKeys.length) {
        const box = css(document.createElement("div"), { border: "1px solid #e7c9dd", background: "#faf3f8", borderRadius: "8px", padding: "8px 9px", margin: "0 0 10px" });
        const bh = css(document.createElement("div"), { display: "flex", alignItems: "center", gap: "6px", margin: "0 0 6px" });
        const bt = document.createElement("div");
        bt.innerHTML = "<b>Actieve herstellingen (" + ovKeys.length + ")</b>";
        bt.style.flex = "1";
        bt.style.fontSize = "12px";
        bh.append(bt, mini("Alles wissen", () => {
          ovKeys.forEach((k) => clearOverride(k));
          drawHighlights();
          renderPanel();
        }));
        box.appendChild(bh);
        ovKeys.forEach((k) => {
          const hook = HOOKS.find((h) => h[3] === k);
          const name = hook ? hook[1] : k;
          const r = css(document.createElement("div"), { display: "flex", alignItems: "center", gap: "6px", padding: "3px 0" });
          const lab = document.createElement("span");
          lab.style.flex = "1";
          lab.style.fontSize = "11px";
          const broken = !!(hook && selectorInfo(overrides[k], null).count === 0 && defaultEls(hook).length > 0);
          const flag = broken ? ' <span style="color:#d98a0b;font-weight:700">⚠ werkt niet meer</span>' : "";
          const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
          lab.innerHTML = "<b>" + esc(name) + "</b>" + flag + '<br><span style="color:#8a5a76;word-break:break-all">' + esc(overrides[k]) + "</span>";
          r.append(lab, mini("Verwijder", () => {
            clearOverride(k);
            drawHighlights();
            renderPanel();
          }));
          box.appendChild(r);
        });
        body.appendChild(box);
      }
      let grp = "";
      HOOKS.forEach((h) => {
        if (h[0] !== grp) {
          grp = h[0];
          const g = css(document.createElement("div"), { fontWeight: "800", fontSize: "10px", color: "#888", margin: "10px 0 2px" });
          g.textContent = grp;
          body.appendChild(g);
        }
        const o = overrideSel(h);
        const row = css(document.createElement("div"), { display: "flex", alignItems: "center", gap: "7px", padding: "5px 4px", borderBottom: "1px solid #f2f2f2", borderRadius: "6px" });
        const dot = css(document.createElement("span"), { minWidth: "26px", textAlign: "center", fontWeight: "800" });
        const lbl = document.createElement("span");
        lbl.style.flex = "1";
        lbl.textContent = h[1] + (o ? " •" : "");
        lbl.title = o || (typeof h[2] === "function" ? "(heuristisch)" : h[2]);
        row.append(dot, lbl);
        if (h[3]) {
          row.append(mini(o ? "Opnieuw" : "Herstel", () => enterPick(h), true));
          if (o) row.append(mini("Reset", () => {
            clearOverride(h[3]);
            drawHighlights();
            renderPanel();
          }));
        }
        row.onmouseenter = () => {
          if (row.dataset.on === "1") row.style.background = "#f7eef4";
        };
        row.onmouseleave = () => {
          row.style.background = "";
        };
        row.onclick = () => {
          if (row.dataset.on === "1") flash(h);
        };
        body.appendChild(row);
        const update = () => {
          const na = h[0] === "Agenda" && modalIsOpen();
          if (na) {
            row.dataset.on = "0";
            row.style.cursor = "default";
            row.style.display = onlyMissing ? "none" : "flex";
            row.style.opacity = ".45";
            dot.textContent = "–";
            dot.style.color = "#999";
            return true;
          }
          row.style.opacity = "";
          const n = visEls(h).length;
          const on = n > 0;
          row.dataset.on = on ? "1" : "0";
          row.style.cursor = on ? "pointer" : "default";
          row.style.display = onlyMissing && on ? "none" : "flex";
          if (overrideSel(h) && !on && defaultEls(h).length > 0) {
            dot.textContent = "⚠";
            dot.style.color = "#d98a0b";
            row.style.display = "flex";
            lbl.title = "Herstelling werkt niet meer (standaard vindt hier wél iets): " + overrideSel(h);
          } else {
            dot.textContent = on ? "✓" + n : "✗";
            dot.style.color = on ? C.ok : C.miss;
          }
          return on;
        };
        update();
        rowUpdaters.push(update);
      });
      const note = css(document.createElement("div"), { fontSize: "10px", color: "#999", marginTop: "10px" });
      note.textContent = "★ = het element dat de extensie gebruikt (bij meerdere treffers). ⚠ = herstelling wijst niets meer aan. Herstellingen worden direct toegepast (geen herladen nodig). Herstelbaar zijn de meeste velden (modal, uursoort, labels, datum, begin-/eindtijd, reistijd, titel, opslaan en de registratie-tijden). Structurele/heuristische hooks (cliëntlijst, cliëntnaam, toevoegen-knop, agenda-elementen) zijn alleen diagnose.";
      body.appendChild(note);
      panel.appendChild(body);
    }
    const HASH_RE = /ons-?ui-?inspector/i;
    function hashWantsInspector() {
      try {
        return HASH_RE.test(location.hash || "") || /[?&]onsInspector=1/i.test(location.search || "");
      } catch (e) {
        return false;
      }
    }
    function openFromHashIfWanted() {
      if (!hashWantsInspector()) return;
      if (!(root && panel)) openPanel();
      try {
        const clean2 = location.href.replace(/#.*$/, "").replace(/([?&])onsInspector=1/i, "$1").replace(/[?&]$/, "");
        history.replaceState(null, "", clean2);
      } catch (e) {
      }
    }
    try {
      window.addEventListener("hashchange", openFromHashIfWanted);
      let tries = 0;
      const iv = setInterval(() => {
        tries++;
        openFromHashIfWanted();
        if (root && panel || tries > 20) clearInterval(iv);
      }, 500);
      openFromHashIfWanted();
    } catch (e) {
    }
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([PERSIST_KEY], (r) => {
          if (r && r[PERSIST_KEY] && !(root && panel)) openPanel();
        });
      }
    } catch (e) {
    }
    try {
      if (chrome && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area2) => {
          if (area2 !== "local") return;
          if (changes[OVERRIDE_KEY]) {
            overrides = changes[OVERRIDE_KEY].newValue || {};
            if (root) {
              drawHighlights();
              renderPanel();
            }
          }
          if (changes[OPEN_KEY]) toggle();
        });
      }
    } catch (e) {
    }
    window.__onsUiInspector = { open: openPanel, close: closePanel, toggle };
    try {
      if (window.__ONS_EXPOSE_FOR_TEST) {
        window.__onsInspectorTestApi = {
          buildSelector,
          buildClassSelector,
          resolveMeaningfulTarget,
          isIconLeaf,
          selectorInfo
        };
      }
    } catch (e) {
    }
  }

  // src/content/test-hooks.js
  function exposeTestApi() {
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
      __setTijdvakken: function(laag, ymd2, rows) {
        try {
          _tijdvakCache[laag + "|" + resolveInviteeId() + "|" + ymd2] = { ts: Date.now(), rows: rows || [] };
        } catch (e) {
        }
      },
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
      __getCurrentScreen: function() {
        try {
          return currentScreen ? { name: currentScreen.name, args: currentScreen.args } : null;
        } catch (e) {
          return null;
        }
      },
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
      __setPendingRegistration: function(o) {
        try {
          if (o == null) sessionStorage.removeItem(PENDING_REG_KEY);
          else sessionStorage.setItem(PENDING_REG_KEY, JSON.stringify(o));
        } catch (e) {
        }
      },
      __setCurrentRegistrationId: setRegistrationIdOverride,
      clearPendingRegistration,
      getRegistrationRestoreState: function() {
        try {
          return { fromAppointment: registrationFlow.registrationFromAppointment, autoApplied: registrationFlow.registrationAutoApplied, restoredToReport: registrationFlow.registrationRestoredToReport, activeChoiceLabel: registrationFlow.activeRegistrationChoice && registrationFlow.activeRegistrationChoice.label || null, autoChoiceLabel: registrationFlow.registrationAutoChoice && registrationFlow.registrationAutoChoice.label || null, pending: function() {
            try {
              return sessionStorage.getItem(PENDING_REG_KEY);
            } catch (e) {
              return null;
            }
          }() };
        } catch (e) {
          return null;
        }
      },
      persistRegistrationTimes,
      restoreRegistrationExtras,
      registrationRestoreHolding,
      registrationPageSettled,
      __setRegistrationHoldStart: function(t) {
        try {
          registrationFlow.registrationRestoreHoldStart = t;
        } catch (e) {
        }
      },
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
      getUiOverride: function(k) {
        try {
          return UI_OVERRIDES[k];
        } catch (e) {
          return void 0;
        }
      },
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
      getUursoortQueueState: function() {
        try {
          return { active: appointmentFlow.uursoortQueueActive, gen: appointmentFlow.uursoortQueueGen, flowBusy: appointmentFlow.appointmentFlowBusy };
        } catch (e) {
          return null;
        }
      },
      __setUursoortQueueActive: function(v) {
        try {
          appointmentFlow.uursoortQueueActive = !!v;
        } catch (e) {
        }
      },
      __setActiveNonClientOption: function(o) {
        try {
          appointmentFlow.activeNonClientOption = o || null;
        } catch (e) {
        }
      },
      appointmentEndGuardState: function() {
        try {
          return { helperEndText: appointmentFlow.helperEndText, userOwned: appointmentFlow.appointmentEndTimeUserOwned };
        } catch (e) {
          return null;
        }
      },
      resetAppointmentEndGuard: function() {
        try {
          appointmentFlow.helperEndText = "";
          appointmentFlow.appointmentEndTimeUserOwned = false;
        } catch (e) {
        }
      },
      getAppConfig: function() {
        try {
          return APP_CONFIG;
        } catch (e) {
          return null;
        }
      },
      getDefaultConfig: function() {
        try {
          return DEFAULT_APP_CONFIG;
        } catch (e) {
          return null;
        }
      },
      getRegistrationChoices: function() {
        try {
          return REGISTRATION_CHOICES;
        } catch (e) {
          return null;
        }
      },
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
      onsDateText,
      findFreeGaps,
      reservationBlocks,
      reservationsOverlapping,
      findFreeSlots,
      mergeOpenRangePerPersoon,
      cachedOpenRange,
      isCached,
      _clearPreloadCache,
      currentInviteeIds,
      jumpToDayVoorTest: jumpToDay,
      productionWeekRow,
      plannedProductionRow,
      plannedRatioRows,
      createLimiter,
      __setOnsOverlap: _setOnsOverlapForTest,
      __setDoorplannen: function(v) {
        try {
          appointmentFlow.appointmentDoorplannen = !!v;
        } catch (e) {
        }
      }
    });
  }

  // src/content/index.js
  connectConfigHooks({
    formsChanged: pushRegistrationForms,
    selectorsChanged: seedUiOverridesFromConfig,
    rolloutChanged: setRollout,
    configApplied: syncWithUrl,
    teamChanged: deactivate
  });
  startModuleHost();
  listenForMainWorldDetails();
  listenForOnsOverlapCalls();
  listenForCreatedEvents();
  listenForEventMeta();
  watchConfigChanges();
  var HELPER_CONFIG_READY = startConfigLoading();
  seedUiOverridesFromConfig();
  watchLocalUiOverrides();
  installFreeDayTracking();
  installPanelDragListeners();
  installUrlWatch();
  HELPER_CONFIG_READY.then(syncWithUrl);
  HELPER_CONFIG_READY.then(function() {
    safe(pushRegistrationForms);
  });
  installContextMenuTracking();
  listenForContextMenuChoice();
  installDeclareClickCapture();
  startDayColoring();
  registerQualityModule();
  exposeTestApi();
  startUiInspector();
})();
//# sourceMappingURL=content.js.map
