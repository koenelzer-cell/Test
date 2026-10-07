// Afspraaklabels zetten en opruimen.

import { allKnownLabels } from '../../config/app-config.js';
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
export function clearKnownLabels(onDone, attempt = 0) {
  const trigger = getEtiketTrigger();
  if (!trigger) { if (onDone) onDone(false); return; }
  const chips = labelChips(trigger);
  if (!chips.length) { if (onDone) onDone(true); return; }
  // Klik elke chip-verwijderknop één keer. NOOIT via de dropdown wissen: een klik
  // op een dropdown-optie ZET het label juist - dat was de bug waarbij 'Verwijder
  // instellingen' (na handmatig verwijderen) het label terugplaatste.
  for (const chip of chips) clickOption(chip.el);
  setTimeout(() => {
    if (!labelChips(trigger).length) { clickEmptyModalSpot(); if (onDone) onDone(true); return; }
    if (attempt >= 4) { clickEmptyModalSpot(); if (onDone) onDone(false); return; }
    clearKnownLabels(onDone, attempt + 1);
  }, 150);
}
export function setLabel(text, onResult) {
  if (!text) { onResult(true); return; }
  const trigger = getEtiketTrigger();
  const selected = trigger ? selectedKnownLabels(trigger, allKnownLabels()) : [];
  const wanted = clean(text);
  if (selected.length === 1 && selected[0] === wanted) {
    onResult(true);
    return;
  }
  clearKnownLabels(() => setTimeout(() => selectLabel(text, onResult), 60));
}
// Opgeruimd (#3): enforceChosenLabelOnly is vervangen door setLabelExclusive,
// dat gefaseerd en gericht werkt via de echte label-chips.
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
// Zet exact het gekozen label. STRIKT gefaseerd zodat er nooit tegelijk wordt
// verwijderd en toegevoegd (dat veroorzaakte het geflikker):
//   fase 1 - verwijder eerst alle niet-gekozen labels (gericht via hun ×);
//   fase 2 - pas als er geen extra's meer zijn en het label ontbreekt: exact
//            één keer toevoegen en KLAAR (niet opnieuw de lus in).
// Wordt pas AAN HET EIND aangeroepen (nadat ONS zijn eigen uursoort-label heeft
// gekoppeld).
function setLabelExclusive(text, onDone, attempt = 0) {
  if (!text) { if (onDone) onDone(true); return; }
  const trigger = getEtiketTrigger();
  if (!trigger) { if (onDone) onDone(false); return; }
  const wanted = clean(text);
  // Doel-chip = exact het label of een chip die het label bevat (bv. met icoon
  // ervoor). Bewust NIET de omgekeerde substring, zodat korte labels niet per
  // ongeluk als 'doel' gelden.
  const isTarget = (l) => l === wanted || l.indexOf(wanted) !== -1;
  const chips = selectedAllLabelChipTexts(trigger);
  const extras = chips.filter((l) => !isTarget(l));
  const triggerTxt = clean(uiText(trigger) || trigger.textContent || '');
  const hasTarget = chips.some(isTarget) || (wanted && triggerTxt.indexOf(wanted) !== -1);
  if (!extras.length && hasTarget) { if (onDone) onDone(true); return; }
  if (attempt >= 6) {
    if (extras.length) setStatus('Let op: verwijder zelf nog het extra label "' + extras[0] + '"', false);
    if (onDone) onDone(!extras.length);
    return;
  }
  // Fase 1: eerst extra labels weg (target beschermd), daarna opnieuw evalueren.
  if (extras.length) {
    removeLabelChipsByText(trigger, extras, wanted);
    setTimeout(() => setLabelExclusive(text, onDone, attempt + 1), 160);
    return;
  }
  // Fase 2: geen extra's meer, label ontbreekt -> exact één keer toevoegen. KLAAR.
  addLabelExact(text, () => { if (onDone) onDone(true); });
}
// Zet exact de gekozen SET labels (meerdere etiketten per afspraaktype). Zelfde
// strikte fasering als setLabelExclusive, maar dan voor een lijst:
//   fase 1 - verwijder eerst elk label dat niet in de gewenste set zit;
//   fase 2 - voeg ontbrekende labels één voor één toe (nooit tegelijk verwijderen
//            en toevoegen), en evalueer daarna opnieuw tot de set klopt.
export function setLabelsExclusive(texts, onDone, attempt = 0) {
  const wanted = (Array.isArray(texts) ? texts : [texts]).map((t) => clean(t)).filter(Boolean);
  if (!wanted.length) { if (onDone) onDone(true); return; }
  if (wanted.length === 1) { setLabelExclusive(wanted[0], onDone, attempt); return; }
  const trigger = getEtiketTrigger();
  if (!trigger) { if (onDone) onDone(false); return; }
  // Een chip "hoort erbij" als hij één van de gewenste labels is of bevat.
  const isWantedChip = (l) => wanted.some((w) => l === w || l.indexOf(w) !== -1);
  const chips = selectedAllLabelChipTexts(trigger);
  const extras = chips.filter((l) => !isWantedChip(l));
  const triggerTxt = clean(uiText(trigger) || trigger.textContent || '');
  const present = (w) => chips.some((l) => l === w || l.indexOf(w) !== -1) || (w && triggerTxt.indexOf(w) !== -1);
  const missing = wanted.filter((w) => !present(w));
  if (!extras.length && !missing.length) { if (onDone) onDone(true); return; }
  if (attempt >= 10) {
    if (extras.length) setStatus('Let op: verwijder zelf nog het extra label "' + extras[0] + '"', false);
    else if (missing.length) setStatus('Let op: voeg zelf nog het label "' + missing[0] + '" toe', false);
    if (onDone) onDone(!extras.length && !missing.length);
    return;
  }
  // Fase 1: eerst alle niet-gewenste labels weg (gewenste chips blijven staan).
  if (extras.length) {
    removeLabelChipsByText(trigger, extras);
    setTimeout(() => setLabelsExclusive(texts, onDone, attempt + 1), 160);
    return;
  }
  // Fase 2: het eerste ontbrekende label toevoegen, daarna opnieuw evalueren.
  addLabelExact(missing[0], () => setTimeout(() => setLabelsExclusive(texts, onDone, attempt + 1), 150));
}
export function selectLabel(text, onResult, attempt = 0) {
  const trigger = getEtiketTrigger();
  if (!trigger) { onResult(false); return; }
  clickElementCenter(trigger);
  setTimeout(() => {
    const input = searchInputForTrigger(trigger);
    if (input) { input.focus(); setInputText(input, text); }
    // Poll tot het label-optie gerenderd is (op productie laadt de lijst
    // trager) i.p.v. één poging na een vaste vertraging.
    pollFor(
      () => findExactDropdownOption(trigger, [text]),
      (best) => {
        if (best) {
          clickOption(best);
          setTimeout(() => { clickEmptyModalSpot(); onResult(true); }, 90);
          return;
        }
        if (attempt < 3) {
          setTimeout(() => selectLabel(text, onResult, attempt + 1), 180);
          return;
        }
        setTimeout(() => { clickEmptyModalSpot(); onResult(false); }, 90);
      },
      { timeout: 2600, interval: 130 }
    );
  }, 130);
}
