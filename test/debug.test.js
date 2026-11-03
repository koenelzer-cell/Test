// Debug (zijpaneel, Info): het wachtwoord staat in de configuratie alleen als
// SHA-256 van 'onsah-debug:' + wachtwoord; het beheerscherm rekent met
// crypto.subtle, het zijpaneel met src/shared/sha256.js. Die moeten gelijk zijn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { debugHash, sha256Hex } from '../src/shared/sha256.js';

test('SHA-256 voor het debugwachtwoord: gelijk aan de standaard (en dus aan crypto.subtle in het beheerscherm)', () => {
  for (const t of ['', 'abc', 'geheim123', 'é€', 'x'.repeat(200)]) assert.equal(sha256Hex(t), createHash('sha256').update(t, 'utf8').digest('hex'), JSON.stringify(t));
  assert.equal(debugHash('geheim123'), createHash('sha256').update('onsah-debug:geheim123').digest('hex'));
});
