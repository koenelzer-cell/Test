// Koppelen aan de pagina en de periodieke controle (tick).

import { SURVEY_CONFIG, surveyDisabled } from './config.js';
import { isSurveyEditUrl, isSurveyPage, nextStatusSel, saveButtons } from './page.js';
import { isJgOutcomeSurvey } from './survey-identity.js';
import { surveyState } from './state.js';
import { surveyQuestionBlocks } from './questions.js';
import { resolvedAge } from './client-age.js';
import { focusPendingQuestion, hideBanner, refresh } from './checklist-view.js';
import {
  absoluteSurveyUrl,
  categoryEditUrls,
  rememberCategoryUrls,
  surveyEditUrlFromOverview,
  surveyResultId,
} from './category-audit.js';
import {
  onEditWhileAuditClick,
  onNextStatusClick,
  prepareStatusAudit,
  requiredNotificationVisible,
  resumeInterruptedAudit,
  revealChecklistAfterOnsNotification,
} from './status-guard.js';
import { logSurveyError } from './log.js';

function onInput() {
  surveyState.statusAuditPromise = null;
  surveyState.statusAuditPage = '';
  surveyState.statusAuditAge = undefined;
  scheduleRefresh();
}
export function attach() {
  if (surveyState.listenersAttached) return;
  surveyState.listenersAttached = true;
  // Capture + stopImmediatePropagation, want de knop gebruikt data-prevent-default
  // en een gedelegeerde 'save-survey'-handler.
  document.addEventListener('input', onInput, true);
  document.addEventListener('change', onInput, true);
  document.addEventListener('click', onEditWhileAuditClick, true);
  document.addEventListener('click', onNextStatusClick, true);
}
function tick() {
  // (#2 uitrol) Centraal uitgeschakeld? Niets tonen/doen.
  if (surveyDisabled()) { hideBanner(); return; }
  // De gewone audit en melding werken voor iedere vragenlijst. Alleen de
  // fysieke Volgende-statusonderschepping en leeftijdsregels zijn elders
  // expliciet beperkt tot JG Outcome.
  // Productie kan de echte vragenlijst in een iframe tonen. Laat het lege
  // hoofddocument dan geen tweede, eeuwig ladend paneel opbouwen; de module
  // in het subframe neemt de controle over zodra daar de vragen verschijnen.
  if (window.top === window && isSurveyEditUrl(location.href) &&
      !surveyQuestionBlocks().length && !saveButtons().length && document.querySelector('iframe')) {
    hideBanner();
    return;
  }
  if (isSurveyPage()) {
    rememberCategoryUrls(categoryEditUrls(document, absoluteSurveyUrl(location.href)), surveyResultId());
    attach();
    if (resumeInterruptedAudit()) return;
    refresh();
  } else if (document.querySelector(nextStatusSel()) || surveyEditUrlFromOverview()) {
    // Start voordat de gebruiker klikt; meestal is het resultaat dan direct beschikbaar.
    if (SURVEY_CONFIG.surveyAuditEnabled && (!isJgOutcomeSurvey(document) || resolvedAge() != null)) prepareStatusAudit().catch(() => {});
    if (SURVEY_CONFIG.surveyAuditEnabled && requiredNotificationVisible()) revealChecklistAfterOnsNotification();
    else surveyState.requiredNotificationSeen = false;
  } else {
    hideBanner();
  }
}
export function scheduleRefresh() {
  if (surveyState._raf) return;
  surveyState._raf = requestAnimationFrame(() => {
    surveyState._raf = 0;
    try { tick(); }
    catch (e) { logSurveyError('tick mislukt', e); }
  });
}
// Opstarten: bij elke DOM-wijziging (buiten ons paneel) de controle opnieuw inplannen.
export function observePageChanges() {
  try {
    // Negeer mutaties binnen ons eigen paneel, anders ontstaat een refresh-lus:
    // renderChecklist herbouwt de paneelinhoud -> observer -> refresh -> ...
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        const t = m.target;
        if (surveyState.bannerEl && (t === surveyState.bannerEl || (surveyState.bannerEl.contains && surveyState.bannerEl.contains(t)))) continue;
        scheduleRefresh();
        return;
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
}
// Bij navigatie (ook SPA/soft-nav tussen categorieën) opnieuw proberen de
// aangeklikte vraag te focussen — anders werkt doorklikken alleen vanaf het
// overzicht (volledige paginalading) en niet van vraag naar vervolgvraag.
export function onSurveyNavigation() { focusPendingQuestion(0); scheduleRefresh(); }
