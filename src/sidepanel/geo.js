// Afstand voor de planhulp: postcode -> coördinaat via de PDOK Locatieserver
// (Kadaster, gratis, geen sleutel), en een schatting van het omrijden.
//
// PRIVACY: naar PDOK gaat ALLEEN een postcode (6 tekens): geen huisnummer,
// geen naam. Coördinaten blijven in het geheugen van het zijpaneel.
//
// De afstand is hemelsbreed × WEG_FACTOR: een schatting om blokken te
// vergelijken, geen rijtijd.

export const PDOK_ORIGIN = 'https://api.pdok.nl/*';
const PDOK_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?fq=type:postcode&rows=1&fl=postcode,centroide_ll&q=';
const WEG_FACTOR = 1.3;

// '2611 eb' -> '2611EB', anders ''.
export function normPostcode(v) {
  var m = /^\s*([1-9]\d{3})\s?([A-Za-z]{2})\s*$/.exec(String(v || ''));
  return m ? m[1] + m[2].toUpperCase() : '';
}

// PDOK-antwoord -> { lat, lon } of null.
export function parsePdok(json) {
  var doc = json && json.response && Array.isArray(json.response.docs) ? json.response.docs[0] : null;
  var m = doc && /POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/.exec(String(doc.centroide_ll || ''));
  return m ? { lon: +m[1], lat: +m[2] } : null;
}

// Hemelsbreed in km (haversine) × wegfactor.
export function km(a, b) {
  if (!a || !b) return null;
  var r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h))) * WEG_FACTOR;
}

// Hoeveel extra km kost een afspraak op [start, start+duur) op die dag, gezien
// de huisbezoeken ervoor en erna? bezoeken: [{ startMin, endMin, pc }] (gesorteerd).
// thuis: coördinaat van het vertrekpunt (optioneel; geldt als begin en eind van
// de dag). coord(pc) -> { lat, lon } | null.
//   -> { km, voor, na } of null als er niets om mee te vergelijken is.
export function detour(bezoeken, start, duur, nieuw, coord, thuis) {
  if (!nieuw) return null;
  var voor = null, na = null;
  (bezoeken || []).forEach(function (b) {
    if (b.endMin <= start) voor = b;
    else if (!na && b.startMin >= start + duur) na = b;
  });
  var p = voor ? coord(voor.pc) : thuis, q = na ? coord(na.pc) : thuis;
  if (!p && !q) return null;
  var extra;
  if (p && q) extra = km(p, nieuw) + km(nieuw, q) - km(p, q);
  else extra = km(p || q, nieuw);
  return {
    km: Math.max(0, extra), voor: voor ? voor.pc : '', na: na ? na.pc : '',
    // Kantoor ervoor of erna (afspraak op een kantoorlocatie): naam voor de uitleg.
    voorKantoor: voor && voor.soort === 'kantoor' ? (voor.kantoor || 'kantoor') : '',
    naKantoor: na && na.soort === 'kantoor' ? (na.kantoor || 'kantoor') : ''
  };
}

// Postcodes opzoeken (met geheugen). fetchJson: (url) -> Promise<json>.
const cache = Object.create(null);
export function lookupPostcodes(pcs, fetchJson) {
  var nodig = pcs.filter(function (pc, i) { return pc && !(pc in cache) && pcs.indexOf(pc) === i; });
  return Promise.all(nodig.map(function (pc) {
    return fetchJson(PDOK_URL + encodeURIComponent(pc)).then(function (j) { cache[pc] = parsePdok(j); }, function () { cache[pc] = null; });
  })).then(function () { return function (pc) { return cache[pc] || null; }; });
}
export function _clearGeoCache() { Object.keys(cache).forEach(function (k) { delete cache[k]; }); }

// Toestemming voor api.pdok.nl (optioneel in het manifest). Vragen kan alleen
// tijdens een klik; zonder klik alleen kijken.
export function heeftPdok(cb) {
  try {
    if (!chrome.permissions || !chrome.permissions.contains) { cb(true); return; }
    chrome.permissions.contains({ origins: [PDOK_ORIGIN] }, function (ok) { void chrome.runtime.lastError; cb(!!ok); });
  } catch (e) { cb(false); }
}
export function vraagPdok(cb) {
  try {
    if (!chrome.permissions || !chrome.permissions.request) { cb(true); return; }
    chrome.permissions.request({ origins: [PDOK_ORIGIN] }, function (ok) { void chrome.runtime.lastError; cb(!!ok); });
  } catch (e) { cb(false); }
}
