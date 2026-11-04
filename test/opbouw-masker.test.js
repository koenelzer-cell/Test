// De opbouw van ONS-antwoorden voor Debug, Netwerk (shared/opbouw-masker.js):
// sleutels en soorten waarden, zonder persoonsgegevens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { opbouwTekst, opbouwVan } from '../src/shared/opbouw-masker.js';

test('cliëntgegevens afgeschermd, ook dieper; de opbouw blijft zichtbaar', () => {
  const o = opbouwVan({ client: { id: 11142, name: 'Tamara Test', birth_date: '1990-01-01', care_allocations: [{ begin_date: '2014-01-01' }] }, gender: 'female', home_town: 'Groningen', status: 'draft', direct_time: 55 });
  const t = JSON.stringify(o);
  assert.doesNotMatch(t, /Tamara|1990|2014|female|Groningen|11142/);
  assert.deepEqual(o.client.care_allocations, [{ begin_date: 'tekst(10)' }]);
  assert.equal(o.client.id, 'id');
  assert.equal(o.status, 'draft', 'een korte code blijft staan');
  assert.equal(o.direct_time, 55);
});

test('tekst op een plek in een lijst (zonder sleutel) afgeschermd, behalve korte codes', () => {
  const o = opbouwVan({ basic_list: [['Onlangs gebruikt', [['Jan Jansen', 9, [], false]]], ['allowed', []]] });
  assert.deepEqual(o.basic_list[0], ['tekst(16)', [['tekst(10)', 9, [], false]]]);
  assert.equal(o.basic_list[1][0], 'allowed');
});

test('uursoorten (activity, hour_type) leesbaar: naam, code en id; tenzij onder een gevoelige sleutel', () => {
  const o = opbouwVan({ suggestedActivityList: [{ activityModel: { objectId: 1089, description: 'Detachering ', identificationNo: 'DET-01' } }], hour_type: { external_id: '1146' }, client: { hour_type: { name: 'Geheim' } } });
  assert.deepEqual(o.suggestedActivityList[0].activityModel, { objectId: 1089, description: 'Detachering ', identificationNo: 'DET-01' });
  assert.deepEqual(o.hour_type, { external_id: '1146' });
  assert.deepEqual(o.client.hour_type, { name: 'tekst(6)' }, 'onder client blijft alles afgeschermd');
});

test('adressen zonder nummers en zoekwaarden; datums en tijden blijven; lange tekst en grote getallen ingekort', () => {
  const o = opbouwVan({ url: '/clients/11142/dossier?term=Jan', start_time: '2026-11-03T13:05:00.000+01:00', tijd: '13:05', notitie_kort: 'x'.repeat(50), lang: 'y'.repeat(50), bedrag: 1234567 });
  assert.equal(o.url, '/clients/{n}/dossier?term=…');
  assert.equal(o.start_time, '2026-11-03T13:05:00.000+01:00');
  assert.equal(o.tijd, '13:05');
  assert.equal(o.lang, 'tekst(50)');
  assert.equal(o.bedrag, 'getal(7)');
});

test('opbouwTekst: alleen JSON; ingekort tot het maximum', () => {
  assert.equal(opbouwTekst('<html>'), '');
  assert.equal(opbouwTekst(''), '');
  assert.equal(opbouwTekst('{kapot'), '');
  assert.equal(opbouwTekst('{"status":"ok","n":3}'), '{"status":"ok","n":3}');
  const groot = opbouwTekst(JSON.stringify({ a: Array.from({ length: 3 }, () => ({ k: 'x'.repeat(30), l: 'y'.repeat(30), m: 'z'.repeat(30) })) }), 60);
  assert.match(groot, /…\(ingekort\)$/);
});

test('declaration: status en sent blijven leesbaar, on_date (kan een naam bevatten) niet', () => {
  const o = opbouwVan({ registration: { declaration: { sent: false, status: 'valid', on_date: 'Geregistreerd door Jan op 04 november' }, created_by: 'Jan' } });
  assert.deepEqual(o.registration.declaration, { sent: false, status: 'valid', on_date: 'tekst(37)' });
  assert.equal(o.registration.created_by, 'tekst(3)');
});
