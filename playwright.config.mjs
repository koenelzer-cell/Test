// Playwright: tests in een echte Chromium (npm run test:e2e).
//   e2e/zijpaneel.spec.mjs  pages/sidepanel.html met dist/ en een nep-'chrome'
//                           (e2e/nep-chrome.js), zonder geladen extensie;
//   e2e/extensie.spec.mjs   de uitgepakte extensie zelf, met vaste ONS-pagina's.
// Geen van beide heeft ONS nodig.
// PW_CHROMIUM: pad naar een eigen Chromium als de meegeleverde niet past.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    headless: true,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
