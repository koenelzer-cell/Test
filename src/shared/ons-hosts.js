// Op welke adressen draait ONS? Eén bron: host_permissions in manifest.json.
// Het testpakket (scripts/release.mjs) voegt daar de testomgeving aan toe; de
// code hoeft daarvoor niet te veranderen.

export const ONS_URL_PATTERNS = (function () {
  try { return chrome.runtime.getManifest().host_permissions || []; } catch (e) { return []; }
})();

// 'https://*.onsagenda.nl/*' -> /^https:\/\/[^/]+\.onsagenda\.nl\//
const ONS_URL_RES = ONS_URL_PATTERNS.map(function (patroon) {
  const m = /^https:\/\/(\*\.)?([^/*]+)\/\*$/.exec(patroon);
  return m && new RegExp('^https://' + (m[1] ? '[^/]+\\.' : '') + m[2].replace(/\./g, '\\.') + '/');
}).filter(Boolean);

export function isOnsUrl(url) {
  const u = String(url || '');
  return ONS_URL_RES.some(function (re) { return re.test(u); });
}
