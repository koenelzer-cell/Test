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
    // afspraak vanuit de planhulp (datum, begintijd, duur; model: velden voor het lege ONS-afspraakmodel)
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
    var NIEUW_PATH = "/calendar/events/new";
    var MODEL_GELDIG_MS = 2 * 60 * 1e3;
    var YMD = /^\d{4}-\d{2}-\d{2}$/, ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
    function klaargezetModel() {
      try {
        var p = JSON.parse(sessionStorage.getItem(PAGE_SESSION.PENDING_APPOINTMENT) || "null");
        if (!p || !p.model || !(Date.now() - p.ts <= MODEL_GELDIG_MS)) return null;
        return p.model;
      } catch (e) {
        return null;
      }
    }
    function isNieuwModel(url, method) {
      if (String(method || "GET").toUpperCase() !== "GET") return false;
      try {
        var abs = new URL(String(url || ""), location.href);
        return abs.origin === location.origin && abs.pathname.replace(/\/$/, "") === NIEUW_PATH;
      } catch (e) {
        return false;
      }
    }
    function vulModel(json, k) {
      var ev = json && typeof json === "object" ? json.event && typeof json.event === "object" ? json.event : json : null;
      if (!ev || !ev.meta || ev.meta.new_record !== true || ev.meta.create_url !== CREATE_PATH) return false;
      var gedaan = false;
      if (ev.valid_from == null && YMD.test(String(k.valid_from || ""))) {
        ev.valid_from = k.valid_from;
        gedaan = true;
      }
      if (ev.start_time == null && ISO.test(String(k.start_time || ""))) {
        ev.start_time = k.start_time;
        gedaan = true;
      }
      if (ev.end_time == null && ISO.test(String(k.end_time || ""))) {
        ev.end_time = k.end_time;
        gedaan = true;
      }
      var l = Array.isArray(k.labels) ? k.labels.filter(function(x) {
        return x && Number(x.id) > 0 && typeof x.name === "string";
      }) : [];
      if (l.length && Array.isArray(ev.labels) && !ev.labels.length) {
        ev.labels = l.map(function(x) {
          return { id: Number(x.id), name: String(x.name) };
        });
        gedaan = true;
      }
      return gedaan;
    }
    function vulTekst(tekst) {
      var k = klaargezetModel();
      if (!k) return tekst;
      try {
        var j = JSON.parse(tekst);
        return vulModel(j, k) ? JSON.stringify(j) : tekst;
      } catch (e) {
        return tekst;
      }
    }
    function vulXhr(xhr, proto) {
      try {
        var rt = Object.getOwnPropertyDescriptor(proto, "responseText");
        var r = Object.getOwnPropertyDescriptor(proto, "response");
        var klaar = null;
        var tekst = function() {
          if (klaar === null) klaar = vulTekst(rt.get.call(xhr));
          return klaar;
        };
        if (rt && rt.get) Object.defineProperty(xhr, "responseText", { configurable: true, get: function() {
          return xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300 ? tekst() : rt.get.call(xhr);
        } });
        if (r && r.get) Object.defineProperty(xhr, "response", { configurable: true, get: function() {
          var v = r.get.call(xhr);
          if (!(xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300)) return v;
          if (typeof v === "string") return tekst();
          if (v && typeof v === "object" && xhr.responseType === "json") {
            var k = klaargezetModel();
            if (k) vulModel(v, k);
          }
          return v;
        } });
      } catch (e) {
      }
    }
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
              if (isNieuwModel(url, method) && klaargezetModel()) {
                return p.then(function(res) {
                  if (!res || !res.ok || !res.clone) return res;
                  return res.clone().text().then(function(t) {
                    var n = vulTekst(t);
                    return n === t ? res : new Response(n, { status: res.status, statusText: res.statusText, headers: res.headers });
                  }, function() {
                    return res;
                  });
                });
              }
            } catch (e) {
            }
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
              if (isNieuwModel(xhr.__onsahUrl, xhr.__onsahMethod) && klaargezetModel()) vulXhr(xhr, XHR.prototype);
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
