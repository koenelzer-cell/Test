// Voorwaarden voor de registratiehulp en wachten tot de pagina rustig is.

import { mkText } from '../../ui/managed-text.js';
import { clean, deepQueryAll, isOwnPopup, visible } from '../../ons/dom.js';
import { helperPanel, registrationFlow } from '../../state.js';
import { $body, safe, setStatus, showLoadingState } from '../../screen/status.js';
import { markScreen } from '../../screen/screen-state.js';
import { renderScreen } from '../../ui/react-bridge.js';
import { hasRegistrationDate, hasRegistrationStartTime } from './fields.js';
import { hasRegistrationEndTime, hasRegistrationHourTypeSelected, visibleSelect2HourTypeContainers } from './hour-type.js';
import { restoreRegistrationExtras } from './pending.js';
import { maybePrefetchUursoorten } from '../appointment/uursoort-source.js';
import { schermen } from '../../screen/schermen.js';
import { registrationReportNeedsContent } from './report.js';

export function hasRegistrationClient() {
  const valuedClientInput = deepQueryAll('input,select').some((el) => {
    if (!visible(el) || isOwnPopup(el)) return false;
    const idName = `${el.id || ''} ${el.name || ''}`;
    if (/hour_type|time|date|direct|indirect|travel|declaration_client_information_\d+__(id|hour_type_id)/i.test(idName)) return false;
    return /(client|invitee|patient).*(^|_|-)id|(^|[_\[])(client|invitee|patient)(_id|id|\])/.test(idName) && !!String(el.value || '').trim();
  });
  if (valuedClientInput) return true;
  const select2Client = deepQueryAll('.select2-selection__rendered,[id^="select2-"][id$="-container"]').some((el) => {
    if (!visible(el) || isOwnPopup(el)) return false;
    const id = el.id || '';
    if (!/(client|invitee|patient)/i.test(id) || /hour_type|time|date/i.test(id)) return false;
    const text = clean(el.textContent || '');
    return !!text && !/zoek|selecteer|client|cliënt|patient/.test(text);
  });
  if (select2Client) return true;
  if (!visibleSelect2HourTypeContainers().length) return false;
  return deepQueryAll('div,span,p,td,li,strong').some((el) => {
    if (!visible(el) || isOwnPopup(el)) return false;
    const text = clean(el.textContent || '');
    if (!text || text.length > 240) return false;
    if (/rapportage|registratie maken|reistijd toevoegen|afwezigheid toevoegen/.test(text)) return false;
    return /geboren op\b|\(\d{3,}\)|\b\d{1,2}\s*jaar\b/.test(text);
  });
}
export function showRegistrationNeedsClient() {
  const body = $body(); if (!body) return;
  markScreen('registrationNeedsClient');
  // Geen resetBody: dit scherm wordt herhaald getekend terwijl op cliënt/datum
  // gewacht wordt. Beheerbare teksten blijven mkText-knopen.
  renderScreen(body, 'needsClient', {
    nodes: [
      mkText('registratie_prereq_regel1', 'Voor cliëntgebonden registraties: vul cliënt, datum en begintijd in.', { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px', color: '#c0006a' }),
      mkText('registratie_prereq_regel2', 'Voor niet cliëntgebonden registraties: vul datum, begintijd en eindtijd in.', { fontWeight: '700', fontSize: '13px', margin: '2px 0 4px', color: '#c0006a' }),
    ],
  });
  setStatus('Wacht op cliënt, begintijd en datum');
}
// "Is de registratiepagina uitgerenderd/rustig?" -> document geladen én ~0,5s geen
// NIET-eigen DOM-mutaties meer. Zo tonen we het herstelde scherm pas als de pagina
// klaar is, i.p.v. te flikkeren tussen 'schrijf rapportage' en 'indienen' tijdens het laden.
export function registrationPageSettled() {
  try {
    if (document.readyState !== 'complete') return false;
    return (Date.now() - helperPanel.lastDomMutationAt) > 500;
  } catch (e) { return true; }
}
export function registrationRestoreHolding() {
  if (!registrationFlow.registrationRestoredToReport) return false;
  if (registrationPageSettled()) return false;
  if (registrationFlow.registrationRestoreHoldStart && (Date.now() - registrationFlow.registrationRestoreHoldStart) > 4000) return false; // veiligheidscap
  return true;
}
export function armRegistrationSettleCheck() {
  if (registrationFlow.registrationSettleTimer) return;
  registrationFlow.registrationSettleTimer = setTimeout(() => { registrationFlow.registrationSettleTimer = null; safe(refreshRegistrationPrereqScreen); }, 300);
}
export function refreshRegistrationPrereqScreen() {
  const body = $body(); if (!body || registrationFlow.registrationNoShowPromptOpen || registrationFlow.registrationEpisodesPromptOpen) return;
  maybePrefetchUursoorten(); // achtergrond-prefetch van de uursoorten zodra cliënt aanwezig is
  // Na een refresh: wacht met renderen tot de pagina rustig is (geen flikker).
  if (registrationRestoreHolding()) { showLoadingState('Registratie laden...'); armRegistrationSettleCheck(); return; }
  if (helperPanel._infoPanelRestore) return; // infopaneel open: niet overschrijven
  if (registrationFlow.registrationHourTypeBusy) return;  // uursoorten worden geladen: niet overschrijven
  if (registrationFlow.registrationFlowBusy) return;      // flow navigeert actief: niet overschrijven
  const text = body.textContent || '';
  // Na een refresh hersteld: de vorm is bekend -> rapportagescherm, ook zonder inhoud.
  if (registrationFlow.registrationRestoredToReport && registrationFlow.activeRegistrationChoice && !/richtlijn rapporteren|indienen/i.test(text)) {
    restoreRegistrationExtras(); // directe/indirecte tijd + reistijd terugzetten
    schermen.showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
    return;
  }
  if (registrationFlow.activeRegistrationChoice && registrationReadyToSubmitPage() && !/richtlijn rapporteren|indienen/i.test(text)) {
    schermen.showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
    return;
  }
  // Geen cliënt, maar wel uursoort + tijden -> alleen Indienen tonen.
  if (!registrationFlow.activeRegistrationChoice && registrationManualSubmitReady()) {
    if (!(helperPanel.popupEl && helperPanel.popupEl.querySelector('[data-registration-helper-submit]'))) schermen.showRegistrationSubmitOnly();
    return;
  }
  if (/vul client, begintijd en datum in|vul cliënt, begintijd en datum in|voor clientgebonden registraties|voor cliëntgebonden registraties/i.test(text) && hasRegistrationPrereqs()) schermen.showRegistrationChoices();
  else if (!hasRegistrationPrereqs() && !/vul client, begintijd en datum in|vul cliënt, begintijd en datum in|voor clientgebonden registraties|voor cliëntgebonden registraties/i.test(text)) showRegistrationNeedsClient();
}
// Geen cliënt gekoppeld maar wel een uursoort ingevuld: dan is er geen rapportage
// nodig. Toon enkel de Indienen-knop, zonder rapportage-richtlijn/groepsnotitie.
export function registrationManualSubmitReady() {
  return !hasRegistrationClient() && hasRegistrationDate() && hasRegistrationStartTime() &&
    hasRegistrationEndTime() && hasRegistrationHourTypeSelected();
}
export function hasRegistrationPrereqs() {
  return hasRegistrationClient() && hasRegistrationDate() && hasRegistrationStartTime();
}
export function registrationReadyToSubmitPage() {
  return hasRegistrationPrereqs() && hasRegistrationEndTime() && hasRegistrationHourTypeSelected() && !registrationReportNeedsContent();
}
