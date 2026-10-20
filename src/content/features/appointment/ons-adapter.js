// OnsAdapter: één gedocumenteerde naad naar het afspraakformulier (lezen én
// bedienen), met een register van velden die niet (meer) gevonden worden.
// Gebruikt door de zelfdiagnose en de tests.

import { inputTextValue } from '../../ons/form-controls.js';
import {
  appointmentTravelInput,
  entryUursoortIsSet,
  entryUursoortText,
  findClientEntries,
  findRecurrenceField,
  getDateInput,
  getEndTimeInput,
  getEtiketTrigger,
  getStartTimeInput,
  getTitleInput,
  invalidateClientEntries,
  labelChips,
} from '../../ons/appointment-form.js';
import { clearTitle } from './fields.js';
import { zetTitelAsync } from './title.js';
import { chooseUursoort } from './uursoort-field.js';
import { clearKnownLabels, setLabel } from './labels.js';
import { clearEndTime } from './end-time.js';
import {
  appointmentTravelTotalMinutes,
  clearAppointmentTravelTimes,
  setAppointmentTravelTotalMinutes,
} from './travel.js';
import { ensureClientExpanded, hasClientInAppointment } from './clients.js';
import { clearAllUursoorten } from './uursoort-queue.js';
import { findModal } from '../../ons/modal.js';

// Zelftest: welke kern-hooks herkent de hulp NIET op het afspraakscherm?
// Label/datum/begintijd horen altijd in de afspraakdetails te staan zodra het
// keuzescherm verschijnt. Uursoort blijft buiten de check: dat veld zit soms in
// een ingeklapte cliëntkaart en wordt bewust later door de gebruiker gekozen.
/* ==========================================================================
   ONS-adapter

   Eén plek die beschrijft wat de hulp uit ONS leest en erin schrijft. De rest
   van de extensie hoeft dan niet te weten hóé ONS dat technisch doet — bij een
   wijziging in ONS is dit het bestand waar je kijkt.

   Bewust een dunne laag over de bestaande functies, niet een herschrijving:
   die functies zijn door schade en schande afgesteld en werken. Wat de laag
   wél toevoegt:
     1) een inventaris van alle contactpunten, op één plek;
     2) elke mislukte uitlezing wordt geregistreerd, zodat de zelftest niet
        langer drie hardgecodeerde velden controleert maar álles wat de hulp
        werkelijk nodig had;
     3) een testbare naad: met een opgeslagen stuk ONS-HTML kun je nu
        controleren of de herkenning nog klopt.
   ========================================================================== */
const _onsGemist = new Set();
// Voert een uitlezing uit en onthoudt of die iets opleverde. `naam` is wat de
// medewerker in een melding te zien krijgt, dus in gewone taal.
function _onsLees(naam, fn) {
  let waarde = null;
  try { waarde = fn(); } catch (e) { waarde = null; }
  const leeg = waarde == null || waarde === '' || waarde === false ||
    (Array.isArray(waarde) && waarde.length === 0);
  if (leeg) _onsGemist.add(naam); else _onsGemist.delete(naam);
  return waarde;
}
// Welke ONS-velden heeft de hulp deze sessie niet kunnen vinden?
// Let op: een Set is niet array-achtig, dus Array.prototype.slice werkt hier
// niet — die gaf stilzwijgend een lege lijst terug.
export function onsGemisteVelden() { return Array.from(_onsGemist); }
export function onsVergeetGemist() { _onsGemist.clear(); }
export const OnsAdapter = {
  // Waar zijn we, en in welk scherm?
  context: {
    modal: () => _onsLees('afspraakvenster', findModal),
    heeftClient: () => hasClientInAppointment(),
  },
  // De afspraak zelf.
  afspraak: {
    titelVeld: () => _onsLees('titel', getTitleInput),
    datumVeld: () => _onsLees('datum', getDateInput),
    begintijdVeld: () => _onsLees('begintijd', getStartTimeInput),
    eindtijdVeld: () => _onsLees('eindtijd', getEndTimeInput),
    labelVeld: () => _onsLees('label', getEtiketTrigger),
    herhalingVeld: () => _onsLees('herhaling', findRecurrenceField),
    reistijdVeld: (richting) => _onsLees('reistijd ' + richting, () => appointmentTravelInput(richting)),

    titel() { const el = this.titelVeld(); return el ? String(inputTextValue(el) || '').trim() : ''; },
    eindtijd() { const el = this.eindtijdVeld(); return el ? String(inputTextValue(el) || '').trim() : ''; },
    labels() {
      try { return (labelChips(getEtiketTrigger()) || []).map((c) => String(c.name || '').trim()).filter(Boolean); }
      catch (e) { return []; }
    },
    reistijdTotaal: () => appointmentTravelTotalMinutes(),

    zetTitel: (tekst) => zetTitelAsync(tekst),
    zetLabel: (naam, klaar) => setLabel(naam, klaar),
    wisLabels: (klaar) => clearKnownLabels(klaar),
    zetReistijd: (minuten) => setAppointmentTravelTotalMinutes(minuten),
    wisReistijd: () => clearAppointmentTravelTimes(),
    wisTitel: () => clearTitle(),
    wisEindtijd: () => clearEndTime(),
  },
  // De cliënten in de afspraak en hun uursoort — het veld waar het in de
  // praktijk het vaakst misgaat.
  clienten: {
    lijst: () => _onsLees('cliëntkaarten', findClientEntries),
    ververs: () => invalidateClientEntries(),
    klapUit: (klaar) => ensureClientExpanded(klaar),
    uursoort: (entry) => entryUursoortText(entry),
    heeftUursoort: (entry) => entryUursoortIsSet(entry),
    uursoortVeld: (entry) => (entry ? entry.uursoortTrigger : null),
    zetUursoort: (tekst, klaar, trigger) => chooseUursoort(tekst, klaar, trigger),
    wisUursoorten: (klaar) => clearAllUursoorten(klaar),
  },
};
