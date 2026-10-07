// Kleur en direct/indirect-label per afspraaktype of registratievorm.

import { APP_CONFIG, directIndirectLabel } from '../config/app-config.js';

// Vier categoriekleuren voor de keuzetegels, elk een verwijzing naar een
// kleur-key uit APP_CONFIG.palette (hetzelfde palet als de dagindeling-
// zones, instelbaar in het beheerscherm bij Afspraaktypes). Zo rijmt de
// kleur die je kiest met de kleur die de afspraak straks in de agenda krijgt,
// en is er één bron van waarheid voor kleuren in plaats van een losse,
// hardgecodeerde set.
function onsahPaletteSolidColor(key) {
  const def = APP_CONFIG.palette && APP_CONFIG.palette[key];
  const raw = String((def && (def.legend || def.fill)) || '').trim();
  const m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return m ? ('rgb(' + m[1] + ',' + m[2] + ',' + m[3] + ')') : '#999';
}
export function onsahCategoryColor(clientPresent, index) {
  const pair = clientPresent ? ['rood', 'blauw'] : ['geel', 'groen'];
  return onsahPaletteSolidColor(pair[(index || 0) % 2]);
}
// Stipkleur per afspraaktype-keuze: leest het 'kleur'-veld van de keuze
// zelf (instelbaar in het beheerscherm, in de modal "Labels in ONS" bij
// dat afspraaktype, zodat je 'm daar direct kunt matchen met de labelkleur
// die ONS zelf toont). Ontbreekt dat veld (bv. een oudere config), dan
// valt dit terug op de vaste afwisseling.
export function onsahChoiceDotColor(choice, index) {
  const key = choice && choice.kleur;
  if (key && APP_CONFIG.palette && APP_CONFIG.palette[key]) return onsahPaletteSolidColor(key);
  return onsahCategoryColor(choice && choice.clientPresent, index);
}
// Zoekt de registratievorm die bij deze afspraaktype-keuze hoort (via de
// gekoppelde ONS-labels) en geeft het bijbehorende direct/indirect-label,
// zodat de keuzetegel in Afspraakhulp dezelfde badge toont als straks de
// Registratiehulp.
export function onsahChoiceDirectIndirectLabel(choice) {
  const forms = (APP_CONFIG && APP_CONFIG.registrationForms) || [];
  const labels = (choice && choice.etiketten && choice.etiketten.length) ? choice.etiketten : (choice && choice.etiket ? [choice.etiket] : []);
  if (!labels.length) return '';
  for (let i = 0; i < forms.length; i++) {
    const f = forms[i];
    if (f.labels && f.labels.some((l) => labels.indexOf(l) !== -1)) return directIndirectLabel(f.startVerdeling);
  }
  return '';
}
// Registratievormen hebben geen clientPresent-veld, maar wel een
// direct/indirect-verdeling (zelfde onderliggende onderscheid).
export function onsahRegistrationIsDirect(choice) {
  if (!choice) return true;
  if (choice.directFullDuration) return true;
  if (choice.indirectFullDuration) return false;
  if (choice.startSplit) return choice.startSplit.directPct >= choice.startSplit.indirectPct;
  return true;
}
