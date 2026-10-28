// Rapportageveld: prefix van de registratievorm en indienen blokkeren zolang
// het leeg is.

import { REGISTRATION_CHOICES } from '../../config/app-config.js';
import { overrideEl } from '../../ons/selector-overrides.js';
import { area, clean, deepQueryAll, isOwnPopup, visible } from '../../ons/dom.js';
import { setInputTextComposed } from '../../ons/form-controls.js';
import { helperPanel, registrationFlow } from '../../state.js';
import { setStatus } from '../../screen/status.js';
import { clearPendingRegistration } from './pending-store.js';

export function registrationTextHasNoShowCue(text) {
  return /\b(afwezig|voicemail|geen gehoor|niet bereikbaar|onbereikbaar|neemt niet op|nam niet op|niet opgenomen|niet verschenen|niet gekomen|komt niet|kwam niet|no show|noshow|zonder bericht|geen reactie|reageert niet|niet thuis|deur niet open|op voicemail|ingesproken)\b/i.test(text || '');
}
export function registrationReportTextFields() {
  return deepQueryAll('textarea,input,[contenteditable="true"],[role="textbox"]')
    .filter((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      if (el.closest && el.closest('.select2-container,.select2-dropdown,.select2-results,[role="listbox"]')) return false;
      const tag = (el.tagName || '').toLowerCase();
      const meta = clean([el.id, el.name, el.className, el.type, el.getAttribute && el.getAttribute('placeholder'), el.getAttribute && el.getAttribute('aria-label')].filter(Boolean).join(' '));
      if (/select2|search__field|zoek naar uursoorten|zoek naar labels|zichtbaar voor|visible for|hour_type|uursoort|client_information_\d+__hour_type_id|absence|afwezigheid/.test(meta)) return false;
      if (tag === 'input') {
        const type = clean(el.getAttribute('type') || 'text');
        if (!/^(text|search|textarea)?$/.test(type)) return false;
        if ((el.className || '').includes('time') || /time|date|declaration_(start|end)_time/.test(el.id || el.name || '')) return false;
        if (!/rapport|report|verslag|notit|note|description|omschrijving|content|body|text/.test(meta)) return false;
      }
      return true;
    });
}
export function registrationReportTextValue(el) {
  if (!el) return '';
  if ('value' in el && typeof el.value === 'string') return el.value;
  return el.textContent || '';
}
export function setRegistrationReportTextValue(el, text) {
  if (!el) return false;
  if ('value' in el && typeof el.value === 'string') setInputTextComposed(el, text);
  else {
    el.textContent = text;
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }
  return true;
}
function focusRegistrationReportAtEnd(field) {
  if (!field) return false;
  try { field.focus(); } catch (e) {}
  if ('value' in field && typeof field.value === 'string') {
    const end = field.value.length;
    try { field.setSelectionRange(end, end); } catch (e) {}
    return true;
  }
  if (field.getAttribute && field.getAttribute('contenteditable') === 'true') {
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(field);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch (e) {}
  }
  return false;
}
export function registrationPrimaryReportField() {
  const ov = overrideEl('regReport'); if (ov) return ov;
  const fields = registrationReportTextFields();
  if (!fields.length) return null;
  const preferred = fields.find((el) => {
    const tag = (el.tagName || '').toLowerCase();
    const meta = clean([el.id, el.name, el.className, el.getAttribute && el.getAttribute('aria-label')].filter(Boolean).join(' '));
    return tag === 'textarea' && /rapport|report|verslag|notit|note|description|omschrijving|content|body|text/.test(meta);
  });
  if (preferred) return preferred;
  return fields
    .filter((el) => (el.tagName || '').toLowerCase() === 'textarea' || el.getAttribute('contenteditable') === 'true')
    .sort((a, b) => area(b) - area(a))[0] || fields.sort((a, b) => area(b) - area(a))[0] || null;
}
// De rapportage-prefix van een vorm: het ingestelde 'reportPrefix' (uit de
// beheerbare config) wint; anders de vorm-naam. Zo krijgt élke vorm een prefix
// en is die per vorm aan te passen.
export function choicePrefix(c) {
  return (c && c.reportPrefix && String(c.reportPrefix).trim()) ? String(c.reportPrefix).trim() : (c ? c.label : '');
}
// Een prefix van één regel komt vóór de rapportage te staan als "prefix - tekst".
// Bevat de prefix regeleindes, dan is het een sjabloon: dat hoort als blok
// bovenaan te staan met de rapportage eronder, niet met een streepje erachter.
function _prefixIsSjabloon(p) { return /\n/.test(String(p || '')); }
export function _prefixScheiding(p) { return _prefixIsSjabloon(p) ? '\n' : ' - '; }
function _escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
// Het staartstuk waarmee een prefix van de rapportage wordt gescheiden.
function _prefixStaartRe(p) { return _prefixIsSjabloon(p) ? '\\s*' : '\\s*-\\s*'; }
export function registrationPrefixRegex() {
  // Langste eerst: anders matcht een korte prefix die het begin is van een
  // langere (bv. "MDO" binnen "MDO overleg") de verkeerde.
  const parts = REGISTRATION_CHOICES.map((c) => choicePrefix(c)).filter(Boolean)
    .slice().sort((a, b) => b.length - a.length)
    .map((p) => _escapeRe(p) + _prefixStaartRe(p));
  return new RegExp(`^\\s*(?:${parts.join('|')})`, 'i');
}
export function registrationChoicePrefixRegex(choice) {
  const p = choicePrefix(choice);
  if (!p) return null;
  return new RegExp(`^\\s*${_escapeRe(p)}${_prefixStaartRe(p)}`, 'i');
}
export function registrationReportNeedsContent() {
  const field = registrationPrimaryReportField();
  if (!field) return false;
  const text = registrationReportTextValue(field);
  if (registrationFlow.activeRegistrationChoice) {
    const expectedPrefixRe = registrationChoicePrefixRegex(registrationFlow.activeRegistrationChoice);
    if (!String(text || '').trim()) return true;
    if (expectedPrefixRe && !expectedPrefixRe.test(text)) return true;
    return !text.replace(expectedPrefixRe, '').trim();
  }
  const prefixRe = registrationPrefixRegex();
  if (!prefixRe.test(text)) return false;
  return !text.replace(prefixRe, '').trim();
}
export function prefixRegistrationReport(label) {
  const field = registrationPrimaryReportField();
  if (!field) return false;
  const prefixRe = registrationPrefixRegex();
  const current = registrationReportTextValue(field);
  const rest = current.replace(prefixRe, '');
  const ok = setRegistrationReportTextValue(field, `${label}${_prefixScheiding(label)}${rest}`);
  setTimeout(updateRegistrationSubmitGuard, 0);
  return ok;
}
export function ensureActiveRegistrationReportPrefix(field = null) {
  if (!registrationFlow.activeRegistrationChoice || registrationFlow.activeRegistrationChoice.label === 'No show') return false;
  const primary = registrationPrimaryReportField();
  const target = field || primary;
  if (!target) return false;
  // Het type-prefix hoort alleen in het algemene rapportageveld.
  if (target !== primary) return false;
  const expectedRe = registrationChoicePrefixRegex(registrationFlow.activeRegistrationChoice);
  const current = registrationReportTextValue(target);
  if (expectedRe && expectedRe.test(current)) return false;
  const trimmed = String(current || '').trim();
  const cleaned = clean(trimmed);
  const pfx = choicePrefix(registrationFlow.activeRegistrationChoice);
  const labelClean = clean(pfx);
  const otherPrefixRe = registrationPrefixRegex();
  const looksEmptyOrBrokenPrefix =
    !trimmed ||
    (cleaned.length >= 2 && labelClean.startsWith(cleaned)) ||
    cleaned === labelClean ||
    otherPrefixRe.test(current);
  if (!looksEmptyOrBrokenPrefix) return false;
  const rest = otherPrefixRe.test(current) ? current.replace(otherPrefixRe, '') : '';
  const ok = setRegistrationReportTextValue(target, `${pfx}${_prefixScheiding(pfx)}${rest}`);
  setTimeout(updateRegistrationSubmitGuard, 0);
  return ok;
}
function registrationSubmitButton() {
  return document.getElementById('submitRegistrationBtn') ||
    deepQueryAll('input[type="submit"],button[type="submit"]').find((el) => !isOwnPopup(el) && /indienen/i.test(el.value || el.textContent || '')) ||
    null;
}
export function setRegistrationSubmitBlocked(blocked) {
  const btn = registrationSubmitButton();
  if (!btn) return;
  if ('disabled' in btn) btn.disabled = blocked;
  try { btn.setAttribute('aria-disabled', blocked ? 'true' : 'false'); } catch (e) {}
  const inner = btn.shadowRoot ? (btn.shadowRoot.querySelector('button[type="submit"], button') || btn) : btn;
  if (inner instanceof HTMLButtonElement) inner.disabled = blocked;
  // GEEN pointer-events:none: dan valt de hover weg en zie je de
  // 'niet toegestaan'-cursor (rood cirkeltje met schuine streep) nooit. Het
  // tegenhouden gebeurt via de disabled-knop + de submit-guard.
  for (const el of [inner, btn]) {
    if (el && el.style) {
      el.style.opacity = blocked ? '0.45' : '';
      el.style.cursor = blocked ? 'not-allowed' : '';
      el.style.pointerEvents = blocked ? 'auto' : '';
    }
  }
}
// De Indienen-knop in het paneel heet altijd Indienen; zolang de rapportage
// ontbreekt is hij grijs (de reden staat eronder, zie completeness.js). Een
// klik zet dan de cursor in het rapportageveld.
export function updateRegistrationReportSubmitButton() {
  const btn = helperPanel.popupEl && helperPanel.popupEl.querySelector('[data-registration-helper-submit]');
  if (!btn) return;
  const blocked = registrationReportNeedsContent();
  btn.textContent = 'Indienen';
  btn.removeAttribute('title');
  btn.setAttribute('aria-disabled', blocked ? 'true' : 'false');
  btn.style.background = blocked ? '#c9c1bd' : '#1b7f3b';
  btn.style.boxShadow = blocked ? 'none' : '0 6px 16px -7px rgba(27,127,59,.55)';
  btn.style.opacity = '1';
  btn.style.cursor = blocked ? 'not-allowed' : 'pointer';
}
export function submitRegistrationFromHelper() {
  ensureActiveRegistrationReportPrefix();
  updateRegistrationSubmitGuard();
  updateRegistrationReportSubmitButton();
  if (registrationReportNeedsContent()) {
    const field = registrationPrimaryReportField();
    focusRegistrationReportAtEnd(field);
    // Sommige ONS-componenten herstellen de selectie nog na focus; zet de
    // cursor daarom ook na de huidige event-cyclus opnieuw achteraan.
    setTimeout(() => focusRegistrationReportAtEnd(field), 0);
    return;
  }
  const btn = registrationSubmitButton();
  if (!btn) { setStatus('Indienen-knop niet gevonden', false); return; }
  clearPendingRegistration(); // ingediend -> onthouden vorm vergeten
  btn.click();
}
export function updateRegistrationSubmitGuard() {
  setRegistrationSubmitBlocked(registrationReportNeedsContent());
  updateRegistrationReportSubmitButton();
}
function isRegistrationSubmitNode(el) {
  let n = el;
  for (let i = 0; n && i < 7; i++) {
    if (n.nodeType === 1 && n.matches && (n.matches('#submitRegistrationBtn') || (n.matches('input[type="submit"],button[type="submit"]') && /indienen/i.test(n.value || n.textContent || '')))) return true;
    n = n.parentElement;
  }
  return false;
}
export function blockRegistrationSubmitIfReportEmpty(e) {
  if (!helperPanel.helperEnabled) return;
  if (helperPanel.activeMode !== 'registrations' || isOwnPopup(e.target)) return;
  if (e.type === 'click' && !isRegistrationSubmitNode(e.target)) return;
  ensureActiveRegistrationReportPrefix();
  if (!registrationReportNeedsContent()) { clearPendingRegistration(); updateRegistrationSubmitGuard(); return; } // echte indien-klik -> vergeten
  e.preventDefault();
  e.stopPropagation();
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  updateRegistrationSubmitGuard();
}
