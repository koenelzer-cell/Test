// De duurkeuze-stijl wordt per afspraaktype ingesteld in het beheerscherm.
// Die keuze moet ALTIJD worden gehonoreerd — ook bij weinig opties, waar de
// code eerder stilzwijgend terugviel op het chipsrooster. Die fout is al twee
// keer opgetreden (eerst voor 'slider' en 'columns', daarna voor 'hourMinute');
// deze tests moeten voorkomen dat een vierde stijl hem opnieuw maakt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

// De stijlen die het beheerscherm aanbiedt (PICKER_STYLES in beheer_u.html).
const STIJLEN = ['hourMinute', 'slider', 'columns'];

// Weinig opties: precies het geval waarin de terugval vroeger toesloeg.
const WEINIG = [15, 30, 45, 60];
const VEEL = Array.from({ length: 40 }, (_, i) => (i + 1) * 5);

function pickers() {
  const { api } = bootHelper();
  assert.ok(api.mkDurationPicker, 'mkDurationPicker is niet blootgesteld');
  return api;
}

// Elke stijl moet een herkenbaar ander resultaat opleveren; als twee stijlen
// dezelfde opmaak geven, wordt er (weer) eentje genegeerd.
function vorm(node) {
  return node ? node.outerHTML.length + '|' + node.querySelectorAll('*').length : 'leeg';
}

// DE KERNTEST. Bij weinig opties kiest de automatische modus het chipsrooster.
// Wordt een ingestelde stijl genegeerd, dan valt hij precies daarop terug — en
// is het resultaat identiek aan "geen stijl". Elke stijl moet daarvan afwijken.
test('een ingestelde stijl wijkt bij WEINIG opties af van de automatische modus', () => {
  const api = pickers();
  const automatisch = vorm(api.mkDurationPicker(WEINIG, () => {}, undefined));
  for (const stijl of STIJLEN) {
    const node = api.mkDurationPicker(WEINIG, () => {}, stijl);
    assert.ok(node, `stijl ${stijl} leverde niets op`);
    assert.notEqual(vorm(node), automatisch,
      `stijl '${stijl}' geeft hetzelfde als geen stijl — de instelling wordt dus genegeerd (dit is de bug die eerder voor slider, columns en hourMinute optrad)`);
  }
});

test('de ingestelde stijlen leveren onderling verschillende weergaven op', () => {
  const api = pickers();
  const gezien = new Map();
  for (const stijl of STIJLEN) {
    const v = vorm(api.mkDurationPicker(WEINIG, () => {}, stijl));
    for (const [andere, av] of gezien) {
      assert.notEqual(v, av, `stijl '${stijl}' geeft exact hetzelfde als '${andere}'`);
    }
    gezien.set(stijl, v);
  }
});

test('elke ingestelde stijl werkt ook bij VEEL opties', () => {
  const api = pickers();
  for (const stijl of STIJLEN) {
    const node = api.mkDurationPicker(VEEL, () => {}, stijl);
    assert.ok(node, `stijl ${stijl} leverde niets op bij veel opties`);
  }
});

test('zonder stijl blijft het automatische gedrag: chips bij weinig, niet bij veel', () => {
  const api = pickers();
  const weinig = api.mkDurationPicker(WEINIG, () => {}, undefined);
  const veel = api.mkDurationPicker(VEEL, () => {}, undefined);
  assert.notEqual(vorm(weinig), vorm(veel),
    'zonder stijl hoort de weergave af te hangen van het aantal opties');
});

test('een onbekende stijl valt veilig terug in plaats van te breken', () => {
  const api = pickers();
  const node = api.mkDurationPicker(WEINIG, () => {}, 'verzonnen-stijl-uit-oude-config');
  assert.ok(node, 'een onbekende (bv. verouderde) stijl mag geen fout geven');
});

test('de schuifregelaar start op de meegegeven beginwaarde', () => {
  const api = pickers();
  // Reistijd begint op 0, een duur op de eerste waarde. Beide moeten werken.
  assert.ok(api.mkDurationPicker([0, 5, 10], () => {}, 'slider', 0));
  assert.ok(api.mkDurationPicker(WEINIG, () => {}, 'slider'));
});

// ── Korte reeksen: geen zinloze uren-stap ────────────────────────────────────
// Bij de vraag "hoeveel directe/indirecte tijd zat er in deze registratie?" gaat
// het om minuten binnen één registratie. De uren-stap leverde daar de keuze
// tussen "0 uur" en "1 uur" op.
const PORTIE = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]; // 5 t/m 60 min
// Een registratie van 19:15 tot 21:15 = 120 minuten; portiestap 5 → 24 keuzes.
// Dit is het geval uit de praktijk waar de uren-stap ten onrechte verscheen.
const PORTIE_2UUR = Array.from({ length: 24 }, (_, i) => (i + 1) * 5);

test('een reeks tot en met een uur vraagt meteen om minuten', () => {
  const api = pickers();
  const node = api.mkDurationPicker(PORTIE, () => {}, 'hourMinute');
  const tekst = node.textContent || '';
  assert.doesNotMatch(tekst, /aantal uren/i,
    'bij een bereik tot 60 minuten is "kies eerst het aantal uren" zinloos');
  assert.doesNotMatch(tekst, /0 uur/,
    '"0 uur" is geen begrijpelijke keuze');
  assert.match(tekst, /5 min/, 'de losse minuten horen direct kiesbaar te zijn');
});

test('alle waarden van een korte reeks zijn in één keer te kiezen', () => {
  const api = pickers();
  const node = api.mkDurationPicker(PORTIE, () => {}, 'hourMinute');
  const knoppen = node.querySelectorAll('button');
  assert.equal(knoppen.length, PORTIE.length,
    'elke minutenwaarde hoort direct aanklikbaar te zijn, kreeg ' + knoppen.length);
});

test('een korte reeks kiest de juiste waarde', () => {
  const api = pickers();
  let gekozen = null;
  const node = api.mkDurationPicker(PORTIE, (v) => { gekozen = v; }, 'hourMinute');
  const knoppen = [...node.querySelectorAll('button')];
  const knop = knoppen.find((b) => /^30 min/.test(b.textContent || ''));
  assert.ok(knop, 'er hoort een knop voor 30 minuten te zijn');
  knop.click();
  assert.equal(gekozen, 30);
});

test('een lange reeks houdt de uren-stap, met een begrijpelijk label', () => {
  const api = pickers();
  const lang = [];
  for (let m = 15; m <= 480; m += 15) lang.push(m);
  const node = api.mkDurationPicker(lang, () => {}, 'hourMinute');
  const tekst = node.textContent || '';
  assert.match(tekst, /aantal uren/i, 'bij acht uur is de uren-stap juist nuttig');
  assert.doesNotMatch(tekst, /(^|[^<]\s)0 uur/, 'de eerste groep hoort "< 1 uur" te heten');
  assert.match(tekst, /< 1 uur/, 'de groep onder het uur moet begrijpelijk zijn');
});

test('een registratie van twee uur vraagt de portie in stappen van 5 minuten', () => {
  const api = pickers();
  const node = api.mkDurationPicker(PORTIE_2UUR, () => {}, 'hourMinute');
  const tekst = node.textContent || '';
  assert.doesNotMatch(tekst, /aantal uren/i,
    'bij "hoeveel indirecte tijd zat hierin?" denk je in minuten, niet in uren');
  assert.doesNotMatch(tekst, /< 1 uur/,
    'de keuze "< 1 uur / 1 uur / 2 uur" is precies wat hier niet hoort');
  const knoppen = [...node.querySelectorAll('button')];
  assert.equal(knoppen.length, 24, 'alle 24 stappen van 5 minuten horen direct kiesbaar te zijn');
  assert.ok(knoppen.some((b) => /^5 min/.test(b.textContent || '')), 'de kleinste stap is 5 minuten');
  // De weergave volgt de instelling; standaard is dat uren en minuten.
  assert.ok(knoppen.some((b) => /^2 uur$/.test((b.textContent || '').trim())),
    'de grootste keuze is de volledige duur van twee uur');
});

test('bij een echt lange reeks blijft de uren-stap bestaan', () => {
  const api = pickers();
  const lang = [];
  for (let m = 15; m <= 480; m += 15) lang.push(m); // afspraakduur tot 8 uur = 32 keuzes
  const tekst = (api.mkDurationPicker(lang, () => {}, 'hourMinute').textContent || '');
  assert.match(tekst, /aantal uren/i, 'daar is de uren-stap juist wél zinvol');
});

// ── Weergave van de keuzeknoppen ────────────────────────────────────────────
// Bij een afspraakduur denk je in uren ("1 uur 15 min."), bij reistijd in
// minuten ("45 min."). Beide zijn instelbaar in het beheerscherm.

test('duur wordt standaard in uren en minuten getoond', () => {
  const api = pickers();
  assert.equal(api.durationChipLabel(75, 'urenMinuten'), '1 uur 15 min.');
  assert.equal(api.durationChipLabel(60, 'urenMinuten'), '1 uur');
  assert.equal(api.durationChipLabel(45, 'urenMinuten'), '45 min.');
});

test('de minuten-weergave laat het uur achterwege', () => {
  const api = pickers();
  assert.equal(api.durationChipLabel(75, 'minuten'), '75 min.');
  assert.equal(api.durationChipLabel(120, 'minuten'), '120 min.');
});

test('zonder instelling: duur in uren, reistijd in minuten', () => {
  const api = pickers();
  assert.equal(api.durationLabelStyle('duur'), 'urenMinuten');
  assert.equal(api.durationLabelStyle('reistijd'), 'minuten',
    'voor reistijd was de minuten-weergave juist prettig');
});

test('de chips van een afspraakduur tonen uren en minuten', () => {
  const api = pickers();
  const waarden = [15, 30, 45, 60, 75, 90];
  const node = api.mkDurationPicker(waarden, () => {}, undefined, undefined, 'urenMinuten');
  const tekst = node.textContent || '';
  assert.match(tekst, /1 uur 15 min/, 'dit was de weergave die verdween');
  assert.doesNotMatch(tekst, /75 min/, 'en niet de kale minuten');
});

test('het platte minutenrooster volgt dezelfde weergave', () => {
  const api = pickers();
  const waarden = Array.from({ length: 24 }, (_, i) => (i + 1) * 5); // portie van 2 uur
  const uren = api.mkDurationPicker(waarden, () => {}, 'hourMinute', undefined, 'urenMinuten');
  assert.match(uren.textContent || '', /1 uur 15 min/,
    'ook bij de portievraag hoort de ingestelde weergave te gelden');
  const min = api.mkDurationPicker(waarden, () => {}, 'hourMinute', undefined, 'minuten');
  assert.match(min.textContent || '', /75 min/);
});
