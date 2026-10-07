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
  var SIDEPANEL_PORT = "agendahulp-sidepanel";

  // src/background/badge.js
  var BADGE_COLOR = "#cc087d";
  function setBadge(count, tabId) {
    const text = count > 0 ? String(count) : "";
    try {
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
      if (tabId != null) chrome.action.setBadgeText({ text, tabId });
      else chrome.action.setBadgeText({ text });
    } catch (e) {
    }
  }

  // src/shared/storage-keys.js
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
  function writeStorage(area, values) {
    return new Promise(function(resolve) {
      try {
        area.set(values, function() {
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  }
  var readLocal = (keys) => readStorage(chrome.storage.local, keys);
  var writeLocal = (values) => writeStorage(chrome.storage.local, values);

  // src/background/snapshot.js
  function sanitizeSnapshot(msg) {
    const num = function(v) {
      return typeof v === "number" && isFinite(v) && v >= 0 ? Math.round(v) : 0;
    };
    let days = [];
    if (Array.isArray(msg.days)) {
      days = msg.days.slice(0, 31).map(function(d) {
        return {
          date: typeof d.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : "",
          client: num(d.client),
          overig: num(d.overig),
          late: num(d.late)
        };
      }).filter(function(d) {
        return d.date;
      });
    }
    return {
      openDays: num(msg.openDays),
      openMinutes: num(msg.openMinutes),
      lateMinutes: num(msg.lateMinutes),
      futureMinutes: num(msg.futureMinutes),
      directPct: typeof msg.directPct === "number" && isFinite(msg.directPct) ? Math.round(msg.directPct) : null,
      normPct: typeof msg.normPct === "number" && isFinite(msg.normPct) ? Math.round(msg.normPct) : null,
      week: num(msg.week) || null,
      days,
      ts: Date.now()
    };
  }
  function saveSnapshot(msg) {
    return writeLocal({ [LOCAL.SNAPSHOT]: sanitizeSnapshot(msg) });
  }
  function loadSnapshot() {
    return readLocal([LOCAL.SNAPSHOT]).then(function(v) {
      return v[LOCAL.SNAPSHOT] || null;
    });
  }

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

  // src/background/reminder.js
  var ALARM_NAME = "onsHelper.reminder";
  var NOTIFICATION_PREFIX = "onsHelper.reminder";
  var WEEK_MINUTES = 7 * 24 * 60;
  var SNAPSHOT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1e3;
  var DEFAULT_SETTINGS = {
    enabled: false,
    // bewust uit: een melding is opdringerig, dus opt-in
    weekday: 5,
    // 1 = maandag … 7 = zondag
    hour: 15,
    minute: 0,
    minOpenDays: 1
    // pas melden vanaf dit aantal openstaande dagen
  };
  function loadSettings() {
    return readLocal([LOCAL.REMINDER_SETTINGS]).then(function(v) {
      const s = v[LOCAL.REMINDER_SETTINGS];
      if (!s || typeof s !== "object") return Object.assign({}, DEFAULT_SETTINGS);
      return Object.assign({}, DEFAULT_SETTINGS, s);
    });
  }
  function updateSettings(msg) {
    return loadSettings().then(function(cur) {
      const next = Object.assign({}, cur);
      if (typeof msg.enabled === "boolean") next.enabled = msg.enabled;
      if (msg.weekday >= 1 && msg.weekday <= 7) next.weekday = msg.weekday | 0;
      if (msg.hour >= 0 && msg.hour <= 23) next.hour = msg.hour | 0;
      if (msg.minute >= 0 && msg.minute <= 59) next.minute = msg.minute | 0;
      return writeLocal({ [LOCAL.REMINDER_SETTINGS]: next }).then(rescheduleAlarm).then(function() {
        return next;
      });
    });
  }
  function nextFireTime(s, from) {
    const now = from || /* @__PURE__ */ new Date();
    const target = new Date(now.getTime());
    target.setHours(s.hour, s.minute, 0, 0);
    const wantDow = s.weekday % 7;
    let delta = (wantDow - target.getDay() + 7) % 7;
    if (delta === 0 && target.getTime() <= now.getTime()) delta = 7;
    target.setDate(target.getDate() + delta);
    return target.getTime();
  }
  function rescheduleAlarm() {
    return loadSettings().then(function(s) {
      try {
        chrome.alarms.clear(ALARM_NAME);
      } catch (e) {
      }
      if (!s.enabled) return;
      try {
        chrome.alarms.create(ALARM_NAME, { when: nextFireTime(s), periodInMinutes: WEEK_MINUTES });
      } catch (e) {
      }
    });
  }
  function fmtHM(min) {
    const m = Math.max(0, Math.round(min));
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return r + " min";
    return r ? h + " u " + r + " min" : h + " uur";
  }
  function reminderText(snap) {
    if (!snap || !snap.ts) return null;
    if (Date.now() - snap.ts > SNAPSHOT_MAX_AGE_MS) return null;
    const regels = [];
    if (snap.openMinutes > 0) {
      regels.push(fmtHM(snap.openMinutes) + " nog niet geregistreerd" + (snap.openDays > 0 ? " (" + snap.openDays + (snap.openDays === 1 ? " dag" : " dagen") + ")" : ""));
    }
    if (snap.lateMinutes > 0) regels.push("waarvan " + fmtHM(snap.lateMinutes) + " langer dan een dag open");
    if (snap.directPct != null) {
      regels.push("Directe tijd: " + snap.directPct + "%" + (snap.normPct != null ? " (norm " + snap.normPct + "%)" : ""));
    }
    if (!regels.length) return null;
    return regels.join("\n");
  }
  function showReminder() {
    return Promise.all([loadSnapshot(), loadSettings()]).then(function(res) {
      const snap = res[0], s = res[1];
      if (!s.enabled) return;
      if (!snap || snap.openDays < s.minOpenDays) return;
      const body = reminderText(snap);
      if (!body) return;
      const stand = new Date(snap.ts);
      try {
        chrome.notifications.create(NOTIFICATION_PREFIX + "." + Date.now(), {
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/icon128.png"),
          title: "ONS Agendahulp — nog te registreren",
          message: body,
          // Eerlijk zijn over de bron: dit is de laatste stand die de hulp zag
          // terwijl de agenda openstond, niet een live meting.
          contextMessage: "Stand van " + stand.toLocaleDateString("nl-NL") + " " + stand.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }),
          priority: 0
        });
      } catch (e) {
      }
    });
  }
  function onNotificationClicked(id) {
    if (String(id).indexOf(NOTIFICATION_PREFIX) !== 0) return;
    try {
      chrome.tabs.query({ url: ONS_URL_PATTERNS }, function(tabs) {
        if (tabs && tabs.length) chrome.tabs.update(tabs[0].id, { active: true });
        chrome.notifications.clear(id);
      });
    } catch (e) {
    }
  }

  // src/background/context-menu.js
  var MENU_ROOT = "onsHelper.register";
  var MENU_PANEL = "onsHelper.panel";
  var MAX_FORMS = 25;
  function buildMenu(forms) {
    return new Promise(function(resolve) {
      try {
        chrome.contextMenus.removeAll(function() {
          const list = Array.isArray(forms) ? forms.filter(function(f) {
            return typeof f === "string" && f.trim();
          }) : [];
          if (list.length) {
            chrome.contextMenus.create({
              id: MENU_ROOT,
              title: "Registreren als…",
              contexts: ["all"],
              documentUrlPatterns: ONS_URL_PATTERNS
            });
            list.slice(0, MAX_FORMS).forEach(function(vorm, i) {
              chrome.contextMenus.create({
                id: MENU_ROOT + "." + i,
                parentId: MENU_ROOT,
                title: vorm,
                contexts: ["all"],
                documentUrlPatterns: ONS_URL_PATTERNS
              });
            });
          }
          chrome.contextMenus.create({
            id: MENU_PANEL,
            title: "Agendahulp in zijpaneel",
            contexts: ["all"],
            documentUrlPatterns: ONS_URL_PATTERNS
          });
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  }
  function rebuildMenuFromStorage() {
    return readLocal([LOCAL.FORMS]).then(function(v) {
      return buildMenu(v[LOCAL.FORMS]);
    });
  }
  function updateForms(rawForms) {
    const forms = Array.isArray(rawForms) ? rawForms.slice(0, MAX_FORMS) : [];
    return readLocal([LOCAL.FORMS]).then(function(v) {
      const was = JSON.stringify(v[LOCAL.FORMS] || []);
      if (was === JSON.stringify(forms)) return;
      return writeLocal({ [LOCAL.FORMS]: forms }).then(function() {
        return buildMenu(forms);
      });
    });
  }
  function onMenuClicked(info, tab) {
    if (!tab || tab.id == null) return;
    if (info.menuItemId === MENU_PANEL) {
      try {
        chrome.sidePanel.open({ tabId: tab.id });
      } catch (e) {
      }
      return;
    }
    const m = /^onsHelper\.register\.(\d+)$/.exec(String(info.menuItemId || ""));
    if (!m) return;
    readLocal([LOCAL.FORMS]).then(function(v) {
      const forms = Array.isArray(v[LOCAL.FORMS]) ? v[LOCAL.FORMS] : [];
      const vorm = forms[parseInt(m[1], 10)];
      if (!vorm) return;
      try {
        chrome.tabs.sendMessage(tab.id, { type: MSG.CTX_REGISTER, vorm });
      } catch (e) {
      }
    });
  }

  // src/background/side-panel.js
  var sidePanelPorts = 0;
  var zijpaneelTab = null;
  function stuurStand(tabId, open) {
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
  function zetZijpaneelTab(tabId) {
    if (zijpaneelTab === tabId) return;
    const vorige = zijpaneelTab;
    zijpaneelTab = tabId;
    if (vorige != null) stuurStand(vorige, false);
    if (tabId != null) stuurStand(tabId, true);
  }
  function verversZijpaneelTab() {
    if (sidePanelPorts === 0) {
      zetZijpaneelTab(null);
      return;
    }
    try {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, function(tabs) {
        void chrome.runtime.lastError;
        const t = tabs && tabs[0];
        zetZijpaneelTab(t && isOnsUrl(t.url) ? t.id : null);
      });
    } catch (e) {
    }
  }
  function onConnect(port) {
    if (!port || port.name !== SIDEPANEL_PORT) return;
    sidePanelPorts++;
    verversZijpaneelTab();
    port.onDisconnect.addListener(function() {
      void chrome.runtime.lastError;
      sidePanelPorts = Math.max(0, sidePanelPorts - 1);
      verversZijpaneelTab();
    });
  }
  function onTabUpdated(tabId, info) {
    if (info && (info.url || info.status === "complete")) verversZijpaneelTab();
  }
  function answerSidePanelQuery(tabId, sendResponse) {
    if (sidePanelPorts === 0 || tabId == null) {
      try {
        sendResponse({ open: false });
      } catch (e) {
      }
      return;
    }
    try {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, function(tabs) {
        void chrome.runtime.lastError;
        const t = tabs && tabs[0];
        try {
          sendResponse({ open: !!(t && t.id === tabId) });
        } catch (e) {
        }
      });
    } catch (e) {
      try {
        sendResponse({ open: false });
      } catch (e2) {
      }
    }
  }
  var OPEN_ANSWER_TIMEOUT_MS = 600;
  function openSidePanel(tabId, sendResponse) {
    let klaar = false;
    const antwoord = function(ok) {
      if (klaar) return;
      klaar = true;
      try {
        sendResponse({ ok });
      } catch (e) {
      }
    };
    try {
      const r = chrome.sidePanel.open({ tabId });
      if (r && typeof r.then === "function") r.then(function() {
        antwoord(true);
      }, function() {
        antwoord(false);
      });
      else antwoord(true);
    } catch (e) {
      antwoord(false);
    }
    setTimeout(function() {
      antwoord(true);
    }, OPEN_ANSWER_TIMEOUT_MS);
  }

  // src/background/index.js
  function onMessage(msg, sender, sendResponse) {
    if (!msg || typeof msg !== "object") return;
    const tabId = sender && sender.tab && sender.tab.id;
    switch (msg.type) {
      case MSG.BADGE:
        setBadge(msg.count | 0, tabId);
        return;
      case MSG.SIDEPANEL_QUERY:
        answerSidePanelQuery(tabId, sendResponse);
        return true;
      case MSG.SUMMARY:
        saveSnapshot(msg);
        return;
      case MSG.FORMS:
        updateForms(msg.forms);
        return;
      case MSG.REMINDER_SETTINGS:
        updateSettings(msg).then(function(next) {
          try {
            sendResponse({ ok: true, settings: next });
          } catch (e) {
          }
        });
        return true;
      case MSG.REMINDER_GET:
        Promise.all([loadSettings(), loadSnapshot()]).then(function(r) {
          try {
            sendResponse({ settings: r[0], snapshot: r[1] });
          } catch (e) {
          }
        });
        return true;
      case MSG.REMINDER_TEST:
        showReminder().then(function() {
          try {
            sendResponse({ ok: true });
          } catch (e) {
          }
        });
        return true;
      case MSG.OPEN_TAB:
        openTab(msg.url, sender && sender.tab, sendResponse);
        return true;
      case MSG.OPEN_SIDE_PANEL:
        if (tabId == null) return;
        openSidePanel(tabId, sendResponse);
        return true;
      // De panelen zenden hun toestand uit naar open extensiepagina's (het
      // zijpaneel); de worker hoeft daar niets mee.
      default:
        return;
    }
  }
  function openTab(url, fromTab, sendResponse) {
    if (typeof url !== "string" || !/^https:\/\//i.test(url)) {
      try {
        sendResponse({ ok: false });
      } catch (e) {
      }
      return;
    }
    const opts = { url, active: true };
    if (fromTab && typeof fromTab.index === "number") opts.index = fromTab.index + 1;
    if (fromTab && fromTab.windowId != null) opts.windowId = fromTab.windowId;
    try {
      chrome.tabs.create(opts, function() {
        const ok = !chrome.runtime.lastError;
        try {
          sendResponse({ ok });
        } catch (e) {
        }
      });
    } catch (e) {
      try {
        sendResponse({ ok: false });
      } catch (e2) {
      }
    }
  }
  chrome.runtime.onMessage.addListener(onMessage);
  chrome.runtime.onConnect.addListener(onConnect);
  chrome.contextMenus.onClicked.addListener(onMenuClicked);
  chrome.alarms.onAlarm.addListener(function(a) {
    if (a && a.name === ALARM_NAME) showReminder();
  });
  chrome.notifications.onClicked.addListener(onNotificationClicked);
  try {
    chrome.tabs.onActivated.addListener(function() {
      verversZijpaneelTab();
    });
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    chrome.windows.onFocusChanged.addListener(function() {
      verversZijpaneelTab();
    });
  } catch (e) {
  }
  chrome.runtime.onInstalled.addListener(function() {
    rebuildMenuFromStorage();
    rescheduleAlarm();
  });
  chrome.runtime.onStartup.addListener(function() {
    rebuildMenuFromStorage();
    rescheduleAlarm();
  });
})();
//# sourceMappingURL=background.js.map
