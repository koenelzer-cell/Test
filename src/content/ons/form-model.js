// Het open afspraakformulier van ONS rechtstreeks bijwerken en lezen, via de
// main-world (src/main-world/index.js): labels, uursoort, titel en andere
// velden, met ONS' eigen Vue-koppeling. Het antwoord is true (gezet en
// nagekeken) of false.
//
// Vaste werkwijze voor elke zetter: eerstViaFormulier(viaFormulier,
// viaScherm). Eerst via het formulier; lukt dat niet, dan één keer via het
// scherm (klikken of typen).

import { PAGE_COMMAND } from '../../shared/messages.js';
import { vraagMainWorld } from '../core/page-bridge.js';
import { APP_CONFIG } from '../config/app-config.js';

// Noodschakelaar (beheerscherm of bedrijfsbeleid): features.formViaModel ===
// false zet de route via het ONS-model uit. Elke zetter gaat dan meteen via
// het scherm, lezen valt terug op de cliëntkaarten en de planhulp zet geen
// model klaar. Voor als een ONS-update het model anders maakt.
export function formulierViaModelAan() {
  return !(APP_CONFIG.features && APP_CONFIG.features.formViaModel === false);
}

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
  return vraagFormulier(PAGE_COMMAND.SET_LABELS, PAGE_COMMAND.LABELS_SET, { labels: lijst, toevoegen: o.toevoegen === true }, o.wachtMs);
}

// Alle labels weghalen (Verwijder instellingen). -> Promise<boolean>
export function wisLabelsViaFormulier(wachtMs) {
  return vraagFormulier(PAGE_COMMAND.SET_LABELS, PAGE_COMMAND.LABELS_SET, { labels: [], wis: true }, wachtMs);
}

// De uursoort van één uursoortveld (per cliënt) zetten. veld: het
// uursoortveld of een element erin/eromheen; het krijgt even een kenmerk
// (data-onsah-doel) zodat de main-world precies dit veld vindt.
// -> Promise<boolean>
export function zetUursoortViaFormulier(veld, hourTypeId, beschrijving, wachtMs) {
  if (!veld || !veld.setAttribute || !(Number(hourTypeId) > 0)) return Promise.resolve(false);
  const doel = 'u' + (++volgnummer) + '-' + Date.now();
  try { veld.setAttribute('data-onsah-doel', doel); } catch (e) { return Promise.resolve(false); }
  return vraagFormulier(PAGE_COMMAND.SET_HOUR_TYPE, PAGE_COMMAND.HOUR_TYPE_SET,
    { doel: doel, hourTypeId: Number(hourTypeId), beschrijving: String(beschrijving == null ? '' : beschrijving).slice(0, 200) }, wachtMs)
    .then((ok) => { try { veld.removeAttribute('data-onsah-doel'); } catch (e) {} return ok; });
}

// De uursoort van een uursoortveld weghalen. -> Promise<boolean>
export function wisUursoortViaFormulier(veld, wachtMs) {
  if (!veld || !veld.setAttribute) return Promise.resolve(false);
  const doel = 'w' + (++volgnummer) + '-' + Date.now();
  try { veld.setAttribute('data-onsah-doel', doel); } catch (e) { return Promise.resolve(false); }
  return vraagFormulier(PAGE_COMMAND.SET_HOUR_TYPE, PAGE_COMMAND.HOUR_TYPE_SET, { doel: doel, wis: true }, wachtMs)
    .then((ok) => { try { veld.removeAttribute('data-onsah-doel'); } catch (e) {} return ok; });
}

// De uursoort van de cliënt met dit (interne) id, vanuit de planhulp: de
// main-world vindt het veld zelf aan de cliënt. -> Promise<boolean>
export function zetUursoortVoorClient(clientId, hourTypeId, beschrijving, wachtMs) {
  if (!/^\d{1,12}$/.test(String(clientId)) || !(Number(hourTypeId) > 0)) return Promise.resolve(false);
  return vraagFormulier(PAGE_COMMAND.SET_HOUR_TYPE, PAGE_COMMAND.HOUR_TYPE_SET,
    { clientId: String(clientId), hourTypeId: Number(hourTypeId), beschrijving: String(beschrijving == null ? '' : beschrijving).slice(0, 200) }, wachtMs);
}

// Eén veld van het afspraakmodel via ONS' eigen onChange: 'name' (titel),
// 'comment', 'start_time'/'end_time' ('14:00'), 'travel_time_before'/'after'
// (minuten). -> Promise<boolean> (true = het model heeft de waarde)
export function zetVeldViaFormulier(veld, waarde, wachtMs) {
  return vraagFormulier(PAGE_COMMAND.SET_FIELD, PAGE_COMMAND.FIELD_SET, { veld: String(veld), waarde: waarde }, wachtMs);
}

// De herhaling van het open afspraakformulier op 'Niet' (Afspraak doorplannen
// uit), met de keuze uit het eigen keuzeveld van ONS. -> Promise<boolean>
export function zetHerhalingNietViaFormulier(wachtMs) {
  return vraagFormulier(PAGE_COMMAND.SET_RECURRENCE_NONE, PAGE_COMMAND.RECURRENCE_SET, {}, wachtMs);
}

// Wat het open formulier bevat (main-world, uit het Vue-model):
// { clients: [{ id, voornaam }], uursoorten: { clientId: hourTypeId|null },
//   labelIds } of null als dat niet lukt. Geen volledige namen.
export function leesFormulier(wachtMs) {
  return vraagFormulier(PAGE_COMMAND.READ_FORM, PAGE_COMMAND.FORM_READ, {}, wachtMs, true);
}

// volledig: het hele antwoord teruggeven (of null) in plaats van true/false.
function vraagFormulier(type, antwoordType, velden, wachtMs, volledig) {
  if (!formulierViaModelAan()) return Promise.resolve(volledig ? null : false);
  return vraagMainWorld(type, antwoordType, velden, wachtMs || 1500).then((d) => {
    const ok = !!d && d.ok === true;
    return volledig ? (ok ? d : null) : ok;
  });
}
