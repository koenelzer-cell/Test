// Registratieformulier: datum, tijden, direct/indirect-verdeling en reistijd.

import { addMinutesText, addOneHourText, minutesToDurationText, timeTextToMinutes } from '../../core/datetime.js';
import { overrideEl } from '../../ons/selector-overrides.js';
import { clean, deepQueryAll, isOwnPopup, rect, visible } from '../../ons/dom.js';
import { clickOption, setInputTextComposed } from '../../ons/form-controls.js';
import { registrationFlow } from '../../state.js';
import { safe } from '../../screen/status.js';

export function clickRegistrationTravelTimeButton() {
  const btn = overrideEl('regTravelAdd') || document.querySelector('#js_add_travel_time') ||
    deepQueryAll('button').find((el) => visible(el) && /reistijd toevoegen/i.test(el.textContent || ''));
  if (!btn || registrationFlow.registrationTravelClicked) return false;
  clickOption(btn);
  registrationFlow.registrationTravelClicked = true;
  return true;
}
function registrationInputValue(inp) {
  return String((inp && ('value' in inp ? inp.value : '')) || (inp && inp.getAttribute && inp.getAttribute('value')) || (inp && inp.textContent) || '').trim();
}
function registrationInputMeta(inp) {
  return clean(`${inp.id || ''} ${inp.name || ''} ${inp.className || ''} ${inp.type || ''} ${inp.getAttribute('placeholder') || ''} ${inp.getAttribute('aria-label') || ''}`);
}
function registrationTimeLikeInput(inp) {
  if (!inp || !visible(inp) || isOwnPopup(inp)) return false;
  const meta = registrationInputMeta(inp);
  if (/direct|indirect|travel|absence|hour_type|client_information_\d+__hour_type_id/.test(meta)) return false;
  const value = registrationInputValue(inp);
  return /time|tijd|uu:mm|__:__|js-time/.test(meta) || /^\d{1,2}:\d{2}$/.test(value);
}
function registrationDateLikeInput(inp) {
  if (!inp || !visible(inp) || isOwnPopup(inp)) return false;
  const meta = registrationInputMeta(inp);
  if (/time|tijd|direct|indirect|travel|hour_type/.test(meta)) return false;
  const value = registrationInputValue(inp);
  return /date|datum|dd-mm-jjjj/.test(meta) || /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(value);
}
function registrationInputsNearLabel(labelRe, predicate) {
  const inputs = deepQueryAll('input').filter(predicate);
  const labels = deepQueryAll('label,span,div,p,td,th')
    .filter((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const text = clean(el.textContent || '');
      return text && text.length <= 60 && labelRe.test(text);
    });
  let best = null, bestScore = Infinity;
  for (const label of labels) {
    const lr = rect(label);
    for (const inp of inputs) {
      const ir = rect(inp);
      const sameRow = Math.abs((ir.top + ir.height / 2) - (lr.top + lr.height / 2)) <= 28 && ir.left >= lr.left - 10;
      const below = ir.top >= lr.top - 8 && ir.top <= lr.bottom + 70 && Math.abs(ir.left - lr.left) <= 240;
      if (!sameRow && !below) continue;
      const score = Math.abs(ir.top - lr.top) * 3 + Math.max(0, ir.left - lr.right) + (below ? 80 : 0);
      if (score < bestScore) { best = inp; bestScore = score; }
    }
  }
  return best;
}
function registrationInputsInVisualOrder(predicate) {
  return deepQueryAll('input').filter(predicate).sort((a, b) => {
    const ar = rect(a), br = rect(b);
    return Math.abs(ar.top - br.top) > 8 ? ar.top - br.top : ar.left - br.left;
  });
}
export function registrationTimeInput(id) {
  if (/start/i.test(id)) { const ov = overrideEl('regStart'); if (ov) return ov; }
  else if (/end/i.test(id)) { const ov = overrideEl('regEnd'); if (ov) return ov; }
  const exact = document.getElementById(id) || deepQueryAll('input.time.js-time').find((inp) => inp.id === id);
  if (exact && (visible(exact) || registrationInputValue(exact))) return exact;
  if (/start/i.test(id)) return registrationInputsNearLabel(/^begintijd\b/, registrationTimeLikeInput) || registrationInputsInVisualOrder(registrationTimeLikeInput)[0] || null;
  if (/end/i.test(id)) return registrationInputsNearLabel(/^eindtijd\b/, registrationTimeLikeInput) || registrationInputsInVisualOrder(registrationTimeLikeInput)[1] || null;
  return null;
}
export function registrationDateInput() {
  const ov = overrideEl('regDate'); if (ov) return ov;
  const exact = document.getElementById('declaration_date');
  if (exact && (visible(exact) || registrationInputValue(exact))) return exact;
  return (
    deepQueryAll('input').find((inp) => registrationDateLikeInput(inp) && /date|datum|dd-mm-jjjj/.test(registrationInputMeta(inp))) ||
    registrationInputsNearLabel(/^datum\b/, registrationDateLikeInput) ||
    registrationInputsInVisualOrder(registrationDateLikeInput)[0] ||
    null
  );
}
export function hasRegistrationStartTime() {
  const start = registrationTimeInput('declaration_start_time_display');
  return !!(start && timeTextToMinutes(registrationLiveTimeValue(start)) !== null);
}
export function hasRegistrationDate() {
  const date = registrationDateInput();
  if (date && String(date.value || date.getAttribute('value') || date.textContent || '').trim()) return true;
  return deepQueryAll('input,span,div').some((el) => {
    if (!visible(el) || isOwnPopup(el)) return false;
    const meta = clean(`${el.id || ''} ${el.getAttribute && (el.getAttribute('name') || '')} ${el.getAttribute && (el.getAttribute('aria-label') || '')}`);
    const text = String(('value' in el ? el.value : '') || el.getAttribute && el.getAttribute('value') || el.textContent || '').trim();
    if (!text || !/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(text)) return false;
    return /date|datum|declaration/.test(meta) || rect(el).width < 260;
  });
}
export function setRegistrationEndTimePlusOneMinute() {
  const start = registrationTimeInput('declaration_start_time_display');
  const end = registrationTimeInput('declaration_end_time_display');
  if (!start || !end) return false;
  const startText = registrationLiveTimeValue(start);
  if (timeTextToMinutes(startText) === null) return false;
  const next = addMinutesText(startText, 1);
  if (!next) return false;
  setInputTextComposed(end, next);
  return true;
}
export function setRegistrationEndTimePlusOneHour() {
  const start = registrationTimeInput('declaration_start_time_display');
  const end = registrationTimeInput('declaration_end_time_display');
  if (!start || !end) return false;
  const startText = registrationLiveTimeValue(start);
  if (timeTextToMinutes(startText) === null) return false;
  const next = addOneHourText(startText);
  if (!next) return false;
  setInputTextComposed(end, next);
  return true;
}
export function setRegistrationEndTimePlusMinutes(minutes) {
  const start = registrationTimeInput('declaration_start_time_display');
  const end = registrationTimeInput('declaration_end_time_display');
  if (!start || !end) return false;
  const startText = registrationLiveTimeValue(start);
  if (timeTextToMinutes(startText) === null) return false;
  const next = addMinutesText(startText, minutes);
  if (!next) return false;
  setInputTextComposed(end, next);
  return true;
}
export function registrationLiveTimeValue(inp) {
  // ONS laat een verouderd value-ATTRIBUUT staan terwijl de echte (lege) waarde
  // in de .value-PROPERTY zit. Voor "is er een tijd ingevuld" tellen we alleen
  // de live property, niet het attribuut.
  if (!inp) return '';
  return ('value' in inp && typeof inp.value === 'string') ? inp.value.trim() : '';
}
export function registrationDurationMinutes() {
  const start = registrationTimeInput('declaration_start_time_display');
  const end = registrationTimeInput('declaration_end_time_display');
  const s = timeTextToMinutes(registrationLiveTimeValue(start));
  const e = timeTextToMinutes(registrationLiveTimeValue(end));
  if (s === null || e === null) return null;
  return e >= s ? e - s : (e + 24 * 60) - s;
}
export function registrationDirectTimeInput() {
  return overrideEl('regDirect') || document.getElementById('declaration_direct_time') ||
    deepQueryAll('input').find((inp) => inp.id === 'declaration_direct_time' || /(?:^|[\[_])direct_time(?:\]|$)/.test(inp.name || '')) || null;
}
export function registrationIndirectTimeInput() {
  return overrideEl('regIndirect') || document.getElementById('declaration_indirect_time') ||
    deepQueryAll('input').find((inp) => inp.id === 'declaration_indirect_time' || /indirect_time/.test(inp.name || ''));
}
export function setRegistrationTimeSplit({ directMinutes = null, indirectMinutes = null }) {
  let ok = true;
  const direct = registrationDirectTimeInput();
  const indirect = registrationIndirectTimeInput();
  if (directMinutes !== null) {
    if (direct) {
      const text = minutesToDurationText(directMinutes);
      if (String(direct.value || direct.getAttribute('value') || '') !== text) setInputTextComposed(direct, text);
    }
    else ok = false;
  }
  if (indirectMinutes !== null) {
    if (indirect) {
      const text = minutesToDurationText(indirectMinutes);
      if (String(indirect.value || indirect.getAttribute('value') || '') !== text) setInputTextComposed(indirect, text);
    }
    else ok = false;
  }
  return ok;
}
export function setRegistrationIndirectFullDuration() {
  const minutes = registrationDurationMinutes();
  if (minutes === null) return false;
  return setRegistrationTimeSplit({ directMinutes: 0, indirectMinutes: minutes });
}
export function setRegistrationDirectFullDuration() {
  const minutes = registrationDurationMinutes();
  if (minutes === null) return false;
  return setRegistrationTimeSplit({ directMinutes: minutes, indirectMinutes: 0 });
}
// Percentage-verdeling: bv. 75% indirect -> 25% direct, op basis van de duur.
export function setRegistrationStartSplit(choice) {
  if (!choice || !choice.startSplit) return false;
  const minutes = registrationDurationMinutes();
  if (minutes === null) return false;
  const dPct = Math.max(0, Math.min(100, choice.startSplit.directPct || 0));
  const directMin = Math.round(minutes * dPct / 100);
  const indirectMin = minutes - directMin;
  return setRegistrationTimeSplit({ directMinutes: directMin, indirectMinutes: indirectMin });
}
export function applyRegistrationSplitForChoice(choice) {
  if (!choice) return false;
  if (choice.startSplit) return setRegistrationStartSplit(choice);
  if (choice.indirectFullDuration) return setRegistrationIndirectFullDuration();
  if (choice.directFullDuration) return setRegistrationDirectFullDuration();
  return true;
}
export function cancelReapplyRegistrationSplit() {
  registrationFlow.reapplyRegistrationSplitTimers.forEach(clearTimeout);
  registrationFlow.reapplyRegistrationSplitTimers = [];
}
// ONS rekent na een wijziging soms nog na en zet dan een tijd terug: de
// verdeling daarom kort na elkaar drie keer opnieuw zetten.
export function scheduleReapplyRegistrationSplit() {
  cancelReapplyRegistrationSplit();
  if (!registrationFlow.activeRegistrationChoice) return;
  const reapply = () => safe(() => {
    if (registrationFlow.activeRegistrationPortionMinutes !== null && registrationPortionApplies(registrationFlow.activeRegistrationChoice)) {
      applyRegistrationPortion(registrationFlow.activeRegistrationChoice, registrationFlow.activeRegistrationPortionMinutes);
    } else {
      applyRegistrationSplitForChoice(registrationFlow.activeRegistrationChoice);
    }
  });
  registrationFlow.reapplyRegistrationSplitTimers = [80, 260, 700].map((ms) => setTimeout(reapply, ms));
}
export function registrationTravelInput(kind) {
  const there = kind === 'heen';
  const ov = overrideEl(there ? 'regTravelBefore' : 'regTravelAfter'); if (ov) return ov;
  const directId = document.getElementById(there ? 'declaration_travel_time_before' : 'declaration_travel_time_after');
  if (directId && (visible(directId) || registrationInputValue(directId))) return directId;
  const idNeedles = there
    ? /(travel.*(before|to|heen|there|out|naar)|reistijd.*(heen|naar))/
    : /(travel.*(after|back|return|from|terug)|reistijd.*terug)/;
  const exact = deepQueryAll('input').find((inp) => {
    if (!visible(inp) || isOwnPopup(inp)) return false;
    const meta = registrationInputMeta(inp);
    return idNeedles.test(meta);
  });
  if (exact) return exact;
  const labelRe = there ? /^(reistijd\s*)?(heen|naar|heenreis)\b|^reistijd heen\b/ : /^(reistijd\s*)?(terug|retour|terugreis)\b|^reistijd terug\b/;
  const byLabel = registrationInputsNearLabel(labelRe, (inp) => {
    if (!inp || !visible(inp) || isOwnPopup(inp)) return false;
    const meta = registrationInputMeta(inp);
    if (/direct|indirect|hour_type|client|date|datum/.test(meta)) return false;
    return /travel|reistijd|time|tijd|number|text|__:__|uu:mm/.test(meta) || registrationInputValue(inp) !== '';
  });
  if (byLabel) return byLabel;
  const travelInputs = deepQueryAll('input')
    .filter((inp) => visible(inp) && !isOwnPopup(inp) && /travel|reistijd/.test(registrationInputMeta(inp)))
    .sort((a, b) => {
      const ar = rect(a), br = rect(b);
      return Math.abs(ar.top - br.top) > 8 ? ar.top - br.top : ar.left - br.left;
    });
  return travelInputs[there ? 0 : 1] || null;
}
function formatRegistrationTravelMinutes(minutes, input) {
  if (Number.isInteger(minutes)) return String(minutes);
  return input && input.type === 'number' ? String(minutes) : String(minutes).replace('.', ',');
}
export function setRegistrationTravelTotalMinutes(totalMinutes) {
  clickRegistrationTravelTimeButton();
  const there = registrationTravelInput('heen');
  const back = registrationTravelInput('terug');
  if (!there || !back) return false;
  const thereMinutes = Math.ceil(totalMinutes / 2);
  const backMinutes = Math.floor(totalMinutes / 2);
  setInputTextComposed(there, formatRegistrationTravelMinutes(thereMinutes, there));
  setInputTextComposed(back, formatRegistrationTravelMinutes(backMinutes, back));
  return true;
}
export function clearRegistrationTravelTimes() {
  const fields = [
    overrideEl('regTravelBefore') || document.getElementById('declaration_travel_time_before') || registrationTravelInput('heen'),
    overrideEl('regTravelAfter') || document.getElementById('declaration_travel_time_after') || registrationTravelInput('terug'),
  ].filter(Boolean);
  const unique = Array.from(new Set(fields));
  if (!unique.length) return true;
  for (const field of unique) setInputTextComposed(field, '0');
  return true;
}
export function scheduleClearRegistrationTravelTimes() {
  clearRegistrationTravelTimes();
  setTimeout(() => safe(clearRegistrationTravelTimes), 120);
  setTimeout(() => safe(clearRegistrationTravelTimes), 420);
}
// Zet de tegen-tijd (indirect bij directFull, direct bij indirectFull) op
// `portionMinutes` en trekt dat van de hoofdtijd af. Totaal = registratieduur.
export function applyRegistrationPortion(choice, portionMinutes) {
  const total = registrationDurationMinutes();
  if (total === null) return false;
  const p = Math.max(0, Math.min(portionMinutes, total));
  if (choice.askIndirectPortion) {
    // hoofdtijd = direct; tegen-tijd = indirect
    return setRegistrationTimeSplit({ directMinutes: total - p, indirectMinutes: p });
  }
  if (choice.askDirectPortion) {
    // hoofdtijd = indirect; tegen-tijd = direct
    return setRegistrationTimeSplit({ directMinutes: p, indirectMinutes: total - p });
  }
  return true;
}
export function registrationPortionApplies(choice) {
  return !!(choice && (choice.askIndirectPortion || choice.askDirectPortion));
}
export function _regToMin(raw) { const s = (raw == null ? '' : String(raw)).trim(); if (!s) return null; const hm = s.match(/^(\d{1,2}):(\d{2})$/); if (hm) return +hm[1] * 60 + +hm[2]; if (/^\d{1,4}$/.test(s)) return +s; return null; }
