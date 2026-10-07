// Bouwstenen voor schermen zonder React: knoppen, schakelaars, terugknop, lege
// toestand.

import { mkText } from './managed-text.js';
import { helperPanel } from '../state.js';
import { ONSAH_TOKENS, onsahFocusRing } from './theme.js';
import { svgEmptyIcon, svgIcon } from './icons.js';

// Pil: primaire/bevestigende actie. Vlakke kleur (geen gradient - dat oogde
// gedateerd) + JS-gedreven hover/active, zodat de vorm nooit van een
// <style>-tag afhangt. `to` fungeert als iets donkerdere druk-tint.
function applyOnsahPillStyle(el, opts) {
  opts = opts || {};
  const from = opts.from || ONSAH_TOKENS.brand;
  const to = opts.to || ONSAH_TOKENS.brandDeep;
  const shadowRgb = opts.shadowRgb || '204,8,125';
  Object.assign(el.style, {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
    border: '0', borderRadius: '999px', padding: '10px 18px',
    font: '700 13px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: '#fff',
    background: from, cursor: 'pointer',
    boxShadow: '0 4px 12px -6px rgba(' + shadowRgb + ',.55)',
    transition: 'transform .08s ease, box-shadow .12s ease, background .1s ease', boxSizing: 'border-box',
  });
  el.addEventListener('mouseenter', () => { if (!el.disabled) el.style.boxShadow = '0 6px 16px -5px rgba(' + shadowRgb + ',.6)'; });
  el.addEventListener('mouseleave', () => { el.style.boxShadow = '0 4px 12px -6px rgba(' + shadowRgb + ',.55)'; el.style.background = from; });
  el.addEventListener('mousedown', () => { if (!el.disabled) { el.style.transform = 'translateY(1px)'; el.style.background = to; } });
  el.addEventListener('mouseup', () => { el.style.transform = 'none'; el.style.background = from; });
  onsahFocusRing(el, to);
}
// Kant-en-klare pil-knop met klik-handler (bevestigende acties, bv. Indienen).
export function mkPillButton(label, onClick, opts) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  applyOnsahPillStyle(b, opts);
  b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(e); });
  return b;
}
// Herbruikbare "lege status": icoon + gedempte tekst i.p.v. een kaal
// tekstregeltje, voor plekken zonder gegevens (bv. een leeg overzicht).
export function onsahEmptyState(text) {
  const T = ONSAH_TOKENS;
  const wrap = document.createElement('div');
  Object.assign(wrap.style, { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', padding: '10px 2px', color: T.inkSoft, fontSize: '12.5px' });
  const icon = svgEmptyIcon();
  icon.style.width = '22px'; icon.style.height = '22px'; icon.style.color = T.line;
  const lbl = document.createElement('span'); lbl.textContent = text;
  wrap.append(icon, lbl);
  return wrap;
}
// `opts.tick` (hex) zet een kleine categoriekleur-stip vooraan (voor
// type-keuzes); zonder tick is de tegel neutraal (voor Ja/Nee/Terug e.d.).
// `opts.chevron` (default aan) toont een navigatie-chevron rechts.
// `opts.accent` (hex) kleurt rand/tekst/hover voor destructieve varianten.
export function mkButton(label, onClick, opts) {
  opts = opts || {};
  const T = ONSAH_TOKENS;
  const hoverBg = opts.accentWash || (opts.accent ? opts.accent + '14' : T.brandWash);
  const chevColorHover = opts.accent || T.brand;
  const b = document.createElement('button');
  b.type = 'button';
  Object.assign(b.style, {
    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
    padding: '10px 11px', borderRadius: '11px', border: '1px solid ' + T.brand,
    background: '#fff', color: opts.accent || T.ink,
    font: '600 13.5px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', textAlign: 'left', cursor: 'pointer',
    transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease',
    boxSizing: 'border-box',
  });
  if (opts.tick) {
    const tick = document.createElement('span');
    Object.assign(tick.style, { width: '7px', height: '7px', borderRadius: '50%', flex: '0 0 auto', background: opts.tick });
    b.appendChild(tick);
  }
  const lbl = document.createElement('span');
  Object.assign(lbl.style, { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  lbl.textContent = label;
  b.appendChild(lbl);
  // Kleine, gedempte meta-badge (bv. "direct"/"indirect") — los van het
  // label, monospace, geen pil/rand, zoals .tile .meta in het Spine-concept.
  if (opts.meta) {
    const meta = document.createElement('span');
    Object.assign(meta.style, { flex: '0 0 auto', fontSize: '10.5px', color: T.inkSoft, fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' });
    meta.textContent = opts.meta;
    b.appendChild(meta);
  }
  let chev = null;
  if (opts.chevron !== false) {
    chev = svgIcon('M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z');
    // Expliciete afmetingen op het element zelf: een SVG zonder width/height
    // valt terug op zijn (grote) intrinsieke default als er geen stylesheet
    // is die de maat overneemt — vandaar hier nooit alleen op CSS leunen.
    chev.setAttribute('width', '14'); chev.setAttribute('height', '14');
    Object.assign(chev.style, { width: '14px', height: '14px', color: '#c7bfbc', flex: '0 0 auto', transition: 'color .12s ease' });
    b.appendChild(chev);
  }
  b.addEventListener('mouseenter', () => {
    if (b.disabled) return;
    b.style.transform = 'translateY(-1px)';
    b.style.boxShadow = '0 4px 14px -6px rgba(32,20,15,.28)';
    b.style.background = hoverBg;
    b.style.borderColor = 'transparent';
    if (chev) chev.style.color = chevColorHover;
  });
  b.addEventListener('mouseleave', () => {
    b.style.transform = 'none';
    b.style.boxShadow = 'none';
    b.style.background = '#fff';
    b.style.borderColor = T.brand;
    if (chev) chev.style.color = '#c7bfbc';
  });
  b.addEventListener('mousedown', () => { if (!b.disabled) b.style.transform = 'translateY(0)'; });
  b.addEventListener('mouseup', () => { if (!b.disabled) b.style.transform = 'translateY(-1px)'; });
  onsahFocusRing(b, opts.accent || T.brand);
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(e);
  });
  return b;
}
// Aan/uit-schakelaar (role=switch) in de eigen roze huisstijl. `onChange(bool)`
// krijgt de nieuwe stand; `.setChecked(bool)` zet de stand van buitenaf.
// Vlakke schakelaar (geen gradient, geen rand): grijs uit, roze aan — zelfde
// moderne taal als de rest van de tegels/pillen.
function mkSwitch(initial, onChange) {
  const T = ONSAH_TOKENS;
  const sw = document.createElement('button');
  sw.type = 'button';
  sw.setAttribute('role', 'switch');
  let on = !!initial;
  Object.assign(sw.style, { position: 'relative', width: '38px', height: '22px', borderRadius: '999px', border: '0', background: on ? T.brand : '#c7bfbc', cursor: 'pointer', flex: '0 0 auto', padding: '0', transition: 'background .15s ease' });
  const knob = document.createElement('span');
  Object.assign(knob.style, { position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .15s ease' });
  sw.appendChild(knob);
  const render = () => {
    sw.setAttribute('aria-checked', on ? 'true' : 'false');
    sw.style.background = on ? T.brand : '#c7bfbc';
    knob.style.left = on ? '18px' : '2px';
  };
  render();
  sw.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); on = !on; render(); try { onChange && onChange(on); } catch (err) {} });
  sw.setChecked = (v) => { on = !!v; render(); };
  onsahFocusRing(sw);
  return sw;
}
// Kader (zoals de opslaanknop) met een vraagtekst links en een aan/uit-knop
// rechts. `labelKey` verwijst naar een beheerbare schermtekst.
export function mkToggleBox(labelKey, fallbackLabel, initial, onChange) {
  const T = ONSAH_TOKENS;
  const box = document.createElement('div');
  Object.assign(box.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: '1px solid ' + T.brand, borderRadius: '11px', padding: '10px 11px', background: '#fff' });
  const lab = mkText(labelKey, fallbackLabel, { fontSize: '13.5px', color: T.ink, fontWeight: '600', lineHeight: '1.3' });
  lab.style.flex = '1';
  lab.style.fontWeight = '600'; // zelfde dikte als de Opslaan-knop (mkButton), ongeacht managed 'bold'
  lab.style.fontSize = '13.5px'; // idem voor grootte: mkText past de beheerbare 'sizePx' ná defaultStyle toe, dus ook dit expliciet terugzetten zodat dit label exact dezelfde tekstgrootte heeft als de andere tegels/knoppen (mkButton)
  lab.style.color = T.ink; // idem voor kleur: mkText past de beheerbare tekstkleur ná defaultStyle toe (bv. #cc087d), dus hier expliciet terugzetten naar inkt zodat dit label dezelfde neutrale tekstkleur heeft als de andere tegels/knoppen
  const sw = mkSwitch(initial, onChange);
  box.appendChild(lab);
  box.appendChild(sw);
  box._switch = sw;
  return box;
}
export function mkBackButton(onClick, label) {
  // Elke Terug-klik geeft ~1,2s rust aan de auto-refresh, zodat de navigatie
  // niet meteen wordt teruggedraaid (bv. van opslaanpagina naar keuzemenu).
  const wrapped = (...args) => { helperPanel.suppressAutoUntil = Date.now() + 1200; return onClick && onClick(...args); };
  const b = mkButton(label || 'Terug', wrapped);
  b.textContent = '';
  b.appendChild(svgIcon('M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20z'));
  b.appendChild(document.createTextNode(label || 'Terug'));
  Object.assign(b.style, { display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', textAlign: 'left', width: '100%' });
  return b;
}
