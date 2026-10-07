// De opties van een geopende uursoort-dropdown uitlezen (scraping; terugval
// als de product-API niets geeft).

import { allNonClientHourTypes, CONFIG } from '../config/app-config.js';
import { clean, isOwnPopup, rect, visible } from './dom.js';
import {
  containsSeparateActionText,
  genericOptionCandidates,
  hasNestedOptionNode,
  optionSearchRoots,
  optionText,
} from './form-controls.js';
import { deepQueryAll } from '../ons/dom.js';

export function splitUursoortCategoryText(text) {
  let raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  raw = raw
    .replace(/&nbsp;|\u00a0/gi, ' ')
    .replace(/(Onlangs gebruikt|Geadviseerd|Toegestaan)\s*/gi, '\n')
    .replace(/\*\s*(?=[A-ZÀ-ÖØ-Þ])/g, '*\n')
    .replace(/\)\s+(?=[A-ZÀ-ÖØ-Þ])/g, ')\n')
    .replace(/#\s*(?=[A-ZÀ-ÖØ-Þ])/g, '#\n');
  return raw.split(/\n+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => !!part && !/^(?:#|\*|&?nbsp;?)$/i.test(part));
}
function pushUniqueText(out, seen, text, validator) {
  for (const part of splitUursoortCategoryText(text)) {
    if (validator && !validator(part)) continue;
    const key = clean(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
}
export function invalidUursoortOption(text) {
  const c = clean(text);
  if (!c || c.length < 2) return true;
  if (/^(onlangs gebruikt|geadviseerd|toegestaan)$/.test(c)) return true;
  if (c === 'uursoort' || c === 'uursoorten' || c === 'toeslag' || c === 'titel' || c === 'labels' || c === 'locatie' || c === 'notities') return true;
  if (CONFIG.uursoortIgnore.some((ig) => c.includes(ig))) return true;
  if (/^(bekijk agenda|toon|toont|selecteer|zoek naar|geen resultaten)/i.test(c)) return true;
  if (/verwijder uit selectie|client|medewerker|toevoegen|niet beschikbaar|annuleren|opslaan/i.test(c)) return true;
  if (/jg\s*jeugd\s*&\s*gezin|jeugd\s*&\s*gezin|jeugd\s+en\s+gezin/.test(c)) return true;
  if (/j\s*&\s*g\s+(kracht|zoetermeer)|\bjg\s+(kracht|zoetermeer)\b/.test(c)) return true;
  return false;
}
function looksLikeUursoortOption(text) {
  const c = clean(text);
  if (invalidUursoortOption(text)) return false;
  if (allNonClientHourTypes().some((name) => {
    const wanted = clean(name);
    const loose = clean(String(name || '').replace(/\*+$/, ''));
    return c === wanted || (!!loose && c === loose);
  })) return true;
  if (/\b(ggz|ambulant|hbo|mbo|behandeling|diagnostiek|verslaglegging|zorgcoordinatie|no show|factuur|mdo|huisbezoek|digitaal|telefonisch|mail)\b/.test(c)) return true;
  if (/[#]/.test(text)) return true;
  return false;
}
export function optionCandidates(root) {
  const selector = '[role="option"], li, button, [class*="option" i], [data-value], [data-id]';
  const raw = deepQueryAll(selector, root).filter((o) => visible(o) && !isOwnPopup(o));
  const fallback = deepQueryAll('div,span', root).filter((o) => visible(o) && !isOwnPopup(o));
  const pool = [...raw, ...fallback];
  const out = [];
  const seen = new Set();
  for (const o of pool) {
    if (/input|textarea|select/i.test(o.tagName || '')) continue;
    if (hasNestedOptionNode(o, selector)) continue;
    const t = optionText(o);
    const c = clean(t);
    if (!looksLikeUursoortOption(t) || seen.has(c)) continue;
    const r = rect(o);
    if (r.width < 80 || r.height < 18 || r.height > 90) continue;
    seen.add(c); out.push(o);
  }
  return out;
}
function collectUursoortOptionTexts(trigger) {
  const seen = new Set(); const out = [];
  for (const root of optionSearchRoots(trigger)) {
    for (const o of optionCandidates(root)) {
      pushUniqueText(out, seen, optionText(o).trim(), looksLikeUursoortOption);
    }
    for (const o of genericOptionCandidates(root)) {
      pushUniqueText(out, seen, optionText(o).trim(), looksLikeUursoortOption);
    }
    const rootText = optionText(root);
    pushUniqueText(out, seen, rootText, looksLikeUursoortOption);
  }
  return out.slice(0, 25);
}
function clientUursoortListbox(trigger) {
  if (!trigger) return null;
  const local = deepQueryAll('[role="listbox"], ul[part="list"]', trigger)
    .find((el) => visible(el) && !isOwnPopup(el));
  if (local) return local;
  for (const root of optionSearchRoots(trigger)) {
    if (root.matches && root.matches('[role="listbox"], ul[part="list"]') && visible(root)) return root;
    const nested = deepQueryAll('[role="listbox"], ul[part="list"]', root)
      .find((el) => visible(el) && !isOwnPopup(el));
    if (nested) return nested;
  }
  return null;
}
export function collectClientUursoortOptionTexts(trigger) {
  const out = []; const seen = new Set();
  // Als er een echte open uursoort-lijst is (role="listbox"), ALLEEN daarbinnen
  // scannen. Zo komen agenda-/paneelelementen ACHTER de modal (bv. een collega-
  // agenda "… Informatie niet delen / Toon alleen deze agenda") niet als optie mee.
  // Alleen zonder herkende lijst vallen we terug op de bredere optionSearchRoots.
  const listbox = clientUursoortListbox(trigger);
  const roots = listbox ? [listbox] : optionSearchRoots(trigger);
  for (const root of roots) {
    const nodes = deepQueryAll('[role="option"], li, [data-value]', root)
      .filter((el) => visible(el) && !isOwnPopup(el));
    for (const node of nodes) {
      if (hasNestedOptionNode(node, '[role="option"], li, [data-value]')) continue;
      if (containsSeparateActionText(node)) continue; // geen agenda-/paneelkaart achter de modal
      const text = optionText(node).replace(/\s+/g, ' ').trim();
      const r = rect(node);
      if (r.width < 60 || r.height < 16 || r.height > 100) continue;
      for (const part of splitUursoortCategoryText(text)) {
        if (invalidUursoortOption(part)) continue;
        const key = clean(part);
        if (!key || seen.has(key)) continue;
        seen.add(key); out.push(part);
      }
    }
  }
  // Zodra echte losse opties gevonden zijn, mag de tekst van de bovenliggende
  // virtuele lijst niet nogmaals worden verwerkt: die bevat dezelfde opties
  // aaneengeregen en veroorzaakte de lange herhalingsknop.
  if (out.length) return out;
  // Alleen als er geen losse option-elementen bestaan: gebruik tekstsplitsing
  // als vangnet voor oudere/afwijkende ONS-varianten.
  collectUursoortOptionTexts(trigger).forEach((text) => {
    for (const part of splitUursoortCategoryText(text)) {
      const key = clean(part);
      if (key && !seen.has(key)) { seen.add(key); out.push(part); }
    }
  });
  return out;
}
// Uursoorten worden door ONS gevirtualiseerd: slechts enkele regels bestaan
// tegelijk in de DOM. Scan daarom de hele lijst en verzamel elke gerenderde
// optie, ook wanneer die pas na scrollen zichtbaar wordt.
export function scanClientUursoortOptions(trigger, onDone) {
  const found = []; const seen = new Set();
  const collect = () => {
    collectClientUursoortOptionTexts(trigger).forEach((text) => {
      const key = clean(text);
      if (key && !seen.has(key)) { seen.add(key); found.push(text); }
    });
  };
  collect();
  const listbox = clientUursoortListbox(trigger);
  if (!listbox) { onDone(found); return; }
  const max = Math.max(0, (listbox.scrollHeight || 0) - (listbox.clientHeight || 0));
  const step = Math.max(90, Math.round((listbox.clientHeight || 150) * 0.8));
  const positions = [];
  for (let y = 0; y < max; y += step) positions.push(y);
  positions.push(max);
  let index = 0;
  const next = () => {
    if (index >= positions.length) {
      try { listbox.scrollTop = 0; listbox.dispatchEvent(new Event('scroll', { bubbles: true, composed: true })); } catch (e) {}
      onDone(found.slice(0, 100));
      return;
    }
    try {
      listbox.scrollTop = positions[index++];
      listbox.dispatchEvent(new Event('scroll', { bubbles: true, composed: true }));
    } catch (e) { index++; }
    setTimeout(() => { collect(); next(); }, 75);
  };
  next();
}
