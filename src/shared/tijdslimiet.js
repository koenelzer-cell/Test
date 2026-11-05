// Een verzoek dat te lang op antwoord wacht, breekt de hulp af: dan krijgt de
// medewerker een fout (met Opnieuw) in plaats van een knop die blijft draaien.
// Werkt met elke fetch-functie (ook de nep-fetch in tests): het verzoek krijgt
// een AbortSignal mee, en na de limiet wordt het afgebroken en geweigerd met
// een TimeoutError, ook als de fetch-functie het signaal negeert.

export const TIJDSLIMIET_MS = 20000;

export function metTijdslimiet(fetchFn, url, init, ms) {
  const limiet = ms > 0 ? ms : TIJDSLIMIET_MS;
  if (typeof AbortController !== 'function') return fetchFn(url, init);
  const ac = new AbortController();
  let timer = null;
  const verlopen = new Promise(function (_, weiger) {
    timer = setTimeout(function () {
      try { ac.abort(); } catch (e) { /* al afgebroken */ }
      const fout = new Error('Geen antwoord binnen ' + Math.round(limiet / 1000) + ' seconden');
      fout.name = 'TimeoutError';
      weiger(fout);
    }, limiet);
  });
  const verzoek = Promise.resolve().then(function () {
    return fetchFn(url, Object.assign({}, init, { signal: ac.signal }));
  });
  return Promise.race([verzoek, verlopen]).finally(function () { clearTimeout(timer); });
}

// Een fout van metTijdslimiet?
export function isTijdslimiet(fout) { return !!fout && fout.name === 'TimeoutError'; }
