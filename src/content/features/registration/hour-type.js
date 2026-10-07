// Uursoort op het registratieformulier (select2/native select).

import { REGISTRATION_CHOICES } from '../../config/app-config.js';
import { timeTextToMinutes } from '../../core/datetime.js';
import { clean, isOwnPopup, pollFor, rect, visible } from '../../ons/dom.js';
import {
  clickElementCenter,
  clickOption,
  hasNestedOptionNode,
  setInputText,
} from '../../ons/form-controls.js';
import { splitUursoortCategoryText } from '../../ons/uursoort-options.js';
import { firstNameFromName } from '../../ons/appointment-form.js';
import { clickEmptyModalSpot } from '../../ons/interaction.js';
import { helperPanel, registrationFlow } from '../../state.js';
import { $body, safe, setStatus } from '../../screen/status.js';
import { ONSAH_TOKENS } from '../../ui/theme.js';
import { markScreen } from '../../screen/screen-state.js';
import { renderScreen } from '../../ui/react-bridge.js';
import { registrationLiveTimeValue, registrationTimeInput } from './fields.js';
import {
  applyRegistrationChoice,
  showRegistrationChoices,
  showRegistrationReportPrompt,
} from './screens.js';
import { hasRegistrationPrereqs } from './prereqs.js';
import {
  registrationPrefixRegex,
  registrationReportNeedsContent,
  registrationTextHasNoShowCue,
  updateRegistrationSubmitGuard,
} from './report.js';
import { showRegistrationNoShowPrompt } from './prompts.js';
import { deepQueryAll } from '../../ons/dom.js';

function selectHourTypeInNativeSelects(text) {
  const selects = deepQueryAll('select')
    .filter((sel) => /hour_type_id/.test(sel.id || sel.name || '') && (sel.options || []).length);
  if (!selects.length) return false;
  let okCount = 0;
  const wanted = clean(text);
  for (const sel of selects) {
    const option = Array.from(sel.options || []).find((opt) => clean(opt.textContent || opt.label || '') === wanted) ||
      Array.from(sel.options || []).find((opt) => clean(opt.textContent || opt.label || '').includes(wanted));
    if (!option) continue;
    sel.value = option.value;
    option.selected = true;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    try { if (window.jQuery) window.jQuery(sel).trigger('change'); } catch (e) {}
    okCount++;
  }
  return okCount === selects.length;
}
export function visibleSelect2HourTypeContainers() {
  return deepQueryAll('[id^="select2-"][id$="hour_type_id-container"], .select2-selection__rendered')
    .filter((el) => visible(el) && !isOwnPopup(el) && /hour_type_id/.test(el.id || ''));
}
function registrationHourTypeSelectedInContainer(container) {
  if (!container) return false;
  const text = clean(container.textContent || container.getAttribute('title') || '');
  return !!text && !/zoek naar uursoorten|selecteer uursoort|uursoort/.test(text);
}
function registrationHourTypeTextInContainer(container) {
  if (!registrationHourTypeSelectedInContainer(container)) return '';
  return (container.textContent || container.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
}
function registrationHourTypeLooksNoShow(text) {
  return /\bno\s*show\b|\bnoshow\b/i.test(text || '');
}
export function registrationHasNoShowHourTypeSelected() {
  if (visibleSelect2HourTypeContainers().some((container) => registrationHourTypeLooksNoShow(registrationHourTypeTextInContainer(container)))) return true;
  return deepQueryAll('select')
    .filter((sel) => /hour_type_id/.test(sel.id || sel.name || '') && (sel.options || []).length)
    .some((sel) => {
      const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      return registrationHourTypeLooksNoShow((opt && (opt.textContent || opt.label)) || sel.value || '');
    });
}
function registrationHourTypeSelectForContainer(container) {
  const id = container && container.id && container.id.replace(/^select2-/, '').replace(/-container$/, '');
  return id ? document.getElementById(id) : null;
}
function registrationClientNameForHourType(container, index) {
  const select = registrationHourTypeSelectForContainer(container);
  // Betrouwbaarste route (bevestigd uit REG-B): de cliënt staat in een
  // div.client_form met data-invitee-name (en data-invitee-id). Geen geometrie
  // meer nodig - dit was de bron van verkeerd-gekoppelde/gescrapte namen.
  const clientForm = (select && select.closest && select.closest('.client_form[data-invitee-name]')) ||
    (container && container.closest && container.closest('.client_form[data-invitee-name]'));
  if (clientForm) {
    const nm = (clientForm.getAttribute('data-invitee-name') || '').replace(/\s+/g, ' ').trim();
    if (nm) return { name: nm, firstName: firstNameFromName(nm) || `client ${index + 1}` };
  }
  const roots = [select && select.closest('tr,.client_information,.nested-fields,[class*="client" i]')].filter(Boolean);
  const banned = /^(uursoort|rapportage|geboren op|zichtbaar voor|zoek naar uursoorten|selecteer uursoort|onlangs gebruikt|geadviseerd|toegestaan)$/;
  for (const root of roots) {
    const cr = rect(container);
    const names = deepQueryAll('strong,b,span,div,label', root)
      .filter((el) => {
        if (!visible(el) || isOwnPopup(el)) return false;
        if (el.closest && el.closest('.select2-container,.select2-dropdown,.select2-results')) return false;
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const c = clean(txt);
        if (!txt || txt.length > 70 || banned.test(c)) return false;
        if (/uursoort|rapportage|geboren op|zoek naar|ggz|hbo|mbo|factuur|declarabel|speciaal|ambulant|behandeling|diagnostiek|no show|consult/.test(c)) return false;
        if (!/\s/.test(txt)) return false;
        const r = rect(el);
        return r.top <= cr.top + 8 && r.bottom >= cr.top - 220 && r.left <= cr.left + 60;
      })
      .sort((a, b) => rect(b).bottom - rect(a).bottom);
    if (names.length) {
      const txt = names[0].textContent.replace(/\s+/g, ' ').trim();
      return { name: txt, firstName: firstNameFromName(txt) || `client ${index + 1}` };
    }
  }
  const cr = rect(container);
  const fallback = deepQueryAll('strong,b,span,div,label')
    .filter((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      if (el.closest && el.closest('.select2-container,.select2-dropdown,.select2-results')) return false;
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const c = clean(txt);
      if (!txt || txt.length > 70 || banned.test(c) || !/\s/.test(txt)) return false;
      if (/uursoort|rapportage|geboren op|zoek naar|ggz|hbo|mbo|factuur|declarabel|speciaal|ambulant|behandeling|diagnostiek|no show|consult/.test(c)) return false;
      const r = rect(el);
      return r.top <= cr.top + 8 && r.bottom >= cr.top - 180 && r.left < cr.left - 10;
    })
    .sort((a, b) => rect(b).bottom - rect(a).bottom)[0];
  if (fallback) {
    const txt = fallback.textContent.replace(/\s+/g, ' ').trim();
    return { name: txt, firstName: firstNameFromName(txt) || `client ${index + 1}` };
  }
  return { name: `Client ${index + 1}`, firstName: `client ${index + 1}` };
}
export function registrationHourTypeContexts() {
  return visibleSelect2HourTypeContainers()
    .sort((a, b) => rect(a).top - rect(b).top || rect(a).left - rect(b).left)
    .map((container, index) => {
      const target = container.closest('.select2-selection') || container.parentElement || container;
      const person = registrationClientNameForHourType(container, index);
      return { container, target, index, name: person.name, firstName: person.firstName };
    });
}
function clickSelect2OptionTextInRoot(text, root) {
  const wanted = clean(text);
  const options = deepQueryAll('.select2-results__option,[role="option"],li', root || document)
    .filter((el) => visible(el) && !isOwnPopup(el) && !/true/i.test(el.getAttribute('aria-disabled') || ''));
  const match = options.find((el) => clean(el.textContent || '') === wanted) ||
    options.find((el) => clean(el.textContent || '').includes(wanted));
  if (!match) return false;
  clickOption(match);
  return true;
}
function validRegistrationHourTypeOptionText(text) {
  const c = clean(text);
  if (!c || c.length < 2) return false;
  if (/^(onlangs gebruikt|geadviseerd|toegestaan)$/.test(c)) return false;
  return true;
}
function splitRegistrationHourTypeOptionText(text) {
  return splitUursoortCategoryText(text).filter(validRegistrationHourTypeOptionText);
}
function pushRegistrationHourTypeOption(out, seen, text) {
  for (const part of splitRegistrationHourTypeOptionText(text)) {
    const key = clean(part);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
}
function nativeRegistrationHourTypeOptions() {
  const out = [];
  const seen = new Set();
  for (const sel of deepQueryAll('select').filter((s) => /hour_type_id/.test(s.id || s.name || ''))) {
    for (const opt of Array.from(sel.options || [])) {
      const text = (opt.textContent || opt.label || '').replace(/\s+/g, ' ').trim();
      pushRegistrationHourTypeOption(out, seen, text);
    }
  }
  return out;
}
function select2ResultsElementForSelection(selection, rendered) {
  const owns = selection && selection.getAttribute && selection.getAttribute('aria-owns');
  if (owns) {
    const byOwns = document.getElementById(owns);
    if (byOwns) return byOwns;
  }
  const renderedId = rendered && rendered.id;
  if (renderedId && /-container$/.test(renderedId)) {
    const byRendered = document.getElementById(renderedId.replace(/-container$/, '-results'));
    if (byRendered) return byRendered;
  }
  return null;
}
function select2SearchInputForHourType(resultsRoot) {
  if (!resultsRoot || !/hour_type_id-results/.test(resultsRoot.id || '')) return null;
  const open = resultsRoot.closest('.select2-container--open') || document;
  return deepQueryAll('input.select2-search__field', open)
    .find((inp) => visible(inp) && !isOwnPopup(inp)) || null;
}
function visibleSelect2Options(resultsRoot) {
  const out = [];
  const seen = new Set();
  if (!resultsRoot) return out;
  const selector = '.select2-results__option,[role="option"],li';
  for (const opt of deepQueryAll(selector, resultsRoot).filter((el) => visible(el) && !isOwnPopup(el))) {
    if (/true/i.test(opt.getAttribute('aria-disabled') || '')) continue;
    if (/group/i.test(opt.getAttribute('role') || '') || /select2-results__option--group/.test(opt.className || '')) continue;
    if (opt.id && !/hour_type_id-result/.test(opt.id)) continue;
    if (hasNestedOptionNode(opt, selector)) continue;
    const text = (opt.textContent || '').replace(/\s+/g, ' ').trim();
    pushRegistrationHourTypeOption(out, seen, text);
  }
  return out;
}
function clearRegistrationPrefixFromHourTypeSearch(resultsRoot) {
  const search = select2SearchInputForHourType(resultsRoot);
  if (!search) return false;
  const value = String(search.value || '').trim();
  if (!value) return false;
  const c = clean(value);
  const prefixRe = registrationPrefixRegex();
  const looksLikeRegistrationPrefix = prefixRe.test(value) ||
    REGISTRATION_CHOICES.some((choice) => {
      const label = clean(choice.label);
      return c === label || (c.length >= 2 && label.startsWith(c.replace(/\s*-\s*$/, '')));
    });
  if (!looksLikeRegistrationPrefix) return false;
  setInputText(search, '');
  return true;
}
function listRegistrationHourTypeOptions(onDone, context = null) {
  const containers = context ? [context.container] : visibleSelect2HourTypeContainers();
  const nativeOptions = nativeRegistrationHourTypeOptions();
  if (!containers.length) { onDone(nativeOptions); return; }
  const container = containers[0];
  const target = container.closest('.select2-selection') || container.parentElement || container;
  registrationFlow.registrationHourTypeBusy = true;
  clickElementCenter(target);
  // Wacht (met polling) tot het select2-resultatenpaneel daadwerkelijk
  // opties bevat i.p.v. na een vaste 280ms te lezen — dat leverde soms
  // "Geen uursoorten gevonden" op als het paneel nog niet gerenderd was.
  pollFor(() => {
    const resultsRoot = select2ResultsElementForSelection(target, container);
    if (!resultsRoot) return null;
    const options = visibleSelect2Options(resultsRoot);
    return options.length ? { resultsRoot, options } : null;
  }, (found) => {
    const resultsRoot = (found && found.resultsRoot) || select2ResultsElementForSelection(target, container);
    const cleared = clearRegistrationPrefixFromHourTypeSearch(resultsRoot);
    setTimeout(() => {
      const options = visibleSelect2Options(resultsRoot);
      registrationFlow.registrationHourTypeBusy = false;
      onDone(context ? options : (options.length ? options : nativeOptions));
    }, cleared ? 120 : 0);
  }, { timeout: 2500, interval: 90 });
}
function clearRegistrationHourTypeForContext(context, onDone) {
  if (!context || !context.container) { if (onDone) onDone(false); return; }
  let touched = false;
  const select = registrationHourTypeSelectForContainer(context.container);
  if (select) {
    const emptyOption = Array.from(select.options || []).find((opt) => !opt.value);
    if (emptyOption) select.value = emptyOption.value;
    else select.selectedIndex = -1;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    try { if (window.jQuery) window.jQuery(select).trigger('change'); } catch (e) {}
    touched = true;
  }
  const selection = context.target || context.container.closest('.select2-selection') || context.container.parentElement || context.container;
  const clear = (context.container.querySelector && context.container.querySelector('.select2-selection__clear')) ||
    (selection.querySelector && selection.querySelector('.select2-selection__clear'));
  if (clear && visible(clear)) {
    clickOption(clear);
    touched = true;
    setTimeout(() => onDone && onDone(touched), 80);
    return;
  }
  if (onDone) onDone(touched);
}
export function clearRegistrationNoShowHourTypes(onDone) {
  let touched = false;
  for (const sel of deepQueryAll('select').filter((s) => /hour_type_id/.test(s.id || s.name || '') && (s.options || []).length)) {
    const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
    if (!registrationHourTypeLooksNoShow((opt && (opt.textContent || opt.label)) || sel.value || '')) continue;
    const emptyOption = Array.from(sel.options || []).find((o) => !o.value);
    if (emptyOption) sel.value = emptyOption.value;
    else sel.selectedIndex = -1;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    try { if (window.jQuery) window.jQuery(sel).trigger('change'); } catch (e) {}
    touched = true;
  }
  const contexts = registrationHourTypeContexts().filter((ctx) => registrationHourTypeLooksNoShow(registrationHourTypeTextInContainer(ctx.container)));
  let index = 0;
  const next = () => {
    const ctx = contexts[index++];
    if (!ctx) { if (onDone) onDone(touched); return; }
    clearRegistrationHourTypeForContext(ctx, (ok) => { touched = touched || ok; next(); });
  };
  next();
}
function backFromRegistrationHourTypeSelection(index = 0) {
  const contexts = registrationHourTypeContexts();
  const context = contexts[index] || null;
  setStatus('Uursoort verwijderen...');
  const afterClear = () => {
    clickEmptyModalSpot();
    updateRegistrationSubmitGuard();
    if (index > 0) showRegistrationHourTypeSelection(index - 1);
    else showRegistrationChoices();
    setStatus('Uursoort verwijderd');
  };
  if (context) clearRegistrationHourTypeForContext(context, afterClear);
  else clearRegistrationHourTypes(afterClear);
}
export function showRegistrationHourTypeSelection(index = null) {
  const body = $body(); if (!body) return;
  const contexts = registrationHourTypeContexts();
  const selectedIndex = index === null
    ? Math.max(0, contexts.findIndex((ctx) => !registrationHourTypeSelectedInContainer(ctx.container)))
    : index;
  const context = contexts[selectedIndex] || null;
  if (contexts.length && !context) { showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice); return; }
  if (contexts.length && contexts.every((ctx) => registrationHourTypeSelectedInContainer(ctx.container)) && index === null) {
    showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
    return;
  }
  registrationFlow.activeRegistrationHourTypeIndex = selectedIndex;
  markScreen('registrationHourTypeSelection', { index: selectedIndex });
  const title = context ? `Uursoort ${context.firstName}` : 'Uursoortselectie';
  const onBack = () => { helperPanel.suppressAutoUntil = Date.now() + 1200; safe(() => backFromRegistrationHourTypeSelection(selectedIndex)); };
  renderScreen(body, 'pickList', {
    title: title, loading: true, options: null, tokens: ONSAH_TOKENS, onBack: onBack,
    emptyMessage: 'Geen uursoorten gevonden',
  });
  setStatus('Uursoorten laden...');
  listRegistrationHourTypeOptions((options) => {
    const onPickOption = (opt) => safe(() => {
      setRegistrationHourTypeForContext(opt, context, (ok) => {
        if (ok && registrationTextHasNoShowCue(opt)) {
          registrationFlow.registrationNoShowPromptSuppressed = false;
          registrationFlow.registrationNoShowPromptAfterNo = () => {
            if (context && selectedIndex + 1 < contexts.length) showRegistrationHourTypeSelection(selectedIndex + 1);
            else if (hasRegistrationHourTypeSelected()) showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
            else showRegistrationHourTypeSelection();
          };
          showRegistrationNoShowPrompt();
          setStatus(`No show-uursoort gekozen voor ${context ? context.firstName : 'client'}`, false);
          return;
        }
        if (ok && context && selectedIndex + 1 < contexts.length) {
          showRegistrationHourTypeSelection(selectedIndex + 1);
        } else if (ok && hasRegistrationHourTypeSelected()) {
          showRegistrationReportPrompt(registrationFlow.activeRegistrationChoice);
        }
        setStatus(ok ? `Uursoort gezet voor ${context ? context.firstName : 'client'}: ${opt}` : `Uursoort niet gevonden voor ${context ? context.firstName : 'client'}: ${opt}`, ok);
      });
    });
    renderScreen(body, 'pickList', {
      title: title, loading: false, options: options, tokens: ONSAH_TOKENS, onBack: onBack,
      onPick: onPickOption, emptyMessage: 'Geen uursoorten gevonden',
    });
    setStatus(options.length ? 'Kies uursoort' : 'Uursoorten niet gevonden', !!options.length);
  }, context);
}
function setHourTypeViaSelect2(text, onDone) {
  const containers = visibleSelect2HourTypeContainers();
  if (!containers.length) { onDone(false); return; }
  let index = 0, okCount = 0;
  const next = () => {
    const container = containers[index++];
    if (!container) { onDone(okCount === containers.length); return; }
    const target = container.closest('.select2-selection') || container.parentElement || container;
    clickElementCenter(target);
    setTimeout(() => {
      const resultsRoot = select2ResultsElementForSelection(target, container);
      const search = select2SearchInputForHourType(resultsRoot);
      if (search) setInputText(search, text);
      setTimeout(() => {
        const ok = clickSelect2OptionTextInRoot(text, resultsRoot);
        setTimeout(() => {
          const selected = clean(container.textContent || container.getAttribute('title') || '');
          if (ok && selected && !/zoek naar uursoorten|selecteer uursoort|uursoort/.test(selected)) okCount++;
          else if (ok) okCount++;
          setTimeout(next, 80);
        }, 90);
      }, 180);
    }, 120);
  };
  next();
}
function setRegistrationHourTypeForContext(text, context, onDone) {
  if (!context) { setRegistrationHourType(text, onDone); return; }
  const target = context.target || context.container.closest('.select2-selection') || context.container.parentElement || context.container;
  clickElementCenter(target);
  setTimeout(() => {
    const resultsRoot = select2ResultsElementForSelection(target, context.container);
    setTimeout(() => {
      const ok = clickSelect2OptionTextInRoot(text, resultsRoot);
      setTimeout(() => onDone(!!ok && registrationHourTypeSelectedInContainer(context.container)), 120);
    }, 80);
  }, 120);
}
export function setRegistrationHourType(text, onDone) {
  const nativeOk = selectHourTypeInNativeSelects(text);
  if (nativeOk) { onDone(true); return; }
  setHourTypeViaSelect2(text, onDone);
}
export function clearRegistrationHourTypes(onDone) {
  let touched = false;
  const selects = deepQueryAll('select').filter((sel) => /hour_type_id/.test(sel.id || sel.name || ''));
  for (const sel of selects) {
    if (!sel.value && sel.selectedIndex <= 0) continue;
    const emptyOption = Array.from(sel.options || []).find((opt) => !opt.value);
    if (emptyOption) sel.value = emptyOption.value;
    else sel.selectedIndex = -1;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    try { if (window.jQuery) window.jQuery(sel).trigger('change'); } catch (e) {}
    touched = true;
  }
  const containers = visibleSelect2HourTypeContainers();
  let index = 0;
  const next = () => {
    const container = containers[index++];
    if (!container) { onDone(touched); return; }
    const selection = container.closest('.select2-selection') || container.parentElement || container;
    const clear = (container.querySelector && container.querySelector('.select2-selection__clear')) ||
      (selection.querySelector && selection.querySelector('.select2-selection__clear'));
    if (clear && visible(clear)) {
      clickOption(clear);
      touched = true;
      setTimeout(next, 100);
    } else {
      setTimeout(next, 0);
    }
  };
  next();
}
export function applyRegistrationNoShow() {
  applyRegistrationChoice(REGISTRATION_CHOICES[0]);
}
export function hasRegistrationEndTime() {
  const end = registrationTimeInput('declaration_end_time_display');
  return !!(end && timeTextToMinutes(registrationLiveTimeValue(end)) !== null);
}
export function hasRegistrationHourTypeSelected() {
  const containers = visibleSelect2HourTypeContainers();
  if (containers.length) {
    return containers.every((el) => {
      const text = clean(el.textContent || el.getAttribute('title') || '');
      return !!text && !/zoek naar uursoorten|selecteer uursoort|uursoort/.test(text);
    });
  }
  const selects = deepQueryAll('select').filter((sel) => /hour_type_id/.test(sel.id || sel.name || '') && (sel.options || []).length);
  if (selects.length) return selects.every((sel) => {
    const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
    const text = clean((opt && (opt.textContent || opt.label)) || '');
    return !!String(sel.value || '').trim() && validRegistrationHourTypeOptionText(text || sel.value);
  });
  return false;
}
export function registrationReadyToSubmitPage() {
  return hasRegistrationPrereqs() && hasRegistrationEndTime() && hasRegistrationHourTypeSelected() && !registrationReportNeedsContent();
}
