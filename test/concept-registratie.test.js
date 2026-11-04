// Een als concept opgeslagen registratie (declaration.sent false) telt op
// backup staging niet mee in de weekcijfers; elders blijft alles zoals het was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRegistrationDetails } from '../src/content/domain/registrations.js';

const CONCEPT = { registration: { date: '2026-11-04', direct_time: 80, indirect_time: 0, travel_time_before: 0, travel_time_after: 0,
  start_time: '2026-11-04T06:05:00.000+01:00', end_time: '2026-11-04T07:25:00.000+01:00', hour_type: { id: 5, external_id: 23, name: 'JW BG H10 Individuele BG midde' },
  declaration: { sent: false, status: 'valid', on_date: 'Geregistreerd op 04 november 2026 09:45' } } };

test('concept telt niet mee als dat gevraagd wordt (staging); anders gewoon wel', () => {
  assert.equal(parseRegistrationDetails(CONCEPT, { conceptTeltNiet: true }), null);
  const gewoon = parseRegistrationDetails(CONCEPT);
  assert.equal(gewoon.directMin, 80, 'zonder de optie (productie) telt hij mee');
  const ingediend = JSON.parse(JSON.stringify(CONCEPT));
  ingediend.registration.declaration.sent = true;
  assert.equal(parseRegistrationDetails(ingediend, { conceptTeltNiet: true }).directMin, 80, 'ingediend telt mee');
  const zonder = JSON.parse(JSON.stringify(CONCEPT));
  delete zonder.registration.declaration;
  assert.equal(parseRegistrationDetails(zonder, { conceptTeltNiet: true }).directMin, 80, 'zonder declaration telt hij mee');
});
