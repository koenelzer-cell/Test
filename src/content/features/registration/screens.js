// Schermen van de registratiehulp: vorm kiezen, duur, tegen-tijd, reistijd,
// rapportage.

import { APP_CONFIG, gsNum, helperNeedsTeamChoice, REGISTRATION_CHOICES } from '../../config/app-config.js';
import { registrationDurationLabel } from '../../core/datetime.js';
import { mkText } from '../../ui/managed-text.js';
import { clickEmptyModalSpot } from '../../ons/interaction.js';
import { helperPanel, registrationFlow } from '../../state.js';
import { $body, safe, setStatus, showLoadingState } from '../../screen/status.js';
import { ONSAH_TOKENS } from '../../ui/theme.js';
import { onsahCategoryColor, onsahRegistrationIsDirect } from '../../ui/choice-style.js';
import { durationLabelStyle, mkDurationPicker, mkValuePicker } from '../../ui/duration-picker.js';
import { clearScreenMark, markScreen } from '../../screen/screen-state.js';
import { renderScreen } from '../../ui/react-bridge.js';
import { applyRegistrationPortion, applyRegistrationSplitForChoice, clickRegistrationTravelTimeButton, hasRegistrationStartTime, registrationDurationMinutes, registrationLiveTimeValue, registrationPortionApplies, registrationTimeInput, scheduleClearRegistrationTravelTimes, scheduleReapplyRegistrationSplit, setRegistrationDirectFullDuration, setRegistrationEndTimePlusMinutes, setRegistrationEndTimePlusOneHour, setRegistrationEndTimePlusOneMinute, setRegistrationIndirectFullDuration, setRegistrationStartSplit, setRegistrationTravelTotalMinutes } from './fields.js';
import { mkRegistrationCompletenessNode, mkRegistrationSubmitNode } from './completeness.js';
import { clearRegistrationNoShowHourTypes, hasRegistrationEndTime, hasRegistrationHourTypeSelected, registrationHasNoShowHourTypeSelected, registrationHourTypeContexts, setRegistrationHourType } from './hour-type.js';
import { armRegistrationSettleCheck, hasRegistrationPrereqs, registrationReadyToSubmitPage, registrationRestoreHolding } from './prereqs.js';
import { choicePrefix, prefixRegistrationReport, updateRegistrationReportSubmitButton, updateRegistrationSubmitGuard } from './report.js';
import { clearRegistrationSettings } from './reset.js';
import { persistRegistrationForm, restoreRegistrationExtras } from './pending.js';
import { schermen } from '../../screen/schermen.js';

export function showRegistrationReportPrompt(choice) {
  const body = $body(); if (!body) return;
  markScreen('registrationReportPrompt', { choice: choice });
  const backTo = () => {
    registrationFlow.registrationRestoredToReport = false; // bewust weg van het (herstelde) rapportagescherm
    if (choice && choice.label !== 'No show') {
      const contexts = registrationHourTypeContexts();
      schermen.showRegistrationHourTypeSelection(Math.max(0, contexts.length - 1));
    } else { registrationFlow.activeRegistrationChoice = null; showRegistrationChoices(); }
  };
  const msg = mkText('registratie_rapportage_titel', 'Schrijf nu je rapportage, volgens ', { fontWeight: '700', fontSize: '14px', margin: '8px 0 6px' });
  const guidelineEnabled = !APP_CONFIG.features || APP_CONFIG.features.reportGuidelineLink !== false;
  if (!guidelineEnabled) msg.querySelectorAll('a').forEach((anchor) => anchor.replaceWith(document.createTextNode(anchor.textContent || '')));
  if (guidelineEnabled && !msg.querySelector('a[href]')) {
    const link = document.createElement('a');
    link.textContent = 'Richtlijn rapporteren';
    link.href = 'https://impegno.sharepoint.com/sites/kennisbank/Documents_Public/Forms/AllItems.aspx?id=%2Fsites%2Fkennisbank%2FDocuments%5FPublic%2FRichtlijn%20rapporteren%2Epdf&parent=%2Fsites%2Fkennisbank%2FDocuments%5FPublic';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    Object.assign(link.style, { color: '#cc087d', textDecoration: 'underline' });
    msg.appendChild(link);
  }
  renderScreen(body, 'reportPrompt', {
    msgNode: msg,
    completenessNode: mkRegistrationCompletenessNode(),
    submitNode: mkRegistrationSubmitNode(),
    tokens: ONSAH_TOKENS,
    onBack: function () { helperPanel.suppressAutoUntil = Date.now() + 1200; safe(backTo); },
  });
  updateRegistrationReportSubmitButton();
  const usMissing = !hasRegistrationHourTypeSelected();
  setStatus(usMissing ? 'Voeg nog een uursoort toe' : (choice ? `${choice.label} duur afgerond` : ''), !usMissing);
}
export function showRegistrationSubmitOnly() {
  const body = $body(); if (!body) return;
  clearScreenMark();
  renderScreen(body, 'submitOnly', {
    completenessNode: mkRegistrationCompletenessNode(),
    submitNode: mkRegistrationSubmitNode(),
  });
  updateRegistrationReportSubmitButton();
  setStatus('Klaar om in te dienen', true);
}
export function showRegistrationDurationAsk(choice) {
  const body = $body(); if (!body) return;
  if (!hasRegistrationStartTime()) {
    setStatus('Vul eerst de begintijd in.', false);
    // wacht tot begintijd er is, probeer dan opnieuw
    setTimeout(() => safe(() => { if (registrationFlow.activeRegistrationChoice === choice) showRegistrationDurationAsk(choice); }), 500);
    return;
  }
  markScreen('registrationDurationAsk', { choice: choice });
  const _st = (choice.durationStep>0?choice.durationStep:gsNum("durationStepMin",15));
  const _mx = (choice.maxDuration>0?choice.maxDuration:gsNum("registrationMaxMin",180));
  const _durValues = []; for (let m=_st; m<=_mx; m+=_st) _durValues.push(m);
  renderScreen(body, 'duration', {
    title: `${choice.label} duur:`,
    tokens: ONSAH_TOKENS,
    onBack: function () { helperPanel.suppressAutoUntil = Date.now() + 1200; safe(showRegistrationChoices); },
    pickerNode: mkDurationPicker(_durValues, (minutes) => safe(() => {
      const endOk = setRegistrationEndTimePlusMinutes(minutes);
      // verdeling opnieuw toepassen op de nieuwe (nu bekende) duur
      applyRegistrationSplitForChoice(choice);
      scheduleReapplyRegistrationSplit();
      setStatus(endOk ? `${choice.label} ${registrationDurationLabel(minutes)}` : 'Eindtijd niet gezet', endOk);
      setTimeout(() => routeAfterRegistrationDuration(choice), 200);
    }), choice.pickerStyle, undefined, durationLabelStyle('duur')),
  });
  setStatus('Kies de duur');
}
function routeAfterRegistrationDuration(choice) {
  if (registrationPortionApplies(choice)) showRegistrationPortionQuestion(choice);
  else if (choice.addTravelTime) showRegistrationTravelSelection(choice);
  else proceedToReportOrHourType(choice);
}
function registrationNeedsDurationAsk() {
  if (!hasRegistrationEndTime()) return true;
  const dur = registrationDurationMinutes();
  return dur !== null && dur <= 1; // 1 min = No show-restant -> nieuwe duur vragen
}
function registrationPortionWord(choice) {
  return choice.askIndirectPortion ? 'indirecte' : 'directe';
}
function proceedToReportOrHourType(choice) {
  // Uursoort wordt uit de ONS-dropdown gekozen; ontbreekt die nog, toon de
  // uursoort-keuze als laatste stap vóór de rapportage.
  if (choice && !choice.hourType && registrationHasNoShowHourTypeSelected()) {
    clearRegistrationNoShowHourTypes(() => {
      clickEmptyModalSpot();
      updateRegistrationSubmitGuard();
      schermen.showRegistrationHourTypeSelection();
      setStatus('No show-uursoort verwijderd | kies uursoort', false);
    });
    return;
  }
  if (!hasRegistrationHourTypeSelected()) { schermen.showRegistrationHourTypeSelection(); return; }
  showRegistrationReportPrompt(choice);
}
function continueAfterRegistrationChoice(choice) {
  registrationFlow.registrationFlowBusy = true;
  if (choice.addTravelTime) setTimeout(() => { registrationFlow.registrationFlowBusy = false; safe(() => showRegistrationTravelSelection(choice)); }, 200);
  else setTimeout(() => { registrationFlow.registrationFlowBusy = false; safe(() => proceedToReportOrHourType(choice)); }, 200);
}
export function showRegistrationPortionQuestion(choice) {
  const body = $body(); if (!body) return;
  markScreen('registrationPortionQuestion', { choice: choice });
  const woord = registrationPortionWord(choice);
  // Uit een afspraak: 'No show' blijft onder 'Nee' bereikbaar (de vorm-keuze
  // is immers overgeslagen). Bij een losse registratie zonder afspraak staat
  // No show al in de keuzelijst, dus dan tonen we deze knop niet.
  const _ns = registrationFlow.registrationFromAppointment ? REGISTRATION_CHOICES.find((x) => x.label === 'No show') : null;
  renderScreen(body, 'portionQuestion', {
    question: `${woord.charAt(0).toUpperCase() + woord.slice(1)} tijd aanwezig in deze registratie?`,
    woordBijw: choice.askIndirectPortion ? 'indirect' : 'direct',
    startText: registrationLiveTimeValue(registrationTimeInput('declaration_start_time_display')) || 'begintijd',
    endText: registrationLiveTimeValue(registrationTimeInput('declaration_end_time_display')) || 'eindtijd',
    tokens: ONSAH_TOKENS,
    onBack: function () { helperPanel.suppressAutoUntil = Date.now() + 1200; safe(() => showRegistrationDurationAsk(choice)); },
    onYes: function () { safe(() => showRegistrationPortionDuration(choice)); },
    onNo: function () {
      safe(function () {
        // door zoals nu: volledige hoofdtijd, geen tegen-tijd
        registrationFlow.activeRegistrationPortionMinutes = null;
        applyRegistrationSplitForChoice(choice);
        scheduleReapplyRegistrationSplit();
        setStatus(`${choice.label} gezet`);
        continueAfterRegistrationChoice(choice);
      });
    },
    onNoShow: _ns ? function () { safe(() => applyRegistrationChoice(_ns)); } : null,
  });
  setStatus(`${woord} tijd?`);
}
export function showRegistrationPortionDuration(choice) {
  const body = $body(); if (!body) return;
  markScreen('registrationPortionDuration', { choice: choice });
  const woord = registrationPortionWord(choice);
  const total = registrationDurationMinutes();
  const onBack = function () { helperPanel.suppressAutoUntil = Date.now() + 1200; safe(() => showRegistrationPortionQuestion(choice)); };
  if (total === null || total < 5) {
    renderScreen(body, 'duration', {
      title: `Duur ${woord} tijd:`,
      tokens: ONSAH_TOKENS,
      onBack: onBack,
      errorMessage: 'Registratieduur onbekend of te kort.',
    });
    return;
  }
  // Stapgrootte uit config (standaard 5 min), maximaal de registratieduur.
  const _ps = (APP_CONFIG.generalSettings && APP_CONFIG.generalSettings.portionStepMin > 0) ? APP_CONFIG.generalSettings.portionStepMin : 5;
  const max = Math.floor(total / _ps) * _ps;
  const _vals = [];
  for (let minutes = _ps; minutes <= max; minutes += _ps) _vals.push(minutes);
  // Ook deze vraag volgt de duurkeuze-stijl uit het beheerscherm.
  renderScreen(body, 'duration', {
    title: `Duur ${woord} tijd:`,
    tokens: ONSAH_TOKENS,
    onBack: onBack,
    pickerNode: mkDurationPicker(_vals, function (minutes) {
      safe(function () {
        registrationFlow.activeRegistrationPortionMinutes = minutes;
        const ok = applyRegistrationPortion(choice, minutes);
        scheduleReapplyRegistrationSplit();
        setStatus(ok ? `${choice.label} | ${woord} tijd ${registrationDurationLabel(minutes)}` : 'Verdeling niet gezet', ok);
        continueAfterRegistrationChoice(choice);
      });
    }, 'minutenRooster', undefined, durationLabelStyle('duur')),
  });
}
export function showRegistrationTravelSelection(choice) {
  const body = $body(); if (!body) return;
  markScreen('registrationTravelSelection', { choice: choice });
  const _ts = (APP_CONFIG.generalSettings&&APP_CONFIG.generalSettings.travelStepMin>0?APP_CONFIG.generalSettings.travelStepMin:5);
  const _tm = (APP_CONFIG.generalSettings&&APP_CONFIG.generalSettings.travelMaxMin>0?APP_CONFIG.generalSettings.travelMaxMin:60);
  const _travelValues = []; for (let m=0; m<=_tm; m+=_ts) _travelValues.push(m);
  renderScreen(body, 'duration', {
    title: 'Totale reistijd (heen en terug):',
    backFirst: false, // dit scherm zette de titel altijd al bóven de terugknop
    tokens: ONSAH_TOKENS,
    onBack: function () { helperPanel.suppressAutoUntil = Date.now() + 1200; safe(showRegistrationChoices); },
    pickerNode: mkValuePicker(_travelValues, 0, (minutes) => safe(() => {
      registrationFlow.registrationFlowBusy = true;
      const ok = setRegistrationTravelTotalMinutes(minutes);
      setStatus(ok ? `Reistijd gezet: ${registrationDurationLabel(minutes)} totaal` : 'Reistijdvelden niet gevonden', ok);
      setTimeout(() => { registrationFlow.registrationFlowBusy = false; safe(() => proceedToReportOrHourType(registrationFlow.activeRegistrationChoice)); }, 250);
    }), choice.pickerStyle, undefined, durationLabelStyle('duur')),
  });
}
export function applyRegistrationChoice(choice) {
  if (!hasRegistrationPrereqs()) { schermen.showRegistrationNeedsClient(); return; }
  persistRegistrationForm(choice); // vorm onthouden zodat een refresh 'm herstelt
  registrationFlow.registrationRestoredToReport = false; // verse keuze: geen restore-override
  registrationFlow.activeRegistrationChoice = null;
  registrationFlow.activeRegistrationPortionMinutes = null;
  registrationFlow.activeRegistrationHourTypeIndex = null;
  registrationFlow.registrationNoShowPromptOpen = false;
  registrationFlow.registrationNoShowPromptSuppressed = true;
  registrationFlow.registrationEpisodesPromptOpen = false;
  registrationFlow.registrationEpisodesPromptSuppressed = false;
  setStatus(`${choice.label} instellen...`);
  let travelOk = true, endOk = true, splitOk = true, reportOk = true;
  reportOk = prefixRegistrationReport(choicePrefix(choice));
  if (choice.addTravelTime) travelOk = clickRegistrationTravelTimeButton();
  else scheduleClearRegistrationTravelTimes();
  if (choice.endPlusOneMinute) endOk = setRegistrationEndTimePlusOneMinute();
  if (choice.endPlusOneHour) endOk = setRegistrationEndTimePlusOneHour();
  if (choice.startSplit) splitOk = setRegistrationStartSplit(choice);
  if (choice.indirectFullDuration) splitOk = setRegistrationIndirectFullDuration();
  if (choice.directFullDuration) splitOk = setRegistrationDirectFullDuration();
  const finish = (hourOk) => {
    if (choice.endPlusOneMinute) endOk = setRegistrationEndTimePlusOneMinute() || endOk;
    if (choice.endPlusOneHour) endOk = setRegistrationEndTimePlusOneHour() || endOk;
    if (choice.startSplit) splitOk = setRegistrationStartSplit(choice) || splitOk;
    if (choice.indirectFullDuration) splitOk = setRegistrationIndirectFullDuration() || splitOk;
    if (choice.directFullDuration) splitOk = setRegistrationDirectFullDuration() || splitOk;
    const problems = [];
    const notes = [];
    if (choice.hourType && !hourOk) problems.push('uursoort niet gevonden');
    if (choice.addTravelTime && !travelOk) notes.push('Reistijdknop al aanwezig');
    if (choice.endPlusOneMinute && !endOk) problems.push('eindtijd niet gezet');
    if (choice.endPlusOneHour && !endOk) problems.push('eindtijd niet gezet');
    if ((choice.indirectFullDuration || choice.directFullDuration || choice.startSplit) && !splitOk) problems.push('directe/indirecte tijd niet gezet');
    if (!reportOk) notes.push('rapportage niet gevonden');
    const suffix = [...problems, ...notes].join(' | ');
    setStatus(problems.length ? `${choice.label} deels gezet | ${suffix}` : `${choice.label} gezet${suffix ? ` | ${suffix}` : ''}`, problems.length === 0);
    registrationFlow.activeRegistrationChoice = choice;
    scheduleReapplyRegistrationSplit();
    if (choice.hourType) {
      // No show: zet zelf de eindtijd (begintijd + 1 min), ook als die nog
      // moest verschijnen; geen duur-uitvraag. Blijf het kort herproberen.
      if (choice.endPlusOneMinute) {
        [120, 350, 700, 1200].forEach((d) => setTimeout(() => safe(() => {
          if (!hasRegistrationEndTime()) setRegistrationEndTimePlusOneMinute();
        }), d));
      }
      // No show heeft ook een Indienen-pagina nodig.
      setTimeout(() => showRegistrationReportPrompt(choice), 400);
      return;
    }
    // Duur uitvragen als er geen eindtijd is OF als de huidige duur 1 min is
    // (restant van een eerdere No show die nu overschreven wordt).
    if (registrationNeedsDurationAsk()) {
      setTimeout(() => showRegistrationDurationAsk(choice), 250);
      return;
    }
    // Eindtijd is al ingevuld (omgezette afspraak): geen duur vragen.
    if (registrationPortionApplies(choice)) {
      setTimeout(() => showRegistrationPortionQuestion(choice), 300);
    } else if (choice.addTravelTime) {
      setTimeout(() => showRegistrationTravelSelection(choice), 300);
    } else {
      setTimeout(() => proceedToReportOrHourType(choice), 300);
    }
  };
  // No show overschrijft de uursoort met 'No show#'; alle andere vormen
  // laten de bestaande (uit de afspraak overgenomen) uursoort staan.
  if (choice.hourType) setRegistrationHourType(choice.hourType, finish);
  else finish(true);
}
export function showRegistrationChoices() {
  const body = $body(); if (!body) return;
  // Geen resetBody: dit scherm wordt herhaald getekend door de refresh-lus.
  // Leegmaken vóór de asynchrone React-render zou elke tik een lege flits geven;
  // de doorverwijzingen hieronder maken de body zelf leeg waar dat nodig is.
  if (helperNeedsTeamChoice()) { schermen.showNeedsTeamChoice(); return; }
  markScreen('registrationChoices');
  if (!hasRegistrationPrereqs()) { schermen.showRegistrationNeedsClient(); return; }
  // Na een refresh hersteld: de vorm is al toegepast -> direct het rapportagescherm
  // tonen i.p.v. het keuzemenu (ook als de rapportage nog leeg is). Maar pas als de
  // pagina rustig/geladen is, anders flikkert het tijdens het laden.
  if (registrationFlow.registrationRestoredToReport && registrationFlow.activeRegistrationChoice) {
    if (registrationRestoreHolding()) { showLoadingState('Registratie laden...'); armRegistrationSettleCheck(); return; }
    restoreRegistrationExtras(); // directe/indirecte tijd + reistijd terugzetten
    showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
    return;
  }
  // Uit een afspraak? Sla de vorm-keuze over en pas éénmalig automatisch de bij
  // het afspraaklabel horende registratievorm toe (direct/indirect volgt daaruit).
  if (registrationFlow.registrationAutoChoice && !registrationFlow.registrationAutoApplied && !(registrationFlow.activeRegistrationChoice && registrationReadyToSubmitPage())) {
    registrationFlow.registrationAutoApplied = true;
    const auto = registrationFlow.registrationAutoChoice;
    setStatus('Uit afspraak: ' + auto.label);
    applyRegistrationChoice(auto);
    return;
  }
  // Altijd eerst de registratievorm laten kiezen; pas NA een keuze
  // (activeRegistrationChoice gezet) door naar de rapportage/indienen.
  if (registrationFlow.activeRegistrationChoice && registrationReadyToSubmitPage()) {
    showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
    return;
  }
  renderScreen(body, 'choices', {
    choices: REGISTRATION_CHOICES.map((choice, i) => ({
      label: choice.label,
      tick: onsahCategoryColor(onsahRegistrationIsDirect(choice), i),
      meta: choice.directIndirectLabel,
    })),
    blocked: false,
    tokens: ONSAH_TOKENS,
    resetLabel: 'Instellingen verwijderen',
    onPick: function (i) { safe(function () { applyRegistrationChoice(REGISTRATION_CHOICES[i]); }); },
    onReset: function () { safe(clearRegistrationSettings); },
  });
  setStatus('');
}
