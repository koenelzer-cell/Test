// Planhulp, meerdere afspraken: cliënt zoeken op naam (dezelfde zoekfunctie
// als ONS bij 'Genodigden toevoegen') en de postcode erbij, zodat niemand
// postcodes uit het hoofd hoeft te weten.
//
// PRIVACY: namen gaan alleen naar het zijpaneel van deze extensie (zoals ONS
// ze zelf toont) en worden nergens bewaard. Buiten ONS gaat alleen de
// postcode (PDOK / Google Routes).

import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { getJson } from '../../services/ons-api/http.js';
import { postcodeFromClient } from '../../domain/route.js';

export const MAX_TREFFERS = 8;

// search_panel-antwoord -> [{ id, name, pc }]
export function clientsForPlan(json) {
  var lijst = (json && Array.isArray(json.clients)) ? json.clients : (Array.isArray(json) ? json : []);
  return lijst.filter(function (c) { return c && c.id != null; }).slice(0, MAX_TREFFERS).map(function (c) {
    var naam = c.display_name || c.name || c.full_name || c.sortable_name || '';
    return { id: String(c.id), name: String(naam).replace(/\s+/g, ' ').trim(), pc: postcodeFromClient(c) };
  });
}

// term (min. 2 tekens) -> Promise<[{ id, name, pc }]>
export function searchClientsForPlan(term) {
  var t = String(term || '').trim();
  if (t.length < 2) return Promise.resolve([]);
  return getJson(_apiUrl('searchClients', { term: t, outOfCare: 'false' })).then(clientsForPlan);
}
