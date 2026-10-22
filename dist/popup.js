(() => {
  // src/shared/storage-keys.js
  var SYNC = {
    SECTOR: "sector",
    // gekozen bedrijfsonderdeel (popup)
    COLOR_PROFILE: "colorProfile",
    // gekozen team / dagindeling (popup)
    WORK_HOURS: "workHours"
    // eigen werktijden per weekdag (popup; zie shared/work-hours.js)
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
    REMINDER_HANDLED: "onsHelper.reminderHandled",
    // tijdstip (ms) van de laatst afgehandelde herinnering
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
  function icon(pathD) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", pathD);
    svg.appendChild(path);
    return svg;
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
  function uitleg(st, meldingenMogen) {
    if (!st.enabled) return "Uit. Je krijgt geen meldingen.";
    if (!meldingenMogen) return "Aan, maar de browser mag nog geen meldingen tonen. Zet de herinnering uit en weer aan om dat toe te staan.";
    return "Elke " + (DAGEN[(st.weekday || 5) - 1] || "vrijdag") + " om " + String(st.hour).padStart(2, "0") + ":" + String(st.minute).padStart(2, "0") + " een melding als er nog tijd openstaat.";
  }
  var MELDINGEN = { permissions: ["notifications"] };
  function meldingenToegestaan() {
    return new Promise(function(resolve) {
      chrome.permissions.contains(MELDINGEN, resolve);
    });
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
    const zet = function(aan) {
      stuur({ type: MSG.REMINDER_SETTINGS, enabled: aan }).then(function(res) {
        if (res && res.settings) toelichting.textContent = uitleg(res.settings, aan);
        setStatus2(aan ? "Herinnering aan." : "Herinnering uit.");
      });
    };
    Promise.all([stuur({ type: MSG.REMINDER_GET }), meldingenToegestaan()]).then(function(r) {
      const s = r[0] && r[0].settings || {};
      vink.checked = !!s.enabled;
      toelichting.textContent = uitleg(s, r[1]);
      vink.addEventListener("change", function() {
        if (!vink.checked) {
          zet(false);
          chrome.permissions.remove(MELDINGEN);
          return;
        }
        chrome.permissions.request(MELDINGEN, function(mag) {
          if (mag) {
            zet(true);
            return;
          }
          vink.checked = false;
          setStatus2("Zonder toestemming voor meldingen kan de herinnering niet aan.");
        });
      });
    });
    return wrap;
  }

  // src/shared/work-hours.js
  var WORKDAYS = [1, 2, 3, 4, 5];
  var DAY_NAMES = { 1: "ma", 2: "di", 3: "wo", 4: "do", 5: "vr" };
  function hmToMinutes(hm) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hm || ""));
    return m ? +m[1] * 60 + +m[2] : null;
  }
  function minutesToHm(minutes) {
    return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
  }
  function normalizeWorkHours(raw) {
    if (!raw || typeof raw !== "object") return null;
    const hours = {};
    let any = false;
    for (const day of WORKDAYS) {
      const start = raw[day] ? hmToMinutes(raw[day].start) : null;
      const end = raw[day] ? hmToMinutes(raw[day].end) : null;
      hours[day] = start != null && end != null && end > start ? { start, end } : null;
      if (hours[day]) any = true;
    }
    return any ? hours : null;
  }
  function describeWorkHours(hours) {
    if (!hours) return "";
    const groups = [];
    for (const day of WORKDAYS) {
      const w = hours[day];
      if (!w) continue;
      const last = groups[groups.length - 1];
      if (last && last.to === day - 1 && last.start === w.start && last.end === w.end) last.to = day;
      else groups.push({ from: day, to: day, start: w.start, end: w.end });
    }
    return groups.map((g) => {
      const days = g.from === g.to ? DAY_NAMES[g.from] : g.to === g.from + 1 ? DAY_NAMES[g.from] + " en " + DAY_NAMES[g.to] : DAY_NAMES[g.from] + " t/m " + DAY_NAMES[g.to];
      return days + " " + minutesToHm(g.start) + " tot " + minutesToHm(g.end);
    }).join(", ");
  }

  // src/shared/time-field.js
  function normalizeTime(text) {
    const s = String(text == null ? "" : text).trim().replace(/[.,]/g, ":");
    const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(s) || /^(\d{1,2})(\d{2})$/.exec(s);
    if (!m) return null;
    const hours = +m[1], minutes = m[2] == null ? 0 : +m[2];
    if (hours > 23 || minutes > 59) return null;
    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
  }
  function createTimeField(value, label) {
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.maxLength = 5;
    input.placeholder = "uu:mm";
    input.value = value || "";
    input.setAttribute("aria-label", label);
    input.addEventListener("blur", () => {
      const time = normalizeTime(input.value);
      if (time) input.value = time;
      input.setAttribute("aria-invalid", time || !input.value ? "false" : "true");
    });
    return input;
  }

  // src/popup/work-hours.js
  var ICON_EDIT = "M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.33-2.33a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.82-1.84z";
  var ICON_SAVE = "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z";
  var ICON_CANCEL = "M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z";
  var ICON_CLEAR = "M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z";
  function button(cls, pathD, text, onClick) {
    const b = el("button", { type: "button", class: cls });
    b.appendChild(icon(pathD));
    b.appendChild(document.createTextNode(text));
    b.addEventListener("click", onClick);
    return b;
  }
  function teamWindow(profile) {
    const zones = (popupConfig.zoneProfiles || {})[profile];
    const starts = (Array.isArray(zones) ? zones : []).map((z) => hmToMinutes(z.start)).filter((m) => m != null);
    const ends = (Array.isArray(zones) ? zones : []).map((z) => hmToMinutes(z.end)).filter((m) => m != null);
    return starts.length && ends.length ? { start: Math.min(...starts), end: Math.max(...ends) } : { start: 8 * 60, end: 17 * 60 };
  }
  function workHoursSection(colorProfile, setStatus2) {
    const wrap = el("div", { class: "section", "data-werktijden": "" });
    let hours = null;
    function render(editing) {
      wrap.textContent = "";
      const head = el("div", { class: "section-head" });
      head.appendChild(el("h2", null, "Werktijden"));
      if (!editing) head.appendChild(button("small", ICON_EDIT, hours ? "Aanpassen" : "Instellen", () => render(true)));
      wrap.appendChild(head);
      if (!editing) {
        wrap.appendChild(el(
          "div",
          { class: "hint", "data-werktijden-samenvatting": "" },
          hours ? describeWorkHours(hours) : "Niet ingesteld: de dagindeling van je team geldt."
        ));
        return;
      }
      const team = teamWindow(colorProfile);
      const rows = WORKDAYS.map((day) => {
        const w = hours ? hours[day] : team;
        const row = el("div", { class: "day-row", "data-dag": String(day) });
        const label = el("label", { class: "day-check" });
        const works = el("input", { type: "checkbox" });
        works.checked = !!w;
        label.appendChild(works);
        label.appendChild(document.createTextNode(DAY_NAMES[day]));
        const start = createTimeField(minutesToHm((w || team).start), "Begin " + DAY_NAMES[day]);
        const end = createTimeField(minutesToHm((w || team).end), "Einde " + DAY_NAMES[day]);
        start.className = end.className = "time-field";
        const sync = () => {
          start.disabled = end.disabled = !works.checked;
        };
        works.addEventListener("change", sync);
        sync();
        row.appendChild(label);
        row.appendChild(start);
        row.appendChild(el("span", { class: "hint" }, "tot"));
        row.appendChild(end);
        wrap.appendChild(row);
        return { day, works, start, end };
      });
      const actions = el("div", { class: "section-actions" });
      actions.appendChild(button("primary", ICON_SAVE, "Opslaan", () => {
        const raw = {};
        for (const r of rows) {
          if (!r.works.checked) continue;
          const start = normalizeTime(r.start.value), end = normalizeTime(r.end.value);
          if (!start || !end) {
            setStatus2("Vul op " + DAY_NAMES[r.day] + " een tijd in als 09:00.");
            return;
          }
          if (!(hmToMinutes(end) > hmToMinutes(start))) {
            setStatus2("Op " + DAY_NAMES[r.day] + " moet het begin voor het einde liggen.");
            return;
          }
          raw[r.day] = { start, end };
        }
        if (!Object.keys(raw).length) {
          setStatus2("Vink minstens één werkdag aan, of wis je werktijden.");
          return;
        }
        syncArea().set({ [SYNC.WORK_HOURS]: raw }, () => {
          hours = normalizeWorkHours(raw);
          setStatus2("Werktijden opgeslagen. Open of ververs de agenda.");
          render(false);
        });
      }));
      actions.appendChild(button("small", ICON_CANCEL, "Annuleren", () => {
        setStatus2("");
        render(false);
      }));
      if (hours) {
        actions.appendChild(button("danger", ICON_CLEAR, "Wissen", () => {
          if (!window.confirm("Weet je het zeker?")) return;
          syncArea().remove(SYNC.WORK_HOURS, () => {
            hours = null;
            setStatus2("Werktijden gewist: de dagindeling van je team geldt.");
            render(false);
          });
        }));
      }
      wrap.appendChild(actions);
    }
    syncArea().get([SYNC.WORK_HOURS], (res) => {
      hours = normalizeWorkHours(res && res[SYNC.WORK_HOURS]);
      render(false);
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
    view.appendChild(el("h2", null, sector + ": kies je agenda-indeling"));
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
    view.appendChild(workHoursSection(state.colorProfile, setStatus));
    view.appendChild(reminderToggle(setStatus));
    const wrap = el("div", { class: "support-link" });
    wrap.style.cssText = "margin-top:14px;padding-top:12px;border-top:1px solid #e5e5e5";
    const a = el("a", { href: supportUrl(), target: "_blank", rel: "noopener noreferrer" }, "Probleem melden via TOPdesk");
    a.style.cssText = "color:#cc087d;text-decoration:underline;font-size:13px";
    wrap.appendChild(a);
    view.appendChild(wrap);
  }
  document.getElementById("copyright").textContent = "© impegno " + (/* @__PURE__ */ new Date()).getFullYear();
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
