// Eén manier om JSON van ONS op te halen.
//
// Altijd een relatief pad (same-origin): de sessiecookie van de ingelogde
// medewerker gaat mee en er gaat niets naar andere servers. Een antwoord dat
// niet 'ok' is, wordt een fout ("HTTP 404"), zodat de aanroeper kan terugvallen.
//
// Rustig voor ONS: een GET die mislukt door een netwerkfout of 500/502/504
// probeert de hulp hooguit twee keer opnieuw, steeds later en met wat
// toeval (backoff met jitter). Zegt ONS dat het te druk is (429 of 503), dan
// niet opnieuw, en stopt het vooraf laden tot de tijd uit Retry-After (of
// een minuut) voorbij is (onsTeDruk). Een POST nooit opnieuw.
//
// Tijdslimiet: een GET zonder antwoord binnen 20 seconden wordt afgebroken
// (niet opnieuw: ONS is dan traag, nog een verzoek maakt het drukker). Een
// POST krijgt 60 seconden, want opslaan mag even duren; daarna een fout die
// zegt dat het toch opgeslagen kan zijn, zodat niemand het dubbel maakt.

import { logVerzoek, netwerklogAan, netwerklogAntwoorden } from './netwerklog.js';
import { opbouwTekst } from '../../../shared/opbouw-masker.js';
import { meldFout } from '../../core/foutbuffer.js';
import { metTijdslimiet, isTijdslimiet, TIJDSLIMIET_MS } from '../../../shared/tijdslimiet.js';

export const POST_TIJDSLIMIET_MS = 60000;
let limieten = { get: TIJDSLIMIET_MS, post: POST_TIJDSLIMIET_MS };
// Alleen voor tests: kortere limieten.
export function _zetTijdslimieten(get, post) { limieten = { get: get || TIJDSLIMIET_MS, post: post || POST_TIJDSLIMIET_MS }; }
function haalMetLimiet(pad, init) {
  const ms = (init.method || 'GET') === 'POST' ? limieten.post : limieten.get;
  return metTijdslimiet(function (u, i) { return fetch(u, i); }, pad, init, ms);
}

// Het soort adres voor de foutbuffer: zonder zoekdeel en zonder nummers.
function soortAdres(pad) { return String(pad).split('?')[0].replace(/\d+/g, '{n}').slice(0, 70); }

// Een verzoek van de hulp, met het netwerklog (Debug) als dat aan staat.
async function haal(pad, init) {
  if (!netwerklogAan()) return haalMetLimiet(pad, init);
  const t0 = performance.now(), methode = init.method || 'GET';
  try {
    const r = await haalMetLimiet(pad, init);
    // Met antwoorden (Debug): ook de afgeschermde opbouw van antwoord en verzoek.
    let antwoord = '', verzoek = '';
    if (netwerklogAntwoorden()) {
      try { antwoord = opbouwTekst(await r.clone().text()); } catch (e) { antwoord = ''; }
      verzoek = typeof init.body === 'string' ? opbouwTekst(init.body) : '';
    }
    logVerzoek('hulp', { methode, url: pad, status: r.status, ms: performance.now() - t0, grootte: r.headers && r.headers.get ? r.headers.get('content-length') : null, antwoord: antwoord, verzoek: verzoek });
    return r;
  } catch (e) {
    logVerzoek('hulp', { methode, url: pad, status: 0, ms: performance.now() - t0 });
    throw e;
  }
}

// Alleen naar ONS zelf: het adres moet op deze origin uitkomen. Een ander
// domein (ook '//domein' of '/\\domein', die de browser zo leest) wordt
// geweigerd, zodat de sessie en het CSRF-token nooit naar een andere server
// gaan, ook niet bij een verkeerd ingesteld adres in de configuratie.
export function alleenOns(url) {
  let u = null;
  try { u = new URL(String(url == null ? '' : url), location.href); } catch (e) { u = null; }
  if (!u || u.origin !== location.origin) throw new Error('Alleen een adres binnen ONS');
  return String(url);
}

let pauzeTot = 0;
export function onsTeDruk() { return Date.now() < pauzeTot; }
export function _wisTeDruk() { pauzeTot = 0; }
// Hoe lang wachten na een 429 of 503: Retry-After (seconden of een datum),
// anders een minuut; tussen 10 seconden en 10 minuten.
export function pauzeNa(r) {
  const ra = r && r.headers && r.headers.get ? r.headers.get('retry-after') : null;
  let s = Number(ra);
  if (!(s > 0) && ra) { const t = Date.parse(ra); s = t ? (t - Date.now()) / 1000 : 0; }
  return Math.min(Math.max(s > 0 ? s : 60, 10), 600) * 1000;
}
const OPNIEUW = [500, 502, 504], MAX_OPNIEUW = 2;
let wachtBasis = 400;
export function _zetWachtBasis(ms) { wachtBasis = ms; }
function wacht(poging) { return new Promise(function (r) { setTimeout(r, wachtBasis * Math.pow(2, poging) + Math.random() * wachtBasis * 0.75); }); }

export async function getJson(url) {
  const pad = alleenOns(url);
  for (let poging = 0; ; poging++) {
    let response = null, fout = null;
    try { response = await haal(pad, { credentials: 'same-origin', headers: { Accept: 'application/json' } }); } catch (e) { fout = e; }
    if (response && (response.status === 429 || response.status === 503)) {
      pauzeTot = Math.max(pauzeTot, Date.now() + pauzeNa(response));
      meldFout('GET ' + soortAdres(pad), new Error('HTTP ' + response.status + ', ONS is druk: even geen vooraf laden'));
      throw new Error('HTTP ' + response.status);
    }
    const nogEens = (!!fout && !isTijdslimiet(fout)) || (!!response && OPNIEUW.indexOf(response.status) >= 0);
    if (nogEens && poging < MAX_OPNIEUW && !onsTeDruk()) { await wacht(poging); continue; }
    if (fout) { meldFout('GET ' + soortAdres(pad), fout); throw fout; }
    if (!response.ok) { if (response.status !== 404) meldFout('GET ' + soortAdres(pad), new Error('HTTP ' + response.status)); throw new Error('HTTP ' + response.status); }
    return response.json();
  }
}

// Iets vastleggen in ONS (POST met JSON). Net als getJson alleen naar een
// relatief pad binnen de ingelogde sessie. ONS is een Rails-applicatie: een
// wijzigend verzoek moet het CSRF-token van de pagina meesturen, anders
// weigert de server het.
export async function postJson(url, body) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  const pad = alleenOns(url);
  const token = csrfToken();
  if (token) headers['X-CSRF-Token'] = token;
  let response;
  try {
    response = await haal(pad, {
      method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify(body),
    });
  } catch (e) {
    if (!isTijdslimiet(e)) throw e;
    meldFout('POST ' + soortAdres(pad), e);
    const fout = new Error('ONS gaf binnen ' + Math.round(limieten.post / 1000) + ' seconden geen antwoord. Kijk in de agenda of het toch is opgeslagen voor je het opnieuw probeert.');
    fout.name = 'TimeoutError';
    throw fout;
  }
  if (response.status === 429 || response.status === 503) pauzeTot = Math.max(pauzeTot, Date.now() + pauzeNa(response));
  if (!response.ok) { meldFout('POST ' + soortAdres(pad), new Error('HTTP ' + response.status)); throw new Error('HTTP ' + response.status); }
  return response;
}

function csrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return (meta && meta.getAttribute('content')) || '';
}
