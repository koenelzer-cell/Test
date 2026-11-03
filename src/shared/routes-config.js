// Rijtijden en kaart (zijpaneel): wat er uit routesProxy in de configuratie
// gebruikt wordt. Eigen server (https-url + token) gaat voor; anders direct
// met de Routes-sleutel; anders niets (dan geen rijtijden).
//
// Het zijpaneel leest dit zelf uit wat de extensie meelevert (config.json) en
// het beleid (chrome.storage.managed), niet uit wat de ONS-pagina doorgeeft:
// zo kan niets op die pagina de postcodes naar een andere server laten gaan.

export function routesVoorPaneel(p) {
  p = p && typeof p === 'object' ? p : {};
  const url = String(p.url || '').trim().replace(/\/+$/, '');
  if (/^https:\/\/[^/]+/.test(url) && p.token) return { url: url, token: String(p.token) };
  const key = String(p.routesKey || '').trim();
  return /^[A-Za-z0-9_-]{10,60}$/.test(key) ? { key: key } : null;
}
export function kaartSleutel(p) {
  const k = String((p && p.embedKey) || '').trim();
  return /^[A-Za-z0-9_-]{10,60}$/.test(k) ? k : '';
}
// routesProxy uit config.json en het beleid samen (het beleid wint per sleutel).
export function routesUitLagen(bundled, managed) {
  const deel = function (c) {
    if (!c || typeof c !== 'object') return null;
    const h = c.helperConfig && typeof c.helperConfig === 'object' ? c.helperConfig : c;
    return h.routesProxy && typeof h.routesProxy === 'object' ? h.routesProxy : null;
  };
  return Object.assign({}, deel(bundled), deel(managed));
}
