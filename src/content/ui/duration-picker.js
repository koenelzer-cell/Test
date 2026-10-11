// Duurkiezers (chips, uren/minuten, twee kolommen).

import { registrationDurationLabel } from '../core/datetime.js';
import { _agGenSettings } from '../domain/registrations.js';
import { ONSAH_TOKENS, onsahFocusRing } from './theme.js';
import { mkPillButton } from './controls.js';

// Duur-/reistijdkeuze uit een reeks minuutwaardes (bv. 15,30,...,180): een
// compact chipsrooster bij een overzichtelijk aantal opties, anders (te
// veel rijen in de smalle 280px-popup) een schuifregelaar-tijdpicker.
// Boven de PICKER_CHIP_LIMIT is een chipgrid weer net zo'n lange lijst als
// de oude volle-breedte-knoppen, alleen met kleinere blokjes.
export const PICKER_CHIP_LIMIT = 16;
// Gedeelde chip-stijl (tegel uit een rooster): gebruikt door mkChipGrid en
// mkHourMinutePicker, zodat beide er identiek uitzien.
function styleChipButton(chip) {
  const T = ONSAH_TOKENS;
  Object.assign(chip.style, {
    padding: '9px 6px', borderRadius: '10px', border: '1px solid ' + T.line, background: '#fff',
    font: '600 13px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: T.ink, cursor: 'pointer',
    fontVariantNumeric: 'tabular-nums', textAlign: 'center', boxSizing: 'border-box',
    transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease',
  });
  chip.addEventListener('mouseenter', () => { chip.style.transform = 'translateY(-1px)'; chip.style.boxShadow = '0 4px 12px -6px rgba(32,20,15,.28)'; chip.style.background = T.brandWash; chip.style.borderColor = 'transparent'; });
  chip.addEventListener('mouseleave', () => { chip.style.transform = 'none'; chip.style.boxShadow = 'none'; chip.style.background = '#fff'; chip.style.borderColor = T.line; });
  onsahFocusRing(chip);
}
// Hoe een aantal minuten op een keuzeknop komt te staan. 'urenMinuten' geeft
// "1 uur 15 min.", 'minuten' geeft "75 min.". Instelbaar omdat het per vraag
// verschilt: bij een afspraakduur denk je in uren, bij reistijd in minuten.
export function durationChipLabel(minutes, stijl) {
  return stijl === 'minuten' ? (minutes + ' min.') : registrationDurationLabel(minutes);
}
// De ingestelde weergave, met een verstandige standaard per soort vraag.
export function durationLabelStyle(soort) {
  const g = _agGenSettings();
  const key = soort === 'reistijd' ? 'travelLabelStyle' : 'durationLabelStyle';
  const v = g[key];
  if (v === 'minuten' || v === 'urenMinuten') return v;
  return soort === 'reistijd' ? 'minuten' : 'urenMinuten';
}
function mkChipGrid(values, onPick, labelStijl) {
  const grid = document.createElement('div');
  Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '7px' });
  values.forEach((m) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = durationChipLabel(m, labelStijl);
    styleChipButton(chip);
    chip.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onPick(m); });
    grid.appendChild(chip);
  });
  return grid;
}
// Duur eerst op hele uren kiezen, dan (indien dat uur meerdere minuutwaardes
// bevat) de minuten binnen dat uur — twee korte chipsroosters i.p.v. één
// lange lijst of een schuifregelaar. Alternatieve fallback voor afspraakduur
// naast mkTimePicker; werkt voor elke stapgrootte, ook als die geen mooie
// deler van 60 is (dan wisselt het aantal minuutopties per uur gewoon mee).
function mkHourMinutePicker(values, onPick, labelStijl) {
  const byHour = new Map();
  values.forEach((v) => {
    const h = Math.floor(v / 60);
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h).push(v % 60);
  });
  const hours = [...byHour.keys()].sort((a, b) => a - b);
  const wrap = document.createElement('div');
  const cap = document.createElement('div');
  Object.assign(cap.style, { fontSize: '12px', fontWeight: '700', color: ONSAH_TOKENS.inkSoft, margin: '0 0 7px' });
  const stage = document.createElement('div');
  wrap.append(cap, stage);
  function mkGrid() {
    const grid = document.createElement('div');
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: '7px' });
    return grid;
  }
  // Alle waarden in één rooster, zonder uren-stap. Voor korte reeksen (bv. de
  // directe/indirecte tijd binnen een registratie) is "kies eerst het aantal
  // uren" zinloos: je zou moeten kiezen tussen "0 uur" en "1 uur".
  function renderAlleMinuten() {
    cap.textContent = 'Kies de duur:';
    stage.innerHTML = '';
    const grid = mkGrid();
    values.slice().sort((a, b) => a - b).forEach((v) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = durationChipLabel(v, labelStijl);
      styleChipButton(btn);
      btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onPick(v); });
      grid.appendChild(btn);
    });
    stage.appendChild(grid);
  }
  function renderHours() {
    cap.textContent = 'Aantal uren:';
    stage.innerHTML = '';
    const grid = mkGrid();
    hours.forEach((h) => {
      const mins = byHour.get(h);
      const btn = document.createElement('button');
      btn.type = 'button';
      // "0 uur" zegt niets; bij een reeks die onder het uur begint is
      // "< 1 uur" de begrijpelijke omschrijving.
      btn.textContent = h === 0 ? '< 1 uur' : (h + ' uur');
      styleChipButton(btn);
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (mins.length === 1) onPick(h * 60 + mins[0]);
        else renderMinutes(h, mins);
      });
      grid.appendChild(btn);
    });
    stage.appendChild(grid);
  }
  function renderMinutes(h, mins) {
    cap.textContent = h + ' uur, aantal minuten:';
    stage.innerHTML = '';
    const back = document.createElement('button');
    back.type = 'button'; back.textContent = '‹ Ander aantal uren';
    Object.assign(back.style, { border: '0', background: 'none', color: ONSAH_TOKENS.inkSoft, font: '600 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', cursor: 'pointer', padding: '0 0 8px', display: 'block' });
    back.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); renderHours(); });
    const grid = mkGrid();
    mins.slice().sort((a, b) => a - b).forEach((m) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = m + ' min.';
      styleChipButton(btn);
      btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onPick(h * 60 + m); });
      grid.appendChild(btn);
    });
    stage.append(back, grid);
  }
  // De uren-stap bestaat om een láánge lijst te vermijden. Bij een
  // overzichtelijk aantal waarden is een rooster met alle minuten duidelijker:
  // je denkt bij "hoeveel indirecte tijd zat hierin?" in minuten, niet in
  // uren. Een registratie van twee uur geeft 24 keuzes van 5 minuten — dat
  // past prima in één rooster.
  const PICKER_UUR_DREMPEL = 30;
  if (hours.length <= 1 || values.length <= PICKER_UUR_DREMPEL) renderAlleMinuten();
  else renderHours();
  return wrap;
}
function mkTimePicker(values, initial, onPick) {
  const T = ONSAH_TOKENS;
  const min = values[0], max = values[values.length - 1];
  const step = values.length > 1 ? (values[1] - values[0]) : 1;
  let cur = values.includes(initial) ? initial : values[0];
  const wrap = document.createElement('div');
  Object.assign(wrap.style, { display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0 2px' });
  const readout = document.createElement('div');
  Object.assign(readout.style, { textAlign: 'center', font: '800 22px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: T.ink, fontVariantNumeric: 'tabular-nums' });
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = String(min); slider.max = String(max); slider.step = String(step); slider.value = String(cur);
  Object.assign(slider.style, { width: '100%', height: '6px', borderRadius: '999px', accentColor: T.brand, outline: 'none', margin: '2px 0', boxSizing: 'border-box' });
  const steps = document.createElement('div');
  Object.assign(steps.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' });
  function mkStepBtn(symbol, delta, label) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = symbol; b.setAttribute('aria-label', label);
    Object.assign(b.style, { width: '34px', height: '34px', borderRadius: '50%', border: '1px solid ' + T.line, background: '#fff', color: T.ink, font: '700 17px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .12s ease, border-color .12s ease, transform .12s ease' });
    b.addEventListener('mouseenter', () => { b.style.background = T.brandWash; b.style.borderColor = 'transparent'; });
    b.addEventListener('mouseleave', () => { b.style.background = '#fff'; b.style.borderColor = T.line; });
    onsahFocusRing(b);
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cur = Math.max(min, Math.min(max, cur + delta)); render(); });
    return b;
  }
  const minus = mkStepBtn('−', -step, registrationDurationLabel(step) + ' minder');
  const plus = mkStepBtn('+', step, registrationDurationLabel(step) + ' meer');
  const hint = document.createElement('div');
  Object.assign(hint.style, { fontSize: '11px', color: T.inkSoft, minWidth: '120px', textAlign: 'center' });
  hint.textContent = 'stap ' + registrationDurationLabel(step) + ', max ' + registrationDurationLabel(max);
  steps.append(minus, hint, plus);
  const confirmBtn = mkPillButton('Kies deze duur', () => onPick(cur), { shadowRgb: '204,8,125' });
  Object.assign(confirmBtn.style, { width: '100%', boxSizing: 'border-box' });
  function render() { readout.textContent = registrationDurationLabel(cur); slider.value = String(cur); }
  slider.addEventListener('input', () => { cur = +slider.value; render(); });
  wrap.append(readout, slider, steps, confirmBtn);
  render();
  return wrap;
}
// Reistijdkeuze: dezelfde stijlkeuze als de duurvragen. Zonder stijl valt hij
// terug op het automatische gedrag van vóór deze wijziging.
export function mkValuePicker(values, initial, onPick, style) {
  return mkDurationPicker(values, onPick, style, initial, durationLabelStyle('reistijd'));
}
// Uren en minuten als twee kolommen náást elkaar (i.p.v. na elkaar zoals
// mkHourMinutePicker): je ziet meteen het hele bereik van beide, kiest in
// beide kolommen één waarde (in willekeurige volgorde) en zodra dat een
// geldige combinatie oplevert past hij 'm meteen toe — één klik extra
// t.o.v. een chip, maar in één oogopslag overzichtelijk. Combinaties die
// buiten het toegestane bereik vallen (bv. 3 uur 45 min. bij een max van
// 3 uur 15 min.) worden uitgegrijsd zodra de andere kolom al gekozen is.
function mkTwoColumnDurationPicker(values, onPick) {
  const T = ONSAH_TOKENS;
  const set = new Set(values);
  const hours = [...new Set(values.map((v) => Math.floor(v / 60)))].sort((a, b) => a - b);
  const mins = [...new Set(values.map((v) => v % 60))].sort((a, b) => a - b);
  let selHour = null, selMin = null;
  function comboValid(h, m) { return h != null && m != null && set.has(h * 60 + m); }
  function mkItemBtn(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.dataset.sel = '0';
    Object.assign(b.style, {
      padding: '7px 6px', borderRadius: '9px', border: '1px solid ' + T.line, background: '#fff',
      font: '600 13px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: T.ink, cursor: 'pointer',
      fontVariantNumeric: 'tabular-nums', textAlign: 'center', boxSizing: 'border-box',
      transition: 'background .12s ease, border-color .12s ease, opacity .12s ease, color .12s ease',
    });
    b.addEventListener('mouseenter', () => { if (!b.disabled && b.dataset.sel !== '1') { b.style.background = T.brandWash; b.style.borderColor = 'transparent'; } });
    b.addEventListener('mouseleave', () => { if (b.dataset.sel !== '1') { b.style.background = '#fff'; b.style.borderColor = T.line; } });
    onsahFocusRing(b);
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (!b.disabled) onClick(); });
    return b;
  }
  function mkColumn(title) {
    const col = document.createElement('div');
    Object.assign(col.style, { flex: '1 1 0', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '5px' });
    const h = document.createElement('div');
    h.textContent = title;
    Object.assign(h.style, { fontSize: '10.5px', fontWeight: '700', color: T.inkSoft, textAlign: 'center', marginBottom: '2px' });
    col.appendChild(h);
    return col;
  }
  const hourCol = mkColumn('Uren');
  const minCol = mkColumn('Minuten');
  const hourBtns = new Map(), minBtns = new Map();
  hours.forEach((h) => { const b = mkItemBtn(h + ' uur', () => { selHour = h; renderState(); tryApply(); }); hourBtns.set(h, b); hourCol.appendChild(b); });
  mins.forEach((m) => { const b = mkItemBtn(m + ' min.', () => { selMin = m; renderState(); tryApply(); }); minBtns.set(m, b); minCol.appendChild(b); });
  function paint(b, isSel, invalid) {
    b.dataset.sel = isSel ? '1' : '0';
    b.disabled = invalid;
    b.style.cursor = invalid ? 'not-allowed' : 'pointer';
    b.style.opacity = invalid ? '.35' : '1';
    b.style.background = isSel ? T.brand : '#fff';
    b.style.color = isSel ? '#fff' : T.ink;
    b.style.borderColor = isSel ? T.brand : T.line;
  }
  function renderState() {
    hourBtns.forEach((b, h) => paint(b, selHour === h, selMin != null && !comboValid(h, selMin)));
    minBtns.forEach((b, m) => paint(b, selMin === m, selHour != null && !comboValid(selHour, m)));
  }
  function tryApply() { if (comboValid(selHour, selMin)) onPick(selHour * 60 + selMin); }
  const wrap = document.createElement('div');
  const cap = document.createElement('div');
  cap.textContent = 'Kies uren én minuten:';
  Object.assign(cap.style, { fontSize: '12px', fontWeight: '700', color: T.inkSoft, margin: '0 0 8px' });
  const cols = document.createElement('div');
  Object.assign(cols.style, { display: 'flex', gap: '10px' });
  cols.append(hourCol, minCol);
  wrap.append(cap, cols);
  renderState();
  return wrap;
}
// Voor afspraakduur: 'slider' en 'columns' zijn EXPLICIETE keuzes (alleen
// bereikbaar door dat bij een afspraaktype in te stellen via Overige ->
// Duurkeuze bij veel opties) en gelden daarom altijd, ongeacht het aantal
// opties — anders zou een ingestelde schuifregelaar/twee-koloms-weergave
// bij een klein aantal opties (bv. 12) alsnog overschreven worden door de
// standaard-chipgrid, wat 'm in de praktijk onbruikbaar maakt. Alleen de
// standaardstijl 'hourMinute' (of geen expliciete keuze) behoudt het oude
// automatische gedrag: chipgrid bij een overzichtelijk aantal opties
// (<= PICKER_CHIP_LIMIT), anders pas de uren-dan-minuten-weergave.
// Eén ingang voor ELKE duur-/tijdvraag, zodat de in het beheerscherm gekozen
// stijl overal geldt: afspraakduur, registratieduur, reistijd én de
// directe/indirecte tijd. `initial` is de startwaarde voor de schuifregelaar
// (reistijd begint op 0, een duur op de eerste waarde).
//
// 'hourMinute' had eerder geen eigen tak en viel door naar het chipsrooster;
// omdat dat óók de standaardwaarde is, werd de ingestelde stijl bij 16 of
// minder opties genegeerd. Dezelfde fout was eerder al voor 'slider' en
// 'columns' hersteld; dit is de derde.
export function mkDurationPicker(values, onPick, style, initial, labelStijl) {
  const start = (initial != null) ? initial : values[0];
  // 'minutenRooster': altijd alle waarden in één rooster, nooit een uren-stap.
  // Gebruikt voor de vraag hoeveel directe/indirecte tijd er in een registratie
  // zat: dat denk je in minuten, ook als de registratie vier uur duurt.
  if (style === 'minutenRooster') return mkChipGrid(values, onPick, labelStijl);
  if (style === 'slider') return mkTimePicker(values, start, onPick);
  if (style === 'columns') return mkTwoColumnDurationPicker(values, onPick);
  if (style === 'hourMinute') return mkHourMinutePicker(values, onPick, labelStijl);
  // Geen (of onbekende) stijl: automatisch — compacte chips bij een
  // overzichtelijk aantal opties, anders uren-dan-minuten.
  if (values.length <= PICKER_CHIP_LIMIT) return mkChipGrid(values, onPick, labelStijl);
  return mkHourMinutePicker(values, onPick, labelStijl);
}
