// De brug naar de main-world (src/main-world/): berichten via
// window.postMessage, alleen binnen dit venster en deze origin. Wat de
// main-world meldt, kan een script van de pagina ook sturen; wie luistert,
// behandelt de inhoud dus als invoer van de pagina en controleert hem.

import { PAGE_BRIDGE } from '../../shared/messages.js';

// fn(bericht) bij elk bericht van dit type uit de main-world. -> stoppen()
export function onPageEvent(type, fn) {
  const luister = (ev) => {
    if (ev.origin !== location.origin || (ev.source && ev.source !== window)) return;
    const d = ev.data;
    if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.FROM_MAIN || d.type !== type) return;
    fn(d);
  };
  window.addEventListener('message', luister);
  return () => window.removeEventListener('message', luister);
}

export function toMainWorld(type, velden) {
  window.postMessage({ ...velden, [PAGE_BRIDGE.MARKER]: true, dir: PAGE_BRIDGE.TO_MAIN, type }, location.origin);
}

let volgnummer = 0;
// Een opdracht aan de main-world (PAGE_COMMAND); het antwoord komt met
// hetzelfde id terug. -> Promise met het antwoord, of null na wachtMs.
export function vraagMainWorld(type, antwoordType, velden, wachtMs) {
  return new Promise((klaar) => {
    const id = type + '-' + (++volgnummer) + '-' + Date.now();
    const stop = onPageEvent(antwoordType, (d) => { if (d.id === id) einde(d); });
    const timer = setTimeout(() => einde(null), wachtMs);
    function einde(antwoord) {
      clearTimeout(timer);
      stop();
      klaar(antwoord);
    }
    toMainWorld(type, { ...velden, id });
  });
}
