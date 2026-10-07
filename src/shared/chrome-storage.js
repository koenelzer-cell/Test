// Promise-varianten van chrome.storage. Fail-safe: een fout of ontbrekende
// opslag levert een leeg resultaat op in plaats van een uitzondering, zodat een
// onderdeel van de extensie nooit stukgaat op opslag.

export function readStorage(area, keys) {
  return new Promise(function (resolve) {
    try {
      if (!area || typeof area.get !== 'function') { resolve({}); return; }
      area.get(keys, function (v) {
        try { if (chrome.runtime && chrome.runtime.lastError) { resolve({}); return; } } catch (e) {}
        resolve(v || {});
      });
    } catch (e) { resolve({}); }
  });
}

export function writeStorage(area, values) {
  return new Promise(function (resolve) {
    try { area.set(values, function () { resolve(); }); }
    catch (e) { resolve(); }
  });
}

export const readLocal = (keys) => readStorage(chrome.storage.local, keys);
export const writeLocal = (values) => writeStorage(chrome.storage.local, values);

// Voorkeuren die met de medewerker meereizen. Zonder sync (bijv. uitgezet door
// beleid) vallen we terug op local.
export function syncArea() {
  return (chrome.storage && chrome.storage.sync) || (chrome.storage && chrome.storage.local);
}
