// Het open afspraakformulier van ONS rechtstreeks bijwerken, via de
// main-world (src/main-world/index.js, taak 6): labels en uursoort. Die gebruikt ONS' eigen
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
  return vraagMainWorld(PAGE_COMMAND.SET_LABELS, PAGE_COMMAND.LABELS_SET, { labels: lijst }, wachtMs);
}

// De uursoort van één uursoortveld (per cliënt) zetten. veld: het
// uursoortveld of een element erin/eromheen; het krijgt even een kenmerk
// (data-onsah-doel) zodat de main-world precies dit veld vindt.
// -> Promise<boolean>
export function zetUursoortViaFormulier(veld, hourTypeId, beschrijving, wachtMs) {
  if (!veld || !veld.setAttribute || !(Number(hourTypeId) > 0)) return Promise.resolve(false);
  const doel = 'u' + (++volgnummer) + '-' + Date.now();
  try { veld.setAttribute('data-onsah-doel', doel); } catch (e) { return Promise.resolve(false); }
  return vraagMainWorld(PAGE_COMMAND.SET_HOUR_TYPE, PAGE_COMMAND.HOUR_TYPE_SET,
    { doel: doel, hourTypeId: Number(hourTypeId), beschrijving: String(beschrijving == null ? '' : beschrijving).slice(0, 200) }, wachtMs)
    .then((ok) => { try { veld.removeAttribute('data-onsah-doel'); } catch (e) {} return ok; });
}

function vraagMainWorld(type, antwoordType, velden, wachtMs) {
  return new Promise((klaar) => {
    const id = type + '-' + (++volgnummer) + '-' + Date.now();
    let gemeld = false;
    const luister = (ev) => {
      if (!ev || ev.origin !== location.origin || (ev.source && ev.source !== window)) return;
      const d = ev.data;
      if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.FROM_MAIN || d.type !== antwoordType || d.id !== id) return;
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
      window.postMessage(Object.assign({ [PAGE_BRIDGE.MARKER]: true, dir: PAGE_BRIDGE.TO_MAIN, type: type, id: id }, velden), location.origin);
    } catch (e) { einde(false); }
  });
}
