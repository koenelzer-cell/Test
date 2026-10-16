// Het afspraakformulier dat vanuit de planhulp opent (Afspraak maken, ONS
// Afspraakformulier). Datum, tijden, afspraaktype en uursoorten vult de hulp
// zelf in (features/appointment/prefill.js); de titel komt uit het geheugen
// van het zijpaneel. Is het afspraaktype bekend, dan vraagt de afspraakhulp
// er niet opnieuw naar, maar gaat hij na het invullen meteen naar de
// opslaanpagina. Ontbreekt er nog een uursoort, dan vraagt hij alleen die.

import { MSG } from '../../shared/messages.js';
import { choiceLabels, CONFIG, nonClientCategoriesActive } from '../config/app-config.js';
import { clean } from '../ons/dom.js';
import { getTitleInputSafe } from '../ons/appointment-form.js';
import { appointmentFlow } from '../state.js';
import { applyPendingAppointment } from '../features/appointment/prefill.js';
import { appointmentReadyToSave, setAppointmentTitleText } from '../features/appointment/fields.js';
import { setLabelsExclusive } from '../features/appointment/labels.js';
import { showAppointmentReadyToSave } from '../features/appointment/save.js';
import { showChoices } from '../features/appointment/choices.js';
import { showUursoortQueue } from '../features/appointment/uursoort-queue.js';
import { hasClientInAppointment } from '../features/appointment/clients.js';
import { hasUursoortSelected } from '../features/appointment/uursoort-field.js';
import { handleNonClientOption } from '../features/appointment/non-client.js';
import { inputTextValue } from '../ons/form-controls.js';

// Het afspraaktype uit de beheerlijst waar dit label bij hoort.
export function keuzeVoorLabel(naam) {
  const w = clean(naam || '');
  if (!w) return null;
  return (CONFIG.choices || []).find((c) => choiceLabels(c).some((l) => clean(l) === w)) || null;
}
// De niet-cliëntgebonden optie met deze uursoort (met of zonder sterretje).
export function nietClientOptieVoorUursoort(naam) {
  const kaal = (s) => clean(s || '').replace(/[*#\s]+$/, '');
  const w = kaal(naam);
  if (!w) return null;
  for (const cat of nonClientCategoriesActive()) {
    const opties = [].concat(cat && cat.directOption ? [cat.directOption] : [], (cat && cat.options) || []);
    const o = opties.find((x) => x && x.uursoort && kaal(x.uursoort) === w);
    if (o) return o;
  }
  return null;
}

// De titel uit het zijpaneel (Afspraak maken). Leeg als het paneel dicht is
// of niets voor dit moment heeft.
function vraagTitel(date, time) {
  return new Promise((klaar) => {
    let gemeld = false;
    const einde = (t) => { if (!gemeld) { gemeld = true; klaar(t); } };
    setTimeout(() => einde(''), 2000);
    try {
      chrome.runtime.sendMessage({ type: MSG.AGENDA_FORM_TITLE, date: date, time: time }, (res) => {
        try { void chrome.runtime.lastError; } catch (e) {}
        einde(res && typeof res.title === 'string' ? res.title.trim().slice(0, 200) : '');
      });
    } catch (e) { einde(''); }
  });
}
// Titel zetten zodra het titelveld er is (hooguit ~10 s).
function zetTitel(titel, pogingen = 0) {
  const inp = getTitleInputSafe();
  if (inp && inputTextValue(inp) === titel) return;
  if (inp && setAppointmentTitleText(titel)) return;
  if (pogingen < 40) setTimeout(() => zetTitel(titel, pogingen + 1), 250);
}

// Aanroepen zodra de afspraakhulp op /events/new start (helper/routing.js).
export function startVanuitPlanhulp() {
  let keuze = null, nietClient = null, titel = '';
  const p = applyPendingAppointment(() => afronden());
  if (!p) return;
  const label = p.model && Array.isArray(p.model.labels) && p.model.labels[0] ? p.model.labels[0].name : '';
  keuze = keuzeVoorLabel(label);
  if (!keuze && p.uursoortAfspraak) nietClient = nietClientOptieVoorUursoort(p.uursoortAfspraak.name);
  if (keuze || nietClient) {
    appointmentFlow.planhulpVullenSinds = Date.now();
    if (keuze) appointmentFlow.pendingChoice = keuze;
    if (p.minutes > 0) appointmentFlow.activeAppointmentDurationMinutes = p.minutes;
  }
  vraagTitel(p.date, p.time).then((t) => { titel = t; if (t) zetTitel(t); });

  function afronden() {
    if (!keuze && !nietClient) return;   // onbekend type: de gewone afspraakhulp
    appointmentFlow.planhulpVullenSinds = 0;
    if (nietClient) {
      // Zoals na een keuze in de afspraakhulp (eindtijd en uursoort staan al).
      handleNonClientOption(nietClient);
      return;
    }
    appointmentFlow.appointmentTypeApplied = true;
    const labels = choiceLabels(keuze);
    const naarOpslaan = () => {
      if (titel) zetTitel(titel);
      showAppointmentReadyToSave();
    };
    // ONS kan bij een uursoort zelf een label koppelen: daarna precies de
    // labels van dit type, zoals de afspraakhulp altijd doet.
    setLabelsExclusive(labels, () => {
      if (appointmentReadyToSave()) { naarOpslaan(); return; }
      if (hasClientInAppointment() && !hasUursoortSelected()) {
        showUursoortQueue([], 0, () => setLabelsExclusive(labels, naarOpslaan));
        return;
      }
      showChoices();
    });
  }
}
