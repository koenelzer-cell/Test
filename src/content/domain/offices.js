// Kantoorlocaties: welke ONS-locatie hoort bij welk kantoor (postcode)?
// De lijst staat in de configuratie (offices); zie config/defaults.js.

import { APP_CONFIG } from '../config/app-config.js';

function woordIn(naam, woord) {
  // Heel woord: 'oss' mag niet matchen in 'Bosschenhoofd'; 'ede' niet in 'Veldhoven'.
  const w = String(woord).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-zà-ÿ])' + w + '($|[^a-zà-ÿ])', 'i').test(naam);
}

// 'J&G Oosterhout' -> { name: 'Breda', postcode: '4822NH' } of null.
// Alleen locaties die beginnen met 'BG' (Begeleiding) of 'J&G' (Jeugd en
// Gezin) zijn kantoren; de rest (bijv. 'GGZ volwassenen', 'Jeugd en Gezin')
// is een organisatie-eenheid en telt niet. Langere zoekwoorden gaan voor
// ('den haag zuid-west' vóór 'zuid-west').
export function officeSector(locationName) {
  const naam = String(locationName || '').trim();
  if (/^bg(\s|$)/i.test(naam)) return 'bv';
  if (/^j\s*&\s*g(\s|$)/i.test(naam)) return 'jg';
  return '';
}
export function officeForLocation(locationName, offices) {
  const naam = String(locationName || '').trim();
  const sector = officeSector(naam);
  if (!sector) return null;
  const rest = naam.replace(/^(bg|j\s*&\s*g)\s*/i, '').replace(/\([^)]*\)/g, ' ');
  const lijst = Array.isArray(offices) ? offices : (APP_CONFIG.offices || []);
  const kandidaten = [];
  lijst.forEach(function (o) {
    if (!o || (o.sector || 'bv') !== sector) return;
    (o.match && o.match.length ? o.match : [o.name]).forEach(function (w) { if (w && woordIn(rest, w)) kandidaten.push({ o: o, len: String(w).length }); });
  });
  if (!kandidaten.length) return null;
  kandidaten.sort(function (a, b) { return b.len - a.len; });
  return { name: kandidaten[0].o.name, postcode: String(kandidaten[0].o.postcode || '').replace(/\s+/g, '').toUpperCase() };
}
