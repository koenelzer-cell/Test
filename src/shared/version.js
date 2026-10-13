// Versienummer van de extensie (uit manifest.json). Gedeeld door alle onderdelen.

// Eén bron van waarheid: versie komt uit manifest.json (met fallback).
export const SCRIPT_VERSION = (function () {
  try { return chrome.runtime.getManifest().version; } catch (e) { return '1.6.264'; }
})();
