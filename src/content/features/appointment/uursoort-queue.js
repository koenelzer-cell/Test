// Uursoort kiezen per cliënt: opties ophalen (API, met DOM-terugval) en de
// wachtrij bij meerdere cliënten.

import { wachtTot } from '../../core/wacht.js';
import { clean } from '../../ons/dom.js';
import {
  entryUursoortIsSet,
  findClientEntries,
  firstNameFromName,
  invalidateClientEntries,
} from '../../ons/appointment-form.js';
import { clearUursoort } from './uursoort-field.js';
import { removeFirstNameFromTitle, setTitleForChoice } from './client-name.js';
import {
  clickInviteeToggle,
  computeAppointmentUursoortState,
  ensureClientExpanded,
  inviteeToggleExpanded,
} from './clients.js';
import { appointmentFlow } from '../../state.js';
import { setStatus, showLoadingState } from '../../screen/status.js';
import { showChoices } from './choices.js';
import { showManualUursoortInstruction, showUursoort } from './uursoort-screens.js';
import { listUursoortOptions, maybePrefetchUursoorten } from './uursoort-source.js';

export function uursoortContexts() {
  return findClientEntries()
    .filter((entry) => entry.uursoortTrigger)
    .map((entry) => ({
      firstName: entry.firstName,
      name: entry.name,
      trigger: entry.uursoortTrigger,
    }));
}
function freshUursoortContext(context) {
  if (!context) return context;
  const entry = findClientEntries().find(
    (item) => item.name === context.name,
  );
  return entry && entry.uursoortTrigger
    ? {
        firstName: entry.firstName,
        name: entry.name,
        trigger: entry.uursoortTrigger,
      }
    : context;
}
export function freshUursoortTriggerForContext(context) {
  return (freshUursoortContext(context) || {}).trigger || null;
}
function clearUursoortContexts(contexts, onDone, index = 0) {
  if (!contexts.length || index >= contexts.length) {
    onDone();
    return;
  }
  invalidateClientEntries();
  const ctx = freshUursoortContext(contexts[index]);
  clearUursoort(
    () =>
      setTimeout(
        () => clearUursoortContexts(contexts, onDone, index + 1),
        120,
      ),
    ctx && ctx.trigger,
  );
}
export function clearAllUursoorten(onDone, attempt = 0) {
  invalidateClientEntries();
  const contexts = uursoortContexts().filter((ctx) =>
    entryUursoortIsSet(
      findClientEntries().find((e) => e.name === ctx.name) || {},
    ),
  );
  if (!contexts.length || attempt >= 6) {
    onDone();
    return;
  }
  clearUursoortContexts(contexts, () => {
    setTimeout(() => clearAllUursoorten(onDone, attempt + 1), 200);
  });
}
export function clientsMissingUursoortEntries(exclude) {
  invalidateClientEntries();
  return findClientEntries().filter(
    (e) =>
      !(
        exclude &&
        exclude.has(typeof clean === "function" ? clean(e.name) : e.name)
      ) && !entryUursoortIsSet(e),
  );
}
// contexts dient alleen als "welke cliënten horen bij deze flow"; de volgorde
// en het overslaan bepalen we live.
export function showUursoortQueue(contexts, afterAll) {
  if (appointmentFlow.uursoortQueueActive) return; // maar één wachtrij tegelijk (geen race tussen drivers)
  appointmentFlow.uursoortQueueActive = true;
  // Deze wachtrij hoort bij de huidige generatie. Wist de gebruiker de instellingen
  // (of remount), dan verandert de generatie en stopt deze driver bij de volgende tik.
  const myGen = appointmentFlow.uursoortQueueGen;
  const stale = () => myGen !== appointmentFlow.uursoortQueueGen;
  // We filteren NIET op de bij-de-start vastgelegde namen: bij 3+ cliënten kan
  // een kaart later uitklappen en anders buiten de lijst vallen. Cliënten die al
  // een uursoort hebben worden sowieso overgeslagen, dus "alle nog ontbrekende
  // uursoorten" is de juiste, robuuste verzameling.
  const handled = new Set(); // cliënten die de gebruiker in deze flow al koos
  const expandTries = new Map(); // per cliënt: pogingen om het veld te vinden
  const nullTries = new Map(); // per cliënt: pogingen waarbij het veld (nog) niet leesbaar was
  let guard = 0;
  const done = () => { if (stale()) return; appointmentFlow.uursoortQueueActive = false; setTimeout(afterAll, 60); };
  // Pas ECHT afronden (opslaanpagina) als een korte hercontrole bevestigt dat
  // niemand meer een uursoort mist. Zonder deze "settle" eindigde de wachtrij
  // tussen cliënt N-1 en N even (want de kaart/uursoort van N was nog niet
  // gedetecteerd) -> opslaanscherm flitste en het zelfherstel moest 'm heropenen.
  // We blijven tijdens de hercontrole actief, dus er verschijnt geen opslaanscherm.
  const settleThenDone = (n) => {
    if (stale()) return;
    const missing = clientsMissingUursoortEntries(handled);
    if (missing.length) { step(); return; }
    // Maximaal ÉÉN hercontrole (gebruikerswens): geen herhaald "Controleren..." per
    // cliënt meer. De remount-afhandeling zit al in de actieve retries (expandTries/
    // nullTries) tijdens het verwerken; deze settle is alleen nog een laatste sanity-check.
    // Bij meerdere cliënten die ene controle iets later, zodat een kaart die tijdens een
    // re-render even uit de DOM valt in dat venster alsnog wordt opgepakt.
    const needed = 1;
    if (n >= needed) { done(); return; }
    showLoadingState('Controleren...');
    const wait = (findClientEntries().length <= 1) ? 130 : 320;
    setTimeout(() => settleThenDone(n + 1), wait);
  };
  const step = () => {
    if (stale()) return; // instellingen gewist / nieuwe flow: deze wachtrij stopt
    if (++guard > 300) { done(); return; }
    const missing = clientsMissingUursoortEntries(handled);
    if (!missing.length) { settleThenDone(0); return; } // pas na hercontrole naar opslaanpagina
    // Liefst een cliënt met een zichtbaar uursoort-veld; anders de eerste die nog
    // mist en dan diens EIGEN kaart uitklappen. Zo werkt het voor 2, 3, 4 of meer:
    // we hangen niet aan een globale "alles open"-check die een late kaart mist.
    const entry = missing.find((e) => e.uursoortTrigger) || missing[0];
    if (!entry.uursoortTrigger) {
      const key = clean(entry.name);
      const n = (expandTries.get(key) || 0) + 1;
      expandTries.set(key, n);
      if (n > 25) {
        // Deze cliënt lukt echt niet automatisch (na ~5s uitklappen): overslaan zodat de
        // rest wél verwerkt wordt (opslaan blijft geblokkeerd tot de gebruiker die zelf
        // invult). Ruim genomen, zodat een traag remountende kaart bij meerdere
        // cliënten niet onterecht wordt overgeslagen.
        handled.add(key);
        setTimeout(step, 60);
        return;
      }
      showLoadingState(`Kaart openen voor ${entry.firstName}...`);
      if (entry.toggle && inviteeToggleExpanded(entry.toggle) === false) clickInviteeToggle(entry.toggle);
      else ensureClientExpanded(() => {}); // toggle-status onbekend of geen toggle: robuuste uitklap
      setTimeout(step, 200);
      return;
    }
    const ctx = { firstName: entry.firstName, name: entry.name, trigger: entry.uursoortTrigger };
    // Unieke laadpagina i.p.v. de opslaanpagina met "laden..." erover.
    showLoadingState(`Uursoort laden voor ${ctx.firstName}...`);
    listUursoortOptions((opts) => {
      if (opts === null) {
        // Veld (nog) niet leesbaar. Dit is meestal tijdelijk (kaart/veld remount na de
        // vorige cliënt), dus NIET meteen overslaan: eerst een aantal keer opnieuw
        // proberen. Pas na herhaalde mislukkingen als afgehandeld markeren, zodat we niet
        // blijven hangen maar ook cliënt 2 niet af en toe onterecht overslaan.
        const nkey = clean(ctx.name);
        const nt = (nullTries.get(nkey) || 0) + 1;
        nullTries.set(nkey, nt);
        if (nt <= 8) { setTimeout(step, 200); return; }
        handled.add(nkey);
        setTimeout(step, 180);
        return;
      }
      showUursoort(opts, () => {
        // Deze cliënt is nu handmatig gezet: niet opnieuw tonen, en NIET de
        // opslaanpagina laten flitsen - gewoon door naar de volgende cliënt.
        handled.add(clean(ctx.name));
        setTimeout(step, 160);
      }, ctx);
    }, freshUursoortTriggerForContext(ctx) || ctx.trigger, 0, false, entry);
  };
  step();
}
function uursoortContextsForNames(names) {
  const wanted = new Set(names.map(clean));
  return findClientEntries()
    .filter((entry) => wanted.has(clean(entry.name)) && entry.uursoortTrigger)
    .map((entry) => ({ firstName: entry.firstName, name: entry.name, trigger: entry.uursoortTrigger }));
}
function startUursoortForNewClients(names) {
  if (!appointmentFlow.pendingChoice || !appointmentFlow.pendingChoice.pickUursoort || appointmentFlow.autoSelectingNewClient) return;
  appointmentFlow.autoSelectingNewClient = true;
  ensureClientExpanded(() => wachtTot(() => {
    invalidateClientEntries();
    const c = uursoortContextsForNames(names);
    return c.length ? c : null;
  }, { max: 2000 }).then((gevonden) => {
    const contexts = gevonden || [];
    if (!contexts.length) {
      appointmentFlow.autoSelectingNewClient = false;
      setStatus('Nieuwe client gevonden | uursoortveld niet gevonden', false);
      return;
    }
    setStatus(`Uursoort kiezen voor ${contexts.map((ctx) => ctx.firstName).join(' - ')}...`);
    showUursoortQueue(contexts, () => {
      appointmentFlow.autoSelectingNewClient = false;
      showChoices();
      setStatus('Uursoort voor nieuwe client gezet');
    });
  }));
}
export function handleClientListChanges() {
  const entries = findClientEntries();
  const currentNames = new Set(entries.map((e) => e.name));
  // Verwijderde cliënt(en): voornaam uit de titel halen.
  if (appointmentFlow.knownClientNames.size) {
    for (const name of appointmentFlow.knownClientNames) {
      if (!currentNames.has(name)) removeFirstNameFromTitle(firstNameFromName(name));
    }
  }
  if (!entries.length) { appointmentFlow.knownClientNames.clear(); return; }
  maybePrefetchUursoorten(); // cliënt aanwezig -> uursoorten alvast op de achtergrond laden
  const firstSeed = !appointmentFlow.knownClientNames.size;
  const added = entries.filter((entry) => !appointmentFlow.knownClientNames.has(entry.name));
  appointmentFlow.knownClientNames = new Set(currentNames);
  if (firstSeed || !added.length) return;
  // Alleen ingrijpen als de gebruiker AL een afspraaktype koos (pendingChoice).
  // Zonder keuze eerst gewoon het keuzemenu tonen, NIET automatisch uursoorten
  // uitlezen (dat kan cliëntgegevens als uursoort lezen en slaat het
  // afspraaktype over).
  if (appointmentFlow.pendingChoice && appointmentFlow.pendingChoice.pickUursoort && !appointmentFlow.uursoortQueueActive && !appointmentFlow.appointmentFlowBusy) {
    setTitleForChoice(appointmentFlow.pendingChoice, () => {});
    // Een later toegevoegde cliënt: de namen gaan naar de auto-wachtrij (die de
    // nieuwe uursoortvelden zelf uitklapt en invult). Alleen zonder concrete
    // namen de handmatige instructie.
    const addedNames = added.map((e) => e.name).filter(Boolean);
    const state = computeAppointmentUursoortState();
    if (addedNames.length && (state === 'MIXED' || state === 'CHOICE')) {
      startUursoortForNewClients(addedNames);
    } else {
      ensureClientExpanded(() => showManualUursoortInstruction());
    }
  }
}
