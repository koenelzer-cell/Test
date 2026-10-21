#!/usr/bin/env node
// Maakt een uitrolbare versie: versienummer ophogen, bouwen, controleren,
// testen en inpakken — in die volgorde, en het stopt zodra er iets misgaat.
//
// Waarom dit een script is: met de hand zijn het zes stappen waarvan er vijf
// stil misgaan als je er één vergeet. Je zipt dan een oude bundel, of je rolt
// uit met hetzelfde versienummer — en dan updaten werkplekken niet, zonder dat
// iemand ziet waarom.
//
//   npm run release            versie x.y.Z+1
//   npm run release -- --minor versie x.Y+1.0
//   npm run release -- --major versie X+1.0.0
//   npm run release -- --dry   niets wijzigen, alleen tonen wat er zou gebeuren
//
// Er komen drie ZIP's uit:
//   ONSAgendahulp-x.y.z.zip         de extensie
//   ONSAgendahulp-x.y.z-test.zip    dezelfde extensie, die ook op de testomgeving
//                                   van ONS draait (TESTOMGEVING hieronder) en in de
//                                   browser 'ONS Agendahulp (test)' heet
//   ONSAgendahulp-x.y.z-beheer.zip  het beheerscherm (tools/beheer/), voor de beheerder

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const soort = args.includes('--major') ? 'major' : args.includes('--minor') ? 'minor' : 'patch';

const rood = (t) => `\x1b[31m${t}\x1b[0m`;
const groen = (t) => `\x1b[32m${t}\x1b[0m`;
const grijs = (t) => `\x1b[90m${t}\x1b[0m`;
let stap = 0;
const kop = (t) => console.log(`\n${grijs(`[${++stap}]`)} ${t}`);

function run(cmd, argv) {
  execFileSync(cmd, argv, { cwd: ROOT, stdio: 'inherit' });
}

// De bestanden die de extensie uitmaken. Alles wat hier niet in staat, gaat
// niet mee — dus geen node_modules, geen tests, geen bronbestanden.
const INHOUD = [
  'manifest.json', 'managed_schema.json', 'config.json',
  'dist', 'pages', 'icons', 'assets',
];
const BEHEER = 'tools/beheer';

const TESTOMGEVING = 'https://impegno-staging-staging.ons-dossier.nl/*';

// Het manifest van het testpakket: de testomgeving erbij, overal waar het
// productie-dossier staat.
function testManifest(manifest) {
  const m = structuredClone(manifest);
  const metTest = (lijst) => (lijst.includes('https://impegno.ons-dossier.nl/*') ? [...lijst, TESTOMGEVING] : lijst);
  m.name += ' (test)';
  m.host_permissions = metTest(m.host_permissions);
  m.content_scripts.forEach((c) => { c.matches = metTest(c.matches); });
  m.web_accessible_resources.forEach((w) => { w.matches = metTest(w.matches); });
  return m;
}

function volgendeVersie(huidig) {
  const d = String(huidig).split('.').map((n) => parseInt(n, 10) || 0);
  while (d.length < 3) d.push(0);
  if (soort === 'major') return `${d[0] + 1}.0.0`;
  if (soort === 'minor') return `${d[0]}.${d[1] + 1}.0`;
  return `${d[0]}.${d[1]}.${d[2] + 1}`;
}

try {
  // ── Versie ────────────────────────────────────────────────────────────────
  const manifestPad = path.join(ROOT, 'manifest.json');
  const manifestTekst = fs.readFileSync(manifestPad, 'utf8');
  const huidig = JSON.parse(manifestTekst).version;
  const nieuw = volgendeVersie(huidig);
  kop(`Versie ${huidig} → ${groen(nieuw)}${dry ? grijs('  (proefdraai)') : ''}`);

  if (!dry) {
    fs.writeFileSync(manifestPad, manifestTekst.replace(`"version": "${huidig}"`, `"version": "${nieuw}"`));
    // src/shared/version.js heeft een terugvalversie voor als getManifest() faalt; die moet
    // meelopen, anders rapporteert de hulp straks een verkeerd nummer.
    const contentPad = path.join(ROOT, 'src', 'shared', 'version.js');
    const content = fs.readFileSync(contentPad, 'utf8');
    if (!content.includes(`return '${huidig}'`)) {
      console.log(rood('  Let op: de terugvalversie in src/shared/version.js stond niet op ' + huidig + ' en is niet aangepast.'));
    } else {
      fs.writeFileSync(contentPad, content.replace(`return '${huidig}'`, `return '${nieuw}'`));
    }
    // Het beheerscherm noemt de versie waar het bij hoort.
    const beheerPad = path.join(ROOT, BEHEER, 'beheer.html');
    const beheer = fs.readFileSync(beheerPad, 'utf8').replace(/const MANAGER_VERSION = '[^']*';/, `const MANAGER_VERSION = '${nieuw}';`);
    fs.writeFileSync(beheerPad, beheer);
  }

  // ── Bouwen, controleren, testen ───────────────────────────────────────────
  kop('Bouwen');
  run('npm', ['run', 'build']);

  kop('Syntax en manifest controleren');
  run('npm', ['run', 'check']);

  kop('Tests');
  run('node', ['--test', '--test-force-exit', ...fs.readdirSync(path.join(ROOT, 'test'))
    .filter((f) => f.endsWith('.test.js')).map((f) => `test/${f}`)]);

  // ── Compleetheid ──────────────────────────────────────────────────────────
  kop('Controleren of alles aanwezig is');
  const manifest = JSON.parse(fs.readFileSync(manifestPad, 'utf8'));
  const nodig = new Set();
  (manifest.content_scripts || []).forEach((c) => (c.js || []).forEach((f) => nodig.add(f)));
  if (manifest.background?.service_worker) nodig.add(manifest.background.service_worker);
  if (manifest.action?.default_popup) nodig.add(manifest.action.default_popup);
  if (manifest.storage?.managed_schema) nodig.add(manifest.storage.managed_schema);
  Object.values(manifest.icons || {}).forEach((f) => nodig.add(f));
  (manifest.web_accessible_resources || []).forEach((w) => (w.resources || []).forEach((f) => nodig.add(f)));
  const ontbreekt = [...nodig].filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (ontbreekt.length) throw new Error('Het manifest verwijst naar bestanden die er niet zijn: ' + ontbreekt.join(', '));
  console.log(`  ${nodig.size} bestanden uit het manifest aanwezig`);

  // De bundel moet nieuwer zijn dan de bron, anders zip je een oude versie.
  const bundel = Math.min(...['dist/react-bundle.js', 'dist/content.js']
    .map((f) => fs.statSync(path.join(ROOT, f)).mtimeMs));
  const bronnen = [];
  const loop = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) loop(p); else bronnen.push(fs.statSync(p).mtimeMs);
  });
  loop(path.join(ROOT, 'src'));
  if (Math.max(...bronnen) > bundel) throw new Error('dist/ is ouder dan src/ — de bundels zijn niet opnieuw gebouwd.');
  console.log('  bundel is actueel');

  // ── Inpakken ──────────────────────────────────────────────────────────────
  const zip = `ONSAgendahulp-${nieuw}.zip`;
  const testZip = `ONSAgendahulp-${nieuw}-test.zip`;
  const beheerZip = `ONSAgendahulp-${nieuw}-beheer.zip`;
  kop(`Inpakken als ${zip}, ${testZip} en ${beheerZip}`);
  if (!dry) {
    fs.readdirSync(ROOT).filter((f) => /^ONSAgendahulp-.*\.zip$/.test(f))
      .forEach((f) => fs.unlinkSync(path.join(ROOT, f)));
    run('zip', ['-qr', zip, ...INHOUD, '-x', '*.DS_Store']);
    // Het testpakket: dezelfde bestanden, een ander manifest.
    const map = fs.mkdtempSync(path.join(os.tmpdir(), 'agendahulp-test-'));
    INHOUD.forEach((f) => fs.cpSync(path.join(ROOT, f), path.join(map, f), { recursive: true }));
    fs.writeFileSync(path.join(map, 'manifest.json'), JSON.stringify(testManifest(manifest), null, 2) + '\n');
    execFileSync('zip', ['-qr', path.join(ROOT, testZip), ...INHOUD, '-x', '*.DS_Store'], { cwd: map, stdio: 'inherit' });
    fs.rmSync(map, { recursive: true, force: true });
    execFileSync('zip', ['-qr', path.join(ROOT, beheerZip), '.', '-x', '*.DS_Store'], { cwd: path.join(ROOT, BEHEER), stdio: 'inherit' });
    for (const z of [zip, testZip, beheerZip]) console.log(`  ${z} — ${Math.round(fs.statSync(path.join(ROOT, z)).size / 1024)} kB`);
  } else {
    console.log(grijs('  (proefdraai: niet ingepakt)'));
  }

  console.log(`\n${groen('Klaar.')} Versie ${nieuw} is gebouwd, getest en ingepakt.`);
  if (!dry) console.log(grijs('Vergeet niet te committen; de gewijzigde bestanden staan nog open.'));
} catch (e) {
  console.error(`\n${rood('Afgebroken:')} ${e.message || e}`);
  console.error(grijs('Er is niets ingepakt. Los het bovenstaande op en draai opnieuw.'));
  process.exit(1);
}
