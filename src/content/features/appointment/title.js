// Titel van het afspraakformulier zetten: eerst in het afspraakmodel van ONS
// (onChange(waarde, 'name') via de main-world) en nakijken of het titelveld
// hem toont; anders typen. Voor elke eenmalige titel. Alleen het aanvullen
// van een vrije titel terwijl de medewerker typt (niet-cliëntgebonden
// 'Overig') typt direct.

import { eerstViaFormulier, zetVeldViaFormulier } from '../../ons/form-model.js';
import { inputTextValue } from '../../ons/form-controls.js';
import { getTitleInputSafe } from '../../ons/appointment-form.js';
import { wachtTot } from '../../core/wacht.js';
import { setAppointmentTitleText } from './fields.js';

// -> Promise<boolean>: true als de titel in het veld staat.
export function zetTitelAsync(tekst) {
  const titel = String(tekst == null ? '' : tekst);
  const toont = () => { const inp = getTitleInputSafe(); return !!inp && inputTextValue(inp) === titel; };
  return eerstViaFormulier(
    () => zetVeldViaFormulier('name', titel).then((ok) => ok && wachtTot(toont, { max: 600 }).then(Boolean)),
    () => setAppointmentTitleText(titel)
  );
}
