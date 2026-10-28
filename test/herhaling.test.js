// Herhaling op 'Niet' (Afspraak doorplannen uit): via ONS' eigen Vue-koppeling
// van het keuzeveld, zonder de keuzelijst te openen; klikken alleen als
// terugval.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootHelper } from './helpers/harness.mjs';

const KEUZES = [{ value: 'none', label: 'Niet' }, { value: 'daily', label: 'Dagelijks' }, { value: 'weekly', label: 'Wekelijks' }];

// Een nagebootst afspraakformulier met het herhalingveld (uc-form-field
// data-qa="recurrence-type" met een uc-select erin), zoals de andere velden.
async function formulier({ neemtOver = true, keuzesInProps = true, keuzes = KEUZES } = {}) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body><div id="content" data-v-app><uc-form-field data-qa="recurrence-type"><uc-select></uc-select></uc-form-field></div></body>',
    { url: 'https://impegno.onsagenda.nl/events/new', runScripts: 'outside-only' });
  const w = dom.window;
  const sel = w.document.querySelector('uc-select');
  const gezet = [];
  const v = { el: sel, props: { 'model-value': 'daily', 'onUpdate:modelValue': (x, t) => { gezet.push([x, t]); if (neemtOver) v.props['model-value'] = x; } } };
  if (keuzesInProps) v.props.options = keuzes;
  // Of de keuzes als optie-vnodes onder het veld (props.value en de tekst).
  else v.children = keuzes.map((k) => ({ el: null, props: { value: k.value }, children: k.label }));
  const houder = w.document.getElementById('content');
  houder.__vue_app__ = {};
  houder._vnode = { component: { subTree: { children: [{ el: w.document.querySelector('uc-form-field'), props: {}, children: [v] }] } } };
  w.eval(fs.readFileSync(new URL('../dist/main-world.js', import.meta.url), 'utf8'));
  const vraag = () => new Promise((klaar) => {
    const id = 'h' + Math.random();
    const luister = (ev) => { const d = ev.data; if (d && d.type === 'herhalingGezet' && d.id === id) { w.removeEventListener('message', luister); klaar(d); } };
    w.addEventListener('message', luister);
    w.dispatchEvent(new w.MessageEvent('message', { data: { __onsah: true, dir: 'to-main', type: 'zetHerhalingNiet', id }, origin: w.location.origin, source: w }));
    setTimeout(() => klaar(null), 400);
  });
  return { gezet: () => JSON.parse(JSON.stringify(gezet)), vraag };
}

test('main-world: herhaling op Niet via onUpdate:modelValue, met de waarde uit de eigen keuzes', async () => {
  const f = await formulier();
  const r = await f.vraag();
  assert.equal(r.ok, true);
  assert.deepEqual(f.gezet(), [['none', 'Niet']], 'de waarde van Niet, geen vaste waarde');
});

test('main-world: ook als de keuzes als optie-vnodes onder het veld staan', async () => {
  const f = await formulier({ keuzesInProps: false, keuzes: [{ value: null, label: ' Niet ' }, { value: 'daily', label: 'Dagelijks' }] });
  const r = await f.vraag();
  assert.equal(r.ok, true);
  assert.deepEqual(f.gezet(), [[null, 'Niet']]);
});

test('main-world: geen keuze Niet of het veld neemt het niet over: ok false (dan klikt de hulp)', async () => {
  const zonder = await formulier({ keuzes: KEUZES.slice(1) });
  assert.match((await zonder.vraag()).reden, /keuze Niet niet gevonden/);
  assert.deepEqual(zonder.gezet(), [], 'niets gezet');
  const weigert = await formulier({ neemtOver: false });
  const r = await weigert.vraag();
  assert.equal(r.ok, false);
  assert.match(r.reden, /nam de waarde niet over/);
});

// De opslaanpagina met het uitgeklapte herhalingveld op 'Dagelijks'.
const PAGINA = '<!doctype html><html><body><div class="modal"><button aria-expanded="true"><span>Herhaling</span><span>Dagelijks</span></button>'
  + '<uc-form-field data-qa="recurrence-type"><div role="combobox" aria-description="Dagelijks">Dagelijks</div></uc-form-field>'
  + '<ul role="listbox" id="lijst" hidden><li role="option">Niet</li><li role="option">Dagelijks</li></ul></div></body></html>';

function metMainWorld(window, antwoord) {
  const gevraagd = [];
  window.postMessage = (data) => window.dispatchEvent(new window.MessageEvent('message', { data, origin: window.location.origin, source: window }));
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.dir !== 'to-main' || d.type !== 'zetHerhalingNiet') return;
    gevraagd.push(d.type);
    if (antwoord == null) return;
    if (antwoord) { const c = window.document.querySelector('[role="combobox"]'); c.setAttribute('aria-description', 'Niet'); c.textContent = 'Niet'; }
    window.dispatchEvent(new window.MessageEvent('message', { data: { __onsah: true, dir: 'from-main', type: 'herhalingGezet', id: d.id, ok: antwoord }, origin: window.location.origin, source: window }));
  });
  return gevraagd;
}

test('doorplannen uit: herhaling op Niet via het formulier, zonder de keuzelijst te openen', async () => {
  const { api, window } = bootHelper({ html: PAGINA, url: 'https://impegno.onsagenda.nl/events/new' });
  const gevraagd = metMainWorld(window, true);
  let geopend = 0;
  window.document.querySelector('[role="combobox"]').addEventListener('click', () => { geopend++; });
  assert.equal(api.recurrenceIsSet(), true);
  const ok = await new Promise((klaar) => api.setRecurrenceToNiet(klaar));
  assert.equal(ok, true);
  assert.deepEqual(gevraagd, ['zetHerhalingNiet']);
  assert.equal(geopend, 0, 'de keuzelijst bleef dicht');
  assert.equal(api.recurrenceIsSet(), false);
});

test('doorplannen uit: lukt het formulier niet, dan één keer via de keuzelijst', async () => {
  const { api, window } = bootHelper({ html: PAGINA, url: 'https://impegno.onsagenda.nl/events/new' });
  const gevraagd = metMainWorld(window, false);
  const doc = window.document;
  let geopend = 0, gekozen = '';
  doc.querySelector('[role="combobox"]').addEventListener('click', () => { geopend++; doc.getElementById('lijst').hidden = false; });
  doc.querySelectorAll('[role="option"]').forEach((o) => o.addEventListener('click', () => { gekozen = o.textContent; }));
  const ok = await new Promise((klaar) => api.setRecurrenceToNiet(klaar));
  assert.deepEqual(gevraagd, ['zetHerhalingNiet'], 'eerst gevraagd');
  assert.equal(geopend, 1, 'daarna de keuzelijst open');
  assert.equal(gekozen, 'Niet');
  assert.equal(ok, true);
});
