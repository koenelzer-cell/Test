// Vragen naar aanleiding van de rapportagetekst: no-show en episodes.

import { ONS } from '../../ons/selectors.js';
import { isOwnPopup, pollFor, visible } from '../../ons/dom.js';
import { clickOption, setInputText } from '../../ons/form-controls.js';
import { helperPanel, registrationFlow } from '../../state.js';
import { $body, safe, setStatus } from '../../screen/status.js';
import { ONSAH_TOKENS } from '../../ui/theme.js';
import { clearScreenMark, markScreen } from '../../screen/screen-state.js';
import { renderScreen } from '../../ui/react-bridge.js';
import { showRegistrationChoices, showRegistrationReportPrompt } from './screens.js';
import { activeRegistrationClientForms } from './completeness.js';
import { applyRegistrationNoShow, registrationReadyToSubmitPage } from './hour-type.js';
import { hasRegistrationPrereqs } from './prereqs.js';
import {
  registrationReportTextFields,
  registrationReportTextValue,
  registrationTextHasNoShowCue,
} from './report.js';
import { deepQueryAll } from '../../ons/dom.js';

export function showRegistrationNoShowPrompt() {
  const body = $body(); if (!body || registrationFlow.registrationNoShowPromptOpen) return;
  registrationFlow.registrationNoShowPromptOpen = true;
  markScreen('registrationNoShowPrompt');
  renderScreen(body, 'prompt', {
    question: 'No show?',
    tokens: ONSAH_TOKENS,
    onYes: function () {
      safe(function () {
        registrationFlow.registrationNoShowPromptOpen = false;
        registrationFlow.registrationNoShowPromptSuppressed = true;
        applyRegistrationNoShow();
        setTimeout(showRegistrationChoices, 350);
      });
    },
    onNo: function () {
      safe(function () {
        registrationFlow.registrationNoShowPromptOpen = false;
        registrationFlow.registrationNoShowPromptSuppressed = true;
        const afterNo = registrationFlow.registrationNoShowPromptAfterNo;
        registrationFlow.registrationNoShowPromptAfterNo = null;
        if (afterNo) afterNo();
        else if (registrationFlow.activeRegistrationChoice && registrationReadyToSubmitPage()) showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
        else showRegistrationChoices();
        setStatus('No show overgeslagen | ga verder');
      });
    },
  });
  setStatus('Triggerwoord gevonden');
}
export function checkRegistrationNoShowText(sourceEl) {
  if (!helperPanel.helperEnabled) return;
  if (helperPanel.activeMode !== 'registrations') return;
  if (!hasRegistrationPrereqs()) return;
  const fields = sourceEl ? [sourceEl] : registrationReportTextFields();
  const hasCue = fields.some((el) => !isOwnPopup(el) && registrationTextHasNoShowCue(registrationReportTextValue(el)));
  if (!hasCue) {
    const wasOpen = registrationFlow.registrationNoShowPromptOpen;
    registrationFlow.registrationNoShowPromptSuppressed = false;
    registrationFlow.registrationNoShowPromptOpen = false;
    registrationFlow.registrationNoShowPromptAfterNo = null;
    if (wasOpen) showRegistrationChoices();
    return;
  }
  if (!registrationFlow.registrationNoShowPromptSuppressed) showRegistrationNoShowPrompt();
}
function registrationTextHasEpisodesTrigger(text) {
  return /\b(moeder|vader)\b/i.test(text || '');
}
export function getRegistrationClientNumber() {
  // Alleen actieve (niet-verwijderde) clientforms tellen mee; een verwijderde
  // cliënt toont zijn naam/nummer nog wel, maar mag niet worden doorgeschakeld.
  const forms = activeRegistrationClientForms();
  const scopes = forms.length ? forms : [document];
  for (const scope of scopes) {
    let spans; try { spans = scope.querySelectorAll('.client_form_invitee_text span, [class*="invitee_text"] span, [class*="invitee-text"] span'); } catch (e) { spans = []; }
    for (const el of spans) {
      if (isOwnPopup(el)) continue;
      const m = (el.textContent || '').match(/\((\d+)\)/);
      if (m) return m[1];
    }
  }
  return null;
}
function extractEpisodesUrlFromJumpHref(href) {
  if (!href) return null;
  try {
    const toParam = href.split('to=')[1];
    if (!toParam) return null;
    const decoded = decodeURIComponent(toParam);
    const m = decoded.match(/\/clients\/(\d+)\//);
    if (!m) return null;
    const objectId = m[1];
    const url = new URL(decoded);
    return url.origin + '/clients/' + objectId + '/episodes';
  } catch (e) { return null; }
}
function findEpisodesUrlInDom() {
  for (const el of deepQueryAll('uc-link, a')) {
    if (!visible(el) || isOwnPopup(el)) continue;
    const href = el.getAttribute('href') || '';
    if (!href.includes('clients')) continue;
    const url = extractEpisodesUrlFromJumpHref(href);
    if (url) return url;
  }
  return null;
}
function findOmnisearchInput() {
  return deepQueryAll('input').find((el) => {
    if (!visible(el) || isOwnPopup(el)) return false;
    const ph = (el.getAttribute('placeholder') || '').toLowerCase();
    return ph.includes('liënt') || ph.includes('lient') || ph.includes('oeken');
  }) || null;
}
function doEpisodesSearch(clientNumber, onFound) {
  const btn = deepQueryAll(ONS.omnisearchTrigger).find((el) => visible(el) && !isOwnPopup(el));
  if (!btn) { onFound(null); return; }
  clickOption(btn);
  // Wacht (met polling) tot het zoekveld verschijnt i.p.v. een vaste vertraging.
  pollFor(findOmnisearchInput, (inp) => {
    if (!inp) { onFound(null); return; }
    setInputText(inp, clientNumber);
    // Wacht tot de dossierlink in de resultaten verschijnt.
    pollFor(findEpisodesUrlInDom, (url) => {
      try { inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (e) {}
      onFound(url || null);
    }, { timeout: 7000, interval: 150 });
  }, { timeout: 5000, interval: 120 });
}
function showRegistrationEpisodesPrompt() {
  const body = $body(); if (!body || registrationFlow.registrationEpisodesPromptOpen) return;
  registrationFlow.registrationEpisodesPromptOpen = true;
  clearScreenMark();
  renderScreen(body, 'prompt', {
    question: 'Afschermen via Episodes?',
    hint: 'Kopieer en plak de af te schermen zin(nen) onder de juiste episode.',
    tokens: ONSAH_TOKENS,
    onYes: function () {
      safe(function () {
        registrationFlow.registrationEpisodesPromptOpen = false;
        registrationFlow.registrationEpisodesPromptSuppressed = true;
        const clientNumber = getRegistrationClientNumber();
        if (!clientNumber) { setStatus('Cliëntnummer niet gevonden', false); showRegistrationChoices(); return; }
        setStatus('Dossier zoeken...');
        doEpisodesSearch(clientNumber, (url) => {
          if (url) {
            window.open(url, '_blank');
            setStatus('Episodes geopend');
          } else {
            setStatus('Dossierlink niet gevonden', false);
          }
          showRegistrationChoices();
        });
      });
    },
    onNo: function () {
      safe(function () {
        registrationFlow.registrationEpisodesPromptOpen = false;
        registrationFlow.registrationEpisodesPromptSuppressed = true;
        if (registrationFlow.activeRegistrationChoice && registrationReadyToSubmitPage()) showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
        else showRegistrationChoices();
        setStatus('Episodes overgeslagen');
      });
    },
  });
  setStatus('Triggerwoord gevonden: Moeder/Vader');
}
export function checkRegistrationEpisodesText() {
  if (!helperPanel.helperEnabled || helperPanel.activeMode !== 'registrations') return;
  if (!hasRegistrationPrereqs()) return;
  const fields = registrationReportTextFields();
  const hasCue = fields.some((el) => !isOwnPopup(el) && registrationTextHasEpisodesTrigger(registrationReportTextValue(el)));
  if (!hasCue) {
    if (registrationFlow.registrationEpisodesPromptOpen) { registrationFlow.registrationEpisodesPromptOpen = false; registrationFlow.registrationEpisodesPromptSuppressed = false; showRegistrationChoices(); }
    return;
  }
  if (!registrationFlow.registrationEpisodesPromptSuppressed) showRegistrationEpisodesPrompt();
}
