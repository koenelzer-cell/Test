(() => {
  // src/survey/questions.js
  function isSurveyQuestionBlock(el) {
    return !!(el && el.matches && el.matches(surveyQuestionSel()));
  }
  function closestSurveyQuestionBlock(el) {
    return el && el.closest ? el.closest(surveyQuestionSel()) : null;
  }
  function surveyQuestionBlocks(root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(surveyQuestionSel())).filter((el) => !(el.matches && el.matches(".survey_question") && el.querySelector("tr.required")));
  }
  function directText(el) {
    let t = "";
    if (!el) return t;
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.textContent;
    return t;
  }
  function questionLabelRaw(q) {
    let lbl = null;
    if (UI_OVERRIDES.surveyQuestionTextSelector) {
      try {
        lbl = q.querySelector(UI_OVERRIDES.surveyQuestionTextSelector);
      } catch (e) {
      }
    }
    if (!lbl) lbl = q.querySelector(".question-text");
    if (!lbl) return "";
    const info = lbl.querySelector("uc-inline-info");
    return (info && ct(directText(info)) ? directText(info) : directText(lbl)).replace(/\s+/g, " ").trim();
  }
  function questionLabelText(q) {
    return ct(questionLabelRaw(q));
  }
  function respondentWarningText(age, wrongGroups, rule) {
    const groups = Array.isArray(wrongGroups) ? wrongGroups : [];
    if (age == null || !groups.length) return "";
    return "Let op: er is een antwoord ingevuld dat bij deze leeftijd niet nodig is. Controleer of je de juiste leeftijdsversie van de vraag invult.";
  }
  function readableQuestionText(q) {
    const text2 = questionLabelRaw(q);
    return (text2 || "Vraag zonder titel").replace(/\s*antwoord wissen\s*$/i, "").trim();
  }
  function categoryName(root) {
    const doc = root || document;
    const selected = doc.querySelector(".category_navigation li.selected");
    if (selected && ct(selected.textContent)) return selected.textContent.replace(/\s+/g, " ").trim();
    const title = doc.querySelector(".category-title,.mod-status .selected");
    return title && title.textContent ? title.textContent.replace(/\s+/g, " ").trim() : "Vragenlijst";
  }
  function groupName(q, root) {
    const wrap = q.closest && q.closest(".mod-survey-group,fieldset");
    const heading = wrap && wrap.querySelector(".group-header h2.description,.group-header h2,h2.description,legend");
    return heading && ct(heading.textContent) ? heading.textContent.replace(/\s+/g, " ").trim() : categoryName(root);
  }
  function categoryOrderOf(root) {
    const doc = root || document;
    const nav = Array.prototype.slice.call(doc.querySelectorAll(".category_navigation li"));
    if (!nav.length) return 0;
    const idx = nav.findIndex((li) => li.classList && li.classList.contains("selected"));
    return idx >= 0 ? idx : 0;
  }
  function isRequiredQuestion(q, age, rule) {
    if (!q) return false;
    if (rule) {
      const configured = rule.questionsFor ? rule.questionsFor(questionLabelText(q)) : [rule.questionFor(questionLabelText(q))].filter(Boolean);
      const requiredRules = configured.filter((cq) => cq.rule === "vraag_verplicht");
      if (requiredRules.length) return requiredRules.some((cq) => rule.appliesAt(cq, age));
    }
    if (q.classList && q.classList.contains("required")) return true;
    if (q.querySelector('[required],[aria-required="true"]')) return true;
    const props = Array.prototype.slice.call(q.querySelectorAll("[data-props]")).some((el) => /&quot;required&quot;\s*:\s*&quot;required&quot;|"required"\s*:\s*"required"/i.test(el.getAttribute("data-props") || ""));
    if (props) return true;
    return false;
  }
  function questionInactiveByPageCode(q) {
    if (!q) return false;
    if (q.getAttribute("data-ons-helper-rendered-visible") === "false") return true;
    let node = q;
    const group = q.closest && q.closest(".mod-survey-group");
    while (node && node !== group) {
      const style = ct(node.getAttribute && node.getAttribute("style") || "");
      const cls = ct(node.className || "");
      if (node.hasAttribute && node.hasAttribute("hidden") || node.getAttribute && node.getAttribute("aria-hidden") === "true" || /display\s*:\s*none|visibility\s*:\s*hidden/.test(style) || /(^|\s)(hidden|is-hidden|conditionally-hidden|collapsed)(\s|$)/.test(cls)) return true;
      node = node.parentElement;
    }
    if (q.ownerDocument === document) {
      try {
        const style = getComputedStyle(q);
        if (style.display === "none" || style.visibility === "hidden" || q.getClientRects().length === 0) return true;
      } catch (e) {
      }
    }
    return false;
  }
  function isAnswered(q) {
    const radios = Array.prototype.slice.call(q.querySelectorAll('input[type="radio"]:not([disabled])'));
    if (radios.length) {
      const checked = radios.find((r) => r.checked);
      if (!checked || String(checked.value || "").trim() === "") return false;
      const option = checked.closest("div,tr,li,label");
      if (option && option !== q) {
        const dependent = Array.prototype.slice.call(option.querySelectorAll('textarea:not([disabled]),select:not([disabled]),input:not([disabled]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"])'));
        if (dependent.length && !dependent.some((el) => String(el.value == null ? "" : el.value).trim() !== "")) return false;
      }
      return true;
    }
    const checks = Array.prototype.slice.call(q.querySelectorAll('input[type="checkbox"]:not([disabled])'));
    if (checks.length) return checks.some((el) => el.checked);
    const selects = Array.prototype.slice.call(q.querySelectorAll("select:not([disabled])"));
    if (selects.length) return selects.some((el) => String(el.value || "").trim() !== "");
    const fields = Array.prototype.slice.call(q.querySelectorAll('textarea:not([disabled]),input:not([disabled]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"])'));
    if (fields.length) return fields.some((field) => {
      const type = ct(field.getAttribute("type") || field.type || "text");
      if (type === "file") return !!(field.files && field.files.length || String(field.value || "").trim());
      return String(field.value == null ? "" : field.value).trim() !== "";
    });
    const editable = q.querySelector('[contenteditable="true"]');
    if (editable) return ct(editable.textContent || "") !== "";
    const reactInputs = Array.prototype.slice.call(q.querySelectorAll("[data-react-component][data-props]"));
    if (reactInputs.length) {
      const hasMeaningfulValue = (value) => {
        if (value == null) return false;
        if (typeof value === "string") return value.trim() !== "";
        if (typeof value === "number" || typeof value === "boolean") return true;
        if (Array.isArray(value)) return value.some(hasMeaningfulValue);
        if (typeof value === "object") return Object.keys(value).some((key) => hasMeaningfulValue(value[key]));
        return false;
      };
      let recognized = false;
      for (const host of reactInputs) {
        let props = null;
        try {
          props = JSON.parse(host.getAttribute("data-props") || "{}");
        } catch (e) {
          props = null;
        }
        if (!props) continue;
        for (const key of ["defaultValue", "value", "answer", "selectedValue", "selectedValues"]) {
          if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
          recognized = true;
          if (hasMeaningfulValue(props[key])) return true;
        }
      }
      if (recognized) return false;
    }
    const custom = Array.prototype.slice.call(q.querySelectorAll('uc-select,uc-input,uc-textarea,[role="combobox"],[role="slider"],[aria-selected],[aria-checked]'));
    if (custom.length) return custom.some((el) => {
      const ariaChecked = el.getAttribute && el.getAttribute("aria-checked");
      const ariaSelected = el.getAttribute && el.getAttribute("aria-selected");
      if (ariaChecked === "true" || ariaSelected === "true") return true;
      const value = ("value" in el ? el.value : null) || el.getAttribute && (el.getAttribute("value") || el.getAttribute("data-value"));
      return String(value == null ? "" : value).trim() !== "";
    });
    return true;
  }
  function hasRecognizedControl(q) {
    if (!q || !q.querySelector) return false;
    return !!q.querySelector(
      'input[type="radio"]:not([disabled]),input[type="checkbox"]:not([disabled]),select:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]),[contenteditable="true"],[data-react-component][data-props],uc-select,uc-input,uc-textarea,[role="combobox"],[role="slider"],[aria-selected],[aria-checked]'
    );
  }

  // src/survey/page.js
  var SAVE_SEL = '[data-action="save-survey"]';
  var _NEXT_STATUS_DEFAULT = 'button[title="Volgende status"],button[aria-label="Volgende status"]';
  var nextStatusSel = () => UI_OVERRIDES.surveyNextStatusSelector || _NEXT_STATUS_DEFAULT;
  var ct = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  function saveButtons() {
    return Array.prototype.slice.call(document.querySelectorAll(SAVE_SEL)).filter((el) => ct(el.textContent || el.value || "") === "opslaan");
  }
  var _SURVEY_QUESTION_DEFAULT = ".survey_question,tr.required";
  var surveyQuestionSel = () => UI_OVERRIDES.surveyQuestionSelector || _SURVEY_QUESTION_DEFAULT;
  var SURVEY_RESPONSE_SEL = ".survey_question input,.survey_question textarea,.survey_question select,tr.required input,tr.required textarea,tr.required select";
  var SURVEY_VALUE_FIELD_SEL = '.survey_question input[type="text"],.survey_question input[type="number"],.survey_question textarea,.survey_question select,tr.required input[type="text"],tr.required input[type="number"],tr.required textarea,tr.required select';
  function isSurveyEditUrl(rawUrl) {
    try {
      const url = new URL(rawUrl || location.href, location.origin);
      return /\/survey_results\/[^/]+\/categories\/[^/]+\/edit\/?$/.test(url.pathname);
    } catch (e) {
      return /\/survey_results\/[^/]+\/categories\/[^/]+\/edit\/?$/.test(String(rawUrl || location.href).split(/[?#]/)[0]);
    }
  }
  function isSurveyPage() {
    return isSurveyEditUrl(location.href) || saveButtons().length > 0 && surveyQuestionBlocks().length > 0;
  }

  // src/survey/survey-identity.js
  var VIRTUAL_RULE = {
    questionsFor: (text2) => configQuestionsForText(text2),
    questionFor: (text2) => configQuestionForText(text2),
    appliesAt: (cq, age) => ageSatisfies(age, cq),
    // Is er binnen dezelfde vragenlijst nóg een geconfigureerde vraag die bij
    // deze leeftijd wél hoort? (voor de "verkeerde leeftijdsversie"-waarschuwing)
    hasApplicableSibling: (age, cq) => allConfigQuestions().some((q) => q !== cq && q.rule === "vraag_verplicht" && q.surveyName === (cq && cq.surveyName) && ageSatisfies(age, q)),
    // Legacy-shims (voor het geval iets nog naar de oude interface verwijst):
    groupOf: (text2) => {
      const cq = configQuestionForText(text2);
      return cq ? cq.key : null;
    },
    expectedGroupForAge: () => null,
    ageThreshold: 0,
    warningFor: () => ""
  };
  function surveyTitleOf(root) {
    const doc = root || document;
    const header = doc.querySelector('[data-react-component="SurveyResultHeader"][data-props]');
    if (header) {
      try {
        const props = JSON.parse(header.getAttribute("data-props") || "{}");
        if (props && ct(props.title)) return String(props.title).replace(/\s+/g, " ").trim();
      } catch (e) {
      }
    }
    const editTitle = doc.querySelector(".mod-status .index h2[title],.mod-status h2[title]");
    if (editTitle) {
      const title = editTitle.getAttribute("title") || editTitle.textContent || "";
      if (ct(title)) return title.replace(/\s+/g, " ").trim();
    }
    const visibleTitle = doc.querySelector(UI_OVERRIDES.surveyTitleSelector || '.mod-survey-result-header h1.ivy-title,[data-react-component="SurveyResultHeader"] h1.ivy-title');
    return visibleTitle && visibleTitle.textContent ? visibleTitle.textContent.replace(/\s+/g, " ").trim() : "";
  }
  function configSurveyByTitle(root) {
    if (!CONFIG_SURVEYS.length) return null;
    const t = ctLower(surveyTitleOf(root));
    if (!t) return null;
    return CONFIG_SURVEYS.find((s) => s.nameLc && (t === s.nameLc || t.indexOf(s.nameLc) !== -1 || s.nameLc.indexOf(t) !== -1)) || null;
  }
  function respondentRuleFor(root) {
    if (!CONFIG_SURVEYS.length) return null;
    if (configSurveyByTitle(root)) return VIRTUAL_RULE;
    let anyMatch = false;
    try {
      anyMatch = surveyQuestionBlocks(root || document).some((q) => configQuestionsForText(questionLabelText(q)).length);
    } catch (e) {
      anyMatch = false;
    }
    return anyMatch ? VIRTUAL_RULE : null;
  }
  function isJgOutcomeSurvey(root) {
    return !!respondentRuleFor(root);
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
    // afspraak vanuit de planhulp (datum, begintijd, duur; model: velden voor het lege ONS-afspraakmodel; uursoorten: { clientId, hourTypeId, name } per cliënt)
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

  // src/survey/state.js
  var PANEL_W_KEY = PAGE_LOCAL.SURVEY_PANEL_WIDTH;
  var PANEL_MIN = 260;
  var PANEL_MAX = 900;
  var surveyState = {
    listenersAttached: false,
    // klik-/invoerlisteners al gekoppeld (attach)
    bannerEl: null,
    // het paneel in de pagina, of null
    _raf: 0,
    // ingeplande refresh (requestAnimationFrame)
    docked: false,
    // paneel rechts vastgezet, pagina ingeschoven
    PANEL_W: 380,
    // breedte van het paneel (px), onthouden in localStorage
    // Achtergrondcontrole van alle categorieën vóór "Volgende status"
    statusAuditPromise: null,
    statusAuditPage: "",
    statusAuditAge: null,
    // (#3) Wanneer de controle "Volgende status" blokkeert, onthouden we de knop
    // zodat de checklist een expliciete "Toch doorgaan"-noodknop kan tonen.
    _pendingOverrideBtn: null,
    statusCheckBusy: false,
    checklistAuditStarted: false,
    requiredNotificationSeen: false,
    // Koppeling met het zijpaneel
    _laatsteChecklist: null,
    // laatst getekende checklist
    _zijpaneelOpen: false,
    _checklistSig: ""
    // laatst uitgezonden checklist (alleen bij wijziging zenden)
  };
  var PENDING_QUESTION_KEY = PAGE_SESSION.PENDING_SURVEY_QUESTION;
  var CHECKLIST_KEY = PAGE_SESSION.SURVEY_CHECKLIST;
  var CHECKLIST_SCHEMA = 21;
  var CATEGORY_URLS_KEY = PAGE_SESSION.SURVEY_CATEGORY_URLS;
  var CATEGORY_AUDIT_CACHE_KEY = PAGE_SESSION.SURVEY_AUDIT_CACHE;
  var AUDIT_RESUME_KEY = PAGE_SESSION.SURVEY_AUDIT_RESUME;
  var AUDIT_RESUME_PARAM = "ons_helper_resume";
  var statusBypass = /* @__PURE__ */ new WeakSet();

  // src/survey/evaluate.js
  function evaluate(root, ageOverride, sourceUrl) {
    const doc = root || document;
    const age = ageOverride === void 0 ? clientAgeYears() : ageOverride;
    const items = [];
    const missing = [];
    const signals = [];
    const wrongRespondentGroups = /* @__PURE__ */ new Set();
    const rule = respondentRuleFor(doc);
    const catOrder = categoryOrderOf(doc);
    let qIndex = -1;
    for (const q of surveyQuestionBlocks(doc)) {
      qIndex++;
      const configuredQuestions = rule ? rule.questionsFor ? rule.questionsFor(questionLabelText(q)) : [rule.questionFor(questionLabelText(q))].filter(Boolean) : [];
      if (rule && age != null) {
        configuredQuestions.filter((cq) => cq.rule === "vraag_verplicht").forEach((cq) => {
          if (!rule.appliesAt(cq, age) && isAnswered(q) && rule.hasApplicableSibling(age, cq)) wrongRespondentGroups.add(cq.key);
        });
      }
      configuredQuestions.filter((cq) => cq.rule === "signaal_tonen" && rule.appliesAt(cq, age) && !questionInactiveByPageCode(q) && cq.signal && cq.signal.text).forEach((cq) => signals.push({ question: readableQuestionText(q), signal: cq.signal, key: cq.key }));
      if (questionInactiveByPageCode(q) || !isRequiredQuestion(q, age, rule)) continue;
      const recognized = hasRecognizedControl(q);
      const unknown = !recognized;
      const done = recognized ? isAnswered(q) : false;
      const label = q.querySelector(".question-text[for]");
      const labelFor = label && label.getAttribute("for") || "";
      const control = q.querySelector('textarea[id],select[id],input[id]:not([type="hidden"]),[contenteditable="true"][id]');
      let reactId = "";
      if (!control) {
        const reactHost = q.querySelector("[data-react-component][data-props]");
        if (reactHost) {
          try {
            reactId = JSON.parse(reactHost.getAttribute("data-props") || "{}").id || "";
          } catch (e) {
          }
        }
      }
      const anchorId = q.id || labelFor || control && control.id || reactId;
      const baseUrl = sourceUrl || location.href;
      let href = baseUrl;
      try {
        const u = new URL(baseUrl, location.origin);
        u.hash = anchorId ? "#" + anchorId : "";
        href = u.href;
      } catch (e) {
      }
      const item = {
        element: doc === document ? q : null,
        category: categoryName(doc),
        group: groupName(q, doc),
        question: readableQuestionText(q),
        href,
        anchorId,
        // Sorteersleutel: categorievolgorde, dan positie binnen de categorie.
        order: catOrder * 1e5 + qIndex,
        done,
        unknown
      };
      items.push(item);
      if (!done) missing.push(item);
    }
    const wrongGroups = Array.from(wrongRespondentGroups);
    const respondentWarning = respondentWarningText(age, wrongGroups, rule);
    return { age, items, missing, signals, wrongRespondentGroups: wrongGroups, respondentWarning, blocked: missing.length > 0 || !!respondentWarning };
  }

  // src/survey/category-audit.js
  function surveyEditUrlFromOverview() {
    const host = document.querySelector('[data-react-component="SurveyResultHeader"][data-props]');
    if (!host) return null;
    try {
      const props = JSON.parse(host.getAttribute("data-props") || "{}");
      return props && props.actions && props.actions.edit && props.actions.edit.path || null;
    } catch (e) {
      return null;
    }
  }
  function absoluteSurveyUrl(path) {
    try {
      return new URL(path, location.origin).href;
    } catch (e) {
      return null;
    }
  }
  function normalizedSurveyUrl(path) {
    try {
      const url = new URL(path, location.origin);
      url.hash = "";
      url.searchParams.delete("ons_helper_focus");
      url.searchParams.delete(AUDIT_RESUME_PARAM);
      return url.href;
    } catch (e) {
      return null;
    }
  }
  function categoryEditUrls(doc, firstUrl) {
    const urls = /* @__PURE__ */ new Set();
    const normalizedFirst = normalizedSurveyUrl(firstUrl);
    if (normalizedFirst) urls.add(normalizedFirst);
    for (const el of Array.prototype.slice.call(doc.querySelectorAll('[data-action="save-survey"][data-redirect]'))) {
      const url = normalizedSurveyUrl(el.getAttribute("data-redirect"));
      if (url && isSurveyEditUrl(url)) urls.add(url);
    }
    return Array.from(urls);
  }
  function surveyResultId(url) {
    const m = String(url || location.href).match(/\/survey_results\/(\d+)/);
    return m ? m[1] : null;
  }
  function rememberCategoryUrls(urls, resultId) {
    const id = resultId || surveyResultId();
    if (!id || !urls || !urls.length) return;
    try {
      const current = JSON.parse(sessionStorage.getItem(CATEGORY_URLS_KEY + id) || "[]");
      const merged = Array.from(new Set(current.concat(urls).map(normalizedSurveyUrl).filter(Boolean)));
      sessionStorage.setItem(CATEGORY_URLS_KEY + id, JSON.stringify(merged));
    } catch (e) {
    }
  }
  function rememberedCategoryUrls(resultId) {
    if (!resultId) return [];
    try {
      return Array.from(new Set(JSON.parse(sessionStorage.getItem(CATEGORY_URLS_KEY + resultId) || "[]").map(normalizedSurveyUrl).filter((url) => url && isSurveyEditUrl(url))));
    } catch (e) {
      return [];
    }
  }
  async function fetchSurveyDocument(url) {
    const response = await fetch(url, { credentials: "same-origin", headers: { Accept: "text/html" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return new DOMParser().parseFromString(await response.text(), "text/html");
  }
  function categoryResourceVersion(doc) {
    const field = doc && doc.querySelector && doc.querySelector('#resource-version,[name="resource_version"]');
    return field ? String(field.value || field.getAttribute("value") || "").trim() : "";
  }
  function categoryAuditCacheId(url, resourceVersion, age) {
    if (!resourceVersion) return "";
    let normalized = String(url || "");
    try {
      const parsed = new URL(normalized, location.origin);
      parsed.hash = "";
      parsed.searchParams.delete("ons_helper_focus");
      parsed.searchParams.delete(AUDIT_RESUME_PARAM);
      normalized = parsed.href;
    } catch (e) {
    }
    return [CHECKLIST_SCHEMA, normalized, resourceVersion, age == null ? "unknown" : age].join("|");
  }
  function readCategoryAuditCache(url, resourceVersion, age) {
    const id = categoryAuditCacheId(url, resourceVersion, age);
    if (!id) return null;
    try {
      const all = JSON.parse(sessionStorage.getItem(CATEGORY_AUDIT_CACHE_KEY) || "{}");
      const entry = all[id];
      if (!entry || !entry.ts || Date.now() - entry.ts > 30 * 60 * 1e3 || !entry.result) return null;
      return entry.result;
    } catch (e) {
      return null;
    }
  }
  function writeCategoryAuditCache(url, resourceVersion, age, result) {
    const id = categoryAuditCacheId(url, resourceVersion, age);
    if (!id || !result) return;
    try {
      const all = JSON.parse(sessionStorage.getItem(CATEGORY_AUDIT_CACHE_KEY) || "{}");
      all[id] = {
        ts: Date.now(),
        result: {
          items: (result.items || []).map((item) => Object.assign({}, item, { element: null })),
          missing: (result.missing || []).map((item) => Object.assign({}, item, { element: null })),
          wrongRespondentGroups: result.wrongRespondentGroups || []
        }
      };
      const keys = Object.keys(all).sort((a, b) => (all[b].ts || 0) - (all[a].ts || 0));
      for (const old of keys.slice(24)) delete all[old];
      sessionStorage.setItem(CATEGORY_AUDIT_CACHE_KEY, JSON.stringify(all));
    } catch (e) {
    }
  }
  function renderedSurveyState(doc, win) {
    const questions = surveyQuestionBlocks(doc);
    const answerParts = [];
    const visibilityParts = [];
    let filled = 0, hasAnsweredChoice = false;
    for (let qIndex = 0; qIndex < questions.length; qIndex++) {
      const q = questions[qIndex];
      let visible = true;
      try {
        const style = win.getComputedStyle(q);
        visible = style.display !== "none" && style.visibility !== "hidden" && q.getClientRects().length > 0;
      } catch (e) {
      }
      visibilityParts.push(qIndex + ":" + (visible ? "1" : "0") + ":" + (q.disabled ? "1" : "0"));
      const fields = Array.prototype.slice.call(q.querySelectorAll('input,textarea,select,[contenteditable="true"],[aria-checked],[aria-selected]'));
      for (let fIndex = 0; fIndex < fields.length; fIndex++) {
        const field = fields[fIndex];
        const type = ct(field.getAttribute && field.getAttribute("type") || field.tagName || "");
        const value = String(("value" in field ? field.value : null) ?? (field.textContent || "")).trim();
        const checked = !!field.checked || field.getAttribute && (field.getAttribute("aria-checked") === "true" || field.getAttribute("aria-selected") === "true");
        answerParts.push([qIndex, fIndex, type, checked ? "1" : "0", value, field.disabled ? "1" : "0"].join(":"));
        if ((type === "radio" || type === "checkbox") && checked && value !== "") {
          filled++;
          hasAnsweredChoice = true;
        } else if (field.tagName === "SELECT" && value !== "") {
          filled++;
          hasAnsweredChoice = true;
        } else if (type !== "radio" && type !== "checkbox" && value !== "") filled++;
      }
      for (const host of Array.prototype.slice.call(q.querySelectorAll("[data-react-component][data-props]"))) {
        answerParts.push("react:" + qIndex + ":" + (host.getAttribute("data-props") || ""));
      }
    }
    const form = doc.querySelector("[data-number-of-react-inputs]");
    const expectedRaw = form && parseInt(form.getAttribute("data-number-of-react-inputs"), 10);
    const expectedReact = Number.isFinite(expectedRaw) ? expectedRaw : null;
    const mountedReact = (form || doc).querySelectorAll("[data-react-component][data-props]").length;
    const responseCount = doc.querySelectorAll(SURVEY_RESPONSE_SEL).length;
    const reactReady = expectedReact == null ? responseCount > 0 || mountedReact > 0 : mountedReact >= expectedReact;
    return {
      questions,
      answerSignature: answerParts.join("|"),
      visibilitySignature: visibilityParts.join("|"),
      filled,
      hasAnsweredChoice,
      reactReady,
      expectedReact,
      mountedReact,
      responseCount
    };
  }
  async function loadRenderedSurveyMissing(url, age) {
    try {
      return await new Promise((resolve, reject) => {
        const frame = document.createElement("iframe");
        frame.name = "ons-helper-survey-scan";
        Object.assign(frame.style, {
          position: "fixed",
          left: "-12000px",
          top: "0",
          width: "1200px",
          height: "900px",
          opacity: "0",
          pointerEvents: "none",
          border: "0",
          zIndex: "-1"
        });
        let finished = false, poll = null, observer = null, timeout = null;
        const started = Date.now();
        const finish = (err, result) => {
          if (finished) return;
          finished = true;
          if (poll) clearInterval(poll);
          if (observer) observer.disconnect();
          if (timeout) clearTimeout(timeout);
          try {
            frame.remove();
          } catch (e) {
          }
          if (err) reject(err);
          else resolve({
            url,
            items: result.items || [],
            missing: result.missing || [],
            wrongRespondentGroups: result.wrongRespondentGroups || []
          });
        };
        timeout = setTimeout(() => finish(new Error("Gerenderde vragenlijst timeout")), 6500);
        const complete = (doc, resourceVersion) => {
          try {
            const win = frame.contentWindow;
            for (const q of surveyQuestionBlocks(doc)) {
              let active = true;
              try {
                const style = win.getComputedStyle(q);
                active = style.display !== "none" && style.visibility !== "hidden" && q.getClientRects().length > 0;
              } catch (e) {
              }
              q.setAttribute("data-ons-helper-rendered-visible", active ? "true" : "false");
            }
            const result = evaluate(doc, age, url);
            writeCategoryAuditCache(url, resourceVersion || categoryResourceVersion(doc), age, result);
            finish(null, result);
          } catch (e) {
            finish(e);
          }
        };
        frame.onload = () => {
          let initialDoc = null;
          try {
            initialDoc = frame.contentDocument;
          } catch (e) {
          }
          const resourceVersion = categoryResourceVersion(initialDoc);
          const cached = readCategoryAuditCache(url, resourceVersion, age);
          if (cached) {
            finish(null, cached);
            return;
          }
          let lastAnswerSignature = null, lastVisibilitySignature = null;
          let lastAnswerChangeAt = started, lastVisibilityChangeAt = started;
          let lastRelevantMutationAt = started, firstReadyAt = 0;
          try {
            const mutationRoot = initialDoc.querySelector("[data-survey-input-form],form.edit_survey_result") || initialDoc.body;
            const FrameMutationObserver = frame.contentWindow.MutationObserver || MutationObserver;
            observer = new FrameMutationObserver(() => {
              lastRelevantMutationAt = Date.now();
            });
            observer.observe(mutationRoot, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ["class", "style", "hidden", "aria-hidden", "disabled", "checked", "value", "aria-checked", "aria-selected"]
            });
          } catch (e) {
          }
          poll = setInterval(() => {
            let doc = null;
            try {
              doc = frame.contentDocument;
            } catch (e) {
            }
            if (!doc || !surveyQuestionBlocks(doc).length) return;
            const now = Date.now();
            const elapsed = now - started;
            const state = renderedSurveyState(doc, frame.contentWindow);
            if (state.answerSignature !== lastAnswerSignature) {
              lastAnswerSignature = state.answerSignature;
              lastAnswerChangeAt = now;
            }
            if (state.visibilitySignature !== lastVisibilitySignature) {
              lastVisibilitySignature = state.visibilitySignature;
              lastVisibilityChangeAt = now;
            }
            const ready = state.reactReady || elapsed > 1800 && doc.readyState !== "loading";
            if (!ready) {
              if (elapsed > 5200) complete(doc, resourceVersion);
              return;
            }
            if (!firstReadyAt) firstReadyAt = now;
            const answerQuiet = state.hasAnsweredChoice ? 1400 : 450;
            const visibilityQuiet = state.hasAnsweredChoice ? 450 : 350;
            const stable2 = now - lastAnswerChangeAt >= answerQuiet && now - lastVisibilityChangeAt >= visibilityQuiet && now - lastRelevantMutationAt >= 250 && now - firstReadyAt >= 250;
            if (stable2 || elapsed > 5200) complete(doc, resourceVersion);
          }, 100);
          return;
          let lastSig = "", stable = 0, everFilled = false, lastChangeAt = Date.now();
          poll = setInterval(() => {
            let doc = null;
            try {
              doc = frame.contentDocument;
            } catch (e) {
            }
            if (!doc || !surveyQuestionBlocks(doc).length) return;
            let filled = 0;
            try {
              for (const f of doc.querySelectorAll('.survey_question input:checked,tr.required input:checked,.survey_question [aria-checked="true"],tr.required [aria-checked="true"]')) {
                if (String(f.value == null ? "" : f.value).trim() !== "") filled++;
              }
              for (const f of doc.querySelectorAll(SURVEY_VALUE_FIELD_SEL)) {
                if (String(f.value == null ? "" : f.value).trim() !== "") filled++;
              }
            } catch (e) {
            }
            if (filled > 0) everFilled = true;
            const questions = surveyQuestionBlocks(doc);
            let visibleQ = 0, hiddenQ = 0;
            try {
              for (const q of questions) {
                if (q.getClientRects().length > 0) visibleQ++;
                else hiddenQ++;
              }
            } catch (e) {
            }
            const sig = [
              questions.length,
              doc.querySelectorAll(SURVEY_RESPONSE_SEL).length,
              hiddenQ,
              filled,
              visibleQ
            ].join("|");
            if (sig === lastSig) stable++;
            else {
              stable = 0;
              lastSig = sig;
              lastChangeAt = Date.now();
            }
            const elapsed = Date.now() - started;
            const settledFor = Date.now() - lastChangeAt;
            if (everFilled && elapsed > 1500 && settledFor > 1200 && stable >= 8 || elapsed > 5200) complete(doc);
          }, 120);
        };
        frame.onerror = () => {
          clearTimeout(timeout);
          finish(new Error("Gerenderde vragenlijst laden mislukt"));
        };
        frame.src = url;
        (document.body || document.documentElement).appendChild(frame);
      });
    } catch (e) {
      const doc = await fetchSurveyDocument(url);
      const evaluated = evaluate(doc, age, url);
      return {
        url,
        items: evaluated.items,
        missing: evaluated.missing,
        wrongRespondentGroups: evaluated.wrongRespondentGroups || []
      };
    }
  }
  async function evaluateAllSurveyCategories(ageOverride, onProgress) {
    const runAll = (list, ag) => {
      let done = 0;
      const total = list.length;
      if (onProgress) {
        try {
          onProgress(0, total);
        } catch (e) {
        }
      }
      return Promise.all(list.map((url) => loadRenderedSurveyMissing(url, ag).then((r) => {
        done++;
        if (onProgress) {
          try {
            onProgress(done, total);
          } catch (e) {
          }
        }
        return r;
      })));
    };
    const onCategoryPage = isSurveyEditUrl(location.href);
    const firstUrl = absoluteSurveyUrl(surveyEditUrlFromOverview()) || (onCategoryPage ? absoluteSurveyUrl(location.href) : null);
    const resultId = surveyResultId(firstUrl || location.href);
    const age = ageOverride === void 0 ? clientAgeYears() : ageOverride;
    let urls = rememberedCategoryUrls(resultId);
    if (onCategoryPage) {
      const cur = normalizedSurveyUrl(location.href);
      if (cur && urls.indexOf(cur) === -1) urls = urls.concat([cur]);
    }
    let results;
    if (urls.length > 1) {
      results = await runAll(urls, age);
    } else {
      const base = urls[0] || firstUrl;
      if (!base) throw new Error("Geen vragenlijst-URL gevonden");
      const firstDoc = await fetchSurveyDocument(base);
      const discovered = categoryEditUrls(firstDoc, base);
      urls = discovered.length ? discovered : [base];
      rememberCategoryUrls(urls, resultId);
      results = await runAll(urls, age);
    }
    const items = [];
    const missing = [];
    const seen = /* @__PURE__ */ new Set();
    const wrongRespondentGroups = /* @__PURE__ */ new Set();
    for (const res of results) {
      for (const group of res.wrongRespondentGroups || []) wrongRespondentGroups.add(group);
      for (const item of res.items || res.missing || []) {
        const key = [item.href, item.question].join("||");
        if (!seen.has(key)) {
          seen.add(key);
          items.push(item);
          if (!item.done) missing.push(item);
        }
      }
    }
    const wrongGroups = Array.from(wrongRespondentGroups);
    const respondentWarning = respondentWarningText(age, wrongGroups);
    return { age, items, missing, wrongRespondentGroups: wrongGroups, respondentWarning, blocked: missing.length > 0 || !!respondentWarning };
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

  // node_modules/dompurify/dist/purify.es.mjs
  function _OverloadYield(e, d) {
    this.v = e, this.k = d;
  }
  function _arrayLikeToArray(r, a) {
    (null == a || a > r.length) && (a = r.length);
    for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
    return n;
  }
  function _arrayWithHoles(r) {
    if (Array.isArray(r)) return r;
  }
  function _iterableToArrayLimit(r, l) {
    var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (null != t) {
      var e, n, i, u, a = [], f = true, o = false;
      try {
        if (i = (t = t.call(r)).next, 0 === l) {
          if (Object(t) !== t) return;
          f = false;
        } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true) ;
      } catch (r2) {
        o = true, n = r2;
      } finally {
        try {
          if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
        } finally {
          if (o) throw n;
        }
      }
      return a;
    }
  }
  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  function _slicedToArray(r, e) {
    return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
  }
  function _unsupportedIterableToArray(r, a) {
    if (r) {
      if ("string" == typeof r) return _arrayLikeToArray(r, a);
      var t = {}.toString.call(r).slice(8, -1);
      return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
    }
  }
  function AsyncGenerator(e) {
    var t, n;
    function resume(t2, n2) {
      try {
        var r = e[t2](n2), o = r.value, u = o instanceof _OverloadYield;
        Promise.resolve(u ? o.v : o).then(function(n3) {
          if (u) {
            var i = "return" === t2 && o.k ? t2 : "next";
            if (!o.k || n3.done) return resume(i, n3);
            n3 = e[i](n3).value;
          }
          settle(!!r.done, n3);
        }, function(e2) {
          resume("throw", e2);
        });
      } catch (e2) {
        settle(2, e2);
      }
    }
    function settle(e2, r) {
      2 === e2 ? t.reject(r) : t.resolve({
        value: r,
        done: e2
      }), (t = t.next) ? resume(t.key, t.arg) : n = null;
    }
    this._invoke = function(e2, r) {
      return new Promise(function(o, u) {
        var i = {
          key: e2,
          arg: r,
          resolve: o,
          reject: u,
          next: null
        };
        n ? n = n.next = i : (t = n = i, resume(e2, r));
      });
    }, "function" != typeof e.return && (this.return = void 0);
  }
  AsyncGenerator.prototype["function" == typeof Symbol && Symbol.asyncIterator || "@@asyncIterator"] = function() {
    return this;
  }, AsyncGenerator.prototype.next = function(e) {
    return this._invoke("next", e);
  }, AsyncGenerator.prototype.throw = function(e) {
    return this._invoke("throw", e);
  }, AsyncGenerator.prototype.return = function(e) {
    return this._invoke("return", e);
  };
  var entries = Object.entries;
  var setPrototypeOf = Object.setPrototypeOf;
  var isFrozen = Object.isFrozen;
  var getPrototypeOf = Object.getPrototypeOf;
  var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  var freeze = Object.freeze;
  var seal = Object.seal;
  var create = Object.create;
  var _ref = typeof Reflect !== "undefined" && Reflect;
  var apply = _ref.apply;
  var construct = _ref.construct;
  if (!freeze) freeze = function freeze2(x) {
    return x;
  };
  if (!seal) seal = function seal2(x) {
    return x;
  };
  if (!apply) apply = function apply2(func, thisArg) {
    for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
    return func.apply(thisArg, args);
  };
  if (!construct) construct = function construct2(Func) {
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) args[_key2 - 1] = arguments[_key2];
    return new Func(...args);
  };
  var arrayForEach = unapply(Array.prototype.forEach);
  Array.prototype.indexOf;
  var arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
  var arrayPop = unapply(Array.prototype.pop);
  var arrayPush = unapply(Array.prototype.push);
  var arraySlice = unapply(Array.prototype.slice);
  var arraySplice = unapply(Array.prototype.splice);
  var arrayIsArray = Array.isArray;
  var setCreate = unconstruct(Set);
  var setAdd = unapply(Set.prototype.add);
  var setHas = unapply(Set.prototype.has);
  var stringToLowerCase = unapply(String.prototype.toLowerCase);
  var stringToString = unapply(String.prototype.toString);
  var stringMatch = unapply(String.prototype.match);
  var stringReplace = unapply(String.prototype.replace);
  var stringIndexOf = unapply(String.prototype.indexOf);
  var stringTrim = unapply(String.prototype.trim);
  var numberToString = unapply(Number.prototype.toString);
  var booleanToString = unapply(Boolean.prototype.toString);
  var bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
  var symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
  var objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
  var objectToString = unapply(Object.prototype.toString);
  var regExpTest = unapply(RegExp.prototype.test);
  var typeErrorCreate = unconstruct(TypeError);
  function unapply(func) {
    return function(thisArg) {
      if (thisArg instanceof RegExp) thisArg.lastIndex = 0;
      for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) args[_key3 - 1] = arguments[_key3];
      return apply(func, thisArg, args);
    };
  }
  function unconstruct(Func) {
    return function() {
      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) args[_key4] = arguments[_key4];
      return construct(Func, args);
    };
  }
  function addToSet(set, array) {
    let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
    if (setPrototypeOf) setPrototypeOf(set, null);
    if (!arrayIsArray(array)) return set;
    let l = array.length;
    while (l--) {
      let element = array[l];
      if (typeof element === "string") {
        const lcElement = transformCaseFunc(element);
        if (lcElement !== element) {
          if (!isFrozen(array)) array[l] = lcElement;
          element = lcElement;
        }
      }
      set[element] = true;
    }
    return set;
  }
  function cleanArray(array) {
    for (let index = 0; index < array.length; index++) if (!objectHasOwnProperty(array, index)) array[index] = null;
    return array;
  }
  function clone(object) {
    const newObject = create(null);
    for (const _ref2 of entries(object)) {
      var _ref3 = _slicedToArray(_ref2, 2);
      const property = _ref3[0];
      const value = _ref3[1];
      if (objectHasOwnProperty(object, property)) {
        if (arrayIsArray(value)) newObject[property] = cleanArray(value);
        else if (value && typeof value === "object" && value.constructor === Object) newObject[property] = clone(value);
        else newObject[property] = value;
      }
    }
    return newObject;
  }
  function stringifyValue(value) {
    switch (typeof value) {
      case "string":
        return value;
      case "number":
        return numberToString(value);
      case "boolean":
        return booleanToString(value);
      case "bigint":
        return bigintToString ? bigintToString(value) : "0";
      case "symbol":
        return symbolToString ? symbolToString(value) : "Symbol()";
      case "undefined":
        return objectToString(value);
      case "function":
      case "object": {
        if (value === null) return objectToString(value);
        const valueAsRecord = value;
        const valueToString = lookupGetter(valueAsRecord, "toString");
        if (typeof valueToString === "function") {
          const stringified = valueToString(valueAsRecord);
          return typeof stringified === "string" ? stringified : objectToString(stringified);
        }
        return objectToString(value);
      }
      default:
        return objectToString(value);
    }
  }
  function lookupGetter(object, prop) {
    while (object !== null) {
      const desc = getOwnPropertyDescriptor(object, prop);
      if (desc) {
        if (desc.get) return unapply(desc.get);
        if (typeof desc.value === "function") return unapply(desc.value);
      }
      object = getPrototypeOf(object);
    }
    function fallbackValue() {
      return null;
    }
    return fallbackValue;
  }
  function lookupAccessor(object, prop) {
    while (object !== null) {
      const desc = getOwnPropertyDescriptor(object, prop);
      if (desc) return desc.get ? unapply(desc.get) : null;
      object = getPrototypeOf(object);
    }
    return null;
  }
  function isRegex(value) {
    try {
      regExpTest(value, "");
      return true;
    } catch (_unused) {
      return false;
    }
  }
  var html$1 = freeze([
    "a",
    "abbr",
    "acronym",
    "address",
    "area",
    "article",
    "aside",
    "audio",
    "b",
    "bdi",
    "bdo",
    "big",
    "blink",
    "blockquote",
    "body",
    "br",
    "button",
    "canvas",
    "caption",
    "center",
    "cite",
    "code",
    "col",
    "colgroup",
    "content",
    "data",
    "datalist",
    "dd",
    "decorator",
    "del",
    "details",
    "dfn",
    "dialog",
    "dir",
    "div",
    "dl",
    "dt",
    "element",
    "em",
    "fieldset",
    "figcaption",
    "figure",
    "font",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "header",
    "hgroup",
    "hr",
    "html",
    "i",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "main",
    "map",
    "mark",
    "marquee",
    "menu",
    "menuitem",
    "meter",
    "nav",
    "nobr",
    "ol",
    "optgroup",
    "option",
    "output",
    "p",
    "picture",
    "pre",
    "progress",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "search",
    "section",
    "select",
    "shadow",
    "slot",
    "small",
    "source",
    "spacer",
    "span",
    "strike",
    "strong",
    "style",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "template",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "tr",
    "track",
    "tt",
    "u",
    "ul",
    "var",
    "video",
    "wbr"
  ]);
  var svg$1 = freeze([
    "svg",
    "a",
    "altglyph",
    "altglyphdef",
    "altglyphitem",
    "animatecolor",
    "animatemotion",
    "animatetransform",
    "circle",
    "clippath",
    "defs",
    "desc",
    "ellipse",
    "enterkeyhint",
    "exportparts",
    "filter",
    "font",
    "g",
    "glyph",
    "glyphref",
    "hkern",
    "image",
    "inputmode",
    "line",
    "lineargradient",
    "marker",
    "mask",
    "metadata",
    "mpath",
    "part",
    "path",
    "pattern",
    "polygon",
    "polyline",
    "radialgradient",
    "rect",
    "stop",
    "style",
    "switch",
    "symbol",
    "text",
    "textpath",
    "title",
    "tref",
    "tspan",
    "view",
    "vkern"
  ]);
  var svgFilters = freeze([
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feDropShadow",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence"
  ]);
  var svgDisallowed = freeze([
    "animate",
    "color-profile",
    "cursor",
    "discard",
    "font-face",
    "font-face-format",
    "font-face-name",
    "font-face-src",
    "font-face-uri",
    "foreignobject",
    "hatch",
    "hatchpath",
    "mesh",
    "meshgradient",
    "meshpatch",
    "meshrow",
    "missing-glyph",
    "script",
    "set",
    "solidcolor",
    "unknown",
    "use"
  ]);
  var mathMl$1 = freeze([
    "math",
    "menclose",
    "merror",
    "mfenced",
    "mfrac",
    "mglyph",
    "mi",
    "mlabeledtr",
    "mmultiscripts",
    "mn",
    "mo",
    "mover",
    "mpadded",
    "mphantom",
    "mroot",
    "mrow",
    "ms",
    "mspace",
    "msqrt",
    "mstyle",
    "msub",
    "msup",
    "msubsup",
    "mtable",
    "mtd",
    "mtext",
    "mtr",
    "munder",
    "munderover",
    "mprescripts"
  ]);
  var mathMlDisallowed = freeze([
    "maction",
    "maligngroup",
    "malignmark",
    "mlongdiv",
    "mscarries",
    "mscarry",
    "msgroup",
    "mstack",
    "msline",
    "msrow",
    "semantics",
    "annotation",
    "annotation-xml",
    "mprescripts",
    "none"
  ]);
  var text = freeze(["#text"]);
  var html = freeze([
    "accept",
    "action",
    "align",
    "alt",
    "autocapitalize",
    "autocomplete",
    "autopictureinpicture",
    "autoplay",
    "background",
    "bgcolor",
    "border",
    "capture",
    "cellpadding",
    "cellspacing",
    "checked",
    "cite",
    "class",
    "clear",
    "color",
    "cols",
    "colspan",
    "command",
    "commandfor",
    "controls",
    "controlslist",
    "coords",
    "crossorigin",
    "datetime",
    "decoding",
    "default",
    "dir",
    "disabled",
    "disablepictureinpicture",
    "disableremoteplayback",
    "download",
    "draggable",
    "enctype",
    "enterkeyhint",
    "exportparts",
    "face",
    "for",
    "headers",
    "height",
    "hidden",
    "high",
    "href",
    "hreflang",
    "id",
    "inert",
    "inputmode",
    "integrity",
    "ismap",
    "kind",
    "label",
    "lang",
    "list",
    "loading",
    "loop",
    "low",
    "max",
    "maxlength",
    "media",
    "method",
    "min",
    "minlength",
    "multiple",
    "muted",
    "name",
    "nonce",
    "noshade",
    "novalidate",
    "nowrap",
    "open",
    "optimum",
    "part",
    "pattern",
    "placeholder",
    "playsinline",
    "popover",
    "popovertarget",
    "popovertargetaction",
    "poster",
    "preload",
    "pubdate",
    "radiogroup",
    "readonly",
    "rel",
    "required",
    "rev",
    "reversed",
    "role",
    "rows",
    "rowspan",
    "spellcheck",
    "scope",
    "selected",
    "shape",
    "size",
    "sizes",
    "slot",
    "span",
    "srclang",
    "start",
    "src",
    "srcset",
    "step",
    "style",
    "summary",
    "tabindex",
    "title",
    "translate",
    "type",
    "usemap",
    "valign",
    "value",
    "width",
    "wrap",
    "xmlns"
  ]);
  var svg = freeze([
    "accent-height",
    "accumulate",
    "additive",
    "alignment-baseline",
    "amplitude",
    "ascent",
    "attributename",
    "attributetype",
    "azimuth",
    "basefrequency",
    "baseline-shift",
    "begin",
    "bias",
    "by",
    "class",
    "clip",
    "clippathunits",
    "clip-path",
    "clip-rule",
    "color",
    "color-interpolation",
    "color-interpolation-filters",
    "color-profile",
    "color-rendering",
    "cx",
    "cy",
    "d",
    "dx",
    "dy",
    "diffuseconstant",
    "direction",
    "display",
    "divisor",
    "dominant-baseline",
    "dur",
    "edgemode",
    "elevation",
    "end",
    "exponent",
    "fill",
    "fill-opacity",
    "fill-rule",
    "filter",
    "filterunits",
    "flood-color",
    "flood-opacity",
    "font-family",
    "font-size",
    "font-size-adjust",
    "font-stretch",
    "font-style",
    "font-variant",
    "font-weight",
    "fx",
    "fy",
    "g1",
    "g2",
    "glyph-name",
    "glyphref",
    "gradientunits",
    "gradienttransform",
    "height",
    "href",
    "id",
    "image-rendering",
    "in",
    "in2",
    "intercept",
    "k",
    "k1",
    "k2",
    "k3",
    "k4",
    "kerning",
    "keypoints",
    "keysplines",
    "keytimes",
    "lang",
    "lengthadjust",
    "letter-spacing",
    "kernelmatrix",
    "kernelunitlength",
    "lighting-color",
    "local",
    "marker-end",
    "marker-mid",
    "marker-start",
    "markerheight",
    "markerunits",
    "markerwidth",
    "maskcontentunits",
    "maskunits",
    "max",
    "mask",
    "mask-type",
    "media",
    "method",
    "mode",
    "min",
    "name",
    "numoctaves",
    "offset",
    "operator",
    "opacity",
    "order",
    "orient",
    "orientation",
    "origin",
    "overflow",
    "paint-order",
    "path",
    "pathlength",
    "patterncontentunits",
    "patterntransform",
    "patternunits",
    "pointer-events",
    "points",
    "preservealpha",
    "preserveaspectratio",
    "primitiveunits",
    "r",
    "rx",
    "ry",
    "radius",
    "refx",
    "refy",
    "repeatcount",
    "repeatdur",
    "restart",
    "result",
    "rotate",
    "scale",
    "seed",
    "shape-rendering",
    "slope",
    "specularconstant",
    "specularexponent",
    "spreadmethod",
    "startoffset",
    "stddeviation",
    "stitchtiles",
    "stop-color",
    "stop-opacity",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-opacity",
    "stroke",
    "stroke-width",
    "style",
    "surfacescale",
    "systemlanguage",
    "tabindex",
    "tablevalues",
    "targetx",
    "targety",
    "transform",
    "transform-origin",
    "text-anchor",
    "text-decoration",
    "text-orientation",
    "text-rendering",
    "textlength",
    "type",
    "u1",
    "u2",
    "unicode",
    "values",
    "vector-effect",
    "viewbox",
    "visibility",
    "version",
    "vert-adv-y",
    "vert-origin-x",
    "vert-origin-y",
    "width",
    "word-spacing",
    "wrap",
    "writing-mode",
    "xchannelselector",
    "ychannelselector",
    "x",
    "x1",
    "x2",
    "xmlns",
    "y",
    "y1",
    "y2",
    "z",
    "zoomandpan"
  ]);
  var mathMl = freeze([
    "accent",
    "accentunder",
    "align",
    "bevelled",
    "close",
    "columnalign",
    "columnlines",
    "columnspacing",
    "columnspan",
    "denomalign",
    "depth",
    "dir",
    "display",
    "displaystyle",
    "encoding",
    "fence",
    "frame",
    "height",
    "href",
    "id",
    "largeop",
    "length",
    "linethickness",
    "lquote",
    "lspace",
    "mathbackground",
    "mathcolor",
    "mathsize",
    "mathvariant",
    "maxsize",
    "minsize",
    "movablelimits",
    "notation",
    "numalign",
    "open",
    "rowalign",
    "rowlines",
    "rowspacing",
    "rowspan",
    "rspace",
    "rquote",
    "scriptlevel",
    "scriptminsize",
    "scriptsizemultiplier",
    "selection",
    "separator",
    "separators",
    "stretchy",
    "subscriptshift",
    "supscriptshift",
    "symmetric",
    "voffset",
    "width",
    "xmlns"
  ]);
  var xml = freeze([
    "xlink:href",
    "xml:id",
    "xlink:title",
    "xml:space",
    "xmlns:xlink"
  ]);
  var MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
  var ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
  var TMPLIT_EXPR = seal(/\${[\w\W]*/g);
  var DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
  var ARIA_ATTR = seal(/^aria-[\-\w]+$/);
  var IS_ALLOWED_URI = seal(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i);
  var IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
  var ATTR_WHITESPACE = seal(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g);
  var DOCTYPE_NAME = seal(/^html$/i);
  var CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
  var ELEMENT_MARKUP_PROBE = seal(/<[/\w!]/g);
  var COMMENT_MARKUP_PROBE = seal(/<[/\w]/g);
  var FALLBACK_TAG_CLOSE = seal(/<\/no(script|embed|frames)/i);
  var SELF_CLOSING_TAG = seal(/\/>/i);
  var NODE_TYPE = {
    element: 1,
    attribute: 2,
    text: 3,
    cdataSection: 4,
    entityReference: 5,
    entityNode: 6,
    processingInstruction: 7,
    comment: 8,
    document: 9,
    documentType: 10,
    documentFragment: 11,
    notation: 12
  };
  var LITERAL_TEXT_ELEMENTS = freeze(addToSet({}, [
    "style",
    "script",
    "xmp",
    "iframe",
    "noembed",
    "noframes",
    "plaintext",
    "noscript"
  ]));
  var getGlobal = function getGlobal2() {
    return typeof window === "undefined" ? null : window;
  };
  var _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
    if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") return null;
    let suffix = null;
    const ATTR_NAME = "data-tt-policy-suffix";
    if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) suffix = purifyHostElement.getAttribute(ATTR_NAME);
    const policyName = "dompurify" + (suffix ? "#" + suffix : "");
    try {
      return trustedTypes.createPolicy(policyName, {
        createHTML(html2) {
          return html2;
        },
        createScriptURL(scriptUrl) {
          return scriptUrl;
        }
      });
    } catch (_) {
      console.warn("TrustedTypes policy " + policyName + " could not be created.");
      return null;
    }
  };
  var _createHooksMap = function _createHooksMap2() {
    return {
      afterSanitizeAttributes: [],
      afterSanitizeElements: [],
      afterSanitizeShadowDOM: [],
      beforeSanitizeAttributes: [],
      beforeSanitizeElements: [],
      beforeSanitizeShadowDOM: [],
      uponSanitizeAttribute: [],
      uponSanitizeElement: [],
      uponSanitizeShadowNode: []
    };
  };
  var _resolveSetOption = function _resolveSetOption2(cfg, key, fallback, options) {
    return objectHasOwnProperty(cfg, key) && arrayIsArray(cfg[key]) ? addToSet(options.base ? clone(options.base) : {}, cfg[key], options.transform) : fallback;
  };
  var _resolveObjectOption = function _resolveObjectOption2(cfg, key, makeFallback) {
    const value = objectHasOwnProperty(cfg, key) ? cfg[key] : void 0;
    return value && typeof value === "object" ? clone(value) : makeFallback();
  };
  function createDOMPurify() {
    let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
    const DOMPurify = (root) => createDOMPurify(root);
    DOMPurify.version = "3.4.17";
    DOMPurify.removed = [];
    if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
      DOMPurify.isSupported = false;
      return DOMPurify;
    }
    let document2 = window2.document;
    const originalDocument = document2;
    const currentScript = originalDocument.currentScript;
    window2.DocumentFragment;
    const HTMLTemplateElement = window2.HTMLTemplateElement, Node = window2.Node, Element = window2.Element, NodeFilter = window2.NodeFilter;
    window2.NamedNodeMap === void 0 && (window2.NamedNodeMap || window2.MozNamedAttrMap);
    window2.HTMLFormElement;
    const DOMParser2 = window2.DOMParser, trustedTypes = window2.trustedTypes;
    const ElementPrototype = Element.prototype;
    const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
    const remove = lookupGetter(ElementPrototype, "remove");
    const removeAttributeNode = lookupGetter(ElementPrototype, "removeAttributeNode");
    const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
    const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
    const getParentNode = lookupGetter(ElementPrototype, "parentNode");
    const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
    const getAttributes = lookupGetter(ElementPrototype, "attributes");
    const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
    const getNodeName = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeName") : null;
    const getOwnerDocument = Node && Node.prototype ? lookupGetter(Node.prototype, "ownerDocument") : null;
    const _readNodeType = function _readNodeType2(node) {
      return getNodeType ? getNodeType(node) : node.nodeType;
    };
    const _readNodeName = function _readNodeName2(node) {
      return getNodeName ? getNodeName(node) : node.nodeName;
    };
    const getNamespaceURI = lookupAccessor(ElementPrototype, "namespaceURI");
    const _readNamespaceURI = function _readNamespaceURI2(element) {
      return getNamespaceURI ? getNamespaceURI(element) : element.namespaceURI;
    };
    if (typeof HTMLTemplateElement === "function") {
      const template = document2.createElement("template");
      if (template.content && template.content.ownerDocument) document2 = template.content.ownerDocument;
    }
    let trustedTypesPolicy;
    let emptyHTML = "";
    let defaultTrustedTypesPolicy;
    let defaultTrustedTypesPolicyResolved = false;
    let IN_TRUSTED_TYPES_POLICY = 0;
    const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy2() {
      if (IN_TRUSTED_TYPES_POLICY > 0) throw typeErrorCreate('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.');
    };
    const _createTrustedHTML = function _createTrustedHTML2(html2) {
      _assertNotInTrustedTypesPolicy();
      IN_TRUSTED_TYPES_POLICY++;
      try {
        return trustedTypesPolicy.createHTML(html2);
      } finally {
        IN_TRUSTED_TYPES_POLICY--;
      }
    };
    const _createTrustedScriptURL = function _createTrustedScriptURL2(scriptUrl) {
      _assertNotInTrustedTypesPolicy();
      IN_TRUSTED_TYPES_POLICY++;
      try {
        return trustedTypesPolicy.createScriptURL(scriptUrl);
      } finally {
        IN_TRUSTED_TYPES_POLICY--;
      }
    };
    const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy2() {
      if (!defaultTrustedTypesPolicyResolved) {
        defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
        defaultTrustedTypesPolicyResolved = true;
      }
      return defaultTrustedTypesPolicy;
    };
    const _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
    const importNode = originalDocument.importNode;
    let hooks = _createHooksMap();
    DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
    const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
    let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
    let ALLOWED_TAGS = null;
    const DEFAULT_ALLOWED_TAGS = addToSet({}, [
      ...html$1,
      ...svg$1,
      ...svgFilters,
      ...mathMl$1,
      ...text
    ]);
    let ALLOWED_ATTR = null;
    const DEFAULT_ALLOWED_ATTR = addToSet({}, [
      ...html,
      ...svg,
      ...mathMl,
      ...xml
    ]);
    let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
      tagNameCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      attributeNameCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      allowCustomizedBuiltInElements: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: false
      }
    }));
    let FORBID_TAGS = null;
    let FORBID_ATTR = null;
    const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
      tagCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      attributeCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      }
    }));
    let ALLOW_ARIA_ATTR = true;
    let ALLOW_DATA_ATTR = true;
    let ALLOW_UNKNOWN_PROTOCOLS = false;
    let ALLOW_SELF_CLOSE_IN_ATTR = true;
    let SAFE_FOR_TEMPLATES = false;
    let SAFE_FOR_XML = true;
    let WHOLE_DOCUMENT = false;
    let SET_CONFIG = false;
    let SET_CONFIG_ALLOWED_TAGS = null;
    let SET_CONFIG_ALLOWED_ATTR = null;
    let FORCE_BODY = false;
    let RETURN_DOM = false;
    let RETURN_DOM_FRAGMENT = false;
    let RETURN_TRUSTED_TYPE = false;
    let SANITIZE_DOM = true;
    let SANITIZE_NAMED_PROPS = false;
    const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
    let KEEP_CONTENT = true;
    let IN_PLACE = false;
    let IN_PLACE_VISITED = null;
    let USE_PROFILES = {};
    let FORBID_CONTENTS = null;
    const DEFAULT_FORBID_CONTENTS = addToSet({}, [
      "annotation-xml",
      "audio",
      "colgroup",
      "desc",
      "foreignobject",
      "head",
      "iframe",
      "math",
      "mi",
      "mn",
      "mo",
      "ms",
      "mtext",
      "noembed",
      "noframes",
      "noscript",
      "plaintext",
      "script",
      "selectedcontent",
      "style",
      "svg",
      "template",
      "thead",
      "title",
      "video",
      "xmp"
    ]);
    let DATA_URI_TAGS = null;
    const DEFAULT_DATA_URI_TAGS = addToSet({}, [
      "audio",
      "video",
      "img",
      "source",
      "image",
      "track"
    ]);
    let URI_SAFE_ATTRIBUTES = null;
    const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, [
      "alt",
      "class",
      "for",
      "id",
      "label",
      "name",
      "pattern",
      "placeholder",
      "role",
      "summary",
      "title",
      "value",
      "style",
      "xmlns"
    ]);
    const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
    const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
    const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
    let NAMESPACE = HTML_NAMESPACE;
    let IS_EMPTY_INPUT = false;
    let ALLOWED_NAMESPACES = null;
    const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [
      MATHML_NAMESPACE,
      SVG_NAMESPACE,
      HTML_NAMESPACE
    ], stringToString);
    const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze([
      "mi",
      "mo",
      "mn",
      "ms",
      "mtext"
    ]);
    let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
    const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
    let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
    const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, [
      "title",
      "style",
      "font",
      "a",
      "script"
    ]);
    let PARSER_MEDIA_TYPE = null;
    const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
    const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
    let transformCaseFunc = null;
    let CONFIG = null;
    const formElement = document2.createElement("form");
    const isRegexOrFunction = function isRegexOrFunction2(testValue) {
      return testValue instanceof RegExp || testValue instanceof Function;
    };
    const _parseConfig = function _parseConfig2() {
      let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      if (CONFIG && CONFIG === cfg) return;
      if (!cfg || typeof cfg !== "object") cfg = {};
      cfg = clone(cfg);
      PARSER_MEDIA_TYPE = SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
      transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
      ALLOWED_TAGS = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, { transform: transformCaseFunc });
      ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, { transform: transformCaseFunc });
      ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, { transform: stringToString });
      URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
        transform: transformCaseFunc,
        base: DEFAULT_URI_SAFE_ATTRIBUTES
      });
      DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
        transform: transformCaseFunc,
        base: DEFAULT_DATA_URI_TAGS
      });
      FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, { transform: transformCaseFunc });
      FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone({}), { transform: transformCaseFunc });
      FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone({}), { transform: transformCaseFunc });
      USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
      ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
      ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
      ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
      ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
      SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
      SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
      WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
      RETURN_DOM = cfg.RETURN_DOM || false;
      RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
      RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
      FORCE_BODY = cfg.FORCE_BODY || false;
      SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
      SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
      KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
      IN_PLACE = cfg.IN_PLACE || false;
      IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
      NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
      MATHML_TEXT_INTEGRATION_POINTS = _resolveObjectOption(cfg, "MATHML_TEXT_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS));
      HTML_INTEGRATION_POINTS = _resolveObjectOption(cfg, "HTML_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS));
      const customElementHandling = _resolveObjectOption(cfg, "CUSTOM_ELEMENT_HANDLING", () => create(null));
      CUSTOM_ELEMENT_HANDLING = create(null);
      if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
      if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
      if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
      seal(CUSTOM_ELEMENT_HANDLING);
      if (SAFE_FOR_TEMPLATES) ALLOW_DATA_ATTR = false;
      if (RETURN_DOM_FRAGMENT) RETURN_DOM = true;
      if (USE_PROFILES) {
        ALLOWED_TAGS = addToSet({}, text);
        ALLOWED_ATTR = create(null);
        if (USE_PROFILES.html === true) {
          addToSet(ALLOWED_TAGS, html$1);
          addToSet(ALLOWED_ATTR, html);
        }
        if (USE_PROFILES.svg === true) {
          addToSet(ALLOWED_TAGS, svg$1);
          addToSet(ALLOWED_ATTR, svg);
          addToSet(ALLOWED_ATTR, xml);
        }
        if (USE_PROFILES.svgFilters === true) {
          addToSet(ALLOWED_TAGS, svgFilters);
          addToSet(ALLOWED_ATTR, svg);
          addToSet(ALLOWED_ATTR, xml);
        }
        if (USE_PROFILES.mathMl === true) {
          addToSet(ALLOWED_TAGS, mathMl$1);
          addToSet(ALLOWED_ATTR, mathMl);
          addToSet(ALLOWED_ATTR, xml);
        }
      }
      EXTRA_ELEMENT_HANDLING.tagCheck = null;
      EXTRA_ELEMENT_HANDLING.attributeCheck = null;
      if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
        if (typeof cfg.ADD_TAGS === "function") EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
        else if (arrayIsArray(cfg.ADD_TAGS)) {
          if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) ALLOWED_TAGS = clone(ALLOWED_TAGS);
          addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
        }
      }
      if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
        if (typeof cfg.ADD_ATTR === "function") EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
        else if (arrayIsArray(cfg.ADD_ATTR)) {
          if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) ALLOWED_ATTR = clone(ALLOWED_ATTR);
          addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
        }
      }
      if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
        if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) FORBID_CONTENTS = clone(FORBID_CONTENTS);
        addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
      }
      if (KEEP_CONTENT) ALLOWED_TAGS["#text"] = true;
      if (WHOLE_DOCUMENT) addToSet(ALLOWED_TAGS, [
        "html",
        "head",
        "body"
      ]);
      if (ALLOWED_TAGS.table) {
        addToSet(ALLOWED_TAGS, ["tbody"]);
        delete FORBID_TAGS.tbody;
      }
      if (cfg.TRUSTED_TYPES_POLICY) {
        if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
        if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
        const previousTrustedTypesPolicy = trustedTypesPolicy;
        trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
        try {
          emptyHTML = _createTrustedHTML("");
        } catch (error) {
          trustedTypesPolicy = previousTrustedTypesPolicy;
          throw error;
        }
      } else if (cfg.TRUSTED_TYPES_POLICY === null) {
        trustedTypesPolicy = void 0;
        emptyHTML = "";
      } else {
        if (trustedTypesPolicy === void 0) trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
        if (trustedTypesPolicy && typeof emptyHTML === "string") emptyHTML = _createTrustedHTML("");
      }
      if (freeze) freeze(cfg);
      CONFIG = cfg;
    };
    const ALL_SVG_TAGS = addToSet({}, [
      ...svg$1,
      ...svgFilters,
      ...svgDisallowed
    ]);
    const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
    const _checkSvgNamespace = function _checkSvgNamespace2(tagName, parent, parentTagName) {
      if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "svg";
      if (parent.namespaceURI === MATHML_NAMESPACE) return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
      return Boolean(ALL_SVG_TAGS[tagName]);
    };
    const _checkMathMlNamespace = function _checkMathMlNamespace2(tagName, parent, parentTagName) {
      if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "math";
      if (parent.namespaceURI === SVG_NAMESPACE) return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
      return Boolean(ALL_MATHML_TAGS[tagName]);
    };
    const _checkHtmlNamespace = function _checkHtmlNamespace2(tagName, parent, parentTagName) {
      if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) return false;
      if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) return false;
      return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
    };
    const _checkValidNamespace = function _checkValidNamespace2(element) {
      const elementNamespace = _readNamespaceURI(element);
      const tagName = stringToLowerCase(_readNodeName(element));
      const parentNode = getParentNode(element);
      let parent;
      let parentTagName;
      if (parentNode && _readNodeType(parentNode) === NODE_TYPE.element) {
        parent = { namespaceURI: _readNamespaceURI(parentNode) };
        parentTagName = stringToLowerCase(_readNodeName(parentNode));
      } else {
        parent = { namespaceURI: NAMESPACE };
        parentTagName = "template";
      }
      if (!ALLOWED_NAMESPACES[elementNamespace]) return false;
      if (elementNamespace === SVG_NAMESPACE) return _checkSvgNamespace(tagName, parent, parentTagName);
      if (elementNamespace === MATHML_NAMESPACE) return _checkMathMlNamespace(tagName, parent, parentTagName);
      if (elementNamespace === HTML_NAMESPACE) return _checkHtmlNamespace(tagName, parent, parentTagName);
      if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[elementNamespace]) return true;
      return false;
    };
    const _forceRemove = function _forceRemove2(node) {
      arrayPush(DOMPurify.removed, { element: node });
      try {
        getParentNode(node).removeChild(node);
      } catch (_) {
        remove(node);
        if (!getParentNode(node)) throw typeErrorCreate("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
      }
    };
    const _stripAttributeNode = function _stripAttributeNode2(element, attribute, name) {
      try {
        removeAttributeNode(element, attribute);
      } catch (_) {
        try {
          element.removeAttribute(name);
        } catch (_2) {
        }
      }
    };
    const _neutralizeRoot = function _neutralizeRoot2(root) {
      _neutralizeSubtree(root);
      const childNodes = getChildNodes(root);
      if (childNodes) arrayForEach(arraySlice(childNodes), (child) => {
        try {
          remove(child);
        } catch (_) {
        }
      });
      const attributes = _readNodeType(root) === NODE_TYPE.element ? getAttributes(root) : null;
      if (attributes) for (let i = attributes.length - 1; i >= 0; --i) {
        const attribute = attributes[i];
        const name = attribute && attribute.name;
        if (typeof name === "string") _stripAttributeNode(root, attribute, name);
      }
    };
    const _removeAttribute = function _removeAttribute2(name, element, attr) {
      if (!attr) try {
        attr = element.getAttributeNode(name);
      } catch (_) {
        attr = null;
      }
      arrayPush(DOMPurify.removed, {
        attribute: attr || null,
        from: element
      });
      try {
        if (attr) removeAttributeNode(element, attr);
        else element.removeAttribute(name);
      } catch (_) {
        try {
          element.removeAttribute(name);
        } catch (_2) {
        }
      }
      if (name === "is") {
        if (RETURN_DOM || RETURN_DOM_FRAGMENT) try {
          _forceRemove(element);
        } catch (_) {
        }
        else try {
          element.setAttribute(name, "");
        } catch (_) {
        }
      }
    };
    const _stripDisallowedAttributes = function _stripDisallowedAttributes2(element) {
      const attributes = getAttributes(element);
      if (!attributes) return;
      for (let i = attributes.length - 1; i >= 0; --i) {
        const attribute = attributes[i];
        const name = attribute && attribute.name;
        if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) continue;
        _stripAttributeNode(element, attribute, name);
      }
    };
    const _walkTree = function _walkTree2(root, visit) {
      let intoShadow = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
      const stack = [root];
      while (stack.length > 0) {
        const node = stack.pop();
        if (visit(node) === false) continue;
        if (intoShadow && _readNodeType(node) === NODE_TYPE.element) {
          const shadowRoot = getShadowRoot(node);
          if (_isDocumentFragment(shadowRoot)) stack.push(shadowRoot);
        }
        const childNodes = getChildNodes(node);
        if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push(childNodes[i]);
      }
    };
    const _neutralizeSubtree = function _neutralizeSubtree2(root) {
      _walkTree(root, (node) => {
        if (_readNodeType(node) === NODE_TYPE.element) _stripDisallowedAttributes(node);
      });
    };
    const _collectLiveNodes = function _collectLiveNodes2(root) {
      const nodes = [];
      _walkTree(root, (node) => {
        nodes.push(node);
      }, true);
      return nodes;
    };
    const _neutralizeEscapedElements = function _neutralizeEscapedElements2(root, before) {
      const reachable = setCreate();
      arrayForEach(_collectLiveNodes(root), (node) => {
        if (_readNodeType(node) === NODE_TYPE.element) setAdd(reachable, node);
      });
      arrayForEach(before, (node) => {
        if (_readNodeType(node) === NODE_TYPE.element && !setHas(reachable, node)) _stripDisallowedAttributes(node);
      });
    };
    const _neutralizeDiscarded = function _neutralizeDiscarded2(root, before) {
      let rootRemoved = false;
      arrayForEach(DOMPurify.removed, (entry) => {
        if (entry.element) {
          rootRemoved = rootRemoved || entry.element === root;
          _neutralizeSubtree(entry.element);
        }
      });
      _neutralizeEscapedElements(root, before);
      return rootRemoved;
    };
    const MAX_UNVISITED_ROUNDS = 8;
    const _sanitizeUnvisitedNodes = function _sanitizeUnvisitedNodes2(root, before) {
      const visited = IN_PLACE_VISITED;
      let original = null;
      const getOriginal = () => {
        if (!original) {
          original = setCreate();
          arrayForEach(before, (beforeNode) => {
            setAdd(original, beforeNode);
          });
        }
        return original;
      };
      for (let round = 0; ; round++) {
        const live = _collectLiveNodes(root);
        const containers = [root];
        let pending = false;
        arrayForEach(live, (node) => {
          if (_readNodeType(node) === NODE_TYPE.documentFragment) arrayPush(containers, node);
          else if (!pending && !setHas(visited, node)) pending = setHas(getOriginal(), node);
        });
        if (!pending) return;
        if (round >= MAX_UNVISITED_ROUNDS) throw typeErrorCreate("the tree kept changing during in-place sanitization; refusing to return it");
        arrayForEach(containers, (container, index) => {
          _sanitizeUnvisitedIn(container, index > 0, root, getOriginal());
        });
      }
    };
    const _sanitizeUnvisitedIn = function _sanitizeUnvisitedIn2(container, inShadow, root, original) {
      const iterator = _createNodeIterator(container);
      let node;
      while (node = iterator.nextNode()) {
        if (!setHas(original, node) || setHas(IN_PLACE_VISITED, node)) continue;
        if (inShadow) _executeHooks(hooks.uponSanitizeShadowNode, node, null);
        _sanitizeElements(node, root);
        _sanitizeAttributes(node, root);
        if (_isDocumentFragment(node.content)) _sanitizeShadowDOM2(node.content);
      }
    };
    const _markVisited = function _markVisited2(node) {
      if (IN_PLACE_VISITED) setAdd(IN_PLACE_VISITED, node);
    };
    const _isPatchLinkageAttribute = function _isPatchLinkageAttribute2(lcName, lcTag) {
      if (!SAFE_FOR_XML) return false;
      if (lcName === "patchsrc") return true;
      return lcName === "for" && lcTag !== "label" && lcTag !== "output";
    };
    const _neutralizePatchLinkage = function _neutralizePatchLinkage2(root) {
      if (!SAFE_FOR_XML) return;
      _walkTree(root, (node) => {
        const nodeType = _readNodeType(node);
        if (nodeType === NODE_TYPE.processingInstruction || nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, node.data)) {
          try {
            remove(node);
          } catch (_) {
          }
          return false;
        }
        if (nodeType === NODE_TYPE.element) {
          const element = node;
          const lcTag = transformCaseFunc(_readNodeName(node));
          try {
            if (element.hasAttribute && element.hasAttribute("patchsrc")) element.removeAttribute("patchsrc");
            if (element.hasAttribute && element.hasAttribute("for") && _isPatchLinkageAttribute("for", lcTag)) element.removeAttribute("for");
          } catch (_) {
          }
        }
        return true;
      });
    };
    const _initDocument = function _initDocument2(dirty) {
      let doc = null;
      let leadingWhitespace = null;
      if (FORCE_BODY) dirty = "<remove></remove>" + dirty;
      else {
        const matches = stringMatch(dirty, /^[\r\n\t ]+/);
        leadingWhitespace = matches && matches[0];
      }
      if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
      const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
      if (NAMESPACE === HTML_NAMESPACE) try {
        doc = new DOMParser2().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
      } catch (_) {
      }
      if (!doc || !doc.documentElement) {
        doc = implementation.createDocument(NAMESPACE, "template", null);
        try {
          doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
        } catch (_) {
        }
      }
      const body = doc.body || doc.documentElement;
      if (dirty && leadingWhitespace) body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
      if (NAMESPACE === HTML_NAMESPACE) return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
      return WHOLE_DOCUMENT ? doc.documentElement : body;
    };
    const _createNodeIterator = function _createNodeIterator2(root) {
      const doc = getOwnerDocument ? getOwnerDocument(root) : root.ownerDocument;
      return createNodeIterator.call(doc || root, root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION, null);
    };
    const _stripTemplateExpressions = function _stripTemplateExpressions2(value) {
      value = stringReplace(value, MUSTACHE_EXPR$1, " ");
      value = stringReplace(value, ERB_EXPR$1, " ");
      value = stringReplace(value, TMPLIT_EXPR$1, " ");
      return value;
    };
    const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
      var _node$querySelectorAl;
      _scrubOwnCharacterData(node);
      const templates = (_node$querySelectorAl = node.querySelectorAll) === null || _node$querySelectorAl === void 0 ? void 0 : _node$querySelectorAl.call(node, "template");
      if (templates) arrayForEach(templates, (tmpl) => {
        if (_isDocumentFragment(tmpl.content)) _scrubTemplateExpressions2(tmpl.content);
      });
    };
    const _scrubOwnCharacterData = function _scrubOwnCharacterData2(node) {
      node.normalize();
      const doc = getOwnerDocument ? getOwnerDocument(node) : node.ownerDocument;
      const walker = createNodeIterator.call(doc || node, node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION, null);
      let currentNode = walker.nextNode();
      while (currentNode) {
        currentNode.data = _stripTemplateExpressions(currentNode.data);
        currentNode = walker.nextNode();
      }
    };
    const _isClobbered = function _isClobbered2(element) {
      const realTagName = getNodeName ? getNodeName(element) : null;
      if (typeof realTagName !== "string") return false;
      if (transformCaseFunc(realTagName) !== "form") return false;
      return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.removeAttributeNode !== "function" || typeof element.getAttributeNode !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || element.nodeType !== getNodeType(element) || element.childNodes !== getChildNodes(element);
    };
    const _isDocumentFragment = function _isDocumentFragment2(value) {
      if (!getNodeType || typeof value !== "object" || value === null) return false;
      try {
        return getNodeType(value) === NODE_TYPE.documentFragment;
      } catch (_) {
        return false;
      }
    };
    const _isNode = function _isNode2(value) {
      if (!getNodeType || typeof value !== "object" || value === null) return false;
      try {
        return typeof getNodeType(value) === "number";
      } catch (_) {
        return false;
      }
    };
    function _executeHooks(hooks2, currentNode, data) {
      if (hooks2.length === 0) return;
      arrayForEach(hooks2, (hook) => {
        hook.call(DOMPurify, currentNode, data, CONFIG);
      });
    }
    const _isUnsafeNode = function _isUnsafeNode2(currentNode, tagName) {
      if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) return true;
      if (SAFE_FOR_XML && LITERAL_TEXT_ELEMENTS[tagName] && _readNodeType(currentNode) === NODE_TYPE.element && _readNamespaceURI(currentNode) === HTML_NAMESPACE && (_isNode(currentNode.firstElementChild) || typeof currentNode.textContent === "string" && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent))) return true;
      if (currentNode.nodeType === NODE_TYPE.processingInstruction) return true;
      if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) return true;
      return false;
    };
    const _matchesNameCheck = function _matchesNameCheck2(check, name) {
      if (check instanceof RegExp) return regExpTest(check, name);
      if (check instanceof Function) {
        for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
        return Boolean(check(name, ...args));
      }
      return false;
    };
    const _sanitizeDisallowedNode = function _sanitizeDisallowedNode2(currentNode, tagName, root) {
      if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) return false;
      if (KEEP_CONTENT && !FORBID_CONTENTS[tagName] && !FORBID_CONTENTS[stringToLowerCase(tagName)]) {
        const parentNode = getParentNode(currentNode);
        const childNodes = getChildNodes(currentNode);
        if (childNodes && parentNode) {
          const childCount = childNodes.length;
          for (let i = childCount - 1; i >= 0; --i) {
            const hoisted = currentNode === root ? cloneNode(childNodes[i], true) : childNodes[i];
            parentNode.insertBefore(hoisted, getNextSibling(currentNode));
          }
        }
      }
      _forceRemove(currentNode);
      return true;
    };
    const _forkSharedAllowlist = function _forkSharedAllowlist2(hookList, set, defaultSet, setConfigSet) {
      if (hookList.length === 0) return set;
      return set === defaultSet || set === setConfigSet ? clone(set) : set;
    };
    const _handleHookDetachedNode = function _handleHookDetachedNode2(currentNode, root) {
      if (currentNode === root || getParentNode(currentNode) !== null) return false;
      if (IN_PLACE) _neutralizeSubtree(currentNode);
      return true;
    };
    const _sanitizeElements = function _sanitizeElements2(currentNode, root) {
      _markVisited(currentNode);
      _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
      if (_handleHookDetachedNode(currentNode, root)) return true;
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
        return true;
      }
      const tagName = transformCaseFunc(_readNodeName(currentNode));
      ALLOWED_TAGS = _forkSharedAllowlist(hooks.uponSanitizeElement, ALLOWED_TAGS, DEFAULT_ALLOWED_TAGS, SET_CONFIG_ALLOWED_TAGS);
      _executeHooks(hooks.uponSanitizeElement, currentNode, {
        tagName,
        allowedTags: ALLOWED_TAGS
      });
      if (_handleHookDetachedNode(currentNode, root)) return true;
      if (_isUnsafeNode(currentNode, tagName)) {
        _forceRemove(currentNode);
        return true;
      }
      if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
        const removed = _sanitizeDisallowedNode(currentNode, tagName, root);
        if (removed === false) {
          _executeHooks(hooks.afterSanitizeElements, currentNode, null);
          if (_handleHookDetachedNode(currentNode, root)) return true;
        }
        return removed;
      }
      if (_readNodeType(currentNode) === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
        _forceRemove(currentNode);
        return true;
      }
      if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
        const content = _stripTemplateExpressions(currentNode.textContent);
        if (currentNode.textContent !== content) {
          arrayPush(DOMPurify.removed, { element: currentNode.cloneNode() });
          currentNode.textContent = content;
        }
      }
      _executeHooks(hooks.afterSanitizeElements, currentNode, null);
      return _handleHookDetachedNode(currentNode, root);
    };
    const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
      if (FORBID_ATTR[lcName]) return false;
      if (_isPatchLinkageAttribute(lcName, lcTag)) return false;
      if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) return false;
      const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
      if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName)) return true;
      if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) return true;
      if (!nameIsPermitted) return _isBasicCustomElement(lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName, lcTag) || lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value);
      if (URI_SAFE_ATTRIBUTES[lcName]) return true;
      if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
      if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) return true;
      if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
      return !value;
    };
    const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, [
      "annotation-xml",
      "color-profile",
      "font-face",
      "font-face-format",
      "font-face-name",
      "font-face-src",
      "font-face-uri",
      "missing-glyph"
    ]);
    const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
      return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
    };
    const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute2(lcTag, lcName, namespaceURI, value) {
      if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) switch (trustedTypes.getAttributeType(lcTag, lcName)) {
        case "TrustedHTML":
          return _createTrustedHTML(value);
        case "TrustedScriptURL":
          return _createTrustedScriptURL(value);
      }
      return value;
    };
    const _setAttributeValue = function _setAttributeValue2(currentNode, name, namespaceURI, value) {
      try {
        if (namespaceURI) currentNode.setAttributeNS(namespaceURI, name, value);
        else currentNode.setAttribute(name, value);
        if (_isClobbered(currentNode)) {
          _forceRemove(currentNode);
          return false;
        }
        return true;
      } catch (_) {
        _removeAttribute(name, currentNode);
        return false;
      }
    };
    const _isUnsafeAttributeValue = function _isUnsafeAttributeValue2(name, value) {
      if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) return true;
      return stringToLowerCase(name) === "attributename" && stringMatch(value, "href") !== null;
    };
    const _sanitizeAttributes = function _sanitizeAttributes2(currentNode, root) {
      _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
      if (_handleHookDetachedNode(currentNode, root)) return;
      const attributes = currentNode.attributes;
      if (!attributes || _isClobbered(currentNode)) return;
      ALLOWED_ATTR = _forkSharedAllowlist(hooks.uponSanitizeAttribute, ALLOWED_ATTR, DEFAULT_ALLOWED_ATTR, SET_CONFIG_ALLOWED_ATTR);
      const hookEvent = {
        attrName: "",
        attrValue: "",
        keepAttr: true,
        allowedAttributes: ALLOWED_ATTR,
        forceKeepAttr: void 0
      };
      let l = attributes.length;
      const lcTag = transformCaseFunc(currentNode.nodeName);
      while (l--) {
        const attr = attributes[l];
        const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
        const lcName = transformCaseFunc(name);
        const initValue = attrValue;
        let value = name === "value" ? initValue : stringTrim(initValue);
        let recreatedNamedProp = false;
        hookEvent.attrName = lcName;
        hookEvent.attrValue = value;
        hookEvent.keepAttr = true;
        hookEvent.forceKeepAttr = void 0;
        _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
        value = hookEvent.attrValue;
        if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
          _removeAttribute(name, currentNode, attr);
          value = SANITIZE_NAMED_PROPS_PREFIX + value;
          recreatedNamedProp = true;
        }
        if (_isUnsafeAttributeValue(name, value)) {
          _removeAttribute(name, currentNode, attr);
          continue;
        }
        if (hookEvent.forceKeepAttr) continue;
        if (!hookEvent.keepAttr) {
          _removeAttribute(name, currentNode, attr);
          continue;
        }
        if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
          _removeAttribute(name, currentNode, attr);
          continue;
        }
        if (SAFE_FOR_TEMPLATES) value = _stripTemplateExpressions(value);
        if (!_isValidAttribute(lcTag, lcName, value)) {
          _removeAttribute(name, currentNode, attr);
          continue;
        }
        value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
        if (value !== initValue) {
          if (_setAttributeValue(currentNode, name, namespaceURI, value) && recreatedNamedProp) arrayPop(DOMPurify.removed);
        }
      }
      _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
      _handleHookDetachedNode(currentNode, root);
    };
    const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
      let shadowNode = null;
      const shadowIterator = _createNodeIterator(fragment);
      _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
      while (shadowNode = shadowIterator.nextNode()) {
        _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
        _sanitizeElements(shadowNode, fragment);
        _sanitizeAttributes(shadowNode, fragment);
        if (_isDocumentFragment(shadowNode.content)) _sanitizeShadowDOM2(shadowNode.content);
        if (_readNodeType(shadowNode) === NODE_TYPE.element) {
          const innerSr = getShadowRoot(shadowNode);
          if (_isDocumentFragment(innerSr)) {
            _sanitizeAttachedShadowRoots(innerSr);
            _sanitizeShadowDOM2(innerSr);
          }
        }
      }
      if (SAFE_FOR_TEMPLATES) _scrubOwnCharacterData(fragment);
      _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
    };
    const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots2(root) {
      const stack = [{
        node: root,
        shadow: null
      }];
      while (stack.length > 0) {
        const item = stack.pop();
        if (item.shadow) {
          _sanitizeShadowDOM2(item.shadow);
          continue;
        }
        const node = item.node;
        const isElement = _readNodeType(node) === NODE_TYPE.element;
        const childNodes = getChildNodes(node);
        if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push({
          node: childNodes[i],
          shadow: null
        });
        if (isElement) {
          const rootName = getNodeName ? getNodeName(node) : null;
          if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
            const content = node.content;
            if (_isDocumentFragment(content)) stack.push({
              node: content,
              shadow: null
            });
          }
        }
        if (isElement) {
          const sr = getShadowRoot(node);
          if (_isDocumentFragment(sr)) stack.push({
            node: null,
            shadow: sr
          }, {
            node: sr,
            shadow: null
          });
        }
      }
    };
    DOMPurify.sanitize = function(dirty) {
      let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      let body = null;
      let importedNode = null;
      let currentNode = null;
      let returnNode = null;
      IS_EMPTY_INPUT = !dirty;
      if (IS_EMPTY_INPUT) dirty = "<!-->";
      if (typeof dirty !== "string" && !_isNode(dirty)) {
        dirty = stringifyValue(dirty);
        if (typeof dirty !== "string") throw typeErrorCreate("dirty is not a string, aborting");
      }
      if (!DOMPurify.isSupported) return dirty;
      if (SET_CONFIG) {
        ALLOWED_TAGS = SET_CONFIG_ALLOWED_TAGS;
        ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
      } else _parseConfig(cfg);
      if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) ALLOWED_TAGS = clone(ALLOWED_TAGS);
      if (hooks.uponSanitizeAttribute.length > 0) ALLOWED_ATTR = clone(ALLOWED_ATTR);
      DOMPurify.removed = [];
      const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
      let inPlaceNodes = [];
      const outerVisited = IN_PLACE_VISITED;
      if (inPlace) {
        _neutralizePatchLinkage(dirty);
        const nn = _readNodeName(dirty);
        if (typeof nn === "string") {
          const tagName = transformCaseFunc(nn);
          if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
            _neutralizeRoot(dirty);
            throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
          }
        }
        if (_isClobbered(dirty)) {
          _neutralizeRoot(dirty);
          throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
        }
        inPlaceNodes = _collectLiveNodes(dirty);
        IN_PLACE_VISITED = setCreate();
      } else if (_isNode(dirty)) {
        body = _initDocument("<!---->");
        importedNode = body.ownerDocument.importNode(dirty, true);
        if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") body = importedNode;
        else if (importedNode.nodeName === "HTML") body = importedNode;
        else body.appendChild(importedNode);
        _sanitizeAttachedShadowRoots(body);
      } else {
        if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && dirty.indexOf("<") === -1) return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
        body = _initDocument(dirty);
        if (!body) return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
      }
      if (body && FORCE_BODY) _forceRemove(body.firstChild);
      const walkRoot = inPlace ? dirty : body;
      try {
        if (inPlace) _sanitizeAttachedShadowRoots(dirty);
        const nodeIterator = _createNodeIterator(walkRoot);
        while (currentNode = nodeIterator.nextNode()) {
          _sanitizeElements(currentNode, walkRoot);
          _sanitizeAttributes(currentNode, walkRoot);
          if (_isDocumentFragment(currentNode.content)) _sanitizeShadowDOM2(currentNode.content);
        }
        if (inPlace) _sanitizeUnvisitedNodes(dirty, inPlaceNodes);
      } catch (error) {
        if (inPlace) {
          _neutralizeRoot(dirty);
          _neutralizeDiscarded(dirty, inPlaceNodes);
        }
        throw error;
      } finally {
        IN_PLACE_VISITED = outerVisited;
      }
      if (inPlace) {
        if (_neutralizeDiscarded(dirty, inPlaceNodes)) throw typeErrorCreate("a node selected for removal could not be safely returned; refusing to sanitize in place");
        if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(dirty);
        return dirty;
      }
      if (RETURN_DOM) {
        if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(body);
        if (RETURN_DOM_FRAGMENT) {
          returnNode = createDocumentFragment.call(body.ownerDocument);
          while (body.firstChild) returnNode.appendChild(body.firstChild);
        } else returnNode = body;
        if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) returnNode = importNode.call(originalDocument, returnNode, true);
        return returnNode;
      }
      let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
      if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
      if (SAFE_FOR_TEMPLATES) serializedHTML = _stripTemplateExpressions(serializedHTML);
      return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
    };
    DOMPurify.setConfig = function() {
      let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      _parseConfig(cfg);
      SET_CONFIG = true;
      SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS;
      SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
    };
    DOMPurify.clearConfig = function() {
      CONFIG = null;
      SET_CONFIG = false;
      SET_CONFIG_ALLOWED_TAGS = null;
      SET_CONFIG_ALLOWED_ATTR = null;
      trustedTypesPolicy = defaultTrustedTypesPolicy;
      emptyHTML = "";
    };
    DOMPurify.isValidAttribute = function(tag, attr, value) {
      if (!CONFIG) _parseConfig({});
      const lcTag = transformCaseFunc(tag);
      const lcName = transformCaseFunc(attr);
      if (typeof value === "string" && (_isUnsafeAttributeValue(attr, value) || !ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value))) return false;
      return _isValidAttribute(lcTag, lcName, value);
    };
    DOMPurify.addHook = function(entryPoint, hookFunction) {
      if (typeof hookFunction !== "function") return;
      if (!objectHasOwnProperty(hooks, entryPoint)) return;
      arrayPush(hooks[entryPoint], hookFunction);
    };
    DOMPurify.removeHook = function(entryPoint, hookFunction) {
      if (!objectHasOwnProperty(hooks, entryPoint)) return;
      if (hookFunction !== void 0) {
        const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
        return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
      }
      return arrayPop(hooks[entryPoint]);
    };
    DOMPurify.removeHooks = function(entryPoint) {
      if (!objectHasOwnProperty(hooks, entryPoint)) return;
      hooks[entryPoint] = [];
    };
    DOMPurify.removeAllHooks = function() {
      hooks = _createHooksMap();
    };
    return DOMPurify;
  }
  var purify_default = createDOMPurify();

  // src/shared/veilige-html.js
  var TAGS = ["b", "strong", "i", "em", "u", "s", "strike", "a", "mark", "font", "br", "p", "div", "span", "h2", "h3", "h4", "blockquote", "pre", "code", "ul", "ol", "li"];
  var STIJLEN = ["color", "backgroundColor", "fontWeight", "fontStyle", "textDecoration"];
  var LINK = /^(?:https?:\/\/|mailto:|#)/i;
  function veiligeHtml(html2, linkKleur) {
    const frag = purify_default.sanitize(String(html2 == null ? "" : html2), {
      ALLOWED_TAGS: TAGS,
      ALLOWED_ATTR: ["href", "style", "color"],
      ALLOWED_URI_REGEXP: LINK,
      KEEP_CONTENT: true,
      RETURN_DOM_FRAGMENT: true
    });
    Array.prototype.slice.call(frag.querySelectorAll("*")).forEach(function(el) {
      const href = el.tagName === "A" ? String(el.getAttribute("href") || "") : "";
      const oud = {};
      STIJLEN.forEach(function(p) {
        oud[p] = el.style[p];
      });
      if (el.tagName === "FONT" && !oud.color) oud.color = String(el.getAttribute("color") || "");
      Array.prototype.slice.call(el.attributes).forEach(function(a) {
        el.removeAttribute(a.name);
      });
      if (href && LINK.test(href)) {
        el.setAttribute("href", href);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
      STIJLEN.forEach(function(p) {
        if (oud[p]) {
          try {
            el.style[p] = oud[p];
          } catch (e) {
          }
        }
      });
      if (el.tagName === "A" && linkKleur) {
        if (!el.style.color) el.style.color = linkKleur;
        if (!el.style.textDecoration) el.style.textDecoration = "underline";
      }
    });
    return frag;
  }

  // src/survey/checklist.js
  var _lastBadge = -1;
  function sendBadge(count) {
    const c = Math.max(0, count | 0);
    if (c === _lastBadge) return;
    _lastBadge = c;
    try {
      chrome.runtime.sendMessage({ type: MSG.BADGE, count: c });
    } catch (e) {
    }
  }
  function setAuditProgress(done, total) {
    if (!surveyState.bannerEl || surveyState.bannerEl.style.display === "none") return;
    const title = surveyState.bannerEl.querySelector("[data-survey-title]");
    if (title && total > 1) title.textContent = "Categorie " + done + " van " + total + " controleren…";
  }
  function currentSurveyResultId() {
    const fromLoc = surveyResultId(location.href);
    if (fromLoc) return fromLoc;
    try {
      const editPath = surveyEditUrlFromOverview();
      const abs = editPath ? absoluteSurveyUrl(editPath) : null;
      return abs ? surveyResultId(abs) : null;
    } catch (e) {
      return null;
    }
  }
  function markAuditForResume(reason) {
    const resultId = currentSurveyResultId();
    if (!resultId) return null;
    try {
      sessionStorage.setItem(AUDIT_RESUME_KEY, JSON.stringify({
        schema: CHECKLIST_SCHEMA,
        resultId,
        reason: String(reason || ""),
        age: clientAgeYears(),
        ts: Date.now()
      }));
    } catch (e) {
    }
    return resultId;
  }
  function readAuditResume() {
    const currentId = currentSurveyResultId();
    try {
      const url = new URL(location.href);
      const urlId = url.searchParams.get(AUDIT_RESUME_PARAM);
      if (urlId && (!currentId || urlId === currentId)) {
        return { schema: CHECKLIST_SCHEMA, resultId: urlId, reason: "edit-navigation", ts: Date.now(), fromUrl: true };
      }
    } catch (e) {
    }
    try {
      const state = JSON.parse(sessionStorage.getItem(AUDIT_RESUME_KEY) || "null");
      if (!state || state.schema !== CHECKLIST_SCHEMA || !state.resultId || !state.ts || Date.now() - state.ts > 5 * 60 * 1e3) {
        try {
          sessionStorage.removeItem(AUDIT_RESUME_KEY);
        } catch (e2) {
        }
        return null;
      }
      if (currentId && state.resultId !== currentId) return null;
      return state;
    } catch (e) {
      return null;
    }
  }
  function clearAuditResume() {
    try {
      sessionStorage.removeItem(AUDIT_RESUME_KEY);
    } catch (e) {
    }
    try {
      const url = new URL(location.href);
      if (!url.searchParams.has(AUDIT_RESUME_PARAM)) return;
      url.searchParams.delete(AUDIT_RESUME_PARAM);
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    } catch (e) {
    }
  }
  function loadChecklist() {
    try {
      const state = JSON.parse(sessionStorage.getItem(CHECKLIST_KEY) || "null");
      if (!state || state.schema !== CHECKLIST_SCHEMA || !Array.isArray(state.items) || !state.ts || Date.now() - state.ts > 4 * 60 * 60 * 1e3) return null;
      const cur = currentSurveyResultId();
      if (state.resultId && cur && state.resultId !== cur) {
        clearChecklist();
        return null;
      }
      return state;
    } catch (e) {
      return null;
    }
  }
  function saveChecklist(state) {
    if (!state) return;
    state.ts = Date.now();
    if (!state.resultId) state.resultId = currentSurveyResultId() || null;
    try {
      sessionStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
    } catch (e) {
    }
  }
  function clearChecklist() {
    try {
      sessionStorage.removeItem(CHECKLIST_KEY);
    } catch (e) {
    }
  }
  function sortChecklistItems(items) {
    if (!Array.isArray(items)) return items;
    items.sort((a, b) => (a && a.order || 0) - (b && b.order || 0));
    return items;
  }
  function itemTargetsCurrentPage(item) {
    try {
      const target = new URL(item.href, location.origin);
      const current = new URL(location.href);
      target.searchParams.delete("ons_helper_focus");
      current.searchParams.delete("ons_helper_focus");
      target.searchParams.delete(AUDIT_RESUME_PARAM);
      current.searchParams.delete(AUDIT_RESUME_PARAM);
      return target.origin === current.origin && target.pathname === current.pathname && target.search === current.search;
    } catch (e) {
      return false;
    }
  }
  function localQuestionForItem(item) {
    if (!item || !itemTargetsCurrentPage(item)) return null;
    if (item.anchorId) {
      const field = document.getElementById(item.anchorId);
      if (field) return closestSurveyQuestionBlock(field) || field;
    }
    return surveyQuestionBlocks(document).find((q) => readableQuestionText(q) === item.question && groupName(q, document) === item.group) || null;
  }
  function navigateToItemCategory(item) {
    if (!item || !item.href) return;
    try {
      sessionStorage.setItem(PENDING_QUESTION_KEY, JSON.stringify({
        id: item.anchorId || "",
        anchorId: item.anchorId || "",
        href: item.href,
        group: item.group,
        question: item.question,
        ts: Date.now()
      }));
    } catch (e) {
    }
    let url = item.href;
    try {
      const u = new URL(item.href, location.origin);
      u.hash = "";
      url = u.href;
    } catch (e) {
    }
    try {
      location.assign(url);
    } catch (e) {
      try {
        location.href = url;
      } catch (e2) {
      }
    }
  }
  function managedSignalNode(value, tagValues) {
    const signal = parsedSignal(value);
    const out = document.createElement("div");
    const frag = veiligeHtml(signal.html);
    if (frag.childNodes.length) out.appendChild(frag);
    else out.textContent = signal.text || "";
    const tags = tagValues || {}, replace = (text2) => String(text2 || "").replace(/\{vraag\}/gi, tags.vraag ? String(tags.vraag) : "{vraag}").replace(/\{clientNaam\}/gi, tags.clientNaam || "{clientNaam}").replace(/\{clientLeeftijd\}/gi, tags.clientLeeftijd == null ? "{clientLeeftijd}" : String(tags.clientLeeftijd));
    const walk = (node) => {
      if (node.nodeType === 3) {
        node.nodeValue = replace(node.nodeValue);
        return;
      }
      Array.from(node.childNodes || []).forEach(walk);
    };
    walk(out);
    Object.assign(out.style, { color: signal.color, fontWeight: signal.bold ? "700" : "400", fontStyle: signal.italic ? "italic" : "normal", fontSize: signal.sizePx + "px", overflowWrap: "anywhere" });
    return out;
  }

  // src/survey/dom.js
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
  function deepQueryAll(selector, root) {
    if (root) {
      const out2 = [], seen = /* @__PURE__ */ new Set();
      const walk = (node) => {
        if (!node || seen.has(node)) return;
        seen.add(node);
        try {
          out2.push(...node.querySelectorAll(selector));
        } catch (e) {
        }
        let all;
        try {
          all = node.querySelectorAll("*");
        } catch (e) {
          return;
        }
        for (const el of all) if (el.shadowRoot) walk(el.shadowRoot);
      };
      walk(root);
      return out2;
    }
    const out = [];
    for (const currentRoot of _roots()) {
      try {
        for (const el of currentRoot.querySelectorAll(selector)) out.push(el);
      } catch (e) {
      }
    }
    return out;
  }

  // src/survey/client-age.js
  function clientAgeYears() {
    const selectors = [
      // Handmatig in de UI-inspector aangewezen leeftijd-element: eerst proberen.
      ...UI_OVERRIDES.surveyAgeSelector ? [UI_OVERRIDES.surveyAgeSelector] : [],
      '[data-testid="widget-root"] [data-testid="client-details-birthdate"]',
      '[data-testid="client-details-birthdate"]',
      '[data-testid="avatar-modal-header"] .avatar-dialog__header-detail',
      ".avatar-dialog__header-detail",
      '[data-testid*="birthdate" i]',
      '[class*="birthdate" i]'
    ];
    const candidates = [];
    const seen = /* @__PURE__ */ new Set();
    const docs = [];
    const seenDocs = /* @__PURE__ */ new Set();
    const addDocument = (doc) => {
      if (!doc || seenDocs.has(doc)) return;
      seenDocs.add(doc);
      docs.push(doc);
      let frames = [];
      try {
        frames = doc.querySelectorAll("iframe,frame");
      } catch (e) {
      }
      for (const frame of frames) {
        try {
          addDocument(frame.contentDocument);
        } catch (e) {
        }
      }
    };
    try {
      addDocument(window.top.document);
    } catch (e) {
      addDocument(document);
    }
    addDocument(document);
    for (const doc of docs) {
      for (const selector of selectors) {
        let found = [];
        try {
          found = deepQueryAll(selector, doc);
        } catch (e) {
        }
        for (const el of found) {
          if (!seen.has(el)) {
            seen.add(el);
            candidates.push(el);
          }
        }
      }
      let attributed = [];
      try {
        attributed = deepQueryAll('[datetime],[data-birthdate],[data-date-of-birth],[aria-label*="geboorte" i],[title*="geboorte" i]', doc);
      } catch (e) {
      }
      for (const el of attributed) if (!seen.has(el)) {
        seen.add(el);
        candidates.push(el);
      }
    }
    for (const el of candidates) {
      const txt = [
        el.textContent,
        el.getAttribute && el.getAttribute("datetime"),
        el.getAttribute && el.getAttribute("data-birthdate"),
        el.getAttribute && el.getAttribute("data-date-of-birth"),
        el.getAttribute && el.getAttribute("aria-label"),
        el.getAttribute && el.getAttribute("title")
      ].filter(Boolean).join(" ");
      const m = txt.match(/\((\d{1,3})\s*jaar\)|\bleeftijd\s*[:\-]?\s*(\d{1,3})\b/i);
      if (m) {
        const parsed = parseInt(m[1] || m[2], 10);
        if (parsed >= 0 && parsed <= 125) return parsed;
      }
      const d = txt.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
      if (d) {
        const bd = new Date(+d[3], +d[2] - 1, +d[1]);
        if (!isNaN(bd.getTime()) && bd.getFullYear() === +d[3] && bd.getMonth() === +d[2] - 1 && bd.getDate() === +d[1]) {
          const now = /* @__PURE__ */ new Date();
          let age = now.getFullYear() - bd.getFullYear();
          const mm = now.getMonth() - bd.getMonth();
          if (mm < 0 || mm === 0 && now.getDate() < bd.getDate()) age--;
          if (age >= 0 && age <= 125) return age;
        }
      }
    }
    return null;
  }
  function surveyClientName() {
    const docs = [], seen = /* @__PURE__ */ new Set();
    const add = (doc) => {
      if (doc && !seen.has(doc)) {
        seen.add(doc);
        docs.push(doc);
      }
    };
    if (UI_OVERRIDES.surveyClientNameSelector) {
      try {
        const hits = deepQueryAll(UI_OVERRIDES.surveyClientNameSelector) || [];
        for (const el of hits) {
          const n = String(el.textContent || "").replace(/\s+/g, " ").trim().replace(/\s*\(\d{1,3}\s*jaar\).*$/i, "");
          if (n) return n;
        }
      } catch (e) {
      }
    }
    try {
      add(window.top && window.top.document);
    } catch (e) {
    }
    add(document);
    try {
      Array.from((window.top && window.top.document || document).querySelectorAll("iframe")).forEach((frame) => {
        try {
          add(frame.contentDocument);
        } catch (e) {
        }
      });
    } catch (e) {
    }
    const clean = (raw) => String(raw || "").replace(/\s+/g, " ").trim().replace(/\s*\(\d{1,3}\s*jaar\).*$/i, "");
    const looksLikeName = (n) => !!n && n.length <= 100 && !/[\[\]{}]|survey_result|question_\d|_id\b/i.test(n) && /[a-zà-ÿ]/i.test(n);
    const nameSelectors = ["uc-person-name", ".base-card__name-tags", '[data-testid="client-details-name"]', '[data-testid="client-name"]', "[data-client-name]", "[data-invitee-name]", '[data-testid="avatar-modal-header"] [class*="name" i]', ".client-name"];
    for (const sel of nameSelectors) {
      let hits = [];
      try {
        hits = deepQueryAll(sel);
      } catch (e) {
      }
      for (const el of hits) {
        const raw = el.getAttribute && (el.getAttribute("data-client-name") || el.getAttribute("data-invitee-name")) || el.textContent || "";
        const name = clean(raw);
        if (looksLikeName(name)) return name;
      }
    }
    for (const doc of docs) {
      for (const host of Array.from(doc.querySelectorAll("[data-react-component][data-props]"))) {
        try {
          const props = JSON.parse(host.getAttribute("data-props") || "{}"), name = props.clientName || props.client && props.client.name;
          if (looksLikeName(clean(name))) return clean(name);
        } catch (e) {
        }
      }
    }
    return "";
  }
  function waitForClientAge(maxWaitMs) {
    const started = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        const age = clientAgeYears();
        if (age != null || Date.now() - started >= maxWaitMs) {
          resolve(age);
          return;
        }
        setTimeout(check, 100);
      };
      check();
    });
  }
  function distinctClientAges() {
    const ages = /* @__PURE__ */ new Set();
    const docs = [];
    try {
      if (window.top && window.top.document) docs.push(window.top.document);
    } catch (e) {
    }
    if (docs.indexOf(document) === -1) docs.push(document);
    for (const doc of docs) {
      let text2 = "";
      try {
        text2 = doc.body && doc.body.textContent || "";
      } catch (e) {
      }
      const re = /\((\d{1,3})\s*jaar\)/g;
      let m;
      while (m = re.exec(text2)) {
        const a = parseInt(m[1], 10);
        if (a >= 0 && a <= 125) ages.add(a);
      }
    }
    return Array.from(ages);
  }
  function clientAgeAmbiguous() {
    return distinctClientAges().length > 1;
  }
  var MANUAL_AGE_KEY = PAGE_SESSION.SURVEY_MANUAL_AGE;
  function loadManualAge() {
    try {
      const s = JSON.parse(sessionStorage.getItem(MANUAL_AGE_KEY) || "null");
      if (!s || s.schema !== CHECKLIST_SCHEMA || !s.ts || Date.now() - s.ts > 4 * 60 * 60 * 1e3) return null;
      const cur = currentSurveyResultId();
      if (s.resultId && cur && s.resultId !== cur) return null;
      return s;
    } catch (e) {
      return null;
    }
  }
  function saveManualAge(under12) {
    try {
      sessionStorage.setItem(MANUAL_AGE_KEY, JSON.stringify({
        schema: CHECKLIST_SCHEMA,
        resultId: currentSurveyResultId() || null,
        age: under12 ? 6 : 15,
        under12: !!under12,
        ts: Date.now()
      }));
    } catch (e) {
    }
  }
  function resolvedAge() {
    const manual = loadManualAge();
    if (manual) return manual.age;
    const detected = clientAgeYears();
    if (detected != null && !clientAgeAmbiguous()) return detected;
    return null;
  }

  // src/shared/version.js
  var SCRIPT_VERSION = function() {
    try {
      return chrome.runtime.getManifest().version;
    } catch (e) {
      return "1.6.286";
    }
  }();

  // src/survey/banner.js
  function loadPanelWidth() {
    try {
      const w = parseInt(localStorage.getItem(PANEL_W_KEY), 10);
      if (w >= PANEL_MIN && w <= PANEL_MAX) surveyState.PANEL_W = w;
    } catch (e) {
    }
  }
  function applyPanelWidth(w) {
    surveyState.PANEL_W = Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.round(w)));
    if (surveyState.bannerEl) {
      surveyState.bannerEl.style.width = surveyState.PANEL_W + "px";
      surveyState.bannerEl.style.minWidth = surveyState.PANEL_W + "px";
      surveyState.bannerEl.style.maxWidth = surveyState.PANEL_W + "px";
    }
    if (surveyState.docked && typeof pushPage === "function") pushPage(true);
  }
  var SURVEY_ICON_SVG = {
    warn: '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="7" y1="3" x2="7" y2="8"/><circle cx="7" cy="10.6" r=".9" fill="currentColor" stroke="none"/></svg>',
    info: '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="7" y1="6.2" x2="7" y2="10.4"/><circle cx="7" cy="3.6" r=".9" fill="currentColor" stroke="none"/></svg>',
    vraag: '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.3 5.1a1.7 1.7 0 1 1 2.6 1.9c-.6.5-.9 1-.9 1.7"/><circle cx="7" cy="10.6" r=".9" fill="currentColor" stroke="none"/></svg>',
    ok: '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.2l2.6 2.6L11 4"/></svg>',
    sluiten: '<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>'
  };
  function ensureBanner() {
    if (surveyState.bannerEl && document.body.contains(surveyState.bannerEl)) return surveyState.bannerEl;
    surveyState.bannerEl = document.createElement("div");
    Object.assign(surveyState.bannerEl.style, {
      position: "fixed",
      zIndex: "2147483647",
      right: "16px",
      top: "80px",
      left: "auto",
      bottom: "auto",
      transform: "none",
      width: surveyState.PANEL_W + "px",
      minWidth: surveyState.PANEL_W + "px",
      maxWidth: surveyState.PANEL_W + "px",
      maxHeight: "calc(100vh - 100px)",
      background: "#ffffff",
      color: "#201d1f",
      border: "1px solid #ece7e5",
      borderRadius: "14px",
      overflow: "hidden",
      boxShadow: "0 14px 36px rgba(32,20,15,.24)",
      font: '400 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      display: "none",
      flexDirection: "row",
      alignItems: "stretch",
      pointerEvents: "auto"
    });
    const spine = document.createElement("div");
    spine.setAttribute("data-survey-spine", "");
    Object.assign(spine.style, { width: "14px", flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", background: "#cc087d" });
    const icon = document.createElement("span");
    icon.innerHTML = SURVEY_ICON_SVG.warn;
    icon.setAttribute("data-survey-drag-handle", "");
    icon.title = "Sleep de melding";
    Object.assign(icon.style, { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "16px", height: "16px", flex: "0 0 auto", color: "#fff" });
    spine.appendChild(icon);
    const mainCol = document.createElement("div");
    Object.assign(mainCol.style, { flex: "1 1 auto", minWidth: "0", display: "flex", flexDirection: "column" });
    const header = document.createElement("div");
    header.setAttribute("data-survey-header", "");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flex: "0 0 auto",
      background: "#fff",
      color: "#201d1f",
      padding: "10px 12px",
      userSelect: "none",
      borderBottom: "1px solid #f1ecea"
    });
    const title = document.createElement("span");
    title.setAttribute("data-survey-title", "");
    Object.assign(title.style, { flex: "1 1 auto", minWidth: "0", fontSize: "13px", fontWeight: "700" });
    const version = document.createElement("span");
    version.setAttribute("data-survey-version", "");
    version.textContent = "v" + SCRIPT_VERSION;
    version.title = "Geladen versie van de vragenlijstcontrole";
    Object.assign(version.style, { flex: "0 0 auto", fontSize: "10px", fontWeight: "700", color: "#a49a9d" });
    const ctrlStyle = { flex: "0 0 auto", width: "24px", height: "24px", padding: "0", border: "1px solid #ece7e5", borderRadius: "7px", background: "#f6f2f0", color: "#6b6367", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
    const collapse = document.createElement("button");
    collapse.type = "button";
    collapse.setAttribute("data-survey-collapse", "");
    collapse.setAttribute("aria-label", "Melding inklappen");
    Object.assign(collapse.style, ctrlStyle, { font: '700 15px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' });
    const close = document.createElement("button");
    close.type = "button";
    close.innerHTML = SURVEY_ICON_SVG.sluiten;
    close.setAttribute("aria-label", "Melding sluiten");
    Object.assign(close.style, ctrlStyle);
    collapse.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const state = loadChecklist();
      if (!state) return;
      state.collapsed = !state.collapsed;
      saveChecklist(state);
      renderChecklist(state);
    });
    close.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearChecklist();
      hideBanner();
    });
    header.appendChild(title);
    header.appendChild(version);
    header.appendChild(collapse);
    header.appendChild(close);
    const msg = document.createElement("div");
    msg.setAttribute("data-survey-msg", "");
    Object.assign(msg.style, { flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "10px 12px 12px" });
    mainCol.appendChild(header);
    mainCol.appendChild(msg);
    surveyState.bannerEl.appendChild(spine);
    surveyState.bannerEl.appendChild(mainCol);
    (document.body || document.documentElement).appendChild(surveyState.bannerEl);
    let moving = false, dragDX = 0, dragDY = 0, prevUserSelect = "";
    surveyState.bannerEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (surveyState.docked) return;
      const r = surveyState.bannerEl.getBoundingClientRect();
      if (e.clientY > r.top + 44) return;
      if (e.target && e.target.closest && e.target.closest("a,button,input,textarea,select")) return;
      moving = true;
      dragDX = e.clientX - r.left;
      dragDY = e.clientY - r.top;
      surveyState.bannerEl.style.left = r.left + "px";
      surveyState.bannerEl.style.top = r.top + "px";
      surveyState.bannerEl.style.right = "auto";
      surveyState.bannerEl.style.bottom = "auto";
      surveyState.bannerEl.style.transform = "none";
      prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!moving || !surveyState.bannerEl) return;
      e.preventDefault();
      const r = surveyState.bannerEl.getBoundingClientRect();
      const left = Math.min(Math.max(8, e.clientX - dragDX), Math.max(8, window.innerWidth - r.width - 8));
      const top = Math.min(Math.max(8, e.clientY - dragDY), Math.max(8, window.innerHeight - r.height - 8));
      surveyState.bannerEl.style.left = left + "px";
      surveyState.bannerEl.style.top = top + "px";
    }, { passive: false });
    window.addEventListener("mouseup", () => {
      if (!moving || !surveyState.bannerEl) return;
      moving = false;
      document.body.style.userSelect = prevUserSelect;
      const r = surveyState.bannerEl.getBoundingClientRect();
      const state = loadChecklist();
      if (state) {
        state.position = { left: Math.round(r.left), top: Math.round(r.top) };
        saveChecklist(state);
      }
    });
    const grip = document.createElement("div");
    grip.setAttribute("data-survey-resize", "");
    Object.assign(grip.style, {
      position: "absolute",
      left: "0",
      top: "0",
      bottom: "0",
      width: "8px",
      cursor: "ew-resize",
      zIndex: "5",
      background: "transparent",
      touchAction: "none"
    });
    surveyState.bannerEl.appendChild(grip);
    let resizing = false, startX = 0, startW = 0, prevUS2 = "";
    grip.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || !surveyState.docked) return;
      resizing = true;
      startX = e.clientX;
      startW = surveyState.PANEL_W;
      prevUS2 = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      e.preventDefault();
      e.stopPropagation();
    });
    window.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      e.preventDefault();
      applyPanelWidth(startW + (startX - e.clientX));
    }, { passive: false });
    window.addEventListener("mouseup", () => {
      if (!resizing) return;
      resizing = false;
      document.body.style.userSelect = prevUS2;
      try {
        localStorage.setItem(PANEL_W_KEY, String(surveyState.PANEL_W));
      } catch (e) {
      }
    });
    return surveyState.bannerEl;
  }
  function pushPage(on) {
    const body = document.body;
    if (!body) return;
    const avail = "calc(100vw - " + surveyState.PANEL_W + "px)";
    const shells = document.querySelectorAll('.unify-layout,[class*="unify-layout"],[class*="_columns_" i],form');
    if (on) {
      try {
        body.style.setProperty("box-sizing", "border-box", "important");
        body.style.setProperty("padding-right", surveyState.PANEL_W + "px", "important");
      } catch (e) {
      }
      for (const el of shells) {
        try {
          el.style.setProperty("max-width", avail, "important");
          el.style.setProperty("box-sizing", "border-box", "important");
          el.setAttribute("data-ons-helper-pushed", "1");
        } catch (e) {
        }
      }
    } else {
      try {
        body.style.removeProperty("padding-right");
        body.style.removeProperty("box-sizing");
      } catch (e) {
      }
      for (const el of document.querySelectorAll("[data-ons-helper-pushed]")) {
        try {
          el.style.removeProperty("max-width");
          el.style.removeProperty("box-sizing");
          el.removeAttribute("data-ons-helper-pushed");
        } catch (e) {
        }
      }
    }
  }
  function setDock(on) {
    surveyState.docked = !!on;
    if (!surveyState.bannerEl) return;
    if (on) {
      Object.assign(surveyState.bannerEl.style, {
        top: "0",
        right: "0",
        bottom: "0",
        left: "auto",
        transform: "none",
        width: surveyState.PANEL_W + "px",
        minWidth: surveyState.PANEL_W + "px",
        maxWidth: surveyState.PANEL_W + "px",
        height: "auto",
        maxHeight: "none",
        borderRadius: "0",
        boxShadow: "-4px 0 24px rgba(0,0,0,.18)"
      });
    } else {
      Object.assign(surveyState.bannerEl.style, {
        top: "80px",
        right: "16px",
        bottom: "auto",
        left: "auto",
        transform: "none",
        width: surveyState.PANEL_W + "px",
        minWidth: surveyState.PANEL_W + "px",
        maxWidth: surveyState.PANEL_W + "px",
        height: "auto",
        maxHeight: "calc(100vh - 100px)",
        borderRadius: "10px",
        boxShadow: "0 8px 28px rgba(0,0,0,0.28)"
      });
    }
    pushPage(on);
    const handle = surveyState.bannerEl.querySelector("[data-survey-drag-handle]");
    if (handle) handle.style.cursor = on ? "default" : "move";
  }
  function showBanner(text2) {
    const b = ensureBanner();
    const spine = b.querySelector("[data-survey-spine]");
    const title = b.querySelector("[data-survey-title]");
    const icon = b.querySelector("[data-survey-drag-handle]");
    const msg = b.querySelector("[data-survey-msg]");
    if (spine) spine.style.background = "#cc087d";
    if (icon) icon.innerHTML = SURVEY_ICON_SVG.info;
    if (title) title.textContent = text2;
    if (msg) {
      msg.textContent = "";
      msg.style.display = "none";
    }
    setDock(false);
    b.style.display = "flex";
  }
  function surveyActionButton(label, kind, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    const bg = kind === "primary" ? "#cc087d" : kind === "warn" ? "#b45309" : "#f6f2f0";
    const fg = kind === "ghost" ? "#4a4448" : "#fff";
    Object.assign(btn.style, {
      appearance: "none",
      border: kind === "ghost" ? "1px solid #ece7e5" : "0",
      borderRadius: "999px",
      padding: "9px 16px",
      fontWeight: "700",
      cursor: "pointer",
      background: bg,
      color: fg,
      font: '700 13px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      boxShadow: kind === "ghost" ? "none" : "0 4px 12px -5px rgba(0,0,0,.4)"
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    });
    return btn;
  }
  var _awaitingAgeChoice = false;
  function showAgePrompt(reason, onPick) {
    _awaitingAgeChoice = true;
    const pick = (age) => {
      _awaitingAgeChoice = false;
      onPick(age);
    };
    const b = ensureBanner();
    const spine = b.querySelector("[data-survey-spine]");
    const title = b.querySelector("[data-survey-title]");
    const icon = b.querySelector("[data-survey-drag-handle]");
    const msg = b.querySelector("[data-survey-msg]");
    if (spine) spine.style.background = "#b45309";
    if (icon) icon.innerHTML = SURVEY_ICON_SVG.vraag;
    if (title) title.textContent = "Leeftijd van de cliënt bevestigen";
    setDock(false);
    msg.textContent = "";
    msg.style.display = "block";
    const p = document.createElement("div");
    p.textContent = reason || "De leeftijd kon niet automatisch worden bepaald. Is de cliënt jonger dan 12 jaar?";
    Object.assign(p.style, { margin: "2px 0 10px", lineHeight: "1.4" });
    msg.appendChild(p);
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", flexWrap: "wrap", gap: "8px" });
    row.appendChild(surveyActionButton("Ja, jonger dan 12", "primary", () => {
      saveManualAge(true);
      pick(6);
    }));
    row.appendChild(surveyActionButton("Nee, 12 jaar of ouder", "warn", () => {
      saveManualAge(false);
      pick(15);
    }));
    msg.appendChild(row);
    b.style.display = "flex";
  }

  // src/survey/side-panel-bridge.js
  function checklistVoorZijpaneel(state) {
    if (!state || !Array.isArray(state.items)) return null;
    return {
      items: state.items.map(function(i) {
        return {
          question: String(i.question || ""),
          category: String(i.category || ""),
          group: String(i.group || ""),
          done: !!i.done,
          unknown: !!i.unknown
        };
      }),
      signals: (Array.isArray(state.signals) ? state.signals : []).map(function(s) {
        return { question: String(s && s.question || ""), text: String(s && s.signal || "") };
      }),
      respondentWarning: state.respondentWarning ? String(state.respondentWarning) : ""
    };
  }
  function pushChecklist(force) {
    if (!surveyState._zijpaneelOpen) return;
    try {
      const payload = checklistVoorZijpaneel(surveyState._laatsteChecklist);
      if (!payload) return;
      const sig = JSON.stringify(payload);
      if (!force && sig === surveyState._checklistSig) return;
      surveyState._checklistSig = sig;
      chrome.runtime.sendMessage({ type: MSG.SURVEY_STATE, state: payload });
    } catch (e) {
    }
  }
  function openChecklistItem(index) {
    if (!surveyState._laatsteChecklist || !Array.isArray(surveyState._laatsteChecklist.items)) return;
    const item = surveyState._laatsteChecklist.items[index];
    if (!item) return;
    const found = localQuestionForItem(item) || (item.anchorId ? document.getElementById(item.anchorId) : null);
    const q = closestSurveyQuestionBlock(found) || found;
    if (q) {
      try {
        q.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch (e) {
      }
      const focusable = q.querySelector && q.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"],[tabindex]');
      try {
        if (focusable) focusable.focus();
      } catch (e) {
      }
      if (q.style) {
        const oldOutline = q.style.outline, oldOffset = q.style.outlineOffset;
        q.style.outline = "3px solid #cc087d";
        q.style.outlineOffset = "4px";
        setTimeout(function() {
          q.style.outline = oldOutline;
          q.style.outlineOffset = oldOffset;
        }, 3500);
      }
      return;
    }
    try {
      navigateToItemCategory(item);
    } catch (e) {
    }
  }
  function listenForSidePanel() {
    try {
      chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
        if (!msg || typeof msg.type !== "string") return;
        if (msg.type === MSG.SIDEPANEL_STATE) {
          const was = surveyState._zijpaneelOpen;
          surveyState._zijpaneelOpen = !!msg.open;
          if (was === surveyState._zijpaneelOpen) return;
          if (surveyState._zijpaneelOpen) {
            surveyState._checklistSig = "";
            pushChecklist(true);
            if (surveyState.bannerEl) {
              setDock(false);
              surveyState.bannerEl.style.display = "none";
            }
          } else if (surveyState._laatsteChecklist) {
            try {
              renderChecklist(surveyState._laatsteChecklist);
            } catch (e) {
            }
          }
          return;
        }
        if (msg.type === MSG.SURVEY_GET_STATE) {
          surveyState._zijpaneelOpen = true;
          try {
            sendResponse({ state: checklistVoorZijpaneel(surveyState._laatsteChecklist) });
          } catch (e) {
          }
          return true;
        }
        if (msg.type === MSG.SURVEY_OPEN_ITEM) {
          try {
            openChecklistItem(msg.index | 0);
          } catch (e) {
          }
          return;
        }
      });
      chrome.runtime.sendMessage({ type: MSG.SIDEPANEL_QUERY }, function(r) {
        void chrome.runtime.lastError;
        if (r && r.open) {
          surveyState._zijpaneelOpen = true;
          pushChecklist(true);
        }
      });
    } catch (e) {
    }
  }

  // src/survey/checklist-view.js
  function renderChecklist(state) {
    surveyState._laatsteChecklist = state;
    pushChecklist();
    if (surveyState._zijpaneelOpen) {
      try {
        sendBadge(state.items.filter(function(i) {
          return !i.done;
        }).length);
      } catch (e) {
      }
      if (surveyState.bannerEl) {
        setDock(false);
        surveyState.bannerEl.style.display = "none";
      }
      return;
    }
    const b = ensureBanner();
    const spine = b.querySelector("[data-survey-spine]");
    const titleEl = b.querySelector("[data-survey-title]");
    const iconEl = b.querySelector("[data-survey-drag-handle]");
    const msg = b.querySelector("[data-survey-msg]");
    const collapse = b.querySelector("[data-survey-collapse]");
    msg.textContent = "";
    const remaining = state.items.filter((item) => !item.done).length;
    const completed = state.items.length - remaining;
    const unknownRemaining = state.items.filter((item) => item.unknown && !item.done).length;
    const hasRespondentWarning = !!state.respondentWarning;
    const signals = Array.isArray(state.signals) ? state.signals : [];
    const hasSignals = signals.length > 0;
    sendBadge(remaining);
    if (spine) spine.style.background = remaining ? "#cc087d" : hasRespondentWarning || hasSignals ? "#b45309" : "#1b7f3b";
    if (iconEl) iconEl.innerHTML = remaining || hasRespondentWarning || hasSignals ? SURVEY_ICON_SVG.warn : SURVEY_ICON_SVG.ok;
    if (titleEl) titleEl.textContent = remaining ? "Nog " + remaining + " van " + state.items.length + " verplichte " + (state.items.length === 1 ? "vraag" : "vragen") : state.items.length ? "Alle " + completed + " verplichte vragen ingevuld" : "Alle verplichte vragen ingevuld";
    if (titleEl && !remaining && hasRespondentWarning) titleEl.textContent = "Controleer cliënttevredenheid";
    if (titleEl && !remaining && hasSignals) titleEl.textContent = signals.length + " " + (signals.length === 1 ? "signaal" : "signalen");
    if (collapse) {
      collapse.textContent = state.collapsed ? "+" : "−";
      collapse.setAttribute("aria-label", state.collapsed ? "Melding uitklappen" : "Melding inklappen");
    }
    if (state.collapsed) {
      setDock(false);
      if (state.position && Number.isFinite(state.position.left) && Number.isFinite(state.position.top)) {
        const r = b.getBoundingClientRect();
        const left = Math.min(Math.max(8, state.position.left), Math.max(8, window.innerWidth - (r.width || 300) - 8));
        const top = Math.min(Math.max(8, state.position.top), Math.max(8, window.innerHeight - (r.height || 60) - 8));
        b.style.left = left + "px";
        b.style.top = top + "px";
        b.style.right = "auto";
        b.style.bottom = "auto";
        b.style.transform = "none";
      }
      msg.style.display = "none";
      b.style.display = "flex";
      return;
    }
    msg.style.display = "block";
    setDock(true);
    (function addOverrideToolbar() {
      if (!surveyState._pendingOverrideBtn || !remaining) return;
      const bar = document.createElement("div");
      Object.assign(bar.style, { display: "flex", gap: "8px", margin: "2px 0 8px", flexWrap: "wrap" });
      const btn = surveyState._pendingOverrideBtn;
      bar.appendChild(surveyActionButton("Toch doorgaan", "warn", () => {
        surveyState._pendingOverrideBtn = null;
        try {
          statusBypass.add(btn);
          btn.click();
        } finally {
          setTimeout(() => statusBypass.delete(btn), 0);
        }
        hideBanner();
      }));
      msg.appendChild(bar);
    })();
    signals.forEach((entry) => {
      const signalBox = document.createElement("div");
      signalBox.setAttribute("role", "alert");
      Object.assign(signalBox.style, { margin: "4px 0 10px", padding: "10px 11px", borderRadius: "7px", border: "1px solid #f0b429", background: "#fff7d6", color: "#704b00", lineHeight: "1.4" });
      const label = document.createElement("div");
      label.textContent = entry.question || "Signaal";
      Object.assign(label.style, { marginBottom: "4px", fontSize: "11px", fontWeight: "800", color: "#704b00" });
      signalBox.append(label, managedSignalNode(entry.signal, { vraag: entry.question || "", clientNaam: surveyClientName(), clientLeeftijd: state.age == null ? resolvedAge() : state.age }));
      msg.appendChild(signalBox);
    });
    if (state.respondentWarning) {
      const warning = document.createElement("div");
      warning.setAttribute("role", "alert");
      warning.textContent = state.respondentWarning;
      Object.assign(warning.style, {
        margin: "4px 0 10px",
        padding: "10px 11px",
        borderRadius: "7px",
        border: "1px solid #f0b429",
        background: "#fff7d6",
        color: "#704b00",
        fontWeight: "700",
        lineHeight: "1.4"
      });
      msg.appendChild(warning);
    }
    const grouped = /* @__PURE__ */ new Map();
    for (const item of sortChecklistItems(state.items.slice())) {
      const key = item.category + "||" + item.group;
      if (!grouped.has(key)) grouped.set(key, { category: item.category, group: item.group, items: [] });
      grouped.get(key).items.push(item);
    }
    for (const entry of grouped.values()) {
      const heading = document.createElement("div");
      heading.textContent = entry.category === entry.group ? entry.group : entry.category + " > " + entry.group;
      Object.assign(heading.style, { fontWeight: "700", fontSize: "12px", color: "#6b6b6b", margin: "12px 0 4px", paddingBottom: "3px", borderBottom: "1px solid #eee" });
      msg.appendChild(heading);
      const list = document.createElement("ul");
      Object.assign(list.style, { listStyle: "none", margin: "0 0 4px", padding: "0" });
      const onInvulscherm = isSurveyPage();
      for (const item of entry.items) {
        const li = document.createElement("li");
        Object.assign(li.style, { display: "flex", alignItems: "flex-start", gap: "8px", padding: "5px 0", borderBottom: "1px solid #f3f3f3" });
        const link = document.createElement("a");
        const isUnknown = !!item.unknown && !item.done;
        link.textContent = item.question + (isUnknown ? "  — niet automatisch te controleren" : "");
        if (isUnknown) link.title = "Deze verplichte vraag kon niet automatisch worden gecontroleerd. Kijk haar zelf na.";
        const openColor = isUnknown ? "#b45309" : "#cc087d";
        Object.assign(link.style, {
          flex: "1 1 auto",
          minWidth: "0",
          color: item.done ? "#9aa0a6" : openColor,
          textDecoration: item.done ? "line-through" : "none",
          fontWeight: item.done ? "400" : "600",
          cursor: "pointer"
        });
        link.addEventListener("mouseenter", () => {
          if (!item.done) link.style.textDecoration = "underline";
        });
        link.addEventListener("mouseleave", () => {
          if (!item.done) link.style.textDecoration = "none";
        });
        link.tabIndex = 0;
        link.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            link.click();
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const links = Array.prototype.slice.call(msg.querySelectorAll('a[tabindex="0"]'));
            const i = links.indexOf(link);
            const next = links[i + (e.key === "ArrowDown" ? 1 : -1)];
            if (next) next.focus();
          }
        });
        const mark = document.createElement("span");
        mark.textContent = item.done ? "✓" : isUnknown ? "?" : "";
        mark.setAttribute("aria-label", item.done ? "Ingevuld" : isUnknown ? "Niet te controleren" : "Nog niet ingevuld");
        Object.assign(mark.style, item.done || isUnknown ? {
          flex: "0 0 auto",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "1px",
          width: "18px",
          height: "18px",
          borderRadius: "999px",
          background: item.done ? "#1b7f3b" : "#b45309",
          color: "#fff",
          fontWeight: "900",
          fontSize: "11px",
          lineHeight: "1"
        } : { display: "none" });
        const highlightQuestion = (q) => {
          if (!q) return;
          try {
            q.scrollIntoView({ block: "center", behavior: "smooth" });
          } catch (err) {
          }
          const focusable = q.querySelector && q.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"],[tabindex]');
          try {
            if (focusable) focusable.focus();
          } catch (err) {
          }
          if (q.style) {
            const oldOutline = q.style.outline, oldOffset = q.style.outlineOffset;
            q.style.outline = "3px solid #cc087d";
            q.style.outlineOffset = "4px";
            setTimeout(() => {
              q.style.outline = oldOutline;
              q.style.outlineOffset = oldOffset;
            }, 3500);
          }
        };
        if (onInvulscherm) {
          link.setAttribute("role", "button");
          link.addEventListener("click", (e) => {
            e.preventDefault();
            const found = localQuestionForItem(item) || (item.anchorId ? document.getElementById(item.anchorId) : null);
            const q = closestSurveyQuestionBlock(found) || found;
            if (q) {
              highlightQuestion(q);
              return;
            }
            navigateToItemCategory(item);
          });
        } else {
          link.href = item.href || "#";
          link.addEventListener("click", (e) => {
            let target = null;
            try {
              target = new URL(link.href, location.origin);
            } catch (err) {
            }
            let hrefId = "";
            try {
              hrefId = target && target.hash ? decodeURIComponent(target.hash.slice(1)) : "";
            } catch (err) {
            }
            try {
              sessionStorage.setItem(PENDING_QUESTION_KEY, JSON.stringify({
                id: hrefId || item.anchorId,
                href: item.href,
                group: item.group,
                question: item.question,
                ts: Date.now()
              }));
            } catch (err) {
            }
            let sameCategory = false;
            try {
              sameCategory = target.origin === location.origin && target.pathname === location.pathname;
            } catch (err) {
            }
            if (!sameCategory || !target) return;
            const field = hrefId ? document.getElementById(hrefId) : null;
            if (!field) {
              setTimeout(() => focusPendingQuestion(0), 0);
              return;
            }
            e.preventDefault();
            try {
              sessionStorage.removeItem(PENDING_QUESTION_KEY);
            } catch (err) {
            }
            const question = closestSurveyQuestionBlock(field) || field;
            requestAnimationFrame(() => highlightQuestion(question));
          });
        }
        li.appendChild(link);
        li.appendChild(mark);
        list.appendChild(li);
      }
      msg.appendChild(list);
    }
    b.style.display = "flex";
  }
  function showMissingBanner(res, replaceExisting) {
    const previous = loadChecklist();
    const previousDone = new Map((previous && previous.items || []).map((item) => [item.href + "||" + item.question, !!item.done]));
    const incoming = (res.items || res.missing || []).map((item) => {
      const key = item.href + "||" + item.question;
      const local = localQuestionForItem(item);
      return {
        category: item.category,
        group: item.group,
        question: item.question,
        href: item.href,
        anchorId: item.anchorId,
        order: typeof item.order === "number" ? item.order : 0,
        unknown: !!item.unknown && !(local && hasRecognizedControl(local)),
        done: !!item.done || !!previousDone.get(key) || !!(local && hasRecognizedControl(local) && isAnswered(local))
      };
    });
    const items = previous && !replaceExisting ? previous.items.slice() : [];
    const known = new Set(items.map((item) => item.href + "||" + item.question));
    for (const item of incoming) {
      const key = item.href + "||" + item.question;
      if (!known.has(key)) {
        known.add(key);
        items.push(item);
      } else {
        const existing = items.find((it) => it.href + "||" + it.question === key);
        if (existing && typeof item.order === "number" && item.order) existing.order = item.order;
        if (existing && item.done) existing.done = true;
        if (existing) existing.unknown = item.unknown;
      }
    }
    sortChecklistItems(items);
    const state = {
      schema: CHECKLIST_SCHEMA,
      resultId: currentSurveyResultId() || previous && previous.resultId || null,
      collapsed: previous ? !!previous.collapsed : false,
      position: previous && previous.position || null,
      ts: Date.now(),
      age: res.age == null ? previous && previous.age : res.age,
      respondentWarning: res.respondentWarning || "",
      signals: Array.isArray(res.signals) ? res.signals : [],
      items
    };
    saveChecklist(state);
    renderChecklist(state);
  }
  function updateChecklistCompletion() {
    const state = loadChecklist();
    if (!state) return false;
    let changed = false;
    const kept = [];
    for (const item of state.items) {
      const question = localQuestionForItem(item);
      if (question && questionInactiveByPageCode(question)) {
        changed = true;
        continue;
      }
      kept.push(item);
      if (!isSurveyQuestionBlock(question)) continue;
      const recognized = hasRecognizedControl(question);
      const done = recognized ? isAnswered(question) : false;
      const unknown = !recognized;
      if (item.done !== done) {
        item.done = done;
        changed = true;
      }
      if (item.unknown !== unknown) {
        item.unknown = unknown;
        changed = true;
      }
    }
    state.items = kept;
    if (changed) saveChecklist(state);
    renderChecklist(state);
    return true;
  }
  function focusPendingQuestion(attempt) {
    let data = null;
    try {
      data = JSON.parse(sessionStorage.getItem(PENDING_QUESTION_KEY) || "null");
    } catch (e) {
    }
    if (!data || !data.id && !data.question || !data.ts || Date.now() - data.ts > 3e4) {
      try {
        sessionStorage.removeItem(PENDING_QUESTION_KEY);
      } catch (e) {
      }
      return;
    }
    let field = data.id ? document.getElementById(data.id) : null;
    let question = closestSurveyQuestionBlock(field);
    if (!question && data.question) question = localQuestionForItem(data);
    if (!field && question && question.querySelector) field = question.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"],[tabindex]');
    if (field || question) {
      try {
        sessionStorage.removeItem(PENDING_QUESTION_KEY);
      } catch (e) {
      }
      try {
        (question || field).scrollIntoView({ block: "center", behavior: "smooth" });
      } catch (e) {
      }
      try {
        if (field) field.focus();
      } catch (e) {
      }
      if (question && question.style) {
        const oldOutline = question.style.outline;
        const oldOffset = question.style.outlineOffset;
        question.style.outline = "3px solid #cc087d";
        question.style.outlineOffset = "4px";
        setTimeout(() => {
          question.style.outline = oldOutline;
          question.style.outlineOffset = oldOffset;
        }, 3500);
      }
      return;
    }
    if ((attempt || 0) < 60) setTimeout(() => focusPendingQuestion((attempt || 0) + 1), 250);
    else {
      try {
        sessionStorage.removeItem(PENDING_QUESTION_KEY);
      } catch (e) {
      }
    }
  }
  function hideBanner() {
    setDock(false);
    if (surveyState.bannerEl) surveyState.bannerEl.style.display = "none";
    sendBadge(0);
    surveyState._laatsteChecklist = null;
    surveyState._checklistSig = "";
    if (surveyState._zijpaneelOpen) {
      try {
        chrome.runtime.sendMessage({ type: MSG.SURVEY_GONE });
      } catch (e) {
      }
    }
  }
  function refresh() {
    if (_awaitingAgeChoice) return;
    if (!isSurveyPage()) {
      hideBanner();
      return;
    }
    if (!surveyQuestionBlocks().length) {
      if (loadChecklist()) renderChecklist(loadChecklist());
      else hideBanner();
      return;
    }
    const res = evaluate();
    if (loadChecklist()) {
      showMissingBanner(res, false);
      updateChecklistCompletion();
      return;
    }
    if (res.signals && res.signals.length) {
      showMissingBanner(res, true);
      return;
    }
    hideBanner();
  }

  // src/survey/log.js
  function logSurveyError(what, err, level = "error") {
    try {
      const message = err && err.message ? String(err.message) : "";
      console[level]("[ONS-helper survey] " + what + (message ? ": " + message : ""));
    } catch (e) {
    }
  }

  // src/survey/status-guard.js
  function prepareStatusAudit() {
    const pageKey = location.href;
    const detectedAge = resolvedAge();
    if (surveyState.statusAuditPromise && surveyState.statusAuditPage === pageKey && surveyState.statusAuditAge === detectedAge) return surveyState.statusAuditPromise;
    surveyState.statusAuditPage = pageKey;
    surveyState.statusAuditAge = detectedAge;
    surveyState.statusAuditPromise = evaluateAllSurveyCategories(detectedAge, setAuditProgress).catch((err) => {
      surveyState.statusAuditPromise = null;
      throw err;
    });
    return surveyState.statusAuditPromise;
  }
  async function onNextStatusClick(e) {
    const t = e.target;
    if (!t || !t.closest) return;
    const btn = t.closest(nextStatusSel());
    if (!btn || ct(btn.textContent || "") !== "volgende status" || statusBypass.has(btn)) return;
    if (!isJgOutcomeSurvey(document)) return;
    if (!SURVEY_CONFIG.enabled || !SURVEY_CONFIG.surveyAuditEnabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    if (surveyState.statusCheckBusy) return;
    surveyState.statusCheckBusy = true;
    markAuditForResume("next-status");
    showBanner("Verplichte vragen in alle categorieën controleren...");
    try {
      if (clientAgeYears() == null) {
        showBanner("Leeftijd van de cliënt ophalen...");
        await waitForClientAge(2500);
      }
      if (resolvedAge() == null) {
        const reason = clientAgeAmbiguous() ? "Er zijn meerdere cliënten in beeld. Geldt deze vragenlijst voor een cliënt jonger dan 12 jaar?" : "De leeftijd van de cliënt kon niet automatisch worden bepaald. Is de cliënt jonger dan 12 jaar?";
        showAgePrompt(reason, () => {
          surveyState.statusAuditPromise = null;
          surveyState.statusAuditPage = "";
          surveyState.statusAuditAge = void 0;
          onNextStatusClick(e);
        });
        return;
      }
      const res = await prepareStatusAudit();
      if (res.age == null) {
        clearAuditResume();
        showAgePrompt("De leeftijd kon niet worden vastgesteld. Is de cliënt jonger dan 12 jaar?", () => {
          surveyState.statusAuditPromise = null;
          surveyState.statusAuditPage = "";
          surveyState.statusAuditAge = void 0;
          onNextStatusClick(e);
        });
        return;
      }
      if (res.blocked) {
        surveyState._pendingOverrideBtn = btn;
        showMissingBanner(res, true);
        updateChecklistCompletion();
        clearAuditResume();
        return;
      }
      surveyState._pendingOverrideBtn = null;
      clearAuditResume();
      hideBanner();
      statusBypass.add(btn);
      try {
        btn.click();
      } finally {
        setTimeout(() => statusBypass.delete(btn), 0);
      }
    } catch (err) {
      clearAuditResume();
      showBanner("De verplichte vragen konden niet volledig worden gecontroleerd. Probeer het opnieuw of open de vragenlijst via Wijzig.");
      logSurveyError("controle Volgende status mislukt", err, "warn");
    } finally {
      surveyState.statusCheckBusy = false;
    }
  }
  var REQUIRED_NOTIFICATION_TEXT = "u kunt alleen naar de volgende status gaan wanneer alle verplichte vragen zijn beantwoord";
  function requiredNotificationVisible() {
    for (const notification of deepQueryAll('uc-notification[variant="error"]')) {
      const text2 = ct(notification.textContent || "");
      if (text2.indexOf(REQUIRED_NOTIFICATION_TEXT) === -1) continue;
      try {
        const style = getComputedStyle(notification);
        if (style.display === "none" || style.visibility === "hidden" || notification.getClientRects().length === 0) continue;
      } catch (e) {
      }
      return true;
    }
    return false;
  }
  function revealChecklistAfterOnsNotification() {
    if (surveyState.requiredNotificationSeen) return;
    surveyState.requiredNotificationSeen = true;
    surveyState.checklistAuditStarted = true;
    markAuditForResume("ons-notification");
    showBanner("Verplichte vragen ophalen...");
    prepareStatusAudit().then((res) => {
      surveyState.checklistAuditStarted = false;
      if (res) {
        showMissingBanner(res, true);
        updateChecklistCompletion();
      }
      clearAuditResume();
    }).catch((err) => {
      surveyState.checklistAuditStarted = false;
      clearAuditResume();
      showBanner("De verplichte vragen konden niet volledig worden gecontroleerd. Open de vragenlijst via Wijzig en probeer het opnieuw.");
      try {
        document.documentElement.setAttribute("data-ons-agendahulp-survey-error", String(err && (err.stack || err.message) || err));
        logSurveyError("achtergrondcontrole mislukt", err);
      } catch (e) {
      }
    });
  }
  function onEditWhileAuditClick(e) {
    if (!surveyState.checklistAuditStarted && !surveyState.statusCheckBusy) return;
    const t = e.target;
    if (!t || !t.closest) return;
    const trigger = t.closest("a,button,uc-button");
    if (!trigger) return;
    const label = ct(trigger.getAttribute && (trigger.getAttribute("title") || trigger.getAttribute("aria-label")) || trigger.textContent || "");
    if (label !== "wijzig" && label.indexOf("wijzig") !== 0) return;
    const editPath = surveyEditUrlFromOverview();
    const resultId = markAuditForResume("edit-navigation");
    if (!editPath || !resultId) return;
    let target;
    try {
      target = new URL(editPath, location.origin);
      target.searchParams.set(AUDIT_RESUME_PARAM, resultId);
    } catch (err) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    location.assign(target.href);
  }
  function resumeInterruptedAudit() {
    if (surveyState.checklistAuditStarted) return true;
    const pending = readAuditResume();
    if (!pending) return false;
    surveyState.checklistAuditStarted = true;
    showBanner("Verplichte vragen ophalen...");
    prepareStatusAudit().then((res) => {
      surveyState.checklistAuditStarted = false;
      if (res) {
        showMissingBanner(res, true);
        updateChecklistCompletion();
      }
      clearAuditResume();
    }).catch((err) => {
      surveyState.checklistAuditStarted = false;
      clearAuditResume();
      showBanner("De verplichte vragen konden niet volledig worden gecontroleerd. Probeer het opnieuw.");
      try {
        document.documentElement.setAttribute("data-ons-agendahulp-survey-error", String(err && (err.stack || err.message) || err));
        logSurveyError("hervatten achtergrondcontrole mislukt", err);
      } catch (e) {
      }
    });
    return true;
  }

  // src/survey/lifecycle.js
  function onInput() {
    surveyState.statusAuditPromise = null;
    surveyState.statusAuditPage = "";
    surveyState.statusAuditAge = void 0;
    scheduleRefresh();
  }
  function attach() {
    if (surveyState.listenersAttached) return;
    surveyState.listenersAttached = true;
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("click", onEditWhileAuditClick, true);
    document.addEventListener("click", onNextStatusClick, true);
  }
  function tick() {
    if (surveyDisabled()) {
      hideBanner();
      return;
    }
    if (window.top === window && isSurveyEditUrl(location.href) && !surveyQuestionBlocks().length && !saveButtons().length && document.querySelector("iframe")) {
      hideBanner();
      return;
    }
    if (isSurveyPage()) {
      rememberCategoryUrls(categoryEditUrls(document, absoluteSurveyUrl(location.href)), surveyResultId());
      attach();
      if (resumeInterruptedAudit()) return;
      refresh();
    } else if (document.querySelector(nextStatusSel()) || surveyEditUrlFromOverview()) {
      if (SURVEY_CONFIG.surveyAuditEnabled && (!isJgOutcomeSurvey(document) || resolvedAge() != null)) prepareStatusAudit().catch(() => {
      });
      if (SURVEY_CONFIG.surveyAuditEnabled && requiredNotificationVisible()) revealChecklistAfterOnsNotification();
      else surveyState.requiredNotificationSeen = false;
    } else {
      hideBanner();
    }
  }
  function scheduleRefresh() {
    if (surveyState._raf) return;
    surveyState._raf = requestAnimationFrame(() => {
      surveyState._raf = 0;
      try {
        tick();
      } catch (e) {
        logSurveyError("tick mislukt", e);
      }
    });
  }
  function observePageChanges() {
    try {
      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          const t = m.target;
          if (surveyState.bannerEl && (t === surveyState.bannerEl || surveyState.bannerEl.contains && surveyState.bannerEl.contains(t))) continue;
          scheduleRefresh();
          return;
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {
    }
  }
  function onSurveyNavigation() {
    focusPendingQuestion(0);
    scheduleRefresh();
  }

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

  // src/survey/config.js
  var SURVEY_CONFIG = { enabled: true, surveyHelperEnabled: true, surveyAuditEnabled: true };
  var CONFIG_SURVEYS = [];
  var UI_OVERRIDES = {};
  var ctLower = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase().replace(/\s*antwoord wissen\s*$/i, "").replace(/\s*\*+\s*$/, "").trim();
  function parsedSignal(value) {
    const source = value && typeof value === "object" ? value : {};
    const text2 = String(source.text || "").trim();
    return {
      text: text2,
      html: String(source.html || text2),
      color: /^(?:#[0-9a-f]{6}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/i.test(source.color || "") ? source.color : "#704b00",
      bold: source.bold !== false,
      italic: !!source.italic,
      sizePx: Math.max(8, Math.min(40, parseInt(source.sizePx, 10) || 13))
    };
  }
  function parseSurveys(list) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach((s) => {
      const nameLc = ctLower(s && s.name);
      const raw = Array.isArray(s && s.questions) ? s.questions : s && s.question ? [{ question: s.question, op: s.op, value: s.value, value2: s.value2 }] : [];
      const questions = [];
      raw.forEach((q, qIndex) => {
        const textLc = ctLower(q && q.question);
        if (!textLc || textLc.length < 4) return;
        const num = (x) => x === "" || x == null || isNaN(parseInt(x, 10)) ? null : parseInt(x, 10);
        const legacyCondition = q && q.rule === "leeftijd";
        const action = q && q.rule === "signaal_tonen" ? "signaal_tonen" : "vraag_verplicht";
        questions.push({ surveyName: nameLc, textLc, rule: action, condition: q && q.condition || (legacyCondition ? "leeftijd" : "leeftijd"), signal: parsedSignal(q && q.signal), op: q && q.op || ">=", value: num(q && q.value), value2: num(q && q.value2), key: nameLc + "::" + textLc + "::" + qIndex });
      });
      if (nameLc && questions.length) out.push({ nameLc, questions });
    });
    return out;
  }
  function ageSatisfies(age, q) {
    if (!q) return false;
    if (q.condition === "altijd") return true;
    if (age == null || q.condition !== "leeftijd" || q.value == null) return false;
    const a = age, v = q.value, v2 = q.value2;
    switch (q.op) {
      case "=":
        return a === v;
      case ">":
        return a > v;
      case "<":
        return a < v;
      case ">=":
        return a >= v;
      case "<=":
        return a <= v;
      case "<>":
        return v2 != null && a >= v && a <= v2;
      // binnen (grenzen inbegrepen)
      case "><":
        return v2 != null && (a < v || a > v2);
      // buiten
      default:
        return false;
    }
  }
  function allConfigQuestions() {
    const out = [];
    CONFIG_SURVEYS.forEach((s) => {
      s.questions.forEach((q) => out.push(q));
    });
    return out;
  }
  function configQuestionsForText(text2) {
    const L = ctLower(text2);
    if (!L || L.length < 4) return [];
    return allConfigQuestions().filter((q) => q.textLc && (L === q.textLc || L.indexOf(q.textLc) !== -1 || q.textLc.indexOf(L) !== -1));
  }
  function configQuestionForText(text2) {
    const all = configQuestionsForText(text2);
    return all.find((q) => q.rule === "vraag_verplicht") || all[0] || null;
  }
  function applySurveyConfig(cfg) {
    if (!cfg || typeof cfg !== "object") return;
    const hc = cfg.helperConfig && typeof cfg.helperConfig === "object" ? cfg.helperConfig : cfg;
    const features = hc.features || cfg.features || {};
    if (typeof features.surveyRequired === "boolean") SURVEY_CONFIG.surveyHelperEnabled = features.surveyRequired;
    if (typeof features.surveyAudit === "boolean") SURVEY_CONFIG.surveyAuditEnabled = features.surveyAudit;
    if (typeof cfg.enabled === "boolean") SURVEY_CONFIG.enabled = cfg.enabled;
    if (typeof cfg.surveyHelperEnabled === "boolean") SURVEY_CONFIG.surveyHelperEnabled = cfg.surveyHelperEnabled;
    if (typeof cfg.surveyAuditEnabled === "boolean") SURVEY_CONFIG.surveyAuditEnabled = cfg.surveyAuditEnabled;
    if (Array.isArray(hc.surveys)) CONFIG_SURVEYS = parseSurveys(hc.surveys);
    else if (Array.isArray(cfg.surveys)) CONFIG_SURVEYS = parseSurveys(cfg.surveys);
    const us = hc.uiSelectors && typeof hc.uiSelectors === "object" ? hc.uiSelectors : null;
    if (us) {
      for (const k of SURVEY_SELECTOR_KEYS) if (typeof us[k] === "string" && us[k]) UI_OVERRIDES[k] = us[k];
    }
    try {
      scheduleRefresh();
    } catch (e) {
    }
  }
  var SURVEY_SELECTOR_KEYS = ["surveyAgeSelector", "surveyQuestionTextSelector", "surveyClientNameSelector", "surveyTitleSelector", "surveyQuestionSelector", "surveyNextStatusSelector"];
  async function loadSurveyConfig() {
    try {
      const response = await fetch(chrome.runtime.getURL("config.json"));
      const bundled = response.ok ? await response.json() : null;
      if (bundled) applySurveyConfig(bundled);
    } catch (e) {
    }
    const local = await readStorage(chrome.storage.local, [LOCAL.TEST_CONFIG, LOCAL.UI_OVERRIDES]);
    try {
      if (local[LOCAL.TEST_CONFIG]) applySurveyConfig(local[LOCAL.TEST_CONFIG]);
    } catch (e) {
    }
    const managed = await readStorage(chrome.storage.managed, null);
    try {
      applySurveyConfig(managed);
    } catch (e) {
    }
    const overrides = local[LOCAL.UI_OVERRIDES];
    if (overrides && typeof overrides === "object") {
      for (const k of SURVEY_SELECTOR_KEYS) if (typeof overrides[k] === "string" && overrides[k]) UI_OVERRIDES[k] = overrides[k];
      try {
        scheduleRefresh();
      } catch (e) {
      }
    }
  }
  function surveyDisabled() {
    return !SURVEY_CONFIG.enabled || !SURVEY_CONFIG.surveyHelperEnabled;
  }
  function watchSurveyConfig() {
    try {
      if (chrome && chrome.storage && chrome.storage.onChanged) chrome.storage.onChanged.addListener((c, area) => {
        if (area === "managed" || area === "local") loadSurveyConfig();
      });
    } catch (e) {
    }
  }

  // src/survey/start.js
  function startSurveyCheck() {
    watchSurveyConfig();
    loadSurveyConfig();
    loadPanelWidth();
    listenForSidePanel();
    observePageChanges();
    window.addEventListener("locationchange", onSurveyNavigation);
    window.addEventListener("popstate", onSurveyNavigation);
    setInterval(scheduleRefresh, 1200);
    attach();
    focusPendingQuestion(0);
    if (isSurveyEditUrl(location.href) && loadChecklist()) updateChecklistCompletion();
    scheduleRefresh();
  }

  // src/survey/index.js
  (function() {
    if (!/ons-dossier/i.test(location.hostname)) return;
    if (window.name === "ons-helper-survey-scan") return;
    try {
      document.documentElement.setAttribute("data-ons-agendahulp-survey-version", SCRIPT_VERSION);
    } catch (e) {
    }
    startSurveyCheck();
  })();
})();
/*! Bundled license information:

dompurify/dist/purify.es.mjs:
  (*! @license DOMPurify 3.4.17 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.17/LICENSE *)
  (*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE *)
*/
//# sourceMappingURL=survey.js.map
