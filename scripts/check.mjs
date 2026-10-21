#!/usr/bin/env node
// Snelle controles zonder browser:
//  1. manifest.json is geldige MV3 en verwijst alleen naar bestaande bestanden;
//  2. elk script dat de browser laadt (manifest + HTML-pagina's) heeft geldige syntax;
//  3. de inline-scripts van het beheerscherm zijn parseerbaar;
//  4. config.json en managed_schema.json zijn geldige JSON.
// Stopt met exitcode 1 bij de eerste categorie met fouten.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.join(ROOT, p);
const fouten = [];

// ── 1. Manifest ────────────────────────────────────────────────────────────
const manifest = JSON.parse(fs.readFileSync(rel('manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) fouten.push('manifest: geen manifest_version 3');
if (!manifest.version) fouten.push('manifest: geen versie');

const nodig = new Set();
const scripts = new Set();
(manifest.content_scripts || []).forEach((c) => (c.js || []).forEach((f) => { nodig.add(f); scripts.add(f); }));
if (manifest.background?.service_worker) { nodig.add(manifest.background.service_worker); scripts.add(manifest.background.service_worker); }
const paginas = [manifest.action?.default_popup, manifest.side_panel?.default_path].filter(Boolean);
paginas.forEach((p) => nodig.add(p));
if (manifest.storage?.managed_schema) nodig.add(manifest.storage.managed_schema);
Object.values(manifest.icons || {}).forEach((f) => nodig.add(f));
(manifest.web_accessible_resources || []).forEach((w) => (w.resources || []).forEach((f) => nodig.add(f)));

// Scripts die een extensiepagina zelf laadt (<script src="…">).
for (const pagina of paginas) {
  if (!fs.existsSync(rel(pagina))) continue;
  const html = fs.readFileSync(rel(pagina), 'utf8');
  for (const m of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
    const f = path.posix.normalize(path.posix.join(path.posix.dirname(pagina), m[1]));
    nodig.add(f); scripts.add(f);
  }
}
const ontbreekt = [...nodig].filter((f) => !fs.existsSync(rel(f)));
if (ontbreekt.length) fouten.push('manifest/pagina verwijst naar ontbrekende bestanden: ' + ontbreekt.join(', '));

// ── 2. Syntax van alles wat de browser laadt ───────────────────────────────
const isModule = (f) => manifest.background?.type === 'module' && f === manifest.background.service_worker;
for (const f of scripts) {
  if (!fs.existsSync(rel(f))) continue;
  const code = fs.readFileSync(rel(f), 'utf8');
  try {
    if (isModule(f)) new vm.SourceTextModule(code);
    else new vm.Script(code, { filename: f });
  } catch (e) {
    if (e instanceof TypeError && /SourceTextModule/.test(String(e))) continue; // zonder --experimental-vm-modules
    fouten.push(`syntaxfout in ${f}: ${e.message}`);
  }
}

// ── 3. Beheerscherm ────────────────────────────────────────────────────────
const BEHEER = 'tools/beheer/beheer.html';
if (fs.existsSync(rel(BEHEER))) {
  const html = fs.readFileSync(rel(BEHEER), 'utf8');
  let n = 0;
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    n++;
    try { new vm.Script(m[1], { filename: `${BEHEER} (inline #${n})` }); }
    catch (e) { fouten.push(`syntaxfout in ${BEHEER} inline-script #${n}: ${e.message}`); }
  }
}

// ── 4. JSON ────────────────────────────────────────────────────────────────
for (const f of ['config.json', 'managed_schema.json']) {
  try { JSON.parse(fs.readFileSync(rel(f), 'utf8')); } catch (e) { fouten.push(`${f}: ${e.message}`); }
}

if (fouten.length) {
  console.error('Controle mislukt:\n  - ' + fouten.join('\n  - '));
  process.exit(1);
}
console.log(`Controle OK: manifest v${manifest.version}, ${scripts.size} scripts, ${nodig.size} verwijzingen.`);
