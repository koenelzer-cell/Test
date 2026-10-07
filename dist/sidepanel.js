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
    AGENDA_OPEN_BREAKDOWN: "ag-open-breakdown",
    AGENDA_OPEN_CALC: "ag-open-calc",
    AGENDA_UNREG_COLLAPSED: "ag-unreg-collapsed",
    // { value }
    AGENDA_OPEN_LEAVE: "ag-open-leave",
    //                 verlofdialoog openen in de pagina
    AGENDA_CHECK_RANGE: "ag-check-range",
    // { from, to } -> { ok, result | error }  open registraties in een periode
    AGENDA_QUICK_REGISTER: "ag-quick-register",
    // { date, time, minutes, force } -> { ok, overlap?, error? }
    // CS -> SP (uitgezonden)
    AGENDA_RANGE_PROGRESS: "ag-range-progress",
    // { done, total } voortgang van AGENDA_CHECK_RANGE
    SURVEY_GET_STATE: "survey-get-state",
    //  -> { state }
    SURVEY_OPEN_ITEM: "survey-open-item"
    // { index }
  };
  var SIDEPANEL_PORT = "agendahulp-sidepanel";

  // src/shared/ons-hosts.js
  var ONS_URL_PATTERNS = [
    "https://impegno.ons-dossier.nl/*",
    "https://impegno-staging-staging.ons-dossier.nl/*",
    "https://*.onsagenda.nl/*"
  ];
  var ONS_URL_RE = /^https:\/\/(impegno\.ons-dossier\.nl|impegno-staging-staging\.ons-dossier\.nl|[^/]+\.onsagenda\.nl)\//;
  function isOnsUrl(url) {
    return ONS_URL_RE.test(String(url || ""));
  }

  // src/sidepanel/agenda-panel.js
  var T = {
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
  var SVG_NS = "http://www.w3.org/2000/svg";
  var WD = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  var MON = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  function fmtHM(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h + ":" + (m < 10 ? "0" : "") + m;
  }
  function fmtMin(min) {
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + " u" + (m ? " " + m + " m" : "") : m + " m";
  }
  function dayLabel(date) {
    var d = /* @__PURE__ */ new Date(date + "T00:00:00");
    if (isNaN(d.getTime())) return date;
    return WD[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()];
  }
  function el(tag, styles, text) {
    var n = document.createElement(tag);
    if (styles) Object.assign(n.style, styles);
    if (text != null) n.textContent = text;
    return n;
  }
  function focusRing(node, color) {
    node.addEventListener("focus", function() {
      node.style.outline = "2px solid " + (color || T.brand);
      node.style.outlineOffset = "2px";
    });
    node.addEventListener("blur", function() {
      node.style.outline = "none";
    });
  }
  function liftOnHover(card) {
    card.addEventListener("mouseenter", function() {
      card.style.transform = "translateY(-1px)";
      card.style.boxShadow = "0 4px 12px -6px rgba(32,20,15,.22)";
    });
    card.addEventListener("mouseleave", function() {
      card.style.transform = "none";
      card.style.boxShadow = "none";
    });
  }
  function svgSpineCheck() {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    var p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", "M3 7.2l2.6 2.6L11 4");
    svg.appendChild(p);
    return svg;
  }
  function svgSpinePause() {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    [5, 9].forEach(function(x) {
      var l = document.createElementNS(SVG_NS, "line");
      l.setAttribute("x1", x);
      l.setAttribute("y1", "3.5");
      l.setAttribute("x2", x);
      l.setAttribute("y2", "10.5");
      svg.appendChild(l);
    });
    return svg;
  }
  function svgInfoIcon() {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    var line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", "7");
    line.setAttribute("y1", "6.2");
    line.setAttribute("x2", "7");
    line.setAttribute("y2", "10.4");
    var dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", "7");
    dot.setAttribute("cy", "3.6");
    dot.setAttribute("r", ".9");
    dot.setAttribute("fill", "currentColor");
    dot.setAttribute("stroke", "none");
    var ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("cx", "7");
    ring.setAttribute("cy", "7");
    ring.setAttribute("r", "6.1");
    svg.appendChild(ring);
    svg.appendChild(line);
    svg.appendChild(dot);
    return svg;
  }
  function svgPath(d, size) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", size || 18);
    svg.setAttribute("height", size || 18);
    svg.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("fill", "currentColor");
    p.setAttribute("d", d);
    svg.appendChild(p);
    return svg;
  }
  var CHEV_DICHT = "M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z";
  function pill(label, value, bg, fg) {
    var s = el("span", {
      display: "inline-block",
      background: bg,
      color: fg,
      borderRadius: "10px",
      padding: "1px 8px",
      margin: "0 4px 4px 0",
      fontSize: "11px",
      fontWeight: "600",
      fontVariantNumeric: "tabular-nums"
    }, label + " " + value);
    return s;
  }
  function statLine(client, overig) {
    var wrap = el("div", { margin: "2px 0 2px" });
    wrap.appendChild(pill("Cliënt", fmtHM(client), T.okWash, T.ok));
    wrap.appendChild(pill("Overig", fmtHM(overig), T.lineSoft, T.inkSoft));
    wrap.appendChild(pill("Totaal", fmtHM(client + overig), T.brandWash, T.brand));
    return wrap;
  }
  function sectionTitle(text) {
    return el("div", {
      fontSize: "11px",
      fontWeight: "700",
      color: T.brand,
      textTransform: "uppercase",
      letterSpacing: ".03em",
      margin: "0 0 6px",
      borderTop: "1px solid " + T.line,
      paddingTop: "9px"
    }, text);
  }
  function miniTag(text, fg, bg, bd) {
    return el("span", {
      display: "inline-block",
      fontSize: "10px",
      fontWeight: "700",
      color: fg,
      background: bg,
      border: "1px solid " + bd,
      borderRadius: "8px",
      padding: "0 6px",
      marginLeft: "6px",
      verticalAlign: "middle"
    }, text);
  }
  function zorgVoorStijl(doc) {
    var d = doc || document;
    if (d.getElementById("ons-agendapanel-stijl")) return;
    var st = d.createElement("style");
    st.id = "ons-agendapanel-stijl";
    st.textContent = "@keyframes onsAhSchuif{0%{transform:translateX(-60%)}100%{transform:translateX(260%)}}@keyframes onsAhPuls{0%,100%{opacity:.55}50%{opacity:.9}}";
    (d.head || d.documentElement).appendChild(st);
  }
  function laadBalk() {
    var spoor = el("div", {
      position: "relative",
      height: "3px",
      borderRadius: "999px",
      background: T.lineSoft,
      overflow: "hidden",
      margin: "0 0 10px"
    });
    spoor.setAttribute("role", "progressbar");
    spoor.setAttribute("aria-label", "Weekoverzicht wordt opgehaald");
    var loper = el("div", {
      position: "absolute",
      top: "0",
      bottom: "0",
      left: "0",
      width: "38%",
      borderRadius: "999px",
      background: T.brand,
      animation: "onsAhSchuif 1.1s cubic-bezier(.4,0,.6,1) infinite"
    });
    spoor.appendChild(loper);
    return spoor;
  }
  function skelet() {
    var wrap = el("div", { animation: "onsAhPuls 1.4s ease-in-out infinite" });
    var streep = function(breedte, hoogte, marge) {
      return el("div", {
        height: (hoogte || 10) + "px",
        width: breedte,
        borderRadius: "6px",
        background: T.lineSoft,
        margin: marge || "0 0 8px"
      });
    };
    wrap.appendChild(streep("55%", 12, "0 0 10px"));
    var rij = el("div", { display: "flex", gap: "8px", margin: "0 0 12px" });
    rij.appendChild(el("div", { flex: "1 1 0", height: "52px", borderRadius: "10px", background: T.lineSoft }));
    rij.appendChild(el("div", { flex: "1 1 0", height: "52px", borderRadius: "10px", background: T.lineSoft }));
    wrap.appendChild(rij);
    wrap.appendChild(streep("40%", 9));
    ["85%", "70%", "78%"].forEach(function(b) {
      wrap.appendChild(streep("100%", 8, "0 0 4px"));
      wrap.appendChild(streep(b, 6, "0 0 12px"));
    });
    return wrap;
  }
  function create(host2, actions) {
    actions = actions || {};
    var state = null;
    var infoOpen = false;
    var unregCollapsed = true;
    var root = el("div", {
      background: "#fff",
      color: T.ink,
      font: "14px/1.4 system-ui, sans-serif",
      overflow: "hidden",
      display: "flex",
      flexDirection: "row",
      alignItems: "stretch",
      height: "100%",
      width: "100%"
    });
    var spine = el("div", {
      width: "16px",
      flex: "0 0 auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "12px 0",
      userSelect: "none"
    });
    spine.setAttribute("aria-hidden", "true");
    var spineChip = el("span", {
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      background: "rgba(255,255,255,.24)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      flex: "0 0 auto"
    });
    spine.appendChild(spineChip);
    var mainCol = el("div", {
      flex: "1 1 auto",
      minWidth: "0",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      overflowX: "hidden",
      opacity: "1",
      transition: "opacity .15s ease"
    });
    var header = el("div", {
      display: "flex",
      alignItems: "center",
      background: "#fff",
      color: T.ink,
      padding: "11px 12px",
      fontWeight: "700",
      userSelect: "none",
      borderBottom: "1px solid #f1ecea",
      flex: "0 0 auto"
    });
    var title = el("span", {
      flex: "1 1 auto",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }, "Agendahulp");
    header.appendChild(title);
    var controls = el("div", { display: "inline-flex", alignItems: "center", gap: "8px", flex: "0 0 auto", marginLeft: "8px" });
    var onoff = document.createElement("button");
    onoff.type = "button";
    Object.assign(onoff.style, {
      position: "relative",
      background: "transparent",
      border: "0",
      borderRadius: "999px",
      color: "#fff",
      cursor: "pointer",
      lineHeight: "1",
      padding: "0",
      width: "58px",
      height: "24px",
      fontWeight: "700",
      overflow: "hidden",
      flex: "0 0 auto",
      fontFamily: "inherit"
    });
    var swTrack = el("span", {
      position: "absolute",
      inset: "0",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,.45)",
      transition: "background .16s ease, box-shadow .16s ease, opacity .16s ease"
    });
    var swText = el("span", {
      position: "absolute",
      top: "0",
      bottom: "0",
      display: "flex",
      alignItems: "center",
      fontSize: "11px",
      fontWeight: "700",
      color: "#fff",
      opacity: ".95",
      transition: "left .16s ease, right .16s ease",
      pointerEvents: "none"
    });
    var swKnob = el("span", {
      position: "absolute",
      top: "3px",
      width: "18px",
      height: "18px",
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,.22)",
      transition: "left .16s ease"
    });
    onoff.appendChild(swTrack);
    onoff.appendChild(swText);
    onoff.appendChild(swKnob);
    focusRing(onoff);
    onoff.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      var next = !(state && state.enabled);
      if (state) state.enabled = next;
      paintOnoff();
      if (actions.onToggleEnabled) actions.onToggleEnabled(next);
      if (!infoOpen) renderBody();
    });
    var info = document.createElement("button");
    info.type = "button";
    info.appendChild(svgInfoIcon());
    Object.assign(info.style, {
      background: T.lineSoft,
      border: "1px solid " + T.line,
      borderRadius: "8px",
      color: T.inkSoft,
      cursor: "pointer",
      width: "28px",
      height: "28px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto"
    });
    focusRing(info);
    info.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      infoOpen = !infoOpen;
      renderBody();
    });
    controls.appendChild(onoff);
    controls.appendChild(info);
    header.appendChild(controls);
    mainCol.appendChild(header);
    var body = el("div", { padding: "12px", flex: "0 0 auto" });
    var totals = el("div", { padding: "0 12px 12px", flex: "0 0 auto" });
    var weekBox = el("div", { padding: "0 12px 12px", flex: "0 0 auto" });
    var laadStrook = el("div");
    var weekHost = el("div", { transition: "opacity .15s ease" });
    weekBox.appendChild(laadStrook);
    weekBox.appendChild(weekHost);
    var tools = el("div", { padding: "0 12px 12px", flex: "0 0 auto" });
    mainCol.appendChild(body);
    mainCol.appendChild(totals);
    mainCol.appendChild(tools);
    mainCol.appendChild(weekBox);
    var leaveBar = el("div", {
      position: "sticky",
      bottom: "0",
      marginTop: "auto",
      padding: "10px 12px",
      background: "#fff",
      borderTop: "1px solid #f1ecea",
      flex: "0 0 auto"
    });
    var leaveBtn = document.createElement("button");
    leaveBtn.type = "button";
    leaveBtn.textContent = "Verlof aanvragen";
    leaveBtn.title = "Verlof vastleggen in de agenda en aanvragen in AFAS";
    Object.assign(leaveBtn.style, {
      width: "100%",
      border: "0",
      borderRadius: "999px",
      padding: "10px 16px",
      background: T.brand,
      color: "#fff",
      cursor: "pointer",
      font: "700 13px/1 system-ui,-apple-system,sans-serif",
      boxShadow: "0 4px 12px -6px rgba(204,8,125,.55)"
    });
    leaveBtn.addEventListener("mouseenter", function() {
      leaveBtn.style.background = T.brandDeep;
    });
    leaveBtn.addEventListener("mouseleave", function() {
      leaveBtn.style.background = T.brand;
    });
    focusRing(leaveBtn, T.brandDeep);
    leaveBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (actions.onRequestLeave) actions.onRequestLeave();
    });
    leaveBar.appendChild(leaveBtn);
    mainCol.appendChild(leaveBar);
    root.appendChild(spine);
    root.appendChild(mainCol);
    host2.appendChild(root);
    function paintOnoff() {
      var aan = !!(state && state.enabled);
      swText.textContent = aan ? "Aan" : "Uit";
      swTrack.style.background = aan ? "#1b7f3b" : "#a3241f";
      swTrack.style.boxShadow = aan ? "inset 0 0 0 1px rgba(255,255,255,.12)" : "inset 0 0 0 1px rgba(255,255,255,.10)";
      swTrack.style.opacity = aan ? "1" : ".82";
      swKnob.style.left = aan ? "37px" : "3px";
      swText.style.left = aan ? "9px" : "27px";
      swText.style.right = aan ? "25px" : "7px";
      onoff.setAttribute("aria-label", aan ? "Agendahulp uitschakelen" : "Agendahulp inschakelen");
      onoff.setAttribute("aria-pressed", aan ? "true" : "false");
      onoff.title = aan ? "Aan" : "Uit";
      spine.style.background = aan ? T.brand : "#9a9296";
      spineChip.innerHTML = "";
      spineChip.appendChild(aan ? svgSpineCheck() : svgSpinePause());
    }
    function renderStatusCard() {
      var tekst, toon2;
      if (!state || !state.enabled) {
        tekst = "Gekleurde dagindeling staat uit.";
        toon2 = "off";
      } else if (!state.profileLabel) {
        tekst = "Kies eerst een indeling via het extensie-icoontje in de browser.";
        toon2 = "warn";
      } else {
        tekst = "Gekleurde dagindeling staat aan (" + state.profileLabel + ").";
        toon2 = "ok";
      }
      var bg = toon2 === "ok" ? T.okWash : toon2 === "warn" ? "#fff4d6" : T.lineSoft;
      var fg = toon2 === "ok" ? T.ok : toon2 === "warn" ? "#8a5a00" : T.inkSoft;
      var card = el("div", {
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        padding: "9px 10px",
        borderRadius: "10px",
        background: bg,
        color: fg,
        fontSize: "12.5px",
        lineHeight: "1.4",
        fontWeight: "600"
      });
      var icon = toon2 === "ok" ? svgSpineCheck() : svgInfoIcon();
      icon.setAttribute("width", "13");
      icon.setAttribute("height", "13");
      Object.assign(icon.style, { width: "13px", height: "13px", flex: "0 0 auto", marginTop: "1px" });
      card.appendChild(icon);
      card.appendChild(el("span", null, tekst));
      return card;
    }
    function renderInfo() {
      body.innerHTML = "";
      var back = document.createElement("button");
      back.type = "button";
      Object.assign(back.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "9px 10px",
        borderRadius: "10px",
        cursor: "pointer",
        border: "1px solid " + T.brand,
        background: "#fff",
        color: T.brand,
        fontWeight: "600",
        fontSize: "13px",
        width: "100%",
        marginBottom: "10px",
        boxSizing: "border-box",
        transition: "transform .12s ease, box-shadow .12s ease"
      });
      back.appendChild(svgPath("M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20z"));
      back.appendChild(document.createTextNode("Terug"));
      liftOnHover(back);
      focusRing(back);
      back.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        infoOpen = false;
        renderBody();
      });
      body.appendChild(back);
      body.appendChild(el("div", {
        fontSize: "12.5px",
        color: T.inkSoft,
        lineHeight: "1.4",
        margin: "2px 0 10px"
      }, "Gebruik de Agendahulp voor een duidelijk agenda-overzicht."));
      var legenda = state && state.legend || [];
      body.appendChild(el("div", {
        fontSize: "11px",
        fontWeight: "700",
        color: T.brand,
        textTransform: "uppercase",
        letterSpacing: ".03em",
        margin: "0 0 6px"
      }, "Legenda (" + (state && state.windowLabel || "08:00–17:00") + ")"));
      var wrap = el("div", { display: "flex", flexDirection: "column", gap: "5px" });
      legenda.forEach(function(item) {
        var row = el("div", { display: "flex", alignItems: "center", gap: "8px" });
        row.appendChild(el("span", {
          width: "12px",
          height: "12px",
          borderRadius: "4px",
          background: item.color,
          border: "1px solid rgba(0,0,0,.12)",
          flex: "0 0 auto"
        }));
        row.appendChild(el("span", { fontSize: "12px", color: T.ink, lineHeight: "1.3" }, item.text));
        wrap.appendChild(row);
      });
      body.appendChild(wrap);
      body.appendChild(el("div", {
        fontSize: "11px",
        color: T.inkSoft,
        marginTop: "10px",
        paddingTop: "8px",
        borderTop: "1px solid " + T.line
      }, "Versie " + (state && state.version || "")));
    }
    function renderOnsCount() {
      var n = state && state.onsOpenCount;
      if (n == null) return null;
      var row = el("div", {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginTop: "8px",
        padding: "8px 10px",
        borderRadius: "10px",
        fontSize: "12.5px",
        fontWeight: "600",
        lineHeight: "1.35",
        background: n > 0 ? T.brandWash : T.okWash,
        color: n > 0 ? T.brandDeep : T.ok
      });
      row.appendChild(el("span", {
        minWidth: "22px",
        height: "22px",
        padding: "0 6px",
        boxSizing: "border-box",
        borderRadius: "999px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        background: n > 0 ? T.brand : T.ok,
        color: "#fff",
        fontSize: "12px",
        fontWeight: "800",
        fontVariantNumeric: "tabular-nums"
      }, String(n)));
      row.appendChild(el("span", null, n === 1 ? "open registratie volgens ONS" : "open registraties volgens ONS"));
      row.title = "Het aantal dat ONS zelf telt (ververst elke vijf minuten).";
      return row;
    }
    function renderBody() {
      if (infoOpen) {
        renderInfo();
        return;
      }
      body.innerHTML = "";
      body.appendChild(renderStatusCard());
      var cnt = renderOnsCount();
      if (cnt) body.appendChild(cnt);
    }
    function renderTotals() {
      totals.innerHTML = "";
      if (!state) return;
      var past = state.past || {};
      var dates = Object.keys(past).filter(function(d) {
        return past[d].client + past[d].overig > 0;
      }).sort();
      var view = state.view || "";
      var inDayView = view === "day";
      if (view !== "workweek" && view !== "week") {
        var weekBtn = document.createElement("button");
        weekBtn.type = "button";
        weekBtn.style.cssText = "display:flex;align-items:center;justify-content:center;gap:6px;width:100%;box-sizing:border-box;margin:4px 0 10px;padding:8px 10px;border-radius:10px;cursor:pointer;border:1px solid " + T.brand + ";background:#fff;color:" + T.brand + ";font-weight:700;font-size:12px;transition:transform .12s ease, box-shadow .12s ease";
        weekBtn.textContent = "Naar weekweergave";
        liftOnHover(weekBtn);
        focusRing(weekBtn);
        weekBtn.addEventListener("click", function() {
          if (actions.onJumpToWeek) actions.onJumpToWeek();
        });
        totals.appendChild(weekBtn);
      }
      if (dates.length) {
        var secHead = el("div", {
          display: "flex",
          alignItems: "center",
          gap: "6px",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: "700",
          color: T.brand,
          textTransform: "uppercase",
          letterSpacing: ".03em",
          margin: "0 0 6px",
          borderTop: "1px solid " + T.line,
          paddingTop: "9px",
          userSelect: "none"
        });
        var secChev = svgPath(CHEV_DICHT, 11);
        secChev.style.cssText = "width:11px;height:11px;flex:0 0 auto;transition:transform .15s ease;transform:" + (unregCollapsed ? "none" : "rotate(90deg)");
        var secLbl = el("span", { flex: "1 1 auto" }, "Ongeregistreerde tijd per dag");
        secHead.appendChild(secChev);
        secHead.appendChild(secLbl);
        var secBody = el("div", {
          display: unregCollapsed ? "none" : "flex",
          flexDirection: "column",
          gap: "6px"
        });
        secHead.addEventListener("click", function() {
          unregCollapsed = !unregCollapsed;
          secBody.style.display = unregCollapsed ? "none" : "flex";
          secChev.style.transform = unregCollapsed ? "none" : "rotate(90deg)";
          if (actions.onUnregCollapsedChange) actions.onUnregCollapsedChange(unregCollapsed);
        });
        totals.appendChild(secHead);
        totals.appendChild(secBody);
        dates.forEach(function(date) {
          var t = past[date];
          var card = el("div");
          card.style.cssText = "padding:7px 9px;border-radius:10px;background:#fff;border:1px solid " + (inDayView ? T.line : T.brand) + ";cursor:" + (inDayView ? "default" : "pointer") + ";box-sizing:border-box;transition:transform .12s ease, box-shadow .12s ease";
          if (!inDayView) {
            card.title = "Klik om naar deze dag te gaan";
            liftOnHover(card);
            card.addEventListener("click", function() {
              if (actions.onJumpToDay) actions.onJumpToDay(date);
            });
          }
          var d = el("div", { fontSize: "12px", fontWeight: "700", color: T.ink, marginBottom: "3px" }, dayLabel(date));
          if (t.lateCount > 0) d.appendChild(miniTag("te laat: " + t.lateCount, T.bad, T.badWash, "#f0b0b0"));
          var ws = (state.windowStatus || {})[date];
          if (ws === "locked") d.appendChild(miniTag("vergrendeld", T.bad, T.badWash, "#f0b0b0"));
          else if (ws === "soon") d.appendChild(miniTag("verloopt binnenkort", "#8a5a00", "#fff6e0", "#f0d08a"));
          card.appendChild(d);
          card.appendChild(statLine(t.client, t.overig));
          secBody.appendChild(card);
        });
      }
      if (inDayView) {
        var items = state.unfinished || [];
        totals.appendChild(sectionTitle("Nog te registreren" + (items.length ? " (" + items.length + ")" : "")));
        if (!items.length) {
          var none = el("div");
          none.style.cssText = "display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:10px;background:" + T.okWash + ";color:" + T.ok + ";font-size:12.5px;font-weight:700";
          var okIcon = svgSpineCheck();
          okIcon.setAttribute("width", "13");
          okIcon.setAttribute("height", "13");
          okIcon.style.cssText = "width:13px;height:13px;flex:0 0 auto";
          none.appendChild(okIcon);
          none.appendChild(document.createTextNode("Alles geregistreerd"));
          totals.appendChild(none);
        } else {
          var list = el("div");
          list.style.cssText = "display:flex;flex-direction:column;gap:6px";
          items.forEach(function(it) {
            var card = el("div");
            card.style.cssText = "display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:10px;background:#fff;border:1px solid " + (it.client ? T.brand : T.line) + ";cursor:pointer;box-sizing:border-box;transition:transform .12s ease, box-shadow .12s ease";
            card.title = "Klik om de afspraak te openen";
            liftOnHover(card);
            card.addEventListener("click", function() {
              if (actions.onOpenOccurrence) actions.onOpenOccurrence(it.id);
            });
            card.appendChild(el("span", {
              fontSize: "12px",
              fontWeight: "800",
              color: T.brand,
              fontVariantNumeric: "tabular-nums",
              flex: "0 0 auto"
            }, it.time || "--:--"));
            card.appendChild(el("span", {
              fontSize: "12px",
              color: T.ink,
              flex: "1 1 auto",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }, it.name));
            card.appendChild(el("span", {
              fontSize: "10px",
              fontWeight: "700",
              color: it.client ? T.ok : T.inkSoft,
              background: it.client ? T.okWash : T.lineSoft,
              borderRadius: "8px",
              padding: "1px 7px",
              flex: "0 0 auto"
            }, it.client ? "cliënt" : "overig"));
            list.appendChild(card);
          });
          totals.appendChild(list);
        }
      }
    }
    function renderWeek() {
      var w = state && state.week;
      var bezig = !!(state && state.weekLoading);
      var fout = state && state.weekError || "";
      var bridge = window.__onsahReact;
      if (fout && !bezig) {
        if (bridge && bridge.unmount) bridge.unmount(weekHost);
        weekHost.innerHTML = "";
        weekHost.style.opacity = "1";
        laadStrook.innerHTML = "";
        weekHost.appendChild(el("div", {
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          padding: "9px 10px",
          borderRadius: "10px",
          background: "#fbeceb",
          color: "#a3241f",
          fontSize: "12.5px",
          fontWeight: "600",
          lineHeight: "1.4",
          marginTop: "9px",
          borderTop: "1px solid " + T.line
        }, fout));
        return;
      }
      if (!w || !w.summary) {
        if (bridge && bridge.unmount) bridge.unmount(weekHost);
        weekHost.innerHTML = "";
        weekHost.style.opacity = "1";
        laadStrook.innerHTML = "";
        if (bezig) {
          zorgVoorStijl(weekBox.ownerDocument);
          laadStrook.appendChild(el("div", {
            fontSize: "11px",
            fontWeight: "700",
            color: T.brand,
            textTransform: "uppercase",
            letterSpacing: ".03em",
            margin: "0 0 6px",
            borderTop: "1px solid " + T.line,
            paddingTop: "9px"
          }, "Weekoverzicht ophalen…"));
          laadStrook.appendChild(laadBalk());
          laadStrook.appendChild(skelet());
        }
        return;
      }
      if (!bridge || !bridge.renderWeekPanel) {
        laadStrook.innerHTML = "";
        weekHost.innerHTML = "";
        weekHost.appendChild(el("div", {
          fontSize: "12px",
          color: T.bad,
          fontWeight: "600"
        }, "Weekoverzicht kon niet laden (bundel ontbreekt)."));
        return;
      }
      bridge.renderWeekPanel(weekHost, w.summary, w.opts || {}, T, w.clientRows || [], w.overigRows || [], fmtMin, {
        onOpenBreakdown: function() {
          if (actions.onOpenBreakdown) actions.onOpenBreakdown();
        },
        onOpenCalc: function() {
          if (actions.onOpenCalc) actions.onOpenCalc();
        }
      });
      weekHost.style.opacity = bezig ? ".45" : "1";
      laadStrook.innerHTML = "";
      if (bezig) {
        zorgVoorStijl(weekBox.ownerDocument);
        var balk = laadBalk();
        balk.style.margin = "9px 0 8px";
        laadStrook.appendChild(balk);
      }
    }
    var range = { open: true, from: "", to: "", busy: false, done: 0, total: 0, result: null, error: "" };
    var quick = { open: false, date: "", time: "", minutes: "15", busy: false, error: "", overlap: "" };
    function fieldLabel(text, input) {
      var w = el("label", { display: "flex", flexDirection: "column", gap: "3px", flex: "1 1 0", minWidth: "0", fontSize: "11px", fontWeight: "700", color: T.inkSoft });
      w.appendChild(document.createTextNode(text));
      w.appendChild(input);
      return w;
    }
    function inputEl(type, value, onChange) {
      var i = document.createElement("input");
      i.type = type;
      i.value = value || "";
      Object.assign(i.style, {
        width: "100%",
        boxSizing: "border-box",
        padding: "6px 7px",
        borderRadius: "8px",
        border: "1px solid " + T.line,
        font: "13px system-ui, sans-serif",
        color: T.ink,
        background: "#fff"
      });
      focusRing(i);
      i.addEventListener("input", function() {
        onChange(i.value);
      });
      i.addEventListener("change", function() {
        onChange(i.value);
      });
      return i;
    }
    function primaryBtn(text, onClick, disabled) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.disabled = !!disabled;
      Object.assign(b.style, {
        width: "100%",
        border: "0",
        borderRadius: "10px",
        padding: "9px 12px",
        marginTop: "8px",
        background: disabled ? "#d9c2cf" : T.brand,
        color: "#fff",
        cursor: disabled ? "default" : "pointer",
        font: "700 12.5px/1 system-ui, sans-serif"
      });
      focusRing(b, T.brandDeep);
      b.addEventListener("click", function(e) {
        e.preventDefault();
        if (!b.disabled) onClick();
      });
      return b;
    }
    function noteBox(text, tone) {
      var c = tone === "bad" ? [T.badWash, T.bad] : tone === "ok" ? [T.okWash, T.ok] : ["#fff4d6", "#8a5a00"];
      return el("div", {
        marginTop: "8px",
        padding: "8px 10px",
        borderRadius: "10px",
        background: c[0],
        color: c[1],
        fontSize: "12.5px",
        fontWeight: "600",
        lineHeight: "1.4"
      }, text);
    }
    function toolHead(text, isOpen, onToggle) {
      var h = el("div", {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: "700",
        color: T.brand,
        textTransform: "uppercase",
        letterSpacing: ".03em",
        margin: "0 0 6px",
        borderTop: "1px solid " + T.line,
        paddingTop: "9px",
        userSelect: "none"
      });
      h.setAttribute("role", "button");
      h.setAttribute("tabindex", "0");
      h.setAttribute("aria-expanded", isOpen ? "true" : "false");
      var chev = svgPath(CHEV_DICHT, 11);
      chev.style.cssText = "width:11px;height:11px;flex:0 0 auto;transition:transform .15s ease;transform:" + (isOpen ? "rotate(90deg)" : "none");
      h.appendChild(chev);
      h.appendChild(el("span", { flex: "1 1 auto" }, text));
      h.addEventListener("click", onToggle);
      h.addEventListener("keydown", function(e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      });
      return h;
    }
    function clockText(ms) {
      var d = new Date(ms);
      return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    }
    function rangeResultEl(r) {
      var wrap = el("div", { marginTop: "8px" });
      if (!r.days.length) {
        wrap.appendChild(noteBox("Alles geregistreerd van " + dayLabel(r.from) + " t/m " + dayLabel(r.to) + ".", "ok"));
        return wrap;
      }
      var sum = el(
        "div",
        { fontSize: "12.5px", fontWeight: "700", color: T.ink, margin: "0 0 6px" },
        r.totalCount + (r.totalCount === 1 ? " afspraak" : " afspraken") + " open · " + fmtMin(r.totalMinutes) + " op " + r.days.length + (r.days.length === 1 ? " dag" : " dagen")
      );
      if (r.lateCount > 0) sum.appendChild(miniTag("te laat: " + r.lateCount, T.bad, T.badWash, "#f0b0b0"));
      wrap.appendChild(sum);
      var list = el("div", { display: "flex", flexDirection: "column", gap: "6px" });
      r.days.forEach(function(d) {
        var card = el("div");
        card.style.cssText = "padding:7px 9px;border-radius:10px;background:#fff;border:1px solid " + T.brand + ";cursor:pointer;box-sizing:border-box;transition:transform .12s ease, box-shadow .12s ease";
        card.title = "Klik om naar deze dag te gaan";
        liftOnHover(card);
        card.addEventListener("click", function() {
          if (actions.onJumpToDay) actions.onJumpToDay(d.date, true);
        });
        var head = el("div", { fontSize: "12px", fontWeight: "700", color: T.ink, marginBottom: "3px" }, dayLabel(d.date));
        if (d.lateCount > 0) head.appendChild(miniTag("te laat: " + d.lateCount, T.bad, T.badWash, "#f0b0b0"));
        var ws = (state && state.windowStatus || {})[d.date];
        if (ws === "soon") head.appendChild(miniTag("verloopt binnenkort", "#8a5a00", "#fff6e0", "#f0d08a"));
        card.appendChild(head);
        card.appendChild(statLine(d.client, d.overig));
        d.items.forEach(function(it) {
          var row = el("div", { display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: T.inkSoft, marginTop: "2px" });
          row.appendChild(el("span", { fontWeight: "800", color: T.brand, fontVariantNumeric: "tabular-nums", flex: "0 0 auto" }, clockText(it.start)));
          row.appendChild(el("span", { flex: "0 0 auto", fontVariantNumeric: "tabular-nums" }, fmtMin(it.minutes)));
          row.appendChild(el("span", { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, it.uursoort || ""));
          row.appendChild(el("span", {
            fontSize: "10px",
            fontWeight: "700",
            color: it.client ? T.ok : T.inkSoft,
            background: it.client ? T.okWash : T.lineSoft,
            borderRadius: "8px",
            padding: "0 6px",
            flex: "0 0 auto"
          }, it.client ? "cliënt" : "overig"));
          card.appendChild(row);
        });
        list.appendChild(card);
      });
      wrap.appendChild(list);
      return wrap;
    }
    function startRangeCheck() {
      if (range.busy || !actions.onCheckRange) return;
      range.busy = true;
      range.done = 0;
      range.total = 0;
      range.error = "";
      range.result = null;
      renderTools();
      actions.onCheckRange(range.from, range.to, function(res) {
        range.busy = false;
        if (res && res.ok && res.result) range.result = res.result;
        else range.error = res && res.error || "Controleren mislukt.";
        renderTools();
      });
    }
    function startQuickRegister(force) {
      if (quick.busy || !actions.onQuickRegister) return;
      quick.busy = true;
      quick.error = "";
      if (!force) quick.overlap = "";
      renderTools();
      actions.onQuickRegister({ date: quick.date, time: quick.time, minutes: quick.minutes, force: !!force }, function(res) {
        quick.busy = false;
        if (res && res.ok) {
          quick.overlap = "";
          quick.error = "";
        } else if (res && res.overlap) quick.overlap = res.overlap;
        else quick.error = res && res.error || "Openen mislukt.";
        renderTools();
      });
    }
    function renderTools() {
      tools.innerHTML = "";
      if (!state) return;
      if (!range.from && state.rangeDefaultFrom) range.from = state.rangeDefaultFrom;
      if (!range.to && state.today) range.to = state.today;
      if (!quick.date && state.today) quick.date = state.today;
      tools.appendChild(toolHead("Open registraties controleren", range.open, function() {
        range.open = !range.open;
        renderTools();
      }));
      if (range.open) {
        var rBox = el("div");
        var rRow = el("div", { display: "flex", gap: "8px" });
        rRow.appendChild(fieldLabel("Van", inputEl("date", range.from, function(v) {
          range.from = v;
        })));
        rRow.appendChild(fieldLabel("Tot en met", inputEl("date", range.to, function(v) {
          range.to = v;
        })));
        rBox.appendChild(rRow);
        rBox.appendChild(el(
          "div",
          { fontSize: "11px", color: T.inkSoft, marginTop: "5px", lineHeight: "1.35" },
          "Haalt elke week in deze periode op bij ONS (hooguit 26 weken) en toont per dag wat nog niet geregistreerd is."
        ));
        rBox.appendChild(primaryBtn(range.busy ? "Bezig met controleren…" : "Controleren", startRangeCheck, range.busy));
        if (range.busy) {
          zorgVoorStijl(tools.ownerDocument);
          var p = el("div", { marginTop: "8px" });
          p.appendChild(el(
            "div",
            { fontSize: "11px", fontWeight: "700", color: T.inkSoft, marginBottom: "4px" },
            range.total ? "Week " + range.done + " van " + range.total + " opgehaald" : "Weken ophalen…"
          ));
          if (range.total) {
            var spoor = el("div", { height: "4px", borderRadius: "999px", background: T.lineSoft, overflow: "hidden" });
            spoor.setAttribute("role", "progressbar");
            spoor.setAttribute("aria-valuemin", "0");
            spoor.setAttribute("aria-valuemax", String(range.total));
            spoor.setAttribute("aria-valuenow", String(range.done));
            spoor.appendChild(el("div", { height: "100%", width: Math.round(range.done / range.total * 100) + "%", background: T.brand, transition: "width .2s ease" }));
            p.appendChild(spoor);
          } else {
            p.appendChild(laadBalk());
          }
          rBox.appendChild(p);
        }
        if (range.error) rBox.appendChild(noteBox(range.error, "bad"));
        if (range.result && !range.busy) rBox.appendChild(rangeResultEl(range.result));
        tools.appendChild(rBox);
      }
      tools.appendChild(toolHead("Snel registreren", quick.open, function() {
        quick.open = !quick.open;
        renderTools();
      }));
      if (quick.open) {
        var qBox = el("div");
        qBox.appendChild(el("div", { marginBottom: "6px" }, null)).appendChild(fieldLabel("Datum", inputEl("date", quick.date, function(v) {
          quick.date = v;
          quick.overlap = "";
        })));
        var qRow = el("div", { display: "flex", gap: "8px" });
        qRow.appendChild(fieldLabel("Begintijd", inputEl("time", quick.time, function(v) {
          quick.time = v;
          quick.overlap = "";
        })));
        var dur = inputEl("number", quick.minutes, function(v) {
          quick.minutes = v;
          quick.overlap = "";
        });
        dur.min = "5";
        dur.max = "1440";
        dur.step = "5";
        qRow.appendChild(fieldLabel("Duur (min)", dur));
        qBox.appendChild(qRow);
        qBox.appendChild(el(
          "div",
          { fontSize: "11px", color: T.inkSoft, marginTop: "5px", lineHeight: "1.35" },
          "Opent het registratieformulier van ONS met deze tijden ingevuld. Registreer je een afspraak? Open dan de afspraak zelf, zodat de registratie eraan gekoppeld wordt."
        ));
        if (quick.overlap) {
          qBox.appendChild(noteBox(quick.overlap, "warn"));
          qBox.appendChild(primaryBtn(quick.busy ? "Openen…" : "Toch openen", function() {
            startQuickRegister(true);
          }, quick.busy));
        } else {
          qBox.appendChild(primaryBtn(quick.busy ? "Controleren…" : "Formulier openen", function() {
            startQuickRegister(false);
          }, quick.busy));
        }
        if (quick.error) qBox.appendChild(noteBox(quick.error, "bad"));
        tools.appendChild(qBox);
      }
    }
    var toolsReady = false;
    function render() {
      if (!toolsReady && state) {
        toolsReady = true;
        renderTools();
      }
      leaveBar.style.display = state && state.leaveRequest === false ? "none" : "";
      paintOnoff();
      renderBody();
      renderTotals();
      renderWeek();
    }
    paintOnoff();
    render();
    return {
      update: function(next) {
        state = next || null;
        render();
      },
      setUnregCollapsed: function(v) {
        unregCollapsed = !!v;
        renderTotals();
      },
      setRangeProgress: function(done, total) {
        if (!range.busy) return;
        range.done = done;
        range.total = total;
        renderTools();
      },
      destroy: function() {
        try {
          if (window.__onsahReact) window.__onsahReact.unmount(weekHost);
        } catch (e) {
        }
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  // src/sidepanel/survey-panel.js
  var T2 = {
    ink: "#201d1f",
    inkSoft: "#6b6367",
    line: "#ece7e5",
    lineSoft: "#f6f2f0",
    brand: "#cc087d",
    ok: "#1b7f3b",
    okWash: "#eaf6ee",
    amber: "#b45309",
    amberWash: "#fff7d6",
    amberLine: "#f0b429",
    amberInk: "#704b00"
  };
  var SVG_NS2 = "http://www.w3.org/2000/svg";
  function el2(tag, styles, text) {
    var n = document.createElement(tag);
    if (styles) Object.assign(n.style, styles);
    if (text != null) n.textContent = text;
    return n;
  }
  function focusRing2(node, color) {
    node.addEventListener("focus", function() {
      node.style.outline = "2px solid " + (color || T2.brand);
      node.style.outlineOffset = "2px";
    });
    node.addEventListener("blur", function() {
      node.style.outline = "none";
    });
  }
  function svgStroke(d, w) {
    var svg = document.createElementNS(SVG_NS2, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", w || "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    var p = document.createElementNS(SVG_NS2, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
    return svg;
  }
  var ICON_OK = "M3 7.2l2.6 2.6L11 4";
  var ICON_LET_OP = "M7 3.6v4.2M7 10.3v.1";
  function create2(host2, actions) {
    actions = actions || {};
    var state = null;
    var root = el2("div", {
      background: "#fff",
      color: T2.ink,
      font: "14px/1.4 system-ui, sans-serif",
      overflow: "hidden",
      display: "flex",
      flexDirection: "row",
      alignItems: "stretch",
      height: "100%",
      width: "100%"
    });
    var spine = el2("div", {
      width: "16px",
      flex: "0 0 auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "12px 0",
      userSelect: "none",
      background: T2.brand
    });
    spine.setAttribute("aria-hidden", "true");
    var spineChip = el2("span", {
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      background: "rgba(255,255,255,.24)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      flex: "0 0 auto"
    });
    spine.appendChild(spineChip);
    var mainCol = el2("div", {
      flex: "1 1 auto",
      minWidth: "0",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      overflowX: "hidden"
    });
    var header = el2("div", {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "#fff",
      color: T2.ink,
      padding: "11px 12px",
      fontWeight: "700",
      userSelect: "none",
      borderBottom: "1px solid #f1ecea",
      flex: "0 0 auto"
    });
    var title = el2("span", {
      flex: "1 1 auto",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "13px"
    }, "Vragenlijst");
    header.appendChild(title);
    mainCol.appendChild(header);
    var body = el2("div", { padding: "12px", flex: "1 1 auto" });
    mainCol.appendChild(body);
    root.appendChild(spine);
    root.appendChild(mainCol);
    host2.appendChild(root);
    function tel(s) {
      var items = s && s.items || [];
      var open = items.filter(function(i) {
        return !i.done;
      }).length;
      var signalen = s && s.signals || [];
      return {
        items,
        open,
        klaar: items.length - open,
        signalen,
        waarschuwing: s && s.respondentWarning,
        letOp: signalen.length > 0 || !!(s && s.respondentWarning)
      };
    }
    function paintSpine() {
      var t = tel(state);
      var kleur = t.open ? T2.brand : t.letOp ? T2.amber : T2.ok;
      spine.style.background = kleur;
      spineChip.innerHTML = "";
      spineChip.appendChild(svgStroke(t.open || t.letOp ? ICON_LET_OP : ICON_OK, t.open || t.letOp ? "2" : "1.8"));
    }
    function paintTitle() {
      var t = tel(state);
      if (!state) {
        title.textContent = "Vragenlijst";
        return;
      }
      if (t.open) {
        title.textContent = "Nog " + t.open + " van " + t.items.length + " verplichte " + (t.items.length === 1 ? "vraag" : "vragen");
      } else if (t.signalen.length) {
        title.textContent = t.signalen.length + " " + (t.signalen.length === 1 ? "signaal" : "signalen");
      } else if (t.waarschuwing) {
        title.textContent = "Controleer cliënttevredenheid";
      } else {
        title.textContent = t.items.length ? "Alle " + t.klaar + " verplichte vragen ingevuld" : "Alle verplichte vragen ingevuld";
      }
    }
    function meldkader(tekst, rol) {
      var box = el2("div", {
        margin: "4px 0 10px",
        padding: "10px 11px",
        borderRadius: "7px",
        border: "1px solid " + T2.amberLine,
        background: T2.amberWash,
        color: T2.amberInk,
        fontWeight: "700",
        lineHeight: "1.4",
        fontSize: "12.5px"
      }, tekst);
      if (rol) box.setAttribute("role", rol);
      return box;
    }
    function render() {
      paintSpine();
      paintTitle();
      body.innerHTML = "";
      if (!state) {
        body.appendChild(el2(
          "div",
          { fontSize: "12.5px", color: T2.inkSoft, lineHeight: "1.45" },
          "Geen vragenlijst open. Open in ONS een cliëntvragenlijst; de checklist verschijnt hier dan vanzelf."
        ));
        return;
      }
      var t = tel(state);
      t.signalen.forEach(function(s) {
        var box = meldkader("", "alert");
        box.textContent = "";
        box.appendChild(el2("div", {
          marginBottom: "4px",
          fontSize: "11px",
          fontWeight: "800",
          textTransform: "uppercase",
          letterSpacing: ".02em",
          color: T2.amberInk
        }, s.question || "Signaal"));
        box.appendChild(el2("div", { fontWeight: "600" }, s.text || ""));
        body.appendChild(box);
      });
      if (t.waarschuwing) body.appendChild(meldkader(t.waarschuwing, "alert"));
      if (!t.items.length) {
        body.appendChild(el2("div", {
          display: "flex",
          alignItems: "center",
          gap: "7px",
          padding: "8px 10px",
          borderRadius: "10px",
          background: T2.okWash,
          color: T2.ok,
          fontSize: "12.5px",
          fontWeight: "700"
        }, "Geen verplichte vragen gevonden."));
        return;
      }
      var groepen = [];
      var index = {};
      t.items.forEach(function(item, i) {
        var key = item.category + "||" + item.group;
        if (!index[key]) {
          index[key] = { category: item.category, group: item.group, items: [] };
          groepen.push(index[key]);
        }
        index[key].items.push({ item, i });
      });
      groepen.forEach(function(g) {
        body.appendChild(el2("div", {
          fontWeight: "700",
          fontSize: "12px",
          color: "#6b6b6b",
          textTransform: "uppercase",
          letterSpacing: ".02em",
          margin: "12px 0 4px",
          paddingBottom: "3px",
          borderBottom: "1px solid #eee"
        }, g.category === g.group ? g.group : g.category + " > " + g.group));
        var lijst = el2("ul", { listStyle: "none", margin: "0 0 4px", padding: "0" });
        g.items.forEach(function(rij) {
          var item = rij.item;
          var li = el2("li", {
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            padding: "5px 0",
            borderBottom: "1px solid #f3f3f3"
          });
          var onbekend = !!item.unknown && !item.done;
          var link = document.createElement("a");
          link.textContent = item.question + (onbekend ? "  — niet automatisch te controleren" : "");
          if (onbekend) link.title = "Deze verplichte vraag kon niet automatisch worden gecontroleerd. Kijk haar zelf na.";
          link.setAttribute("role", "button");
          link.tabIndex = 0;
          Object.assign(link.style, {
            flex: "1 1 auto",
            minWidth: "0",
            color: item.done ? "#9aa0a6" : onbekend ? T2.amber : T2.brand,
            textDecoration: item.done ? "line-through" : "none",
            fontWeight: item.done ? "400" : "600",
            cursor: "pointer",
            fontSize: "12.5px"
          });
          link.addEventListener("mouseenter", function() {
            if (!item.done) link.style.textDecoration = "underline";
          });
          link.addEventListener("mouseleave", function() {
            if (!item.done) link.style.textDecoration = "none";
          });
          var ga = function() {
            if (actions.onOpenItem) actions.onOpenItem(rij.i);
          };
          link.addEventListener("click", function(e) {
            e.preventDefault();
            ga();
          });
          link.addEventListener("keydown", function(e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              ga();
              return;
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              var links = Array.prototype.slice.call(body.querySelectorAll('a[tabindex="0"]'));
              var k = links.indexOf(link);
              var next = links[k + (e.key === "ArrowDown" ? 1 : -1)];
              if (next) next.focus();
            }
          });
          focusRing2(link);
          var mark = el2("span", item.done || onbekend ? {
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "1px",
            width: "18px",
            height: "18px",
            borderRadius: "999px",
            background: item.done ? T2.ok : T2.amber,
            color: "#fff",
            fontWeight: "900",
            fontSize: "11px",
            lineHeight: "1"
          } : { display: "none" }, item.done ? "✓" : onbekend ? "?" : "");
          mark.setAttribute("aria-label", item.done ? "Ingevuld" : onbekend ? "Niet te controleren" : "Nog niet ingevuld");
          li.appendChild(link);
          li.appendChild(mark);
          lijst.appendChild(li);
        });
        body.appendChild(lijst);
      });
    }
    paintSpine();
    render();
    return {
      update: function(next) {
        state = next || null;
        render();
      },
      destroy: function() {
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  // src/sidepanel/index.js
  var NIETS_KOP = "Niets om te tonen";
  var NIETS_TEKST = "Ga in ONS naar de agenda of open een cliëntvragenlijst; het paneel vult zich dan vanzelf.";
  var host = document.getElementById("paneel");
  var huidig = null;
  var onsTabId = null;
  function leeg() {
    if (huidig) {
      huidig.paneel.destroy();
      huidig = null;
    }
    host.innerHTML = "";
  }
  function toonMelding(kop, tekst) {
    leeg();
    const d = document.createElement("div");
    d.className = "melding";
    const b = document.createElement("b");
    b.textContent = kop;
    d.appendChild(b);
    d.appendChild(document.createTextNode(tekst));
    host.appendChild(d);
  }
  function naarTab(msg) {
    if (onsTabId == null) return;
    try {
      chrome.tabs.sendMessage(onsTabId, msg, function() {
        void chrome.runtime.lastError;
      });
    } catch (e) {
    }
  }
  function vraagAanTab(msg, cb) {
    if (onsTabId == null) {
      cb({ ok: false, error: "Geen ONS-tabblad gevonden." });
      return;
    }
    try {
      chrome.tabs.sendMessage(onsTabId, msg, function(res) {
        if (chrome.runtime.lastError || !res) {
          cb({ ok: false, error: "De ONS-pagina reageert niet. Herlaad de pagina en probeer het opnieuw." });
          return;
        }
        cb(res);
      });
    } catch (e) {
      cb({ ok: false, error: "De ONS-pagina reageert niet." });
    }
  }
  var agendaActies = {
    onToggleEnabled: function(aan) {
      naarTab({ type: MSG.AGENDA_TOGGLE_ENABLED, value: aan });
    },
    onJumpToDay: function(date, always) {
      naarTab({ type: MSG.AGENDA_JUMP_DAY, date, always: !!always });
    },
    onJumpToWeek: function() {
      naarTab({ type: MSG.AGENDA_JUMP_WEEK });
    },
    onOpenOccurrence: function(id) {
      naarTab({ type: MSG.AGENDA_OPEN_OCCURRENCE, id });
    },
    onOpenBreakdown: function() {
      naarTab({ type: MSG.AGENDA_OPEN_BREAKDOWN });
    },
    onOpenCalc: function() {
      naarTab({ type: MSG.AGENDA_OPEN_CALC });
    },
    onUnregCollapsedChange: function(v) {
      naarTab({ type: MSG.AGENDA_UNREG_COLLAPSED, value: v });
    },
    onRequestLeave: function() {
      naarTab({ type: MSG.AGENDA_OPEN_LEAVE });
    },
    onCheckRange: function(from, to, cb) {
      vraagAanTab({ type: MSG.AGENDA_CHECK_RANGE, from, to }, cb);
    },
    onQuickRegister: function(req, cb) {
      vraagAanTab(Object.assign({ type: MSG.AGENDA_QUICK_REGISTER }, req), cb);
    }
  };
  var vragenlijstActies = {
    onOpenItem: function(index) {
      naarTab({ type: MSG.SURVEY_OPEN_ITEM, index });
    }
  };
  function toon(soort, state) {
    if (!huidig || huidig.soort !== soort) {
      leeg();
      const paneel = soort === "vragenlijst" ? create2(host, vragenlijstActies) : create(host, agendaActies);
      huidig = { soort, paneel };
    }
    huidig.paneel.update(state);
  }
  function meldStand(tabId, open) {
    if (tabId == null) return;
    try {
      chrome.tabs.sendMessage(
        tabId,
        { type: MSG.SIDEPANEL_STATE, open },
        function() {
          void chrome.runtime.lastError;
        }
      );
    } catch (e) {
    }
  }
  function vraagToestand(tabId) {
    if (onsTabId != null && onsTabId !== tabId) meldStand(onsTabId, false);
    onsTabId = tabId;
    meldStand(tabId, true);
    chrome.tabs.sendMessage(tabId, { type: MSG.SURVEY_GET_STATE }, function(res) {
      void chrome.runtime.lastError;
      if (res && res.state) {
        toon("vragenlijst", res.state);
        return;
      }
      chrome.tabs.sendMessage(tabId, { type: MSG.AGENDA_GET_STATE }, function(res2) {
        void chrome.runtime.lastError;
        if (res2 && res2.state) {
          toon("agenda", res2.state);
          return;
        }
        if (!huidig) toonMelding(NIETS_KOP, NIETS_TEKST);
      });
    });
  }
  function zoekOnsTab() {
    try {
      chrome.tabs.query({ url: ONS_URL_PATTERNS }, function(tabs) {
        void chrome.runtime.lastError;
        if (!tabs || !tabs.length) {
          if (onsTabId != null) meldStand(onsTabId, false);
          onsTabId = null;
          toonMelding(
            "Geen ONS-scherm open",
            "Open ONS in een tabblad; de Agendahulp of de vragenlijst-checklist verschijnt hier dan vanzelf."
          );
          return;
        }
        const actief = tabs.find(function(t) {
          return t.active;
        });
        vraagToestand((actief || tabs[0]).id);
      });
    } catch (e) {
      toonMelding("Kon het tabblad niet vinden", "Herlaad het zijpaneel.");
    }
  }
  function onMessage(msg, sender) {
    if (!msg) return;
    const vanTab = sender && sender.tab && sender.tab.id;
    if (vanTab != null && onsTabId != null && vanTab !== onsTabId) return;
    if (vanTab != null) onsTabId = vanTab;
    if (msg.type === MSG.SURVEY_STATE || msg.type === MSG.AGENDA_STATE) annuleerSluiten();
    if (msg.type === MSG.SURVEY_STATE && msg.state) {
      toon("vragenlijst", msg.state);
      return;
    }
    if (msg.type === MSG.AGENDA_RANGE_PROGRESS) {
      if (huidig && huidig.soort === "agenda" && huidig.paneel.setRangeProgress) huidig.paneel.setRangeProgress(msg.done | 0, msg.total | 0);
      return;
    }
    if (msg.type === MSG.AGENDA_STATE && msg.state) {
      if (huidig && huidig.soort === "vragenlijst") return;
      toon("agenda", msg.state);
      return;
    }
    if (msg.type === MSG.SURVEY_GONE) {
      if (huidig && huidig.soort === "vragenlijst") {
        leeg();
        naNavigatie(sender && sender.tab);
      }
      return;
    }
    if (msg.type === MSG.AGENDA_GONE && (!huidig || huidig.soort === "agenda")) {
      toonMelding(NIETS_KOP, NIETS_TEKST);
      naNavigatie(sender && sender.tab);
    }
  }
  chrome.runtime.onMessage.addListener(onMessage);
  var SLUIT_NA_MS = 5e3;
  var mijnVenster = null;
  var sluitTimer = null;
  function annuleerSluiten() {
    if (sluitTimer) {
      clearTimeout(sluitTimer);
      sluitTimer = null;
    }
  }
  function sluitZijpaneel() {
    annuleerSluiten();
    if (onsTabId != null) meldStand(onsTabId, false);
    try {
      if (chrome.sidePanel && typeof chrome.sidePanel.close === "function" && mijnVenster != null) {
        const r = chrome.sidePanel.close({ windowId: mijnVenster });
        if (r && typeof r.catch === "function") r.catch(function() {
          window.close();
        });
        return;
      }
    } catch (e) {
    }
    window.close();
  }
  function naNavigatie(tab) {
    annuleerSluiten();
    if (!tab || !isOnsUrl(tab.url)) {
      sluitZijpaneel();
      return;
    }
    onsTabId = tab.id;
    vraagToestand(tab.id);
    sluitTimer = setTimeout(function() {
      sluitTimer = null;
      chrome.tabs.sendMessage(tab.id, { type: MSG.SURVEY_GET_STATE }, function(res) {
        void chrome.runtime.lastError;
        if (res && res.state) return;
        chrome.tabs.sendMessage(tab.id, { type: MSG.AGENDA_GET_STATE }, function(res2) {
          void chrome.runtime.lastError;
          if (!(res2 && res2.state)) sluitZijpaneel();
        });
      });
    }, SLUIT_NA_MS);
  }
  function inMijnVenster(windowId) {
    return mijnVenster == null || windowId == null || windowId === mijnVenster;
  }
  try {
    chrome.windows.getCurrent(function(w) {
      void chrome.runtime.lastError;
      if (w) mijnVenster = w.id;
    });
  } catch (e) {
  }
  try {
    chrome.tabs.onActivated.addListener(function(info) {
      if (!inMijnVenster(info && info.windowId)) return;
      if (onsTabId != null && onsTabId !== info.tabId) meldStand(onsTabId, false);
      onsTabId = null;
      chrome.tabs.get(info.tabId, function(tab) {
        void chrome.runtime.lastError;
        naNavigatie(tab);
      });
    });
    chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
      if (!tab || !tab.active || !inMijnVenster(tab.windowId)) return;
      if (info && (info.url || info.status === "loading")) naNavigatie(tab);
    });
  } catch (e) {
  }
  try {
    chrome.runtime.connect({ name: SIDEPANEL_PORT });
  } catch (e) {
  }
  zoekOnsTab();
})();
//# sourceMappingURL=sidepanel.js.map
