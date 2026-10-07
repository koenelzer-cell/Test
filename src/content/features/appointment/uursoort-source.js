// Waar de uursoortopties voor een cliënt vandaan komen.
//
//   1. PRIMAIR de ONS-product-API (services/ons-api/products.js): daarvoor
//      zijn de medewerker-id en de interne cliënt-id nodig.
//   2. TERUGVAL: de uursoort-dropdown in het formulier openen en de opties
//      uitlezen (ons/uursoort-options.js). Dat gebeurt als de API faalt óf een
//      lege lijst geeft.
//
// Om de keuzelijst direct te kunnen tonen, wordt de API al aangeroepen zodra
// een cliënt in het formulier verschijnt (maybePrefetchUursoorten); de
// product-API cachet het antwoord.

import { agendaYmd } from '../../core/datetime.js';
import { clean } from '../../ons/dom.js';
import { findClientEntries, getUursoortTrigger, invalidateClientEntries } from '../../ons/appointment-form.js';
import { openSelectCombobox, searchInputForTrigger, setInputTextComposed } from '../../ons/form-controls.js';
import { clickEmptyModalSpot, dismissOpenDropdowns } from '../../ons/interaction.js';
import { scanClientUursoortOptions } from '../../ons/uursoort-options.js';
import { findClientIdByName } from '../../services/ons-api/clients.js';
import { getEmployeeIdAsync } from '../../services/ons-api/employee.js';
import { fetchProductList } from '../../services/ons-api/products.js';

/* ── Cliënt-id's bij een uursoortveld ─────────────────────────────────── */

// De cliëntkaart waar dit uursoortveld bij hoort.
function clientScope(context, trigger) {
  if (context && context.card) return context.card;
  if (trigger && trigger.closest) {
    return trigger.closest('ul[class*="_selected-clients_"] > li')
      || trigger.closest('ul[data-qa="selected_clients"] > li')
      || trigger.closest('li') || null;
  }
  return null;
}
function scopeClientName(scope, context) {
  if (scope) {
    const el = scope.querySelector('span[class*="invitee-name"], span[class*="_invitee-name_"]');
    const nm = el ? String(el.innerText || el.textContent || '').trim() : '';
    if (nm) return nm;
  }
  return (context && context.name) ? String(context.name).trim() : '';
}

// Interne cliënt-id('s) voor de product-API.
async function getClientIdsAsync(context, trigger) {
  const candidates = [];
  const add = (v) => {
    const s = String(v == null ? '' : v).trim();
    if (/^\d+$/.test(s) && !candidates.includes(s)) candidates.push(s);
  };

  const scope = clientScope(context, trigger);
  // Naam van DEZE cliënt: eerst de bekende context.name (betrouwbaar per cliënt),
  // anders de naam uit de gescopede rij. BEWUST geen document-brede fallback -> die
  // pakt bij meerdere cliënten steeds de eerste naam (kruisbesmetting).
  const name = String((context && context.name) || scopeClientName(scope, null) || '').trim();

  // PRIMAIR: de INTERNE id van DEZE cliënt via de VOLLEDIGE naam (search_panel). Belangrijk
  // is dat we de volledige weergavenaam gebruiken, niet een deelterm (bv. alleen "test"),
  // anders geeft de zoekopdracht meerdere cliënten en pakken we de verkeerde id.
  if (name) {
    const byName = await findClientIdByName(name);
    if (byName) return [byName];
  }

  // TERUGVAL 1: gescopede DOM-bronnen (deze cliënt).
  if (context && context.clientId != null) add(context.clientId);
  if (scope) {
    scope.querySelectorAll('input[name="event[client_ids][]"], input[name="client_id"], input[type="hidden"][name*="client"]').forEach((el) => add(el.value));
    scope.querySelectorAll('[data-client-id],[data-patient-id]').forEach((el) => { add(el.getAttribute('data-client-id')); add(el.getAttribute('data-patient-id')); });
    if (candidates.length) return candidates.slice(0, 1);
  }

  // TERUGVAL 2 (geen scope/naam): globale bronnen (single-client legacy).
  const href = String(location.href || '');
  const m = href.match(/client_id[s]?(?:%5B%5D|\[\])=(\d+)/g);
  if (m) m.forEach((match) => { const id = match.match(/(\d+)/); if (id) add(id[1]); });
  else { const singleMatch = href.match(/\/clients\/(\d+)/i); if (singleMatch) add(singleMatch[1]); }
  document.querySelectorAll('input[name="event[client_ids][]"], input[name="client_id"], input[type="hidden"][name*="client"]').forEach((el) => add(el.value));

  return candidates;
}

/* ── Via de API ───────────────────────────────────────────────────────── */

export async function fetchClientUursoortOptionsApi(context, trigger) {
  const employeeId = await getEmployeeIdAsync();
  const clientIds = await getClientIdsAsync(context, trigger);
  if (!employeeId) throw new Error('geen employee-id gevonden');
  if (!clientIds || clientIds.length === 0) throw new Error('geen client-id gevonden');
  return fetchProductList({ date: agendaYmd(new Date()), employeeId: employeeId, clientIds: clientIds });
}

// Warmt de cache alvast op, zodat de keuzelijst later direct gevuld is.
function prefetchClientUursoorten(context, trigger) {
  try { fetchClientUursoortOptionsApi(context || null, trigger || null).catch(function () {}); } catch (e) {}
}

// Prefetch de uursoorten ZO VROEG MOGELIJK: al zodra een cliënt(naam) in beeld komt —
// we wachten NIET tot het uursoort-veld gerenderd is. De interne id komt uit de naam
// (search_panel), dus de product_list-call kan al meteen na het toevoegen van de cliënt.
// Per cliëntnaam maar één keer, zodat elke nieuwe cliënt direct zijn eigen prefetch krijgt.
let prefetchedNames = Object.create(null);
export function resetPrefetchedUursoorten() { prefetchedNames = Object.create(null); }
export function maybePrefetchUursoorten() {
  try {
    // Verse lezing: een net toegevoegde cliënt moet meteen meetellen (anders wacht de
    // prefetch op de volgende tik en verschijnt het laadscherm alsnog).
    invalidateClientEntries();
    findClientEntries().forEach(function (e) {
      const nm = (e && e.name) ? String(e.name).trim() : '';
      if (!nm) return;
      const key = (location.pathname || '') + '|' + clean(nm);
      if (prefetchedNames[key]) return;
      prefetchedNames[key] = true;
      // Achtergrond-call: interne id op naam ophalen + product_list warmen. Het latere
      // openen van de keuzelijst (na eindtijd/reistijd) is dan een directe cache-hit.
      prefetchClientUursoorten({ name: nm, trigger: (e && e.uursoortTrigger) || null }, (e && e.uursoortTrigger) || null);
    });
  } catch (e) {}
}

/* ── Opties ophalen: API, anders de dropdown uitlezen ─────────────────── */

// Roept cb(lijst) aan met de uursoortnamen, of cb(null) als er geen
// uursoortveld is. `scrape` = meteen de dropdown uitlezen (de terugvalroute).
export function listUursoortOptions(cb, triggerArg = null, attempt = 0, scrape = false, clientContext = null) {
  const trigger = triggerArg || getUursoortTrigger();
  if (!trigger) { cb(null); return; }

  if (scrape) { scrapeUursoortOptions(cb, trigger, triggerArg, attempt, clientContext); return; }

  fetchClientUursoortOptionsApi(clientContext, trigger)
    .then(function (out) {
      if (out && out.length > 0) cb(out);
      else throw new Error('API leverde een lege lijst op');
    })
    .catch(function () {
      dismissOpenDropdowns();
      setTimeout(() => listUursoortOptions(cb, triggerArg, attempt, true, clientContext), 70);
    });
}

// Terugval: open de uursoort-dropdown, maak het zoekveld leeg en lees de opties.
// ONS-WORKAROUND: de dropdown bouwt zijn opties asynchroon op; de vertragingen
// (170/140/20 ms) en maximaal 3 pogingen zijn empirisch bepaald.
function scrapeUursoortOptions(cb, trigger, triggerArg, attempt, clientContext) {
  const openedBy = openSelectCombobox(trigger) || trigger;
  setTimeout(() => {
    const input = searchInputForTrigger(openedBy) || searchInputForTrigger(trigger);
    if (input) {
      input.focus();
      setInputTextComposed(input, '');
    }
    setTimeout(() => {
      scanClientUursoortOptions(trigger, (out) => {
        if (!out.length && attempt < 2) {
          clickEmptyModalSpot();
          setTimeout(() => listUursoortOptions(cb, triggerArg, attempt + 1, true, clientContext), 140);
          return;
        }
        cb(out);
        setTimeout(clickEmptyModalSpot, 60);
      });
    }, input ? 140 : 20);
  }, 170);
}
