(() => {
  // src/shared/messages.js
  var PAGE_BRIDGE = {
    MARKER: "__onsah",
    TO_MAIN: "to-main",
    FROM_MAIN: "from-main"
  };

  // src/shared/storage-keys.js
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

  // src/main-world/index.js
  (function onsAgendahulpMainWorld() {
    if (window.__onsAgendahulpMW) return;
    window.__onsAgendahulpMW = true;
    function post(type, payload) {
      try {
        window.postMessage(Object.assign({ [PAGE_BRIDGE.MARKER]: true, dir: PAGE_BRIDGE.FROM_MAIN, type }, payload || {}), location.origin);
      } catch (e) {
      }
    }
    function onsEnvironment() {
      try {
        return String(location.hostname.split(".")[0] || "");
      } catch (e) {
        return "";
      }
    }
    function detectUserId() {
      try {
        if (window.employeeId) return String(window.employeeId);
      } catch (e) {
      }
      try {
        var el = document.getElementById("altrechtUserId") || document.querySelector('input[name*="user" i][value]');
        if (el && el.value) return String(el.value);
      } catch (e) {
      }
      try {
        var html = document.body ? document.body.innerHTML : "";
        var m = html.match(/"?userId"?\s*[:=]\s*"?(\d{1,10})/i);
        if (m) return m[1];
      } catch (e) {
      }
      return "";
    }
    function announceContext() {
      post("context", { environment: onsEnvironment(), userId: detectUserId(), url: location.href });
    }
    var DETAILS_RE = /\/(?:events|registrations)\/[^/?#]+\/details(?:[?#]|$)/;
    function labelNamesFrom(json) {
      if (!json || typeof json !== "object") return [];
      var body = json;
      var keys = ["data", "event", "occurrence", "registration", "entry"];
      for (var i = 0; i < keys.length; i++) {
        var v = json[keys[i]];
        if (v && typeof v === "object" && !Array.isArray(v)) {
          body = v;
          break;
        }
      }
      if (!Array.isArray(body.labels)) return [];
      return body.labels.map(function(l) {
        return String(l && l.name != null ? l.name : typeof l === "string" ? l : "").trim();
      }).filter(Boolean);
    }
    function reportDetails(url, text) {
      try {
        if (!url || !DETAILS_RE.test(String(url))) return;
        var labels = labelNamesFrom(JSON.parse(text));
        if (labels.length) post("details", { url: String(url), labels });
      } catch (e) {
      }
    }
    var OVERLAP_RE = /\/event_planner\/overlap_detection(?:[?#]|$)/;
    function reportOverlap(url, text) {
      try {
        var abs = new URL(String(url), location.href);
        if (abs.origin !== location.origin) return;
        post("eventOverlap", { url: abs.pathname + abs.search, body: String(text == null ? "" : text).slice(0, 4e3) });
      } catch (e) {
      }
    }
    var CREATE_PATH = "/calendar/events";
    function kopieenKlaar() {
      try {
        return sessionStorage.getItem(PAGE_SESSION.PENDING_DUPLICATES) || "";
      } catch (e) {
        return "";
      }
    }
    function melderVoor(url, method) {
      var u = String(url || "");
      if (DETAILS_RE.test(u)) return reportDetails;
      if (OVERLAP_RE.test(u)) return reportOverlap;
      if (String(method || "GET").toUpperCase() !== "POST") return null;
      try {
        var abs = new URL(u, location.href);
        if (abs.origin !== location.origin || abs.pathname.replace(/\/$/, "") !== CREATE_PATH) return null;
        var klaar = kopieenKlaar();
        return function(url2, text, body) {
          if (typeof body !== "string" || !body) return;
          try {
            var meta = (JSON.parse(body).event || {}).meta, kaal = {};
            if (meta && typeof meta === "object") Object.keys(meta).forEach(function(k) {
              var v = meta[k];
              if (typeof v === "boolean" || v === null || typeof v === "number") kaal[k] = v;
            });
            post("eventMeta", { meta: kaal });
          } catch (e) {
          }
          try {
            if (klaar) post("eventCreated", { body, pending: klaar });
          } catch (e) {
          }
        };
      } catch (e) {
      }
      return null;
    }
    function installDetailsWatcher() {
      try {
        var origFetch = window.fetch;
        if (typeof origFetch === "function") {
          window.fetch = function(input, init) {
            var url = typeof input === "string" ? input : input && (input.url || input.href) || "";
            var method = init && init.method || input && typeof input === "object" && input.method || "GET";
            var body = init && init.body;
            var p = origFetch.apply(this, arguments);
            try {
              var melder = melderVoor(url, method);
              if (melder) {
                p.then(function(res) {
                  try {
                    if (res && res.ok && res.clone) res.clone().text().then(function(t) {
                      melder(url, t, body);
                    }, function() {
                    });
                  } catch (e) {
                  }
                  return res;
                }, function() {
                });
              }
            } catch (e) {
            }
            return p;
          };
        }
      } catch (e) {
      }
      try {
        var XHR = window.XMLHttpRequest;
        if (XHR && XHR.prototype && typeof XHR.prototype.open === "function") {
          var origOpen = XHR.prototype.open;
          XHR.prototype.open = function(method, url) {
            try {
              this.__onsahUrl = url;
              this.__onsahMethod = method;
            } catch (e) {
            }
            return origOpen.apply(this, arguments);
          };
          var origSend = XHR.prototype.send;
          XHR.prototype.send = function(body) {
            try {
              var xhr = this;
              var melder = melderVoor(xhr.__onsahUrl, xhr.__onsahMethod);
              if (melder) {
                xhr.addEventListener("load", function() {
                  try {
                    if (xhr.status >= 200 && xhr.status < 300) melder(xhr.__onsahUrl, xhr.responseText, body);
                  } catch (e) {
                  }
                });
              }
            } catch (e) {
            }
            return origSend.apply(this, arguments);
          };
        }
      } catch (e) {
      }
    }
    installDetailsWatcher();
    var CONTEXT_TRIES = 20, CONTEXT_INTERVAL_MS = 500;
    var tries = 0;
    var timer = setInterval(function() {
      announceContext();
      if (++tries >= CONTEXT_TRIES) clearInterval(timer);
    }, CONTEXT_INTERVAL_MS);
    announceContext();
  })();
})();
//# sourceMappingURL=main-world.js.map
