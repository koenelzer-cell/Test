// Afspraaklabels zetten en opruimen.

import { clean, isOwnPopup, pollFor, rect, visible } from '../../ons/dom.js';
import {
  clickElementCenter,
  clickOption,
  findExactDropdownOption,
  genericOptionCandidates,
  optionSearchRoots,
  optionText,
  searchInputForTrigger,
  setInputText,
  uiText,
} from '../../ons/form-controls.js';
import { getEtiketTrigger, labelChips } from '../../ons/appointment-form.js';
import { eerstViaFormulier, wisLabelsViaFormulier, zetLabelsViaFormulier } from '../../ons/form-model.js';
import { wachtTot } from '../../core/wacht.js';
import { clickEmptyModalSpot, rowForOptionText } from '../../ons/interaction.js';
import { setStatus } from '../../screen/status.js';

export function selectedKnownLabels(trigger, labels) {
  const known = labels.map(clean).filter(Boolean);
  const found = new Set();
  const chips = labelChips(trigger);
  if (chips.length) {
    for (const chip of chips) {
      for (const label of known) if (chip.name === label || chip.name.indexOf(label) !== -1) found.add(label);
    }
    return [...found];
  }
  // Fallback als de chips (nog) niet leesbaar zijn: tekst van het labelveld.
  const triggerText = clean(uiText(trigger) || (trigger && trigger.textContent) || '');
  for (const label of known) if (triggerText.includes(label)) found.add(label);
  return [...found];
}
// Klik gericht de verwijderknop van chips. Zonder `labels` (of lege lijst) worden
// ALLE chips verwijderd; met labels alleen de matchende. Werkt op de echte
// label-tag-buttons - geen coördinaatgokken of dropdown meer.
export function clickLabelChipRemovers(trigger, labels) {
  const wanted = (labels || []).map(clean).filter(Boolean);
  const chips = labelChips(trigger);
  let clicked = false;
  for (const chip of chips) {
    if (wanted.length && !wanted.some((w) => chip.name === w || chip.name.indexOf(w) !== -1)) continue;
    clickOption(chip.el);
    clicked = true;
  }
  return clicked;
}
export function clickExactDropdownOption(trigger, texts) {
  const best = findExactDropdownOption(trigger, texts);
  if (!best) return false;
  clickOption(best);
  return true;
}
// Alle labels weg: eerst in het formulier, anders elke chip via zijn eigen ×.
export function clearKnownLabels(onDone) {
  const trigger = getEtiketTrigger();
  if (!trigger) { if (onDone) onDone(false); return; }
  if (!labelChips(trigger).length) { if (onDone) onDone(true); return; }
  eerstViaFormulier(
    () => wisLabelsViaFormulier().then((ok) => ok && wachtTot(() => !labelChips(getEtiketTrigger() || trigger).length, { max: 800 }).then(Boolean)),
    () => new Promise((klaar) => wisLabelsViaScherm(klaar))
  ).then((ok) => { if (onDone) onDone(ok); });
}
function wisLabelsViaScherm(onDone, attempt = 0) {
  const trigger = getEtiketTrigger();
  if (!trigger) { onDone(false); return; }
  const chips = labelChips(trigger);
  if (!chips.length) { onDone(true); return; }
  // Klik elke chip-verwijderknop één keer. NOOIT via de dropdown wissen: een klik
  // op een dropdown-optie ZET het label juist (dan zou 'Verwijder instellingen'
  // een al verwijderd label terugplaatsen).
  for (const chip of chips) clickOption(chip.el);
  setTimeout(() => {
    if (!labelChips(trigger).length) { clickEmptyModalSpot(); onDone(true); return; }
    if (attempt >= 4) { clickEmptyModalSpot(); onDone(false); return; }
    wisLabelsViaScherm(onDone, attempt + 1);
  }, 150);
}
// Precies dit ene label (zelfde als setLabelsExclusive met één naam).
export function setLabel(text, onResult) {
  if (!text) { onResult(true); return; }
  setLabelsExclusive([text], onResult);
}
// Dit label erbij, de rest blijft staan.
export function voegLabelToe(naam, onDone) {
  const w = clean(naam);
  if (!w) { if (onDone) onDone(true); return; }
  const staat = () => { const tr = getEtiketTrigger(); return !!tr && selectedAllLabelChipTexts(tr).some((l) => l === w || l.indexOf(w) !== -1); };
  if (staat()) { if (onDone) onDone(true); return; }
  eerstViaFormulier(
    () => zetLabelsViaFormulier([naam], { toevoegen: true }).then((ok) => ok && wachtTot(staat, { max: 800 }).then(Boolean)),
    () => new Promise((klaar) => addLabelExact(naam, klaar))
  ).then((ok) => { if (onDone) onDone(ok); });
}
// Alle daadwerkelijk geselecteerde labelchips (ook labels die NIET in de config
// staan, zoals het label dat ONS automatisch aan een uursoort koppelt). Leunt op
// labelChips, dus op de echte button.label-tag-chips.
export function selectedAllLabelChipTexts(trigger) {
  return labelChips(trigger).map((c) => c.name);
}
// Verwijder GERICHT alleen de chips waarvan de naam matcht met `texts`, door hun
// eigen verwijderknop één keer te klikken. Het gekozen label (`protect`) wordt
// NOOIT verwijderd. Geen wegnokken-en-opnieuw-plakken, dus geen label-dans.
export function removeLabelChipsByText(trigger, texts, protect) {
  if (!trigger || !texts || !texts.length) return false;
  const want = texts.map(clean).filter((w) => w && w.length >= 2);
  const prot = clean(protect || '');
  let clicked = false;
  for (const chip of labelChips(trigger)) {
    const nm = chip.name;
    if (!nm) continue;
    if (prot && (nm === prot || nm.indexOf(prot) !== -1)) continue;
    if (!want.some((w) => nm === w || nm.indexOf(w) !== -1)) continue;
    clickOption(chip.el);
    clicked = true;
  }
  return clicked;
}
// Zoek in de open label-dropdown een optie die EXACT gelijk is aan `wanted`.
// Bewust géén fuzzy/token-matching (zoals findExactDropdownOption): bij een nog
// niet gefilterde lijst pakte dat een naburig/verkeerd label -> churn op "een
// heel ander label". We klikken liever niets dan het verkeerde.
function findExactLabelOption(trigger, wanted) {
  const w = clean(wanted);
  if (!w) return null;
  const tr = rect(trigger);
  for (const root of optionSearchRoots(trigger)) {
    for (const el of genericOptionCandidates(root)) {
      if (!visible(el) || isOwnPopup(el) || /input|textarea|select/i.test(el.tagName || '')) continue;
      const row = rowForOptionText(el, root);
      if (!visible(row) || isOwnPopup(row)) continue;
      const txt = clean(optionText(row) || optionText(el));
      if (txt !== w) continue; // EXACT
      const r = rect(row);
      if (r.top < tr.top - 500 || r.top > tr.bottom + 600) continue;
      if (r.width < 120 || r.height < 20 || r.height > 80) continue;
      return row;
    }
  }
  return null;
}
// Voeg exact één label toe door de dropdown te openen, de naam te typen en te
// wachten tot de EXACT matchende optie verschijnt. Vindt die niet binnen de tijd,
// dan klikken we niets (onResult(false)) i.p.v. een verkeerd label te kiezen.
function addLabelExact(text, onResult) {
  const trigger = getEtiketTrigger();
  if (!trigger) { onResult(false); return; }
  const wanted = clean(text);
  clickElementCenter(trigger);
  setTimeout(() => {
    const input = searchInputForTrigger(trigger);
    if (input) { input.focus(); setInputText(input, text); }
    pollFor(
      () => findExactLabelOption(trigger, wanted),
      (opt) => {
        if (opt) { clickOption(opt); setTimeout(() => { clickEmptyModalSpot(); onResult(true); }, 90); }
        else { clickEmptyModalSpot(); onResult(false); }
      },
      { timeout: 2500, interval: 120 }
    );
  }, 140);
}
// Zet exact de gekozen SET labels (een of meer per afspraaktype): eerst in het
// formulier (geen dropdown), anders via het scherm.
export function setLabelsExclusive(texts, onDone) {
  const lijst = (Array.isArray(texts) ? texts : [texts]).map((t) => String(t == null ? '' : t).trim()).filter(Boolean);
  const wanted = lijst.map(clean).filter(Boolean);
  if (!wanted.length) { if (onDone) onDone(true); return; }
  eerstViaFormulier(
    () => zetLabelsViaFormulier(lijst).then((ok) => ok && wachtTot(() => labelsKloppen(wanted), { max: 800 }).then(Boolean)),
    () => new Promise((klaar) => labelsViaScherm(wanted, klaar))
  ).then((ok) => { if (onDone) onDone(ok); });
}
// Via het scherm, STRIKT gefaseerd zodat er nooit tegelijk wordt verwijderd en
// toegevoegd (dat gaf geflikker):
//   fase 1 - verwijder eerst elk label dat niet in de gewenste set zit;
//   fase 2 - voeg ontbrekende labels één voor één toe, en kijk daarna opnieuw.
// Wordt pas AAN HET EIND van een keuze aangeroepen (nadat ONS zijn eigen
// uursoort-label heeft gekoppeld).
function labelsViaScherm(wanted, onDone, attempt = 0) {
  const trigger = getEtiketTrigger();
  if (!trigger) { onDone(false); return; }
  // Een chip "hoort erbij" als hij één van de gewenste labels is of bevat.
  const isWantedChip = (l) => wanted.some((w) => l === w || l.indexOf(w) !== -1);
  const chips = selectedAllLabelChipTexts(trigger);
  const extras = chips.filter((l) => !isWantedChip(l));
  const triggerTxt = clean(uiText(trigger) || trigger.textContent || '');
  const present = (w) => chips.some((l) => l === w || l.indexOf(w) !== -1) || (w && triggerTxt.indexOf(w) !== -1);
  const missing = wanted.filter((w) => !present(w));
  if (!extras.length && !missing.length) { onDone(true); return; }
  if (attempt >= 10) {
    if (extras.length) setStatus('Let op: verwijder zelf nog het extra label "' + extras[0] + '"', false);
    else if (missing.length) setStatus('Let op: voeg zelf nog het label "' + missing[0] + '" toe', false);
    onDone(false);
    return;
  }
  if (extras.length) {
    removeLabelChipsByText(trigger, extras);
    setTimeout(() => labelsViaScherm(wanted, onDone, attempt + 1), 160);
    return;
  }
  addLabelExact(missing[0], () => setTimeout(() => labelsViaScherm(wanted, onDone, attempt + 1), 150));
}
// Staan precies de gewenste labels als chip in het veld?
function labelsKloppen(wanted) {
  const trigger = getEtiketTrigger();
  if (!trigger) return false;
  const chips = selectedAllLabelChipTexts(trigger);
  const hoort = (l) => wanted.some((w) => l === w || l.indexOf(w) !== -1);
  return chips.length > 0 && chips.every(hoort) && wanted.every((w) => chips.some((l) => l === w || l.indexOf(w) !== -1));
}
