// Vragen op de pagina lezen: tekst, categorie, groep, verplicht en beantwoord.

import { UI_OVERRIDES } from './config.js';
import { ct, surveyQuestionSel } from './page.js';

export function isSurveyQuestionBlock(el) {
  return !!(el && el.matches && el.matches(surveyQuestionSel()));
}
export function closestSurveyQuestionBlock(el) {
  return el && el.closest ? el.closest(surveyQuestionSel()) : null;
}
export function surveyQuestionBlocks(root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(surveyQuestionSel()))
    // Een matrix kan zelf een .survey_question zijn en daarbinnen voor elke
    // echte vraag een tr.required bevatten. Scan dan alleen de rijen, anders
    // komt dezelfde matrix dubbel en met een onjuiste verzameling antwoorden.
    .filter((el) => !(el.matches && el.matches('.survey_question') && el.querySelector('tr.required')));
}
function directText(el) {
  let t = '';
  if (!el) return t;
  for (const n of el.childNodes) if (n.nodeType === 3) t += n.textContent;
  return t;
}
// De vraagtekst staat als directe tekstnode in het label, of (bij vragen met
// een info-knop) als directe tekstnode van <uc-inline-info> — NIET de
// tooltip-tekst in de 'slot=info'-span.
function questionLabelRaw(q) {
  // Handmatig aangewezen vraagtekst-element (geldt voor ELKE vraag) heeft
  // voorrang; anders de standaard .question-text.
  let lbl = null;
  if (UI_OVERRIDES.surveyQuestionTextSelector) { try { lbl = q.querySelector(UI_OVERRIDES.surveyQuestionTextSelector); } catch (e) {} }
  if (!lbl) lbl = q.querySelector('.question-text');
  if (!lbl) return '';
  const info = lbl.querySelector('uc-inline-info');
  return (info && ct(directText(info)) ? directText(info) : directText(lbl)).replace(/\s+/g, ' ').trim();
}
export function questionLabelText(q) {
  return ct(questionLabelRaw(q));
}
export function respondentWarningText(age, wrongGroups, rule) {
  const groups = Array.isArray(wrongGroups) ? wrongGroups : [];
  if (age == null || !groups.length) return '';
  // Config-gedreven: er staat een antwoord ingevuld dat bij deze leeftijd niet
  // hoort, terwijl er wél een andere (leeftijds)versie van de vraag geldt.
  return 'Let op: er is een antwoord ingevuld dat bij deze leeftijd niet nodig is. Controleer of je de juiste leeftijdsversie van de vraag invult.';
}
export function readableQuestionText(q) {
  const text = questionLabelRaw(q);
  return (text || 'Vraag zonder titel').replace(/\s*antwoord wissen\s*$/i, '').trim();
}
export function categoryName(root) {
  const doc = root || document;
  const selected = doc.querySelector('.category_navigation li.selected');
  if (selected && ct(selected.textContent)) return selected.textContent.replace(/\s+/g, ' ').trim();
  const title = doc.querySelector('.category-title,.mod-status .selected');
  return title && title.textContent ? title.textContent.replace(/\s+/g, ' ').trim() : 'Vragenlijst';
}
export function groupName(q, root) {
  const wrap = q.closest && q.closest('.mod-survey-group,fieldset');
  const heading = wrap && wrap.querySelector('.group-header h2.description,.group-header h2,h2.description,legend');
  return heading && ct(heading.textContent) ? heading.textContent.replace(/\s+/g, ' ').trim() : categoryName(root);
}
// Positie van de (huidige) categorie in de navigatie, zodat de checklist in
// de volgorde van de vragenlijst blijft staan i.p.v. op moment-van-detectie.
export function categoryOrderOf(root) {
  const doc = root || document;
  const nav = Array.prototype.slice.call(doc.querySelectorAll('.category_navigation li'));
  if (!nav.length) return 0;
  const idx = nav.findIndex((li) => li.classList && li.classList.contains('selected'));
  return idx >= 0 ? idx : 0;
}
export function isRequiredQuestion(q, age, rule) {
  if (!q) return false;
  // (#geen-vangnet) Staat deze vraag in het beheerscherm? Dan bepaalt de config
  // ALLES: verplicht zodra de leeftijd aan de ingestelde vergelijking voldoet,
  // en anders NIET verplicht (ook al zou ONS de andere leeftijdsversie markeren).
  if (rule) {
    const configured = rule.questionsFor ? rule.questionsFor(questionLabelText(q)) : [rule.questionFor(questionLabelText(q))].filter(Boolean);
    const requiredRules=configured.filter((cq)=>cq.rule==='vraag_verplicht');
    if (requiredRules.length) return requiredRules.some((cq)=>rule.appliesAt(cq, age));
  }
  // Niet in de config: de gewone ONS-markering (sterretje/required) blijft gelden.
  if (q.classList && q.classList.contains('required')) return true;
  if (q.querySelector('[required],[aria-required="true"]')) return true;
  const props = Array.prototype.slice.call(q.querySelectorAll('[data-props]'))
    .some((el) => /&quot;required&quot;\s*:\s*&quot;required&quot;|"required"\s*:\s*"required"/i.test(el.getAttribute('data-props') || ''));
  if (props) return true;
  return false;
}
export function questionInactiveByPageCode(q) {
  if (!q) return false;
  if (q.getAttribute('data-ons-helper-rendered-visible') === 'false') return true;
  let node = q;
  const group = q.closest && q.closest('.mod-survey-group');
  while (node && node !== group) {
    const style = ct(node.getAttribute && node.getAttribute('style') || '');
    const cls = ct(node.className || '');
    if ((node.hasAttribute && node.hasAttribute('hidden')) ||
        (node.getAttribute && node.getAttribute('aria-hidden') === 'true') ||
        /display\s*:\s*none|visibility\s*:\s*hidden/.test(style) ||
        /(^|\s)(hidden|is-hidden|conditionally-hidden|collapsed)(\s|$)/.test(cls)) return true;
    node = node.parentElement;
  }
  // Op de echte, actieve pagina is computedStyle de betrouwbaarste bron:
  // ONS heeft daar zijn eigen inklap-/afhankelijkheidslogica al uitgevoerd.
  if (q.ownerDocument === document) {
    try {
      const style = getComputedStyle(q);
      if (style.display === 'none' || style.visibility === 'hidden' || q.getClientRects().length === 0) return true;
    } catch (e) {}
  }
  return false;
}
export function isAnswered(q) {
  const radios = Array.prototype.slice.call(q.querySelectorAll('input[type="radio"]:not([disabled])'));
  if (radios.length) {
    const checked = radios.find((r) => r.checked);
    if (!checked || String(checked.value || '').trim() === '') return false;
    // Sommige radiokeuzes openen een aanvullend tekst-/datumveld binnen
    // dezelfde optie. Als zo'n veld bestaat, hoort het bij het antwoord.
    const option = checked.closest('div,tr,li,label');
    if (option && option !== q) {
      const dependent = Array.prototype.slice.call(option.querySelectorAll('textarea:not([disabled]),select:not([disabled]),input:not([disabled]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"])'));
      if (dependent.length && !dependent.some((el) => String(el.value == null ? '' : el.value).trim() !== '')) return false;
    }
    return true;
  }
  const checks = Array.prototype.slice.call(q.querySelectorAll('input[type="checkbox"]:not([disabled])'));
  if (checks.length) return checks.some((el) => el.checked);
  const selects = Array.prototype.slice.call(q.querySelectorAll('select:not([disabled])'));
  if (selects.length) return selects.some((el) => String(el.value || '').trim() !== '');
  const fields = Array.prototype.slice.call(q.querySelectorAll('textarea:not([disabled]),input:not([disabled]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"])'));
  if (fields.length) return fields.some((field) => {
    const type = ct(field.getAttribute('type') || field.type || 'text');
    if (type === 'file') return !!((field.files && field.files.length) || String(field.value || '').trim());
    return String(field.value == null ? '' : field.value).trim() !== '';
  });
  const editable = q.querySelector('[contenteditable="true"]');
  if (editable) return ct(editable.textContent || '') !== '';
  // Bij een achtergrond-GET zijn React-vragen nog niet altijd naar een
  // input/textarea gerenderd. Lees dan de opgeslagen waarde uit data-props.
  // Dit vangt o.a. SurveyTextArea, SurveyDateInput en numerieke componenten.
  const reactInputs = Array.prototype.slice.call(q.querySelectorAll('[data-react-component][data-props]'));
  if (reactInputs.length) {
    const hasMeaningfulValue = (value) => {
      if (value == null) return false;
      if (typeof value === 'string') return value.trim() !== '';
      if (typeof value === 'number' || typeof value === 'boolean') return true;
      if (Array.isArray(value)) return value.some(hasMeaningfulValue);
      if (typeof value === 'object') return Object.keys(value).some((key) => hasMeaningfulValue(value[key]));
      return false;
    };
    let recognized = false;
    for (const host of reactInputs) {
      let props = null;
      try { props = JSON.parse(host.getAttribute('data-props') || '{}'); } catch (e) { props = null; }
      if (!props) continue;
      for (const key of ['defaultValue', 'value', 'answer', 'selectedValue', 'selectedValues']) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
        recognized = true;
        if (hasMeaningfulValue(props[key])) return true;
      }
    }
    if (recognized) return false;
  }
  const custom = Array.prototype.slice.call(q.querySelectorAll('uc-select,uc-input,uc-textarea,[role="combobox"],[role="slider"],[aria-selected],[aria-checked]'));
  if (custom.length) return custom.some((el) => {
    const ariaChecked = el.getAttribute && el.getAttribute('aria-checked');
    const ariaSelected = el.getAttribute && el.getAttribute('aria-selected');
    if (ariaChecked === 'true' || ariaSelected === 'true') return true;
    const value = ('value' in el ? el.value : null) || (el.getAttribute && (el.getAttribute('value') || el.getAttribute('data-value')));
    return String(value == null ? '' : value).trim() !== '';
  });
  return true; // onbekend type -> niet blokkeren
}
// (#2) Bevat de vraag een besturingselement dat isAnswered betrouwbaar kan
// beoordelen? Zo niet, dan mag een verplichte vraag niet vals-groen worden;
// we markeren haar als "niet te controleren" zodat jij haar zelf nakijkt.
export function hasRecognizedControl(q) {
  if (!q || !q.querySelector) return false;
  return !!q.querySelector(
    'input[type="radio"]:not([disabled]),input[type="checkbox"]:not([disabled]),' +
    'select:not([disabled]),textarea:not([disabled]),' +
    'input:not([disabled]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]),' +
    '[contenteditable="true"],[data-react-component][data-props],' +
    'uc-select,uc-input,uc-textarea,[role="combobox"],[role="slider"],[aria-selected],[aria-checked]'
  );
}
