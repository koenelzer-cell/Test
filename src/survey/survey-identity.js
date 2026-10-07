// Om welke vragenlijst gaat het, en geldt er een leeftijdsregel voor de
// respondent?

import {
  ageSatisfies,
  allConfigQuestions,
  CONFIG_SURVEYS,
  configQuestionForText,
  configQuestionsForText,
  ctLower,
  UI_OVERRIDES,
} from './config.js';
import { ct } from './page.js';
import { questionLabelText, surveyQuestionBlocks } from './questions.js';

// (#geen-vangnet) Eén config-gedreven regel: een vraag op het scherm wordt
// gematcht op de in het beheerscherm ingestelde vraagtekst en is verplicht
// zodra de cliëntleeftijd aan de ingestelde vergelijking voldoet. Er is geen
// hard-coded JG Outcome-regel meer; alles komt uit config.surveys.
export const VIRTUAL_RULE = {
  questionsFor: (text) => configQuestionsForText(text),
  questionFor: (text) => configQuestionForText(text),
  appliesAt: (cq, age) => ageSatisfies(age, cq),
  // Is er binnen dezelfde vragenlijst nóg een geconfigureerde vraag die bij
  // deze leeftijd wél hoort? (voor de "verkeerde leeftijdsversie"-waarschuwing)
  hasApplicableSibling: (age, cq) => allConfigQuestions().some((q) => q !== cq && q.rule === 'vraag_verplicht' && q.surveyName === (cq && cq.surveyName) && ageSatisfies(age, q)),
  // Legacy-shims (voor het geval iets nog naar de oude interface verwijst):
  groupOf: (text) => { const cq = configQuestionForText(text); return cq ? cq.key : null; },
  expectedGroupForAge: () => null,
  ageThreshold: 0,
  warningFor: () => ''
};
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
  const visibleTitle = doc.querySelector(UI_OVERRIDES.surveyTitleSelector || '.mod-survey-result-header h1.ivy-title,[data-react-component="SurveyResultHeader"] h1.ivy-title');
  return visibleTitle && visibleTitle.textContent ? visibleTitle.textContent.replace(/\s+/g, ' ').trim() : '';
}
// Vindt de geconfigureerde vragenlijst die bij de huidige titel hoort. Werkt
// ook op het overzicht- en statusscherm, waar (nog) geen vraagblokken staan —
// net zoals de oude JG Outcome-route op de titel matchte.
function configSurveyByTitle(root) {
  if (!CONFIG_SURVEYS.length) return null;
  const t = ctLower(surveyTitleOf(root));
  if (!t) return null;
  return CONFIG_SURVEYS.find((s) => s.nameLc && (t === s.nameLc || t.indexOf(s.nameLc) !== -1 || s.nameLc.indexOf(t) !== -1)) || null;
}
// De config-regel is actief zodra (1) de vragenlijst-titel een geconfigureerde
// vragenlijst is — zodat overzicht én "Volgende status" dezelfde route volgen
// als bij Outcome — of (2) er minstens één geconfigureerde vraag op de pagina staat.
export function respondentRuleFor(root) {
  if (!CONFIG_SURVEYS.length) return null;
  if (configSurveyByTitle(root)) return VIRTUAL_RULE;
  let anyMatch = false;
  try { anyMatch = surveyQuestionBlocks(root || document).some((q) => configQuestionsForText(questionLabelText(q)).length); } catch (e) { anyMatch = false; }
  return anyMatch ? VIRTUAL_RULE : null;
}
// Behoudt de bestaande betekenis: "heeft deze vragenlijst leeftijdsregels?"
// Alle callers blijven werken.
export function isJgOutcomeSurvey(root) {
  return !!respondentRuleFor(root);
}
