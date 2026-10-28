// Afspraak maken: de locaties uit ONS (search_panel/locations/tree). Pure
// rekenlogica.
//
// De boom: [{ label, value, internal_id, authorized, children: [...] }]. In
// een afspraak zet ONS de locatie als location_id = value (zo stuurt het
// formulier van ONS het zelf); internal_id gebruiken we niet. Alleen de
// bladeren zijn te kiezen; het label erboven komt erbij als groep.

export const MAX_LOCATIES = 500;

// -> [{ id, name, groep, kan }] (kan: authorized in ONS)
export function locatiesUitBoom(json) {
  const wortels = Array.isArray(json) ? json
    : json && Array.isArray(json.data) ? json.data
      : json && Array.isArray(json.locations) ? json.locations
        : json && typeof json === 'object' ? [json] : [];
  const tekst = function (v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, 120); };
  const uit = [], gezien = {};
  (function loop(knopen, ouder, diepte) {
    if (diepte > 12) return;
    knopen.forEach(function (n) {
      if (!n || typeof n !== 'object' || uit.length >= MAX_LOCATIES) return;
      const naam = tekst(n.label != null ? n.label : n.name);
      const kinderen = Array.isArray(n.children) ? n.children : [];
      if (kinderen.length) { loop(kinderen, naam || ouder, diepte + 1); return; }
      const id = String(n.value);
      if (!/^\d{1,12}$/.test(id) || !naam || gezien[id]) return;
      gezien[id] = true;
      uit.push({ id: id, name: naam, groep: ouder, kan: n.authorized !== false });
    });
  })(wortels, '', 0);
  return uit;
}
