// Netwerklog voor ontwikkeling (zijpaneel, Info, Debug, Netwerk): elk verzoek
// van ONS zelf (de main-world meldt ze, PAGE_EVENT.NET_REQUEST) en van de hulp
// (http.js), met methode, adres, status, duur en grootte. Alleen zolang het
// zijpaneel erom vraagt: elke vraag (MSG.AGENDA_NETLOG) houdt het 15 seconden
// aan. De laatste 300 staan alleen in het geheugen van dit tabblad en gaan weg
// zodra het log uit gaat; niets wordt opgeslagen. Zoekwaarden worden
// gemaskeerd (shared/netwerk-masker.js: een zoekterm kan een cliëntnaam zijn);
// id's in het pad blijven staan.

import { onPageEvent, toMainWorld } from '../../core/page-bridge.js';
import { PAGE_COMMAND, PAGE_EVENT } from '../../../shared/messages.js';
import { maskeerZoek } from '../../../shared/netwerk-masker.js';

const BEWAAR = 300, AAN_MS = 15000;
// Per geladen pagina een eigen sessie: na een herlaad of een ander tabblad
// begint het zijpaneel weer bij het begin.
const SESSIE = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
let tot = 0, volgnummer = 0, items = [], stoppen = [], controle = null;

export function netwerklogAan() { return Date.now() < tot; }

// Een adres zoals het log het toont: op deze origin het pad, anders volledig;
// de zoekwaarden gemaskeerd (maskeerZoek).
export function logAdres(url) {
  try {
    const u = new URL(String(url == null ? '' : url), location.href);
    return ((u.origin === location.origin ? u.pathname : u.origin + u.pathname) + maskeerZoek(u.search)).slice(0, 2000);
  } catch (e) { return String(url == null ? '' : url).split('?')[0].slice(0, 2000); }
}
export function logVerzoek(bron, v) {
  if (!netwerklogAan()) return;
  items.push({
    id: ++volgnummer, tijd: Date.now(), bron: bron,
    methode: String(v.methode || 'GET').toUpperCase().slice(0, 10), url: logAdres(v.url),
    status: Number(v.status) || 0, ms: Math.max(0, Math.round(Number(v.ms) || 0)),
    grootte: Number(v.grootte) >= 0 && v.grootte !== '' && v.grootte != null ? Number(v.grootte) : null,
  });
  if (items.length > BEWAAR) items = items.slice(-BEWAAR);
}
function zetUit() {
  tot = 0; items = [];
  clearInterval(controle); controle = null;
  stoppen.forEach(function (s) { s(); }); stoppen = [];
  toMainWorld(PAGE_COMMAND.SET_NETLOG, { aan: false });
}
export function netwerklogSessie() { return SESSIE; }
// Het zijpaneel vraagt om de verzoeken na 'sinds' en houdt het log zo aan.
export function netwerklogSinds(sinds) {
  const was = netwerklogAan();
  tot = Date.now() + AAN_MS;
  if (!was) {
    toMainWorld(PAGE_COMMAND.SET_NETLOG, { aan: true });
    if (!stoppen.length) {
      stoppen.push(onPageEvent(PAGE_EVENT.NET_REQUEST, function (d) { logVerzoek('ons', d); }));
      stoppen.push(onPageEvent(PAGE_EVENT.MAIN_READY, function () { if (netwerklogAan()) toMainWorld(PAGE_COMMAND.SET_NETLOG, { aan: true }); }));
    }
    if (!controle) controle = setInterval(function () { if (!netwerklogAan()) zetUit(); }, 5000);
  }
  const n = Number(sinds) || 0;
  return items.filter(function (it) { return it.id > n; });
}
