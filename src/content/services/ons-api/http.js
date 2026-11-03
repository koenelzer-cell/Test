// Eén manier om JSON van ONS op te halen.
//
// Altijd een relatief pad (same-origin): de sessiecookie van de ingelogde
// medewerker gaat mee en er gaat niets naar andere servers. Een antwoord dat
// niet 'ok' is, wordt een fout ("HTTP 404"), zodat de aanroeper kan terugvallen.

import { logVerzoek, netwerklogAan } from './netwerklog.js';

// Een verzoek van de hulp, met het netwerklog (Debug) als dat aan staat.
async function haal(pad, init) {
  if (!netwerklogAan()) return fetch(pad, init);
  const t0 = performance.now(), methode = init.method || 'GET';
  try {
    const r = await fetch(pad, init);
    logVerzoek('hulp', { methode, url: pad, status: r.status, ms: performance.now() - t0, grootte: r.headers && r.headers.get ? r.headers.get('content-length') : null });
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

export async function getJson(url) {
  const pad = alleenOns(url);
  const response = await haal(pad, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
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
  const response = await haal(pad, {
    method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response;
}

function csrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return (meta && meta.getAttribute('content')) || '';
}
