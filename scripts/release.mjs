#!/usr/bin/env node
// Maakt een uitrolbare versie: bouwen, controleren en testen, dan pas het
// versienummer ophogen en inpakken. Het stopt zodra er iets misgaat, en dan is
// er niets veranderd.
//
// Waarom dit een script is: met de hand zijn het zes stappen waarvan er vijf
// stil misgaan als je er één vergeet. Je zipt dan een oude bundel, of je rolt
// uit met hetzelfde versienummer, en dan updaten werkplekken niet, zonder dat
// iemand ziet waarom.
//
//   npm run release            versie x.y.Z+1
//   npm run release -- --minor versie x.Y+1.0
//   npm run release -- --major versie X+1.0.0
//   npm run release -- --dry   bouwen, controleren, testen en nakijken; niets ophogen of inpakken
//   npm run release -- --bron  de bron-ZIP van de huidige commit (na het committen)
//
// Alles komt in release/ (buiten versiebeheer); bestaande ZIP's blijven staan.
//   ONSAgendahulp-x.y.z.zip         de extensie
//   ONSAgendahulp-x.y.z-test.zip    dezelfde extensie, die ook op de testomgeving
//                                   van ONS draait (TESTOMGEVING hieronder) en in de
//                                   browser 'ONS Agendahulp (test)' heet
//   ONSAgendahulp-x.y.z-beheer.zip  het beheerscherm (tools/beheer/), voor de beheerder
//   ONSAgendahulp-x.y.z-bron.zip    de broncode van die versie (--bron)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UIT = path.join(ROOT, 'release');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const soort = args.includes('--major') ? 'major' : args.includes('--minor') ? 'minor' : 'patch';

const rood = (t) => `\x1b[31m${t}\x1b[0m`;
const groen = (t) => `\x1b[32m${t}\x1b[0m`;
const grijs = (t) => `\x1b[90m${t}\x1b[0m`;
let stap = 0;
const kop = (t) => console.log(`\n${grijs(`[${++stap}]`)} ${t}`);

function run(cmd, argv, cwd = ROOT) {
  execFileSync(cmd, argv, { cwd, stdio: 'inherit' });
}

// De bestanden die de extensie uitmaken. Alles wat hier niet in staat, gaat
// niet mee: geen node_modules, geen tests, geen bron, geen beheerscherm.
const INHOUD = ['manifest.json', 'managed_schema.json', 'config.json', 'dist', 'pages', 'icons', 'assets'];
const BEHEER = 'tools/beheer';
const TESTOMGEVING = 'https://impegno-staging-staging.ons-dossier.nl/*';
// Wat nooit in een pakket mag: het hoort bij ontwikkelen en testen.
const VERBODEN = [
  [/sourceMappingURL=/, 'een verwijzing naar een sourcemap'],
  [/__onsHelperTestApi|__ONS_EXPOSE_FOR_TEST/, 'een testhaak'],
];

const manifestPad = path.join(ROOT, 'manifest.json');
const beheerPad = path.join(ROOT, BEHEER, 'beheer.html');

function volgendeVersie(huidig) {
  const d = String(huidig).split('.').map((n) => parseInt(n, 10) || 0);
  while (d.length < 3) d.push(0);
  if (soort === 'major') return `${d[0] + 1}.0.0`;
  if (soort === 'minor') return `${d[0]}.${d[1] + 1}.0`;
  return `${d[0]}.${d[1]}.${d[2] + 1}`;
}

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

function bestandenIn(map) {
  const uit = [];
  (function loop(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) loop(p); else uit.push(path.relative(map, p).split(path.sep).join('/'));
    }
  })(map);
  return uit;
}

// Een pakket samenstellen in een lege map, met het gegeven manifest. Wat
// npm run dev achterlaat (sourcemaps) gaat niet mee.
function stelSamen(manifest) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'agendahulp-'));
  INHOUD.forEach((f) => fs.cpSync(path.join(ROOT, f), path.join(map, f), { recursive: true }));
  fs.writeFileSync(path.join(map, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  bestandenIn(map).filter((f) => f.endsWith('.map') || f.endsWith('.DS_Store'))
    .forEach((f) => fs.rmSync(path.join(map, f)));
  return map;
}

// Klopt de inhoud? Alles waar het manifest of een pagina naar verwijst is er,
// in dist/ staat niets waar niemand naar verwijst, en geen bestand bevat iets
// uit VERBODEN.
function controleerPakket(map, manifest) {
  const nodig = new Set([
    manifest.background.service_worker, manifest.action.default_popup,
    manifest.side_panel.default_path, manifest.storage.managed_schema,
    ...Object.values(manifest.icons),
    ...manifest.content_scripts.flatMap((c) => c.js),
    ...manifest.web_accessible_resources.flatMap((w) => w.resources),
  ]);
  for (const pagina of [manifest.action.default_popup, manifest.side_panel.default_path]) {
    const html = fs.readFileSync(path.join(map, pagina), 'utf8');
    for (const m of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
      nodig.add(path.posix.normalize(path.posix.join(path.posix.dirname(pagina), m[1])));
    }
  }
  const aanwezig = bestandenIn(map);
  const fouten = [...nodig].filter((f) => !aanwezig.includes(f)).map((f) => `${f} ontbreekt`);
  for (const f of aanwezig) {
    if (f.startsWith('dist/') && !nodig.has(f)) fouten.push(`${f} wordt nergens geladen`);
    if (!/\.(js|html|json)$/.test(f)) continue;
    const tekst = fs.readFileSync(path.join(map, f), 'utf8');
    for (const [re, wat] of VERBODEN) if (re.test(tekst)) fouten.push(`${f} bevat ${wat}`);
  }
  if (fouten.length) throw new Error('Het pakket klopt niet:\n  - ' + fouten.join('\n  - '));
  const kb = Math.round(aanwezig.reduce((n, f) => n + fs.statSync(path.join(map, f)).size, 0) / 1024);
  console.log(`  ${aanwezig.length} bestanden, ${kb} kB uitgepakt; alles aanwezig, niets te veel`);
}

function zip(naam, map) {
  const doel = path.join(UIT, naam);
  fs.rmSync(doel, { force: true });
  run('zip', ['-qr', doel, '.', '-x', '*.DS_Store'], map);
  console.log(`  ${path.relative(ROOT, doel)}  ${Math.round(fs.statSync(doel).size / 1024)} kB`);
}

function bronZip() {
  const versie = JSON.parse(fs.readFileSync(manifestPad, 'utf8')).version;
  if (execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim()) {
    throw new Error('Er staan nog wijzigingen open. Commit eerst: de bron-ZIP is de huidige commit.');
  }
  fs.mkdirSync(UIT, { recursive: true });
  const doel = path.join(UIT, `ONSAgendahulp-${versie}-bron.zip`);
  run('git', ['archive', '--format=zip', '-o', doel, 'HEAD']);
  console.log(`${groen('Klaar.')} ${path.relative(ROOT, doel)}`);
}

function release() {
  const manifestTekst = fs.readFileSync(manifestPad, 'utf8');
  const huidig = JSON.parse(manifestTekst).version;
  const nieuw = volgendeVersie(huidig);
  console.log(`Versie ${huidig} → ${groen(nieuw)}${dry ? grijs('  (proefdraai)') : ''}`);

  // De bundels lezen de versie uit het manifest, dus wat hier getest wordt,
  // is precies wat er straks in het pakket gaat.
  kop('Bouwen');
  run('npm', ['run', 'build']);
  kop('Syntax, manifest, importen en lint controleren');
  run('npm', ['run', 'check']);
  run('npm', ['run', 'lint', '--', '--quiet']);
  kop('Tests');
  run('node', ['--test', '--test-force-exit', ...fs.readdirSync(path.join(ROOT, 'test'))
    .filter((f) => f.endsWith('.test.js')).map((f) => `test/${f}`)]);

  const manifest = { ...JSON.parse(manifestTekst), version: nieuw };
  const pakketten = [
    [`ONSAgendahulp-${nieuw}.zip`, manifest],
    [`ONSAgendahulp-${nieuw}-test.zip`, testManifest(manifest)],
  ];
  const mappen = [];
  try {
    for (const [naam, m] of pakketten) {
      kop(`${naam} samenstellen en nakijken`);
      mappen.push(stelSamen(m));
      controleerPakket(mappen.at(-1), m);
    }
    if (JSON.stringify(manifest).includes(TESTOMGEVING)) throw new Error('De testomgeving hoort alleen in het testpakket.');

    if (dry) {
      console.log(`\n${groen('Proefdraai klaar.')} Niets opgehoogd of ingepakt.`);
      return;
    }

    kop(`Versie ${nieuw} vastleggen en inpakken`);
    const beheerTekst = fs.readFileSync(beheerPad, 'utf8');
    try {
      fs.writeFileSync(manifestPad, manifestTekst.replace(`"version": "${huidig}"`, `"version": "${nieuw}"`));
      // Het beheerscherm noemt de versie waar het bij hoort.
      fs.writeFileSync(beheerPad, beheerTekst.replace(/const MANAGER_VERSION = '[^']*';/, `const MANAGER_VERSION = '${nieuw}';`));
      fs.mkdirSync(UIT, { recursive: true });
      pakketten.forEach(([naam], i) => zip(naam, mappen[i]));
      zip(`ONSAgendahulp-${nieuw}-beheer.zip`, path.join(ROOT, BEHEER));
    } catch (e) {
      fs.writeFileSync(manifestPad, manifestTekst);
      fs.writeFileSync(beheerPad, beheerTekst);
      throw e;
    }
  } finally {
    mappen.forEach((map) => fs.rmSync(map, { recursive: true, force: true }));
  }

  console.log(`\n${groen('Klaar.')} Versie ${nieuw} is gebouwd, getest en ingepakt.`);
  console.log(grijs('Nu: CHANGELOG.md bijwerken, committen, en npm run release -- --bron.'));
}

try {
  if (args.includes('--bron')) bronZip(); else release();
} catch (e) {
  console.error(`\n${rood('Afgebroken:')} ${e.message || e}`);
  console.error(grijs('Er is niets opgehoogd of ingepakt. Los het bovenstaande op en draai opnieuw.'));
  process.exit(1);
}
