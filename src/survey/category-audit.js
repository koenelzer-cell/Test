// Alle categorieën van een vragenlijst op de achtergrond controleren
// (verborgen frames, met cache).

import { ct, isSurveyEditUrl, SURVEY_RESPONSE_SEL, SURVEY_VALUE_FIELD_SEL } from './page.js';
import {
  AUDIT_RESUME_PARAM,
  CATEGORY_AUDIT_CACHE_KEY,
  CATEGORY_URLS_KEY,
  CHECKLIST_SCHEMA,
} from './state.js';
import { respondentWarningText, surveyQuestionBlocks } from './questions.js';
import { clientAgeYears } from './client-age.js';
import { evaluate } from './evaluate.js';

export function surveyEditUrlFromOverview() {
  const host = document.querySelector('[data-react-component="SurveyResultHeader"][data-props]');
  if (!host) return null;
  try {
    const props = JSON.parse(host.getAttribute('data-props') || '{}');
    return props && props.actions && props.actions.edit && props.actions.edit.path || null;
  } catch (e) { return null; }
}
export function absoluteSurveyUrl(path) {
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
export function categoryEditUrls(doc, firstUrl) {
  const urls = new Set();
  const normalizedFirst = normalizedSurveyUrl(firstUrl);
  if (normalizedFirst) urls.add(normalizedFirst);
  for (const el of Array.prototype.slice.call(doc.querySelectorAll('[data-action="save-survey"][data-redirect]'))) {
    const url = normalizedSurveyUrl(el.getAttribute('data-redirect'));
    if (url && isSurveyEditUrl(url)) urls.add(url);
  }
  return Array.from(urls);
}
export function surveyResultId(url) {
  const m = String(url || location.href).match(/\/survey_results\/(\d+)/);
  return m ? m[1] : null;
}
export function rememberCategoryUrls(urls, resultId) {
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
export async function evaluateAllSurveyCategories(ageOverride, onProgress) {
  const runAll = (list, ag) => {
    let done = 0;
    const total = list.length;
    if (onProgress) { try { onProgress(0, total); } catch (e) {} }
    return Promise.all(list.map((url) => loadRenderedSurveyMissing(url, ag).then((r) => {
      done++;
      if (onProgress) { try { onProgress(done, total); } catch (e) {} }
      return r;
    })));
  };
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
    results = await runAll(urls, age);
  } else {
    // Eén (of geen) URL bekend: uit de eerste pagina de navigatielinks halen.
    const base = urls[0] || firstUrl;
    if (!base) throw new Error('Geen vragenlijst-URL gevonden');
    const firstDoc = await fetchSurveyDocument(base);
    const discovered = categoryEditUrls(firstDoc, base);
    urls = discovered.length ? discovered : [base];
    rememberCategoryUrls(urls, resultId);
    results = await runAll(urls, age);
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
