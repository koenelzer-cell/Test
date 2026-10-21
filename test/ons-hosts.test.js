// De ONS-adressen komen uit host_permissions van het manifest. Het gewone
// pakket kent de testomgeving niet; het testpakket voegt die alleen in het
// manifest toe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
globalThis.chrome = { runtime: { getManifest: () => manifest } };
const { isOnsUrl, ONS_URL_PATTERNS } = await import('../src/shared/ons-hosts.js');

test('de ONS-adressen zijn de host_permissions van het manifest', () => {
  assert.deepEqual(ONS_URL_PATTERNS, manifest.host_permissions);
});

test('isOnsUrl: ONS Agenda en ONS Dossier wel, de testomgeving en andere sites niet', () => {
  assert.equal(isOnsUrl('https://impegno.onsagenda.nl/invitees/1/calendar/week'), true);
  assert.equal(isOnsUrl('https://impegno.ons-dossier.nl/clients/1'), true);
  assert.equal(isOnsUrl('https://impegno-staging-staging.ons-dossier.nl/clients/1'), false);
  assert.equal(isOnsUrl('https://impegno.onsagenda.nl.voorbeeld.nl/'), false);
  assert.equal(isOnsUrl('http://impegno.onsagenda.nl/'), false);
  assert.equal(isOnsUrl('https://voorbeeld.nl/?u=https://impegno.onsagenda.nl/'), false);
  assert.equal(isOnsUrl(undefined), false);
});
