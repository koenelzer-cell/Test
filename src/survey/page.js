// De vragenlijstpagina van ONS: selectors en de knoppen Opslaan/Volgende
// status.

import { UI_OVERRIDES } from './config.js';
import { surveyQuestionBlocks } from './questions.js';

// Controleer welke leeftijdsafhankelijke vragen nog open staan:
//   - cliënt < 12 jaar  -> de "Ouder"-vragen moeten ingevuld zijn
//   - cliënt >= 12 jaar -> de "Jeugdige vanaf 12 jaar"-vragen moeten ingevuld zijn
// "Vragen" = zowel de tevredenheids-radio als de bijbehorende score.
const SAVE_SEL = '[data-action="save-survey"]';
const _NEXT_STATUS_DEFAULT = 'button[title="Volgende status"],button[aria-label="Volgende status"]';
export const nextStatusSel = () => UI_OVERRIDES.surveyNextStatusSelector || _NEXT_STATUS_DEFAULT;
export const ct = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
export function saveButtons() {
  return Array.prototype.slice.call(document.querySelectorAll(SAVE_SEL))
    .filter((el) => ct(el.textContent || el.value || '') === 'opslaan');
}
// ONS gebruikt meerdere HTML-vormen voor vragen. De meeste formulieren
// gebruiken .survey_question, maar matrix-/controlelijsten renderen iedere
// afzonderlijke vraag als een verplichte tabelrij (<tr class="required">).
// Behandel beide vormen overal als hetzelfde type vraagblok.
const _SURVEY_QUESTION_DEFAULT = '.survey_question,tr.required';
export const surveyQuestionSel = () => UI_OVERRIDES.surveyQuestionSelector || _SURVEY_QUESTION_DEFAULT;
export const SURVEY_RESPONSE_SEL = '.survey_question input,.survey_question textarea,.survey_question select,tr.required input,tr.required textarea,tr.required select';
export const SURVEY_VALUE_FIELD_SEL = '.survey_question input[type="text"],.survey_question input[type="number"],.survey_question textarea,.survey_question select,tr.required input[type="text"],tr.required input[type="number"],tr.required textarea,tr.required select';
// De URL is de vaste bron voor herkenning van het invulscherm. ONS rendert
// de Opslaan-knop en survey_question-blokken soms pas later via React; daarop
// wachten maakte dat de checklist op sommige vragenlijsten nooit opkwam.
export function isSurveyEditUrl(rawUrl) {
  try {
    const url = new URL(rawUrl || location.href, location.origin);
    return /\/survey_results\/[^/]+\/categories\/[^/]+\/edit\/?$/.test(url.pathname);
  } catch (e) {
    return /\/survey_results\/[^/]+\/categories\/[^/]+\/edit\/?$/.test(String(rawUrl || location.href).split(/[?#]/)[0]);
  }
}
export function isSurveyPage() {
  return isSurveyEditUrl(location.href) || (saveButtons().length > 0 && surveyQuestionBlocks().length > 0);
}
