// Meetteller (beheer: features.meetteller, standaard uit): hoeveel verzoeken
// ONS zelf doet en hoeveel de hulp erbij doet, per soort adres. Voor de pilot,
// om de extra belasting op ONS te meten zonder DevTools.
//
// PRIVACY: van een adres blijft alleen het soort over. Getallen (medewerker-,
// cliënt- en afspraak-id's, datums) worden {n}; van de zoekparameters blijft
// alleen de naam, met de waarde alleen bij een vaste keuze zoals layer=events.
// Een zoekterm (term=Tamara) of datum gaat dus nooit mee.

const OPEN_WAARDEN = ['layer', 'sub_layers[]', 'usage'];
export const MAX_PATRONEN = 300;

function deel(d) {
  if (!d) return d;
  if (/^[\d,]+$/.test(d) || /^\d{4}-\d{2}-\d{2}$/.test(d) || /^[0-9a-f-]{16,}$/i.test(d) || d.length > 40) return '{n}';
  return d.replace(/\d+/g, '{n}');
}

// url (relatief of volledig), methode, origin van de pagina -> 'soort adres' of ''.
// Bijv. 'GET /calendar/invitee/{n}/entries/week?date=…&layer=events'.
export function meetPatroon(url, methode, origin) {
  let u;
  try { u = new URL(String(url == null ? '' : url), origin); } catch (e) { return ''; }
  if (!/^https?:$/.test(u.protocol)) return '';
  const pad = u.pathname.split('/').map(function (d) { let x = d; try { x = decodeURIComponent(d); } catch (e) {} return deel(x); }).join('/');
  const namen = [];
  u.searchParams.forEach(function (w, k) {
    const sleutel = String(k).slice(0, 40).replace(/[^\w[\]]/g, '');
    if (!sleutel) return;
    const stuk = OPEN_WAARDEN.indexOf(sleutel) >= 0 && /^[a-z_/]{1,40}$/i.test(w) ? sleutel + '=' + w : sleutel + '=…';
    if (namen.indexOf(stuk) < 0) namen.push(stuk);
  });
  const host = u.origin === origin ? '' : u.host;
  const m = String(methode || 'GET').toUpperCase();
  return (m === 'GET' ? 'GET ' : (/^[A-Z]{3,7}$/.test(m) ? m : 'GET') + ' ') + host + pad + (namen.length ? '?' + namen.join('&') : '');
}

// Is dit een soort adres zoals meetPatroon het maakt? (Wat de main-world
// meldt, kan een script van de pagina ook sturen.)
export function isPatroon(p) {
  return typeof p === 'string' && p.length <= 300 && /^[A-Z]{3,7} [\w.\-/{}…?&=[\]:]*$/.test(p);
}

// Bij de opgeslagen telling optellen: delta { patroon: { ons, hulp } }.
export function voegTellingToe(oud, delta, nu) {
  const goed = oud && typeof oud === 'object' && oud.patronen && typeof oud.patronen === 'object';
  const t = { start: goed && oud.start > 0 ? oud.start : nu, bijgewerkt: nu, patronen: goed ? Object.assign({}, oud.patronen) : {} };
  Object.keys(delta || {}).forEach(function (p) {
    if (!isPatroon(p)) return;
    if (!t.patronen[p] && Object.keys(t.patronen).length >= MAX_PATRONEN) return;
    const a = t.patronen[p] || { ons: 0, hulp: 0 }, d = delta[p] || {};
    t.patronen[p] = { ons: (a.ons | 0) + (d.ons | 0), hulp: (a.hulp | 0) + (d.hulp | 0) };
  });
  return t;
}

// Voor het zijpaneel: totalen en de adressen, de drukste eerst.
export function meettellerOverzicht(t) {
  const patronen = (t && t.patronen) || {};
  const rijen = Object.keys(patronen).filter(isPatroon).map(function (p) { return { patroon: p, ons: patronen[p].ons | 0, hulp: patronen[p].hulp | 0 }; })
    .sort(function (a, b) { return (b.ons + b.hulp) - (a.ons + a.hulp) || a.patroon.localeCompare(b.patroon); });
  const ons = rijen.reduce(function (s, r) { return s + r.ons; }, 0), hulp = rijen.reduce(function (s, r) { return s + r.hulp; }, 0);
  return { start: (t && t.start) || 0, bijgewerkt: (t && t.bijgewerkt) || 0, ons: ons, hulp: hulp, extraProcent: ons ? Math.round(hulp / ons * 100) : null, rijen: rijen };
}
