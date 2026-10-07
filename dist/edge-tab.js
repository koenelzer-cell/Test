(() => {
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
    // { date, time, minutes } -> { ok, error? }  afspraakformulier openen
    AGENDA_FREE_SLOTS: "ag-free-slots",
    // { minutes, weeks } -> { ok, result: { gaps, ... } | error }  planhulp
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

  // src/edge-tab/index.js
  (function() {
    if (window.__onsEdgeTab) return;
    window.__onsEdgeTab = true;
    if (window.top !== window) return;
    var ROZE = "#cc087d";
    var ROZE_DIEP = "#8c0a58";
    var STIJL_ID = "onsah-edge-tab-stijl";
    var NUDGE_KEY = "onsHelper.edgeTabNudged";
    var tab = null, chev = null, labelEl = null, tipEl = null;
    var open = false;
    function zorgVoorStijl() {
      if (document.getElementById(STIJL_ID)) return;
      var st = document.createElement("style");
      st.id = STIJL_ID;
      st.textContent = "@keyframes onsahEdgeIn{from{transform:translate(100%,-50%)}to{transform:translate(0,-50%)}}@keyframes onsahEdgeNudge{0%,100%{transform:translate(0,-50%)}25%,65%{transform:translate(-7px,-50%)}45%,85%{transform:translate(0,-50%)}}@keyframes onsahEdgeTik{0%,100%{transform:translateX(0)}50%{transform:translateX(-3px)}}@keyframes onsahEdgeRust{0%,78%,100%{transform:translateX(0)}82%,90%{transform:translateX(-3px)}86%,94%{transform:translateX(0)}}#onsah-edge-tab svg{animation:onsahEdgeRust 5s ease-in-out infinite}#onsah-edge-tab.onsah-in{animation:onsahEdgeIn .35s cubic-bezier(.2,.8,.2,1)}#onsah-edge-tab.onsah-nudge{animation:onsahEdgeNudge 1.4s ease-in-out}#onsah-edge-tab:hover svg,#onsah-edge-tab:focus-visible svg{animation:onsahEdgeTik .9s ease-in-out infinite}@media (prefers-reduced-motion: reduce){#onsah-edge-tab,#onsah-edge-tab svg{animation:none!important}}";
      (document.head || document.documentElement).appendChild(st);
    }
    function speel(klasse) {
      if (!tab) return;
      tab.classList.remove("onsah-in", "onsah-nudge");
      void tab.offsetWidth;
      tab.classList.add(klasse);
    }
    function misschienWiebelen() {
      try {
        if (sessionStorage.getItem(NUDGE_KEY)) return;
        sessionStorage.setItem(NUDGE_KEY, "1");
      } catch (e) {
        return;
      }
      setTimeout(function() {
        if (tab && !open) speel("onsah-nudge");
      }, 1200);
    }
    function svgChevron() {
      var ns = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "15");
      svg.setAttribute("height", "15");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2.4");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      var p = document.createElementNS(ns, "path");
      p.setAttribute("d", "M15 5 8 12l7 7");
      svg.appendChild(p);
      return svg;
    }
    function bouw() {
      if (tab) return tab;
      zorgVoorStijl();
      tab = document.createElement("div");
      tab.id = "onsah-edge-tab";
      tab.setAttribute("role", "button");
      tab.setAttribute("tabindex", "0");
      tab.setAttribute("aria-label", "Zijpaneel openen");
      tab.title = "Zijpaneel openen";
      Object.assign(tab.style, {
        position: "fixed",
        right: "0",
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: "2147483645",
        display: "flex",
        alignItems: "center",
        gap: "0",
        height: "62px",
        width: "26px",
        paddingRight: "2px",
        boxSizing: "border-box",
        borderRadius: "14px 0 0 14px",
        background: "linear-gradient(180deg, " + ROZE + " 0%, " + ROZE_DIEP + " 100%)",
        color: "#fff",
        cursor: "pointer",
        userSelect: "none",
        justifyContent: "center",
        boxShadow: "0 4px 18px -4px rgba(140,10,88,.45), 0 0 0 1px rgba(255,255,255,.14) inset",
        transition: "width .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s ease, opacity .15s ease",
        font: '600 12px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
      });
      chev = svgChevron();
      Object.assign(chev.style, { flex: "0 0 auto" });
      tab.appendChild(chev);
      labelEl = document.createElement("span");
      labelEl.textContent = "Zijpaneel";
      Object.assign(labelEl.style, {
        whiteSpace: "nowrap",
        overflow: "hidden",
        maxWidth: "0",
        opacity: "0",
        transition: "max-width .18s cubic-bezier(.2,.8,.2,1), opacity .14s ease, margin .18s ease",
        margin: "0"
      });
      tab.appendChild(labelEl);
      var uit = function() {
        tab.style.width = "26px";
        labelEl.style.maxWidth = "0";
        labelEl.style.opacity = "0";
        labelEl.style.margin = "0";
        tab.style.boxShadow = "0 4px 18px -4px rgba(140,10,88,.45), 0 0 0 1px rgba(255,255,255,.14) inset";
      };
      var aan = function() {
        tab.style.width = "116px";
        labelEl.style.maxWidth = "84px";
        labelEl.style.opacity = "1";
        labelEl.style.margin = "0 8px 0 4px";
        tab.style.boxShadow = "0 8px 26px -6px rgba(140,10,88,.55), 0 0 0 1px rgba(255,255,255,.22) inset";
      };
      tab.addEventListener("mouseenter", aan);
      tab.addEventListener("mouseleave", uit);
      tab.addEventListener("focus", aan);
      tab.addEventListener("blur", uit);
      tab.addEventListener("click", openen);
      tab.addEventListener("keydown", function(e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openen();
        }
      });
      tab.addEventListener("animationend", function(e) {
        if (e.target === tab) tab.classList.remove("onsah-in", "onsah-nudge");
      });
      (document.body || document.documentElement).appendChild(tab);
      return tab;
    }
    function toonTip(tekst) {
      if (tipEl) tipEl.remove();
      tipEl = document.createElement("div");
      tipEl.textContent = tekst;
      Object.assign(tipEl.style, {
        position: "fixed",
        right: "34px",
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: "2147483645",
        maxWidth: "230px",
        background: "#201d1f",
        color: "#fff",
        borderRadius: "10px",
        padding: "9px 11px",
        font: '600 12px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        boxShadow: "0 10px 30px -8px rgba(0,0,0,.45)"
      });
      (document.body || document.documentElement).appendChild(tipEl);
      setTimeout(function() {
        if (tipEl) {
          tipEl.remove();
          tipEl = null;
        }
      }, 6e3);
    }
    function openen() {
      try {
        chrome.runtime.sendMessage({ type: MSG.OPEN_SIDE_PANEL }, function(res) {
          void chrome.runtime.lastError;
          if (res && res.ok === false) {
            toonTip("Je browser wil het zijpaneel alleen openen vanaf de browserbalk. Klik met rechts in de pagina → “Agendahulp in zijpaneel”.");
          }
        });
      } catch (e) {
        toonTip("Zijpaneel openen lukte niet. Gebruik de rechtermuisknop → “Agendahulp in zijpaneel”.");
      }
    }
    function toon(zichtbaar) {
      if (!tab) return;
      var was = tab.style.display !== "none";
      tab.style.display = zichtbaar ? "flex" : "none";
      if (zichtbaar && !was) speel("onsah-in");
    }
    function setOpen(v) {
      open = !!v;
      toon(!open);
    }
    try {
      chrome.runtime.onMessage.addListener(function(msg) {
        if (msg && msg.type === MSG.SIDEPANEL_STATE) setOpen(!!msg.open);
      });
      chrome.runtime.sendMessage({ type: MSG.SIDEPANEL_QUERY }, function(r) {
        void chrome.runtime.lastError;
        if (r && r.open) setOpen(true);
      });
    } catch (e) {
    }
    function start() {
      bouw();
      tab.style.display = "none";
      toon(!open);
      if (!open) misschienWiebelen();
    }
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
  })();
})();
//# sourceMappingURL=edge-tab.js.map
