// Schakelaar voor de wekelijkse herinnering (service worker: reminder.js).
// Standaard uit: een melding is opdringerig, dus dat hoort een bewuste keuze te
// zijn en geen verrassing na een update.

import { MSG } from '../shared/messages.js';
import { el } from './dom.js';

const DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

function stuur(msg) {
  return new Promise(function (resolve) {
    try { chrome.runtime.sendMessage(msg, function (r) { resolve(r || null); }); }
    catch (e) { resolve(null); }
  });
}

function uitleg(st) {
  return st.enabled
    ? ('Elke ' + (DAGEN[(st.weekday || 5) - 1] || 'vrijdag') + ' om ' +
       String(st.hour).padStart(2, '0') + ':' + String(st.minute).padStart(2, '0') +
       ' een melding als er nog tijd openstaat.')
    : 'Uit. Je krijgt geen meldingen.';
}

export function reminderToggle(setStatus) {
  const wrap = el('div');
  wrap.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid #e5e5e5';

  const rij = el('div');
  rij.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px';
  const vink = el('input', { type: 'checkbox', id: 'herinner' });
  const tekst = el('label', { for: 'herinner' }, 'Wekelijkse herinnering');
  tekst.style.cssText = 'cursor:pointer';
  rij.appendChild(vink); rij.appendChild(tekst);
  wrap.appendChild(rij);

  const toelichting = el('div');
  toelichting.style.cssText = 'font-size:11px;color:#666;margin-top:4px';
  wrap.appendChild(toelichting);

  stuur({ type: MSG.REMINDER_GET }).then(function (r) {
    const s = (r && r.settings) || {};
    vink.checked = !!s.enabled;
    toelichting.textContent = uitleg(s);
    vink.addEventListener('change', function () {
      stuur({ type: MSG.REMINDER_SETTINGS, enabled: vink.checked }).then(function (res) {
        if (res && res.settings) toelichting.textContent = uitleg(res.settings);
        setStatus(vink.checked ? 'Herinnering aan.' : 'Herinnering uit.');
      });
    });
  });

  return wrap;
}
