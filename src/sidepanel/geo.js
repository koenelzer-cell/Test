// Afstand voor de planhulp: postcode -> coördinaat via de PDOK Locatieserver
// (Kadaster, gratis, geen sleutel), en een schatting van het extra rijden.
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
// de afspraken ervoor en erna (cliënt of kantoor)? bezoeken: [{ startMin, endMin, pc }] (gesorteerd).
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

/* ── Rijtijden over de weg via de eigen routes-proxy (server/routes-proxy) ──
   Alleen postcodes gaan naar de server (en van daar naar Google). Werkt via
   CORS: de server staat precies deze extensie toe; geen extra toestemming. */

function postProxy(proxy, pad, body, fetchFn) {
  return (fetchFn || fetch)(proxy.url + pad, {
    method: 'POST', credentials: 'omit',
    headers: { 'Content-Type': 'application/json', 'X-Agendahulp-Token': proxy.token },
    body: JSON.stringify(body)
  }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); });
}

/* Zonder server: rechtstreeks naar de Google Routes API met een sleutel die
   alleen de Routes API mag (proxy = { key }). Ook dan alleen postcodes. */
export const ROUTES_ORIGIN = 'https://routes.googleapis.com/*';
const PC6 = /^[1-9]\d{3}[A-Z]{2}$/;
function postGoogle(key, url, mask, body, fetchFn) {
  return (fetchFn || fetch)(url, {
    method: 'POST', credentials: 'omit',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': mask },
    body: JSON.stringify(body)
  }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); });
}
function sec(d) { return parseInt(String(d || '0').replace(/s$/, ''), 10) || 0; }
function plek(pc) { return { waypoint: { address: pc + ', Nederland' } }; }

// pcs (uniek, max. 25) -> pair(a, b) -> { m, s } | null
export function roadMatrix(proxy, pcs, fetchFn) {
  var lijst = pcs.filter(function (p, i) { return p && pcs.indexOf(p) === i && PC6.test(p); }).slice(0, 25);
  if (!proxy || lijst.length < 2) return Promise.resolve(function () { return null; });
  var vraag = proxy.key
    ? postGoogle(proxy.key, 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', 'originIndex,destinationIndex,distanceMeters,duration,condition',
      { origins: lijst.map(plek), destinations: lijst.map(plek), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE' }, fetchFn)
      .then(function (rijen) {
        var pairs = {};
        (Array.isArray(rijen) ? rijen : []).forEach(function (e) {
          if (e.condition !== 'ROUTE_EXISTS' || e.originIndex == null || e.destinationIndex == null) return;
          var a = lijst[e.originIndex], b = lijst[e.destinationIndex];
          if (a && b && a !== b) pairs[a + '|' + b] = { m: e.distanceMeters || 0, s: sec(e.duration) };
        });
        return { pairs: pairs };
      })
    : postProxy(proxy, '/matrix', { pcs: lijst }, fetchFn);
  return vraag.then(function (j) {
    var pairs = (j && j.pairs) || {};
    return function (a, b) { return a === b ? { m: 0, s: 0 } : (pairs[a + '|' + b] || null); };
  });
}

// Zelfde als detour(), maar over de weg: extra meters en seconden.
export function detourRoad(bezoeken, start, duur, pcNieuw, pair, thuisPc) {
  if (!pcNieuw) return null;
  var voor = null, na = null;
  (bezoeken || []).forEach(function (b) {
    if (b.endMin <= start) voor = b;
    else if (!na && b.startMin >= start + duur) na = b;
  });
  var p = voor ? voor.pc : thuisPc, q = na ? na.pc : thuisPc;
  if (!p && !q) return null;
  var som = function (x, y) { return x && y ? { m: x.m + y.m, s: x.s + y.s } : null; };
  var extra;
  if (p && q) {
    var heen = pair(p, pcNieuw), terug = pair(pcNieuw, q), direct = pair(p, q);
    var via = som(heen, terug);
    if (!via || !direct) return null;
    extra = { m: via.m - direct.m, s: via.s - direct.s };
  } else {
    extra = p ? pair(p, pcNieuw) : pair(pcNieuw, q);
    if (!extra) return null;
  }
  return { m: Math.max(0, extra.m), s: Math.max(0, extra.s) };
}

// Kortste rondrit vanaf het vertrekpunt langs de stops -> { order, m, s }.
export function optimizeRoute(proxy, origin, stops, fetchFn) {
  if (!proxy.key) return postProxy(proxy, '/optimize', { origin: origin, stops: stops }, fetchFn);
  if (!PC6.test(origin) || !stops.every(function (s) { return PC6.test(s); })) return Promise.reject(new Error('Alleen postcodes'));
  var adres = function (pc) { return { address: pc + ', Nederland' }; };
  return postGoogle(proxy.key, 'https://routes.googleapis.com/directions/v2:computeRoutes', 'routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration',
    { origin: adres(origin), destination: adres(origin), intermediates: stops.map(adres), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE', optimizeWaypointOrder: true }, fetchFn)
    .then(function (j) {
      var route = j && j.routes && j.routes[0];
      if (!route) throw new Error('Geen route');
      return { order: Array.isArray(route.optimizedIntermediateWaypointIndex) ? route.optimizedIntermediateWaypointIndex : stops.map(function (_, i) { return i; }), m: route.distanceMeters || 0, s: sec(route.duration) };
    });
}

// Toestemming voor routes.googleapis.com (alleen bij een directe sleutel).
export function heeftRoutes(cb) {
  try {
    if (!chrome.permissions || !chrome.permissions.contains) { cb(true); return; }
    chrome.permissions.contains({ origins: [ROUTES_ORIGIN] }, function (ok) { void chrome.runtime.lastError; cb(!!ok); });
  } catch (e) { cb(false); }
}
// PDOK en (bij een directe sleutel) Google Routes in één vraag: Chrome staat
// per klik maar één toestemmingsvraag toe. -> cb({ pdok, routes })
export function toestemmingAfstand(gebaar, metRoutes, cb) {
  var origins = [PDOK_ORIGIN].concat(metRoutes ? [ROUTES_ORIGIN] : []);
  try {
    if (!chrome.permissions || !chrome.permissions.contains) { cb({ pdok: true, routes: true }); return; }
    var kijk = function () {
      chrome.permissions.contains({ origins: [PDOK_ORIGIN] }, function (a) {
        void chrome.runtime.lastError;
        if (!metRoutes) { cb({ pdok: !!a, routes: false }); return; }
        chrome.permissions.contains({ origins: [ROUTES_ORIGIN] }, function (b) { void chrome.runtime.lastError; cb({ pdok: !!a, routes: !!b }); });
      });
    };
    if (gebaar) chrome.permissions.request({ origins: origins }, function () { void chrome.runtime.lastError; kijk(); });
    else kijk();
  } catch (e) { cb({ pdok: false, routes: false }); }
}
export function vraagRoutes(cb) {
  try {
    if (!chrome.permissions || !chrome.permissions.request) { cb(true); return; }
    chrome.permissions.request({ origins: [ROUTES_ORIGIN] }, function (ok) { void chrome.runtime.lastError; cb(!!ok); });
  } catch (e) { cb(false); }
}

// Google Maps-link(s) voor een volgorde van adressen (zoals domain/route.js).
export function mapsUrls(adressen, origin, terug) {
  var stops = (adressen || []).filter(Boolean);
  if (terug && origin) stops = stops.concat([origin]);
  var uit = [], start = origin || '';
  for (var i = 0; i < stops.length; i += 10) {
    var deel = stops.slice(i, i + 10), dest = deel[deel.length - 1], tussen = deel.slice(0, -1);
    var q = ['api=1'];
    if (start) q.push('origin=' + encodeURIComponent(start));
    q.push('destination=' + encodeURIComponent(dest));
    if (tussen.length) q.push('waypoints=' + tussen.map(encodeURIComponent).join('%7C'));
    q.push('travelmode=driving');
    uit.push('https://www.google.com/maps/dir/?' + q.join('&'));
    start = dest;
  }
  return uit;
}

// Kaart (Google Maps Embed API, directions): origin, stops (adressen), sleutel.
// Zonder vertrekpunt begint de kaart bij de eerste stop. Max. 20 tussenstops.
export function embedUrl(key, adressen, origin) {
  var stops = (adressen || []).filter(Boolean);
  if (!key || !stops.length) return '';
  var start = origin || stops[0];
  var rest = origin ? stops : stops.slice(1);
  if (!rest.length) return 'https://www.google.com/maps/embed/v1/place?key=' + encodeURIComponent(key) + '&q=' + encodeURIComponent(start);
  var dest = rest[rest.length - 1], tussen = rest.slice(0, -1).slice(0, 20);
  return 'https://www.google.com/maps/embed/v1/directions?key=' + encodeURIComponent(key) +
    '&origin=' + encodeURIComponent(start) + '&destination=' + encodeURIComponent(dest) +
    (tussen.length ? '&waypoints=' + tussen.map(encodeURIComponent).join('%7C') : '') + '&mode=driving';
}
