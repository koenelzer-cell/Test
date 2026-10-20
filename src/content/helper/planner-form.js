// Het afspraakformulier dat vanuit de planhulp opent (Afspraak maken, ONS
// Afspraakformulier). Datum, tijden, afspraaktype en uursoorten vult de hulp
// zelf in (features/appointment/prefill.js); de titel komt uit het geheugen
// van het zijpaneel. Is het afspraaktype bekend, dan vraagt de afspraakhulp
// er niet opnieuw naar, maar gaat hij na het invullen meteen naar de
// opslaanpagina. Hij laat alleen zien wat nog ontbreekt: geen cliënt, dan
// alleen 'voeg een cliënt toe'; geen uursoort, dan alleen die vraag.

import { MSG } from '../../shared/messages.js';
import { wachtTot } from '../core/wacht.js';
import { choiceLabels, CONFIG, nonClientCategoriesActive } from '../config/app-config.js';
import { clean } from '../ons/dom.js';
import { findClientEntries, getTitleInputSafe, invalidateClientEntries } from '../ons/appointment-form.js';
import { appointmentFlow } from '../state.js';
import { applyPendingAppointment } from '../features/appointment/prefill.js';
import { zetTitelAsync } from '../features/appointment/title.js';
import { setLabelsExclusive } from '../features/appointment/labels.js';
import { clientsMissingUursoortEntries } from '../features/appointment/uursoort-queue.js';
import { ensureClientExpanded, hasClientInAppointment } from '../features/appointment/clients.js';
import { handleNonClientOption } from '../features/appointment/non-client.js';
import { clientVoornamenAsync } from '../features/appointment/client-name.js';
import { leesFormulier } from '../ons/form-model.js';
import { inputTextValue } from '../ons/form-controls.js';
import { schermen } from '../screen/schermen.js';

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
function zetTitel(titel) {
  wachtTot(getTitleInputSafe, { max: 10000 }).then((inp) => {
    if (inp && inputTextValue(inp) !== titel) zetTitelAsync(titel);
  });
}

// Voornamen van cliënten die er in het formulier bij kwamen, achter de titel
// zoals de afspraakhulp ze schrijft ('Titel - Voornaam'; zo kan hij een
// voornaam ook weer weghalen als je een cliënt verwijdert).
// Voornamen uit het afspraakmodel, anders uit de cliëntkaarten
// (clientVoornamenAsync), achter de titel.
function voegVoornamenToe(keuze) {
  return clientVoornamenAsync().then((namen) => {
    const inp = getTitleInputSafe();
    if (!inp) return;
    const t = String(inputTextValue(inp) || '').trim() || keuze.titleLabel || keuze.label || '';
    const delen = t.split(' - ').map(clean);
    const erbij = namen.filter((n) => delen.indexOf(clean(n)) < 0);
    if (erbij.length) return zetTitelAsync([t].concat(erbij).join(' - '));
  });
}
// Welke cliënten missen nog een uursoort? Eerst uit het formulier zelf
// (uursoortveld per cliënt-id), anders uit de cliëntkaarten op het scherm.
// -> Promise<number> (aantal; bij geen gevonden cliënt nooit 0)
function ontbrekendeUursoorten() {
  return leesFormulier().then((f) => {
    if (f && f.clients && f.clients.length) return f.clients.filter((c) => f.uursoorten[c.id] == null).length;
    invalidateClientEntries();
    return findClientEntries().length ? clientsMissingUursoortEntries().length : 1;
  });
}
// Wachten tot elke cliëntkaart open staat met naam en uursoortveld (zoals de
// afspraakhulp dat ook doet voordat hij verder gaat). Hooguit ~4 s.
function wachtOpClientkaarten(verder) {
  ensureClientExpanded(() => {
    wachtTot(() => {
      invalidateClientEntries();
      const kaarten = findClientEntries();
      return kaarten.length > 0 && kaarten.every((e) => e.name && e.uursoortTrigger);
    }, { max: 4000 }).then(() => verder());
  });
}

// Aanroepen zodra de afspraakhulp op /events/new start (helper/routing.js).
export function startVanuitPlanhulp() {
  let keuze = null, nietClient = null, titel = '', clientLater = false;
  appointmentFlow.planhulpVerder = null;   // nieuw formulier: niets meer van een vorig
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
    // Alleen tonen wat nog ontbreekt. Geen cliënt (in de planhulp niet
    // gekozen): alleen daarom vragen; zodra er een cliënt is, gaat het
    // hieronder verder (via choices.js).
    if (!hasClientInAppointment()) {
      appointmentFlow.planhulpVerder = () => {
        clientLater = true;
        // Tot de kaart van de nieuwe cliënt er helemaal staat: laadmelding.
        appointmentFlow.planhulpVullenSinds = Date.now();
        wachtOpClientkaarten(() => { voegVoornamenToe(keuze).then(afronden, afronden); });
      };
      schermen.showAppointmentNeedsPrereqs();
      return;
    }
    const labels = choiceLabels(keuze);
    const naarOpslaan = () => {
      appointmentFlow.planhulpVullenSinds = 0;
      // Pas nu geldt het type als toegepast (zoals na een klik in de hulp).
      appointmentFlow.appointmentTypeApplied = true;
      if (titel && !clientLater) zetTitel(titel);
      schermen.showAppointmentReadyToSave();
    };
    appointmentFlow.planhulpVullenSinds = Date.now();
    wachtOpClientkaarten(() => {
      // ONS kan bij een uursoort zelf een label koppelen: daarna precies de
      // labels van dit type, zoals de afspraakhulp altijd doet.
      setLabelsExclusive(labels, () => {
        // Een type zonder uursoortkeuze vraagt er niet om.
        const telling = keuze.pickUursoort ? ontbrekendeUursoorten() : Promise.resolve(0);
        telling.then((missen) => {
          if (!missen) { naarOpslaan(); return; }
          // Alleen de uursoort ontbreekt: alleen die vragen, dan opslaan.
          appointmentFlow.planhulpVullenSinds = 0;
          schermen.showUursoortQueue([], () => setLabelsExclusive(labels, naarOpslaan));
        });
      });
    });
  }
}
