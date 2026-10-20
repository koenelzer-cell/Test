// Schermen openen elkaar via screen/schermen.js (schermen.showX()), niet via
// importen. Een tikfout daar zou pas tijdens het gebruik opvallen; deze test
// kijkt het vooraf na: elk gebruikt scherm is in index.js aangemeld en bestaat.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content');
const bestanden = [];
(function loop(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) loop(p); else if (e.name.endsWith('.js')) bestanden.push(p); } })(BASE);
// Zonder commentaar: daar staat 'schermen.showX()' als voorbeeld.
const zonderCommentaar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
const bron = Object.fromEntries(bestanden.map((f) => [f, zonderCommentaar(fs.readFileSync(f, 'utf8'))]));

test('elk scherm dat via schermen wordt geopend, is in index.js aangemeld en bestaat', () => {
  const gebruikt = new Set();
  for (const s of Object.values(bron)) for (const m of s.matchAll(/(?<![/\w])schermen\.(\w+)/g)) gebruikt.add(m[1]);
  const blok = /koppelSchermen\(\{([\s\S]*?)\}\);/.exec(bron[path.join(BASE, 'index.js')]);
  assert.ok(blok, 'koppelSchermen in index.js');
  const aangemeld = new Set(blok[1].split(',').map((x) => x.trim()).filter(Boolean));
  for (const n of gebruikt) assert.ok(aangemeld.has(n), 'niet aangemeld: ' + n);
  for (const n of aangemeld) {
    assert.ok(Object.values(bron).some((s) => new RegExp('export function ' + n + '\\b').test(s)), 'bestaat niet: ' + n);
  }
  assert.ok(gebruikt.size > 10);
});
