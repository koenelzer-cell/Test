// Event-handlers op het registratie- en afspraakformulier.

import { isOwnPopup } from '../../ons/dom.js';
import { helperPanel } from '../../state.js';
import { scheduleReapplyRegistrationSplit } from './fields.js';
import { refreshRegistrationPrereqScreen } from './prereqs.js';
import {
  ensureActiveRegistrationReportPrefix,
  registrationPrimaryReportField,
  registrationReportTextFields,
  updateRegistrationSubmitGuard,
} from './report.js';
import { checkRegistrationEpisodesText, checkRegistrationNoShowText } from './prompts.js';
import { persistRegistrationTimes } from './pending.js';

export function onRegistrationReportInput(e) {
  if (!helperPanel.helperEnabled) return;
  if (helperPanel.activeMode !== 'registrations' || isOwnPopup(e.target)) return;
  const el = e.target;
  refreshRegistrationPrereqScreen();
  const idName = `${el && el.id || ''} ${el && el.name || ''}`;
  if (/declaration_(start|end)_time|declaration_(in)?direct_time|declaration_travel_time/.test(idName) || (el && (el.className || '').includes('js-time'))) {
    scheduleReapplyRegistrationSplit();
    persistRegistrationTimes(); // onthoud direct/indirect + reistijd voor na een refresh
    updateRegistrationSubmitGuard();
    return;
  }
  const fields = registrationReportTextFields();
  const field = fields.includes(el) ? el : fields.find((candidate) => candidate.contains && candidate.contains(el));
  if (!field) return;
  updateRegistrationSubmitGuard();
  checkRegistrationNoShowText();
  checkRegistrationEpisodesText();
}
// Extra vangnet voor de directe/indirecte verdeling: bij een begintijd-interactie
// zet ONS de directe tijd soms terug zónder een input-event dat we opvangen. Een
// focusout op een tijdveld triggert daarom (idempotent) een her-verdeling volgens
// de actieve registratievorm.
export function onRegistrationTimeInteract(e) {
  if (!helperPanel.helperEnabled || helperPanel.activeMode !== 'registrations' || !e || isOwnPopup(e.target)) return;
  const el = e.target;
  const idName = `${(el && el.id) || ''} ${(el && el.name) || ''}`;
  if (/declaration_(start|end)_time|declaration_(in)?direct_time/.test(idName) || (el && (el.className || '').includes('js-time'))) {
    scheduleReapplyRegistrationSplit();
  }
}
export function onRegistrationReportFocus(e) {
  if (!helperPanel.helperEnabled) return;
  if (helperPanel.activeMode !== 'registrations' || isOwnPopup(e.target)) return;
  const fields = registrationReportTextFields();
  const field = fields.includes(e.target) ? e.target : fields.find((candidate) => candidate.contains && candidate.contains(e.target));
  if (!field) return;
  // Alleen het ALGEMENE (grote) rapportageveld krijgt het type-prefix,
  // nooit de per-client rapportagevelden.
  if (field === registrationPrimaryReportField()) ensureActiveRegistrationReportPrefix(field);
  updateRegistrationSubmitGuard();
}
