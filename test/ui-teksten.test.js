// Afspraak voor alle tekst die de extensie toont: geen '·' en geen lange of
// halve streepjes ('—', '–'); 'tot', 'en', komma's of een nieuwe regel.
// Deze test kijkt naar elke tekst in de broncode (strings en template-literals,
// geen commentaar).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const SRC = new URL('../src/', import.meta.url).pathname;
const bestanden = [];
(function zoek(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) zoek(p); else if (e.name.endsWith('.js')) bestanden.push(p);
  }
})(SRC);

test("geen '·' of streepjes in teksten van de extensie", () => {
  const fout = [];
  for (const f of bestanden) {
    const ast = acorn.parse(fs.readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    walk.full(ast, (n) => {
      const tekst = n.type === 'Literal' && typeof n.value === 'string' ? n.value : n.type === 'TemplateElement' ? n.value.cooked : null;
      if (tekst && /[·–—]/.test(tekst)) fout.push(path.relative(SRC, f) + ':' + n.loc.start.line + ' ' + JSON.stringify(tekst));
    });
  }
  assert.deepEqual(fout, []);
});
