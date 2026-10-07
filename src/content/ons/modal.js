// Het ONS-afspraakvenster (modal) sluiten.

import { CONFIG } from '../config/app-config.js';
import { area, clean, isOwnPopup, rect, visible } from './dom.js';
import { clickElementCenter, clickUiButton } from './form-controls.js';
import { deepQueryAll } from '../ons/dom.js';

// Sluit het ONS-afspraakmodal via de secundaire (Annuleren) knop. De knop is
// een uc-button (web component): de echte <button> zit in de shadow root en
// reageert alleen op een 'composed' klik-sequentie (clickUiButton), niet op een
// gewone .click() die de shadow-grens niet oversteekt.
function ucButtonIsSecondary(host) {
  const inner = host && host.shadowRoot && host.shadowRoot.querySelector('button[part="button"], button');
  return !!(inner && /\bsecondary\b/.test(inner.className || ''));
}
export function closeOnsModal() {
  const hosts = deepQueryAll('uc-button').filter((h) => visible(h) && !isOwnPopup(h));
  // 1. uc-button met light-DOM-tekst "annuleren" (meest specifiek).
  for (const host of hosts) {
    if (clean(host.textContent || '') === 'annuleren' && clickUiButton(host)) return;
  }
  // 2. uc-button met secondary-styling (Annuleren is de secundaire knop).
  for (const host of hosts) {
    if (ucButtonIsSecondary(host) && clickUiButton(host)) return;
  }
  // 3. Fallback: een gewone knop/link met tekst "annuleren" of part+secondary.
  for (const el of deepQueryAll('button,a,[role="button"]')) {
    if (!visible(el) || isOwnPopup(el)) continue;
    const part = el.getAttribute('part') || '';
    const cls = el.className || '';
    const txt = clean(el.textContent || '');
    if (txt === 'annuleren' || (part === 'button' && /\bsecondary\b/.test(cls))) {
      if (clickElementCenter(el)) return;
      try { el.click(); return; } catch (e) {}
    }
  }
}
export function findModal() {
  if (CONFIG.modalPanelSelector) { const p = document.querySelector(CONFIG.modalPanelSelector); if (p) return { host: p, panel: p }; }
  let cands = deepQueryAll('dialog[open],[role="dialog"],[aria-modal="true"]').filter(visible);
  if (!cands.length) cands = deepQueryAll('[class*="modal" i],[class*="dialog" i]').filter(visible);
  if (!cands.length) return null;
  const withForm = cands.filter((c) => /afspraakdetails|opslaan|afspraak toevoegen/i.test(c.textContent || ''));
  const pool = withForm.length ? withForm : cands;
  const host = [...pool].sort((a, b) => area(b) - area(a))[0];
  const panel = [...pool].sort((a, b) => area(a) - area(b)).find((c) => rect(c).width > 480 && rect(c).width < window.innerWidth * 0.96) || pool[0];
  return { host, panel };
}
