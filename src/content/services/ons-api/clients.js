// Cliënten zoeken in ONS (search_panel) om de INTERNE cliënt-id bij een naam
// te vinden. Die id is nodig voor de product-API (uursoorten).
//
// PRIVACY: de zoekresultaten bevatten namen; die worden alleen gebruikt om de
// juiste cliënt te kiezen en daarna weggegooid. Alleen de id wordt (per naam)
// in het geheugen van deze pagina bewaard.

import { clean } from '../../ons/dom.js';
import { _apiUrl } from './endpoints.js';
import { getJson } from './http.js';

// Kies uit de search_panel-respons ({clients:[{id,external_id,display_name,...}]}) de
// cliënt die op naam matcht en geef diens INTERNE id (bv. 11142).
// NOOIT external_id (die is voor Ons Administratie).
export function pickClientIdFromSearch(json, name) {
  const clients = (json && Array.isArray(json.clients)) ? json.clients : (Array.isArray(json) ? json : []);
  if (!clients.length) return null;
  const namesOf = (c) => [c && c.display_name, c && c.name, c && c.sortable_name, c && c.full_name].filter(Boolean).map(clean);
  const idOf = (c) => (c && c.id != null) ? String(c.id) : null;
  const want = clean(name);
  if (want) {
    // 1. Exacte naam-match op een van de naamvelden.
    const exact = clients.find((c) => namesOf(c).some((n) => n === want));
    if (exact) return idOf(exact);
    // 2. Alle woorden uit de gezochte naam komen voor bij precies één cliënt (vangt
    //    "Achternaam, Voornaam" vs "Voornaam Achternaam" en extra tussenvoegsels af).
    const tokens = want.split(' ').filter(Boolean);
    if (tokens.length) {
      const tokMatch = clients.filter((c) => {
        const blob = namesOf(c).join(' ');
        return tokens.every((t) => blob.indexOf(t) !== -1);
      });
      if (tokMatch.length === 1) return idOf(tokMatch[0]);
    }
  }
  // 3. Precies één resultaat -> eenduidig, ook zonder naam.
  if (clients.length === 1) return idOf(clients[0]);
  // 4. Meerdere resultaten en geen zekere match -> NIET gokken (liever geen id dan de
  //    verkeerde cliënt en dus verkeerde uursoorten).
  return null;
}

// Zoekresultaten voor één term + zorg-scope (array met cliënten; [] bij een fout).
async function searchClients(term, outOfCare) {
  try {
    const json = await getJson(_apiUrl('searchClients', { term: term, outOfCare: outOfCare }));
    return (json && Array.isArray(json.clients)) ? json.clients : (Array.isArray(json) ? json : []);
  } catch (e) {
    return [];
  }
}

// De INTERNE cliënt-id bij een volledige weergavenaam, of null. Gecached per naam.
const clientIdByName = Object.create(null);
export async function findClientIdByName(name) {
  const nm = String(name || '').trim();
  if (!nm) return null;
  if (clientIdByName[nm]) return clientIdByName[nm];
  // Zoek zowel IN ZORG (out_of_care=false) als UIT ZORG (out_of_care=true): een cliënt
  // kan in beide categorieën vallen. Eerst 'in zorg' (meest voorkomend); alleen bij géén
  // zekere match ook 'uit zorg' erbij, gecombineerd en ontdubbeld op id. Zo missen we een
  // cliënt niet (en slaan we die niet over) enkel omdat die 'uit zorg' is.
  const clients = await searchClients(nm, 'false');
  let id = pickClientIdFromSearch({ clients }, nm);
  if (!id) {
    const more = await searchClients(nm, 'true');
    const byId = new Map();
    clients.concat(more).forEach((c) => { if (c && c.id != null) byId.set(String(c.id), c); });
    id = pickClientIdFromSearch({ clients: Array.from(byId.values()) }, nm);
  }
  if (id) { clientIdByName[nm] = id; return id; }
  return null;
}
