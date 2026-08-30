// Waarschuwing bij overlap, vóór opslaan.
//
// ONS meldt dit pas als je opslaat, en alleen bij registraties — bij afspraken
// controleert het helemaal niets. Deze controle waarschuwt eerder en bij beide.
// Puur een tijdvergelijking: er wordt geen cliëntinformatie gelezen (de titel
// van een agenda-item bevat bij registraties de cliëntnaam en blijft daarom
// buiten beeld; alleen de uursoort komt mee).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

const uur = (h, m = 0) => h * 60 + m;
const vak = (ymd, s, e, extra = {}) => ({ id: extra.id || null, ymd, startMin: s, endMin: e, uursoort: extra.uursoort || '' });

test('overlappende tijdvakken worden herkend', () => {
  const { api } = bootHelper();
  const o = api._tijdvakkenOverlappen;
  assert.equal(o(uur(10), uur(11), uur(10, 30), uur(11, 30)), true, 'gedeeltelijk');
  assert.equal(o(uur(10), uur(12), uur(10, 30), uur(11)), true, 'omsloten');
  assert.equal(o(uur(10), uur(11), uur(10), uur(11)), true, 'identiek');
});

test('aansluitende afspraken zijn geen overlap', () => {
  const { api } = bootHelper();
  assert.equal(api._tijdvakkenOverlappen(uur(10), uur(11), uur(11), uur(12)), false,
    '10:00-11:00 gevolgd door 11:00-12:00 is gewoon een volle dag');
});

test('een overlappende afspraak op dezelfde dag wordt gevonden', () => {
  const { api } = bootHelper();
  api.__setTijdvakken('afspraken', '2026-08-25', [
    vak('2026-08-25', uur(9), uur(10)),
    vak('2026-08-25', uur(20, 5), uur(22, 5), { uursoort: 'JG Huisbezoek' }),
  ]);
  const hit = api.overlappendTijdvak('afspraken', '2026-08-25', uur(21), uur(22), null);
  assert.ok(hit, 'het tijdvak van 20:05 tot 22:05 overlapt');
  assert.equal(hit.uursoort, 'JG Huisbezoek');
});

test('de melding noemt de tijden en de uursoort', () => {
  const { api } = bootHelper();
  const tekst = api.overlapMelding(vak('2026-08-25', uur(20, 5), uur(22, 5), { uursoort: 'JG MDO' }), 'een afspraak');
  assert.match(tekst, /20:05/);
  assert.match(tekst, /22:05/);
  assert.match(tekst, /JG MDO/);
  assert.match(tekst, /afspraak/);
});

test('een andere dag telt niet mee', () => {
  const { api } = bootHelper();
  api.__setTijdvakken('afspraken', '2026-08-25', [vak('2026-08-24', uur(10), uur(12))]);
  assert.equal(api.overlappendTijdvak('afspraken', '2026-08-25', uur(10), uur(11), null), null);
});

test('een item merkt zichzelf niet aan als overlap', () => {
  const { api } = bootHelper();
  api.__setTijdvakken('registraties', '2026-08-25', [vak('2026-08-25', uur(10), uur(11), { id: 'reg-1' })]);
  assert.equal(api.overlappendTijdvak('registraties', '2026-08-25', uur(10), uur(11), 'reg-1'), null,
    'bij het bewerken van een bestaande registratie mag die zichzelf niet melden');
  assert.ok(api.overlappendTijdvak('registraties', '2026-08-25', uur(10), uur(11), 'reg-2'));
});

test('afspraken en registraties worden apart bijgehouden', () => {
  const { api } = bootHelper();
  api.__setTijdvakken('afspraken', '2026-08-25', [vak('2026-08-25', uur(10), uur(11))]);
  assert.ok(api.overlappendTijdvak('afspraken', '2026-08-25', uur(10), uur(11), null));
  assert.equal(api.overlappendTijdvak('registraties', '2026-08-25', uur(10), uur(11), null), null,
    'een afspraak is geen registratie; de lagen mogen elkaar niet vervuilen');
});

test('zonder geladen weekgegevens wordt er niets gemeld', () => {
  const { api } = bootHelper();
  assert.equal(api.overlappendTijdvak('afspraken', '2026-08-25', uur(10), uur(11), null), null,
    'liever zwijgen dan melden op onvolledige gegevens');
});
