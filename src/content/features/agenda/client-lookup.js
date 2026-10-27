// Planhulp, meerdere afspraken: cliënt zoeken op naam (dezelfde zoekfunctie
// als ONS bij 'Genodigden toevoegen') en de postcode erbij, zodat niemand
// postcodes uit het hoofd hoeft te weten.
//
// PRIVACY: namen, cliëntnummer en geboortedatum gaan alleen naar het zijpaneel van deze extensie (zoals ONS
// ze zelf toont) en worden nergens bewaard. Buiten ONS gaat alleen de
// postcode (Google Routes).

import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { getJson } from '../../services/ons-api/http.js';
import { controleerOns } from '../../services/ons-api/formaat.js';
import { postcodeFromClient } from '../../domain/route.js';
import { medewerkersUitZoek } from '../../domain/collega.js';
import { agendaIds } from './free-slots.js';

export const MAX_TREFFERS = 8;

// search_panel-antwoord -> [{ id, name, pc, number, birth }]
// number: cliëntnummer (identification_no), birth: geboortedatum zoals ONS
// hem geeft ('01-01-1984'): om de juiste cliënt te kiezen, net als in ONS.
export function clientsForPlan(json) {
  const lijst = (json && Array.isArray(json.clients)) ? json.clients : (Array.isArray(json) ? json : []);
  return lijst.filter(function (c) { return c && c.id != null; }).slice(0, MAX_TREFFERS).map(function (c) {
    const naam = c.display_name || c.name || c.full_name || c.sortable_name || '';
    const tekst = function (v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, 40); };
    const uit = { id: String(c.id), name: tekst(naam).slice(0, 200) || String(naam), pc: postcodeFromClient(c), number: tekst(c.identification_no), birth: tekst(c.date_of_birth) };
    // Uit zorg (alleen als ONS het aangeeft): als label in de lijst.
    if (c.out_of_care === true || c.in_care === false) uit.outOfCare = true;
    return uit;
  });
}

// term (min. 2 tekens) -> Promise<[{ id, name, pc }]>
// outOfCare: ook cliënten die uit zorg zijn (out_of_care=true, zoals in ONS).
export function searchClientsForPlan(term, outOfCare) {
  const t = String(term || '').trim();
  if (t.length < 2) return Promise.resolve([]);
  return getJson(_apiUrl('searchClients', { term: t, outOfCare: outOfCare === true ? 'true' : 'false' })).then(function (j) { return clientsForPlan(controleerOns('clienten', j)); });
}

// Afspraak maken: een collega zoeken (dezelfde zoekfunctie als ONS bij
// 'Genodigden toevoegen'). Wie al als agenda open staat, telt niet mee.
// term (min. 2 tekens) -> Promise<[{ id, name, team, kanUitnodigen }]>
export function searchEmployeesForPlan(term) {
  const t = String(term || '').trim();
  if (t.length < 2) return Promise.resolve([]);
  return getJson(_apiUrl('searchEmployees', { term: t })).then(function (j) { return medewerkersUitZoek(controleerOns('medewerkers', j), agendaIds()); });
}
