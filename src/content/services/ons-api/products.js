// Uursoorten (producten) die ONS voor een medewerker + cliënt(en) + datum
// toestaat, via /product_selection/product_list.
//
// Dit is de werkende, primaire bron voor de uursoortkeuze. Waar de ids
// vandaan komen en wat er gebeurt als dit faalt (DOM-terugval), staat in
// features/appointment/uursoort-source.js.

import { clean } from '../../ons/dom.js';
import { _apiUrl } from './endpoints.js';
import { getJson } from './http.js';
import { controleerOns } from './formaat.js';

// Parse de product_selection/basic_list-respons naar een platte, ontdubbelde lijst
// uursoortnamen uit 'Onlangs gebruikt', 'Geadviseerd' én 'Toegestaan'.
export function parseProductList(json) {
  if (!json || !Array.isArray(json.basic_list)) return [];
  const cats = ['Onlangs gebruikt', 'Geadviseerd', 'Toegestaan'];
  const out = [], seen = new Set();
  json.basic_list.forEach(function (group) {
    if (!Array.isArray(group) || cats.indexOf(group[0]) === -1) return;
    const items = Array.isArray(group[1]) ? group[1] : [];
    items.forEach(function (item) {
      const name = Array.isArray(item) ? String(item[0] == null ? '' : item[0]).trim() : '';
      if (!name) return;
      const key = clean(name);
      if (!key || seen.has(key)) return;
      seen.add(key); out.push(name);
    });
  });
  return out;
}

// Verse cache-hit -> direct terug (een prefetch maakt de keuzelijst instant). Ruime TTL:
// de uursoorten voor dezelfde medewerker+cliënt+datum wijzigen niet tijdens het maken van
// één afspraak, dus de warme prefetch blijft geldig ook als je even bezig bent met
// afspraaktype/eindtijd/reistijd. (Met 30 s verliep hij en zag je toch weer "laden".)
const PRODUCT_LIST_TTL_MS = 5 * 60 * 1000;
const productListCache = Object.create(null);

// De toegestane uursoortnamen. Gooit een fout bij een HTTP-fout of een
// onverwachte respons; een geldige respons met een lege lijst is GEEN fout.
export async function fetchProductList({ date, employeeId, clientIds }) {
  // Sjabloon met de eerste cliënt; extra cliënten worden erachter geplakt (multi-cliënt).
  let url = _apiUrl('productList', { date: date, employeeId: employeeId, clientId: clientIds[0] });
  for (let k = 1; k < clientIds.length; k++) {
    url += '&client_ids%5B%5D=' + encodeURIComponent(clientIds[k]);
  }

  const cached = productListCache[url];
  if (cached && (Date.now() - cached.ts) < PRODUCT_LIST_TTL_MS && cached.list && cached.list.length) {
    return cached.list.slice();
  }

  const json = controleerOns('productlijst', await getJson(url));

  const list = parseProductList(json);
  if (list.length) productListCache[url] = { ts: Date.now(), list: list.slice() }; // alleen niet-lege lijsten cachen
  return list;
}
