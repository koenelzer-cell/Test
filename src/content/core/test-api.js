// Testhaak: interne functies blootstellen op window.__onsHelperTestApi, alleen
// als window.__ONS_EXPOSE_FOR_TEST vooraf is gezet. Nul effect in productie.

// Test-hook: alleen actief als window.__ONS_EXPOSE_FOR_TEST vooraf is gezet.
// Stelt geselecteerde interne functies bloot op window.__onsHelperTestApi voor
// de jsdom-tests. Nul effect in productie (vlag staat daar niet).
export function __exposeForTest(map) {
  try {
    if (typeof window === 'undefined' || !window.__ONS_EXPOSE_FOR_TEST) return;
    window.__onsHelperTestApi = window.__onsHelperTestApi || {};
    for (const k in map) if (Object.prototype.hasOwnProperty.call(map, k)) window.__onsHelperTestApi[k] = map[k];
  } catch (e) {}
}
