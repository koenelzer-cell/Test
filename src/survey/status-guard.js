// "Volgende status" tegenhouden zolang er verplichte vragen openstaan, met een
// noodknop.

import { SURVEY_CONFIG } from './config.js';
import { ct, nextStatusSel } from './page.js';
import { isJgOutcomeSurvey } from './survey-identity.js';
import { AUDIT_RESUME_PARAM, statusBypass, surveyState } from './state.js';
import { showAgePrompt, showBanner } from './banner.js';
import { clientAgeAmbiguous, clientAgeYears, resolvedAge, waitForClientAge } from './client-age.js';
import {
  clearAuditResume,
  markAuditForResume,
  readAuditResume,
  setAuditProgress,
} from './checklist.js';
import { hideBanner, showMissingBanner, updateChecklistCompletion } from './checklist-view.js';
import { evaluateAllSurveyCategories, surveyEditUrlFromOverview } from './category-audit.js';
import { deepQueryAll } from './dom.js';
import { logSurveyError } from './log.js';

export function prepareStatusAudit() {
  const pageKey = location.href;
  // (#1/#9) Gebruik de effectieve leeftijd (handmatige keuze wint; anders
  // eenduidig gedetecteerd), zodat een handmatige bevestiging doorwerkt.
  const detectedAge = resolvedAge();
  // Een vroege React-render kan nog geen client-header bevatten. Bewaar een
  // null-resultaat daarom niet zodra de leeftijd later wel beschikbaar is.
  if (surveyState.statusAuditPromise && surveyState.statusAuditPage === pageKey && surveyState.statusAuditAge === detectedAge) return surveyState.statusAuditPromise;
  surveyState.statusAuditPage = pageKey;
  surveyState.statusAuditAge = detectedAge;
  surveyState.statusAuditPromise = evaluateAllSurveyCategories(detectedAge, setAuditProgress).catch((err) => {
    surveyState.statusAuditPromise = null;
    throw err;
  });
  return surveyState.statusAuditPromise;
}
export async function onNextStatusClick(e) {
  const t = e.target;
  if (!t || !t.closest) return;
  const btn = t.closest(nextStatusSel());
  if (!btn || ct(btn.textContent || '') !== 'volgende status' || statusBypass.has(btn)) return;
  // Nooit een statusknop van een andere soort vragenlijst onderscheppen.
  if (!isJgOutcomeSurvey(document)) return;
  // (#2 uitrol) Audit/onderschepping centraal uit? Laat ONS de knop normaal
  // afhandelen; niet onderscheppen.
  if (!SURVEY_CONFIG.enabled || !SURVEY_CONFIG.surveyAuditEnabled) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  if (surveyState.statusCheckBusy) return;
  surveyState.statusCheckBusy = true;
  markAuditForResume('next-status');
  showBanner('Verplichte vragen in alle categorieën controleren...');
  try {
    if (clientAgeYears() == null) {
      showBanner('Leeftijd van de cliënt ophalen...');
      await waitForClientAge(2500);
    }
    // (#1/#9) Geen eenduidige leeftijd (onbekend of meerdere cliënten)?
    // Vraag het de gebruiker en herstart de controle met die keuze.
    if (resolvedAge() == null) {
      const reason = clientAgeAmbiguous()
        ? 'Er zijn meerdere cliënten in beeld. Geldt deze vragenlijst voor een cliënt jonger dan 12 jaar?'
        : 'De leeftijd van de cliënt kon niet automatisch worden bepaald. Is de cliënt jonger dan 12 jaar?';
      showAgePrompt(reason, () => {
        surveyState.statusAuditPromise = null; surveyState.statusAuditPage = ''; surveyState.statusAuditAge = undefined;
        onNextStatusClick(e);
      });
      return;
    }
    const res = await prepareStatusAudit();
    if (res.age == null) {
      clearAuditResume();
      showAgePrompt('De leeftijd kon niet worden vastgesteld. Is de cliënt jonger dan 12 jaar?', () => {
        surveyState.statusAuditPromise = null; surveyState.statusAuditPage = ''; surveyState.statusAuditAge = undefined;
        onNextStatusClick(e);
      });
      return;
    }
    if (res.blocked) {
      surveyState._pendingOverrideBtn = btn; // (#3) noodknop "Toch doorgaan" tonen
      showMissingBanner(res, true);
      updateChecklistCompletion();
      clearAuditResume();
      return;
    }
    surveyState._pendingOverrideBtn = null;
    clearAuditResume();
    hideBanner();
    statusBypass.add(btn);
    try { btn.click(); } finally { setTimeout(() => statusBypass.delete(btn), 0); }
  } catch (err) {
    clearAuditResume();
    showBanner('De verplichte vragen konden niet volledig worden gecontroleerd. Probeer het opnieuw of open de vragenlijst via Wijzig.');
    logSurveyError('controle Volgende status mislukt', err, 'warn');
  } finally {
    surveyState.statusCheckBusy = false;
  }
}
const REQUIRED_NOTIFICATION_TEXT = 'u kunt alleen naar de volgende status gaan wanneer alle verplichte vragen zijn beantwoord';
export function requiredNotificationVisible() {
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
export function revealChecklistAfterOnsNotification() {
  if (surveyState.requiredNotificationSeen) return;
  surveyState.requiredNotificationSeen = true;
  surveyState.checklistAuditStarted = true;
  markAuditForResume('ons-notification');
  showBanner('Verplichte vragen ophalen...');
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
    showBanner('De verplichte vragen konden niet volledig worden gecontroleerd. Open de vragenlijst via Wijzig en probeer het opnieuw.');
    try {
      document.documentElement.setAttribute('data-ons-agendahulp-survey-error', String(err && (err.stack || err.message) || err));
      logSurveyError('achtergrondcontrole mislukt', err);
    } catch (e) {}
  });
}
// Klikt de gebruiker tijdens de lopende achtergrondcontrole op Wijzig, dan
// navigeert ONS naar een nieuw document en verdwijnen alle open promises.
// Voeg alleen in dat specifieke geval een tijdelijke hervatmarker toe aan
// de bestaande edit-URL. Op de editpagina start de audit daarmee direct
// opnieuw en gebruikt hij reeds afgeronde categorieen uit de versiecache.
export function onEditWhileAuditClick(e) {
  if (!surveyState.checklistAuditStarted && !surveyState.statusCheckBusy) return;
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
export function resumeInterruptedAudit() {
  // Zolang de hervatte promise loopt, mag refresh() het laadpaneel niet
  // verbergen doordat er nog geen checklist in storage staat.
  if (surveyState.checklistAuditStarted) return true;
  const pending = readAuditResume();
  if (!pending) return false;
  surveyState.checklistAuditStarted = true;
  showBanner('Verplichte vragen ophalen...');
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
    showBanner('De verplichte vragen konden niet volledig worden gecontroleerd. Probeer het opnieuw.');
    try {
      document.documentElement.setAttribute('data-ons-agendahulp-survey-error', String(err && (err.stack || err.message) || err));
      logSurveyError('hervatten achtergrondcontrole mislukt', err);
    } catch (e) {}
  });
  return true;
}
