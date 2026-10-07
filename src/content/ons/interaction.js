// Laag-niveau interactie: toetsen, klikken op coördinaten, dropdowns sluiten.

import { clean, deepActive, isOwnPopup, rect, visible } from './dom.js';
import { optionText, setInputText } from './form-controls.js';
import { isAddInviteeControl, isProtectedAppointmentStartInput } from './appointment-form.js';
import { appointmentFlow } from '../state.js';
import { findModal } from './modal.js';
import { deepQueryAll } from '../ons/dom.js';

function fireKey(el, key) {
  if (!el) return;
  if (isProtectedAppointmentStartInput(el)) return;
  for (const type of ['keydown', 'keyup']) {
    try { el.dispatchEvent(new KeyboardEvent(type, { key, code: key, bubbles: true, cancelable: true })); } catch (e) {}
  }
}
export function clickAt(x, y) {
  const el = document.elementFromPoint(x, y) || document.body;
  // Een blinde synthetische klik mag nooit impliciet de genodigdenzoeker openen.
  if (typeof isAddInviteeControl === 'function' && isAddInviteeControl(el) &&
      !appointmentFlow.intentionalAddClientClick && Date.now() >= appointmentFlow.allowInviteeModalUntil) {
    return false;
  }
  for (const type of ['mousedown', 'mouseup', 'click']) {
    try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y })); } catch (e) {}
  }
  return true;
}
// Ligt onder dit punt een klikbaar/interactief element? Dan is het GEEN veilige
// 'lege plek' om een dropdown mee te sluiten — een blinde klik erop zou bv. de
// "+ Toevoegen"-knop (Genodigden) indrukken en de zoek-genodigden-modal openen.
function interactiveAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return false;
  if (isProtectedAppointmentStartInput(el)) return true;
  if (/^(input|textarea|select|button|a)$/i.test(el.tagName || '')) return true;
  return !!(el.closest && el.closest('button,a,[role="button"],[role="combobox"],uc-button,uc-icon,[data-qa*="add" i],[class*="button" i]'));
}
export function clickEmptyModalSpot() {
  const m = findModal();
  const panel = (m && (m.panel || m.host)) || document.body;
  const heading = deepQueryAll('h1,h2,h3,div,span', panel)
    .find((el) => visible(el) && !isOwnPopup(el) && /afspraakdetails|afspraak toevoegen|genodigden/i.test(el.textContent || ''));
  if (heading) {
    const hr = rect(heading);
    const hx = Math.round(hr.left + Math.min(24, Math.max(8, hr.width / 2)));
    const hy = Math.round(hr.top + hr.height / 2);
    if (!interactiveAtPoint(hx, hy)) { clickAt(hx, hy); return; }
  }
  // Zoek een aantoonbaar lege plek in de linker-bovenhoek van het paneel; klik
  // nooit als er een interactief element onder ligt.
  const r = rect(panel);
  for (let attempt = 0; attempt < 10; attempt++) {
    const x = Math.round(r.left + Math.max(24, Math.min(r.width - 40, r.width * (0.1 + Math.random() * 0.22))));
    const y = Math.round(r.top + Math.max(14, Math.min(r.height - 40, 20 + Math.random() * 26)));
    if (!interactiveAtPoint(x, y)) { clickAt(x, y); return; }
  }
  // Geen veilige plek gevonden: liever niets doen dan per ongeluk een knop
  // indrukken. De dropdown sluit dan bij de volgende interactie.
}
export function dismissOpenDropdowns() {
  // Stuur nooit een globale Escape: als er geen dropdown openstaat sluit ONS
  // daarmee de hele afspraak en toont het "Niet-opgeslagen wijzigingen".
  clickEmptyModalSpot();
}
// Opgeruimd (#3): de oude SVG-/geometrie-gebaseerde chip-verwijderhelpers
// (isLabelRemovePath, labelRemovePaths, hasLabelRemoveSvg, visibleClickTargetForPath,
// clickLabelRemoveSvgNear, clickSelectionRemoversNearText) zijn verwijderd. Labels
// worden nu betrouwbaar via labelChips()/data-qa afgehandeld.
export function clearSelectField(trigger, backspaces = 4) {
  if (!trigger) return false;
  trigger.click(); try { trigger.focus && trigger.focus(); } catch (e) {}
  const activeEl = deepActive() || trigger;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) setInputText(activeEl, '');
  for (let i = 0; i < backspaces; i++) fireKey(activeEl, 'Backspace');
  fireKey(activeEl, 'Delete');
  return true;
}
export function rowForOptionText(el, root) {
  let n = el;
  for (let depth = 0; n && n !== document.body && depth < 6; depth++, n = n.parentElement) {
    if (root && root !== n && root.contains && !root.contains(n)) break;
    if (!visible(n) || isOwnPopup(n)) continue;
    if (deepQueryAll('input,textarea', n).some((inp) => visible(inp) && !isOwnPopup(inp))) continue;
    const r = rect(n);
    const c = clean(optionText(n));
    if (r.width >= 140 && r.height >= 24 && r.height <= 70 && c && !/^zoek naar/.test(c)) return n;
    if (n.getAttribute && n.getAttribute('role') === 'option') return n;
  }
  return el;
}
