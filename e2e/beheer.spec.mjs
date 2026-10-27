// Het beheerscherm (tools/beheer/beheer.html) in een echte browser. Elke pagina
// op een smal en een breed scherm: geen horizontale scroll en geen '·' of
// streepjes in de tekst. Daarnaast de belangrijkste handelingen: bewerken in
// het paneel naast de tabel, annuleren, opslaan, volgorde wijzigen, teams,
// functies, publiceren in vier stappen en de oude paginanamen.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const BEHEER = pathToFileURL(path.join(ROOT, 'tools/beheer/beheer.html')).href;
const CONFIG = fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8');

async function open(page, breedte) {
  await page.setViewportSize({ width: breedte || 1280, height: 900 });
  const fouten = [];
  page.on('pageerror', (e) => fouten.push(String(e)));
  page.on('dialog', (d) => d.accept());
  await page.goto(BEHEER);
  await page.evaluate((t) => applyImported(JSON.parse(t)), CONFIG);
  return fouten;
}
const pagina = (page) => page.evaluate(() => huidigePagina());
const kop = (page) => page.locator('#dirty');

for (const breedte of [420, 1280]) {
  test(`beheer: elke pagina past op ${breedte} px en heeft geen streepjes`, async ({ page }, info) => {
    const fouten = await open(page, breedte);
    const ids = await page.$$eval('[data-settings-page]', (els) => els.map((e) => e.id));
    expect(ids.length).toBeGreaterThan(15);
    for (const id of ids) {
      await page.evaluate((x) => showSettingsPage(x), id);
      const probleem = await page.evaluate(() => {
        const uit = [], doc = document.documentElement;
        if (doc.scrollWidth > doc.clientWidth + 1) uit.push('pagina scrolt horizontaal (' + doc.scrollWidth + ' > ' + doc.clientWidth + ')');
        const tekst = document.querySelector('.kopbalk').innerText + '\n' + document.querySelector('.menu').innerText + '\n' + document.querySelector('[data-settings-page]:not([hidden])').innerText;
        const m = tekst.match(/.{0,30}[·–—].{0,30}/);
        if (m) uit.push('teken in de tekst: ' + m[0]);
        return uit;
      });
      expect(probleem, id).toEqual([]);
      await info.attach(`${breedte}-${id}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    }
    expect(fouten).toEqual([]);
  });
}

test('beheer: config.json komt ongewijzigd terug na inlezen', async ({ page }) => {
  await open(page);
  const rond = await page.evaluate(() => { const a = JSON.stringify(buildConfigFromDOM()); applyImported(JSON.parse(a)); return [a, JSON.stringify(buildConfigFromDOM())]; });
  expect(rond[1]).toBe(rond[0]);
  const cfg = JSON.parse(rond[0]), bron = JSON.parse(CONFIG);
  expect(cfg.choices.map((c) => c.label)).toEqual(bron.choices.map((c) => c.label));
  expect(cfg.registrationForms.map((f) => f.startVerdeling)).toEqual(bron.registrationForms.map((f) => f.startVerdeling));
  expect(Object.keys(cfg.zoneProfiles)).toEqual(Object.keys(bron.zoneProfiles));
  expect(cfg.features).toEqual(bron.features);
});

test('beheer: bewerken in het paneel, annuleren en opslaan', async ({ page }) => {
  await open(page);
  await page.evaluate(() => showSettingsPage('afspraaktypes'));
  await page.click('#tblChoices tbody tr:nth-child(3) .rij-naam');
  await expect(page.locator('#choiceDetail h2')).toHaveText('Huisbezoek');
  await page.fill('#choiceDetail input[type=text]', 'Huisbezoek thuis');
  await expect(page.locator('#tblChoices tbody tr:nth-child(3)')).toContainText('Huisbezoek thuis');
  await expect(kop(page)).toContainText('nog niet opgeslagen');
  // Weg van een pagina met wijzigingen kan niet.
  await page.click('[data-menu-target=functies]');
  expect(await pagina(page)).toBe('afspraaktypes');
  await page.click('#btnCancelPage');
  expect(await page.evaluate(() => readChoices().map((c) => c.label))).toContain('Huisbezoek');
  await expect(page.locator('#choiceDetail h2')).toHaveText('Huisbezoek');
  // Reistijd uit en opslaan.
  await page.locator('#choiceDetail .schakelrij input').nth(2).click();
  await page.click('#btnSave');
  const opgeslagen = await page.evaluate(() => JSON.parse(localStorage.getItem('onsBeheerConfig')).choices.find((c) => c.label === 'Huisbezoek'));
  expect(opgeslagen.addTravelTime).toBe(false);
  await expect(kop(page)).toContainText('Alles opgeslagen');
});

test('beheer: volgorde met de greep (toetsenbord en slepen)', async ({ page }) => {
  await open(page);
  await page.evaluate(() => showSettingsPage('afspraaktypes'));
  await page.focus('#tblChoices tbody tr:nth-child(2) .greep');
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => readChoices().map((c) => c.volgorde))).toEqual([1, 2, 3, 4, 5, 6]);
  expect((await page.evaluate(() => readChoices()))[0].label).toBe('Digitaal');
  const g = await page.locator('#tblChoices tbody tr:nth-child(6) .greep').boundingBox();
  const d = await page.locator('#tblChoices tbody tr:nth-child(1)').boundingBox();
  await page.mouse.move(g.x + 10, g.y + 10); await page.mouse.down();
  await page.mouse.move(d.x + 50, d.y + 5, { steps: 8 }); await page.mouse.up();
  expect((await page.evaluate(() => readChoices()))[0].label).toBe('MDO');
});

test('beheer: teams, dagbalk en dagindeling overnemen', async ({ page }) => {
  await open(page);
  await page.evaluate(() => showSettingsPage('teams'));
  await page.click('#teamLijst [data-team="J&O/JBG"]');
  const team = page.locator('#zones > div:not([hidden])');
  await expect(team.locator('h2')).toHaveText('J&O/JBG');
  await expect(team.locator('.regel')).toContainText('Sluit aan van 08:00 tot 17:00');
  await team.locator('tbody tr:nth-child(2) input').nth(1).fill('11:30');
  await expect(team.locator('.regel')).toContainText('Gat van 11:30 tot 12:00');
  await page.click('#btnCancelPage');
  await team.locator('select[aria-label^="Dagindeling overnemen"]').selectOption('JGGZ');
  expect(await page.evaluate(() => readZonesAndSectors().zoneProfiles['J&O/JBG'].length)).toBe(8);
  await page.click('#btnCancelPage');
  await page.click('[aria-label="Team toevoegen aan Begeleiding"]');
  await page.fill('#organizationDialogInput', 'Ambulant');
  await page.click('#organizationDialog button[type=submit]');
  expect(await page.evaluate(() => readZonesAndSectors().profileSectors.Ambulant)).toBe('Begeleiding');
  await expect(team.locator('h2')).toHaveText('Ambulant');
});

test('beheer: functies en de noodschakelaar', async ({ page }) => {
  await open(page);
  await page.evaluate(() => showSettingsPage('functies'));
  await page.click('[data-feature=planner]');
  expect(await page.locator('[data-feature=plannerCopies]').isDisabled()).toBe(true);
  expect(await page.evaluate(() => readFeatures().plannerCopies)).toBe(true);
  await page.click('[data-feature=formViaModel]');
  await expect(page.locator('[data-nood-uit]')).toBeVisible();
  await page.click('#btnSave');
  await page.click('[data-menu-target=overzicht]');
  await expect(page.locator('#ovNood')).toContainText('noodschakelaar staat uit');
});

test('beheer: publiceren in vier stappen, daarna telt een wijziging mee', async ({ page }) => {
  await open(page);
  await page.click('#btnPubliceren');
  await expect(page.locator('[data-stap-inhoud="1"]')).toBeVisible();
  await page.click('#pubVerder1');
  await expect(page.locator('#pubSam2')).toContainText('Eerste publicatie');
  await page.click('[data-stap-inhoud="2"] .knop.primair');
  await page.fill('#publishNote', 'Eerste versie');
  await page.click('[data-stap-inhoud="3"] .knop.primair');
  const bestanden = [];
  page.on('download', (d) => bestanden.push(d.suggestedFilename()));
  const tweede = page.waitForEvent('download', { predicate: (d) => d.suggestedFilename() === 'helperConfig-beleid.json' });
  await page.click('[data-stap-inhoud="4"] .knop.primair');
  await tweede;
  expect(bestanden).toEqual(['config.json', 'helperConfig-beleid.json']);
  await expect(page.locator('#pubKlaar')).toBeVisible();
  await expect(kop(page)).toContainText('gepubliceerd');
  await page.click('#pubKlaar >> text=Naar Overzicht');
  await expect(page.locator('#ovStatus')).toContainText('Eerste versie');
  await page.click('[data-menu-target=functies]');
  await page.click('[data-feature=routeLink]');
  await page.click('#btnSave');
  await expect(kop(page)).toContainText('1 wijziging nog niet gepubliceerd');
  await expect(page.locator('#menuPubliceren')).toHaveText('1');
  await page.click('[data-menu-target=overzicht]');
  await expect(page.locator('#ovSinds')).toContainText('Route van de dag staat uit');
  await page.click('#btnPubliceren');
  await page.click('#pubVerder1');
  await expect(page.locator('#publishDiff')).toContainText('Was aan, wordt uit');
});

test('beheer: oude paginanamen gaan naar de nieuwe plek', async ({ page }) => {
  await open(page);
  const paren = [['configcontrole', 'controle'], ['testmatrix', 'controle'], ['algemeen', 'duurtijden'], ['zoneprofielen', 'teams'], ['sectorinstellingen', 'teams'], ['rawjson', 'geavanceerd'], ['compatibiliteit', 'publiceren'], ['troubleshooting', 'storingen']];
  for (const [oud, nieuw] of paren) {
    await page.evaluate((h) => { location.hash = h; }, oud);
    await expect.poll(() => pagina(page), { message: oud }).toBe(nieuw);
  }
  await page.evaluate(() => { location.hash = 'zelftest'; });
  await expect(page.locator('#domCheckArea')).toBeVisible();
});
