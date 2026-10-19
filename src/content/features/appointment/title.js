// Titel van het afspraakformulier zetten: eerst rechtstreeks in het
// afspraakmodel van ONS (onChange(waarde, 'name') via de main-world), en
// alleen als het titelveld daarna niet de nieuwe titel toont, typen zoals
// vroeger.

import { zetVeldViaFormulier } from '../../ons/form-model.js';
import { inputTextValue } from '../../ons/form-controls.js';
import { getTitleInputSafe } from '../../ons/appointment-form.js';
import { setAppointmentTitleText } from './fields.js';

// -> Promise<boolean>: true als de titel in het veld staat.
export function zetTitelAsync(tekst) {
  const titel = String(tekst == null ? '' : tekst);
  const toont = () => { const inp = getTitleInputSafe(); return !!inp && inputTextValue(inp) === titel; };
  return zetVeldViaFormulier('name', titel).then((ok) => new Promise((klaar) => {
    // Het veld even de tijd geven om het model te volgen.
    setTimeout(() => {
      if (ok && toont()) { klaar(true); return; }
      klaar(setAppointmentTitleText(titel));
    }, ok ? 60 : 0);
  }));
}
