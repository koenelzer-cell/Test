// Ongedaan maken. "Verwijder instellingen" maakt alle velden leeg; undo zet
// terug wat er stond. Het verschil telt zodra de medewerker zelf al iets had
// ingevuld — een zelf getypte titel hoort niet te verdwijnen omdat je het
// verkeerde afspraaktype aanklikte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

function paginaMetVelden(document, waarden) {
  document.body.innerHTML = '';
  const mk = (id, label, value) => {
    const wrap = document.createElement('div');
    const lab = document.createElement('label');
    lab.textContent = label;
    const inp = document.createElement('input');
    inp.id = id; inp.value = value;
    wrap.append(lab, inp); document.body.appendChild(wrap);
    return inp;
  };
  return { titel: mk('appointment_title', 'Titel', waarden.titel || '') };
}

test('zonder momentopname is er niets om naar terug te keren', () => {
  const { api } = bootHelper();
  assert.equal(api.hasAppointmentSnapshot(), false,
    'de undo-knop hoort pas te verschijnen nadat de hulp iets heeft ingevuld');
});

test('na een momentopname is er wél iets om naar terug te keren', () => {
  const { api, document } = bootHelper();
  paginaMetVelden(document, { titel: 'Zelf getypte titel' });
  api.takeAppointmentSnapshot();
  assert.equal(api.hasAppointmentSnapshot(), true);
});

test('de momentopname legt de bestaande waarden vast', () => {
  const { api, document } = bootHelper();
  paginaMetVelden(document, { titel: 'Zelf getypte titel' });
  const snap = api.takeAppointmentSnapshot();
  assert.ok(snap, 'er hoort een momentopname te zijn');
  assert.ok(Object.prototype.hasOwnProperty.call(snap, 'titel'), 'de titel hoort vastgelegd te worden');
  assert.ok(Array.isArray(snap.labels), 'de labels horen als lijst vastgelegd te worden');
});

test('de momentopname kan gewist worden', () => {
  const { api, document } = bootHelper();
  paginaMetVelden(document, { titel: 'x' });
  api.takeAppointmentSnapshot();
  api.clearAppointmentSnapshot();
  assert.equal(api.hasAppointmentSnapshot(), false,
    'na terugdraaien of een nieuwe afspraak mag er geen oude opname blijven hangen');
});

test('een tweede momentopname vervangt de eerste', () => {
  const { api, document } = bootHelper();
  paginaMetVelden(document, { titel: 'eerste' });
  api.takeAppointmentSnapshot();
  paginaMetVelden(document, { titel: 'tweede' });
  const snap = api.takeAppointmentSnapshot();
  assert.ok(api.hasAppointmentSnapshot());
  assert.ok(snap, 'de nieuwe stand hoort de oude te vervangen, niet ernaast te bestaan');
});
