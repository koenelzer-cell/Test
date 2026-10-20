// Niet-cliëntgebonden afspraken (overleg, verlof, pauze, Overig).

import { gsNum } from '../../config/app-config.js';
import { registrationDurationLabel } from '../../core/datetime.js';
import { clean, isOwnPopup, rect, visible } from '../../ons/dom.js';
import { inputTextValue, uiText } from '../../ons/form-controls.js';
import { invalidUursoortOption } from '../../ons/uursoort-options.js';
import { getTitleInputSafe, getUursoortTrigger } from '../../ons/appointment-form.js';
import {
  appointmentCurrentStartTimeText,
  clearTitle,
  hasAppointmentDate,
  hasAppointmentEndTime,
  hasAppointmentStartTime,
  setAppointmentTitleText,
} from './fields.js';
import { clearUursoortViaScherm, setAppointmentUursoortByName } from './uursoort-field.js';
import { updateSubmitGuard } from './submit-guard.js';
import { clearKnownLabels, clickLabelChipRemovers, setLabelsExclusive, voegLabelToe } from './labels.js';
import { zetTitelAsync } from './title.js';
import { eerstViaFormulier, wisUursoortViaFormulier } from '../../ons/form-model.js';
import {
  clearEndTime,
  enforceAppointmentEndTime,
  scheduleAppointmentEndTime,
  setAppointmentEndTimePlusMinutes,
} from './end-time.js';
import { clearAppointmentTravelTimes } from './travel.js';
import { showAppointmentReadyToSave } from './save.js';
import { appointmentFlow, helperPanel } from '../../state.js';
import { $body, safe, setStatus } from '../../screen/status.js';
import { showAppointmentNeedsPrereqs } from './prereqs.js';
import { ONSAH_TOKENS } from '../../ui/theme.js';
import { durationLabelStyle, mkDurationPicker } from '../../ui/duration-picker.js';
import { clearScreenMark, markScreen } from '../../screen/screen-state.js';
import { renderScreen } from '../../ui/react-bridge.js';
import { closeOnsModal, findModal } from '../../ons/modal.js';
import { deepQueryAll } from '../../ons/dom.js';

export function findNonClientUursoortTrigger() {
  // Het uursoort-veld op afspraakniveau, via het label "Uursoort" in Afspraakdetails.
  // Gebruik hier nooit de cliëntkaart: dezelfde discipline als de cliëntgebonden
  // flow, maar dan met een eigen afspraakniveau-context.
  const modal = findModal() || document;
  const modalBox = modal && modal.getBoundingClientRect ? rect(modal) : { left: 0, width: window.innerWidth || document.documentElement.clientWidth || 1200 };
  const detailsHead = deepQueryAll('h1,h2,h3,div,span,p', modal).find(function (el) {
    return visible(el) && !isOwnPopup(el) && clean(el.textContent || '') === 'afspraakdetails';
  });
  const detailsLeft = detailsHead ? rect(detailsHead).left : (modalBox.left + modalBox.width * 0.45);
  const rightSide = function (el) {
    const r = rect(el);
    if (r.width <= 0 || r.height <= 0) return false;
    if (r.left < detailsLeft - 100) return false;
    let n = el.parentElement;
    for (let depth = 0; n && depth < 7; depth++, n = n.parentElement) {
      const txt = clean(n.textContent || '');
      if (txt.includes('genodigden') || txt.includes('clienten zijn aanwezig') || txt.includes('verwijder uit selectie')) return false;
      if (txt.includes('afspraakdetails')) return true;
    }
    return true;
  };
  const direct = deepQueryAll('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"]', modal)
    .filter(function (el) { return visible(el) && !isOwnPopup(el) && rightSide(el); })
    .sort(function (a, b) { return rect(a).top - rect(b).top; })[0];
  if (direct) {
    return direct;
  }
  const labels = deepQueryAll('label,div,span,p', modal).filter(function (el) {
    return visible(el) && !isOwnPopup(el) && clean(el.textContent || '') === 'uursoort';
  }).filter(function (label) {
    const lr = rect(label);
    if (lr.left < detailsLeft - 80) return false;
    let n = label.parentElement;
    for (let depth = 0; n && depth < 7; depth++, n = n.parentElement) {
      const txt = clean(n.textContent || '');
      if (txt.includes('genodigden') || txt.includes('clienten zijn aanwezig') || txt.includes('verwijder uit selectie')) return false;
      if (txt.includes('afspraakdetails')) return true;
    }
    return true;
  });
  for (const label of labels) {
    const lr = rect(label);
    const candidates = deepQueryAll('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], [data-qa="hour_type_select"], [role="combobox"],select,button,div,span,input', modal);
    let best = null, bestScore = Infinity;
    for (const el of candidates) {
      if (!visible(el) || isOwnPopup(el) || el === label) continue;
      const meta = clean((uiText(el) || '') + ' ' + ((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('data-qa') || '')) || ''));
      if (/reistijd|locatie|labels|notities|titel|begintijd|eindtijd/.test(meta)) continue;
      const r = rect(el);
      if (r.width < 150 || r.height < 22 || r.height > 90) continue;
      if (r.top < lr.bottom - 8 || r.top > lr.bottom + 100) continue;
      if (Math.abs(r.left - lr.left) > 280) continue;
      const textBonus = /zoek naar uursoorten|uursoort/.test(meta) ? -500 : 0;
      const hostBonus = /^UC-SELECT$/i.test(el.tagName || '') ? -700 : 0;
      const score = textBonus + hostBonus + (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
      if (score < bestScore) { best = el; bestScore = score; }
    }
    if (best) {
      const nested = best.querySelector && best.querySelector('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], [data-qa="hour_type_select"], [aria-label="Uursoort"]');
      return nested || best;
    }
  }
  return null;
}
// Titel van een optie. Bij een vrije titel ('Overig') direct typen: daarna
// zet het titelscherm er meteen het voorvoegsel in, en een titel die later
// via het model binnenkomt zou dat overschrijven.
function titelVoorOptie(opt) {
  if (opt.freeTitle) setAppointmentTitleText(opt.display);
  else zetTitelAsync(opt.display);
}
// Labels van een niet-cliëntgebonden optie: JG Overig, plus het eigen label
// uit de beheerlijst als dat is ingesteld.
function nonClientLabels(opt) {
  return ['JG Overig'].concat(opt && opt.etiket ? [opt.etiket] : []);
}
function clearNonClientUursoort(onDone) {
  // Eerst in het formulier; via het scherm één poging (chip weg, anders de
  // dropdown). Bij mislukking accepteren: de uursoort wordt bij de volgende
  // keuze toch overschreven.
  const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
  if (!trigger || !nonClientUursoortValueText()) { if (onDone) onDone(); return; }
  eerstViaFormulier(
    () => wisUursoortViaFormulier(trigger),
    () => new Promise(function (klaar) {
      if (clickLabelChipRemovers(trigger, [])) setTimeout(klaar, 220);
      else clearUursoortViaScherm(klaar, trigger);
    })
  ).then(function () { if (onDone) onDone(); });
}
export function clearNonClientSettings() {
  appointmentFlow.appointmentClearingSettings = true;
  setStatus('Instellingen verwijderen...');
  let finished = false;
  const finish = function (ok, text) {
    if (finished) return;
    finished = true;
    clearTimeout(guard);
    appointmentFlow.activeNonClientOption = null;
    appointmentFlow.appointmentClearingSettings = false;
    showAppointmentNeedsPrereqs();
    setStatus(text || 'Instellingen verwijderd', ok !== false);
  };
  const guard = setTimeout(function () {
    finish(false, 'Instellingen grotendeels verwijderd');
  }, 5500);
  try {
    // Stop alle geplande eindtijd-timers zodat ze de schone staat niet overschrijven.
    appointmentFlow.appointmentTimeGuardTimers.forEach(function (t) { clearTimeout(t); });
    appointmentFlow.appointmentTimeGuardTimers = [];
    appointmentFlow.activeAppointmentDurationMinutes = null;
    clearTitle();
    clearEndTime();
    clearAppointmentTravelTimes();
    clearKnownLabels(function () {
      try {
        clearNonClientUursoort(function () { finish(true, 'Instellingen verwijderd'); });
      } catch (e) {
        finish(false, 'Instellingen deels verwijderd');
      }
    });
  } catch (e) {
    finish(false, 'Instellingen deels verwijderd');
  }
}
let nonClientInfoOverlay = null;
function closeNonClientOptionInfo() {
  if (nonClientInfoOverlay && nonClientInfoOverlay.parentNode) nonClientInfoOverlay.parentNode.removeChild(nonClientInfoOverlay);
  nonClientInfoOverlay = null;
}
function showNonClientOptionInfo(opt) {
  closeNonClientOptionInfo();
  // Boven de afspraakhulp-popup tonen. De ONS-modal zit in de top-layer, dus een
  // overlay op document.body valt erachter. Daarom hangen we de info-popup in
  // dezelfde host als popupEl en positioneren we hem over de popup heen.
  const host = (helperPanel.popupEl && helperPanel.popupEl.parentNode) || document.body;
  const r = helperPanel.popupEl ? rect(helperPanel.popupEl) : { left: 24, top: 74, width: 280, height: 200 };
  const box = document.createElement('div');
  nonClientInfoOverlay = box;
  Object.assign(box.style, {
    position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px',
    zIndex: '2147483647', boxSizing: 'border-box',
    background: '#fff', border: '2px solid #e91e8c', borderRadius: '12px',
    padding: '14px 16px', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
  });
  const headRow = document.createElement('div');
  Object.assign(headRow.style, { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' });
  const title = document.createElement('div');
  title.textContent = opt.display;
  Object.assign(title.style, { fontWeight: '700', fontSize: '14px', color: '#e91e8c', flex: '1' });
  const closeX = document.createElement('button');
  closeX.textContent = '✕';
  Object.assign(closeX.style, {
    flexShrink: '0', width: '24px', height: '24px', padding: '0', lineHeight: '1',
    border: 'none', background: 'transparent', color: '#e91e8c', fontSize: '16px', cursor: 'pointer',
  });
  closeX.title = 'Sluiten';
  closeX.addEventListener('click', function (e) { e.stopPropagation(); closeNonClientOptionInfo(); });
  headRow.appendChild(title);
  headRow.appendChild(closeX);
  box.appendChild(headRow);
  const text = document.createElement('div');
  text.textContent = opt.info || '';
  Object.assign(text.style, { fontSize: '13px', color: '#333', lineHeight: '1.5' });
  box.appendChild(text);
  try { host.appendChild(box); } catch (e) { document.body.appendChild(box); }
}
export function showNonClientCategory(cat) {
  const body = $body(); if (!body) return;
  clearScreenMark();
  const _opts = cat.options || [];
  renderScreen(body, 'category', {
    heading: cat.label,
    options: _opts.map(function (opt) { return { display: opt.display, info: !!opt.info }; }),
    tokens: ONSAH_TOKENS,
    onBack: function () { helperPanel.suppressAutoUntil = Date.now() + 1200; safe(showAppointmentNeedsPrereqs); },
    onPick: function (i) { safe(function () { handleNonClientOption(_opts[i]); }); },
    onInfo: function (i) { safe(function () { showNonClientOptionInfo(_opts[i]); }); },
  });
  setStatus('Kies een optie');
}
function applyNonClientEndTime(minutes) {
  appointmentFlow.activeAppointmentStartTimeText = appointmentCurrentStartTimeText();
  clearAppointmentTravelTimes();
  const ok = setAppointmentEndTimePlusMinutes(minutes);
  scheduleAppointmentEndTime(minutes);
  return ok;
}
function finishNonClientOption(opt) {
  // Label JG Overig zetten en daarna naar de opslaanpagina zodra de tijden kloppen.
  // Het label-veld zit in hetzelfde Afspraakdetails-paneel als de eindtijd, dus de
  // label-selectie kan de eindtijd wissen -> na elke stap opnieuw afdwingen,
  // precies zoals handleChoice dat in de cliëntflow doet.
  // enforceAppointmentEndTime/scheduleAppointmentEndTime doen niets als
  // activeAppointmentDurationMinutes null is (eindtijd was al ingevuld).
  setLabelsExclusive(nonClientLabels(opt), function () {
    zetTitelAsync(opt.display);
    scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
    setStatus(opt.display + ' gezet');
    const tryShow = function () {
      if (appointmentFlow.activeNonClientOption !== opt) return false;
      // Eindtijd opnieuw afdwingen vóór de check; een paneel-rerender kan hem
      // ondertussen hebben gewist.
      enforceAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
      // Naar opslaanpagina zodra datum + begin- + eindtijd kloppen (uursoort
      // mag handmatig; de opslaanpagina toont anders een uursoort-melding).
      if (hasAppointmentDate() && hasAppointmentStartTime() && hasAppointmentEndTime()) {
        showAppointmentReadyToSave();
        return true;
      }
      return false;
    };
    [120, 350, 700, 1200].forEach(function (d) { setTimeout(function () { safe(tryShow); }, d); });
  });
}
function nonClientHourTypeMatches(text, wanted) {
  const c = clean(text);
  const w = clean(wanted);
  const loose = clean(String(wanted || '').replace(/[*#]+$/, ''));
  return !!c && (c === w || (!!loose && c === loose) || c.includes(w) || (!!loose && c.includes(loose)));
}
// Geeft de geselecteerde uursoort-chips naast het trigger-veld terug,
// op dezelfde manier als selectedKnownLabels dat voor etiketten doet.
function nonClientUursoortChips(trigger) {
  if (!trigger) return [];
  const tr = rect(trigger);
  const found = [];
  const seen = new Set();
  for (const el of deepQueryAll('div,span,button,[role="button"]')) {
    if (!visible(el) || isOwnPopup(el)) continue;
    const r = rect(el);
    if (r.bottom < tr.top - 24 || r.top > tr.bottom + 24 || r.left < tr.left - 60 || r.right > tr.right + 120) continue;
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const c = clean(txt);
    if (!c || /^zoek naar|selecteer uursoort/.test(c) || invalidUursoortOption(txt)) continue;
    if (!seen.has(c)) { seen.add(c); found.push(txt); }
  }
  return found;
}
function nonClientUursoortValueText() {
  const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
  if (!trigger) return '';
  const chips = nonClientUursoortChips(trigger);
  if (chips.length) return chips[0];
  // Fallback: trigger-tekst (voor dropdowns die de waarde erin tonen)
  const txt = clean(uiText(trigger) || trigger.textContent || ('value' in trigger ? trigger.value : '') ||
    (trigger.getAttribute && (trigger.getAttribute('title') || trigger.getAttribute('value'))) || '');
  if (!txt || /^(zoek naar uursoorten|selecteer uursoort|uursoort|zoek naar uursoort)$/.test(txt)) return '';
  return txt;
}
export function nonClientUursoortSet() {
  if (!appointmentFlow.activeNonClientOption) return false;
  const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
  if (!trigger) return false;
  const wanted = appointmentFlow.activeNonClientOption.uursoort;
  // 1) Chips zoals bij labels. Een spurious chip mag NIET kortsluiten: als er
  //    chips zijn maar geen ervan matcht, alsnog de trigger-tekst controleren.
  const chips = nonClientUursoortChips(trigger);
  if (chips.some((chip) => nonClientHourTypeMatches(chip, wanted))) return true;
  // 2) Trigger-tekst: een uc-select toont de gekozen waarde in het veld zelf
  //    (geen losse verwijderbare chip).
  const txt = clean(uiText(trigger) || trigger.textContent || ('value' in trigger ? trigger.value : '') ||
    (trigger.getAttribute && (trigger.getAttribute('title') || trigger.getAttribute('value'))) || '');
  if (!txt || /^(zoek naar uursoorten|selecteer uursoort|uursoort|zoek naar uursoort)$/.test(txt)) return false;
  return nonClientHourTypeMatches(txt, wanted);
}
// 'Overig'-flow: geen uursoort, maar een verplichte vrije titel "Overig - ...".
function nonClientFreeTitlePrefix(opt) { return (opt && opt.display ? opt.display : 'Overig') + ' - '; }
export function nonClientFreeTitleComplete(opt) {
  const inp = getTitleInputSafe();
  const val = inp ? inputTextValue(inp) : '';
  const trimmed = String(val || '').trim();
  if (!trimmed) return false;
  // Er moet iets staan ná "Overig -"; de prefix alleen telt niet als titel.
  const prefixRe = new RegExp('^' + (opt && opt.display ? opt.display : 'Overig').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*-\\s*', 'i');
  if (!prefixRe.test(trimmed)) return false;
  const rest = trimmed.replace(prefixRe, '');
  return !!rest.trim();
}
function ensureNonClientFreeTitlePrefix(opt) {
  const prefix = nonClientFreeTitlePrefix(opt);
  const inp = getTitleInputSafe();
  if (!inp) return;
  const prefixRe = new RegExp('^' + (opt && opt.display ? opt.display : 'Overig').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*-\\s*', 'i');
  const current = String(inputTextValue(inp) || '').trim();
  const rest = current.replace(prefixRe, '');
  setAppointmentTitleText(prefix + rest);
  setTimeout(function () {
    const i = getTitleInputSafe();
    if (i && i.focus) { try { i.focus(); } catch (e) {} }
    updateSubmitGuard();
  }, 0);
}
export function handleNonClientOption(opt) {
  setStatus('Bezig...');
  appointmentFlow.activeNonClientOption = opt;
  appointmentFlow.nonClientFreeTitleScreenActive = false;
  appointmentFlow.nonClientNoUursoortActive = false;
  appointmentFlow.nonClientBusy = true; // voorkom dat de refresh-cyclus opnieuw triggert
  titelVoorOptie(opt);
  // Optioneel ONS-label uit de beheerlijst (alleen als ingesteld).
  if (opt.etiket) voegLabelToe(opt.etiket);
  if (opt.freeTitle) {
    // 'Overig': raak de uursoort niet aan. Eerst (zonodig) de duur vragen,
    // daarna het vrije-titel-scherm dat blokkeert tot er een titel staat.
    appointmentFlow.nonClientBusy = false;
    if (!hasAppointmentEndTime()) { showNonClientDurationSelection(opt); return; }
    appointmentFlow.activeAppointmentDurationMinutes = null;
    appointmentFlow.appointmentTimeGuardTimers.forEach(function (t) { clearTimeout(t); });
    appointmentFlow.appointmentTimeGuardTimers = [];
    showNonClientFreeTitlePrompt(opt);
    return;
  }
  if (opt.fixedHalfHour) {
    // Pauze: vaste duur (instelbaar via generalSettings.pauseFixedMin, standaard
    // 30 min), geen duur vragen. Eerst eindtijd, dan na 80ms de uursoort/label-
    // stappen (die elk de eindtijd opnieuw afdwingen).
    const endOk = applyNonClientEndTime(gsNum('pauseFixedMin', 30));
    setStatus(endOk ? (opt.display + ' 30 min') : 'Eindtijd niet gezet', endOk);
    setTimeout(function () { safe(function () {
      setNonClientUursoortThenFinish(opt);
      scheduleAppointmentEndTime(30);
      [120, 350, 650].forEach(function (d) { setTimeout(function () { safe(function () { enforceAppointmentEndTime(30); }); }, d); });
    }); }, 80);
    return;
  }
  if (opt.defaultDuration > 0 && !hasAppointmentEndTime()) {
    // Standaardduur uit de beheerlijst: sla de duurvraag over en zet direct de eindtijd.
    const dd = opt.defaultDuration;
    const endOk = applyNonClientEndTime(dd);
    setStatus(endOk ? (opt.display + ' ' + dd + ' min') : 'Eindtijd niet gezet', endOk);
    setTimeout(function () { safe(function () {
      setNonClientUursoortThenFinish(opt);
      scheduleAppointmentEndTime(dd);
      [120, 350, 650].forEach(function (d) { setTimeout(function () { safe(function () { enforceAppointmentEndTime(dd); }); }, d); });
    }); }, 80);
    return;
  }
  if (!hasAppointmentEndTime()) {
    // Eindtijd leeg: eerst de duur vragen; uursoort wordt daarna gezet.
    appointmentFlow.nonClientBusy = false;
    showNonClientDurationSelection(opt);
    return;
  }
  // Eindtijd is al ingevuld: niet aanraken. Stop geplande forcering.
  appointmentFlow.activeAppointmentDurationMinutes = null;
  appointmentFlow.appointmentTimeGuardTimers.forEach(function (t) { clearTimeout(t); });
  appointmentFlow.appointmentTimeGuardTimers = [];
  setNonClientUursoortThenFinish(opt);
}
// Zet de uursoort EENMALIG (met nette retries binnen selectNonClientUursoort)
// en ga daarna door naar afronden. Skip als de uursoort al correct is ingesteld
// (anders reset de dropdown-interactie de eindtijd).
function setNonClientUursoortThenFinish(opt) {
  if (nonClientUursoortSet()) {
    appointmentFlow.nonClientBusy = false;
    appointmentFlow.nonClientNoUursoortActive = false;
    finishNonClientOption(opt);
    return;
  }
  setStatus('Uursoort instellen...');
  setAppointmentUursoortByName(opt.uursoort, function (uursoortOk) {
    appointmentFlow.nonClientBusy = false;
    // De uursoort-dropdown zit in hetzelfde Afspraakdetails-paneel als de eindtijd;
    // de selectie kan de eindtijd hebben gewist -> opnieuw afdwingen (no-op als
    // er geen actieve duur is, dus een al ingevulde eindtijd blijft staan).
    scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
    if (!uursoortOk && !nonClientUursoortSet()) {
      // Geen (passende) uursoort beschikbaar: aparte foutpagina i.p.v. de
      // gewone opslaanpagina met "Let op"-melding.
      showNonClientNoUursoort(opt);
      return;
    }
    appointmentFlow.nonClientNoUursoortActive = false;
    finishNonClientOption(opt);
  });
}
function showNonClientNoUursoort(opt) {
  const body = $body(); if (!body) return;
  clearScreenMark();
  appointmentFlow.nonClientBusy = false;
  appointmentFlow.nonClientNoUursoortActive = true;
  renderScreen(body, 'messageScreen', {
    title: 'Geen uursoorten gevonden!',
    titleStyle: { color: '#b3261e' },
    body: 'Controleer zelf of er uursoorten in de lijst staan en neem contact op met EPD.',
    actionLabel: 'Afsluiten',
    tokens: ONSAH_TOKENS,
    onBack: function () {
      helperPanel.suppressAutoUntil = Date.now() + 1200;
      safe(function () {
        appointmentFlow.nonClientNoUursoortActive = false;
        showAppointmentNeedsPrereqs();
      });
    },
    onAction: function () { safe(closeOnsModal); },
  });
  setStatus('Geen uursoorten gevonden', false);
}
export function showNonClientDurationSelection(opt) {
  const body = $body(); if (!body) return;
  markScreen('nonClientDurationSelection', { opt: opt });
  const durStep = opt.durationStep > 0 ? opt.durationStep : gsNum('durationStepMin', 15);
  const durMax = opt.maxDuration > 0 ? opt.maxDuration : gsNum('appointmentMaxMin', 480);
  const durValues = []; for (let m = durStep; m <= durMax; m += durStep) durValues.push(m);
  renderScreen(body, 'duration', {
    title: opt.display + ' duur:',
    tokens: ONSAH_TOKENS,
    onBack: function () { helperPanel.suppressAutoUntil = Date.now() + 1200; safe(showAppointmentNeedsPrereqs); },
    pickerNode: mkDurationPicker(durValues, function (m) { return safe(function () {
    // Zelfde opzet als de cliëntflow: eerst eindtijd zetten + plannen, dan
    // na 80ms de uursoort/label-stappen (die elk de eindtijd opnieuw afdwingen).
    const endOk = applyNonClientEndTime(m);
    titelVoorOptie(opt);
    setStatus(endOk ? (opt.display + ' ' + registrationDurationLabel(m)) : 'Eindtijd niet gezet', endOk);
    setTimeout(function () { safe(function () {
      if (opt.freeTitle) showNonClientFreeTitlePrompt(opt);
      else setNonClientUursoortThenFinish(opt);
      scheduleAppointmentEndTime(m);
      [100, 300].forEach(function (d) { setTimeout(function () { safe(function () { enforceAppointmentEndTime(m); }); }, d); });
    }); }, 50);
    }); }, opt.pickerStyle, undefined, durationLabelStyle('duur')),
  });
  setStatus('Kies de duur');
}
// 'Overig': geen uursoort. Eis dat de gebruiker de titel "Overig - ..." aanvult;
// blokkeer opslaan tot dat gebeurd is (zoals het rapportageveld bij registraties).
export function showNonClientFreeTitlePrompt(opt) {
  const body = $body(); if (!body) return;
  appointmentFlow.nonClientBusy = false;
  appointmentFlow.nonClientFreeTitleScreenActive = true;
  markScreen('nonClientFreeTitlePrompt', { opt: opt });
  const prefix = nonClientFreeTitlePrefix(opt);
  // Label JG Overig zetten en de titel voorzien van de prefix (alleen als de
  // gebruiker nog niets eigens heeft ingevuld).
  setLabelsExclusive(nonClientLabels(opt), function () {
    const inp = getTitleInputSafe();
    const cur = inp ? clean(inputTextValue(inp)) : '';
    if (!cur || cur === clean(opt.display) || cur === clean(prefix)) setAppointmentTitleText(prefix);
    scheduleAppointmentEndTime(appointmentFlow.activeAppointmentDurationMinutes);
  });
  // Geen resetBody: dit scherm wordt door refreshAppointmentPrereqScreen
  // herhaald getekend terwijl de gebruiker de titel typt.
  renderScreen(body, 'messageScreen', {
    title: 'Vul de titel aan na "' + prefix + '".',
    titleStyle: { fontSize: 13, margin: '4px 0 2px', color: '#333' },
    body: 'Zodra je een titel hebt ingevuld, kun je opslaan.',
    bodyStyle: { fontSize: 12, color: '#666', lineHeight: 1.35, margin: '0 0 8px' },
    actionLabel: 'Zet titel',
    actionAccent: '#1a7f37',
    actionAccentWash: '#eaf6ee',
    actionChevron: false,
    tokens: ONSAH_TOKENS,
    onBack: function () {
      helperPanel.suppressAutoUntil = Date.now() + 1200;
      safe(function () { appointmentFlow.nonClientFreeTitleScreenActive = false; showAppointmentNeedsPrereqs(); });
    },
    onAction: function () { safe(function () { ensureNonClientFreeTitlePrefix(opt); }); },
  });
  updateSubmitGuard();
  // Geen Opslaan-knop hier: zodra er inhoud na de prefix staat, leidt
  // refreshAppointmentPrereqScreen automatisch door naar de generieke opslaanpagina.
  if (nonClientFreeTitleComplete(opt)) { appointmentFlow.nonClientFreeTitleScreenActive = false; showAppointmentReadyToSave(); return; }
  setStatus('Vul de titel aan', false);
}
