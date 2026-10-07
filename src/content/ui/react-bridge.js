// Brug naar de React-schermen in dist/react-bundle.js (window.__onsahReact).

import { helperPanel } from '../state.js';

// ===== Ingang naar de React-bundel =====
// De schermen van de hulp zitten in dist/react-bundle.js, dat het manifest
// vóór dit bestand laadt. Ontbreekt die bundel — niet gebouwd na een
// wijziging in src/, bestand kwijt, of de vololgorde in het manifest
// gewijzigd — dan bestaat window.__onsahReact niet en zou elke schermaanroep
// stukvallen op een generieke "Er ging iets mis". Daarom één ingang met een
// melding die de oorzaak wél benoemt.
export function onsahReact() {
  var b = (typeof window !== 'undefined') ? window.__onsahReact : null;
  return (b && typeof b.renderWizardScreen === 'function') ? b : null;
}
export function renderBundleMissing(container) {
  if (!container) return;
  try {
    container.innerHTML = '';
    var box = document.createElement('div');
    box.style.cssText = 'font-size:13px;color:#b3261e;font-weight:700;line-height:1.4;padding:6px 0';
    box.textContent = 'De schermen van de hulp konden niet worden geladen.';
    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:12px;color:#6b6367;font-weight:400;margin-top:4px';
    sub.textContent = 'De extensie is waarschijnlijk niet volledig geïnstalleerd. Meld dit via ‘Meld probleem’.';
    box.appendChild(sub);
    container.appendChild(box);
  } catch (e) {}
}
// Alle schermaanroepen lopen hierlangs. Geeft false als er niets getekend kon
// worden, zodat de aanroeper desgewenst kan stoppen.
export function renderScreen(container, name, props) {
  var b = onsahReact();
  if (!b) { renderBundleMissing(container); return false; }
  // Sneltoetsen alleen als het paneel ook echt bedienbaar is: uitgeklapt, hulp
  // aan, en geen info-paneel eroverheen. Anders zou een cijfertoets iets kiezen
  // op een scherm dat de medewerker niet ziet.
  var p = props || {};
  if (p.keyboardEnabled === undefined) {
    p = Object.assign({}, p, { keyboardEnabled: !helperPanel.popupCollapsed && helperPanel.helperEnabled !== false && !helperPanel._infoPanelRestore });
  }
  b.renderWizardScreen(container, name, p);
  return true;
}
