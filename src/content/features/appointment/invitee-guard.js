// Cliënt toevoegen, en het ongewild openen van de zoek-genodigden-modal
// voorkomen.

import { clean, isOwnPopup, rect, visible } from '../../ons/dom.js';
import { clickUiButton, uiText } from '../../ons/form-controls.js';
import { appointmentFlow, helperPanel } from '../../state.js';
import { setStatus } from '../../screen/status.js';
import { deepQueryAll } from '../../ons/dom.js';
import { UI_OVERRIDES } from '../../ons/selector-overrides.js';

// Synthetische klik-events die op de ONS "+ Toevoegen"-knop worden geweerd
// (zie appointmentFlow.intentionalAddClientClick).
const STRAY_ADD_EVENTS = ['pointerdown', 'mousedown', 'click'];
// Goedkope route: de "+ Toevoegen"-knop staat als light-DOM <uc-button> in de
// header van #teleport (de Genodigden-kaart). Een gerichte querySelector daar
// is vele malen lichter dan een deepQueryAll over alle shadow-roots — cruciaal
// omdat dit bij elke mount draait.
function findAddInviteeButtonFast() {
  const tp = document.getElementById('teleport');
  if (!tp) return null;
  const header = tp.querySelector('div[slot="header"], [class*="_header_"]') || tp;
  let candidates;
  try { candidates = header.querySelectorAll('uc-button, button'); } catch (e) { return null; }
  for (const btn of candidates) {
    if (!visible(btn) || isOwnPopup(btn)) continue;
    const txt = clean(uiText(btn) || btn.textContent || '');
    const hasAdd = (btn.shadowRoot && (btn.shadowRoot.querySelector('uc-icon[icon="add"]') || btn.shadowRoot.querySelector('[icon="add"]'))) ||
      (btn.querySelector && btn.querySelector('uc-icon[icon="add"]'));
    if (/(^|[^a-z])toevoegen([^a-z]|$)/.test(txt) || hasAdd) return btn;
  }
  return null;
}
function findAddClientButton() {
  // Eerst de goedkope, gerichte route; alleen bij afwezigheid van #teleport
  // (andere layout) terugvallen op de bredere scan.
  const fast = findAddInviteeButtonFast();
  if (fast) return fast;
  // Knop "Toevoegen" binnen de Genodigden-kaart. Zoek document-breed,
  // want de ONS-modal bestaat soms uit meerdere sibling-containers.
  const scope = document;
  const headings = deepQueryAll('h1,h2,h3,div,span,p', scope).filter(function (el) {
    const txt = clean(el.textContent || '');
    return visible(el) && !isOwnPopup(el) && (txt === 'genodigden' || (txt.startsWith('genodigden') && txt.length < 80));
  }).sort(function (a, b) { return rect(a).top - rect(b).top || rect(a).left - rect(b).left; });
  const hasAddIcon = function (b) {
    return !!(b && (
      (b.querySelector && (b.querySelector('uc-icon[icon="add"]') || b.querySelector('[icon="add"]'))) ||
      (b.shadowRoot && (b.shadowRoot.querySelector('uc-icon[icon="add"]') || b.shadowRoot.querySelector('[icon="add"]')))
    ));
  };
  const buttonText = function (b) {
    return clean(uiText(b) || b.textContent || (b.shadowRoot && b.shadowRoot.textContent) || '');
  };
  const candidates = deepQueryAll('uc-button,button,[role="button"]', scope)
    .filter(function (b) {
      if (isOwnPopup(b)) return false;
      const r = rect(b);
      if (r.width <= 0 || r.height <= 0) return false;
      return /toevoegen/.test(buttonText(b)) || hasAddIcon(b);
    })
    .map(function (b) {
      const r = rect(b);
      const nearestHeading = headings.reduce(function (best, h) {
        const hr = rect(h);
        if (r.top < hr.top - 55 || r.top > hr.top + 160) return best;
        if (r.left < hr.left + 120 || r.left > hr.left + 900) return best;
        const dy = Math.abs((r.top + r.height / 2) - (hr.top + hr.height / 2));
        const sameHeaderBand = r.top >= hr.top - 36 && r.top <= hr.top + 110;
        const rightOfHeading = r.left > hr.left + 120;
        const score = dy + Math.abs(r.left - hr.left) / 6 + (sameHeaderBand ? -600 : 0) + (rightOfHeading ? -250 : 0);
        return Math.min(best, score);
      }, headings.length ? 99999 : 0);
      const txt = buttonText(b);
      const textBonus = /toevoegen/.test(txt) ? -700 : 0;
      const iconBonus = hasAddIcon(b) ? -150 : 0;
      const agendaPenalty = nearestHeading >= 99999 ? 100000 : 0;
      return { button: b, score: nearestHeading + textBonus + iconBonus + agendaPenalty };
    })
    .sort(function (a, b) { return a.score - b.score; });
  return candidates.length && candidates[0].score < 50000 ? candidates[0].button : null;
}
export function clickAddClientButton() {
  const btn = findAddClientButton();
  if (!btn) { setStatus('Knop "Cli\u00ebnt toevoegen" niet gevonden', false); return false; }
  // Bewuste opening: sta de modal 6 s toe zodat de auto-sluit-net hem niet dicht.
  appointmentFlow.intentionalAddClientClick = true;
  appointmentFlow.allowInviteeModalUntil = Date.now() + 6000;
  try { clickUiButton(btn); } finally {
    setTimeout(() => { appointmentFlow.intentionalAddClientClick = false; }, 400);
  }
  setStatus('Cli\u00ebnt toevoegen geopend');
  return true;
}
// Herken de ONS "Zoek naar genodigden"-modal (los van de afspraak-modal).
function findInviteeSearchModal() {
  for (const m of deepQueryAll('uc-modal,[role="dialog"],dialog')) {
    if (!visible(m) || isOwnPopup(m)) continue;
    const al = clean((m.getAttribute && (m.getAttribute('aria-label') || '')) || '');
    if (al === 'afspraak toevoegen' || al === 'afspraakdetails') continue;
    if (/zoek naar genodigden|genodigde toevoegen|genodigde zoeken/.test(al)) return m;
    const txt = clean((m.textContent || '').slice(0, 500));
    if (/zoek naar (clienten|genodigden)/.test(txt) && /medewerker/.test(txt) && /(groep|team|locatie)/.test(txt)) return m;
  }
  return null;
}
function closeInviteeSearchModal(modal) {
  const closeBtn = deepQueryAll(UI_OVERRIDES.afsCloseButton || 'uc-button[aria-label*="sluit" i], button[aria-label*="sluit" i]', modal)
    .find((b) => visible(b) && !isOwnPopup(b));
  if (closeBtn) { clickUiButton(closeBtn); return true; }
  const dlg = deepQueryAll('dialog,[role="dialog"]', modal)[0] || modal;
  try { dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, composed: true, cancelable: true })); } catch (e) {}
  return false;
}
// Sluit de zoek-genodigden-modal als die niet door de gebruiker (of de bewuste
// helper-knop) is geopend. Vangt het neveneffect ongeacht welke interne klik
// hem opende \u2014 betrouwbaarder dan het onderscheppen door de shadow-DOM heen.
export function maybeDismissStrayInviteeModal(attempt = 0) {
  if (!helperPanel.helperEnabled || helperPanel.activeMode === 'registrations') return;
  if (appointmentFlow.intentionalAddClientClick || Date.now() < appointmentFlow.allowInviteeModalUntil) return;
  const modal = findInviteeSearchModal();
  if (!modal) {
    // De inhoud van de modal kan nog renderen; kort opnieuw proberen.
    if (attempt < 6) setTimeout(() => maybeDismissStrayInviteeModal(attempt + 1), 70);
    return;
  }
  if (appointmentFlow.intentionalAddClientClick || Date.now() < appointmentFlow.allowInviteeModalUntil) return;
  closeInviteeSearchModal(modal);
  // Nogmaals controleren: sommige flows heropenen hem direct.
  if (attempt < 6) setTimeout(() => maybeDismissStrayInviteeModal(attempt + 1), 90);
}
// Handler die DIRECT op de "+ Toevoegen"-knop wordt gehangen. Zo vangen we de
// activatie ongeacht de shadow-DOM/composed-grens (een document-listener mist
// niet-composed synthetische events die binnen de shadow-root worden afgevuurd).
function inviteeAddButtonGuard(e) {
  if (appointmentFlow.intentionalAddClientClick || Date.now() < appointmentFlow.allowInviteeModalUntil) return;
  if (e.isTrusted) {
    // Echte gebruikersklik: toestaan én een venster openen zodat de modal
    // en eventuele vervolgevents (mousedown→click) niet worden geblokkeerd.
    appointmentFlow.allowInviteeModalUntil = Date.now() + 6000;
    return;
  }
  // Synthetische activatie zonder toestemming: tegenhouden vóór ONS reageert.
  e.preventDefault();
  e.stopPropagation();
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();
}
// Hang de guard op de actuele "+ Toevoegen"-knop (en zijn inner shadow-button).
// Wordt bij elke mount opnieuw aangeroepen omdat ONS de knop kan hertekenen.
export function guardInviteeAddButton() {
  if (helperPanel.activeMode === 'registrations') return;
  // Bewust de goedkope finder: dit draait bij elke mount, dus geen dure
  // document-brede shadow-scan.
  const btn = findAddInviteeButtonFast();
  if (!btn) return;
  const targets = [btn];
  const inner = btn.shadowRoot && btn.shadowRoot.querySelector('button');
  if (inner) targets.push(inner);
  for (const el of targets) {
    if (el.__onsInviteeGuarded) continue;
    el.__onsInviteeGuarded = true;
    for (const type of STRAY_ADD_EVENTS) el.addEventListener(type, inviteeAddButtonGuard, true);
  }
}
