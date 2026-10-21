// Versienummer van de extensie, uit manifest.json. Een functie, zodat een
// module die het nodig heeft ook buiten de extensie (in de tests) te laden is.
export function extensionVersion() {
  return chrome.runtime.getManifest().version;
}
