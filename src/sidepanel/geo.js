// Rijtijden voor de planhulp en Route van de dag: Google Routes API.
//
// PRIVACY: naar Google gaat ALLEEN een postcode (6 tekens): geen huisnummer,
// geen naam. Uitkomsten blijven in het geheugen van het zijpaneel.
//
// Zonder server: rechtstreeks met de Routes-sleutel uit het beheerscherm
// (proxy = { key }), of via de eigen routes-proxy (proxy = { url, token }).

// '2611 eb' -> '2611EB', anders ''.
export function normPostcode(v) {
  var m = /^\s*([1-9]\d{3})\s?([A-Za-z]{2})\s*$/.exec(String(v || ''));
  return m ? m[1] + m[2].toUpperCase() : '';
}

/* Via de eigen routes-proxy (server/routes-proxy): werkt via CORS; de server
   staat precies deze extensie toe; geen extra toestemming. */

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

// Afstanden die al bekend zijn (dit paneel): een tweede klik kost niets.
const paarCache = Object.create(null);
export function _clearRouteCache() { Object.keys(paarCache).forEach(function (k) { delete paarCache[k]; }); }

// pcs (uniek, max. 25) -> pair(a, b) -> { m, s } | null
// Eén computeRouteMatrix (herkomst x bestemming); Google rekent per element.
// Staan alle paren al in het geheugen, dan geen aanvraag.
export function roadMatrix(proxy, pcs, fetchFn) {
  var lijst = pcs.filter(function (p, i) { return p && pcs.indexOf(p) === i && PC6.test(p); }).slice(0, 25);
  var lees = function (a, b) { return a === b ? { m: 0, s: 0 } : (paarCache[a + '|' + b] || null); };
  var bekend = lijst.every(function (a) { return lijst.every(function (b) { return a === b || paarCache[a + '|' + b]; }); });
  if (!proxy || lijst.length < 2 || bekend) return Promise.resolve(lees);
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
    Object.keys(pairs).forEach(function (k) { paarCache[k] = pairs[k]; });
    return lees;
  });
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
