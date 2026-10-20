// Laag-niveau interactie: toetsen, klikken op coördinaten, dropdowns sluiten.

import { clean, deepActive, deepQueryAll, isOwnPopup, pollFor, rect, visible } from './dom.js';
import { clickOption, genericOptionCandidates, openSelectCombobox, optionSearchRoots, optionText, searchInputForTrigger, setInputText, typeIntoSearchField, uiText } from './form-controls.js';
import { appointmentFlow } from '../state.js';
import { findModal } from './modal.js';
import { isProtectedAppointmentStartInput } from './time-input.js';

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
export function isAddInviteeControl(el) {
  if (!el) return false;
  const t = clean(uiText(el) || el.textContent || '');
  const qa = clean((el.getAttribute && el.getAttribute('data-qa')) || '');
  // De uitklap-toggle heet "toggle-invitee-fields-button"; die is juist wel
  // gewenst. Alleen de daadwerkelijke toevoegknop weren.
  if (/toggle-invitee-fields/.test(qa)) return false;
  return /^\+?\s*toevoegen$|genodigde? toevoegen/.test(t) || /(^|[^a-z])add([^a-z]|$)|add-invitee|add_invitee/.test(qa);
}
export function openTypePick(getTrigger, text, onResult) {
  const trigger = getTrigger();
  if (!trigger) { onResult(false, 'veld niet gevonden'); return; }
  selectDropdownLikeLabel(trigger, text, (ok) => onResult(ok, ok ? '' : 'optie niet gevonden'));
}
function selectDropdownLikeLabel(trigger, text, onResult, attempt = 0) {
  if (!trigger) { onResult(false); return; }
  const openedBy = openSelectCombobox(trigger) || trigger;
  setTimeout(() => {
    const input = searchInputForTrigger(openedBy) || searchInputForTrigger(trigger);
    const searchText = String(text || '').replace(/[*#]+$/, '').trim();
    if (input) {
      try { input.focus(); } catch (e) {}
      typeIntoSearchField(input, searchText);
    } else if (trigger.tagName === 'INPUT' || trigger.tagName === 'TEXTAREA') {
      setInputText(trigger, searchText);
    }
    const wanted = [text, String(text || '').replace(/\*+$/, '').trim()].filter(Boolean);
    // Poll tot de optie echt gerenderd is (op productie duurt server-side
    // zoeken langer) i.p.v. één poging na een vaste vertraging.
    pollFor(
      () => findExactDropdownOption(openedBy, wanted) || findExactDropdownOption(trigger, wanted),
      (best) => {
        if (best) {
          clickOption(best);
          setTimeout(() => { clickEmptyModalSpot(); onResult(true); }, 90);
          return;
        }
        if (attempt < 3) {
          clickEmptyModalSpot();
          setTimeout(() => selectDropdownLikeLabel(trigger, text, onResult, attempt + 1), 200);
          return;
        }
        setTimeout(() => { clickEmptyModalSpot(); onResult(false); }, 90);
      },
      { timeout: 2600, interval: 130 }
    );
  }, 170);
}
// Alleen zóeken (geen klik) naar de best passende optie. Zo kunnen we pollen
// tot de optie echt gerenderd is (op productie laden lijsten trager) i.p.v.
// met een vaste vertraging één keer te proberen en te falen.
export function findExactDropdownOption(trigger, texts) {
  const wanted = texts.map(clean).filter(Boolean);
  if (!wanted.length) return null;
  const tr = rect(trigger);
  let best = null, bestScore = Infinity;
  for (const root of optionSearchRoots(trigger)) {
    for (const el of genericOptionCandidates(root)) {
      if (!visible(el) || isOwnPopup(el) || /input|textarea|select/i.test(el.tagName || '')) continue;
      const row = rowForOptionText(el, root);
      if (!visible(row) || isOwnPopup(row)) continue;
      const txt = clean(optionText(row) || optionText(el));
      if (/toont |zoekterm|zoek naar|geen resultaten/.test(txt)) continue;
      const matches = wanted.some(function (w) {
        if (!w) return false;
        if (txt === w || txt.includes(w) || w.includes(txt)) return true;
        // token-overlap: deel de gewenste naam in woorden (zonder afkortingspunten)
        // en eis dat het eerste betekenisvolle woord in de optietekst voorkomt.
        const tokens = w.replace(/[.*]/g, ' ').split(/\s+/).filter(function (t) { return t.length >= 4; });
        return tokens.length > 0 && tokens.every(function (t) { return txt.indexOf(t) !== -1; });
      });
      if (!matches) continue;
      const r = rect(row);
      if (r.top < tr.top - 500 || r.top > tr.bottom + 600) continue; // te ver weg
      if (r.width < 120 || r.height < 20 || r.height > 80) continue;
      const selectedScore = /true/i.test(row.getAttribute('aria-selected') || '') || /selected|active|checked/i.test(row.className || '') ? -1000 : 0;
      const exactScore = wanted.includes(txt) ? -500 : 0;
      const distToTrigger = Math.min(Math.abs(r.top - tr.bottom), Math.abs(r.bottom - tr.top));
      const score = selectedScore + exactScore + distToTrigger + Math.abs(r.left - tr.left) / 4;
      if (score < bestScore) { best = row; bestScore = score; }
    }
  }
  return best;
}
