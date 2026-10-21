(() => {
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
    SNAPSHOT: "onsHelper.snapshot",
    // laatste weekstand (service worker; alleen getallen)
    REMINDER_SETTINGS: "onsHelper.reminders",
    // instellingen wekelijkse herinnering
    FORMS: "onsHelper.forms"
    // registratievormen voor het rechtermuismenu
  };

  // src/shared/chrome-storage.js
  function readStorage(area, keys) {
    return new Promise(function(resolve) {
      try {
        if (!area || typeof area.get !== "function") {
          resolve({});
          return;
        }
        area.get(keys, function(v) {
          try {
            if (chrome.runtime && chrome.runtime.lastError) {
              resolve({});
              return;
            }
          } catch (e) {
          }
          resolve(v || {});
        });
      } catch (e) {
        resolve({});
      }
    });
  }
  function syncArea() {
    return chrome.storage && chrome.storage.sync || chrome.storage && chrome.storage.local;
  }

  // src/popup/config.js
  var DEFAULT_TOPDESK_URL = "https://impegno.topdesk.net/";
  var popupConfig = {
    zoneProfiles: { "JGGZ": [], "J&O/JBG": [], "Begeleiding": [] },
    profileSectors: { "JGGZ": "Jeugd & Gezin", "J&O/JBG": "Jeugd & Gezin", "Begeleiding": "Begeleiding" },
    topdeskUrl: DEFAULT_TOPDESK_URL
  };
  function applyPopupConfig(value) {
    const cfg = value && value.helperConfig ? value.helperConfig : value;
    if (!cfg || typeof cfg !== "object") return;
    if (cfg.zoneProfiles && typeof cfg.zoneProfiles === "object") popupConfig.zoneProfiles = cfg.zoneProfiles;
    if (cfg.profileSectors && typeof cfg.profileSectors === "object") popupConfig.profileSectors = cfg.profileSectors;
    if (cfg.support && typeof cfg.support === "object" && typeof cfg.support.topdeskUrl === "string" && cfg.support.topdeskUrl) popupConfig.topdeskUrl = cfg.support.topdeskUrl;
  }
  async function loadPopupConfig() {
    try {
      const response = await fetch(chrome.runtime.getURL("config.json"));
      const cfg = response.ok ? await response.json() : null;
      if (cfg) applyPopupConfig(cfg);
    } catch (e) {
    }
    const local = await readStorage(chrome.storage.local, [LOCAL.TEST_CONFIG]);
    if (local[LOCAL.TEST_CONFIG]) applyPopupConfig(local[LOCAL.TEST_CONFIG]);
    const managed = await readStorage(chrome.storage.managed, null);
    if (managed && Object.keys(managed).length) applyPopupConfig(managed);
  }
  function configuredSectors() {
    const sectors = [];
    Object.keys(popupConfig.zoneProfiles || {}).forEach(function(profile) {
      const sector = String((popupConfig.profileSectors || {})[profile] || "Overige").trim() || "Overige";
      if (sectors.indexOf(sector) < 0) sectors.push(sector);
    });
    return sectors;
  }
  function profilesForSector(sector) {
    return Object.keys(popupConfig.zoneProfiles || {}).filter(function(profile) {
      return String((popupConfig.profileSectors || {})[profile] || "Overige") === sector;
    });
  }
  function supportUrl() {
    const u = popupConfig.topdeskUrl;
    return typeof u === "string" && /^https?:\/\//i.test(u) ? u : DEFAULT_TOPDESK_URL;
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
    AGENDA_REGISTER_ITEM: "ag-register-item",
    // { id, date } -> { ok, error? }  open registraties: afspraak openen en Registreren klikken
    AGENDA_OPEN_LEAVE: "ag-open-leave",
    //                 verlofdialoog openen in de pagina
    AGENDA_CHECK_RANGE: "ag-check-range",
    // { from, to } -> { ok, result | error }  open registraties in een periode
    AGENDA_QUICK_REGISTER: "ag-quick-register",
    // { date, time, minutes, force } -> { ok, overlap?, error? }
    AGENDA_NEW_EVENT: "ag-new-event",
    // { date, time, minutes, extra?: [{ date, time }] } -> { ok, error? }  afspraakformulier openen (extra: kopieën na opslaan)
    AGENDA_FORM_TITLE: "ag-form-title",
    // content -> zijpaneel: { date, time } -> { title }  titel uit Afspraak maken voor het ONS-formulier dat net openging (alleen in het geheugen van het zijpaneel)
    AGENDA_DUPLICATES_DONE: "ag-duplicates-done",
    // content -> zijpaneel: { made, failed, reason }  kopieën van een afspraak
    AGENDA_DAY_ROUTE: "ag-day-route",
    // { date, origin } -> { ok, result: { persons: [{ stops, missing, urls }] } | error }  route van de dag
    AGENDA_SLOT_CHECK: "ag-slot-check",
    // { date, startMin, minutes } -> { ok, status, overlap }  ONS' overlapcontrole
    AGENDA_EVENT_OPTIONS: "ag-event-options",
    // { clientIds } -> { ok, labels: [{ id, name }], hourTypes: { clientId: [{ id, name, recent }] }, metaKnown }
    AGENDA_CREATE_EVENTS: "ag-create-events",
    // { events: [{ date, startMin, minutes, clients: [{ id, hourTypeId }], labelId, name, travelBefore, travelAfter }] } -> { ok, results: [{ ok, error? }] }
    AGENDA_RELOAD: "ag-reload",
    //                 agenda verversen (na afspraken maken)
    AGENDA_CLIENT_SEARCH: "ag-client-search",
    // { term, outOfCare } -> { ok, clients: [{ id, name, pc, number, birth }] }  planhulp: meerdere afspraken
    AGENDA_FREE_SLOTS: "ag-free-slots",
    // { minutes, weeks, to?, from?, days? ([1..5]: alleen die weekdagen), limit? (aantal blokken) } -> { ok, result: { gaps, ... } | error }  planhulp (to: zoek tot en met die datum; from: vanaf die datum, weekraster)
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

  // src/popup/dom.js
  function el(tag, props, text) {
    const n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function(k) {
      n.setAttribute(k, props[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }

  // src/popup/reminder-toggle.js
  var DAGEN = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
  function stuur(msg) {
    return new Promise(function(resolve) {
      try {
        chrome.runtime.sendMessage(msg, function(r) {
          resolve(r || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }
  function uitleg(st) {
    return st.enabled ? "Elke " + (DAGEN[(st.weekday || 5) - 1] || "vrijdag") + " om " + String(st.hour).padStart(2, "0") + ":" + String(st.minute).padStart(2, "0") + " een melding als er nog tijd openstaat." : "Uit. Je krijgt geen meldingen.";
  }
  function reminderToggle(setStatus2) {
    const wrap = el("div");
    wrap.style.cssText = "margin-top:14px;padding-top:12px;border-top:1px solid #e5e5e5";
    const rij = el("div");
    rij.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px";
    const vink = el("input", { type: "checkbox", id: "herinner" });
    const tekst = el("label", { for: "herinner" }, "Wekelijkse herinnering");
    tekst.style.cssText = "cursor:pointer";
    rij.appendChild(vink);
    rij.appendChild(tekst);
    wrap.appendChild(rij);
    const toelichting = el("div");
    toelichting.style.cssText = "font-size:11px;color:#666;margin-top:4px";
    wrap.appendChild(toelichting);
    stuur({ type: MSG.REMINDER_GET }).then(function(r) {
      const s = r && r.settings || {};
      vink.checked = !!s.enabled;
      toelichting.textContent = uitleg(s);
      vink.addEventListener("change", function() {
        stuur({ type: MSG.REMINDER_SETTINGS, enabled: vink.checked }).then(function(res) {
          if (res && res.settings) toelichting.textContent = uitleg(res.settings);
          setStatus2(vink.checked ? "Herinnering aan." : "Herinnering uit.");
        });
      });
    });
    return wrap;
  }

  // src/popup/index.js
  var view = document.getElementById("view");
  var statusEl = document.getElementById("status");
  var state = { sector: null, colorProfile: null };
  function setStatus(t) {
    statusEl.textContent = t || "";
  }
  function save(partial, cb) {
    Object.assign(state, partial);
    try {
      syncArea().set(partial, function() {
        if (cb) cb();
      });
    } catch (e) {
      if (cb) cb();
    }
  }
  function choiceButton(label, opts) {
    opts = opts || {};
    const b = el("button", { class: "choice" + (opts.selected ? " selected" : "") + (opts.disabled ? " disabled" : "") }, label);
    if (!opts.disabled && opts.onClick) b.addEventListener("click", opts.onClick);
    return b;
  }
  function saveProfile(sector, profile, rerender) {
    save({ [SYNC.SECTOR]: sector, [SYNC.COLOR_PROFILE]: profile }, function() {
      setStatus("Indeling opgeslagen: " + profile + ". Open of ververs de agenda.");
      rerender();
    });
  }
  function renderSectorChoice() {
    view.innerHTML = "";
    view.appendChild(el("h2", null, "Waar werk je?"));
    configuredSectors().forEach(function(sector) {
      const profiles = profilesForSector(sector);
      view.appendChild(choiceButton(sector, {
        selected: state.sector === sector,
        disabled: !profiles.length,
        onClick: function() {
          if (profiles.length === 1) saveProfile(sector, profiles[0], renderSectorChoice);
          else save({ [SYNC.SECTOR]: sector }, renderProfileChoice);
        }
      }));
    });
    appendFooter();
  }
  function renderProfileChoice() {
    view.innerHTML = "";
    const back = el("button", { class: "back" }, "← Terug");
    back.addEventListener("click", renderSectorChoice);
    view.appendChild(back);
    const sector = state.sector;
    const profiles = profilesForSector(sector);
    if (!profiles.length) {
      renderSectorChoice();
      return;
    }
    view.appendChild(el("h2", null, sector + " — kies je agenda-indeling:"));
    profiles.forEach(function(key) {
      view.appendChild(choiceButton(key, {
        selected: state.colorProfile === key,
        onClick: function() {
          saveProfile(sector, key, renderProfileChoice);
        }
      }));
    });
    appendFooter();
  }
  function appendFooter() {
    view.appendChild(reminderToggle(setStatus));
    const wrap = el("div", { class: "support-link" });
    wrap.style.cssText = "margin-top:14px;padding-top:12px;border-top:1px solid #e5e5e5";
    const a = el("a", { href: supportUrl(), target: "_blank", rel: "noopener noreferrer" }, "Probleem melden via TOPdesk");
    a.style.cssText = "color:#cc087d;text-decoration:underline;font-size:13px";
    wrap.appendChild(a);
    view.appendChild(wrap);
  }
  function init() {
    loadPopupConfig().catch(function() {
    }).then(function() {
      try {
        syncArea().get([SYNC.SECTOR, SYNC.COLOR_PROFILE], function(res) {
          state.sector = res && res[SYNC.SECTOR] || null;
          state.colorProfile = res && res[SYNC.COLOR_PROFILE] || null;
          const knownSector = configuredSectors().find(function(sector) {
            return String(sector).toLowerCase() === String(state.sector || "").toLowerCase();
          });
          if (knownSector) state.sector = knownSector;
          if (state.sector && profilesForSector(state.sector).length > 1) renderProfileChoice();
          else renderSectorChoice();
        });
      } catch (e) {
        renderSectorChoice();
      }
    });
  }
  init();
})();
