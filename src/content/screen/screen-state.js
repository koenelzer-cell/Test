// Welk hulpscherm staat er nu? Eén bron van waarheid (markScreen), zodat het
// scherm na uit/aan of een herbouw terugkomt zonder de schermtekst te
// herkennen.

// ===== Welk hulpscherm staat er nu? (één bron van waarheid) =====
// Voorheen werd dit achteraf afgeleid door de schermTEKST met patronen te
// ontleden (zie de terugvallogica onderin createCurrentScreenRestore). Dat is
// fragiel: precies die zinnen zijn in het beheerscherm aanpasbaar, dus een
// gewijzigde tekst brak stilletjes de schermherkenning. Elk scherm meldt zich
// nu zelf aan; herstellen is dan simpelweg datzelfde scherm opnieuw tekenen.
// Alleen 'echte' schermen melden zich — tijdelijke overlays (laden, info,
// uitgeschakeld) juist niet, want daar mag je nooit naar terugkeren.
export let currentScreen = null;
export function markScreen(name, args) { currentScreen = { name: name, args: args || {} }; }
// Voor schermen die (nog) niet herstelbaar zijn: markering wissen, zodat er
// nooit een verouderd scherm blijft staan en de terugval het overneemt —
// precies zoals het vóór de state-machine ook ging.
// Het scherm dat je verlaat is zelf niet herstelbaar, maar de route ernaartoe
// wél: het scherm waar je vandaan kwam gaat op de stapel, zodat Terug niet
// een stap overslaat.
export function clearScreenMark() { currentScreen = null; }
// Staat dit scherm nu? Vervangt checks die vroeger afgingen op het bestaan van
// een timer of op de tekst in het paneel.
export function isScreen(name) { return !!currentScreen && currentScreen.name === name; }
// Maakt de hulp-body leeg vóór een vanilla-scherm. React beheert dezelfde
// container, dus die root moet er eerst netjes af: anders blijft React denken
// dat hij nog eigenaar is van knopen die hier zojuist zijn weggegooid.
export function resetBody(body) {
  if (!body) return;
  try { if (window.__onsahReact) window.__onsahReact.unmount(body); } catch (e) {}
  body.innerHTML = '';
}
