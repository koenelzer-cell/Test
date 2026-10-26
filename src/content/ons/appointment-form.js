// Het ONS-afspraakformulier lezen: velden (titel, label, datum, tijden,
// reistijd, herhaling) en cliëntkaarten vinden. Alleen zoeken, niets wijzigen;
// de features gebruiken dit om velden te vullen.

import { ONS } from './selectors.js';
import { CONFIG } from '../config/app-config.js';
import { overrideAll, overrideEl, UI_OVERRIDES } from './selector-overrides.js';
import { area, clean, deepQueryAll, isOwnPopup, rect, visible } from './dom.js';
import { clickBoxFor, findOpener, firstByDataQa, inputTextValue, isUsableBox, uiText } from './form-controls.js';
import { firstNameFromName as voornaamUitNaam } from '../../shared/namen.js';
import { findModal } from './modal.js';

export function getEtiketTrigger() {
  if (CONFIG.etiketFieldSelector) { const f = document.querySelector(CONFIG.etiketFieldSelector); if (f) return f; }
  // Eerst de stabiele ONS-haak data-qa="label_select"; tekst/geometrie als fallback.
  const byQa = firstByDataQa('label_select');
  if (byQa) return byQa;
  const t = findOpener({ placeholderRe: /label|etiket/i, displayTexts: ['zoek naar labels', 'zoek naar etiketten'], labelTexts: ['labels', 'label', 'etiket', 'etiketten'] });
  return t;
}
export function findClientUursoortTrigger() {
  const clientLabels = deepQueryAll('div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'client');
  let best = null, bestScore = Infinity;
  for (const clientLabel of clientLabels) {
    const cr = rect(clientLabel);
    for (const label of deepQueryAll('label,div,span,p')) {
      if (!visible(label) || isOwnPopup(label) || clean(label.textContent) !== 'uursoort') continue;
      const lr = rect(label);
      if (lr.top < cr.bottom - 2 || lr.top > cr.bottom + 110) continue;
      if (Math.abs(lr.left - cr.left) > 80) continue;
      for (const el of deepQueryAll('input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,[class*="select" i],div,span')) {
        if (!visible(el) || isOwnPopup(el)) continue;
        const box = clickBoxFor(el);
        if (!isUsableBox(box)) continue;
        const br = rect(box);
        if (br.top < lr.bottom - 6 || br.top - lr.bottom > 70) continue;
        if (Math.abs(br.left - lr.left) > 80) continue;
        const score = (br.top - lr.bottom) * 20 + Math.abs(br.left - lr.left) + area(box) / 1000;
        if (score < bestScore) { best = box; bestScore = score; }
      }
    }
  }
  return best;
}
export function getTitleInputSafe() {
  try { return getTitleInput(); } catch (e) { return null; }
}
export function getUursoortTrigger() {
  if (CONFIG.uursoortFieldSelector) { const f = document.querySelector(CONFIG.uursoortFieldSelector); if (f) return f; }
  const t = findClientUursoortTrigger() || findOpener({ placeholderRe: /uursoort|hour type/i, displayTexts: ['zoek naar uursoorten'], labelTexts: ['uursoort', 'uursoorten', 'hour type'] });
  return t;
}
export function getTitleInput() {
  const ov = overrideEl('afsTitel'); if (ov) return ov;
  const labels = deepQueryAll('label,div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'titel');
  let best = null, bestScore = Infinity;
  for (const label of labels) {
    const lr = rect(label);
    for (const inp of deepQueryAll('input,textarea')) {
      if (!visible(inp) || isOwnPopup(inp)) continue;
      const r = rect(inp);
      if (r.top < lr.bottom - 6 || r.top - lr.bottom > 90) continue;
      if (Math.abs(r.left - lr.left) > 120) continue;
      const score = (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
      if (score < bestScore) { best = inp; bestScore = score; }
    }
  }
  if (best) return best;
  const byAttr = deepQueryAll('input,textarea').find((inp) => {
    if (!visible(inp) || isOwnPopup(inp)) return false;
    const text = clean([
      inp.getAttribute('aria-label'),
      inp.getAttribute('placeholder'),
      inp.getAttribute('name'),
      inp.getAttribute('id'),
      inp.getAttribute('title'),
    ].filter(Boolean).join(' '));
    return /\btitel\b/.test(text);
  });
  if (byAttr) return byAttr;
  const details = deepQueryAll('h1,h2,h3,div,span,p')
    .find((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent) === 'afspraakdetails');
  if (details) {
    const dr = rect(details);
    return deepQueryAll('input,textarea')
      .filter((inp) => visible(inp) && !isOwnPopup(inp))
      .filter((inp) => {
        const r = rect(inp);
        return r.top > dr.bottom && r.top - dr.bottom < 160 && Math.abs(r.left - dr.left) < 180;
      })
      .sort((a, b) => rect(a).top - rect(b).top)[0] || null;
  }
  return best;
}
export function getDateInput() {
  const ov = overrideEl('afsDatum'); if (ov) return ov;
  const host = deepQueryAll('uc-date-input[aria-label="Datum*"], uc-date-input[aria-label="Datum"]')
    .find((el) => visible(el) && !isOwnPopup(el));
  if (host && host.shadowRoot) {
    const inp = deepQueryAll('input', host.shadowRoot).find((i) => visible(i) && !isOwnPopup(i));
    if (inp) return inp;
  }
  return deepQueryAll('input').find((inp) => {
    if (!visible(inp) || isOwnPopup(inp)) return false;
    const label = clean(inp.getAttribute('aria-label') || '');
    const placeholder = clean(inp.getAttribute('placeholder') || '');
    return label === 'datum*' || label === 'datum' || placeholder === 'dd-mm-jjjj';
  }) || null;
}
// Zoek de input binnen een uc-time-input host op basis van aria-label.
function ucTimeInputFor(labelPattern) {
  for (const host of deepQueryAll('uc-time-input')) {
    if (!visible(host) || isOwnPopup(host)) continue;
    if (!labelPattern.test(clean(host.getAttribute('aria-label') || ''))) continue;
    if (host.shadowRoot) {
      const inp = host.shadowRoot.querySelector('input[placeholder="uu:mm"]') || host.shadowRoot.querySelector('input');
      if (inp) return inp;
    }
  }
  return null;
}
export function getStartTimeInput() {
  const ov = overrideEl('afsBegintijd'); if (ov) return ov;
  // Directe lookup via uc-time-input[aria-label^="Begintijd"]
  const direct = ucTimeInputFor(/^begintijd/);
  if (direct) return direct;
  // Fallback: visueel label
  const labels = deepQueryAll('label,div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && /^begintijd\*?$/.test(clean(el.textContent || '')));
  let best = null, bestScore = Infinity;
  for (const label of labels) {
    const lr = rect(label);
    for (const inp of deepQueryAll('input')) {
      if (!visible(inp) || isOwnPopup(inp)) continue;
      if (clean(inp.getAttribute('placeholder') || '') !== 'uu:mm') continue;
      const r = rect(inp);
      if (r.top < lr.bottom - 8 || r.top - lr.bottom > 90) continue;
      if (Math.abs(r.left - lr.left) > 120) continue;
      const score = (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
      if (score < bestScore) { best = inp; bestScore = score; }
    }
  }
  if (best) return best;
  return timeInputsInOrder()[0] || null;
}
export function getEndTimeInput() {
  const ov = overrideEl('afsEindtijd'); if (ov) return ov;
  const startInput = getStartTimeInput();
  // Directe lookup via uc-time-input[aria-label^="Eindtijd"]
  const direct = ucTimeInputFor(/^eindtijd/);
  if (direct && direct !== startInput) return direct;
  // Fallback: visueel label
  const startRect = startInput ? rect(startInput) : null;
  const labels = deepQueryAll('label,div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && /^eindtijd\*?$/.test(clean(el.textContent || '')));
  let best = null, bestScore = Infinity;
  for (const label of labels) {
    const lr = rect(label);
    for (const inp of deepQueryAll('input')) {
      if (!visible(inp) || isOwnPopup(inp)) continue;
      if (startInput && inp === startInput) continue;
      const meta = clean(`${inp.getAttribute('placeholder') || ''} ${inp.getAttribute('aria-label') || ''} ${inp.getAttribute('inputmode') || ''}`);
      const value = inputTextValue(inp);
      if (!/uu:mm|time|tijd|numeric/.test(meta) && !/^(\d{1,2}):(\d{2})$/.test(value)) continue;
      const r = rect(inp);
      if (r.top < lr.bottom - 16 || r.top - lr.bottom > 110) continue;
      if (Math.abs(r.left - lr.left) > 220) continue;
      if (startRect && Math.abs(r.top - startRect.top) < 24 && Math.abs(r.left - startRect.left) < 24) continue;
      const score = (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
      if (score < bestScore) { best = inp; bestScore = score; }
    }
  }
  if (best) return best;
  const ordered = timeInputsInOrder().filter((inp) => !startInput || inp !== startInput);
  if (startRect) {
    const rightOfStart = ordered.find((inp) => {
      const r = rect(inp);
      return Math.abs(r.top - startRect.top) < 40 && r.left > startRect.left + 40;
    });
    if (rightOfStart) return rightOfStart;
  }
  return ordered[1] || null;
}
function timeInputsInOrder() {
  return deepQueryAll('input')
    .filter((inp) => visible(inp) && !isOwnPopup(inp) && clean(inp.getAttribute('placeholder') || '') === 'uu:mm')
    .sort((a, b) => {
      const ar = rect(a), br = rect(b);
      return Math.abs(ar.top - br.top) > 8 ? ar.top - br.top : ar.left - br.left;
    });
}
export function findClientNameText() {
  const inviteeNames = deepQueryAll(UI_OVERRIDES.afsClientName || 'span[class*="_invitee-name_"], ._invitee-name_sohx9_40')
    .filter((el) => visible(el) && !isOwnPopup(el));
  for (const nameEl of inviteeNames) {
    const txt = (nameEl.textContent || '').replace(/\s+/g, ' ').trim();
    if (!txt) continue;
    const nr = rect(nameEl);
    const role = deepQueryAll('div,span,p').find((el) => {
      if (!visible(el) || isOwnPopup(el) || clean(el.textContent) !== 'client') return false;
      const rr = rect(el);
      return rr.top >= nr.bottom - 8 && rr.top <= nr.bottom + 45 && Math.abs(rr.left - nr.left) <= 130;
    });
    if (role) return txt;
    let n = nameEl.parentElement;
    for (let depth = 0; n && depth < 5; depth++, n = n.parentElement) {
      const r = rect(n);
      const t = clean(n.textContent || '');
      if (r.height <= 180 && t.includes('client') && !t.includes('medewerker')) return txt;
    }
  }
  return '';
}
// Voornaam/aanhef uit een cliëntnaam: de regel staat in src/shared/namen.js
// (ook de main-world gebruikt hem).
export function firstNameFromName(name) { return voornaamUitNaam(name); }
// ÉÉN bron voor de gekozen labels. In de huidige ONS-UI is elke chip een
// <button class="label-tag" aria-label="Verwijder label <naam>"> binnen
// <div class="label-tags" data-qa="label_tags">; de button ZELF is de
// verwijderknop (één klik = label weg). Val terug op <uc-tag deletable> (oudere
// UI). Geeft [{ el, name }] terug met name = schoongemaakte labelnaam.
export function labelChips(trigger) {
  const tr = trigger ? rect(trigger) : null;
  const inField = (el) => {
    if (!tr) return true;
    const r = rect(el);
    return !(r.bottom < tr.top - 40 || r.top > tr.bottom + 90 || r.left < tr.left - 90 || r.right > tr.right + 200);
  };
  const out = [];
  const seen = new Set();
  const add = (el, rawName) => {
    if (!el || seen.has(el)) return;
    const name = clean(rawName || '').replace(/^verwijder label\s+/, '');
    if (!name) return;
    seen.add(el);
    out.push({ el: el, name: name });
  };
  // Low-code herstel: staat er voor de labelchips een herstelde selector in de
  // beheerconfig (sleutel 'afsLabelChips'), gebruik dan die elementen
  // rechtstreeks — geen geometrie/naam-heuristiek nodig.
  const ov = overrideAll('afsLabelChips');
  const source = (ov && ov.length)
    ? ov
    : deepQueryAll('button[aria-label^="Verwijder label" i], .label-tags button, [data-qa="label_tags"] button');
  for (const btn of source) {
    if (!visible(btn) || isOwnPopup(btn)) continue;
    if (!(ov && ov.length) && !inField(btn)) continue; // bij heuristiek: dicht bij het labelveld
    const al = btn.getAttribute('aria-label') || '';
    const m = /verwijder label\s+(.+)$/i.exec(al);
    add(btn, m ? m[1] : (btn.textContent || ''));
  }
  // Fallback: oudere UI met <uc-tag deletable> (verwijderknop in de shadow-root).
  if (!out.length && !(ov && ov.length)) {
    for (const tag of deepQueryAll(ONS.ucTagDeletable)) {
      if (!visible(tag) || isOwnPopup(tag) || !inField(tag)) continue;
      const btn = tag.shadowRoot && (tag.shadowRoot.querySelector('button') || tag.shadowRoot.querySelector('[part="button"]'));
      add(btn || tag, tag.textContent || '');
    }
  }
  return out;
}
export function appointmentTravelInput(kind) {
  const ov = overrideEl(kind === 'heen' ? 'afsTravelBefore' : 'afsTravelAfter'); if (ov) return ov;
  const wanted = kind === 'heen' ? 'reistijd heen' : 'reistijd terug';
  const labels = deepQueryAll('label,div,span,p').filter((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent || '') === wanted);
  let best = null, bestScore = Infinity;
  for (const label of labels) {
    const lr = rect(label);
    for (const inp of deepQueryAll('input')) {
      if (!visible(inp) || isOwnPopup(inp)) continue;
      const meta = clean(`${inp.getAttribute('placeholder') || ''} ${inp.getAttribute('inputmode') || ''} ${inp.getAttribute('aria-label') || ''} ${inp.getAttribute('role') || ''}`);
      if (!/min|decimal|spinbutton|reistijd/.test(meta)) continue;
      const r = rect(inp);
      if (r.top < lr.bottom - 18 || r.top > lr.bottom + 120 || Math.abs(r.left - lr.left) > 240) continue;
      const score = Math.abs(r.top - lr.bottom) * 4 + Math.abs(r.left - lr.left);
      if (score < bestScore) { best = inp; bestScore = score; }
    }
  }
  if (best) return best;
  const allDirect = deepQueryAll('input').filter((inp) => {
    if (isOwnPopup(inp)) return false;
    const label = clean(inp.getAttribute('aria-label') || '');
    const placeholder = clean(inp.getAttribute('placeholder') || '');
    return label === wanted && (!placeholder || placeholder === 'min');
  });
  const direct = allDirect.find((inp) => visible(inp) && (/decimal/i.test(inp.getAttribute('inputmode') || '') || /spinbutton/i.test(inp.getAttribute('role') || ''))) ||
    allDirect.find(visible) ||
    allDirect[0];
  if (direct) return direct;
  const host = deepQueryAll('[aria-label]').find((el) => !isOwnPopup(el) && clean(el.getAttribute('aria-label') || '') === wanted);
  if (host && host.shadowRoot) {
    const inner = deepQueryAll('input', host.shadowRoot).find((inp) => !isOwnPopup(inp));
    if (inner) return inner;
  }
  return null;
}
function clientCardFor(nameEl, role, nextTop) {
  const nr = rect(nameEl);
  const wantedName = clean(nameEl.textContent || '');
  // De kaart mag niet doorlopen tot in de volgende client; daarmee
  // voorkomen we dat de bovenste client een kaart krijgt die ook de
  // velden van de volgende client (en dus een verkeerde trigger) bevat.
  const bottomLimit = Number.isFinite(nextTop) ? nextTop - 2 : Infinity;
  let best = null, bestScore = Infinity;
  let n = nameEl.parentElement;
  for (let depth = 0; n && n !== document.body && depth < 14; depth++, n = n.parentElement) {
    if (!visible(n) || isOwnPopup(n)) continue;
    const r = rect(n);
    const t = clean(n.textContent || '');
    if (!t.includes(wantedName) || !t.includes('client')) continue;
    if (r.width < 260 || r.width > 900 || r.height < 42 || r.height > 620) continue;
    if (r.right < nr.left + 280 || r.top > nr.top + 4 || r.bottom < rect(role).bottom) continue;
    if (r.bottom > bottomLimit) continue; // reikt tot in de volgende client -> afwijzen
    const fieldBonus = t.includes('uursoort') ? -90000 : 0;
    const staffPenalty = t.includes('medewerker') ? 350000 : 0;
    const score = area(n) + depth * 1000 + staffPenalty + fieldBonus;
    if (score < bestScore) { best = n; bestScore = score; }
  }
  return best;
}
function findUursoortTriggerForClient(entry, nextTop) {
  const roleRect = rect(entry.role);
  const upper = Number.isFinite(nextTop) ? Math.max(roleRect.bottom + 40, nextTop - 10) : roleRect.bottom + 280;
  // Als er een geldige clientkaart is, ALLEEN daarbinnen zoeken. Het uursoort-veld
  // hoort altijd in de kaart van de client; terugvallen op document pakt anders
  // soms een veld van een andere client of iets achter de modal.
  const cardRect = entry.card ? rect(entry.card) : null;
  const insideCard = (r) => !cardRect ||
    (r.top >= cardRect.top - 4 && r.bottom <= cardRect.bottom + 4 &&
     r.left >= cardRect.left - 4 && r.right <= cardRect.right + 4);
  const roots = entry.card ? [entry.card] : [document];
  let best = null, bestScore = Infinity;
  for (const root of roots) {
    for (const label of deepQueryAll('label,div,span,p', root)) {
      if (!visible(label) || isOwnPopup(label) || clean(label.textContent) !== 'uursoort') continue;
      const lr = rect(label);
      if (lr.top < roleRect.bottom - 4 || lr.top > upper) continue;
      if (Math.abs(lr.left - roleRect.left) > 120) continue;
      if (!insideCard(lr)) continue;
      for (const el of deepQueryAll('input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,[class*="select" i],div,span', root)) {
        if (!visible(el) || isOwnPopup(el)) continue;
        const box = clickBoxFor(el);
        if (!isUsableBox(box)) continue;
        const br = rect(box);
        if (br.top < lr.bottom - 8 || br.top - lr.bottom > 95 || br.top > upper) continue;
        if (Math.abs(br.left - lr.left) > 110) continue;
        if (!insideCard(br)) continue;
        const text = clean(uiText(box));
        if (/toeslag|verwijder uit selectie|niet beschikbaar|clienten zijn aanwezig|toevoegen/.test(text)) continue;
        const score = (br.top - lr.bottom) * 25 + Math.abs(br.left - lr.left) + area(box) / 1000;
        if (score < bestScore) { best = box; bestScore = score; }
      }
    }
  }
  return best;
}
let _clientEntriesCache = null, _clientEntriesAt = 0;
const CLIENT_ENTRIES_TTL = 250; // ms
export function invalidateClientEntries() { _clientEntriesCache = null; }
export function findClientEntries() {
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (_clientEntriesCache && (now - _clientEntriesAt) < CLIENT_ENTRIES_TTL) return _clientEntriesCache;
  const res = _findClientEntriesUncached();
  _clientEntriesCache = res; _clientEntriesAt = now;
  return res;
}
// Nieuwe ONS-modal: iedere cliënt staat in een eigen li onder
// ul._selected-clients_*. Gebruik deze structurele relatie als primaire route;
// zo is Afspraakhulp niet afhankelijk van afstanden/afmetingen op het scherm.
function findClientEntriesFromModalStructure() {
  // Low-code herstel: cliëntlijst-rijen via de beheerconfig (sleutel 'afsClientList').
  const ovRows = overrideAll('afsClientList');
  const rows = (ovRows && ovRows.length)
    ? ovRows
    : deepQueryAll('ul[class*="_selected-clients_"] > li, ul[data-qa="selected_clients"] > li')
      .filter((row) => visible(row) && !isOwnPopup(row));
  const entries = [];
  const seen = new Set();
  for (const row of rows) {
    const nameEl = deepQueryAll(UI_OVERRIDES.afsClientName || 'span[class*="_invitee-name_"], [class*="_invitee-name_"]', row)
      .find((el) => visible(el) && !isOwnPopup(el) && (el.textContent || '').trim());
    if (!nameEl) continue;
    const name = (nameEl.textContent || '').replace(/\s+/g, ' ').trim();
    const key = clean(name);
    if (!key || seen.has(key)) continue;
    const role = deepQueryAll('div,span,p', row)
      .find((el) => visible(el) && !isOwnPopup(el) && clean(el.textContent || '') === 'client') || nameEl;
    const toggle = deepQueryAll(UI_OVERRIDES.afsInviteeToggle || '[data-qa="toggle-invitee-fields-button"]', row)
      .find((el) => visible(el) && !isOwnPopup(el)) || null;
    let uursoortTrigger = deepQueryAll('uc-select[data-qa="hour_type_select"], [data-qa="hour_type_select"]', row)
      .find((el) => visible(el) && !isOwnPopup(el)) || null;
    seen.add(key);
    const entry = {
      name,
      firstName: firstNameFromName(name),
      nameEl,
      role,
      toggle,
      card: row,
      clientId: row.getAttribute('data-invitee-id') || row.getAttribute('data-client-id') || row.getAttribute('data-patient-id') || null,
      uursoortTrigger,
    };
    // Fallback: een leeg uursoort-veld ("Zoek naar uursoorten") heeft niet altijd
    // data-qa="hour_type_select". Zonder deze fallback blijft de trigger van zo'n
    // cliënt leeg en slaat de wachtrij hem over.
    if (!entry.uursoortTrigger) entry.uursoortTrigger = findUursoortTriggerForClient(entry, Infinity);
    entries.push(entry);
  }
  return entries;
}
// Betrouwbare "heeft deze cliënt al een uursoort?"-check op STABIELE signalen
// (geen geometrie meer). Bewezen uit de ONS-DOM:
//  1) een gekozen uursoort verschijnt als light-DOM samenvatting in de kaart
//     (div[slot="sub"] > [class*="_summary_"]); een leeg veld heeft die niet.
//  2) backup: de uc-select-combobox houdt class "placeholder" zolang leeg.
// De uursoort zoals die in de cliëntkaart staat (de samenvatting die ONS toont
// zodra er iets gekozen is). Leeg als er nog niets staat.
export function entryUursoortText(entry) {
  if (!entry || !entry.card) return '';
  const summary = deepQueryAll('[class*="_summary_"]', entry.card)
    .find((el) => !isOwnPopup(el) && clean(el.textContent || ''));
  return summary ? (summary.textContent || '').replace(/\s+/g, ' ').trim() : '';
}
export function entryUursoortIsSet(entry) {
  if (!entry) return false;
  if (entry.card) {
    const summary = deepQueryAll('[class*="_summary_"]', entry.card)
      .find((el) => !isOwnPopup(el) && clean(el.textContent || ''));
    if (summary) return true;
  }
  const trg = entry.uursoortTrigger;
  if (trg) {
    const combo = (trg.shadowRoot && trg.shadowRoot.querySelector('[role="combobox"]')) ||
      deepQueryAll('[role="combobox"]', trg).find((el) => !isOwnPopup(el));
    if (combo) {
      const isPlaceholder = combo.classList.contains('placeholder');
      // Signaal 3 (bevestigd uit snapshots, gelijk aan agendaModel-reader):
      // de geneste uc-select-list draagt value="" zolang leeg, value="713" e.d.
      // zodra gekozen. Defensieve OR: niet-placeholder + niet-lege value = gezet.
      const listEl = deepQueryAll('uc-select-list', trg).find((el) => !isOwnPopup(el)) ||
        (entry.card && deepQueryAll('uc-select-list', entry.card).find((el) => !isOwnPopup(el)));
      const val = listEl ? (listEl.getAttribute('value') || '') : '';
      if (!isPlaceholder && val) return true;
      return !isPlaceholder;
    }
  }
  return false;
}
function _findClientEntriesUncached() {
  const structural = findClientEntriesFromModalStructure();
  if (structural.length) return structural;
  const nameEls = deepQueryAll('span[class*="_invitee-name_"], ._invitee-name_sohx9_40')
    .filter((el) => visible(el) && !isOwnPopup(el));
  const toggles = deepQueryAll(UI_OVERRIDES.afsInviteeToggle || 'uc-button[data-qa="toggle-invitee-fields-button"], [data-qa="toggle-invitee-fields-button"]')
    .filter((btn) => visible(btn) && !isOwnPopup(btn));
  const basics = [];
  const seen = new Set();
  for (const nameEl of nameEls) {
    const name = (nameEl.textContent || '').replace(/\s+/g, ' ').trim();
    if (!name || seen.has(name)) continue;
    const nr = rect(nameEl);
    const role = deepQueryAll('div,span,p').find((el) => {
      if (!visible(el) || isOwnPopup(el) || clean(el.textContent) !== 'client') return false;
      const rr = rect(el);
      return rr.top >= nr.bottom - 8 && rr.top <= nr.bottom + 48 && Math.abs(rr.left - nr.left) <= 150;
    });
    if (!role) continue;
    const toggle = toggles.find((btn) => clean(btn.getAttribute('aria-label') || '').includes(clean(name))) ||
      toggles
        .map((btn) => ({ btn, r: rect(btn) }))
        .filter(({ r }) => r.left > nr.left + 240 && r.top >= nr.top - 90 && r.top <= nr.top + 90)
        .sort((a, b) => Math.abs((a.r.top + a.r.height / 2) - (nr.top + nr.height / 2)) - Math.abs((b.r.top + b.r.height / 2) - (nr.top + nr.height / 2)))[0]?.btn || null;
    seen.add(name);
    basics.push({ name, firstName: firstNameFromName(name), nameEl, role, toggle });
  }
  const sorted = basics.sort((a, b) => rect(a.nameEl).top - rect(b.nameEl).top || rect(a.nameEl).left - rect(b.nameEl).left);
  return sorted.map((entry, index) => {
    const next = sorted[index + 1];
    const nextTop = next ? rect(next.nameEl).top : Infinity;
    const card = clientCardFor(entry.nameEl, entry.role, nextTop);
    const clientId = (card && (card.getAttribute('data-invitee-id') || card.getAttribute('data-client-id') || card.getAttribute('data-patient-id'))) || null;
    const withCard = { ...entry, card, clientId };
    return { ...withCard, uursoortTrigger: findUursoortTriggerForClient(withCard, nextTop) };
  });
}
// ---- Herhaling / doorplannen ------------------------------------------------
// De 'Herhaling'-accordeonkop in de ONS-afspraakmodal. De hashed klassen
// (_header_186fh_22) zijn buildafhankelijk, dus we matchen op de zichtbare
// titeltekst "Herhaling" van een uitklapknop (met herstelde selector uit de beheerconfig).
export function findRecurrenceHeader() {
  const ov = overrideEl('recurrenceHeader'); if (ov) return ov;
  const btns = deepQueryAll('button[aria-expanded]').filter((b) => visible(b) && !isOwnPopup(b));
  for (const b of btns) {
    let spans; try { spans = b.querySelectorAll('span'); } catch (e) { continue; }
    for (const s of spans) if (clean(s.textContent) === 'herhaling') return b;
  }
  return null;
}
// Het recurrence-type keuzeveld (<uc-form-field data-qa="recurrence-type">) dat
// na het uitklappen van 'Herhaling' verschijnt. Dit is het veld dat we roze
// markeren en waaruit we de gekozen waarde lezen (met herstelde selector uit de beheerconfig).
export function findRecurrenceField() {
  const ovSel = UI_OVERRIDES.recurrenceType;
  return (ovSel ? deepQueryAll(ovSel) : deepQueryAll('[data-qa="recurrence-type"]')).find((el) => visible(el) && !isOwnPopup(el)) || null;
}
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
