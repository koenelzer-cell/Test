// Debug (zijpaneel, Info): het wachtwoord staat in de configuratie alleen als
// afgeleide. Nieuw: PBKDF2-SHA256 met zout ('pbkdf2-sha256$rondes$zout$hash',
// src/shared/debug-wachtwoord.js; het beheerscherm maakt hem met
// crypto.subtle). Oud: SHA-256 van 'onsah-debug:' + wachtwoord (sha256.js),
// werkt nog tot het wachtwoord opnieuw is ingesteld.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { debugHash, sha256Hex } from '../src/shared/sha256.js';
import { DEBUG_RONDES, debugWachtwoordSoort, isDebugWachtwoord, klopDebugWachtwoord, klopOudDebugWachtwoord, maakDebugWachtwoord } from '../src/shared/debug-wachtwoord.js';

test('SHA-256 voor het debugwachtwoord (oude vorm): gelijk aan de standaard', () => {
  for (const t of ['', 'abc', 'geheim123', 'é€', 'x'.repeat(200)]) assert.equal(sha256Hex(t), createHash('sha256').update(t, 'utf8').digest('hex'), JSON.stringify(t));
  assert.equal(debugHash('geheim123'), createHash('sha256').update('onsah-debug:geheim123').digest('hex'));
});

test('PBKDF2: de vorm, gelijk aan node (en dus aan het beheerscherm), elk keer een ander zout', async () => {
  assert.equal(DEBUG_RONDES, 600000);
  const w = await maakDebugWachtwoord('geheim123', 2000);
  const m = /^pbkdf2-sha256\$2000\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(w);
  assert.ok(m, w);
  assert.equal(m[2], pbkdf2Sync('geheim123', Buffer.from(m[1], 'hex'), 2000, 32, 'sha256').toString('hex'));
  assert.notEqual(await maakDebugWachtwoord('geheim123', 2000), w, 'ander zout');
  assert.equal(debugWachtwoordSoort(w), 'pbkdf2');
  assert.equal(await klopDebugWachtwoord('geheim123', w), true);
  assert.equal(await klopDebugWachtwoord('geheim124', w), false);
  assert.equal(await klopDebugWachtwoord('', w), false);
  assert.equal(klopOudDebugWachtwoord('geheim123', w), false, 'de snelle route geldt alleen voor de oude vorm');
});

test('oude vorm blijft werken; kapotte waarden tellen als geen wachtwoord', async () => {
  const oud = createHash('sha256').update('onsah-debug:geheim123').digest('hex');
  assert.equal(debugWachtwoordSoort(oud), 'sha256');
  assert.equal(klopOudDebugWachtwoord('geheim123', oud), true);
  assert.equal(klopOudDebugWachtwoord('fout', oud), false);
  assert.equal(await klopDebugWachtwoord('geheim123', oud), true);
  for (const kapot of ['', null, undefined, 'abc', oud.slice(1), 'pbkdf2-sha256$600000$zz$' + oud, 'pbkdf2-sha256$10$' + '0'.repeat(32) + '$' + oud, 'pbkdf2-sha256$99999999$' + '0'.repeat(32) + '$' + oud]) {
    assert.equal(isDebugWachtwoord(kapot), false, String(kapot));
    assert.equal(await klopDebugWachtwoord('geheim123', kapot), false);
  }
});
