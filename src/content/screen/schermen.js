// De schermen van de hulp openen elkaar (keuzes, voorwaarden, duur, uursoort,
// opslaan, registratie, …), maar importeren elkaar niet: index.js meldt ze
// hier bij het opstarten aan (koppelSchermen) en een scherm opent een ander
// met schermen.showX(). Zo lopen de importen tussen de schermen niet in een
// kring, en is elk scherm los te lezen.

export const schermen = {};

export function koppelSchermen(lijst) { Object.assign(schermen, lijst); }
