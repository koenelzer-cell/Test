// Het open afspraakformulier van ONS rechtstreeks bijwerken en lezen, via de
// main-world (src/main-world/index.js): labels, uursoort, titel en andere
// velden, met ONS' eigen Vue-koppeling. Het antwoord is true (gezet en
// nagekeken) of false.
//
// Vaste werkwijze voor elke zetter: eerstViaFormulier(viaFormulier,
// viaScherm). Eerst via het formulier; lukt dat niet, dan één keer via het
// scherm (klikken of typen).

import { PAGE_BRIDGE, PAGE_COMMAND } from '../../shared/messages.js';

let volgnummer = 0;

// viaFormulier: () => Promise<boolean>; viaScherm: () => waarde of Promise.
// -> Promise met true (formulier gelukt) of de uitkomst van viaScherm.
export function eerstViaFormulier(viaFormulier, viaScherm) {
  return Promise.resolve().then(viaFormulier).then((ok) => (ok ? true : viaScherm()), () => viaScherm());
}

// namen: labelnamen zoals in de config ('JG Huisbezoek'). De set vervangt
// wat er stond, of komt erbij met { toevoegen: true }. -> Promise<boolean>
export function zetLabelsViaFormulier(namen, opties) {
  const lijst = (Array.isArray(namen) ? namen : [namen]).map((n) => String(n == null ? '' : n).trim()).filter(Boolean);
  if (!lijst.length) return Promise.resolve(false);
  const o = typeof opties === 'number' ? { wachtMs: opties } : (opties || {});
  return vraagMainWorld(PAGE_COMMAND.SET_LABELS, PAGE_COMMAND.LABELS_SET, { labels: lijst, toevoegen: o.toevoegen === true }, o.wachtMs);
}

// Alle labels weghalen (Verwijder instellingen). -> Promise<boolean>
export function wisLabelsViaFormulier(wachtMs) {
  return vraagMainWorld(PAGE_COMMAND.SET_LABELS, PAGE_COMMAND.LABELS_SET, { labels: [], wis: true }, wachtMs);
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

// De uursoort van een uursoortveld weghalen. -> Promise<boolean>
export function wisUursoortViaFormulier(veld, wachtMs) {
  if (!veld || !veld.setAttribute) return Promise.resolve(false);
  const doel = 'w' + (++volgnummer) + '-' + Date.now();
  try { veld.setAttribute('data-onsah-doel', doel); } catch (e) { return Promise.resolve(false); }
  return vraagMainWorld(PAGE_COMMAND.SET_HOUR_TYPE, PAGE_COMMAND.HOUR_TYPE_SET, { doel: doel, wis: true }, wachtMs)
    .then((ok) => { try { veld.removeAttribute('data-onsah-doel'); } catch (e) {} return ok; });
}

// De uursoort van de cliënt met dit (interne) id, vanuit de planhulp: de
// main-world vindt het veld zelf aan de cliënt. -> Promise<boolean>
export function zetUursoortVoorClient(clientId, hourTypeId, beschrijving, wachtMs) {
  if (!/^\d{1,12}$/.test(String(clientId)) || !(Number(hourTypeId) > 0)) return Promise.resolve(false);
  return vraagMainWorld(PAGE_COMMAND.SET_HOUR_TYPE, PAGE_COMMAND.HOUR_TYPE_SET,
    { clientId: String(clientId), hourTypeId: Number(hourTypeId), beschrijving: String(beschrijving == null ? '' : beschrijving).slice(0, 200) }, wachtMs);
}

// Eén veld van het afspraakmodel via ONS' eigen onChange: 'name' (titel),
// 'comment', 'start_time'/'end_time' ('14:00'), 'travel_time_before'/'after'
// (minuten). -> Promise<boolean> (true = het model heeft de waarde)
export function zetVeldViaFormulier(veld, waarde, wachtMs) {
  return vraagMainWorld(PAGE_COMMAND.SET_FIELD, PAGE_COMMAND.FIELD_SET, { veld: String(veld), waarde: waarde }, wachtMs);
}

// Wat het open formulier bevat (main-world, uit het Vue-model):
// { clients: [{ id, voornaam }], uursoorten: { clientId: hourTypeId|null },
//   labelIds } of null als dat niet lukt. Geen volledige namen.
export function leesFormulier(wachtMs) {
  return vraagMainWorld(PAGE_COMMAND.READ_FORM, PAGE_COMMAND.FORM_READ, {}, wachtMs, true);
}

// volledig: het hele antwoord teruggeven (of null) in plaats van true/false.
function vraagMainWorld(type, antwoordType, velden, wachtMs, volledig) {
  return new Promise((klaar) => {
    const id = type + '-' + (++volgnummer) + '-' + Date.now();
    let gemeld = false;
    const luister = (ev) => {
      if (!ev || ev.origin !== location.origin || (ev.source && ev.source !== window)) return;
      const d = ev.data;
      if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.FROM_MAIN || d.type !== antwoordType || d.id !== id) return;
      einde(volledig ? (d.ok === true ? d : null) : d.ok === true);
    };
    const timer = setTimeout(() => einde(volledig ? null : false), wachtMs || 1500);
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
    } catch (e) { einde(volledig ? null : false); }
  });
}
