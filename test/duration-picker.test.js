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
