// Het info-scherm van het hulppaneel.

import { supportTopdeskUrl } from '../config/app-config.js';
import { helperPanel } from '../state.js';
import { $body, safe, showDisabledState } from '../screen/status.js';
import { mkBackButton } from '../ui/controls.js';
import { resetBody } from '../screen/screen-state.js';
import { SCRIPT_VERSION } from '../../shared/version.js';
import { schermen } from '../screen/schermen.js';

function closeInfoPanel() {
  if (!helperPanel._infoPanelRestore) return;
  const restore = helperPanel._infoPanelRestore;
  helperPanel._infoPanelRestore = null;
  restore();
}
export function toggleInfoPanel() {
  // tweede klik op de i-knop werkt als terug
  if (helperPanel._infoPanelRestore) { closeInfoPanel(); return; }
  showInfoPanel();
}
function showInfoPanel() {
  const body = $body(); if (!body) return;
  if (helperPanel._infoPanelRestore) return; // al open: niet opnieuw opbouwen
  helperPanel._infoPanelRestore = helperPanel.helperEnabled ? schermen.createCurrentScreenRestore() : () => showDisabledState();
  const statusEl = helperPanel.popupEl && helperPanel.popupEl.querySelector('[data-status]');
  resetBody(body);
  body.appendChild(mkBackButton(() => safe(closeInfoPanel), 'Terug'));

  const title = document.createElement('div');
  title.textContent = (helperPanel.activeMode === 'registrations' ? 'Registratiehulp' : 'Afspraakhulp');
  Object.assign(title.style, { fontWeight: '700', fontSize: '14px', margin: '6px 0 2px' });
  body.appendChild(title);

  const ver = document.createElement('div');
  ver.textContent = `Versie ${SCRIPT_VERSION}`;
  Object.assign(ver.style, { fontSize: '13px', color: '#333', margin: '0 0 8px' });
  body.appendChild(ver);

  const help = document.createElement('div');
  Object.assign(help.style, { fontSize: '13px', color: '#333', lineHeight: '1.4' });
  help.appendChild(document.createTextNode('Vragen of verbetersuggesties kunnen worden gesteld via '));
  const link = document.createElement('a');
  link.textContent = 'Topdesk';
  link.href = supportTopdeskUrl();
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  Object.assign(link.style, { color: '#cc087d', textDecoration: 'underline' });
  help.appendChild(link);
  help.appendChild(document.createTextNode('.'));
  body.appendChild(help);

  if (statusEl) { statusEl.textContent = ''; }
}
