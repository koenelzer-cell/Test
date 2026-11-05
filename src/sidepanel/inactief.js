// Niets doen in het zijpaneel: wie van de computer wegloopt, laat geen open
// Debug en geen opgehaalde lijsten achter. Telt alleen klikken, toetsen en
// scrollen in het zijpaneel zelf (de schil in agenda-panel.jsx meldt die).
// Na een kwartier gaat Debug op slot, na een half uur is alles leeg en staat
// het zijpaneel weer op de startpagina. Elke stap één keer per stille periode.
// Bewaard in deze module, zodat het opnieuw opbouwen van het paneel
// (paginawissel in ONS) de tijd niet terugzet.

export const DEBUG_SLOT_MS = 15 * 60000;
export const LEEG_MS = 30 * 60000;

let laatst = Date.now();
let gedaan = { slot: false, leeg: false };

export function activiteit() { laatst = Date.now(); gedaan = { slot: false, leeg: false }; }
export function stilSinds() { return Date.now() - laatst; }

// Welke stap nu aan de beurt is. bezig: er loopt nog iets (ophalen,
// opslaan); dan nog niet leegmaken, wel Debug op slot.
export function stilteStappen(bezig) {
  const stil = Date.now() - laatst, uit = { slot: false, leeg: false };
  if (stil >= DEBUG_SLOT_MS && !gedaan.slot) { gedaan.slot = true; uit.slot = true; }
  if (stil >= LEEG_MS && !gedaan.leeg && !bezig) { gedaan.leeg = true; uit.leeg = true; }
  return uit;
}
