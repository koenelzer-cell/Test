// Fouten die de hulp stil opvangt (safe(), een mislukt verzoek aan ONS, een
// onverwachte fout in het content-script): de laatste 100, alleen in het
// geheugen van dit tabblad, zichtbaar in het zijpaneel bij Info, Debug,
// Fouten. Per fout de tijd, de plek en de melding; nooit gegevens die erbij
// hoorden. Lange getallen (zoals een cliëntnummer) in een melding worden '…'.
// De plek komt uit de stack: bestand, regel en kolom in dist/ (het pakket is
// verkleind, dus de kolom wijst de plek aan in dat bestand van die versie).

const MAX = 100;
let fouten = [];

// De plek uit de stack: de eerste regel van de hulp zelf ('content.js:1:2345').
export function plekUitStack(stack) {
  const regels = String(stack || '').split('\n');
  for (let i = 0; i < regels.length; i++) {
    const m = /\/(?:dist|test\/build)\/([\w.-]+\.js):(\d+):(\d+)/.exec(regels[i]);
    if (m) return m[1] + ':' + m[2] + ':' + m[3];
  }
  return '';
}
export function schoneMelding(e) {
  const t = e && typeof e === 'object' ? (e.name && e.name !== 'Error' ? e.name + ': ' : '') + String(e.message || '') : String(e);
  return t.replace(/\d{5,}/g, '…').slice(0, 200) || 'onbekende fout';
}
export function meldFout(plek, e) {
  try {
    fouten.push({ tijd: Date.now(), plek: String(plek || plekUitStack(e && e.stack) || 'onbekend').slice(0, 80), melding: schoneMelding(e) });
    if (fouten.length > MAX) fouten = fouten.slice(-MAX);
  } catch (x) {}
}
export function foutLijst() { return fouten.slice(); }
export function _wisFouten() { fouten = []; }
