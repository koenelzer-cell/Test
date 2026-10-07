// Koppeling met het zijpaneel: de checklist uitzenden en een aangeklikt item
// openen.

import { surveyState } from './state.js';
import { setDock } from './banner.js';
import { closestSurveyQuestionBlock } from './questions.js';
import { localQuestionForItem, navigateToItemCategory } from './checklist.js';
import { renderChecklist } from './checklist-view.js';
import { MSG } from '../shared/messages.js';

/* ===== De checklist in het zijpaneel =====
   Het zijpaneel tekent dezelfde checklist (surveypanel.js), maar kan deze
   pagina niet lezen. Daarom zenden we de checklist uit en voeren we de
   klikken uit die daar gebeuren.

   PRIVACY: alleen de vraagteksten, hun categorie/groep en of ze ingevuld
   zijn. Geen antwoorden, geen cliëntnaam, geen geboortedatum. De
   signaaltekst gaat wél mee — dat is de melding die de medewerker moet
   lezen — maar zonder de cliëntgegevens die in de pagina-versie in de
   opmaak worden aangevuld.
   ========================================================================== */

function checklistVoorZijpaneel(state) {
  if (!state || !Array.isArray(state.items)) return null;
  return {
    items: state.items.map(function (i) {
      return {
        question: String(i.question || ''),
        category: String(i.category || ''),
        group: String(i.group || ''),
        done: !!i.done,
        unknown: !!i.unknown
      };
    }),
    signals: (Array.isArray(state.signals) ? state.signals : []).map(function (s) {
      return { question: String((s && s.question) || ''), text: String((s && s.signal) || '') };
    }),
    respondentWarning: state.respondentWarning ? String(state.respondentWarning) : ''
  };
}
export function pushChecklist(force) {
  if (!surveyState._zijpaneelOpen) return;
  try {
    var payload = checklistVoorZijpaneel(surveyState._laatsteChecklist);
    if (!payload) return;
    var sig = JSON.stringify(payload);
    if (!force && sig === surveyState._checklistSig) return;
    surveyState._checklistSig = sig;
    chrome.runtime.sendMessage({ type: MSG.SURVEY_STATE, state: payload });
  } catch (e) {}
}
// Eén item aanwijzen vanuit het zijpaneel: precies wat een klik in de
// pagina-lijst doet — naar de vraag scrollen en haar oplichten, of naar de
// juiste categorie navigeren als ze hier niet staat.
function openChecklistItem(index) {
  if (!surveyState._laatsteChecklist || !Array.isArray(surveyState._laatsteChecklist.items)) return;
  var item = surveyState._laatsteChecklist.items[index];
  if (!item) return;
  var found = localQuestionForItem(item) || (item.anchorId ? document.getElementById(item.anchorId) : null);
  var q = closestSurveyQuestionBlock(found) || found;
  if (q) {
    try { q.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    var focusable = q.querySelector && q.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"],[tabindex]');
    try { if (focusable) focusable.focus(); } catch (e) {}
    if (q.style) {
      var oldOutline = q.style.outline, oldOffset = q.style.outlineOffset;
      q.style.outline = '3px solid #cc087d'; q.style.outlineOffset = '4px';
      setTimeout(function () { q.style.outline = oldOutline; q.style.outlineOffset = oldOffset; }, 3500);
    }
    return;
  }
  try { navigateToItemCategory(item); } catch (e) {}
}
// Opstarten: koppeling met het zijpaneel (toestand opvragen, item openen, open/dicht).
export function listenForSidePanel() {
  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg || typeof msg.type !== 'string') return;
      if (msg.type === MSG.SIDEPANEL_STATE) {
        var was = surveyState._zijpaneelOpen;
        surveyState._zijpaneelOpen = !!msg.open;
        if (was === surveyState._zijpaneelOpen) return;
        if (surveyState._zijpaneelOpen) {
          surveyState._checklistSig = '';
          pushChecklist(true);
          if (surveyState.bannerEl) { setDock(false); surveyState.bannerEl.style.display = 'none'; }
        } else if (surveyState._laatsteChecklist) {
          // Zijpaneel dicht: de melding hoort weer in de pagina te staan.
          try { renderChecklist(surveyState._laatsteChecklist); } catch (e) {}
        }
        return;
      }
      if (msg.type === MSG.SURVEY_GET_STATE) {
        surveyState._zijpaneelOpen = true;
        try { sendResponse({ state: checklistVoorZijpaneel(surveyState._laatsteChecklist) }); } catch (e) {}
        return true;
      }
      if (msg.type === MSG.SURVEY_OPEN_ITEM) { try { openChecklistItem(msg.index | 0); } catch (e) {} return; }
    });
    chrome.runtime.sendMessage({ type: MSG.SIDEPANEL_QUERY }, function (r) {
      void chrome.runtime.lastError;
      if (r && r.open) { surveyState._zijpaneelOpen = true; pushChecklist(true); }
    });
  } catch (e) {}
}
