#!/usr/bin/env node
// Bouwt alles wat de browser laadt uit src/ naar dist/.
//
// Eén regel: de browser laadt NOOIT bestanden uit src/, alleen uit dist/ (plus
// manifest.json, config.json, de HTML-pagina's en de afbeeldingen).
//
// Waarom een bundelstap: content-scripts kunnen in Chrome/Edge geen ES-modules
// zijn. De bron is wel in modules opgedeeld (import/export); esbuild voegt ze
// per ingang samen tot één klassiek script (IIFE). De uitvoer is bewust NIET
// geminificeerd, zodat een fout in de console nog leesbaar is. Sourcemaps
// alleen bij --watch: ze wijzen in DevTools terug naar src/, maar horen niet in
// versiebeheer of in het pakket.
//
//   node scripts/build.mjs            alles bouwen
//   node scripts/build.mjs --watch    blijven meekijken (npm run dev)
//   node scripts/build.mjs --test     ook de testbundels (test/build/): het content-script
//                                     met testhaken en de React-componenten

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const watch = args.includes('--watch');
const withTests = args.includes('--test');

const common = {
  absWorkingDir: ROOT,
  bundle: true,
  format: 'iife',
  target: 'chrome116',   // = minimum_chrome_version in manifest.json
  logLevel: 'warning',
};

// Klassieke scripts (geen React). Niet geminificeerd.
const SCRIPT_ENTRIES = [
  // [bron, uitvoer]                                     waar het draait
  ['src/content/index.js', 'dist/content.js'],            // content-script, ONS-pagina's
  ['src/survey/index.js', 'dist/survey.js'],              // content-script, ONS Dossier (alle frames)
  ['src/main-world/index.js', 'dist/main-world.js'],      // content-script, pagina-context van ONS
  ['src/edge-tab/index.js', 'dist/edge-tab.js'],          // content-script, ONS-pagina's
  ['src/io-planning-block/index.js', 'dist/io-planning-block.js'], // content-script, ioservice.net
  ['src/background/index.js', 'dist/background.js'],      // service worker
  ['src/popup/index.js', 'dist/popup.js'],                // pages/popup.html
  ['src/sidepanel/index.js', 'dist/sidepanel.js'],        // pages/sidepanel.html
];

const builds = [
  ...SCRIPT_ENTRIES.map(([entry, outfile]) => ({
    ...common,
    entryPoints: [entry],
    outfile,
    sourcemap: watch ? 'linked' : false,
    charset: 'utf8',
  })),
  // De React-schermen (src/react/): geminificeerd, productiebuild van React.
  // Laadt als apart script vóór dist/content.js en dist/sidepanel.js en biedt
  // window.__onsahReact aan (zie src/content/ui/react-bridge.js).
  {
    ...common,
    entryPoints: ['src/react/index.jsx'],
    outfile: 'dist/react-bundle.js',
    minify: true,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  },
];

if (withTests) {
  // Het content-script met de interne functies voor de jsdom-tests
  // (test/helpers/content-api.js). Alleen hier; dist/content.js heeft ze niet.
  builds.push({
    ...common,
    entryPoints: ['test/helpers/content-api.js'],
    outfile: 'test/build/content.js',
    charset: 'utf8',
  });
  // Losse ESM-bundel van de componenten voor de jsdom-tests (React extern).
  builds.push({
    absWorkingDir: ROOT,
    entryPoints: ['src/react/components/WizardScreen.jsx'],
    outfile: 'test/build/components.mjs',
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    packages: 'external',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    logLevel: 'warning',
  });
}

if (watch) {
  for (const b of builds) (await esbuild.context(b)).watch();
  console.log('Bouwen klaar; kijkt mee naar wijzigingen in src/ …');
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
  console.log(`Gebouwd: ${builds.map((b) => b.outfile).join(', ')}`);
}
