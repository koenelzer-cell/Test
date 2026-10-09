// Routes-proxy voor de ONS Agendahulp.
//
// Houdt de Google Maps-sleutel buiten de extensie: de extensie praat met deze
// server, deze server met de Google Routes API. Er gaan ALLEEN postcodes
// (6 tekens, bijv. 2611EB) naar Google — geen adressen, geen namen.
//
// Omgevingsvariabelen:
//   GOOGLE_MAPS_KEY   de sleutel (alleen Routes API, beperkt op het IP van deze server)
//   PROXY_TOKEN       gedeeld geheim; de extensie stuurt het mee (X-Agendahulp-Token)
//   ALLOWED_ORIGINS   komma-gescheiden, bijv. chrome-extension://<id-van-de-extensie>
//   PORT              standaard 8080
//
// Eindpunten (POST, JSON):
//   /matrix    { pcs: ['2611EB', …] }            -> { pairs: { '2611EB|2613RR': { m, s } } }
//   /optimize  { origin: '4822NH', stops: [pc…] } -> { order: [i…], m, s }   (rondrit vanaf origin)
// Geen afhankelijkheden; Node 18+ (ingebouwde fetch).

import http from 'node:http';
import crypto from 'node:crypto';

const KEY = process.env.GOOGLE_MAPS_KEY || '';
const TOKEN = process.env.PROXY_TOKEN || '';
const ORIGINS = String(process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const MAX_PCS = 25;              // 25 x 25 = 625 elementen: het maximum van computeRouteMatrix
const MAX_PER_MIN = 120;         // per IP
const CACHE_MS = 7 * 24 * 3600 * 1000;

const PC = /^[1-9]\d{3}[A-Z]{2}$/;
export function normPcs(lijst) {
  if (!Array.isArray(lijst)) return null;
  const uit = [];
  for (const v of lijst) {
    const pc = String(v || '').replace(/\s+/g, '').toUpperCase();
    if (!PC.test(pc)) return null;     // alles wat geen postcode is: weigeren
    if (!uit.includes(pc)) uit.push(pc);
  }
  return uit;
}
const plek = (pc) => ({ waypoint: { address: pc + ', Nederland' } });
const sec = (d) => parseInt(String(d || '0').replace(/s$/, ''), 10) || 0;

// Kleine cache voor paren (afstand tussen postcodes verandert zelden).
const cache = new Map();
function uitCache(k) { const v = cache.get(k); if (!v) return null; if (Date.now() - v.t > CACHE_MS) { cache.delete(k); return null; } return v.v; }
function inCache(k, v) { if (cache.size > 20000) cache.clear(); cache.set(k, { t: Date.now(), v }); }

export async function matrix(pcs, fetchFn = fetch) {
  const pairs = {};
  const nodig = pcs.filter((a) => pcs.some((b) => a !== b && !uitCache(a + '|' + b)));
  pcs.forEach((a) => pcs.forEach((b) => { const c = a !== b && uitCache(a + '|' + b); if (c) pairs[a + '|' + b] = c; }));
  if (nodig.length) {
    const r = await fetchFn('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,duration,condition' },
      body: JSON.stringify({ origins: pcs.map(plek), destinations: pcs.map(plek), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE' }),
    });
    if (!r.ok) throw new Error('Google ' + r.status);
    const rijen = await r.json();
    (Array.isArray(rijen) ? rijen : []).forEach((e) => {
      if (e.condition !== 'ROUTE_EXISTS' || e.originIndex == null || e.destinationIndex == null) return;
      const a = pcs[e.originIndex], b = pcs[e.destinationIndex];
      if (!a || !b || a === b) return;
      const v = { m: e.distanceMeters || 0, s: sec(e.duration) };
      pairs[a + '|' + b] = v; inCache(a + '|' + b, v);
    });
  }
  return { pairs };
}

export async function optimize(origin, stops, fetchFn = fetch) {
  const r = await fetchFn('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration' },
    body: JSON.stringify({
      origin: { address: origin + ', Nederland' }, destination: { address: origin + ', Nederland' },
      intermediates: stops.map((pc) => ({ address: pc + ', Nederland' })),
      travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE', optimizeWaypointOrder: true,
    }),
  });
  if (!r.ok) throw new Error('Google ' + r.status);
  const j = await r.json();
  const route = j && j.routes && j.routes[0];
  if (!route) throw new Error('Geen route');
  const order = Array.isArray(route.optimizedIntermediateWaypointIndex) ? route.optimizedIntermediateWaypointIndex : stops.map((_, i) => i);
  return { order, m: route.distanceMeters || 0, s: sec(route.duration) };
}

const tellers = new Map();
function teVeel(ip) {
  const nu = Date.now(), t = tellers.get(ip) || { start: nu, n: 0 };
  if (nu - t.start > 60000) { t.start = nu; t.n = 0; }
  t.n++; tellers.set(ip, t);
  return t.n > MAX_PER_MIN;
}
function zelfdeToken(x) {
  const a = Buffer.from(String(x || '')), b = Buffer.from(TOKEN);
  return TOKEN && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function handler(fetchFn = fetch) {
  return async (req, res) => {
    const origin = req.headers.origin || '';
    const cors = ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    const stuur = (code, obj) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cors)); res.end(JSON.stringify(obj)); };
    if (req.method === 'OPTIONS') {
      res.writeHead(ORIGINS.includes(origin) ? 204 : 403, Object.assign({ 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, X-Agendahulp-Token', 'Access-Control-Max-Age': '600' }, cors));
      return res.end();
    }
    if (req.method !== 'POST' || !['/matrix', '/optimize'].includes(req.url)) return stuur(404, { error: 'onbekend' });
    if (!ORIGINS.includes(origin)) return stuur(403, { error: 'origin' });
    if (!zelfdeToken(req.headers['x-agendahulp-token'])) return stuur(401, { error: 'token' });
    if (teVeel(req.socket.remoteAddress || '')) return stuur(429, { error: 'te veel verzoeken' });
    let tekst = '';
    for await (const deel of req) { tekst += deel; if (tekst.length > 5000) return stuur(413, { error: 'te groot' }); }
    let body; try { body = JSON.parse(tekst || '{}'); } catch (e) { return stuur(400, { error: 'json' }); }
    try {
      if (req.url === '/matrix') {
        const pcs = normPcs(body.pcs);
        if (!pcs || pcs.length < 2 || pcs.length > MAX_PCS) return stuur(400, { error: 'pcs' });
        return stuur(200, await matrix(pcs, fetchFn));
      }
      const o = normPcs([body.origin]), stops = normPcs(body.stops);
      if (!o || !stops || !stops.length || stops.length > MAX_PCS) return stuur(400, { error: 'stops' });
      return stuur(200, await optimize(o[0], stops, fetchFn));
    } catch (e) { return stuur(502, { error: 'routes' }); }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!KEY || !TOKEN || !ORIGINS.length) { console.error('Zet GOOGLE_MAPS_KEY, PROXY_TOKEN en ALLOWED_ORIGINS.'); process.exit(1); }
  http.createServer(handler()).listen(parseInt(process.env.PORT || '8080', 10), () => console.log('routes-proxy luistert'));
}
