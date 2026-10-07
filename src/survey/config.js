// Welke vragenlijsten en vragen verplicht zijn (config.surveys uit het
// beheerscherm), en de aan/uit-schakelaars. Lagen: config.json, beleid, lokale
// testconfig.

import { scheduleRefresh } from './lifecycle.js';
import { LOCAL } from '../shared/storage-keys.js';
import { readStorage } from '../shared/chrome-storage.js';

// (#2 uitrol) Kill-switch/config voor de vragenlijst (chrome.storage.managed,
// door IT via beleid te zetten). Fail-open: aan tenzij expliciet false.
//   enabled              -> hoofdschakelaar
//   surveyHelperEnabled  -> vragenlijst-checklist tonen
//   surveyAuditEnabled   -> achtergrond-audit + Volgende-status-onderschepping
export const SURVEY_CONFIG = { enabled: true, surveyHelperEnabled: true, surveyAuditEnabled: true };
// (#geen-vangnet) De leeftijdsafhankelijke verplichte vragen komen UITSLUITEND
// uit het beheerscherm (config.surveys). Er is geen hard-coded terugval meer:
// wat hier staat, is de enige bron van waarheid.
export let CONFIG_SURVEYS = [];
// Handmatig in de UI-inspector aangewezen elementen voor de vragenlijst:
//   surveyAgeSelector          -> waar de leeftijd van de cliënt staat
//   surveyQuestionTextSelector -> het vraagtekst-element binnen elke vraag
// Bron: config.uiSelectors (centraal) + storage.local onsHelper.uiOverrides.
export let UI_OVERRIDES = {};
export const ctLower = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/\s*antwoord wissen\s*$/i, '').replace(/\s*\*+\s*$/, '').trim();
export function parsedSignal(value) {
  const source = value && typeof value === 'object' ? value : {};
  const text = String(source.text || '').trim();
  return {
    text,
    html: String(source.html || text),
    color: /^(?:#[0-9a-f]{6}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/i.test(source.color || '') ? source.color : '#704b00',
    bold: source.bold !== false,
    italic: !!source.italic,
    sizePx: Math.max(8, Math.min(40, parseInt(source.sizePx, 10) || 13))
  };
}
export function parseSurveys(list) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((s) => {
    const nameLc = ctLower(s && s.name);
    const raw = Array.isArray(s && s.questions) ? s.questions
      : (s && s.question ? [{ question: s.question, op: s.op, value: s.value, value2: s.value2 }] : []); // compat: oude platte vorm
    const questions = [];
    raw.forEach((q, qIndex) => {
      const textLc = ctLower(q && q.question);
      if (!textLc || textLc.length < 4) return;
      const num = (x) => (x === '' || x == null || isNaN(parseInt(x, 10))) ? null : parseInt(x, 10);
      const legacyCondition = q && q.rule === 'leeftijd';
      const action = q && q.rule === 'signaal_tonen' ? 'signaal_tonen' : 'vraag_verplicht';
      questions.push({ surveyName: nameLc, textLc, rule: action, condition: (q && q.condition) || (legacyCondition ? 'leeftijd' : 'leeftijd'), signal: parsedSignal(q && q.signal), op: (q && q.op) || '>=', value: num(q && q.value), value2: num(q && q.value2), key: nameLc + '::' + textLc + '::' + qIndex });
    });
    if (nameLc && questions.length) out.push({ nameLc, questions });
  });
  return out;
}
export function ageSatisfies(age, q) {
  if (!q) return false;
  if (q.condition === 'altijd') return true;
  if (age == null || q.condition !== 'leeftijd' || q.value == null) return false;
  const a = age, v = q.value, v2 = q.value2;
  switch (q.op) {
    case '=': return a === v;
    case '>': return a > v;
    case '<': return a < v;
    case '>=': return a >= v;
    case '<=': return a <= v;
    case '<>': return v2 != null && a >= v && a <= v2;   // binnen (grenzen inbegrepen)
    case '><': return v2 != null && (a < v || a > v2);   // buiten
    default: return false;
  }
}
export function allConfigQuestions() { const out = []; CONFIG_SURVEYS.forEach((s) => { s.questions.forEach((q) => out.push(q)); }); return out; }
export function configQuestionsForText(text) {
  const L = ctLower(text);
  if (!L || L.length < 4) return [];
  // Match op de volledige vraagtekst (tolerant: begin/bevat, beide richtingen).
  return allConfigQuestions().filter((q) => q.textLc && (L === q.textLc || L.indexOf(q.textLc) !== -1 || q.textLc.indexOf(L) !== -1));
}
export function configQuestionForText(text) { const all=configQuestionsForText(text);return all.find((q)=>q.rule==='vraag_verplicht')||all[0]||null; }
function applySurveyConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return;
  const hc = (cfg.helperConfig && typeof cfg.helperConfig === 'object') ? cfg.helperConfig : cfg;
  const features = hc.features || cfg.features || {};
  if (typeof features.surveyRequired === 'boolean') SURVEY_CONFIG.surveyHelperEnabled = features.surveyRequired;
  if (typeof features.surveyAudit === 'boolean') SURVEY_CONFIG.surveyAuditEnabled = features.surveyAudit;
  if (typeof cfg.enabled === 'boolean') SURVEY_CONFIG.enabled = cfg.enabled;
  if (typeof cfg.surveyHelperEnabled === 'boolean') SURVEY_CONFIG.surveyHelperEnabled = cfg.surveyHelperEnabled;
  if (typeof cfg.surveyAuditEnabled === 'boolean') SURVEY_CONFIG.surveyAuditEnabled = cfg.surveyAuditEnabled;
  if (Array.isArray(hc.surveys)) CONFIG_SURVEYS = parseSurveys(hc.surveys);
  else if (Array.isArray(cfg.surveys)) CONFIG_SURVEYS = parseSurveys(cfg.surveys);
  // Centraal aangewezen UI-selectors als basis (lokaal herstel wint later).
  const us = (hc.uiSelectors && typeof hc.uiSelectors === 'object') ? hc.uiSelectors : null;
  if (us) { for (const k of SURVEY_SELECTOR_KEYS) if (typeof us[k] === 'string' && us[k]) UI_OVERRIDES[k] = us[k]; }
  try { scheduleRefresh(); } catch (e) {}
}
// In vaste volgorde, net als het content-script en de popup:
//   config.json < lokale testconfig < beleid (chrome.storage.managed),
// en daarna de lokaal in de UI-inspector herstelde selectors (winnen per sleutel).
//
// Tot 1.6.201 liepen deze vier verzoeken tegelijk en won de laatste die
// binnenkwam. Omdat config.json via fetch meestal als laatste binnenkomt,
// overschreef het dan het beleid en de lokaal herstelde selectors.
const SURVEY_SELECTOR_KEYS = ['surveyAgeSelector', 'surveyQuestionTextSelector', 'surveyClientNameSelector', 'surveyTitleSelector', 'surveyQuestionSelector', 'surveyNextStatusSelector'];
export async function loadSurveyConfig() {
  try {
    const response = await fetch(chrome.runtime.getURL('config.json'));
    const bundled = response.ok ? await response.json() : null;
    if (bundled) applySurveyConfig(bundled);
  } catch (e) {}
  const local = await readStorage(chrome.storage.local, [LOCAL.TEST_CONFIG, LOCAL.UI_OVERRIDES]);
  try { if (local[LOCAL.TEST_CONFIG]) applySurveyConfig(local[LOCAL.TEST_CONFIG]); } catch (e) {}
  const managed = await readStorage(chrome.storage.managed, null);
  try { applySurveyConfig(managed); } catch (e) {}
  const overrides = local[LOCAL.UI_OVERRIDES];
  if (overrides && typeof overrides === 'object') {
    for (const k of SURVEY_SELECTOR_KEYS) if (typeof overrides[k] === 'string' && overrides[k]) UI_OVERRIDES[k] = overrides[k];
    try { scheduleRefresh(); } catch (e) {}
  }
}
export function surveyDisabled() { return !SURVEY_CONFIG.enabled || !SURVEY_CONFIG.surveyHelperEnabled; }
// Opstarten: config opnieuw lezen als beleid of lokale override wijzigt.
export function watchSurveyConfig() {
  try { if (chrome && chrome.storage && chrome.storage.onChanged) chrome.storage.onChanged.addListener((c, area) => { if (area === 'managed' || area === 'local') loadSurveyConfig(); }); } catch (e) {}
}
