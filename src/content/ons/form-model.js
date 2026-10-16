// Het open afspraakformulier van ONS rechtstreeks bijwerken, via de
// main-world (src/main-world/index.js, taak 6). Die gebruikt ONS' eigen
// Vue-koppeling van het veld, dus er gaat geen dropdown open. Het antwoord is
// true (gezet en nagekeken) of false; bij false doet de aanroeper het zoals
// vroeger, met klikken.

import { PAGE_BRIDGE, PAGE_COMMAND } from '../../shared/messages.js';

let volgnummer = 0;

// namen: labelnamen zoals in de config ('JG Huisbezoek'). De set vervangt
// wat er stond. -> Promise<boolean>
export function zetLabelsViaFormulier(namen, wachtMs) {
  const lijst = (Array.isArray(namen) ? namen : [namen]).map((n) => String(n == null ? '' : n).trim()).filter(Boolean);
  if (!lijst.length) return Promise.resolve(false);
  return new Promise((klaar) => {
    const id = 'labels-' + (++volgnummer) + '-' + Date.now();
    let gemeld = false;
    const luister = (ev) => {
      if (!ev || ev.origin !== location.origin || (ev.source && ev.source !== window)) return;
      const d = ev.data;
      if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.FROM_MAIN || d.type !== PAGE_COMMAND.LABELS_SET || d.id !== id) return;
      einde(d.ok === true);
    };
    const timer = setTimeout(() => einde(false), wachtMs || 1500);
    function einde(ok) {
      if (gemeld) return;
      gemeld = true;
      clearTimeout(timer);
      window.removeEventListener('message', luister);
      klaar(ok);
    }
    window.addEventListener('message', luister);
    try {
      window.postMessage({ [PAGE_BRIDGE.MARKER]: true, dir: PAGE_BRIDGE.TO_MAIN, type: PAGE_COMMAND.SET_LABELS, id: id, labels: lijst }, location.origin);
    } catch (e) { einde(false); }
  });
}
