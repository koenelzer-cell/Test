// Versienummer van de extensie, uit manifest.json. Een functie, zodat een
// module die het nodig heeft ook buiten de extensie (in de tests) te laden is.
export function extensionVersion() {
  return chrome.runtime.getManifest().version;
}

// Het testpakket (scripts/release.mjs: naam eindigt op '(test)'). Alleen daar
// telt de lokale testconfiguratie (chrome.storage.local onsHelperConfig); in
// het gewone pakket niet, zodat iets in die opslag de hulp niet kan omleiden.
export function isTestpakket() {
  try { return /\(test\)\s*$/.test(String(chrome.runtime.getManifest().name || '')); } catch (e) { return false; }
}
