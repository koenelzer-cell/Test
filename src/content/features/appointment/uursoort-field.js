// Afspraakformulier: het uursoort-veld (per cliënt) vinden, vullen en wissen.

import { clean, deepQueryAll, isOwnPopup, rect, visible } from '../../ons/dom.js';
import { clickElementCenter, clickOption, openSelectCombobox, optionSearchRoots, optionText, searchInputForTrigger, setInputText, uiText } from '../../ons/form-controls.js';
import { optionCandidates } from '../../ons/uursoort-options.js';
import { entryUursoortIsSet, findClientEntries, getUursoortTrigger } from '../../ons/appointment-form.js';
import { clearSelectField, clickEmptyModalSpot, openTypePick } from '../../ons/interaction.js';
import { clickExactDropdownOption } from './labels.js';
import { computeAppointmentUursoortState } from './clients.js';
import { appointmentFlow } from '../../state.js';
import { findNonClientUursoortTrigger } from './non-client.js';
import { eerstViaFormulier, wisUursoortViaFormulier, zetUursoortViaFormulier } from '../../ons/form-model.js';
import { nietClientUursoortMetId, uursoortMetId } from './uursoort-source.js';

// Zet de uursoort op het afspraak-detailniveau (combobox "Zoek naar uursoorten")
// door de exacte naam (incl. sterretje) te zoeken en aan te klikken.
export function setAppointmentUursoortByName(name, onDone) {
  const done = typeof onDone === 'function' ? onDone : function () {};
  // De afspraak-uursoort-dropdown werkt hetzelfde als de labels; gebruik
  // daarom hetzelfde pad (selectNonClientUursoort -> selectLabel-principe).
  selectNonClientUursoort(name, done);
}
// Eerst rechtstreeks in het formulier (geen dropdown): het uursoortveld op
// afspraakniveau, dat er alleen is zolang er geen cliënt aan de afspraak hangt.
function selectNonClientUursoort(text, onResult) {
  const trigger = findNonClientUursoortTrigger();
  eerstViaFormulier(
    () => (trigger ? nietClientUursoortMetId(text).then((optie) => (optie ? zetUursoortViaFormulier(trigger, optie.id, optie.name) : false)) : false),
    () => new Promise((klaar) => selectNonClientUursoortViaDropdown(text, klaar))
  ).then((ok) => onResult(!!ok));
}
function selectNonClientUursoortViaDropdown(text, onResult, attempt = 0) {
  // Zelfde patroon als selectLabel: clickElementCenter opent de dropdown,
  // zoekterm typen (zonder * en #), dan exacte optie klikken.
  const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
  if (!trigger) { onResult(false); return; }
  clickElementCenter(trigger);
  setTimeout(() => {
    const searchText = String(text || '').replace(/[*#]+$/, '').trim();
    const input = searchInputForTrigger(trigger);
    if (input) { input.focus(); setInputText(input, searchText); }
    const loose = searchText;
    setTimeout(() => {
      const ok = clickExactDropdownOption(trigger, [text, loose].filter(Boolean));
      if (!ok && attempt < 5) {
        clickEmptyModalSpot();
        setTimeout(() => selectNonClientUursoortViaDropdown(text, onResult, attempt + 1), 120);
        return;
      }
      setTimeout(() => { clickEmptyModalSpot(); onResult(!!ok); }, 50);
    }, input ? 220 : 130);
  }, 90);
}
export function hasUursoortSelected() {
  const hasTriggerValue = (trigger) => {
    if (!trigger) return false;
    const txt = clean(uiText(trigger) || trigger.textContent || trigger.value || trigger.getAttribute && (trigger.getAttribute('value') || trigger.getAttribute('title') || ''));
    return !!txt && !/zoek naar uursoorten|selecteer uursoort|uursoort|geen resultaten|voer minstens|toont /.test(txt);
  };
  const entries = findClientEntries();
  // Cliënt-pad: gereed = centrale toestand READY_TO_SAVE (alle cliënten gezet).
  if (entries.length) return computeAppointmentUursoortState() === 'READY_TO_SAVE';
  const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
  if (hasTriggerValue(trigger)) return true;
  const clientLabels = deepQueryAll('div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'client');
  for (const label of clientLabels) {
    const lr = rect(label);
    for (const el of deepQueryAll('div,span,p')) {
      if (!visible(el) || isOwnPopup(el) || el === label) continue;
      const txt = clean(el.textContent || '');
      if (!txt || txt === 'client' || txt.includes('clienten') || txt.includes('medewerker') || txt.includes('niet beschikbaar')) continue;
      if (txt.includes('uursoort') || txt.includes('toeslag') || txt.includes('verwijder uit selectie')) continue;
      const r = rect(el);
      if (r.top < lr.bottom - 4 || r.top > lr.bottom + 55) continue;
      if (Math.abs(r.left - lr.left) > 100) continue;
      if (txt.includes('ggz') || txt.includes('#')) return true;
    }
  }
  return false;
}
export function shouldRequireUursoortForSubmit() {
  return !!appointmentFlow.activeNonClientOption || findClientEntries().length > 0;
}
// Vind de daadwerkelijk geselecteerde optie(s) in de open dropdown, ONGEACHT
// of de tekst als 'uursoort' herkend wordt (niet via optionCandidates(): die
// filtert met looksLikeUursoortOption, en een uursoort die daar niet door komt
// zou dan nooit gedeselecteerd worden).
function selectedUursoortOptionEls(openedBy, trigger) {
  const out = [];
  const seen = new Set();
  const consider = (o) => {
    if (!o || seen.has(o) || !visible(o) || isOwnPopup(o)) return;
    const isSel = /true/i.test(o.getAttribute('aria-selected') || '') || /(^|\s)(selected|active|checked)(\s|$)/i.test(o.className || '');
    if (!isSel) return;
    const t = clean(optionText(o));
    if (!t || /toont |zoekterm|zoek naar|geen resultaten/.test(t)) return;
    seen.add(o); out.push(o);
  };
  for (const root of optionSearchRoots(openedBy).concat(optionSearchRoots(trigger))) {
    for (const o of deepQueryAll('[role="option"], li[aria-selected], li.selected', root)) consider(o);
  }
  // Laatste redmiddel: virtualisatiecontainers vallen soms buiten
  // optionSearchRoots. Scan dan document-breed naar aria-selected opties
  // vlakbij de trigger.
  if (!out.length && trigger) {
    const tr = rect(trigger);
    for (const o of deepQueryAll('[role="option"][aria-selected="true"], li[aria-selected="true"]')) {
      const r = rect(o);
      if (r.top < tr.top - 40 || r.top > tr.bottom + 600) continue;
      consider(o);
    }
  }
  return out;
}
function clearUursoortSearchInput(openedBy, trigger) {
  for (const root of optionSearchRoots(openedBy).concat(optionSearchRoots(trigger))) {
    const inp = deepQueryAll('input,textarea', root).find((i) => visible(i) && !isOwnPopup(i));
    if (inp) { try { inp.focus(); } catch (e) {} setInputText(inp, ''); return true; }
  }
  return false;
}
export function clearUursoort(onDone, triggerArg = null) {
  const trigger = triggerArg || getUursoortTrigger();
  if (!trigger) { if (onDone) onDone(); return; }
  eerstViaFormulier(
    () => wisUursoortViaFormulier(trigger),
    () => new Promise((klaar) => clearUursoortViaScherm(klaar, trigger))
  ).then(() => { if (onDone) onDone(); });
}
// Via het scherm: de dropdown openen en de gekozen optie deselecteren.
export function clearUursoortViaScherm(onDone, trigger) {
  const currentText = clean(uiText(trigger));
  const openedBy = openSelectCombobox(trigger) || trigger;
  setTimeout(() => {
    let clicked = false;
    // 1) Primair: klik de geselecteerde optie (aria-selected) om te
    //    deselecteren. Precies één klik -> het is een toggle.
    const selectedEls = selectedUursoortOptionEls(openedBy, trigger);
    if (selectedEls.length) {
      clickOption(selectedEls[0]);
      clicked = true;
    }
    // 2) Fallback: tekst-match tegen de huidige veldwaarde.
    if (!clicked) {
      for (const root of optionSearchRoots(openedBy).concat(optionSearchRoots(trigger))) {
        const options = optionCandidates(root);
        const sameText = options.find((o) => currentText && clean(optionText(o)) && currentText.includes(clean(optionText(o))));
        if (sameText) { clickOption(sameText); clicked = true; break; }
      }
    }
    if (!clicked) { clearSelectField(trigger, 5); }
    // 3) Zoekbalk in de dropdown leegmaken (na deselecteren), dan sluiten.
    setTimeout(() => {
      clearUursoortSearchInput(openedBy, trigger);
      setTimeout(() => { clickEmptyModalSpot(); if (onDone) onDone(); }, 80);
    }, 90);
  }, 120);
}
// context (optioneel): de cliënt uit de uursoortwachtrij, voor het juiste id.
export function chooseUursoort(text, onResult, triggerArg = null, context = null) {
  const trigger = triggerArg || getUursoortTrigger();
  eerstViaFormulier(
    () => (trigger ? uursoortMetId(text, context, trigger).then((optie) => (optie ? zetUursoortViaFormulier(trigger, optie.id, optie.name) : false)) : false),
    () => new Promise((klaar) => openTypePick(() => triggerArg || getUursoortTrigger(), text, (ok) => {
      if (ok) setTimeout(clickEmptyModalSpot, 90);
      klaar(ok);
    }))
  ).then((ok) => onResult(!!ok));
}
export function anyUursoortPresent() {
  const entries = findClientEntries();
  if (entries.length) return entries.some(entryUursoortIsSet);
  const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
  if (!trigger) return false;
  const txt = clean(uiText(trigger) || trigger.textContent || ('value' in trigger ? trigger.value : '') || '');
  return !!txt && !/zoek naar uursoorten|selecteer uursoort|uursoort|geen resultaten|voer minstens|toont /.test(txt);
}
