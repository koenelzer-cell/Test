// Schermafbeeldingen van het zijpaneel voor de gebruikershandleiding
// (docs/gebruikers/afbeeldingen/). Draait het zijpaneel in Chromium met de
// nep-antwoorden van de e2e-tests (e2e/nep-chrome.js): geen echte ONS en geen
// echte cliëntgegevens. Bouw eerst (npm run build).
//
//   node scripts/docs-schermen.mjs
//   PW_CHROMIUM=/opt/pw-browsers/chromium node scripts/docs-schermen.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UIT = path.join(ROOT, 'docs/gebruikers/afbeeldingen');
const BREED = 380;
const lees = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const HTML = lees('pages/sidepanel.html').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');

fs.mkdirSync(UIT, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

// Een vers zijpaneel; rondleidingen staan als gezien (anders opent die van
// het startscherm vanzelf), behalve als het voorbeeld er een laat zien.
async function paneel(hoogte) {
  const page = await browser.newPage({ viewport: { width: BREED, height: hoogte || 900 }, deviceScaleFactor: 2 });
  await page.route('https://agendahulp.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
  await page.goto('https://agendahulp.test/sidepanel.html');
  await page.addScriptTag({ content: "(function(){var g=Storage.prototype.getItem;Storage.prototype.getItem=function(k){return String(k).indexOf('onsHelper.rondleiding.')===0?'e2e':g.call(this,k);};})();" });
  await page.addScriptTag({ content: 'window.NEP_MANIFEST = ' + lees('manifest.json') + ';' });
  await page.addScriptTag({ path: path.join(ROOT, 'e2e/nep-chrome.js') });
  await page.addScriptTag({ path: path.join(ROOT, 'dist/sidepanel.js') });
  await page.locator('[data-hulpmiddelen]').waitFor();
  await page.waitForTimeout(300);
  return page;
}
async function foto(page, naam, opts) {
  const o = opts || {};
  const y = o.vanaf ? Math.max(0, (await page.locator(o.vanaf).first().boundingBox()).y - (o.marge == null ? 10 : o.marge)) : 0;
  await page.screenshot({ path: path.join(UIT, naam + '.png'), clip: { x: 0, y: y, width: BREED, height: o.hoog || 640 } });
  console.log('  ' + naam + '.png');
}
async function naarPlan(page) {
  await page.locator('[data-hulp="plan"]').click();
  await page.locator('[data-dag][data-start]').first().waitFor();
  await page.waitForTimeout(300);
}

// 1. Startscherm.
let p = await paneel();
await foto(p, 'startscherm', { hoog: 620 });
await p.close();

// 2. Planhulp: de lijst, een eigen duur, gekozen momenten.
p = await paneel();
await naarPlan(p);
await foto(p, 'planhulp-lijst', { hoog: 720 });
await p.locator('[data-plan-duur-eigen]').click();
await p.waitForTimeout(400);
await foto(p, 'planhulp-eigen-duur', { hoog: 330 });
await p.locator('[data-plan-duur="60"]').click();
await p.waitForTimeout(400);
const tijden = p.locator('[data-dag][data-start]');
const eerste = await tijden.first().getAttribute('data-dag');
await tijden.nth(2).click();
await p.locator('[data-dag]:not([data-dag="' + eerste + '"])[data-start]').first().click();
await p.locator('[data-teller]').click();
await p.waitForTimeout(300);
await p.screenshot({ path: path.join(UIT, 'planhulp-momenten.png'), clip: { x: 0, y: 900 - 230, width: BREED, height: 230 } });
console.log('  planhulp-momenten.png');
await p.close();

// 3. Weekplanning: week met vrije tijd, slepen, Detail.
p = await paneel();
await naarPlan(p);
await p.locator('[data-plan-weergave="raster"]').click();
await p.locator('[data-week-verder]').click();
await p.locator('[data-raster-strook]').first().waitFor({ state: 'attached' });
await p.waitForTimeout(500);
await foto(p, 'weekplanning', { vanaf: '[data-plan-weergave]', hoog: 760 });
const strook = p.locator('[data-raster-strook]').first();
const b = await strook.boundingBox();
await p.mouse.move(b.x + b.width / 2, b.y + 3);
await p.mouse.down();
await p.mouse.move(b.x + b.width / 2, b.y + 50, { steps: 4 });
await p.mouse.move(b.x + b.width / 2, b.y + 85, { steps: 4 });
await foto(p, 'weekplanning-slepen', { vanaf: '[data-week-titel]', marge: 30, hoog: 420 });
await p.mouse.up();
await p.locator('[data-plan-detail]').click();
await p.waitForTimeout(800);
await foto(p, 'weekplanning-detail', { vanaf: '[data-week-titel]', marge: 30, hoog: 560 });
await p.close();

// 4. Afspraak maken.
p = await paneel(1100);
await naarPlan(p);
const t2 = p.locator('[data-dag][data-start]');
const d1 = await t2.first().getAttribute('data-dag');
await t2.first().click();
await p.locator('[data-dag]:not([data-dag="' + d1 + '"])[data-start]').first().click();
await p.getByRole('button', { name: /Afspraak maken op 2 momenten/ }).click();
await p.locator('[data-maak-afspraak]').first().waitFor();
await p.locator('[data-maak-zoek]').first().fill('Tam');
await p.locator('[data-client-id="11142"]').first().waitFor();
await foto(p, 'maken-client-zoeken', { vanaf: '[data-maak-zoek]', marge: 60, hoog: 330 });
await p.locator('[data-client-id="11142"]').first().click();
await p.locator('[data-maak-uursoort="11142"]').click();
await p.waitForTimeout(300);
await foto(p, 'maken-uursoort', { vanaf: '[data-maak-uursoort="11142"]', marge: 70, hoog: 360 });
await p.locator('[data-keuze-lijst] [data-optie="5"]').click();
await p.waitForTimeout(300);
await foto(p, 'maken-alle', { hoog: 900 });
await p.locator('[data-maak-eind="1"]').click();
await p.locator('[data-maak-eind-typen="1"]').fill('1500');
await p.locator('[data-maak-eind-typen="1"]').press('Enter');
await p.waitForTimeout(300);
await foto(p, 'maken-kaarten', { vanaf: '[data-maak-afspraak="0"]', marge: 30, hoog: 420 });
await p.screenshot({ path: path.join(UIT, 'maken-balk.png'), clip: { x: 0, y: 1100 - 130, width: BREED, height: 130 } });
console.log('  maken-balk.png');
await p.close();

// 5. De andere schermen.
for (const [hulp, naam, hoog] of [['open', 'open-registraties', 760], ['snel', 'snel-registreren', 330], ['route', 'route', 560], ['verhouding', 'verhouding', 500]]) {
  p = await paneel();
  await p.locator('[data-hulp="' + hulp + '"]').click();
  await p.waitForTimeout(900);
  await foto(p, naam, { hoog: hoog });
  await p.close();
}

// 6. Info en de kop met vraagteken en i-tje.
p = await paneel();
await foto(p, 'kop', { hoog: 70 });
await p.locator('[aria-label="Legenda en versie"]').click();
await p.waitForTimeout(400);
await foto(p, 'info', { hoog: 340 });
await p.close();

// 7. Een rondleiding.
p = await paneel();
await p.locator('[data-rondleiding-knop="hoofd"]').click();
await p.locator('[data-rondleiding-volgende]').click();
await p.waitForTimeout(600);
await foto(p, 'rondleiding', { hoog: 520 });
await p.close();

await browser.close();
console.log('Klaar: ' + path.relative(ROOT, UIT));
