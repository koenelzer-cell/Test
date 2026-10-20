// Bedienen van ONS-formuliervelden: checkboxes, dropdowns, zoekvelden en
// tekstinvoer.

import { CONFIG } from '../config/app-config.js';
import { area, clean, deepActive, deepQueryAll, isOwnPopup, labelTextFor, rect, visible } from './dom.js';
import { isProtectedAppointmentStartInput } from './time-input.js';

/*  Clint(en) aanwezig  */
function findCheckbox(matcher) {
  for (const input of deepQueryAll('input[type="checkbox"]'))
    if (matcher(clean(labelTextFor(input)))) return { el: input, kind: 'input' };
  for (const node of deepQueryAll('[role="checkbox"], [aria-checked], uc-checkbox'))
    if (matcher(clean(labelTextFor(node) || node.textContent || node.getAttribute && (node.getAttribute('aria-label') || '')))) return { el: node, kind: 'aria' };
  return null;
}
function nativeCheckboxFor(ctrl) {
  if (!ctrl || !ctrl.el) return null;
  if (ctrl.el.matches && ctrl.el.matches('input[type="checkbox"]')) return ctrl.el;
  return (ctrl.el.querySelector && ctrl.el.querySelector('input[type="checkbox"]')) ||
    (ctrl.el.shadowRoot && ctrl.el.shadowRoot.querySelector('input[type="checkbox"]')) ||
    null;
}
function isChecked(ctrl) {
  if (!ctrl || !ctrl.el) return null;
  const native = nativeCheckboxFor(ctrl);
  if (native) return !!native.checked;
  const nodes = [ctrl.el, ctrl.el.shadowRoot && ctrl.el.shadowRoot.querySelector('[aria-checked]')].filter(Boolean);
  for (const node of nodes) {
    const aria = node.getAttribute && node.getAttribute('aria-checked');
    if (aria === 'true') return true;
    if (aria === 'false') return false;
    const checked = node.getAttribute && node.getAttribute('checked');
    if (checked === '' || checked === 'true') return true;
    const state = clean(node.getAttribute && (node.getAttribute('data-state') || node.getAttribute('class') || ''));
    if (/\bchecked\b|\bselected\b|\bactive\b/.test(state)) return true;
  }
  return null;
}
function setChecked(ctrl, desired) {
  if (!ctrl) return false;
  const current = isChecked(ctrl);
  if (current === desired) return true;
  if (current === null) return false;
  const native = nativeCheckboxFor(ctrl);
  const target = native || ctrl.el;
  clickOption(target);
  if (native && native.checked !== desired) {
    native.checked = desired;
    native.dispatchEvent(new Event('input', { bubbles: true }));
    native.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return isChecked(ctrl) === desired;
}
export function applyClientPresent(desired, onResult, attempt = 0) {
  const ctrl = findCheckbox(CONFIG.clientPresentMatcher);
  if (ctrl) {
    const ok = setChecked(ctrl, desired);
    if (ok || attempt >= 5) { onResult(ok, ok); return; }
    setTimeout(() => applyClientPresent(desired, onResult, attempt + 1), 120);
    return;
  }
  if (attempt < 15) setTimeout(() => applyClientPresent(desired, onResult, attempt + 1), 200);
  else onResult(false, false);
}
/*  veld-opener vinden (placeholder-attribuut, weergavetekst, of kopje)  */
export function uiText(el) {
  if (!el) return '';
  const bits = [];
  if (el.getAttribute) bits.push(el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.getAttribute('label'), el.getAttribute('title'));
  if ('value' in el && typeof el.value === 'string') bits.push(el.value);
  bits.push(el.textContent);
  return bits.filter(Boolean).join(' ');
}
export function isUsableBox(el) {
  if (!visible(el) || isOwnPopup(el)) return false;
  const r = rect(el);
  return r.width >= 90 && r.width <= 700 && r.height >= 24 && r.height <= 90;
}
export function clickBoxFor(el) {
  const clickable = 'input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,[class*="select" i]';
  let n = el;
  while (n && n !== document.body && n.nodeType === 1) {
    if (!isOwnPopup(n) && visible(n)) {
      const r = rect(n);
      if ((n.matches && n.matches(clickable)) || (r.width >= 120 && r.height >= 28 && r.height <= 90)) return n;
    }
    n = n.parentElement;
  }
  return el;
}
function findByVisibleText(texts) {
  const wanted = texts.map(clean);
  let best = null, bestScore = Infinity;
  for (const el of deepQueryAll('input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,div,span,p,label')) {
    if (!visible(el) || isOwnPopup(el)) continue;
    const t = clean(uiText(el));
    if (!t) continue;
    const exact = wanted.includes(t);
    const compact = wanted.some((w) => t.startsWith(w) && t.length <= w.length + 8);
    if (!exact && !compact) continue;
    const box = clickBoxFor(el);
    if (!isUsableBox(box)) continue;
    const r = rect(box);
    const score = area(box) + (exact ? 0 : 100000) + r.top;
    if (score < bestScore) { best = box; bestScore = score; }
  }
  return best;
}
function findBelowLabel(labelTexts, displayTexts) {
  const labels = [];
  const wantedLabels = labelTexts.map(clean);
  for (const el of deepQueryAll('label,div,span,p')) {
    if (!visible(el) || isOwnPopup(el)) continue;
    const t = clean(el.textContent || '');
    if (wantedLabels.includes(t)) labels.push(el);
  }
  const wantedDisplay = displayTexts.map(clean);
  let best = null, bestScore = Infinity;
  for (const label of labels) {
    const lr = rect(label);
    for (const el of deepQueryAll('input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,[class*="select" i],div,span')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const box = clickBoxFor(el);
      if (!isUsableBox(box)) continue;
      const r = rect(box);
      if (r.top < lr.bottom - 4 || r.top - lr.bottom > 100) continue;
      const aligned = Math.abs(r.left - lr.left) < 80 || (r.left <= lr.left + 20 && r.right >= lr.left + 80);
      if (!aligned) continue;
      const text = clean(uiText(box));
      const textBonus = wantedDisplay.some((w) => text.includes(w)) ? -1000 : 0;
      const score = (r.top - lr.bottom) * 20 + Math.abs(r.left - lr.left) + area(box) / 1000 + textBonus;
      if (score < bestScore) { best = box; bestScore = score; }
    }
  }
  return best;
}
export function findOpener({ placeholderRe, displayTexts = [], labelTexts = [] }) {
  const byText = displayTexts.length ? findByVisibleText(displayTexts) : null;
  if (byText) return byText;

  const byLabel = labelTexts.length ? findBelowLabel(labelTexts, displayTexts) : null;
  if (byLabel) return byLabel;

  for (const el of deepQueryAll('input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select')) {
    if (!visible(el) || isOwnPopup(el)) continue;
    if (placeholderRe.test(uiText(el))) return clickBoxFor(el);
  }
  return null;
}
/*  generiek: open  typ  kies  */
export function optionSearchRoots(trigger) {
  const scored = [];
  for (const el of deepQueryAll('[role="listbox"],[role="menu"],ul,uc-select-list,[class*="dropdown" i],[class*="menu" i],[class*="popover" i],[class*="options" i]')) {
    if (!visible(el) || isOwnPopup(el)) continue;
    const r = rect(el);
    if (r.width < 160 || r.height < 30) continue;
    let score = 0;
    if (trigger) {
      const tr = rect(trigger);
      const xOverlap = Math.max(0, Math.min(r.right, tr.right + 240) - Math.max(r.left, tr.left - 240));
      const below = r.top >= tr.bottom - 12 && r.top <= tr.bottom + 120;
      const coversTriggerX = xOverlap >= Math.min(tr.width, r.width) * 0.45;
      if (below && coversTriggerX) {
        score = Math.abs(r.top - tr.bottom) + Math.abs(r.left - tr.left) / 5 - xOverlap / 100;
      } else {
        const dx = Math.abs((r.left + r.right) / 2 - (tr.left + tr.right) / 2);
        const dy = Math.min(Math.abs(r.top - tr.bottom), Math.abs(r.bottom - tr.top));
        if (dx > 430 || dy > 520) continue;
        score = 10000 + dy + dx / 5;
      }
    }
    scored.push({ el, score });
  }
  if (trigger) {
    const tr = rect(trigger);
    for (const inp of deepQueryAll('input,textarea')) {
      if (!visible(inp) || isOwnPopup(inp)) continue;
      const ir = rect(inp);
      const below = ir.top >= tr.bottom - 12 && ir.top <= tr.bottom + 140;
      const overlaps = ir.right >= tr.left - 80 && ir.left <= tr.right + 240;
      if (!below || !overlaps) continue;
      let n = inp.parentElement;
      while (n && n !== document.body) {
        const nr = rect(n);
        if (nr.width >= Math.max(220, tr.width * 0.8) && nr.height >= 70 && nr.top <= ir.top + 5) {
          scored.push({ el: n, score: -20 + Math.abs(nr.top - tr.bottom) / 10 });
          break;
        }
        n = n.parentElement;
      }
    }
  }
  return [...new Set(scored.sort((a, b) => a.score - b.score).map((x) => x.el))];
}
export function optionText(el) {
  return ((el.getAttribute && (el.getAttribute('label') || el.getAttribute('aria-label'))) || el.textContent || '').replace(/\s+/g, ' ').trim();
}
export function hasNestedOptionNode(el, selector) {
  if (!el || !el.querySelectorAll) return false;
  try {
    return Array.from(el.querySelectorAll(selector)).some((child) => child !== el && visible(child) && !isOwnPopup(child));
  } catch (e) {
    return false;
  }
}
// Een échte uursoort-optie is één regel. Een container die eigen actie-elementen
// met tekst omvat (links/knoppen) is géén optie maar een stuk UI — bijvoorbeeld een
// collega-agendakaart achter de modal ("… Informatie niet delen / Toon alleen deze
// agenda"). Generiek (geen vaste teksten) en vangt ook de fallback-race bij snel doorklikken.
export function containsSeparateActionText(el) {
  if (!el || !el.querySelectorAll) return false;
  try {
    return Array.from(el.querySelectorAll('a[href], button, [role="button"], [role="menuitem"], [role="link"]'))
      .some((child) => child !== el && visible(child) && !isOwnPopup(child) && clean(child.textContent || '').length >= 2);
  } catch (e) {
    return false;
  }
}
export function genericOptionCandidates(root) {
  const selector = '[role="option"], li, button, [class*="option" i], [data-value], [data-id], div, span';
  const out = [];
  const seen = new Set();
  for (const o of deepQueryAll(selector, root).filter((el) => visible(el) && !isOwnPopup(el))) {
    if (/input|textarea|select/i.test(o.tagName || '')) continue;
    const t = optionText(o);
    const c = clean(t);
    if (!c || seen.has(c) || /^zoek naar|toont |geen resultaten|voer minstens/.test(c)) continue;
    const r = rect(o);
    if (r.width < 60 || r.height < 18 || r.height > 90) continue;
    seen.add(c); out.push(o);
  }
  return out;
}
export function clickOption(el) {
  try { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
  try { el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
  el.click();
}
export function clickUiButton(el) {
  if (!el) return false;
  const inner = el.shadowRoot && (el.shadowRoot.querySelector('button:not([disabled])') || el.shadowRoot.querySelector('button'));
  const target = inner || el;
  return clickElementCenter(target);
}
export function clickElementCenter(el) {
  if (!el) return false;
  try { el.scrollIntoView && el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
  const r = rect(el);
  if (!r || r.width <= 0 || r.height <= 0) return false;
  const x = Math.round(r.left + r.width / 2);
  const y = Math.round(r.top + r.height / 2);
  // Richt events op het gevonden element. Na scrollen/hertekenen kan
  // elementFromPoint inmiddels een buurknop aanwijzen.
  const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y };
  try { el.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerType: 'mouse' })); } catch (e) {}
  try { el.dispatchEvent(new MouseEvent('mousedown', init)); } catch (e) {}
  try { el.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerType: 'mouse' })); } catch (e) {}
  try { el.dispatchEvent(new MouseEvent('mouseup', init)); } catch (e) {}
  try { el.dispatchEvent(new MouseEvent('click', init)); } catch (e) {}
  if (!isProtectedAppointmentStartInput(el)) {
    try { el.focus && el.focus(); } catch (e) {}
  }
  return true;
}
export function openSelectCombobox(el) {
  if (!el) return null;
  const nestedSelect = el.querySelector && el.querySelector('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], uc-select[aria-label="Labels"], [role="combobox"][aria-label="Uursoort"], [role="combobox"][aria-label="Labels"]');
  if (nestedSelect && nestedSelect !== el) return openSelectCombobox(nestedSelect);
  const inner = el.shadowRoot && (
    el.shadowRoot.querySelector('[role="combobox"]:not([aria-disabled="true"])') ||
    el.shadowRoot.querySelector('button:not([disabled])') ||
    el.shadowRoot.querySelector('[tabindex],input,button,div')
  );
  const target = inner || el;
  try { target.scrollIntoView && target.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
  const r = rect(target);
  const x = Math.round(r.left + r.width / 2);
  const y = Math.round(r.top + r.height / 2);
  const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y };
  try { target.focus && target.focus(); } catch (e) {}
  try { target.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerType: 'mouse' })); } catch (e) {}
  try { target.dispatchEvent(new MouseEvent('mousedown', init)); } catch (e) {}
  try { target.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerType: 'mouse' })); } catch (e) {}
  try { target.dispatchEvent(new MouseEvent('mouseup', init)); } catch (e) {}
  try { target.dispatchEvent(new MouseEvent('click', init)); } catch (e) {}
  return target;
}
export function setInputText(inp, text) {
  if (isProtectedAppointmentStartInput(inp)) return false;
  const proto = inp instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;
  if (setter) setter.call(inp, text); else inp.value = text;
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
export function setInputTextComposed(inp, text) {
  if (!setInputText(inp, text)) return false;
  inp.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  return true;
}
export function inputTextValue(inp) {
  return String((inp && 'value' in inp ? inp.value : '') || (inp && inp.getAttribute && inp.getAttribute('value')) || '').trim();
}
export function setInputTextOns(inp, text) {
  if (!inp) return false;
  if (isProtectedAppointmentStartInput(inp)) return false;
  try { inp.scrollIntoView && inp.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
  try { inp.focus && inp.focus(); } catch (e) {}
  try { inp.select && inp.select(); } catch (e) {}
  setInputTextComposed(inp, text);
  try { inp.setAttribute && inp.setAttribute('value', text); } catch (e) {}
  try { inp.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: String(text) })); } catch (e) {}
  inp.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
  try { inp.blur && inp.blur(); } catch (e) {}
  return true;
}
export function setInputTextQuiet(inp, text) {
  if (isProtectedAppointmentStartInput(inp)) return false;
  if (!inp || inputTextValue(inp) === String(text)) return !!inp;
  setInputTextComposed(inp, text);
  try { inp.setAttribute && inp.setAttribute('value', text); } catch (e) {}
  return true;
}
export function setInputTextOnsVerified(inp, text, attempts = 4) {
  if (!inp) return false;
  const apply = (left) => {
    setInputTextOns(inp, text);
    if (left > 0) {
      setTimeout(() => {
        if (inputTextValue(inp) !== String(text)) apply(left - 1);
      }, left === attempts ? 120 : 220);
    }
  };
  apply(attempts);
  return true;
}
// Zit `el` (ook door shadow roots heen) binnen `host`?
function deepContains(host, el) {
  if (!host || !el) return false;
  let n = el;
  for (let i = 0; i < 200 && n; i++) {
    if (n === host) return true;
    n = n.parentElement || (n.getRootNode && n.getRootNode().host) || null;
  }
  return false;
}
// Hoort dit zoekveld bij DEZE combobox? Bij meerdere cliëntkaarten staan er
// identieke uursoort-comboboxen onder elkaar; zonder deze koppeling kan het
// zoekveld van een ándere cliënt worden gebruikt (uursoort bij de verkeerde
// cliënt). Twee vormen zijn geldig:
//  1) het zoekveld zit ín de combobox zelf (labels: inline chip-invoer);
//  2) het zoekveld staat in het uitklappaneel bij deze combobox.
// Let op: alleen "eronder" is te streng — de labelinvoer ligt op dezelfde
// hoogte als het veld zelf. Vandaar de band vanaf iets boven de bovenkant.
export function inputBelongsToTrigger(inp, tr, triggerEl) {
  if (!inp) return false;
  if (triggerEl && deepContains(triggerEl, inp)) return true;
  if (!tr) return false;
  const r = rect(inp);
  const horizontallyNear = r.left <= tr.right + 260 && r.right >= tr.left - 120;
  return horizontallyNear && r.top >= tr.top - 8 && r.top <= tr.bottom + 170;
}
export function searchInputForTrigger(trigger) {
  const tr = trigger ? rect(trigger) : null;
  const activeEl = deepActive();
  if (activeEl && /input|textarea/i.test(activeEl.tagName || '') && visible(activeEl) && !isOwnPopup(activeEl) && !isProtectedAppointmentStartInput(activeEl)) {
    const ph = clean((activeEl.getAttribute('placeholder') || '') + ' ' + (activeEl.getAttribute('aria-label') || ''));
    // Focus alleen vertrouwen als het veld ook echt bij deze trigger hoort:
    // een nog openstaande dropdown van een vorige cliënt kan de focus vasthouden
    // (dan zou de uursoort bij de verkeerde cliënt komen).
    const focusUsable = !tr || inputBelongsToTrigger(activeEl, tr, trigger);
    if (focusUsable && !ph.includes('afspraken') && !ph.includes('clienten') && (/zoeken|zoek/.test(ph) || ph === '')) return activeEl;
  }
  for (const root of optionSearchRoots(trigger)) {
    const input = deepQueryAll('input', root).find((inp) => {
      if (!visible(inp) || isOwnPopup(inp) || isProtectedAppointmentStartInput(inp)) return false;
      const ph = clean((inp.getAttribute('placeholder') || '') + ' ' + (inp.getAttribute('aria-label') || ''));
      if (ph.includes('afspraken') || ph.includes('clienten')) return false;
      return /zoeken|zoek/.test(ph) || ph === '';
    });
    if (input) return input;
  }
  if (!tr) return null;
  return deepQueryAll('input').find((inp) => {
    if (!visible(inp) || isOwnPopup(inp) || isProtectedAppointmentStartInput(inp)) return false;
    const ph = clean((inp.getAttribute('placeholder') || '') + ' ' + (inp.getAttribute('aria-label') || ''));
    if (ph.includes('afspraken') || ph.includes('clienten')) return false;
    return inputBelongsToTrigger(inp, tr, trigger);
  }) || null;
}
// Pak het eerste zichtbare element met een stabiele ONS-testhaak (data-qa).
// Deze veranderen niet mee met layout/opmaak en zijn dus betrouwbaarder dan
// geometrie- of tekstdetectie.
export function firstByDataQa(qa) {
  for (const el of deepQueryAll('[data-qa="' + qa + '"]')) {
    if (visible(el) && !isOwnPopup(el)) return el;
  }
  return null;
}
export function typeIntoSearchField(input, text) {
  if (!input) return false;
  try { input.focus(); } catch (e) {}
  try { input.click && input.click(); } catch (e) {}
  // leeg eerst
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;
  const setVal = (v) => { if (setter) setter.call(input, v); else input.value = v; };
  const fireInput = (value, inputType) => {
    try { input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, composed: true, inputType: inputType || 'insertText', data: value })); } catch (e) {}
    try { input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: inputType || 'insertText', data: value })); } catch (e) {
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
  };
  setVal('');
  fireInput('', 'deleteContentBackward');
  // typ teken voor teken met echte toetsaanslagen (nodig voor "min. 2 karakters"-velden)
  let acc = '';
  for (const ch of String(text)) {
    acc += ch;
    try { input.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true, composed: true })); } catch (e) {}
    setVal(acc);
    fireInput(ch, 'insertText');
    try { input.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true, cancelable: true, composed: true })); } catch (e) {}
  }
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  setTimeout(() => {
    if (inputTextValue(input) !== String(text)) {
      setVal(String(text));
      fireInput(String(text), 'insertText');
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
  }, 60);
  return true;
}
