// De registratiehulp in het vernieuwde registratievenster (impegno-backup-
// staging): dezelfde stappen als de bestaande hulp, maar alles via ONS' eigen
// Vue-koppeling van het venster (ons/form-model.js), zonder in velden te
// klikken.
//
//   1. registratievorm kiezen (of meteen de vorm uit het afspraaklabel);
//   2. de vorm zet de tijdverdeling (direct en indirect), zo nodig na de vraag
//      naar de tegen-tijd; 'No show' zet no-show bij de cliënten;
//   3. reistijd, als de vorm dat vraagt;
//   4. de aanhef in de lege rapportage;
//   5. de controles (rapportage, uursoort, direct plus indirect) en Indienen.
//
// De uursoort van de vorm zoekt de hulp op naam in de lijst die het
// uursoortveld zelf ophaalt (main-world), en zet hem zoals dat veld een keuze
// meldt. Is de lijst er nog niet, dan probeert de controle het straks nog één
// keer; is de naam niet (eenduidig) te vinden, dan kiest de medewerker zelf.

import { APP_CONFIG, gsNum, REGISTRATION_CHOICES } from '../../config/app-config.js';
import { leesRegistratieVenster, zetRegistratieNoShow, zetRegistratieRapport, zetRegistratieTijden, zetRegistratieUursoort } from '../../ons/form-model.js';
import { klikIndienenInVenster, toonReistijdInVenster } from '../../ons/registratie-venster.js';
import { labelsVoorAfspraak } from '../../services/ons-api/event-details.js';
import { controleerVenster, deelVraagGeldt, duurVanVenster, isNoShowVorm, kiesUursoort, reistijdVerdeling, verdelingVoorVorm } from '../../domain/registratie-venster.js';
import { $body, safe, setStatus, showLoadingState } from '../../screen/status.js';
import { isScreen, markScreen } from '../../screen/screen-state.js';
import { renderScreen } from '../../ui/react-bridge.js';
import { ONSAH_TOKENS } from '../../ui/theme.js';
import { onsahCategoryColor, onsahRegistrationIsDirect } from '../../ui/choice-style.js';
import { durationLabelStyle, mkDurationPicker } from '../../ui/duration-picker.js';
import { mkPillButton } from '../../ui/controls.js';
import { mkText } from '../../ui/managed-text.js';
import { vulRegistratieControles } from '../registration/completeness.js';
import { matchRegistrationChoiceByLabel } from '../registration/pending.js';
import { helperPanel } from '../../state.js';
import { meldFout } from '../../core/foutbuffer.js';

// Per open venster (afspraak-id): welke vorm, of de vorm uit het label al is
// toegepast, en of de uursoort van de vorm al geprobeerd is (één keer per
// gekozen vorm: kiest de medewerker daarna zelf een andere, dan blijft die).
const stand = { afspraak: null, vorm: null, autoGedaan: false, bezig: false, laatst: null, uursoortGedaan: false };
let controleTimer = null;

function vormen() { return REGISTRATION_CHOICES || []; }
// Een stap die via Vue loopt is async: een fout gaat naar de foutbuffer
// (Debug, Fouten) en geeft een korte status, net als safe().
function opgevangen(belofte, plek) {
  return Promise.resolve(belofte).catch(function (e) { stand.bezig = false; meldFout(plek, e); setStatus('Er ging iets mis', false); });
}
function stopControle() { clearInterval(controleTimer); controleTimer = null; }
// Een nieuw venster (andere afspraak) begint opnieuw.
function nieuwVenster(afspraak) {
  if (stand.afspraak === afspraak) return;
  stand.afspraak = afspraak; stand.vorm = null; stand.autoGedaan = false; stand.laatst = null; stand.uursoortGedaan = false;
}
export function vergeetRegistratieVenster() { stopControle(); stand.afspraak = null; stand.vorm = null; stand.autoGedaan = false; stand.laatst = null; stand.bezig = false; stand.uursoortGedaan = false; }

// De uursoort van de vorm. v: een lezing met de uursoortlijst. Zonder lijst
// (nog niet geladen) niets, en later opnieuw; anders één poging.
async function zetUursoortVanVorm(vorm, v) {
  if (!vorm || !vorm.hourType || stand.uursoortGedaan || !v) return;
  const lijst = Array.isArray(v.uursoorten) ? v.uursoorten : [];
  if (!lijst.length) return;
  stand.uursoortGedaan = true;
  const u = kiesUursoort(lijst, vorm.hourType);
  if (!u) { setStatus('Uursoort ' + vorm.hourType + ' niet gevonden, kies hem zelf', false); return; }
  if (v.uursoort === u.id) return;
  const ok = await zetRegistratieUursoort(u.id);
  setStatus(ok ? 'Uursoort ' + u.naam : 'Uursoort niet gezet, kies hem zelf', ok);
}

// Het startscherm: de vorm kiezen. Komt het venster uit een afspraak met een
// gekoppeld label, dan meteen die vorm (één keer per venster), zoals de
// bestaande hulp.
export function toonRegistratieVenster() {
  const body = $body(); if (!body) return;
  if (stand.vorm) { toonRegistratieVensterRapport(); return; }
  markScreen('registratieVensterKeuze');
  stopControle();
  renderScreen(body, 'choices', {
    choices: vormen().map(function (vorm, i) {
      return { label: vorm.label, tick: onsahCategoryColor(onsahRegistrationIsDirect(vorm), i), meta: vorm.directIndirectLabel };
    }),
    blocked: false,
    tokens: ONSAH_TOKENS,
    onPick: function (i) { opgevangen(kiesVorm(vormen()[i]), 'registratievenster vorm'); },
  });
  setStatus('Kies de registratievorm');
  opgevangen(leesRegistratieVenster().then(function (v) {
    if (!v || !isScreen('registratieVensterKeuze')) return;
    nieuwVenster(v.afspraak || '');
    if (stand.autoGedaan || stand.vorm) return;
    const vorm = labelsVoorAfspraak(v.afspraak).map(matchRegistrationChoiceByLabel).filter(Boolean)[0];
    if (!vorm) return;
    stand.autoGedaan = true;
    setStatus('Uit afspraak: ' + vorm.label);
    return kiesVorm(vorm, v);
  }), 'registratievenster label');
}

// Bij elke wijziging in de pagina (helper/panel.js): het juiste scherm laten staan.
export function verversRegistratieVenster() {
  if (stand.bezig) return;
  if (isScreen('registratieVensterKeuze') || isScreen('registratieVensterDeel') || isScreen('registratieVensterDeelDuur')
    || isScreen('registratieVensterReis') || isScreen('registratieVensterRapport')) return;
  toonRegistratieVenster();
}

async function kiesVorm(vorm, gelezen) {
  if (!vorm || stand.bezig) return;
  stand.bezig = true;
  try {
    showLoadingState(vorm.label + ' toepassen...');
    const v = gelezen || await leesRegistratieVenster();
    if (!v) { stand.bezig = false; setStatus('Het registratievenster is niet te lezen', false); toonRegistratieVenster(); return; }
    nieuwVenster(v.afspraak || '');
    stand.vorm = vorm;
    stand.uursoortGedaan = false;
    if (vorm.hourType) await zetUursoortVanVorm(vorm, await leesRegistratieVenster(undefined, true));
    if (isNoShowVorm(vorm)) {
      let ok = true;
      for (const c of (v.clients || [])) if (!c.noShow) ok = (await zetRegistratieNoShow(c.id, true)) && ok;
      setStatus(ok ? 'No show gezet' : 'No show niet gezet bij elke cliënt', ok);
      stand.bezig = false;
      await zetAanhef(vorm);
      toonRegistratieVensterRapport();
      return;
    }
    stand.bezig = false;
    if (deelVraagGeldt(vorm)) { toonRegistratieVensterDeel(); return; }
    await pasVerdelingToe(vorm, null, v);
    verder(vorm);
  } catch (e) { stand.bezig = false; throw e; }
}
async function pasVerdelingToe(vorm, deel, gelezen) {
  const v = gelezen || await leesRegistratieVenster();
  const verdeling = verdelingVoorVorm(vorm, duurVanVenster(v), deel);
  if (!verdeling) return true;
  const ok = await zetRegistratieTijden({ direct_time: verdeling.direct, indirect_time: verdeling.indirect });
  setStatus(ok ? vorm.label + ': direct ' + verdeling.direct + ' min, indirect ' + verdeling.indirect + ' min' : 'Tijdverdeling niet gezet', ok);
  return ok;
}
function verder(vorm) {
  if (vorm.addTravelTime) { toonRegistratieVensterReis(); return; }
  return zetAanhef(vorm).then(toonRegistratieVensterRapport);
}
// De aanhef van de vorm in de rapportage, alleen als die nog leeg is.
async function zetAanhef(vorm) {
  if (!vorm || !vorm.reportPrefix) return;
  const v = await leesRegistratieVenster();
  if (!v || v.rapportLengte > 0) return;
  await zetRegistratieRapport(vorm.reportPrefix);
}

// 'Directe/Indirecte tijd aanwezig in deze registratie?'
export function toonRegistratieVensterDeel() {
  const body = $body(); const vorm = stand.vorm; if (!body || !vorm) return;
  markScreen('registratieVensterDeel');
  const woord = vorm.askIndirectPortion ? 'indirecte' : 'directe';
  renderScreen(body, 'portionQuestion', {
    question: woord.charAt(0).toUpperCase() + woord.slice(1) + ' tijd aanwezig in deze registratie?',
    woordBijw: vorm.askIndirectPortion ? 'indirect' : 'direct',
    startText: 'begintijd', endText: 'eindtijd',
    tokens: ONSAH_TOKENS,
    onBack: function () { stand.vorm = null; safe(toonRegistratieVenster, 'registratievenster terug'); },
    onYes: function () { safe(toonRegistratieVensterDeelDuur, 'registratievenster deel'); },
    onNo: function () { opgevangen(pasVerdelingToe(vorm, null).then(function () { verder(vorm); }), 'registratievenster deel'); },
    onNoShow: null,
  });
  setStatus(woord + ' tijd?');
}
export function toonRegistratieVensterDeelDuur() {
  const body = $body(); const vorm = stand.vorm; if (!body || !vorm) return;
  markScreen('registratieVensterDeelDuur');
  const woord = vorm.askIndirectPortion ? 'indirecte' : 'directe';
  opgevangen(leesRegistratieVenster().then(function (v) {
    if (!isScreen('registratieVensterDeelDuur')) return;
    const totaal = duurVanVenster(v);
    const onBack = function () { safe(toonRegistratieVensterDeel, 'registratievenster terug'); };
    if (!(totaal >= 5)) { renderScreen(body, 'duration', { title: 'Duur ' + woord + ' tijd:', tokens: ONSAH_TOKENS, onBack: onBack, errorMessage: 'Registratieduur onbekend of te kort.' }); return; }
    const stap = (APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.portionStepMin > 0) ? APP_CONFIG.generalSettings.portionStepMin : 5;
    const waarden = []; for (let m = stap; m <= Math.floor(totaal / stap) * stap; m += stap) waarden.push(m);
    renderScreen(body, 'duration', {
      title: 'Duur ' + woord + ' tijd:', tokens: ONSAH_TOKENS, onBack: onBack,
      pickerNode: mkDurationPicker(waarden, function (minuten) {
        opgevangen(pasVerdelingToe(vorm, minuten).then(function () { verder(vorm); }), 'registratievenster deel');
      }, 'minutenRooster', undefined, durationLabelStyle('duur')),
    });
  }), 'registratievenster deelduur');
}
// 'Totale reistijd (heen en terug):'
export function toonRegistratieVensterReis() {
  const body = $body(); const vorm = stand.vorm; if (!body || !vorm) return;
  markScreen('registratieVensterReis');
  const stap = gsNum('travelStepMin', 5), max = gsNum('travelMaxMin', 60);
  const waarden = []; for (let m = 0; m <= max; m += stap) waarden.push(m);
  renderScreen(body, 'duration', {
    title: 'Totale reistijd (heen en terug):', tokens: ONSAH_TOKENS,
    onBack: function () { safe(function () { if (deelVraagGeldt(vorm)) toonRegistratieVensterDeel(); else { stand.vorm = null; toonRegistratieVenster(); } }, 'registratievenster terug'); },
    pickerNode: mkDurationPicker(waarden, function (totaal) {
      const r = reistijdVerdeling(totaal);
      // Eerst de velden van ONS tonen ('+ Reistijd'), dan de waarden zetten.
      opgevangen((totaal > 0 ? toonReistijdInVenster() : Promise.resolve(true)).then(function () {
        return zetRegistratieTijden({ travel_time_before: r.heen, travel_time_after: r.terug });
      }).then(function (ok) {
        setStatus(ok ? 'Reistijd ' + totaal + ' min' : 'Reistijd niet gezet', ok);
        return zetAanhef(vorm);
      }).then(toonRegistratieVensterRapport), 'registratievenster reistijd');
    }, undefined, undefined, durationLabelStyle('reistijd')),
  });
  setStatus('Kies de reistijd');
}

// De rapportage en wat nog moet; Indienen klikt de knop van ONS als alles klopt.
export function toonRegistratieVensterRapport() {
  const body = $body(); if (!body) return;
  markScreen('registratieVensterRapport');
  const vorm = stand.vorm;
  const lijst = document.createElement('div');
  lijst.setAttribute('data-registratievenster-controles', '');
  // Indienen kijkt altijd naar een verse lezing van het venster, en klikt dan
  // de knop Indienen van ONS zelf (ONS controleert daarna ook nog).
  const knop = mkPillButton('Indienen', function () {
    opgevangen(leesRegistratieVenster().then(function (v) {
      if (!v) { setStatus('Het registratievenster is niet te lezen', false); return; }
      stand.laatst = v;
      const issues = controleerVenster(v, vorm);
      vulRegistratieControles(lijst, issues);
      if (issues.length) { zetKnop(true); setStatus(issues[0].msg, false); return; }
      const ok = klikIndienenInVenster();
      setStatus(ok ? 'Ingediend bij ONS' : 'Knop Indienen van ONS niet gevonden', ok);
    }), 'registratievenster indienen');
  });
  knop.style.width = '100%';
  knop.setAttribute('data-registratievenster-indienen', '');
  // Zoals de bestaande hulp: grijs zolang er nog iets moet, groen als het klopt.
  const zetKnop = function (blok) {
    knop.setAttribute('aria-disabled', blok ? 'true' : 'false');
    knop.style.background = blok ? '#c9c1bd' : '#1b7f3b';
    knop.style.boxShadow = blok ? 'none' : '0 6px 16px -7px rgba(27,127,59,.55)';
    knop.style.cursor = blok ? 'not-allowed' : 'pointer';
  };
  zetKnop(true);
  renderScreen(body, 'reportPrompt', {
    msgNode: mkText('registratie_rapportage_titel', 'Schrijf nu je rapportage', { fontWeight: '700', fontSize: '14px', margin: '8px 0 6px' }),
    completenessNode: lijst,
    submitNode: knop,
    tokens: ONSAH_TOKENS,
    onBack: function () { stand.vorm = null; safe(toonRegistratieVenster, 'registratievenster terug'); },
  });
  let bezigMetLezen = false;
  const ververs = function () {
    if (!isScreen('registratieVensterRapport') || !helperPanel.active) { stopControle(); return; }
    if (bezigMetLezen) return; // vorige lezing loopt nog
    bezigMetLezen = true;
    // Zolang de uursoort van de vorm nog niet geprobeerd is (lijst nog niet
    // geladen), ook de lijst meelezen.
    const uursoortNog = !!(vorm && vorm.hourType && !stand.uursoortGedaan);
    opgevangen(leesRegistratieVenster(undefined, uursoortNog).then(function (v) {
      bezigMetLezen = false;
      if (!v || !isScreen('registratieVensterRapport')) return;
      if (uursoortNog) opgevangen(zetUursoortVanVorm(vorm, v), 'registratievenster uursoort');
      stand.laatst = v;
      const issues = controleerVenster(v, vorm);
      vulRegistratieControles(lijst, issues);
      zetKnop(issues.length > 0);
      setStatus(issues.length ? issues[0].msg : 'Klaar om in te dienen', !issues.length);
    }, function (e) { bezigMetLezen = false; throw e; }), 'registratievenster controle');
  };
  stopControle();
  ververs();
  controleTimer = setInterval(ververs, 1000);
}
