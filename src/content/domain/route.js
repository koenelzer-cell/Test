// Route langs de afspraken bij cliënten van een dag (Google Maps).
//
// ONS zet in het detailvenster van een afspraak al een link naar Google Maps
// (https://www.google.nl/maps/place/Koornmarkt+35-a,+2611EB,+Delft). Klik je
// daarop, dan gaat het adres naar Google. De route-knop doet hetzelfde voor
// alle afspraken bij cliënten van een dag tegelijk, en ook alleen als de medewerker
// zelf klikt.
//
// PRIVACY: we lezen alleen het adres (geen naam, geen andere cliëntgegevens)
// en bewaren het nergens. Het gaat pas naar Google als de medewerker op de
// knop klikt.

// Is deze afspraak bij de cliënt? Geen labelcontrole: een afspraak met een
// cliënt telt als bij de cliënt, tenzij hij op een kantoorlocatie staat
// (ONS-locatie 'BG …' / 'J&G …', zie domain/offices.js). Welke afspraken
// 'huisbezoek' zijn bepaalt de medewerker zelf (vinkje in de planhulp).
export function isAtClient(entry, opKantoor) {
  return !!(entry && entry.clientPresent && !opKantoor);
}

// '…/maps/place/Koornmarkt+35-a,+2611EB,+Delft' -> 'Koornmarkt 35-a, 2611EB, Delft'
export function addressFromMapsUrl(url) {
  const m = /\/maps\/place\/([^/?#"'<>\s]+)/.exec(String(url || ''));
  if (!m) return '';
  let t;
  try { t = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return ''; }
  return t.replace(/\s+/g, ' ').replace(/[,\s]+$/, '').trim();
}

function schoon(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

// Uit losse adresvelden (straat, huisnummer, postcode, plaats) één regel.
function adresUitVelden(o) {
  const pak = function (re) {
    for (const k in o) { if (re.test(k) && (typeof o[k] === 'string' || typeof o[k] === 'number')) return schoon(o[k]); }
    return '';
  };
  const straat = pak(/^(street|straat|street_name|streetname)$/i);
  const nr = pak(/^(house_?number|huisnummer|number|nr)$/i);
  const toev = pak(/^(house_?number_?(addition|suffix)|toevoeging|addition|suffix)$/i);
  const pc = pak(/^(zip_?code|postal_?code|postcode)$/i);
  const plaats = pak(/^(city|woonplaats|plaats|place|town)$/i);
  if (!straat || !plaats) return '';
  const eerste = straat + (nr ? ' ' + nr + (toev ? (/^[a-z0-9]/i.test(toev) ? '-' : '') + toev : '') : '');
  return [eerste, pc, plaats].filter(Boolean).join(', ');
}

// Adres uit een details-antwoord van ONS. De vorm is niet gedocumenteerd,
// dus we zoeken in volgorde:
//  1. een Google Maps-link (zoals in het detailvenster),
//  2. een tekstveld met 'address'/'adres' in de naam,
//  3. losse velden (straat, huisnummer, postcode, plaats).
// Velden met 'name'/'naam' slaan we over. Geeft '' als er niets is.
export function addressFromDetails(json) {
  const gevonden = { link: '', tekst: '', velden: '' };
  let gezien = 0;
  (function loop(v, sleutel, diepte) {
    if (gevonden.link || diepte > 8 || ++gezien > 5000) return;
    if (typeof v === 'string') {
      if (/maps\/place\//.test(v)) { const a = addressFromMapsUrl(v); if (a) gevonden.link = a; return; }
      // sleutel is het pad ('address.asText'): een tekst onder of met 'address'.
      if (!gevonden.tekst && /address|adres/i.test(sleutel || '') && !/mail|phone|telefoon|ip_?adres|ip_?address/i.test(sleutel || '')) {
        const s = schoon(v);
        if (s.length >= 6 && s.length <= 160 && /\d/.test(s) && /[a-z]/i.test(s) && /[\s,]/.test(s)) gevonden.tekst = s; // los veld als '1111AA' telt niet
      }
      return;
    }
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(function (x) { loop(x, sleutel, diepte + 1); }); return; }
    if (!gevonden.velden) { const f = adresUitVelden(v); if (f) gevonden.velden = f; }
    Object.keys(v).forEach(function (k) {
      if (/(^|_)(name|naam|first|last|initials|bsn)/i.test(k)) return;
      // Onder een adresobject telt de hele weg mee; elders alleen de eigen sleutel.
      loop(v[k], /address|adres/i.test(sleutel || '') ? sleutel + '.' + k : k, diepte + 1);
    });
  })(json, '', 0);
  return gevonden.link || gevonden.tekst || gevonden.velden || '';
}

// Google Maps-routes. Eén route heeft hooguit 10 stops (bestemming + 9
// tussenstops); meer stops -> meerdere routes, die op elkaar aansluiten.
// origin: vertrekpunt (optioneel; zonder vertrekpunt start Maps bij je locatie).
export const STOPS_PER_ROUTE = 10;
export function routeUrls(addresses, origin) {
  const stops = (addresses || []).map(schoon).filter(Boolean);
  if (!stops.length) return [];
  let uit = [], start = schoon(origin);
  for (let i = 0; i < stops.length; i += STOPS_PER_ROUTE) {
    const deel = stops.slice(i, i + STOPS_PER_ROUTE);
    const bestemming = deel[deel.length - 1];
    const tussen = deel.slice(0, -1);
    const q = ['api=1'];
    if (start) q.push('origin=' + encodeURIComponent(start));
    q.push('destination=' + encodeURIComponent(bestemming));
    if (tussen.length) q.push('waypoints=' + tussen.map(encodeURIComponent).join('%7C'));
    q.push('travelmode=driving');
    uit.push('https://www.google.com/maps/dir/?' + q.join('&'));
    start = bestemming;  // de volgende route begint waar deze eindigt
  }
  return uit;
}

// Postcode (6 tekens, zonder spatie) uit een adresregel, of ''.
export function postcodeFromAddress(adres) {
  const m = /\b([1-9]\d{3})\s?([A-Za-z]{2})\b/.exec(String(adres || ''));
  return m ? (m[1] + m[2].toUpperCase()) : '';
}

// Postcode van een cliënt uit een zoekresultaat (search_panel) of details:
// eerst een veld als 'zipcode'/'postal_code', anders uit een adresregel.
// -> '2611EB' of ''.
export function postcodeFromClient(obj) {
  let gevonden = '', gezien = 0;
  (function loop(v, k, d) {
    if (gevonden || d > 6 || ++gezien > 2000) return;
    if (typeof v === 'string' || typeof v === 'number') {
      if (/zip|postal|postcode/i.test(k || '')) {
        const m = /^\s*([1-9]\d{3})\s?([A-Za-z]{2})\s*$/.exec(String(v));
        if (m) gevonden = m[1] + m[2].toUpperCase();
      }
      return;
    }
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(function (x) { loop(x, k, d + 1); }); return; }
    Object.keys(v).forEach(function (kk) { loop(v[kk], kk, d + 1); });
  })(obj, '', 0);
  return gevonden || postcodeFromAddress(addressFromDetails(obj));
}
