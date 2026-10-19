// Voornaam (of aanduiding) uit een cliëntnaam, voor in de titel. Gedeeld door
// het content-script en de main-world, zodat beide dezelfde regel volgen.
//
// ONS toont namen als "Mw. E.I.A Aalbers" of "Dhr. RWC Aalbers"; de aanhef
// (Mw./Dhr./Mevr./Hr.) is geen voornaam, dus die slaan we over. Wat
// overblijft (bij veel cliënten vaak de voorletters) is prima als aanduiding.
export function firstNameFromName(name) {
  const tokens = String(name || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const TITLE = /^(mw|mevr|mevrouw|dhr|hr|meneer|mr|dr)\.?$/i;
  let i = 0;
  while (i < tokens.length - 1 && TITLE.test(tokens[i])) i++;
  return tokens[i] || tokens[0] || '';
}
