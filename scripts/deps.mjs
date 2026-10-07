#!/usr/bin/env node
// Toont hoe de modules van het content-script van elkaar afhangen en welke
// importen tegen de laagindeling ingaan.
//
// Lagen (laag → hoog). Een module mag importeren uit zijn eigen laag of lager:
//   shared    src/shared/: constanten die alle onderdelen delen (berichten, opslagsleutels)
//   core      datum/tijd, testhaak — geen afhankelijkheden
//   platform  moduleplatform + meldingenkanaal (platform/module-host.js)
//   config    configuratie (standaard, geladen, afgeleid)
//   storage   opslag van voorkeuren
//   state     state.js: gedeelde toestand van de hulp
//   ons       kennis van de ONS-pagina: selectors, DOM, formuliervelden lezen
//   domain    pure rekenlogica op ONS-gegevens
//   services  netwerk: de ONS-API
//   ui        bouwstenen voor schermen (knoppen, iconen, duurkiezer, React-brug)
//   screen    diensten voor schermen: statusregel, schermvak, schermmarkering
//   features  wat de hulp doet (afspraak, registratie, agenda, …)
//   helper    de regie: paneel opbouwen, aan/uit, routering, scherm herstellen
//   entry     index.js en test-hooks.js
//
//   node scripts/deps.mjs            samenvatting + overtredingen
//   node scripts/deps.mjs --strict   exitcode 1 bij overtredingen

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(ROOT, 'src', 'content');
const LAYERS = ['shared', 'core', 'platform', 'config', 'storage', 'state', 'ons', 'domain', 'services', 'ui', 'screen', 'features', 'helper', 'entry'];

// Bewuste uitzonderingen, met reden. Houd deze lijst kort.
const ALLOWED = [
  // De beschikbaarheidswaarschuwing onderbreekt het huidige scherm en keert
  // er daarna naar terug; dat herstellen is regie (helper/).
  ['features/appointment/availability.js', 'helper/screen-restore.js'],
];
// (Configuratiewijzigingen lopen niet via importen omhoog maar via
// config/hooks.js; index.js koppelt de reacties bij het opstarten.)

const layerOf = (rel) => {
  if (rel === 'index.js' || rel === 'test-hooks.js') return 'entry';
  if (rel === 'state.js') return 'state';
  if (rel.startsWith('../shared/')) return 'shared';
  return rel.split('/')[0];
};

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p);
  }
})(BASE);

const graph = new Map();
for (const f of files) {
  const rel = path.relative(BASE, f).split(path.sep).join('/');
  const src = fs.readFileSync(f, 'utf8');
  const deps = [...src.matchAll(/^import\s[\s\S]*?from\s+'([^']+)';/gm)]
    .map((m) => path.relative(BASE, path.resolve(path.dirname(f), m[1])).split(path.sep).join('/'));
  graph.set(rel, deps);
}

const violations = [];
for (const [mod, deps] of graph) {
  const lm = LAYERS.indexOf(layerOf(mod));
  for (const d of deps) {
    const ld = LAYERS.indexOf(layerOf(d));
    if (ld > lm && !ALLOWED.some(([a, b]) => a === mod && b === d)) violations.push(`${mod}  →  ${d}`);
  }
}

// Cycli tellen (Tarjan: sterk samenhangende componenten > 1 module).
let index = 0; const stack = []; const idx = new Map(); const low = new Map(); const on = new Set(); const sccs = [];
const strong = (v) => {
  idx.set(v, index); low.set(v, index); index++; stack.push(v); on.add(v);
  for (const w of graph.get(v) || []) {
    if (!graph.has(w)) continue;
    if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); }
    else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
  }
  if (low.get(v) === idx.get(v)) {
    const c = []; let w;
    do { w = stack.pop(); on.delete(w); c.push(w); } while (w !== v);
    if (c.length > 1) sccs.push(c);
  }
};
for (const v of graph.keys()) if (!idx.has(v)) strong(v);

console.log(`${graph.size} modules`);
for (const l of LAYERS) {
  const n = [...graph.keys()].filter((m) => layerOf(m) === l).length;
  if (n) console.log(`  ${l.padEnd(9)} ${n}`);
}
console.log(`\nImporten tegen de laagindeling in: ${violations.length}`);
violations.forEach((v) => console.log('  ' + v));
console.log(`\nCyclische groepen: ${sccs.length}${sccs.length ? ' (grootste: ' + Math.max(...sccs.map((c) => c.length)) + ' modules)' : ''}`);
if (process.argv.includes('--verbose')) sccs.forEach((c) => console.log('  - ' + c.sort().join(', ')));
if (process.argv.includes('--strict') && violations.length) process.exit(1);
