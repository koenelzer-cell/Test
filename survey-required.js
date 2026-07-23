(function () {
  'use strict';

  const SCRIPT_VERSION = (function () {
    try { return chrome.runtime.getManifest().version; } catch (e) { return '1.6.34'; }
  })();
  const dbg = function () {
    try { console.debug.apply(console, ['[ONS-helper survey]'].concat(Array.from(arguments))); } catch (e) {}
  };

  // De leeftijdsdetectie zoekt ook in open shadow DOM. Deze helpers stonden in
  // het algemene content-script en moeten in de zelfstandige module aanwezig
  // blijven; zonder deze functies stopte de audit op "controleren...".
  let _shadowRoots = null, _shadowScheduled = false;
  function _collectRoots() {
    const roots = [document];
    const stack = [document];
    while (stack.length) {
      const node = stack.pop();
      let all;
      try { all = node.querySelectorAll('*'); } catch (e) { continue; }
      for (const el of all) if (el.shadowRoot) { roots.push(el.shadowRoot); stack.push(el.shadowRoot); }
    }
    return roots;
  }
  function _roots() {
    if (_shadowRoots) return _shadowRoots;
    _shadowRoots = _collectRoots();
    if (!_shadowScheduled) {
      _shadowScheduled = true;
      queueMicrotask(() => { _shadowRoots = null; _shadowScheduled = false; });
    }
    return _shadowRoots;
  }
  function deepQueryAll(selector, root) {
    if (root) {
      const out = [], seen = new Set();
      const walk = (node) => {
        if (!node || seen.has(node)) return;
        seen.add(node);
        try { out.push(...node.querySelectorAll(selector)); } catch (e) {}
        let all;
        try { all = node.querySelectorAll('*'); } catch (e) { return; }
        for (const el of all) if (el.shadowRoot) walk(el.shadowRoot);
      };
      walk(root);
      return out;
    }
    const out = [];
    for (const currentRoot of _roots()) {
      try { for (const el of currentRoot.querySelectorAll(selector)) out.push(el); } catch (e) {}
    }
    return out;
  }

  if (!/ons-dossier/i.test(location.hostname)) return;
  // Verborgen frames die de module zelf gebruikt om andere categorieen te
  // controleren mogen de module niet opnieuw starten (all_frames-recursie).
  if (window.name === 'ons-helper-survey-scan') return;

  // Dit bestand wordt als eerste content-script geladen. Daardoor blijft de
  // verplichte-vragencontrole werken als een ander onderdeel van content.js op
  // een productiepagina een fout veroorzaakt.
  try {
    document.documentElement.setAttribute('data-ons-agendahulp-survey-version', SCRIPT_VERSION);
    console.info('[ONS-helper survey v' + SCRIPT_VERSION + '] zelfstandig geladen op', location.hostname,
      window.top === window ? '(hoofddocument)' : '(subframe)');
  } catch (e) {}

  /* ===== ONS Dossier: verplichte vragen per categorie/groep controleren ===== */
  (function surveyGuardModule() {
    // Alleen op het dossier (ons-dossier); geen overhead op de agenda-app.
    if (!/ons-dossier/i.test(location.hostname)) return;
    // Zichtbare bevestiging dat het content-script hier draait (helpt bij
    // diagnose: verschijnt dit niet, dan is de extensie niet (her)laden op dit
    // domein of is de pagina niet ververst).
    try { console.info('[ONS-helper] vragenlijst-guard actief op', location.hostname, '(v' + SCRIPT_VERSION + ')'); } catch (e) {}
    let _announcedSurvey = false;
    // Controleer welke leeftijdsafhankelijke vragen nog open staan:
    //   - cliënt < 12 jaar  -> de "Ouder"-vragen moeten ingevuld zijn
    //   - cliënt >= 12 jaar -> de "Jeugdige vanaf 12 jaar"-vragen moeten ingevuld zijn
    // "Vragen" = zowel de tevredenheids-radio als de bijbehorende score.
    const SAVE_SEL = '[data-action="save-survey"]';
    const NEXT_STATUS_SEL = 'button[title="Volgende status"],button[aria-label="Volgende status"]';
    const ct = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    // De aanvullende onderschepping is uitsluitend bedoeld voor JG Outcome.
    // Herken de vragenlijst aan de technische titel in zowel het overzicht als
    // het categorie-/invulscherm, dus niet aan losse vraagteksten of de URL.
    const TARGET_SURVEY_TITLE = 'jg outcome';
    function surveyTitleOf(root) {
      const doc = root || document;
      const header = doc.querySelector('[data-react-component="SurveyResultHeader"][data-props]');
      if (header) {
        try {
          const props = JSON.parse(header.getAttribute('data-props') || '{}');
          if (props && ct(props.title)) return String(props.title).replace(/\s+/g, ' ').trim();
        } catch (e) {}
      }
      const editTitle = doc.querySelector('.mod-status .index h2[title],.mod-status h2[title]');
      if (editTitle) {
        const title = editTitle.getAttribute('title') || editTitle.textContent || '';
        if (ct(title)) return title.replace(/\s+/g, ' ').trim();
      }
      const visibleTitle = doc.querySelector('.mod-survey-result-header h1.ivy-title,[data-react-component="SurveyResultHeader"] h1.ivy-title');
      return visibleTitle && visibleTitle.textContent ? visibleTitle.textContent.replace(/\s+/g, ' ').trim() : '';
    }
    function isJgOutcomeSurvey(root) {
      return ct(surveyTitleOf(root)) === TARGET_SURVEY_TITLE;
    }
    let listenersAttached = false, bannerEl = null, _raf = 0;
    let docked = false;
    // Breedte is instelbaar (console-achtig slepen aan de linkerrand); onthouden.
    const PANEL_W_KEY = 'onsHelper.surveyPanelWidth';
    const PANEL_MIN = 260, PANEL_MAX = 900;
    let PANEL_W = 380;
    try { const w = parseInt(localStorage.getItem(PANEL_W_KEY), 10); if (w >= PANEL_MIN && w <= PANEL_MAX) PANEL_W = w; } catch (e) {}
    function applyPanelWidth(w) {
      PANEL_W = Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.round(w)));
      if (bannerEl) {
        bannerEl.style.width = PANEL_W + 'px';
        bannerEl.style.minWidth = PANEL_W + 'px';
        bannerEl.style.maxWidth = PANEL_W + 'px';
      }
      // Herbereken de pagina-inschuiving (body-padding + max-width van de shells)
      // met de nieuwe breedte, zodat inhoud nooit achter het paneel valt.
      if (docked && typeof pushPage === 'function') pushPage(true);
    }
    const PENDING_QUESTION_KEY = 'onsHelper.pendingSurveyQuestion';
    const CHECKLIST_KEY = 'onsHelper.surveyChecklist';
    const CHECKLIST_SCHEMA = 18;
    const CATEGORY_URLS_KEY = 'onsHelper.surveyCategoryUrls.';
    const CATEGORY_AUDIT_CACHE_KEY = 'onsHelper.surveyCategoryAuditCache';
    const AUDIT_RESUME_KEY = 'onsHelper.surveyAuditResume';
    const AUDIT_RESUME_PARAM = 'ons_helper_resume';
    let statusAuditPromise = null, statusAuditPage = '', statusAuditAge;
    const statusBypass = new WeakSet();
    let statusCheckBusy = false;
    let checklistAuditStarted = false;
    let requiredNotificationSeen = false;

    function saveButtons() {
      return Array.prototype.slice.call(document.querySelectorAll(SAVE_SEL))
        .filter((el) => ct(el.textContent || el.value || '') === 'opslaan');
    }
    // ONS gebruikt meerdere HTML-vormen voor vragen. De meeste formulieren
    // gebruiken .survey_question, maar matrix-/controlelijsten renderen iedere
    // afzonderlijke vraag als een verplichte tabelrij (<tr class="required">).
    // Behandel beide vormen overal als hetzelfde type vraagblok.
    const SURVEY_QUESTION_SEL = '.survey_question,tr.required';
    const SURVEY_RESPONSE_SEL = '.survey_question input,.survey_question textarea,.survey_question select,tr.required input,tr.required textarea,tr.required select';
    const SURVEY_VALUE_FIELD_SEL = '.survey_question input[type="text"],.survey_question input[type="number"],.survey_question textarea,.survey_question select,tr.required input[type="text"],tr.required input[type="number"],tr.required textarea,tr.required select';
    function isSurveyQuestionBlock(el) {
      return !!(el && el.matches && el.matches(SURVEY_QUESTION_SEL));
    }
    function closestSurveyQuestionBlock(el) {
      return el && el.closest ? el.closest(SURVEY_QUESTION_SEL) : null;
    }
    function surveyQuestionBlocks(root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(SURVEY_QUESTION_SEL))
        // Een matrix kan zelf een .survey_question zijn en daarbinnen voor elke
        // echte vraag een tr.required bevatten. Scan dan alleen de rijen, anders
        // komt dezelfde matrix dubbel en met een onjuiste verzameling antwoorden.
        .filter((el) => !(el.matches && el.matches('.survey_question') && el.querySelector('tr.required')));
    }
    // De URL is de vaste bron voor herkenning van het invulscherm. ONS rendert
    // de Opslaan-knop en survey_question-blokken soms pas later via React; daarop
    // wachten maakte dat de checklist op sommige vragenlijsten nooit opkwam.
    function isSurveyEditUrl(rawUrl) {
      try {
        const url = new URL(rawUrl || location.href, location.origin);
        return /\/survey_results\/[^/]+\/categories\/[^/]+\/edit\/?$/.test(url.pathname);
      } catch (e) {
        return /\/survey_results\/[^/]+\/categories\/[^/]+\/edit\/?$/.test(String(rawUrl || location.href).split(/[?#]/)[0]);
      }
    }
    function isSurveyPage() {
      return isSurveyEditUrl(location.href) || (saveButtons().length > 0 && surveyQuestionBlocks().length > 0);
    }
    function directText(el) {
      let t = '';
      if (!el) return t;
      for (const n of el.childNodes) if (n.nodeType === 3) t += n.textContent;
      return t;
    }
    // De vraagtekst staat als directe tekstnode in het label, of (bij vragen met
    // een info-knop) als directe tekstnode van <uc-inline-info> — NIET de
    // tooltip-tekst in de 'slot=info'-span.
    function questionLabelRaw(q) {
      const lbl = q.querySelector('.question-text');
      if (!lbl) return '';
      const info = lbl.querySelector('uc-inline-info');
      return (info && ct(directText(info)) ? directText(info) : directText(lbl)).replace(/\s+/g, ' ').trim();
    }
    function questionLabelText(q) {
      return ct(questionLabelRaw(q));
    }
    function questionGroup(text) {
      if (/^jeugdige vanaf 12 jaar\b/.test(text)) return 'client';
      if (/^ouder\b/.test(text)) return 'parent';
      return null;
    }
    function respondentWarningText(age, wrongGroups) {
      const groups = Array.isArray(wrongGroups) ? wrongGroups : [];
      if (age == null) return '';
      if (age < 12 && groups.indexOf('client') !== -1) {
        return 'Let op, je hebt cliënttevredenheid voor de jeugdige ingevuld in plaats van de ouder.';
      }
      if (age >= 12 && groups.indexOf('parent') !== -1) {
        return 'Let op, je hebt cliënttevredenheid voor de ouder ingevuld in plaats van de jeugdige.';
      }
      return '';
    }
    function readableQuestionText(q) {
      const text = questionLabelRaw(q);
      return (text || 'Vraag zonder titel').replace(/\s*antwoord wissen\s*$/i, '').trim();
    }
    function categoryName(root) {
      const doc = root || document;
      const selected = doc.querySelector('.category_navigation li.selected');
      if (selected && ct(selected.textContent)) return selected.textContent.replace(/\s+/g, ' ').trim();
      const title = doc.querySelector('.category-title,.mod-status .selected');
      return title && title.textContent ? title.textContent.replace(/\s+/g, ' ').trim() : 'Vragenlijst';
    }
    function groupName(q, root) {
      const wrap = q.closest && q.closest('.mod-survey-group,fieldset');
      const heading = wrap && wrap.querySelector('.group-header h2.description,.group-header h2,h2.description,legend');
      return heading && ct(heading.textContent) ? heading.textContent.replace(/\s+/g, ' ').trim() : categoryName(root);
    }
    // Positie van de (huidige) categorie in de navigatie, zodat de checklist in
    // de volgorde van de vragenlijst blijft staan i.p.v. op moment-van-detectie.
    function categoryOrderOf(root) {
      const doc = root || document;
      const nav = Array.prototype.slice.call(doc.querySelectorAll('.category_navigation li'));
      if (!nav.length) return 0;
      const idx = nav.findIndex((li) => li.classList && li.classList.contains('selected'));
      return idx >= 0 ? idx : 0;
    }
    function isRequiredQuestion(q, age, isOutcome) {
      if (!q) return false;
      // JG Outcome bevat twee leeftijdstakken. Een expliciete required-class
      // mag de niet-toepasselijke tak niet alsnog verplicht maken.
      const ageQuestionGroup = questionGroup(questionLabelText(q));
      if (isOutcome && ageQuestionGroup) {
        if (age == null) return false;
        return ageQuestionGroup === (age < 12 ? 'parent' : 'client');
      }
      if (q.classList && q.classList.contains('required')) return true;
      if (q.querySelector('[required],[aria-required="true"]')) return true;
      const props = Array.prototype.slice.call(q.querySelectorAll('[data-props]'))
        .some((el) => /&quot;required&quot;\s*:\s*&quot;required&quot;|"required"\s*:\s*"required"/i.test(el.getAttribute('data-props') || ''));
      if (props) return true;
      return false;
    }
    function questionInactiveByPageCode(q) {
      if (!q) return false;
      if (q.getAttribute('data-ons-helper-rendered-visible') === 'false') return true;
      let node = q;
      const group = q.closest && q.closest('.mod-survey-group');
      while (node && node !== group) {
        const style = ct(node.getAttribute && node.getAttribute('style') || '');
        const cls = ct(node.className || '');
        if ((node.hasAttribute && node.hasAttribute('hidden')) ||
            (node.getAttribute && node.getAttribute('aria-hidden') === 'true') ||
            /display\s*:\s*none|visibility\s*:\s*hidden/.test(style) ||
            /(^|\s)(hidden|is-hidden|conditionally-hidden|collapsed)(\s|$)/.test(cls)) return true;
        node = node.parentElement;
      }
      // Op de echte, actieve pagina is computedStyle de betrouwbaarste bron:
      // ONS heeft daar zijn eigen inklap-/afhankelijkheidslogica al uitgevoerd.
      if (q.ownerDocument === document) {
        try {
          const style = getComputedStyle(q);
          if (style.display === 'none' || style.visibility === 'hidden' || q.getClientRects().length === 0) return true;
        } catch (e) {}
      }
      return false;
    }
    function isAnswered(q) {
      const radios = Array.prototype.slice.call(q.querySelectorAll('input[type="radio"]:not([disabled])'));
      if (radios.length) {
        const checked = radios.find((r) => r.checked);
        if (!checked || String(checked.value || '').trim() === '') return false;
        // Sommige radiokeuzes openen een aanvullend tekst-/datumveld binnen
        // dezelfde optie. Als zo'n veld bestaat, hoort het bij het antwoord.
        const option = checked.closest('div,tr,li,label');
        if (option && option !== q) {
          const dependent = Array.prototype.slice.call(option.querySelectorAll('textarea:not([disabled]),select:not([disabled]),input:not([disabled]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"])'));
          if (dependent.length && !dependent.some((el) => String(el.value == null ? '' : el.value).trim() !== '')) return false;
        }
        return true;
      }
      const checks = Array.prototype.slice.call(q.querySelectorAll('input[type="checkbox"]:not([disabled])'));
      if (checks.length) return checks.some((el) => el.checked);
      const selects = Array.prototype.slice.call(q.querySelectorAll('select:not([disabled])'));
      if (selects.length) return selects.some((el) => String(el.value || '').trim() !== '');
      const fields = Array.prototype.slice.call(q.querySelectorAll('textarea:not([disabled]),input:not([disabled]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"])'));
      if (fields.length) return fields.some((field) => {
        const type = ct(field.getAttribute('type') || field.type || 'text');
        if (type === 'file') return !!((field.files && field.files.length) || String(field.value || '').trim());
        return String(field.value == null ? '' : field.value).trim() !== '';
      });
      const editable = q.querySelector('[contenteditable="true"]');
      if (editable) return ct(editable.textContent || '') !== '';
      // Bij een achtergrond-GET zijn React-vragen nog niet altijd naar een
      // input/textarea gerenderd. Lees dan de opgeslagen waarde uit data-props.
      // Dit vangt o.a. SurveyTextArea, SurveyDateInput en numerieke componenten.
      const reactInputs = Array.prototype.slice.call(q.querySelectorAll('[data-react-component][data-props]'));
      if (reactInputs.length) {
        const hasMeaningfulValue = (value) => {
          if (value == null) return false;
          if (typeof value === 'string') return value.trim() !== '';
          if (typeof value === 'number' || typeof value === 'boolean') return true;
          if (Array.isArray(value)) return value.some(hasMeaningfulValue);
          if (typeof value === 'object') return Object.keys(value).some((key) => hasMeaningfulValue(value[key]));
          return false;
        };
        let recognized = false;
        for (const host of reactInputs) {
          let props = null;
          try { props = JSON.parse(host.getAttribute('data-props') || '{}'); } catch (e) { props = null; }
          if (!props) continue;
          for (const key of ['defaultValue', 'value', 'answer', 'selectedValue', 'selectedValues']) {
            if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
            recognized = true;
            if (hasMeaningfulValue(props[key])) return true;
          }
        }
        if (recognized) return false;
      }
      const custom = Array.prototype.slice.call(q.querySelectorAll('uc-select,uc-input,uc-textarea,[role="combobox"],[role="slider"],[aria-selected],[aria-checked]'));
      if (custom.length) return custom.some((el) => {
        const ariaChecked = el.getAttribute && el.getAttribute('aria-checked');
        const ariaSelected = el.getAttribute && el.getAttribute('aria-selected');
        if (ariaChecked === 'true' || ariaSelected === 'true') return true;
        const value = ('value' in el ? el.value : null) || (el.getAttribute && (el.getAttribute('value') || el.getAttribute('data-value')));
        return String(value == null ? '' : value).trim() !== '';
      });
      return true; // onbekend type -> niet blokkeren
    }
    function clientAgeYears() {
      const selectors = [
        '[data-testid="widget-root"] [data-testid="client-details-birthdate"]',
        '[data-testid="client-details-birthdate"]',
        '[data-testid="avatar-modal-header"] .avatar-dialog__header-detail',
        '.avatar-dialog__header-detail',
        '[data-testid*="birthdate" i]',
        '[class*="birthdate" i]'
      ];
      const candidates = [];
      const seen = new Set();
      // Op productie kan de vragenlijstmodule in een same-origin subframe
      // draaien terwijl de client-header (en dus de leeftijd) in het
      // hoofddocument staat. Scan beide documenten plus eventuele subframes.
      const docs = [];
      const seenDocs = new Set();
      const addDocument = (doc) => {
        if (!doc || seenDocs.has(doc)) return;
        seenDocs.add(doc);
        docs.push(doc);
        let frames = [];
        try { frames = doc.querySelectorAll('iframe,frame'); } catch (e) {}
        for (const frame of frames) {
          try { addDocument(frame.contentDocument); } catch (e) {}
        }
      };
      try { addDocument(window.top.document); } catch (e) { addDocument(document); }
      addDocument(document);
      for (const doc of docs) {
        for (const selector of selectors) {
          let found = [];
          try { found = deepQueryAll(selector, doc); } catch (e) {}
          for (const el of found) {
            if (!seen.has(el)) { seen.add(el); candidates.push(el); }
          }
        }
        let attributed = [];
        try { attributed = deepQueryAll('[datetime],[data-birthdate],[data-date-of-birth],[aria-label*="geboorte" i],[title*="geboorte" i]', doc); } catch (e) {}
        for (const el of attributed) if (!seen.has(el)) { seen.add(el); candidates.push(el); }
      }
      for (const el of candidates) {
        const txt = [
          el.textContent,
          el.getAttribute && el.getAttribute('datetime'),
          el.getAttribute && el.getAttribute('data-birthdate'),
          el.getAttribute && el.getAttribute('data-date-of-birth'),
          el.getAttribute && el.getAttribute('aria-label'),
          el.getAttribute && el.getAttribute('title')
        ].filter(Boolean).join(' ');
        const m = txt.match(/\((\d{1,3})\s*jaar\)|\bleeftijd\s*[:\-]?\s*(\d{1,3})\b/i);
        if (m) {
          const parsed = parseInt(m[1] || m[2], 10);
          if (parsed >= 0 && parsed <= 125) return parsed;
        }
        const d = txt.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
        if (d) {
          const bd = new Date(+d[3], +d[2] - 1, +d[1]);
          if (!isNaN(bd.getTime()) && bd.getFullYear() === +d[3] && bd.getMonth() === +d[2] - 1 && bd.getDate() === +d[1]) {
            const now = new Date();
            let age = now.getFullYear() - bd.getFullYear();
            const mm = now.getMonth() - bd.getMonth();
            if (mm < 0 || (mm === 0 && now.getDate() < bd.getDate())) age--;
            if (age >= 0 && age <= 125) return age;
          }
        }
      }
      return null;
    }
    function waitForClientAge(maxWaitMs) {
      const started = Date.now();
      return new Promise((resolve) => {
        const check = () => {
          const age = clientAgeYears();
          if (age != null || Date.now() - started >= maxWaitMs) { resolve(age); return; }
          setTimeout(check, 100);
        };
        check();
      });
    }
    function evaluate(root, ageOverride, sourceUrl) {
      const doc = root || document;
      const age = ageOverride === undefined ? clientAgeYears() : ageOverride;
      const items = [];
      const missing = [];
      const wrongRespondentGroups = new Set();
      const isOutcome = isJgOutcomeSurvey(doc);
      const catOrder = categoryOrderOf(doc);
      let qIndex = -1;
      for (const q of surveyQuestionBlocks(doc)) {
        qIndex++;
        // Een opgeslagen antwoord uit de verkeerde leeftijdstak kan verborgen
        // zijn. Detecteer het daarom vóór de zichtbaarheidsfilter.
        const answerGroup = questionGroup(questionLabelText(q));
        const expectedGroup = age == null ? null : (age < 12 ? 'parent' : 'client');
        if (isOutcome && answerGroup && expectedGroup && answerGroup !== expectedGroup && isAnswered(q)) {
          wrongRespondentGroups.add(answerGroup);
        }
        if (questionInactiveByPageCode(q) || !isRequiredQuestion(q, age, isOutcome)) continue;
        const done = isAnswered(q);
        const label = q.querySelector('.question-text[for]');
        const labelFor = label && label.getAttribute('for') || '';
        const control = q.querySelector('textarea[id],select[id],input[id]:not([type="hidden"]),[contenteditable="true"][id]');
        let reactId = '';
        if (!control) {
          const reactHost = q.querySelector('[data-react-component][data-props]');
          if (reactHost) {
            try { reactId = JSON.parse(reactHost.getAttribute('data-props') || '{}').id || ''; } catch (e) {}
          }
        }
        const anchorId = q.id || labelFor || (control && control.id) || reactId;
        const baseUrl = sourceUrl || location.href;
        let href = baseUrl;
        try { const u = new URL(baseUrl, location.origin); u.hash = anchorId ? '#' + anchorId : ''; href = u.href; } catch (e) {}
        const item = {
          element: doc === document ? q : null,
          category: categoryName(doc),
          group: groupName(q, doc),
          question: readableQuestionText(q),
          href,
          anchorId,
          // Sorteersleutel: categorievolgorde, dan positie binnen de categorie.
          order: catOrder * 100000 + qIndex,
          done
        };
        items.push(item);
        if (!done) missing.push(item);
      }
      const wrongGroups = Array.from(wrongRespondentGroups);
      const respondentWarning = respondentWarningText(age, wrongGroups);
      return { age, items, missing, wrongRespondentGroups: wrongGroups, respondentWarning, blocked: missing.length > 0 || !!respondentWarning };
    }
    function blockText(res) {
      if (!res || !res.missing || !res.missing.length) return '';
      const grouped = new Map();
      for (const item of res.missing) {
        const key = item.category + '||' + item.group;
        if (!grouped.has(key)) grouped.set(key, { category: item.category, group: item.group, questions: [] });
        grouped.get(key).questions.push(item.question);
      }
      const lines = ['Vul eerst de volgende verplichte vragen in:'];
      for (const entry of grouped.values()) {
        const heading = entry.category === entry.group ? entry.group : entry.category + ' > ' + entry.group;
        lines.push('', heading + ':');
        for (const question of entry.questions) lines.push('• ' + question);
      }
      return lines.join('\n');
    }
    function ensureBanner() {
      if (bannerEl && document.body.contains(bannerEl)) return bannerEl;
      bannerEl = document.createElement('div');
      Object.assign(bannerEl.style, {
        position: 'fixed', zIndex: '2147483647', right: '16px', top: '80px', left: 'auto', bottom: 'auto', transform: 'none',
        width: PANEL_W + 'px', minWidth: PANEL_W + 'px', maxWidth: PANEL_W + 'px', maxHeight: 'calc(100vh - 100px)',
        background: '#ffffff', color: '#222', border: '1px solid #e3e3e3', borderRadius: '10px', overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.22)', font: '400 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        display: 'none', flexDirection: 'column', pointerEvents: 'auto',
      });
      // Kop in dezelfde roze tint als Afspraak-/Registratiehulp.
      const header = document.createElement('div');
      header.setAttribute('data-survey-header', '');
      Object.assign(header.style, {
        display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto',
        background: '#cc087d', color: '#fff', padding: '10px 12px', userSelect: 'none',
      });
      const icon = document.createElement('span');
      icon.textContent = '⚠';
      icon.setAttribute('data-survey-drag-handle', '');
      icon.title = 'Sleep de melding';
      Object.assign(icon.style, { fontSize: '16px', lineHeight: '1', flex: '0 0 auto' });
      const title = document.createElement('span');
      title.setAttribute('data-survey-title', '');
      Object.assign(title.style, { flex: '1 1 auto', minWidth: '0', fontSize: '13px', fontWeight: '700' });
      const version = document.createElement('span');
      version.setAttribute('data-survey-version', '');
      version.textContent = 'v' + SCRIPT_VERSION;
      version.title = 'Geladen versie van de vragenlijstcontrole';
      Object.assign(version.style, { flex: '0 0 auto', fontSize: '10px', fontWeight: '700', opacity: '.82' });
      const ctrlStyle = { flex: '0 0 auto', width: '26px', height: '26px', padding: '0', border: '1px solid rgba(255,255,255,.35)', borderRadius: '7px', background: 'rgba(255,255,255,0.16)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
      const collapse = document.createElement('button');
      collapse.type = 'button';
      collapse.setAttribute('data-survey-collapse', '');
      collapse.setAttribute('aria-label', 'Melding inklappen');
      Object.assign(collapse.style, ctrlStyle, { font: '700 16px/1 system-ui, sans-serif' });
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = '✕';
      close.setAttribute('aria-label', 'Melding sluiten');
      Object.assign(close.style, ctrlStyle, { font: '700 13px/1 system-ui, sans-serif' });
      collapse.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const state = loadChecklist();
        if (!state) return;
        state.collapsed = !state.collapsed;
        saveChecklist(state);
        renderChecklist(state);
      });
      close.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearChecklist(); hideBanner(); });
      header.appendChild(icon);
      header.appendChild(title);
      header.appendChild(version);
      header.appendChild(collapse);
      header.appendChild(close);
      // Witte, scrollbare inhoud.
      const msg = document.createElement('div');
      msg.setAttribute('data-survey-msg', '');
      Object.assign(msg.style, { flex: '1 1 auto', minHeight: '0', overflowY: 'auto', padding: '10px 12px 12px' });
      bannerEl.appendChild(header);
      bannerEl.appendChild(msg);
      (document.body || document.documentElement).appendChild(bannerEl);
      let moving = false, dragDX = 0, dragDY = 0, prevUserSelect = '';
      bannerEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (docked) return; // gedockt paneel is niet sleepbaar
        const r = bannerEl.getBoundingClientRect();
        // De volledige bovenste strook is een sleepgreep; links en knoppen
        // behouden hun normale klikgedrag.
        if (e.clientY > r.top + 44) return;
        if (e.target && e.target.closest && e.target.closest('a,button,input,textarea,select')) return;
        moving = true;
        dragDX = e.clientX - r.left;
        dragDY = e.clientY - r.top;
        bannerEl.style.left = r.left + 'px';
        bannerEl.style.top = r.top + 'px';
        bannerEl.style.right = 'auto';
        bannerEl.style.bottom = 'auto';
        bannerEl.style.transform = 'none';
        // Tekstselectie/auto-scroll uitzetten tijdens het slepen (anders "scrollt"
        // de pagina i.p.v. dat de melding meebeweegt).
        prevUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (!moving || !bannerEl) return;
        e.preventDefault();
        const r = bannerEl.getBoundingClientRect();
        const left = Math.min(Math.max(8, e.clientX - dragDX), Math.max(8, window.innerWidth - r.width - 8));
        const top = Math.min(Math.max(8, e.clientY - dragDY), Math.max(8, window.innerHeight - r.height - 8));
        bannerEl.style.left = left + 'px';
        bannerEl.style.top = top + 'px';
      }, { passive: false });
      window.addEventListener('mouseup', () => {
        if (!moving || !bannerEl) return;
        moving = false;
        document.body.style.userSelect = prevUserSelect;
        const r = bannerEl.getBoundingClientRect();
        const state = loadChecklist();
        if (state) { state.position = { left: Math.round(r.left), top: Math.round(r.top) }; saveChecklist(state); }
      });
      // Resize-greep aan de linkerrand (console-achtig). Cursor = ew-resize
      // (dubbele horizontale pijl). Slepen past de breedte + de pagina-marge aan.
      const grip = document.createElement('div');
      grip.setAttribute('data-survey-resize', '');
      Object.assign(grip.style, {
        position: 'absolute', left: '0', top: '0', bottom: '0', width: '8px',
        cursor: 'ew-resize', zIndex: '5', background: 'transparent', touchAction: 'none'
      });
      bannerEl.appendChild(grip);
      let resizing = false, startX = 0, startW = 0, prevUS2 = '';
      grip.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !docked) return;   // alleen het gedockte paneel is resizebaar
        resizing = true; startX = e.clientX; startW = PANEL_W;
        prevUS2 = document.body.style.userSelect; document.body.style.userSelect = 'none';
        e.preventDefault(); e.stopPropagation();
      });
      window.addEventListener('mousemove', (e) => {
        if (!resizing) return;
        e.preventDefault();
        // Naar links slepen = breder (paneel zit rechts).
        applyPanelWidth(startW + (startX - e.clientX));
      }, { passive: false });
      window.addEventListener('mouseup', () => {
        if (!resizing) return;
        resizing = false;
        document.body.style.userSelect = prevUS2;
        try { localStorage.setItem(PANEL_W_KEY, String(PANEL_W)); } catch (e) {}
      });
      return bannerEl;
    }
    // Bepaal de hoogte van een vaste bovenbalk zodat het paneel eronder begint
    // (en de balk met menu/zoek/avatar niet afdekt).
    function topBarHeight() {
      let h = 0;
      try {
        const vw = window.innerWidth;
        const seen = new Set();
        const consider = (el) => {
          if (!el || el.nodeType !== 1 || seen.has(el) || el === bannerEl || (bannerEl && bannerEl.contains(el))) return;
          seen.add(el);
          const r = el.getBoundingClientRect();
          if (r.top > 3 || r.height < 24 || r.height > 200 || r.width < vw * 0.6) return;
          let pos = '';
          try { pos = getComputedStyle(el).position; } catch (e) {}
          // Alleen balken die blíjven staan (fixed/sticky) schuiven de inhoud niet
          // mee; alleen die moeten we ontwijken.
          if (pos === 'fixed' || pos === 'sticky') h = Math.max(h, r.bottom);
        };
        document.querySelectorAll('header,[role="banner"],nav,[class*="header" i],[class*="topbar" i],[class*="top-bar" i],[class*="navbar" i],[class*="appbar" i],[class*="app-bar" i],[class*="masthead" i],[class*="toolbar" i]').forEach(consider);
        // Generieke fallback: pak de vaste/sticky balken die daadwerkelijk
        // bovenaan het venster liggen (klasse-onafhankelijk).
        try { (document.elementsFromPoint ? document.elementsFromPoint(vw / 2, 8).concat(document.elementsFromPoint(vw - 40, 8)) : []).forEach((el) => { let n = el; for (let i = 0; n && i < 6; i++, n = n.parentElement) consider(n); }); } catch (e) {}
      } catch (e) {}
      return h || 56;
    }
    // Duw de pagina-inhoud opzij voor het gedockte paneel. Bewust ALLEEN via
    // padding op <body> (met border-box): dat verkleint de beschikbare ruimte
    // voor de app-inhoud zonder de eigen layout-containers te forceren (dat brak
    // de app / maakte het scherm leeg). Vaste balken schuiven niet mee, daarom
    // begint het paneel onder de bovenbalk.
    function pushPage(on) {
      const body = document.body;
      if (!body) return;
      const avail = 'calc(100vw - ' + PANEL_W + 'px)';
      // Layout-containers die de inhoud dragen; die begrenzen we met MAX-width
      // (niet width/right — dat maakte het scherm eerder leeg), zodat brede inhoud
      // niet achter het paneel valt.
      const shells = document.querySelectorAll('.unify-layout,[class*="unify-layout"],[class*="_columns_" i],form');
      if (on) {
        try {
          body.style.setProperty('box-sizing', 'border-box', 'important');
          body.style.setProperty('padding-right', PANEL_W + 'px', 'important');
        } catch (e) {}
        for (const el of shells) {
          try {
            el.style.setProperty('max-width', avail, 'important');
            el.style.setProperty('box-sizing', 'border-box', 'important');
            el.setAttribute('data-ons-helper-pushed', '1');
          } catch (e) {}
        }
      } else {
        try { body.style.removeProperty('padding-right'); body.style.removeProperty('box-sizing'); } catch (e) {}
        for (const el of document.querySelectorAll('[data-ons-helper-pushed]')) {
          try { el.style.removeProperty('max-width'); el.style.removeProperty('box-sizing'); el.removeAttribute('data-ons-helper-pushed'); } catch (e) {}
        }
      }
    }
    // Dock de melding rechts (zoals de DevTools-console): eigen kolom onder de
    // bovenbalk, en de pagina-inhoud schuift ernaast. Uit -> kleine 'pill'.
    function setDock(on) {
      docked = !!on;
      if (!bannerEl) return;
      if (on) {
        // Volledige hoogte: de body-padding maakt de rechterstrook over de héle
        // hoogte vrij (ook de bovenbalk schuift mee naar links), dus het paneel
        // begint bovenaan om die strook helemaal te vullen — geen grijze ruimte.
        Object.assign(bannerEl.style, {
          top: '0', right: '0', bottom: '0', left: 'auto', transform: 'none',
          width: PANEL_W + 'px', minWidth: PANEL_W + 'px', maxWidth: PANEL_W + 'px', height: 'auto', maxHeight: 'none',
          borderRadius: '0', boxShadow: '-4px 0 24px rgba(0,0,0,.18)'
        });
      } else {
        Object.assign(bannerEl.style, {
          top: '80px', right: '16px', bottom: 'auto', left: 'auto', transform: 'none',
          width: PANEL_W + 'px', minWidth: PANEL_W + 'px', maxWidth: PANEL_W + 'px', height: 'auto',
          maxHeight: 'calc(100vh - 100px)', borderRadius: '10px', boxShadow: '0 8px 28px rgba(0,0,0,0.28)'
        });
      }
      pushPage(on);
      const handle = bannerEl.querySelector('[data-survey-drag-handle]');
      if (handle) handle.style.cursor = on ? 'default' : 'move';
    }
    function showBanner(text) {
      const b = ensureBanner();
      const header = b.querySelector('[data-survey-header]');
      const title = b.querySelector('[data-survey-title]');
      const icon = b.querySelector('[data-survey-drag-handle]');
      const msg = b.querySelector('[data-survey-msg]');
      if (header) header.style.background = '#cc087d';
      if (icon) icon.textContent = 'ℹ';
      if (title) title.textContent = text;
      if (msg) { msg.textContent = ''; msg.style.display = 'none'; }
      setDock(false);
      b.style.display = 'flex';
    }
    // Identificeer de vragenlijst die nú op het scherm staat (survey_results/<id>),
    // zodat de checklist aan déze vragenlijst hangt en niet die van een eerder
    // gecontroleerde vragenlijst blijft tonen.
    function currentSurveyResultId() {
      const fromLoc = surveyResultId(location.href);
      if (fromLoc) return fromLoc;
      try {
        const editPath = surveyEditUrlFromOverview();
        const abs = editPath ? absoluteSurveyUrl(editPath) : null;
        return abs ? surveyResultId(abs) : null;
      } catch (e) { return null; }
    }
    // Een volledige vragenlijstaudit kan meerdere categorieen laden. Als de
    // gebruiker tijdens dat werk op Wijzig klikt, wordt het oude document
    // afgebroken. Bewaar daarom expliciet dat dezelfde audit in het nieuwe
    // document moet worden hervat. De URL-marker is een fallback voor
    // omgevingen waarin sessionStorage voor content-scripts niet beschikbaar is.
    function markAuditForResume(reason) {
      const resultId = currentSurveyResultId();
      if (!resultId) return null;
      try {
        sessionStorage.setItem(AUDIT_RESUME_KEY, JSON.stringify({
          schema: CHECKLIST_SCHEMA,
          resultId,
          reason: String(reason || ''),
          age: clientAgeYears(),
          ts: Date.now()
        }));
      } catch (e) {}
      return resultId;
    }
    function readAuditResume() {
      const currentId = currentSurveyResultId();
      try {
        const url = new URL(location.href);
        const urlId = url.searchParams.get(AUDIT_RESUME_PARAM);
        if (urlId && (!currentId || urlId === currentId)) {
          return { schema: CHECKLIST_SCHEMA, resultId: urlId, reason: 'edit-navigation', ts: Date.now(), fromUrl: true };
        }
      } catch (e) {}
      try {
        const state = JSON.parse(sessionStorage.getItem(AUDIT_RESUME_KEY) || 'null');
        if (!state || state.schema !== CHECKLIST_SCHEMA || !state.resultId || !state.ts || Date.now() - state.ts > 5 * 60 * 1000) {
          try { sessionStorage.removeItem(AUDIT_RESUME_KEY); } catch (e2) {}
          return null;
        }
        if (currentId && state.resultId !== currentId) return null;
        return state;
      } catch (e) { return null; }
    }
    function clearAuditResume() {
      try { sessionStorage.removeItem(AUDIT_RESUME_KEY); } catch (e) {}
      try {
        const url = new URL(location.href);
        if (!url.searchParams.has(AUDIT_RESUME_PARAM)) return;
        url.searchParams.delete(AUDIT_RESUME_PARAM);
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      } catch (e) {}
    }
    function loadChecklist() {
      try {
        const state = JSON.parse(sessionStorage.getItem(CHECKLIST_KEY) || 'null');
        if (!state || state.schema !== CHECKLIST_SCHEMA || !Array.isArray(state.items) || !state.ts || Date.now() - state.ts > 4 * 60 * 60 * 1000) return null;
        // Hoort deze checklist bij een andere vragenlijst? Dan negeren/opruimen.
        const cur = currentSurveyResultId();
        if (state.resultId && cur && state.resultId !== cur) { clearChecklist(); return null; }
        return state;
      } catch (e) { return null; }
    }
    function saveChecklist(state) {
      if (!state) return;
      state.ts = Date.now();
      if (!state.resultId) state.resultId = currentSurveyResultId() || null;
      try { sessionStorage.setItem(CHECKLIST_KEY, JSON.stringify(state)); } catch (e) {}
    }
    function clearChecklist() {
      try { sessionStorage.removeItem(CHECKLIST_KEY); } catch (e) {}
    }
    // Houd de checklist in vragenlijst-volgorde (categorie, dan positie), zodat een
    // vraag die je middenin wijzigt op zijn eigen plek blijft i.p.v. onderaan.
    function sortChecklistItems(items) {
      if (!Array.isArray(items)) return items;
      items.sort((a, b) => ((a && a.order) || 0) - ((b && b.order) || 0));
      return items;
    }
    function itemTargetsCurrentPage(item) {
      try {
        const target = new URL(item.href, location.origin);
        const current = new URL(location.href);
        target.searchParams.delete('ons_helper_focus');
        current.searchParams.delete('ons_helper_focus');
        target.searchParams.delete(AUDIT_RESUME_PARAM);
        current.searchParams.delete(AUDIT_RESUME_PARAM);
        return target.origin === current.origin && target.pathname === current.pathname && target.search === current.search;
      } catch (e) { return false; }
    }
    function localQuestionForItem(item) {
      if (!item || !itemTargetsCurrentPage(item)) return null;
      if (item.anchorId) {
        const field = document.getElementById(item.anchorId);
        if (field) return closestSurveyQuestionBlock(field) || field;
      }
      // React kan het oorspronkelijke id vervangen of later renderen. Zoek dan
      // binnen de juiste groep op de zichtbare vraagtekst.
      return surveyQuestionBlocks(document).find((q) =>
        readableQuestionText(q) === item.question && groupName(q, document) === item.group) || null;
    }
    // Navigeer naar de categorie waarin een checklist-vraag valt en onthoud welke
    // vraag daarna gehighlight moet worden. Bewust ZONDER hash (die zou op de
    // huidige pagina het naar-boven-springen veroorzaken); het scrollen/highlighten
    // gebeurt na aankomst via focusPendingQuestion.
    function navigateToItemCategory(item) {
      if (!item || !item.href) return;
      try {
        sessionStorage.setItem(PENDING_QUESTION_KEY, JSON.stringify({
          id: item.anchorId || '', anchorId: item.anchorId || '', href: item.href, group: item.group, question: item.question, ts: Date.now()
        }));
      } catch (e) {}
      let url = item.href;
      try { const u = new URL(item.href, location.origin); u.hash = ''; url = u.href; } catch (e) {}
      try { location.assign(url); } catch (e) { try { location.href = url; } catch (e2) {} }
    }
    function renderChecklist(state) {
      const b = ensureBanner();
      const header = b.querySelector('[data-survey-header]');
      const titleEl = b.querySelector('[data-survey-title]');
      const iconEl = b.querySelector('[data-survey-drag-handle]');
      const msg = b.querySelector('[data-survey-msg]');
      const collapse = b.querySelector('[data-survey-collapse]');
      msg.textContent = '';
      const remaining = state.items.filter((item) => !item.done).length;
      const completed = state.items.length - remaining;
      const hasRespondentWarning = !!state.respondentWarning;
      // Roze kop (huisstijl) als er nog vragen open staan, groen als alles klaar is.
      if (header) header.style.background = remaining ? '#cc087d' : (hasRespondentWarning ? '#b45309' : '#1b7f3b');
      if (iconEl) iconEl.textContent = remaining ? '⚠' : '✓';
      if (titleEl) titleEl.textContent = remaining
        ? ('Nog ' + remaining + ' van ' + state.items.length + ' verplichte ' + (state.items.length === 1 ? 'vraag' : 'vragen'))
        : (state.items.length ? ('Alle ' + completed + ' verplichte vragen ingevuld') : 'Alle verplichte vragen ingevuld');
      if (titleEl && !remaining && hasRespondentWarning) titleEl.textContent = 'Controleer cliënttevredenheid';
      if (collapse) {
        collapse.textContent = state.collapsed ? '+' : '−';
        collapse.setAttribute('aria-label', state.collapsed ? 'Melding uitklappen' : 'Melding inklappen');
      }
      if (state.collapsed) {
        // Ingeklapt: alleen de gekleurde kop (compacte pill), niet gedockt.
        setDock(false);
        if (state.position && Number.isFinite(state.position.left) && Number.isFinite(state.position.top)) {
          const r = b.getBoundingClientRect();
          const left = Math.min(Math.max(8, state.position.left), Math.max(8, window.innerWidth - (r.width || 300) - 8));
          const top = Math.min(Math.max(8, state.position.top), Math.max(8, window.innerHeight - (r.height || 60) - 8));
          b.style.left = left + 'px'; b.style.top = top + 'px'; b.style.right = 'auto'; b.style.bottom = 'auto'; b.style.transform = 'none';
        }
        msg.style.display = 'none';
        b.style.display = 'flex';
        return;
      }
      msg.style.display = 'block';
      // Uitgeklapt: rechts gedockt zoals de console; de pagina schuift ernaast.
      setDock(true);
      if (state.respondentWarning) {
        const warning = document.createElement('div');
        warning.setAttribute('role', 'alert');
        warning.textContent = state.respondentWarning;
        Object.assign(warning.style, {
          margin: '4px 0 10px', padding: '10px 11px', borderRadius: '7px',
          border: '1px solid #f0b429', background: '#fff7d6', color: '#704b00',
          fontWeight: '700', lineHeight: '1.4'
        });
        msg.appendChild(warning);
      }
      const grouped = new Map();
      for (const item of sortChecklistItems(state.items.slice())) {
        const key = item.category + '||' + item.group;
        if (!grouped.has(key)) grouped.set(key, { category: item.category, group: item.group, items: [] });
        grouped.get(key).items.push(item);
      }
      for (const entry of grouped.values()) {
        const heading = document.createElement('div');
        heading.textContent = entry.category === entry.group ? entry.group : entry.category + ' > ' + entry.group;
        Object.assign(heading.style, { fontWeight: '700', fontSize: '12px', color: '#6b6b6b', textTransform: 'uppercase', letterSpacing: '.02em', margin: '12px 0 4px', paddingBottom: '3px', borderBottom: '1px solid #eee' });
        msg.appendChild(heading);
        const list = document.createElement('ul');
        Object.assign(list.style, { listStyle: 'none', margin: '0 0 4px', padding: '0' });
        const onInvulscherm = isSurveyPage();
        for (const item of entry.items) {
          const li = document.createElement('li');
          Object.assign(li.style, { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f3f3f3' });
          const link = document.createElement('a');
          link.textContent = item.question;
          Object.assign(link.style, {
            flex: '1 1 auto', minWidth: '0',
            color: item.done ? '#9aa0a6' : '#cc087d',
            textDecoration: item.done ? 'line-through' : 'none',
            fontWeight: item.done ? '400' : '600', cursor: 'pointer'
          });
          link.addEventListener('mouseenter', () => { if (!item.done) link.style.textDecoration = 'underline'; });
          link.addEventListener('mouseleave', () => { if (!item.done) link.style.textDecoration = 'none'; });
          const mark = document.createElement('span');
          mark.textContent = item.done ? '✓' : '';
          mark.setAttribute('aria-label', item.done ? 'Ingevuld' : 'Nog niet ingevuld');
          Object.assign(mark.style, item.done ? {
            flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px',
            width: '18px', height: '18px', borderRadius: '999px',
            background: '#1b7f3b', color: '#fff', fontWeight: '900', fontSize: '11px', lineHeight: '1'
          } : { display: 'none' });
          const highlightQuestion = (q) => {
            if (!q) return;
            try { q.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) {}
            const focusable = q.querySelector && q.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"],[tabindex]');
            try { if (focusable) focusable.focus(); } catch (err) {}
            if (q.style) {
              const oldOutline = q.style.outline, oldOffset = q.style.outlineOffset;
              q.style.outline = '3px solid #cc087d'; q.style.outlineOffset = '4px';
              setTimeout(() => { q.style.outline = oldOutline; q.style.outlineOffset = oldOffset; }, 3500);
            }
          };
          if (onInvulscherm) {
            // Op het invulscherm GEEN href: een href zet de URL-hash en dan springt
            // de pagina bij elke React-render terug omhoog. Klikken scrolt hooguit
            // naar de vraag als die op deze pagina staat; nooit navigeren/hash zetten.
            link.setAttribute('role', 'button');
            link.addEventListener('click', (e) => {
              e.preventDefault();
              const found = localQuestionForItem(item) || (item.anchorId ? document.getElementById(item.anchorId) : null);
              const q = closestSurveyQuestionBlock(found) || found;
              if (q) { highlightQuestion(q); return; }
              // Vraag staat in een andere categorie: ga daarheen en highlight na aankomst.
              navigateToItemCategory(item);
            });
          } else {
            link.href = item.href || '#';
            link.addEventListener('click', (e) => {
              let target = null;
              try { target = new URL(link.href, location.origin); } catch (err) {}
              let hrefId = '';
              try { hrefId = target && target.hash ? decodeURIComponent(target.hash.slice(1)) : ''; } catch (err) {}
              try {
                sessionStorage.setItem(PENDING_QUESTION_KEY, JSON.stringify({
                  id: hrefId || item.anchorId, href: item.href, group: item.group, question: item.question, ts: Date.now()
                }));
              } catch (err) {}
              let sameCategory = false;
              try {
                sameCategory = target.origin === location.origin && target.pathname === location.pathname;
              } catch (err) {}
              if (!sameCategory || !target) return; // gewone href werkt tussen categorieën/vanuit overzicht
              const field = hrefId ? document.getElementById(hrefId) : null;
              if (!field) { setTimeout(() => focusPendingQuestion(0), 0); return; }
              e.preventDefault();
              try { sessionStorage.removeItem(PENDING_QUESTION_KEY); } catch (err) {}
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
      b.style.display = 'flex';
    }
    function showMissingBanner(res, replaceExisting) {
      const previous = loadChecklist();
      const previousDone = new Map((previous && previous.items || []).map((item) => [item.href + '||' + item.question, !!item.done]));
      // Een volledige audit levert alle actieve verplichte vragen aan, inclusief
      // reeds ingevulde vragen. Zo verdwijnt een vraag niet uit de lijst wanneer
      // de gebruiker haar invult terwijl de achtergrondcontrole nog loopt.
      const incoming = (res.items || res.missing || []).map((item) => {
        const key = item.href + '||' + item.question;
        const local = localQuestionForItem(item);
        return {
          category: item.category,
          group: item.group,
          question: item.question,
          href: item.href,
          anchorId: item.anchorId,
          order: typeof item.order === 'number' ? item.order : 0,
          done: !!item.done || !!previousDone.get(key) || !!(local && isAnswered(local))
        };
      });
      const items = previous && !replaceExisting ? previous.items.slice() : [];
      const known = new Set(items.map((item) => item.href + '||' + item.question));
      for (const item of incoming) {
        const key = item.href + '||' + item.question;
        if (!known.has(key)) { known.add(key); items.push(item); }
        else {
          // Bestaand item: werk de sorteervolgorde bij (kan initieel 0 zijn geweest).
          const existing = items.find((it) => (it.href + '||' + it.question) === key);
          if (existing && typeof item.order === 'number' && item.order) existing.order = item.order;
          if (existing && item.done) existing.done = true;
        }
      }
      sortChecklistItems(items);
      const state = {
        schema: CHECKLIST_SCHEMA,
        resultId: currentSurveyResultId() || (previous && previous.resultId) || null,
        collapsed: previous ? !!previous.collapsed : false,
        position: previous && previous.position || null,
        ts: Date.now(),
        respondentWarning: res.respondentWarning || '',
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
        if (question && questionInactiveByPageCode(question)) { changed = true; continue; }
        kept.push(item);
        if (!isSurveyQuestionBlock(question)) continue;
        const done = isAnswered(question);
        if (item.done !== done) { item.done = done; changed = true; }
      }
      state.items = kept;
      if (changed) saveChecklist(state);
      renderChecklist(state);
      return true;
    }
    function focusPendingQuestion(attempt) {
      let data = null;
      try { data = JSON.parse(sessionStorage.getItem(PENDING_QUESTION_KEY) || 'null'); } catch (e) {}
      if (!data || (!data.id && !data.question) || !data.ts || Date.now() - data.ts > 30000) {
        try { sessionStorage.removeItem(PENDING_QUESTION_KEY); } catch (e) {}
        return;
      }
      let field = data.id ? document.getElementById(data.id) : null;
      let question = closestSurveyQuestionBlock(field);
      if (!question && data.question) question = localQuestionForItem(data);
      if (!field && question && question.querySelector) field = question.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"],[tabindex]');
      if (field || question) {
        try { sessionStorage.removeItem(PENDING_QUESTION_KEY); } catch (e) {}
        try { (question || field).scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
        try { if (field) field.focus(); } catch (e) {}
        if (question && question.style) {
          const oldOutline = question.style.outline;
          const oldOffset = question.style.outlineOffset;
          question.style.outline = '3px solid #cc087d';
          question.style.outlineOffset = '4px';
          setTimeout(() => { question.style.outline = oldOutline; question.style.outlineOffset = oldOffset; }, 3500);
        }
        return;
      }
      if ((attempt || 0) < 60) setTimeout(() => focusPendingQuestion((attempt || 0) + 1), 250);
      else { try { sessionStorage.removeItem(PENDING_QUESTION_KEY); } catch (e) {} }
    }
    function hideBanner() { setDock(false); if (bannerEl) bannerEl.style.display = 'none'; }
    function refresh() {
      if (!isSurveyPage()) { hideBanner(); return; }
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
      hideBanner();
    }
    function surveyEditUrlFromOverview() {
      const host = document.querySelector('[data-react-component="SurveyResultHeader"][data-props]');
      if (!host) return null;
      try {
        const props = JSON.parse(host.getAttribute('data-props') || '{}');
        return props && props.actions && props.actions.edit && props.actions.edit.path || null;
      } catch (e) { return null; }
    }
    function absoluteSurveyUrl(path) {
      try { return new URL(path, location.origin).href; } catch (e) { return null; }
    }
    function normalizedSurveyUrl(path) {
      try {
        const url = new URL(path, location.origin);
        url.hash = '';
        url.searchParams.delete('ons_helper_focus');
        url.searchParams.delete(AUDIT_RESUME_PARAM);
        return url.href;
      } catch (e) { return null; }
    }
    function categoryEditUrls(doc, firstUrl) {
      const urls = new Set();
      const normalizedFirst = normalizedSurveyUrl(firstUrl);
      if (normalizedFirst) urls.add(normalizedFirst);
      for (const el of Array.prototype.slice.call(doc.querySelectorAll('[data-action="save-survey"][data-redirect]'))) {
        const url = normalizedSurveyUrl(el.getAttribute('data-redirect'));
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
        const current = JSON.parse(sessionStorage.getItem(CATEGORY_URLS_KEY + id) || '[]');
        const merged = Array.from(new Set(current.concat(urls).map(normalizedSurveyUrl).filter(Boolean)));
        sessionStorage.setItem(CATEGORY_URLS_KEY + id, JSON.stringify(merged));
      } catch (e) {}
    }
    function rememberedCategoryUrls(resultId) {
      if (!resultId) return [];
      try {
        return Array.from(new Set(JSON.parse(sessionStorage.getItem(CATEGORY_URLS_KEY + resultId) || '[]')
          .map(normalizedSurveyUrl)
          .filter((url) => url && isSurveyEditUrl(url))));
      } catch (e) { return []; }
    }
    async function fetchSurveyDocument(url) {
      const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return new DOMParser().parseFromString(await response.text(), 'text/html');
    }
    function categoryResourceVersion(doc) {
      const field = doc && doc.querySelector && doc.querySelector('#resource-version,[name="resource_version"]');
      return field ? String(field.value || field.getAttribute('value') || '').trim() : '';
    }
    function categoryAuditCacheId(url, resourceVersion, age) {
      if (!resourceVersion) return '';
      let normalized = String(url || '');
      try {
        const parsed = new URL(normalized, location.origin);
        parsed.hash = '';
        parsed.searchParams.delete('ons_helper_focus');
        parsed.searchParams.delete(AUDIT_RESUME_PARAM);
        normalized = parsed.href;
      } catch (e) {}
      return [CHECKLIST_SCHEMA, normalized, resourceVersion, age == null ? 'unknown' : age].join('|');
    }
    function readCategoryAuditCache(url, resourceVersion, age) {
      const id = categoryAuditCacheId(url, resourceVersion, age);
      if (!id) return null;
      try {
        const all = JSON.parse(sessionStorage.getItem(CATEGORY_AUDIT_CACHE_KEY) || '{}');
        const entry = all[id];
        if (!entry || !entry.ts || Date.now() - entry.ts > 30 * 60 * 1000 || !entry.result) return null;
        return entry.result;
      } catch (e) { return null; }
    }
    function writeCategoryAuditCache(url, resourceVersion, age, result) {
      const id = categoryAuditCacheId(url, resourceVersion, age);
      if (!id || !result) return;
      try {
        const all = JSON.parse(sessionStorage.getItem(CATEGORY_AUDIT_CACHE_KEY) || '{}');
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
      } catch (e) {}
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
          visible = style.display !== 'none' && style.visibility !== 'hidden' && q.getClientRects().length > 0;
        } catch (e) {}
        visibilityParts.push(qIndex + ':' + (visible ? '1' : '0') + ':' + (q.disabled ? '1' : '0'));
        const fields = Array.prototype.slice.call(q.querySelectorAll('input,textarea,select,[contenteditable="true"],[aria-checked],[aria-selected]'));
        for (let fIndex = 0; fIndex < fields.length; fIndex++) {
          const field = fields[fIndex];
          const type = ct(field.getAttribute && field.getAttribute('type') || field.tagName || '');
          const value = String(('value' in field ? field.value : null) ?? (field.textContent || '')).trim();
          const checked = !!field.checked || field.getAttribute && (field.getAttribute('aria-checked') === 'true' || field.getAttribute('aria-selected') === 'true');
          answerParts.push([qIndex, fIndex, type, checked ? '1' : '0', value, field.disabled ? '1' : '0'].join(':'));
          if ((type === 'radio' || type === 'checkbox') && checked && value !== '') {
            filled++;
            hasAnsweredChoice = true;
          } else if (field.tagName === 'SELECT' && value !== '') {
            filled++;
            hasAnsweredChoice = true;
          } else if (type !== 'radio' && type !== 'checkbox' && value !== '') filled++;
        }
        for (const host of Array.prototype.slice.call(q.querySelectorAll('[data-react-component][data-props]'))) {
          answerParts.push('react:' + qIndex + ':' + (host.getAttribute('data-props') || ''));
        }
      }
      const form = doc.querySelector('[data-number-of-react-inputs]');
      const expectedRaw = form && parseInt(form.getAttribute('data-number-of-react-inputs'), 10);
      const expectedReact = Number.isFinite(expectedRaw) ? expectedRaw : null;
      const mountedReact = (form || doc).querySelectorAll('[data-react-component][data-props]').length;
      const responseCount = doc.querySelectorAll(SURVEY_RESPONSE_SEL).length;
      const reactReady = expectedReact == null
        ? (responseCount > 0 || mountedReact > 0)
        : mountedReact >= expectedReact;
      return {
        questions,
        answerSignature: answerParts.join('|'),
        visibilitySignature: visibilityParts.join('|'),
        filled,
        hasAnsweredChoice,
        reactReady,
        expectedReact,
        mountedReact,
        responseCount
      };
    }
    // Laad een categorie in een verborgen iframe (zodat ONS de voorwaardelijke
    // logica uitvoert) en evalueer de LIVE inputs. Cruciaal: NIET via outerHTML
    // opnieuw parsen — React zet antwoorden als .checked/.value PROPERTY en die
    // gaan bij serialiseren verloren, waardoor alles onterecht 'niet ingevuld'
    // leek ("25 van 25" terwijl alles is ingevuld).
    async function loadRenderedSurveyMissing(url, age) {
      try {
        return await new Promise((resolve, reject) => {
          const frame = document.createElement('iframe');
          frame.name = 'ons-helper-survey-scan';
          Object.assign(frame.style, {
            position: 'fixed', left: '-12000px', top: '0', width: '1200px', height: '900px',
            opacity: '0', pointerEvents: 'none', border: '0', zIndex: '-1'
          });
          let finished = false, poll = null, observer = null, timeout = null;
          const started = Date.now();
          const finish = (err, result) => {
            if (finished) return;
            finished = true;
            if (poll) clearInterval(poll);
            if (observer) observer.disconnect();
            if (timeout) clearTimeout(timeout);
            try { frame.remove(); } catch (e) {}
            if (err) reject(err);
            else resolve({
              url,
              items: result.items || [],
              missing: result.missing || [],
              wrongRespondentGroups: result.wrongRespondentGroups || []
            });
          };
          timeout = setTimeout(() => finish(new Error('Gerenderde vragenlijst timeout')), 6500);
          const complete = (doc, resourceVersion) => {
            try {
              const win = frame.contentWindow;
              for (const q of surveyQuestionBlocks(doc)) {
                let active = true;
                try {
                  const style = win.getComputedStyle(q);
                  active = style.display !== 'none' && style.visibility !== 'hidden' && q.getClientRects().length > 0;
                } catch (e) {}
                q.setAttribute('data-ons-helper-rendered-visible', active ? 'true' : 'false');
              }
              const result = evaluate(doc, age, url);   // LIVE document
              writeCategoryAuditCache(url, resourceVersion || categoryResourceVersion(doc), age, result);
              finish(null, result);
            } catch (e) { finish(e); }
          };
          frame.onload = () => {
            let initialDoc = null;
            try { initialDoc = frame.contentDocument; } catch (e) {}
            const resourceVersion = categoryResourceVersion(initialDoc);
            const cached = readCategoryAuditCache(url, resourceVersion, age);
            if (cached) { finish(null, cached); return; }

            let lastAnswerSignature = null, lastVisibilitySignature = null;
            let lastAnswerChangeAt = started, lastVisibilityChangeAt = started;
            let lastRelevantMutationAt = started, firstReadyAt = 0;
            try {
              const mutationRoot = initialDoc.querySelector('[data-survey-input-form],form.edit_survey_result') || initialDoc.body;
              const FrameMutationObserver = frame.contentWindow.MutationObserver || MutationObserver;
              observer = new FrameMutationObserver(() => { lastRelevantMutationAt = Date.now(); });
              observer.observe(mutationRoot, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'disabled', 'checked', 'value', 'aria-checked', 'aria-selected']
              });
            } catch (e) {}
            poll = setInterval(() => {
              let doc = null;
              try { doc = frame.contentDocument; } catch (e) {}
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

              // Gebruik ONS' React-teller als primaire gereedheidsmarker. Oude
              // vragenlijsten met een afwijkende teller mogen na 1,8 seconde
              // doorgaan zodra het document en de vraagstructuur stabiel zijn.
              const ready = state.reactReady || (elapsed > 1800 && doc.readyState !== 'loading');
              if (!ready) {
                if (elapsed > 5200) complete(doc, resourceVersion);
                return;
              }
              if (!firstReadyAt) firstReadyAt = now;

              // Keuzevelden kunnen een conditionele tak aansturen en krijgen
              // daarom langer om hun zichtbaarheidseffect uit te voeren. Lege,
              // tekst- en datumformulieren zijn na een korte rustperiode klaar.
              const answerQuiet = state.hasAnsweredChoice ? 1400 : 450;
              const visibilityQuiet = state.hasAnsweredChoice ? 450 : 350;
              const stable = now - lastAnswerChangeAt >= answerQuiet &&
                now - lastVisibilityChangeAt >= visibilityQuiet &&
                now - lastRelevantMutationAt >= 250 &&
                now - firstReadyAt >= 250;
              if (stable || elapsed > 5200) complete(doc, resourceVersion);
            }, 100);
            return;

            // Legacy polling blijft hieronder alleen als leesbare referentie;
            // het adaptieve pad hierboven handelt iedere onload af.
            let lastSig = '', stable = 0, everFilled = false, lastChangeAt = Date.now();
            poll = setInterval(() => {
              let doc = null;
              try { doc = frame.contentDocument; } catch (e) {}
              if (!doc || !surveyQuestionBlocks(doc).length) return;
              // Tel de reeds ingevulde antwoorden. React laadt opgeslagen waarden
              // ná het mounten; we mogen pas concluderen als die geladen zijn,
              // anders lijken ingevulde vragen leeg -> valse "X van X"-melding.
              let filled = 0;
              try {
                // Een lege, standaard aangevinkte "niet beantwoord"-radio telt
                // niet als geladen antwoord. Dat voorkomt een te vroege scan.
                for (const f of doc.querySelectorAll('.survey_question input:checked,tr.required input:checked,.survey_question [aria-checked="true"],tr.required [aria-checked="true"]')) {
                  if (String(f.value == null ? '' : f.value).trim() !== '') filled++;
                }
                for (const f of doc.querySelectorAll(SURVEY_VALUE_FIELD_SEL)) {
                  if (String(f.value == null ? '' : f.value).trim() !== '') filled++;
                }
              } catch (e) {}
              if (filled > 0) everFilled = true;
              // Tel de daadwerkelijk ZICHTBARE vragen (getClientRects = 0 bij
              // display:none/verborgen). ONS past conditionele verbergingen (bijv.
              // "Nieuw doel toevoegen? = Nee" -> vervolgvragen weg) ná het laden van
              // de antwoorden toe; door dit in de 'stabiel'-signatuur op te nemen
              // wachten we tot die verbergingen zijn doorgevoerd — anders worden
              // net-verborgen vervolgvragen onterecht als verplicht geteld.
               const questions = surveyQuestionBlocks(doc);
               let visibleQ = 0, hiddenQ = 0;
               try {
                 for (const q of questions) {
                   if (q.getClientRects().length > 0) visibleQ++;
                   else hiddenQ++;
                 }
               } catch (e) {}
               const sig = [
                 questions.length,
                 doc.querySelectorAll(SURVEY_RESPONSE_SEL).length,
                 hiddenQ,
                filled,
                visibleQ
              ].join('|');
              if (sig === lastSig) stable++;
              else {
                stable = 0;
                lastSig = sig;
                lastChangeAt = Date.now();
              }
              const elapsed = Date.now() - started;
              const settledFor = Date.now() - lastChangeAt;
              // Klaar zodra we antwoorden hebben zien laden én het beeld (incl. de
              // conditionele zichtbaarheid) even stabiel is. Voor een écht lege
              // vragenlijst blijft 'everFilled' false; dan pas na de ruimere
              // bovengrens concluderen (voorkomt valse meldingen).
              // ONS vult eerst de opgeslagen controller in en verwerkt daarna
              // pas de conditionele vervolgvragen. Wacht daarom tot antwoorden
              // en zichtbaarheid minimaal 1,2 seconde ongewijzigd zijn.
              if ((everFilled && elapsed > 1500 && settledFor > 1200 && stable >= 8) || elapsed > 5200) complete(doc);
            }, 120);
          };
          frame.onerror = () => { clearTimeout(timeout); finish(new Error('Gerenderde vragenlijst laden mislukt')); };
          frame.src = url;
          (document.body || document.documentElement).appendChild(frame);
        });
      } catch (e) {
        dbg('gerenderde vragenlijst niet beschikbaar; statische fallback', url, e);
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
    async function evaluateAllSurveyCategories(ageOverride) {
      const onCategoryPage = isSurveyEditUrl(location.href);
      // firstUrl uit de overzicht-header, of — op het invulscherm — uit de huidige URL.
      const firstUrl = absoluteSurveyUrl(surveyEditUrlFromOverview()) || (onCategoryPage ? absoluteSurveyUrl(location.href) : null);
      const resultId = surveyResultId(firstUrl || location.href);
      const age = ageOverride === undefined ? clientAgeYears() : ageOverride;
      let urls = rememberedCategoryUrls(resultId);
      // Zorg dat de huidige categorie erbij zit (invulscherm).
      if (onCategoryPage) {
        const cur = normalizedSurveyUrl(location.href);
        if (cur && urls.indexOf(cur) === -1) urls = urls.concat([cur]);
      }
      let results;
      if (urls.length > 1) {
        // Laat ONS zelf alle conditionele/inklapvragen uitvoeren en laad parallel.
        results = await Promise.all(urls.map((url) => loadRenderedSurveyMissing(url, age)));
      } else {
        // Eén (of geen) URL bekend: uit de eerste pagina de navigatielinks halen.
        const base = urls[0] || firstUrl;
        if (!base) throw new Error('Geen vragenlijst-URL gevonden');
        const firstDoc = await fetchSurveyDocument(base);
        const discovered = categoryEditUrls(firstDoc, base);
        urls = discovered.length ? discovered : [base];
        rememberCategoryUrls(urls, resultId);
        results = await Promise.all(urls.map((url) => loadRenderedSurveyMissing(url, age)));
      }
      const items = [];
      const missing = [];
      const seen = new Set();
      const wrongRespondentGroups = new Set();
      for (const res of results) {
        for (const group of (res.wrongRespondentGroups || [])) wrongRespondentGroups.add(group);
        for (const item of (res.items || res.missing || [])) {
          const key = [item.href, item.question].join('||');
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
    function prepareStatusAudit() {
      const pageKey = location.href;
      const detectedAge = clientAgeYears();
      // Een vroege React-render kan nog geen client-header bevatten. Bewaar een
      // null-resultaat daarom niet zodra de leeftijd later wel beschikbaar is.
      if (statusAuditPromise && statusAuditPage === pageKey && statusAuditAge === detectedAge) return statusAuditPromise;
      statusAuditPage = pageKey;
      statusAuditAge = detectedAge;
      statusAuditPromise = evaluateAllSurveyCategories(detectedAge).catch((err) => {
        statusAuditPromise = null;
        throw err;
      });
      return statusAuditPromise;
    }
    // Toon de checklist al tijdens het invullen (niet pas bij "Volgende status"),
    // zodat je meteen alle openstaande vragen ziet én de controle al klaar is als
    // je verder wilt. Draait de audit één keer; daarna live-updates via refresh().
    function legacyEnsureSurveyChecklist() {
      if (loadChecklist() || checklistAuditStarted) return;
      checklistAuditStarted = true;
      // Direct feedback geven zodra de edit-URL wordt herkend; de gebruiker
      // hoeft niet te wachten tot alle React-velden zichtbaar zijn.
      showBanner('Verplichte vragen controleren...');
      prepareStatusAudit().then((res) => {
        checklistAuditStarted = false;
        if (res && !loadChecklist()) showMissingBanner(res, true);
      }).catch((err) => {
        checklistAuditStarted = false;
        try {
          document.documentElement.setAttribute('data-ons-agendahulp-survey-error', String(err && (err.stack || err.message) || err));
          console.error('[ONS-helper survey] controle laden mislukt', err);
        } catch (e) {}
      });
    }
    async function onNextStatusClick(e) {
      const t = e.target;
      if (!t || !t.closest) return;
      const btn = t.closest(NEXT_STATUS_SEL);
      if (!btn || ct(btn.textContent || '') !== 'volgende status' || statusBypass.has(btn)) return;
      // Nooit een statusknop van een andere soort vragenlijst onderscheppen.
      if (!isJgOutcomeSurvey(document)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (statusCheckBusy) return;
      statusCheckBusy = true;
      markAuditForResume('next-status');
      showBanner('Verplichte vragen in alle categorieën controleren...');
      try {
        if (clientAgeYears() == null) {
          showBanner('Leeftijd van de cliënt ophalen...');
          await waitForClientAge(2500);
        }
        const res = await prepareStatusAudit();
        if (res.age == null) {
          clearAuditResume();
          showBanner('De leeftijd van de cliënt kon niet worden vastgesteld. Ververs de pagina en probeer Volgende status opnieuw.');
          return;
        }
        if (res.blocked) {
          showMissingBanner(res, true);
          updateChecklistCompletion();
          clearAuditResume();
          return;
        }
        clearAuditResume();
        hideBanner();
        statusBypass.add(btn);
        try { btn.click(); } finally { setTimeout(() => statusBypass.delete(btn), 0); }
      } catch (err) {
        clearAuditResume();
        showBanner('De verplichte vragen konden niet volledig worden gecontroleerd. Probeer het opnieuw of open de vragenlijst via Wijzig.');
        try { console.warn('[ONS-helper] controle Volgende status mislukt', err); } catch (e2) {}
      } finally {
        statusCheckBusy = false;
      }
    }
    const REQUIRED_NOTIFICATION_TEXT = 'u kunt alleen naar de volgende status gaan wanneer alle verplichte vragen zijn beantwoord';
    function requiredNotificationVisible() {
      for (const notification of deepQueryAll('uc-notification[variant="error"]')) {
        const text = ct(notification.textContent || '');
        if (text.indexOf(REQUIRED_NOTIFICATION_TEXT) === -1) continue;
        try {
          const style = getComputedStyle(notification);
          if (style.display === 'none' || style.visibility === 'hidden' || notification.getClientRects().length === 0) continue;
        } catch (e) {}
        return true;
      }
      return false;
    }
    // Reservepad voor het geval ONS zelf alsnog een foutmelding toont, bijv.
    // wanneer de pagina tijdens een statusovergang opnieuw is opgebouwd.
    function revealChecklistAfterOnsNotification() {
      if (requiredNotificationSeen) return;
      requiredNotificationSeen = true;
      checklistAuditStarted = true;
      markAuditForResume('ons-notification');
      showBanner('Verplichte vragen ophalen...');
      prepareStatusAudit().then((res) => {
        checklistAuditStarted = false;
        if (res) {
          showMissingBanner(res, true);
          updateChecklistCompletion();
        }
        clearAuditResume();
      }).catch((err) => {
        checklistAuditStarted = false;
        clearAuditResume();
        showBanner('De verplichte vragen konden niet volledig worden gecontroleerd. Open de vragenlijst via Wijzig en probeer het opnieuw.');
        try {
          document.documentElement.setAttribute('data-ons-agendahulp-survey-error', String(err && (err.stack || err.message) || err));
          console.error('[ONS-helper survey] achtergrondcontrole mislukt', err);
        } catch (e) {}
      });
    }
    // Klikt de gebruiker tijdens de lopende achtergrondcontrole op Wijzig, dan
    // navigeert ONS naar een nieuw document en verdwijnen alle open promises.
    // Voeg alleen in dat specifieke geval een tijdelijke hervatmarker toe aan
    // de bestaande edit-URL. Op de editpagina start de audit daarmee direct
    // opnieuw en gebruikt hij reeds afgeronde categorieen uit de versiecache.
    function onEditWhileAuditClick(e) {
      if (!checklistAuditStarted && !statusCheckBusy) return;
      const t = e.target;
      if (!t || !t.closest) return;
      const trigger = t.closest('a,button,uc-button');
      if (!trigger) return;
      const label = ct((trigger.getAttribute && (trigger.getAttribute('title') || trigger.getAttribute('aria-label'))) || trigger.textContent || '');
      if (label !== 'wijzig' && label.indexOf('wijzig') !== 0) return;
      const editPath = surveyEditUrlFromOverview();
      const resultId = markAuditForResume('edit-navigation');
      if (!editPath || !resultId) return;
      let target;
      try {
        target = new URL(editPath, location.origin);
        target.searchParams.set(AUDIT_RESUME_PARAM, resultId);
      } catch (err) { return; }
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      location.assign(target.href);
    }
    function resumeInterruptedAudit() {
      // Zolang de hervatte promise loopt, mag refresh() het laadpaneel niet
      // verbergen doordat er nog geen checklist in storage staat.
      if (checklistAuditStarted) return true;
      const pending = readAuditResume();
      if (!pending) return false;
      checklistAuditStarted = true;
      showBanner('Verplichte vragen ophalen...');
      prepareStatusAudit().then((res) => {
        checklistAuditStarted = false;
        if (res) {
          showMissingBanner(res, true);
          updateChecklistCompletion();
        }
        clearAuditResume();
      }).catch((err) => {
        checklistAuditStarted = false;
        clearAuditResume();
        showBanner('De verplichte vragen konden niet volledig worden gecontroleerd. Probeer het opnieuw.');
        try {
          document.documentElement.setAttribute('data-ons-agendahulp-survey-error', String(err && (err.stack || err.message) || err));
          console.error('[ONS-helper survey] hervatten achtergrondcontrole mislukt', err);
        } catch (e) {}
      });
      return true;
    }
    function onInput() {
      statusAuditPromise = null;
      statusAuditPage = '';
      statusAuditAge = undefined;
      scheduleRefresh();
    }
    function attach() {
      if (listenersAttached) return;
      listenersAttached = true;
      // Capture + stopImmediatePropagation, want de knop gebruikt data-prevent-default
      // en een gedelegeerde 'save-survey'-handler.
      document.addEventListener('input', onInput, true);
      document.addEventListener('change', onInput, true);
      document.addEventListener('click', onEditWhileAuditClick, true);
      document.addEventListener('click', onNextStatusClick, true);
    }
    function tick() {
      // De gewone audit en melding werken voor iedere vragenlijst. Alleen de
      // fysieke Volgende-statusonderschepping en leeftijdsregels zijn elders
      // expliciet beperkt tot JG Outcome.
      // Productie kan de echte vragenlijst in een iframe tonen. Laat het lege
      // hoofddocument dan geen tweede, eeuwig ladend paneel opbouwen; de module
      // in het subframe neemt de controle over zodra daar de vragen verschijnen.
      if (window.top === window && isSurveyEditUrl(location.href) &&
          !surveyQuestionBlocks().length && !saveButtons().length && document.querySelector('iframe')) {
        _announcedSurvey = false;
        hideBanner();
        return;
      }
      if (isSurveyPage()) {
        rememberCategoryUrls(categoryEditUrls(document, absoluteSurveyUrl(location.href)), surveyResultId());
        if (!_announcedSurvey) {
          _announcedSurvey = true;
          try { console.info('[ONS-helper] vragenlijst gedetecteerd - checklistupdates actief. Leeftijd:', clientAgeYears()); } catch (e) {}
        }
        attach();
        if (resumeInterruptedAudit()) return;
        refresh();
      } else if (document.querySelector(NEXT_STATUS_SEL) || surveyEditUrlFromOverview()) {
        // Start voordat de gebruiker klikt; meestal is het resultaat dan direct beschikbaar.
        if (!isJgOutcomeSurvey(document) || clientAgeYears() != null) prepareStatusAudit().catch(() => {});
        if (requiredNotificationVisible()) revealChecklistAfterOnsNotification();
        else requiredNotificationSeen = false;
      } else {
        _announcedSurvey = false;
        hideBanner();
      }
    }
    function scheduleRefresh() {
      if (_raf) return;
      _raf = requestAnimationFrame(() => {
        _raf = 0;
        try { tick(); }
        catch (e) { try { console.error('[ONS-helper survey] tick mislukt', e); } catch (e2) {} }
      });
    }
    try {
      // Negeer mutaties binnen ons eigen paneel, anders ontstaat een refresh-lus:
      // renderChecklist herbouwt de paneelinhoud -> observer -> refresh -> ...
      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          const t = m.target;
          if (bannerEl && (t === bannerEl || (bannerEl.contains && bannerEl.contains(t)))) continue;
          scheduleRefresh();
          return;
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    // Bij navigatie (ook SPA/soft-nav tussen categorieën) opnieuw proberen de
    // aangeklikte vraag te focussen — anders werkt doorklikken alleen vanaf het
    // overzicht (volledige paginalading) en niet van vraag naar vervolgvraag.
    function onSurveyNavigation() { focusPendingQuestion(0); scheduleRefresh(); }
    window.addEventListener('locationchange', onSurveyNavigation);
    window.addEventListener('popstate', onSurveyNavigation);
    // Houd het gedockte paneel op de juiste hoogte als de bovenbalk verandert
    // (resize, scroll met sticky balk).
    function repositionDock() {
      // Gedockt paneel staat vast op top:0 (volledige hoogte); niets te herpositioneren.
    }
    setInterval(scheduleRefresh, 1200);
    attach();
    focusPendingQuestion(0);
    if (isSurveyEditUrl(location.href) && loadChecklist()) updateChecklistCompletion();
    scheduleRefresh();
  })();
})();
