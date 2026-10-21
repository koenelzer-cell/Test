// Wat er moet gebeuren als de configuratie verandert.
//
// De configuratielaag weet niet wie er op een wijziging reageert: index.js
// koppelt dat één keer bij het opstarten (connectConfigHooks), vóór de eerste
// configuratie wordt ingelezen. Zo hoeft config/ niet te importeren uit de
// lagen erboven (routering, features), en blijft het los te testen.

const hooks = {
  formsChanged: null,       // registratievormen gewijzigd -> rechtermuismenu bijwerken
  selectorsChanged: null,   // config.uiSelectors gewijzigd -> selector-overrides herberekenen
  configApplied: null,      // configuratie toegepast -> opnieuw bepalen welke hulp bij de URL hoort
  teamChanged: null,        // ander team gekozen -> de hulp opnieuw starten
};

export function connectConfigHooks(handlers) {
  for (const k of Object.keys(handlers)) {
    if (!(k in hooks)) throw new Error('onbekende config-haak: ' + k);
    hooks[k] = handlers[k];
  }
}

export function runConfigHook(name, ...args) {
  try { if (typeof hooks[name] === 'function') hooks[name](...args); } catch (e) {}
}
