// Eén categorie controleren: welke verplichte vragen staan nog open?

import { respondentRuleFor } from './survey-identity.js';
import {
  categoryName,
  categoryOrderOf,
  groupName,
  hasRecognizedControl,
  isAnswered,
  isRequiredQuestion,
  questionInactiveByPageCode,
  questionLabelText,
  readableQuestionText,
  respondentWarningText,
  surveyQuestionBlocks,
} from './questions.js';
import { clientAgeYears } from './client-age.js';

export function evaluate(root, ageOverride, sourceUrl) {
  const doc = root || document;
  const age = ageOverride === undefined ? clientAgeYears() : ageOverride;
  const items = [];
  const missing = [];
  const signals = [];
  const wrongRespondentGroups = new Set();
  const rule = respondentRuleFor(doc);
  const catOrder = categoryOrderOf(doc);
  let qIndex = -1;
  for (const q of surveyQuestionBlocks(doc)) {
    qIndex++;
    const configuredQuestions = rule ? (rule.questionsFor ? rule.questionsFor(questionLabelText(q)) : [rule.questionFor(questionLabelText(q))].filter(Boolean)) : [];
    // Een opgeslagen antwoord uit de verkeerde leeftijdsversie kan verborgen
    // zijn. Detecteer het daarom vóór de zichtbaarheidsfilter: een geconfigureerde
    // vraag die is ingevuld maar bij deze leeftijd NIET hoort, terwijl er binnen
    // dezelfde vragenlijst wél een passende (andere) leeftijdsversie is.
    if (rule && age != null) {
      configuredQuestions.filter((cq)=>cq.rule==='vraag_verplicht').forEach((cq)=>{if(!rule.appliesAt(cq, age)&&isAnswered(q)&&rule.hasApplicableSibling(age,cq))wrongRespondentGroups.add(cq.key);});
    }
    configuredQuestions.filter((cq)=>cq.rule==='signaal_tonen'&&rule.appliesAt(cq,age)&&!questionInactiveByPageCode(q)&&cq.signal&&cq.signal.text).forEach((cq)=>signals.push({question:readableQuestionText(q),signal:cq.signal,key:cq.key}));
    if (questionInactiveByPageCode(q) || !isRequiredQuestion(q, age, rule)) continue;
    // (#2) Onbekend besturingselement -> niet als ingevuld tellen.
    const recognized = hasRecognizedControl(q);
    const unknown = !recognized;
    const done = recognized ? isAnswered(q) : false;
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
