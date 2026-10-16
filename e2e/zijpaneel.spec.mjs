// Het zijpaneel in een echte browser: elke pagina op een smal en een breed
// paneel. Per pagina: geen horizontale scroll, geen knoptekst die uit zijn
// knop loopt, geen '·' of streepjes in de tekst, en een schermafdruk in het
// rapport (playwright-report/) om na te kijken.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const lees = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
// De pagina zonder eigen scripttags: die voegen we zelf toe, met de nep-chrome ertussen.
const HTML = lees('pages/sidepanel.html').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');

async function openPaneel(page, breedte) {
  await page.setViewportSize({ width: breedte, height: 900 });
  await page.setContent(HTML);
  await page.addScriptTag({ path: path.join(ROOT, 'dist/react-bundle.js') });
  await page.addScriptTag({ path: path.join(ROOT, 'e2e/nep-chrome.js') });
  await page.addScriptTag({ path: path.join(ROOT, 'dist/sidepanel.js') });
  await expect(page.locator('[data-hulpmiddelen]')).toBeVisible();
}

// Wat op elke pagina moet kloppen. Geeft een lijst problemen (leeg = goed).
async function problemen(page) {
  return page.evaluate(() => {
    const uit = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth + 1) uit.push('pagina scrolt horizontaal (' + doc.scrollWidth + ' > ' + doc.clientWidth + ')');
    const zichtbaar = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const naam = (e) => e.tagName.toLowerCase() + ([...e.attributes].filter((a) => a.name.startsWith('data-')).map((a) => '[' + a.name + (a.value ? '=' + a.value : '') + ']').join('') || '') + ' "' + (e.textContent || '').trim().slice(0, 30) + '"';
    const rechts = doc.clientWidth;
    for (const e of document.querySelectorAll('#paneel *')) {
      if (!zichtbaar(e)) continue;
      const s = getComputedStyle(e);
      // Het paneel zelf scrolt niet zijwaarts maar knipt af: wat rechts buiten
      // beeld valt, ziet niemand.
      if (e.getBoundingClientRect().right > rechts + 1) uit.push('valt rechts buiten het paneel: ' + naam(e));
      // Een scrollvak dat zijwaarts scrolt (de week- en dagstroken mogen dat bewust niet).
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 1) uit.push('scrolt zijwaarts: ' + naam(e));
    }
    for (const b of document.querySelectorAll('#paneel button')) {
      if (!zichtbaar(b)) continue;
      const s = getComputedStyle(b);
      // Afgekapte tekst met ellips is bewust; tekst die buiten de knop valt niet.
      if (s.textOverflow === 'ellipsis' || s.overflow === 'hidden') continue;
      if (b.scrollWidth > b.clientWidth + 1) uit.push('knoptekst past niet: ' + naam(b));
    }
    // Datumvelden tonen de hele datum, niet 'vr 16 okt 20...'.
    for (const d of document.querySelectorAll('#paneel [data-datum] *')) {
      if (zichtbaar(d) && d.children.length === 0 && d.scrollWidth > d.clientWidth + 1) uit.push('datum past niet in het veld: ' + naam(d.closest('[data-datum]')));
    }
    const tekst = document.getElementById('paneel').innerText;
    const fout = tekst.match(/[·–—]/g);
    if (fout) uit.push('verboden teken(s) in de tekst: ' + [...new Set(fout)].join(' ') + ' in "' + tekst.slice(Math.max(0, tekst.search(/[·–—]/) - 30), tekst.search(/[·–—]/) + 30).replace(/\s+/g, ' ') + '"');
    return uit;
  });
}

async function controleer(page, testInfo, naam) {
  // Even wachten op laden en straksTekenen (setTimeout-render).
  await page.waitForTimeout(250);
  // Het paneel scrolt binnenin (body scrolt niet): voor de schermafdruk het
  // venster even zo hoog maken als de inhoud, zodat de hele pagina erop staat.
  const vp = page.viewportSize();
  const extra = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('#paneel *')]
    .filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowY))
    .map((e) => e.scrollHeight - e.clientHeight)));
  if (extra > 0) await page.setViewportSize({ width: vp.width, height: Math.min(vp.height + extra, 4000) });
  await testInfo.attach(naam, { body: await page.screenshot(), contentType: 'image/png' });
  if (extra > 0) await page.setViewportSize(vp);
  expect(await problemen(page), naam).toEqual([]);
}

async function terug(page) {
  await page.locator('[data-terug]').first().click();
  await expect(page.locator('[data-hulpmiddelen]')).toBeVisible();
}

for (const breedte of [340, 420]) {
  test.describe('zijpaneel ' + breedte + 'px', () => {
    test.beforeEach(async ({ page }) => { await openPaneel(page, breedte); });

    test('startscherm en hulpmiddelen', async ({ page }, testInfo) => {
      await controleer(page, testInfo, 'start');
      await expect(page.locator('[data-hulp="open"] [data-hulp-teller]')).toHaveText('3');
      for (const [soort, titel] of [['open', 'open'], ['snel', 'snel'], ['route', 'route'], ['verhouding', 'verhouding']]) {
        await page.locator('[data-hulp="' + soort + '"]').click();
        await expect(page.locator('[data-terug]').first()).toBeVisible();
        await controleer(page, testInfo, titel);
        await terug(page);
      }
      await page.locator('[aria-label="Legenda en versie"]').click();
      await controleer(page, testInfo, 'info');
    });

    test('planhulp: lijst, weekplanning en instellingen', async ({ page }, testInfo) => {
      await page.locator('[data-hulp="plan"]').click();
      await expect(page.locator('[data-dag][data-start]').first()).toBeVisible();
      // ONS kijkt na nadat de lijst er staat; de waarschuwing komt er later bij.
      await expect(page.locator('[data-ons-overlap][data-start="09:30"]')).toHaveCount(1);
      await controleer(page, testInfo, 'plan-lijst');
      await page.locator('[data-plan-meer]').click();
      await expect(page.locator('[data-plan-meer]')).toBeVisible();
      await controleer(page, testInfo, 'plan-meer-geladen');
      // Tot datum: de maandkalender klapt onder de instellingen open.
      await page.locator('[data-plan-tot]').click();
      await expect(page.locator('[data-plan-kalender]')).toBeVisible();
      await controleer(page, testInfo, 'plan-kalender');
      await page.locator('[data-plan-tot]').click();
      await expect(page.locator('[data-plan-kalender]')).toHaveCount(0);
      await page.locator('[data-plan-weergave="raster"]').click();
      await expect(page.locator('[data-raster]').first()).toBeVisible();
      await controleer(page, testInfo, 'plan-weekplanning');
    });

    test('afspraak maken: zelfde, per afspraak anders en niet cliëntgebonden', async ({ page }, testInfo) => {
      await page.locator('[data-hulp="plan"]').click();
      const tijden = page.locator('[data-dag][data-start]');
      await expect(tijden.first()).toBeVisible();
      // Twee momenten op verschillende dagen.
      const eerste = await tijden.first().getAttribute('data-dag');
      await tijden.first().click();
      await page.locator('[data-dag]:not([data-dag="' + eerste + '"])[data-start]').first().click();
      await page.getByRole('button', { name: /Afspraak maken op 2 momenten/ }).click();
      await expect(page.locator('[data-maak-afspraak]')).toHaveCount(2);
      await controleer(page, testInfo, 'maken-zelfde');

      // Een cliënt kiezen: daarna komen type, aanwezig en reistijd in beeld.
      const zoek = page.locator('[data-maak-zoek]').first();
      await zoek.fill('Tam');
      await page.locator('[data-client-id="11142"]').first().click();
      await controleer(page, testInfo, 'maken-zelfde-client');
      await page.locator('[data-maak-aanpassen="0"]').click();
      await controleer(page, testInfo, 'maken-zelfde-aanpassen');

      await page.locator('[data-maak-modus="los"]').click();
      await expect(page.locator('[data-maak-type="1"]')).toBeVisible();
      await controleer(page, testInfo, 'maken-per-afspraak');

      await page.locator('[data-maak-niet-client]').click();
      await controleer(page, testInfo, 'maken-niet-client');

      // Verwijderen vraagt eerst 'Weet je het zeker?'.
      page.once('dialog', (d) => { expect(d.message()).toBe('Weet je het zeker?'); d.accept(); });
      await page.locator('[data-maak-weg="1"]').click();
      await expect(page.locator('[data-maak-afspraak]')).toHaveCount(1);
      await controleer(page, testInfo, 'maken-een-moment');
    });
  });
}
