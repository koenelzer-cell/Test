#!/usr/bin/env node
// Controleert de importen in src/ (zonder te bundelen):
//
//  1. Elk onderdeel (content, background, popup, sidepanel, …) wordt
//     een aparte bundel. Ze delen code alleen via src/shared/ — nooit
//     rechtstreeks uit elkaars map (dan belandt code van het ene onderdeel
//     ongemerkt in de bundel van het andere).
//  2. Elke import verwijst naar een bestaand bestand dat de naam exporteert.
//  3. Vergeten imports: een naam die een module gebruikt maar nergens in dat
//     bestand declareert of importeert, terwijl een module in hetzelfde
//     onderdeel of in src/shared/ hem exporteert. esbuild meldt dat niet (het is
//     dan een globale variabele) en het gaat pas bij het uitvoeren mis.
//  4. Onbekende namen: een naam die nergens gedeclareerd of geïmporteerd is en
//     ook geen globale van de browser is (zo stond createAgendaPanel in het
//     zijpaneel zonder import, en bleef het zijpaneel leeg).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import * as esbuild from 'esbuild';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const fouten = [];

const files = [];
(function scan(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) scan(p);
    else if (/\.jsx?$/.test(e.name)) files.push(p);
  }
})(SRC);

const partOf = (abs) => path.relative(SRC, abs).split(path.sep)[0];
const rel = (abs) => path.relative(ROOT, abs);

// Namen uit een declaratiepatroon ({ a, b: [c] } = …, function-parameters, …).
function patternNames(node, out) {
  if (!node) return;
  switch (node.type) {
    case 'Identifier': out.add(node.name); break;
    case 'ObjectPattern': node.properties.forEach((p) => patternNames(p.type === 'RestElement' ? p.argument : p.value, out)); break;
    case 'ArrayPattern': node.elements.forEach((e) => patternNames(e, out)); break;
    case 'RestElement': patternNames(node.argument, out); break;
    case 'AssignmentPattern': patternNames(node.left, out); break;
  }
}

const info = new Map();
for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');
  let ast;
  // JSX eerst naar gewone JavaScript (zoals de bundel het doet); een component
  // in JSX telt dan als gebruikte naam.
  if (f.endsWith('.jsx')) {
    try { src = esbuild.transformSync(src, { loader: 'jsx', jsx: 'automatic', format: 'esm' }).code; }
    catch (e) { fouten.push(`${rel(f)}: syntaxfout: ${e.message}`); continue; }
  }
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch (e) { fouten.push(`${rel(f)}: syntaxfout: ${e.message}`); continue; }
  const exports = new Set(), imports = [], declared = new Set(), used = new Set();
  for (const st of ast.body) {
    if (st.type === 'ExportNamedDeclaration' && st.declaration) {
      const d = st.declaration;
      if (d.id) exports.add(d.id.name);
      if (d.declarations) d.declarations.forEach((x) => patternNames(x.id, exports));
    }
    // export { a, b } (zo schrijft esbuild de exports van een .jsx-bestand).
    if (st.type === 'ExportNamedDeclaration' && !st.declaration && !st.source) st.specifiers.forEach((x) => exports.add(x.exported.name));
    if (st.type === 'ImportDeclaration') {
      imports.push({ from: st.source.value, names: st.specifiers.map((s) => (s.imported ? s.imported.name : 'default')) });
      st.specifiers.forEach((s) => declared.add(s.local.name));
    }
  }
  walk.full(ast, (node) => {
    switch (node.type) {
      case 'VariableDeclarator': patternNames(node.id, declared); break;
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression':
        if (node.id) declared.add(node.id.name);
        node.params.forEach((p) => patternNames(p, declared)); break;
      case 'ClassDeclaration': case 'ClassExpression': if (node.id) declared.add(node.id.name); break;
      case 'CatchClause': patternNames(node.param, declared); break;
    }
  });
  // Gebruikte namen: identifiers die geen eigenschapsnaam zijn.
  walk.ancestor(ast, {
    Identifier(node, ancestors) {
      const parent = ancestors[ancestors.length - 2];
      if (parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
      if (parent && parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) return;
      if (parent && (parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.key === node) return;
      used.add(node.name);
    },
  });
  info.set(f, { exports, imports, declared, used });
}

const exportedBy = new Map();
for (const [f, i] of info) for (const n of i.exports) {
  if (!exportedBy.has(n)) exportedBy.set(n, []);
  exportedBy.get(n).push(f);
}

for (const [f, i] of info) {
  const part = partOf(f);
  for (const { from, names } of i.imports) {
    if (!from.startsWith('.')) continue; // npm-pakketten (react)
    const target = path.resolve(path.dirname(f), from);
    if (!fs.existsSync(target)) { fouten.push(`${rel(f)}: importeert ${from}, dat bestaat niet`); continue; }
    const tPart = partOf(target);
    if (tPart !== part && tPart !== 'shared') fouten.push(`${rel(f)}: importeert uit ${tPart}/ (${from}); deel code alleen via src/shared/`);
    const ex = info.get(target) ? info.get(target).exports : new Set();
    for (const n of names) if (n !== 'default' && !ex.has(n)) fouten.push(`${rel(f)}: ${n} wordt niet geëxporteerd door ${from}`);
  }
  for (const n of i.used) {
    if (i.declared.has(n)) continue;
    const owners = (exportedBy.get(n) || []).filter((o) => o !== f && (partOf(o) === part || partOf(o) === 'shared'));
    if (owners.length) fouten.push(`${rel(f)}: gebruikt ${n} zonder import (geëxporteerd door ${owners.map(rel).join(', ')})`);
  }
}

// Globalen van een browserpagina (jsdom) en van de JS-runtime, plus wat de
// extensie-API en de bundel zelf leveren.
const GLOBALS = new Set([
  ...Object.getOwnPropertyNames(globalThis),
  ...(() => { const names = new Set(); let o = new JSDOM('').window; while (o) { Object.getOwnPropertyNames(o).forEach((n) => names.add(n)); o = Object.getPrototypeOf(o); } return names; })(),
  'chrome', 'browser', 'arguments', 'undefined', 'self', 'importScripts',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'structuredClone', 'CSS', 'ResizeObserver',
  'IntersectionObserver', 'PerformanceObserver', 'Intl', 'WeakRef', 'FinalizationRegistry',
  'AbortController', 'TextEncoder', 'TextDecoder', 'fetch', 'Response', 'Request', 'Headers',
]);
for (const [f, i] of info) {
  for (const n of i.used) {
    if (i.declared.has(n) || GLOBALS.has(n)) continue;
    if ((exportedBy.get(n) || []).some((o) => o !== f && (partOf(o) === partOf(f) || partOf(o) === 'shared'))) continue; // al gemeld
    fouten.push(`${rel(f)}: onbekende naam ${n} (niet gedeclareerd, niet geïmporteerd, geen globale)`);
  }
}

const uniek = [...new Set(fouten)];
if (uniek.length) {
  console.error('Importcontrole mislukt:\n  - ' + uniek.join('\n  - '));
  process.exit(1);
}
console.log(`Importcontrole OK: ${files.length} modules, alleen gedeeld via src/shared/.`);
