// Na een update van de extensie stopt de hulp in deze pagina en vraagt hij om
// herladen (zie shared/losgekoppeld.js).

import { bijLosgekoppeld } from '../../shared/losgekoppeld.js';
import { stopModuleHost } from '../platform/module-host.js';
import { svgIcon } from '../ui/icons.js';
import { deactivateAgendaPage } from '../features/agenda/lifecycle.js';
import { deactivate } from './lifecycle.js';
import { stopUrlWatch } from './routing.js';

const ICON_VERVERS = 'M17.7 6.3A8 8 0 1 0 19.7 14h-2.1a6 6 0 1 1-1.4-6.2L13 11h7V4z';

export function bewaakVerbinding() {
  bijLosgekoppeld(() => {
    // Elke stap apart: zonder verbinding kan een stap falen op een chrome-API,
    // en dan moet de rest toch opgeruimd worden.
    for (const stap of [stopUrlWatch, stopModuleHost, deactivate, deactivateAgendaPage]) {
      try { stap(); } catch (e) { /* zie hierboven */ }
    }
    toonHerladen();
  });
}

function toonHerladen() {
  const kaart = document.createElement('div');
  kaart.setAttribute('data-ons-agendahulp', 'herladen');
  Object.assign(kaart.style, {
    position: 'fixed', left: '16px', bottom: '16px', zIndex: '2147483647', maxWidth: '320px',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px',
    background: '#fff', color: '#201d1f', border: '1px solid #ece7e5', borderLeft: '4px solid #cc087d',
    borderRadius: '12px', padding: '10px 12px', boxShadow: '0 4px 16px rgba(0,0,0,.16)',
    font: '13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  });
  kaart.appendChild(document.createTextNode('De Agendahulp is bijgewerkt. Herlaad de pagina om hem weer te gebruiken.'));
  const knop = document.createElement('button');
  knop.type = 'button';
  Object.assign(knop.style, {
    display: 'inline-flex', alignItems: 'center', gap: '6px', border: '0', borderRadius: '8px',
    padding: '6px 12px', background: '#cc087d', color: '#fff', font: '600 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', cursor: 'pointer',
  });
  knop.appendChild(svgIcon(ICON_VERVERS));
  knop.appendChild(document.createTextNode('Pagina herladen'));
  knop.addEventListener('click', () => location.reload());
  kaart.appendChild(knop);
  (document.body || document.documentElement).appendChild(kaart);
}
