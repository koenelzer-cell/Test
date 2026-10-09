// Kantoorlocaties: welke ONS-locatie hoort bij welk kantoor (postcode)?
// De lijst staat in de configuratie (offices); zie config/defaults.js.

import { APP_CONFIG } from '../config/app-config.js';

function woordIn(naam, woord) {
  // Heel woord: 'oss' mag niet matchen in 'Bosschenhoofd'; 'ede' niet in 'Veldhoven'.
  var w = String(woord).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-zà-ÿ])' + w + '($|[^a-zà-ÿ])', 'i').test(naam);
}

// 'J&G Oosterhout' -> { name: 'Breda', postcode: '4822NH' } of null.
// Locatienamen met J&G/Jeugd zoeken eerst bij Jeugd en Gezin, de rest eerst
// bij Begeleiding; langere zoekwoorden gaan voor ('den haag zuid' vóór 'den haag').
export function officeForLocation(locationName, offices) {
  var naam = String(locationName || '').trim();
  if (!naam) return null;
  var lijst = Array.isArray(offices) ? offices : (APP_CONFIG.offices || []);
  var jg = /(^|[^a-z])(j&g|j\s*&\s*g|jg|jeugd)([^a-z]|$)/i.test(naam);
  var volgorde = jg ? ['jg', 'bv'] : ['bv', 'jg'];
  for (var s = 0; s < volgorde.length; s++) {
    var kandidaten = [];
    lijst.forEach(function (o) {
      if (!o || (o.sector || 'bv') !== volgorde[s]) return;
      (o.match || [o.name]).forEach(function (w) { if (w && woordIn(naam, w)) kandidaten.push({ o: o, len: String(w).length }); });
    });
    if (kandidaten.length) {
      kandidaten.sort(function (a, b) { return b.len - a.len; });
      return { name: kandidaten[0].o.name, postcode: String(kandidaten[0].o.postcode || '').replace(/\s+/g, '').toUpperCase() };
    }
  }
  return null;
}
