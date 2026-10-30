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
//   MAX_PER_MIN       verzoeken per minuut per gebruiker (IP), standaard 120
//   MAX_PER_DAG       verzoeken per dag in totaal, standaard 5000: het plafond als
//                     het token toch uitlekt (het staat in de extensie)
//   TRUST_PROXY_HOPS  aantal proxy's voor deze server die X-Forwarded-For aanvullen
//                     (Cloud Run: 1); 0 = het adres van de verbinding zelf
//   LOG               0 = geen logregels bij geweigerde verzoeken
//
// Het token en de herkomst (Origin) houden alleen de extensie binnen; een
// script buiten de browser kan een Origin namaken. Daarom ook de limieten per
// minuut en per dag, en logregels bij geweigerde verzoeken (zonder token,
// sleutel of inhoud; het IP-adres ingekort).
//
// Eindpunten (POST, JSON):
//   /pairs     { pairs: [['2611EB','2613RR'], …] } -> { pairs: { '2611EB|2613RR': { m, s } } }  (max. 100; alleen wat nodig is)
//   /matrix    { pcs: ['2611EB', …] }            -> { pairs: … }  (volledige matrix; duurder, n x n elementen)
//   /optimize  { origin: '4822NH', stops: [pc…] } -> { order: [i…], m, s }   (rondrit vanaf origin)
// Geen afhankelijkheden; Node 18+ (ingebouwde fetch).

import http from 'node:http';
import crypto from 'node:crypto';

const KEY = process.env.GOOGLE_MAPS_KEY || '';
const TOKEN = process.env.PROXY_TOKEN || '';
const ORIGINS = String(process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const MAX_PCS = 25;              // 25 x 25 = 625 elementen: het maximum van computeRouteMatrix
const CACHE_MS = 7 * 24 * 3600 * 1000;
const GOOGLE_TIMEOUT_MS = 10000;
const getal = (v, std, min) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= min ? n : std; };
const STANDAARD = {
  maxPerMin: getal(process.env.MAX_PER_MIN, 120, 1),
  maxPerDag: getal(process.env.MAX_PER_DAG, 5000, 1),
  hops: getal(process.env.TRUST_PROXY_HOPS, 0, 0),
  log: process.env.LOG !== '0',
};

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
      method: 'POST', signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
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

// Alleen gevraagde paren, per herkomst één aanvraag (Google rekent per element).
export async function pairsVoor(paren, fetchFn = fetch) {
  const pairs = {}, perHerkomst = {};
  for (const [a, b] of paren) {
    const c = uitCache(a + '|' + b);
    if (c) pairs[a + '|' + b] = c; else (perHerkomst[a] = perHerkomst[a] || []).push(b);
  }
  await Promise.all(Object.entries(perHerkomst).map(async ([o, ds]) => {
    const r = await fetchFn('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST', signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,duration,condition' },
      body: JSON.stringify({ origins: [plek(o)], destinations: ds.map(plek), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE' }),
    });
    if (!r.ok) throw new Error('Google ' + r.status);
    const rijen = await r.json();
    (Array.isArray(rijen) ? rijen : []).forEach((e) => {
      if (e.condition !== 'ROUTE_EXISTS' || e.destinationIndex == null) return;
      const b = ds[e.destinationIndex]; if (!b) return;
      const v = { m: e.distanceMeters || 0, s: sec(e.duration) };
      pairs[o + '|' + b] = v; inCache(o + '|' + b, v);
    });
  }));
  return { pairs };
}

export async function optimize(origin, stops, fetchFn = fetch) {
  const r = await fetchFn('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST', signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
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

// Het adres van de gebruiker. Achter een proxy (Cloud Run) het adres dat die
// proxy er zelf achter zette; wat een client zelf in X-Forwarded-For zet,
// staat daarvoor en telt niet.
export function clientIp(req, hops = STANDAARD.hops) {
  const lijst = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (hops > 0 && lijst.length >= hops) return lijst[lijst.length - hops];
  return (req.socket && req.socket.remoteAddress) || '';
}
// Voor de logregels: IPv4 zonder laatste deel, IPv6 alleen de eerste drie groepen.
export function kortIp(ip) {
  const v4 = String(ip || '').replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.replace(/\.\d+$/, '.0');
  return String(ip || '').split(':').slice(0, 3).join(':') + '::';
}
function zelfdeToken(x) {
  const a = Buffer.from(String(x || '')), b = Buffer.from(TOKEN);
  return TOKEN && a.length === b.length && crypto.timingSafeEqual(a, b);
}
const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000',
};

// opties: { maxPerMin, maxPerDag, hops, log } (standaard uit de omgeving).
export function handler(fetchFn = fetch, opties = {}) {
  const o = Object.assign({}, STANDAARD, opties);
  const tellers = new Map();
  let dag = { datum: '', n: 0 }, opgeruimd = Date.now(), logs = { start: 0, n: 0 };
  // Per IP een teller per minuut; oude tellers gaan eens per minuut weg.
  const teVeel = (ip) => {
    const nu = Date.now();
    if (nu - opgeruimd > 60000) { for (const [k, t] of tellers) if (nu - t.start > 60000) tellers.delete(k); opgeruimd = nu; }
    const t = tellers.get(ip) || { start: nu, n: 0 };
    if (nu - t.start > 60000) { t.start = nu; t.n = 0; }
    t.n++; tellers.set(ip, t);
    return t.n > o.maxPerMin;
  };
  const dagVol = () => {
    const d = new Date().toISOString().slice(0, 10);
    if (dag.datum !== d) dag = { datum: d, n: 0 };
    dag.n++;
    return dag.n > o.maxPerDag;
  };
  // Een regel per geweigerd verzoek (hooguit 60 per minuut): wanneer, wat, welk
  // pad en het ingekorte IP. Nooit het token, de sleutel of de inhoud.
  const meld = (soort, req, ip) => {
    if (!o.log) return;
    const nu = Date.now();
    if (nu - logs.start > 60000) logs = { start: nu, n: 0 };
    if (++logs.n > 60) return;
    console.log(JSON.stringify({ tijd: new Date(nu).toISOString(), soort, pad: String(req.url || '').slice(0, 40), ip: kortIp(ip) }));
  };
  return async (req, res) => {
    const origin = req.headers.origin || '';
    const ip = clientIp(req, o.hops);
    const cors = ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    const stuur = (code, obj) => { res.writeHead(code, Object.assign({}, HEADERS, cors)); res.end(JSON.stringify(obj)); };
    // Alleen via https (achter Cloud Run of een load balancer).
    if (String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'http') { meld('geen-https', req, ip); return stuur(403, { error: 'https' }); }
    if (req.method === 'OPTIONS') {
      res.writeHead(ORIGINS.includes(origin) ? 204 : 403, Object.assign({}, HEADERS, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, X-Agendahulp-Token', 'Access-Control-Max-Age': '600' }, cors));
      return res.end();
    }
    if (teVeel(ip)) { meld('te-veel', req, ip); return stuur(429, { error: 'te veel verzoeken' }); }
    if (req.method !== 'POST' || !['/matrix', '/pairs', '/optimize'].includes(req.url)) { meld('onbekend-pad', req, ip); return stuur(404, { error: 'onbekend' }); }
    if (!ORIGINS.includes(origin)) { meld('geweigerd-origin', req, ip); return stuur(403, { error: 'origin' }); }
    if (!zelfdeToken(req.headers['x-agendahulp-token'])) { meld('geweigerd-token', req, ip); return stuur(401, { error: 'token' }); }
    if (dagVol()) { meld('dagplafond', req, ip); return stuur(429, { error: 'dagplafond' }); }
    let tekst = '';
    for await (const deel of req) { tekst += deel; if (tekst.length > 5000) return stuur(413, { error: 'te groot' }); }
    let body; try { body = JSON.parse(tekst || '{}'); } catch (e) { return stuur(400, { error: 'json' }); }
    try {
      if (req.url === '/pairs') {
        const lijst = Array.isArray(body.pairs) ? body.pairs : null;
        if (!lijst || !lijst.length || lijst.length > 100) return stuur(400, { error: 'pairs' });
        const paren = [];
        for (const x of lijst) { const p = normPcs(Array.isArray(x) ? x : []); if (!p || p.length !== 2) return stuur(400, { error: 'pairs' }); paren.push(p); }
        return stuur(200, await pairsVoor(paren, fetchFn));
      }
      if (req.url === '/matrix') {
        const pcs = normPcs(body.pcs);
        if (!pcs || pcs.length < 2 || pcs.length > MAX_PCS) return stuur(400, { error: 'pcs' });
        return stuur(200, await matrix(pcs, fetchFn));
      }
      const or = normPcs([body.origin]), stops = normPcs(body.stops);
      if (!or || !stops || !stops.length || stops.length > MAX_PCS) return stuur(400, { error: 'stops' });
      return stuur(200, await optimize(or[0], stops, fetchFn));
    } catch (e) { meld('google-fout', req, ip); return stuur(502, { error: 'routes' }); }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!KEY || !TOKEN || !ORIGINS.length) { console.error('Zet GOOGLE_MAPS_KEY, PROXY_TOKEN en ALLOWED_ORIGINS.'); process.exit(1); }
  if (TOKEN.length < 32) console.error('Let op: PROXY_TOKEN is korter dan 32 tekens. Maak een lang willekeurig token, bijvoorbeeld met openssl rand -hex 32.');
  const server = http.createServer(handler());
  server.requestTimeout = 15000;   // trage of hangende verzoeken niet eindeloos openhouden
  server.headersTimeout = 10000;
  server.listen(parseInt(process.env.PORT || '8080', 10), () => console.log('routes-proxy luistert'));
}
