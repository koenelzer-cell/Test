(() => {
  // src/shared/messages.js
  var PAGE_BRIDGE = {
    MARKER: "__onsah",
    TO_MAIN: "to-main",
    FROM_MAIN: "from-main"
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
    function melderVoor(url) {
      var u = String(url || "");
      if (DETAILS_RE.test(u)) return reportDetails;
      if (OVERLAP_RE.test(u)) return reportOverlap;
      return null;
    }
    function installDetailsWatcher() {
      try {
        var origFetch = window.fetch;
        if (typeof origFetch === "function") {
          window.fetch = function(input, init) {
            var url = typeof input === "string" ? input : input && (input.url || input.href) || "";
            var p = origFetch.apply(this, arguments);
            try {
              var melder = melderVoor(url);
              if (melder) {
                p.then(function(res) {
                  try {
                    if (res && res.ok && res.clone) res.clone().text().then(function(t) {
                      melder(url, t);
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
            } catch (e) {
            }
            return origOpen.apply(this, arguments);
          };
          var origSend = XHR.prototype.send;
          XHR.prototype.send = function() {
            try {
              var xhr = this;
              var melder = melderVoor(xhr.__onsahUrl);
              if (melder) {
                xhr.addEventListener("load", function() {
                  try {
                    if (xhr.status >= 200 && xhr.status < 300) melder(xhr.__onsahUrl, xhr.responseText);
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
