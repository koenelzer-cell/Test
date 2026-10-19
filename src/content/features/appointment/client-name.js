// Cliëntnaam uit het formulier en de voornaam in de titel.

import { clean, isOwnPopup, rect, visible } from '../../ons/dom.js';
import { setInputText } from '../../ons/form-controls.js';
import {
  findClientEntries,
  findClientNameText,
  firstNameFromName,
  getTitleInput,
} from '../../ons/appointment-form.js';
import { deepQueryAll } from '../../ons/dom.js';
import { leesFormulier } from '../../ons/form-model.js';
import { zetTitelAsync } from './title.js';

export function findClientFirstName() {
  const directName = findClientNameText();
  if (directName) return firstNameFromName(directName);
  const labels = deepQueryAll('div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'client');
  let best = null, bestScore = Infinity;
  for (const label of labels) {
    const lr = rect(label);
    for (const el of deepQueryAll('div,span,p,strong,b')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const c = clean(txt);
      if (!txt || c === 'client' || c.includes('clienten') || c.includes('medewerker') || c.includes('uursoort')) continue;
      if (txt.length > 60 || txt.split(/\s+/).length > 4) continue;
      const r = rect(el);
      if (r.bottom < lr.top - 55 || r.bottom > lr.top + 8) continue;
      if (Math.abs(r.left - lr.left) > 120) continue;
      const score = Math.abs(lr.top - r.bottom) + Math.abs(lr.left - r.left) / 4;
      if (score < bestScore) { best = txt; bestScore = score; }
    }
  }
  return best ? firstNameFromName(best) : '';
}
export function findClientFirstNames() {
  const names = [];
  const seen = new Set();
  for (const entry of findClientEntries()) {
    const first = entry.firstName || firstNameFromName(entry.name);
    const key = clean(first);
    if (first && !seen.has(key)) { seen.add(key); names.push(first); }
  }
  if (!names.length) {
    const first = findClientFirstName();
    if (first) names.push(first);
  }
  return names;
}
// Voornamen van de cliënten: eerst uit het afspraakmodel van het formulier
// (main-world, betrouwbaar); lukt dat niet, dan uit de cliëntkaarten.
export function clientVoornamenAsync(wachtMs) {
  return leesFormulier(wachtMs || 600).then((f) => {
    const uitModel = [];
    ((f && f.clients) || []).forEach((c) => {
      if (c.voornaam && !uitModel.some((n) => clean(n) === clean(c.voornaam))) uitModel.push(c.voornaam);
    });
    return uitModel.length ? uitModel : findClientFirstNames();
  }, () => findClientFirstNames());
}
export function setTitleForChoice(choice, onResult) {
  if (!getTitleInput()) { onResult(false); return; }
  clientVoornamenAsync().then((firstNames) => {
    const input = getTitleInput();
    if (!input) { onResult(false); return; }
    const titleBase = choice.titleLabel || choice.label;
    const title = firstNames.length ? `${titleBase} - ${firstNames.join(' - ')}` : titleBase;
    zetTitelAsync(title).then(() => onResult(true), () => { setInputText(input, title); onResult(true); });
  });
}
// Haal de voornaam van een verwijderde cliënt uit de titel. De titel is
// opgebouwd als "Basis - Voornaam1 - Voornaam2"; we houden het eerste segment
// (de basis) altijd, en verwijderen segmenten die gelijk zijn aan de voornaam.
export function removeFirstNameFromTitle(first) {
  if (!first) return;
  const input = getTitleInput(); if (!input) return;
  const t = String(input.value || '');
  if (!t) return;
  const parts = t.split(' - ');
  if (parts.length < 2) return; // alleen basis, geen namen om te verwijderen
  const target = clean(first);
  const kept = parts.filter((p, i) => i === 0 || clean(p) !== target);
  if (kept.length !== parts.length) {
    const n = kept.join(' - ');
    if (n !== t) setInputText(input, n);
  }
}
